"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import {
    Search, Download, Plus, AlertTriangle, Copy, X,
    LayoutDashboard, Map, FileText, ShieldCheck, BarChart3, Building2, Image as ImageIcon, History, BookUser,
    Phone, MoreVertical, Upload, FileDown, RefreshCw, Eye, EyeOff, Edit2, Key, UserCheck, UserX, ChevronLeft, ChevronRight,
    AlertCircle, Activity, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { formatRelative, formatDate, formatDF } from "@/lib/date-utils";
import { OversightTab } from "@/components/portal/OversightTab";
import { PortalShell, type PortalNavItem } from "@/components/portal/PortalShell";
import { SlaManagementTab } from "@/components/portal/SlaManagementTab";
import { AnalyticsTab, type InsightsData } from "@/components/portal/AnalyticsTab";
import { AnalyticsDrilldownModal, type DrilldownData } from "@/components/portal/AnalyticsDrilldownModal";
import { BarangayManagementTab, type BarangayOverviewRow, type BarangayCityWide } from "@/components/portal/BarangayManagementTab";
import { BarangayDetailDrawer } from "@/components/portal/BarangayDetailDrawer";
import { ReportDetailDrawer } from "@/components/portal/ReportDetailDrawer";
import { AuditLogTab } from "@/components/portal/AuditLogTab";
import { EvidenceGalleryTab } from "@/components/portal/EvidenceGalleryTab";
import { UserManagementTab, type UserManagementRef } from "@/components/portal/UserManagementTab";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { ConfidenceTooltipBody } from "@/components/ConfidenceTooltipBody";
import { BARANGAYS } from "@/lib/barangays";
import { TrustBadge } from "@/components/TrustBadge";
import { useUnreadNotificationCount } from "@/lib/notification-poll";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { DateRange } from "react-day-picker";
import { subDays } from "date-fns";

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

const formatClusterLocation = (barangays?: string[]) => {
    if (!barangays || barangays.length === 0) return "Unknown location";
    if (barangays.length === 1) return barangays[0];
    if (barangays.length === 2) return `Between ${barangays[0]} and ${barangays[1]}`;
    return `Between ${barangays.slice(0, -1).join(', ')}, and ${barangays[barangays.length - 1]}`;
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
    const userManagementRef = useRef<UserManagementRef>(null);

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
    const [insightsDateRange, setInsightsDateRange] = useState<DateRange | undefined>({ from: subDays(new Date(), 30), to: new Date() });
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
        if (activeTab === 'analytics' && user) {
            fetchInsights(insightsDateRange);
        }
    }, [activeTab, user, insightsDateRange]);

    // Fetch Barangay Management overview when tab becomes active
    useEffect(() => {
        if (activeTab !== 'barangay_management' || !user) return;
        fetchBarangayOverview();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, user]);

    const handleAssignBarangayAdmin = (barangayName: string) => {
        userManagementRef.current?.openCreateForBarangay(barangayName);
    };

    const handleReassignBarangayAdmin = (adminUserId: number) => {
        const admin = selectedBarangayRow?.admin;
        if (!admin) return;
        userManagementRef.current?.openEditForBarangay(admin, selectedBarangayRow?.barangay ?? "");
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





    const handleReassign = async (reportId: number) => {
        if (!newBarangay) return;
        setActionLoading(true);

        const formData = new FormData();
        formData.append("new_barangay", newBarangay);

        try {
            await api(`/report/${reportId}/reassign`, { method: "PUT", body: formData });
            const updater = (r: any) => (r.id === reportId ? { ...r, barangay: newBarangay } : r);
            setReports((prev) => prev.map(updater));
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

    const fetchInsights = async (dateRange: DateRange | undefined) => {
        setInsightsLoading(true);
        try {
            const params = new URLSearchParams();
            if (dateRange?.from && dateRange?.to) {
                params.set("start", dateRange.from.toISOString());
                params.set("end", dateRange.to.toISOString());
            } else {
                params.set("days", "30"); // fallback
            }
            const data = await api(`/analytics/insights?${params.toString()}`);
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
            const params = new URLSearchParams({ metric });
            if (insightsDateRange?.from && insightsDateRange?.to) {
                params.set("start", insightsDateRange.from.toISOString());
                params.set("end", insightsDateRange.to.toISOString());
            } else {
                params.set("days", "30");
            }
            if (key) params.set("key", key);
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
            const params = new URLSearchParams();
            if (insightsDateRange?.from && insightsDateRange?.to) {
                params.set("start", insightsDateRange.from.toISOString());
                params.set("end", insightsDateRange.to.toISOString());
            } else {
                params.set("days", "30");
            }
            const res = await fetch(`${API_URL}/analytics/insights-export?${params.toString()}`, {
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

    if (!user) return null;

    const stats = {
        total: reports.length,
        resolved: reports.filter(r => r.status === 'resolved').length,
        active: reports.filter(r => r.status === 'assigned' || r.status === 'in_progress').length,
        failed: reports.filter(r => r.status === 'failed_cleanup').length,
        pending: reports.filter(r => r.status === 'pending' || r.status === 'verified').length,
    };
    const pending = stats.pending;
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
                        dateRange={insightsDateRange}
                        onDateRangeChange={setInsightsDateRange}
                        exporting={insightsExporting}
                        onExport={handleExportInsights}
                        onRefresh={() => fetchInsights(insightsDateRange)}
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
                    loading ? (
                        /* Dashboard skeleton — only shown when on the Dashboard tab */
                        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[2.5fr_1fr] gap-6 overflow-hidden pb-4 animate-pulse">
                            <div className="flex flex-col gap-4 min-h-0">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0 w-full">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <div key={i} className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 h-24 justify-center">
                                            <div className="h-3 w-20 bg-muted rounded" />
                                            <div className="h-7 w-12 bg-muted rounded" />
                                        </div>
                                    ))}
                                </div>
                                <div className="rounded-lg border border-border bg-card h-[74px] shrink-0 flex items-center px-5 gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-muted shrink-0" />
                                    <div className="flex flex-col gap-2 flex-1">
                                        <div className="h-3 w-24 bg-muted rounded" />
                                        <div className="h-4 w-16 bg-muted rounded" />
                                    </div>
                                </div>
                                <div className="flex-1 rounded-lg border border-border bg-card min-h-[400px] relative overflow-hidden">
                                    <div className="absolute inset-0 bg-muted/30" />
                                    <div className="absolute top-4 left-4 h-5 w-28 bg-muted rounded-full" />
                                </div>
                            </div>
                            <div className="flex flex-col gap-4 overflow-y-auto pr-2">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="rounded-lg border border-border bg-card p-5 flex flex-col gap-4 min-h-[200px]">
                                        <div className="h-4 w-28 bg-muted rounded" />
                                        {Array.from({ length: 3 }).map((_, j) => (
                                            <div key={j} className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-muted shrink-0" />
                                                <div className="flex-1 flex flex-col gap-1.5">
                                                    <div className="h-3 bg-muted rounded w-3/4" />
                                                    <div className="h-3 bg-muted rounded w-1/2" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-[2.5fr_1fr] gap-6 overflow-hidden pb-4">

                        {/* Left: Main Content */}
                        <div className="flex flex-col gap-4 min-h-0">
                            {/* Top Stats Bar */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0 animate-slide-up stagger-1 w-full">
                                <div className="rounded-xl border border-border bg-card p-5 shadow-sm flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-muted-foreground mb-1.5 truncate">Total Reports</div>
                                        <div className="text-3xl font-extrabold text-foreground tracking-tight leading-none">{stats.total}</div>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                                        <FileText size={22} />
                                    </div>
                                </div>
                                <div className="rounded-xl border border-border bg-card p-5 shadow-sm flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-muted-foreground mb-1.5 truncate">Pending / Verified</div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-extrabold text-foreground tracking-tight leading-none">{pending}</span>
                                            {pending > 0 && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-1.5 self-center animate-pulse">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                                                    needs action
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-destructive/10 text-destructive">
                                        <AlertCircle size={22} />
                                    </div>
                                </div>
                                <div className="rounded-xl border border-border bg-card p-5 shadow-sm flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-muted-foreground mb-1.5 truncate">Active Cleanups</div>
                                        <div className="text-3xl font-extrabold text-foreground tracking-tight leading-none">{stats.active}</div>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                                        <Activity size={22} />
                                    </div>
                                </div>
                                <div className="rounded-xl border border-border bg-card p-5 shadow-sm flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-muted-foreground mb-1.5 truncate">Success Rate</div>
                                        <div className="text-3xl font-extrabold text-foreground tracking-tight leading-none">{successRate}%</div>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                                        <CheckCircle2 size={22} />
                                    </div>
                                </div>
                            </div>

                            {/* Merged SLA bar */}
                            <div className="rounded-xl border border-border bg-card p-5 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-0 divide-y md:divide-y-0 md:divide-x divide-border/60 animate-slide-up stagger-2 overflow-hidden shrink-0">
                                {/* SLA Breaches Section */}
                                <div className="flex items-center justify-between gap-4 pb-4 md:pb-0 md:pr-6">
                                    <div className="flex items-center gap-4 min-w-0">
                                        {/* Breach icon */}
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${slaBreaches.length > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted/50 text-muted-foreground'}`}>
                                            <AlertTriangle size={18} />
                                        </div>

                                        {/* Breach info */}
                                        <div className="min-w-0">
                                            <div className="text-xs font-semibold text-muted-foreground mb-0.5">SLA Breaches</div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-2xl font-extrabold text-foreground tracking-tight leading-none">
                                                    {slaBreaches.length}
                                                </span>
                                                {slaBreaches.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {slaBreaches.slice(0, 3).map((r) => {
                                                            const sla = slaInfo(r.created_at, r.status);
                                                            return (
                                                                <span
                                                                    key={r.id}
                                                                    title={sla ? `Breached by ${sla.days} days` : undefined}
                                                                    className="group inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-destructive/10 text-destructive border border-destructive/20 cursor-help transition-all duration-300 whitespace-nowrap"
                                                                >
                                                                    {r.tracking_id}
                                                                    {sla && (
                                                                        <span className="max-w-0 overflow-hidden group-hover:max-w-[40px] group-hover:ml-1.5 transition-all duration-300 ease-in-out inline-block whitespace-nowrap text-destructive/80">
                                                                            {sla.days}d
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">All on schedule</span>
                                                )}
                                            </div>
                                        </div>
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
                                            className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1 shrink-0 shadow-sm whitespace-nowrap"
                                        >
                                            <span className="hidden xl:inline">View </span>Queue →
                                        </button>
                                    )}
                                </div>

                                {/* SLA Policy Section */}
                                <div className="flex items-center justify-between gap-4 pt-4 md:pt-0 md:pl-6">
                                    <div className="flex items-center gap-4 min-w-0">
                                        {/* Policy icon */}
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                                            <ShieldCheck size={18} />
                                        </div>

                                        {/* Policy info */}
                                        <div className="min-w-0">
                                            <div className="text-xs font-semibold text-muted-foreground mb-0.5">SLA Policy</div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15 whitespace-nowrap">Low {slaPolicy.low}d</span>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-500/5 text-yellow-600 dark:text-yellow-400 border border-yellow-500/15 whitespace-nowrap">Med {slaPolicy.medium}d</span>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/5 text-destructive border border-destructive/15 whitespace-nowrap">High {slaPolicy.high}d</span>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setShowSlaModal(true)}
                                        className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground/80 hover:text-foreground border border-border rounded-lg text-xs font-medium transition-all shrink-0 whitespace-nowrap"
                                    >
                                        Edit Policy
                                    </button>
                                </div>
                            </div>

                            {/* Map hero */}
                            <div className="flex-1 rounded-lg border border-border bg-card text-card-foreground shadow-sm overflow-hidden relative min-h-[300px] animate-slide-up stagger-3">
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
                    )
                )}

                {activeTab === 'overview' && (
                    /* OVERVIEW TAB (Map + Stats) */
                    loading ? (
                        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 animate-pulse">
                            {/* Left: Stats Column Skeleton */}
                            <div className="flex-1 lg:max-w-xs flex flex-col gap-3">
                                <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 h-24 justify-center">
                                    <div className="h-3 w-20 bg-muted rounded" />
                                    <div className="h-7 w-12 bg-muted rounded" />
                                </div>
                                <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 h-24 justify-center">
                                    <div className="h-3 w-28 bg-muted rounded" />
                                    <div className="h-7 w-12 bg-muted rounded" />
                                </div>
                                <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 flex-1 min-h-[200px]">
                                    <div className="h-4 w-28 bg-muted rounded mb-2" />
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <div key={i} className="flex justify-between items-center py-1.5 border-b border-border/40 last:border-0">
                                            <div className="space-y-1">
                                                <div className="h-3 w-16 bg-muted rounded" />
                                                <div className="h-2 w-10 bg-muted rounded" />
                                            </div>
                                            <div className="h-4 w-6 bg-muted rounded" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Right: Map Skeleton */}
                            <div className="flex-[3] rounded-lg border border-border bg-card relative min-h-[400px]">
                                <div className="absolute inset-0 bg-muted/30 animate-pulse" />
                                <div className="absolute top-3 left-3 h-5 w-32 bg-muted rounded-full" />
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
                            {/* Left: Stats Column */}
                            <div className="flex-1 lg:max-w-xs flex flex-col gap-3 relative z-30">
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
                                    <div className="p-4 pb-2 shrink-0 flex items-center gap-1.5">
                                        <h3 className="text-xs font-medium text-muted-foreground tracking-tight">Active Hotspots</h3>
                                        <InfoTooltip side="right" panelClassName="w-72">
                                            <div className="space-y-2">
                                                <div className="font-semibold text-foreground">Active Hotspots (Clusters)</div>
                                                <div className="text-muted-foreground text-[10px] leading-relaxed">
                                                    Areas with a high concentration of active reports. Our system groups reports located within ~100 meters of each other using DBSCAN to detect critical waste hotspots.
                                                </div>
                                                <img 
                                                    src="/clustered_tooltip.png" 
                                                    alt="Clustering visualization" 
                                                    className="w-full h-auto rounded-lg border border-border/40 bg-muted/20 mt-1"
                                                />
                                            </div>
                                        </InfoTooltip>
                                    </div>
                                    <div className="p-4 pt-0 flex-1 overflow-y-auto space-y-1.5 scrollbar-hide">
                                        {heatmaps.length === 0 ? (
                                            <p className="text-[11px] text-muted-foreground italic">No significant hotspots detected.</p>
                                        ) : (
                                            heatmaps.map((h, i) => (
                                                <div key={i} className="flex items-center justify-between py-2 group border-b border-border last:border-0">
                                                    <div className="min-w-0 pr-2">
                                                        <div className="text-[13px] font-medium text-foreground">Cluster {h.cluster_id}</div>
                                                        <div className="text-[10px] text-muted-foreground mt-0.5 font-medium leading-tight truncate" title={formatClusterLocation(h.barangays)}>
                                                            {formatClusterLocation(h.barangays)}
                                                        </div>
                                                        <div className="text-[9px] text-red-500 font-semibold mt-1 uppercase tracking-wider">{h.intensity} Intensity</div>
                                                    </div>
                                                    <div className="text-xs font-extrabold px-2 py-1 rounded bg-muted text-foreground/80 shrink-0">{h.report_count} reports</div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right: Map */}
                            <div className="flex-[3] rounded-lg border border-border bg-card shadow-sm overflow-hidden relative z-0 min-h-[400px]">
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
                    )
                )}

                {activeTab === 'oversight' && (
                    <OversightTab 
                        user={user} 
                        barangays={BARANGAYS} 
                        onReportClick={(report) => {
                            setSelectedReport(report);
                            setNewBarangay(report.barangay ?? "");
                        }} 
                    />
                )}

                {activeTab === 'audit' && (
                    <AuditLogTab user={user} />
                )}

                {activeTab === 'gallery' && (
                    <EvidenceGalleryTab 
                        reports={reports} 
                        barangays={BARANGAYS} 
                        onReportClick={setSelectedReport} 
                        loading={loading}
                    />
                )}

                {activeTab === 'users' && (
                    <UserManagementTab 
                        ref={userManagementRef}
                        onBarangayAdminChange={fetchBarangayOverview}
                    />
                )}
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



        </PortalShell>
    );
}

