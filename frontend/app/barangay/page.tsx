"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Search, Download, LayoutDashboard, FileText, Map, ClipboardList, BookUser, MoreVertical, FileDown, Eye, EyeOff, Edit2, Key, UserCheck, UserX, Plus, ChevronRight, LayoutGrid, List, RefreshCw, AlertTriangle, ListChecks, Hourglass, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { slaInfo, SLA_PILL_CLASSES, slaDeadlineColor, slaDeadlineLabel } from "@/lib/sla";
import { formatDate, formatDateTime, formatRelative } from "@/lib/date-utils";
import { PortalShell, type PortalNavItem } from "@/components/portal/PortalShell";
import { TrustBadge } from "@/components/TrustBadge";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { ConfidenceTooltipBody } from "@/components/ConfidenceTooltipBody";
import { PhotoEvidenceDetail } from "@/components/PhotoEvidenceDetail";
import { useUnreadNotificationCount } from "@/lib/notification-poll";
import { KpiCard } from "@/components/portal/KpiCard";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { DateRange } from "react-day-picker";

const MiniMap = dynamic(() => import("@/components/MiniMap"), { ssr: false });
const MapComponent = dynamic(() => import("@/components/MapComponent"), { ssr: false });
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type BarangayView = "dashboard" | "reports" | "map_view" | "workorders" | "accounts";
type ReportSubFilter = "pending" | "assigned" | "resolved";

const BARANGAY_NAV: PortalNavItem[] = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, subtitle: "Jurisdiction overview" },
    { key: "reports", label: "Reports", icon: FileText },
    { key: "map_view", label: "Map View", icon: Map },
    { key: "workorders", label: "Workorders", icon: ClipboardList, sectionBreakBefore: true },
    { key: "accounts", label: "Accounts", icon: BookUser },
];

function useDebounce<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(t);
    }, [value, delayMs]);
    return debounced;
}

async function downloadCsv(qs: string) {
    const headers: Record<string, string> = {};
    try {
        const raw = localStorage.getItem("ecowatch_user");
        if (raw) {
            const u = JSON.parse(raw);
            if (u?.id) headers["X-User-Id"] = String(u.id);
        }
    } catch { /* ignore */ }
    const res = await fetch(`${API_URL}/reports/export${qs}`, { headers });
    if (!res.ok) {
        let detail = `Export failed (${res.status})`;
        try { const j = await res.json(); if (j?.detail) detail = j.detail; } catch { /* ignore */ }
        throw new Error(detail);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ecowatch_reports_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

interface BarangayUser {
    id: number;
    email: string;
    full_name: string;
    role: string;
    barangay_assignment: string | null;
    phone_number: string | null;
    is_active: boolean;
    created_at: string | null;
    last_login_at: string | null;
}

// useSearchParams() (used in BarangayPortalInner for report deep-linking) needs a
// Suspense boundary so the page doesn't bail out of static prerendering at build time.
export default function BarangayPortal() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}>
            <BarangayPortalInner />
        </Suspense>
    );
}

function BarangayPortalInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [user, setUser] = useState<any>(null);
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [tableLoading, setTableLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState<any>(null);
    const [unreadCount] = useUnreadNotificationCount(user?.id);
    const rawTab = searchParams.get('tab');
    const [activeView, setActiveView] = useState<BarangayView>(
        BARANGAY_NAV.some(n => n.key === rawTab) ? (rawTab as BarangayView) : 'dashboard'
    );
    const rawSub = searchParams.get('sub');
    const VALID_SUBS: ReportSubFilter[] = ['pending', 'assigned', 'resolved'];
    const [reportSubFilter, setReportSubFilter] = useState<ReportSubFilter>(
        (typeof window !== "undefined" ? (new URLSearchParams(window.location.search).get("sub") as ReportSubFilter) : null) || 'pending'
    );
    const [reportPage, setReportPage] = useState(1);
    const [reportViewMode, setReportViewMode] = useState<"table" | "card">("table");
    const [reportSort, setReportSort] = useState<"newest" | "oldest">("newest");
    const [reportStatus, setReportStatus] = useState("all");
    const REPORT_PAGE_SIZE = reportViewMode === "table" ? 10 : 12;

    // Filters (B1)
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 300);
    const [dateRange, setDateRange] = useState<DateRange | undefined>();

    // Action States
    const [actionLoading, setActionLoading] = useState(false);
    const [cleanupImage, setCleanupImage] = useState<File | null>(null);
    const [cleanupPreview, setCleanupPreview] = useState<string | null>(null);
    const [deploymentNotes, setDeploymentNotes] = useState("");
    const [selectedPriority, setSelectedPriority] = useState("medium");
    const [selectedCleaner, setSelectedCleaner] = useState<number | null>(null);

    // SLA Policy (loaded on mount so deploy modal labels are accurate)
    const [slaPolicy, setSlaPolicy] = useState({ low: 7, medium: 3, high: 1 });

    // Team Management States (cleaners list used for deploy/workorder modals)
    const [cleaners, setCleaners] = useState<any[]>([]);

    // -- Accounts Tab State ---------------------------------------------------
    const [barangayUsers, setBarangayUsers] = useState<BarangayUser[]>([]);
    const [userLoading, setUserLoading] = useState(false);
    const [userPage, setUserPage] = useState(1);
    const [userViewMode, setUserViewMode] = useState<"table" | "card">("table");
    const USER_PAGE_SIZE = userViewMode === "table" ? 10 : 12;
    const [userSearch, setUserSearch] = useState("");
    const debouncedUserSearch = useDebounce(userSearch, 300);
    const [userStatusFilter, setUserStatusFilter] = useState("all");
    const [userActionsMenu, setUserActionsMenu] = useState<number | null>(null);
    const [reactivating, setReactivating] = useState<Set<number>>(new Set());

    const [showCreateCleanerModal, setShowCreateCleanerModal] = useState(false);
    const [createCleanerForm, setCreateCleanerForm] = useState({ full_name: "", email: "", phone_number: "" });
    const [createCleanerPending, setCreateCleanerPending] = useState(false);
    const [showCleanerPasswordModal, setShowCleanerPasswordModal] = useState(false);
    const [cleanerTempPassword, setCleanerTempPassword] = useState("");
    const [cleanerTempEmail, setCleanerTempEmail] = useState("");

    const [showEditCleanerModal, setShowEditCleanerModal] = useState(false);
    const [editTarget, setEditTarget] = useState<BarangayUser | null>(null);
    const [editForm, setEditForm] = useState({ full_name: "", email: "", phone_number: "" });
    const [editPending, setEditPending] = useState(false);

    const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
    const [resetTarget, setResetTarget] = useState<BarangayUser | null>(null);
    const [resetPending, setResetPending] = useState(false);
    const [resetCredential, setResetCredential] = useState<{ email: string; password: string } | null>(null);
    const [resetPasswordVisible, setResetPasswordVisible] = useState(false);

    // -- Workorders Tab State -------------------------------------------------
    const [workOrders, setWorkOrders] = useState<any[]>([]);
    const [woLoading, setWoLoading] = useState(false);
    const [woError, setWoError] = useState<string | null>(null);
    const [woPage, setWoPage] = useState(1);
    const [woViewMode, setWoViewMode] = useState<"table" | "card">("table");
    const [woSort, setWoSort] = useState<"newest" | "oldest">("newest");
    const WO_PAGE_SIZE = woViewMode === "table" ? 10 : 12;
    const [woStatusFilter, setWoStatusFilter] = useState<string>("all");
    const [woPriorityFilter, setWoPriorityFilter] = useState<string>("all");
    const [woCleanerFilter, setWoCleanerFilter] = useState<number | null>(null);
    const [woSlaRiskOnly, setWoSlaRiskOnly] = useState(false);
    const [woSearch, setWoSearch] = useState("");
    const [woKpiWindow, setWoKpiWindow] = useState<"week" | "month" | "all">("week");
    const [selectedWorkOrder, setSelectedWorkOrder] = useState<any>(null);
    const [pendingFocusReportId, setPendingFocusReportId] = useState<number | null>(null);
    const [woActionLoading, setWoActionLoading] = useState(false);
    const [showReassignModal, setShowReassignModal] = useState(false);
    const [reassignCleaner, setReassignCleaner] = useState<number | null>(null);
    const [showPriorityModal, setShowPriorityModal] = useState(false);
    const [newWoPriority, setNewWoPriority] = useState<string>("medium");
    const [showForceResolveModal, setShowForceResolveModal] = useState(false);
    const [forceResolveReason, setForceResolveReason] = useState("");
    const [showSlaTooltip, setShowSlaTooltip] = useState(false);
    const [slaTooltipPos, setSlaTooltipPos] = useState({ top: 0, left: 0 });
    const slaTooltipAnchorRef = useRef<HTMLSpanElement>(null);

    // Reporter detail (Module 2): fetched from /reports/{id}/detail when a report modal opens
    const [reporterDetail, setReporterDetail] = useState<{ id: number; full_name: string; email: string; phone_number: string | null } | null>(null);
    const [reporterLoading, setReporterLoading] = useState(false);
    const [reporterError, setReporterError] = useState(false);
    // Photo evidence detail (Module 4): stored from the same /detail fetch
    const [reportPhotos, setReportPhotos] = useState<Array<{ url: string; mask_url: string | null; ai_confidence: number | null; ai_verified: boolean | null; trust_score: string | null; failing_signals: string[]; signals?: Record<string, unknown> }>>([]);

    // Possible duplicates (Module 3): fetched when a flagged report modal opens
    const [duplicateMatches, setDuplicateMatches] = useState<any[]>([]);
    const [markingDuplicate, setMarkingDuplicate] = useState(false);

    useEffect(() => {
        // Auth Check
        const storedUser = localStorage.getItem('ecowatch_user');
        if (!storedUser) {
            router.push('/login');
            return;
        }

        const parsed = JSON.parse(storedUser);
        if (parsed.role !== 'barangay') {
            router.push('/');
            return;
        }

        setUser(parsed);
    }, [router]);

    // Re-fetch whenever filters change (after the user is loaded)
    useEffect(() => {
        if (!user?.barangay_assignment) return;
        fetchReports(user.barangay_assignment);
        fetchCleaners(); // Ensure cleaners are available for the deploy modal on initial load
        api("/config/sla").then((data) => setSlaPolicy(data)).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.barangay_assignment, debouncedSearch, dateRange]);

    useEffect(() => setReportPage(1), [search, reportStatus, reportSort, reportViewMode, dateRange]);
    useEffect(() => setWoPage(1), [woSearch, woStatusFilter, woPriorityFilter, woCleanerFilter, woSlaRiskOnly, woSort, woViewMode]);

    const buildQuery = () => {
        const params = new URLSearchParams();
        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
        if (dateRange?.from) {
            const y = dateRange.from.getFullYear();
            const m = String(dateRange.from.getMonth() + 1).padStart(2, '0');
            const d = String(dateRange.from.getDate()).padStart(2, '0');
            params.set("date_from", `${y}-${m}-${d}T00:00:00`);
        }
        if (dateRange?.to) {
            const y = dateRange.to.getFullYear();
            const m = String(dateRange.to.getMonth() + 1).padStart(2, '0');
            const d = String(dateRange.to.getDate()).padStart(2, '0');
            params.set("date_to", `${y}-${m}-${d}T23:59:59`);
        }
        params.set("limit", "1000"); // fetch up to 1000 for client-side pagination
        const qs = params.toString();
        return qs ? `?${qs}` : "";
    };

    const fetchReports = async (barangayName: string) => {
        setTableLoading(true);
        try {
            const data = await api(`/reports/barangay/${encodeURIComponent(barangayName)}${buildQuery()}`);
            if (Array.isArray(data)) {
                setReports(data);
            }
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to load reports");
        } finally {
            setLoading(false);
            setTableLoading(false);
        }
    };

    const handleDeploy = async (reportId: number) => {
        setActionLoading(true);
        try {
            const formData = new FormData();
            const trimmed = deploymentNotes.trim();
            if (trimmed) formData.append("deployment_notes", trimmed);
            if (selectedPriority) formData.append("priority", selectedPriority);
            if (selectedCleaner) formData.append("assigned_cleaner_id", String(selectedCleaner));
            const data = await api(`/report/${reportId}/assign`, { method: "PUT", body: formData });
            const updated = { status: 'assigned', deployment_notes: trimmed || null };
            setReports(reports.map(r => r.id === reportId ? { ...r, ...updated, ...(data?.report || {}) } : r));
            setSelectedReport({ ...selectedReport, ...updated, ...(data?.report || {}) });
            setDeploymentNotes("");
            setSelectedPriority("medium");
            setSelectedCleaner(null);
            toast.success("Cleanup team deployed.");
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Network error.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleResolve = async (reportId: number) => {
        if (!cleanupImage) {
            toast.error("Please upload a cleanup verification photo.");
            return;
        }
        setActionLoading(true);

        const formData = new FormData();
        formData.append("cleanup_images", cleanupImage);

        try {
            const data = await api(`/report/${reportId}/resolve`, {
                method: "POST",
                body: formData,
            });
            // 202: photo saved, AI runs in background. Show "verifying" then poll.
            const reportSnapshot = data.report;
            setReports(prev => prev.map(r => r.id === reportId ? { ...r, ...reportSnapshot } : r));
            setSelectedReport((prev: any) => prev ? { ...prev, ...reportSnapshot } : prev);
            setCleanupImage(null);
            setCleanupPreview(null);
            toast.info("Cleanup photo uploaded. AI verifying…");
            pollResolveOutcome(reportId, reportSnapshot.tracking_id);
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Network error.");
        } finally {
            setActionLoading(false);
        }
    };

    const pollResolveOutcome = (reportId: number, trackingId: string | null) => {
        if (!trackingId) return;
        let attempts = 0;
        const MAX_ATTEMPTS = 40; // ~2 minutes at 3s
        const tick = async () => {
            attempts++;
            try {
                const res = await fetch(`${API_URL}/report/track/${trackingId}`);
                if (res.ok) {
                    const fresh = await res.json();
                    setReports(prev => prev.map(r => r.id === reportId ? { ...r, ...fresh } : r));
                    setSelectedReport((prev: any) => prev?.id === reportId ? { ...prev, ...fresh } : prev);
                    if (!fresh.verification_pending) {
                        if (fresh.status === "failed_cleanup") {
                            toast.warning("AI detected waste is still present. Please clean thoroughly and try again.");
                        } else if (fresh.status === "resolved") {
                            toast.success("Report resolved!");
                            setSelectedReport((prev: any) => prev?.id === reportId ? null : prev);
                        }
                        return;
                    }
                }
            } catch { /* transient — retry */ }
            if (attempts < MAX_ATTEMPTS) setTimeout(tick, 3000);
            else toast.error("AI verification is taking longer than expected. Refresh later for the result.");
        };
        setTimeout(tick, 1500);
    };

    const handleExport = async () => {
        try {
            await downloadCsv(buildQuery());
            toast.success("CSV downloaded.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Export failed");
        }
    };

    const fetchCleaners = async () => {
        if (!user?.barangay_assignment) return;
        try {
            const data = await api("/users");
            if (Array.isArray(data)) setCleaners(data);
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to load team");
        }
    };

    const fetchWorkOrders = async () => {
        setWoLoading(true);
        setWoError(null);
        try {
            const data = await api("/work-orders");
            if (Array.isArray(data)) setWorkOrders(data);
        } catch (err) {
            setWoError(err instanceof ApiError ? err.message : "Failed to load work orders");
        } finally {
            setWoLoading(false);
        }
    };

    useEffect(() => {
        if (user && activeView === "workorders") {
            fetchWorkOrders();
            fetchCleaners();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, activeView]);

    const handleWoReassign = async () => {
        if (!selectedWorkOrder || !reassignCleaner) return;
        setWoActionLoading(true);
        try {
            const data = await api(`/work-orders/${selectedWorkOrder.id}/reassign`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assigned_cleaner_id: reassignCleaner }),
            });
            const updated = data.work_order;
            setWorkOrders(prev => prev.map(wo => wo.id === updated.id ? updated : wo));
            setSelectedWorkOrder(updated);
            setShowReassignModal(false);
            setReassignCleaner(null);
            toast.success("Cleaner reassigned.");
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Reassign failed.");
        } finally {
            setWoActionLoading(false);
        }
    };

    const handleWoPriority = async () => {
        if (!selectedWorkOrder || !newWoPriority) return;
        setWoActionLoading(true);
        try {
            const data = await api(`/work-orders/${selectedWorkOrder.id}/priority`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ priority: newWoPriority }),
            });
            const updated = data.work_order;
            setWorkOrders(prev => prev.map(wo => wo.id === updated.id ? updated : wo));
            setSelectedWorkOrder(updated);
            setShowPriorityModal(false);
            toast.success("Priority updated. SLA deadline recomputed.");
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Priority update failed.");
        } finally {
            setWoActionLoading(false);
        }
    };

    const handleForceResolve = async () => {
        if (!selectedWorkOrder || forceResolveReason.trim().length < 10) return;
        setWoActionLoading(true);
        try {
            const data = await api(`/work-orders/${selectedWorkOrder.id}/force-resolve`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: forceResolveReason.trim() }),
            });
            const updated = data.work_order;
            setWorkOrders(prev => prev.map(wo => wo.id === updated.id ? updated : wo));
            setSelectedWorkOrder(updated);
            setShowForceResolveModal(false);
            setForceResolveReason("");
            toast.success("Work order force-resolved. Report marked as resolved.");
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Force resolve failed.");
        } finally {
            setWoActionLoading(false);
        }
    };

    const handleRetry = async (reportId: number) => {
        setActionLoading(true);
        try {
            const data = await api(`/report/${reportId}/retry`, { method: "PUT" });
            const updated = { status: 'assigned', ...(data?.report || {}) };
            setReports(prev => prev.map(r => r.id === reportId ? { ...r, ...updated } : r));
            setSelectedReport((prev: any) => prev ? { ...prev, ...updated } : prev);
            toast.success("Cleanup retried. Report moved back to assigned.");
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Retry failed.");
        } finally {
            setActionLoading(false);
        }
    };

    // Fetch accounts when sidebar switches to that view
    useEffect(() => {
        if (activeView === 'accounts') fetchBrgyUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeView]);

    useEffect(() => {
        const handler = (e: Event) => {
            const ce = e as CustomEvent<{ report_id: number | null; work_order_id: number | null; kind: string }>;
            const { report_id, kind } = ce.detail || {};

            if (kind === "report_reassigned_out") {
                toast.info("This report has been moved to another barangay.");
                return;
            }
            if (kind === "sla_approaching" || kind === "sla_breached" || kind === "cleanup_needs_redo") {
                setActiveView("workorders" as BarangayView);
                router.replace("?tab=workorders", { scroll: false });
                return;
            }
            if (report_id) {
                setActiveView("reports" as BarangayView);
                router.replace("?tab=reports", { scroll: false });
                setPendingFocusReportId(report_id);
            }
        };
        window.addEventListener("ecowatch:open-target", handler as EventListener);
        return () => window.removeEventListener("ecowatch:open-target", handler as EventListener);
    }, [router]);

    useEffect(() => {
        if (pendingFocusReportId == null) return;
        const target = reports.find(r => r.id === pendingFocusReportId);
        if (target) {
            setSelectedReport(target);
            setPendingFocusReportId(null);
        }
    }, [pendingFocusReportId, reports]);

    // Fetch reporter identity + photo evidence when a report modal opens (Modules 2 + 4)
    useEffect(() => {
        if (!selectedReport) {
            setReporterDetail(null);
            setReporterError(false);
            setReportPhotos([]);
            return;
        }
        if (selectedReport.reporter_id == null) {
            setReporterDetail(null);
        }
        let cancelled = false;
        setReporterDetail(null);
        setReporterLoading(true);
        setReporterError(false);
        setReportPhotos([]);
        api(`/reports/${selectedReport.id}/detail`)
            .then((data: any) => {
                if (!cancelled) {
                    setReporterDetail(data?.reporter ?? null);
                    setReportPhotos(data?.report?.photos ?? []);
                }
            })
            .catch(() => {
                if (!cancelled) setReporterError(true);
            })
            .finally(() => {
                if (!cancelled) setReporterLoading(false);
            });
        return () => { cancelled = true; };
    }, [selectedReport?.id]);

    // Fetch possible duplicates when a flagged report modal opens (Module 3)
    useEffect(() => {
        if (!selectedReport || !selectedReport.possible_duplicate_flag || selectedReport.status === 'duplicate') {
            setDuplicateMatches([]);
            return;
        }
        let cancelled = false;
        api(`/reports/${selectedReport.id}/possible-duplicates`)
            .then((data: any) => {
                if (!cancelled) setDuplicateMatches(data?.possible_duplicates ?? []);
            })
            .catch(() => {
                if (!cancelled) setDuplicateMatches([]);
            });
        return () => { cancelled = true; };
    }, [selectedReport?.id, selectedReport?.possible_duplicate_flag]);

    const handleMarkDuplicate = async (originalId: number) => {
        if (!selectedReport) return;
        setMarkingDuplicate(true);
        try {
            await api(`/reports/${selectedReport.id}/mark-duplicate`, {
                method: "POST",
                body: JSON.stringify({ duplicate_of_id: originalId }),
            });
            toast.success("Marked as duplicate. Report removed from the active queue.");
            setReports(prev => prev.filter(r => r.id !== selectedReport.id));
            setSelectedReport(null);
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to mark as duplicate.");
        } finally {
            setMarkingDuplicate(false);
        }
    };

    const fetchBrgyUsers = async () => {
        setUserLoading(true);
        try {
            const data = await api("/users");
            if (Array.isArray(data)) setBarangayUsers(data as BarangayUser[]);
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to load accounts");
        } finally {
            setUserLoading(false);
        }
    };

    const fetchPortalData = async () => {
        if (!user?.barangay_assignment) return;
        setLoading(true);
        try {
            await Promise.all([
                fetchReports(user.barangay_assignment),
                fetchCleaners(),
                fetchWorkOrders(),
                activeView === 'accounts' ? fetchBrgyUsers() : Promise.resolve()
            ]);
        } catch (err) {
            console.error("Failed to refresh portal data", err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCleaner = async () => {
        if (!createCleanerForm.full_name.trim() || !createCleanerForm.email.trim()) {
            toast.error("Name and email are required.");
            return;
        }
        setCreateCleanerPending(true);
        try {
            const data = await api("/users", {
                method: "POST",
                body: JSON.stringify({
                    full_name: createCleanerForm.full_name.trim(),
                    email: createCleanerForm.email.trim(),
                    phone_number: createCleanerForm.phone_number.trim() || null,
                    role: "cleaner",
                    barangay_assignment: user.barangay_assignment,
                }),
            });
            setCleanerTempPassword(data.temporary_password);
            setCleanerTempEmail(createCleanerForm.email.trim());
            setShowCreateCleanerModal(false);
            setCreateCleanerForm({ full_name: "", email: "", phone_number: "" });
            setShowCleanerPasswordModal(true);
            await fetchBrgyUsers();
            toast.success("Cleaner account created!");
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to create account");
        } finally {
            setCreateCleanerPending(false);
        }
    };

    const handleReactivateBrgyUser = async (userId: number) => {
        setReactivating(prev => new Set(prev).add(userId));
        try {
            await api(`/users/${userId}/reactivate`, { method: "PUT" });
            setBarangayUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: true } : u));
            toast.success("Account reactivated.");
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to reactivate");
        } finally {
            setReactivating(prev => { const s = new Set(prev); s.delete(userId); return s; });
        }
    };

    const handleDisableBrgyUser = async (userId: number) => {
        try {
            await api(`/users/${userId}/disable`, { method: "PUT" });
            setBarangayUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: false } : u));
            toast.success("Account disabled.");
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to disable");
        }
    };

    const openEditCleaner = (u: BarangayUser) => {
        setEditTarget(u);
        setEditForm({ full_name: u.full_name, email: u.email, phone_number: u.phone_number || "" });
        setUserActionsMenu(null);
        setShowEditCleanerModal(true);
    };

    const handleEditCleaner = async () => {
        if (!editTarget) return;
        setEditPending(true);
        try {
            await api(`/users/${editTarget.id}`, {
                method: "PUT",
                body: JSON.stringify({
                    full_name: editForm.full_name.trim() || undefined,
                    email: editForm.email.trim() || undefined,
                    phone_number: editForm.phone_number.trim() || undefined,
                }),
            });
            setBarangayUsers(prev => prev.map(u => u.id === editTarget.id
                ? { ...u, full_name: editForm.full_name.trim() || u.full_name, email: editForm.email.trim() || u.email, phone_number: editForm.phone_number.trim() || u.phone_number }
                : u
            ));
            setShowEditCleanerModal(false);
            setEditTarget(null);
            toast.success("Account updated.");
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to update");
        } finally {
            setEditPending(false);
        }
    };

    const openResetPasswordBrgy = (u: BarangayUser) => {
        setResetTarget(u);
        setResetCredential(null);
        setResetPasswordVisible(false);
        setUserActionsMenu(null);
        setShowResetPasswordModal(true);
    };

    const handleResetPasswordBrgy = async () => {
        if (!resetTarget) return;
        setResetPending(true);
        try {
            const data = await api(`/users/${resetTarget.id}/reset-password`, { method: "POST" });
            setResetCredential({ email: data.email, password: data.temporary_password });
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to reset password");
        } finally {
            setResetPending(false);
        }
    };

    const handleExportCleanersCSV = async () => {
        const headers: Record<string, string> = {};
        try {
            const raw = localStorage.getItem("ecowatch_user");
            if (raw) { const u = JSON.parse(raw); if (u?.id) headers["X-User-Id"] = String(u.id); }
        } catch { /* ignore */ }
        try {
            const res = await fetch(`${API_URL}/users/export`, { headers });
            if (!res.ok) throw new Error(`Export failed (${res.status})`);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `ecowatch_cleaners_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            toast.success("CSV downloaded.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Export failed");
        }
    };

    if (!user) return null;

    let displayReports = reports;
    if (reportStatus !== "all") {
        displayReports = displayReports.filter((r) => r.status === reportStatus);
    }
    displayReports = [...displayReports].sort((a, b) => {
        return reportSort === "newest" 
            ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const stats = {
        pending: reports.filter(r => r.status === 'pending' || r.status === 'verified').length,
        deployed: reports.filter(r => r.status === 'assigned' || r.status === 'in_progress' || r.status === 'failed_cleanup').length,
        resolved: reports.filter(r => r.status === 'resolved').length
    };

    const toUTCMs = (iso: string) => new Date(iso.endsWith("Z") || iso.includes("+") || iso.includes("-", 10) ? iso : iso + "Z").getTime();
    const recentReports = [...reports]
        .sort((a, b) => toUTCMs(b.created_at) - toUTCMs(a.created_at))
        .slice(0, 5);

    return (
        <PortalShell
            brand={{ name: "Barangay Ops", suffix: user.barangay_assignment }}
            role="BARANGAY"
            nav={BARANGAY_NAV}
            activeKey={activeView}
            onNavChange={(k) => {
                    setActiveView(k as BarangayView);
                    router.replace('?tab=' + k, { scroll: false });
                }}
            notificationCount={unreadCount}
        >
            <div className="max-w-[1600px] mx-auto h-full flex flex-col gap-5">

                {/* DASHBOARD VIEW */}
                {activeView === 'dashboard' && (
                    <div className="flex flex-col gap-6 flex-1 min-h-0 animate-slide-up pb-8 w-full shrink-0">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-4 flex-wrap shrink-0">
                            <div>
                                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                                    {user.barangay_assignment} <span className="text-primary">Dashboard</span>
                                </h1>
                                <p className="text-sm text-foreground/50 mt-1">Jurisdiction overview &middot; {new Date().toLocaleDateString()}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={fetchPortalData} disabled={loading} className="p-2 bg-muted/50 border border-border text-foreground rounded-lg hover:bg-muted transition-colors" title="Refresh data">
                                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                                </button>
                            </div>
                        </div>

                        {/* KPI Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
                            <KpiCard
                                label="Pending Reports"
                                value={stats.pending}
                                icon={<AlertTriangle size={22} />}
                                tone={stats.pending > 0 ? "yellow" : "emerald"}
                                loading={loading}
                            />
                            <KpiCard
                                label="Teams Deployed"
                                value={stats.deployed}
                                icon={<Hourglass size={22} />}
                                tone="blue"
                                loading={loading}
                            />
                            <KpiCard
                                label="Total Resolved"
                                value={stats.resolved}
                                icon={<CheckCircle2 size={22} />}
                                tone={stats.resolved > 0 ? "emerald" : "neutral"}
                                loading={loading}
                            />
                        </div>

                        {/* Recent Reports Container */}
                        <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col flex-1 min-h-[400px]">
                            <div className="p-6 pb-4 border-b border-border flex items-center justify-between">
                                <h2 className="text-base font-bold text-foreground">Recent Reports</h2>
                                <button
                                    onClick={() => setActiveView('reports')}
                                    className="text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                                >
                                    View All <ChevronRight size={14} />
                                </button>
                            </div>
                            <div className="p-6 pt-4 flex-1 overflow-auto">
                                {tableLoading ? (
                                    <div className="space-y-4">
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-foreground/5 animate-pulse">
                                                <div className="flex items-center gap-3 w-1/2">
                                                    <div className="w-24 h-4 bg-foreground/10 rounded-md"></div>
                                                    <div className="w-16 h-4 bg-foreground/10 rounded-md"></div>
                                                </div>
                                                <div className="w-12 h-4 bg-foreground/10 rounded-md"></div>
                                            </div>
                                        ))}
                                    </div>
                                ) : recentReports.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm py-10">
                                        <FileText className="mb-3 opacity-20" size={32} />
                                        No reports yet.
                                    </div>
                                ) : (
                                    <ul className="space-y-2">
                                        {recentReports.map(r => {
                                            const sla = slaInfo(r.created_at, r.status);
                                            return (
                                                <li key={r.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors border border-transparent hover:border-border cursor-pointer" onClick={() => {
                                                    setSelectedReport(r);
                                                    setCleanupPreview(null);
                                                    setCleanupImage(null);
                                                    setDeploymentNotes("");
                                                }}>
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <span className="font-mono text-sm font-bold text-foreground truncate">{r.tracking_id}</span>
                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                                            r.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                                                            r.status === 'assigned' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20' :
                                                            r.status === 'in_progress' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' :
                                                            r.status === 'verified' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20' :
                                                            r.status === 'pending' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                                                            r.status === 'failed_cleanup' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                                                            r.status === 'rejected' ? 'bg-muted text-muted-foreground border border-border' :
                                                            'bg-muted text-foreground border border-border'
                                                        }`}>{r.status.replace('_', ' ')}</span>
                                                    </div>
                                                    {sla && (
                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${SLA_PILL_CLASSES[sla.color]}`}>
                                                            {sla.days}d open
                                                        </span>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* MAP VIEW */}
                {activeView === 'map_view' && (
                    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden relative flex-1 min-h-[500px] animate-slide-up">
                        <div className="absolute top-6 left-6 z-[1000] bg-background/90 backdrop-blur-sm border border-border px-4 py-2 rounded-lg text-sm font-medium text-foreground shadow-sm pointer-events-none">
                            <span className="flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                </span>
                                {user.barangay_assignment}
                            </span>
                        </div>
                        <MapComponent
                            height="100%"
                            reports={reports}
                            heatmaps={[]}
                            focusedBarangay={user.barangay_assignment}
                            onBarangayClick={() => {}}
                        />
                    </div>
                )}

                {/* WORKORDERS TAB */}
                {activeView === 'workorders' && (() => {
                    const now = Date.now();
                    const windowMs = woKpiWindow === "week" ? now - 7 * 86400000 : woKpiWindow === "month" ? now - 30 * 86400000 : 0;
                    const activeStatuses = ["assigned", "in_progress", "needs_redo"];

                    const kpiActive = workOrders.filter(wo => ["assigned", "in_progress"].includes(wo.status)).length;
                    const kpiNeedsRedo = workOrders.filter(wo => wo.status === "needs_redo").length;
                    const kpiAtRisk = workOrders.filter(wo =>
                        activeStatuses.includes(wo.status) &&
                        wo.sla_deadline &&
                        new Date(wo.sla_deadline).getTime() > now &&
                        new Date(wo.sla_deadline).getTime() - now <= 86400000
                    ).length;
                    const kpiBreached = workOrders.filter(wo =>
                        activeStatuses.includes(wo.status) &&
                        wo.sla_deadline &&
                        new Date(wo.sla_deadline).getTime() < now
                    ).length;
                    const kpiResolved = workOrders.filter(wo =>
                        (wo.status === "verified" || wo.status === "completed") &&
                        (woKpiWindow === "all" || (wo.completed_at && new Date(wo.completed_at).getTime() >= windowMs))
                    ).length;

                    const STATUS_ORDER: Record<string, number> = { assigned: 0, in_progress: 1, needs_redo: 2, completed: 3, verified: 4 };
                    const activeCleaners = cleaners.filter((c: any) => c.role === "cleaner" && c.is_active);

                    const filtered = workOrders.filter(wo => {
                        const q = woSearch.toLowerCase();
                        const matchSearch = !q || wo.report_tracking_id?.toLowerCase().includes(q) || wo.assigned_cleaner_name?.toLowerCase().includes(q);
                        const matchStatus = woStatusFilter === "all" || wo.status === woStatusFilter;
                        const matchPriority = woPriorityFilter === "all" || wo.priority === woPriorityFilter;
                        const matchCleaner = !woCleanerFilter || wo.assigned_cleaner_id === woCleanerFilter;
                        const matchSlaRisk = !woSlaRiskOnly || (wo.sla_deadline && new Date(wo.sla_deadline).getTime() <= now + 86400000);
                        return matchSearch && matchStatus && matchPriority && matchCleaner && matchSlaRisk;
                    }).sort((a, b) => {
                        if (woSort === "oldest") {
                            return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
                        } else {
                            // newest
                            return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
                        }
                    });

                    const PRIORITY_PILL: Record<string, string> = {
                        high: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
                        medium: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20",
                        low: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
                    };
                    const STATUS_PILL: Record<string, string> = {
                        assigned: "bg-muted text-muted-foreground border border-border",
                        in_progress: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20",
                        needs_redo: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
                        completed: "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20",
                        verified: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
                    };
                    const STATUS_LABEL: Record<string, string> = {
                        assigned: "Assigned",
                        in_progress: "In Progress",
                        needs_redo: "Needs Redo",
                        completed: "Completed",
                        verified: "Verified",
                    };

                    const handleExportWorkordersCSV = () => {
                        if (filtered.length === 0) {
                            toast.error("No work orders to export");
                            return;
                        }
                        const headers = ["Tracking ID", "Cleaner", "Priority", "Status", "SLA Deadline", "Created At"];
                        const rows = filtered.map(wo => [
                            wo.report_tracking_id || "",
                            wo.assigned_cleaner_name || "",
                            wo.priority || "",
                            wo.status || "",
                            wo.sla_deadline ? new Date(wo.sla_deadline).toISOString() : "",
                            wo.created_at ? new Date(wo.created_at).toISOString() : ""
                        ]);
                        const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `ecowatch_workorders_${new Date().toISOString().slice(0, 10)}.csv`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                        toast.success("CSV downloaded.");
                    };

                    const paginatedWo = filtered.slice((woPage - 1) * WO_PAGE_SIZE, woPage * WO_PAGE_SIZE);
                    const woTotalPages = Math.ceil(filtered.length / WO_PAGE_SIZE) || 1;

                    return (
                        <div className="flex flex-col gap-6 flex-1 min-h-0 animate-slide-up pb-8 w-full shrink-0">
                            {/* Header */}
                            <div className="flex items-start justify-between gap-4 flex-wrap shrink-0">
                                <div>
                                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Work Orders</h1>
                                    <p className="text-sm text-foreground/50 mt-1">Manage and track work orders assigned to cleaners.</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={fetchWorkOrders}
                                        disabled={woLoading}
                                        className="px-4 py-2 bg-muted/50 border border-border text-foreground text-sm font-medium rounded-lg hover:bg-muted transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <RefreshCw size={14} className={woLoading ? "animate-spin" : ""} />
                                        Refresh
                                    </button>
                                    <button
                                        onClick={handleExportWorkordersCSV}
                                        className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                    >
                                        <FileDown size={14} />
                                        Export CSV
                                    </button>
                                </div>
                            </div>

                            {/* KPI Strip */}
                            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 shrink-0">
                                <KpiCard
                                    label="Active Work Orders"
                                    value={kpiActive}
                                    icon={<ClipboardList size={22} />}
                                    tone="blue"
                                    loading={woLoading}
                                />
                                <KpiCard
                                    label="Needs Redo"
                                    value={kpiNeedsRedo}
                                    icon={<AlertTriangle size={22} />}
                                    tone={kpiNeedsRedo > 0 ? "red" : "neutral"}
                                    loading={woLoading}
                                />
                                <KpiCard
                                    label="At Risk"
                                    value={kpiAtRisk}
                                    icon={<Hourglass size={22} />}
                                    tone={kpiAtRisk > 0 ? "yellow" : "neutral"}
                                    loading={woLoading}
                                />
                                <KpiCard
                                    label="Breached SLA"
                                    value={kpiBreached}
                                    icon={<AlertTriangle size={22} />}
                                    tone={kpiBreached > 0 ? "red" : "neutral"}
                                    loading={woLoading}
                                />
                                <KpiCard
                                    label={woKpiWindow === "week" ? "Resolved (7d)" : woKpiWindow === "month" ? "Resolved (30d)" : "Resolved (All)"}
                                    value={kpiResolved}
                                    icon={<CheckCircle2 size={22} />}
                                    tone={kpiResolved > 0 ? "emerald" : "neutral"}
                                    loading={woLoading}
                                />
                            </div>

                            {/* Toolbar */}
                            <div className="flex flex-wrap items-center gap-3 shrink-0">
                                <div className="relative flex-1 min-w-[200px] max-w-xs">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
                                    <input
                                        value={woSearch}
                                        onChange={e => setWoSearch(e.target.value)}
                                        placeholder="Search tracking ID or cleaner..."
                                        className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                    />
                                </div>

                                <select
                                    value={woStatusFilter}
                                    onChange={e => setWoStatusFilter(e.target.value)}
                                    className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="assigned">Assigned</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="needs_redo">Needs Redo</option>
                                    <option value="completed">Completed</option>
                                    <option value="verified">Verified</option>
                                </select>

                                <select
                                    value={woPriorityFilter}
                                    onChange={e => setWoPriorityFilter(e.target.value)}
                                    className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                >
                                    <option value="all">All Priorities</option>
                                    <option value="high">High</option>
                                    <option value="medium">Medium</option>
                                    <option value="low">Low</option>
                                </select>

                                <select
                                    value={woCleanerFilter ?? ""}
                                    onChange={e => setWoCleanerFilter(e.target.value ? Number(e.target.value) : null)}
                                    className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                >
                                    <option value="">All Cleaners</option>
                                    {activeCleaners.map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.full_name}</option>
                                    ))}
                                </select>

                                <div className="flex bg-muted/50 border border-border rounded-lg overflow-hidden">
                                    {(["week", "month", "all"] as const).map(w => (
                                        <button
                                            key={w}
                                            onClick={() => setWoKpiWindow(w)}
                                            className={`px-3 py-1.5 text-xs font-semibold transition-colors ${woKpiWindow === w ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                                        >
                                            {w === "week" ? "7d" : w === "month" ? "30d" : "All"}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={() => setWoSlaRiskOnly(!woSlaRiskOnly)}
                                    className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${woSlaRiskOnly ? "bg-destructive/10 border-destructive/20 text-destructive" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}
                                >
                                    SLA Risk Only
                                </button>

                                {(woStatusFilter !== "all" || woPriorityFilter !== "all" || woCleanerFilter || woSlaRiskOnly || woSearch || woSort !== "newest") && (
                                    <button
                                        onClick={() => { setWoStatusFilter("all"); setWoPriorityFilter("all"); setWoCleanerFilter(null); setWoSlaRiskOnly(false); setWoSearch(""); setWoSort("newest"); }}
                                        className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <RefreshCw size={12} /> Clear
                                    </button>
                                )}

                                <div className="flex-1" />

                                <select
                                    value={woSort}
                                    onChange={e => setWoSort(e.target.value as any)}
                                    className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                >
                                    <option value="newest">Sort: Newest First</option>
                                    <option value="oldest">Sort: Oldest First</option>
                                </select>

                                <div className="flex bg-muted/50 border border-border rounded-lg overflow-hidden">
                                    <button
                                        onClick={() => setWoViewMode("card")}
                                        title="Card view"
                                        className={`px-3 py-2 transition-colors ${woViewMode === "card" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                                    >
                                        <LayoutGrid size={15} />
                                    </button>
                                    <button
                                        onClick={() => setWoViewMode("table")}
                                        title="Table view"
                                        className={`px-3 py-2 transition-colors ${woViewMode === "table" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                                    >
                                        <List size={15} />
                                    </button>
                                </div>
                            </div>

                            {/* Main View Area */}
                            {woViewMode === "table" ? (
                                <div className="bg-card rounded-xl border border-border flex flex-col overflow-hidden animate-slide-up shadow-sm">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-border text-xs text-muted-foreground font-medium bg-muted/20">
                                                    <th className="p-4">Tracking ID</th>
                                                    <th className="p-4">Cleaner</th>
                                                    <th className="p-4">Priority</th>
                                                    <th className="p-4">Status</th>
                                                    <th className="p-4">SLA Deadline</th>
                                                    <th className="p-4">
                                                        <div className="inline-flex items-center gap-1">
                                                            <span>Time Left</span>
                                                            <span
                                                                ref={slaTooltipAnchorRef}
                                                                onMouseEnter={() => {
                                                                    const rect = slaTooltipAnchorRef.current?.getBoundingClientRect();
                                                                    if (rect) setSlaTooltipPos({ top: rect.bottom + 8, left: Math.max(8, rect.left - 240) });
                                                                    setShowSlaTooltip(true);
                                                                }}
                                                                onMouseLeave={() => setShowSlaTooltip(false)}
                                                                className="cursor-help text-foreground/30 hover:text-primary transition-colors text-sm select-none"
                                                            >ⓘ</span>
                                                        </div>
                                                    </th>
                                                    <th className="p-4">Created</th>
                                                    <th className="p-4 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {woLoading ? (
                                                    Array.from({ length: 5 }).map((_, i) => (
                                                        <tr key={i} className="border-b border-border">
                                                            {Array.from({ length: 8 }).map((__, j) => (
                                                                <td key={j} className="p-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                                                            ))}
                                                        </tr>
                                                    ))
                                                ) : paginatedWo.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={8} className="p-12 text-center text-muted-foreground font-medium">No work orders match the current filters.</td>
                                                    </tr>
                                                ) : (
                                                    paginatedWo.map(wo => {
                                                        const slaColor = slaDeadlineColor(wo.sla_deadline);
                                                        const slaLabel = slaDeadlineLabel(wo.sla_deadline);
                                                        return (
                                                            <tr key={wo.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                                                                <td className="p-4 font-mono text-sm font-medium text-foreground">{wo.report_tracking_id}</td>
                                                                <td className="p-4 text-sm text-muted-foreground">{wo.assigned_cleaner_name}</td>
                                                                <td className="p-4">
                                                                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${PRIORITY_PILL[wo.priority] || "bg-muted text-foreground border border-border"}`}>
                                                                        {wo.priority}
                                                                    </span>
                                                                </td>
                                                                <td className="p-4">
                                                                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${STATUS_PILL[wo.status] || "bg-muted text-foreground border border-border"}`}>
                                                                        {STATUS_LABEL[wo.status] || wo.status}
                                                                    </span>
                                                                </td>
                                                                <td className="p-4 text-sm text-muted-foreground">
                                                                    {wo.sla_deadline ? formatDate(wo.sla_deadline) : "—"}
                                                                </td>
                                                                <td className="p-4">
                                                                    {wo.sla_deadline ? (
                                                                        <span className={`px-2 py-1 rounded-md text-[11px] font-bold ${SLA_PILL_CLASSES[slaColor]}`}>
                                                                            {slaLabel}
                                                                        </span>
                                                                    ) : <span className="text-muted-foreground text-sm">—</span>}
                                                                </td>
                                                                <td className="p-4 text-sm text-muted-foreground">
                                                                    {wo.created_at ? formatDate(wo.created_at) : "—"}
                                                                </td>
                                                                <td className="p-4 text-right">
                                                                    <button
                                                                        onClick={() => { setSelectedWorkOrder(wo); setNewWoPriority(wo.priority); }}
                                                                        className="px-3 py-1.5 bg-background border border-border text-foreground text-xs font-medium rounded-lg hover:bg-muted transition-colors"
                                                                    >
                                                                        Manage
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-slide-up">
                                    {woLoading ? (
                                        Array.from({ length: 8 }).map((_, i) => (
                                            <div key={i} className="h-40 bg-card rounded-xl border border-border animate-pulse" />
                                        ))
                                    ) : paginatedWo.length === 0 ? (
                                        <div className="col-span-full py-12 text-center text-muted-foreground font-medium">No work orders match the current filters.</div>
                                    ) : (
                                        paginatedWo.map(wo => {
                                            const slaColor = slaDeadlineColor(wo.sla_deadline);
                                            const slaLabel = slaDeadlineLabel(wo.sla_deadline);
                                            return (
                                                <div key={wo.id} onClick={() => { setSelectedWorkOrder(wo); setNewWoPriority(wo.priority); }} className="bg-card rounded-xl border border-border p-4 hover:shadow-md hover:border-primary/50 transition-all cursor-pointer flex flex-col gap-3">
                                                    <div className="flex items-center justify-between">
                                                        <div className="font-mono text-sm font-bold text-foreground">{wo.report_tracking_id}</div>
                                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${STATUS_PILL[wo.status] || "bg-muted text-foreground"}`}>
                                                            {STATUS_LABEL[wo.status] || wo.status}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm font-medium text-foreground">{wo.assigned_cleaner_name || "Unassigned"}</div>
                                                    <div className="flex justify-between items-center text-xs text-muted-foreground mt-auto">
                                                        <span>Priority: <span className="font-bold text-foreground capitalize">{wo.priority}</span></span>
                                                        {wo.sla_deadline ? (
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${SLA_PILL_CLASSES[slaColor]}`}>{slaLabel}</span>
                                                        ) : <span>—</span>}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}

                            {/* Pagination Controls */}
                            {woTotalPages > 1 && (
                                <div className="flex items-center justify-between bg-card p-4 rounded-xl border border-border shadow-sm shrink-0 mt-auto">
                                    <span className="text-xs text-muted-foreground font-medium">
                                        Page {woPage} of {woTotalPages} ({filtered.length} total)
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button disabled={woPage === 1} onClick={() => setWoPage(p => p - 1)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted disabled:opacity-50 transition-colors text-foreground">Previous</button>
                                        <button disabled={woPage === woTotalPages} onClick={() => setWoPage(p => p + 1)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted disabled:opacity-50 transition-colors text-foreground">Next</button>
                                    </div>
                                </div>
                            )}
                            {/* SLA Tooltip — fixed so it escapes overflow containers */}
                            {showSlaTooltip && (
                                <div
                                    style={{ position: "fixed", top: slaTooltipPos.top, left: slaTooltipPos.left }}
                                    className="z-[200] w-72 p-4 bg-background border border-border rounded-2xl shadow-2xl pointer-events-none"
                                >
                                    <p className="text-xs font-bold text-foreground mb-3 uppercase tracking-widest">SLA Deadline Guide</p>
                                    <div className="flex flex-col gap-2 text-xs mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                                            <span className="text-foreground/60"><span className="text-green-400 font-bold">Not an issue</span> — 3+ days remaining</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 shrink-0" />
                                            <span className="text-foreground/60"><span className="text-yellow-400 font-bold">Moderate</span> — 1 to 3 days remaining</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                                            <span className="text-foreground/60"><span className="text-red-400 font-bold">Critical</span> — under 24 hours remaining</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-red-600 ring-2 ring-red-500/40 shrink-0" />
                                            <span className="text-foreground/60"><span className="text-red-500 font-bold">Breached</span> — deadline already passed</span>
                                        </div>
                                    </div>
                                    <div className="border-t border-border pt-3">
                                        <p className="text-[11px] font-bold text-foreground/40 uppercase tracking-widest mb-2">Priority → Deadline</p>
                                        <div className="flex flex-col gap-1 text-xs">
                                            <div className="flex justify-between"><span className="text-red-400 font-bold">High</span><span className="text-foreground/60">{slaPolicy.high} day{slaPolicy.high !== 1 ? "s" : ""} from deploy</span></div>
                                            <div className="flex justify-between"><span className="text-yellow-400 font-bold">Medium</span><span className="text-foreground/60">{slaPolicy.medium} days from deploy</span></div>
                                            <div className="flex justify-between"><span className="text-blue-400 font-bold">Low</span><span className="text-foreground/60">{slaPolicy.low} days from deploy</span></div>
                                        </div>
                                        <p className="text-[10px] text-foreground/30 mt-2">Deadlines are configurable by CENRO.</p>
                                    </div>
                                </div>
                            )}

                            {/* Detail Drawer */}
                            {selectedWorkOrder && createPortal(
                                <div className="fixed inset-0 z-50" onClick={() => { setSelectedWorkOrder(null); setShowReassignModal(false); setShowPriorityModal(false); setShowForceResolveModal(false); }}>
                                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                                    <div
                                        className="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-background border-l border-border overflow-y-auto shadow-2xl"
                                        onClick={e => e.stopPropagation()}
                                    >
                                        {/* Drawer Header */}
                                        <div className="sticky top-0 bg-background border-b border-border p-5 flex items-start justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-mono font-black text-lg text-foreground">{selectedWorkOrder.report_tracking_id}</span>
                                                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${STATUS_PILL[selectedWorkOrder.status] || "bg-foreground/10 text-foreground"}`}>
                                                        {STATUS_LABEL[selectedWorkOrder.status] || selectedWorkOrder.status}
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${PRIORITY_PILL[selectedWorkOrder.priority] || "bg-foreground/10 text-foreground"}`}>
                                                        {selectedWorkOrder.priority}
                                                    </span>
                                                </div>
                                                {selectedWorkOrder.sla_deadline && (
                                                    <span className={`text-xs font-bold ${SLA_PILL_CLASSES[slaDeadlineColor(selectedWorkOrder.sla_deadline)]}`}>
                                                        SLA: {slaDeadlineLabel(selectedWorkOrder.sla_deadline)}
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => { setSelectedWorkOrder(null); setShowReassignModal(false); setShowPriorityModal(false); setShowForceResolveModal(false); }}
                                                className="p-2 rounded-lg glass border border-border text-foreground/50 hover:text-foreground transition-colors text-xs font-bold"
                                            >
                                                ✕
                                            </button>
                                        </div>

                                        <div className="p-5 flex flex-col gap-5">
                                            {/* Report Context */}
                                            <div className="glass rounded-xl p-4">
                                                <p className="text-xs font-bold text-foreground/50 uppercase tracking-widest mb-3">Report Context</p>
                                                {selectedWorkOrder.report_image_url && (
                                                    <img
                                                        src={`${API_URL}${selectedWorkOrder.report_image_url}`}
                                                        alt="Citizen report"
                                                        className="w-full h-40 object-cover rounded-lg mb-3"
                                                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                                                    />
                                                )}
                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                    <div><span className="text-foreground/40 text-xs">Barangay</span><p className="text-foreground font-medium">{selectedWorkOrder.report_barangay}</p></div>
                                                    <div><span className="text-foreground/40 text-xs">GPS</span><p className="text-foreground font-mono text-xs">{selectedWorkOrder.report_lat?.toFixed(5)}, {selectedWorkOrder.report_lon?.toFixed(5)}</p></div>
                                                </div>
                                                {selectedWorkOrder.report_notes && (
                                                    <p className="text-foreground/70 text-sm mt-2 italic">&ldquo;{selectedWorkOrder.report_notes}&rdquo;</p>
                                                )}
                                            </div>

                                            {/* Before / After Photos */}
                                            {selectedWorkOrder.report_cleanup_image_url && (
                                                <div className="glass rounded-xl p-4">
                                                    <p className="text-xs font-bold text-foreground/50 uppercase tracking-widest mb-3">Cleanup Proof</p>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <p className="text-[11px] text-foreground/40 mb-1 font-bold">BEFORE</p>
                                                            {selectedWorkOrder.report_image_url ? (
                                                                <img src={`${API_URL}${selectedWorkOrder.report_image_url}`} alt="Before" className="w-full h-28 object-cover rounded-lg" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                                            ) : <div className="w-full h-28 rounded-lg bg-foreground/5 flex items-center justify-center text-foreground/20 text-xs">No photo</div>}
                                                        </div>
                                                        <div>
                                                            <p className="text-[11px] text-foreground/40 mb-1 font-bold">AFTER</p>
                                                            <img src={`${API_URL}${selectedWorkOrder.report_cleanup_image_url}`} alt="After cleanup" className="w-full h-28 object-cover rounded-lg" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Assignment Timeline */}
                                            <div className="glass rounded-xl p-4">
                                                <p className="text-xs font-bold text-foreground/50 uppercase tracking-widest mb-3">Assignment</p>
                                                <div className="flex flex-col gap-2 text-sm">
                                                    <div className="flex justify-between"><span className="text-foreground/40">Cleaner</span><span className="text-foreground font-medium">{selectedWorkOrder.assigned_cleaner_name}</span></div>
                                                    <div className="flex justify-between"><span className="text-foreground/40">Email</span><span className="text-foreground/70 text-xs">{selectedWorkOrder.assigned_cleaner_email}</span></div>
                                                    <div className="flex justify-between"><span className="text-foreground/40">Created</span><span className="text-foreground/70">{selectedWorkOrder.created_at ? formatDateTime(selectedWorkOrder.created_at) : "—"}</span></div>
                                                    <div className="flex justify-between"><span className="text-foreground/40">Started</span><span className="text-foreground/70">{selectedWorkOrder.started_at ? formatDateTime(selectedWorkOrder.started_at) : "Not started"}</span></div>
                                                    <div className="flex justify-between"><span className="text-foreground/40">Completed</span><span className="text-foreground/70">{selectedWorkOrder.completed_at ? formatDateTime(selectedWorkOrder.completed_at) : "—"}</span></div>
                                                </div>
                                            </div>

                                            {/* Notes */}
                                            {selectedWorkOrder.notes && (
                                                <div className="glass rounded-xl p-4">
                                                    <p className="text-xs font-bold text-foreground/50 uppercase tracking-widest mb-2">Notes</p>
                                                    <p className="text-foreground/70 text-sm whitespace-pre-wrap">{selectedWorkOrder.notes}</p>
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="flex flex-col gap-3">
                                                <p className="text-xs font-bold text-foreground/50 uppercase tracking-widest">Actions</p>

                                                {/* Reassign — only when assigned */}
                                                {selectedWorkOrder.status === "assigned" && (
                                                    <div className="glass rounded-xl p-4">
                                                        <p className="text-sm font-bold text-foreground mb-2">Reassign Cleaner</p>
                                                        <select
                                                            value={reassignCleaner ?? ""}
                                                            onChange={e => setReassignCleaner(e.target.value ? Number(e.target.value) : null)}
                                                            className="w-full glass border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:border-primary/50 mb-3"
                                                        >
                                                            <option value="">Select cleaner…</option>
                                                            {activeCleaners.filter((c: any) => c.id !== selectedWorkOrder.assigned_cleaner_id).map((c: any) => (
                                                                <option key={c.id} value={c.id}>{c.full_name}</option>
                                                            ))}
                                                        </select>
                                                        <button
                                                            onClick={handleWoReassign}
                                                            disabled={!reassignCleaner || woActionLoading}
                                                            className="w-full py-2 eco-gradient text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                                                        >
                                                            {woActionLoading ? "Saving…" : "Confirm Reassign"}
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Change Priority */}
                                                {["assigned", "in_progress", "needs_redo"].includes(selectedWorkOrder.status) && (
                                                    <div className="glass rounded-xl p-4">
                                                        <p className="text-sm font-bold text-foreground mb-2">Change Priority</p>
                                                        <div className="flex gap-2 mb-3">
                                                            {["high", "medium", "low"].map(p => (
                                                                <button
                                                                    key={p}
                                                                    onClick={() => setNewWoPriority(p)}
                                                                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${newWoPriority === p ? (PRIORITY_PILL[p] + " border-current") : "glass border-border text-foreground/50"}`}
                                                                >
                                                                    {p.charAt(0).toUpperCase() + p.slice(1)}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <p className="text-[11px] text-foreground/40 mb-3">
                                                            SLA will be recomputed: {newWoPriority === "high" ? `${slaPolicy.high}d` : newWoPriority === "medium" ? `${slaPolicy.medium}d` : `${slaPolicy.low}d`} from original creation date.
                                                        </p>
                                                        <button
                                                            onClick={handleWoPriority}
                                                            disabled={newWoPriority === selectedWorkOrder.priority || woActionLoading}
                                                            className="w-full py-2 eco-gradient text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                                                        >
                                                            {woActionLoading ? "Saving…" : "Update Priority"}
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Force Resolve — only on needs_redo */}
                                                {selectedWorkOrder.status === "needs_redo" && (
                                                    <div className="glass rounded-xl p-4 border border-red-500/20">
                                                        <p className="text-sm font-bold text-red-400 mb-1">Force Resolve</p>
                                                        <p className="text-[11px] text-foreground/40 mb-3">Bypasses AI re-verification. Use only when cleanup is confirmed by other means.</p>
                                                        {!showForceResolveModal ? (
                                                            <button
                                                                onClick={() => setShowForceResolveModal(true)}
                                                                className="w-full py-2 bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold rounded-lg hover:bg-red-500/30 transition-colors"
                                                            >
                                                                Force Resolve…
                                                            </button>
                                                        ) : (
                                                            <div className="flex flex-col gap-2">
                                                                <textarea
                                                                    value={forceResolveReason}
                                                                    onChange={e => setForceResolveReason(e.target.value)}
                                                                    placeholder="Reason for bypassing AI verification (min. 10 characters)…"
                                                                    rows={3}
                                                                    className="w-full glass border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-transparent resize-none focus:outline-none focus:border-red-500/50 placeholder:text-foreground/30"
                                                                />
                                                                <p className="text-[11px] text-foreground/30">{forceResolveReason.trim().length}/10 min chars</p>
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => { setShowForceResolveModal(false); setForceResolveReason(""); }}
                                                                        className="flex-1 py-2 glass border border-border text-foreground/50 text-xs font-bold rounded-lg hover:bg-foreground/10 transition-colors"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                    <button
                                                                        onClick={handleForceResolve}
                                                                        disabled={forceResolveReason.trim().length < 10 || woActionLoading}
                                                                        className="flex-1 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                                                                    >
                                                                        {woActionLoading ? "Resolving…" : "Confirm"}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            , document.body)}
                        </div>
                    );
                })()}

                {/* ACCOUNTS TAB */}
                {activeView === 'accounts' && (() => {
                    const getInitials = (name: string) => name.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase();
                    const fmtLogin = (dt: string | null) => {
                        if (!dt) return "Never";
                        return formatRelative(dt);
                    };
                    const filtered = barangayUsers.filter(u => {
                        const q = debouncedUserSearch.toLowerCase();
                        const matchSearch = !q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
                        const matchStatus = userStatusFilter === "all" || (userStatusFilter === "active" ? u.is_active : !u.is_active);
                        return matchSearch && matchStatus;
                    });
                    const totalPages = Math.max(1, Math.ceil(filtered.length / USER_PAGE_SIZE));
                    const paged = filtered.slice((userPage - 1) * USER_PAGE_SIZE, userPage * USER_PAGE_SIZE);

                    const kpiTotal = barangayUsers.length;
                    const kpiActive = barangayUsers.filter(u => u.is_active).length;
                    const kpiDisabled = barangayUsers.filter(u => !u.is_active).length;

                    return (
                        <div className="flex flex-col gap-6 flex-1 min-h-0 animate-slide-up pb-8 w-full shrink-0" onClick={() => userActionsMenu !== null && setUserActionsMenu(null)}>
                            {/* Header */}
                            <div className="flex items-start justify-between gap-4 flex-wrap shrink-0">
                                <div>
                                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Cleaner Accounts</h1>
                                    <p className="text-sm text-foreground/50 mt-1">Manage accounts for your barangay's cleanup team.</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={(e) => { e.stopPropagation(); setShowCreateCleanerModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-sm">
                                        <Plus size={14} /> Create Cleaner
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleExportCleanersCSV(); }} className="flex items-center gap-2 px-4 py-2 bg-muted/50 border border-border text-foreground text-sm font-medium rounded-lg hover:bg-muted transition-colors">
                                        <FileDown size={14} /> Export CSV
                                    </button>
                                </div>
                            </div>

                            {/* KPI Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
                                <KpiCard
                                    label="Total Cleaners"
                                    value={kpiTotal}
                                    icon={<BookUser size={22} />}
                                    tone="blue"
                                    loading={userLoading}
                                />
                                <KpiCard
                                    label="Active Accounts"
                                    value={kpiActive}
                                    icon={<UserCheck size={22} />}
                                    tone="emerald"
                                    loading={userLoading}
                                />
                                <KpiCard
                                    label="Disabled Accounts"
                                    value={kpiDisabled}
                                    icon={<UserX size={22} />}
                                    tone="red"
                                    loading={userLoading}
                                />
                            </div>

                            {/* Toolbar */}
                            <div className="flex flex-wrap items-center gap-3 shrink-0">
                                <div className="relative flex-1 min-w-[200px] max-w-xs">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" size={14} />
                                    <input type="text" value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search name or email..." className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary" />
                                </div>
                                <select value={userStatusFilter} onChange={e => setUserStatusFilter(e.target.value)} className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary">
                                    <option value="all">All Statuses</option>
                                    <option value="active">Active</option>
                                    <option value="disabled">Disabled</option>
                                </select>
                                {(userStatusFilter !== "all" || userSearch) && (
                                    <button
                                        onClick={() => { setUserStatusFilter("all"); setUserSearch(""); }}
                                        className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <RefreshCw size={12} /> Clear
                                    </button>
                                )}
                                <div className="flex-1" />
                                <div className="flex bg-muted/50 border border-border rounded-lg overflow-hidden">
                                    <button
                                        onClick={() => setUserViewMode("card")}
                                        title="Card view"
                                        className={`px-3 py-2 transition-colors ${userViewMode === "card" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                                    >
                                        <LayoutGrid size={15} />
                                    </button>
                                    <button
                                        onClick={() => setUserViewMode("table")}
                                        title="Table view"
                                        className={`px-3 py-2 transition-colors ${userViewMode === "table" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                                    >
                                        <List size={15} />
                                    </button>
                                </div>
                            </div>

                            {/* Main View Area */}
                            {userViewMode === "table" ? (
                                <div className="bg-card rounded-xl border border-border flex flex-col animate-slide-up shadow-sm overflow-hidden md:overflow-visible">
                                    <div className="overflow-x-auto md:overflow-visible">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-border text-xs text-muted-foreground font-medium bg-muted/20">
                                                    <th className="px-5 py-3">Full Name</th>
                                                    <th className="px-5 py-3">Email</th>
                                                    <th className="px-5 py-3">Phone</th>
                                                    <th className="px-5 py-3">Status</th>
                                                    <th className="px-5 py-3">Last Login</th>
                                                    <th className="px-5 py-3 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {userLoading ? (
                                                    Array.from({ length: 5 }).map((_, i) => (
                                                        <tr key={i} className="border-b border-border">
                                                            {Array.from({ length: 6 }).map((__, j) => (
                                                                <td key={j} className="p-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                                                            ))}
                                                        </tr>
                                                    ))
                                                ) : paged.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} className="p-12 text-center text-muted-foreground font-medium">No cleaners found.</td>
                                                    </tr>
                                                ) : (
                                                    paged.map(u => (
                                                        <tr key={u.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                                                            <td className="px-5 py-3">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-[11px] font-bold text-blue-300 shrink-0">
                                                                        {getInitials(u.full_name)}
                                                                    </div>
                                                                    <span className="text-sm font-semibold text-foreground">{u.full_name}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-3 text-sm text-muted-foreground font-mono">{u.email}</td>
                                                            <td className="px-5 py-3 text-sm text-muted-foreground">{u.phone_number ?? <span className="text-foreground/30">--</span>}</td>
                                                            <td className="px-5 py-3">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className={"w-1.5 h-1.5 rounded-full shrink-0 " + (u.is_active ? "bg-emerald-400" : "bg-red-400")} />
                                                                    <span className={"px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider " + (u.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400")}>
                                                                        {u.is_active ? "Active" : "Disabled"}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-3 text-sm text-muted-foreground">{fmtLogin(u.last_login_at)}</td>
                                                            <td className="px-5 py-3 text-right">
                                                                <div className="relative inline-block" onClick={e => e.stopPropagation()}>
                                                                    <button onClick={() => setUserActionsMenu(userActionsMenu === u.id ? null : u.id)} className="p-2 rounded-lg hover:bg-foreground/10 text-foreground/50 hover:text-foreground transition-colors">
                                                                        <MoreVertical size={16} />
                                                                    </button>
                                                                    {userActionsMenu === u.id && (
                                                                        <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-xl shadow-sm z-50 overflow-hidden">
                                                                            <button onClick={() => openEditCleaner(u)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors text-left">
                                                                                <Edit2 size={14} className="text-muted-foreground" /> Edit Account
                                                                            </button>
                                                                            <button onClick={() => openResetPasswordBrgy(u)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors text-left">
                                                                                <Key size={14} className="text-muted-foreground" /> Reset Password
                                                                            </button>
                                                                            <div className="border-t border-border" />
                                                                            {u.is_active ? (
                                                                                <button onClick={() => { setUserActionsMenu(null); handleDisableBrgyUser(u.id); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors text-left">
                                                                                    <UserX size={14} /> Disable Account
                                                                                </button>
                                                                            ) : (
                                                                                <button onClick={() => { setUserActionsMenu(null); handleReactivateBrgyUser(u.id); }} disabled={reactivating.has(u.id)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-emerald-500 hover:bg-emerald-500/10 transition-colors text-left disabled:opacity-50">
                                                                                    <UserCheck size={14} /> {reactivating.has(u.id) ? "Reactivating..." : "Reactivate"}
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-slide-up">
                                    {userLoading ? (
                                        Array.from({ length: 8 }).map((_, i) => (
                                            <div key={i} className="h-40 bg-card rounded-xl border border-border animate-pulse" />
                                        ))
                                    ) : paged.length === 0 ? (
                                        <div className="col-span-full py-12 text-center text-muted-foreground font-medium">No cleaners found.</div>
                                    ) : (
                                        paged.map(u => (
                                            <div key={u.id} className="bg-card rounded-xl border border-border p-4 flex flex-col gap-3 hover:shadow-md hover:border-primary/50 transition-all">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-sm font-bold text-blue-300 shrink-0">
                                                            {getInitials(u.full_name)}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-semibold text-foreground">{u.full_name}</div>
                                                            <div className="text-xs text-muted-foreground">{u.phone_number ?? "No phone"}</div>
                                                        </div>
                                                    </div>
                                                    <div className="relative" onClick={e => e.stopPropagation()}>
                                                        <button onClick={() => setUserActionsMenu(userActionsMenu === u.id ? null : u.id)} className="p-1 rounded-md hover:bg-foreground/10 text-foreground/50 hover:text-foreground transition-colors">
                                                            <MoreVertical size={16} />
                                                        </button>
                                                        {userActionsMenu === u.id && (
                                                            <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-xl shadow-sm z-50 overflow-hidden">
                                                                <button onClick={() => openEditCleaner(u)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors text-left">
                                                                    <Edit2 size={14} className="text-muted-foreground" /> Edit Account
                                                                </button>
                                                                <button onClick={() => openResetPasswordBrgy(u)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors text-left">
                                                                    <Key size={14} className="text-muted-foreground" /> Reset Password
                                                                </button>
                                                                <div className="border-t border-border" />
                                                                {u.is_active ? (
                                                                    <button onClick={() => { setUserActionsMenu(null); handleDisableBrgyUser(u.id); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors text-left">
                                                                        <UserX size={14} /> Disable Account
                                                                    </button>
                                                                ) : (
                                                                    <button onClick={() => { setUserActionsMenu(null); handleReactivateBrgyUser(u.id); }} disabled={reactivating.has(u.id)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-emerald-500 hover:bg-emerald-500/10 transition-colors text-left disabled:opacity-50">
                                                                        <UserCheck size={14} /> {reactivating.has(u.id) ? "Reactivating..." : "Reactivate"}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-xs text-muted-foreground font-mono break-all mt-1">{u.email}</div>
                                                <div className="mt-auto flex items-center justify-between pt-3 border-t border-border">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={"w-1.5 h-1.5 rounded-full shrink-0 " + (u.is_active ? "bg-emerald-400" : "bg-red-400")} />
                                                        <span className={"text-[10px] font-bold uppercase tracking-wider " + (u.is_active ? "text-emerald-500" : "text-red-500")}>
                                                            {u.is_active ? "Active" : "Disabled"}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">{fmtLogin(u.last_login_at)}</div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between bg-card p-4 rounded-xl border border-border shadow-sm shrink-0 mt-auto">
                                    <span className="text-xs text-muted-foreground font-medium">
                                        Page {userPage} of {totalPages} ({filtered.length} total)
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button disabled={userPage === 1} onClick={() => setUserPage(p => p - 1)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted disabled:opacity-50 transition-colors text-foreground">Previous</button>
                                        <button disabled={userPage === totalPages} onClick={() => setUserPage(p => p + 1)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted disabled:opacity-50 transition-colors text-foreground">Next</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* REPORTS VIEW */}
                {activeView === 'reports' && (() => {
                    const STATUS_OPTIONS = [
                        { value: "all", label: "All Statuses" },
                        { value: "pending", label: "Pending" },
                        { value: "verified", label: "Verified" },
                        { value: "assigned", label: "Assigned" },
                        { value: "in_progress", label: "In Progress" },
                        { value: "resolved", label: "Resolved" },
                        { value: "failed_cleanup", label: "Failed Cleanup" },
                        { value: "rejected", label: "Rejected" },
                    ];
                    const paginatedReports = displayReports.slice((reportPage - 1) * REPORT_PAGE_SIZE, reportPage * REPORT_PAGE_SIZE);
                    const reportTotalPages = Math.ceil(displayReports.length / REPORT_PAGE_SIZE) || 1;
                    return (
                        <div className="flex flex-col gap-6 flex-1 min-h-0 animate-slide-up pb-8 w-full shrink-0">
                            {/* Header */}
                            <div className="flex items-start justify-between gap-4 flex-wrap shrink-0">
                                <div>
                                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Reports</h1>
                                    <p className="text-sm text-foreground/50 mt-1">Manage and track reports in your jurisdiction.</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => fetchReports(user?.barangay_assignment || '')}
                                        disabled={loading}
                                        className="px-4 py-2 bg-muted/50 border border-border text-foreground text-sm font-medium rounded-lg hover:bg-muted transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                                        Refresh
                                    </button>
                                    <button
                                        onClick={handleExport}
                                        className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                    >
                                        <FileDown size={14} />
                                        Export CSV
                                    </button>
                                </div>
                            </div>

                            {/* KPI Strip */}
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 shrink-0">
                                <KpiCard
                                    label="Total Reports"
                                    value={reports.length}
                                    icon={<ListChecks size={22} />}
                                    tone="blue"
                                    loading={tableLoading}
                                />
                                <KpiCard
                                    label="Pending Review"
                                    value={stats.pending}
                                    icon={<AlertTriangle size={22} />}
                                    tone={stats.pending > 0 ? "yellow" : "emerald"}
                                    loading={tableLoading}
                                />
                                <KpiCard
                                    label="Teams Deployed"
                                    value={stats.deployed}
                                    icon={<Hourglass size={22} />}
                                    tone="neutral"
                                    loading={tableLoading}
                                />
                                <KpiCard
                                    label="Total Resolved"
                                    value={stats.resolved}
                                    icon={<CheckCircle2 size={22} />}
                                    tone={stats.resolved > 0 ? "emerald" : "neutral"}
                                    loading={tableLoading}
                                />
                            </div>

                            {/* Toolbar */}
                            <div className="flex flex-wrap items-center gap-3 shrink-0">
                                <div className="relative flex-1 min-w-[200px] max-w-xs">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
                                    <input
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        placeholder="Search tracking ID or notes..."
                                        className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                    />
                                </div>

                                <select
                                    value={reportStatus}
                                    onChange={(e) => setReportStatus(e.target.value)}
                                    className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                >
                                    {STATUS_OPTIONS.map((s) => (
                                        <option key={s.value} value={s.value}>{s.label}</option>
                                    ))}
                                </select>

                                <DateRangePicker 
                                    date={dateRange} 
                                    onDateChange={setDateRange} 
                                />

                                <div className="flex-1" />

                                <select
                                    value={reportSort}
                                    onChange={e => setReportSort(e.target.value as any)}
                                    className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                >
                                    <option value="newest">Sort: Newest First</option>
                                    <option value="oldest">Sort: Oldest First</option>
                                </select>

                                <div className="flex bg-muted/50 border border-border rounded-lg overflow-hidden">
                                    <button
                                        onClick={() => setReportViewMode("card")}
                                        title="Card view"
                                        className={`px-3 py-2 transition-colors ${reportViewMode === "card" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                                    >
                                        <LayoutGrid size={15} />
                                    </button>
                                    <button
                                        onClick={() => setReportViewMode("table")}
                                        title="Table view"
                                        className={`px-3 py-2 transition-colors ${reportViewMode === "table" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                                    >
                                        <List size={15} />
                                    </button>
                                </div>
                            </div>

                            {/* Main View Area */}
                            {reportViewMode === "table" ? (
                                <div className="bg-card rounded-xl border border-border flex flex-col overflow-hidden animate-slide-up shadow-sm">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-border text-xs text-muted-foreground font-medium bg-muted/20">
                                                    <th className="p-4">Tracking ID</th>
                                                    <th className="p-4">Date</th>
                                                    <th className="p-4">Status</th>
                                                    <th className="p-4">Open</th>
                                                    <th className="p-4">AI Score</th>
                                                    <th className="p-4 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tableLoading ? (
                                                    Array.from({ length: 5 }).map((_, i) => (
                                                        <tr key={i} className="border-b border-border">
                                                            {Array.from({ length: 6 }).map((__, j) => (
                                                                <td key={j} className="p-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                                                            ))}
                                                        </tr>
                                                    ))
                                                ) : paginatedReports.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} className="p-12 text-center text-muted-foreground font-medium">No reports match the current filters.</td>
                                                    </tr>
                                                ) : (
                                                    paginatedReports.map(report => {
                                                        const sla = slaInfo(report.created_at, report.status);
                                                        return (
                                                            <tr 
                                                                key={report.id} 
                                                                className="border-b border-border hover:bg-muted/50 transition-colors cursor-pointer"
                                                                onClick={() => {
                                                                    setSelectedReport(report);
                                                                    setCleanupPreview(null);
                                                                    setCleanupImage(null);
                                                                    setDeploymentNotes("");
                                                                }}
                                                            >
                                                                <td className="p-4 font-mono text-sm font-medium text-foreground">
                                                                    {report.tracking_id}
                                                                    {report.possible_duplicate_flag && report.status !== 'duplicate' && (
                                                                        <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-tight bg-amber-500/20 text-amber-500 align-middle">⚠ DUP?</span>
                                                                    )}
                                                                </td>
                                                                <td className="p-4 text-sm text-muted-foreground">{formatDate(report.created_at)}</td>
                                                                <td className="p-4">
                                                                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                                                                        report.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                                                                        report.status === 'assigned' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20' :
                                                                        report.status === 'in_progress' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' :
                                                                        report.status === 'verified' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20' :
                                                                        report.status === 'pending' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                                                                        report.status === 'failed_cleanup' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                                                                        report.status === 'rejected' ? 'bg-muted text-muted-foreground border border-border' :
                                                                        'bg-muted text-foreground border border-border'
                                                                    }`}>
                                                                        {report.status.replace(/_/g, " ")}
                                                                    </span>
                                                                </td>
                                                                <td className="p-4">
                                                                    {sla ? (
                                                                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${SLA_PILL_CLASSES[sla.color]}`}>{sla.days}d</span>
                                                                    ) : (
                                                                        <span className="text-muted-foreground text-sm">—</span>
                                                                    )}
                                                                </td>
                                                                <td className="p-4 text-sm font-medium text-foreground">
                                                                    {report.ai_confidence ? `${(report.ai_confidence * 100).toFixed(0)}%` : 'N/A'}
                                                                    {(report as any).needs_human_review && (
                                                                        <span title="Low-trust photo — needs human review" className="text-yellow-500 ml-1 text-xs">⚠</span>
                                                                    )}
                                                                </td>
                                                                <td className="p-4 text-right">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSelectedReport(report);
                                                                            setCleanupPreview(null);
                                                                            setCleanupImage(null);
                                                                            setDeploymentNotes("");
                                                                        }}
                                                                        className="px-3 py-1.5 bg-background border border-border text-foreground text-xs font-medium rounded-lg hover:bg-muted transition-colors"
                                                                    >
                                                                        Manage
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-slide-up">
                                    {tableLoading ? (
                                        Array.from({ length: 8 }).map((_, i) => (
                                            <div key={i} className="h-40 bg-card rounded-xl border border-border animate-pulse" />
                                        ))
                                    ) : paginatedReports.length === 0 ? (
                                        <div className="col-span-full py-12 text-center text-muted-foreground font-medium">No reports match the current filters.</div>
                                    ) : (
                                        paginatedReports.map(report => (
                                            <div key={report.id} onClick={() => {
                                                setSelectedReport(report);
                                                setCleanupPreview(null);
                                                setCleanupImage(null);
                                                setDeploymentNotes("");
                                            }} className="bg-card rounded-xl border border-border p-4 hover:shadow-md hover:border-primary/50 transition-all cursor-pointer flex flex-col gap-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="font-mono text-sm font-bold text-foreground">{report.tracking_id}</div>
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                                        report.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                                                        report.status === 'pending' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                                                        'bg-muted text-foreground border border-border'
                                                    }`}>
                                                        {report.status.replace(/_/g, " ")}
                                                    </span>
                                                </div>
                                                <div className="text-sm font-medium text-foreground">Score: {report.ai_confidence ? `${(report.ai_confidence * 100).toFixed(0)}%` : 'N/A'}</div>
                                                <div className="text-xs text-muted-foreground mt-auto">{formatDate(report.created_at)}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* Pagination Controls */}
                            {reportTotalPages > 1 && (
                                <div className="flex items-center justify-between bg-card p-4 rounded-xl border border-border shadow-sm shrink-0 mt-auto">
                                    <span className="text-xs text-muted-foreground font-medium">
                                        Page {reportPage} of {reportTotalPages} ({displayReports.length} total)
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button disabled={reportPage === 1} onClick={() => setReportPage(p => p - 1)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted disabled:opacity-50 transition-colors text-foreground">Previous</button>
                                        <button disabled={reportPage === reportTotalPages} onClick={() => setReportPage(p => p + 1)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted disabled:opacity-50 transition-colors text-foreground">Next</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>

            {/* Report Detail Modal */}
            {selectedReport && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card p-0 max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-xl border border-border shadow-2xl relative animate-in zoom-in-95 duration-300">

                        {/* Modal Header */}
                        <div className="sticky top-0 z-20 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-foreground">Report {selectedReport.tracking_id}</h2>
                                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    selectedReport.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                                    selectedReport.status === 'pending' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                                    'bg-muted text-foreground border border-border'
                                }`}>
                                    {selectedReport.status.replace(/_/g, " ")}
                                </span>
                            </div>
                            <button
                                onClick={() => setSelectedReport(null)}
                                className="p-2 text-foreground/50 hover:text-foreground bg-foreground/5 hover:bg-foreground/10 rounded-full transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>

                        <div className="p-6 md:p-8 grid md:grid-cols-2 gap-8">

                            {/* Left Col: Info & Map */}
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Location Map</h3>
                                    <div className="w-full h-48 rounded-xl overflow-hidden border border-border relative bg-black/50">
                                        <MiniMap lat={selectedReport.lat} lon={selectedReport.lon} />
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Citizen Notes</h3>
                                    <p className="text-sm text-foreground bg-muted/50 p-4 rounded-xl border border-border italic">
                                        {selectedReport.notes || "No notes provided."}
                                    </p>
                                </div>

                                {selectedReport.deployment_notes && (
                                    <div>
                                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Deployment Notes</h3>
                                        <p className="text-sm text-foreground bg-muted/50 p-4 rounded-xl border border-border">
                                            {selectedReport.deployment_notes}
                                        </p>
                                    </div>
                                )}

                                {/* Reporter identity (Module 2) */}
                                <div>
                                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Reporter</h3>
                                    {selectedReport.reporter_id === null ? (
                                        <div className="text-sm text-muted-foreground italic">Anonymous (legacy report)</div>
                                    ) : reporterLoading && !reporterDetail ? (
                                        <div className="flex items-center gap-3 animate-pulse">
                                            <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0"></div>
                                            <div className="space-y-2 flex-1">
                                                <div className="h-4 bg-muted rounded w-24"></div>
                                                <div className="h-3 bg-muted rounded w-32"></div>
                                            </div>
                                        </div>
                                    ) : reporterError && !reporterDetail ? (
                                        <div className="text-sm text-destructive">
                                            <span>Couldn&apos;t load reporter info.</span>
                                        </div>
                                    ) : reporterDetail ? (
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full eco-gradient flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                                {reporterDetail.full_name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-semibold text-foreground text-sm">{reporterDetail.full_name}</div>
                                                <div className="text-[10px] text-foreground/50 truncate">{reporterDetail.email}</div>
                                                {reporterDetail.phone_number && (
                                                    <div className="text-[10px] text-foreground/50">{reporterDetail.phone_number}</div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-[11px] text-foreground/40">Reporter info unavailable.</div>
                                    )}
                                </div>

                                <div className="text-xs text-muted-foreground">
                                    Reported: {formatDateTime(selectedReport.created_at)}
                                </div>
                            </div>

                            {/* Right Col: Evidence & Actions */}
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Evidence Photo</h3>
                                    <div className="w-full aspect-video rounded-xl overflow-hidden border border-border bg-muted relative">
                                        <img src={`${API_URL}${selectedReport.image_url}`} className="w-full h-full object-cover" alt="Evidence" />
                                        {selectedReport.ai_confidence && (
                                            <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm border border-white/10 px-2 py-1 rounded text-[10px] font-bold text-white inline-flex items-center gap-1.5 shadow-sm">
                                                <span>AI Confidence: {(selectedReport.ai_confidence * 100).toFixed(0)}%</span>
                                                <InfoTooltip side="top" align="right" label="How is AI confidence computed?">
                                                    <ConfidenceTooltipBody />
                                                </InfoTooltip>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-2">
                                        <TrustBadge
                                            trust_score={(selectedReport as any).trust_score}
                                            trust_reasons={(selectedReport as any).trust_reasons}
                                            failing_signals={(selectedReport as any).failing_signals}
                                            needs_human_review={(selectedReport as any).needs_human_review}
                                        />
                                    </div>
                                    {reportPhotos.length > 0 && reportPhotos[0].signals && Object.keys(reportPhotos[0].signals).length > 0 && (
                                        <PhotoEvidenceDetail
                                            photo={reportPhotos[0]}
                                            report={{ lat: selectedReport.lat, lon: selectedReport.lon, created_at: selectedReport.created_at }}
                                        />
                                    )}
                                </div>

                                {/* Possible Duplicates (Module 3) */}
                                {selectedReport.possible_duplicate_flag && selectedReport.status !== 'duplicate' && duplicateMatches.length > 0 && (
                                    <div className="bg-amber-50 dark:bg-amber-950/20 p-5 rounded-xl border border-amber-200 dark:border-amber-900/50">
                                        <h3 className="text-sm font-medium text-amber-800 dark:text-amber-400 mb-2 flex items-center gap-2">
                                            <span>⚠</span> Possible Duplicates
                                        </h3>
                                        <p className="text-xs text-amber-700/70 dark:text-amber-400/70 mb-3">
                                            Open reports near this one. If this is the same incident, confirm it as a duplicate to remove it from the queue.
                                        </p>
                                        <div className="space-y-2">
                                            {duplicateMatches.map((m) => (
                                                <div key={m.id} className="flex items-center justify-between gap-3 bg-white/50 dark:bg-black/20 rounded-lg px-3 py-2 border border-amber-200/50 dark:border-amber-900/50">
                                                    <div className="min-w-0">
                                                        <div className="font-mono text-xs font-bold text-foreground">{m.tracking_id}</div>
                                                        <div className="text-[10px] text-foreground/50">
                                                            {m.barangay ?? "—"} · {Math.round(m.distance_m)} m away · {formatDate(m.created_at)}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleMarkDuplicate(m.id)}
                                                        disabled={markingDuplicate}
                                                        className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                    >
                                                        {markingDuplicate ? "…" : "Confirm Duplicate"}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Action Area */}
                                <div className="bg-muted/40 p-6 rounded-xl border border-border">
                                    <h3 className="text-base font-semibold text-foreground mb-4 border-b border-border pb-2">Take Action</h3>

                                    {selectedReport.status === 'verified' && (
                                        <div>
                                            <p className="text-xs text-foreground/60 mb-4">This report has been verified by the AI. Dispatch a cleanup team to the location.</p>

                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Priority</label>
                                                    <select
                                                        value={selectedPriority}
                                                        onChange={(e) => setSelectedPriority(e.target.value)}
                                                        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                                                    >
                                                        <option value="low">Low ({slaPolicy.low} days)</option>
                                                        <option value="medium">Medium ({slaPolicy.medium} days)</option>
                                                        <option value="high">High ({slaPolicy.high} days)</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Assign To</label>
                                                    <select
                                                        value={selectedCleaner || ""}
                                                        onChange={(e) => setSelectedCleaner(e.target.value ? parseInt(e.target.value) : null)}
                                                        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                                                    >
                                                        <option value="">Select cleaner...</option>
                                                        {cleaners.filter(c => c.is_active).map(c => (
                                                            <option key={c.id} value={c.id}>{c.full_name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Deployment Notes <span className="text-muted-foreground/60 normal-case">(optional)</span></label>
                                            <textarea
                                                value={deploymentNotes}
                                                onChange={(e) => setDeploymentNotes(e.target.value)}
                                                placeholder="Optional: who was dispatched, ETA, contact info…"
                                                rows={3}
                                                className="w-full mb-4 px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 resize-none transition-all"
                                            />
                                            <button
                                                onClick={() => handleDeploy(selectedReport.id)}
                                                disabled={actionLoading || !selectedCleaner}
                                                className="w-full py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {actionLoading ? "Processing..." : "Deploy Cleanup Team"}
                                            </button>
                                        </div>
                                    )}

                                    {(selectedReport.status === 'assigned' || selectedReport.status === 'in_progress') && (
                                        <div>
                                            <p className="text-xs text-foreground/60 mb-4">
                                                {selectedReport.status === 'in_progress'
                                                    ? "Cleaner is actively working. Upload a clear photo of the cleaned area to resolve."
                                                    : "Team is assigned. Upload a clear photo of the cleaned area to resolve."}
                                            </p>

                                            <label className="block w-full h-32 border-2 border-dashed border-foreground/20 hover:border-primary/50 rounded-xl mb-4 cursor-pointer overflow-hidden relative group">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    capture="environment"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            setCleanupImage(file);
                                                            setCleanupPreview(URL.createObjectURL(file));
                                                        }
                                                    }}
                                                />
                                                {cleanupPreview ? (
                                                    <img src={cleanupPreview} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-foreground/40 group-hover:text-primary transition-colors">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                                        <span className="text-xs font-bold mt-2">Upload Cleanup Proof</span>
                                                    </div>
                                                )}
                                            </label>

                                            <button
                                                onClick={() => handleResolve(selectedReport.id)}
                                                disabled={!cleanupImage || actionLoading}
                                                className="w-full py-3 bg-primary hover:bg-emerald-400 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/50 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                                            >
                                                {actionLoading ? "AI Verifying..." : "Mark as Resolved"}
                                            </button>
                                        </div>
                                    )}

                                    {selectedReport.status === 'failed_cleanup' && (
                                        <div>
                                            <p className="text-xs text-foreground/60 mb-4">
                                                Previous cleanup was rejected by AI. Retry to loop the report back to assigned so the cleaner can attempt again.
                                            </p>
                                            <button
                                                onClick={() => handleRetry(selectedReport.id)}
                                                disabled={actionLoading}
                                                className="w-full py-3 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 rounded-xl font-bold hover:bg-yellow-500/30 active:scale-95 transition-all disabled:opacity-50"
                                            >
                                                {actionLoading ? "Processing..." : "Retry Cleanup"}
                                            </button>
                                        </div>
                                    )}

                                    {selectedReport.status === 'resolved' && (
                                        <div>
                                            <div className="flex items-center gap-2 text-green-400 font-bold mb-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                                Cleanup Verified
                                            </div>
                                            {selectedReport.cleanup_image_url && (
                                                <div className="w-full h-32 rounded-lg overflow-hidden border border-border mt-2">
                                                    <img src={`${API_URL}${selectedReport.cleanup_image_url}`} className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* C1 - Create Cleaner Modal */}
            {showCreateCleanerModal && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="glass p-0 max-w-md w-full rounded-2xl border border-border shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="px-6 pt-6 pb-4 border-b border-border">
                            <h3 className="text-lg font-bold text-foreground">Create Cleaner Account</h3>
                            <p className="text-xs text-foreground/50 mt-1">A temporary password will be generated upon creation.</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-foreground/50 uppercase tracking-widest mb-1.5">Full Name *</label>
                                <input type="text" value={createCleanerForm.full_name} onChange={e => setCreateCleanerForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Juan dela Cruz" className="w-full px-3 py-2 glass border border-border rounded-lg text-sm text-foreground placeholder-foreground/30 focus:outline-none focus:border-primary" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-foreground/50 uppercase tracking-widest mb-1.5">Email Address *</label>
                                <input type="email" value={createCleanerForm.email} onChange={e => setCreateCleanerForm(f => ({ ...f, email: e.target.value }))} placeholder="juan@example.com" className="w-full px-3 py-2 glass border border-border rounded-lg text-sm text-foreground placeholder-foreground/30 focus:outline-none focus:border-primary" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-foreground/50 uppercase tracking-widest mb-1.5">Phone <span className="normal-case text-foreground/30 font-normal">(optional)</span></label>
                                <input type="tel" value={createCleanerForm.phone_number} onChange={e => setCreateCleanerForm(f => ({ ...f, phone_number: e.target.value }))} placeholder="+63 912 345 6789" className="w-full px-3 py-2 glass border border-border rounded-lg text-sm text-foreground placeholder-foreground/30 focus:outline-none focus:border-primary" />
                            </div>
                            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300/80">
                                Account will be assigned to <strong>{user.barangay_assignment}</strong> with role <strong>Cleaner</strong>.
                            </div>
                            <div className="flex gap-3 pt-1">
                                <button onClick={() => { setShowCreateCleanerModal(false); setCreateCleanerForm({ full_name: "", email: "", phone_number: "" }); }} disabled={createCleanerPending} className="flex-1 px-4 py-2.5 glass border border-border text-foreground/70 text-sm font-bold rounded-xl hover:bg-foreground/10 transition-colors">Cancel</button>
                                <button onClick={handleCreateCleaner} disabled={createCleanerPending} className="flex-1 px-4 py-2.5 eco-gradient text-white text-sm font-bold rounded-xl shadow-lg shadow-primary/20 disabled:opacity-50 transition-all">
                                    {createCleanerPending ? "Creating..." : "Generate Account"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* C2 - Cleaner Created Password Modal */}
            {showCleanerPasswordModal && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="glass p-6 max-w-md w-full rounded-2xl border border-border shadow-2xl animate-in zoom-in-95 duration-300">
                        <h3 className="text-lg font-bold text-foreground mb-1">Account Created</h3>
                        <p className="text-xs text-foreground/50 mb-4">Share these credentials. Password shown once only.</p>
                        <div className="space-y-2 mb-4">
                            <div className="bg-black/40 border border-border rounded-lg p-3">
                                <div className="text-[10px] text-foreground/40 uppercase tracking-widest mb-0.5">Email</div>
                                <div className="font-mono text-sm text-foreground">{cleanerTempEmail}</div>
                            </div>
                            <div className="bg-black/40 border border-border rounded-lg p-3">
                                <div className="text-[10px] text-foreground/40 uppercase tracking-widest mb-0.5">Temporary Password</div>
                                <div className="font-mono text-emerald-400 text-sm tracking-wider">{cleanerTempPassword}</div>
                            </div>
                        </div>
                        <button onClick={() => { navigator.clipboard.writeText(cleanerTempPassword); toast.success("Password copied!"); }} className="w-full px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:bg-primary/80 transition-colors mb-2">Copy Password</button>
                        <button onClick={() => { setShowCleanerPasswordModal(false); setCleanerTempPassword(""); setCleanerTempEmail(""); }} className="w-full px-4 py-2 glass border border-border text-foreground text-sm font-bold rounded-xl hover:bg-foreground/10 transition-colors">Done</button>
                    </div>
                </div>
            )}

            {/* C3 - Edit Cleaner Modal */}
            {showEditCleanerModal && editTarget && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="glass p-0 max-w-md w-full rounded-2xl border border-border shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="px-6 pt-6 pb-4 border-b border-border flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-foreground">Edit Account</h3>
                                <p className="text-xs text-foreground/50 mt-0.5">ID #{editTarget.id}</p>
                            </div>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400">Cleaner</span>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-foreground/50 uppercase tracking-widest mb-1.5">Full Name</label>
                                <input type="text" value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} className="w-full px-3 py-2 glass border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-foreground/50 uppercase tracking-widest mb-1.5">Email</label>
                                    <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 glass border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-foreground/50 uppercase tracking-widest mb-1.5">Phone</label>
                                    <input type="tel" value={editForm.phone_number} onChange={e => setEditForm(f => ({ ...f, phone_number: e.target.value }))} placeholder="+63 912 345 6789" className="w-full px-3 py-2 glass border border-border rounded-lg text-sm text-foreground placeholder-foreground/30 focus:outline-none focus:border-primary" />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-1">
                                <button onClick={() => { setShowEditCleanerModal(false); setEditTarget(null); }} disabled={editPending} className="flex-1 px-4 py-2.5 glass border border-border text-foreground/70 text-sm font-bold rounded-xl hover:bg-foreground/10 transition-colors">Cancel</button>
                                <button onClick={handleEditCleaner} disabled={editPending} className="flex-1 px-4 py-2.5 eco-gradient text-white text-sm font-bold rounded-xl shadow-lg shadow-primary/20 disabled:opacity-50 transition-all">
                                    {editPending ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* C4 - Reset Password Modal */}
            {showResetPasswordModal && resetTarget && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="glass p-0 max-w-md w-full rounded-2xl border border-border shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="px-6 pt-6 pb-4 border-b border-border">
                            <h3 className="text-lg font-bold text-foreground">Reset Password</h3>
                            <p className="text-xs text-foreground/50 mt-0.5">For <strong className="text-foreground">{resetTarget.full_name}</strong></p>
                        </div>
                        <div className="p-6">
                            {!resetCredential ? (
                                <div className="space-y-4">
                                    <p className="text-sm text-foreground/70">A new temporary password will be generated. The old password is immediately invalidated.</p>
                                    <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3 text-xs text-yellow-300/80">
                                        This action cannot be undone.
                                    </div>
                                    <div className="flex gap-3">
                                        <button onClick={() => { setShowResetPasswordModal(false); setResetTarget(null); }} disabled={resetPending} className="flex-1 px-4 py-2.5 glass border border-border text-foreground/70 text-sm font-bold rounded-xl hover:bg-foreground/10 transition-colors">Cancel</button>
                                        <button onClick={handleResetPasswordBrgy} disabled={resetPending} className="flex-1 px-4 py-2.5 bg-orange-500/20 border border-orange-500/30 text-orange-400 text-sm font-bold rounded-xl hover:bg-orange-500/30 transition-colors disabled:opacity-50">
                                            {resetPending ? "Resetting..." : "Reveal Temp Password"}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <p className="text-xs text-foreground/50">Share securely. Password shown once only.</p>
                                    <div className="space-y-2">
                                        <div className="bg-black/40 border border-border rounded-lg p-3">
                                            <div className="text-[10px] text-foreground/40 uppercase tracking-widest mb-0.5">Email</div>
                                            <div className="font-mono text-sm text-foreground">{resetCredential.email}</div>
                                        </div>
                                        <div className="bg-black/40 border border-border rounded-lg p-3">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <div className="text-[10px] text-foreground/40 uppercase tracking-widest">Temporary Password</div>
                                                <button onClick={() => setResetPasswordVisible(v => !v)} className="text-foreground/40 hover:text-foreground transition-colors">
                                                    {resetPasswordVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                                                </button>
                                            </div>
                                            <div className="font-mono text-sm text-emerald-400 tracking-wider">
                                                {resetPasswordVisible ? resetCredential.password : resetCredential.password.replace(/./g, ".")}
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => { navigator.clipboard.writeText(resetCredential.password); toast.success("Copied!"); }} className="w-full px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:bg-primary/80 transition-colors mb-1">Copy Password</button>
                                    <button onClick={() => { setShowResetPasswordModal(false); setResetTarget(null); setResetCredential(null); setResetPasswordVisible(false); }} className="w-full px-4 py-2 glass border border-border text-foreground text-sm font-bold rounded-xl hover:bg-foreground/10 transition-colors">Done</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </PortalShell>
    );
}
