"use client";

import dynamic from "next/dynamic";

const SJDMMap = dynamic(() => import("@/components/MapComponent"), {
    ssr: false,
    loading: () => <div className="h-[600px] w-full glass animate-pulse flex items-center justify-center">Loading City-Wide Map Engine...</div>
});

export default function DashboardPage() {
    return (
        <div className="p-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-4xl font-extrabold text-gradient">CENRO Command Center</h1>
                    <p className="text-foreground/60 font-medium">Real-time Environmental Monitoring - San Jose del Monte</p>
                </div>

                <div className="flex gap-4">
                    <div className="glass px-6 py-3 rounded-2xl border-primary/20 bg-primary/5">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-primary">Total Reports</p>
                        <p className="text-2xl font-black">128</p>
                    </div>
                    <div className="glass px-6 py-3 rounded-2xl border-yellow-500/20 bg-yellow-500/5">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-yellow-500">Unresolved</p>
                        <p className="text-2xl font-black">42</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-3">
                    <SJDMMap height="600px" />
                </div>

                <div className="space-y-6">
                    <div className="glass p-6 space-y-4">
                        <h3 className="text-lg font-bold">Barangay Status</h3>
                        <div className="space-y-3">
                            {[
                                { name: "Muzon", count: 12, color: "bg-red-500" },
                                { name: "Gaya-gaya", count: 8, color: "bg-orange-500" },
                                { name: "Dulong Bayan", count: 5, color: "bg-yellow-500" },
                                { name: "Sapang Palay", count: 3, color: "bg-green-500" },
                            ].map((brgy) => (
                                <div key={brgy.name} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${brgy.color}`} />
                                        <span className="font-medium">{brgy.name}</span>
                                    </div>
                                    <span className="font-bold text-foreground/60">{brgy.count}</span>
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
                            DBSCAN analysis indicates a <span className="text-primary font-bold">15% increase</span> in illegal dumping activity near Muzon waterways this week.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
