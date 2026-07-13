"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, FileText, LayoutGrid, List, FileDown, RefreshCw, AlertTriangle, ListChecks, Hourglass, CheckCircle2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { DateRange } from "react-day-picker";
import { formatDate } from "@/lib/date-utils";
import { formatDF } from "@/lib/date-utils"; // Need to ensure formatDF is exported or use alternative
import { toast } from "sonner";
import { KpiCard } from "@/components/portal/KpiCard";
import { QueueReport } from "@/components/portal/ReportDetailDrawer"; // Assuming QueueReport is exported there

const STATUS_OPTIONS = [
    { value: "all", label: "All Statuses" },
    { value: "pending", label: "Pending" },
    { value: "verified", label: "Verified" },
    { value: "assigned", label: "Assigned" },
    { value: "in_progress", label: "In Progress" },
    { value: "resolved", label: "Resolved" },
    { value: "failed_cleanup", label: "Failed Cleanup" },
    { value: "rejected", label: "Rejected" },
];

const SLA_PILL_CLASSES: Record<string, string> = {
    red: "bg-destructive/10 text-destructive border border-destructive/20",
    yellow: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20",
    green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
};

// Simple debouncer
function useDebounce<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(t);
    }, [value, delayMs]);
    return debounced;
}

function slaInfo(createdAt: string, status: string) {
    if (['resolved', 'rejected'].includes(status)) return null;
    const daysOpen = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    let color = "green";
    if (daysOpen > 3) color = "yellow";
    if (daysOpen > 7) color = "red";
    return { days: daysOpen, color };
}

interface OversightTabProps {
    user: any;
    barangays: string[];
    onReportClick: (report: any) => void;
}

export function OversightTab({ user, barangays, onReportClick }: OversightTabProps) {
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Filters
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 300);
    const [status, setStatus] = useState("all");
    const [barangay, setBarangay] = useState("all");
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [sort, setSort] = useState<"newest" | "oldest">("newest");
    const [viewMode, setViewMode] = useState<"table" | "card">("table");
    const [page, setPage] = useState(1);

    const pageSize = viewMode === "table" ? 10 : 12;

    const buildQuery = () => {
        const params = new URLSearchParams();
        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
        if (status !== "all") params.set("status", status);
        if (dateRange?.from) {
            const y = dateRange.from.getFullYear();
            const m = String(dateRange.from.getMonth() + 1).padStart(2, '0');
            const d = String(dateRange.from.getDate()).padStart(2, '0');
            params.set("date_from", `${y}-${m}-${d}T00:00:00`);
        }
        if (dateRange?.to) {
            const y = dateRange.to.getFullYear();
            const m = String(dateRange.to.getMonth() + 1).padStart(2, '0');
            const d = String(dateRange.to.getDate()).padStart(2, '0');
            params.set("date_to", `${y}-${m}-${d}T23:59:59`);
        }
        params.set("limit", "1000"); // fetch up to 1000 for client-side pagination and barangay filtering
        return `?${params.toString()}`;
    };

    const fetchReports = async () => {
        setLoading(true);
        try {
            const data = await api(`/reports/recent${buildQuery()}`);
            if (Array.isArray(data)) setReports(data);
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to load reports");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!user) return;
        fetchReports();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, debouncedSearch, status, dateRange]);

    const handleExport = () => {
        setExporting(true);
        try {
            const csvRows = [
                ["Tracking ID", "Barangay", "Status", "Date Reported"]
            ];
            reports.forEach(r => {
                csvRows.push([
                    r.tracking_id,
                    r.barangay || "Unassigned",
                    r.status,
                    r.created_at
                ]);
            });
            const csvContent = csvRows.map(e => e.join(",")).join("\n");
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `oversight_reports_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Reports exported.");
        } catch (error) {
            toast.error("Export failed.");
        } finally {
            setExporting(false);
        }
    };

    const filtered = useMemo(() => {
        let rows = reports;
        if (barangay !== "all") {
            rows = rows.filter((r) => r.barangay === barangay);
        }
        if (sort === "newest") rows = [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        if (sort === "oldest") rows = [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        return rows;
    }, [reports, barangay, sort]);

    useEffect(() => setPage(1), [search, status, barangay, sort, viewMode, dateRange]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

    // KPIs
    const totalReports = reports.length;
    const pendingCount = reports.filter(r => r.status === 'pending' || r.status === 'verified').length;
    const activeCount = reports.filter(r => r.status === 'assigned' || r.status === 'in_progress').length;
    const resolvedCount = reports.filter(r => r.status === 'resolved').length;
    const resRate = totalReports ? Math.round((resolvedCount / totalReports) * 100) : 0;

    return (
        <div className="flex flex-col gap-6 pb-8 w-full shrink-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Oversight Queue</h1>
                    <p className="text-sm text-foreground/50 mt-1">Manage all reports city-wide, override statuses, and track resolutions.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchReports}
                        disabled={loading}
                        className="px-4 py-2 bg-muted/50 border border-border text-foreground text-sm font-medium rounded-lg hover:bg-muted transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                        Refresh
                    </button>
                    <button
                        onClick={handleExport}
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
                    label="Total Found (Current Filters)"
                    value={totalReports}
                    icon={<ListChecks size={22} />}
                    tone="blue"
                />
                <KpiCard
                    label="Pending / Verified"
                    value={pendingCount}
                    icon={<AlertTriangle size={22} />}
                    tone={pendingCount > 0 ? "yellow" : "emerald"}
                />
                <KpiCard
                    label="Active Cleanups"
                    value={activeCount}
                    icon={<Hourglass size={22} />}
                    tone="neutral"
                />
                <KpiCard
                    label="Resolution Rate"
                    value={`${resRate}%`}
                    icon={<CheckCircle2 size={22} />}
                    tone={resRate >= 80 ? "emerald" : resRate >= 50 ? "yellow" : "red"}
                />
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search Tracking ID..."
                        className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                </div>

                <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                >
                    {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                </select>

                <select
                    value={barangay}
                    onChange={(e) => setBarangay(e.target.value)}
                    className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                >
                    <option value="all">All Barangays</option>
                    {barangays.map((b) => (
                        <option key={b} value={b}>{b}</option>
                    ))}
                </select>

                <DateRangePicker 
                    date={dateRange} 
                    onDateChange={setDateRange} 
                />

                <div className="flex-1" />

                <select
                    value={sort}
                    onChange={e => setSort(e.target.value as typeof sort)}
                    className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                >
                    <option value="newest">Sort: Newest First</option>
                    <option value="oldest">Sort: Oldest First</option>
                </select>

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
            </div>

            {/* Main View Area */}
            {viewMode === "table" ? (
                <div className="bg-card rounded-xl border border-border flex flex-col overflow-hidden animate-slide-up shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-border text-xs text-muted-foreground font-medium bg-muted/20">
                                    <th className="p-4">Tracking ID</th>
                                    <th className="p-4">Barangay</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Open</th>
                                    <th className="p-4">Date Reported</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="border-b border-border">
                                            {Array.from({ length: 5 }).map((__, j) => (
                                                <td key={j} className="p-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                                            ))}
                                        </tr>
                                    ))
                                ) : paginated.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-12 text-center text-muted-foreground font-medium">No reports match the current filters.</td>
                                    </tr>
                                ) : (
                                    paginated.map(report => {
                                        const sla = slaInfo(report.created_at, report.status);
                                        return (
                                            <tr key={report.id} onClick={() => onReportClick(report)} className="border-b border-border hover:bg-muted/50 transition-colors cursor-pointer">
                                                <td className="p-4 font-mono text-sm font-medium text-foreground">
                                                    {report.tracking_id}
                                                    {report.possible_duplicate_flag && report.status !== 'duplicate' && (
                                                        <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-tight bg-amber-500/20 text-amber-500 align-middle">⚠ DUP?</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-sm font-medium text-foreground">{report.barangay || '—'}</td>
                                                <td className="p-4">
                                                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                                                        report.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                                                        report.status === 'assigned' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20' :
                                                        report.status === 'in_progress' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' :
                                                        report.status === 'verified' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20' :
                                                        report.status === 'pending' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                                                        report.status === 'failed_cleanup' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                                                        report.status === 'rejected' ? 'bg-muted text-muted-foreground border border-border' :
                                                        'bg-muted text-foreground border border-border'
                                                    }`}>
                                                        {report.status.replace(/_/g, " ")}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    {sla ? (
                                                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${SLA_PILL_CLASSES[sla.color]}`}>{sla.days}d</span>
                                                    ) : (
                                                        <span className="text-muted-foreground text-sm">—</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-sm text-muted-foreground">{formatDate(report.created_at)}</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-slide-up">
                    {loading ? (
                        Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="h-40 bg-card rounded-xl border border-border animate-pulse" />
                        ))
                    ) : paginated.length === 0 ? (
                        <div className="col-span-full py-12 text-center text-muted-foreground font-medium">No reports match the current filters.</div>
                    ) : (
                        paginated.map(report => (
                            <div key={report.id} onClick={() => onReportClick(report)} className="bg-card rounded-xl border border-border p-4 hover:shadow-md hover:border-primary/50 transition-all cursor-pointer flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <div className="font-mono text-sm font-bold text-foreground">{report.tracking_id}</div>
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                        report.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                                        report.status === 'pending' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                                        'bg-muted text-foreground border border-border'
                                    }`}>
                                        {report.status.replace(/_/g, " ")}
                                    </span>
                                </div>
                                <div className="text-sm font-medium text-foreground">{report.barangay || 'Unassigned'}</div>
                                <div className="text-xs text-muted-foreground mt-auto">{formatDate(report.created_at)}</div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between bg-card p-4 rounded-xl border border-border shadow-sm shrink-0">
                    <span className="text-xs text-muted-foreground font-medium">
                        Page {page} of {totalPages} ({filtered.length} total)
                    </span>
                    <div className="flex items-center gap-2">
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted disabled:opacity-50 transition-colors text-foreground">Previous</button>
                        <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted disabled:opacity-50 transition-colors text-foreground">Next</button>
                    </div>
                </div>
            )}
        </div>
    );
}
