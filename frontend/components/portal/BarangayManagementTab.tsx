"use client";

import { useState, useMemo, useEffect } from "react";
import {
    Search, Plus, AlertTriangle, Building2, UserCheck, UserX,
    RefreshCw, FileDown, MoreVertical, LayoutGrid, List,
} from "lucide-react";
import { formatRelative } from "@/lib/date-utils";
import { KpiCard } from "@/components/portal/KpiCard";

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
                        className="px-4 py-2 bg-muted/50 border border-border text-foreground text-sm font-medium rounded-lg hover:bg-muted transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                        Refresh
                    </button>
                    <button
                        onClick={onExport}
                        disabled={exporting}
                        className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
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
                        className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                </div>

                {/* Filter chips */}
                <div className="flex gap-1.5">
                    {(["all", "no_admin", "sla_breached", "critical"] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                                filter === f
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-muted/50 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
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
                    className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                >
                    <option value="name">Sort: A → Z</option>
                    <option value="resolution_rate_asc">Sort: Worst Rate First</option>
                    <option value="active_breaches_desc">Sort: Most Breaches</option>
                    <option value="total_reports_desc">Sort: Most Reports</option>
                </select>

                {/* View toggle */}
                <div className="flex bg-muted/50 border border-border rounded-lg overflow-hidden">
                    <button
                        onClick={() => setViewMode("card")}
                        title="Card view"
                        className={`px-3 py-2 transition-colors ${viewMode === "card" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        <LayoutGrid size={15} />
                    </button>
                    <button
                        onClick={() => setViewMode("table")}
                        title="Table view"
                        className={`px-3 py-2 transition-colors ${viewMode === "table" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        <List size={15} />
                    </button>
                </div>

                {/* Assign New Admin */}
                <button
                    onClick={() => onAssignAdmin("")}
                    className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm"
                >
                    <Plus size={14} />
                    Assign New Admin
                </button>
            </div>

            {/* Error state */}
            {error && (
                <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10 flex items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-3 text-destructive">
                        <AlertTriangle size={18} />
                        <span className="text-sm font-semibold">{error}</span>
                    </div>
                    <button
                        onClick={onRefresh}
                        className="px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors"
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
                            <div key={i} className="h-52 bg-card rounded-lg border border-border animate-pulse" />
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
                <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden animate-slide-up">
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="p-6"><SkeletonRows count={8} /></div>
                        ) : paginated.length === 0 ? (
                            <EmptyState
                                icon={<Building2 size={32} className="text-muted-foreground" />}
                                title="No barangays match these filters"
                                subtitle="Try adjusting your search or filter."
                            />
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead>
                                    <tr className="border-b border-border bg-muted/50">
                                        <th className="py-4 px-6 text-xs font-medium text-muted-foreground">Barangay</th>
                                        <th className="py-4 px-4 text-xs font-medium text-muted-foreground">Assigned Admin</th>
                                        <th className="py-4 px-4 text-xs font-medium text-muted-foreground text-right">Reports</th>
                                        <th className="py-4 px-4 text-xs font-medium text-muted-foreground text-right">Pending</th>
                                        <th className="py-4 px-4 text-xs font-medium text-muted-foreground text-right">Resolved</th>
                                        <th className="py-4 px-4 text-xs font-medium text-muted-foreground text-center">SLA Breaches</th>
                                        <th className="py-4 px-4 text-xs font-medium text-muted-foreground text-center">Status</th>
                                        <th className="py-4 px-4 w-10" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginated.map(row => (
                                        <tr
                                            key={row.barangay}
                                            onClick={() => onSelectBarangay(row)}
                                            className="border-b border-border hover:bg-muted/50 cursor-pointer transition-colors"
                                        >
                                            <td className="py-4 px-6">
                                                <div className="font-semibold text-foreground">{row.barangay}</div>
                                                <div className="text-xs text-muted-foreground mt-0.5">San Jose del Monte</div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                                                        {row.admin ? row.admin.full_name.charAt(0).toUpperCase() : "?"}
                                                    </div>
                                                    <span className={row.admin ? "text-sm text-foreground font-medium" : "text-sm text-muted-foreground italic"}>
                                                        {row.admin ? row.admin.full_name : "Unassigned"}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 text-right text-muted-foreground">{row.total_reports}</td>
                                            <td className="py-4 px-4 text-right text-yellow-600 dark:text-yellow-400 font-semibold">{row.pending}</td>
                                            <td className="py-4 px-4 text-right text-emerald-600 dark:text-emerald-400 font-semibold">{row.resolved}</td>
                                            <td className="py-4 px-4 text-center">
                                                {row.active_breaches > 0 ? (
                                                    <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                                                        {row.active_breaches} Active
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground">
                                                        None
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <div className={`w-2 h-2 rounded-full ${
                                                        row.status === "healthy" ? "bg-emerald-500" :
                                                        row.status === "at_risk" ? "bg-yellow-500" :
                                                        row.status === "breached" ? "bg-destructive" :
                                                        "bg-orange-500"
                                                    }`} />
                                                    <span className={`text-sm font-medium ${
                                                        row.status === "healthy" ? "text-emerald-600 dark:text-emerald-400" :
                                                        row.status === "at_risk" ? "text-yellow-600 dark:text-yellow-400" :
                                                        row.status === "breached" ? "text-destructive" :
                                                        "text-orange-600 dark:text-orange-400"
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
                    <span className="text-sm text-muted-foreground">
                        Showing {Math.min((page - 1) * pageSize + 1, filtered.length)}–{Math.min(page * pageSize, filtered.length)} of {filtered.length} barangay{filtered.length !== 1 ? "s" : ""}
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1.5 bg-muted/50 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
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
                                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${p === page ? "bg-primary text-primary-foreground border border-primary" : "bg-muted/50 border border-border text-foreground hover:bg-muted"}`}
                                >
                                    {p}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-3 py-1.5 bg-muted/50 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
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
    const statusDot = {
        healthy: "bg-emerald-500",
        at_risk: "bg-yellow-500",
        breached: "bg-destructive",
        unassigned: "bg-orange-500",
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
            className="bg-card rounded-lg border border-border cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200 p-5 flex flex-col gap-3 relative overflow-hidden shadow-sm"
        >
            {/* Header: name + status pill */}
            <div className="flex items-start justify-between gap-2 relative z-10">
                <div className="min-w-0">
                    <h3 className="font-bold text-foreground text-sm leading-tight truncate">{row.barangay}</h3>
                    <div className="text-xs text-muted-foreground mt-0.5">San Jose del Monte</div>
                </div>
                <div className={`flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-md border text-xs font-medium ${
                    row.status === "healthy" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" :
                    row.status === "at_risk" ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400" :
                    row.status === "breached" ? "bg-destructive/10 border-destructive/30 text-destructive" :
                    "bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400"
                }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                    {statusLabel}
                </div>
            </div>

            {/* Admin row */}
            <div className="flex items-center gap-2 relative z-10">
                <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                    {row.admin ? row.admin.full_name.charAt(0).toUpperCase() : "?"}
                </div>
                <div className="min-w-0 flex-1">
                    {row.admin ? (
                        <>
                            <div className="text-sm font-semibold text-foreground truncate">{row.admin.full_name}</div>
                            <div className="text-xs text-muted-foreground truncate">{row.admin.email}</div>
                        </>
                    ) : (
                        <div className="text-xs font-medium text-orange-600 dark:text-orange-400 italic">No Admin Assigned</div>
                    )}
                </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-4 gap-1 relative z-10">
                {[
                    { label: "Reports", value: row.total_reports, color: "text-foreground" },
                    { label: "Pending", value: row.pending, color: "text-yellow-600 dark:text-yellow-400" },
                    { label: "Resolved", value: row.resolved, color: "text-emerald-600 dark:text-emerald-400" },
                    {
                        label: "Rate",
                        value: `${row.resolution_rate.toFixed(0)}%`,
                        color: row.resolution_rate >= 75 ? "text-emerald-600 dark:text-emerald-400" : row.resolution_rate >= 50 ? "text-yellow-600 dark:text-yellow-400" : "text-destructive",
                    },
                ].map(k => (
                    <div key={k.label} className="text-center">
                        <div className={`text-lg font-bold ${k.color}`}>{k.value}</div>
                        <div className="text-xs font-medium text-muted-foreground mt-0.5">{k.label}</div>
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
            <div className="flex items-center justify-between pt-3 mt-1 border-t border-border/50 relative z-10">
                <span className="text-xs text-muted-foreground">{lastReport}</span>
                {!row.admin ? (
                    <button
                        onClick={(e) => { e.stopPropagation(); onAssignAdmin(); }}
                        className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                        Assign Admin
                    </button>
                ) : (
                    <button
                        onClick={(e) => { e.stopPropagation(); }}
                        className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Details &rarr;
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── Shared Sub-components (mirrored from SlaManagementTab) ──────────────────

function SkeletonRows({ count = 4 }: { count?: number }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="h-10 bg-muted/50 rounded-md animate-pulse" />
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
