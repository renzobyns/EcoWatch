"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Briefcase, LayoutDashboard, Map, History, HelpCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useUnreadNotificationCount } from "@/lib/notification-poll";
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

// useSearchParams() (used in CleanerPortalInner) needs a Suspense boundary so the
// page doesn't bail out of static prerendering at build time.
export default function CleanerPortal() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}>
            <CleanerPortalInner />
        </Suspense>
    );
}

interface CleanerUser {
    id: number;
    email: string;
    full_name?: string;
    role: string;
}

interface CleanerWorkOrder {
    id: number;
    report_id: number;
    assigned_cleaner_id?: number | null;
    priority: string;
    sla_deadline: string;
    status: string;
    notes?: string | null;
    created_at: string;
    started_at?: string | null;
    completed_at?: string | null;
    report_tracking_id?: string | null;
    report_barangay?: string | null;
    report_lat?: number | null;
    report_lon?: number | null;
    report_image_url?: string | null;
    report_status?: string | null;
    report_verification_pending?: boolean;
    cleanup_verification_result?: string | null;
    cleanup_guide_used?: boolean | null;
    cleanup_distance_m?: number | null;
    cleanup_phash?: string | null;
    [key: string]: unknown;
}

function CleanerPortalInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [user, setUser] = useState<CleanerUser | null>(null);
    const [workOrders, setWorkOrders] = useState<CleanerWorkOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [selectedWorkOrder, setSelectedWorkOrder] = useState<CleanerWorkOrder | null>(null);
    const rawTab = searchParams.get('tab');
    const [activeView, setActiveView] = useState<CleanerView>(
        CLEANER_NAV.some(n => n.key === rawTab) ? (rawTab as CleanerView) : 'dashboard'
    );
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

    const [unreadCount, setUnreadCount] = useUnreadNotificationCount(user?.id);

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
        window.addEventListener("ecowatch:open-target", handler as EventListener);
        return () => window.removeEventListener("ecowatch:open-target", handler as EventListener);
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
            setSelectedWorkOrder((prev) =>
                prev?.id === workOrderId ? { ...prev, ...data.work_order } : prev
            );
            toast.success("Work started. Go clean!");
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Network error");
        } finally {
            setActionLoading(false);
        }
    };

    const handleComplete = async (
        workOrderId: number,
        images: File[],
        cleanerLat?: number,
        cleanerLon?: number,
        guideUsed?: boolean,
        sessionId?: string
    ) => {
        setActionLoading(true);
        const formData = new FormData();
        images.forEach((img) => formData.append("cleanup_images", img));
        // Append cleaner GPS for proximity audit (optional — backend accepts but doesn't require)
        if (cleanerLat != null) formData.append("cleaner_lat", String(cleanerLat));
        if (cleanerLon != null) formData.append("cleaner_lon", String(cleanerLon));
        if (guideUsed != null) formData.append("guide_used", String(guideUsed));
        if (sessionId) formData.append("session_id", sessionId);

        try {
            const data = await api(`/work-orders/${workOrderId}/complete`, {
                method: "PUT",
                body: formData,
            });
            // 202: cleanup photo saved, AI runs in background. Show "verifying" then poll.
            setWorkOrders((prev) =>
                prev.map((wo) => (wo.id === workOrderId ? { ...wo, ...data.work_order } : wo))
            );
            setSelectedWorkOrder((prev) =>
                prev?.id === workOrderId ? { ...prev, ...data.work_order } : prev
            );
            toast.info("Cleanup photo uploaded. Multi-phase AI verification running…");
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
                    const fresh = data.find((wo: CleanerWorkOrder) => wo.id === workOrderId);
                    if (fresh) {
                        setSelectedWorkOrder((prev) =>
                            prev?.id === workOrderId ? { ...prev, ...fresh } : prev
                        );
                        if (!fresh.report_verification_pending) {
                            if (fresh.status === "needs_redo") {
                                let reason = "AI detected issues with cleanup proof. Please review and retake.";
                                if (fresh.cleanup_verification_result) {
                                    try {
                                        const parsed = typeof fresh.cleanup_verification_result === "string"
                                            ? JSON.parse(fresh.cleanup_verification_result)
                                            : fresh.cleanup_verification_result;
                                        if (parsed.summary_message || parsed.reason) {
                                            reason = parsed.summary_message || parsed.reason;
                                        }
                                    } catch {}
                                }
                                toast.warning(reason);
                            } else if (fresh.status === "verified") {
                                toast.success("Work completed and verified! Thank you!");
                            } else if (fresh.status === "completed") {
                                toast.info("Cleanup submitted. Awaiting supervisor/CENRO review.");
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

    if (!user) return null;

    return (
        <PortalShell
            brand={{ name: "EcoWatch", suffix: "Cleaner" }}
            role="CLEANER"
            nav={CLEANER_NAV}
            activeKey={activeView}
            onNavChange={(k) => {
                setActiveView(k as CleanerView);
                router.replace('?tab=' + k, { scroll: false });
            }}
            notificationCount={unreadCount}
        >
            <div className="max-w-[1600px] mx-auto h-full flex flex-col gap-5">
                {activeView === "dashboard" && (
                    <DashboardTab
                        user={user}
                        workOrders={workOrders}
                        onOpenWO={setSelectedWorkOrder}
                        onJump={(v) => setActiveView(v as CleanerView)}
                        loading={loading}
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
