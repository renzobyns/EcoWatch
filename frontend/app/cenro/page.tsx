"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";

const SJDMMap = dynamic(() => import("@/components/MapComponent"), {
    ssr: false,
    loading: () => <div className="h-[600px] w-full glass animate-pulse flex items-center justify-center">Loading City-Wide Map Engine...</div>
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function DashboardPage() {
    const [data, setData] = useState({ total_active_reports: 0, hotspots: [] as any[] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        const fetchData = async () => {
            try {
                const res = await fetch(`${API_URL}/spatial/heatmaps`, {
                    signal: controller.signal,
                });
                if (!res.ok) throw new Error(`Server error: ${res.status}`);
                const resData = await res.json();
                if (resData) setData(resData);
            } catch (err: any) {
                if (err.name !== "AbortError") {
                    console.error("Dashboard fetch error:", err);
                    setError("Could not connect to the backend server. Make sure it is running.");
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        return () => controller.abort();
    }, []);

    return (
        <div className="p-4 md:p-8 space-y-6 md:space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-gradient">CENRO Command Center</h1>
                    <p className="text-foreground/60 font-medium">Real-time Environmental Monitoring - San Jose del Monte</p>
                </div>

                <div className="flex sm:flex-row gap-4 w-full md:w-auto">
                    <div className="glass px-4 md:px-6 py-3 flex-1 md:flex-none rounded-2xl border-primary/20 bg-primary/5">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-primary">Active Reports</p>
                        <p className="text-2xl font-black">
                            {loading ? <span className="animate-pulse">--</span> : data.total_active_reports}
                        </p>
                    </div>
                    <div className="glass px-4 md:px-6 py-3 flex-1 md:flex-none rounded-2xl border-yellow-500/20 bg-yellow-500/5">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-yellow-500">Live Hotspots</p>
                        <p className="text-2xl font-black">
                            {loading ? <span className="animate-pulse">--</span> : data.hotspots.length}
                        </p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="glass p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-medium flex items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-3">
                    <SJDMMap height="600px" />
                </div>

                <div className="space-y-6">
                    <div className="glass p-6 space-y-4">
                        <h3 className="text-lg font-bold">Detected Hotspots (DBSCAN)</h3>
                        <div className="space-y-3">
                            {loading && <p className="text-xs animate-pulse">Analyzing map data...</p>}
                            {!loading && data.hotspots.length === 0 && <p className="text-xs text-foreground/50">No major hotspots detected currently.</p>}
                            {data.hotspots.map((hotspot, idx) => (
                                <div key={idx} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                        <span className="font-medium">Zone #{hotspot.cluster_id + 1}</span>
                                    </div>
                                    <span className="font-bold text-foreground/60">{hotspot.intensity} reports</span>
                                </div>
                            ))}
                        </div>
                        <button className="w-full py-2 text-xs font-bold uppercase tracking-widest text-primary hover:bg-primary/10 transition-colors rounded-lg border border-primary/20 mt-4">
                            View Detailed Heatmap
                        </button>
                    </div>

                    <div className="glass p-6 bg-primary/5 border-primary/20">
                        <h3 className="text-lg font-bold text-primary">AI Insights</h3>
                        <p className="text-xs text-foreground/60 mt-2 leading-relaxed">
                            {data.hotspots.length > 0 ? (
                                <>DBSCAN analysis indicates <span className="text-primary font-bold">{data.hotspots.length} high-density</span> dumping zones requiring immediate CENRO intervention.</>
                            ) : (
                                "No significant spatial clustering detected yet. System is monitoring."
                            )}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
