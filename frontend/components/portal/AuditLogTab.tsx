"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, FileDown, RefreshCw, Activity, ShieldAlert, Users, ListChecks } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { AuditEntry } from "@/components/portal/ReportDetailDrawer";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { DateRange } from "react-day-picker";
import { formatDateTime } from "@/lib/date-utils";
import { toast } from "sonner";
import { KpiCard } from "@/components/portal/KpiCard";

const ACTION_FILTER_OPTIONS = ["all", "deploy", "resolve", "reassign", "force_close", "create_user", "disable_user"];

const ACTION_PILL_CLASSES: Record<string, string> = {
    deploy: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
    resolve: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
    reassign: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20",
    force_close: "bg-destructive/10 text-destructive border border-destructive/20",
    disable_user: "bg-destructive/10 text-destructive border border-destructive/20",
    create_user: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20",
};

export function AuditLogTab({ user }: { user: any }) {
    const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [auditAction, setAuditAction] = useState("all");
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
    const [page, setPage] = useState(1);
    const pageSize = 15;

    const fetchAuditLog = async () => {
        setLoading(true);
        try {
            // Fetch a large batch for client-side pagination
            const data = await api(`/audit-log?limit=1000&offset=0`);
            const entries: AuditEntry[] = Array.isArray(data?.entries) ? data.entries : [];
            setAuditEntries(entries);
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to load audit log");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!user) return;
        fetchAuditLog();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const filteredAndSortedEntries = useMemo(() => {
        let result = [...auditEntries];

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(e => {
                const targetLabel = (e.details?.tracking_id as string) || `${e.target_type} #${e.target_id ?? "—"}`;
                const matchEmail = e.user_email?.toLowerCase().includes(q);
                const matchTarget = targetLabel.toString().toLowerCase().includes(q);
                return matchEmail || matchTarget;
            });
        }

        if (auditAction !== "all") {
            result = result.filter(e => e.action === auditAction);
        }

        if (dateRange?.from) {
            const start = new Date(dateRange.from);
            start.setHours(0, 0, 0, 0);
            
            result = result.filter(e => {
                const entryDate = new Date(e.created_at.endsWith("Z") ? e.created_at : e.created_at + "Z");
                if (entryDate < start) return false;
                if (dateRange.to) {
                    const end = new Date(dateRange.to);
                    end.setHours(23, 59, 59, 999);
                    if (entryDate > end) return false;
                }
                return true;
            });
        }

        result.sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
        });

        return result;
    }, [auditEntries, searchQuery, auditAction, dateRange, sortOrder]);

    useEffect(() => setPage(1), [searchQuery, auditAction, dateRange, sortOrder]);

    const totalPages = Math.max(1, Math.ceil(filteredAndSortedEntries.length / pageSize));
    const paginated = filteredAndSortedEntries.slice((page - 1) * pageSize, page * pageSize);

    const handleExport = () => {
        setExporting(true);
        try {
            const csvRows = [
                ["Timestamp", "User", "Action", "Target", "Details"]
            ];
            filteredAndSortedEntries.forEach(e => {
                const targetLabel = (e.details?.tracking_id as string) || `${e.target_type} #${e.target_id ?? ""}`;
                const detailsStr = e.details && Object.keys(e.details).length ? JSON.stringify(e.details) : "";
                csvRows.push([
                    e.created_at,
                    e.user_email || "",
                    e.action,
                    targetLabel,
                    `"${detailsStr.replace(/"/g, '""')}"`
                ]);
            });
            const csvContent = csvRows.map(row => row.join(",")).join("\n");
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Audit log exported.");
        } catch (error) {
            toast.error("Export failed.");
        } finally {
            setExporting(false);
        }
    };

    // KPIs
    const totalEvents = filteredAndSortedEntries.length;
    const criticalActions = filteredAndSortedEntries.filter(e => e.action === 'force_close' || e.action === 'disable_user').length;
    const activeAdmins = new Set(filteredAndSortedEntries.map(e => e.user_email)).size;
    const actionsCounts = filteredAndSortedEntries.reduce((acc, curr) => {
        acc[curr.action] = (acc[curr.action] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const topAction = Object.keys(actionsCounts).length > 0 
        ? Object.keys(actionsCounts).reduce((a, b) => actionsCounts[a] > actionsCounts[b] ? a : b)
        : "None";

    return (
        <div className="flex flex-col gap-6 pb-8 w-full shrink-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Audit Log</h1>
                    <p className="text-sm text-foreground/50 mt-1">Every override action — who, when, what, why.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchAuditLog}
                        disabled={loading}
                        className="px-4 py-2 bg-muted/50 border border-border text-foreground text-sm font-medium rounded-lg hover:bg-muted transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                        Refresh
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={exporting || filteredAndSortedEntries.length === 0}
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
                    label="Total Events (Filtered)"
                    value={totalEvents}
                    icon={<ListChecks size={22} />}
                    tone="blue"
                />
                <KpiCard
                    label="Critical Actions"
                    value={criticalActions}
                    icon={<ShieldAlert size={22} />}
                    tone={criticalActions > 0 ? "yellow" : "emerald"}
                />
                <KpiCard
                    label="Active Admins (Filtered)"
                    value={activeAdmins}
                    icon={<Users size={22} />}
                    tone="neutral"
                />
                <KpiCard
                    label="Top Action Type"
                    value={topAction.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                    icon={<Activity size={22} />}
                    tone="neutral"
                />
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
                    <input
                        type="text"
                        placeholder="Search by User or Target..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                </div>

                <select
                    value={auditAction}
                    onChange={(e) => setAuditAction(e.target.value)}
                    className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                >
                    {ACTION_FILTER_OPTIONS.map((a) => (
                        <option key={a} value={a}>{a === "all" ? "All actions" : a.replace(/_/g, " ")}</option>
                    ))}
                </select>

                <DateRangePicker 
                    date={dateRange}
                    onDateChange={setDateRange}
                />

                <div className="flex-1" />

                <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                    className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                >
                    <option value="desc">Sort: Newest First</option>
                    <option value="asc">Sort: Oldest First</option>
                </select>
            </div>

            {/* Table Area */}
            <div className="bg-card rounded-xl border border-border flex flex-col overflow-hidden animate-slide-up shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border text-xs text-muted-foreground font-medium bg-muted/20">
                                <th className="p-4">Timestamp</th>
                                <th className="p-4">User</th>
                                <th className="p-4">Action</th>
                                <th className="p-4">Target</th>
                                <th className="p-4">Details</th>
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
                                    <td colSpan={5} className="p-12 text-center text-muted-foreground font-medium">No audit entries match this filter.</td>
                                </tr>
                            ) : (
                                paginated.map((e) => {
                                    const detailsStr = e.details && Object.keys(e.details).length ? JSON.stringify(e.details) : "";
                                    const targetLabel = (e.details?.tracking_id as string) || `${e.target_type} #${e.target_id ?? "—"}`;
                                    return (
                                        <tr key={e.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                                            <td className="p-4 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(e.created_at)}</td>
                                            <td className="p-4 text-sm font-medium text-foreground">{e.user_email || "—"}</td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${ACTION_PILL_CLASSES[e.action] || 'bg-muted text-muted-foreground'}`}>
                                                    {e.action.replace(/_/g, " ")}
                                                </span>
                                            </td>
                                            <td className="p-4 text-xs font-mono text-foreground font-medium">{targetLabel}</td>
                                            <td className="p-4 text-[11px] text-muted-foreground font-mono max-w-md truncate" title={detailsStr}>
                                                {detailsStr.length > 80 ? detailsStr.slice(0, 80) + "…" : detailsStr}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between bg-card p-4 rounded-xl border border-border shadow-sm shrink-0">
                    <span className="text-xs text-muted-foreground font-medium">
                        Page {page} of {totalPages} ({filteredAndSortedEntries.length} total)
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
