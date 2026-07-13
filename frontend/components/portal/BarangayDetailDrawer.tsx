"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
    X, Building2, Mail, Phone, Clock, AlertTriangle,
    Shield, Users, FileText, MapPin, Map, RefreshCw, Inbox
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { BarangayOverviewRow } from "./BarangayManagementTab";
import { formatRelative, formatDate } from "@/lib/date-utils";

const BarangayBoundaryMap = dynamic(
    () => import("./BarangayBoundaryMap"),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-full bg-muted/20 border border-border border-dashed rounded-xl flex flex-col items-center justify-center animate-pulse gap-3">
                <MapPin className="text-muted-foreground/30" size={32} />
                <div className="h-2 w-24 bg-muted-foreground/20 rounded-full" />
            </div>
        ),
    }
);

// ─── Types ────────────────────────────────────────────────────────────────────

type DrawerTab = "overview" | "reports" | "work_orders" | "team" | "boundary";

interface Props {
    open: boolean;
    barangay: BarangayOverviewRow | null;
    onClose: () => void;
    onAssignAdmin: (barangayName: string) => void;
    onReassignAdmin: (adminUserId: number) => void;
    onDisableAdmin: (adminUserId: number) => void;
    onViewOnMap: (barangayName: string) => void;
}

// ─── Pill lookup maps ─────────────────────────────────────────────────────────

const REPORT_PILL: Record<string, string> = {
    pending: "bg-destructive/10 border-destructive/20 text-destructive",
    verified: "bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400",
    assigned: "bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400",
    in_progress: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
    resolved: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    rejected: "bg-muted text-muted-foreground border-border",
    failed_cleanup: "bg-destructive/10 border-destructive/20 text-destructive",
};

const WO_STATUS_PILL: Record<string, string> = {
    assigned: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
    in_progress: "bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400",
    completed: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    verified: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    needs_redo: "bg-destructive/10 border-destructive/20 text-destructive",
};

const WO_PRIORITY_PILL: Record<string, string> = {
    low: "bg-muted text-muted-foreground border-border",
    medium: "bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400",
    high: "bg-destructive/10 border-destructive/20 text-destructive",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function TabError({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="flex flex-col items-center gap-4 py-12 text-center bg-card rounded-xl border border-border shadow-sm border-dashed">
            <AlertTriangle size={32} className="text-destructive/50" />
            <p className="text-sm font-medium text-muted-foreground">{message}</p>
            <button
                onClick={onRetry}
                className="px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
                <RefreshCw size={14} /> Retry
            </button>
        </div>
    );
}

function TabLoading() {
    return (
        <div className="space-y-4 pt-1">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 bg-card rounded-xl border border-border shadow-sm flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-muted animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2 py-1">
                        <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
                        <div className="h-2 w-2/3 bg-muted/50 rounded animate-pulse" />
                        <div className="h-2 w-1/2 bg-muted/50 rounded animate-pulse" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function TabEmpty({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center gap-3 py-16 text-center bg-card rounded-xl border border-border shadow-sm border-dashed">
            <Inbox size={40} className="text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">{message}</p>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BarangayDetailDrawer({
    open,
    barangay,
    onClose,
    onAssignAdmin,
    onReassignAdmin,
    onDisableAdmin,
    onViewOnMap,
}: Props) {
    const [activeTab, setActiveTab] = useState<DrawerTab>("overview");

    const [reports, setReports] = useState<any[]>([]);
    const [reportsLoading, setReportsLoading] = useState(false);
    const [reportsError, setReportsError] = useState<string | null>(null);
    const [reportsFetched, setReportsFetched] = useState(false);

    const [workOrders, setWorkOrders] = useState<any[]>([]);
    const [woLoading, setWoLoading] = useState(false);
    const [woError, setWoError] = useState<string | null>(null);
    const [woFetched, setWoFetched] = useState(false);

    const [cleaners, setCleaners] = useState<any[]>([]);
    const [teamLoading, setTeamLoading] = useState(false);
    const [teamError, setTeamError] = useState<string | null>(null);
    const [teamFetched, setTeamFetched] = useState(false);

    const [geoFeature, setGeoFeature] = useState<any>(null);
    const [boundaryLoading, setBoundaryLoading] = useState(false);
    const [boundaryError, setBoundaryError] = useState<string | null>(null);
    const [boundaryFetched, setBoundaryFetched] = useState(false);

    // Reset lazy data on barangay change
    useEffect(() => {
        setActiveTab("overview");
        setReports([]); setReportsFetched(false); setReportsError(null);
        setWorkOrders([]); setWoFetched(false); setWoError(null);
        setCleaners([]); setTeamFetched(false); setTeamError(null);
        setGeoFeature(null); setBoundaryFetched(false); setBoundaryError(null);
    }, [barangay?.barangay]);

    const fetchReports = async () => {
        if (!barangay) return;
        setReportsLoading(true);
        setReportsError(null);
        try {
            const data = await api(`/reports/barangay/${encodeURIComponent(barangay.barangay)}?limit=10`);
            setReports(data);
            setReportsFetched(true);
        } catch (err) {
            setReportsError(err instanceof ApiError ? err.message : "Failed to load reports. Please retry.");
        } finally {
            setReportsLoading(false);
        }
    };

    const fetchWorkOrders = async () => {
        if (!barangay) return;
        setWoLoading(true);
        setWoError(null);
        try {
            const data = await api(`/work-orders?barangay=${encodeURIComponent(barangay.barangay)}`);
            setWorkOrders(data);
            setWoFetched(true);
        } catch (err) {
            setWoError(err instanceof ApiError ? err.message : "Failed to load work orders. Please retry.");
        } finally {
            setWoLoading(false);
        }
    };

    const fetchTeam = async () => {
        if (!barangay) return;
        setTeamLoading(true);
        setTeamError(null);
        try {
            const data = await api(`/users?role=cleaner`);
            const filtered = (data as any[]).filter(u => u.barangay_assignment === barangay.barangay);
            setCleaners(filtered);
            setTeamFetched(true);
        } catch (err) {
            setTeamError(err instanceof ApiError ? err.message : "Failed to load team. Please retry.");
        } finally {
            setTeamLoading(false);
        }
    };

    const fetchBoundary = async () => {
        if (!barangay) return;
        setBoundaryLoading(true);
        setBoundaryError(null);
        try {
            const geoData = await api("/spatial/barangays");
            const feature = geoData?.features?.find(
                (f: any) => f.properties?.ADM4_EN === barangay.barangay
            ) ?? null;
            if (!feature) {
                setBoundaryError("Boundary data not available for this barangay.");
            } else {
                setGeoFeature(feature);
            }
            setBoundaryFetched(true);
        } catch {
            setBoundaryError("Boundary data unavailable.");
        } finally {
            setBoundaryLoading(false);
        }
    };

    // Lazy-load on tab switch
    useEffect(() => {
        if (!open || !barangay) return;
        if (activeTab === "reports" && !reportsFetched && !reportsLoading) fetchReports();
        if (activeTab === "work_orders" && !woFetched && !woLoading) fetchWorkOrders();
        if (activeTab === "team" && !teamFetched && !teamLoading) fetchTeam();
        if (activeTab === "boundary" && !boundaryFetched && !boundaryLoading) fetchBoundary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, open, barangay?.barangay]);

    if (!barangay) return null;

    const statusLabel = {
        healthy: "Healthy", at_risk: "At Risk", breached: "Breached", unassigned: "No Admin",
    }[barangay.status];

    const statusPillClass = {
        healthy: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
        at_risk: "bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400",
        breached: "bg-destructive/10 border-destructive/20 text-destructive",
        unassigned: "bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400",
    }[barangay.status];

    const TABS: { key: DrawerTab; label: string; icon: React.ReactNode }[] = [
        { key: "overview",    label: "Overview",    icon: <Building2 size={14} /> },
        { key: "reports",     label: "Reports",     icon: <FileText size={14} /> },
        { key: "work_orders", label: "Work Orders", icon: <Shield size={14} /> },
        { key: "team",        label: "Team",        icon: <Users size={14} /> },
        { key: "boundary",    label: "Boundary",    icon: <MapPin size={14} /> },
    ];

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-[2000] bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
                    open ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
                onClick={onClose}
            />

            {/* Drawer panel */}
            <div
                className={`fixed inset-y-0 right-0 z-[2001] w-full max-w-[480px] flex flex-col bg-background border-l border-border shadow-2xl transition-transform duration-300 ease-out ${
                    open ? "translate-x-0" : "translate-x-full"
                }`}
            >
                {/* Header */}
                <div className="flex items-start justify-between p-6 pb-4 border-b border-border bg-card shrink-0">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 flex-wrap mb-1">
                            <h2 className="text-xl font-bold text-foreground leading-tight">{barangay.barangay}</h2>
                            <span className={`px-2 py-0.5 rounded-md border text-xs font-semibold ${statusPillClass}`}>
                                {statusLabel}
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground">San Jose del Monte, Bulacan</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-3"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Sub-tab bar */}
                <div className="flex gap-1 px-4 pt-4 border-b border-border shrink-0 overflow-x-auto scrollbar-hide bg-card">
                    {TABS.map(t => (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key)}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-t-lg border-b-2 -mb-[1px] ${
                                activeTab === t.key
                                    ? "text-primary border-primary bg-primary/5"
                                    : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50"
                            }`}
                        >
                            {t.icon}
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto p-5 scrollbar-hide bg-muted/20">
                    {activeTab === "overview" && (
                        <OverviewTab barangay={barangay} />
                    )}
                    {activeTab === "reports" && (
                        <ReportsTab
                            reports={reports}
                            loading={reportsLoading}
                            error={reportsError}
                            onRetry={fetchReports}
                        />
                    )}
                    {activeTab === "work_orders" && (
                        <WorkOrdersTab
                            workOrders={workOrders}
                            loading={woLoading}
                            error={woError}
                            onRetry={fetchWorkOrders}
                        />
                    )}
                    {activeTab === "team" && (
                        <TeamTab
                            barangay={barangay}
                            cleaners={cleaners}
                            loading={teamLoading}
                            error={teamError}
                            onRetry={fetchTeam}
                            onAssignAdmin={onAssignAdmin}
                            onReassignAdmin={onReassignAdmin}
                            onDisableAdmin={onDisableAdmin}
                        />
                    )}
                    {activeTab === "boundary" && (
                        <BoundaryTab
                            barangay={barangay}
                            feature={geoFeature}
                            loading={boundaryLoading}
                            error={boundaryError}
                            onRetry={fetchBoundary}
                        />
                    )}
                </div>

                {/* Footer actions */}
                <div className="p-4 border-t border-border shrink-0 flex gap-3 bg-card">
                    {!barangay.admin ? (
                        <button
                            onClick={() => onAssignAdmin(barangay.barangay)}
                            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
                        >
                            Assign Admin
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => onReassignAdmin(barangay.admin!.id)}
                                className="flex-1 py-2.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border text-sm font-medium rounded-xl transition-colors"
                            >
                                Reassign Admin
                            </button>
                            <button
                                onClick={() => onDisableAdmin(barangay.admin!.id)}
                                className="flex-1 py-2.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm font-medium rounded-xl transition-colors shadow-sm"
                            >
                                Disable Admin
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => onViewOnMap(barangay.barangay)}
                        title="View on City Map"
                        className="px-4 py-2.5 bg-secondary hover:bg-secondary/80 border border-border text-secondary-foreground rounded-xl transition-colors shadow-sm"
                    >
                        <Map size={18} />
                    </button>
                </div>
            </div>
        </>
    );
}

// ─── Sub-tab: Overview ────────────────────────────────────────────────────────

function OverviewTab({ barangay }: { barangay: BarangayOverviewRow }) {
    const trend = barangay.trend_7d_resolution_rate_delta;
    const trendColor = trend > 0.5 ? "text-emerald-600 dark:text-emerald-400" : trend < -0.5 ? "text-destructive" : "text-muted-foreground";
    const trendArrow = trend > 0.5 ? "↑" : trend < -0.5 ? "↓" : "→";

    return (
        <div className="flex flex-col gap-6">
            {/* Admin card */}
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <div className="text-sm font-medium text-muted-foreground mb-4">Assigned Admin</div>
                {barangay.admin ? (
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-muted border border-border flex items-center justify-center text-lg font-bold text-foreground shrink-0">
                            {barangay.admin.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="font-semibold text-foreground text-base mb-1">{barangay.admin.full_name}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1.5 mb-0.5">
                                <Mail size={14} /> {barangay.admin.email}
                            </div>
                            {barangay.admin.phone_number && (
                                <div className="text-sm text-muted-foreground flex items-center gap-1.5 mb-0.5">
                                    <Phone size={14} /> {barangay.admin.phone_number}
                                </div>
                            )}
                            {barangay.admin.last_login_at && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                                    <Clock size={12} /> Last login: {formatRelative(barangay.admin.last_login_at)}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg text-orange-600 dark:text-orange-400">
                        <Building2 size={20} className="opacity-80" />
                        <span className="text-sm font-semibold">No Admin Assigned</span>
                    </div>
                )}
            </div>

            {/* Report stats */}
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <div className="text-sm font-medium text-muted-foreground mb-4">Report Statistics</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                        { label: "Total",    value: barangay.total_reports,    color: "text-foreground" },
                        { label: "Pending",  value: barangay.pending,          color: "text-yellow-600 dark:text-yellow-400" },
                        { label: "Active",   value: barangay.active,           color: "text-blue-600 dark:text-blue-400" },
                        { label: "Resolved", value: barangay.resolved,         color: "text-emerald-600 dark:text-emerald-400" },
                        { label: "Rejected", value: barangay.rejected,         color: "text-muted-foreground" },
                        { label: "Failed",   value: barangay.failed_cleanup,   color: "text-destructive" },
                    ].map(k => (
                        <div key={k.label} className="bg-muted/30 rounded-lg border border-border p-3 text-center">
                            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
                            <div className="text-xs font-medium text-muted-foreground mt-1">{k.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* SLA stats */}
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <div className="text-sm font-medium text-muted-foreground mb-4">SLA Performance</div>
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <div className={`text-3xl font-bold ${barangay.compliance_rate >= 80 ? "text-emerald-600 dark:text-emerald-400" : barangay.compliance_rate >= 60 ? "text-yellow-600 dark:text-yellow-400" : "text-destructive"}`}>
                            {barangay.compliance_rate.toFixed(0)}%
                        </div>
                        <div className="text-xs font-medium text-muted-foreground mt-1">Compliance</div>
                    </div>
                    <div>
                        <div className={`text-3xl font-bold ${barangay.active_breaches > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                            {barangay.active_breaches}
                        </div>
                        <div className="text-xs font-medium text-muted-foreground mt-1">Active Breaches</div>
                    </div>
                    <div>
                        <div className="text-3xl font-bold text-foreground">{barangay.avg_resolution_days.toFixed(1)}d</div>
                        <div className="text-xs font-medium text-muted-foreground mt-1">Avg Resolution</div>
                    </div>
                </div>
            </div>

            {/* Trend + last report + rate */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                    <div className="text-xs font-medium text-muted-foreground mb-2">7-Day Trend</div>
                    <div className={`text-lg font-bold ${trendColor}`}>
                        {trendArrow} {Math.abs(trend).toFixed(1)}%
                    </div>
                </div>
                <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                    <div className="text-xs font-medium text-muted-foreground mb-2">Last Report</div>
                    <div className="text-sm font-semibold text-foreground">
                        {barangay.last_report_at ? formatRelative(barangay.last_report_at) : "No reports yet"}
                    </div>
                </div>
                <div className="bg-card rounded-xl border border-border p-4 shadow-sm col-span-2 md:col-span-1">
                    <div className="text-xs font-medium text-muted-foreground mb-2">Resolution Rate</div>
                    <div className={`text-lg font-bold ${barangay.resolution_rate >= 75 ? "text-emerald-600 dark:text-emerald-400" : barangay.resolution_rate >= 50 ? "text-yellow-600 dark:text-yellow-400" : "text-destructive"}`}>
                        {barangay.resolution_rate.toFixed(0)}%
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Sub-tab: Reports ─────────────────────────────────────────────────────────

function ReportsTab({
    reports,
    loading,
    error,
    onRetry,
}: {
    reports: any[];
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}) {
    if (loading) return <TabLoading />;
    if (error) return <TabError message={error} onRetry={onRetry} />;
    if (reports.length === 0) return <TabEmpty message="No reports for this barangay yet." />;

    return (
        <div className="flex flex-col gap-3">
            {reports.map((r: any) => (
                <div key={r.id} className="bg-card rounded-xl border border-border p-4 shadow-sm flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 flex-wrap mb-1.5">
                            <span className="text-sm font-bold text-foreground">{r.tracking_id || `#${r.id}`}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${REPORT_PILL[r.status] ?? REPORT_PILL.pending}`}>
                                {String(r.status).replace("_", " ")}
                            </span>
                        </div>
                        {r.notes && (
                            <div className="text-sm text-muted-foreground truncate">{r.notes}</div>
                        )}
                    </div>
                    <div className="text-xs font-medium text-muted-foreground shrink-0 mt-0.5">
                        {r.created_at ? formatRelative(r.created_at) : ""}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Sub-tab: Work Orders ─────────────────────────────────────────────────────

function WorkOrdersTab({
    workOrders,
    loading,
    error,
    onRetry,
}: {
    workOrders: any[];
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}) {
    if (loading) return <TabLoading />;
    if (error) return <TabError message={error} onRetry={onRetry} />;
    if (workOrders.length === 0) return <TabEmpty message="No work orders for this barangay." />;

    return (
        <div className="flex flex-col gap-3">
            {workOrders.slice(0, 20).map((wo: any) => (
                <div key={wo.id} className="bg-card rounded-xl border border-border p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${WO_PRIORITY_PILL[wo.priority] ?? WO_PRIORITY_PILL.medium}`}>
                                {wo.priority} Priority
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${WO_STATUS_PILL[wo.status] ?? WO_STATUS_PILL.assigned}`}>
                                {String(wo.status).replace("_", " ")}
                            </span>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground shrink-0 mt-0.5">
                            {wo.created_at ? formatRelative(wo.created_at) : ""}
                        </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        {wo.assigned_cleaner && (
                            <div className="text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">Cleaner:</span> {wo.assigned_cleaner.full_name ?? `#${wo.assigned_cleaner_id}`}
                            </div>
                        )}
                        {wo.sla_deadline && (
                            <div className="text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">SLA Deadline:</span> {formatDate(wo.sla_deadline)}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Sub-tab: Team ────────────────────────────────────────────────────────────

function TeamTab({
    barangay,
    cleaners,
    loading,
    error,
    onRetry,
    onAssignAdmin,
    onReassignAdmin,
    onDisableAdmin,
}: {
    barangay: BarangayOverviewRow;
    cleaners: any[];
    loading: boolean;
    error: string | null;
    onRetry: () => void;
    onAssignAdmin: (name: string) => void;
    onReassignAdmin: (id: number) => void;
    onDisableAdmin: (id: number) => void;
}) {
    return (
        <div className="flex flex-col gap-6">
            {/* Admin section */}
            <div>
                <div className="text-sm font-medium text-muted-foreground mb-3">Administrator</div>
                {barangay.admin ? (
                    <div className="bg-card rounded-xl border border-border p-4 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-muted border border-border flex items-center justify-center text-lg font-bold text-foreground shrink-0">
                            {barangay.admin.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-base font-semibold text-foreground truncate mb-0.5">{barangay.admin.full_name}</div>
                            <div className="text-sm text-muted-foreground truncate">{barangay.admin.email}</div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                            <button
                                onClick={() => onReassignAdmin(barangay.admin!.id)}
                                className="px-3 py-1.5 bg-secondary border border-border hover:bg-secondary/80 rounded-lg text-xs font-medium text-secondary-foreground transition-colors"
                            >
                                Reassign
                            </button>
                            <button
                                onClick={() => onDisableAdmin(barangay.admin!.id)}
                                className="px-3 py-1.5 bg-destructive/10 border border-destructive/20 hover:bg-destructive/20 rounded-lg text-xs font-medium text-destructive transition-colors"
                            >
                                Disable
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-card rounded-xl border border-orange-500/20 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <AlertTriangle size={24} className="text-orange-500" />
                            <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">No Admin Assigned</span>
                        </div>
                        <button
                            onClick={() => onAssignAdmin(barangay.barangay)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm whitespace-nowrap"
                        >
                            Assign Admin
                        </button>
                    </div>
                )}
            </div>

            {/* Cleaners section */}
            <div>
                <div className="text-sm font-medium text-muted-foreground mb-3 flex items-center justify-between">
                    <span>Cleaners {!loading && `(${cleaners.length})`}</span>
                </div>
                {loading ? (
                    <TabLoading />
                ) : error ? (
                    <TabError message={error} onRetry={onRetry} />
                ) : cleaners.length === 0 ? (
                    <TabEmpty message="No cleaners assigned to this barangay." />
                ) : (
                    <div className="flex flex-col gap-3">
                        {cleaners.map((c: any) => (
                            <div key={c.id} className="bg-card rounded-xl border border-border p-4 shadow-sm flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-sm font-bold text-foreground shrink-0">
                                    {c.full_name?.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-semibold text-foreground truncate mb-0.5">{c.full_name}</div>
                                    <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                                </div>
                                {!c.is_active && (
                                    <span className="text-[10px] font-bold text-destructive border border-destructive/20 px-2 py-1 rounded-md bg-destructive/10 uppercase tracking-widest shrink-0">
                                        Disabled
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Sub-tab: Boundary ────────────────────────────────────────────────────────

function BoundaryTab({
    barangay,
    feature,
    loading,
    error,
    onRetry,
}: {
    barangay: BarangayOverviewRow;
    feature: any;
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}) {
    if (loading) {
        return (
            <div className="w-full h-72 bg-muted/20 border border-border border-dashed rounded-xl flex flex-col items-center justify-center animate-pulse gap-3 shadow-sm">
                <MapPin className="text-muted-foreground/30" size={32} />
                <div className="h-2 w-24 bg-muted-foreground/20 rounded-full" />
            </div>
        );
    }
    if (error) return <TabError message={error} onRetry={onRetry} />;
    if (!feature) return <TabEmpty message="Boundary data unavailable." />;

    return (
        <div className="flex flex-col gap-4">
            <div className="w-full h-72 rounded-xl overflow-hidden border border-border shadow-sm">
                <BarangayBoundaryMap feature={feature} />
            </div>
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <MapPin size={16} /> Location Information
                </div>
                <div className="text-lg font-bold text-foreground mb-1">{barangay.barangay}</div>
                <div className="text-sm text-muted-foreground">San Jose del Monte, Bulacan</div>
            </div>
        </div>
    );
}
