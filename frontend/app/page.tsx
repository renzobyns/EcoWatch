"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import QRCodeModal from "@/components/QRCodeModal";
import { formatRelative } from "@/lib/date-utils";
import SJDMLoader from "@/components/SJDMLoader";

// Dynamically import MapComponent to prevent SSR issues with Leaflet
const MapComponent = dynamic(() => import("@/components/MapComponent"), { 
    ssr: false,
    loading: () => null
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function LandingPage() {
    const [reports, setReports] = useState<any[]>([]);
    const [heatmaps, setHeatmaps] = useState<any[]>([]);
    const [focusedBarangay, setFocusedBarangay] = useState<string | null>(null);
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isQRModalOpen, setQRModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isMapReady, setIsMapReady] = useState(false);
    const [user, setUser] = useState<{ id: number; role: string } | null>(null);
    const [feedMode, setFeedMode] = useState<"city" | "my">("city");

    useEffect(() => {
        try {
            const raw = localStorage.getItem("ecowatch_user");
            if (raw) setUser(JSON.parse(raw));
        } catch (e) {}

        // Fetch heatmaps once
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

    useEffect(() => {
        setIsLoading(true);
        const reportUrl = feedMode === "my" && user?.id 
            ? `${API_URL}/reports/recent?reporter_id=${user.id}` 
            : `${API_URL}/reports/recent`;

        fetch(reportUrl)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setReports(data);
            })
            .catch(err => console.error("Failed to load reports", err))
            .finally(() => setIsLoading(false));
    }, [feedMode, user?.id]);

    const filteredReports = focusedBarangay 
        ? reports.filter(r => r.barangay === focusedBarangay)
        : reports;

    return (
        <div className="relative w-full h-screen -mt-20 overflow-hidden bg-background">
            {/* Full Screen Map */}
            <div className="absolute inset-0 z-0">
                <MapComponent
                    height="100%"
                    reports={reports}
                    heatmaps={heatmaps}
                    focusedBarangay={focusedBarangay}
                    onBarangayClick={setFocusedBarangay}
                    onMapReady={() => setIsMapReady(true)}
                />
            </div>

            {/* Persistent Map Loader Overlay */}
            {(isLoading || !isMapReady) && (
                <div className="absolute inset-0 z-[2000] w-full h-full">
                    <SJDMLoader />
                </div>
            )}

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
                className={`absolute top-28 z-40 glass p-3 rounded-full text-foreground shadow-xl transition-all duration-500 ease-in-out cursor-pointer ${isSidebarOpen ? 'right-[24rem] md:right-[26rem]' : 'right-4'}`}
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
            <div className={`absolute top-22 bottom-4 right-0 md:right-4 h-[calc(100vh-6.5rem)] w-full md:w-96 z-30 transition-all duration-500 ease-in-out ${isSidebarOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}`}>
                <div className="h-full glass border border-border/50 rounded-2xl flex flex-col shadow-2xl">
                    <div className="px-5 py-4 border-b border-border flex flex-col gap-3 shrink-0">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 tracking-wider">
                                    <span className="relative flex h-2.5 w-2.5">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                    </span>
                                    LIVE FEED
                                </h2>
                                <p className="text-xs text-foreground/50 font-medium tracking-wide mt-0.5">
                                    {focusedBarangay ? `Showing reports in ${focusedBarangay}` : (feedMode === "my" ? 'Your reports' : 'City-wide active reports')}
                                </p>
                            </div>
                            <button onClick={() => setSidebarOpen(false)} aria-label="Close live feed" className="md:hidden text-foreground/50 hover:text-foreground cursor-pointer">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                        {user?.role === 'citizen' && (
                            <div className="flex bg-muted/50 p-1 rounded-lg">
                                <button 
                                    onClick={() => setFeedMode('city')}
                                    className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors cursor-pointer ${feedMode === 'city' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    City Feed
                                </button>
                                <button 
                                    onClick={() => setFeedMode('my')}
                                    className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors cursor-pointer ${feedMode === 'my' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    My Reports
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={`skeleton-${i}`} className="p-3.5 rounded-xl bg-foreground/5 border border-border animate-pulse">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-foreground/20"></div>
                                            <div className="h-3 w-16 bg-foreground/10 rounded"></div>
                                        </div>
                                        <div className="h-2 w-12 bg-foreground/10 rounded"></div>
                                    </div>
                                    <div className="h-4 w-3/4 bg-foreground/10 rounded mb-2"></div>
                                    <div className="h-3 w-full bg-foreground/5 rounded mb-1"></div>
                                    <div className="h-3 w-5/6 bg-foreground/5 rounded mb-3"></div>
                                    <div className="h-3 w-20 bg-foreground/10 rounded"></div>
                                </div>
                            ))
                        ) : filteredReports.length === 0 ? (
                            <div className="text-center py-10 opacity-50">
                                <p className="text-sm">No reports found.</p>
                            </div>
                        ) : (
                            filteredReports.map((report) => (
                                <Link href={report.tracking_url || "#"} key={report.id} className="block group">
                                    <div className="relative p-3.5 rounded-xl bg-foreground/5 border border-border hover:bg-foreground/10 hover:border-foreground/20 hover:shadow-lg hover:shadow-foreground/5 transition-all duration-300 overflow-hidden">
                                        
                                        {/* Subtle gradient background based on status (optional) */}
                                        <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 bg-gradient-to-br ${
                                            report.status === 'resolved' ? 'from-green-500 to-transparent' :
                                            report.status === 'assigned' ? 'from-yellow-500 to-transparent' :
                                            report.status === 'in_progress' ? 'from-blue-500 to-transparent' :
                                            report.status === 'verified' ? 'from-orange-500 to-transparent' :
                                            'from-red-500 to-transparent'
                                        }`} />

                                        <div className="relative flex gap-3 z-10">
                                            {/* Thumbnail Image (if available) */}
                                            {report.image_url ? (
                                                <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-foreground/10 relative shadow-inner">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={report.image_url.startsWith('http') ? report.image_url : `${API_URL}${report.image_url}`} alt="Report thumbnail" className="w-full h-full object-cover filter contrast-125 saturate-50 group-hover:saturate-100 transition-all duration-500" />
                                                    <div className="absolute inset-0 shadow-[inset_0_0_10px_rgba(0,0,0,0.2)] pointer-events-none" />
                                                </div>
                                            ) : (
                                                <div className="w-16 h-16 rounded-lg bg-foreground/5 border border-foreground/10 shrink-0 flex items-center justify-center text-foreground/30">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                                                </div>
                                            )}

                                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                                                <div className="flex items-start justify-between mb-1">
                                                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${
                                                        report.status === 'resolved' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
                                                        report.status === 'assigned' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' :
                                                        report.status === 'in_progress' ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' :
                                                        report.status === 'verified' ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' :
                                                        'bg-red-500/10 border-red-500/20 text-red-500'
                                                    }`}>
                                                        <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_5px_currentColor] ${
                                                            report.status === 'resolved' ? 'bg-green-500' :
                                                            report.status === 'assigned' ? 'bg-yellow-500' :
                                                            report.status === 'in_progress' ? 'bg-blue-500' :
                                                            report.status === 'verified' ? 'bg-orange-500' :
                                                            'bg-red-500'
                                                        }`} />
                                                        <span className="text-[9px] font-bold uppercase tracking-wider">{report.status}</span>
                                                    </div>
                                                    <span className="text-[10px] text-foreground/40 font-medium whitespace-nowrap ml-2">
                                                        {formatRelative(report.created_at)}
                                                    </span>
                                                </div>
                                                
                                                <div>
                                                    <h4 className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{report.barangay || "Unknown Location"}</h4>
                                                </div>
                                                
                                                <div className="flex items-center justify-between mt-1.5">
                                                    <div className="text-[9px] text-foreground/40 font-mono flex items-center gap-1">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                                                        {report.lat.toFixed(4)}, {report.lon.toFixed(4)}
                                                    </div>
                                                    <span className="text-[10px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-1">
                                                        View <span className="text-lg leading-none translate-y-[-1px]">→</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
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
