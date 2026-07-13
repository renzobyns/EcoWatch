"use client";

import { useState, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { AuditEntry } from "@/components/portal/ReportDetailDrawer";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { DateRange } from "react-day-picker";
import { formatDateTime } from "@/lib/date-utils";
import { toast } from "sonner";

const ACTION_FILTER_OPTIONS = ["all", "deploy", "resolve", "reassign", "force_close", "create_user", "disable_user"];

const ACTION_PILL_CLASSES: Record<string, string> = {
    deploy: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
    resolve: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
    reassign: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20",
    force_close: "bg-destructive/10 text-destructive border border-destructive/20",
    disable_user: "bg-destructive/10 text-destructive border border-destructive/20",
    create_user: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function AuditLogTab({ user }: { user: any }) {
    const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditHasMore, setAuditHasMore] = useState(false);
    const [auditOffset, setAuditOffset] = useState(0);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [auditAction, setAuditAction] = useState("all");
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

    const fetchAuditLog = async (offset = 0) => {
        setAuditLoading(true);
        try {
            const data = await api(`/audit-log?limit=50&offset=${offset}`);
            const entries: AuditEntry[] = Array.isArray(data?.entries) ? data.entries : [];
            setAuditEntries((prev) => (offset === 0 ? entries : [...prev, ...entries]));
            setAuditHasMore(entries.length === 50);
            setAuditOffset(offset);
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to load audit log");
        } finally {
            setAuditLoading(false);
        }
    };

    useEffect(() => {
        if (!user) return;
        if (auditEntries.length === 0) fetchAuditLog(0);
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

    return (
        <div className="flex-1 bg-card rounded-2xl border border-border flex flex-col min-h-0 animate-slide-up">
            {/* Toolbar */}
            <div className="p-4 md:p-6 border-b border-border shrink-0 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">Audit Log</h2>
                    <p className="text-sm text-muted-foreground">Every override action — who, when, what, why.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={14} className="text-muted-foreground" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by User or Target..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                        />
                    </div>

                    <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                        className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
                    >
                        <option value="desc">Newest First</option>
                        <option value="asc">Oldest First</option>
                    </select>

                    <select
                        value={auditAction}
                        onChange={(e) => setAuditAction(e.target.value)}
                        className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
                    >
                        {ACTION_FILTER_OPTIONS.map((a) => (
                            <option key={a} value={a}>{a === "all" ? "All actions" : a}</option>
                        ))}
                    </select>

                    <DateRangePicker 
                        date={dateRange}
                        onDateChange={setDateRange}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground font-medium tracking-tight bg-card sticky top-0 z-10">
                            <th className="p-4">Timestamp</th>
                            <th className="p-4">User</th>
                            <th className="p-4">Action</th>
                            <th className="p-4">Target</th>
                            <th className="p-4">Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {auditLoading && auditEntries.length === 0 ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="border-b border-border">
                                    {Array.from({ length: 5 }).map((__, j) => (
                                        <td key={j} className="p-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                                    ))}
                                </tr>
                            ))
                        ) : filteredAndSortedEntries.length === 0 ? (
                            <tr><td colSpan={5} className="p-12 text-center text-muted-foreground font-medium">No audit entries match this filter.</td></tr>
                        ) : (
                            filteredAndSortedEntries.map((e) => {
                                const detailsStr = e.details && Object.keys(e.details).length ? JSON.stringify(e.details) : "";
                                const targetLabel = (e.details?.tracking_id as string) || `${e.target_type} #${e.target_id ?? "—"}`;
                                return (
                                    <tr key={e.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                                        <td className="p-4 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(e.created_at)}</td>
                                        <td className="p-4 text-sm font-medium text-foreground">{e.user_email || "—"}</td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${ACTION_PILL_CLASSES[e.action] || 'bg-muted text-muted-foreground'}`}>
                                                {e.action}
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

            {auditHasMore && (
                <div className="p-4 border-t border-border shrink-0 flex justify-center bg-muted/10">
                    <button
                        onClick={() => fetchAuditLog(auditOffset + 50)}
                        disabled={auditLoading}
                        className="px-6 py-2 rounded-lg bg-background border border-border text-foreground text-xs font-semibold hover:bg-muted transition-colors disabled:opacity-50"
                    >
                        {auditLoading ? "Loading…" : "Load More"}
                    </button>
                </div>
            )}
        </div>
    );
}
