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
        <div className="animate-slide-up h-full w-full flex flex-col relative overflow-hidden">
            {/* Edge-to-Edge Map Wrapper */}
            <div className="w-full h-full flex-1 relative z-0">
                {/* Floating Header */}
                <div className="absolute top-4 left-4 z-[1000] pointer-events-auto bg-background/90 dark:bg-background/95 backdrop-blur-md border border-border rounded-xl p-3 shadow-lg max-w-[200px]">
                    <h1 className="text-base font-bold text-foreground tracking-tight leading-none">
                        Map <span className="text-primary">View</span>
                    </h1>
                    <p className="text-[10px] text-muted-foreground mt-1.5 font-medium">
                        {openWOs.length} open {openWOs.length === 1 ? "job" : "jobs"}
                    </p>
                </div>

                {/* Floating Legend */}
                <div className="absolute top-4 right-4 z-[1000] pointer-events-auto bg-background/90 dark:bg-background/95 backdrop-blur-md border border-border rounded-xl px-3 py-2 shadow-lg">
                    <Legend />
                </div>

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
