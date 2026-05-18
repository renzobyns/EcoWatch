"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Briefcase } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { slaDeadlineLabel, slaDeadlineColor, SLA_PILL_CLASSES } from "@/lib/sla";
import { PortalShell, type PortalNavItem } from "@/components/portal/PortalShell";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const CLEANER_NAV: PortalNavItem[] = [
    { key: "jobs", label: "Jobs", icon: Briefcase },
];

export default function CleanerPortal() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [workOrders, setWorkOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [selectedWorkOrder, setSelectedWorkOrder] = useState<any>(null);
    const [cleanupImage, setCleanupImage] = useState<File | null>(null);
    const [cleanupPreview, setCleanupPreview] = useState<string | null>(null);

    useEffect(() => {
        // Auth Check
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

    const fetchWorkOrders = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const data = await api(`/work-orders/cleaner/${user.id}`);
            if (Array.isArray(data)) {
                setWorkOrders(data);
            }
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to load work orders");
        } finally {
            setLoading(false);
        }
    };

    const handleStart = async (workOrderId: number) => {
        setActionLoading(true);
        try {
            const data = await api(`/work-orders/${workOrderId}/start`, { method: "PUT" });
            setWorkOrders(
                workOrders.map((wo) =>
                    wo.id === workOrderId ? { ...wo, ...data.work_order } : wo
                )
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

    const handleComplete = async (workOrderId: number) => {
        if (!cleanupImage) {
            toast.error("Please upload a cleanup verification photo.");
            return;
        }
        setActionLoading(true);

        const formData = new FormData();
        formData.append("cleanup_image", cleanupImage);

        try {
            const data = await api(`/work-orders/${workOrderId}/complete`, {
                method: "PUT",
                body: formData,
            });
            setWorkOrders(
                workOrders.map((wo) =>
                    wo.id === workOrderId ? { ...wo, ...data.work_order } : wo
                )
            );
            setSelectedWorkOrder((prev) =>
                prev?.id === workOrderId ? { ...prev, ...data.work_order } : prev
            );
            setCleanupImage(null);
            setCleanupPreview(null);

            if (data.work_order.status === "needs_redo") {
                toast.warning(
                    "AI detected waste is still present. Clean thoroughly and try again."
                );
            } else {
                toast.success("Work completed! Thank you!");
                setSelectedWorkOrder(null);
            }
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Network error");
        } finally {
            setActionLoading(false);
        }
    };

    if (loading || !user) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white p-1 shadow-[0_0_30px_rgba(16,185,129,0.3)] animate-pulse">
                    <img
                        src="/logo.png"
                        alt="Loading..."
                        className="w-full h-full object-contain"
                    />
                </div>
                <div className="text-emerald-500 font-bold tracking-widest uppercase text-sm animate-pulse">
                    Initializing Portal...
                </div>
            </div>
        );
    }

    return (
        <PortalShell
            brand={{ name: "EcoWatch", suffix: "Cleaner" }}
            role="CLEANER"
            nav={CLEANER_NAV}
            activeKey="jobs"
            onNavChange={() => { /* single-item nav */ }}
        >
            <div className="max-w-3xl mx-auto relative">
                {/* Header */}
                <div className="mb-6 animate-slide-up">
                    <h1 className="text-2xl font-bold text-foreground mb-2 tracking-tight">
                        My <span className="text-primary">Jobs</span>
                    </h1>
                    <p className="text-emerald-400 font-semibold uppercase tracking-[0.18em] text-[11px] px-2.5 py-0.5 bg-emerald-400/10 rounded-full w-fit border border-emerald-400/20">
                        {user.barangay_assignment}
                    </p>
                </div>

                {/* Work Orders List */}
                <div className="glass rounded-2xl border border-border shadow-2xl overflow-hidden animate-slide-up">
                    {loading ? (
                        <div className="p-12 text-center text-foreground/50">
                            <div className="inline-block w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                            <p className="mt-4 text-sm font-bold">Loading work orders...</p>
                        </div>
                    ) : workOrders.length === 0 ? (
                        <div className="p-12 text-center text-foreground/50 font-bold">
                            No work assigned yet. Check back soon!
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-border text-xs text-foreground/40 uppercase tracking-widest bg-black/20">
                                        <th className="p-4">Tracking ID</th>
                                        <th className="p-4">Priority</th>
                                        <th className="p-4">SLA Deadline</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {workOrders.map((wo) => {
                                        const slaLabel = slaDeadlineLabel(wo.sla_deadline);
                                        const slaColor = slaDeadlineColor(wo.sla_deadline);
                                        return (
                                            <tr
                                                key={wo.id}
                                                className="border-b border-border hover:bg-foreground/5 transition-colors"
                                            >
                                                <td className="p-4 font-mono text-sm text-foreground font-bold">
                                                    {wo.report_tracking_id}
                                                </td>
                                                <td className="p-4 text-sm font-semibold">
                                                    <span
                                                        className={`px-2.5 py-1 rounded-md text-xs uppercase tracking-wider ${
                                                            wo.priority === "high"
                                                                ? "bg-red-500/20 text-red-400"
                                                                : wo.priority === "low"
                                                                  ? "bg-blue-500/20 text-blue-400"
                                                                  : "bg-yellow-500/20 text-yellow-400"
                                                        }`}
                                                    >
                                                        {wo.priority}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <span
                                                        className={`px-2 py-1 rounded-md text-[11px] font-bold ${SLA_PILL_CLASSES[slaColor]}`}
                                                    >
                                                        {slaLabel}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <span
                                                        className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                                                            wo.status === "verified" || wo.status === "completed"
                                                                ? "bg-green-500/20 text-green-400"
                                                                : wo.status === "in_progress"
                                                                  ? "bg-yellow-500/20 text-yellow-400"
                                                                  : wo.status === "needs_redo"
                                                                    ? "bg-red-500/20 text-red-400"
                                                                    : "bg-foreground/10 text-foreground"
                                                        }`}
                                                    >
                                                        {wo.status === "needs_redo"
                                                            ? "Redo"
                                                            : wo.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    {wo.status === "assigned" && (
                                                        <button
                                                            onClick={() => handleStart(wo.id)}
                                                            disabled={actionLoading}
                                                            className="px-4 py-2 glass border border-primary text-primary text-xs font-bold rounded-lg hover:bg-primary/10 transition-colors disabled:opacity-50"
                                                        >
                                                            Start
                                                        </button>
                                                    )}
                                                    {wo.status === "in_progress" && (
                                                        <button
                                                            onClick={() => setSelectedWorkOrder(wo)}
                                                            className="px-4 py-2 glass border border-border text-foreground text-xs font-bold rounded-lg hover:bg-foreground/10 transition-colors"
                                                        >
                                                            Upload Photo
                                                        </button>
                                                    )}
                                                    {(wo.status === "verified" ||
                                                        wo.status === "completed") && (
                                                        <span className="text-xs font-bold text-green-400">
                                                            ✓ Completed
                                                        </span>
                                                    )}
                                                    {wo.status === "needs_redo" && (
                                                        <button
                                                            onClick={() => setSelectedWorkOrder(wo)}
                                                            className="px-4 py-2 glass border border-yellow-500/50 text-yellow-400 text-xs font-bold rounded-lg hover:bg-yellow-500/10 transition-colors"
                                                        >
                                                            Re-attempt
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Photo Upload Modal */}
            {selectedWorkOrder && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="glass p-6 max-w-md w-full rounded-2xl border border-border shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-bold text-foreground mb-4">
                            Upload Cleanup Photo
                        </h3>
                        <p className="text-sm text-foreground/60 mb-4">
                            {selectedWorkOrder.status === "needs_redo"
                                ? "Please clean more thoroughly and upload a new photo."
                                : "Take a clear photo showing the cleaned area."}
                        </p>

                        <label className="block w-full h-40 border-2 border-dashed border-foreground/20 hover:border-primary/50 rounded-xl mb-4 cursor-pointer overflow-hidden relative group">
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        setCleanupImage(file);
                                        const reader = new FileReader();
                                        reader.onload = (event) => {
                                            setCleanupPreview(event.target?.result as string);
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                }}
                            />
                            {cleanupPreview ? (
                                <img
                                    src={cleanupPreview}
                                    alt="Preview"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                                    <div className="text-center">
                                        <svg
                                            className="w-8 h-8 mx-auto mb-2 text-foreground/40 group-hover:text-primary transition-colors"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M12 4v16m8-8H4"
                                            />
                                        </svg>
                                        <p className="text-xs font-bold text-foreground/50">
                                            Click to upload
                                        </p>
                                    </div>
                                </div>
                            )}
                        </label>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setSelectedWorkOrder(null);
                                    setCleanupImage(null);
                                    setCleanupPreview(null);
                                }}
                                className="flex-1 px-4 py-2 glass border border-border text-foreground text-sm font-bold rounded-lg hover:bg-foreground/10 transition-colors"
                                disabled={actionLoading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleComplete(selectedWorkOrder.id)}
                                disabled={!cleanupImage || actionLoading}
                                className="flex-1 px-4 py-2 eco-gradient text-white text-sm font-bold rounded-lg shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                            >
                                {actionLoading ? "Uploading..." : "Submit"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PortalShell>
    );
}
