"use client";

import { useMemo } from "react";
import {
    AreaChart, Area, BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine, Cell,
} from "recharts";
import {
    Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Award, BarChart3, Brain, CheckCircle2,
    ChevronRight, Clock, FileDown, Filter, Minus, RefreshCw, Sparkles, Target, TrendingDown, TrendingUp, Zap,
} from "lucide-react";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { DateRange } from "react-day-picker";

type WindowMeta = {
    days: number;
    granularity: "day" | "week" | "month";
    start: string;
    end: string;
    prior_start: string;
};

type KpiBlock = {
    reports: number;
    resolved: number;
    resolution_rate: number;
    avg_resolve_days: number;
    sla_compliance: number | null;
};

type KpiSet = {
    current: KpiBlock;
    prior: KpiBlock;
    delta: {
        reports_pct: number | null;
        resolution_rate_pts: number;
        avg_resolve_days_pct: number | null;
        sla_compliance_pts: number | null;
    };
};

type TrendPoint = {
    date: string;
    submitted: number;
    resolved: number;
    rejected: number;
    avg_confidence: number | null;
};

type LeaderboardRow = {
    barangay: string;
    total: number;
    resolved: number;
    deployed: number;
    pending: number;
    resolution_rate: number;
    avg_resolve_days: number;
    prior_total: number;
    trend: "up" | "down" | "flat" | "new";
};

type FunnelStage = { key: string; label: string; count: number };

type FunnelData = {
    stages: FunnelStage[];
    branches: FunnelStage[];
    raw_counts: Record<string, number>;
};

type AiHistogramBucket = { bucket: string; count: number; min: number; max: number };

type AiQuality = {
    histogram: AiHistogramBucket[];
    total_analyzed: number;
    mean_confidence: number | null;
    mean_verified_confidence: number | null;
    rejected_count: number;
    verification_rate: number;
    ai_threshold: number;
};

type ResponseRow = {
    priority: "low" | "medium" | "high";
    total_wos: number;
    avg_created_to_deployed_hours: number | null;
    avg_deployed_to_completed_hours: number | null;
    completed_count: number;
};

export type InsightsData = {
    window: WindowMeta;
    kpis: KpiSet;
    trend: TrendPoint[];
    barangay_leaderboard: LeaderboardRow[];
    funnel: FunnelData;
    ai_quality: AiQuality;
    response_time_by_priority: ResponseRow[];
};

interface Props {
    loading: boolean;
    data: InsightsData | null;
    dateRange: DateRange | undefined;
    onDateRangeChange: (r: DateRange | undefined) => void;
    exporting: boolean;
    onExport: () => void;
    onRefresh: () => void;
    lastUpdated: Date | null;
    onDrilldown?: (metric: string, key?: string) => void;
}



const PRIORITY_TONE: Record<string, { text: string; bg: string; border: string; dot: string }> = {
    high: { text: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", dot: "bg-red-400" },
    medium: { text: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", dot: "bg-yellow-400" },
    low: { text: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", dot: "bg-blue-400" },
};

const FUNNEL_TONE = [
    { fill: "bg-primary/30", text: "text-foreground", border: "border-primary/40" },
    { fill: "bg-primary/20", text: "text-foreground", border: "border-primary/30" },
    { fill: "bg-primary/10", text: "text-foreground", border: "border-primary/20" },
    { fill: "bg-primary/5", text: "text-foreground", border: "border-primary/10" },
];

function formatRelativeWindow(start: string, end: string): string {
    try {
        const s = new Date(start);
        const e = new Date(end);
        const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return `${fmt(s)} - ${fmt(e)}`;
    } catch {
        return "";
    }
}

function formatAxisDate(value: string): string {
    if (/^\d{4}-W\d{2}$/.test(value)) return value.slice(5);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const d = new Date(value + "T00:00:00");
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    if (/^\d{4}-\d{2}$/.test(value)) {
        const d = new Date(value + "-01T00:00:00");
        return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    }
    return value;
}

function formatLastUpdated(d: Date | null): string {
    if (!d) return "never";
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function deltaTone(value: number | null, higherIsBetter = true): "emerald" | "red" | "neutral" {
    if (value === null || value === 0) return "neutral";
    if (higherIsBetter) return value > 0 ? "emerald" : "red";
    return value > 0 ? "red" : "emerald";
}

function DeltaArrow({ value, higherIsBetter = true, suffix = "%" }: { value: number | null; higherIsBetter?: boolean; suffix?: string }) {
    if (value === null) {
        return <span className="inline-flex items-center gap-1 text-muted-foreground text-xs font-medium"><Minus size={12} /> n/a</span>;
    }
    const tone = deltaTone(value, higherIsBetter);
    const cls = tone === "emerald" ? "text-emerald-600 dark:text-emerald-400" : tone === "red" ? "text-red-600 dark:text-red-400" : "text-muted-foreground";
    const Icon = value === 0 ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
    const sign = value > 0 ? "+" : "";
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${cls}`}>
            <Icon size={12} />
            {sign}{value.toFixed(1)}{suffix}
        </span>
    );
}

function HeroKpi({
    label, value, suffix, icon, delta, deltaSuffix, higherIsBetter, priorLabel, onClick, tooltipText
}: {
    label: string;
    value: string;
    suffix?: string;
    icon: React.ReactNode;
    delta: number | null;
    deltaSuffix?: string;
    higherIsBetter?: boolean;
    priorLabel: string;
    onClick?: () => void;
    tooltipText?: string;
}) {
    return (
        <div
            className={`bg-card rounded-lg border border-border shadow-sm p-5 flex flex-col gap-3 group ${onClick ? "cursor-pointer hover:border-primary/50 transition-colors" : ""}`}
            onClick={onClick}
        >
            <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-muted-foreground truncate flex items-center gap-1.5">
                    {label}
                    {tooltipText && <InfoTooltip content={tooltipText} />}
                </div>
                <div className={`w-9 h-9 rounded-md flex items-center justify-center bg-primary/10 text-primary`}>{icon}</div>
            </div>
            <div className="flex items-baseline gap-1.5">
                <span className={`text-3xl font-bold tracking-tight text-foreground`}>{value}</span>
                {suffix && <span className={`text-base font-medium text-muted-foreground`}>{suffix}</span>}
            </div>
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                <DeltaArrow value={delta} higherIsBetter={higherIsBetter} suffix={deltaSuffix || "%"} />
                <span className="text-xs text-muted-foreground truncate">{onClick ? "View breakdown →" : priorLabel}</span>
            </div>
        </div>
    );
}

function FunnelRow({
    label, count, percent, width, tone, sublabel, onClick,
}: {
    label: string; count: number; percent: number; width: number; tone: typeof FUNNEL_TONE[number]; sublabel?: string; onClick?: () => void;
}) {
    return (
        <div className={`flex items-center gap-4 group ${onClick ? "cursor-pointer" : ""}`} onClick={onClick}>
            <div className="w-32 shrink-0">
                <div className={`text-sm font-semibold text-foreground tracking-tight`}>{label}</div>
                {sublabel && <div className="text-xs text-muted-foreground mt-0.5">{sublabel}</div>}
            </div>
            <div className="flex-1 relative h-10">
                <div className="absolute inset-0 rounded-md bg-muted border border-border" />
                <div
                    className={`absolute inset-y-0 left-0 rounded-md border ${tone.border} ${tone.fill} transition-all duration-700 ease-out`}
                    style={{ width: `${Math.max(width, 4)}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-between px-4">
                    <span className={`text-lg font-bold tracking-tight ${tone.text}`}>{count}</span>
                    <span className="text-xs text-muted-foreground font-medium">{percent.toFixed(0)}%</span>
                </div>
            </div>
        </div>
    );
}

function TrendArrow({ trend }: { trend: "up" | "down" | "flat" | "new" }) {
    if (trend === "up") return <TrendingUp size={14} className="text-yellow-300" />;
    if (trend === "down") return <TrendingDown size={14} className="text-emerald-300" />;
    if (trend === "new") return <Sparkles size={14} className="text-violet-300" />;
    return <Minus size={14} className="text-foreground/30" />;
}
export function AnalyticsTab({
    loading, data, dateRange, onDateRangeChange, exporting, onExport, onRefresh, lastUpdated, onDrilldown,
}: Props) {
    const trendChartData = useMemo(() => {
        if (!data) return [];
        return data.trend.map((p) => ({ ...p, _label: formatAxisDate(p.date) }));
    }, [data]);

    const aiChartData = useMemo(() => {
        if (!data) return [];
        return data.ai_quality.histogram.map((b) => ({
            bucket: b.bucket,
            count: b.count,
            isAboveThreshold: b.min >= (data.ai_quality.ai_threshold ?? 0.5),
        }));
    }, [data]);

    const funnelMax = useMemo(() => {
        if (!data) return 1;
        return Math.max(1, ...data.funnel.stages.map((s) => s.count));
    }, [data]);

    const totalRejectedShare = useMemo(() => {
        if (!data) return 0;
        const total = data.funnel.stages[0]?.count || 0;
        if (total === 0) return 0;
        return Math.round((data.funnel.branches[0]?.count || 0) / total * 100);
    }, [data]);

    const showSkeleton = loading && !data;

    return (
        <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto scrollbar-hide pb-8">

            {/* Header / Filter Bar */}
            <div className="flex items-start justify-between gap-4 flex-wrap shrink-0">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <BarChart3 size={20} className="text-primary" />
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">Analytics</h1>
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                            Live Insights
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {data ? formatRelativeWindow(data.window.start, data.window.end) : "Loading window..."}
                        <span className="mx-2 text-border">|</span>
                        Updated <span className="text-foreground font-semibold">{formatLastUpdated(lastUpdated)}</span>
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <DateRangePicker
                        date={dateRange}
                        onDateChange={onDateRangeChange}
                    />
                    <button
                        onClick={onRefresh}
                        disabled={loading}
                        className="px-4 py-2 bg-card border border-border text-foreground text-sm font-medium rounded-lg hover:bg-muted transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin text-muted-foreground" : "text-muted-foreground"} />
                        Refresh
                    </button>
                    <button
                        onClick={onExport}
                        disabled={exporting || !data}
                        className="px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                    >
                        <FileDown size={16} />
                        {exporting ? "Exporting..." : "Export CSV"}
                    </button>
                </div>
            </div>

            {/* Row 1 - Hero KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 shrink-0 animate-slide-up">
                {showSkeleton ? (
                    <KpiSkeleton count={4} />
                ) : data ? (
                    <>
                        <HeroKpi
                            label={`Reports - last ${data.window.days}d`}
                            value={data.kpis.current.reports.toString()}
                            icon={<Activity size={18} />}
                            accent="blue"
                            delta={data.kpis.delta.reports_pct}
                            higherIsBetter={false}
                            priorLabel={`Prior: ${data.kpis.prior.reports}`}
                            onClick={onDrilldown ? () => onDrilldown("reports") : undefined}
                        />
                        <HeroKpi
                            label="Resolution Rate"
                            value={data.kpis.current.resolution_rate.toFixed(1)}
                            suffix="%"
                            icon={<Target size={18} />}
                            accent="emerald"
                            delta={data.kpis.delta.resolution_rate_pts}
                            deltaSuffix="pts"
                            higherIsBetter
                            priorLabel={`Prior: ${data.kpis.prior.resolution_rate.toFixed(1)}%`}
                            onClick={onDrilldown ? () => onDrilldown("resolution_rate") : undefined}
                            tooltipText="Calculated as Resolved / (All Verified + Actionable Reports)"
                        />
                        <HeroKpi
                            label="Avg Time to Resolve"
                            value={data.kpis.current.avg_resolve_days.toFixed(1)}
                            suffix="d"
                            icon={<Clock size={18} />}
                            accent="yellow"
                            delta={data.kpis.delta.avg_resolve_days_pct}
                            higherIsBetter={false}
                            priorLabel={`Prior: ${data.kpis.prior.avg_resolve_days.toFixed(1)}d`}
                            onClick={onDrilldown ? () => onDrilldown("avg_resolve_days") : undefined}
                        />
                        <HeroKpi
                            label="SLA Compliance"
                            value={data.kpis.current.sla_compliance != null ? data.kpis.current.sla_compliance.toFixed(1) : "–"}
                            suffix={data.kpis.current.sla_compliance != null ? "%" : undefined}
                            icon={<CheckCircle2 size={18} />}
                            accent="violet"
                            delta={data.kpis.delta.sla_compliance_pts}
                            deltaSuffix="pts"
                            higherIsBetter
                            priorLabel={data.kpis.prior.sla_compliance != null ? `Prior: ${data.kpis.prior.sla_compliance.toFixed(1)}%` : "Prior: N/A"}
                            onClick={onDrilldown ? () => onDrilldown("sla_compliance") : undefined}
                            tooltipText="Percentage of reports resolved within their priority SLA deadline"
                        />
                    </>
                ) : null}
            </div>

            {/* Row 2 - Trend chart + Period-over-period card */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 shrink-0 animate-slide-up stagger-2">
                <div className="xl:col-span-2 bg-card p-6 rounded-lg border border-border shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
                        <div className="flex items-center gap-2 text-foreground">
                            <TrendingUp size={18} className="text-muted-foreground" />
                            <h2 className="text-base font-semibold">Report Lifecycle Over Time</h2>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />Submitted</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Resolved</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" />Rejected</span>
                        </div>
                    </div>
                    <div className="relative z-10 h-72">
                        {showSkeleton ? (
                            <div className="h-full bg-foreground/5 rounded-2xl animate-pulse" />
                        ) : trendChartData.length === 0 ? (
                            <EmptyChart label="No activity in this window" />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendChartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="g_submitted" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                                        </linearGradient>
                                        <linearGradient id="g_resolved" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.55} />
                                            <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                                        </linearGradient>
                                        <linearGradient id="g_rejected" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                                            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="_label" stroke="rgba(255,255,255,0.25)" fontSize={10} tickMargin={10} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                    <YAxis stroke="rgba(255,255,255,0.25)" fontSize={10} axisLine={false} tickLine={false} width={32} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "rgba(10, 15, 10, 0.92)",
                                            backdropFilter: "blur(10px)",
                                            border: "1px solid rgba(255,255,255,0.1)",
                                            borderRadius: "12px",
                                            fontSize: "11px",
                                        }}
                                        labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}
                                    />
                                    <Area type="monotone" dataKey="submitted" name="Submitted" stroke="#3b82f6" fill="url(#g_submitted)" strokeWidth={2} />
                                    <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#10b981" fill="url(#g_resolved)" strokeWidth={2.5} />
                                    <Area type="monotone" dataKey="rejected" name="Rejected" stroke="#ef4444" fill="url(#g_rejected)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                <div className="xl:col-span-1 bg-card p-6 rounded-lg border border-border shadow-sm flex flex-col">
                    <div className="flex items-center gap-2 mb-4 text-foreground">
                        <Zap size={18} className="text-muted-foreground" />
                        <h2 className="text-base font-semibold">Period vs Period</h2>
                    </div>
                    <div className="relative z-10 space-y-3">
                        {showSkeleton ? (
                            <KpiSkeleton count={4} small />
                        ) : data ? (
                            <>
                                <PvpRow label="Reports" current={data.kpis.current.reports} prior={data.kpis.prior.reports} delta={data.kpis.delta.reports_pct} suffix="" deltaSuffix="%" higherIsBetter={false} />
                                <PvpRow label="Resolution" current={data.kpis.current.resolution_rate} prior={data.kpis.prior.resolution_rate} delta={data.kpis.delta.resolution_rate_pts} suffix="%" deltaSuffix="pts" higherIsBetter />
                                <PvpRow label="Resolve Time" current={data.kpis.current.avg_resolve_days} prior={data.kpis.prior.avg_resolve_days} delta={data.kpis.delta.avg_resolve_days_pct} suffix="d" deltaSuffix="%" higherIsBetter={false} />
                                <PvpRow label="SLA" current={data.kpis.current.sla_compliance} prior={data.kpis.prior.sla_compliance} delta={data.kpis.delta.sla_compliance_pts} suffix="%" deltaSuffix="pts" higherIsBetter />
                                <div className="text-[10px] text-foreground/40 italic pt-2 border-t border-border">
                                    Comparison: prior {data.window.days}-day window
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>
            </div>
            {/* Row 3 - Lifecycle Funnel + AI Quality */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 shrink-0 animate-slide-up stagger-3">
                <div className="bg-card p-6 rounded-lg border border-border shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2 text-foreground">
                            <Activity size={18} className="text-muted-foreground" />
                            <h2 className="text-base font-semibold">Lifecycle Funnel</h2>
                        </div>
                        {data && totalRejectedShare > 0 && (
                            <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20">
                                {totalRejectedShare}% rejected
                            </span>
                        )}
                    </div>
                    <div className="relative z-10 space-y-3">
                        {showSkeleton ? (
                            <KpiSkeleton count={5} small />
                        ) : data && data.funnel.stages[0].count === 0 ? (
                            <EmptyChart label="No reports in window" small />
                        ) : data ? (
                            <>
                                {data.funnel.stages.map((stage, idx) => {
                                    const total = data.funnel.stages[0].count;
                                    const pct = total > 0 ? (stage.count / total) * 100 : 0;
                                    const widthPct = (stage.count / funnelMax) * 100;
                                    const priorPct = idx > 0 && total > 0 ? (data.funnel.stages[idx - 1].count / total * 100) : 100;
                                    return (
                                        <FunnelRow
                                            key={stage.key}
                                            label={stage.label}
                                            count={stage.count}
                                            percent={pct}
                                            width={widthPct}
                                            tone={FUNNEL_TONE[idx] || FUNNEL_TONE[0]}
                                            sublabel={idx > 0 ? `${(pct - priorPct).toFixed(0)}% from prev` : "Pipeline entry"}
                                            onClick={onDrilldown ? () => onDrilldown("funnel", stage.key) : undefined}
                                        />
                                    );
                                })}
                                <div className="pt-3 border-t border-border grid grid-cols-2 gap-3">
                                    {data.funnel.branches.map((b) => (
                                        <div
                                            key={b.key}
                                            className={`p-3 rounded-xl bg-red-500/5 border border-red-500/20 ${onDrilldown ? "cursor-pointer hover:bg-red-500/10 transition-colors" : ""}`}
                                            onClick={onDrilldown ? () => onDrilldown("branch", b.key) : undefined}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <AlertTriangle size={14} className="text-red-300" />
                                                    <div className="text-[10px] font-bold text-red-300 uppercase tracking-widest">{b.label}</div>
                                                </div>
                                                <div className="text-xl font-bold text-red-300">{b.count}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>

                <div className="bg-card p-6 rounded-lg border border-border shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2 text-foreground">
                            <Brain size={18} className="text-muted-foreground" />
                            <h2 className="text-base font-semibold">AI Verification Quality</h2>
                        </div>
                        {data && (
                            <span className="text-xs text-muted-foreground font-medium">
                                Threshold {Math.round((data.ai_quality.ai_threshold || 0.5) * 100)}%
                            </span>
                        )}
                    </div>
                    <div className="relative z-10 space-y-4">
                        {showSkeleton ? (
                            <div className="h-48 bg-foreground/5 rounded-2xl animate-pulse" />
                        ) : data ? (
                            <>
                                <div className="grid grid-cols-3 gap-2">
                                    <AiStat label="Analyzed" value={data.ai_quality.total_analyzed.toString()} tone="violet" />
                                    <AiStat label="Mean conf." value={data.ai_quality.mean_confidence !== null ? `${Math.round(data.ai_quality.mean_confidence * 100)}%` : "-"} tone="emerald" />
                                    <AiStat label="Rejected" value={data.ai_quality.rejected_count.toString()} tone="red" />
                                </div>
                                <div className="h-40 -mx-2">
                                    {data.ai_quality.total_analyzed === 0 ? (
                                        <EmptyChart label="No AI-scored reports yet" small />
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={aiChartData} margin={{ top: 5, right: 8, left: -16, bottom: 0 }}>
                                                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="bucket" stroke="rgba(255,255,255,0.3)" fontSize={9} tickMargin={6} axisLine={false} tickLine={false} />
                                                <YAxis stroke="rgba(255,255,255,0.25)" fontSize={9} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: "rgba(10, 15, 10, 0.92)",
                                                        backdropFilter: "blur(10px)",
                                                        border: "1px solid rgba(255,255,255,0.1)",
                                                        borderRadius: "10px",
                                                        fontSize: "11px",
                                                    }}
                                                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                                                />
                                                <ReferenceLine x="0.5-0.6" stroke="rgba(245, 158, 11, 0.5)" strokeDasharray="4 4" label={{ value: "AI threshold", position: "top", fill: "#f59e0b", fontSize: 9 }} />
                                                <Bar
                                                    dataKey="count"
                                                    radius={[6, 6, 0, 0]}
                                                    cursor={onDrilldown ? "pointer" : undefined}
                                                    onClick={onDrilldown ? ((data: unknown) => { const bucket = (data as { bucket?: string })?.bucket; if (bucket) onDrilldown("ai_bucket", bucket); }) : undefined}
                                                >
                                                    {aiChartData.map((entry, idx) => (
                                                        <Cell key={idx} fill={entry.isAboveThreshold ? "#10b981" : "#ef4444"} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                                <div className="text-[10px] text-foreground/40 leading-relaxed">
                                    Mask R-CNN scores below threshold are auto-rejected. Verification rate: <span className="text-emerald-300 font-bold">{data.ai_quality.verification_rate}%</span>
                                    {data.ai_quality.mean_verified_confidence !== null && (
                                        <> | Mean confidence of accepted reports: <span className="text-violet-300 font-bold">{Math.round(data.ai_quality.mean_verified_confidence * 100)}%</span></>
                                    )}
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Row 4 - Barangay Leaderboard + Response Time by Priority */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 shrink-0 animate-slide-up stagger-4">
                <div className="xl:col-span-2 bg-card p-6 rounded-lg border border-border shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
                        <div className="flex items-center gap-2 text-foreground">
                            <Award size={18} className="text-muted-foreground" />
                            <h2 className="text-base font-semibold">Barangay Leaderboard</h2>
                            <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground">Top 10 by volume</span>
                        </div>
                    </div>
                    <div className="relative z-10 overflow-x-auto">
                        {showSkeleton ? (
                            <KpiSkeleton count={5} small />
                        ) : data && data.barangay_leaderboard.length === 0 ? (
                            <EmptyChart label="No barangay activity in this window" small />
                        ) : data ? (
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-border text-xs text-muted-foreground font-medium">
                                        <th className="py-3 pr-3">#</th>
                                        <th className="py-3 pr-3">Barangay</th>
                                        <th className="py-3 pr-3 text-right">Reports</th>
                                        <th className="py-3 pr-3 text-right">Resolved</th>
                                        <th className="py-3 pr-3 text-right">Resolution</th>
                                        <th className="py-3 pr-3 text-right">Avg Days</th>
                                        <th className="py-3 text-right">vs Prior</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.barangay_leaderboard.slice(0, 10).map((row, idx) => (
                                        <tr
                                            key={row.barangay}
                                            className={`border-b border-border hover:bg-muted/50 transition-colors ${onDrilldown ? "cursor-pointer" : ""}`}
                                            onClick={onDrilldown ? () => onDrilldown("leaderboard", row.barangay) : undefined}
                                        >
                                            <td className="py-3 pr-3">
                                                <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-semibold ${idx < 3 ? "bg-primary/10 text-primary border border-primary/20" : "bg-muted text-muted-foreground"}`}>
                                                    {idx + 1}
                                                </div>
                                            </td>
                                            <td className="py-3 pr-3 font-semibold text-foreground">{row.barangay}</td>
                                            <td className="py-3 pr-3 text-right font-bold text-foreground">{row.total}</td>
                                            <td className="py-3 pr-3 text-right text-foreground/70">{row.resolved}</td>
                                            <td className="py-3 pr-3 text-right">
                                                <span className={`font-semibold ${row.resolution_rate >= 50 ? "text-emerald-600 dark:text-emerald-400" : row.resolution_rate >= 25 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`}>
                                                    {row.resolution_rate.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="py-3 pr-3 text-right text-muted-foreground">{row.avg_resolve_days > 0 ? `${row.avg_resolve_days}d` : "-"}</td>
                                            <td className="py-3 text-right">
                                                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <TrendArrow trend={row.trend} />
                                                    <span className="font-semibold">{row.prior_total}</span>
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : null}
                    </div>
                </div>

                <div className="xl:col-span-1 bg-card p-6 rounded-lg border border-border shadow-sm flex flex-col">
                    <div className="flex items-center gap-2 mb-5 text-foreground">
                        <Zap size={18} className="text-muted-foreground" />
                        <h2 className="text-base font-semibold">Response Time by Priority</h2>
                    </div>
                    <div className="relative z-10 space-y-3">
                        {showSkeleton ? (
                            <KpiSkeleton count={3} small />
                        ) : data ? (
                            data.response_time_by_priority.map((row) => {
                                const tone = PRIORITY_TONE[row.priority];
                                const c2d = row.avg_created_to_deployed_hours;
                                const d2c = row.avg_deployed_to_completed_hours;
                                return (
                                    <div
                                        key={row.priority}
                                        className={`p-4 rounded-lg border bg-muted/50 border-border ${onDrilldown ? "cursor-pointer hover:bg-muted transition-colors" : ""}`}
                                        onClick={onDrilldown ? () => onDrilldown("response_priority", row.priority) : undefined}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2.5 h-2.5 rounded-full ${tone.dot}`} />
                                                <span className={`text-xs font-semibold capitalize ${tone.text}`}>{row.priority} Priority</span>
                                            </div>
                                            <span className="text-xs text-muted-foreground font-medium">{row.total_wos} WOs</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Create &rarr; Start</div>
                                                <div className={`text-lg font-bold text-foreground`}>{c2d !== null ? `${c2d}h` : "-"}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Start &rarr; Done</div>
                                                <div className={`text-lg font-bold text-foreground`}>{d2c !== null ? `${d2c}h` : "-"}</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : null}
                        <div className="text-[10px] text-foreground/40 italic pt-1">
                            Higher priority should resolve faster - watch for inversions.
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer hint */}
            <div className="flex items-center justify-center gap-2 text-[10px] text-foreground/30 uppercase tracking-widest font-bold pb-4">
                <ChevronRight size={12} />
                Live analytics powered by EcoWatch + Mask R-CNN
                <ChevronRight size={12} className="rotate-180" />
            </div>
        </div>
    );
}

function PvpRow({
    label, current, prior, delta, suffix, deltaSuffix, higherIsBetter,
}: {
    label: string; current: number | null; prior: number | null; delta: number | null; suffix: string; deltaSuffix: string; higherIsBetter: boolean;
}) {
    const fmt = (v: number | null) => v != null ? `${v.toFixed(label === "Reports" ? 0 : 1)}${suffix}` : "N/A";
    return (
        <div className="flex items-center justify-between gap-3 p-4 rounded-lg bg-muted/50 border border-border">
            <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">{label}</div>
                <div className="text-lg font-bold text-foreground">{fmt(current)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">vs {fmt(prior)}</div>
            </div>
            <DeltaArrow value={delta} higherIsBetter={higherIsBetter} suffix={deltaSuffix} />
        </div>
    );
}

function AiStat({ label, value, tone }: { label: string; value: string; tone: "emerald" | "violet" | "red" }) {
    const text = tone === "emerald" ? "text-emerald-600 dark:text-emerald-400" : tone === "violet" ? "text-violet-600 dark:text-violet-400" : "text-red-600 dark:text-red-400";
    const bg = "bg-muted/50 border-border";
    return (
        <div className={`p-4 rounded-lg border ${bg} text-center`}>
            <div className="text-xs font-medium text-muted-foreground mb-2">{label}</div>
            <div className={`text-xl font-bold ${text}`}>{value}</div>
        </div>
    );
}

function KpiSkeleton({ count = 4, small }: { count?: number; small?: boolean }) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className={`bg-card rounded-lg border border-border p-5 flex flex-col gap-3 animate-pulse ${small ? "h-20" : "h-32"}`}>
                    <div className="flex items-center justify-between">
                        <div className="h-4 w-24 bg-muted rounded" />
                        <div className="h-9 w-9 bg-muted rounded-md" />
                    </div>
                    <div className="h-8 w-16 bg-muted rounded mt-auto" />
                </div>
            ))}
        </>
    );
}

function EmptyChart({ label, small }: { label: string; small?: boolean }) {
    return (
        <div className={`flex items-center justify-center text-center ${small ? "py-6" : "py-12"}`}>
            <p className="text-xs text-foreground/40 italic">{label}</p>
        </div>
    );
}