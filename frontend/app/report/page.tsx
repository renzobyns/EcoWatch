"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import exifr from "exifr";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { GeoPhoto } from "@/components/GeoTagCamera";

const GeoTagCamera = dynamic(() => import("@/components/GeoTagCamera"), { ssr: false });

const MiniMap = dynamic(() => import("@/components/MiniMap"), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-foreground/5 animate-pulse flex items-center justify-center"><p className="text-xs font-bold text-primary">Loading Map...</p></div>
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const MAX_PHOTOS = 5;
const MAX_BYTES = 10 * 1024 * 1024;

// Mirrors backend ai_verifier._KNOWN_EDITOR_KEYWORDS — uploads tagged by any of
// these (human editors OR AI generators) are rejected as tampered evidence.
const EDITOR_KEYWORDS = [
    "photoshop", "lightroom", "gimp", "picsart", "snapseed",
    "facetune", "meitu", "midjourney", "stable diffusion",
    "dall-e", "canva", "pixlr",
];

interface ReportPhoto {
    file: File;
    lat: number;
    lon: number;
    barangay: string | null;
    source: "camera" | "upload";
    previewUrl: string;
}

export default function ReportPage() {
    const router = useRouter();

    // Auth gate
    const [authChecked, setAuthChecked] = useState(false);
    const [reporterId, setReporterId] = useState<number | null>(null);

    // Flow: "source" (chooser) → "review"; camera overlay toggled separately.
    const [step, setStep] = useState<"source" | "review">("source");
    const [showCamera, setShowCamera] = useState(false);

    const [photos, setPhotos] = useState<ReportPhoto[]>([]);
    const [deviceLat, setDeviceLat] = useState<number | null>(null);
    const [deviceLon, setDeviceLon] = useState<number | null>(null);
    const [notes, setNotes] = useState("");

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [validating, setValidating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── Login gate ─────────────────────────────────────────────
    useEffect(() => {
        try {
            const stored = localStorage.getItem("ecowatch_user");
            if (!stored) {
                router.replace("/login?redirect=/report");
                return;
            }
            const parsed = JSON.parse(stored);
            if (!parsed?.id) {
                router.replace("/login?redirect=/report");
                return;
            }
            setReporterId(parsed.id);
            setAuthChecked(true);
        } catch {
            router.replace("/login?redirect=/report");
        }
    }, [router]);

    // Revoke object URLs on unmount.
    useEffect(() => {
        return () => { photos.forEach((p) => URL.revokeObjectURL(p.previewUrl)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const lat = photos[0]?.lat ?? null;
    const lon = photos[0]?.lon ?? null;
    const barangay = photos[0]?.barangay ?? null;

    // ── Camera path (A) ────────────────────────────────────────
    const handleCameraComplete = useCallback((captured: GeoPhoto[]) => {
        const mapped: ReportPhoto[] = captured.map((p) => ({
            file: p.file,
            lat: p.lat,
            lon: p.lon,
            barangay: p.barangay,
            source: "camera",
            previewUrl: URL.createObjectURL(p.file),
        }));
        setPhotos(mapped);
        // Device GPS (B) for camera path == the capture fix.
        if (captured[0]) {
            setDeviceLat(captured[0].lat);
            setDeviceLon(captured[0].lon);
        }
        setShowCamera(false);
        setStep("review");
        setError(null);
    }, []);

    // ── Upload path (B) ────────────────────────────────────────
    const captureDeviceGps = useCallback(() => {
        if (!("geolocation" in navigator)) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => { setDeviceLat(pos.coords.latitude); setDeviceLon(pos.coords.longitude); },
            () => { /* B is best-effort on the upload path */ },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
    }, []);

    const validateAndAddUpload = useCallback(async (file: File): Promise<string | null> => {
        // Type + size
        if (!["image/jpeg", "image/png"].includes(file.type)) {
            return "Only JPEG or PNG photos are allowed.";
        }
        if (file.size > MAX_BYTES) {
            return "Photo must be 10 MB or smaller.";
        }

        // Editor / AI software tag → reject
        try {
            const meta = await exifr.parse(file, ["Software", "Make", "Model"]);
            const software = String(meta?.Software ?? "").toLowerCase();
            if (software && EDITOR_KEYWORDS.some((k) => software.includes(k))) {
                return "This photo was edited or AI-generated (tagged \"" + meta.Software + "\"). Please use the in-app camera instead.";
            }
        } catch {
            // No readable metadata → treated as no-geotag below.
        }

        // Geotag (EXIF GPS) required
        let gps: { latitude?: number; longitude?: number } | undefined;
        try {
            gps = await exifr.gps(file);
        } catch {
            gps = undefined;
        }
        // Treat a present-but-empty geotag (NaN/0,0 — common after Google Drive/Photos
        // or "GPS stamp" apps) as no location data.
        if (!gps || gps.latitude == null || gps.longitude == null ||
            !Number.isFinite(gps.latitude) || !Number.isFinite(gps.longitude) ||
            (gps.latitude === 0 && gps.longitude === 0)) {
            return "This photo has no location data. Please use the in-app camera instead.";
        }

        // Inside SJDM?
        let brgy: string | null = null;
        try {
            const res = await fetch(`${API_URL}/report/validate-location`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lat: gps.latitude, lon: gps.longitude }),
            });
            if (!res.ok) {
                return "This photo was taken outside San Jose del Monte, so it can't be reported here.";
            }
            const data = await res.json();
            brgy = data.barangay ?? null;
        } catch {
            return "Could not verify the photo's location. Check your connection and try again.";
        }

        const photo: ReportPhoto = {
            file,
            lat: gps.latitude,
            lon: gps.longitude,
            barangay: brgy,
            source: "upload",
            previewUrl: URL.createObjectURL(file),
        };
        setPhotos((prev) => [...prev, photo]);
        return null;
    }, []);

    const handleUploadChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = "";
        if (files.length === 0) return;
        if (photos.length + files.length > MAX_PHOTOS) {
            setError(`Maximum ${MAX_PHOTOS} photos allowed.`);
            return;
        }

        setError(null);
        setValidating(true);
        captureDeviceGps();
        let firstError: string | null = null;
        let added = 0;
        for (const f of files) {
            const reason = await validateAndAddUpload(f);
            if (reason && !firstError) firstError = reason;
            if (!reason) added += 1;
        }
        setValidating(false);

        if (added > 0) {
            setStep("review");
            if (firstError) setError(`Some photos were skipped: ${firstError}`);
        } else if (firstError) {
            setError(firstError);
        }
    }, [photos.length, captureDeviceGps, validateAndAddUpload]);

    const removePhoto = (index: number) => {
        URL.revokeObjectURL(photos[index].previewUrl);
        const next = photos.filter((_, i) => i !== index);
        setPhotos(next);
        if (next.length === 0) setStep("source");
    };

    // ── Submit ─────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (lat == null || lon == null || photos.length === 0) {
            setError("Add at least one geo-tagged photo first.");
            return;
        }
        if (reporterId == null) {
            router.replace("/login?redirect=/report");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        const formData = new FormData();
        formData.append("lat", lat.toString());
        formData.append("lon", lon.toString());
        if (deviceLat != null && deviceLon != null) {
            formData.append("device_lat", deviceLat.toString());
            formData.append("device_lon", deviceLon.toString());
        }
        if (notes) formData.append("notes", notes);
        formData.append("reporter_id", reporterId.toString());
        photos.forEach((p) => formData.append("images", p.file));

        try {
            const res = await fetch(`${API_URL}/report/submit`, { method: "POST", body: formData });
            const data = await res.json();
            if (res.ok && data.success) {
                router.push(data.tracking_url);
            } else {
                setError(data.message || data.detail || "Failed to submit report.");
            }
        } catch (err) {
            console.error("Submit error:", err);
            setError("Network error. Could not connect to server.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Render ─────────────────────────────────────────────────
    if (!authChecked) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    if (showCamera) {
        return (
            <GeoTagCamera
                onComplete={handleCameraComplete}
                onCancel={() => setShowCamera(false)}
                maxPhotos={MAX_PHOTOS}
            />
        );
    }

    return (
        <div className="min-h-screen bg-background pt-20 pb-12 px-4 flex flex-col items-center">
            <div className="w-full max-w-lg mb-6 flex items-center justify-between">
                <button
                    onClick={() => step === "review" ? setStep("source") : router.push("/")}
                    className="text-foreground/80 hover:text-primary transition-colors flex items-center gap-2 text-sm font-medium"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                    Back
                </button>
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${step === "source" || step === "review" ? "bg-primary" : "bg-foreground/20"}`} />
                    <div className="w-8 h-0.5 bg-foreground/10" />
                    <div className={`w-3 h-3 rounded-full ${step === "review" ? "bg-primary" : "bg-foreground/20 shadow-inner border border-border"}`} />
                </div>
            </div>

            <div className="w-full max-w-lg glass p-6 md:p-7 rounded-2xl border border-border shadow-2xl relative overflow-hidden">
                {error && (
                    <div className="mb-5 p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                        <svg className="text-red-500 shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                        <p className="text-sm font-medium text-red-400">{error}</p>
                    </div>
                )}

                {/* STEP 1: SOURCE CHOOSER */}
                {step === "source" && (
                    <div className="animate-in fade-in duration-300">
                        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-5 shadow-md shadow-primary/20">
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-1.5">Add evidence photo</h2>
                        <p className="text-sm text-foreground/60 font-medium mb-6">
                            Your photo&apos;s location pins the report automatically — there&apos;s no manual map pin.
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={() => { setError(null); setShowCamera(true); }}
                                className="w-full glass rounded-xl border border-primary/40 bg-primary/5 hover:bg-primary/10 transition-all p-4 flex items-center gap-4 group"
                            >
                                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                                </div>
                                <div className="text-left flex-1">
                                    <p className="text-base font-bold text-foreground">Take Photo</p>
                                    <p className="text-xs text-foreground/60">Live geo-tag camera — fastest, most trusted.</p>
                                </div>
                                <svg className="text-foreground/30 group-hover:text-primary transition-colors" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                            </button>

                            <label className={`w-full glass rounded-xl border border-border hover:border-primary/40 transition-all p-4 flex items-center gap-4 group ${validating ? "opacity-60 pointer-events-none" : "cursor-pointer"}`}>
                                <input type="file" accept="image/jpeg,image/png" multiple className="hidden" onChange={handleUploadChange} disabled={validating} />
                                <div className="w-12 h-12 rounded-xl bg-foreground/5 flex items-center justify-center text-foreground/50 group-hover:text-primary shrink-0">
                                    {validating
                                        ? <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                        : <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>}
                                </div>
                                <div className="text-left flex-1">
                                    <p className="text-base font-bold text-foreground">Upload from Gallery</p>
                                    <p className="text-xs text-foreground/60">{validating ? "Checking the photo's location…" : "Must already have a location (geotag) inside SJDM."}</p>
                                </div>
                            </label>
                        </div>

                        <div className="mt-6 p-3 rounded-lg bg-foreground/5 border border-border flex items-start gap-2.5">
                            <svg className="text-primary shrink-0 mt-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                            <p className="text-[11px] text-foreground/60 leading-relaxed">
                                Photos with no location, or edited/AI-generated photos, are rejected. If your gallery photo is blocked, just re-take it with the in-app camera.
                            </p>
                        </div>
                    </div>
                )}

                {/* STEP 2: REVIEW & SUBMIT */}
                {step === "review" && (
                    <div className="animate-in slide-in-from-right-8 duration-300">
                        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-5 shadow-md shadow-primary/20">
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-1.5">Review &amp; submit</h2>
                        <p className="text-sm text-foreground/60 font-medium mb-5">
                            Check your photos and add any notes for the cleanup crew.
                        </p>

                        {/* Photo strip */}
                        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                            {photos.map((p, i) => (
                                <div key={p.previewUrl} className="relative shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-border group">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={p.previewUrl} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                                    <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[9px] font-bold text-white uppercase tracking-wide">
                                        {p.source === "camera" ? "📷 Live" : "⬆ Upload"}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removePhoto(i)}
                                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                            {photos.length < MAX_PHOTOS && (
                                <button
                                    onClick={() => setStep("source")}
                                    className="shrink-0 w-24 h-24 rounded-xl border-2 border-dashed border-foreground/20 hover:border-primary/50 flex items-center justify-center text-foreground/40 hover:text-primary transition-colors"
                                    aria-label="Add more"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                </button>
                            )}
                        </div>

                        {/* Read-only location card — derived from the photo, never editable */}
                        {lat != null && lon != null && (
                            <div className="mb-5 rounded-xl border border-border overflow-hidden">
                                <div className="flex items-center gap-3 p-3 bg-primary/5">
                                    <svg className="text-primary shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-foreground">{barangay ? `Brgy. ${barangay}` : "Location set"}</p>
                                        <p className="text-[11px] text-foreground/50 font-mono">{lat.toFixed(5)}°, {lon.toFixed(5)}° · from your photo</p>
                                    </div>
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-1 rounded">Auto-pinned</span>
                                </div>
                                <div className="h-28 relative bg-black/50">
                                    <MiniMap lat={lat} lon={lon} />
                                    <div className="absolute inset-0 bg-black/10 pointer-events-none" />
                                </div>
                            </div>
                        )}

                        <label className="block text-[11px] font-semibold text-foreground/50 mb-1.5 uppercase tracking-wider">Additional Notes</label>
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="e.g. It's behind the old church, next to the bridge..."
                            className="h-24 mb-5"
                        />

                        <div className="flex gap-3">
                            <Button onClick={() => setStep("source")} disabled={isSubmitting} variant="outline" size="lg" className="flex-1">
                                Back
                            </Button>
                            <Button onClick={handleSubmit} disabled={isSubmitting || photos.length === 0} size="lg" className="flex-[2]">
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        Submit Report
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
