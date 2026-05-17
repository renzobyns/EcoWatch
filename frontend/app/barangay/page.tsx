"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Search, Download } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";

const MiniMap = dynamic(() => import("@/components/MiniMap"), { ssr: false });
const MapComponent = dynamic(() => import("@/components/MapComponent"), { ssr: false });
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

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

const SLA_PILL_CLASSES: Record<"green" | "yellow" | "red", string> = {
    green: "bg-green-500/20 text-green-400",
    yellow: "bg-yellow-500/20 text-yellow-400",
    red: "bg-red-500/20 text-red-400",
};

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

export default function BarangayPortal() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [tableLoading, setTableLoading] = useState(false);
    const [selectedReport, setSelectedReport] = useState<any>(null);
    const [filter, setFilter] = useState<'pending' | 'deployed' | 'resolved'>('pending');

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
            const data = await api(`/report/${reportId}/deploy`, { method: "PUT", body: formData });
            const updated = { status: 'deployed', deployment_notes: trimmed || null };
            setReports(reports.map(r => r.id === reportId ? { ...r, ...updated, ...(data?.report || {}) } : r));
            setSelectedReport({ ...selectedReport, ...updated, ...(data?.report || {}) });
            setDeploymentNotes("");
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
        formData.append("cleanup_image", cleanupImage);

        try {
            const data = await api(`/report/${reportId}/resolve`, {
                method: "POST",
                body: formData,
            });
            setReports(reports.map(r => r.id === reportId ? { ...r, status: data.status, cleanup_image_url: data.report.cleanup_image_url } : r));
            setSelectedReport({ ...selectedReport, status: data.status, cleanup_image_url: data.report.cleanup_image_url });
            setCleanupImage(null);
            setCleanupPreview(null);
            if (data.status === 'failed_cleanup') {
                toast.warning("AI detected waste is still present. Please clean thoroughly and try again.");
            } else {
                toast.success("Report resolved!");
                setSelectedReport(null); // Close modal on success
            }
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Network error.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            await downloadCsv(buildQuery());
            toast.success("CSV downloaded.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Export failed");
        }
    };

    if (loading || !user) {
        return (
            <div className="min-h-screen bg-[#0a0f0a] flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white p-1 shadow-[0_0_30px_rgba(16,185,129,0.3)] animate-pulse">
                    <img src="/logo.png" alt="Loading..." className="w-full h-full object-contain" />
                </div>
                <div className="text-emerald-500 font-bold tracking-widest uppercase text-sm animate-pulse">Initializing Portal...</div>
            </div>
        );
    }

    const displayReports = reports.filter(r => {
        if (filter === 'pending') return r.status === 'pending' || r.status === 'verified';
        if (filter === 'deployed') return r.status === 'deployed' || r.status === 'failed_cleanup';
        return r.status === 'resolved';
    });

    const stats = {
        pending: reports.filter(r => r.status === 'pending' || r.status === 'verified').length,
        deployed: reports.filter(r => r.status === 'deployed' || r.status === 'failed_cleanup').length,
        resolved: reports.filter(r => r.status === 'resolved').length
    };

    return (
        <div className="min-h-screen bg-[#0a0f0a] pt-20 pb-10 px-4 md:px-8 relative overflow-hidden">
            {/* Pro Max Background Accents */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-[1600px] mx-auto h-[calc(100vh-8rem)] flex flex-col relative z-10">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 shrink-0 animate-slide-up">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Barangay <span className="text-primary">Dashboard</span></h1>
                        <p className="text-emerald-400 font-semibold uppercase tracking-[0.18em] text-[11px] px-2.5 py-0.5 bg-emerald-400/10 rounded-full w-fit border border-emerald-400/20">
                            {user.barangay_assignment}
                        </p>
                    </div>
                </div>

                {/* Main Content Split: 60/40 */}
                <div className="flex-1 flex flex-col lg:flex-row gap-5 min-h-0">

                    {/* Left: Report Queue (60%) */}
                    <div className="flex-[3] flex flex-col gap-4 min-h-0">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-3 gap-4 shrink-0 animate-slide-up stagger-1">
                            <div className="glass-pro p-5 rounded-2xl bento-card">
                                <div className="text-[11px] font-semibold text-white/40 uppercase tracking-[0.1em] mb-1.5">Pending Reports</div>
                                <div className="text-3xl font-bold text-red-400 tracking-tight">{stats.pending}</div>
                                <div className="mt-3 w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-red-400/50" style={{ width: '40%' }}></div>
                                </div>
                            </div>
                            <div className="glass-pro p-5 rounded-2xl bento-card">
                                <div className="text-[11px] font-semibold text-white/40 uppercase tracking-[0.1em] mb-1.5">Teams Deployed</div>
                                <div className="text-3xl font-bold text-yellow-400 tracking-tight">{stats.deployed}</div>
                                <div className="mt-3 w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-yellow-400/50" style={{ width: '60%' }}></div>
                                </div>
                            </div>
                            <div className="glass-pro p-5 rounded-2xl bento-card">
                                <div className="text-[11px] font-semibold text-white/40 uppercase tracking-[0.1em] mb-1.5">Resolved Today</div>
                                <div className="text-3xl font-bold text-green-400 tracking-tight">{stats.resolved}</div>
                                <div className="mt-3 w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-400/50" style={{ width: '80%' }}></div>
                                </div>
                            </div>
                        </div>

                        <div className="glass-pro rounded-[2.5rem] flex flex-col flex-1 min-h-0 shadow-2xl animate-slide-up stagger-2 overflow-hidden">
                            {/* Filter Bar (B1 + B4) */}
                            <div className="flex flex-col lg:flex-row gap-3 p-4 border-b border-white/10 shrink-0">
                                <div className="relative flex-1 min-w-[200px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search tracking ID or notes…"
                                        className="w-full pl-9 pr-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm placeholder:text-white/40 focus:border-primary focus:outline-none"
                                    />
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">From</label>
                                        <input
                                            type="date"
                                            value={dateFrom}
                                            onChange={(e) => setDateFrom(e.target.value)}
                                            onClick={(e) => (e.target as any).showPicker?.()}
                                            className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-xs focus:border-primary focus:outline-none cursor-pointer hover:bg-white/5 transition-colors"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">To</label>
                                        <input
                                            type="date"
                                            value={dateTo}
                                            onChange={(e) => setDateTo(e.target.value)}
                                            onClick={(e) => (e.target as any).showPicker?.()}
                                            className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-xs focus:border-primary focus:outline-none cursor-pointer hover:bg-white/5 transition-colors"
                                        />
                                    </div>
                                    {(search || dateFrom || dateTo) && (
                                        <button
                                            onClick={() => {
                                                setSearch("");
                                                setDateFrom("");
                                                setDateTo("");
                                            }}
                                            className="text-[10px] font-bold text-white/30 hover:text-white uppercase tracking-widest transition-colors"
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

                            {/* Tabs */}
                            <div className="flex border-b border-white/10 shrink-0">
                                <button
                                    onClick={() => setFilter('pending')}
                                    className={`flex-1 py-3 text-[11px] font-semibold uppercase tracking-widest transition-colors ${filter === 'pending' ? 'bg-primary/20 text-primary border-b-2 border-primary' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
                                >
                                    Pending
                                </button>
                                <button
                                    onClick={() => setFilter('deployed')}
                                    className={`flex-1 py-3 text-[11px] font-semibold uppercase tracking-widest transition-colors ${filter === 'deployed' ? 'bg-primary/20 text-primary border-b-2 border-primary' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
                                >
                                    Deployed
                                </button>
                                <button
                                    onClick={() => setFilter('resolved')}
                                    className={`flex-1 py-3 text-[11px] font-semibold uppercase tracking-widest transition-colors ${filter === 'resolved' ? 'bg-primary/20 text-primary border-b-2 border-primary' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
                                >
                                    Done
                                </button>
                            </div>

                            {/* Table Container */}
                            <div className="flex-1 overflow-y-auto">
                                {tableLoading ? (
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-white/5 text-xs text-white/40 uppercase tracking-widest bg-black/20">
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
                                                <tr key={i} className="border-b border-white/5">
                                                    {Array.from({ length: 6 }).map((__, j) => (
                                                        <td key={j} className="p-4"><div className="h-3 bg-white/10 rounded animate-pulse" /></td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : displayReports.length === 0 ? (
                                    <div className="p-12 text-center text-white/50 font-bold">No reports found in this category.</div>
                                ) : (
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-white/5 text-xs text-white/40 uppercase tracking-widest bg-black/20">
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
                                                    <tr key={report.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                        <td className="p-4 font-mono text-sm text-white font-bold">{report.tracking_id}</td>
                                                        <td className="p-4 text-sm text-white/70">
                                                            {new Date(report.created_at).toLocaleDateString()}
                                                        </td>
                                                        <td className="p-4">
                                                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                                                                report.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                                                                report.status === 'deployed' ? 'bg-yellow-500/20 text-yellow-400' :
                                                                report.status === 'failed_cleanup' ? 'bg-red-500/20 text-red-400' :
                                                                'bg-white/10 text-white'
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
                                                                <span className="text-white/30 text-sm">—</span>
                                                            )}
                                                        </td>
                                                        <td className="p-4 text-sm font-bold text-white/80">
                                                            {report.ai_confidence ? `${(report.ai_confidence * 100).toFixed(0)}%` : 'N/A'}
                                                        </td>
                                                        <td className="p-4 text-right">
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedReport(report);
                                                                    setCleanupPreview(null);
                                                                    setCleanupImage(null);
                                                                    setDeploymentNotes("");
                                                                }}
                                                                className="px-4 py-2 glass border border-white/10 text-white text-xs font-bold rounded-lg hover:bg-white/10 transition-colors"
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
                            </div>
                        </div>
                    </div>

                    {/* Right: Map View (40%) */}
                    <div className="flex-[2] glass-pro rounded-[2.5rem] overflow-hidden shadow-2xl relative min-h-[400px] animate-slide-up stagger-3">
                        <div className="absolute top-6 left-6 z-[1000] glass-pro px-4 py-2 rounded-full text-[11px] font-bold text-white uppercase tracking-widest pointer-events-none">
                            <span className="flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                Assigned Locations
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
                </div>
            </div>

            {/* Report Detail Modal */}
            {selectedReport && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="glass p-0 max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 shadow-2xl relative animate-in zoom-in-95 duration-300">

                        {/* Modal Header */}
                        <div className="sticky top-0 z-10 glass border-b border-white/10 px-6 py-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-white">Report {selectedReport.tracking_id}</h2>
                                <p className="text-xs text-white/50 font-bold uppercase tracking-widest">{selectedReport.status}</p>
                            </div>
                            <button
                                onClick={() => setSelectedReport(null)}
                                className="p-2 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>

                        <div className="p-6 md:p-8 grid md:grid-cols-2 gap-8">

                            {/* Left Col: Info & Map */}
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-2">Location Map</h3>
                                    <div className="w-full h-48 rounded-xl overflow-hidden border border-white/10 relative bg-black/50">
                                        <MiniMap lat={selectedReport.lat} lon={selectedReport.lon} />
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-1">Citizen Notes</h3>
                                    <p className="text-sm text-white/80 bg-black/30 p-4 rounded-xl border border-white/5 italic">
                                        {selectedReport.notes || "No notes provided."}
                                    </p>
                                </div>

                                {selectedReport.deployment_notes && (
                                    <div>
                                        <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-1">Deployment Notes</h3>
                                        <p className="text-sm text-white/80 bg-black/30 p-4 rounded-xl border border-white/5">
                                            {selectedReport.deployment_notes}
                                        </p>
                                    </div>
                                )}

                                <div className="text-xs text-white/40">
                                    Reported: {new Date(selectedReport.created_at).toLocaleString()}
                                </div>
                            </div>

                            {/* Right Col: Evidence & Actions */}
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-2">Evidence Photo</h3>
                                    <div className="w-full aspect-video rounded-xl overflow-hidden border border-white/10 bg-black/50 relative">
                                        <img src={`${API_URL}${selectedReport.image_url}`} className="w-full h-full object-cover" alt="Evidence" />
                                        {selectedReport.ai_confidence && (
                                            <div className="absolute bottom-2 right-2 glass px-2 py-1 rounded text-[10px] font-bold text-white">
                                                AI Confidence: {(selectedReport.ai_confidence * 100).toFixed(0)}%
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Action Area */}
                                <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                                    <h3 className="text-xs font-semibold text-white uppercase tracking-widest mb-4 border-b border-white/10 pb-2">Take Action</h3>

                                    {selectedReport.status === 'verified' && (
                                        <div>
                                            <p className="text-xs text-white/60 mb-4">This report has been verified by the AI. Dispatch a cleanup team to the location.</p>
                                            <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">Deployment Notes <span className="text-white/30 normal-case font-medium">(optional)</span></label>
                                            <textarea
                                                value={deploymentNotes}
                                                onChange={(e) => setDeploymentNotes(e.target.value)}
                                                placeholder="Optional: who was dispatched, ETA, contact info…"
                                                rows={3}
                                                className="w-full mb-4 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm placeholder:text-white/30 focus:border-primary focus:outline-none resize-none"
                                            />
                                            <button
                                                onClick={() => handleDeploy(selectedReport.id)}
                                                disabled={actionLoading}
                                                className="w-full py-3 eco-gradient text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                                            >
                                                {actionLoading ? "Processing..." : "Deploy Cleanup Team"}
                                            </button>
                                        </div>
                                    )}

                                    {(selectedReport.status === 'deployed' || selectedReport.status === 'failed_cleanup') && (
                                        <div>
                                            <p className="text-xs text-white/60 mb-4">
                                                {selectedReport.status === 'failed_cleanup'
                                                    ? "Previous cleanup was rejected by AI. Please upload a new proof photo."
                                                    : "Team is deployed. Upload a clear photo of the cleaned area to resolve."}
                                            </p>

                                            <label className="block w-full h-32 border-2 border-dashed border-white/20 hover:border-primary/50 rounded-xl mb-4 cursor-pointer overflow-hidden relative group">
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
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40 group-hover:text-primary transition-colors">
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

                                    {selectedReport.status === 'resolved' && (
                                        <div>
                                            <div className="flex items-center gap-2 text-green-400 font-bold mb-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                                Cleanup Verified
                                            </div>
                                            {selectedReport.cleanup_image_url && (
                                                <div className="w-full h-32 rounded-lg overflow-hidden border border-white/10 mt-2">
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

        </div>
    );
}
