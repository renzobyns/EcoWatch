"use client";

import { useMemo, useState } from "react";

interface HistoryTabProps {
    user: any;
    workOrders: any[];
    onOpenWO: (wo: any) => void;
}

type HistoryFilter = "all" | "verified" | "needs_redo" | "failed";

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

function formatDuration(startIso?: string | null, endIso?: string | null): string {
    if (!startIso || !endIso) return "—";
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    const diffMs = Math.max(0, end - start);
    const h = Math.floor(diffMs / 3600000);
    const m = Math.floor((diffMs % 3600000) / 60000);
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
}

export function HistoryTab({ user, workOrders, onOpenWO }: HistoryTabProps) {
    const [filter, setFilter] = useState<HistoryFilter>("all");

    const historyList = useMemo(() => workOrders.filter(isHistory), [workOrders]);

    const counts = useMemo(() => {
        const c = { all: historyList.length, verified: 0, needs_redo: 0, failed: 0 };
        for (const wo of historyList) {
            c[classifyOutcome(wo)] += 1;
        }
        return c;
    }, [historyList]);

    const filtered = useMemo(() => {
        const list = filter === "all" ? historyList : historyList.filter((wo) => classifyOutcome(wo) === filter);
        return [...list].sort((a, b) => {
            const da = a.completed_at ? new Date(a.completed_at).getTime() : 0;
            const db = b.completed_at ? new Date(b.completed_at).getTime() : 0;
            return db - da;
        });
    }, [historyList, filter]);

    return (
        <div className="space-y-5 animate-slide-up">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">History</h1>
                {user?.barangay_assignment && (
                    <p className="text-emerald-400 font-semibold uppercase tracking-[0.18em] text-[11px] mt-1 px-2.5 py-0.5 bg-emerald-400/10 rounded-full w-fit border border-emerald-400/20">
                        {user.barangay_assignment}
                    </p>
                )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" count={counts.all} />
                <FilterChip active={filter === "verified"} onClick={() => setFilter("verified")} label="Verified" count={counts.verified} />
                <FilterChip active={filter === "needs_redo"} onClick={() => setFilter("needs_redo")} label="Redos" count={counts.needs_redo} />
                <FilterChip active={filter === "failed"} onClick={() => setFilter("failed")} label="Failed" count={counts.failed} />
            </div>

            {/* Table */}
            <div className="glass rounded-2xl border border-border shadow-2xl overflow-hidden">
                {filtered.length === 0 ? (
                    <div className="p-12 text-center text-foreground/50 font-bold">
                        {historyList.length === 0
                            ? "No completed jobs yet. Your record will appear here."
                            : "No jobs match your filter."}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-border text-xs text-foreground/40 uppercase tracking-widest bg-black/20">
                                    <th className="p-4">Tracking</th>
                                    <th className="p-4">Priority</th>
                                    <th className="p-4">Completed</th>
                                    <th className="p-4">Time Taken</th>
                                    <th className="p-4">Outcome</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((wo) => {
                                    const outcome = classifyOutcome(wo);
                                    const outcomeClass =
                                        outcome === "verified"
                                            ? "bg-green-500/20 text-green-400"
                                            : outcome === "needs_redo"
                                              ? "bg-yellow-500/20 text-yellow-400"
                                              : "bg-red-500/20 text-red-400";
                                    const outcomeLabel =
                                        outcome === "verified" ? "Verified" : outcome === "needs_redo" ? "Needs redo" : "Failed";
                                    return (
                                        <tr
                                            key={wo.id}
                                            onClick={() => onOpenWO(wo)}
                                            className="border-b border-border hover:bg-foreground/5 transition-colors cursor-pointer"
                                        >
                                            <td className="p-4 font-mono text-sm text-foreground font-bold">
                                                {wo.report_tracking_id ?? `WO #${wo.id}`}
                                            </td>
                                            <td className="p-4">
                                                <span
                                                    className={`px-2.5 py-1 rounded-md text-xs uppercase tracking-wider font-semibold ${
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
                                            <td className="p-4 text-sm text-foreground/80">
                                                {wo.completed_at ? new Date(wo.completed_at).toLocaleString() : "—"}
                                            </td>
                                            <td className="p-4 text-sm text-foreground/80">
                                                {formatDuration(wo.started_at, wo.completed_at)}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${outcomeClass}`}>
                                                    {outcomeLabel}
                                                </span>
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
