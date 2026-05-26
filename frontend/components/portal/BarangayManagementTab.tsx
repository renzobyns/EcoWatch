"use client";

import { useState, useMemo, useEffect } from "react";
import {
    Search, Plus, AlertTriangle, Building2, UserCheck, UserX,
    RefreshCw, FileDown, MoreVertical, LayoutGrid, List,
} from "lucide-react";
import { formatRelative } from "@/lib/date-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BarangayOverviewRow = {
    barangay: string;
    admin: { id: number; full_name: string; email: string; phone_number: string | null; last_login_at: string | null } | null;
    total_reports: number;
    pending: number;
    active: number;
    resolved: number;
    rejected: number;
    failed_cleanup: number;
    resolution_rate: number;
    active_breaches: number;
    compliance_rate: number;
    avg_resolution_days: number;
    last_report_at: string | null;
    trend_7d_resolution_rate_delta: number;
    status: "healthy" | "at_risk" | "breached" | "unassigned";
};

export type BarangayCityWide = {
    total_barangays: number;
    barangays_with_admin: number;
    barangays_without_admin: number;
    total_active_breaches: number;
    city_resolution_rate: number;
};

interface Props {
    loading: boolean;
    error: string | null;
    cityWide: BarangayCityWide | null;
    barangays: BarangayOverviewRow[];
    exporting: boolean;
    onRefresh: () => void;
    onExport: () => void;
    onSelectBarangay: (row: BarangayOverviewRow) => void;
    onAssignAdmin: (barangayName: string) => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BarangayManagementTab({
    loading,
    error,
    cityWide,
    barangays,
    exporting,
    onRefresh,
    onExport,
    onSelectBarangay,
    onAssignAdmin,
}: Props) {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"all" | "no_admin" | "sla_breached" | "critical">("all");
    const [sort, setSort] = useState<"name" | "resolution_rate_asc" | "active_breaches_desc" | "total_reports_desc">("name");
    const [viewMode, setViewMode] = useState<"card" | "table">("card");
    const [page, setPage] = useState(1);

    const tablePageSize = 8;
    const cardPageSize = 12;
    const pageSize = viewMode === "table" ? tablePageSize : cardPageSize;

    const filtered = useMemo(() => {
        let rows = barangays;
        if (search.trim()) {
            const q = search.toLowerCase();
            rows = rows.filter(r =>
                r.barangay.toLowerCase().includes(q) ||
                (r.admin?.full_name.toLowerCase().includes(q)) ||
                (r.admin?.email.toLowerCase().includes(q))
            );
        }
        if (filter === "no_admin") rows = rows.filter(r => !r.admin);
        if (filter === "sla_breached") rows = rows.filter(r => r.active_breaches > 0);
        if (filter === "critical") rows = rows.filter(r => r.status === "breached" || r.status === "unassigned");
        if (sort === "name") rows = [...rows].sort((a, b) => a.barangay.localeCompare(b.barangay));
        if (sort === "resolution_rate_asc") rows = [...rows].sort((a, b) => a.resolution_rate - b.resolution_rate);
        if (sort === "active_breaches_desc") rows = [...rows].sort((a, b) => b.active_breaches - a.active_breaches);
        if (sort === "total_reports_desc") rows = [...rows].sort((a, b) => b.total_reports - a.total_reports);
        return rows;
    }, [barangays, search, filter, sort]);

    useEffect(() => setPage(1), [search, filter, sort, viewMode]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

    return (
        <div className="flex flex-col gap-6 pb-8 w-full shrink-0">

            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Barangay Management</h1>
                    <p className="text-sm text-foreground/50 mt-1">Oversee all 59 barangays — assign admins, monitor performance, and intervene on SLA breaches.</p>
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
                        {exporting ? "Exporting…" : "Export CSV"}
                    </button>
                </div>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 shrink-0 animate-slide-up">
                <KpiCard
                    label="Total Barangays"
                    value={cityWide?.total_barangays ?? "—"}
                    icon={<Building2 size={22} />}
                    tone="blue"
                />
                <KpiCard
                    label="With Assigned Admin"
                    value={cityWide?.barangays_with_admin ?? "—"}
                    icon={<UserCheck size={22} />}
                    tone="emerald"
                />
                <KpiCard
                    label="No Admin Assigned"
                    value={cityWide?.barangays_without_admin ?? "—"}
                    icon={<UserX size={22} />}
                    tone={cityWide && cityWide.barangays_without_admin > 0 ? "yellow" : "emerald"}
                />
                <KpiCard
                    label="Active SLA Breaches"
                    value={cityWide?.total_active_breaches ?? "—"}
                    icon={<AlertTriangle size={22} />}
                    tone={cityWide && cityWide.total_active_breaches > 0 ? "red" : "emerald"}
                />
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search barangays, admins..."
                        className="w-full pl-9 pr-3 py-2 glass border border-border rounded-lg text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-primary/50"
                    />
                </div>

                {/* Filter chips */}
                <div className="flex gap-1.5">
                    {(["all", "no_admin", "sla_breached", "critical"] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-colors border ${
                                filter === f
                                    ? "bg-primary/20 border-primary/50 text-primary"
                                    : "glass border-border text-foreground/50 hover:text-foreground hover:border-foreground/30"
                            }`}
                        >
                            {f === "all" ? "All" : f === "no_admin" ? "No Admin" : f === "sla_breached" ? "SLA Breached" : "Critical"}
                        </button>
                    ))}
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Sort dropdown */}
                <select
                    value={sort}
                    onChange={e => setSort(e.target.value as typeof sort)}
                    className="px-3 py-2 glass border border-border rounded-lg text-xs text-foreground/70 focus:outline-none focus:border-primary/50 bg-transparent"
                >
                    <option value="name">Sort: A → Z</option>
                    <option value="resolution_rate_asc">Sort: Worst Rate First</option>
                    <option value="active_breaches_desc">Sort: Most Breaches</option>
                    <option value="total_reports_desc">Sort: Most Reports</option>
                </select>

                {/* View toggle */}
                <div className="flex glass border border-border rounded-lg overflow-hidden">
                    <button
                        onClick={() => setViewMode("card")}
                        title="Card view"
                        className={`px-3 py-2 transition-colors ${viewMode === "card" ? "bg-primary/20 text-primary" : "text-foreground/40 hover:text-foreground"}`}
                    >
                        <LayoutGrid size={15} />
                    </button>
                    <button
                        onClick={() => setViewMode("table")}
                        title="Table view"
                        className={`px-3 py-2 transition-colors ${viewMode === "table" ? "bg-primary/20 text-primary" : "text-foreground/40 hover:text-foreground"}`}
                    >
                        <List size={15} />
                    </button>
                </div>

                {/* Assign New Admin */}
                <button
                    onClick={() => onAssignAdmin("")}
                    className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                >
                    <Plus size={14} />
                    Assign New Admin
                </button>
            </div>

            {/* Error state */}
            {error && (
                <div className="glass-pro p-4 rounded-2xl border border-red-500/30 bg-red-500/10 flex items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-3 text-red-400">
                        <AlertTriangle size={18} />
                        <span className="text-sm font-semibold">{error}</span>
                    </div>
                    <button
                        onClick={onRefresh}
                        className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Card View */}
            {viewMode === "card" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-slide-up">
                    {loading ? (
                        Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="h-52 glass-pro rounded-2xl border border-border animate-pulse" />
                        ))
                    ) : paginated.length === 0 ? (
                        <div className="col-span-full py-16 text-center text-foreground/40">
                            <Building2 size={36} className="mx-auto mb-3 opacity-30" />
                            <p className="font-semibold">No barangays match these filters</p>
                        </div>
                    ) : (
                        paginated.map(row => (
                            <BarangayRowCard
                                key={row.barangay}
                                row={row}
                                onSelect={() => onSelectBarangay(row)}
                                onAssignAdmin={() => onAssignAdmin(row.barangay)}
                            />
                        ))
                    )}
                </div>
            )}

            {/* Table View */}
            {viewMode === "table" && (
                <div className="glass-pro rounded-[2.5rem] border border-border bento-card overflow-hidden animate-slide-up">
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="p-6"><SkeletonRows count={8} /></div>
                        ) : paginated.length === 0 ? (
                            <EmptyState
                                icon={<Building2 size={32} className="text-foreground/30" />}
                                title="No barangays match these filters"
                                subtitle="Try adjusting your search or filter."
                            />
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="py-4 px-6 text-left text-[10px] text-foreground/40 uppercase tracking-widest font-bold">Barangay</th>
                                        <th className="py-4 px-4 text-left text-[10px] text-foreground/40 uppercase tracking-widest font-bold">Assigned Admin</th>
                                        <th className="py-4 px-4 text-right text-[10px] text-foreground/40 uppercase tracking-widest font-bold">Reports</th>
                                        <th className="py-4 px-4 text-right text-[10px] text-foreground/40 uppercase tracking-widest font-bold">Pending</th>
                                        <th className="py-4 px-4 text-right text-[10px] text-foreground/40 uppercase tracking-widest font-bold">Resolved</th>
                                        <th className="py-4 px-4 text-center text-[10px] text-foreground/40 uppercase tracking-widest font-bold">SLA Breaches</th>
                                        <th className="py-4 px-4 text-center text-[10px] text-foreground/40 uppercase tracking-widest font-bold">Status</th>
                                        <th className="py-4 px-4 w-10" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginated.map(row => (
                                        <tr
                                            key={row.barangay}
                                            onClick={() => onSelectBarangay(row)}
                                            className="border-b border-border/40 hover:bg-foreground/5 cursor-pointer transition-colors"
                                        >
                                            <td className="py-4 px-6">
                                                <div className="font-semibold text-foreground">{row.barangay}</div>
                                                <div className="text-[10px] text-foreground/40 uppercase tracking-widest mt-0.5">San Jose del Monte</div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-7 h-7 rounded-full bg-foreground/10 border border-border flex items-center justify-center text-[10px] font-bold text-foreground/60 shrink-0">
                                                        {row.admin ? row.admin.full_name.charAt(0).toUpperCase() : "?"}
                                                    </div>
                                                    <span className={row.admin ? "text-sm text-foreground" : "text-sm text-foreground/40 italic"}>
                                                        {row.admin ? row.admin.full_name : "Unassigned"}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 text-right text-foreground/70">{row.total_reports}</td>
                                            <td className="py-4 px-4 text-right text-yellow-400 font-semibold">{row.pending}</td>
                                            <td className="py-4 px-4 text-right text-emerald-400 font-semibold">{row.resolved}</td>
                                            <td className="py-4 px-4 text-center">
                                                {row.active_breaches > 0 ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30 uppercase tracking-widest">
                                                        {row.active_breaches} Active
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-foreground/10 text-foreground/30 border border-border uppercase tracking-widest">
                                                        None
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${
                                                        row.status === "healthy" ? "bg-emerald-400" :
                                                        row.status === "at_risk" ? "bg-yellow-400" :
                                                        row.status === "breached" ? "bg-red-400" :
                                                        "bg-orange-400"
                                                    }`} />
                                                    <span className={`text-xs font-semibold ${
                                                        row.status === "healthy" ? "text-emerald-300" :
                                                        row.status === "at_risk" ? "text-yellow-300" :
                                                        row.status === "breached" ? "text-red-300" :
                                                        "text-orange-300"
                                                    }`}>
                                                        {row.status === "healthy" ? "Healthy" :
                                                         row.status === "at_risk" ? "At Risk" :
                                                         row.status === "breached" ? "Breached" :
                                                         "Action Needed"}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => onSelectBarangay(row)}
                                                    className="p-1.5 rounded-lg hover:bg-foreground/10 text-foreground/40 hover:text-foreground transition-colors"
                                                >
                                                    <MoreVertical size={15} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Pagination */}
            {filtered.length > 0 && (
                <div className="flex items-center justify-between shrink-0 pt-2">
                    <span className="text-xs text-foreground/40">
                        Showing {Math.min((page - 1) * pageSize + 1, filtered.length)}–{Math.min(page * pageSize, filtered.length)} of {filtered.length} barangay{filtered.length !== 1 ? "s" : ""}
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1.5 glass border border-border rounded-lg text-xs font-bold text-foreground/50 hover:text-foreground disabled:opacity-30 transition-colors"
                        >
                            Previous
                        </button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                            const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page + i - 2;
                            if (p > totalPages) return null;
                            return (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${p === page ? "bg-primary/20 border border-primary/50 text-primary" : "glass border border-border text-foreground/50 hover:text-foreground"}`}
                                >
                                    {p}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-3 py-1.5 glass border border-border rounded-lg text-xs font-bold text-foreground/50 hover:text-foreground disabled:opacity-30 transition-colors"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Internal Card Sub-component ─────────────────────────────────────────────

function BarangayRowCard({
    row,
    onSelect,
    onAssignAdmin,
}: {
    row: BarangayOverviewRow;
    onSelect: () => void;
    onAssignAdmin: () => void;
}) {
    const statusBand = {
        healthy: "border-l-4 border-l-emerald-400",
        at_risk: "border-l-4 border-l-yellow-400",
        breached: "border-l-4 border-l-red-400",
        unassigned: "border-l-4 border-l-orange-400",
    }[row.status];

    const statusDot = {
        healthy: "bg-emerald-400",
        at_risk: "bg-yellow-400",
        breached: "bg-red-400",
        unassigned: "bg-orange-400",
    }[row.status];

    const statusLabel = {
        healthy: "Healthy",
        at_risk: "At Risk",
        breached: "Breached",
        unassigned: "No Admin",
    }[row.status];

    const trendArrow = row.trend_7d_resolution_rate_delta > 0.5
        ? "↑"
        : row.trend_7d_resolution_rate_delta < -0.5
        ? "↓"
        : "→";

    const trendColor = row.trend_7d_resolution_rate_delta > 0.5
        ? "text-emerald-400"
        : row.trend_7d_resolution_rate_delta < -0.5
        ? "text-red-400"
        : "text-foreground/50";

    const lastReport = row.last_report_at
        ? formatRelative(row.last_report_at)
        : "No reports yet";

    return (
        <div
            onClick={onSelect}
            className={`glass-pro rounded-2xl border border-border bento-card cursor-pointer hover:border-primary/40 transition-all p-5 flex flex-col gap-3 ${statusBand} relative overflow-hidden`}
        >
            {/* Ambient glow */}
            {row.status === "breached" && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-[40px] pointer-events-none" />
            )}
            {row.status === "at_risk" && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-[40px] pointer-events-none" />
            )}

            {/* Header: name + status pill */}
            <div className="flex items-start justify-between gap-2 relative z-10">
                <div className="min-w-0">
                    <h3 className="font-bold text-foreground text-sm leading-tight truncate">{row.barangay}</h3>
                    <div className="text-[10px] text-foreground/40 mt-0.5">San Jose del Monte</div>
                </div>
                <div className={`flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${
                    row.status === "healthy" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" :
                    row.status === "at_risk" ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-300" :
                    row.status === "breached" ? "bg-red-500/10 border-red-500/30 text-red-300" :
                    "bg-orange-500/10 border-orange-500/30 text-orange-300"
                }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                    {statusLabel}
                </div>
            </div>

            {/* Admin row */}
            <div className="flex items-center gap-2 relative z-10">
                <div className="w-7 h-7 rounded-full bg-foreground/10 border border-border flex items-center justify-center text-[10px] font-bold text-foreground/60 shrink-0">
                    {row.admin ? row.admin.full_name.charAt(0).toUpperCase() : "?"}
                </div>
                <div className="min-w-0 flex-1">
                    {row.admin ? (
                        <>
                            <div className="text-xs font-semibold text-foreground truncate">{row.admin.full_name}</div>
                            <div className="text-[10px] text-foreground/40 truncate">{row.admin.email}</div>
                        </>
                    ) : (
                        <div className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">No Admin Assigned</div>
                    )}
                </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-4 gap-1 relative z-10">
                {[
                    { label: "Reports", value: row.total_reports, color: "text-foreground" },
                    { label: "Pending", value: row.pending, color: "text-yellow-400" },
                    { label: "Resolved", value: row.resolved, color: "text-emerald-400" },
                    {
                        label: "Rate",
                        value: `${row.resolution_rate.toFixed(0)}%`,
                        color: row.resolution_rate >= 75 ? "text-emerald-400" : row.resolution_rate >= 50 ? "text-yellow-400" : "text-red-400",
                    },
                ].map(k => (
                    <div key={k.label} className="text-center">
                        <div className={`text-sm font-bold ${k.color}`}>{k.value}</div>
                        <div className="text-[9px] text-foreground/40 uppercase tracking-widest">{k.label}</div>
                    </div>
                ))}
            </div>

            {/* SLA row */}
            <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-1.5 text-[10px] text-foreground/50">
                    <span>SLA {row.compliance_rate.toFixed(0)}%</span>
                    <span>·</span>
                    <span className={row.active_breaches > 0 ? "text-red-400 font-bold" : ""}>
                        {row.active_breaches} breach{row.active_breaches !== 1 ? "es" : ""}
                    </span>
                </div>
                <span className={`text-xs font-bold ${trendColor}`}>
                    {trendArrow} {Math.abs(row.trend_7d_resolution_rate_delta).toFixed(1)}%
                </span>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-1 border-t border-border/50 relative z-10">
                <span className="text-[10px] text-foreground/40">{lastReport}</span>
                {!row.admin ? (
                    <button
                        onClick={(e) => { e.stopPropagation(); onAssignAdmin(); }}
                        className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 uppercase tracking-widest"
                    >
                        Assign Admin
                    </button>
                ) : (
                    <button
                        onClick={(e) => { e.stopPropagation(); }}
                        className="text-[10px] font-bold text-foreground/40 hover:text-foreground/60 uppercase tracking-widest"
                    >
                        Details →
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── Shared Sub-components (mirrored from SlaManagementTab) ──────────────────

function KpiCard({
    label,
    value,
    icon,
    tone,
}: {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    tone: "red" | "yellow" | "emerald" | "blue";
}) {
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

function SkeletonRows({ count = 4 }: { count?: number }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="h-10 bg-foreground/5 rounded animate-pulse" />
            ))}
        </div>
    );
}

function EmptyState({
    icon,
    title,
    subtitle,
    small,
}: {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    small?: boolean;
}) {
    return (
        <div className={`flex flex-col items-center justify-center text-center ${small ? "py-6" : "py-10"} gap-2`}>
            {icon}
            <p className="text-sm font-bold text-foreground/70">{title}</p>
            <p className="text-xs text-foreground/40 max-w-xs">{subtitle}</p>
        </div>
    );
}
