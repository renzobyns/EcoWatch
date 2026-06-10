"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import piexif from "piexifjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

/**
 * A photo captured by the in-app geo-tag camera (Path A).
 * The GPS is read live at the shutter and written into the JPEG's EXIF, so the
 * backend trust scoring reads a real geotag and the report auto-pins to it.
 */
export interface GeoPhoto {
    file: File;
    lat: number;
    lon: number;
    accuracy: number;   // metres
    timestamp: number;  // ms epoch
    barangay: string | null;
    source: "camera";
}

interface GeoTagCameraProps {
    onComplete: (photos: GeoPhoto[]) => void;
    onCancel: () => void;
    maxPhotos?: number;
}

type Phase =
    | "starting"        // requesting permissions
    | "ready"           // camera + a usable fix → can shoot
    | "locating"        // camera up, still waiting for first GPS fix
    | "outside"         // current fix is outside SJDM → cannot shoot here
    | "denied";         // camera or location permission refused

interface Fix {
    lat: number;
    lon: number;
    accuracy: number;
}

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
    zeroth[piexif.ImageIFD.Model] = "In-App GeoCam";
    zeroth[piexif.ImageIFD.Software] = "EcoWatch GeoCam";
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

export default function GeoTagCamera({ onComplete, onCancel, maxPhotos = 5 }: GeoTagCameraProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const watchIdRef = useRef<number | null>(null);
    const barangayReqRef = useRef<number>(0);

    const [phase, setPhase] = useState<Phase>("starting");
    const [fix, setFix] = useState<Fix | null>(null);
    const [barangay, setBarangay] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string>("");
    const [photos, setPhotos] = useState<GeoPhoto[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);  // object URLs, 1:1 with photos
    const [capturing, setCapturing] = useState(false);

    // Resolve barangay (and SJDM membership) whenever the fix moves meaningfully.
    const resolveBarangay = useCallback(async (lat: number, lon: number) => {
        const reqId = ++barangayReqRef.current;
        try {
            const res = await fetch(`${API_URL}/report/validate-location`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lat, lon }),
            });
            if (reqId !== barangayReqRef.current) return; // stale response
            if (res.ok) {
                const data = await res.json();
                setBarangay(data.barangay ?? null);
                setPhase((p) => (p === "starting" ? p : "ready"));
            } else {
                setBarangay(null);
                setPhase("outside");
            }
        } catch {
            // Network hiccup — keep the last known barangay; don't block shooting.
            if (reqId === barangayReqRef.current) setBarangay((b) => b);
        }
    }, []);

    // Start camera + geolocation watch on mount.
    useEffect(() => {
        let cancelled = false;

        async function start() {
            // 1) Camera
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: "environment" } },
                    audio: false,
                });
                if (cancelled) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play().catch(() => {});
                }
            } catch {
                if (!cancelled) {
                    setErrorMsg("Camera access was blocked. Allow camera to take a geo-tagged photo.");
                    setPhase("denied");
                }
                return;
            }

            // 2) Geolocation
            if (!("geolocation" in navigator)) {
                if (!cancelled) {
                    setErrorMsg("This device has no location services.");
                    setPhase("denied");
                }
                return;
            }
            if (!cancelled) setPhase("locating");

            watchIdRef.current = navigator.geolocation.watchPosition(
                (pos) => {
                    if (cancelled) return;
                    const next: Fix = {
                        lat: pos.coords.latitude,
                        lon: pos.coords.longitude,
                        accuracy: pos.coords.accuracy,
                    };
                    setFix((prev) => {
                        const moved =
                            !prev ||
                            Math.abs(prev.lat - next.lat) > 0.0002 ||
                            Math.abs(prev.lon - next.lon) > 0.0002;
                        if (moved) resolveBarangay(next.lat, next.lon);
                        return next;
                    });
                    setPhase((p) => (p === "locating" ? "ready" : p));
                },
                () => {
                    if (cancelled) return;
                    setErrorMsg("Location access was blocked. Allow location so the photo can be geo-tagged.");
                    setPhase("denied");
                },
                { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
            );
        }

        start();

        return () => {
            cancelled = true;
            if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
            if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
        };
    }, [resolveBarangay]);

    // Revoke our thumbnail object URLs on unmount (the report page makes its own
    // from the handed-off files, so these are safe to release).
    const previewsRef = useRef<string[]>([]);
    useEffect(() => { previewsRef.current = previews; }, [previews]);
    useEffect(() => () => { previewsRef.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

    const stopAndCleanup = useCallback(() => {
        if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
        if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    }, []);

    const burnStamp = useCallback(
        (ctx: CanvasRenderingContext2D, w: number, h: number, fixNow: Fix, taken: Date, brgy: string | null) => {
            const line1 = brgy ? `Brgy. ${brgy}` : "San Jose del Monte";
            const line2 = `${fixNow.lat.toFixed(5)}°, ${fixNow.lon.toFixed(5)}°  ±${Math.round(fixNow.accuracy)}m`;
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
            ctx.fillText(`${line3}  •  EcoWatch GeoCam`, padX, y);

            ctx.shadowBlur = 0;
        },
        []
    );

    const handleShutter = useCallback(async () => {
        const video = videoRef.current;
        if (!video || capturing || photos.length >= maxPhotos) return;
        if (phase !== "ready" || !fix) return;

        setCapturing(true);
        try {
            // Grab the freshest possible fix at the moment of the snap.
            const liveFix: Fix = await new Promise((resolve) => {
                navigator.geolocation.getCurrentPosition(
                    (pos) => resolve({
                        lat: pos.coords.latitude,
                        lon: pos.coords.longitude,
                        accuracy: pos.coords.accuracy,
                    }),
                    () => resolve(fix),
                    { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
                );
            });

            const taken = new Date();
            const w = video.videoWidth || 1280;
            const h = video.videoHeight || 720;
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("Canvas unavailable");
            ctx.drawImage(video, 0, 0, w, h);
            burnStamp(ctx, w, h, liveFix, taken, barangay);

            const rawDataUrl = canvas.toDataURL("image/jpeg", 0.9);
            const stamped = stampExif(rawDataUrl, liveFix, taken);
            const file = dataUrlToFile(stamped, `ecowatch_geocam_${Date.now()}.jpg`);

            const photo: GeoPhoto = {
                file,
                lat: liveFix.lat,
                lon: liveFix.lon,
                accuracy: liveFix.accuracy,
                timestamp: taken.getTime(),
                barangay,
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
    }, [capturing, photos.length, maxPhotos, phase, fix, barangay, burnStamp]);

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
        onCancel();
    };

    const canShoot = phase === "ready" && !!fix && photos.length < maxPhotos && !capturing;

    return (
        <div className="fixed inset-0 z-[1200] bg-black flex flex-col">
            {/* Live viewfinder */}
            <video
                ref={videoRef}
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Top bar */}
            <div className="relative z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
                <button
                    onClick={cancel}
                    className="text-white/90 hover:text-white flex items-center gap-2 text-sm font-semibold"
                    aria-label="Cancel"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    Cancel
                </button>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10">
                    <span className={`w-2 h-2 rounded-full ${fix ? (phase === "outside" ? "bg-red-400" : "bg-emerald-400 animate-pulse") : "bg-amber-400 animate-pulse"}`} />
                    <span className="text-[11px] font-semibold text-white/90 tracking-wide">
                        {phase === "outside"
                            ? "Outside SJDM"
                            : fix
                                ? `${barangay ? `Brgy. ${barangay}` : "Locating area"} • ±${Math.round(fix.accuracy)}m`
                                : "Getting location…"}
                    </span>
                </div>
            </div>

            {/* Center status / permission states */}
            {(phase === "starting" || phase === "locating" || phase === "denied" || phase === "outside") && (
                <div className="absolute inset-0 z-10 flex items-center justify-center p-6 pointer-events-none">
                    <div className="pointer-events-auto max-w-sm w-full text-center rounded-2xl bg-black/70 backdrop-blur-md border border-white/10 p-6">
                        {phase === "starting" && (
                            <>
                                <div className="w-10 h-10 mx-auto mb-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <p className="text-sm font-semibold text-white">Requesting camera + location…</p>
                                <p className="text-xs text-white/60 mt-1">Allow both so your photo can be geo-tagged.</p>
                            </>
                        )}
                        {phase === "locating" && (
                            <>
                                <div className="w-10 h-10 mx-auto mb-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                                <p className="text-sm font-semibold text-white">Getting your location…</p>
                                <p className="text-xs text-white/60 mt-1">Hold steady for a precise GPS fix.</p>
                            </>
                        )}
                        {phase === "outside" && (
                            <>
                                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
                                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><line x1="12" y1="2" x2="12" y2="22" /></svg>
                                </div>
                                <p className="text-sm font-semibold text-white">You&apos;re outside San Jose del Monte</p>
                                <p className="text-xs text-white/60 mt-1">EcoWatch only accepts reports taken inside SJDM, so this spot can&apos;t be reported.</p>
                                <button onClick={cancel} className="mt-4 text-xs font-semibold text-emerald-400 hover:text-emerald-300">Go back</button>
                            </>
                        )}
                        {phase === "denied" && (
                            <>
                                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
                                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                </div>
                                <p className="text-sm font-semibold text-white">{errorMsg || "Permission denied"}</p>
                                <p className="text-xs text-white/60 mt-1">Enable camera & location in your browser, then try again.</p>
                                <div className="flex gap-2 mt-4 justify-center">
                                    <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600">Try again</button>
                                    <button onClick={cancel} className="px-4 py-2 rounded-lg bg-white/10 text-white text-xs font-semibold hover:bg-white/20">Cancel</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Inline transient error (capture failure) */}
            {errorMsg && phase !== "denied" && phase !== "outside" && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 max-w-xs w-[90%]">
                    <div className="rounded-lg bg-red-500/90 text-white text-xs font-medium px-3 py-2 text-center">{errorMsg}</div>
                </div>
            )}

            {/* Bottom controls */}
            <div className="relative z-10 mt-auto p-5 bg-gradient-to-t from-black/80 to-transparent">
                {/* Thumbnail strip */}
                {photos.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-3 mb-2">
                        {photos.map((p, i) => (
                            <div key={i} className="relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-white/20">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={previews[i]} alt={`Capture ${i + 1}`} className="w-full h-full object-cover" />
                                <button
                                    onClick={() => removePhoto(i)}
                                    className="absolute top-0 right-0 w-5 h-5 bg-black/70 text-white flex items-center justify-center text-xs"
                                    aria-label="Remove"
                                >×</button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <div className="w-20 text-left">
                        <span className="text-[11px] font-semibold text-white/70">{photos.length}/{maxPhotos}</span>
                    </div>

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
        </div>
    );
}
