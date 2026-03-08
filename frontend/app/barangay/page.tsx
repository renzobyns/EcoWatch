"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const SJDMMap = dynamic(() => import("@/components/MapComponent"), {
    ssr: false,
    loading: () => <div className="h-[500px] w-full glass animate-pulse flex items-center justify-center">Loading Jurisdictional Map...</div>
});

export default function BarangayPortal() {
    const [activeTab, setActiveTab] = useState<"pending" | "resolved">("pending");

    return (
        <div className="p-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest border border-primary/20">Jurisdiction</span>
                    </div>
                    <h1 className="text-4xl font-extrabold text-gradient">Barangay Muzon Portal</h1>
                    <p className="text-foreground/60 font-medium">Managing Local Environmental Reports & Cleanup</p>
                </div>

                <div className="flex gap-4">
                    <div className="glass px-6 py-3 rounded-2xl border-primary/20 bg-primary/5 text-center">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-primary">Pending Action</p>
                        <p className="text-2xl font-black">12</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex gap-4 border-b border-white/10 pb-4">
                        <button
                            onClick={() => setActiveTab("pending")}
                            className={`pb-2 px-4 transition-all ${activeTab === "pending" ? "border-b-2 border-primary text-primary font-bold" : "text-white/40"}`}
                        >
                            Pending Verification
                        </button>
                        <button
                            onClick={() => setActiveTab("resolved")}
                            className={`pb-2 px-4 transition-all ${activeTab === "resolved" ? "border-b-2 border-primary text-primary font-bold" : "text-white/40"}`}
                        >
                            Resolved Cases
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="glass p-6 border-white/5 hover:border-primary/20 transition-all group flex items-center justify-between">
                            <div className="flex gap-4 items-center">
                                <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary/40"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg">Illegal Dumping near Muzon River</h4>
                                    <p className="text-xs text-white/40 italic">Reported 2 hours ago by Citizen #82</p>
                                </div>
                            </div>
                            <button className="px-6 py-2 rounded-lg eco-gradient text-white text-sm font-bold shadow-lg shadow-primary/20">Verify & Resolve</button>
                        </div>

                        <div className="glass p-6 border-white/5 hover:border-primary/20 transition-all group flex items-center justify-between">
                            <div className="flex gap-4 items-center">
                                <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary/40"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg">Waste accumulation - Block 4</h4>
                                    <p className="text-xs text-white/40 italic">Reported 5 hours ago by Citizen #45</p>
                                </div>
                            </div>
                            <button className="px-6 py-2 rounded-lg eco-gradient text-white text-sm font-bold shadow-lg shadow-primary/20">Verify & Resolve</button>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <SJDMMap height="400px" />
                    <div className="glass p-6 space-y-4">
                        <h3 className="text-lg font-bold">Barangay Taskforce</h3>
                        <p className="text-xs text-foreground/60 leading-relaxed">
                            Use the "Verify & Resolve" button to upload a post-cleanup photo. Our AI will automatically verify if the site is clean before closing the report.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
