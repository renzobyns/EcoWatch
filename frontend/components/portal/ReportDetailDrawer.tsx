"use client";

import { useState, useEffect } from "react";
import { X, FileText, Camera, Shield, Clock, MapPin, User, Mail, Phone, ExternalLink } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { TrustBadge } from "@/components/TrustBadge";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { ConfidenceTooltipBody } from "@/components/ConfidenceTooltipBody";
import { formatRelative, formatDate } from "@/lib/date-utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

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
    trust_reasons?: string[];
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

function OverviewTab({ report, detail, loading, error, onRetry }: {
    report: QueueReport;
    detail: ReportDetailPayload | null;
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}) {
    const mapsUrl = `https://www.google.com/maps?q=${report.lat},${report.lon}`;
    const reporter = detail?.reporter ?? null;

    return (
        <div className="flex flex-col gap-4">
            {/* Status / IDs */}
            <div className="glass-pro rounded-2xl border border-border p-4">
                <div className="text-[10px] text-foreground/40 uppercase tracking-widest font-bold mb-3">Status & IDs</div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                        <div className="text-[9px] text-foreground/40 uppercase tracking-widest">Tracking ID</div>
                        <div className="font-mono font-bold text-foreground">{report.tracking_id ?? `#${report.id}`}</div>
                    </div>
                    <div>
                        <div className="text-[9px] text-foreground/40 uppercase tracking-widest">Barangay</div>
                        <div className="font-bold text-emerald-300">{report.barangay ?? "Unassigned"}</div>
                    </div>
                    <div>
                        <div className="text-[9px] text-foreground/40 uppercase tracking-widest">Reported</div>
                        <div className="text-foreground/80">{formatDate(report.created_at)}</div>
                    </div>
                    {report.deployed_at && (
                        <div>
                            <div className="text-[9px] text-foreground/40 uppercase tracking-widest">Deployed</div>
                            <div className="text-foreground/80">{formatDate(report.deployed_at)}</div>
                        </div>
                    )}
                    {report.resolved_at && (
                        <div>
                            <div className="text-[9px] text-foreground/40 uppercase tracking-widest">Resolved</div>
                            <div className="text-foreground/80">{formatDate(report.resolved_at)}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Reporter */}
            <div className="glass-pro rounded-2xl border border-border p-4">
                <div className="text-[10px] text-foreground/40 uppercase tracking-widest font-bold mb-3">Reporter</div>
                {report.reporter_id === null ? (
                    <div className="flex items-center gap-3 text-foreground/50">
                        <div className="w-10 h-10 rounded-full bg-foreground/5 border border-border flex items-center justify-center shrink-0">
                            <User size={16} className="opacity-50" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest">Anonymous Report</span>
                    </div>
                ) : loading && !reporter ? (
                    <div className="h-12 glass rounded-xl animate-pulse" />
                ) : error && !reporter ? (
                    <div className="flex items-center justify-between gap-3 text-[11px]">
                        <span className="text-red-400">Couldn't load reporter info.</span>
                        <button onClick={onRetry} className="px-2 py-1 glass border border-border rounded text-[10px] font-bold uppercase tracking-widest hover:text-foreground transition-colors">Retry</button>
                    </div>
                ) : reporter ? (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-foreground/10 border border-border flex items-center justify-center text-sm font-bold text-foreground/60 shrink-0">
                            {reporter.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="font-semibold text-foreground text-sm">{reporter.full_name}</div>
                            <div className="text-[11px] text-foreground/50 flex items-center gap-1 mt-0.5">
                                <Mail size={10} /> {reporter.email}
                            </div>
                            {reporter.phone_number && (
                                <div className="text-[11px] text-foreground/50 flex items-center gap-1 mt-0.5">
                                    <Phone size={10} /> {reporter.phone_number}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="text-[11px] text-foreground/40">Reporter info unavailable.</div>
                )}
            </div>

            {/* Location */}
            <div className="glass-pro rounded-2xl border border-border p-4">
                <div className="text-[10px] text-foreground/40 uppercase tracking-widest font-bold mb-3">Location</div>
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm text-foreground/80">
                            <MapPin size={14} className="text-foreground/40 shrink-0" />
                            <span className="font-mono">{report.lat.toFixed(6)}, {report.lon.toFixed(6)}</span>
                        </div>
                    </div>
                    <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 glass border border-border rounded-lg text-[10px] font-bold uppercase tracking-widest text-foreground/60 hover:text-foreground transition-colors shrink-0"
                    >
                        <ExternalLink size={10} /> Maps
                    </a>
                </div>
            </div>

            {/* AI Verification */}
            <div className="glass-pro rounded-2xl border border-border p-4">
                <div className="text-[10px] text-foreground/40 uppercase tracking-widest font-bold mb-3">AI Verification</div>
                <TrustBadge
                    trust_score={report.trust_score as "high" | "medium" | "low" | null}
                    trust_reasons={report.trust_reasons}
                    failing_signals={report.failing_signals}
                    needs_human_review={report.needs_human_review}
                />
                {report.ai_confidence !== null && (
                    <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-foreground/60">
                        <span>Confidence: <span className="font-bold text-foreground">{(report.ai_confidence * 100).toFixed(1)}%</span></span>
                        <InfoTooltip label="How is AI confidence computed?">
                            <ConfidenceTooltipBody />
                        </InfoTooltip>
                    </div>
                )}
                {report.verification_pending && (
                    <div className="mt-2 text-[11px] text-amber-300">AI verification still running…</div>
                )}
            </div>

            {/* Notes */}
            {(report.notes || report.deployment_notes) && (
                <div className="glass-pro rounded-2xl border border-border p-4 space-y-3">
                    <div className="text-[10px] text-foreground/40 uppercase tracking-widest font-bold">Notes</div>
                    {report.notes && (
                        <div>
                            <div className="text-[9px] text-foreground/40 uppercase tracking-widest mb-1">Citizen</div>
                            <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{report.notes}</p>
                        </div>
                    )}
                    {report.deployment_notes && (
                        <div>
                            <div className="text-[9px] text-foreground/40 uppercase tracking-widest mb-1">Deployment</div>
                            <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{report.deployment_notes}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function EvidenceTab({
    report, detail, loading, error, onRetry,
}: {
    report: QueueReport;
    detail: ReportDetailPayload | null;
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}) {
    const [lightbox, setLightbox] = useState<string | null>(null);

    useEffect(() => {
        if (!lightbox) return;
        const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(null); };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [lightbox]);

    if (loading) return <TabLoading />;
    if (error) return <TabError message={error} onRetry={onRetry} />;

    const photos = detail?.report.photos ?? [];
    const cleanupPhotos = detail?.cleanup_photos ?? [];

    const legacyFallback = photos.length === 0 && report.image_url
        ? [{
            url: report.image_url,
            mask_url: report.ai_mask_url,
            ai_confidence: report.ai_confidence,
            ai_verified: null,
            trust_score: report.trust_score,
            failing_signals: report.failing_signals,
          }]
        : [];
    const citizenPhotos = photos.length > 0 ? photos : legacyFallback;

    const isEmpty = citizenPhotos.length === 0 && cleanupPhotos.length === 0;

    if (isEmpty) {
        return (
            <TabEmpty
                message={report.verification_pending
                    ? "AI verification still running…"
                    : "No evidence uploaded yet."}
            />
        );
    }

    return (
        <div className="flex flex-col gap-5">
            {citizenPhotos.length > 0 && (
                <div>
                    <div className="text-[10px] text-foreground/40 uppercase tracking-widest font-bold mb-2">Citizen Evidence</div>
                    <div className="flex flex-col gap-4">
                        {citizenPhotos.map((p, i) => (
                            <div key={i} className="glass-pro rounded-xl border border-border p-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setLightbox(`${API_URL}${p.url}`)}
                                        className="aspect-square rounded-lg overflow-hidden bg-foreground/5 border border-border hover:border-primary/40 transition-colors"
                                    >
                                        <img src={`${API_URL}${p.url}`} alt="Citizen photo" className="w-full h-full object-cover" />
                                    </button>
                                    <button
                                        onClick={() => p.mask_url && setLightbox(`${API_URL}${p.mask_url}`)}
                                        disabled={!p.mask_url}
                                        className="aspect-square rounded-lg overflow-hidden bg-foreground/5 border border-border hover:border-primary/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                                    >
                                        {p.mask_url ? (
                                            <img src={`${API_URL}${p.mask_url}`} alt="AI mask" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-[10px] text-foreground/40 uppercase tracking-widest">No mask</span>
                                        )}
                                    </button>
                                </div>
                                {p.ai_confidence !== null && (
                                    <div className="mt-2 text-[11px] text-foreground/60">
                                        AI confidence: <span className="font-bold text-foreground">{(p.ai_confidence * 100).toFixed(1)}%</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {cleanupPhotos.length > 0 && (
                <div>
                    <div className="text-[10px] text-foreground/40 uppercase tracking-widest font-bold mb-2">Cleanup Proof</div>
                    <div className="flex flex-col gap-2">
                        {cleanupPhotos.map((cp) => (
                            <div key={cp.id} className="glass-pro rounded-xl border border-border p-3 flex gap-3">
                                <button
                                    onClick={() => setLightbox(`${API_URL}${cp.url}`)}
                                    className="w-20 h-20 rounded-lg overflow-hidden bg-foreground/5 border border-border shrink-0 hover:border-primary/40 transition-colors"
                                >
                                    <img src={`${API_URL}${cp.url}`} alt="Cleanup proof" className="w-full h-full object-cover" />
                                </button>
                                <div className="min-w-0 flex-1 text-xs">
                                    <div className="font-semibold text-foreground truncate">
                                        {cp.cleaner?.full_name ?? "Unknown cleaner"}
                                    </div>
                                    <div className="text-[11px] text-foreground/50 truncate">{cp.cleaner?.email ?? ""}</div>
                                    <div className="text-[10px] text-foreground/40 mt-1">Uploaded {formatRelative(cp.uploaded_at)}</div>
                                    {cp.ai_confidence !== null && (
                                        <div className="text-[10px] text-foreground/60 mt-0.5">
                                            AI: <span className="font-bold">{(cp.ai_confidence * 100).toFixed(0)}%</span>
                                            {cp.ai_verified === true && <span className="ml-2 text-emerald-400">Verified</span>}
                                            {cp.ai_verified === false && <span className="ml-2 text-red-400">Failed</span>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {lightbox && (
                <div
                    onClick={() => setLightbox(null)}
                    className="fixed inset-0 z-[3000] bg-black/90 flex items-center justify-center p-6 cursor-zoom-out"
                >
                    <img src={lightbox} alt="Enlarged" className="max-w-full max-h-full rounded-xl shadow-2xl" />
                </div>
            )}
        </div>
    );
}

function WorkOrdersTab({ detail, loading, error, onRetry }: {
    detail: ReportDetailPayload | null;
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}) {
    if (loading) return <TabLoading />;
    if (error) return <TabError message={error} onRetry={onRetry} />;

    const workOrders = detail?.work_orders ?? [];
    if (workOrders.length === 0) {
        return <TabEmpty message="No work orders assigned to this report yet." />;
    }

    return (
        <div className="flex flex-col gap-2">
            {workOrders.map((wo) => (
                <div key={wo.id} className="glass-pro rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${WO_PRIORITY_PILL[wo.priority] ?? WO_PRIORITY_PILL.medium}`}>
                                {wo.priority}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${WO_STATUS_PILL[wo.status] ?? WO_STATUS_PILL.assigned}`}>
                                {wo.status.replace("_", " ")}
                            </span>
                        </div>
                        <span className="text-[10px] text-foreground/40 shrink-0">
                            {formatRelative(wo.created_at)}
                        </span>
                    </div>

                    <div className="text-xs text-foreground/80 font-semibold">
                        {wo.assigned_cleaner_name ?? "Unassigned"}
                    </div>
                    {wo.assigned_cleaner_email && (
                        <div className="text-[10px] text-foreground/50">{wo.assigned_cleaner_email}</div>
                    )}

                    <div className="grid grid-cols-3 gap-2 mt-2 text-[10px]">
                        <div>
                            <div className="text-foreground/40 uppercase tracking-widest">SLA due</div>
                            <div className="text-foreground/80">{formatDate(wo.sla_deadline)}</div>
                        </div>
                        {wo.started_at && (
                            <div>
                                <div className="text-foreground/40 uppercase tracking-widest">Started</div>
                                <div className="text-foreground/80">{formatRelative(wo.started_at)}</div>
                            </div>
                        )}
                        {wo.completed_at && (
                            <div>
                                <div className="text-foreground/40 uppercase tracking-widest">Completed</div>
                                <div className="text-foreground/80">{formatRelative(wo.completed_at)}</div>
                            </div>
                        )}
                    </div>

                    {wo.notes && (
                        <p className="mt-2 text-[11px] text-foreground/60 leading-relaxed whitespace-pre-wrap">{wo.notes}</p>
                    )}
                </div>
            ))}
        </div>
    );
}

function TimelineTab({ entries, loading, error, onRetry }: {
    entries: AuditEntry[];
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}) {
    if (loading) return <TabLoading />;
    if (error) return <TabError message={error} onRetry={onRetry} />;
    if (entries.length === 0) {
        return <TabEmpty message="No override actions recorded for this report." />;
    }

    return (
        <div className="flex flex-col gap-2">
            {entries.map((e) => {
                const detailKeys = Object.keys(e.details ?? {});
                return (
                    <div key={e.id} className="glass-pro rounded-xl border border-border p-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-bold text-foreground uppercase tracking-widest">
                                {titleCase(e.action)}
                            </span>
                            <span className="text-[10px] text-foreground/40 shrink-0">
                                {formatRelative(e.created_at)}
                            </span>
                        </div>
                        <div className="text-[11px] text-foreground/60">
                            By <span className="font-semibold text-foreground/80">{e.user_email ?? "System"}</span>
                        </div>
                        {detailKeys.length > 0 && (
                            <div className="mt-2 grid grid-cols-1 gap-0.5">
                                {detailKeys.map((k) => (
                                    <div key={k} className="text-[10px] text-foreground/60">
                                        <span className="text-foreground/40 uppercase tracking-widest mr-1">{k.replace(/_/g, " ")}:</span>
                                        <span className="text-foreground/80 break-all">{String(e.details[k])}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
