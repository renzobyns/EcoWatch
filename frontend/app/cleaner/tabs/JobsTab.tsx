"use client";

import { useMemo, useState, useEffect } from "react";
import { Search, ListChecks, Clock, PlayCircle, RotateCcw, ChevronLeft, ChevronRight, Inbox, ChevronDown } from "lucide-react";
import { slaDeadlineLabel, slaDeadlineColor, SLA_PILL_CLASSES } from "@/lib/sla";
import { KpiCard } from "@/components/portal/KpiCard";

function parseUTCMs(iso: string): number {
    return new Date(iso.endsWith("Z") || iso.includes("+") || iso.includes("-", 10) ? iso : iso + "Z").getTime();
}

interface JobsTabProps {
    user: any;
    workOrders: any[];
    onOpenWO: (wo: any) => void;
    loading: boolean;
}

type JobFilter = "all" | "assigned" | "in_progress" | "needs_redo";
type SortKey = "sla_deadline" | "priority" | "created_at";

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export function JobsTab({ user, workOrders, onOpenWO, loading }: JobsTabProps) {
    const [filter, setFilter] = useState<JobFilter>("all");
    const [sortBy, setSortBy] = useState<SortKey>("sla_deadline");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const openJobs = useMemo(
        () => workOrders.filter((w) => ["assigned", "in_progress", "needs_redo"].includes(w.status)),
        [workOrders],
    );

    const counts = useMemo(
        () => ({
            all: openJobs.length,
            assigned: openJobs.filter((w) => w.status === "assigned").length,
            in_progress: openJobs.filter((w) => w.status === "in_progress").length,
            needs_redo: openJobs.filter((w) => w.status === "needs_redo").length,
        }),
        [openJobs],
    );

    const filtered = useMemo(() => {
        let list = openJobs;
        if (filter !== "all") list = list.filter((w) => w.status === filter);
        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter((w) => (w.report_tracking_id ?? "").toLowerCase().includes(q));
        }
        const sorted = [...list];
        if (sortBy === "sla_deadline") {
            sorted.sort((a, b) => {
                const da = a.sla_deadline ? parseUTCMs(a.sla_deadline) : Infinity;
                const db = b.sla_deadline ? parseUTCMs(b.sla_deadline) : Infinity;
                return da - db;
            });
        } else if (sortBy === "priority") {
            sorted.sort((a, b) => (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99));
        } else {
            sorted.sort((a, b) => parseUTCMs(b.created_at) - parseUTCMs(a.created_at));
        }
        return sorted;
    }, [openJobs, filter, search, sortBy]);

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
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">My Jobs</h1>
                    {user?.barangay_assignment ? (
                        <p className="text-sm text-muted-foreground mt-1">
                            Assigned to: <span className="font-semibold text-foreground">{user.barangay_assignment}</span>
                        </p>
                    ) : (
                        <p className="text-sm text-muted-foreground mt-1">View and manage your assigned cleanup work orders.</p>
                    )}
                </div>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                <KpiCard
                    label="Total Open"
                    value={counts.all}
                    icon={<ListChecks size={22} />}
                    tone="blue"
                />
                <KpiCard
                    label="Pending Start"
                    value={counts.assigned}
                    icon={<Clock size={22} />}
                    tone="yellow"
                />
                <KpiCard
                    label="In Progress"
                    value={counts.in_progress}
                    icon={<PlayCircle size={22} />}
                    tone="emerald"
                />
                <KpiCard
                    label="Needs Redo"
                    value={counts.needs_redo}
                    icon={<RotateCcw size={22} />}
                    tone={counts.needs_redo > 0 ? "red" : "emerald"}
                />
            </div>

            {/* Main List Container */}
            <div className="bg-card p-4 md:p-6 rounded-xl border border-border shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-base font-bold text-foreground">Work Orders</h2>
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
                        {(["all", "assigned", "in_progress", "needs_redo"] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                                    filter === f
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-muted/50 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                                }`}
                            >
                                {f === "all" ? "All" : f === "assigned" ? "Assigned" : f === "in_progress" ? "In Progress" : "Needs Redo"}
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
                {loading ? (
                    <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
                        <p className="text-sm font-medium">Loading work orders...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-16 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
                        <Inbox size={48} className="mb-4 opacity-20" />
                        <p className="text-sm font-medium text-foreground">
                            {openJobs.length === 0 ? "No work assigned yet. Enjoy the break!" : "No jobs match your filter."}
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
                                        <th className="px-4 py-3 font-medium">SLA Deadline</th>
                                        <th className="px-4 py-3 font-medium">Status</th>
                                        <th className="px-4 py-3 font-medium text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginated.map((wo) => {
                                        const slaLabel = wo.sla_deadline ? slaDeadlineLabel(wo.sla_deadline) : "—";
                                        const color = wo.sla_deadline ? slaDeadlineColor(wo.sla_deadline) : "green";
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
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded-md text-[11px] font-bold ${SLA_PILL_CLASSES[color]}`}>
                                                        {slaLabel}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <StatusBadge status={wo.status} />
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <ActionButton status={wo.status} onClick={() => onOpenWO(wo)} />
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
                                const slaLabel = wo.sla_deadline ? slaDeadlineLabel(wo.sla_deadline) : "—";
                                const color = wo.sla_deadline ? slaDeadlineColor(wo.sla_deadline) : "green";
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
                                            <StatusBadge status={wo.status} />
                                        </div>
                                        
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <PriorityBadge priority={wo.priority} />
                                                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${SLA_PILL_CLASSES[color]}`}>
                                                    SLA: {slaLabel}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <ActionButton status={wo.status} onClick={() => onOpenWO(wo)} fullWidth />
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

function StatusBadge({ status }: { status: string }) {
    return (
        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider ${
            status === "in_progress"
                ? "bg-yellow-500/10 text-yellow-600 border border-yellow-500/20"
                : status === "needs_redo"
                    ? "bg-red-500/10 text-red-500 border border-red-500/20"
                    : "bg-primary/10 text-primary border border-primary/20"
        }`}>
            {status === "needs_redo" ? "Redo" : status.replaceAll("_", " ")}
        </span>
    );
}

function ActionButton({ status, onClick, fullWidth }: { status: string; onClick: () => void; fullWidth?: boolean }) {
    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
            className={`px-3 py-1.5 bg-background border border-border text-muted-foreground text-xs font-semibold rounded-lg hover:border-primary hover:text-primary transition-colors ${fullWidth ? "w-full" : ""}`}
        >
            {status === "assigned"
                ? "Start Work"
                : status === "in_progress"
                    ? "Upload Photo"
                    : "Re-attempt"}
        </button>
    );
}

function CustomSortDropdown({ value, onChange }: { value: string; onChange: (val: string) => void }) {
    const [open, setOpen] = useState(false);
    
    const options = [
        { value: "sla_deadline", label: "SLA deadline" },
        { value: "priority", label: "Priority" },
        { value: "created_at", label: "Newest" },
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
