"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { Search, Download, Plus, AlertTriangle, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";

const MapComponent = dynamic(() => import("@/components/MapComponent"), { ssr: false });
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const BARANGAYS = [
    "Assumption", "Bagong Buhay I", "Bagong Buhay II", "Bagong Buhay III",
    "Citrus", "Ciudad Real", "Dulong Bayan", "Fatima I", "Fatima II",
    "Fatima III", "Minuyan I", "Minuyan II", "Minuyan III", "Muzon",
    "Kaybanban", "Kaypian", "Lawang Pare", "Maharlika", "San Isidro",
    "San Manuel", "San Martin I", "San Martin II", "San Martin III",
    "San Martin IV", "San Pedro", "San Rafael I", "San Rafael II",
    "San Rafael III", "San Rafael IV", "San Rafael V", "San Roque",
    "Sto. Cristo", "Tungkong Mangga", "Graceville", "Gumaoc Central",
    "Gumaoc East", "Gumaoc West", "Poblacion", "Poblacion I"
];

const STATUS_OPTIONS = ["", "pending", "verified", "deployed", "resolved", "failed_cleanup", "rejected"];

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
    const active = ["pending", "verified", "deployed", "failed_cleanup"].includes(status);
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
    lines.push("Barangay,Total Reports,Resolved,Deployed,Pending,Resolution Rate");
    ranking.forEach((r) => {
        lines.push([
            r.barangay,
            r.total_reports,
            r.resolved,
            r.deployed,
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

type TabKey = 'command_center' | 'overview' | 'oversight' | 'audit' | 'users';

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
    is_active: boolean;
}

export default function CenroDashboard() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [reports, setReports] = useState<any[]>([]);
    const [heatmaps, setHeatmaps] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [activeTab, setActiveTab] = useState<TabKey>('command_center');
    const [selectedReport, setSelectedReport] = useState<any>(null);

    // Action State (Oversight modal)
    const [actionLoading, setActionLoading] = useState(false);
    const [newBarangay, setNewBarangay] = useState<string>("");

    // C3 — SLA Breaches
    const [slaBreaches, setSlaBreaches] = useState<any[]>([]);

    // C4 — Oversight Queue filters
    const [queueReports, setQueueReports] = useState<any[]>([]);
    const [queueLoading, setQueueLoading] = useState(false);
    const [oversightSearch, setOversightSearch] = useState("");
    const debouncedOversightSearch = useDebounce(oversightSearch, 300);
    const [oversightStatus, setOversightStatus] = useState("");
    const [oversightDateFrom, setOversightDateFrom] = useState("");
    const [oversightDateTo, setOversightDateTo] = useState("");
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
    const [createForm, setCreateForm] = useState({ email: "", full_name: "", barangay_assignment: "" });
    const [createPending, setCreatePending] = useState(false);
    const [createdCredential, setCreatedCredential] = useState<{ email: string; password: string } | null>(null);
    const [disabling, setDisabling] = useState<Set<number>>(new Set());

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

    // C4 — refetch queue when filters change AND oversight tab active
    const buildQueueQuery = () => {
        const params = new URLSearchParams();
        if (debouncedOversightSearch.trim()) params.set("search", debouncedOversightSearch.trim());
        if (oversightStatus) params.set("status", oversightStatus);
        if (oversightDateFrom) params.set("date_from", `${oversightDateFrom}T00:00:00`);
        if (oversightDateTo) params.set("date_to", `${oversightDateTo}T23:59:59`);
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
    }, [activeTab, debouncedOversightSearch, oversightStatus, oversightDateFrom, oversightDateTo, user]);

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
            const data = await api(`/users?role=barangay`);
            if (Array.isArray(data)) setBarangayUsers(data);
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to load users");
        } finally {
            setUsersLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab !== 'users' || !user) return;
        if (barangayUsers.length === 0) fetchUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, user]);

    const handleCreateUser = async () => {
        if (!createForm.email.trim() || !createForm.full_name.trim() || !createForm.barangay_assignment) {
            toast.error("All fields are required.");
            return;
        }
        setCreatePending(true);
        try {
            const data = await api(`/users`, {
                method: "POST",
                body: JSON.stringify(createForm),
            });
            if (data?.user && data?.temporary_password) {
                setShowCreateUserModal(false);
                setCreatedCredential({ email: data.user.email, password: data.temporary_password });
                setCreateForm({ email: "", full_name: "", barangay_assignment: "" });
                toast.success("Barangay account created.");
                fetchUsers();
            }
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to create account");
        } finally {
            setCreatePending(false);
        }
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

    const handleExportAnalytics = () => {
        try {
            const overview = {
                total: stats.total,
                pending,
                deployed: stats.deployed,
                failed_cleanup: stats.failed,
                resolved: stats.resolved,
                success_rate: successRate,
            };
            const ranking = barangayStats.map((b) => ({
                barangay: b.name,
                total_reports: b.total,
                resolved: b.resolved,
                deployed: reports.filter((r) => r.barangay === b.name && r.status === 'deployed').length,
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
            <div className="min-h-screen bg-[#0a0f0a] flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white p-1 shadow-[0_0_30px_rgba(16,185,129,0.3)] animate-pulse">
                    <img src="/logo.png" alt="Loading..." className="w-full h-full object-contain" />
                </div>
                <div className="text-emerald-500 font-bold tracking-widest uppercase text-sm animate-pulse">Initializing Hub...</div>
            </div>
        );
    }

    const stats = {
        total: reports.length,
        resolved: reports.filter(r => r.status === 'resolved').length,
        deployed: reports.filter(r => r.status === 'deployed').length,
        failed: reports.filter(r => r.status === 'failed_cleanup').length,
    };
    const pending = stats.total - stats.resolved - stats.deployed - stats.failed;
    const successRate = stats.total > 0 ? Number(((stats.resolved / stats.total) * 100).toFixed(1)) : 0;

    const barangayStats = BARANGAYS.map(b => {
        const bReports = reports.filter(r => r.barangay === b);
        const total = bReports.length;
        const resolved = bReports.filter(r => r.status === 'resolved').length;
        const rate = total > 0 ? (resolved / total) * 100 : 0;
        return { name: b, total, resolved, rate };
    }).filter(b => b.total > 0).sort((a, b) => b.rate - a.rate);

    const recentFeed = [...reports].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);

    const pieData = [
        { name: 'Pending', value: pending, color: '#ef4444' },
        { name: 'Deployed', value: stats.deployed, color: '#eab308' },
        { name: 'Failed', value: stats.failed, color: '#f97316' },
        { name: 'Resolved', value: stats.resolved, color: '#22c55e' }
    ].filter(d => d.value > 0);

    const dateMap: Record<string, number> = {};
    [...reports].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).forEach(r => {
        const d = new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        dateMap[d] = (dateMap[d] || 0) + 1;
    });
    const lineData = Object.entries(dateMap).map(([date, count]) => ({ date, count })).slice(-14);

    return (
        <div className="min-h-screen bg-[#0a0f0a] pt-20 pb-10 px-4 md:px-8 relative overflow-hidden">
            {/* Pro Max Background Accents */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-[1600px] mx-auto h-[calc(100vh-8rem)] flex flex-col relative z-10">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 shrink-0 gap-4 animate-slide-up">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">CENRO <span className="text-primary">Ops Hub</span></h1>
                        <p className="text-emerald-400 font-semibold uppercase tracking-[0.18em] text-[11px] px-2.5 py-0.5 bg-emerald-400/10 rounded-full w-fit border border-emerald-400/20">
                            City-Wide Oversight & Analytics
                        </p>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/10 overflow-x-auto backdrop-blur-md">
                        {([
                            ['command_center', 'Command Center'],
                            ['overview', 'Overview Map'],
                            ['oversight', 'Oversight Queue'],
                            ['audit', 'Audit Log'],
                            ['users', 'Users'],
                        ] as [TabKey, string][]).map(([key, label]) => (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === key ? 'bg-primary text-white shadow-lg shadow-emerald-900/50' : 'text-white/50 hover:text-white'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {activeTab === 'command_center' && (
                    /* COMMAND CENTER TAB */
                    <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto scrollbar-hide pb-8">

                        {/* Top Stats Bar + Export */}
                        <div className="flex flex-col gap-4 shrink-0">
                            <div className="flex items-center justify-end">
                                <button
                                    onClick={handleExportAnalytics}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/20 border border-primary/30 text-primary text-xs font-bold uppercase tracking-widest hover:bg-primary/30 transition-colors"
                                    title="Export analytics summary as CSV"
                                >
                                    <Download size={14} />
                                    Export Analytics CSV
                                </button>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 animate-slide-up stagger-1">
                                <div className="glass-pro p-5 rounded-2xl bento-card">
                                    <div className="text-[11px] text-white/50 uppercase tracking-widest font-semibold mb-1.5">Total Reports</div>
                                    <div className="text-3xl font-bold text-emerald-400 tracking-tight">{stats.total}</div>
                                </div>
                                <div className="glass-pro p-5 rounded-2xl bento-card">
                                    <div className="text-[11px] text-white/50 uppercase tracking-widest font-semibold mb-1.5">Active/Pending</div>
                                    <div className="text-3xl font-bold text-red-400 tracking-tight">{pending}</div>
                                </div>
                                <div className="glass-pro p-5 rounded-2xl bento-card">
                                    <div className="text-[11px] text-white/50 uppercase tracking-widest font-semibold mb-1.5">Teams Deployed</div>
                                    <div className="text-3xl font-bold text-yellow-400 tracking-tight">{stats.deployed}</div>
                                </div>
                                <div className="glass-pro p-5 rounded-2xl bento-card">
                                    <div className="text-[11px] text-white/50 uppercase tracking-widest font-semibold mb-1.5">Success Rate</div>
                                    <div className="text-3xl font-bold text-green-400 tracking-tight">{successRate}%</div>
                                </div>
                            </div>
                        </div>

                        {/* C3 — SLA Breaches Card */}
                        <div className="glass-pro p-6 rounded-[2.5rem] border border-white/10 shrink-0 animate-slide-up stagger-2 overflow-hidden relative">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-[80px] pointer-events-none" />
                            <div className="flex items-center justify-between mb-4 flex-wrap gap-4 relative z-10">
                                <div className="flex items-center gap-4">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${slaBreaches.length > 0 ? 'bg-red-500/20 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'bg-green-500/20 text-green-400'}`}>
                                        <AlertTriangle size={28} />
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-1">SLA Breaches (≥ 3 days open)</div>
                                        <div className={`text-2xl font-bold ${slaBreaches.length > 0 ? 'text-red-400' : 'text-green-400'}`}>{slaBreaches.length}</div>
                                    </div>
                                </div>
                                {slaBreaches.length > 0 && (
                                    <button
                                        onClick={() => {
                                            setOversightStatus("");
                                            setOversightSearch("");
                                            setOversightDateFrom("");
                                            setOversightDateTo("");
                                            setOversightBarangay("");
                                            setActiveTab('oversight');
                                        }}
                                        className="text-xs font-bold text-primary hover:text-emerald-300 underline underline-offset-4"
                                    >
                                        View all in Oversight Queue →
                                    </button>
                                )}
                            </div>
                            {slaBreaches.length === 0 ? (
                                <p className="text-xs text-white/40 italic">No active breaches — everything is on schedule.</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {slaBreaches.slice(0, 3).map((r) => {
                                        const sla = slaInfo(r.created_at, r.status);
                                        return (
                                            <div key={r.id} className="p-3 rounded-xl bg-black/30 border border-red-500/20">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="font-mono text-xs font-bold text-white">{r.tracking_id}</div>
                                                    {sla && (
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${SLA_PILL_CLASSES[sla.color]}`}>
                                                            {sla.days}d open
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-emerald-300 font-bold">{r.barangay || "Unassigned"}</div>
                                                <div className="text-[10px] text-white/40 uppercase tracking-wider mt-1">{r.status}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Main Grid */}
                        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">

                            {/* Left: Charts */}
                            <div className="lg:col-span-1 flex flex-col gap-6 min-h-0 animate-slide-up stagger-3">
                                <div className="flex-1 glass-pro p-8 rounded-[2.5rem] flex flex-col min-h-0 bento-card">
                                    <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-6 shrink-0">Status Breakdown</h3>
                                    <div className="flex-1 relative min-h-[160px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={8} dataKey="value">
                                                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />)}
                                                </Pie>
                                                <Tooltip 
                                                    contentStyle={{ backgroundColor: 'rgba(10, 15, 10, 0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }}
                                                    itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex flex-wrap justify-center gap-4 mt-6 shrink-0">
                                        {pieData.map(d => (
                                            <div key={d.name} className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-white/60"><div className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" style={{backgroundColor: d.color, color: d.color}}></div>{d.name}</div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex-1 glass-pro p-8 rounded-[2.5rem] flex flex-col min-h-0 bento-card">
                                    <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-8 shrink-0">City-Wide Trend</h3>
                                    <div className="flex-1 relative min-h-[160px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={lineData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                                <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" fontSize={10} tickMargin={15} axisLine={false} tickLine={false} />
                                                <Tooltip contentStyle={{ backgroundColor: 'rgba(10, 15, 10, 0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }} />
                                                <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={4} dot={{ r: 6, fill: '#10b981', strokeWidth: 3, stroke: '#0a0f0a' }} activeDot={{ r: 8, fill: '#34d399' }} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Center: Map */}
                            <div className="lg:col-span-1 glass rounded-2xl border border-white/10 overflow-hidden relative min-h-[300px]">
                                <div className="absolute top-4 left-4 z-[1000] glass px-3 py-1.5 rounded-full text-[10px] font-bold text-white uppercase tracking-widest border border-white/20 pointer-events-none">Live City Map</div>
                                <MapComponent height="100%" reports={reports} heatmaps={heatmaps} focusedBarangay={null} onBarangayClick={() => {}} />
                            </div>

                            {/* Right: Lists */}
                            <div className="lg:col-span-1 flex flex-col gap-6 min-h-0 animate-slide-up stagger-4">
                                <div className="flex-1 glass-pro p-8 rounded-[2.5rem] flex flex-col min-h-0 bento-card">
                                    <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-6 shrink-0">Barangay Rankings</h3>
                                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-hide">
                                        {barangayStats.map((b, i) => (
                                            <div key={b.name} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.08] transition-colors group">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-8 h-8 rounded-lg bg-black/50 flex items-center justify-center text-xs font-semibold text-white/30 group-hover:text-primary transition-colors">{i + 1}</div>
                                                    <div className="text-sm font-bold text-white/90">{b.name}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-semibold text-emerald-400">{b.rate.toFixed(0)}%</div>
                                                    <div className="text-[10px] text-white/30 uppercase tracking-widest font-bold">{b.resolved} reports</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex-1 glass-pro p-8 rounded-[2.5rem] flex flex-col min-h-0 bento-card">
                                    <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-6 shrink-0">Live City Feed</h3>
                                    <div className="flex-1 overflow-y-auto pr-2 space-y-5 scrollbar-hide">
                                        {recentFeed.map(r => (
                                            <div key={r.id} className="relative pl-6 border-l border-white/5">
                                                <div className="absolute w-2.5 h-2.5 rounded-full bg-emerald-500 -left-[5px] top-1.5 shadow-[0_0_15px_rgba(16,185,129,0.8)]"></div>
                                                <div className="text-[13px] font-semibold text-white mb-1 tracking-tight">Report {r.tracking_id}</div>
                                                <div className="text-[11px] text-white/40 mb-3 font-medium uppercase tracking-wider">{r.barangay} • {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-widest ${r.status === 'resolved' ? 'bg-green-500/20 text-green-400' : r.status === 'deployed' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>{r.status}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'overview' && (
                    /* OVERVIEW TAB (Map + Stats) */
                    <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
                        {/* Left: Stats Column */}
                        <div className="flex-1 lg:max-w-xs flex flex-col gap-4">
                            <div className="glass p-6 rounded-2xl border border-white/10 shadow-2xl">
                                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-emerald-400 mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                                </div>
                                <div className="text-xs font-bold text-white/50 uppercase tracking-widest mb-1">Total Reports</div>
                                <div className="text-3xl font-bold text-white">{stats.total}</div>
                            </div>

                            <div className="glass p-6 rounded-2xl border border-white/10 shadow-2xl">
                                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                </div>
                                <div className="text-xs font-bold text-white/50 uppercase tracking-widest mb-1">City Success Rate</div>
                                <div className="text-3xl font-bold text-green-400">{successRate}%</div>
                                <p className="text-xs text-white/40 mt-2">{stats.resolved} resolved out of {stats.total}</p>
                            </div>

                            <div className="glass p-6 rounded-2xl border border-white/10 shadow-2xl">
                                <div className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4">Active Hotspots</div>
                                {heatmaps.length === 0 ? (
                                    <p className="text-sm text-white/40 italic">No significant hotspots detected.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {heatmaps.map((h, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                                                <div>
                                                    <div className="text-sm font-bold text-white">Cluster {h.cluster_id}</div>
                                                    <div className="text-[10px] text-red-400 uppercase tracking-wider">{h.intensity} Intensity</div>
                                                </div>
                                                <div className="text-lg font-semibold text-white/80">{h.report_count}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right: Map */}
                        <div className="flex-[3] glass rounded-2xl border border-white/10 overflow-hidden shadow-2xl relative min-h-[400px]">
                            <div className="absolute top-4 left-4 z-[1000] glass px-4 py-2 rounded-full text-xs font-bold text-white border border-white/20 shadow-lg pointer-events-none flex items-center gap-2">
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
                    <div className="flex-1 glass rounded-2xl border border-white/10 flex flex-col min-h-0 shadow-2xl">
                        <div className="p-6 border-b border-white/10 shrink-0">
                            <h2 className="text-lg font-semibold text-white">Global Report Queue</h2>
                            <p className="text-sm text-white/50">Manage overrides and cross-barangay assignments.</p>
                        </div>

                        {/* C4 — Filter Bar */}
                        <div className="flex flex-col lg:flex-row gap-3 p-4 border-b border-white/10 shrink-0">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
                                <input
                                    type="text"
                                    value={oversightSearch}
                                    onChange={(e) => setOversightSearch(e.target.value)}
                                    placeholder="Search tracking ID or notes…"
                                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm placeholder:text-white/40 focus:border-primary focus:outline-none"
                                />
                            </div>
                            <select
                                value={oversightStatus}
                                onChange={(e) => setOversightStatus(e.target.value)}
                                className="px-2 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-xs focus:border-primary focus:outline-none"
                            >
                                {STATUS_OPTIONS.map((s) => (
                                    <option key={s || "all"} value={s}>{s ? s : "All statuses"}</option>
                                ))}
                            </select>
                            <select
                                value={oversightBarangay}
                                onChange={(e) => setOversightBarangay(e.target.value)}
                                className="px-2 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-xs focus:border-primary focus:outline-none"
                            >
                                <option value="">All barangays</option>
                                {BARANGAYS.map((b) => (
                                    <option key={b} value={b}>{b}</option>
                                ))}
                            </select>
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">From</label>
                                <input
                                    type="date"
                                    value={oversightDateFrom}
                                    onChange={(e) => setOversightDateFrom(e.target.value)}
                                    className="px-2 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-xs focus:border-primary focus:outline-none"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">To</label>
                                <input
                                    type="date"
                                    value={oversightDateTo}
                                    onChange={(e) => setOversightDateTo(e.target.value)}
                                    className="px-2 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-xs focus:border-primary focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/5 text-xs text-white/40 uppercase tracking-widest bg-black/20 sticky top-0 z-10">
                                        <th className="p-4">Tracking ID</th>
                                        <th className="p-4">Barangay</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4">Open</th>
                                        <th className="p-4">Date Reported</th>
                                        <th className="p-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {queueLoading ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <tr key={i} className="border-b border-white/5">
                                                {Array.from({ length: 6 }).map((__, j) => (
                                                    <td key={j} className="p-4"><div className="h-3 bg-white/10 rounded animate-pulse" /></td>
                                                ))}
                                            </tr>
                                        ))
                                    ) : displayedQueueReports.length === 0 ? (
                                        <tr><td colSpan={6} className="p-12 text-center text-white/50 font-bold">No reports match the current filters.</td></tr>
                                    ) : (
                                        displayedQueueReports.map(report => {
                                            const sla = slaInfo(report.created_at, report.status);
                                            return (
                                                <tr key={report.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                    <td className="p-4 font-mono text-sm text-white font-bold">{report.tracking_id}</td>
                                                    <td className="p-4 text-sm font-bold text-emerald-300">{report.barangay}</td>
                                                    <td className="p-4">
                                                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                                                            report.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                                                            report.status === 'deployed' ? 'bg-yellow-500/20 text-yellow-400' :
                                                            report.status === 'failed_cleanup' ? 'bg-red-500/20 text-red-400' :
                                                            report.status === 'rejected' ? 'bg-white/5 text-white/40' :
                                                            'bg-white/10 text-white'
                                                        }`}>
                                                            {report.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        {sla ? (
                                                            <span className={`px-2 py-1 rounded-md text-[11px] font-bold ${SLA_PILL_CLASSES[sla.color]}`}>{sla.days}d</span>
                                                        ) : (
                                                            <span className="text-white/30 text-sm">—</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-sm text-white/60">
                                                        {new Date(report.created_at).toLocaleDateString()}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedReport(report);
                                                                setNewBarangay(report.barangay);
                                                            }}
                                                            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition-colors border border-white/5"
                                                        >
                                                            Oversight
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
                )}

                {activeTab === 'audit' && (
                    /* C1 — AUDIT LOG TAB */
                    <div className="flex-1 glass rounded-2xl border border-white/10 flex flex-col min-h-0 shadow-2xl">
                        <div className="p-6 border-b border-white/10 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-white">Audit Log</h2>
                                <p className="text-sm text-white/50">Every override action — who, when, what, why.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Action</label>
                                <select
                                    value={auditAction}
                                    onChange={(e) => setAuditAction(e.target.value)}
                                    className="px-2 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-xs focus:border-primary focus:outline-none"
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
                                    <tr className="border-b border-white/5 text-xs text-white/40 uppercase tracking-widest bg-black/20 sticky top-0 z-10">
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
                                            <tr key={i} className="border-b border-white/5">
                                                {Array.from({ length: 5 }).map((__, j) => (
                                                    <td key={j} className="p-4"><div className="h-3 bg-white/10 rounded animate-pulse" /></td>
                                                ))}
                                            </tr>
                                        ))
                                    ) : displayedAuditEntries.length === 0 ? (
                                        <tr><td colSpan={5} className="p-12 text-center text-white/50 font-bold">No audit entries match this filter.</td></tr>
                                    ) : (
                                        displayedAuditEntries.map((e) => {
                                            const detailsStr = e.details && Object.keys(e.details).length ? JSON.stringify(e.details) : "";
                                            const targetLabel = e.details?.tracking_id || `${e.target_type} #${e.target_id ?? "—"}`;
                                            return (
                                                <tr key={e.id} className="border-b border-white/5 hover:bg-white/5">
                                                    <td className="p-4 text-xs text-white/70 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                                                    <td className="p-4 text-sm text-white">{e.user_email || "—"}</td>
                                                    <td className="p-4">
                                                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${ACTION_PILL_CLASSES[e.action] || 'bg-white/10 text-white'}`}>
                                                            {e.action}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-xs font-mono text-emerald-300">{targetLabel}</td>
                                                    <td className="p-4 text-[11px] text-white/60 font-mono max-w-md truncate" title={detailsStr}>
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
                            <div className="p-4 border-t border-white/10 shrink-0 flex justify-center">
                                <button
                                    onClick={() => fetchAuditLog(auditOffset + 50)}
                                    disabled={auditLoading}
                                    className="px-6 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-bold uppercase tracking-widest hover:bg-white/10 disabled:opacity-50"
                                >
                                    {auditLoading ? "Loading…" : "Load more"}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'users' && (
                    /* C2 — USER MANAGEMENT TAB */
                    <div className="flex-1 glass rounded-2xl border border-white/10 flex flex-col min-h-0 shadow-2xl">
                        <div className="p-6 border-b border-white/10 shrink-0 flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-white">Barangay Accounts</h2>
                                <p className="text-sm text-white/50">Onboard new barangays and disable retired accounts.</p>
                            </div>
                            <button
                                onClick={() => setShowCreateUserModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-primary/20 border border-primary/30 text-primary text-xs font-bold uppercase tracking-widest hover:bg-primary/30 rounded-lg transition-colors"
                            >
                                <Plus size={14} />
                                Add Barangay Account
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/5 text-xs text-white/40 uppercase tracking-widest bg-black/20 sticky top-0 z-10">
                                        <th className="p-4">Email</th>
                                        <th className="p-4">Full Name</th>
                                        <th className="p-4">Barangay</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {usersLoading ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <tr key={i} className="border-b border-white/5">
                                                {Array.from({ length: 5 }).map((__, j) => (
                                                    <td key={j} className="p-4"><div className="h-3 bg-white/10 rounded animate-pulse" /></td>
                                                ))}
                                            </tr>
                                        ))
                                    ) : barangayUsers.length === 0 ? (
                                        <tr><td colSpan={5} className="p-12 text-center text-white/50 font-bold">No barangay accounts yet. Click &quot;Add Barangay Account&quot; to onboard the first one.</td></tr>
                                    ) : (
                                        barangayUsers.map((u) => (
                                            <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                                                <td className="p-4 text-sm text-white">{u.email}</td>
                                                <td className="p-4 text-sm text-white/80">{u.full_name}</td>
                                                <td className="p-4 text-sm font-bold text-emerald-300">{u.barangay_assignment || "—"}</td>
                                                <td className="p-4">
                                                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${u.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                        {u.is_active ? "Active" : "Disabled"}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    {u.is_active ? (
                                                        <button
                                                            onClick={() => handleDisableUser(u.id, u.email)}
                                                            disabled={disabling.has(u.id)}
                                                            className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold hover:bg-red-500/30 transition-colors disabled:opacity-50"
                                                        >
                                                            {disabling.has(u.id) ? "Disabling…" : "Disable"}
                                                        </button>
                                                    ) : (
                                                        <span className="text-white/30 text-sm">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Oversight Detail Modal */}
            {selectedReport && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="glass p-0 max-w-2xl w-full rounded-2xl border border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.1)] relative overflow-hidden">

                        <div className="bg-emerald-900/40 border-b border-emerald-500/30 px-6 py-4 flex items-center justify-between">
                            <div>
                                <div className="text-[10px] text-emerald-300 font-bold uppercase tracking-widest mb-1">Cenro Override Console</div>
                                <h2 className="text-lg font-semibold text-white">Report {selectedReport.tracking_id}</h2>
                            </div>
                            <button
                                onClick={() => setSelectedReport(null)}
                                className="p-2 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 md:p-8 space-y-8">

                            {/* Reassign Action */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-white uppercase tracking-widest border-b border-white/10 pb-2">1. Reassign Barangay</h3>
                                <p className="text-xs text-white/50">If the algorithm assigned this to the wrong jurisdiction, override it here.</p>
                                <div className="flex gap-4">
                                    <select
                                        value={newBarangay}
                                        onChange={(e) => setNewBarangay(e.target.value)}
                                        className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-primary"
                                    >
                                        {BARANGAYS.map(b => (
                                            <option key={b} value={b}>{b}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => handleReassign(selectedReport.id)}
                                        disabled={actionLoading || newBarangay === selectedReport.barangay}
                                        className="px-6 py-3 bg-primary hover:bg-emerald-400 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 transition-colors whitespace-nowrap"
                                    >
                                        Update Route
                                    </button>
                                </div>
                            </div>

                            {/* Force Close Action */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-white uppercase tracking-widest border-b border-white/10 pb-2">2. Administrative Override</h3>
                                <p className="text-xs text-white/50">Force-close this ticket. Use this if AI verification is repeatedly failing but visual inspection confirms cleanup.</p>
                                <button
                                    onClick={() => handleForceClose(selectedReport.id)}
                                    disabled={actionLoading || selectedReport.status === 'resolved'}
                                    className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                                    Force Close Ticket
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* C2 — Create User Modal */}
            {showCreateUserModal && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="glass max-w-md w-full rounded-2xl border border-emerald-500/30 overflow-hidden">
                        <div className="bg-emerald-900/40 border-b border-emerald-500/30 px-6 py-4 flex items-center justify-between">
                            <h2 className="text-base font-semibold text-white">New Barangay Account</h2>
                            <button onClick={() => setShowCreateUserModal(false)} className="p-2 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-full">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1 block">Email</label>
                                <input
                                    type="email"
                                    value={createForm.email}
                                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                                    placeholder="barangay@example.gov.ph"
                                    className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:border-primary focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1 block">Full Name</label>
                                <input
                                    type="text"
                                    value={createForm.full_name}
                                    onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                                    placeholder="Juan dela Cruz"
                                    className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:border-primary focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1 block">Barangay Assignment</label>
                                <select
                                    value={createForm.barangay_assignment}
                                    onChange={(e) => setCreateForm({ ...createForm, barangay_assignment: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:border-primary focus:outline-none"
                                >
                                    <option value="">Select barangay…</option>
                                    {BARANGAYS.map((b) => (
                                        <option key={b} value={b}>{b}</option>
                                    ))}
                                </select>
                            </div>
                            <p className="text-[11px] text-white/40 italic">A temporary password will be generated and shown once after submission.</p>
                            <button
                                onClick={handleCreateUser}
                                disabled={createPending}
                                className="w-full py-3 bg-primary hover:bg-emerald-400 text-white rounded-xl font-bold shadow-lg disabled:opacity-50"
                            >
                                {createPending ? "Creating…" : "Create Account"}
                            </button>
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
                            <button onClick={() => setCreatedCredential(null)} className="p-2 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-full">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-xs text-yellow-200 font-bold">⚠ This password will not be shown again. Share it with the new account holder now.</p>
                            <div>
                                <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1 block">Email</label>
                                <div className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm font-mono">{createdCredential.email}</div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1 block">Temporary Password</label>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm font-mono select-all break-all">{createdCredential.password}</div>
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
                                className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
