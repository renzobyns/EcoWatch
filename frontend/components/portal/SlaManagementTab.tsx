"use client";

import { AlertTriangle, Clock, ShieldCheck, Activity, Settings2, History, Award, FileDown, RefreshCw, TrendingUp } from "lucide-react";

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
    old_policy: any;
    new_policy: any;
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

function formatDateTime(iso: string): string {
    try {
        const d = new Date(iso);
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
            " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    } catch {
        return iso;
    }
}

function complianceColor(rate: number, target: number): string {
    if (rate >= target) return "text-emerald-300";
    if (rate >= target - 10) return "text-yellow-300";
    return "text-red-300";
}

function describePolicyDiff(oldPolicy: any, newPolicy: any): string {
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
                        className="px-4 py-2 glass border border-border text-foreground/70 text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-foreground/10 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                        Refresh
                    </button>
                    <button
                        onClick={onExport}
                        disabled={exporting}
                        className="px-5 py-2 bg-emerald-500 text-emerald-950 text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-emerald-400 transition-colors shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50 flex items-center gap-2"
                    >
                        <FileDown size={14} />
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
                    tone={cw && cw.active_breaches > 0 ? "red" : "emerald"}
                />
                <KpiCard
                    label="At-Risk Next 24h"
                    value={cw ? cw.at_risk_24h.toString() : "—"}
                    icon={<Clock size={22} />}
                    tone={cw && cw.at_risk_24h > 0 ? "yellow" : "emerald"}
                />
                <KpiCard
                    label="City-Wide Compliance"
                    value={cw ? `${cw.compliance_rate}%` : "—"}
                    icon={<ShieldCheck size={22} />}
                    tone={cw ? (cw.compliance_rate >= slaPolicy.compliance_target ? "emerald" : cw.compliance_rate >= slaPolicy.compliance_target - 10 ? "yellow" : "red") : "emerald"}
                />
                <KpiCard
                    label="Avg Resolution Time"
                    value={cw ? `${cw.avg_resolution_days}d` : "—"}
                    icon={<Activity size={22} />}
                    tone="blue"
                />
            </div>

            {/* Row 2 - Active Breaches (left) + At-Risk Queue (right) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0 animate-slide-up stagger-2">
                {/* Active Breaches */}
                <div className="lg:col-span-2 glass-pro p-6 rounded-[2.5rem] border border-border bento-card relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-[80px] pointer-events-none" />
                    <div className="flex items-center justify-between mb-5 relative z-10 flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                            <AlertTriangle size={20} className="text-red-400" />
                            <h2 className="text-base font-bold text-foreground">Active Breaches</h2>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 uppercase tracking-widest">
                                {breached.length} {breached.length === 1 ? "WO" : "WOs"}
                            </span>
                        </div>
                        {breached.length > 0 && (
                            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30 uppercase tracking-widest">
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
                                    <tr className="border-b border-border text-[10px] text-foreground/40 uppercase tracking-widest">
                                        <th className="py-3 pr-4">Report ID</th>
                                        <th className="py-3 pr-4">Barangay</th>
                                        <th className="py-3 pr-4">Priority</th>
                                        <th className="py-3 pr-4">Overdue</th>
                                        <th className="py-3 pr-4">Cleaner</th>
                                        <th className="py-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {breached.slice(0, 8).map((wo) => (
                                        <tr key={wo.id} className="border-b border-border/50 hover:bg-foreground/5">
                                            <td className="py-3 pr-4 font-mono text-xs text-foreground">{wo.report_tracking_id || `WO-${wo.id}`}</td>
                                            <td className="py-3 pr-4 text-foreground/80">{wo.report_barangay || "—"}</td>
                                            <td className="py-3 pr-4">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${PRIORITY_PILL[wo.priority] || "bg-foreground/10 text-foreground/60 border-border"}`}>
                                                    {wo.priority}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-4 text-red-400 font-bold text-xs">
                                                {formatOverdue(wo.overdue_hours || 0, wo.overdue_days || 0)}
                                            </td>
                                            <td className="py-3 pr-4 text-foreground/80 text-xs">{wo.assigned_cleaner_name || "Unassigned"}</td>
                                            <td className="py-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${WO_STATUS_PILL[wo.status] || "bg-foreground/10 text-foreground/60"}`}>
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
                <div className="lg:col-span-1 glass-pro p-6 rounded-[2.5rem] border border-border bento-card relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 rounded-full blur-[80px] pointer-events-none" />
                    <div className="flex items-center justify-between mb-5 relative z-10">
                        <div className="flex items-center gap-2">
                            <Clock size={18} className="text-yellow-400" />
                            <h2 className="text-base font-bold text-foreground">At-Risk Queue (24h)</h2>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-300 uppercase tracking-widest">
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
                                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold border whitespace-nowrap ${remainingPillColor(wo.remaining_seconds || 0)}`}>
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
                <div className="lg:col-span-2 glass-pro p-6 rounded-[2.5rem] border border-border bento-card relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />
                    <div className="flex items-center gap-2 mb-5 relative z-10">
                        <History size={18} className="text-emerald-400" />
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
                                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20" />
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
                    <div className="glass-pro p-6 rounded-[2.5rem] border border-border bento-card relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />
                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <div className="flex items-center gap-2">
                                <Settings2 size={18} className="text-emerald-400" />
                                <h2 className="text-base font-bold text-foreground">SLA Policy Config</h2>
                            </div>
                        </div>

                        <div className="relative z-10 space-y-3">
                            <div className="grid grid-cols-3 gap-2">
                                <PolicyTile label="Low" value={slaPolicy.low} unit="d" tone="blue" />
                                <PolicyTile label="Medium" value={slaPolicy.medium} unit="d" tone="yellow" />
                                <PolicyTile label="High" value={slaPolicy.high} unit="d" tone="red" />
                            </div>

                            <div className="pt-1">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10px] text-foreground/50 uppercase tracking-widest font-bold">Compliance Threshold</span>
                                    <span className="text-[11px] text-emerald-300 font-bold">{slaPolicy.compliance_target}% Target</span>
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
                                className="w-full px-4 py-2.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold uppercase tracking-widest hover:bg-emerald-500/30 rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                <Settings2 size={14} />
                                Edit SLA Policy
                            </button>
                        </div>
                    </div>

                    {/* Top Performing Barangays */}
                    <div className="glass-pro p-6 rounded-[2.5rem] border border-border bento-card relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />
                        <div className="flex items-center gap-2 mb-4 relative z-10">
                            <Award size={18} className="text-emerald-400" />
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
                                            <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 text-xs font-bold shrink-0">
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
            <div className="glass-pro p-6 rounded-[2.5rem] border border-border bento-card relative overflow-hidden shrink-0 animate-slide-up stagger-4">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />
                <div className="flex items-center justify-between mb-5 relative z-10 flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                        <TrendingUp size={18} className="text-emerald-400" />
                        <h2 className="text-base font-bold text-foreground">Per-Barangay SLA Performance</h2>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-foreground/10 text-foreground/60 uppercase tracking-widest">
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
                                <tr className="border-b border-border text-[10px] text-foreground/40 uppercase tracking-widest">
                                    <th className="py-3 pr-4">Barangay</th>
                                    <th className="py-3 pr-4 text-right">Total WOs</th>
                                    <th className="py-3 pr-4 text-right">Completed</th>
                                    <th className="py-3 pr-4 text-right">On-Time</th>
                                    <th className="py-3 pr-4 text-right">Compliance</th>
                                    <th className="py-3 pr-4 text-right">Avg Days</th>
                                    <th className="py-3 text-right">Active Breaches</th>
                                </tr>
                            </thead>
                            <tbody>
                                {byBarangay.map((b) => (
                                    <tr key={b.barangay} className="border-b border-border/50 hover:bg-foreground/5">
                                        <td className="py-3 pr-4 font-semibold text-foreground">{b.barangay}</td>
                                        <td className="py-3 pr-4 text-right text-foreground/70">{b.total_wos}</td>
                                        <td className="py-3 pr-4 text-right text-foreground/70">{b.total_completed}</td>
                                        <td className="py-3 pr-4 text-right text-foreground/70">{b.on_time}</td>
                                        <td className={`py-3 pr-4 text-right font-bold ${complianceColor(b.compliance_rate, slaPolicy.compliance_target)}`}>
                                            {b.compliance_rate}%
                                        </td>
                                        <td className="py-3 pr-4 text-right text-foreground/70">{b.avg_resolution_days}d</td>
                                        <td className="py-3 text-right">
                                            {b.active_breaches > 0 ? (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 uppercase tracking-widest">
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

function KpiCard({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: "red" | "yellow" | "emerald" | "blue" }) {
    const toneClasses = {
        red: "bg-red-500/20 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)]",
        yellow: "bg-yellow-500/20 text-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.2)]",
        emerald: "bg-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]",
        blue: "bg-blue-500/20 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.2)]",
    } as const;
    const valueColor = {
        red: "text-red-400",
        yellow: "text-yellow-400",
        emerald: "text-emerald-300",
        blue: "text-blue-300",
    } as const;
    return (
        <div className="glass-pro p-5 rounded-2xl bento-card flex items-center justify-between gap-4">
            <div className="min-w-0">
                <div className="text-[11px] text-foreground/50 uppercase tracking-widest font-bold mb-1.5 truncate">{label}</div>
                <div className={`text-3xl font-bold tracking-tight ${valueColor[tone]}`}>{value}</div>
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${toneClasses[tone]}`}>
                {icon}
            </div>
        </div>
    );
}

function PolicyTile({ label, value, unit, tone }: { label: string; value: number; unit: string; tone: "blue" | "yellow" | "red" }) {
    const tones = {
        blue: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-300" },
        yellow: { bg: "bg-yellow-500/10", border: "border-yellow-500/20", text: "text-yellow-300" },
        red: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-300" },
    } as const;
    const t = tones[tone];
    return (
        <div className={`p-3 rounded-xl border ${t.bg} ${t.border} text-center`}>
            <div className="text-[9px] uppercase tracking-widest font-bold text-foreground/50 mb-1">{label}</div>
            <div className={`text-xl font-bold ${t.text}`}>{value}{unit}</div>
        </div>
    );
}

function SkeletonRows({ count = 4 }: { count?: number }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="h-10 bg-foreground/5 rounded animate-pulse" />
            ))}
        </div>
    );
}

function SkeletonCards({ count = 3 }: { count?: number }) {
    return (
        <div className="space-y-2.5">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="h-14 bg-foreground/5 rounded-xl animate-pulse" />
            ))}
        </div>
    );
}

function EmptyState({ icon, title, subtitle, small }: { icon: React.ReactNode; title: string; subtitle: string; small?: boolean }) {
    return (
        <div className={`flex flex-col items-center justify-center text-center ${small ? "py-6" : "py-10"} gap-2`}>
            {icon}
            <p className="text-sm font-bold text-foreground/70">{title}</p>
            <p className="text-xs text-foreground/40 max-w-xs">{subtitle}</p>
        </div>
    );
}
