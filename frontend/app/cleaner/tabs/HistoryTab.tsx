"use client";

import { useMemo, useState, useEffect } from "react";
import { formatDateTime } from "@/lib/date-utils";
import { Search, History, CheckCircle2, RotateCcw, XCircle, ChevronLeft, ChevronRight, Inbox, ChevronDown } from "lucide-react";
import { KpiCard } from "@/components/portal/KpiCard";

interface HistoryTabProps {
    user: any;
    workOrders: any[];
    onOpenWO: (wo: any) => void;
}

type HistoryFilter = "all" | "verified" | "needs_redo" | "failed";
type SortKey = "newest" | "oldest";

function isHistory(wo: any): boolean {
    return (
        wo.status === "verified" ||
        wo.status === "completed" ||
        wo.status === "needs_redo" ||
        wo.report_status === "failed_cleanup"
    );
}

function classifyOutcome(wo: any): "verified" | "needs_redo" | "failed" {
    if (wo.status === "verified" || wo.status === "completed") return "verified";
    if (wo.report_status === "failed_cleanup" && wo.status !== "needs_redo") return "failed";
    return "needs_redo";
}

function parseUTCMs(iso: string): number {
    return new Date(iso.endsWith("Z") || iso.includes("+") || iso.includes("-", 10) ? iso : iso + "Z").getTime();
}

function formatDuration(startIso?: string | null, endIso?: string | null): string {
    if (!startIso || !endIso) return "—";
    const start = parseUTCMs(startIso);
    const end = parseUTCMs(endIso);
    const diffMs = Math.max(0, end - start);
    const h = Math.floor(diffMs / 3600000);
    const m = Math.floor((diffMs % 3600000) / 60000);
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
}

export function HistoryTab({ user, workOrders, onOpenWO }: HistoryTabProps) {
    const [filter, setFilter] = useState<HistoryFilter>("all");
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState<SortKey>("newest");
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const historyList = useMemo(() => workOrders.filter(isHistory), [workOrders]);

    const counts = useMemo(() => {
        const c = { all: historyList.length, verified: 0, needs_redo: 0, failed: 0 };
        for (const wo of historyList) {
            c[classifyOutcome(wo)] += 1;
        }
        return c;
    }, [historyList]);

    const filtered = useMemo(() => {
        let list = historyList;
        
        if (filter !== "all") {
            list = list.filter((wo) => classifyOutcome(wo) === filter);
        }
        
        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter((w) => (w.report_tracking_id ?? "").toLowerCase().includes(q));
        }

        const sorted = [...list];
        sorted.sort((a, b) => {
            const da = a.completed_at ? parseUTCMs(a.completed_at) : 0;
            const db = b.completed_at ? parseUTCMs(b.completed_at) : 0;
            return sortBy === "newest" ? db - da : da - db;
        });
        
        return sorted;
    }, [historyList, filter, search, sortBy]);

    useEffect(() => {
        setPage(1); // Reset to page 1 on filter/search change
    }, [filter, search, sortBy]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

    return (
        <div className="flex flex-col gap-6 pb-28 md:pb-8 w-full animate-slide-up">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">History</h1>
                    {user?.barangay_assignment ? (
                        <p className="text-sm text-muted-foreground mt-1">
                            Assigned to: <span className="font-semibold text-foreground">{user.barangay_assignment}</span>
                        </p>
                    ) : (
                        <p className="text-sm text-muted-foreground mt-1">View your past completed and failed work orders.</p>
                    )}
                </div>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                <KpiCard
                    label="Total Logs"
                    value={counts.all}
                    icon={<History size={22} />}
                    tone="blue"
                />
                <KpiCard
                    label="Verified Success"
                    value={counts.verified}
                    icon={<CheckCircle2 size={22} />}
                    tone="emerald"
                />
                <KpiCard
                    label="Needs Redo"
                    value={counts.needs_redo}
                    icon={<RotateCcw size={22} />}
                    tone={counts.needs_redo > 0 ? "yellow" : "emerald"}
                />
                <KpiCard
                    label="Failed"
                    value={counts.failed}
                    icon={<XCircle size={22} />}
                    tone={counts.failed > 0 ? "red" : "emerald"}
                />
            </div>

            {/* Main List Container */}
            <div className="bg-card p-4 md:p-6 rounded-xl border border-border shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-base font-bold text-foreground">Past Work Orders</h2>
                </div>

                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3 mb-6">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px] max-w-xs">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search Tracking ID..."
                            className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                        />
                    </div>

                    {/* Filter chips */}
                    <div className="flex flex-wrap gap-1.5">
                        {(["all", "verified", "needs_redo", "failed"] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                                    filter === f
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-muted/50 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                                }`}
                            >
                                {f === "all" ? "All" : f === "verified" ? "Verified" : f === "needs_redo" ? "Redos" : "Failed"}
                            </button>
                        ))}
                    </div>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Sort */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground hidden sm:inline">Sort:</span>
                        <CustomSortDropdown value={sortBy} onChange={(val) => setSortBy(val as SortKey)} />
                    </div>
                </div>

                {/* Data Rendering */}
                {filtered.length === 0 ? (
                    <div className="py-16 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
                        <Inbox size={48} className="mb-4 opacity-20" />
                        <p className="text-sm font-medium text-foreground">
                            {historyList.length === 0 ? "No completed jobs yet. Your record will appear here." : "No jobs match your filter."}
                        </p>
                    </div>
                ) : (
                    <div className="flex-1">
                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-border text-xs font-medium text-muted-foreground bg-muted/30">
                                        <th className="px-4 py-3 font-medium">Tracking ID</th>
                                        <th className="px-4 py-3 font-medium">Priority</th>
                                        <th className="px-4 py-3 font-medium">Completed At</th>
                                        <th className="px-4 py-3 font-medium">Time Taken</th>
                                        <th className="px-4 py-3 font-medium text-right">Outcome</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginated.map((wo) => {
                                        return (
                                            <tr
                                                key={wo.id}
                                                onClick={() => onOpenWO(wo)}
                                                className="border-b border-border hover:bg-muted/50 transition-colors cursor-pointer group"
                                            >
                                                <td className="px-4 py-3 font-mono text-sm font-medium text-foreground">
                                                    {wo.report_tracking_id ?? `WO #${wo.id}`}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <PriorityBadge priority={wo.priority} />
                                                </td>
                                                <td className="px-4 py-3 text-sm text-muted-foreground font-medium">
                                                    {wo.completed_at ? formatDateTime(wo.completed_at) : "—"}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-muted-foreground font-medium">
                                                    {formatDuration(wo.started_at, wo.completed_at)}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <OutcomeBadge outcome={classifyOutcome(wo)} />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="grid grid-cols-1 gap-3 md:hidden">
                            {paginated.map((wo) => {
                                return (
                                    <div
                                        key={wo.id}
                                        onClick={() => onOpenWO(wo)}
                                        className="flex flex-col bg-background border border-border rounded-xl p-4 shadow-sm hover:border-primary/50 transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <p className="text-xs text-muted-foreground font-medium mb-1">Tracking ID</p>
                                                <p className="font-mono text-sm font-bold text-foreground">{wo.report_tracking_id ?? `WO #${wo.id}`}</p>
                                            </div>
                                            <OutcomeBadge outcome={classifyOutcome(wo)} />
                                        </div>
                                        
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col gap-1">
                                                <p className="text-[11px] font-medium text-muted-foreground">Priority</p>
                                                <PriorityBadge priority={wo.priority} />
                                            </div>
                                            <div className="flex flex-col items-end gap-1 text-right">
                                                <p className="text-[11px] font-medium text-muted-foreground">Time Taken</p>
                                                <span className="text-sm font-medium text-foreground">{formatDuration(wo.started_at, wo.completed_at)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Pagination Controls */}
                {filtered.length > 0 && (
                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
                        <span className="text-xs font-medium text-muted-foreground">
                            Page {page} of {totalPages} ({filtered.length} total)
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// --- Helper Components ---

function PriorityBadge({ priority }: { priority: string }) {
    return (
        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider ${
            priority === "high"
                ? "bg-red-500/10 text-red-500 border border-red-500/20"
                : priority === "low"
                    ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                    : "bg-yellow-500/10 text-yellow-600 border border-yellow-500/20"
        }`}>
            {priority}
        </span>
    );
}

function OutcomeBadge({ outcome }: { outcome: "verified" | "needs_redo" | "failed" }) {
    const outcomeLabel = outcome === "verified" ? "Verified" : outcome === "needs_redo" ? "Needs redo" : "Failed";
    return (
        <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 ${
            outcome === "verified"
                ? "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20"
                : outcome === "needs_redo"
                    ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20"
                    : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
        }`}>
            {outcome === "verified" ? <CheckCircle2 size={12} /> : outcome === "needs_redo" ? <RotateCcw size={12} /> : <XCircle size={12} />}
            {outcomeLabel}
        </span>
    );
}

function CustomSortDropdown({ value, onChange }: { value: string; onChange: (val: string) => void }) {
    const [open, setOpen] = useState(false);
    
    const options = [
        { value: "newest", label: "Newest first" },
        { value: "oldest", label: "Oldest first" },
    ];
    
    const selectedLabel = options.find((o) => o.value === value)?.label ?? "Sort";

    // Close when clicking outside
    useEffect(() => {
        if (!open) return;
        const close = () => setOpen(false);
        window.addEventListener("click", close);
        return () => window.removeEventListener("click", close);
    }, [open]);

    return (
        <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center justify-between gap-2 w-[140px] px-3 py-2 bg-background border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors focus:outline-none"
            >
                <span className="truncate">{selectedLabel}</span>
                <ChevronDown size={14} className="opacity-50 shrink-0" />
            </button>
            {open && (
                <div className="absolute top-full mt-1 right-0 w-[140px] bg-card border border-border rounded-lg shadow-lg overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2">
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => {
                                onChange(opt.value);
                                setOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                value === opt.value
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
