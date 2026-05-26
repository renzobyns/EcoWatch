"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { slaDeadlineLabel, slaDeadlineColor, SLA_PILL_CLASSES } from "@/lib/sla";

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

    return (
        <div className="space-y-5 animate-slide-up">
            {/* Header */}
            <div className="flex items-end justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">
                        My <span className="text-primary">Jobs</span>
                    </h1>
                    {user?.barangay_assignment && (
                        <p className="text-emerald-400 font-semibold uppercase tracking-[0.18em] text-[11px] mt-1 px-2.5 py-0.5 bg-emerald-400/10 rounded-full w-fit border border-emerald-400/20">
                            {user.barangay_assignment}
                        </p>
                    )}
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-foreground/40 pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search EW-..."
                        className="pl-9 pr-3 py-2 rounded-xl glass border border-border text-sm text-foreground placeholder-foreground/40 focus:outline-none focus:border-primary/60 w-56"
                    />
                </div>
            </div>

            {/* Filters + sort */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                    <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" count={counts.all} />
                    <FilterChip active={filter === "assigned"} onClick={() => setFilter("assigned")} label="Assigned" count={counts.assigned} />
                    <FilterChip active={filter === "in_progress"} onClick={() => setFilter("in_progress")} label="In Progress" count={counts.in_progress} />
                    <FilterChip active={filter === "needs_redo"} onClick={() => setFilter("needs_redo")} label="Needs Redo" count={counts.needs_redo} />
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <span className="text-foreground/50 uppercase tracking-widest font-bold">Sort:</span>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortKey)}
                        className="glass border border-border rounded-lg px-2 py-1.5 text-foreground text-xs font-semibold focus:outline-none focus:border-primary/60"
                    >
                        <option value="sla_deadline">SLA deadline</option>
                        <option value="priority">Priority</option>
                        <option value="created_at">Newest</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="glass rounded-2xl border border-border shadow-2xl overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-foreground/50">
                        <div className="inline-block w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        <p className="mt-4 text-sm font-bold">Loading work orders…</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-12 text-center text-foreground/50 font-bold">
                        {openJobs.length === 0
                            ? "No work assigned yet. Check back soon!"
                            : "No jobs match your filter."}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-border text-xs text-foreground/40 uppercase tracking-widest bg-black/20">
                                    <th className="p-4">Tracking ID</th>
                                    <th className="p-4">Priority</th>
                                    <th className="p-4">SLA</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((wo) => {
                                    const slaLabel = wo.sla_deadline ? slaDeadlineLabel(wo.sla_deadline) : "—";
                                    const color = wo.sla_deadline ? slaDeadlineColor(wo.sla_deadline) : "green";
                                    return (
                                        <tr
                                            key={wo.id}
                                            onClick={() => onOpenWO(wo)}
                                            className="border-b border-border hover:bg-foreground/5 transition-colors cursor-pointer"
                                        >
                                            <td className="p-4 font-mono text-sm text-foreground font-bold">
                                                {wo.report_tracking_id ?? `WO #${wo.id}`}
                                            </td>
                                            <td className="p-4 text-sm font-semibold">
                                                <span
                                                    className={`px-2.5 py-1 rounded-md text-xs uppercase tracking-wider ${
                                                        wo.priority === "high"
                                                            ? "bg-red-500/20 text-red-400"
                                                            : wo.priority === "low"
                                                              ? "bg-blue-500/20 text-blue-400"
                                                              : "bg-yellow-500/20 text-yellow-400"
                                                    }`}
                                                >
                                                    {wo.priority}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-md text-[11px] font-bold ${SLA_PILL_CLASSES[color]}`}>
                                                    {slaLabel}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span
                                                    className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                                                        wo.status === "in_progress"
                                                            ? "bg-yellow-500/20 text-yellow-400"
                                                            : wo.status === "needs_redo"
                                                              ? "bg-red-500/20 text-red-400"
                                                              : "bg-foreground/10 text-foreground"
                                                    }`}
                                                >
                                                    {wo.status === "needs_redo" ? "Redo" : wo.status.replaceAll("_", " ")}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onOpenWO(wo);
                                                    }}
                                                    className="px-4 py-2 glass border border-primary text-primary text-xs font-bold rounded-lg hover:bg-primary/10 transition-colors"
                                                >
                                                    {wo.status === "assigned"
                                                        ? "Start"
                                                        : wo.status === "in_progress"
                                                          ? "Upload Photo"
                                                          : "Re-attempt"}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${
                active
                    ? "bg-primary/20 border-primary text-primary"
                    : "glass border-border text-foreground/70 hover:text-foreground hover:bg-foreground/5"
            }`}
        >
            {label} <span className="ml-1 opacity-70">({count})</span>
        </button>
    );
}
