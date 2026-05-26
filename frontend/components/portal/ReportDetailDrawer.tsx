"use client";

import { useState, useEffect } from "react";
import { X, FileText, Camera, Shield, Clock } from "lucide-react";
import { api, ApiError } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type DrawerTab = "overview" | "evidence" | "work_orders" | "timeline";

export interface QueueReport {
    id: number;
    tracking_id: string | null;
    barangay: string | null;
    status: string;
    lat: number;
    lon: number;
    reporter_id: number | null;
    image_url: string | null;
    ai_mask_url: string | null;
    ai_confidence: number | null;
    notes: string | null;
    deployment_notes: string | null;
    trust_score: string | null;
    needs_human_review: boolean;
    failing_signals: string[];
    created_at: string;
    deployed_at: string | null;
    resolved_at: string | null;
    verification_pending: boolean;
}

export interface ReportDetailPayload {
    report: QueueReport & {
        photos: Array<{
            url: string;
            mask_url: string | null;
            ai_confidence: number | null;
            ai_verified: boolean | null;
            trust_score: string | null;
            failing_signals: string[];
        }>;
    };
    reporter: {
        id: number;
        full_name: string;
        email: string;
        phone_number: string | null;
    } | null;
    cleanup_photos: Array<{
        id: number;
        url: string;
        ai_confidence: number | null;
        ai_verified: boolean | null;
        uploaded_at: string;
        work_order_id: number | null;
        cleaner: { id: number; full_name: string; email: string } | null;
    }>;
    work_orders: Array<{
        id: number;
        priority: "low" | "medium" | "high";
        status: "assigned" | "in_progress" | "completed" | "verified" | "needs_redo";
        sla_deadline: string;
        notes: string | null;
        created_at: string;
        started_at: string | null;
        completed_at: string | null;
        assigned_cleaner_name: string | null;
        assigned_cleaner_email: string | null;
    }>;
}

export interface AuditEntry {
    id: number;
    user_id: number | null;
    user_email: string | null;
    action: string;
    target_type: string;
    target_id: number | null;
    details: Record<string, unknown>;
    created_at: string;
}

interface Props {
    open: boolean;
    report: QueueReport | null;
    barangays: string[];
    newBarangay: string;
    setNewBarangay: (b: string) => void;
    actionLoading: boolean;
    onClose: () => void;
    onReassign: () => void;
    onForceClose: () => void;
}

// ─── Pill maps ────────────────────────────────────────────────────────────────

const STATUS_PILL: Record<string, string> = {
    pending: "bg-red-500/20 text-red-400",
    verified: "bg-orange-500/20 text-orange-400",
    assigned: "bg-yellow-500/20 text-yellow-400",
    in_progress: "bg-blue-500/20 text-blue-400",
    resolved: "bg-green-500/20 text-green-400",
    rejected: "bg-foreground/5 text-foreground/40",
    failed_cleanup: "bg-red-900/30 text-red-400",
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

function titleCase(s: string): string {
    return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function TabLoading() {
    return (
        <div className="space-y-2 pt-1">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 glass rounded-xl animate-pulse" />
            ))}
        </div>
    );
}

function TabError({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-red-400">{message}</p>
            <button
                onClick={onRetry}
                className="px-4 py-2 glass border border-border rounded-lg text-xs font-bold uppercase tracking-widest text-foreground/60 hover:text-foreground transition-colors"
            >
                Retry
            </button>
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

// ─── Main component ───────────────────────────────────────────────────────────

export function ReportDetailDrawer({
    open, report, barangays, newBarangay, setNewBarangay,
    actionLoading, onClose, onReassign, onForceClose,
}: Props) {
    const [activeTab, setActiveTab] = useState<DrawerTab>("overview");

    const [detail, setDetail] = useState<ReportDetailPayload | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [detailFetched, setDetailFetched] = useState(false);

    const [audit, setAudit] = useState<AuditEntry[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditError, setAuditError] = useState<string | null>(null);
    const [auditFetched, setAuditFetched] = useState(false);

    // Reset lazy data when report changes
    useEffect(() => {
        setActiveTab("overview");
        setDetail(null); setDetailFetched(false); setDetailError(null);
        setAudit([]); setAuditFetched(false); setAuditError(null);
    }, [report?.id]);

    const fetchDetail = async () => {
        if (!report) return;
        setDetailLoading(true);
        setDetailError(null);
        try {
            const data = await api(`/reports/${report.id}/detail`);
            setDetail(data);
            setDetailFetched(true);
        } catch (err) {
            setDetailError(err instanceof ApiError ? err.message : "Failed to load report detail.");
        } finally {
            setDetailLoading(false);
        }
    };

    const fetchAudit = async () => {
        if (!report) return;
        setAuditLoading(true);
        setAuditError(null);
        try {
            const data = await api(`/audit-log?target_id=${report.id}&limit=50`);
            setAudit(data.entries || []);
            setAuditFetched(true);
        } catch (err) {
            setAuditError(err instanceof ApiError ? err.message : "Failed to load timeline.");
        } finally {
            setAuditLoading(false);
        }
    };

    // Lazy-load on tab switch (Overview, Evidence, Work Orders all share /reports/{id}/detail)
    useEffect(() => {
        if (!open || !report) return;
        const needsDetail = activeTab === "overview" || activeTab === "evidence" || activeTab === "work_orders";
        if (needsDetail && !detailFetched && !detailLoading) {
            fetchDetail();
        }
        if (activeTab === "timeline" && !auditFetched && !auditLoading) {
            fetchAudit();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, open, report?.id]);

    if (!report) return null;

    const TABS: { key: DrawerTab; label: string; icon: React.ReactNode }[] = [
        { key: "overview",    label: "Overview",    icon: <FileText size={12} /> },
        { key: "evidence",    label: "Evidence",    icon: <Camera size={12} /> },
        { key: "work_orders", label: "Work Orders", icon: <Shield size={12} /> },
        { key: "timeline",    label: "Timeline",    icon: <Clock size={12} /> },
    ];

    const statusPillClass = STATUS_PILL[report.status] ?? "bg-foreground/10 text-foreground";

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
                            <h2 className="text-lg font-bold text-foreground leading-tight">
                                Report {report.tracking_id ?? `#${report.id}`}
                            </h2>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest ${statusPillClass}`}>
                                {report.status.replace("_", " ")}
                            </span>
                        </div>
                        <p className="text-[11px] text-foreground/40 mt-0.5">
                            {report.barangay ?? "Unassigned"} · Reported {formatDate(report.created_at)}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-foreground/10 text-foreground/40 hover:text-foreground transition-colors shrink-0 ml-3"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Tab strip */}
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
                        <OverviewTab
                            report={report}
                            detail={detail}
                            loading={detailLoading}
                            error={detailError}
                            onRetry={fetchDetail}
                        />
                    )}
                    {activeTab === "evidence" && (
                        <EvidenceTab
                            report={report}
                            detail={detail}
                            loading={detailLoading}
                            error={detailError}
                            onRetry={fetchDetail}
                        />
                    )}
                    {activeTab === "work_orders" && (
                        <WorkOrdersTab
                            detail={detail}
                            loading={detailLoading}
                            error={detailError}
                            onRetry={fetchDetail}
                        />
                    )}
                    {activeTab === "timeline" && (
                        <TimelineTab
                            entries={audit}
                            loading={auditLoading}
                            error={auditError}
                            onRetry={fetchAudit}
                        />
                    )}
                </div>

                {/* Footer actions */}
                <div className="p-4 border-t border-border shrink-0 flex flex-col gap-2">
                    <div className="flex gap-2">
                        <select
                            value={newBarangay}
                            onChange={(e) => setNewBarangay(e.target.value)}
                            className="flex-1 bg-foreground/5 border border-border rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
                        >
                            {barangays.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                        <button
                            onClick={onReassign}
                            disabled={actionLoading || newBarangay === report.barangay}
                            className="px-4 py-2.5 bg-primary hover:bg-emerald-400 text-white text-xs font-bold uppercase tracking-widest rounded-xl shadow-lg disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                            Update Route
                        </button>
                    </div>
                    <button
                        onClick={onForceClose}
                        disabled={actionLoading || report.status === "resolved"}
                        className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-widest rounded-xl shadow-lg disabled:opacity-50 transition-colors"
                    >
                        Force Close Ticket
                    </button>
                </div>
            </div>
        </>
    );
}

// ─── Tab placeholders (filled in later tasks) ────────────────────────────────

function OverviewTab(props: {
    report: QueueReport;
    detail: ReportDetailPayload | null;
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}) {
    return <TabEmpty message="Overview tab — pending Task 5." />;
}

function EvidenceTab(props: {
    report: QueueReport;
    detail: ReportDetailPayload | null;
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}) {
    if (props.loading) return <TabLoading />;
    if (props.error) return <TabError message={props.error} onRetry={props.onRetry} />;
    return <TabEmpty message="Evidence tab — pending Task 6." />;
}

function WorkOrdersTab(props: {
    detail: ReportDetailPayload | null;
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}) {
    if (props.loading) return <TabLoading />;
    if (props.error) return <TabError message={props.error} onRetry={props.onRetry} />;
    return <TabEmpty message="Work Orders tab — pending Task 7." />;
}

function TimelineTab(props: {
    entries: AuditEntry[];
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}) {
    if (props.loading) return <TabLoading />;
    if (props.error) return <TabError message={props.error} onRetry={props.onRetry} />;
    return <TabEmpty message="Timeline tab — pending Task 8." />;
}
