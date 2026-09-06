"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import piexif from "piexifjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://renzobyns-ecowatch-backend.hf.space";

/**
 * A cleanup photo captured by the in-app cleaner geo-camera.
 * GPS is read live at the shutter and written into the JPEG's EXIF, so the
 * backend can verify the cleaner was at the correct location.
 */
export interface CleanerGeoPhoto {
    file: File;
    lat: number;
    lon: number;
    accuracy: number;           // metres
    timestamp: number;          // ms epoch
    distanceFromReport: number; // metres from the original report spot
    source: "camera";
}

interface CleanerGeoCamProps {
    beforeImageUrl: string | null;  // citizen's original photo URL for ghost overlay
    reportLat: number;              // original report GPS for proximity check
    reportLon: number;
    trackingId: string;             // e.g., "EW-1234" for watermark
    barangay: string | null;        // for watermark
    onComplete: (photos: CleanerGeoPhoto[]) => void;
    onBack: () => void;
    maxPhotos?: number;             // default: 5
}

type Phase =
    | "starting"    // requesting permissions
    | "ready"       // camera + GPS fix acquired → can shoot
    | "locating"    // camera up, still waiting for first GPS fix
    | "denied"      // camera or location permission refused
    | "no-camera";  // device has no camera available (desktop)

interface Fix {
    lat: number;
    lon: number;
    accuracy: number;
}

// ── Proximity thresholds (fixed) ─────────────────────────────────
const PROXIMITY_NEAR_M = 100;   // green badge
const PROXIMITY_WARN_M = 500;   // yellow badge (red beyond)

// ── Helper functions ─────────────────────────────────────────────

function pad(n: number): string {
    return String(n).padStart(2, "0");
}

/** EXIF DateTimeOriginal is local wall-clock with no offset ("YYYY:MM:DD HH:MM:SS"). */
function exifDateString(d: Date): string {
    return `${d.getFullYear()}:${pad(d.getMonth() + 1)}:${pad(d.getDate())} ` +
        `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Write Make/Model/Software + GPS + DateTimeOriginal into a JPEG data URL. */
function stampExif(jpegDataUrl: string, fix: Fix, taken: Date): string {
    const zeroth: Record<number, unknown> = {};
    const exifIfd: Record<number, unknown> = {};
    const gps: Record<number, unknown> = {};

    zeroth[piexif.ImageIFD.Make] = "EcoWatch";
    zeroth[piexif.ImageIFD.Model] = "Cleanup GeoCam";
    zeroth[piexif.ImageIFD.Software] = "EcoWatch Cleanup";
    zeroth[piexif.ImageIFD.DateTime] = exifDateString(taken);

    exifIfd[piexif.ExifIFD.DateTimeOriginal] = exifDateString(taken);

    gps[piexif.GPSIFD.GPSLatitudeRef] = fix.lat < 0 ? "S" : "N";
    gps[piexif.GPSIFD.GPSLatitude] = piexif.GPSHelper.degToDmsRational(Math.abs(fix.lat));
    gps[piexif.GPSIFD.GPSLongitudeRef] = fix.lon < 0 ? "W" : "E";
    gps[piexif.GPSIFD.GPSLongitude] = piexif.GPSHelper.degToDmsRational(Math.abs(fix.lon));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exifBytes = piexif.dump({ "0th": zeroth, Exif: exifIfd, GPS: gps } as any);
    return piexif.insert(exifBytes, jpegDataUrl);
}

function dataUrlToFile(dataUrl: string, filename: string): File {
    const [header, base64] = dataUrl.split(",");
    const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], filename, { type: mime });
}

/** Haversine formula — returns distance in metres between two GPS coordinates. */
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Format distance for human display. */
function formatDistance(meters: number): string {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
}

function getImageUrl(url: string | null): string | null {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export default function CleanerGeoCam({
    beforeImageUrl,
    reportLat,
    reportLon,
    trackingId,
    barangay,
    onComplete,
    onBack,
    maxPhotos = 5,
}: CleanerGeoCamProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const watchIdRef = useRef<number | null>(null);

    const [phase, setPhase] = useState<Phase>("starting");
    const [fix, setFix] = useState<Fix | null>(null);
    const [errorMsg, setErrorMsg] = useState<string>("");
    const [photos, setPhotos] = useState<CleanerGeoPhoto[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);  // object URLs, 1:1 with photos
    const [capturing, setCapturing] = useState(false);
    const [flash, setFlash] = useState(false);               // white shutter flash
    const [previewIdx, setPreviewIdx] = useState<number | null>(null); // full-screen preview

    const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
    const [torchSupported, setTorchSupported] = useState(false);
    const [torchOn, setTorchOn] = useState(false);

    // Ghost overlay state
    const [ghostOn, setGhostOn] = useState(false);
    const [ghostLoaded, setGhostLoaded] = useState(false);
    const [ghostHint, setGhostHint] = useState(false);  // one-time hint tooltip
    const ghostImgSrc = getImageUrl(beforeImageUrl);

    // Proximity
    const [distance, setDistance] = useState<number | null>(null);

    // ── Camera Initialization ────────────────────────────────────
    useEffect(() => {
        let cancelled = false;

        async function startCamera() {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
            }

            try {
                if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    setPhase("no-camera");
                    return;
                }

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: facingMode } },
                    audio: false,
                });

                if (cancelled) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }

                streamRef.current = stream;

                // Check for flash (torch) support on this camera track
                const track = stream.getVideoTracks()[0];
                if (track) {
                    const capabilities = track.getCapabilities ? track.getCapabilities() : {};
                    const hasTorch = !!capabilities.torch;
                    setTorchSupported(hasTorch);
                    if (!hasTorch && torchOn) {
                        setTorchOn(false);
                    }
                }

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play().catch(() => {});
                }
            } catch (err: unknown) {
                if (!cancelled) {
                    const error = err as DOMException;
                    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
                        setPhase("no-camera");
                    } else {
                        setErrorMsg("Camera access was blocked. Allow camera to take a cleanup photo.");
                        setPhase("denied");
                    }
                }
            }
        }

        startCamera();

        return () => {
            cancelled = true;
        };
    }, [facingMode]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Geolocation Watch ────────────────────────────────────────
    // Unlike the citizen camera, we don't validate against SJDM boundary.
    // Instead, we compute proximity to the original report coordinates.
    useEffect(() => {
        let cancelled = false;

        if (!("geolocation" in navigator)) {
            if (!cancelled) {
                setErrorMsg("This device has no location services.");
                setPhase("denied");
            }
            return;
        }

        setPhase((p) => (p === "denied" || p === "no-camera" ? p : "locating"));

        watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                if (cancelled) return;
                const next: Fix = {
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                };
                setFix(next);

                // Compute distance from report location
                const dist = haversineMeters(next.lat, next.lon, reportLat, reportLon);
                setDistance(dist);

                setPhase((p) => (p === "locating" || p === "starting" ? "ready" : p));
            },
            () => {
                if (cancelled) return;
                setErrorMsg("Location access was blocked. Allow location so the photo can be geo-tagged.");
                setPhase((prev) => (prev === "no-camera" ? "no-camera" : "denied"));
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
        );

        return () => {
            cancelled = true;
            if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
        };
    }, [reportLat, reportLon]);

    // Revoke our thumbnail object URLs on unmount.
    const previewsRef = useRef<string[]>([]);
    useEffect(() => { previewsRef.current = previews; }, [previews]);
    useEffect(() => () => { previewsRef.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

    // Preload the ghost Before image in the background as soon as component mounts
    useEffect(() => {
        if (!ghostImgSrc) return;
        const img = new Image();
        img.onload = () => setGhostLoaded(true);
        img.src = ghostImgSrc;
    }, [ghostImgSrc]);

    const stopAndCleanup = useCallback(() => {
        if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
        if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    }, []);

    const toggleTorch = useCallback(async () => {
        if (!streamRef.current) return;
        const track = streamRef.current.getVideoTracks()[0];
        if (track && track.getCapabilities?.().torch) {
            try {
                const nextTorch = !torchOn;
                await track.applyConstraints({ advanced: [{ torch: nextTorch }] });
                setTorchOn(nextTorch);
            } catch (e) {
                console.warn("Failed to toggle torch", e);
            }
        }
    }, [torchOn]);

    const flipCamera = useCallback(() => {
        setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    }, []);

    const toggleGhost = useCallback(() => {
        setGhostOn((prev) => {
            const next = !prev;
            // Show hint tooltip the first time ghost is turned on
            if (next && !ghostHint) {
                setGhostHint(true);
                setTimeout(() => setGhostHint(false), 3000);
            }
            if (!next) {
                setErrorMsg("");
            }
            return next;
        });
    }, [ghostHint]);

    // ── Watermark: adapted for cleanup photos ────────────────────
    const burnStamp = useCallback(
        (ctx: CanvasRenderingContext2D, w: number, h: number, fixNow: Fix, taken: Date, dist: number | null) => {
            const line1 = `${trackingId}${barangay ? ` • Brgy. ${barangay}` : ""}`;
            const distLabel = dist !== null ? `  •  ${formatDistance(dist)} from site` : "";
            const line2 = `${fixNow.lat.toFixed(5)}°, ${fixNow.lon.toFixed(5)}°  ±${Math.round(fixNow.accuracy)}m${distLabel}`;
            const line3 = taken.toLocaleString("en-PH", {
                year: "numeric", month: "short", day: "numeric",
                hour: "numeric", minute: "2-digit", hour12: true,
            });

            const fontBig = Math.max(16, Math.round(w * 0.032));
            const fontSmall = Math.max(12, Math.round(w * 0.024));
            const padX = Math.round(w * 0.025);
            const lineGap = Math.round(fontBig * 0.5);
            const blockH = fontBig + lineGap + fontSmall + lineGap + fontSmall + padX * 1.6;

            // Translucent gradient backdrop along the bottom.
            const grad = ctx.createLinearGradient(0, h - blockH, 0, h);
            grad.addColorStop(0, "rgba(0,0,0,0)");
            grad.addColorStop(1, "rgba(0,0,0,0.72)");
            ctx.fillStyle = grad;
            ctx.fillRect(0, h - blockH, w, blockH);

            ctx.textBaseline = "alphabetic";
            ctx.shadowColor = "rgba(0,0,0,0.9)";
            ctx.shadowBlur = 4;

            let y = h - padX - fontSmall - lineGap - fontSmall - lineGap;
            ctx.fillStyle = "#34d399";
            ctx.font = `700 ${fontBig}px system-ui, -apple-system, sans-serif`;
            ctx.fillText(line1, padX, y);

            y += fontBig * 0.4 + lineGap + fontSmall;
            ctx.fillStyle = "#ffffff";
            ctx.font = `600 ${fontSmall}px system-ui, -apple-system, sans-serif`;
            ctx.fillText(line2, padX, y);

            y += lineGap + fontSmall;
            ctx.fillStyle = "rgba(255,255,255,0.85)";
            ctx.font = `500 ${fontSmall}px system-ui, -apple-system, sans-serif`;
            ctx.fillText(`${line3}  •  EcoWatch Cleanup`, padX, y);

            ctx.shadowBlur = 0;
        },
        [trackingId, barangay]
    );

    // ── Shutter ──────────────────────────────────────────────────
    const handleShutter = useCallback(() => {
        const video = videoRef.current;
        if (!video || capturing || photos.length >= maxPhotos) return;
        if (phase !== "ready" || !fix) return;

        setCapturing(true);
        setFlash(true);
        window.setTimeout(() => setFlash(false), 110);
        try {
            const liveFix = fix;
            const taken = new Date();
            const dist = haversineMeters(liveFix.lat, liveFix.lon, reportLat, reportLon);

            const vw = video.videoWidth || 1280;
            const vh = video.videoHeight || 720;
            const MAX_EDGE = 1600;
            const scale = Math.min(1, MAX_EDGE / Math.max(vw, vh));
            const w = Math.round(vw * scale);
            const h = Math.round(vh * scale);

            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("Canvas unavailable");

            // Flip the canvas horizontally if using the front camera (mirror effect)
            if (facingMode === "user") {
                ctx.translate(w, 0);
                ctx.scale(-1, 1);
            }
            ctx.drawImage(video, 0, 0, w, h);

            // Reset transform for drawing text correctly
            if (facingMode === "user") {
                ctx.setTransform(1, 0, 0, 1, 0, 0);
            }

            burnStamp(ctx, w, h, liveFix, taken, dist);

            const rawDataUrl = canvas.toDataURL("image/jpeg", 0.85);
            const stamped = stampExif(rawDataUrl, liveFix, taken);
            const file = dataUrlToFile(stamped, `ecowatch_cleanup_${Date.now()}.jpg`);

            const photo: CleanerGeoPhoto = {
                file,
                lat: liveFix.lat,
                lon: liveFix.lon,
                accuracy: liveFix.accuracy,
                timestamp: taken.getTime(),
                distanceFromReport: dist,
                source: "camera",
            };
            setPhotos((prev) => [...prev, photo]);
            setPreviews((prev) => [...prev, URL.createObjectURL(file)]);
        } catch (e) {
            console.error("Capture failed:", e);
            setErrorMsg("Could not capture the photo. Please try again.");
        } finally {
            setCapturing(false);
        }
    }, [capturing, photos.length, maxPhotos, phase, fix, reportLat, reportLon, burnStamp, facingMode]);

    const removePhoto = (idx: number) => {
        setPreviews((prev) => {
            if (prev[idx]) URL.revokeObjectURL(prev[idx]);
            return prev.filter((_, i) => i !== idx);
        });
        setPhotos((prev) => prev.filter((_, i) => i !== idx));
    };

    const finish = () => {
        if (photos.length === 0) return;
        stopAndCleanup();
        onComplete(photos);
    };

    const cancel = () => {
        stopAndCleanup();
        onBack();
    };

    const canShoot = phase === "ready" && !!fix && photos.length < maxPhotos && !capturing;

    // ── Proximity badge helpers ──────────────────────────────────
    const proximityColor = distance === null
        ? "bg-amber-400 animate-pulse"
        : distance <= PROXIMITY_NEAR_M
            ? "bg-emerald-400 animate-pulse"
            : distance <= PROXIMITY_WARN_M
                ? "bg-amber-400"
                : "bg-red-400";

    const proximityLabel = distance === null
        ? "Getting location…"
        : distance <= PROXIMITY_NEAR_M
            ? `📍 ${formatDistance(distance)} from site ✓`
            : distance <= PROXIMITY_WARN_M
                ? `📍 ${formatDistance(distance)} away ⚠`
                : `📍 ${formatDistance(distance)} away`;

    const compactProximityLabel = distance === null
        ? "GPS…"
        : distance <= PROXIMITY_NEAR_M
            ? `${formatDistance(distance)} ✓`
            : distance <= PROXIMITY_WARN_M
                ? `${formatDistance(distance)} ⚠`
                : formatDistance(distance);

    return (
        <div className="fixed inset-0 h-[100dvh] w-screen z-[99999] bg-black flex flex-col overflow-hidden select-none">
            {/* Live viewfinder */}
            <video
                ref={(el) => {
                    videoRef.current = el;
                    if (el && streamRef.current && el.srcObject !== streamRef.current) {
                        el.srcObject = streamRef.current;
                        el.play().catch(() => {});
                    }
                }}
                autoPlay
                playsInline
                muted
                className={`absolute inset-0 w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
            />

            {/* 👻 Ghost overlay — semi-transparent Before photo */}
            {ghostOn && ghostImgSrc && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={ghostImgSrc}
                    alt="Before reference overlay"
                    onLoad={() => {
                        setGhostLoaded(true);
                        setErrorMsg("");
                    }}
                    onError={() => {
                        setGhostLoaded(false);
                        setErrorMsg("Could not load Before photo for ghost overlay.");
                        setTimeout(() => setErrorMsg(""), 4000);
                    }}
                    className={`absolute inset-0 w-full h-full object-cover pointer-events-none z-[5] transition-opacity duration-300 ${
                        ghostLoaded ? "opacity-40" : "opacity-0"
                    } ${flash ? "opacity-0" : ""}`}
                />
            )}

            {/* Ghost hint tooltip */}
            {ghostHint && ghostOn && (
                <div className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-20 max-w-xs w-[90%] pointer-events-none">
                    <div className="rounded-lg bg-emerald-500/95 shadow-lg backdrop-blur-md text-white text-xs font-semibold px-3 py-2 text-center">
                        Align landmarks to match the Before photo
                    </div>
                </div>
            )}

            {/* Shutter flash */}
            {flash && <div className="absolute inset-0 z-30 bg-white/80 pointer-events-none transition-opacity" />}

            {/* Top bar — ultra-responsive for mobile (cp) screen widths (360px+) */}
            <div className="relative z-20 flex items-center justify-between p-2.5 sm:p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent gap-1.5">
                <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
                    <button
                        onClick={cancel}
                        className="text-white hover:text-primary transition-colors flex items-center gap-1 text-xs sm:text-sm font-semibold bg-black/40 backdrop-blur-sm px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-full border border-white/10 shrink-0 cursor-pointer"
                        aria-label="Back"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        <span>Back</span>
                    </button>
                    {torchSupported && (
                        <button
                            onClick={toggleTorch}
                            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-colors shrink-0 cursor-pointer ${torchOn ? "bg-amber-400 text-black shadow-lg shadow-amber-400/30" : "bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 border border-white/10"}`}
                            aria-label="Toggle flashlight"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                        </button>
                    )}
                    {/* 👻 Ghost overlay toggle */}
                    {ghostImgSrc && (
                        <button
                            onClick={toggleGhost}
                            className={`flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all border shrink-0 cursor-pointer ${
                                ghostOn
                                    ? "bg-violet-600 text-white backdrop-blur-sm border-violet-400/50 shadow-lg shadow-violet-500/30"
                                    : "bg-black/40 text-white/80 backdrop-blur-sm hover:bg-black/60 hover:text-white border-white/10"
                            }`}
                            aria-label="Toggle ghost overlay"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                {ghostOn ? (
                                    <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>
                                ) : (
                                    <><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></>
                                )}
                            </svg>
                            <span>Ghost</span>
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                    {/* Proximity badge — adaptive full label on desktop, compact on mobile (cp) */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${proximityColor}`} />
                        <span className="text-[11px] font-semibold text-white/90 tracking-wide hidden sm:inline whitespace-nowrap">
                            {proximityLabel}
                        </span>
                        <span className="text-[11px] font-semibold text-white/90 tracking-wide sm:hidden whitespace-nowrap">
                            {compactProximityLabel}
                        </span>
                    </div>

                    <button
                        onClick={flipCamera}
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/40 text-white backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors border border-white/10 shrink-0 cursor-pointer"
                        aria-label="Flip camera"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                    </button>
                </div>
            </div>

            {/* Center status / permission states */}
            {(phase === "starting" || phase === "locating" || phase === "denied" || phase === "no-camera") && (
                <div className="absolute inset-0 z-30 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
                    <div className="pointer-events-auto max-w-sm w-full text-center rounded-2xl bg-black/75 backdrop-blur-md border border-white/10 p-6 shadow-2xl">
                        {phase === "starting" && (
                            <>
                                <div className="w-10 h-10 mx-auto mb-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <p className="text-sm font-semibold text-white">Requesting camera + location…</p>
                                <p className="text-xs text-white/60 mt-1">Allow both so your cleanup photo can be geo-tagged.</p>
                            </>
                        )}
                        {phase === "locating" && (
                            <>
                                <div className="w-10 h-10 mx-auto mb-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                                <p className="text-sm font-semibold text-white">Getting your location…</p>
                                <p className="text-xs text-white/60 mt-1">Hold steady for a precise GPS fix.</p>
                            </>
                        )}
                        {(phase === "denied" || phase === "no-camera") && (
                            <>
                                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
                                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                </div>
                                <p className="text-lg font-bold text-white mb-2">
                                    {phase === "no-camera" ? "No camera detected" : "Camera access blocked"}
                                </p>
                                <p className="text-sm text-white/70 mb-6">
                                    {phase === "no-camera"
                                        ? "This device doesn\u2019t have a camera available or the browser blocked media access. Please ensure HTTPS or check permissions."
                                        : "To take a cleanup photo, tap the 🔒 icon in your browser\u2019s address bar and allow camera + location access."}
                                </p>
                                <button onClick={cancel} className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors">
                                    Go back
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Inline transient error (capture failure) */}
            {errorMsg && phase !== "denied" && phase !== "no-camera" && (
                <div className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-20 max-w-xs w-[90%] pointer-events-none">
                    <div className="rounded-lg bg-red-500/90 text-white text-xs font-medium px-3 py-2 text-center shadow-lg">{errorMsg}</div>
                </div>
            )}

            {/* Bottom controls — safe area padding for cellphone navigation bars */}
            <div className="relative z-20 mt-auto p-4 sm:p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/90 via-black/60 to-transparent">
                {/* Thumbnail strip */}
                {photos.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-3 mb-2">
                        {photos.map((p, i) => (
                            <div key={i} className="relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-white/25">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={previews[i]}
                                    alt={`Capture ${i + 1}`}
                                    onClick={() => setPreviewIdx(i)}
                                    className="w-full h-full object-cover cursor-pointer"
                                />
                                <button
                                    onClick={() => removePhoto(i)}
                                    className="absolute top-0 right-0 w-5 h-5 bg-black/70 text-white flex items-center justify-center text-xs"
                                    aria-label="Remove"
                                >×</button>
                                <span className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[8px] text-center leading-none py-0.5 pointer-events-none">tap to view</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center justify-between">
                    {/* Left spacer — no gallery upload for cleaners (anti-cheat) */}
                    <div className="w-20" />

                    <button
                        onClick={handleShutter}
                        disabled={!canShoot}
                        className={`w-18 h-18 rounded-full flex items-center justify-center transition-transform ${canShoot ? "active:scale-90" : "opacity-40"}`}
                        style={{ width: 72, height: 72 }}
                        aria-label="Take photo"
                    >
                        <span className="w-full h-full rounded-full border-4 border-white flex items-center justify-center">
                            <span className={`w-14 h-14 rounded-full ${capturing ? "bg-white/50 animate-pulse" : "bg-white"}`} />
                        </span>
                    </button>

                    <div className="w-20 text-right">
                        <button
                            onClick={finish}
                            disabled={photos.length === 0}
                            className={`px-4 py-2 rounded-full text-sm font-bold ${photos.length > 0 ? "bg-emerald-500 text-white hover:bg-emerald-600" : "bg-white/10 text-white/40"}`}
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>

            {/* Full-screen preview of a captured photo */}
            {previewIdx !== null && previews[previewIdx] && (
                <div className="absolute inset-0 z-40 bg-black/95 flex flex-col" onClick={() => setPreviewIdx(null)}>
                    <div className="flex items-center justify-between p-4">
                        <span className="text-white/80 text-sm font-semibold">Photo {previewIdx + 1} of {photos.length}</span>
                        <button
                            onClick={() => setPreviewIdx(null)}
                            className="text-white/90 hover:text-white text-sm font-semibold flex items-center gap-1"
                            aria-label="Close preview"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            Close
                        </button>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={previews[previewIdx]}
                        alt={`Preview ${previewIdx + 1}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 min-h-0 w-full object-contain"
                    />
                    <div className="p-4 flex justify-center">
                        <button
                            onClick={(e) => { e.stopPropagation(); const idx = previewIdx; setPreviewIdx(null); removePhoto(idx); }}
                            className="px-5 py-2.5 rounded-full bg-red-500/90 text-white text-sm font-bold hover:bg-red-600 flex items-center gap-2"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                            Delete
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
