"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

const MiniMap = dynamic(() => import("@/components/MiniMap"), { ssr: false });
const MapComponent = dynamic(() => import("@/components/MapComponent"), { ssr: false });
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function BarangayPortal() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState<any>(null);
    const [filter, setFilter] = useState<'pending' | 'deployed' | 'resolved'>('pending');

    // Action States
    const [actionLoading, setActionLoading] = useState(false);
    const [cleanupImage, setCleanupImage] = useState<File | null>(null);
    const [cleanupPreview, setCleanupPreview] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

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
        fetchReports(parsed.barangay_assignment);
    }, []);

    const fetchReports = async (barangayName: string) => {
        try {
            const res = await fetch(`${API_URL}/reports/barangay/${barangayName}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                // Sort by newest first
                setReports(data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
            }
        } catch (err) {
            console.error("Failed to load reports", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeploy = async (reportId: number) => {
        setActionLoading(true);
        setActionError(null);
        try {
            const res = await fetch(`${API_URL}/report/${reportId}/deploy`, { method: "PUT" });
            const data = await res.json();
            if (res.ok) {
                // Update local state
                setReports(reports.map(r => r.id === reportId ? { ...r, status: 'deployed' } : r));
                setSelectedReport({ ...selectedReport, status: 'deployed' });
            } else {
                setActionError(data.detail || "Failed to deploy.");
            }
        } catch (err) {
            setActionError("Network error.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleResolve = async (reportId: number) => {
        if (!cleanupImage) {
            setActionError("Please upload a cleanup verification photo.");
            return;
        }
        setActionLoading(true);
        setActionError(null);

        const formData = new FormData();
        formData.append("cleanup_image", cleanupImage);

        try {
            const res = await fetch(`${API_URL}/report/${reportId}/resolve`, {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            
            if (res.ok) {
                // Status could be 'resolved' or 'failed_cleanup' depending on AI
                setReports(reports.map(r => r.id === reportId ? { ...r, status: data.status, cleanup_image_url: data.report.cleanup_image_url } : r));
                setSelectedReport({ ...selectedReport, status: data.status, cleanup_image_url: data.report.cleanup_image_url });
                setCleanupImage(null);
                setCleanupPreview(null);
                if (data.status === 'failed_cleanup') {
                    setActionError("AI detected waste is still present. Please clean thoroughly and try again.");
                } else {
                    setSelectedReport(null); // Close modal on success
                }
            } else {
                setActionError(data.detail || "Failed to resolve.");
            }
        } catch (err) {
            setActionError("Network error.");
        } finally {
            setActionLoading(false);
        }
    };

    if (loading || !user) {
        return <div className="min-h-screen bg-[#0a0f0a] flex items-center justify-center text-white font-bold">Loading Portal...</div>;
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
        <div className="min-h-screen bg-[#0a0f0a] pt-24 pb-12 px-4 md:px-8">
            <div className="max-w-[1600px] mx-auto h-[calc(100vh-8rem)] flex flex-col">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 shrink-0">
                    <div>
                        <h1 className="text-3xl font-black text-white mb-1">Barangay Dashboard</h1>
                        <p className="text-emerald-400 font-bold uppercase tracking-widest">{user.barangay_assignment}</p>
                    </div>
                </div>

                {/* Main Content Split: 60/40 */}
                <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
                    
                    {/* Left: Report Queue (60%) */}
                    <div className="flex-[3] flex flex-col gap-4 min-h-0">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-3 gap-4 shrink-0">
                            <div className="glass p-4 rounded-2xl border border-white/5">
                                <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1">Pending</div>
                                <div className="text-3xl font-black text-red-400">{stats.pending}</div>
                            </div>
                            <div className="glass p-4 rounded-2xl border border-white/5">
                                <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1">Deployed</div>
                                <div className="text-3xl font-black text-yellow-400">{stats.deployed}</div>
                            </div>
                            <div className="glass p-4 rounded-2xl border border-white/5">
                                <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1">Resolved</div>
                                <div className="text-3xl font-black text-green-400">{stats.resolved}</div>
                            </div>
                        </div>

                        <div className="glass rounded-3xl border border-white/10 flex flex-col flex-1 min-h-0 shadow-2xl">
                            {/* Tabs */}
                            <div className="flex border-b border-white/10 shrink-0">
                                <button 
                                    onClick={() => setFilter('pending')}
                                    className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-colors ${filter === 'pending' ? 'bg-primary/20 text-primary border-b-2 border-primary' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
                                >
                                    Pending
                                </button>
                                <button 
                                    onClick={() => setFilter('deployed')}
                                    className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-colors ${filter === 'deployed' ? 'bg-primary/20 text-primary border-b-2 border-primary' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
                                >
                                    Deployed
                                </button>
                                <button 
                                    onClick={() => setFilter('resolved')}
                                    className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-colors ${filter === 'resolved' ? 'bg-primary/20 text-primary border-b-2 border-primary' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
                                >
                                    Done
                                </button>
                            </div>

                            {/* Table Container */}
                            <div className="flex-1 overflow-y-auto">
                        {displayReports.length === 0 ? (
                            <div className="p-12 text-center text-white/50 font-bold">No reports found in this category.</div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/5 text-xs text-white/40 uppercase tracking-widest bg-black/20">
                                        <th className="p-4">Tracking ID</th>
                                        <th className="p-4">Date</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4">AI Score</th>
                                        <th className="p-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayReports.map(report => (
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
                                            <td className="p-4 text-sm font-bold text-white/80">
                                                {report.ai_confidence ? `${(report.ai_confidence * 100).toFixed(0)}%` : 'N/A'}
                                            </td>
                                            <td className="p-4 text-right">
                                                <button 
                                                    onClick={() => {
                                                        setSelectedReport(report);
                                                        setActionError(null);
                                                        setCleanupPreview(null);
                                                        setCleanupImage(null);
                                                    }}
                                                    className="px-4 py-2 glass border border-white/10 text-white text-xs font-bold rounded-lg hover:bg-white/10 transition-colors"
                                                >
                                                    Manage
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Map View (40%) */}
                    <div className="flex-[2] glass rounded-3xl border border-white/10 overflow-hidden shadow-2xl relative min-h-[400px]">
                        <div className="absolute top-4 left-4 z-[1000] glass px-3 py-1.5 rounded-full text-xs font-bold text-white border border-white/20 shadow-lg pointer-events-none">
                            Assigned Locations
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
                    <div className="glass p-0 max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 shadow-2xl relative animate-in zoom-in-95 duration-300">
                        
                        {/* Modal Header */}
                        <div className="sticky top-0 z-10 glass border-b border-white/10 px-6 py-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-black text-white">Report {selectedReport.tracking_id}</h2>
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
                                    <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 border-b border-white/10 pb-2">Take Action</h3>
                                    
                                    {actionError && (
                                        <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-xs font-bold text-red-300">
                                            {actionError}
                                        </div>
                                    )}

                                    {selectedReport.status === 'verified' && (
                                        <div>
                                            <p className="text-xs text-white/60 mb-4">This report has been verified by the AI. Dispatch a cleanup team to the location.</p>
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
