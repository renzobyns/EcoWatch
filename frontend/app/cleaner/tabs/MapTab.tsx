"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";

const MapComponent = dynamic(() => import("@/components/MapComponent"), { ssr: false });

interface MapTabProps {
    user: any;
    workOrders: any[];
    onOpenWO: (wo: any) => void;
}

export function MapTab({ user, workOrders, onOpenWO }: MapTabProps) {
    const openWOs = useMemo(
        () => workOrders.filter((w) => ["assigned", "in_progress", "needs_redo"].includes(w.status)),
        [workOrders],
    );

    return (
        <div className="space-y-4 animate-slide-up h-full flex flex-col">
            {/* Header */}
            <div className="flex items-end justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">
                        Map <span className="text-primary">View</span>
                    </h1>
                    <p className="text-xs text-foreground/50 mt-1">
                        {openWOs.length} open {openWOs.length === 1 ? "job" : "jobs"} for cleanup
                    </p>
                </div>
                <Legend />
            </div>

            {/* Map */}
            <div className="glass rounded-2xl border border-border shadow-2xl overflow-hidden flex-1 min-h-[500px] relative">
                {openWOs.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-center p-6 z-10 pointer-events-none">
                        <div className="glass px-5 py-4 rounded-xl border border-border bg-background/80">
                            <p className="text-sm font-bold text-foreground/70">No open jobs to map.</p>
                            <p className="text-xs text-foreground/50 mt-1">Map shows only your active assignments.</p>
                        </div>
                    </div>
                ) : null}
                <MapComponent
                    height="100%"
                    workOrders={openWOs}
                    pinColorBy="priority"
                    focusedBarangay={user?.barangay_assignment ?? null}
                    onPinClick={onOpenWO}
                />
            </div>
        </div>
    );
}

function Legend() {
    return (
        <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest">
            <LegendItem color="#ef4444" label="High" />
            <LegendItem color="#eab308" label="Med" />
            <LegendItem color="#3b82f6" label="Low" />
        </div>
    );
}

function LegendItem({ color, label }: { color: string; label: string }) {
    return (
        <div className="flex items-center gap-1.5 text-foreground/60">
            <span className="inline-block w-3 h-3 rounded-full border border-white/40" style={{ background: color }} />
            <span>{label}</span>
        </div>
    );
}
