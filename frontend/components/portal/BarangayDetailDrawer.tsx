"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
    X, Building2, Mail, Phone, Clock, AlertTriangle,
    Shield, Users, FileText, MapPin, Map, RefreshCw,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { BarangayOverviewRow } from "./BarangayManagementTab";

const BarangayBoundaryMap = dynamic(
    () => import("./BarangayBoundaryMap"),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-full animate-pulse bg-foreground/5 rounded-xl flex items-center justify-center">
                <span className="text-xs text-foreground/40">Loading map…</span>
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
    pending: "bg-red-500/15 border-red-500/30 text-red-300",
    verified: "bg-orange-500/15 border-orange-500/30 text-orange-300",
    assigned: "bg-yellow-500/15 border-yellow-500/30 text-yellow-300",
    in_progress: "bg-blue-500/15 border-blue-500/30 text-blue-300",
    resolved: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
    rejected: "bg-foreground/10 border-border text-foreground/40",
    failed_cleanup: "bg-red-900/30 border-red-900/40 text-red-400",
};

const WO_STATUS_PILL: Record<string, string> = {
    assigned: "bg-blue-500/15 border-blue-500/30 text-blue-300",
    in_progress: "bg-yellow-500/15 border-yellow-500/30 text-yellow-300",
    completed: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
    verified: "bg-emerald-500/20 border-emerald-500/40 text-emerald-200",
    needs_redo: "bg-red-500/15 border-red-500/30 text-red-300",
};

const WO_PRIORITY_PILL: Record<string, string> = {
    low: "bg-foreground/10 border-border text-foreground/50",
    medium: "bg-yellow-500/15 border-yellow-500/30 text-yellow-300",
    high: "bg-red-500/15 border-red-500/30 text-red-300",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function TabError({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertTriangle size={28} className="text-red-400" />
            <p className="text-sm text-foreground/60">{message}</p>
            <button
                onClick={onRetry}
                className="px-4 py-2 glass border border-border rounded-lg text-xs font-bold uppercase tracking-widest text-foreground/60 hover:text-foreground transition-colors flex items-center gap-2"
            >
                <RefreshCw size={12} /> Retry
            </button>
        </div>
    );
}

function TabLoading() {
    return (
        <div className="space-y-2 pt-1">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 glass rounded-xl animate-pulse" />
            ))}
        </div>
    );
}

function TabEmpty({ message }: { message: string }) {
    return (
        <div className="py-12 text-center text-foreground/40">
            <p className="text-sm">{message}</p>
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
        healthy: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
        at_risk: "bg-yellow-500/10 border-yellow-500/30 text-yellow-300",
        breached: "bg-red-500/10 border-red-500/30 text-red-300",
        unassigned: "bg-orange-500/10 border-orange-500/30 text-orange-300",
    }[barangay.status];

    const TABS: { key: DrawerTab; label: string; icon: React.ReactNode }[] = [
        { key: "overview",    label: "Overview",    icon: <Building2 size={12} /> },
        { key: "reports",     label: "Reports",     icon: <FileText size={12} /> },
        { key: "work_orders", label: "Work Orders", icon: <Shield size={12} /> },
        { key: "team",        label: "Team",        icon: <Users size={12} /> },
        { key: "boundary",    label: "Boundary",    icon: <MapPin size={12} /> },
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
                className={`fixed inset-y-0 right-0 z-[2001] w-full max-w-[480px] flex flex-col glass border-l border-border shadow-2xl transition-transform duration-300 ease-out ${
                    open ? "translate-x-0" : "translate-x-full"
                }`}
            >
                {/* Header */}
                <div className="flex items-start justify-between p-6 pb-4 border-b border-border shrink-0">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-lg font-bold text-foreground leading-tight">{barangay.barangay}</h2>
                            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-widest ${statusPillClass}`}>
                                {statusLabel}
                            </span>
                        </div>
                        <p className="text-[11px] text-foreground/40 mt-0.5">San Jose del Monte, Bulacan</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-foreground/10 text-foreground/40 hover:text-foreground transition-colors shrink-0 ml-3"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Sub-tab bar */}
                <div className="flex gap-0.5 px-4 pt-3 border-b border-border shrink-0 overflow-x-auto scrollbar-hide">
                    {TABS.map(t => (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key)}
                            className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors rounded-t-lg border ${
                                activeTab === t.key
                                    ? "bg-primary/15 border-primary/30 border-b-transparent text-primary"
                                    : "text-foreground/40 hover:text-foreground hover:bg-foreground/5 border-transparent"
                            }`}
                        >
                            {t.icon}
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto p-5 scrollbar-hide">
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
                <div className="p-4 border-t border-border shrink-0 flex gap-2">
                    {!barangay.admin ? (
                        <button
                            onClick={() => onAssignAdmin(barangay.barangay)}
                            className="flex-1 py-2.5 bg-emerald-500 text-emerald-950 text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-emerald-400 transition-colors shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                        >
                            Assign Admin
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => onReassignAdmin(barangay.admin!.id)}
                                className="flex-1 py-2.5 glass border border-border text-foreground/70 text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-foreground/10 transition-colors"
                            >
                                Reassign Admin
                            </button>
                            <button
                                onClick={() => onDisableAdmin(barangay.admin!.id)}
                                className="flex-1 py-2.5 glass border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-red-500/10 transition-colors"
                            >
                                Disable Admin
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => onViewOnMap(barangay.barangay)}
                        title="View on City Map"
                        className="px-3 py-2.5 glass border border-border text-foreground/50 hover:text-foreground rounded-xl hover:bg-foreground/10 transition-colors"
                    >
                        <Map size={15} />
                    </button>
                </div>
            </div>
        </>
    );
}

// ─── Sub-tab: Overview ────────────────────────────────────────────────────────

function OverviewTab({ barangay }: { barangay: BarangayOverviewRow }) {
    const trend = barangay.trend_7d_resolution_rate_delta;
    const trendColor = trend > 0.5 ? "text-emerald-400" : trend < -0.5 ? "text-red-400" : "text-foreground/50";
    const trendArrow = trend > 0.5 ? "↑" : trend < -0.5 ? "↓" : "→";

    return (
        <div className="flex flex-col gap-4">
            {/* Admin card */}
            <div className="glass-pro rounded-2xl border border-border p-4">
                <div className="text-[10px] text-foreground/40 uppercase tracking-widest font-bold mb-3">Assigned Admin</div>
                {barangay.admin ? (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-foreground/10 border border-border flex items-center justify-center text-sm font-bold text-foreground/60 shrink-0">
                            {barangay.admin.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="font-semibold text-foreground text-sm">{barangay.admin.full_name}</div>
                            <div className="text-[11px] text-foreground/50 flex items-center gap-1 mt-0.5">
                                <Mail size={10} /> {barangay.admin.email}
                            </div>
                            {barangay.admin.phone_number && (
                                <div className="text-[11px] text-foreground/50 flex items-center gap-1 mt-0.5">
                                    <Phone size={10} /> {barangay.admin.phone_number}
                                </div>
                            )}
                            {barangay.admin.last_login_at && (
                                <div className="text-[11px] text-foreground/40 flex items-center gap-1 mt-0.5">
                                    <Clock size={10} /> Last login: {formatRelative(barangay.admin.last_login_at)}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 text-orange-400">
                        <div className="w-10 h-10 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                            <Building2 size={16} className="opacity-60" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest">No Admin Assigned</span>
                    </div>
                )}
            </div>

            {/* Report stats */}
            <div>
                <div className="text-[10px] text-foreground/40 uppercase tracking-widest font-bold mb-2">Report Statistics</div>
                <div className="grid grid-cols-3 gap-2">
                    {[
                        { label: "Total",    value: barangay.total_reports,    color: "text-foreground" },
                        { label: "Pending",  value: barangay.pending,          color: "text-yellow-400" },
                        { label: "Active",   value: barangay.active,           color: "text-yellow-400" },
                        { label: "Resolved", value: barangay.resolved,         color: "text-emerald-400" },
                        { label: "Rejected", value: barangay.rejected,         color: "text-foreground/50" },
                        { label: "Failed",   value: barangay.failed_cleanup,   color: "text-red-400" },
                    ].map(k => (
                        <div key={k.label} className="glass-pro rounded-xl border border-border p-3 text-center">
                            <div className={`text-lg font-bold ${k.color}`}>{k.value}</div>
                            <div className="text-[9px] text-foreground/40 uppercase tracking-widest mt-0.5">{k.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* SLA stats */}
            <div className="glass-pro rounded-2xl border border-border p-4">
                <div className="text-[10px] text-foreground/40 uppercase tracking-widest font-bold mb-3">SLA Performance</div>
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <div className={`text-2xl font-bold ${barangay.compliance_rate >= 80 ? "text-emerald-400" : barangay.compliance_rate >= 60 ? "text-yellow-400" : "text-red-400"}`}>
                            {barangay.compliance_rate.toFixed(0)}%
                        </div>
                        <div className="text-[9px] text-foreground/40 uppercase tracking-widest">Compliance</div>
                    </div>
                    <div>
                        <div className={`text-2xl font-bold ${barangay.active_breaches > 0 ? "text-red-400" : "text-emerald-400"}`}>
                            {barangay.active_breaches}
                        </div>
                        <div className="text-[9px] text-foreground/40 uppercase tracking-widest">Active Breaches</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-foreground">{barangay.avg_resolution_days.toFixed(1)}d</div>
                        <div className="text-[9px] text-foreground/40 uppercase tracking-widest">Avg Resolution</div>
                    </div>
                </div>
            </div>

            {/* Trend + last report + rate */}
            <div className="grid grid-cols-3 gap-2">
                <div className="glass-pro rounded-xl border border-border p-3">
                    <div className="text-[9px] text-foreground/40 uppercase tracking-widest mb-1">7-Day Trend</div>
                    <div className={`text-sm font-bold ${trendColor}`}>
                        {trendArrow} {Math.abs(trend).toFixed(1)}%
                    </div>
                </div>
                <div className="glass-pro rounded-xl border border-border p-3">
                    <div className="text-[9px] text-foreground/40 uppercase tracking-widest mb-1">Last Report</div>
                    <div className="text-[11px] font-semibold text-foreground">
                        {barangay.last_report_at ? formatRelative(barangay.last_report_at) : "No reports yet"}
                    </div>
                </div>
                <div className="glass-pro rounded-xl border border-border p-3">
                    <div className="text-[9px] text-foreground/40 uppercase tracking-widest mb-1">Resolution</div>
                    <div className={`text-sm font-bold ${barangay.resolution_rate >= 75 ? "text-emerald-400" : barangay.resolution_rate >= 50 ? "text-yellow-400" : "text-red-400"}`}>
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
        <div className="flex flex-col gap-2">
            {reports.map((r: any) => (
                <div key={r.id} className="glass-pro rounded-xl border border-border p-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-foreground">{r.tracking_id || `#${r.id}`}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${REPORT_PILL[r.status] ?? REPORT_PILL.pending}`}>
                                {String(r.status).replace("_", " ")}
                            </span>
                        </div>
                        {r.notes && (
                            <div className="text-[11px] text-foreground/50 mt-0.5 truncate">{r.notes}</div>
                        )}
                    </div>
                    <div className="text-[10px] text-foreground/40 shrink-0">
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
        <div className="flex flex-col gap-2">
            {workOrders.slice(0, 20).map((wo: any) => (
                <div key={wo.id} className="glass-pro rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${WO_PRIORITY_PILL[wo.priority] ?? WO_PRIORITY_PILL.medium}`}>
                                {wo.priority}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${WO_STATUS_PILL[wo.status] ?? WO_STATUS_PILL.assigned}`}>
                                {String(wo.status).replace("_", " ")}
                            </span>
                        </div>
                        <span className="text-[10px] text-foreground/40 shrink-0">
                            {wo.created_at ? formatRelative(wo.created_at) : ""}
                        </span>
                    </div>
                    {wo.assigned_cleaner && (
                        <div className="text-[11px] text-foreground/50">
                            Cleaner: {wo.assigned_cleaner.full_name ?? `#${wo.assigned_cleaner_id}`}
                        </div>
                    )}
                    {wo.sla_deadline && (
                        <div className="text-[10px] text-foreground/40 mt-0.5">
                            SLA due: {formatDate(wo.sla_deadline)}
                        </div>
                    )}
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
        <div className="flex flex-col gap-4">
            {/* Admin section */}
            <div>
                <div className="text-[10px] text-foreground/40 uppercase tracking-widest font-bold mb-2">Administrator</div>
                {barangay.admin ? (
                    <div className="glass-pro rounded-xl border border-border p-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-foreground/10 border border-border flex items-center justify-center text-xs font-bold text-foreground/60 shrink-0">
                            {barangay.admin.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-foreground truncate">{barangay.admin.full_name}</div>
                            <div className="text-[10px] text-foreground/50 truncate">{barangay.admin.email}</div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                            <button
                                onClick={() => onReassignAdmin(barangay.admin!.id)}
                                className="px-2 py-1 glass border border-border rounded-lg text-[10px] font-bold text-foreground/50 hover:text-foreground uppercase tracking-widest transition-colors"
                            >
                                Reassign
                            </button>
                            <button
                                onClick={() => onDisableAdmin(barangay.admin!.id)}
                                className="px-2 py-1 glass border border-red-500/30 rounded-lg text-[10px] font-bold text-red-400 hover:bg-red-500/10 uppercase tracking-widest transition-colors"
                            >
                                Disable
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="glass-pro rounded-xl border border-orange-500/20 p-3 flex items-center justify-between gap-3">
                        <span className="text-xs text-orange-400 font-bold uppercase tracking-widest">No Admin Assigned</span>
                        <button
                            onClick={() => onAssignAdmin(barangay.barangay)}
                            className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-emerald-500/30 transition-colors"
                        >
                            Assign Admin
                        </button>
                    </div>
                )}
            </div>

            {/* Cleaners section */}
            <div>
                <div className="text-[10px] text-foreground/40 uppercase tracking-widest font-bold mb-2">
                    Cleaners {!loading && `(${cleaners.length})`}
                </div>
                {loading ? (
                    <TabLoading />
                ) : error ? (
                    <TabError message={error} onRetry={onRetry} />
                ) : cleaners.length === 0 ? (
                    <TabEmpty message="No cleaners assigned to this barangay." />
                ) : (
                    <div className="flex flex-col gap-2">
                        {cleaners.map((c: any) => (
                            <div key={c.id} className="glass-pro rounded-xl border border-border p-3 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-foreground/10 border border-border flex items-center justify-center text-[10px] font-bold text-foreground/60 shrink-0">
                                    {c.full_name?.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-semibold text-foreground truncate">{c.full_name}</div>
                                    <div className="text-[10px] text-foreground/50 truncate">{c.email}</div>
                                </div>
                                {!c.is_active && (
                                    <span className="text-[9px] font-bold text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded bg-red-500/10 uppercase tracking-widest shrink-0">
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
            <div className="w-full h-72 animate-pulse bg-foreground/5 rounded-xl flex items-center justify-center">
                <span className="text-xs text-foreground/40">Loading map…</span>
            </div>
        );
    }
    if (error) return <TabError message={error} onRetry={onRetry} />;
    if (!feature) return <TabEmpty message="Boundary data unavailable." />;

    return (
        <div className="flex flex-col gap-4">
            <div className="w-full h-72 rounded-xl overflow-hidden border border-border">
                <BarangayBoundaryMap feature={feature} />
            </div>
            <div className="glass-pro rounded-xl border border-border p-3">
                <div className="text-[10px] text-foreground/40 uppercase tracking-widest font-bold mb-1">Location</div>
                <div className="text-sm font-semibold text-foreground">{barangay.barangay}</div>
                <div className="text-[11px] text-foreground/50">San Jose del Monte, Bulacan</div>
            </div>
        </div>
    );
}
