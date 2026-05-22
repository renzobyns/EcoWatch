"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Briefcase, Loader2, CheckCircle2, Target, AlertTriangle, ArrowRight, Activity } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { slaDeadlineLabel, slaDeadlineColor, SLA_PILL_CLASSES } from "@/lib/sla";

const MapComponent = dynamic(() => import("@/components/MapComponent"), { ssr: false });

interface DashboardTabProps {
    user: any;
    workOrders: any[];
    onOpenWO: (wo: any) => void;
    onJump: (view: string) => void;
}

interface CleanerStats {
    total_assigned: number;
    in_progress: number;
    completed: number;
    sla_compliance: number;
}

interface RecentActivityItem {
    id: number;
    status: string;
    priority: string;
    sla_deadline: string | null;
    report_tracking_id: string | null;
    created_at: string;
}

export function DashboardTab({ user, workOrders, onOpenWO, onJump }: DashboardTabProps) {
    const [stats, setStats] = useState<CleanerStats | null>(null);
    const [activity, setActivity] = useState<RecentActivityItem[]>([]);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        if (!user?.id) return;
        const load = async () => {
            try {
                const data = await api("/users/me");
                if (data?.stats) setStats(data.stats);
                if (Array.isArray(data?.recent_activity)) setActivity(data.recent_activity);
                setLoadError(false);
            } catch (err) {
                setLoadError(err instanceof ApiError);
            }
        };
        load();
    }, [user?.id]);

    // Priority alerts: open WOs that are overdue or needs_redo
    const alerts = workOrders
        .filter((w) => ["assigned", "in_progress", "needs_redo"].includes(w.status))
        .filter((w) => w.status === "needs_redo" || (w.sla_deadline && slaDeadlineColor(w.sla_deadline) === "red"))
        .slice(0, 3);

    const greeting = (() => {
        const h = new Date().getHours();
        if (h < 12) return "Good morning";
        if (h < 18) return "Good afternoon";
        return "Good evening";
    })();

    const today = new Date().toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
    });

    return (
        <div className="space-y-5 animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">
                        {greeting}, <span className="text-primary">{user?.full_name?.split(" ")[0] ?? "Cleaner"}</span>
                    </h1>
                    {user?.barangay_assignment && (
                        <p className="text-emerald-400 font-semibold uppercase tracking-[0.18em] text-[11px] mt-1 px-2.5 py-0.5 bg-emerald-400/10 rounded-full w-fit border border-emerald-400/20">
                            {user.barangay_assignment}
                        </p>
                    )}
                </div>
                <p className="text-xs text-foreground/50 font-bold uppercase tracking-widest">{today}</p>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard
                    icon={Briefcase}
                    label="Assigned"
                    value={stats?.total_assigned ?? "—"}
                    accent="text-emerald-400"
                />
                <KpiCard
                    icon={Loader2}
                    label="In Progress"
                    value={stats?.in_progress ?? "—"}
                    accent="text-yellow-400"
                />
                <KpiCard
                    icon={CheckCircle2}
                    label="Completed"
                    value={stats?.completed ?? "—"}
                    accent="text-green-400"
                />
                <KpiCard
                    icon={Target}
                    label="SLA Compliance"
                    value={stats != null ? `${stats.sla_compliance}%` : "—"}
                    accent="text-blue-400"
                />
            </div>

            {loadError && (
                <div className="glass rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-xs text-yellow-400 font-bold">
                    Couldn't load latest stats. Pull to refresh in a moment.
                </div>
            )}

            {/* Priority alerts + Map preview */}
            <div className="grid lg:grid-cols-2 gap-4">
                <div className="glass rounded-2xl border border-border shadow-2xl p-5">
                    <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-foreground/50 mb-4 flex items-center gap-2">
                        <AlertTriangle className="size-3.5" />
                        Priority Alerts
                    </h3>
                    {alerts.length === 0 ? (
                        <p className="text-sm text-foreground/50 text-center py-6">
                            Nothing urgent. You're on track.
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {alerts.map((wo) => {
                                const color = wo.sla_deadline ? slaDeadlineColor(wo.sla_deadline) : "red";
                                return (
                                    <li key={wo.id}>
                                        <button
                                            type="button"
                                            onClick={() => onOpenWO(wo)}
                                            className="w-full text-left px-3 py-2.5 rounded-xl border border-border bg-black/20 hover:bg-foreground/5 transition-colors flex items-center justify-between gap-3"
                                        >
                                            <div className="min-w-0">
                                                <p className="font-mono text-sm font-bold text-foreground truncate">
                                                    {wo.report_tracking_id ?? `WO #${wo.id}`}
                                                </p>
                                                <p className="text-[10px] uppercase tracking-widest text-foreground/50 mt-0.5">
                                                    {wo.status === "needs_redo" ? "Needs redo" : wo.priority + " priority"}
                                                </p>
                                            </div>
                                            <span className={`shrink-0 px-2 py-1 rounded-md text-[10px] font-bold ${SLA_PILL_CLASSES[color]}`}>
                                                {wo.sla_deadline ? slaDeadlineLabel(wo.sla_deadline) : "—"}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    <button
                        type="button"
                        onClick={() => onJump("jobs")}
                        className="mt-4 text-[11px] uppercase tracking-widest font-bold text-primary hover:text-primary/80 inline-flex items-center gap-1"
                    >
                        View all jobs <ArrowRight className="size-3" />
                    </button>
                </div>

                <div className="glass rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col">
                    <div className="p-5 pb-3 flex items-center justify-between">
                        <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-foreground/50">
                            Map Preview
                        </h3>
                        <button
                            type="button"
                            onClick={() => onJump("map_view")}
                            className="text-[11px] uppercase tracking-widest font-bold text-primary hover:text-primary/80 inline-flex items-center gap-1"
                        >
                            Open <ArrowRight className="size-3" />
                        </button>
                    </div>
                    <div className="flex-1 min-h-[200px]">
                        <MapComponent
                            height="200px"
                            workOrders={workOrders.filter((w) =>
                                ["assigned", "in_progress", "needs_redo"].includes(w.status)
                            )}
                            pinColorBy="priority"
                            focusedBarangay={user?.barangay_assignment ?? null}
                            onPinClick={onOpenWO}
                        />
                    </div>
                </div>
            </div>

            {/* Recent activity */}
            <div className="glass rounded-2xl border border-border shadow-2xl p-5">
                <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-foreground/50 mb-4 flex items-center gap-2">
                    <Activity className="size-3.5" />
                    Recent Activity
                </h3>
                {activity.length === 0 ? (
                    <p className="text-sm text-foreground/50 text-center py-4">No activity yet.</p>
                ) : (
                    <ul className="divide-y divide-border">
                        {activity.slice(0, 5).map((a) => (
                            <li key={a.id} className="py-2.5 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm text-foreground truncate">
                                        <span className="font-mono font-bold">{a.report_tracking_id ?? `#${a.id}`}</span>
                                        <span className="text-foreground/60"> — {a.status.replaceAll("_", " ")}</span>
                                    </p>
                                </div>
                                <span className="text-[10px] uppercase tracking-widest text-foreground/40 font-semibold shrink-0">
                                    {new Date(a.created_at).toLocaleDateString()}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

function KpiCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number | string; accent: string }) {
    return (
        <div className="glass rounded-2xl border border-border shadow-2xl p-4">
            <div className={`flex items-center gap-2 ${accent}`}>
                <Icon className="size-4" />
                <span className="text-[10px] uppercase tracking-widest font-bold">{label}</span>
            </div>
            <p className="text-3xl font-bold text-foreground mt-2 tracking-tight">{value}</p>
        </div>
    );
}
