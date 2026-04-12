"use client";

import dynamic from "next/dynamic";
import { useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import exifr from "exifr";

const SJDMMap = dynamic(() => import("@/components/MapComponent"), {
    ssr: false,
    loading: () => <div className="h-[400px] w-full glass animate-pulse flex items-center justify-center">Loading Map Engine...</div>
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type LocationSource = "exif" | "gps" | "manual" | null;

export default function ReportPage() {
    const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
    const [barangay, setBarangay] = useState<string | null>(null);
    const [locationSource, setLocationSource] = useState<LocationSource>(null);
    const [gpsLoading, setGpsLoading] = useState(false);

    // Photo states
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [exifFailed, setExifFailed] = useState(false);

    // Form states
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);

    // QR modal
    const [showQR, setShowQR] = useState(false);
    const qrRef = useRef<HTMLDivElement>(null);

    // ------ Core: Validate a location against the backend ------
    const validateLocation = async (lat: number, lon: number, source: LocationSource) => {
        setLocation({ lat, lon });
        setLocationSource(source);
        setBarangay(null);
        try {
            const res = await fetch(`${API_URL}/report/validate-location`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lat, lon }),
            });
            const data = await res.json();
            if (data.barangay) setBarangay(data.barangay);
        } catch (err) {
            console.error("Location validation error:", err);
        }
    };

    // ------ Photo upload + EXIF GPS extraction ------
    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;
        const file = e.target.files[0];
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
        setExifFailed(false);

        try {
            // Extract GPS from EXIF metadata
            const exifData = await exifr.gps(file);
            if (exifData && exifData.latitude && exifData.longitude) {
                // GPS found in photo — auto-fill location
                validateLocation(exifData.latitude, exifData.longitude, "exif");
            } else {
                // No GPS in photo
                setExifFailed(true);
            }
        } catch (err) {
            console.error("EXIF extraction error:", err);
            setExifFailed(true);
        }
    };

    // ------ W3C Geolocation API ------
    const handleGPS = () => {
        if (!navigator.geolocation) return;
        setGpsLoading(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                validateLocation(pos.coords.latitude, pos.coords.longitude, "gps");
                setGpsLoading(false);
            },
            () => setGpsLoading(false),
            { enableHighAccuracy: true }
        );
    };

    // ------ Manual map pin ------
    const handleLocationSelect = (lat: number, lon: number) => {
        validateLocation(lat, lon, "manual");
        setExifFailed(false);
    };

    // ------ Submit ------
    const handleSubmit = async () => {
        if (!location || !imageFile) return;
        setIsSubmitting(true);
        setSubmitResult(null);

        const formData = new FormData();
        formData.append("lat", location.lat.toString());
        formData.append("lon", location.lon.toString());
        formData.append("image", imageFile);
        if (notes) formData.append("notes", notes);

        try {
            const res = await fetch(`${API_URL}/report/submit`, { method: "POST", body: formData });
            const data = await res.json();
            if (data.success) {
                setSubmitResult({ success: true, message: `Success! Assigned to ${data.barangay_assigned}.` });
                setLocation(null);
                setBarangay(null);
                setLocationSource(null);
                setImageFile(null);
                setImagePreview(null);
                setNotes("");
                setExifFailed(false);
            } else {
                setSubmitResult({ success: false, message: data.message || "AI Verification failed." });
            }
        } catch (err) {
            console.error(err);
            setSubmitResult({ success: false, message: "Network error connecting to AI Server." });
        } finally {
            setIsSubmitting(false);
        }
    };

    // ------ QR download/print ------
    const getReportURL = () => {
        const origin = typeof window !== "undefined" ? window.location.origin : "https://ecowatch-sjdm.vercel.app";
        return `${origin}/report`;
    };

    const handleDownloadQR = () => {
        if (!qrRef.current) return;
        const svgElement = qrRef.current.querySelector("svg");
        if (!svgElement) return;
        const canvas = document.createElement("canvas");
        canvas.width = 600;
        canvas.height = 600;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const img = new Image();
        img.onload = () => {
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, 600, 600);
            ctx.drawImage(img, 50, 50, 500, 500);
            const link = document.createElement("a");
            link.download = "ecowatch-report-qr.png";
            link.href = canvas.toDataURL("image/png");
            link.click();
        };
        img.src = "data:image/svg+xml;base64," + btoa(svgData);
    };

    const handlePrintQR = () => {
        if (!qrRef.current) return;
        const svgElement = qrRef.current.querySelector("svg");
        if (!svgElement) return;
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgData], { type: "image/svg+xml" });
        const svgUrl = URL.createObjectURL(svgBlob);
        const printWindow = window.open("", "_blank");
        if (!printWindow) return;
        printWindow.document.write(`<!DOCTYPE html><html><head><title>EcoWatch QR</title>
            <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;background:white}
            .card{text-align:center;padding:40px;border:3px solid #10b981;border-radius:20px;max-width:400px}
            .qr{margin:24px 0}.title{font-size:24px;font-weight:800;color:#065f46}
            .subtitle{font-size:11px;color:#6b7280;margin-top:4px;text-transform:uppercase;letter-spacing:2px;font-weight:700}
            .instruction{font-size:12px;color:#4b5563;margin-top:16px;padding:12px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0}
            @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head>
            <body><div class="card"><div class="title">🌿 EcoWatch SJDM</div>
            <div class="subtitle">Scan to Report Illegal Dumping</div>
            <div class="qr"><img src="${svgUrl}" width="250" height="250"/></div>
            <div class="instruction">📱 Scan this QR code with your phone camera to report waterway pollution in San Jose del Monte.</div>
            </div></body></html>`);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
    };

    const sourceLabel = {
        exif: "Detected from Photo GPS",
        gps: "W3C Geolocation API",
        manual: "Manually Pinned",
    };

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 md:space-y-8">
            {/* Header */}
            <div className="text-center space-y-2">
                <h1 className="text-3xl md:text-4xl font-extrabold text-gradient">Report an Issue</h1>
                <p className="text-foreground/60">Upload a photo of the violation. We'll auto-detect the location from it.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Photo + Map */}
                <div className="lg:col-span-2 space-y-4">

                    {/* Step 1: Photo Upload (Primary Action) */}
                    <div className="glass p-6 rounded-xl space-y-4 border border-primary/10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-7 h-7 rounded-lg eco-gradient flex items-center justify-center text-white text-xs font-bold shadow shadow-primary/20">1</span>
                                <h3 className="text-sm font-bold">Upload Evidence Photo</h3>
                            </div>
                            {imageFile && location && locationSource === "exif" && (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 animate-in fade-in duration-300">
                                    📍 GPS Auto-Detected
                                </span>
                            )}
                        </div>

                        <label className="w-full h-44 bg-white/5 rounded-xl border-2 border-dashed border-primary/20 flex flex-col items-center justify-center text-foreground/40 hover:bg-white/10 hover:border-primary/40 transition-all cursor-pointer group relative overflow-hidden">
                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageChange} />
                            {imagePreview ? (
                                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2 group-hover:text-primary transition-colors"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                                    <p className="text-sm font-semibold group-hover:text-primary transition-colors">Tap to take a photo or upload</p>
                                    <p className="text-[10px] text-foreground/30 mt-1">GPS location will be read from the image automatically</p>
                                </>
                            )}
                        </label>

                        {/* EXIF Failed Warning — prompt for manual pin */}
                        {exifFailed && !location && (
                            <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                <div>
                                    <p className="font-bold">Couldn't detect location from photo</p>
                                    <p className="text-xs text-yellow-400/70 mt-0.5">Your photo doesn't have GPS data. Please pin the location on the map below or use the GPS button.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Step 2: Location (auto-filled or manual) */}
                    <div className="glass p-6 rounded-xl space-y-4 border border-white/5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shadow shadow-primary/20 ${location ? "eco-gradient text-white" : "bg-white/10 text-foreground/40"}`}>2</span>
                                <h3 className="text-sm font-bold">{location ? "Location Confirmed" : "Confirm Location"}</h3>
                            </div>
                            {location && locationSource && (
                                <span className="text-[10px] text-foreground/30 font-medium">
                                    {sourceLabel[locationSource]}
                                </span>
                            )}
                        </div>

                        {/* GPS Button */}
                        <button
                            onClick={handleGPS}
                            disabled={gpsLoading}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/10 text-primary rounded-xl text-sm font-bold hover:bg-primary/10 active:scale-95 transition-all disabled:opacity-50"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="10" /></svg>
                            {gpsLoading ? "Detecting your location..." : "📡  Use My Current GPS Location"}
                        </button>

                        <div className="flex items-center gap-3 text-[10px] text-foreground/20 uppercase font-bold tracking-widest">
                            <div className="flex-1 h-px bg-white/5" />
                            or pin on map
                            <div className="flex-1 h-px bg-white/5" />
                        </div>

                        {/* Map */}
                        <SJDMMap height="400px" onLocationSelect={handleLocationSelect} />
                    </div>
                </div>

                {/* Right: Location info + form controls */}
                <div className="space-y-6">
                    {/* Location Card */}
                    <div className="glass p-6 space-y-6 border-primary/10">
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <label className="text-xs font-bold uppercase tracking-wider text-primary/80">Detected Location</label>
                            {location ? (
                                <div className="mt-2 text-sm font-medium">
                                    <p className="text-foreground text-lg font-bold">{barangay || "Verifying Barangay..."}</p>
                                    <p className="text-foreground/40 text-xs mt-1">{location.lat.toFixed(6)}, {location.lon.toFixed(6)}</p>
                                    {locationSource && (
                                        <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border ${
                                            locationSource === "exif"
                                                ? "bg-primary/10 text-primary border-primary/20"
                                                : locationSource === "gps"
                                                ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                                : "bg-white/10 text-foreground/50 border-white/10"
                                        }`}>
                                            {locationSource === "exif" ? "📷 from photo" : locationSource === "gps" ? "📡 from gps" : "📌 pinned"}
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <p className="mt-2 text-sm text-foreground/30 italic">Upload a photo to auto-detect, or pin on the map</p>
                            )}
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Additional Notes (Optional)</label>
                            <textarea
                                className="w-full bg-white/5 rounded-xl border border-primary/20 p-3 text-sm focus:outline-none focus:border-primary/50 text-foreground"
                                rows={2}
                                placeholder="Describe the issue..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            ></textarea>
                        </div>

                        {/* Submit Result */}
                        {submitResult && (
                            <div className={`p-3 rounded-xl text-sm font-semibold ${submitResult.success ? "bg-primary/20 text-primary border border-primary/30" : "bg-red-500/20 text-red-500 border border-red-500/30"}`}>
                                {submitResult.message}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            disabled={!location || !imageFile || isSubmitting}
                            type="button"
                            onClick={handleSubmit}
                            className="w-full py-4 eco-gradient text-white rounded-xl text-lg font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                        >
                            {isSubmitting ? (
                                <><svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Analyzing Image...</>
                            ) : "Submit Report"}
                        </button>
                    </div>

                    {/* QR Share Card */}
                    <div className="glass p-5 rounded-xl border border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold">Share EcoWatch</h3>
                            <button
                                onClick={() => setShowQR(!showQR)}
                                className="text-[10px] text-primary font-bold uppercase tracking-widest hover:text-primary/80 transition-colors"
                            >
                                {showQR ? "Hide QR" : "Show QR"}
                            </button>
                        </div>
                        <p className="text-xs text-foreground/40">
                            Print this QR code and post it around your area. Anyone can scan it to quickly report illegal dumping.
                        </p>

                        {showQR && (
                            <div className="space-y-4 animate-in slide-in-from-top-2 fade-in duration-300">
                                <div ref={qrRef} className="bg-white p-4 rounded-xl flex items-center justify-center mx-auto" style={{ width: "fit-content" }}>
                                    <QRCodeSVG
                                        value={getReportURL()}
                                        size={180}
                                        bgColor="#ffffff"
                                        fgColor="#065f46"
                                        level="H"
                                        includeMargin={false}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={handleDownloadQR}
                                        className="py-2.5 rounded-xl border border-primary/20 text-primary text-xs font-bold hover:bg-primary/10 transition-colors active:scale-95 flex items-center justify-center gap-1.5"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                        Save PNG
                                    </button>
                                    <button
                                        onClick={handlePrintQR}
                                        className="py-2.5 eco-gradient text-white rounded-xl text-xs font-bold shadow shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                                        Print
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Info Note */}
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
