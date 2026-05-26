"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import QRCodeModal from "@/components/QRCodeModal";

// Dynamically import MapComponent to prevent SSR issues with Leaflet
const MapComponent = dynamic(() => import("@/components/MapComponent"), { 
    ssr: false,
    loading: () => (
        <div className="w-full h-screen bg-background flex items-center justify-center">
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
        <div className="relative w-full h-screen overflow-hidden bg-background">
            {/* Full Screen Map */}
            <div className="absolute inset-0 z-0">
                <MapComponent
                    height="100%"
                    reports={reports}
                    heatmaps={heatmaps}
                    focusedBarangay={focusedBarangay}
                    onBarangayClick={setFocusedBarangay}
                />
            </div>

            {/* Floating Action Buttons (Middle Left) */}
            <div className="absolute top-1/2 -translate-y-1/2 left-6 z-[1000] flex flex-col gap-3">
                {/* Refined Report Button */}
                <Link
                    href="/report"
                    className="glass px-3.5 py-2.5 rounded-xl flex items-center gap-2.5 text-foreground transition-all shadow-xl hover:bg-foreground/10 group border border-red-500/20"
                >
                    <div className="relative w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center transition-transform group-hover:scale-110">
                        {/* Soft Pulse Effect on Icon Only */}
                        <div className="absolute inset-0 rounded-lg bg-red-500/20 animate-pulse"></div>
                        <svg className="relative z-10 text-red-500" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    </div>
                    <div className="text-left hidden sm:block pr-1.5">
                        <div className="text-[10px] text-red-500 font-bold uppercase tracking-[0.18em]">Live</div>
                        <div className="text-sm font-semibold uppercase text-foreground/90">Report</div>
                    </div>
                </Link>

                <button
                    onClick={() => setQRModalOpen(true)}
                    className="eco-gradient px-3.5 py-2.5 rounded-xl flex items-center gap-2.5 text-white hover:opacity-90 transition-all shadow-2xl shadow-primary/20 group hover:scale-[1.02] active:scale-95"
                >
                    <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><rect x="7" y="7" width="3" height="3"/><rect x="14" y="7" width="3" height="3"/><rect x="7" y="14" width="3" height="3"/><rect x="14" y="14" width="3" height="3"/></svg>
                    </div>
                    <div className="text-left hidden sm:block">
                        <div className="text-[10px] text-white/70 font-bold uppercase tracking-[0.18em]">Share</div>
                        <div className="text-sm font-semibold">QR Code</div>
                    </div>
                </button>
            </div>


            {/* Toggle Sidebar Button (Desktop & Mobile) */}
            <button
                onClick={() => setSidebarOpen(!isSidebarOpen)}
                aria-label={isSidebarOpen ? "Close live feed" : "Open live feed"}
                className={`absolute top-24 z-40 glass p-3 rounded-full text-foreground shadow-xl transition-all duration-500 ease-in-out cursor-pointer ${isSidebarOpen ? 'right-[24rem] md:right-[25rem]' : 'right-4'}`}
            >
                <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    className={`transition-transform duration-500 ${isSidebarOpen ? 'rotate-180' : 'rotate-0'}`}
                >
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
            </button>

            {/* Collapsible Side Panel (Live Feed) */}
            <div className={`absolute top-16 right-0 h-[calc(100vh-4rem)] w-full md:w-96 z-30 transition-transform duration-500 ease-in-out ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="h-full glass border-l border-border flex flex-col shadow-2xl">
                    <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
                        <div>
                            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 tracking-wider">
                                <span className="relative flex h-2.5 w-2.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                </span>
                                LIVE FEED
                            </h2>
                            <p className="text-xs text-foreground/50 font-medium tracking-wide mt-0.5">
                                {focusedBarangay ? `Showing reports in ${focusedBarangay}` : 'City-wide active reports'}
                            </p>
                        </div>
                        <button onClick={() => setSidebarOpen(false)} aria-label="Close live feed" className="md:hidden text-foreground/50 hover:text-foreground cursor-pointer">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                        {filteredReports.length === 0 ? (
                            <div className="text-center py-10 opacity-50">
                                <p className="text-sm">No reports found.</p>
                            </div>
                        ) : (
                            filteredReports.map((report) => (
                                <div key={report.id} className="p-3.5 rounded-xl bg-foreground/5 border border-border hover:bg-foreground/10 transition-colors cursor-pointer group">
                                    <div className="flex items-start justify-between mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${
                                                report.status === 'resolved' ? 'bg-green-500' :
                                                report.status === 'assigned' ? 'bg-yellow-500' :
                                                report.status === 'in_progress' ? 'bg-blue-500' :
                                                report.status === 'verified' ? 'bg-orange-500' :
                                                'bg-red-500'
                                            }`} />
                                            <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider">{report.status}</span>
                                        </div>
                                        <span className="text-[10px] text-foreground/40 font-medium">
                                            {new Date(report.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                    </div>
                                    <h4 className="text-sm font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">{report.barangay}</h4>
                                    {report.notes && <p className="text-xs text-foreground/60 line-clamp-2 mb-2.5">{report.notes}</p>}
                                    <Link href={report.tracking_url || "#"} className="text-xs font-medium text-primary hover:text-primary-dark underline-offset-2 hover:underline">
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
