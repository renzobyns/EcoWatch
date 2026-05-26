"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Search, Download, LayoutDashboard, FileText, Map, ClipboardList, BookUser, MoreVertical, FileDown, Eye, EyeOff, Edit2, Key, UserCheck, UserX, Plus } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { slaInfo, SLA_PILL_CLASSES, slaDeadlineColor, slaDeadlineLabel } from "@/lib/sla";
import { PortalShell, type PortalNavItem } from "@/components/portal/PortalShell";
import { TrustBadge } from "@/components/TrustBadge";

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

export default function BarangayPortal() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [user, setUser] = useState<any>(null);
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [tableLoading, setTableLoading] = useState(false);
    const [selectedReport, setSelectedReport] = useState<any>(null);
    const rawTab = searchParams.get('tab');
    const [activeView, setActiveView] = useState<BarangayView>(
        BARANGAY_NAV.some(n => n.key === rawTab) ? (rawTab as BarangayView) : 'dashboard'
    );
    const rawSub = searchParams.get('sub');
    const VALID_SUBS: ReportSubFilter[] = ['pending', 'assigned', 'resolved'];
    const [reportSubFilter, setReportSubFilter] = useState<ReportSubFilter>(
        VALID_SUBS.includes(rawSub as ReportSubFilter) ? (rawSub as ReportSubFilter) : 'pending'
    );

    // Filters (B1)
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 300);
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

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
    const USER_PAGE_SIZE = 8;
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
    const [woStatusFilter, setWoStatusFilter] = useState<string>("all");
    const [woPriorityFilter, setWoPriorityFilter] = useState<string>("all");
    const [woCleanerFilter, setWoCleanerFilter] = useState<number | null>(null);
    const [woSlaRiskOnly, setWoSlaRiskOnly] = useState(false);
    const [woSearch, setWoSearch] = useState("");
    const [woKpiWindow, setWoKpiWindow] = useState<"week" | "month" | "all">("week");
    const [selectedWorkOrder, setSelectedWorkOrder] = useState<any>(null);
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
    }, [user?.barangay_assignment, debouncedSearch, dateFrom, dateTo]);

    const buildQuery = () => {
        const params = new URLSearchParams();
        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
        if (dateFrom) params.set("date_from", `${dateFrom}T00:00:00`);
        if (dateTo) params.set("date_to", `${dateTo}T23:59:59`);
        const qs = params.toString();
        return qs ? `?${qs}` : "";
    };

    const fetchReports = async (barangayName: string) => {
        if (loading) {
            // initial mount: keep full-screen loader; skip table skeleton
        } else {
            setTableLoading(true);
        }
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
            const data = await api(`/report/${reportId}/deploy`, { method: "PUT", body: formData });
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

    if (loading || !user) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white p-1 shadow-[0_0_30px_rgba(16,185,129,0.3)] animate-pulse">
                    <img src="/logo.png" alt="Loading..." className="w-full h-full object-contain" />
                </div>
                <div className="text-emerald-500 font-bold tracking-widest uppercase text-sm animate-pulse">Initializing Portal...</div>
            </div>
        );
    }

    const displayReports = reports.filter(r => {
        if (reportSubFilter === 'pending') return r.status === 'pending' || r.status === 'verified';
        if (reportSubFilter === 'assigned') return r.status === 'assigned' || r.status === 'in_progress' || r.status === 'failed_cleanup';
        return r.status === 'resolved';
    });

    const stats = {
        pending: reports.filter(r => r.status === 'pending' || r.status === 'verified').length,
        deployed: reports.filter(r => r.status === 'assigned' || r.status === 'in_progress' || r.status === 'failed_cleanup').length,
        resolved: reports.filter(r => r.status === 'resolved').length
    };

    const recentReports = [...reports]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
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
            notificationCount={stats.pending}
        >
            <div className="max-w-[1600px] mx-auto h-full flex flex-col gap-5">

                {/* DASHBOARD VIEW */}
                {activeView === 'dashboard' && (
                    <div className="flex flex-col gap-5 animate-slide-up">
                        <div>
                            <h1 className="text-2xl font-bold text-foreground tracking-tight">
                                {user.barangay_assignment} <span className="text-primary">Dashboard</span>
                            </h1>
                            <p className="text-foreground/50 text-sm mt-1">Jurisdiction overview · {new Date().toLocaleDateString()}</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="glass-pro p-5 rounded-2xl bento-card">
                                <div className="text-[11px] font-semibold text-foreground/40 uppercase tracking-[0.1em] mb-1.5">Pending Reports</div>
                                <div className="text-3xl font-bold text-red-400 tracking-tight">{stats.pending}</div>
                            </div>
                            <div className="glass-pro p-5 rounded-2xl bento-card">
                                <div className="text-[11px] font-semibold text-foreground/40 uppercase tracking-[0.1em] mb-1.5">Teams Deployed</div>
                                <div className="text-3xl font-bold text-yellow-400 tracking-tight">{stats.deployed}</div>
                            </div>
                            <div className="glass-pro p-5 rounded-2xl bento-card">
                                <div className="text-[11px] font-semibold text-foreground/40 uppercase tracking-[0.1em] mb-1.5">Total Resolved</div>
                                <div className="text-3xl font-bold text-green-400 tracking-tight">{stats.resolved}</div>
                            </div>
                        </div>
                        <div className="glass-pro rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-bold text-foreground/60 uppercase tracking-widest">Recent Reports</h2>
                                <button
                                    onClick={() => setActiveView('reports')}
                                    className="text-xs font-bold text-primary hover:text-emerald-300 uppercase tracking-widest"
                                >
                                    View All →
                                </button>
                            </div>
                            {recentReports.length === 0 ? (
                                <div className="text-foreground/40 text-sm">No reports yet.</div>
                            ) : (
                                <ul className="space-y-2">
                                    {recentReports.map(r => {
                                        const sla = slaInfo(r.created_at, r.status);
                                        return (
                                            <li key={r.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-foreground/5 transition-colors">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className="font-mono text-sm font-bold text-foreground truncate">{r.tracking_id}</span>
                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                                        r.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                                                        r.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                                                        r.status === 'assigned' ? 'bg-yellow-500/20 text-yellow-400' :
                                                        r.status === 'verified' ? 'bg-orange-500/20 text-orange-400' :
                                                        r.status === 'failed_cleanup' ? 'bg-red-500/20 text-red-400' :
                                                        r.status === 'rejected' ? 'bg-foreground/5 text-foreground/40' :
                                                        'bg-foreground/10 text-foreground/70'
                                                    }`}>{r.status}</span>
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
                )}

                {/* MAP VIEW */}
                {activeView === 'map_view' && (
                    <div className="glass-pro rounded-[2.5rem] overflow-hidden shadow-2xl relative flex-1 min-h-[500px] animate-slide-up">
                        <div className="absolute top-6 left-6 z-[1000] glass-pro px-4 py-2 rounded-full text-[11px] font-bold text-foreground uppercase tracking-widest pointer-events-none">
                            <span className="flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
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
                        const aOrder = STATUS_ORDER[a.status] ?? 99;
                        const bOrder = STATUS_ORDER[b.status] ?? 99;
                        if (aOrder !== bOrder) return aOrder - bOrder;
                        return new Date(a.sla_deadline).getTime() - new Date(b.sla_deadline).getTime();
                    });

                    const PRIORITY_PILL: Record<string, string> = {
                        high: "bg-red-500/20 text-red-400",
                        medium: "bg-yellow-500/20 text-yellow-400",
                        low: "bg-blue-500/20 text-blue-400",
                    };
                    const STATUS_PILL: Record<string, string> = {
                        assigned: "bg-foreground/10 text-foreground",
                        in_progress: "bg-yellow-500/20 text-yellow-400",
                        needs_redo: "bg-red-500/20 text-red-400",
                        completed: "bg-green-500/20 text-green-400",
                        verified: "bg-green-500/20 text-green-400",
                    };
                    const STATUS_LABEL: Record<string, string> = {
                        assigned: "Assigned",
                        in_progress: "In Progress",
                        needs_redo: "Needs Redo",
                        completed: "Completed",
                        verified: "Verified",
                    };

                    return (
                        <div className="flex flex-col gap-5 animate-slide-up">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Work <span className="text-primary">Orders</span></h1>
                                    <p className="text-foreground/50 text-sm mt-1">{workOrders.length} total &middot; {user.barangay_assignment}</p>
                                </div>
                                <button
                                    onClick={fetchWorkOrders}
                                    disabled={woLoading}
                                    className="flex items-center gap-2 px-4 py-2 glass border border-border text-foreground/70 text-xs font-bold rounded-xl hover:bg-foreground/10 transition-colors uppercase tracking-widest disabled:opacity-50"
                                >
                                    {woLoading ? "Refreshing…" : "Refresh"}
                                </button>
                            </div>

                            {/* KPI Strip */}
                            <div className="glass-pro rounded-2xl p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-xs font-bold text-foreground/50 uppercase tracking-widest">Operational Overview</span>
                                    <div className="flex items-center gap-1 bg-foreground/5 rounded-lg p-1">
                                        {(["week", "month", "all"] as const).map(w => (
                                            <button
                                                key={w}
                                                onClick={() => setWoKpiWindow(w)}
                                                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${woKpiWindow === w ? "bg-primary text-white" : "text-foreground/50 hover:text-foreground"}`}
                                            >
                                                {w === "week" ? "7d" : w === "month" ? "30d" : "All"}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                    {[
                                        { label: "Active", value: kpiActive, color: "text-foreground" },
                                        { label: "Needs Redo", value: kpiNeedsRedo, color: "text-red-400" },
                                        { label: "At Risk", value: kpiAtRisk, color: "text-yellow-400" },
                                        { label: "Breached SLA", value: kpiBreached, color: "text-red-500" },
                                        { label: woKpiWindow === "week" ? "Resolved (7d)" : woKpiWindow === "month" ? "Resolved (30d)" : "Resolved (All)", value: kpiResolved, color: "text-green-400" },
                                    ].map(kpi => (
                                        <div key={kpi.label} className="glass rounded-xl p-4 text-center">
                                            <div className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</div>
                                            <div className="text-[11px] text-foreground/50 mt-1 font-medium">{kpi.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Filter Bar */}
                            <div className="glass-pro rounded-2xl p-4 flex flex-wrap gap-3 items-center">
                                <div className="relative flex-1 min-w-[180px]">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
                                    <input
                                        value={woSearch}
                                        onChange={e => setWoSearch(e.target.value)}
                                        placeholder="Search tracking ID or cleaner…"
                                        className="w-full pl-8 pr-3 py-2 glass rounded-lg text-sm text-foreground placeholder:text-foreground/30 border border-border focus:outline-none focus:border-primary/50 bg-transparent"
                                    />
                                </div>
                                <select
                                    value={woStatusFilter}
                                    onChange={e => setWoStatusFilter(e.target.value)}
                                    className="glass border border-border rounded-lg px-3 py-2 text-xs text-foreground bg-transparent focus:outline-none focus:border-primary/50"
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
                                    className="glass border border-border rounded-lg px-3 py-2 text-xs text-foreground bg-transparent focus:outline-none focus:border-primary/50"
                                >
                                    <option value="all">All Priorities</option>
                                    <option value="high">High</option>
                                    <option value="medium">Medium</option>
                                    <option value="low">Low</option>
                                </select>
                                <select
                                    value={woCleanerFilter ?? ""}
                                    onChange={e => setWoCleanerFilter(e.target.value ? Number(e.target.value) : null)}
                                    className="glass border border-border rounded-lg px-3 py-2 text-xs text-foreground bg-transparent focus:outline-none focus:border-primary/50"
                                >
                                    <option value="">All Cleaners</option>
                                    {activeCleaners.map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.full_name}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => setWoSlaRiskOnly(!woSlaRiskOnly)}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${woSlaRiskOnly ? "bg-red-500/20 border-red-500/50 text-red-400" : "glass border-border text-foreground/50 hover:text-foreground"}`}
                                >
                                    SLA Risk Only
                                </button>
                                {(woStatusFilter !== "all" || woPriorityFilter !== "all" || woCleanerFilter || woSlaRiskOnly || woSearch) && (
                                    <button
                                        onClick={() => { setWoStatusFilter("all"); setWoPriorityFilter("all"); setWoCleanerFilter(null); setWoSlaRiskOnly(false); setWoSearch(""); }}
                                        className="text-xs text-foreground/40 hover:text-foreground transition-colors underline"
                                    >
                                        Clear filters
                                    </button>
                                )}
                            </div>

                            {/* Table */}
                            <div className="glass-pro rounded-2xl overflow-hidden">
                                {woLoading ? (
                                    <div className="p-12 text-center">
                                        <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                                        <p className="text-foreground/50 text-sm">Loading work orders…</p>
                                    </div>
                                ) : woError ? (
                                    <div className="p-12 text-center">
                                        <p className="text-red-400 text-sm mb-3">{woError}</p>
                                        <button onClick={fetchWorkOrders} className="px-4 py-2 glass border border-border text-foreground/70 text-xs font-bold rounded-lg hover:bg-foreground/10 transition-colors">
                                            Retry
                                        </button>
                                    </div>
                                ) : filtered.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <ClipboardList size={32} className="text-foreground/20 mx-auto mb-3" />
                                        <p className="text-foreground/50 text-sm">
                                            {workOrders.length === 0 ? "No work orders yet. Deploy a verified report to create one." : "No work orders match these filters."}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-border">
                                                    <th className="p-4 text-left text-xs font-bold text-foreground/50 uppercase tracking-wider">Tracking ID</th>
                                                    <th className="p-4 text-left text-xs font-bold text-foreground/50 uppercase tracking-wider">Cleaner</th>
                                                    <th className="p-4 text-left text-xs font-bold text-foreground/50 uppercase tracking-wider">Priority</th>
                                                    <th className="p-4 text-left text-xs font-bold text-foreground/50 uppercase tracking-wider">Status</th>
                                                    <th className="p-4 text-left text-xs font-bold text-foreground/50 uppercase tracking-wider">SLA Deadline</th>
                                                    <th className="p-4 text-left text-xs font-bold text-foreground/50 uppercase tracking-wider">
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
                                                    <th className="p-4 text-left text-xs font-bold text-foreground/50 uppercase tracking-wider">Created</th>
                                                    <th className="p-4"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filtered.map(wo => {
                                                    const slaColor = slaDeadlineColor(wo.sla_deadline);
                                                    const slaLabel = slaDeadlineLabel(wo.sla_deadline);
                                                    return (
                                                        <tr key={wo.id} className="border-b border-border hover:bg-foreground/5 transition-colors">
                                                            <td className="p-4 font-mono text-sm font-bold text-foreground">{wo.report_tracking_id}</td>
                                                            <td className="p-4 text-sm text-foreground/80">{wo.assigned_cleaner_name}</td>
                                                            <td className="p-4">
                                                                <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${PRIORITY_PILL[wo.priority] || "bg-foreground/10 text-foreground"}`}>
                                                                    {wo.priority}
                                                                </span>
                                                            </td>
                                                            <td className="p-4">
                                                                <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${STATUS_PILL[wo.status] || "bg-foreground/10 text-foreground"}`}>
                                                                    {STATUS_LABEL[wo.status] || wo.status}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 text-sm text-foreground/70">
                                                                {wo.sla_deadline ? new Date(wo.sla_deadline).toLocaleDateString() : "—"}
                                                            </td>
                                                            <td className="p-4">
                                                                {wo.sla_deadline ? (
                                                                    <span className={`px-2 py-1 rounded-md text-[11px] font-bold ${SLA_PILL_CLASSES[slaColor]}`}>
                                                                        {slaLabel}
                                                                    </span>
                                                                ) : <span className="text-foreground/30 text-sm">—</span>}
                                                            </td>
                                                            <td className="p-4 text-sm text-foreground/50">
                                                                {wo.created_at ? new Date(wo.created_at).toLocaleDateString() : "—"}
                                                            </td>
                                                            <td className="p-4 text-right">
                                                                <button
                                                                    onClick={() => { setSelectedWorkOrder(wo); setNewWoPriority(wo.priority); }}
                                                                    className="px-4 py-2 glass border border-border text-foreground text-xs font-bold rounded-lg hover:bg-foreground/10 transition-colors"
                                                                >
                                                                    View
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
                                                    <div className="flex justify-between"><span className="text-foreground/40">Created</span><span className="text-foreground/70">{selectedWorkOrder.created_at ? new Date(selectedWorkOrder.created_at).toLocaleString() : "—"}</span></div>
                                                    <div className="flex justify-between"><span className="text-foreground/40">Started</span><span className="text-foreground/70">{selectedWorkOrder.started_at ? new Date(selectedWorkOrder.started_at).toLocaleString() : "Not started"}</span></div>
                                                    <div className="flex justify-between"><span className="text-foreground/40">Completed</span><span className="text-foreground/70">{selectedWorkOrder.completed_at ? new Date(selectedWorkOrder.completed_at).toLocaleString() : "—"}</span></div>
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
                        const diff = Date.now() - new Date(dt).getTime();
                        const mins = Math.floor(diff / 60000);
                        if (mins < 1) return "Just now";
                        if (mins < 60) return mins + "m ago";
                        const hrs = Math.floor(mins / 60);
                        if (hrs < 24) return hrs + "h ago";
                        const days = Math.floor(hrs / 24);
                        if (days === 1) return "Yesterday";
                        if (days < 30) return days + "d ago";
                        return new Date(dt).toLocaleDateString();
                    };
                    const filtered = barangayUsers.filter(u => {
                        const q = debouncedUserSearch.toLowerCase();
                        const matchSearch = !q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
                        const matchStatus = userStatusFilter === "all" || (userStatusFilter === "active" ? u.is_active : !u.is_active);
                        return matchSearch && matchStatus;
                    });
                    const totalPages = Math.max(1, Math.ceil(filtered.length / USER_PAGE_SIZE));
                    const paged = filtered.slice((userPage - 1) * USER_PAGE_SIZE, userPage * USER_PAGE_SIZE);
                    return (
                        <div className="flex flex-col gap-5 animate-slide-up" onClick={() => userActionsMenu !== null && setUserActionsMenu(null)}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Cleaner <span className="text-primary">Accounts</span></h1>
                                    <p className="text-foreground/50 text-sm mt-1">{barangayUsers.length} cleaner{barangayUsers.length !== 1 ? 's' : ''} &middot; {user.barangay_assignment}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button onClick={(e) => { e.stopPropagation(); handleExportCleanersCSV(); }} className="flex items-center gap-2 px-4 py-2 glass border border-border text-foreground/70 text-xs font-bold rounded-xl hover:bg-foreground/10 transition-colors uppercase tracking-widest">
                                        <FileDown size={14} /> Export CSV
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); setShowCreateCleanerModal(true); }} className="flex items-center gap-2 px-4 py-2 eco-gradient text-white text-xs font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest">
                                        <Plus size={14} /> Create Cleaner
                                    </button>
                                </div>
                            </div>
                            <div className="glass-pro rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                                <div className="relative flex-1 min-w-[200px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" size={15} />
                                    <input type="text" value={userSearch} onChange={e => { setUserSearch(e.target.value); setUserPage(1); }} placeholder="Search name or email..." className="w-full pl-9 pr-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground text-sm placeholder:text-foreground/40 focus:border-primary focus:outline-none" />
                                </div>
                                <select value={userStatusFilter} onChange={e => { setUserStatusFilter(e.target.value); setUserPage(1); }} className="px-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground text-sm focus:border-primary focus:outline-none">
                                    <option value="all">All Status</option>
                                    <option value="active">Active</option>
                                    <option value="disabled">Disabled</option>
                                </select>
                                <span className="text-xs text-foreground/40 font-medium shrink-0">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="glass-pro rounded-2xl overflow-hidden">
                                {userLoading ? (
                                    <div className="p-12 text-center text-foreground/50 text-sm">Loading accounts...</div>
                                ) : paged.length === 0 ? (
                                    <div className="p-12 text-center text-foreground/50 font-bold">No cleaners found.</div>
                                ) : (
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-border text-[10px] text-foreground/40 uppercase tracking-[0.1em] bg-black/20">
                                                <th className="px-5 py-3">Full Name</th>
                                                <th className="px-5 py-3">Email</th>
                                                <th className="px-5 py-3">Phone</th>
                                                <th className="px-5 py-3">Status</th>
                                                <th className="px-5 py-3">Last Login</th>
                                                <th className="px-5 py-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paged.map(u => (
                                                <tr key={u.id} className="border-b border-border hover:bg-foreground/5 transition-colors">
                                                    <td className="px-5 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-[11px] font-bold text-blue-300 shrink-0">
                                                                {getInitials(u.full_name)}
                                                            </div>
                                                            <span className="text-sm font-semibold text-foreground">{u.full_name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3 text-sm text-foreground/70 font-mono">{u.email}</td>
                                                    <td className="px-5 py-3 text-sm text-foreground/60">{u.phone_number ?? <span className="text-foreground/30">--</span>}</td>
                                                    <td className="px-5 py-3">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={"w-1.5 h-1.5 rounded-full shrink-0 " + (u.is_active ? "bg-emerald-400" : "bg-red-400")} />
                                                            <span className={"px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider " + (u.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400")}>
                                                                {u.is_active ? "Active" : "Disabled"}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3 text-sm text-foreground/50">{fmtLogin(u.last_login_at)}</td>
                                                    <td className="px-5 py-3 text-right">
                                                        <div className="relative inline-block" onClick={e => e.stopPropagation()}>
                                                            <button onClick={() => setUserActionsMenu(userActionsMenu === u.id ? null : u.id)} className="p-2 rounded-lg hover:bg-foreground/10 text-foreground/50 hover:text-foreground transition-colors">
                                                                <MoreVertical size={16} />
                                                            </button>
                                                            {userActionsMenu === u.id && (
                                                                <div className="absolute right-0 top-full mt-1 w-48 glass border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
                                                                    <button onClick={() => openEditCleaner(u)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-foreground/10 transition-colors text-left">
                                                                        <Edit2 size={14} className="text-foreground/50" /> Edit Account
                                                                    </button>
                                                                    <button onClick={() => openResetPasswordBrgy(u)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-foreground/10 transition-colors text-left">
                                                                        <Key size={14} className="text-foreground/50" /> Reset Password
                                                                    </button>
                                                                    <div className="border-t border-border" />
                                                                    {u.is_active ? (
                                                                        <button onClick={() => { setUserActionsMenu(null); handleDisableBrgyUser(u.id); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left">
                                                                            <UserX size={14} /> Disable Account
                                                                        </button>
                                                                    ) : (
                                                                        <button onClick={() => { setUserActionsMenu(null); handleReactivateBrgyUser(u.id); }} disabled={reactivating.has(u.id)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-emerald-400 hover:bg-emerald-500/10 transition-colors text-left disabled:opacity-50">
                                                                            <UserCheck size={14} /> {reactivating.has(u.id) ? "Reactivating..." : "Reactivate"}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between text-xs text-foreground/50">
                                    <span>Page {userPage} of {totalPages}</span>
                                    <div className="flex gap-2">
                                        <button disabled={userPage === 1} onClick={() => setUserPage(p => p - 1)} className="px-3 py-1.5 glass border border-border rounded-lg disabled:opacity-30 hover:bg-foreground/10 transition-colors">Prev</button>
                                        <button disabled={userPage === totalPages} onClick={() => setUserPage(p => p + 1)} className="px-3 py-1.5 glass border border-border rounded-lg disabled:opacity-30 hover:bg-foreground/10 transition-colors">Next</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* REPORTS VIEW */}
                {activeView === 'reports' && (
                    <div className="flex flex-col flex-1 min-h-0 animate-slide-up">
                        <div className="glass-pro rounded-[2.5rem] flex flex-col flex-1 min-h-0 shadow-2xl overflow-hidden">
                            {/* Filter Bar — Reports view only */}
                            {activeView === 'reports' && (
                                <div className="flex flex-col lg:flex-row gap-3 p-4 border-b border-border shrink-0">
                                    <div className="relative flex-1 min-w-[200px]">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" size={16} />
                                        <input
                                            type="text"
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search tracking ID or notes…"
                                            className="w-full pl-9 pr-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground text-sm placeholder:text-foreground/40 focus:border-primary focus:outline-none"
                                        />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <label className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest">From</label>
                                            <input
                                                type="date"
                                                value={dateFrom}
                                                onChange={(e) => setDateFrom(e.target.value)}
                                                onClick={(e) => (e.target as any).showPicker?.()}
                                                className="px-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground text-xs focus:border-primary focus:outline-none cursor-pointer hover:bg-foreground/5 transition-colors"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest">To</label>
                                            <input
                                                type="date"
                                                value={dateTo}
                                                onChange={(e) => setDateTo(e.target.value)}
                                                onClick={(e) => (e.target as any).showPicker?.()}
                                                className="px-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground text-xs focus:border-primary focus:outline-none cursor-pointer hover:bg-foreground/5 transition-colors"
                                            />
                                        </div>
                                        {(search || dateFrom || dateTo) && (
                                            <button
                                                onClick={() => {
                                                    setSearch("");
                                                    setDateFrom("");
                                                    setDateTo("");
                                                }}
                                                className="text-[10px] font-bold text-foreground/30 hover:text-foreground uppercase tracking-widest transition-colors"
                                            >
                                                Clear Filters
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        onClick={handleExport}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/20 border border-primary/30 text-primary text-xs font-bold uppercase tracking-widest hover:bg-primary/30 transition-colors"
                                        title="Export filtered reports as CSV"
                                    >
                                        <Download size={14} />
                                        Export CSV
                                    </button>
                                </div>
                            )}

                            {/* Sub-tabs — Reports view only */}
                            {activeView === 'reports' && (
                                <div className="flex border-b border-border shrink-0">
                                    <button
                                        onClick={() => { setReportSubFilter('pending'); router.replace('?tab=reports&sub=pending', { scroll: false }); }}
                                        className={`flex-1 py-3 text-[11px] font-semibold uppercase tracking-widest transition-colors ${reportSubFilter === 'pending' ? 'bg-primary/20 text-primary border-b-2 border-primary' : 'text-foreground/50 hover:bg-foreground/5 hover:text-foreground'}`}
                                    >
                                        Pending
                                    </button>
                                    <button
                                        onClick={() => { setReportSubFilter('assigned'); router.replace('?tab=reports&sub=assigned', { scroll: false }); }}
                                        className={`flex-1 py-3 text-[11px] font-semibold uppercase tracking-widest transition-colors ${reportSubFilter === 'assigned' ? 'bg-primary/20 text-primary border-b-2 border-primary' : 'text-foreground/50 hover:bg-foreground/5 hover:text-foreground'}`}
                                    >
                                        Assigned
                                    </button>
                                    <button
                                        onClick={() => { setReportSubFilter('resolved'); router.replace('?tab=reports&sub=resolved', { scroll: false }); }}
                                        className={`flex-1 py-3 text-[11px] font-semibold uppercase tracking-widest transition-colors ${reportSubFilter === 'resolved' ? 'bg-primary/20 text-primary border-b-2 border-primary' : 'text-foreground/50 hover:bg-foreground/5 hover:text-foreground'}`}
                                    >
                                        Done
                                    </button>
                                </div>
                            )}

                            {/* Table Container */}
                            <div className="flex-1 overflow-y-auto">
                                <>
                                        {tableLoading ? (
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b border-border text-xs text-foreground/40 uppercase tracking-widest bg-black/20">
                                                        <th className="p-4">Tracking ID</th>
                                                        <th className="p-4">Date</th>
                                                        <th className="p-4">Status</th>
                                                        <th className="p-4">Open</th>
                                                        <th className="p-4">AI Score</th>
                                                        <th className="p-4 text-right">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {Array.from({ length: 5 }).map((_, i) => (
                                                        <tr key={i} className="border-b border-border">
                                                            {Array.from({ length: 6 }).map((__, j) => (
                                                                <td key={j} className="p-4"><div className="h-3 bg-foreground/10 rounded animate-pulse" /></td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : displayReports.length === 0 ? (
                                            <div className="p-12 text-center text-foreground/50 font-bold">No reports found in this category.</div>
                                        ) : (
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b border-border text-xs text-foreground/40 uppercase tracking-widest bg-black/20">
                                                        <th className="p-4">Tracking ID</th>
                                                        <th className="p-4">Date</th>
                                                        <th className="p-4">Status</th>
                                                        <th className="p-4">Open</th>
                                                        <th className="p-4">AI Score</th>
                                                        <th className="p-4 text-right">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {displayReports.map(report => {
                                                        const sla = slaInfo(report.created_at, report.status);
                                                        return (
                                                            <tr key={report.id} className="border-b border-border hover:bg-foreground/5 transition-colors">
                                                                <td className="p-4 font-mono text-sm text-foreground font-bold">{report.tracking_id}</td>
                                                                <td className="p-4 text-sm text-foreground/70">
                                                                    {new Date(report.created_at).toLocaleDateString()}
                                                                </td>
                                                                <td className="p-4">
                                                                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                                                                        report.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                                                                        report.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                                                                        report.status === 'assigned' ? 'bg-yellow-500/20 text-yellow-400' :
                                                                        report.status === 'verified' ? 'bg-orange-500/20 text-orange-400' :
                                                                        report.status === 'failed_cleanup' ? 'bg-red-500/20 text-red-400' :
                                                                        report.status === 'rejected' ? 'bg-foreground/5 text-foreground/40' :
                                                                        'bg-foreground/10 text-foreground/70'
                                                                    }`}>
                                                                        {report.status}
                                                                    </span>
                                                                </td>
                                                                <td className="p-4">
                                                                    {sla ? (
                                                                        <span className={`px-2 py-1 rounded-md text-[11px] font-bold ${SLA_PILL_CLASSES[sla.color]}`}>
                                                                            {sla.days}d
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-foreground/30 text-sm">—</span>
                                                                    )}
                                                                </td>
                                                                <td className="p-4 text-sm font-bold text-foreground/80">
                                                                    {report.ai_confidence ? `${(report.ai_confidence * 100).toFixed(0)}%` : 'N/A'}
                                                                    {(report as any).needs_human_review && (
                                                                        <span title="Low-trust photo — needs human review" className="text-yellow-400 ml-1 text-xs">⚠</span>
                                                                    )}
                                                                </td>
                                                                <td className="p-4 text-right">
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedReport(report);
                                                                            setCleanupPreview(null);
                                                                            setCleanupImage(null);
                                                                            setDeploymentNotes("");
                                                                        }}
                                                                        className="px-4 py-2 glass border border-border text-foreground text-xs font-bold rounded-lg hover:bg-foreground/10 transition-colors"
                                                                    >
                                                                        Manage
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        )}
                                    </>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Report Detail Modal */}
            {selectedReport && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="glass p-0 max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-border shadow-2xl relative animate-in zoom-in-95 duration-300">

                        {/* Modal Header */}
                        <div className="sticky top-0 z-10 glass border-b border-border px-6 py-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-foreground">Report {selectedReport.tracking_id}</h2>
                                <p className="text-xs text-foreground/50 font-bold uppercase tracking-widest">{selectedReport.status}</p>
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
                                    <h3 className="text-xs font-bold text-foreground/50 uppercase tracking-widest mb-2">Location Map</h3>
                                    <div className="w-full h-48 rounded-xl overflow-hidden border border-border relative bg-black/50">
                                        <MiniMap lat={selectedReport.lat} lon={selectedReport.lon} />
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xs font-bold text-foreground/50 uppercase tracking-widest mb-1">Citizen Notes</h3>
                                    <p className="text-sm text-foreground/80 bg-foreground/5 p-4 rounded-xl border border-border italic">
                                        {selectedReport.notes || "No notes provided."}
                                    </p>
                                </div>

                                {selectedReport.deployment_notes && (
                                    <div>
                                        <h3 className="text-xs font-bold text-foreground/50 uppercase tracking-widest mb-1">Deployment Notes</h3>
                                        <p className="text-sm text-foreground/80 bg-foreground/5 p-4 rounded-xl border border-border">
                                            {selectedReport.deployment_notes}
                                        </p>
                                    </div>
                                )}

                                <div className="text-xs text-foreground/40">
                                    Reported: {new Date(selectedReport.created_at).toLocaleString()}
                                </div>
                            </div>

                            {/* Right Col: Evidence & Actions */}
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-xs font-bold text-foreground/50 uppercase tracking-widest mb-2">Evidence Photo</h3>
                                    <div className="w-full aspect-video rounded-xl overflow-hidden border border-border bg-black/50 relative">
                                        <img src={`${API_URL}${selectedReport.image_url}`} className="w-full h-full object-cover" alt="Evidence" />
                                        {selectedReport.ai_confidence && (
                                            <div className="absolute bottom-2 right-2 glass px-2 py-1 rounded text-[10px] font-bold text-white">
                                                AI Confidence: {(selectedReport.ai_confidence * 100).toFixed(0)}%
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-2">
                                        <TrustBadge
                                            trust_score={(selectedReport as any).trust_score}
                                            failing_signals={(selectedReport as any).failing_signals}
                                            needs_human_review={(selectedReport as any).needs_human_review}
                                        />
                                    </div>
                                </div>

                                {/* Action Area */}
                                <div className="bg-foreground/5 p-6 rounded-2xl border border-border">
                                    <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-4 border-b border-border pb-2">Take Action</h3>

                                    {selectedReport.status === 'verified' && (
                                        <div>
                                            <p className="text-xs text-foreground/60 mb-4">This report has been verified by the AI. Dispatch a cleanup team to the location.</p>

                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-foreground/50 uppercase tracking-widest mb-2">Priority</label>
                                                    <select
                                                        value={selectedPriority}
                                                        onChange={(e) => setSelectedPriority(e.target.value)}
                                                        className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground text-sm focus:border-primary focus:outline-none"
                                                    >
                                                        <option value="low">Low ({slaPolicy.low} days)</option>
                                                        <option value="medium">Medium ({slaPolicy.medium} days)</option>
                                                        <option value="high">High ({slaPolicy.high} days)</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-foreground/50 uppercase tracking-widest mb-2">Assign To</label>
                                                    <select
                                                        value={selectedCleaner || ""}
                                                        onChange={(e) => setSelectedCleaner(e.target.value ? parseInt(e.target.value) : null)}
                                                        className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground text-sm focus:border-primary focus:outline-none"
                                                    >
                                                        <option value="">Select cleaner...</option>
                                                        {cleaners.filter(c => c.is_active).map(c => (
                                                            <option key={c.id} value={c.id}>{c.full_name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            <label className="block text-[10px] font-bold text-foreground/50 uppercase tracking-widest mb-2">Deployment Notes <span className="text-foreground/30 normal-case font-medium">(optional)</span></label>
                                            <textarea
                                                value={deploymentNotes}
                                                onChange={(e) => setDeploymentNotes(e.target.value)}
                                                placeholder="Optional: who was dispatched, ETA, contact info…"
                                                rows={3}
                                                className="w-full mb-4 px-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground text-sm placeholder:text-foreground/30 focus:border-primary focus:outline-none resize-none"
                                            />
                                            <button
                                                onClick={() => handleDeploy(selectedReport.id)}
                                                disabled={actionLoading || !selectedCleaner}
                                                className="w-full py-3 eco-gradient text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
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
