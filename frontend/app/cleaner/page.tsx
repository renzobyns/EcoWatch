"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Briefcase, LayoutDashboard, Map, History, HelpCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { PortalShell, type PortalNavItem } from "@/components/portal/PortalShell";
import { CleanerJobDrawer } from "@/components/portal/CleanerJobDrawer";
import { DashboardTab } from "./tabs/DashboardTab";
import { JobsTab } from "./tabs/JobsTab";
import { MapTab } from "./tabs/MapTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { HelpTab } from "./tabs/HelpTab";

type CleanerView = "dashboard" | "jobs" | "map_view" | "history" | "help";

const CLEANER_NAV: PortalNavItem[] = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, subtitle: "My day at a glance" },
    { key: "jobs", label: "My Jobs", icon: Briefcase },
    { key: "map_view", label: "Map View", icon: Map },
    { key: "history", label: "History", icon: History, sectionBreakBefore: true },
    { key: "help", label: "Help", icon: HelpCircle },
];

const UNREAD_POLL_MS = 30_000;

export default function CleanerPortal() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [workOrders, setWorkOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [selectedWorkOrder, setSelectedWorkOrder] = useState<any>(null);
    const [activeView, setActiveView] = useState<CleanerView>("dashboard");
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        // Auth check
        const storedUser = localStorage.getItem("ecowatch_user");
        if (!storedUser) {
            router.push("/login");
            return;
        }

        const parsed = JSON.parse(storedUser);
        if (parsed.role !== "cleaner") {
            router.push("/");
            return;
        }

        setUser(parsed);
    }, [router]);

    useEffect(() => {
        if (!user?.id) return;
        fetchWorkOrders();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    // Poll unread count every 30s
    useEffect(() => {
        if (!user?.id) return;
        let cancelled = false;
        const tick = async () => {
            try {
                const data = await api(`/notifications/cleaner/${user.id}/unread-count`);
                if (!cancelled && typeof data?.unread_count === "number") {
                    setUnreadCount(data.unread_count);
                }
            } catch {
                /* silent — background poll */
            }
        };
        tick();
        const id = setInterval(tick, UNREAD_POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [user?.id]);

    // Listen for notification dropdown click → open the related WO drawer
    useEffect(() => {
        const handler = (e: Event) => {
            const ce = e as CustomEvent<{ work_order_id: number }>;
            const woId = ce.detail?.work_order_id;
            if (woId == null) return;
            const wo = workOrders.find((w) => w.id === woId);
            if (wo) {
                setSelectedWorkOrder(wo);
            } else {
                // WO may not be in current list (e.g. switched cleaners); refetch then try once more
                fetchWorkOrders().then(() => {
                    setWorkOrders((current) => {
                        const found = current.find((w) => w.id === woId);
                        if (found) setSelectedWorkOrder(found);
                        return current;
                    });
                });
            }
            // Also reduce unread count optimistically (the click already marks-read in dropdown)
            setUnreadCount((c) => Math.max(0, c - 1));
        };
        window.addEventListener("cleaner:open-wo", handler as EventListener);
        return () => window.removeEventListener("cleaner:open-wo", handler as EventListener);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workOrders]);

    const fetchWorkOrders = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const data = await api(`/work-orders/cleaner/${user.id}`);
            if (Array.isArray(data)) {
                setWorkOrders(data);
            }
        } catch (err) {
            if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
                toast.error("Session expired. Please log in again.");
                localStorage.removeItem("ecowatch_user");
                router.push("/login");
                return;
            }
            toast.error(err instanceof ApiError ? err.message : "Couldn't load your jobs.");
        } finally {
            setLoading(false);
        }
    };

    const handleStart = async (workOrderId: number) => {
        setActionLoading(true);
        try {
            const data = await api(`/work-orders/${workOrderId}/start`, { method: "PUT" });
            setWorkOrders((prev) =>
                prev.map((wo) => (wo.id === workOrderId ? { ...wo, ...data.work_order } : wo))
            );
            setSelectedWorkOrder((prev: any) =>
                prev?.id === workOrderId ? { ...prev, ...data.work_order } : prev
            );
            toast.success("Work started. Go clean!");
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Network error");
        } finally {
            setActionLoading(false);
        }
    };

    const handleComplete = async (workOrderId: number, image: File) => {
        setActionLoading(true);
        const formData = new FormData();
        formData.append("cleanup_image", image);

        try {
            const data = await api(`/work-orders/${workOrderId}/complete`, {
                method: "PUT",
                body: formData,
            });
            // 202: cleanup photo saved, AI runs in background. Show "verifying" then poll.
            setWorkOrders((prev) =>
                prev.map((wo) => (wo.id === workOrderId ? { ...wo, ...data.work_order } : wo))
            );
            setSelectedWorkOrder((prev: any) =>
                prev?.id === workOrderId ? { ...prev, ...data.work_order } : prev
            );
            toast.info("Cleanup photo uploaded. AI verifying…");
            pollCompleteOutcome(workOrderId);
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Upload failed. Tap Submit to try again.");
        } finally {
            setActionLoading(false);
        }
    };

    const pollCompleteOutcome = (workOrderId: number) => {
        if (!user?.id) return;
        let attempts = 0;
        const MAX_ATTEMPTS = 40; // ~2 minutes at 3s
        const tick = async () => {
            attempts++;
            try {
                const data = await api(`/work-orders/cleaner/${user.id}`);
                if (Array.isArray(data)) {
                    setWorkOrders(data);
                    const fresh = data.find((wo: any) => wo.id === workOrderId);
                    if (fresh) {
                        setSelectedWorkOrder((prev: any) =>
                            prev?.id === workOrderId ? { ...prev, ...fresh } : prev
                        );
                        if (!fresh.report_verification_pending) {
                            if (fresh.status === "needs_redo") {
                                toast.warning("AI detected waste is still present. Clean thoroughly and try again.");
                            } else if (fresh.status === "verified") {
                                toast.success("Work completed! Thank you!");
                                setSelectedWorkOrder((prev: any) => prev?.id === workOrderId ? null : prev);
                            }
                            return;
                        }
                    }
                }
            } catch { /* transient — retry */ }
            if (attempts < MAX_ATTEMPTS) setTimeout(tick, 3000);
            else toast.error("AI verification is taking longer than expected. Pull-to-refresh later for the result.");
        };
        setTimeout(tick, 1500);
    };

    if (loading && !user) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white p-1 shadow-[0_0_30px_rgba(16,185,129,0.3)] animate-pulse">
                    <img src="/logo.png" alt="Loading..." className="w-full h-full object-contain" />
                </div>
                <div className="text-emerald-500 font-bold tracking-widest uppercase text-sm animate-pulse">
                    Initializing Portal...
                </div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <PortalShell
            brand={{ name: "EcoWatch", suffix: "Cleaner" }}
            role="CLEANER"
            nav={CLEANER_NAV}
            activeKey={activeView}
            onNavChange={(k) => setActiveView(k as CleanerView)}
            notificationCount={unreadCount}
        >
            <div className="max-w-[1600px] mx-auto h-full flex flex-col gap-5">
                {activeView === "dashboard" && (
                    <DashboardTab
                        user={user}
                        workOrders={workOrders}
                        onOpenWO={setSelectedWorkOrder}
                        onJump={(v) => setActiveView(v as CleanerView)}
                    />
                )}
                {activeView === "jobs" && (
                    <JobsTab
                        user={user}
                        workOrders={workOrders}
                        onOpenWO={setSelectedWorkOrder}
                        loading={loading}
                    />
                )}
                {activeView === "map_view" && (
                    <MapTab user={user} workOrders={workOrders} onOpenWO={setSelectedWorkOrder} />
                )}
                {activeView === "history" && (
                    <HistoryTab user={user} workOrders={workOrders} onOpenWO={setSelectedWorkOrder} />
                )}
                {activeView === "help" && <HelpTab user={user} />}
            </div>

            {selectedWorkOrder && (
                <CleanerJobDrawer
                    workOrder={selectedWorkOrder}
                    onClose={() => setSelectedWorkOrder(null)}
                    onStart={handleStart}
                    onComplete={handleComplete}
                    actionLoading={actionLoading}
                />
            )}
        </PortalShell>
    );
}
