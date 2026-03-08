"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const SJDMMap = dynamic(() => import("@/components/MapComponent"), {
    ssr: false,
    loading: () => <div className="h-[400px] w-full glass animate-pulse flex items-center justify-center">Loading Map Engine...</div>
});

export default function ReportPage() {
    const [location, setLocation] = useState<{ lat: number, lon: number } | null>(null);
    const [barangay, setBarangay] = useState<string | null>(null);
    const [gpsLoading, setGpsLoading] = useState(false);

    const validateLocation = async (lat: number, lon: number) => {
        setLocation({ lat, lon });
        try {
            const res = await fetch("http://127.0.0.1:8000/report/validate-location", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lat, lon })
            });
            const data = await res.json();
            if (data.barangay) setBarangay(data.barangay);
        } catch (err) {
            console.error(err);
        }
    };

    const handleLocationSelect = (lat: number, lon: number) => validateLocation(lat, lon);

    const handleGPS = () => {
        if (!navigator.geolocation) return;
        setGpsLoading(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => { validateLocation(pos.coords.latitude, pos.coords.longitude); setGpsLoading(false); },
            () => setGpsLoading(false),
            { enableHighAccuracy: true }
        );
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-12">
            <div className="text-center space-y-2">
                <h1 className="text-4xl font-extrabold text-gradient">Report an Issue</h1>
                <p className="text-foreground/60">Select the illegal dumping location on the map below.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-3">
                    <button
                        onClick={handleGPS}
                        disabled={gpsLoading}
                        className="w-full flex items-center justify-center gap-2 py-3 glass border border-primary/30 text-primary rounded-xl text-sm font-bold hover:bg-primary/10 active:scale-95 transition-all disabled:opacity-50"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="10" /></svg>
                        {gpsLoading ? "Detecting your location..." : "📡  Use My Current Location (GPS)"}
                    </button>
                    <SJDMMap height="500px" onLocationSelect={handleLocationSelect} />
                </div>

                <div className="space-y-6">
                    <div className="glass p-6 space-y-6 border-primary/10">
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                <label className="text-xs font-bold uppercase tracking-wider text-primary/80">Selected Location</label>
                                {location ? (
                                    <div className="mt-2 text-sm font-medium">
                                        <p className="text-foreground">{barangay || "Verifying Barangay..."}</p>
                                        <p className="text-foreground/40 text-xs mt-1">{location.lat.toFixed(4)}, {location.lon.toFixed(4)}</p>
                                    </div>
                                ) : (
                                    <p className="mt-2 text-sm text-foreground/30 italic">Click the map to set location</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Evidence Photo</label>
                                <div className="w-full h-32 bg-white/5 rounded-xl border-2 border-dashed border-primary/20 flex flex-col items-center justify-center text-foreground/40 hover:bg-white/10 transition-colors cursor-pointer group">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1 group-hover:text-primary transition-colors"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                                    <p className="text-xs">Upload or Snap</p>
                                </div>
                            </div>
                        </div>

                        <button
                            disabled={!location}
                            type="button"
                            className="w-full py-4 eco-gradient text-white rounded-xl text-lg font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Submit Report
                        </button>
                    </div>

                    <div className="p-4 glass border-yellow-500/20 bg-yellow-500/5 rounded-xl">
                        <p className="text-[10px] leading-tight text-white/60">
                            <span className="font-bold text-yellow-500">NOTE:</span> All reports are verified using Mask R-CNN AI. False reports may lead to penalties.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
