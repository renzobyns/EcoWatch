"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import QRCodeModal from "@/components/QRCodeModal";

// Dynamically import MapComponent to prevent SSR issues with Leaflet
const MapComponent = dynamic(() => import("@/components/MapComponent"), { 
    ssr: false,
    loading: () => (
        <div className="w-full h-screen bg-[#0a0f0a] flex items-center justify-center">
            <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        </div>
    )
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function LandingPage() {
    const [reports, setReports] = useState<any[]>([]);
    const [heatmaps, setHeatmaps] = useState<any[]>([]);
    const [focusedBarangay, setFocusedBarangay] = useState<string | null>(null);
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isQRModalOpen, setQRModalOpen] = useState(false);

    useEffect(() => {
        // Fetch reports
        fetch(`${API_URL}/reports/recent`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setReports(data);
            })
            .catch(err => console.error("Failed to load reports", err));

        // Fetch heatmaps
        fetch(`${API_URL}/spatial/heatmaps`)
            .then(res => res.json())
            .then(data => {
                if (data && Array.isArray(data.hotspots)) setHeatmaps(data.hotspots);
            })
            .catch(err => console.error("Failed to load heatmaps", err));
            
        // Open sidebar slightly delayed for effect
        const timer = setTimeout(() => setSidebarOpen(true), 1000);
        return () => clearTimeout(timer);
    }, []);

    const filteredReports = focusedBarangay 
        ? reports.filter(r => r.barangay === focusedBarangay)
        : reports;

    return (
        <div className="relative w-full h-screen overflow-hidden bg-[#0a0f0a]">
            {/* Full Screen Map */}
            <div className="absolute inset-0 z-0 pt-16">
                <MapComponent 
                    height="100%" 
                    reports={reports} 
                    heatmaps={heatmaps}
                    focusedBarangay={focusedBarangay}
                    onBarangayClick={setFocusedBarangay}
                />
            </div>

            {/* Floating Action Buttons (Bottom Left) */}
            <div className="absolute bottom-6 left-6 z-40 flex flex-col gap-3">
                <button 
                    onClick={() => setQRModalOpen(true)}
                    className="glass px-4 py-3 rounded-2xl flex items-center gap-3 text-white hover:bg-white/10 transition-all border border-white/10 shadow-xl shadow-black/50 group"
                >
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><rect x="7" y="7" width="3" height="3"/><rect x="14" y="7" width="3" height="3"/><rect x="7" y="14" width="3" height="3"/><rect x="14" y="14" width="3" height="3"/></svg>
                    </div>
                    <div className="text-left hidden sm:block">
                        <div className="text-xs text-foreground/50 font-bold uppercase tracking-widest">Share</div>
                        <div className="text-sm font-bold">QR Code</div>
                    </div>
                </button>
            </div>

            {/* Toggle Sidebar Button (Mobile) */}
            <button 
                onClick={() => setSidebarOpen(!isSidebarOpen)}
                className="md:hidden absolute top-24 right-4 z-40 glass p-3 rounded-full text-white shadow-xl"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </button>

            {/* Collapsible Side Panel (Live Feed) */}
            <div className={`absolute top-16 right-0 h-[calc(100vh-4rem)] w-full md:w-96 z-30 transition-transform duration-500 ease-in-out ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="h-full glass border-l border-white/10 flex flex-col shadow-2xl">
                    <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                        <div>
                            <h2 className="text-lg font-black text-white flex items-center gap-2">
                                <span className="relative flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                                LIVE FEED
                            </h2>
                            <p className="text-xs text-foreground/50 font-medium tracking-wide">
                                {focusedBarangay ? `Showing reports in ${focusedBarangay}` : 'City-wide active reports'}
                            </p>
                        </div>
                        <button onClick={() => setSidebarOpen(false)} className="md:hidden text-foreground/50 hover:text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {filteredReports.length === 0 ? (
                            <div className="text-center py-10 opacity-50">
                                <p className="text-sm">No reports found.</p>
                            </div>
                        ) : (
                            filteredReports.map((report) => (
                                <div key={report.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer group">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${
                                                report.status === 'resolved' ? 'bg-green-500' : 
                                                report.status === 'deployed' ? 'bg-yellow-500' : 'bg-red-500'
                                            }`} />
                                            <span className="text-xs font-bold text-white uppercase tracking-wider">{report.status}</span>
                                        </div>
                                        <span className="text-[10px] text-foreground/40 font-medium">
                                            {new Date(report.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                    </div>
                                    <h4 className="text-sm font-bold text-white mb-1 group-hover:text-primary transition-colors">{report.barangay}</h4>
                                    {report.notes && <p className="text-xs text-foreground/60 line-clamp-2 mb-3">{report.notes}</p>}
                                    <Link href={report.tracking_url || "#"} className="text-xs font-bold text-primary hover:text-primary-dark underline-offset-2 hover:underline">
                                        View Details →
                                    </Link>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* QR Code Modal */}
            {isQRModalOpen && <QRCodeModal onClose={() => setQRModalOpen(false)} />}
        </div>
    );
}
