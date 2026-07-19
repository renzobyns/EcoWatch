"use client";

import { X, ExternalLink, AlertCircle } from "lucide-react";

type BreakdownChip = {
    label: string;
    count: number;
    tone: "blue" | "emerald" | "yellow" | "red" | "violet";
};

type DrilldownRow = Record<string, string | number | boolean | null | undefined>;

export type DrilldownData = {
    kind: "reports" | "work_orders";
    title: string;
    headline: string;
    formula: string;
    breakdown: BreakdownChip[];
    columns: string[];
    rows: DrilldownRow[];
    total: number;
};

interface Props {
    open: boolean;
    loading: boolean;
    error: string | null;
    data: DrilldownData | null;
    onClose: () => void;
    onRowClick?: (row: DrilldownRow) => void;
}

const TONE_CHIP: Record<string, string> = {
    blue:    "bg-blue-500/15 text-blue-300 border-blue-500/30",
    emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    yellow:  "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
    red:     "bg-red-500/15 text-red-300 border-red-500/30",
    violet:  "bg-violet-500/15 text-violet-300 border-violet-500/30",
};

const DETAIL_TONE: Record<string, string> = {
    resolved:        "text-emerald-300",
    "on-time":       "text-emerald-300",
    late:            "text-red-300",
    rejected:        "text-red-300",
    failed_cleanup:  "text-red-300",
    pending:         "text-yellow-300",
    verified:        "text-blue-300",
    assigned:        "text-blue-300",
    in_progress:     "text-yellow-300",
};

const COL_LABEL: Record<string, string> = {
    tracking_id: "ID",
    barangay:    "Barangay",
    status:      "Status",
    created_at:  "Submitted",
    resolved_at: "Resolved",
    sla_deadline:"SLA Deadline",
    completed_at:"Completed",
    priority:    "Priority",
    _detail:     "Detail",
};

function fmtDate(val: string | number | boolean | null | undefined): string {
    if (!val || typeof val !== "string") return "—";
    try {
        return new Date(val).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
    } catch {
        return val;
    }
}

function StatusPill({ value }: { value: string }) {
    const map: Record<string, string> = {
        resolved:        "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
        verified:        "bg-blue-500/15 text-blue-300 border-blue-500/30",
        assigned:        "bg-blue-500/15 text-blue-300 border-blue-500/30",
        in_progress:     "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
        pending:         "bg-foreground/10 text-foreground/60 border-border",
        rejected:        "bg-red-500/15 text-red-300 border-red-500/30",
        failed_cleanup:  "bg-red-500/15 text-red-300 border-red-500/30",
        completed:       "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    };
    const cls = map[value] ?? "bg-foreground/10 text-foreground/60 border-border";
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
            {value.replace(/_/g, " ")}
        </span>
    );
}

function CellValue({ col, val }: { col: string; val: string | number | boolean | null | undefined }) {
    if (val == null) return <span className="text-foreground/30">—</span>;
    if (col === "status") return <StatusPill value={String(val)} />;
    if (col === "created_at" || col === "resolved_at" || col === "sla_deadline" || col === "completed_at") {
        return <span className="text-foreground/70">{fmtDate(val)}</span>;
    }
    if (col === "_detail") {
        const s = String(val);
        const tone = DETAIL_TONE[s] ?? "text-foreground/60";
        return <span className={`text-xs font-bold uppercase tracking-wide ${tone}`}>{s.replace(/_/g, " ")}</span>;
    }
    if (col === "priority") {
        const t = val === "high" ? "text-red-300" : val === "medium" ? "text-yellow-300" : "text-blue-300";
        return <span className={`text-xs font-bold uppercase ${t}`}>{String(val)}</span>;
    }
    if (col === "tracking_id") {
        return <span className="font-mono text-xs text-foreground/90">{String(val)}</span>;
    }
    return <span className="text-foreground/80 text-sm">{String(val)}</span>;
}

export function AnalyticsDrilldownModal({ open, loading, error, data, onClose, onRowClick }: Props) {
    if (!open) return null;

    const visibleCols = (data?.columns ?? []).filter(
        (c) => c !== "resolved_at" || data?.rows.some((r) => r.resolved_at != null)
    );

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-card max-w-3xl w-full rounded-xl border border-border overflow-hidden flex flex-col max-h-[85vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                    <div className="flex items-baseline gap-3">
                        <h2 className="text-base font-bold text-foreground">
                            {data?.title ?? "Drill-down"}
                        </h2>
                        {data?.headline && (
                            <span className="text-2xl font-bold text-foreground tracking-tight">
                                {data.headline}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-foreground/50 hover:text-foreground bg-foreground/5 hover:bg-foreground/10 rounded-full transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Formula + breakdown chips */}
                {data && (
                    <div className="px-6 py-3 border-b border-border bg-muted/50 shrink-0 space-y-2">
                        <p className="text-sm text-muted-foreground">{data.formula}</p>
                        <div className="flex flex-wrap gap-2">
                            {data.breakdown.map((chip) => (
                                <span
                                    key={chip.label}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${TONE_CHIP[chip.tone] ?? TONE_CHIP.blue}`}
                                >
                                    {chip.label}
                                    <span className="opacity-70">·</span>
                                    {chip.count}
                                </span>
                            ))}
                            {data.total > data.rows.length && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border bg-foreground/5 text-foreground/40 border-border">
                                    showing {data.rows.length} of {data.total}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Body */}
                <div className="flex-1 overflow-y-auto min-h-0">
                    {loading && (
                        <div className="p-4 animate-pulse">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/20">
                                        {Array.from({ length: 4 }).map((_, i) => (
                                            <th key={i} className="py-3 px-4">
                                                <div className="h-3 bg-muted rounded w-20" />
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="border-b border-border/40">
                                            {Array.from({ length: 4 }).map((_, j) => (
                                                <td key={j} className="py-3 px-4">
                                                    <div className="h-4 bg-muted rounded w-24" />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {error && !loading && (
                        <div className="flex items-center justify-center py-16 gap-3 text-red-300">
                            <AlertCircle size={18} />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    {!loading && !error && data && data.rows.length === 0 && (
                        <div className="flex items-center justify-center py-16">
                            <p className="text-sm text-foreground/40 italic">No records in this window.</p>
                        </div>
                    )}

                    {!loading && !error && data && data.rows.length > 0 && (
                        <table className="w-full text-left text-sm">
                            <thead className="sticky top-0 bg-card border-b border-border z-10">
                                <tr>
                                    {visibleCols.map((col) => (
                                        <th
                                            key={col}
                                            className="py-3 px-4 text-sm font-medium text-muted-foreground"
                                        >
                                            {COL_LABEL[col] ?? col}
                                        </th>
                                    ))}
                                    {onRowClick && data.kind === "reports" && (
                                        <th className="py-3 px-4 w-8" />
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {data.rows.map((row, idx) => (
                                    <tr
                                        key={idx}
                                        className={`border-b border-border/40 ${onRowClick && data.kind === "reports" ? "cursor-pointer hover:bg-foreground/5 transition-colors" : ""}`}
                                        onClick={() => onRowClick && data.kind === "reports" ? onRowClick(row) : undefined}
                                    >
                                        {visibleCols.map((col) => (
                                            <td key={col} className="py-2.5 px-4">
                                                <CellValue col={col} val={row[col]} />
                                            </td>
                                        ))}
                                        {onRowClick && data.kind === "reports" && (
                                            <td className="py-2.5 px-4 text-foreground/30">
                                                <ExternalLink size={14} />
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-border shrink-0 flex items-center justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border rounded-lg text-sm font-medium transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
