"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { formatDistanceToNow } from "date-fns";
import { Camera, Trash2, ArrowRight, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { GeoPhoto } from "@/components/GeoTagCamera";
import { api, ApiError } from "@/lib/api";
import { getBarangayOffline } from "@/lib/geo";
import {
    saveCitizenDraft,
    getCitizenDraft,
    clearCitizenDraft,
    addOutboxReport,
    storedPhotoToFile,
    type CitizenDraft,
} from "@/lib/offlineStore";

const GeoTagCamera = dynamic(() => import("@/components/GeoTagCamera"), { ssr: false });

const MiniMap = dynamic(() => import("@/components/MiniMap"), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-foreground/5 animate-pulse flex items-center justify-center"><p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest">Map Loading...</p></div>
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/backend";
const MAX_PHOTOS = 5;
const MAX_BYTES = 10 * 1024 * 1024;


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
    const [showCamera, setShowCamera] = useState(true);

    const [photos, setPhotos] = useState<ReportPhoto[]>([]);
    const [deviceLat, setDeviceLat] = useState<number | null>(null);
    const [deviceLon, setDeviceLon] = useState<number | null>(null);
    const [notes, setNotes] = useState("");

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [mapExpanded, setMapExpanded] = useState(false);
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);
    const [outboxQueued, setOutboxQueued] = useState(false);
    const [restoredDraft, setRestoredDraft] = useState<CitizenDraft | null>(null);


    // ── Check for unsubmitted offline draft ─────────────────────
    useEffect(() => {
        if (!authChecked) return;
        getCitizenDraft().then((draft) => {
            if (draft && draft.photos && draft.photos.length > 0) {
                setRestoredDraft(draft);
                setShowCamera(false);
                setStep("source");
            }
        });
    }, [authChecked]);

    // ── Auto-save draft whenever evidence or notes change ───────
    useEffect(() => {
        if (photos.length > 0) {
            saveCitizenDraft(
                photos.map((p) => ({
                    file: p.file,
                    lat: p.lat,
                    lon: p.lon,
                    barangay: p.barangay,
                    source: p.source,
                })),
                notes,
                deviceLat,
                deviceLon
            );
        }
    }, [photos, notes, deviceLat, deviceLon]);

    const handleResumeDraft = useCallback(() => {
        if (!restoredDraft) return;
        const mapped: ReportPhoto[] = restoredDraft.photos.map((sp) => {
            const file = storedPhotoToFile(sp);
            return {
                file,
                lat: sp.lat,
                lon: sp.lon,
                barangay: sp.barangay,
                source: sp.source,
                previewUrl: URL.createObjectURL(file),
            };
        });
        setPhotos(mapped);
        setNotes(restoredDraft.notes || "");
        if (restoredDraft.deviceLat != null) setDeviceLat(restoredDraft.deviceLat);
        if (restoredDraft.deviceLon != null) setDeviceLon(restoredDraft.deviceLon);
        setRestoredDraft(null);
        setShowCamera(false);
        setStep("review");
        setError(null);
    }, [restoredDraft]);

    const handleDiscardDraft = useCallback(async () => {
        await clearCitizenDraft();
        setRestoredDraft(null);
    }, []);

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

    const removePhoto = (index: number) => {
        URL.revokeObjectURL(photos[index].previewUrl);
        const next = photos.filter((_, i) => i !== index);
        setPhotos(next);
        if (next.length === 0) {
            clearCitizenDraft();
            setStep("source");
        }
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

        // Check if device is offline before sending request
        if (typeof navigator !== "undefined" && !navigator.onLine) {
            try {
                await addOutboxReport({
                    lat,
                    lon,
                    deviceLat: deviceLat ?? null,
                    deviceLon: deviceLon ?? null,
                    notes: notes || undefined,
                    barangay,
                    photos: photos.map((p) => ({
                        blob: p.file,
                        fileName: p.file.name,
                        fileType: p.file.type || "image/jpeg",
                    })),
                    reporterId,
                });
                await clearCitizenDraft();
                setOutboxQueued(true);
                return;
            } catch (queueErr) {
                console.error("Failed to queue offline report:", queueErr);
                setError("Could not save report offline. Please try again.");
                return;
            } finally {
                setIsSubmitting(false);
            }
        }

        const formData = new FormData();
        formData.append("lat", lat.toString());
        formData.append("lon", lon.toString());
        if (deviceLat != null && deviceLon != null) {
            formData.append("device_lat", deviceLat.toString());
            formData.append("device_lon", deviceLon.toString());
        }
        if (notes) formData.append("notes", notes);
        // Identity is sent via the X-User-Id header by the api() helper — not a
        // spoofable form field. The backend derives reporter_id from the session.
        photos.forEach((p) => formData.append("images", p.file));

        try {
            const data = await api("/report/submit", { method: "POST", body: formData });
            if (data?.tracking_url) {
                await clearCitizenDraft();
                router.push(data.tracking_url);
            } else {
                setError(data?.message || "Failed to submit report.");
            }
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                router.replace("/login?redirect=/report");
            } else if (err instanceof ApiError) {
                setError(err.message || "Failed to submit report.");
            } else {
                console.warn("Submit network error, queueing to Outbox:", err);
                try {
                    await addOutboxReport({
                        lat,
                        lon,
                        deviceLat: deviceLat ?? null,
                        deviceLon: deviceLon ?? null,
                        notes: notes || undefined,
                        barangay,
                        photos: photos.map((p) => ({
                            blob: p.file,
                            fileName: p.file.name,
                            fileType: p.file.type || "image/jpeg",
                        })),
                        reporterId,
                    });
                    await clearCitizenDraft();
                    setOutboxQueued(true);
                } catch {
                    setError("Network connection failed and report could not be stored offline.");
                }
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Render ─────────────────────────────────────────────────
    if (!authChecked) {
        return (
            <div className="min-h-screen bg-background pt-4 pb-8 px-4 flex flex-col items-center">
                <div className="w-full max-w-lg mb-6 flex items-center justify-between opacity-50">
                    <div className="w-16 h-4 bg-foreground/10 rounded animate-pulse" />
                    <div className="flex gap-2"><div className="w-3 h-3 rounded-full bg-foreground/10 animate-pulse" /><div className="w-8 h-0.5 bg-foreground/10" /><div className="w-3 h-3 rounded-full bg-foreground/10 animate-pulse" /></div>
                </div>
                <div className="w-full max-w-lg glass p-6 md:p-7 rounded-2xl border border-border shadow-2xl flex flex-col gap-5">
                    <div className="w-11 h-11 rounded-xl bg-foreground/5 animate-pulse" />
                    <div>
                        <div className="w-48 h-6 rounded-md bg-foreground/10 animate-pulse mb-2" />
                        <div className="w-full h-4 rounded-md bg-foreground/5 animate-pulse" />
                    </div>
                    <div className="w-full h-20 rounded-xl bg-foreground/5 animate-pulse mt-2" />
                    <div className="w-full h-20 rounded-xl bg-foreground/5 animate-pulse" />
                </div>
            </div>
        );
    }

    if (outboxQueued) {
        return (
            <div className="min-h-screen bg-background pt-8 pb-12 px-4 flex flex-col items-center justify-center">
                <div className="w-full max-w-md glass p-6 md:p-8 rounded-2xl border border-primary/40 shadow-2xl text-center flex flex-col items-center animate-in zoom-in-95 duration-300">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/10">
                        <WifiOff className="w-8 h-8" />
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2 border border-amber-500/20">
                        Saved to Outbox Queue
                    </span>
                    <h2 className="text-2xl font-bold text-foreground mb-2">Report Saved Locally</h2>
                    <p className="text-sm text-foreground/70 mb-6 leading-relaxed">
                        You appear to be offline or in a low-signal area. Your {photos.length} geo-tagged evidence photo(s) are safely stored in your phone&apos;s memory.
                    </p>

                    <div className="w-full bg-foreground/5 p-4 rounded-xl border border-border/40 text-left mb-6 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-foreground/60">Location:</span>
                            <span className="font-semibold text-foreground">{barangay || "San Jose del Monte"}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-foreground/60">Photos:</span>
                            <span className="font-semibold text-foreground">{photos.length} captured</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-foreground/60">Status:</span>
                            <span className="font-bold text-primary flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                Auto-sync when online
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2.5 w-full">
                        <Button
                            onClick={() => router.push("/")}
                            className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg hover:opacity-90 transition-opacity"
                        >
                            Return to Home
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setOutboxQueued(false);
                                setPhotos([]);
                                setNotes("");
                                setStep("source");
                                setShowCamera(true);
                            }}
                            className="w-full py-3 text-xs text-foreground/70 hover:text-foreground"
                        >
                            Submit Another Report
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (showCamera) {
        return (
            <GeoTagCamera
                onComplete={handleCameraComplete}
                onBack={() => router.push("/")}
                maxPhotos={MAX_PHOTOS}
            />
        );
    }

    return (
        <div className="min-h-screen bg-background pt-4 pb-8 px-4 flex flex-col items-center">
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
                {/* Unsubmitted Offline Draft Recovery Banner */}
                {restoredDraft && (
                    <div className="mb-5 p-4 rounded-xl glass border border-primary/40 bg-primary/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
                                <Camera className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-foreground">
                                    Unsubmitted draft found ({restoredDraft.photos.length} photo{restoredDraft.photos.length > 1 ? "s" : ""})
                                </p>
                                <p className="text-[11px] text-foreground/60">
                                    Saved {formatDistanceToNow(restoredDraft.updatedAt, { addSuffix: true })}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleDiscardDraft}
                                className="text-xs h-8 px-2.5 text-foreground/70 hover:text-red-500"
                            >
                                <Trash2 className="w-3.5 h-3.5 mr-1" />
                                Discard
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleResumeDraft}
                                className="text-xs h-8 px-3 bg-primary text-primary-foreground font-semibold hover:opacity-90 shadow-md"
                            >
                                Resume
                                <ArrowRight className="w-3.5 h-3.5 ml-1" />
                            </Button>
                        </div>
                    </div>
                )}

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
                            Capture live evidence with your camera. Your photo&apos;s location pins the report automatically.
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={() => { setError(null); setShowCamera(true); }}
                                className="w-full glass rounded-xl border border-primary/40 bg-primary/5 hover:bg-primary/10 transition-all p-4 flex items-center gap-4 group cursor-pointer"
                            >
                                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                                </div>
                                <div className="text-left flex-1">
                                    <p className="text-base font-bold text-foreground">Open Camera</p>
                                    <p className="text-xs text-foreground/60">Live geo-tag camera with tamper-proof location stamp.</p>
                                </div>
                                <svg className="text-foreground/30 group-hover:text-primary transition-colors" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                            </button>
                        </div>

                        <div className="mt-6 p-3 rounded-lg bg-foreground/5 border border-border flex items-start gap-2.5">
                            <svg className="text-primary shrink-0 mt-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                            <p className="text-[11px] text-foreground/60 leading-relaxed">
                                To ensure authenticity and fast verification, EcoWatch reports require live in-app camera capture.
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
                                    <img 
                                        src={p.previewUrl} 
                                        alt={`Photo ${i + 1}`} 
                                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                                        onClick={() => setPreviewIndex(i)} 
                                    />
                                    <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[9px] font-bold text-white uppercase tracking-wide pointer-events-none flex items-center gap-1">
                                        {p.source === "camera" ? (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                                                <span>Live</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                                <span>Upload</span>
                                            </>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removePhoto(i)}
                                        className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors z-10 shadow-sm"
                                        title="Remove photo"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                </div>
                            ))}
                            {photos.length < MAX_PHOTOS && (
                                <button
                                    onClick={() => { setError(null); setShowCamera(true); }}
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
                                <div className={`relative bg-black/50 transition-all duration-300 ${mapExpanded ? 'h-64' : 'h-28'}`}>
                                    <MiniMap lat={lat} lon={lon} />
                                    <div className="absolute inset-0 bg-black/10 pointer-events-none" />
                                    <button 
                                        onClick={() => setMapExpanded(!mapExpanded)} 
                                        className="absolute bottom-2 right-2 p-1.5 rounded-md bg-black/60 text-white hover:bg-black/80 transition-colors z-10 pointer-events-auto shadow-md"
                                        title={mapExpanded ? "Minimize map" : "Maximize map"}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            {mapExpanded 
                                                ? <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" /> 
                                                : <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />}
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        )}

                        <label className="block text-[11px] font-semibold text-foreground/50 mb-1.5 uppercase tracking-wider">Additional Notes</label>
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="e.g. It's behind the old church, next to the bridge..."
                            className="h-24 mb-6 rounded-xl resize-none glass bg-background/50 border-border shadow-inner focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:border-primary/50 transition-all"
                        />

                        <div className="flex gap-3">
                            <Button onClick={() => { setError(null); setShowCamera(true); }} disabled={isSubmitting} variant="outline" size="lg" className="flex-1 rounded-xl flex items-center justify-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                                Retake
                            </Button>
                            <Button onClick={handleSubmit} disabled={isSubmitting || photos.length === 0} size="lg" className="flex-[2] rounded-xl flex items-center justify-center gap-2">
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
                        <p className="mt-3 text-center text-[11px] text-foreground/50 leading-relaxed">
                            By submitting, you agree that uploaded photos will be verified using AI (Mask R-CNN Instance Segmentation) with all EXIF metadata stripped locally under RA 10173.{" "}
                            <Link href="/privacy" className="text-primary hover:underline font-medium">
                                Privacy Policy
                            </Link>
                        </p>
                    </div>
                )}
            </div>

            {previewIndex !== null && (
                <div className="fixed inset-0 z-[1400] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setPreviewIndex(null)}>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setPreviewIndex(null); }}
                        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                        title="Close preview"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                        src={photos[previewIndex].previewUrl} 
                        alt="Preview" 
                        className="max-w-full max-h-[85vh] rounded-lg object-contain shadow-2xl animate-in zoom-in-95 duration-300"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}
