"use client";

import { AlertTriangle, Clock, ShieldCheck, Activity, Settings2, History, Award, FileDown, RefreshCw, TrendingUp } from "lucide-react";
import { formatDateTime } from "@/lib/date-utils";

type ComplianceData = {
    city_wide: {
        compliance_rate: number;
        total_completed: number;
        on_time: number;
        avg_resolution_days: number;
        active_breaches: number;
        at_risk_24h: number;
    };
    by_barangay: Array<{
        barangay: string;
        total_wos: number;
        total_completed: number;
        on_time: number;
        compliance_rate: number;
        avg_resolution_days: number;
        active_breaches: number;
    }>;
};

type WorkOrder = {
    id: number;
    report_id: number;
    report_tracking_id: string | null;
    report_barangay: string | null;
    priority: string;
    sla_deadline: string;
    status: string;
    assigned_cleaner_name: string | null;
    overdue_seconds?: number;
    overdue_hours?: number;
    overdue_days?: number;
    remaining_seconds?: number;
    remaining_hours?: number;
};

type HistoryEntry = {
    id: number;
    user_email: string | null;
    user_full_name: string | null;
    created_at: string;
    old_policy: Record<string, number> | null;
    new_policy: Record<string, number> | null;
};

type LastModified = {
    user_email: string | null;
    user_full_name: string | null;
    created_at: string;
} | null;

interface Props {
    loading: boolean;
    compliance: ComplianceData | null;
    breached: WorkOrder[];
    atRisk: WorkOrder[];
    history: HistoryEntry[];
    lastModified: LastModified;
    slaPolicy: { low: number; medium: number; high: number; compliance_target: number };
    exporting: boolean;
    onExport: () => void;
    onEditPolicy: () => void;
    onRefresh: () => void;
}

const PRIORITY_PILL: Record<string, string> = {
    low: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    medium: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    high: "bg-red-500/20 text-red-300 border-red-500/30",
};

const WO_STATUS_PILL: Record<string, string> = {
    assigned: "bg-blue-500/20 text-blue-300",
    in_progress: "bg-yellow-500/20 text-yellow-300",
    needs_redo: "bg-orange-500/20 text-orange-300",
    completed: "bg-emerald-500/20 text-emerald-300",
    verified: "bg-emerald-500/20 text-emerald-300",
};

function formatOverdue(hours: number, days: number): string {
    if (days >= 1) {
        const h = hours - days * 24;
        return h > 0 ? `${days}d ${h}h` : `${days}d`;
    }
    return `${Math.max(hours, 0)}h`;
}

function formatRemaining(seconds: number): string {
    if (seconds <= 0) return "now";
    const h = Math.floor(seconds / 3600);
    if (h < 1) {
        const m = Math.floor(seconds / 60);
        return `${m}m`;
    }
    if (h >= 24) {
        const d = Math.floor(h / 24);
        const rh = h - d * 24;
        return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
    }
    return `${h}h`;
}

function remainingPillColor(seconds: number): string {
    if (seconds <= 4 * 3600) return "bg-red-500/20 text-red-300 border-red-500/30";
    if (seconds <= 12 * 3600) return "bg-orange-500/20 text-orange-300 border-orange-500/30";
    return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
}

function complianceColor(rate: number, target: number): string {
    if (rate >= target) return "text-emerald-300";
    if (rate >= target - 10) return "text-yellow-300";
    return "text-red-300";
}

function describePolicyDiff(oldPolicy: Record<string, number> | null, newPolicy: Record<string, number> | null): string {
    if (!newPolicy || typeof newPolicy !== "object") return "Policy updated";
    const labels: Record<string, string> = {
        low: "Low",
        medium: "Medium",
        high: "High",
        compliance_target: "Target",
    };
    const parts: string[] = [];
    for (const [key, val] of Object.entries(newPolicy)) {
        const oldVal = oldPolicy?.[key];
        const suffix = key === "compliance_target" ? "%" : "d";
        if (oldVal !== undefined && oldVal !== val) {
            parts.push(`${labels[key] || key}: ${oldVal}${suffix} → ${val}${suffix}`);
        } else {
            parts.push(`${labels[key] || key}: ${val}${suffix}`);
        }
    }
    return parts.join(" · ");
}

export function SlaManagementTab({
    loading, compliance, breached, atRisk, history, lastModified, slaPolicy,
    exporting, onExport, onEditPolicy, onRefresh,
}: Props) {
    const cw = compliance?.city_wide;
    const byBarangay = compliance?.by_barangay || [];
    const topPerforming = [...byBarangay]
        .filter((b) => b.total_wos > 0)
        .sort((a, b) => b.compliance_rate - a.compliance_rate)
        .slice(0, 3);

    return (
        <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto scrollbar-hide pb-8">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">SLA Management</h1>
                    <p className="text-sm text-foreground/50 mt-1">Monitor and manage service level agreement compliance across city barangays.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onRefresh}
                        disabled={loading}
                        className="px-4 h-9 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium tracking-tight rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                        Refresh
                    </button>
                    <button
                        onClick={onExport}
                        disabled={exporting}
                        className="px-4 h-9 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium tracking-tight rounded-md transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                    >
                        <FileDown size={16} />
                        {exporting ? "Exporting…" : "Generate Report"}
                    </button>
                </div>
            </div>

            {/* Row 1 - 4 KPI cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 shrink-0 animate-slide-up">
                <KpiCard
                    label="Active Breaches"
                    value={cw ? cw.active_breaches.toString() : "—"}
                    icon={<AlertTriangle size={22} />}
                    tone={cw && cw.active_breaches > 0 ? "red" : "default"}
                />
                <KpiCard
                    label="At-Risk Next 24h"
                    value={cw ? cw.at_risk_24h.toString() : "—"}
                    icon={<Clock size={22} />}
                    tone={cw && cw.at_risk_24h > 0 ? "yellow" : "default"}
                />
                <KpiCard
                    label="City-Wide Compliance"
                    value={cw ? `${cw.compliance_rate}%` : "—"}
                    icon={<ShieldCheck size={22} />}
                    tone={cw ? (cw.compliance_rate >= slaPolicy.compliance_target ? "default" : cw.compliance_rate >= slaPolicy.compliance_target - 10 ? "yellow" : "red") : "default"}
                />
                <KpiCard
                    label="Avg Resolution Time"
                    value={cw ? `${cw.avg_resolution_days}d` : "—"}
                    icon={<Activity size={22} />}
                    tone="default"
                />
            </div>

            {/* Row 2 - Active Breaches (left) + At-Risk Queue (right) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0 animate-slide-up stagger-2">
                {/* Active Breaches */}
                <div className="lg:col-span-2 bg-card p-6 rounded-lg border border-border shadow-sm">
                    <div className="flex items-center justify-between mb-5 relative z-10 flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                            <AlertTriangle size={20} className="text-red-400" />
                            <h2 className="text-base font-bold text-foreground">Active Breaches</h2>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-600 dark:text-red-400 tracking-tight">
                                {breached.length} {breached.length === 1 ? "WO" : "WOs"}
                            </span>
                        </div>
                        {breached.length > 0 && (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 tracking-tight">
                                Immediate Action Required
                            </span>
                        )}
                    </div>
                    <div className="relative z-10 overflow-x-auto">
                        {loading ? (
                            <SkeletonRows />
                        ) : breached.length === 0 ? (
                            <EmptyState
                                icon={<ShieldCheck size={32} className="text-emerald-400/60" />}
                                title="No active breaches"
                                subtitle="All cleanup work orders are on schedule."
                            />
                        ) : (
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground font-medium tracking-tight">
                                        <th className="py-3 px-4 rounded-tl-lg">Report ID</th>
                                        <th className="py-3 px-4">Barangay</th>
                                        <th className="py-3 px-4">Priority</th>
                                        <th className="py-3 px-4">Overdue</th>
                                        <th className="py-3 px-4">Cleaner</th>
                                        <th className="py-3 px-4 rounded-tr-lg">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {breached.slice(0, 8).map((wo) => (
                                        <tr key={wo.id} className="border-b border-border/50 hover:bg-muted/50">
                                            <td className="py-3 px-4 font-mono text-xs text-foreground">{wo.report_tracking_id || `WO-${wo.id}`}</td>
                                            <td className="py-3 px-4 text-foreground/80">{wo.report_barangay || "—"}</td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-tight border ${PRIORITY_PILL[wo.priority] || "bg-muted text-muted-foreground border-border"}`}>
                                                    {wo.priority}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-red-600 dark:text-red-400 font-medium text-sm">
                                                {formatOverdue(wo.overdue_hours || 0, wo.overdue_days || 0)}
                                            </td>
                                            <td className="py-3 px-4 text-foreground/80 text-xs">{wo.assigned_cleaner_name || "Unassigned"}</td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-tight ${WO_STATUS_PILL[wo.status] || "bg-muted text-muted-foreground"}`}>
                                                    BREACHED
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        {breached.length > 8 && (
                            <p className="text-[11px] text-foreground/50 mt-3 italic">+ {breached.length - 8} more breaches not shown — see full table below.</p>
                        )}
                    </div>
                </div>

                {/* At-Risk Queue */}
                <div className="lg:col-span-1 bg-card p-6 rounded-lg border border-border shadow-sm">
                    <div className="flex items-center justify-between mb-5 relative z-10">
                        <div className="flex items-center gap-2">
                            <Clock size={18} className="text-muted-foreground" />
                            <h2 className="text-base font-bold text-foreground">At-Risk Queue (24h)</h2>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-tight bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">
                            {atRisk.length} {atRisk.length === 1 ? "WO" : "WOs"}
                        </span>
                    </div>
                    <div className="relative z-10 space-y-2.5">
                        {loading ? (
                            <SkeletonCards count={3} />
                        ) : atRisk.length === 0 ? (
                            <EmptyState
                                icon={<ShieldCheck size={28} className="text-emerald-400/60" />}
                                title="Nothing at risk"
                                subtitle="No WOs breaching in the next 24 hours."
                                small
                            />
                        ) : (
                            atRisk.slice(0, 6).map((wo) => (
                                <div key={wo.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-foreground/5 border border-border hover:border-yellow-500/30 transition-colors">
                                    <div className="min-w-0">
                                        <div className="font-mono text-xs font-bold text-foreground truncate">{wo.report_tracking_id || `WO-${wo.id}`}</div>
                                        <div className="text-[11px] text-foreground/50 truncate mt-0.5">{wo.report_barangay || "—"}</div>
                                    </div>
                                    <span className={`px-2 py-1 rounded-md text-[10px] font-semibold tracking-tight border whitespace-nowrap ${remainingPillColor(wo.remaining_seconds || 0)}`}>
                                        Breach in {formatRemaining(wo.remaining_seconds || 0)}
                                    </span>
                                </div>
                            ))
                        )}
                        {atRisk.length > 6 && (
                            <p className="text-[11px] text-foreground/50 italic text-center pt-2">+ {atRisk.length - 6} more in queue</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Row 3 - History (left) + Policy Config + Top Performing (right) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0 animate-slide-up stagger-3">
                {/* SLA Policy History (timeline) */}
                <div className="lg:col-span-2 bg-card p-6 rounded-lg border border-border shadow-sm">
                    <div className="flex items-center gap-2 mb-5 relative z-10">
                        <History size={18} className="text-muted-foreground" />
                        <h2 className="text-base font-bold text-foreground">SLA Policy History</h2>
                    </div>
                    <div className="relative z-10">
                        {loading ? (
                            <SkeletonRows count={3} />
                        ) : history.length === 0 ? (
                            <EmptyState
                                icon={<History size={28} className="text-foreground/30" />}
                                title="No policy changes yet"
                                subtitle="Threshold edits will appear here for audit."
                                small
                            />
                        ) : (
                            <div className="space-y-4">
                                {history.slice(0, 8).map((entry, idx) => (
                                    <div key={entry.id} className="flex items-start gap-4 relative">
                                        <div className="flex flex-col items-center shrink-0 pt-1">
                                            <div className="w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-primary/20" />
                                            {idx < Math.min(history.length, 8) - 1 && (
                                                <div className="w-px flex-1 bg-border mt-1 min-h-[28px]" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 pb-4">
                                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                                <div className="font-semibold text-foreground text-sm">SLA Policy Updated</div>
                                                <div className="text-[11px] text-foreground/40">{formatDateTime(entry.created_at)}</div>
                                            </div>
                                            <div className="text-[11px] text-foreground/60 mt-1">
                                                By <span className="text-emerald-300 font-semibold">{entry.user_full_name || entry.user_email || "Unknown"}</span>
                                            </div>
                                            <div className="text-[11px] text-yellow-300/80 mt-1 font-mono">
                                                {describePolicyDiff(entry.old_policy, entry.new_policy)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right column: SLA Policy Config + Top Performing */}
                <div className="lg:col-span-1 flex flex-col gap-6">
                    {/* SLA Policy Config */}
                    <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <div className="flex items-center gap-2">
                                <Settings2 size={18} className="text-muted-foreground" />
                                <h2 className="text-base font-bold text-foreground">SLA Policy Config</h2>
                            </div>
                        </div>

                        <div className="relative z-10 space-y-3">
                            <div className="grid grid-cols-3 gap-2">
                                <PolicyTile label="Low" value={slaPolicy.low} unit="d" />
                                <PolicyTile label="Medium" value={slaPolicy.medium} unit="d" />
                                <PolicyTile label="High" value={slaPolicy.high} unit="d" />
                            </div>

                            <div className="pt-1">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-medium text-muted-foreground">Compliance Threshold</span>
                                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{slaPolicy.compliance_target}% Target</span>
                                </div>
                                <div className="h-2 rounded-full bg-foreground/10 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${cw && cw.compliance_rate >= slaPolicy.compliance_target ? "bg-emerald-400" : "bg-yellow-400"}`}
                                        style={{ width: `${Math.min(100, cw?.compliance_rate ?? 0)}%` }}
                                    />
                                </div>
                                <div className="text-[10px] text-foreground/40 mt-1 text-right">
                                    Current: <span className={complianceColor(cw?.compliance_rate ?? 0, slaPolicy.compliance_target)}>{cw?.compliance_rate ?? 0}%</span>
                                </div>
                            </div>

                            {lastModified && (
                                <p className="text-[10px] text-foreground/40 pt-1">
                                    Last modified by <span className="text-foreground/70 font-semibold">{lastModified.user_full_name || lastModified.user_email}</span> on {formatDateTime(lastModified.created_at)}
                                </p>
                            )}

                            <button
                                onClick={onEditPolicy}
                                className="w-full px-4 h-9 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium tracking-tight rounded-md transition-colors flex items-center justify-center gap-2"
                            >
                                <Settings2 size={16} />
                                Edit SLA Policy
                            </button>
                        </div>
                    </div>

                    {/* Top Performing Barangays */}
                    <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
                        <div className="flex items-center gap-2 mb-4 relative z-10">
                            <Award size={18} className="text-muted-foreground" />
                            <h2 className="text-base font-bold text-foreground">Top Performing Barangays</h2>
                        </div>
                        <div className="relative z-10 space-y-3">
                            {loading ? (
                                <SkeletonRows count={3} />
                            ) : topPerforming.length === 0 ? (
                                <p className="text-xs text-foreground/40 italic text-center py-4">No completed work orders yet.</p>
                            ) : (
                                topPerforming.map((b, idx) => (
                                    <div key={b.barangay} className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                                                {idx + 1}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-semibold text-sm text-foreground truncate">{b.barangay}</div>
                                                <div className="text-[10px] text-foreground/40">{b.total_wos} Total WOs</div>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className={`text-base font-bold ${complianceColor(b.compliance_rate, slaPolicy.compliance_target)}`}>{b.compliance_rate}%</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Row 4 - Full Per-Barangay Performance Table */}
            <div className="bg-card p-6 rounded-lg border border-border shadow-sm shrink-0 animate-slide-up stagger-4">
                <div className="flex items-center justify-between mb-5 relative z-10 flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                        <TrendingUp size={18} className="text-muted-foreground" />
                        <h2 className="text-base font-bold text-foreground">Per-Barangay SLA Performance</h2>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-tight bg-muted text-muted-foreground">
                            sorted worst → best
                        </span>
                    </div>
                </div>
                <div className="relative z-10 overflow-x-auto">
                    {loading ? (
                        <SkeletonRows count={5} />
                    ) : byBarangay.length === 0 ? (
                        <EmptyState
                            icon={<TrendingUp size={32} className="text-foreground/30" />}
                            title="No data yet"
                            subtitle="Work orders will populate this table as they are created."
                        />
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground font-medium tracking-tight">
                                    <th className="py-3 px-4 rounded-tl-lg">Barangay</th>
                                    <th className="py-3 px-4 text-right">Total WOs</th>
                                    <th className="py-3 px-4 text-right">Completed</th>
                                    <th className="py-3 px-4 text-right">On-Time</th>
                                    <th className="py-3 px-4 text-right">Compliance</th>
                                    <th className="py-3 px-4 text-right">Avg Days</th>
                                    <th className="py-3 px-4 text-right rounded-tr-lg">Active Breaches</th>
                                </tr>
                            </thead>
                            <tbody>
                                {byBarangay.map((b) => (
                                    <tr key={b.barangay} className="border-b border-border/50 hover:bg-muted/50">
                                        <td className="py-3 px-4 font-semibold text-foreground">{b.barangay}</td>
                                        <td className="py-3 px-4 text-right text-foreground/70">{b.total_wos}</td>
                                        <td className="py-3 px-4 text-right text-foreground/70">{b.total_completed}</td>
                                        <td className="py-3 px-4 text-right text-foreground/70">{b.on_time}</td>
                                        <td className={`py-3 px-4 text-right font-bold ${complianceColor(b.compliance_rate, slaPolicy.compliance_target)}`}>
                                            {b.compliance_rate}%
                                        </td>
                                        <td className="py-3 px-4 text-right text-foreground/70">{b.avg_resolution_days}d</td>
                                        <td className="py-3 px-4 text-right">
                                            {b.active_breaches > 0 ? (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-tight bg-red-500/20 text-red-600 dark:text-red-400">
                                                    {b.active_breaches}
                                                </span>
                                            ) : (
                                                <span className="text-foreground/30">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

// Sub-components

function KpiCard({ label, value, icon, tone = "default" }: { label: string; value: string; icon: React.ReactNode; tone?: "red" | "yellow" | "emerald" | "blue" | "default" }) {
    const toneClasses = {
        red: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
        yellow: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20",
        emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
        blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
        default: "bg-primary/10 text-primary border border-primary/20",
    } as const;
    return (
        <div className="bg-card border border-border shadow-sm p-5 rounded-lg flex items-center justify-between gap-4">
            <div className="min-w-0">
                <div className="text-sm font-medium text-muted-foreground mb-1 truncate">{label}</div>
                <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
            </div>
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${toneClasses[tone]}`}>
                {icon}
            </div>
        </div>
    );
}

function PolicyTile({ label, value, unit }: { label: string; value: number; unit: string }) {
    return (
        <div className={`p-3 rounded-lg border bg-muted/50 border-border text-center`}>
            <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
            <div className="text-xl font-bold text-foreground">{value}{unit}</div>
        </div>
    );
}

function SkeletonRows({ count = 4 }: { count?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-2 border-b border-border/50 animate-pulse">
                    <div className="h-4 bg-muted rounded w-24 shrink-0" />
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-4 bg-muted rounded w-16 ml-auto" />
                </div>
            ))}
        </div>
    );
}

function SkeletonCards({ count = 3 }: { count?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border animate-pulse">
                    <div className="w-10 h-10 bg-muted rounded-md shrink-0" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3 bg-muted rounded w-1/3" />
                        <div className="h-2 bg-muted rounded w-1/2" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function EmptyState({ icon, title, subtitle, small }: { icon: React.ReactNode; title: string; subtitle: string; small?: boolean }) {
    return (
        <div className={`flex flex-col items-center justify-center text-center ${small ? "py-8" : "py-12"} gap-2 border border-dashed border-border rounded-lg bg-card`}>
            <div className="text-muted-foreground/50 mb-1">{icon}</div>
            <p className="text-sm font-medium text-foreground/80">{title}</p>
            <p className="text-xs text-muted-foreground max-w-xs">{subtitle}</p>
        </div>
    );
}
