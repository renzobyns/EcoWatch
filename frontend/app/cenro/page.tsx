"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import {
    Search, Download, Plus, AlertTriangle, Copy, X,
    LayoutDashboard, Map, FileText, ShieldCheck, BarChart3, Building2, Image as ImageIcon, History, BookUser,
    Phone, MoreVertical, Upload, FileDown, RefreshCw, Eye, EyeOff, Edit2, Key, UserCheck, UserX, ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { formatDate, formatDateTime, formatRelative } from "@/lib/date-utils";
import { PortalShell, type PortalNavItem } from "@/components/portal/PortalShell";
import { SlaManagementTab } from "@/components/portal/SlaManagementTab";
import { AnalyticsTab, type InsightsData } from "@/components/portal/AnalyticsTab";
import { AnalyticsDrilldownModal, type DrilldownData } from "@/components/portal/AnalyticsDrilldownModal";
import { BarangayManagementTab, type BarangayOverviewRow, type BarangayCityWide } from "@/components/portal/BarangayManagementTab";
import { BarangayDetailDrawer } from "@/components/portal/BarangayDetailDrawer";
import { ReportDetailDrawer } from "@/components/portal/ReportDetailDrawer";
import { EvidenceGalleryTab } from "@/components/portal/EvidenceGalleryTab";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { ConfidenceTooltipBody } from "@/components/ConfidenceTooltipBody";
import { BARANGAYS } from "@/lib/barangays";
import { TrustBadge } from "@/components/TrustBadge";
import { useUnreadNotificationCount } from "@/lib/notification-poll";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { DateRange } from "react-day-picker";
import { format as formatDF } from "date-fns";

const MapComponent = dynamic(() => import("@/components/MapComponent"), { ssr: false });
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const STATUS_OPTIONS = ["", "pending", "verified", "assigned", "in_progress", "resolved", "failed_cleanup", "rejected"];

const ACTION_FILTER_OPTIONS = ["all", "deploy", "resolve", "reassign", "force_close", "create_user", "disable_user"];

const ACTION_PILL_CLASSES: Record<string, string> = {
    deploy: "bg-blue-500/20 text-blue-300",
    resolve: "bg-green-500/20 text-green-300",
    reassign: "bg-yellow-500/20 text-yellow-300",
    force_close: "bg-red-500/20 text-red-300",
    disable_user: "bg-red-500/20 text-red-300",
    create_user: "bg-cyan-500/20 text-cyan-300",
};

const SLA_PILL_CLASSES: Record<"green" | "yellow" | "red", string> = {
    green: "bg-green-500/20 text-green-400",
    yellow: "bg-yellow-500/20 text-yellow-400",
    red: "bg-red-500/20 text-red-400",
};

function useDebounce<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(t);
    }, [value, delayMs]);
    return debounced;
}

function slaInfo(createdAt: string, status: string): { days: number; color: "green" | "yellow" | "red" } | null {
    const active = ["pending", "verified", "assigned", "in_progress", "failed_cleanup"].includes(status);
    if (!active) return null;
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
    const color: "green" | "yellow" | "red" = days <= 2 ? "green" : days <= 4 ? "yellow" : "red";
    return { days, color };
}

function buildAnalyticsCsv(overview: Record<string, any>, ranking: any[]): string {
    const lines: string[] = [];
    lines.push("EcoWatch SJDM Analytics Export");
    lines.push(`Generated,${new Date().toISOString()}`);
    lines.push("");
    lines.push("Overview");
    lines.push("Metric,Value");
    Object.entries(overview).forEach(([k, v]) => lines.push(`${k},${v}`));
    lines.push("");
    lines.push("Barangay Ranking");
    lines.push("Barangay,Total Reports,Resolved,Active,Pending,Resolution Rate");
    ranking.forEach((r) => {
        lines.push([
            r.barangay,
            r.total_reports,
            r.resolved,
            r.active,
            r.pending,
            r.resolution_rate,
        ].join(","));
    });
    return lines.join("\n");
}

function downloadString(content: string, filename: string, mime = "text/csv") {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

type TabKey =
    | 'command_center'
    | 'overview'
    | 'oversight'
    | 'sla_management'
    | 'analytics'
    | 'barangay_management'
    | 'gallery'
    | 'audit'
    | 'users';

const CENRO_NAV: PortalNavItem[] = [
    { key: 'command_center', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'overview', label: 'City Map', icon: Map },
    { key: 'oversight', label: 'Reports', icon: FileText },
    { key: 'sla_management', label: 'SLA Management', icon: ShieldCheck },
    { key: 'analytics', label: 'Analytics', icon: BarChart3 },
    { key: 'barangay_management', label: 'Barangay Management', icon: Building2 },
    { key: 'gallery', label: 'Evidence Gallery', icon: ImageIcon, sectionBreakBefore: true },
    { key: 'audit', label: 'Audit Log', icon: History },
    { key: 'users', label: 'Accounts', icon: BookUser },
];

interface AuditEntry {
    id: number;
    user_id: number | null;
    user_email: string | null;
    action: string;
    target_type: string;
    target_id: number | null;
    details: Record<string, any>;
    created_at: string;
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

// useSearchParams() (used in CenroDashboardInner for report deep-linking) needs a
// Suspense boundary so the page doesn't bail out of static prerendering at build time.
export default function CenroDashboard() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}>
            <CenroDashboardInner />
        </Suspense>
    );
}

function CenroDashboardInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [user, setUser] = useState<any>(null);
    const [reports, setReports] = useState<any[]>([]);
    const [heatmaps, setHeatmaps] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const rawTab = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState<TabKey>(
        CENRO_NAV.some(n => n.key === rawTab) ? (rawTab as TabKey) : 'command_center'
    );
    const [selectedReport, setSelectedReport] = useState<any>(null);

    // Action State (Oversight modal)
    const [actionLoading, setActionLoading] = useState(false);
    const [newBarangay, setNewBarangay] = useState<string>("");

    // C3 — SLA Breaches & Config
    const [slaBreaches, setSlaBreaches] = useState<any[]>([]);
    const [slaPolicy, setSlaPolicy] = useState({ low: 7, medium: 3, high: 1, compliance_target: 95 });
    const [showSlaModal, setShowSlaModal] = useState(false);
    const [slaDraftLow, setSlaDraftLow] = useState(7);
    const [slaDraftMed, setSlaDraftMed] = useState(3);
    const [slaDraftHigh, setSlaDraftHigh] = useState(1);
    const [slaDraftTarget, setSlaDraftTarget] = useState(95);
    const [slaModalLoading, setSlaModalLoading] = useState(false);

    // SLA Management tab data
    const [slaCompliance, setSlaCompliance] = useState<any>(null);
    const [breachedWOs, setBreachedWOs] = useState<any[]>([]);
    const [atRiskWOs, setAtRiskWOs] = useState<any[]>([]);
    const [slaHistory, setSlaHistory] = useState<any[]>([]);
    const [slaLastModified, setSlaLastModified] = useState<any>(null);
    const [slaManagementLoading, setSlaManagementLoading] = useState(false);
    const [slaExporting, setSlaExporting] = useState(false);

    // Analytics tab state
    const [insightsData, setInsightsData] = useState<InsightsData | null>(null);
    const [insightsLoading, setInsightsLoading] = useState(false);
    const [insightsExporting, setInsightsExporting] = useState(false);
    const [insightsWindowDays, setInsightsWindowDays] = useState(30);
    const [insightsLastUpdated, setInsightsLastUpdated] = useState<Date | null>(null);
    // Drilldown modal state
    const [drilldownOpen, setDrilldownOpen] = useState(false);
    const [drilldownLoading, setDrilldownLoading] = useState(false);
    const [drilldownData, setDrilldownData] = useState<DrilldownData | null>(null);
    const [drilldownError, setDrilldownError] = useState<string | null>(null);

    // Barangay Management tab
    const [barangayOverview, setBarangayOverview] = useState<BarangayOverviewRow[]>([]);
    const [barangayCityWide, setBarangayCityWide] = useState<BarangayCityWide | null>(null);
    const [barangayLoading, setBarangayLoading] = useState(false);
    const [barangayError, setBarangayError] = useState<string | null>(null);
    const [barangayExporting, setBarangayExporting] = useState(false);
    const [selectedBarangayRow, setSelectedBarangayRow] = useState<BarangayOverviewRow | null>(null);

    // C4 — Oversight Queue filters
    const [queueReports, setQueueReports] = useState<any[]>([]);
    const [queueLoading, setQueueLoading] = useState(false);
    const [oversightSearch, setOversightSearch] = useState("");
    const debouncedOversightSearch = useDebounce(oversightSearch, 300);
    const [oversightStatus, setOversightStatus] = useState("");
    const [oversightDateRange, setOversightDateRange] = useState<DateRange | undefined>();
    const [oversightBarangay, setOversightBarangay] = useState("");

    // C1 — Audit Log tab
    const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
    const [auditAction, setAuditAction] = useState<string>("all");
    const [auditOffset, setAuditOffset] = useState(0);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditHasMore, setAuditHasMore] = useState(false);

    // C2 — User Management
    const [barangayUsers, setBarangayUsers] = useState<BarangayUser[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [showCreateUserModal, setShowCreateUserModal] = useState(false);
    const [createForm, setCreateForm] = useState({ email: "", full_name: "", phone_number: "", barangay_assignment: "", role: "barangay" });
    const [createPending, setCreatePending] = useState(false);
    const [createdCredential, setCreatedCredential] = useState<{ email: string; password: string } | null>(null);
    const [disabling, setDisabling] = useState<Set<number>>(new Set());
    const [reactivating, setReactivating] = useState<Set<number>>(new Set());
    const [userRoleFilter, setUserRoleFilter] = useState("all");
    const [userStatusFilter, setUserStatusFilter] = useState("all");
    const [userSearch, setUserSearch] = useState("");
    const debouncedUserSearch = useDebounce(userSearch, 300);
    const [userActionsMenu, setUserActionsMenu] = useState<number | null>(null);
    const [showEditUserModal, setShowEditUserModal] = useState(false);
    const [editTarget, setEditTarget] = useState<BarangayUser | null>(null);
    const [editForm, setEditForm] = useState({ full_name: "", email: "", phone_number: "", barangay_assignment: "" });
    const [editPending, setEditPending] = useState(false);
    const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
    const [resetTarget, setResetTarget] = useState<BarangayUser | null>(null);
    const [resetPending, setResetPending] = useState(false);
    const [resetCredential, setResetCredential] = useState<{ email: string; password: string } | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importStep, setImportStep] = useState(1);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importResults, setImportResults] = useState<any[]>([]);
    const [importSummary, setImportSummary] = useState<{ created: number; failed: number } | null>(null);
    const [importPending, setImportPending] = useState(false);
    const [userPage, setUserPage] = useState(1);
    const USER_PAGE_SIZE = 8;

    const [unreadCount] = useUnreadNotificationCount(user?.id);

    // Auth + initial load
    useEffect(() => {
        const storedUser = localStorage.getItem('ecowatch_user');
        if (!storedUser) {
            router.push('/login');
            return;
        }

        const parsed = JSON.parse(storedUser);
        if (parsed.role !== 'cenro') {
            router.push('/');
            return;
        }

        setUser(parsed);
        fetchOverviewData();
        fetchSlaBreaches();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchOverviewData = async () => {
        try {
            const repData = await api(`/reports/recent?limit=200`);
            if (Array.isArray(repData)) setReports(repData);

            const heatRes = await fetch(`${API_URL}/spatial/heatmaps`);
            const heatData = await heatRes.json();
            if (heatData && Array.isArray(heatData.hotspots)) {
                setHeatmaps(heatData.hotspots);
            }
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to load CENRO data");
        } finally {
            setLoading(false);
        }
    };

    const fetchSlaBreaches = async () => {
        try {
            const data = await api(`/reports/sla-breaches?days=3`);
            if (Array.isArray(data)) setSlaBreaches(data);
        } catch (err) {
            console.error("Failed to load SLA breaches", err);
        }
    };

    // Event listener: navigate to the right tab and open the target report
    useEffect(() => {
        const handler = (e: Event) => {
            const ce = e as CustomEvent<{ report_id: number | null; work_order_id: number | null; kind: string }>;
            const { report_id, kind } = ce.detail || {};

            if (kind === "cenro_stale_deploy" || kind === "cenro_force_resolved") {
                setActiveTab("oversight");
                router.replace("?tab=oversight", { scroll: false });
            } else if (kind === "cenro_sla_breached" || kind === "cenro_high_priority_deployed") {
                setActiveTab("sla_management");
                router.replace("?tab=sla_management", { scroll: false });
            } else if (report_id) {
                setActiveTab("oversight");
                router.replace("?tab=oversight", { scroll: false });
            }

            if (report_id) {
                const target = reports.find((r: any) => r.id === report_id);
                if (target) setSelectedReport(target);
            }
        };
        window.addEventListener("ecowatch:open-target", handler as EventListener);
        return () => window.removeEventListener("ecowatch:open-target", handler as EventListener);
    }, [router, reports]);

    // C4 — refetch queue when filters change AND oversight tab active
    const buildQueueQuery = () => {
        const params = new URLSearchParams();
        if (debouncedOversightSearch.trim()) params.set("search", debouncedOversightSearch.trim());
        if (oversightStatus) params.set("status", oversightStatus);
        if (oversightDateRange?.from) params.set("date_from", `${formatDF(oversightDateRange.from, "yyyy-MM-dd")}T00:00:00`);
        if (oversightDateRange?.to) params.set("date_to", `${formatDF(oversightDateRange.to, "yyyy-MM-dd")}T23:59:59`);
        params.set("limit", "200");
        return `?${params.toString()}`;
    };

    const fetchQueueData = async () => {
        setQueueLoading(true);
        try {
            const data = await api(`/reports/recent${buildQueueQuery()}`);
            if (Array.isArray(data)) setQueueReports(data);
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to load oversight queue");
        } finally {
            setQueueLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab !== 'oversight' || !user) return;
        fetchQueueData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, debouncedOversightSearch, oversightStatus, oversightDateRange, user]);

    // Fetch SLA policy on mount and when command_center tab active
    useEffect(() => {
        if (activeTab === 'command_center') {
            fetchSlaPolicy();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    // Fetch SLA Management data when tab becomes active
    useEffect(() => {
        if (activeTab !== 'sla_management' || !user) return;
        fetchSlaPolicy();
        fetchSlaManagementData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, user]);


    // Fetch Analytics insights when tab active OR window changes
    useEffect(() => {
        if (activeTab !== 'analytics' || !user) return;
        fetchInsights(insightsWindowDays);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, user, insightsWindowDays]);

    // Fetch Barangay Management overview when tab becomes active
    useEffect(() => {
        if (activeTab !== 'barangay_management' || !user) return;
        fetchBarangayOverview();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, user]);

    // Client-side barangay filter (backend has no barangay query param on /reports/recent)
    const displayedQueueReports = oversightBarangay
        ? queueReports.filter((r) => r.barangay === oversightBarangay)
        : queueReports;

    // C1 — fetch audit log
    const fetchAuditLog = async (offset = 0) => {
        setAuditLoading(true);
        try {
            const data = await api(`/audit-log?limit=50&offset=${offset}`);
            const entries: AuditEntry[] = Array.isArray(data?.entries) ? data.entries : [];
            setAuditEntries((prev) => (offset === 0 ? entries : [...prev, ...entries]));
            setAuditHasMore(entries.length === 50);
            setAuditOffset(offset);
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to load audit log");
        } finally {
            setAuditLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab !== 'audit' || !user) return;
        if (auditEntries.length === 0) fetchAuditLog(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, user]);

    const displayedAuditEntries = auditAction === "all"
        ? auditEntries
        : auditEntries.filter((e) => e.action === auditAction);

    // C2 — fetch users
    const fetchUsers = async () => {
        setUsersLoading(true);
        try {
            const data = await api(`/users`);
            if (Array.isArray(data)) setBarangayUsers(data);
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to load users");
        } finally {
            setUsersLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab !== 'users' || !user) return;
        fetchUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, user]);

    const handleCreateUser = async () => {
        const needsBarangay = ["barangay", "cleaner"].includes(createForm.role);
        if (!createForm.email.trim() || !createForm.full_name.trim()) {
            toast.error("Email and full name are required.");
            return;
        }
        if (needsBarangay && !createForm.barangay_assignment) {
            toast.error("Barangay assignment is required for this role.");
            return;
        }
        setCreatePending(true);
        try {
            const payload: any = {
                email: createForm.email.trim(),
                full_name: createForm.full_name.trim(),
                role: createForm.role,
                phone_number: createForm.phone_number.trim() || null,
            };
            if (needsBarangay) payload.barangay_assignment = createForm.barangay_assignment;
            const data = await api(`/users`, { method: "POST", body: JSON.stringify(payload) });
            if (data?.user && data?.temporary_password) {
                setShowCreateUserModal(false);
                setCreatedCredential({ email: data.user.email, password: data.temporary_password });
                setCreateForm({ email: "", full_name: "", phone_number: "", barangay_assignment: "", role: "barangay" });
                toast.success("Account created.");
                fetchUsers();
                if (createForm.role === "barangay") fetchBarangayOverview();
            }
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to create account");
        } finally {
            setCreatePending(false);
        }
    };

    const handleReactivateUser = async (targetId: number, targetEmail: string) => {
        if (!confirm(`Reactivate ${targetEmail}? They will be able to log in again.`)) return;
        setReactivating((s) => new Set(s).add(targetId));
        try {
            await api(`/users/${targetId}/reactivate`, { method: "PUT" });
            setBarangayUsers((prev) => prev.map((u) => (u.id === targetId ? { ...u, is_active: true } : u)));
            toast.success("Account reactivated.");
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to reactivate account");
        } finally {
            setReactivating((s) => { const n = new Set(s); n.delete(targetId); return n; });
        }
    };

    const openEditUser = (u: BarangayUser) => {
        setEditTarget(u);
        setEditForm({ full_name: u.full_name, email: u.email, phone_number: u.phone_number || "", barangay_assignment: u.barangay_assignment || "" });
        setShowEditUserModal(true);
        setUserActionsMenu(null);
    };

    const handleAssignBarangayAdmin = (barangayName: string) => {
        setCreateForm({ email: "", full_name: "", phone_number: "", barangay_assignment: barangayName, role: "barangay" });
        setShowCreateUserModal(true);
    };

    const handleReassignBarangayAdmin = (adminUserId: number) => {
        const admin = selectedBarangayRow?.admin;
        if (!admin) return;
        const asBarangayUser: BarangayUser = {
            id: admin.id,
            email: admin.email,
            full_name: admin.full_name,
            role: "barangay",
            barangay_assignment: selectedBarangayRow?.barangay ?? null,
            phone_number: admin.phone_number,
            is_active: true,
            created_at: null,
            last_login_at: admin.last_login_at,
        };
        setEditTarget(asBarangayUser);
        setEditForm({
            full_name: admin.full_name,
            email: admin.email,
            phone_number: admin.phone_number ?? "",
            barangay_assignment: selectedBarangayRow?.barangay ?? "",
        });
        setShowEditUserModal(true);
    };

    const handleDisableBarangayAdmin = async (adminUserId: number) => {
        const admin = selectedBarangayRow?.admin;
        if (!admin) return;
        if (!confirm(`Disable ${admin.email}? They will no longer be able to log in.`)) return;
        setDisabling(s => new Set(s).add(adminUserId));
        try {
            await api(`/users/${adminUserId}/disable`, { method: "PUT" });
            toast.success(`${admin.full_name} disabled.`);
            setSelectedBarangayRow(null);
            fetchBarangayOverview();
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to disable admin.");
        } finally {
            setDisabling(s => { const n = new Set(s); n.delete(adminUserId); return n; });
        }
    };

    const handleEditUser = async () => {
        if (!editTarget) return;
        if (!editForm.full_name.trim() || !editForm.email.trim()) {
            toast.error("Name and email are required.");
            return;
        }
        setEditPending(true);
        try {
            const payload: any = {
                full_name: editForm.full_name.trim(),
                email: editForm.email.trim(),
                phone_number: editForm.phone_number.trim() || null,
            };
            const needsBarangay = ["barangay", "cleaner"].includes(editTarget.role);
            if (needsBarangay) payload.barangay_assignment = editForm.barangay_assignment || null;
            const updated = await api(`/users/${editTarget.id}`, { method: "PUT", body: JSON.stringify(payload) });
            setBarangayUsers((prev) => prev.map((u) => (u.id === editTarget.id ? { ...u, ...updated } : u)));
            setShowEditUserModal(false);
            toast.success("Account updated.");
            if (editTarget.role === "barangay") fetchBarangayOverview();
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to update account");
        } finally {
            setEditPending(false);
        }
    };

    const openResetPassword = (u: BarangayUser) => {
        setResetTarget(u);
        setResetCredential(null);
        setShowResetPasswordModal(true);
        setUserActionsMenu(null);
    };

    const handleResetPassword = async () => {
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

    const handleExportCSV = async () => {
        try {
            const storedUser = localStorage.getItem("ecowatch_user");
            const userId = storedUser ? JSON.parse(storedUser).id : null;
            const res = await fetch(`${API_URL}/users/export`, {
                headers: { "X-User-Id": String(userId) },
            });
            if (!res.ok) throw new Error("Export failed");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `ecowatch_accounts_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            toast.success("Accounts exported.");
        } catch (err) {
            toast.error("Export failed.");
        }
    };

    const handleImportCSV = async () => {
        if (!importFile) return;
        setImportPending(true);
        try {
            const storedUser = localStorage.getItem("ecowatch_user");
            const userId = storedUser ? JSON.parse(storedUser).id : null;
            const formData = new FormData();
            formData.append("file", importFile);
            const res = await fetch(`${API_URL}/users/import`, {
                method: "POST",
                headers: { "X-User-Id": String(userId) },
                body: formData,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Import failed");
            setImportResults(data.results || []);
            setImportSummary({ created: data.created, failed: data.failed });
            setImportStep(4);
            fetchUsers();
        } catch (err: any) {
            toast.error(err.message || "Import failed");
        } finally {
            setImportPending(false);
        }
    };

    const downloadImportTemplate = () => {
        const csv = "email,full_name,role,barangay_assignment,phone_number\ncitizen@example.com,Juan dela Cruz,citizen,,09171234567\ncoord@example.com,Maria Santos,barangay,Muzon,\ncleaner@example.com,Pedro Reyes,cleaner,Muzon,";
        downloadString(csv, "ecowatch_import_template.csv");
    };

    const handleDisableUser = async (targetId: number, targetEmail: string) => {
        if (!confirm(`Disable ${targetEmail}? They will no longer be able to log in.`)) return;
        setDisabling((s) => new Set(s).add(targetId));
        try {
            await api(`/users/${targetId}/disable`, { method: "PUT" });
            setBarangayUsers((prev) => prev.map((u) => (u.id === targetId ? { ...u, is_active: false } : u)));
            toast.success("Account disabled.");
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to disable account");
        } finally {
            setDisabling((s) => {
                const n = new Set(s);
                n.delete(targetId);
                return n;
            });
        }
    };

    const handleReassign = async (reportId: number) => {
        if (!newBarangay) return;
        setActionLoading(true);

        const formData = new FormData();
        formData.append("new_barangay", newBarangay);

        try {
            await api(`/report/${reportId}/reassign`, { method: "PUT", body: formData });
            const updater = (r: any) => (r.id === reportId ? { ...r, barangay: newBarangay } : r);
            setReports((prev) => prev.map(updater));
            setQueueReports((prev) => prev.map(updater));
            setSelectedReport({ ...selectedReport, barangay: newBarangay });
            toast.success("Report reassigned.");
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Network error.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleForceClose = async (reportId: number) => {
        if (!confirm("Are you sure you want to force-close this report? This overrides AI verification.")) return;
        setActionLoading(true);

        try {
            await api(`/report/${reportId}/force-close`, { method: "PUT" });
            const updater = (r: any) => (r.id === reportId ? { ...r, status: 'resolved' } : r);
            setReports((prev) => prev.map(updater));
            setQueueReports((prev) => prev.map(updater));
            setSelectedReport({ ...selectedReport, status: 'resolved' });
            toast.success("Report force-closed.");
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Network error.");
        } finally {
            setActionLoading(false);
        }
    };

    const fetchSlaPolicy = async () => {
        try {
            const data = await api("/config/sla");
            setSlaPolicy(data);
            setSlaDraftLow(data.low);
            setSlaDraftMed(data.medium);
            setSlaDraftHigh(data.high);
            setSlaDraftTarget(data.compliance_target ?? 95);
        } catch (err) {
            console.error("Failed to fetch SLA policy:", err);
        }
    };

    const handleUpdateSlaPolicy = async () => {
        setSlaModalLoading(true);
        try {
            const data = await api("/config/sla", {
                method: "PUT",
                body: JSON.stringify({
                    low_days: parseInt(slaDraftLow.toString()),
                    medium_days: parseInt(slaDraftMed.toString()),
                    high_days: parseInt(slaDraftHigh.toString()),
                    compliance_target: parseInt(slaDraftTarget.toString()),
                }),
            });
            setSlaPolicy(data);
            setShowSlaModal(false);
            toast.success("SLA policy updated.");
            if (activeTab === 'sla_management') fetchSlaManagementData();
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to update SLA policy");
        } finally {
            setSlaModalLoading(false);
        }
    };

    const fetchSlaManagementData = async () => {
        setSlaManagementLoading(true);
        try {
            const [compliance, breached, atRisk, history] = await Promise.all([
                api("/analytics/sla-compliance"),
                api("/work-orders/breached"),
                api("/work-orders/at-risk?hours=24"),
                api("/config/sla/history?limit=20"),
            ]);
            setSlaCompliance(compliance);
            setBreachedWOs(Array.isArray(breached) ? breached : []);
            setAtRiskWOs(Array.isArray(atRisk) ? atRisk : []);
            setSlaHistory(Array.isArray(history?.entries) ? history.entries : []);
            setSlaLastModified(history?.last_modified || null);
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to load SLA Management data");
        } finally {
            setSlaManagementLoading(false);
        }
    };

    const fetchBarangayOverview = async () => {
        setBarangayLoading(true);
        setBarangayError(null);
        try {
            const data = await api("/analytics/barangay-overview");
            setBarangayCityWide(data.city_wide ?? null);
            setBarangayOverview(Array.isArray(data.barangays) ? data.barangays : []);
        } catch (err) {
            const msg = err instanceof ApiError ? err.message : "Could not load barangay data. Please refresh.";
            setBarangayError(msg);
            toast.error(msg);
        } finally {
            setBarangayLoading(false);
        }
    };

    const handleExportBarangayPerformance = async () => {
        setBarangayExporting(true);
        try {
            const storedUser = localStorage.getItem("ecowatch_user");
            const userId = storedUser ? JSON.parse(storedUser).id : null;
            const res = await fetch(`${API_URL}/analytics/barangay-overview/export`, {
                headers: { "X-User-Id": String(userId) },
            });
            if (!res.ok) throw new Error("Export failed");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `ecowatch_barangay_performance_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            toast.success("Barangay performance CSV exported.");
        } catch {
            toast.error("Export failed. Please try again.");
        } finally {
            setBarangayExporting(false);
        }
    };

    const handleExportSlaReport = async () => {
        setSlaExporting(true);
        try {
            const storedUser = localStorage.getItem("ecowatch_user");
            const userId = storedUser ? JSON.parse(storedUser).id : null;
            const res = await fetch(`${API_URL}/analytics/sla-export`, {
                headers: { "X-User-Id": String(userId) },
            });
            if (!res.ok) throw new Error("Export failed");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `ecowatch_sla_report_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            toast.success("SLA report exported.");
        } catch (err) {
            toast.error("Export failed.");
        } finally {
            setSlaExporting(false);
        }
    };

    const fetchInsights = async (days: number) => {
        setInsightsLoading(true);
        try {
            const data = await api(`/analytics/insights?days=${days}`);
            setInsightsData(data);
            setInsightsLastUpdated(new Date());
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to load analytics insights");
        } finally {
            setInsightsLoading(false);
        }
    };

    const handleDrilldown = async (metric: string, key?: string) => {
        setDrilldownOpen(true);
        setDrilldownLoading(true);
        setDrilldownData(null);
        setDrilldownError(null);
        try {
            const params = new URLSearchParams({ metric, days: String(insightsWindowDays) });
            if (key) params.set("key", key);
            if (insightsData?.window.start) params.set("start", insightsData.window.start);
            if (insightsData?.window.end) params.set("end", insightsData.window.end);
            const data = await api(`/analytics/insights/drilldown?${params.toString()}`);
            setDrilldownData(data);
        } catch (err) {
            setDrilldownError(err instanceof Error ? err.message : "Failed to load drill-down data");
        } finally {
            setDrilldownLoading(false);
        }
    };

    const handleExportInsights = async () => {
        setInsightsExporting(true);
        try {
            const storedUser = localStorage.getItem("ecowatch_user");
            const userId = storedUser ? JSON.parse(storedUser).id : null;
            const res = await fetch(`${API_URL}/analytics/insights-export?days=${insightsWindowDays}`, {
                headers: { "X-User-Id": String(userId) },
            });
            if (!res.ok) throw new Error("Export failed");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `ecowatch_analytics_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            toast.success("Analytics CSV exported.");
        } catch (err) {
            toast.error("Export failed.");
        } finally {
            setInsightsExporting(false);
        }
    };
    const handleExportAnalytics = () => {
        try {
            const overview = {
                total: stats.total,
                pending,
                active: stats.active,
                failed_cleanup: stats.failed,
                resolved: stats.resolved,
                success_rate: successRate,
            };
            const ranking = barangayStats.map((b) => ({
                barangay: b.name,
                total_reports: b.total,
                resolved: b.resolved,
                active: reports.filter((r) => r.barangay === b.name && (r.status === 'assigned' || r.status === 'in_progress')).length,
                pending: reports.filter((r) => r.barangay === b.name && (r.status === 'pending' || r.status === 'verified')).length,
                resolution_rate: b.rate.toFixed(1),
            }));
            const csv = buildAnalyticsCsv(overview, ranking);
            downloadString(csv, `ecowatch_analytics_${new Date().toISOString().slice(0, 10)}.csv`);
            toast.success("Analytics CSV downloaded.");
        } catch (err) {
            toast.error("Export failed");
            console.error(err);
        }
    };

    const handleCopyPassword = async () => {
        if (!createdCredential) return;
        try {
            await navigator.clipboard.writeText(createdCredential.password);
            toast.success("Password copied to clipboard.");
        } catch {
            toast.error("Could not copy. Select the password manually.");
        }
    };

    if (loading || !user) {
        return (
            <PortalShell
                brand={{ name: "EcoWatch", suffix: "CJSDM" }}
                role="CENRO"
                nav={CENRO_NAV}
                activeKey={activeTab}
                onNavChange={() => {}}
                notificationCount={0}
                scrollable={activeTab !== 'command_center'}
            >
                <div className="max-w-[1600px] mx-auto h-full flex-1 grid grid-cols-1 lg:grid-cols-[2.5fr_1fr] gap-6 overflow-hidden p-1 pb-4">
                    {/* Left Section Skeleton */}
                    <div className="flex flex-col gap-4 min-h-0">
                        {/* Top Stats Bar Skeleton */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0 w-full">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="glass-pro p-4 md:p-5 rounded-2xl h-24 bg-foreground/[0.02] flex flex-col justify-center">
                                    <div className="h-2 w-16 bg-foreground/10 rounded mb-3 animate-pulse"></div>
                                    <div className="h-6 w-12 bg-foreground/10 rounded animate-pulse"></div>
                                </div>
                            ))}
                        </div>

                        {/* SLA Bar Skeleton */}
                        <div className="glass-pro h-[74px] rounded-2xl border border-border shrink-0 bg-foreground/[0.02] flex items-center px-5 gap-5">
                            <div className="w-10 h-10 rounded-xl bg-foreground/10 animate-pulse shrink-0"></div>
                            <div className="flex flex-col gap-2">
                                <div className="h-2 w-20 bg-foreground/10 rounded animate-pulse"></div>
                                <div className="h-4 w-8 bg-foreground/10 rounded animate-pulse"></div>
                            </div>
                            <div className="hidden md:block w-px self-stretch bg-border shrink-0 mx-1" />
                            <div className="hidden md:flex flex-col gap-2">
                                <div className="h-2 w-20 bg-foreground/10 rounded animate-pulse"></div>
                                <div className="flex gap-2">
                                    <div className="h-4 w-12 rounded bg-foreground/10 animate-pulse"></div>
                                    <div className="h-4 w-12 rounded bg-foreground/10 animate-pulse"></div>
                                    <div className="h-4 w-12 rounded bg-foreground/10 animate-pulse"></div>
                                </div>
                            </div>
                        </div>

                        {/* Map Skeleton */}
                        <div className="flex-1 glass rounded-2xl border border-border bg-foreground/[0.02] min-h-[400px] relative overflow-hidden">
                            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-foreground/20 via-transparent to-transparent animate-pulse"></div>
                            <div className="absolute top-4 left-4 h-6 w-32 bg-foreground/10 rounded-full animate-pulse"></div>
                        </div>
                    </div>

                    {/* Right Sidebar Skeleton */}
                    <div className="flex flex-col gap-4 overflow-y-auto pr-2 scrollbar-thin">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="glass-pro p-6 rounded-[2rem] bg-foreground/[0.02] flex flex-col shrink-0 min-h-[250px]">
                                <div className="h-3 w-24 bg-foreground/10 rounded mb-6 animate-pulse shrink-0"></div>
                                <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                                    {Array.from({ length: 3 }).map((_, j) => (
                                        <div className="flex items-center gap-3" key={j}>
                                            <div className="w-8 h-8 rounded-full bg-foreground/10 animate-pulse shrink-0"></div>
                                            <div className="flex-1 flex flex-col gap-2">
                                                <div className="h-2 bg-foreground/10 rounded animate-pulse w-3/4"></div>
                                                <div className="h-2 bg-foreground/10 rounded animate-pulse w-1/2"></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </PortalShell>
        );
    }

    const stats = {
        total: reports.length,
        resolved: reports.filter(r => r.status === 'resolved').length,
        active: reports.filter(r => r.status === 'assigned' || r.status === 'in_progress').length,
        failed: reports.filter(r => r.status === 'failed_cleanup').length,
    };
    const pending = stats.total - stats.resolved - stats.active - stats.failed;
    const successRate = stats.total > 0 ? Number(((stats.resolved / stats.total) * 100).toFixed(1)) : 0;

    const barangayStats = BARANGAYS.map(b => {
        const bReports = reports.filter(r => r.barangay === b);
        const total = bReports.length;
        const resolved = bReports.filter(r => r.status === 'resolved').length;
        const rate = total > 0 ? (resolved / total) * 100 : 0;
        return { name: b, total, resolved, rate };
    }).filter(b => b.total > 0).sort((a, b) => b.rate - a.rate);

    const toUTCMs = (iso: string) => new Date(iso.endsWith("Z") || iso.includes("+") || iso.includes("-", 10) ? iso : iso + "Z").getTime();
    const recentFeed = [...reports].sort((a, b) => toUTCMs(b.created_at) - toUTCMs(a.created_at)).slice(0, 10);

    const pieData = [
        { name: 'Pending', value: pending, color: '#ef4444' },
        { name: 'Active', value: stats.active, color: '#eab308' },
        { name: 'Failed', value: stats.failed, color: '#f97316' },
        { name: 'Resolved', value: stats.resolved, color: '#22c55e' }
    ].filter(d => d.value > 0);

    const dateMap: Record<string, number> = {};
    [...reports].sort((a, b) => toUTCMs(a.created_at) - toUTCMs(b.created_at)).forEach(r => {
        const d = new Date(r.created_at.endsWith("Z") || r.created_at.includes("+") || r.created_at.includes("-", 10) ? r.created_at : r.created_at + "Z").toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        dateMap[d] = (dateMap[d] || 0) + 1;
    });
    const lineData = Object.entries(dateMap).map(([date, count]) => ({ date, count })).slice(-14);

    return (
        <PortalShell
            brand={{ name: "EcoWatch", suffix: "CJSDM" }}
            role="CENRO"
            nav={CENRO_NAV}
            activeKey={activeTab}
            onNavChange={(k) => {
                setActiveTab(k as TabKey);
                router.replace('?tab=' + k, { scroll: false });
            }}
            notificationCount={unreadCount}
            scrollable={activeTab !== 'command_center'}
            actions={activeTab === 'command_center' ? (
                <button
                    onClick={handleExportAnalytics}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium shadow-sm hover:bg-primary/90 transition-colors shrink-0"
                    title="Export analytics summary as CSV"
                >
                    <Download size={14} />
                    <span className="hidden md:inline">Export CSV</span>
                </button>
            ) : undefined}
        >
            <div className="max-w-[1600px] mx-auto h-full flex flex-col">

                {/* ANALYTICS TAB */}
                {activeTab === 'analytics' && (
                    <AnalyticsTab
                        loading={insightsLoading}
                        data={insightsData}
                        windowDays={insightsWindowDays}
                        onWindowChange={setInsightsWindowDays}
                        exporting={insightsExporting}
                        onExport={handleExportInsights}
                        onRefresh={() => fetchInsights(insightsWindowDays)}
                        lastUpdated={insightsLastUpdated}
                        onDrilldown={handleDrilldown}
                    />
                )}

                {/* Barangay Management Tab */}
                {activeTab === 'barangay_management' && (
                    <>
                        <BarangayManagementTab
                            loading={barangayLoading}
                            error={barangayError}
                            cityWide={barangayCityWide}
                            barangays={barangayOverview}
                            exporting={barangayExporting}
                            onRefresh={fetchBarangayOverview}
                            onExport={handleExportBarangayPerformance}
                            onSelectBarangay={setSelectedBarangayRow}
                            onAssignAdmin={handleAssignBarangayAdmin}
                        />
                        <BarangayDetailDrawer
                            open={selectedBarangayRow !== null}
                            barangay={selectedBarangayRow}
                            onClose={() => setSelectedBarangayRow(null)}
                            onAssignAdmin={handleAssignBarangayAdmin}
                            onReassignAdmin={handleReassignBarangayAdmin}
                            onDisableAdmin={handleDisableBarangayAdmin}
                            onViewOnMap={() => setActiveTab('overview')}
                        />
                    </>
                )}

                {/* SLA MANAGEMENT TAB */}
                {activeTab === 'sla_management' && (
                    <SlaManagementTab
                        loading={slaManagementLoading}
                        compliance={slaCompliance}
                        breached={breachedWOs}
                        atRisk={atRiskWOs}
                        history={slaHistory}
                        lastModified={slaLastModified}
                        slaPolicy={slaPolicy}
                        exporting={slaExporting}
                        onExport={handleExportSlaReport}
                        onEditPolicy={() => setShowSlaModal(true)}
                        onRefresh={fetchSlaManagementData}
                    />
                )}

                {activeTab === 'command_center' && (
                    /* COMMAND CENTER TAB */
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-[2.5fr_1fr] gap-6 overflow-hidden pb-4">

                        {/* Left: Main Content */}
                        <div className="flex flex-col gap-4 min-h-0">
                            {/* Top Stats Bar */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0 animate-slide-up stagger-1 w-full">
                                <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
                                    <div className="flex flex-row items-center justify-between p-4 pb-2">
                                        <h3 className="text-xs font-medium text-muted-foreground tracking-tight">Total Reports</h3>
                                    </div>
                                    <div className="p-4 pt-0">
                                        <div className="text-xl md:text-2xl font-bold">{stats.total}</div>
                                    </div>
                                </div>
                                <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
                                    <div className="flex flex-row items-center justify-between p-4 pb-2">
                                        <h3 className="text-xs font-medium text-muted-foreground tracking-tight">Active/Pending</h3>
                                    </div>
                                    <div className="p-4 pt-0 flex items-baseline gap-2">
                                        <div className="text-xl md:text-2xl font-bold">{pending}</div>
                                        {pending > 0 && <span className="text-[10px] text-red-500 font-medium">needs action</span>}
                                    </div>
                                </div>
                                <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
                                    <div className="flex flex-row items-center justify-between p-4 pb-2">
                                        <h3 className="text-xs font-medium text-muted-foreground tracking-tight">Active Cleanups</h3>
                                    </div>
                                    <div className="p-4 pt-0">
                                        <div className="text-xl md:text-2xl font-bold">{stats.active}</div>
                                    </div>
                                </div>
                                <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
                                    <div className="flex flex-row items-center justify-between p-4 pb-2">
                                        <h3 className="text-xs font-medium text-muted-foreground tracking-tight">Success Rate</h3>
                                    </div>
                                    <div className="p-4 pt-0">
                                        <div className="text-xl md:text-2xl font-bold">{successRate}%</div>
                                    </div>
                                </div>
                            </div>

                            {/* Merged SLA bar */}
                            <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm px-4 py-3 shrink-0 flex flex-col md:flex-row items-start md:items-center gap-4 animate-slide-up stagger-2 overflow-hidden">
                                {/* Breach icon */}
                                <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${slaBreaches.length > 0 ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                                    <AlertTriangle size={16} />
                                </div>

                                {/* Breach info */}
                                <div className="min-w-0 flex-1 md:flex-none">
                                    <div className="text-[11px] font-medium text-muted-foreground mb-0.5">SLA Breaches</div>
                                    <div className="text-lg font-bold leading-none mb-1 text-foreground">
                                        {slaBreaches.length}
                                    </div>
                                    {slaBreaches.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5">
                                            {slaBreaches.slice(0, 3).map((r) => {
                                                const sla = slaInfo(r.created_at, r.status);
                                                return (
                                                    <span key={r.id} className="px-1.5 py-0.5 rounded-sm text-[10px] font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                                                        {r.tracking_id}{sla ? ` ${sla.days}d` : ''}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-muted-foreground">All on schedule</p>
                                    )}
                                </div>

                                {slaBreaches.length > 0 && (
                                    <button
                                        onClick={() => {
                                            setOversightStatus("");
                                            setOversightSearch("");
                                            setOversightDateRange(undefined);
                                            setOversightBarangay("");
                                            setActiveTab('oversight');
                                        }}
                                        className="text-xs font-medium text-primary hover:underline shrink-0"
                                    >
                                        View Queue →
                                    </button>
                                )}

                                {/* Divider */}
                                <div className="hidden md:block w-px self-stretch bg-border shrink-0 mx-2" />
                                <div className="md:hidden h-px w-full bg-border shrink-0 my-1" />

                                {/* Policy info */}
                                <div className="min-w-0">
                                    <div className="text-[11px] font-medium text-muted-foreground mb-1.5">SLA Policy</div>
                                    <div className="flex gap-1.5 mb-1">
                                        <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-medium bg-green-500/10 text-green-500 border border-green-500/20">Low {slaPolicy.low}d</span>
                                        <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-medium bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20">Med {slaPolicy.medium}d</span>
                                        <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-medium bg-red-500/10 text-red-500 border border-red-500/20">High {slaPolicy.high}d</span>
                                    </div>
                                    <button
                                        onClick={() => setShowSlaModal(true)}
                                        className="text-[11px] font-medium text-primary hover:underline"
                                    >
                                        Edit Policy →
                                    </button>
                                </div>
                            </div>

                            {/* Map hero */}
                            <div className="flex-1 rounded-lg border border-border bg-card text-card-foreground shadow-sm overflow-hidden relative min-h-[400px] animate-slide-up stagger-3">
                                <div className="absolute top-3 left-3 z-[1000] bg-background/80 backdrop-blur-md px-2 py-1 rounded text-[11px] font-medium text-foreground border border-border pointer-events-none shadow-sm flex items-center gap-1.5">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                    Live City Map
                                </div>
                                <MapComponent height="100%" reports={reports} heatmaps={heatmaps} focusedBarangay={null} onBarangayClick={() => {}} />
                            </div>
                        </div>

                        {/* Right: Scrollable Sidebar */}
                        <div className="flex flex-col gap-4 overflow-y-auto pr-2 scrollbar-thin animate-slide-up stagger-4">
                            {/* City-Wide Trend */}
                            <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm flex flex-col shrink-0 min-h-[250px]">
                                <div className="p-4 pb-2 shrink-0">
                                    <h3 className="text-xs font-medium text-muted-foreground tracking-tight">City-Wide Trend</h3>
                                </div>
                                <div className="p-4 pt-0 flex-1 relative min-h-[80px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={lineData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                            <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={9} tickMargin={8} axisLine={false} tickLine={false} />
                                            <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px' }} />
                                            <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={1.5} dot={{ r: 2.5, fill: '#10b981', strokeWidth: 1.5, stroke: 'var(--background)' }} activeDot={{ r: 4, fill: '#34d399' }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Live Feed */}
                            <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm flex flex-col shrink-0 min-h-[250px]">
                                <div className="p-4 pb-2 shrink-0">
                                    <h3 className="text-xs font-medium text-muted-foreground tracking-tight">Live Feed</h3>
                                </div>
                                <div className="p-4 pt-0 flex-1 overflow-y-auto pr-4 space-y-3 scrollbar-hide">
                                    {recentFeed.map(r => (
                                        <div key={r.id} className="relative pl-3 border-l-2 border-border">
                                            <div className="absolute w-1.5 h-1.5 rounded-full bg-emerald-500 -left-[4px] top-1.5"></div>
                                            <div className="text-[11px] font-medium text-foreground mb-0.5">Report {r.tracking_id}</div>
                                            <div className="text-[9px] text-muted-foreground mb-1">{r.barangay} • {formatRelative(r.created_at)}</div>
                                            <span className={`px-1.5 py-0.5 rounded-sm text-[9px] font-medium border ${
                                                r.status === 'resolved' ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' :
                                                r.status === 'assigned' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20' :
                                                r.status === 'in_progress' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' :
                                                r.status === 'verified' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' :
                                                r.status === 'failed_cleanup' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' :
                                                r.status === 'rejected' ? 'bg-muted text-muted-foreground border-border' :
                                                'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                                            }`}>{r.status}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Status Breakdown */}
                            <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm flex flex-col shrink-0 min-h-[250px]">
                                <div className="p-4 pb-2 shrink-0">
                                    <h3 className="text-xs font-medium text-muted-foreground tracking-tight">Status Breakdown</h3>
                                </div>
                                <div className="p-4 pt-0 flex-1 flex flex-col min-h-0">
                                    <div className="flex-1 relative min-h-[100px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value" stroke="none">
                                                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                                </Pie>
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px' }}
                                                    itemStyle={{ color: 'var(--foreground)', fontSize: '11px', fontWeight: '500' }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex flex-wrap justify-center gap-3 mt-4 shrink-0">
                                        {pieData.map(d => (
                                            <div key={d.name} className="flex items-center gap-1.5 text-[11px] font-medium text-foreground/80">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></div>
                                                {d.name}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Barangay Rankings */}
                            <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm flex flex-col shrink-0 min-h-[250px]">
                                <div className="p-4 pb-2 shrink-0">
                                    <h3 className="text-xs font-medium text-muted-foreground tracking-tight">Barangay Rankings</h3>
                                </div>
                                <div className="p-4 pt-0 flex-1 overflow-y-auto pr-4 space-y-1.5 scrollbar-hide">
                                    {barangayStats.map((b, i) => (
                                        <div key={b.name} className="flex items-center justify-between py-1.5 group">
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">{i + 1}</div>
                                                <div className="text-[13px] font-medium text-foreground truncate max-w-[120px]">{b.name}</div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="text-[13px] font-medium text-foreground">{b.rate.toFixed(0)}%</div>
                                                <div className="text-[9px] text-muted-foreground">{b.resolved} res.</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    </div>
                )}

                {activeTab === 'overview' && (
                    /* OVERVIEW TAB (Map + Stats) */
                    <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
                        {/* Left: Stats Column */}
                        <div className="flex-1 lg:max-w-xs flex flex-col gap-3">
                            <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm flex flex-col">
                                <div className="p-4 pb-2 flex items-center justify-between">
                                    <h3 className="text-xs font-medium text-muted-foreground tracking-tight">Total Reports</h3>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/60"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                                </div>
                                <div className="p-4 pt-0">
                                    <div className="text-2xl font-bold">{stats.total}</div>
                                </div>
                            </div>

                            <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm flex flex-col">
                                <div className="p-4 pb-2 flex items-center justify-between">
                                    <h3 className="text-xs font-medium text-muted-foreground tracking-tight">City Success Rate</h3>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/60"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                </div>
                                <div className="p-4 pt-0">
                                    <div className="text-2xl font-bold">{successRate}%</div>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{stats.resolved} resolved out of {stats.total}</p>
                                </div>
                            </div>

                            <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm flex flex-col flex-1 min-h-[200px]">
                                <div className="p-4 pb-2 shrink-0">
                                    <h3 className="text-xs font-medium text-muted-foreground tracking-tight">Active Hotspots</h3>
                                </div>
                                <div className="p-4 pt-0 flex-1 overflow-y-auto space-y-1.5 scrollbar-hide">
                                    {heatmaps.length === 0 ? (
                                        <p className="text-[11px] text-muted-foreground italic">No significant hotspots detected.</p>
                                    ) : (
                                        heatmaps.map((h, i) => (
                                            <div key={i} className="flex items-center justify-between py-1.5 group border-b border-border last:border-0">
                                                <div>
                                                    <div className="text-[13px] font-medium text-foreground">Cluster {h.cluster_id}</div>
                                                    <div className="text-[9px] text-red-500 font-medium">{h.intensity} Intensity</div>
                                                </div>
                                                <div className="text-sm font-bold text-foreground">{h.report_count}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right: Map */}
                        <div className="flex-[3] rounded-lg border border-border bg-card shadow-sm overflow-hidden relative min-h-[400px]">
                            <div className="absolute top-3 left-3 z-[1000] bg-background/80 backdrop-blur-md px-2 py-1 rounded text-[11px] font-medium text-foreground border border-border pointer-events-none shadow-sm flex items-center gap-1.5">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                City-Wide Live Map
                            </div>
                            <MapComponent
                                height="100%"
                                reports={reports}
                                heatmaps={heatmaps}
                                focusedBarangay={null}
                                onBarangayClick={() => {}}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'oversight' && (
                    /* OVERSIGHT QUEUE TAB */
                    <div className="flex-1 rounded-lg border border-border bg-card flex flex-col min-h-0 shadow-sm">
                        <div className="p-5 border-b border-border shrink-0">
                            <h2 className="text-lg font-semibold text-foreground tracking-tight">Global Report Queue</h2>
                            <p className="text-sm text-muted-foreground mt-1">Manage overrides and cross-barangay assignments.</p>
                        </div>

                        {/* C4 — Filter Bar */}
                        <div className="flex flex-col lg:flex-row gap-3 p-4 border-b border-border shrink-0">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                <input
                                    type="text"
                                    value={oversightSearch}
                                    onChange={(e) => setOversightSearch(e.target.value)}
                                    placeholder="Search tracking ID or notes…"
                                    className="w-full pl-9 pr-3 h-9 rounded-md bg-transparent border border-border text-foreground text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                                />
                            </div>
                            <select
                                value={oversightStatus}
                                onChange={(e) => setOversightStatus(e.target.value)}
                                className="px-3 h-9 rounded-md bg-transparent border border-border text-foreground text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                            >
                                {STATUS_OPTIONS.map((s) => (
                                    <option key={s || "all"} value={s}>{s ? s : "All statuses"}</option>
                                ))}
                            </select>
                            <select
                                value={oversightBarangay}
                                onChange={(e) => setOversightBarangay(e.target.value)}
                                className="px-3 h-9 rounded-md bg-transparent border border-border text-foreground text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                            >
                                <option value="">All barangays</option>
                                {BARANGAYS.map((b) => (
                                    <option key={b} value={b}>{b}</option>
                                ))}
                            </select>
                            <DateRangePicker 
                                date={oversightDateRange} 
                                onDateChange={setOversightDateRange} 
                            />
                        </div>

                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-border text-xs text-muted-foreground font-medium tracking-tight bg-foreground/[0.02] sticky top-0 z-10">
                                        <th className="p-4">Tracking ID</th>
                                        <th className="p-4">Barangay</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4">Open</th>
                                        <th className="p-4">Date Reported</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {queueLoading ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <tr key={i} className="border-b border-border">
                                                {Array.from({ length: 5 }).map((__, j) => (
                                                    <td key={j} className="p-4"><div className="h-3 bg-foreground/10 rounded animate-pulse" /></td>
                                                ))}
                                            </tr>
                                        ))
                                    ) : displayedQueueReports.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-12 text-center">
                                                <div className="flex flex-col items-center justify-center gap-3">
                                                    <div className="w-12 h-12 rounded-full bg-foreground/5 flex items-center justify-center text-foreground/30">
                                                        <FileText size={24} />
                                                    </div>
                                                    <div className="text-foreground/50 font-bold">No reports match the current filters</div>
                                                    <div className="text-xs text-foreground/30">Try adjusting your search or status filter.</div>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedQueueReports.map(report => {
                                            const sla = slaInfo(report.created_at, report.status);
                                            return (
                                                <tr key={report.id} className="border-b border-border hover:bg-foreground/5 transition-colors cursor-pointer" onClick={() => { setSelectedReport(report); setNewBarangay(report.barangay ?? ""); }}>
                                                    <td className="p-4 font-mono text-sm text-foreground font-medium">
                                                        {report.tracking_id}
                                                        {report.possible_duplicate_flag && report.status !== 'duplicate' && (
                                                            <span title="A nearby open report may be a duplicate" className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-tight bg-amber-500/20 text-amber-500 align-middle">⚠ DUP?</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-sm font-medium text-foreground">{report.barangay}</td>
                                                    <td className="p-4">
                                                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                                                            report.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                                                            report.status === 'assigned' ? 'bg-yellow-500/20 text-yellow-400' :
                                                            report.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                                                            report.status === 'verified' ? 'bg-orange-500/20 text-orange-400' :
                                                            report.status === 'pending' ? 'bg-red-500/20 text-red-400' :
                                                            report.status === 'failed_cleanup' ? 'bg-red-900/30 text-red-400' :
                                                            report.status === 'rejected' ? 'bg-foreground/5 text-foreground/40' :
                                                            'bg-foreground/10 text-foreground'
                                                        }`}>
                                                            {report.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        {sla ? (
                                                            <span className={`px-2 py-1 rounded-md text-[11px] font-bold ${SLA_PILL_CLASSES[sla.color]}`}>{sla.days}d</span>
                                                        ) : (
                                                            <span className="text-foreground/30 text-sm">—</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-sm text-foreground/60">
                                                        {formatDate(report.created_at)}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'audit' && (
                    /* C1 — AUDIT LOG TAB */
                    <div className="flex-1 glass rounded-2xl border border-border flex flex-col min-h-0 shadow-2xl">
                        <div className="p-6 border-b border-border shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-foreground">Audit Log</h2>
                                <p className="text-sm text-foreground/50">Every override action — who, when, what, why.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest">Action</label>
                                <select
                                    value={auditAction}
                                    onChange={(e) => setAuditAction(e.target.value)}
                                    className="px-2 py-2 rounded-lg bg-foreground/5 border border-border text-foreground text-xs focus:border-primary focus:outline-none"
                                >
                                    {ACTION_FILTER_OPTIONS.map((a) => (
                                        <option key={a} value={a}>{a === "all" ? "All actions" : a}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-border text-xs text-muted-foreground font-medium tracking-tight bg-foreground/[0.02] sticky top-0 z-10">
                                        <th className="p-4">Timestamp</th>
                                        <th className="p-4">User</th>
                                        <th className="p-4">Action</th>
                                        <th className="p-4">Target</th>
                                        <th className="p-4">Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {auditLoading && auditEntries.length === 0 ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <tr key={i} className="border-b border-border">
                                                {Array.from({ length: 5 }).map((__, j) => (
                                                    <td key={j} className="p-4"><div className="h-3 bg-foreground/10 rounded animate-pulse" /></td>
                                                ))}
                                            </tr>
                                        ))
                                    ) : displayedAuditEntries.length === 0 ? (
                                        <tr><td colSpan={5} className="p-12 text-center text-foreground/50 font-bold">No audit entries match this filter.</td></tr>
                                    ) : (
                                        displayedAuditEntries.map((e) => {
                                            const detailsStr = e.details && Object.keys(e.details).length ? JSON.stringify(e.details) : "";
                                            const targetLabel = e.details?.tracking_id || `${e.target_type} #${e.target_id ?? "—"}`;
                                            return (
                                                <tr key={e.id} className="border-b border-border hover:bg-foreground/5">
                                                    <td className="p-4 text-xs text-foreground/70 whitespace-nowrap">{formatDateTime(e.created_at)}</td>
                                                    <td className="p-4 text-sm text-foreground">{e.user_email || "—"}</td>
                                                    <td className="p-4">
                                                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${ACTION_PILL_CLASSES[e.action] || 'bg-foreground/10 text-foreground'}`}>
                                                            {e.action}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-xs font-mono text-emerald-300">{targetLabel}</td>
                                                    <td className="p-4 text-[11px] text-foreground/60 font-mono max-w-md truncate" title={detailsStr}>
                                                        {detailsStr.length > 80 ? detailsStr.slice(0, 80) + "…" : detailsStr}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {auditHasMore && (
                            <div className="p-4 border-t border-border shrink-0 flex justify-center">
                                <button
                                    onClick={() => fetchAuditLog(auditOffset + 50)}
                                    disabled={auditLoading}
                                    className="px-6 py-2 rounded-lg bg-foreground/5 border border-border text-foreground text-xs font-bold uppercase tracking-widest hover:bg-foreground/10 disabled:opacity-50"
                                >
                                    {auditLoading ? "Loading…" : "Load more"}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'gallery' && (
                    <EvidenceGalleryTab 
                        reports={reports} 
                        barangays={BARANGAYS} 
                        onReportClick={setSelectedReport} 
                    />
                )}

                {activeTab === 'users' && (() => {
                    const ROLE_BADGE: Record<string, string> = {
                        cenro: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
                        barangay: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
                        cleaner: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
                        citizen: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
                    };
                    const ROLE_LABEL: Record<string, string> = {
                        cenro: "CENRO Admin", barangay: "Barangay Coordinator", cleaner: "Cleanup Team", citizen: "Citizen",
                    };
                    const filtered = barangayUsers.filter((u) => {
                        if (userRoleFilter !== "all" && u.role !== userRoleFilter) return false;
                        if (userStatusFilter === "active" && !u.is_active) return false;
                        if (userStatusFilter === "disabled" && u.is_active) return false;
                        const q = debouncedUserSearch.toLowerCase();
                        if (q && !u.full_name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
                        return true;
                    });
                    const totalPages = Math.max(1, Math.ceil(filtered.length / USER_PAGE_SIZE));
                    const pg = Math.min(userPage, totalPages);
                    const paged = filtered.slice((pg - 1) * USER_PAGE_SIZE, pg * USER_PAGE_SIZE);
                    const getInitials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
                    const fmtLogin = (ts: string | null) => {
                        if (!ts) return "Never";
                        return formatRelative(ts);
                    };
                    return (
                    <div className="flex-1 flex flex-col min-h-0 gap-4">
                        {/* Page header */}
                        <div className="flex items-center justify-between gap-3 shrink-0">
                            <div>
                                <h2 className="text-lg font-semibold text-foreground">System Accounts</h2>
                                <p className="text-xs text-foreground/50">Administrative control panel for EcoWatch user access.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={handleExportCSV} className="flex items-center gap-2 px-3 py-2 glass border border-border text-foreground/70 text-xs font-bold hover:bg-foreground/10 rounded-lg transition-colors">
                                    <FileDown size={13} /> Export CSV
                                </button>
                                <button onClick={() => { setImportStep(1); setImportFile(null); setImportResults([]); setImportSummary(null); setShowImportModal(true); }} className="flex items-center gap-2 px-3 py-2 glass border border-border text-foreground/70 text-xs font-bold hover:bg-foreground/10 rounded-lg transition-colors">
                                    <Upload size={13} /> Import CSV
                                </button>
                                <button onClick={() => setShowCreateUserModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-emerald-400 text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-primary/20">
                                    <Plus size={13} /> Create Account
                                </button>
                            </div>
                        </div>

                        {/* Filter bar */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
                            <div className="relative flex-1 min-w-[220px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" size={15} />
                                <input
                                    type="text"
                                    value={userSearch}
                                    onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                                    placeholder="Search accounts by name or email…"
                                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground text-sm placeholder:text-foreground/40 focus:border-primary focus:outline-none"
                                />
                            </div>
                            <select value={userRoleFilter} onChange={(e) => { setUserRoleFilter(e.target.value); setUserPage(1); }} className="px-3 py-2 glass border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary">
                                <option value="all">All Roles</option>
                                <option value="citizen">Citizen</option>
                                <option value="barangay">Barangay Coordinator</option>
                                <option value="cleaner">Cleanup Team</option>
                                <option value="cenro">CENRO Admin</option>
                            </select>
                            <select value={userStatusFilter} onChange={(e) => { setUserStatusFilter(e.target.value); setUserPage(1); }} className="px-3 py-2 glass border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary">
                                <option value="all">All Status</option>
                                <option value="active">Active</option>
                                <option value="disabled">Disabled</option>
                            </select>
                            <span className="text-xs text-foreground/40 whitespace-nowrap">Showing {filtered.length} account{filtered.length !== 1 ? "s" : ""}</span>
                        </div>

                        {/* Table */}
                        <div className="flex-1 glass rounded-2xl border border-border flex flex-col min-h-0 shadow-2xl overflow-hidden">
                            <div className="flex-1 overflow-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-border text-xs text-muted-foreground font-medium tracking-tight bg-foreground/[0.02] sticky top-0 z-10">
                                            <th className="p-4 pl-5 w-10"></th>
                                            <th className="p-4">Full Name</th>
                                            <th className="p-4">Email Address</th>
                                            <th className="p-4">Role</th>
                                            <th className="p-4">Barangay</th>
                                            <th className="p-4">Phone Number</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4">Last Login</th>
                                            <th className="p-4 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {usersLoading ? (
                                            Array.from({ length: 5 }).map((_, i) => (
                                                <tr key={i} className="border-b border-border">
                                                    {Array.from({ length: 9 }).map((__, j) => (
                                                        <td key={j} className="p-4"><div className="h-3 bg-foreground/10 rounded animate-pulse" /></td>
                                                    ))}
                                                </tr>
                                            ))
                                        ) : paged.length === 0 ? (
                                            <tr>
                                                <td colSpan={9} className="p-12 text-center text-foreground/40">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <UserX size={32} className="opacity-30" />
                                                        <p className="font-bold">No accounts found</p>
                                                        <p className="text-xs">Try adjusting your filters or create a new account.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            paged.map((u) => (
                                                <tr key={u.id} className="border-b border-border hover:bg-foreground/5">
                                                    <td className="p-4 pl-5 w-10"></td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                                                                {getInitials(u.full_name)}
                                                            </div>
                                                            <span className="text-sm font-medium text-foreground">{u.full_name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-sm text-foreground/70 font-mono">{u.email}</td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${ROLE_BADGE[u.role] || "bg-foreground/10 text-foreground/60"}`}>
                                                            {ROLE_LABEL[u.role] || u.role}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-sm text-foreground/70">{u.barangay_assignment || <span className="text-foreground/30">—</span>}</td>
                                                    <td className="p-4 text-sm text-foreground/70">{u.phone_number || <span className="text-foreground/30 text-xs italic">No phone provided</span>}</td>
                                                    <td className="p-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${u.is_active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? "bg-green-400" : "bg-red-400"}`} />
                                                            {u.is_active ? "Active" : "Disabled"}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-sm text-foreground/50">{fmtLogin(u.last_login_at)}</td>
                                                    <td className="p-4 w-10">
                                                        <div className="relative">
                                                            <button onClick={() => setUserActionsMenu(userActionsMenu === u.id ? null : u.id)} className="p-1.5 rounded-lg hover:bg-foreground/10 text-foreground/50 hover:text-foreground transition-colors">
                                                                <MoreVertical size={16} />
                                                            </button>
                                                            {userActionsMenu === u.id && (
                                                                <div className="absolute right-0 top-full mt-1 z-50 w-44 glass border border-border rounded-xl shadow-2xl overflow-hidden">
                                                                    <button onClick={() => openEditUser(u)} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-foreground/10 text-foreground transition-colors">
                                                                        <Edit2 size={13} className="text-foreground/50" /> Edit Account
                                                                    </button>
                                                                    <button onClick={() => openResetPassword(u)} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-foreground/10 text-foreground transition-colors">
                                                                        <Key size={13} className="text-foreground/50" /> Reset Password
                                                                    </button>
                                                                    <div className="border-t border-border" />
                                                                    {u.is_active ? (
                                                                        <button onClick={() => { handleDisableUser(u.id, u.email); setUserActionsMenu(null); }} disabled={disabling.has(u.id)} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-red-500/10 text-red-400 transition-colors disabled:opacity-50">
                                                                            <UserX size={13} /> {disabling.has(u.id) ? "Disabling…" : "Disable"}
                                                                        </button>
                                                                    ) : (
                                                                        <button onClick={() => { handleReactivateUser(u.id, u.email); setUserActionsMenu(null); }} disabled={reactivating.has(u.id)} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-green-500/10 text-green-400 transition-colors disabled:opacity-50">
                                                                            <UserCheck size={13} /> {reactivating.has(u.id) ? "Reactivating…" : "Reactivate"}
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
                            {totalPages > 1 && (
                                <div className="border-t border-border px-5 py-3 flex items-center justify-between shrink-0">
                                    <span className="text-xs text-foreground/40">Showing {(pg-1)*USER_PAGE_SIZE+1}–{Math.min(pg*USER_PAGE_SIZE, filtered.length)} of {filtered.length} entries</span>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => setUserPage((p) => Math.max(1, p-1))} disabled={pg === 1} className="p-1.5 rounded hover:bg-foreground/10 disabled:opacity-30 text-foreground/60"><ChevronLeft size={15} /></button>
                                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                                            <button key={p} onClick={() => setUserPage(p)} className={`w-7 h-7 rounded text-xs font-bold ${p === pg ? "bg-primary text-white" : "hover:bg-foreground/10 text-foreground/60"}`}>{p}</button>
                                        ))}
                                        <button onClick={() => setUserPage((p) => Math.min(totalPages, p+1))} disabled={pg === totalPages} className="p-1.5 rounded hover:bg-foreground/10 disabled:opacity-30 text-foreground/60"><ChevronRight size={15} /></button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Info cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
                            <div className="glass rounded-xl border border-border p-4 flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0"><Upload size={15} className="text-emerald-400" /></div>
                                <div><p className="text-xs font-bold text-foreground">Bulk Onboarding</p><p className="text-[11px] text-foreground/50 mt-0.5">Use the Import CSV tool to add multiple Barangay Coordinators at once.</p></div>
                            </div>
                            <div className="glass rounded-xl border border-border p-4 flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center shrink-0"><AlertTriangle size={15} className="text-yellow-400" /></div>
                                <div><p className="text-xs font-bold text-foreground">Security Audit</p><p className="text-[11px] text-foreground/50 mt-0.5">Accounts with no activity for 30 days are automatically flagged for review.</p></div>
                            </div>
                            <div className="glass rounded-xl border border-border p-4 flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0"><RefreshCw size={15} className="text-blue-400" /></div>
                                <div><p className="text-xs font-bold text-foreground">Account Recovery</p><p className="text-[11px] text-foreground/50 mt-0.5">Admins can reactivate disabled accounts or reset credentials securely.</p></div>
                            </div>
                        </div>
                    </div>
                    );
                })()}
            </div>

            <ReportDetailDrawer
                open={selectedReport !== null}
                report={selectedReport}
                barangays={[...BARANGAYS]}
                newBarangay={newBarangay}
                setNewBarangay={setNewBarangay}
                actionLoading={actionLoading}
                onClose={() => setSelectedReport(null)}
                onReassign={() => selectedReport && handleReassign(selectedReport.id)}
                onForceClose={() => selectedReport && handleForceClose(selectedReport.id)}
                onUpdated={() => fetchQueueData()}
            />

            {/* Analytics Drill-down Modal */}
            <AnalyticsDrilldownModal
                open={drilldownOpen}
                loading={drilldownLoading}
                error={drilldownError}
                data={drilldownData}
                onClose={() => setDrilldownOpen(false)}
                onRowClick={(row) => {
                    setDrilldownOpen(false);
                    setSelectedReport(row);
                }}
            />

            {/* Create Account Modal */}
            {showCreateUserModal && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="glass max-w-md w-full rounded-2xl border border-border overflow-hidden shadow-2xl">
                        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
                            <div><h2 className="text-base font-semibold text-foreground">Create New Account</h2><p className="text-xs text-foreground/50 mt-0.5">Provision a new system user with specific access rights.</p></div>
                            <button onClick={() => setShowCreateUserModal(false)} className="p-2 text-foreground/50 hover:text-foreground bg-foreground/5 hover:bg-foreground/10 rounded-full transition-colors"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest mb-1.5 block">System Role <span className="text-red-400">*</span></label>
                                <select value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value, barangay_assignment: "" })} className="w-full px-3 py-2.5 rounded-lg bg-foreground/5 border border-border text-foreground text-sm focus:border-primary focus:outline-none">
                                    <option value="">Select user role</option>
                                    <option value="citizen">Citizen</option>
                                    <option value="barangay">Barangay Coordinator</option>
                                    <option value="cleaner">Cleanup Team Member</option>
                                    <option value="cenro">CENRO Admin</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest mb-1.5 block">Full Name <span className="text-red-400">*</span></label>
                                    <input type="text" value={createForm.full_name} onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })} placeholder="e.g. Maria Clara" className="w-full px-3 py-2.5 rounded-lg bg-foreground/5 border border-border text-foreground text-sm focus:border-primary focus:outline-none placeholder:text-foreground/30" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest mb-1.5 block">Phone Number</label>
                                    <input type="tel" value={createForm.phone_number} onChange={(e) => setCreateForm({ ...createForm, phone_number: e.target.value })} placeholder="0912 345 6789" className="w-full px-3 py-2.5 rounded-lg bg-foreground/5 border border-border text-foreground text-sm focus:border-primary focus:outline-none placeholder:text-foreground/30" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest mb-1.5 block">Email Address <span className="text-red-400">*</span></label>
                                <input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} placeholder="m.clara@ecowatch.ph" className="w-full px-3 py-2.5 rounded-lg bg-foreground/5 border border-border text-foreground text-sm focus:border-primary focus:outline-none placeholder:text-foreground/30" />
                            </div>
                            {["barangay", "cleaner"].includes(createForm.role) && (
                                <div>
                                    <label className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest mb-1.5 block">Barangay Assignment <span className="text-red-400">*</span></label>
                                    <select value={createForm.barangay_assignment} onChange={(e) => setCreateForm({ ...createForm, barangay_assignment: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-foreground/5 border border-border text-foreground text-sm focus:border-primary focus:outline-none">
                                        <option value="">Select barangay</option>
                                        {BARANGAYS.map((b) => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>
                            )}
                            <div className="rounded-xl bg-foreground/5 border border-border p-4">
                                <p className="text-[10px] font-bold text-foreground/60 uppercase tracking-widest mb-1">Security Notice</p>
                                <p className="text-[11px] text-foreground/50 leading-relaxed">Account creation logs are audited. Temporary passwords are shown once only. Role permissions cannot be changed without admin approval.</p>
                            </div>
                            <div className="flex gap-3 pt-1">
                                <button onClick={() => setShowCreateUserModal(false)} className="flex-1 py-2.5 glass border border-border text-foreground text-sm font-bold rounded-lg hover:bg-foreground/10 transition-colors">Cancel</button>
                                <button onClick={handleCreateUser} disabled={createPending || !createForm.role || !createForm.email || !createForm.full_name} className="flex-1 py-2.5 bg-primary hover:bg-emerald-400 text-white text-sm font-bold rounded-lg shadow-lg shadow-primary/20 disabled:opacity-50 transition-colors">
                                    {createPending ? "Creating..." : "Generate Account"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Account Modal */}
            {showEditUserModal && editTarget && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="glass max-w-md w-full rounded-2xl border border-border overflow-hidden shadow-2xl">
                        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
                            <div><h2 className="text-base font-semibold text-foreground">Edit User Account</h2><p className="text-xs text-foreground/50 mt-0.5">Modify contact details for {editTarget.full_name}.</p></div>
                            <button onClick={() => setShowEditUserModal(false)} className="p-2 text-foreground/50 hover:text-foreground bg-foreground/5 hover:bg-foreground/10 rounded-full transition-colors"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-4 p-4 rounded-xl bg-foreground/5 border border-border">
                                <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                                    {editTarget.full_name.split(" ").map((p: string) => p[0]).join("").slice(0,2).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-foreground">{editTarget.full_name}</p>
                                    <p className="text-xs text-foreground/50">ID: EW-{String(editTarget.id).padStart(4, "0")}</p>
                                </div>
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${editTarget.role === "cenro" ? "bg-purple-500/20 text-purple-300" : editTarget.role === "barangay" ? "bg-emerald-500/20 text-emerald-300" : editTarget.role === "cleaner" ? "bg-blue-500/20 text-blue-300" : "bg-yellow-500/20 text-yellow-300"}`}>
                                    {editTarget.role === "cenro" ? "CENRO Admin" : editTarget.role === "barangay" ? "Barangay Coordinator" : editTarget.role === "cleaner" ? "Cleanup Team" : "Citizen"}
                                </span>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest mb-1.5 block">Full Name</label>
                                <input type="text" value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-foreground/5 border border-border text-foreground text-sm focus:border-primary focus:outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest mb-1.5 block">Email Address</label>
                                    <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-foreground/5 border border-border text-foreground text-sm focus:border-primary focus:outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest mb-1.5 block">Phone Number</label>
                                    <input type="tel" value={editForm.phone_number} onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })} placeholder="+63 917 123 4567" className="w-full px-3 py-2.5 rounded-lg bg-foreground/5 border border-border text-foreground text-sm focus:border-primary focus:outline-none placeholder:text-foreground/30" />
                                </div>
                            </div>
                            {["barangay", "cleaner"].includes(editTarget.role) && (
                                <div>
                                    <label className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest mb-1.5 block">Barangay Assignment</label>
                                    <select value={editForm.barangay_assignment} onChange={(e) => setEditForm({ ...editForm, barangay_assignment: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-foreground/5 border border-border text-foreground text-sm focus:border-primary focus:outline-none">
                                        <option value="">Select barangay</option>
                                        {BARANGAYS.map((b) => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                    <p className="text-[10px] text-foreground/40 mt-1">Assigning a barangay restricts data visibility to that specific area only.</p>
                                </div>
                            )}
                            <div className="flex gap-3 pt-1">
                                <button onClick={() => setShowEditUserModal(false)} className="flex-1 py-2.5 glass border border-border text-foreground text-sm font-bold rounded-lg hover:bg-foreground/10 transition-colors">Cancel Changes</button>
                                <button onClick={handleEditUser} disabled={editPending} className="flex-1 py-2.5 bg-primary hover:bg-emerald-400 text-white text-sm font-bold rounded-lg shadow-lg shadow-primary/20 disabled:opacity-50 transition-colors">
                                    {editPending ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {showResetPasswordModal && resetTarget && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="glass max-w-sm w-full rounded-2xl border border-border overflow-hidden shadow-2xl">
                        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-2"><Key size={16} className="text-primary" /><h2 className="text-base font-semibold text-foreground">Security Management</h2></div>
                            <button onClick={() => { setShowResetPasswordModal(false); setResetCredential(null); }} className="p-2 text-foreground/50 hover:text-foreground bg-foreground/5 hover:bg-foreground/10 rounded-full transition-colors"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4 text-center">
                            <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-2xl mx-auto">
                                {resetTarget.full_name.split(" ").map((p: string) => p[0]).join("").slice(0,2).toUpperCase()}
                            </div>
                            {!resetCredential ? (
                                <>
                                    <div>
                                        <h3 className="font-bold text-foreground text-lg">Reset Password?</h3>
                                        <p className="text-sm text-foreground/50 mt-1">Resetting password for <strong className="text-foreground">{resetTarget.full_name}</strong> ({resetTarget.email}).</p>
                                    </div>
                                    <button onClick={handleResetPassword} disabled={resetPending} className="w-full py-3 bg-primary hover:bg-emerald-400 text-white font-bold rounded-xl shadow-lg shadow-primary/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                                        <Eye size={16} /> {resetPending ? "Generating..." : "Reveal Temporary Password"}
                                    </button>
                                    <p className="text-[10px] text-foreground/30 uppercase tracking-widest">Authenticated Session Required</p>
                                </>
                            ) : (
                                <>
                                    <div><h3 className="font-bold text-green-400 text-lg">Password Reset!</h3><p className="text-xs text-foreground/50 mt-1">This password will not be shown again.</p></div>
                                    <div className="text-left space-y-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest mb-1 block">Email</label>
                                            <div className="px-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground text-sm font-mono">{resetCredential.email}</div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest mb-1 block">Temporary Password</label>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 px-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground text-sm font-mono select-all break-all">{resetCredential.password}</div>
                                                <button onClick={() => { navigator.clipboard.writeText(resetCredential!.password); toast.success("Copied!"); }} className="px-3 py-2 rounded-lg bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 transition-colors"><Copy size={15} /></button>
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => { setShowResetPasswordModal(false); setResetCredential(null); }} className="w-full py-2.5 glass border border-border text-foreground text-sm font-bold rounded-lg hover:bg-foreground/10 transition-colors">Done</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Import CSV Wizard */}
            {showImportModal && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="glass max-w-lg w-full rounded-2xl border border-border overflow-hidden shadow-2xl">
                        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-3"><Upload size={16} className="text-primary" /><div><h2 className="text-base font-semibold text-foreground">Bulk Import Accounts</h2><p className="text-[10px] text-foreground/40 uppercase tracking-widest">Wizard Flow</p></div></div>
                            <button onClick={() => setShowImportModal(false)} className="p-2 text-foreground/50 hover:text-foreground bg-foreground/5 hover:bg-foreground/10 rounded-full transition-colors"><X size={18} /></button>
                        </div>
                        <div className="flex items-center px-6 py-4 border-b border-border bg-black/10">
                            {(["Upload", "Review", "Import", "Summary"] as const).map((label, i) => (
                                <div key={label} className="flex items-center flex-1">
                                    <div className={`flex items-center gap-2 ${i + 1 <= importStep ? "text-primary" : "text-foreground/30"}`}>
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i + 1 < importStep ? "bg-primary text-white" : i + 1 === importStep ? "bg-primary/20 text-primary border border-primary" : "bg-foreground/10 text-foreground/30"}`}>{i + 1}</div>
                                        <span className="text-xs font-bold hidden sm:block">{label}</span>
                                    </div>
                                    {i < 3 && <div className={`flex-1 h-px mx-2 ${i + 1 < importStep ? "bg-primary" : "bg-foreground/10"}`} />}
                                </div>
                            ))}
                        </div>
                        <div className="p-6">
                            {importStep === 1 && (
                                <div className="space-y-4">
                                    <p className="text-sm text-foreground/60 text-center">Upload a .csv file containing user details to bulk create accounts.</p>
                                    <label className="block border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                                        <Upload size={32} className="mx-auto mb-3 text-foreground/30" />
                                        <p className="font-bold text-foreground">Drag and drop your file here</p>
                                        <p className="text-xs text-foreground/50 mt-1">CSV files only (max. 10MB)</p>
                                        <span className="mt-4 inline-block px-4 py-2 glass border border-border text-foreground text-sm font-bold rounded-lg">Choose File</span>
                                        <input type="file" accept=".csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) setImportFile(f); }} />
                                    </label>
                                    {importFile && <p className="text-xs text-primary text-center font-bold">Selected: {importFile.name}</p>}
                                    <button onClick={downloadImportTemplate} className="w-full flex items-center justify-center gap-2 px-4 py-3 glass border border-border text-foreground/70 text-sm rounded-xl hover:bg-foreground/10 transition-colors">
                                        <FileDown size={14} /> Download EcoWatch CSV Template
                                    </button>
                                    <div className="flex gap-3">
                                        <button onClick={() => setShowImportModal(false)} className="flex-1 py-2.5 glass border border-border text-foreground text-sm font-bold rounded-lg hover:bg-foreground/10 transition-colors">Cancel</button>
                                        <button onClick={() => { if (importFile) setImportStep(2); else toast.error("Please select a file first."); }} className="flex-1 py-2.5 bg-primary hover:bg-emerald-400 text-white text-sm font-bold rounded-lg transition-colors">Continue</button>
                                    </div>
                                </div>
                            )}
                            {importStep === 2 && importFile && (
                                <div className="space-y-4">
                                    <div className="glass rounded-xl border border-border p-4 space-y-2">
                                        <div className="flex items-center justify-between"><span className="text-xs text-foreground/50">File name</span><span className="text-xs font-bold text-foreground">{importFile.name}</span></div>
                                        <div className="flex items-center justify-between"><span className="text-xs text-foreground/50">File size</span><span className="text-xs font-bold text-foreground">{(importFile.size / 1024).toFixed(1)} KB</span></div>
                                    </div>
                                    <div className="glass rounded-xl border border-border p-4">
                                        <p className="text-xs font-bold text-foreground/60 uppercase tracking-widest mb-2">Expected CSV Columns</p>
                                        <p className="text-xs font-mono text-foreground/70">email, full_name, role, barangay_assignment, phone_number</p>
                                        <p className="text-[10px] text-foreground/40 mt-2">Valid roles: citizen, barangay, cleaner, cenro</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <button onClick={() => setImportStep(1)} className="flex-1 py-2.5 glass border border-border text-foreground text-sm font-bold rounded-lg hover:bg-foreground/10 transition-colors">Back</button>
                                        <button onClick={() => setImportStep(3)} className="flex-1 py-2.5 bg-primary hover:bg-emerald-400 text-white text-sm font-bold rounded-lg transition-colors">Continue</button>
                                    </div>
                                </div>
                            )}
                            {importStep === 3 && (
                                <div className="space-y-4">
                                    <p className="text-sm text-foreground/60 text-center">Ready to import. Accounts will be created for all valid rows.</p>
                                    <div className="glass rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                                        <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Ready to Process</p>
                                        <p className="text-xs text-foreground/50 mt-1">EcoWatch is standing by for your file mapping.</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <button onClick={() => setImportStep(2)} className="flex-1 py-2.5 glass border border-border text-foreground text-sm font-bold rounded-lg hover:bg-foreground/10 transition-colors">Back</button>
                                        <button onClick={handleImportCSV} disabled={importPending} className="flex-1 py-2.5 bg-primary hover:bg-emerald-400 text-white text-sm font-bold rounded-lg disabled:opacity-50 transition-colors">
                                            {importPending ? "Importing..." : "Start Import"}
                                        </button>
                                    </div>
                                </div>
                            )}
                            {importStep === 4 && importSummary && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="glass rounded-xl border border-green-500/20 bg-green-500/5 p-4 text-center"><p className="text-2xl font-bold text-green-400">{importSummary.created}</p><p className="text-xs text-foreground/50 mt-1">Accounts Created</p></div>
                                        <div className="glass rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center"><p className="text-2xl font-bold text-red-400">{importSummary.failed}</p><p className="text-xs text-foreground/50 mt-1">Rows Failed</p></div>
                                    </div>
                                    {importResults.filter((r: any) => r.status === "error").length > 0 && (
                                        <div className="max-h-40 overflow-auto space-y-1">
                                            {importResults.filter((r: any) => r.status === "error").map((r: any) => (
                                                <div key={r.row} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                                                    <AlertTriangle size={12} className="text-red-400 mt-0.5 shrink-0" />
                                                    <p className="text-xs text-foreground/70"><span className="font-bold">Row {r.row}</span> ({r.email || "no email"}): {r.errors?.join(", ")}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <button onClick={() => setShowImportModal(false)} className="w-full py-2.5 bg-primary hover:bg-emerald-400 text-white text-sm font-bold rounded-lg transition-colors">Done</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* SLA Policy Edit Modal */}
            {showSlaModal && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-card max-w-md w-full rounded-lg border border-border shadow-lg overflow-hidden">
                        <div className="px-6 py-4 flex items-center justify-between border-b border-border">
                            <h2 className="text-base font-semibold tracking-tight text-foreground">Edit SLA Policy</h2>
                            <button onClick={() => setShowSlaModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-muted-foreground">Set cleanup SLA thresholds by priority level (in days).</p>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground mb-1 block">Low Priority (days)</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={slaDraftLow}
                                    onChange={(e) => setSlaDraftLow(parseInt(e.target.value) || 1)}
                                    className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground mb-1 block">Medium Priority (days)</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={slaDraftMed}
                                    onChange={(e) => setSlaDraftMed(parseInt(e.target.value) || 1)}
                                    className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground mb-1 block">High Priority (days)</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={slaDraftHigh}
                                    onChange={(e) => setSlaDraftHigh(parseInt(e.target.value) || 1)}
                                    className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground mb-1 block">Compliance Target (%)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={slaDraftTarget}
                                    onChange={(e) => setSlaDraftTarget(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                                    className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                                <p className="text-xs text-muted-foreground mt-1">City-wide on-time completion target.</p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowSlaModal(false)}
                                    className="flex-1 px-4 h-9 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium rounded-md transition-colors"
                                    disabled={slaModalLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUpdateSlaPolicy}
                                    className="flex-1 px-4 h-9 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-md shadow-sm transition-colors disabled:opacity-50"
                                    disabled={slaModalLoading}
                                >
                                    {slaModalLoading ? "Saving..." : "Save"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* C2 — Credential Display Modal (one-time) */}
            {createdCredential && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="glass max-w-md w-full rounded-2xl border border-yellow-500/30 overflow-hidden">
                        <div className="bg-yellow-900/30 border-b border-yellow-500/30 px-6 py-4 flex items-center justify-between">
                            <h2 className="text-base font-semibold text-yellow-200">Temporary Credentials</h2>
                            <button onClick={() => setCreatedCredential(null)} className="p-2 text-foreground/50 hover:text-foreground bg-foreground/5 hover:bg-foreground/10 rounded-full">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-xs text-yellow-200 font-bold">⚠ This password will not be shown again. Share it with the new account holder now.</p>
                            <div>
                                <label className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest mb-1 block">Email</label>
                                <div className="px-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground text-sm font-mono">{createdCredential.email}</div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest mb-1 block">Temporary Password</label>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 px-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground text-sm font-mono select-all break-all">{createdCredential.password}</div>
                                    <button
                                        onClick={handleCopyPassword}
                                        className="px-3 py-2 rounded-lg bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 transition-colors"
                                        title="Copy password"
                                    >
                                        <Copy size={16} />
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={() => setCreatedCredential(null)}
                                className="w-full py-3 bg-foreground/10 hover:bg-foreground/20 text-foreground rounded-xl font-bold transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </PortalShell>
    );
}

