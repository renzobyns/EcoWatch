"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

const MapComponent = dynamic(() => import("@/components/MapComponent"), { ssr: false });
const MiniMap = dynamic(() => import("@/components/MiniMap"), { ssr: false });
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
    "Gumaoc East", "Gumaoc West", "Graceville", "Poblacion", "Poblacion I"
];

export default function CenroDashboard() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [reports, setReports] = useState<any[]>([]);
    const [heatmaps, setHeatmaps] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // UI State
    const [activeTab, setActiveTab] = useState<'command_center' | 'overview' | 'oversight'>('command_center');
    const [selectedReport, setSelectedReport] = useState<any>(null);
    
    // Action State
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [newBarangay, setNewBarangay] = useState<string>("");

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
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // Fetch all recent reports
            const repRes = await fetch(`${API_URL}/reports/recent`);
            const repData = await repRes.json();
            if (Array.isArray(repData)) setReports(repData);

            // Fetch heatmaps
            const heatRes = await fetch(`${API_URL}/spatial/heatmaps`);
            const heatData = await heatRes.json();
            if (heatData && Array.isArray(heatData.hotspots)) {
                setHeatmaps(heatData.hotspots);
            }
        } catch (err) {
            console.error("Failed to load CENRO data", err);
        } finally {
            setLoading(false);
        }
    };

    const handleReassign = async (reportId: number) => {
        if (!newBarangay) return;
        setActionLoading(true);
        setActionError(null);

        const formData = new FormData();
        formData.append("new_barangay", newBarangay);

        try {
            const res = await fetch(`${API_URL}/report/${reportId}/reassign`, {
                method: "PUT",
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                setReports(reports.map(r => r.id === reportId ? { ...r, barangay: newBarangay } : r));
                setSelectedReport({ ...selectedReport, barangay: newBarangay });
                setActionError("Successfully reassigned.");
            } else {
                setActionError(data.detail || "Failed to reassign.");
            }
        } catch (err) {
            setActionError("Network error.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleForceClose = async (reportId: number) => {
        if (!confirm("Are you sure you want to force-close this report? This overrides AI verification.")) return;
        setActionLoading(true);
        setActionError(null);

        try {
            const res = await fetch(`${API_URL}/report/${reportId}/force-close`, { method: "PUT" });
            const data = await res.json();
            if (res.ok) {
                setReports(reports.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
                setSelectedReport({ ...selectedReport, status: 'resolved' });
            } else {
                setActionError(data.detail || "Failed to force close.");
            }
        } catch (err) {
            setActionError("Network error.");
        } finally {
            setActionLoading(false);
        }
    };

    if (loading || !user) {
        return <div className="min-h-screen bg-[#0a0f0a] flex items-center justify-center text-white font-bold">Loading CENRO Dashboard...</div>;
    }

    const stats = {
        total: reports.length,
        resolved: reports.filter(r => r.status === 'resolved').length,
        deployed: reports.filter(r => r.status === 'deployed').length,
        failed: reports.filter(r => r.status === 'failed_cleanup').length,
    };
    const pending = stats.total - stats.resolved - stats.deployed - stats.failed;
    const successRate = stats.total > 0 ? ((stats.resolved / stats.total) * 100).toFixed(1) : 0;

    // Variant A Data Processing
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
        <div className="min-h-screen bg-[#0a0f0a] pt-24 pb-12 px-4 md:px-8">
            <div className="max-w-[1600px] mx-auto h-[calc(100vh-8rem)] flex flex-col">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 shrink-0">
                    <div>
                        <h1 className="text-3xl font-black text-white mb-1">CENRO Operations Hub</h1>
                        <p className="text-blue-400 font-bold uppercase tracking-widest">City-Wide Oversight & Analytics</p>
                    </div>
                    
                    {/* Navigation Tabs */}
                    <div className="flex gap-2 bg-white/5 p-1 rounded-xl border border-white/10 mt-4 md:mt-0">
                        <button 
                            onClick={() => setActiveTab('command_center')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'command_center' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-white/50 hover:text-white'}`}
                        >
                            Command Center
                        </button>
                        <button 
                            onClick={() => setActiveTab('overview')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-white/50 hover:text-white'}`}
                        >
                            Overview Map
                        </button>
                        <button 
                            onClick={() => setActiveTab('oversight')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'oversight' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-white/50 hover:text-white'}`}
                        >
                            Oversight Queue
                        </button>
                    </div>
                </div>

                {activeTab === 'command_center' && (
                    /* COMMAND CENTER TAB (Variant A) */
                    <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
                        
                        {/* Top Stats Bar */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
                            <div className="glass p-4 rounded-2xl border border-white/10">
                                <div className="text-[10px] text-white/50 uppercase tracking-widest font-bold mb-1">Total Reports</div>
                                <div className="text-3xl font-black text-blue-400">{stats.total}</div>
                            </div>
                            <div className="glass p-4 rounded-2xl border border-white/10">
                                <div className="text-[10px] text-white/50 uppercase tracking-widest font-bold mb-1">Active/Pending</div>
                                <div className="text-3xl font-black text-red-400">{pending}</div>
                            </div>
                            <div className="glass p-4 rounded-2xl border border-white/10">
                                <div className="text-[10px] text-white/50 uppercase tracking-widest font-bold mb-1">Teams Deployed</div>
                                <div className="text-3xl font-black text-yellow-400">{stats.deployed}</div>
                            </div>
                            <div className="glass p-4 rounded-2xl border border-white/10">
                                <div className="text-[10px] text-white/50 uppercase tracking-widest font-bold mb-1">Success Rate</div>
                                <div className="text-3xl font-black text-green-400">{successRate}%</div>
                            </div>
                        </div>

                        {/* Main Grid */}
                        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
                            
                            {/* Left: Charts */}
                            <div className="lg:col-span-1 flex flex-col gap-6 min-h-0">
                                <div className="flex-1 glass p-6 rounded-3xl border border-white/10 flex flex-col min-h-0">
                                    <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4 shrink-0">Status Breakdown</h3>
                                    <div className="flex-1 relative min-h-[150px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={5} dataKey="value">
                                                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                                </Pie>
                                                <Tooltip contentStyle={{ backgroundColor: '#0a0f0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex flex-wrap justify-center gap-4 mt-2 shrink-0">
                                        {pieData.map(d => (
                                            <div key={d.name} className="flex items-center gap-2 text-xs text-white/80"><div className="w-3 h-3 rounded-full" style={{backgroundColor: d.color}}></div>{d.name}</div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex-1 glass p-6 rounded-3xl border border-white/10 flex flex-col min-h-0">
                                    <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4 shrink-0">Trend (Last 14 Days)</h3>
                                    <div className="flex-1 relative min-h-[150px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={lineData}>
                                                <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" fontSize={10} tickMargin={10} />
                                                <Tooltip contentStyle={{ backgroundColor: '#0a0f0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                                                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Center: Map */}
                            <div className="lg:col-span-1 glass rounded-3xl border border-white/10 overflow-hidden relative min-h-[300px]">
                                <div className="absolute top-4 left-4 z-[1000] glass px-3 py-1.5 rounded-full text-[10px] font-bold text-white uppercase tracking-widest border border-white/20 pointer-events-none">Live City Map</div>
                                <MapComponent height="100%" reports={reports} heatmaps={heatmaps} focusedBarangay={null} onBarangayClick={() => {}} />
                            </div>

                            {/* Right: Lists */}
                            <div className="lg:col-span-1 flex flex-col gap-6 min-h-0">
                                <div className="flex-1 glass p-6 rounded-3xl border border-white/10 flex flex-col min-h-0">
                                    <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4 shrink-0">Barangay Leaderboard</h3>
                                    <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                                        {barangayStats.map((b, i) => (
                                            <div key={b.name} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-6 h-6 rounded bg-black/50 flex items-center justify-center text-[10px] font-bold text-white/50">{i + 1}</div>
                                                    <div className="text-sm font-bold text-white">{b.name}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-black text-green-400">{b.rate.toFixed(0)}%</div>
                                                    <div className="text-[10px] text-white/40">{b.resolved}/{b.total} done</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex-1 glass p-6 rounded-3xl border border-white/10 flex flex-col min-h-0">
                                    <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4 shrink-0">Recent Activity</h3>
                                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                                        {recentFeed.map(r => (
                                            <div key={r.id} className="relative pl-4 border-l border-white/10">
                                                <div className="absolute w-2 h-2 rounded-full bg-blue-500 -left-[5px] top-1.5"></div>
                                                <div className="text-xs font-bold text-white mb-0.5">Report {r.tracking_id}</div>
                                                <div className="text-[10px] text-white/60 mb-1">{r.barangay} • {new Date(r.created_at).toLocaleString()}</div>
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${r.status === 'resolved' ? 'bg-green-500/20 text-green-400' : r.status === 'deployed' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>{r.status}</span>
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
                            <div className="glass p-6 rounded-3xl border border-white/10 shadow-2xl">
                                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                                </div>
                                <div className="text-xs font-bold text-white/50 uppercase tracking-widest mb-1">Total Reports</div>
                                <div className="text-4xl font-black text-white">{stats.total}</div>
                            </div>
                            
                            <div className="glass p-6 rounded-3xl border border-white/10 shadow-2xl">
                                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                </div>
                                <div className="text-xs font-bold text-white/50 uppercase tracking-widest mb-1">City Success Rate</div>
                                <div className="text-4xl font-black text-green-400">{successRate}%</div>
                                <p className="text-xs text-white/40 mt-2">{stats.resolved} resolved out of {stats.total}</p>
                            </div>

                            <div className="glass p-6 rounded-3xl border border-white/10 shadow-2xl">
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
                                                <div className="text-xl font-black text-white/80">{h.report_count}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right: Map */}
                        <div className="flex-[3] glass rounded-3xl border border-white/10 overflow-hidden shadow-2xl relative min-h-[400px]">
                            <div className="absolute top-4 left-4 z-[1000] glass px-4 py-2 rounded-full text-xs font-bold text-white border border-white/20 shadow-lg pointer-events-none flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
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
                ) : (
                    /* OVERSIGHT QUEUE TAB */
                    <div className="flex-1 glass rounded-3xl border border-white/10 flex flex-col min-h-0 shadow-2xl">
                        <div className="p-6 border-b border-white/10 shrink-0">
                            <h2 className="text-xl font-black text-white">Global Report Queue</h2>
                            <p className="text-sm text-white/50">Manage overrides and cross-barangay assignments.</p>
                        </div>
                        
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/5 text-xs text-white/40 uppercase tracking-widest bg-black/20 sticky top-0 z-10">
                                        <th className="p-4">Tracking ID</th>
                                        <th className="p-4">Barangay</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4">Date Reported</th>
                                        <th className="p-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reports.map(report => (
                                        <tr key={report.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="p-4 font-mono text-sm text-white font-bold">{report.tracking_id}</td>
                                            <td className="p-4 text-sm font-bold text-blue-300">{report.barangay}</td>
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
                                            <td className="p-4 text-sm text-white/60">
                                                {new Date(report.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="p-4 text-right">
                                                <button 
                                                    onClick={() => {
                                                        setSelectedReport(report);
                                                        setNewBarangay(report.barangay);
                                                        setActionError(null);
                                                    }}
                                                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition-colors border border-white/5"
                                                >
                                                    Oversight
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Oversight Detail Modal */}
            {selectedReport && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="glass p-0 max-w-2xl w-full rounded-3xl border border-blue-500/30 shadow-[0_0_50px_rgba(59,130,246,0.1)] relative overflow-hidden">
                        
                        <div className="bg-blue-900/40 border-b border-blue-500/30 px-6 py-4 flex items-center justify-between">
                            <div>
                                <div className="text-[10px] text-blue-300 font-bold uppercase tracking-widest mb-1">Cenro Override Console</div>
                                <h2 className="text-xl font-black text-white">Report {selectedReport.tracking_id}</h2>
                            </div>
                            <button 
                                onClick={() => setSelectedReport(null)}
                                className="p-2 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>

                        <div className="p-6 md:p-8 space-y-8">
                            
                            {actionError && (
                                <div className="p-3 rounded-lg bg-blue-500/20 border border-blue-500/30 text-sm font-bold text-blue-300">
                                    {actionError}
                                </div>
                            )}

                            {/* Reassign Action */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-white uppercase tracking-widest border-b border-white/10 pb-2">1. Reassign Barangay</h3>
                                <p className="text-xs text-white/50">If the algorithm assigned this to the wrong jurisdiction, override it here.</p>
                                <div className="flex gap-4">
                                    <select 
                                        value={newBarangay}
                                        onChange={(e) => setNewBarangay(e.target.value)}
                                        className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-blue-500"
                                    >
                                        {BARANGAYS.map(b => (
                                            <option key={b} value={b}>{b}</option>
                                        ))}
                                    </select>
                                    <button 
                                        onClick={() => handleReassign(selectedReport.id)}
                                        disabled={actionLoading || newBarangay === selectedReport.barangay}
                                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 transition-colors whitespace-nowrap"
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

        </div>
    );
}
