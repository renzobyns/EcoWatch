"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { X, MapPin, Clock, FileText, ExternalLink, Camera, Upload } from "lucide-react";
import { toast } from "sonner";
import { slaDeadlineLabel, slaDeadlineColor, SLA_PILL_CLASSES } from "@/lib/sla";
import { formatDateTime } from "@/lib/date-utils";
import type { CleanerGeoPhoto } from "@/components/CleanerGeoCam";

const MiniMap = dynamic(() => import("@/components/MiniMap"), { ssr: false });
const CleanerGeoCam = dynamic(() => import("@/components/CleanerGeoCam"), { ssr: false });

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://renzobyns-ecowatch-backend.hf.space";

function getImageUrl(url: string | null | undefined): string {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

interface CleanerJobDrawerProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    workOrder: any;
    onClose: () => void;
    onStart: (workOrderId: number) => Promise<void> | void;
    onComplete: (workOrderId: number, images: File[], cleanerLat?: number, cleanerLon?: number) => Promise<void> | void;
    actionLoading?: boolean;
}

export function CleanerJobDrawer({
    workOrder,
    onClose,
    onStart,
    onComplete,
    actionLoading = false,
}: CleanerJobDrawerProps) {
    // Camera + Review flow states
    const [mounted, setMounted] = useState(false);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [showReview, setShowReview] = useState(false);
    const [reviewPhotos, setReviewPhotos] = useState<CleanerGeoPhoto[]>([]);
    const [reviewPreviews, setReviewPreviews] = useState<string[]>([]);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Close drawer on Escape
    useEffect(() => {
        const onEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (cameraOpen) {
                    // Camera handles its own back button, but Escape also works
                    setCameraOpen(false);
                } else if (showReview) {
                    setShowReview(false);
                    cleanupReviewState();
                } else {
                    onClose();
                }
            }
        };
        document.addEventListener("keydown", onEsc);
        return () => document.removeEventListener("keydown", onEsc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onClose, cameraOpen, showReview]);

    // Cleanup review preview URLs on unmount
    useEffect(() => {
        return () => {
            reviewPreviews.forEach((url) => URL.revokeObjectURL(url));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!workOrder) return null;

    const status = workOrder.status as string;
    const isReadOnly = status === "verified" || status === "completed";
    const hasCoords = workOrder.report_lat != null && workOrder.report_lon != null;

    const isCompleted = status === "completed";
    const sla = workOrder.sla_deadline && !isCompleted ? slaDeadlineLabel(workOrder.sla_deadline) : null;
    const slaColor = workOrder.sla_deadline && !isCompleted ? slaDeadlineColor(workOrder.sla_deadline) : null;
    const completedOnTime =
        isCompleted && workOrder.completed_at && workOrder.sla_deadline
            ? new Date(workOrder.completed_at) <= new Date(workOrder.sla_deadline)
            : null;

    const gmapsHref = hasCoords
        ? `https://www.google.com/maps/dir/?api=1&destination=${workOrder.report_lat},${workOrder.report_lon}`
        : "#";

    // ── Camera completion handler ────────────────────────────────
    const handleCameraComplete = (photos: CleanerGeoPhoto[]) => {
        const previews = photos.map((p) => URL.createObjectURL(p.file));
        setReviewPhotos(photos);
        setReviewPreviews(previews);
        setCameraOpen(false);
        setShowReview(true);
    };

    const handleCameraBack = () => {
        setCameraOpen(false);
    };

    // ── Review actions ───────────────────────────────────────────
    const cleanupReviewState = () => {
        reviewPreviews.forEach((url) => URL.revokeObjectURL(url));
        setReviewPhotos([]);
        setReviewPreviews([]);
    };

    const handleReviewSubmit = async () => {
        if (reviewPhotos.length === 0) {
            toast.error("No photos to submit.");
            return;
        }
        const files = reviewPhotos.map((p) => p.file);
        const lat = reviewPhotos[0]?.lat;
        const lon = reviewPhotos[0]?.lon;
        await onComplete(workOrder.id, files, lat, lon);
        cleanupReviewState();
        setShowReview(false);
    };

    const handleRetake = () => {
        cleanupReviewState();
        setShowReview(false);
        setCameraOpen(true);
    };

    const handleCancelReview = () => {
        cleanupReviewState();
        setShowReview(false);
    };

    const priorityClass =
        workOrder.priority === "high"
            ? "bg-red-500/20 text-red-400 border-red-500/30"
            : workOrder.priority === "low"
              ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
              : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";

    // Format average distance for review badge
    const avgDistance = reviewPhotos.length > 0
        ? Math.round(reviewPhotos.reduce((sum, p) => sum + p.distanceFromReport, 0) / reviewPhotos.length)
        : null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[1900] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Drawer */}
            <aside className="fixed top-0 right-0 z-[1950] h-full w-full sm:w-[480px] bg-card border-l border-border shadow-2xl shadow-black/50 flex flex-col animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="shrink-0 px-5 py-4 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                        <p className="font-mono font-bold text-foreground truncate">
                            {workOrder.report_tracking_id ?? `WO #${workOrder.id}`}
                        </p>
                        <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${priorityClass}`}
                        >
                            {workOrder.priority}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="size-9 rounded-full flex items-center justify-center text-foreground/60 hover:bg-foreground/5 hover:text-foreground transition-colors"
                        aria-label="Close drawer"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-5 pb-16 sm:pb-8 space-y-6">
                    {/* ── Review Screen ─────────────────────────────── */}
                    {showReview ? (
                        <div className="space-y-6 animate-in fade-in duration-200">
                            <div>
                                <h3 className="text-lg font-semibold text-foreground mb-1">Review Cleanup Photos</h3>
                                <p className="text-sm text-muted-foreground">
                                    Confirm the before &amp; after comparison, then submit for AI verification.
                                </p>
                            </div>

                            {/* Before vs After comparison */}
                            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                {/* BEFORE */}
                                <div className="rounded-lg overflow-hidden border border-border bg-muted/20">
                                    <div className="text-xs font-semibold text-muted-foreground p-2 border-b border-border bg-muted/40">Before</div>
                                    {workOrder.report_image_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={getImageUrl(workOrder.report_image_url)}
                                            alt="Before"
                                            className="w-full h-36 object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-36 flex items-center justify-center text-xs text-muted-foreground">No photo</div>
                                    )}
                                </div>

                                {/* AFTER */}
                                <div className="rounded-lg overflow-hidden border border-border bg-muted/20">
                                    <div className="text-xs font-semibold text-muted-foreground p-2 border-b border-border bg-muted/40">
                                        After ({reviewPhotos.length}/{5})
                                    </div>
                                    {reviewPreviews.length === 1 ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={reviewPreviews[0]}
                                            alt="After"
                                            className="w-full h-36 object-cover"
                                        />
                                    ) : (
                                        <div className="flex gap-1 overflow-x-auto p-1 h-36 items-center">
                                            {reviewPreviews.map((url, i) => (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    key={url}
                                                    src={url}
                                                    alt={`After ${i + 1}`}
                                                    className="shrink-0 w-20 h-28 rounded-md object-cover border border-border"
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Proximity verification badge */}
                            {avgDistance !== null && (
                                <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border ${
                                    avgDistance <= 100
                                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                        : avgDistance <= 500
                                            ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                                            : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
                                }`}>
                                    <MapPin className="size-4 shrink-0" />
                                    <div>
                                        <p className="text-sm font-semibold">
                                            {avgDistance <= 100
                                                ? `GPS Verified: ${avgDistance}m from report spot`
                                                : avgDistance <= 500
                                                    ? `Warning: ${avgDistance}m from report spot`
                                                    : `Far from report: ${avgDistance >= 1000 ? `${(avgDistance / 1000).toFixed(1)}km` : `${avgDistance}m`} away`}
                                        </p>
                                        <p className="text-xs opacity-80">
                                            {avgDistance <= 100
                                                ? "Location matches the reported incident area."
                                                : "Ensure you're at the correct cleanup site."}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Photo metadata summary */}
                            <div className="text-xs text-muted-foreground space-y-1">
                                <p>📸 {reviewPhotos.length} photo{reviewPhotos.length > 1 ? "s" : ""} captured with GPS &amp; timestamp</p>
                                <p>📍 {reviewPhotos[0]?.lat.toFixed(5)}°, {reviewPhotos[0]?.lon.toFixed(5)}° ±{Math.round(reviewPhotos[0]?.accuracy ?? 0)}m</p>
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleRetake}
                                    disabled={actionLoading}
                                    className="flex-1 px-4 py-2.5 border border-border text-foreground bg-background text-sm font-medium rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Retake
                                </button>
                                <button
                                    type="button"
                                    onClick={handleReviewSubmit}
                                    disabled={actionLoading}
                                    className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                                >
                                    {actionLoading ? "Uploading…" : "Submit Resolution"}
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={handleCancelReview}
                                disabled={actionLoading}
                                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                        </div>
                    ) : (
                        /* ── Normal Drawer Content ──────────────────── */
                        <>
                            {/* Citizen evidence */}
                            <section>
                                <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                    <FileText className="size-3.5" />
                                    {isReadOnly ? "Before / After" : "Citizen Evidence"}
                                </h3>
                                {isReadOnly && workOrder.report_cleanup_image_url ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="rounded-lg overflow-hidden bg-muted/20 border border-border">
                                            <div className="text-xs font-semibold text-muted-foreground p-2 border-b border-border bg-muted/40">Before</div>
                                            {workOrder.report_image_url ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={getImageUrl(workOrder.report_image_url)}
                                                    alt="Citizen evidence"
                                                    className="w-full h-32 object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-32 flex items-center justify-center text-xs text-foreground/40">No photo</div>
                                            )}
                                        </div>
                                        <div className="rounded-lg overflow-hidden bg-muted/20 border border-border">
                                            <div className="text-xs font-semibold text-muted-foreground p-2 border-b border-border bg-muted/40">After</div>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={getImageUrl(workOrder.report_cleanup_image_url)}
                                                alt="Cleanup verification"
                                                className="w-full h-32 object-cover"
                                            />
                                        </div>
                                    </div>
                                ) : workOrder.report_image_url ? (
                                    <div className="rounded-xl overflow-hidden bg-black/30 border border-border">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={getImageUrl(workOrder.report_image_url)}
                                            alt="Citizen evidence"
                                            className="w-full max-h-64 object-cover"
                                        />
                                    </div>
                                ) : (
                                    <div className="rounded-xl bg-black/30 border border-border h-40 flex items-center justify-center text-xs text-foreground/40">
                                        No photo provided
                                    </div>
                                )}
                            </section>

                            {/* Location */}
                            <section>
                                <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                    <MapPin className="size-3.5" />
                                    Location
                                </h3>
                                <p className="text-sm font-bold text-foreground">{workOrder.report_barangay ?? "—"}</p>
                                {hasCoords && (
                                    <p className="text-xs text-foreground/60 font-mono mb-3">
                                        {workOrder.report_lat.toFixed(4)}, {workOrder.report_lon.toFixed(4)}
                                    </p>
                                )}
                                {hasCoords && (
                                    <div className="rounded-xl overflow-hidden border border-border mb-3 h-40">
                                        <MiniMap lat={workOrder.report_lat} lon={workOrder.report_lon} />
                                    </div>
                                )}
                                <a
                                    href={gmapsHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-disabled={!hasCoords}
                                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg glass border border-border text-xs font-bold transition-colors ${
                                        hasCoords
                                            ? "text-foreground hover:bg-foreground/10"
                                            : "text-foreground/30 pointer-events-none"
                                    }`}
                                >
                                    <ExternalLink className="size-3.5" />
                                    Open in Google Maps
                                </a>
                            </section>

                            {/* SLA */}
                            <section>
                                <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                    <Clock className="size-3.5" />
                                    SLA
                                </h3>
                                {sla && slaColor && (
                                    <div
                                        className={`inline-block px-4 py-2 rounded-lg text-sm font-bold ${SLA_PILL_CLASSES[slaColor]}`}
                                    >
                                        {sla}
                                    </div>
                                )}
                                {completedOnTime !== null && (
                                    <div
                                        className={`inline-block px-4 py-2 rounded-lg text-sm font-bold ${
                                            completedOnTime
                                                ? "bg-green-500/20 text-green-400"
                                                : "bg-red-500/20 text-red-400"
                                        }`}
                                    >
                                        {completedOnTime ? "Completed on time" : "Completed overdue"}
                                    </div>
                                )}
                                <div className="mt-2 text-xs text-foreground/60 space-y-0.5">
                                    {workOrder.created_at && (
                                        <p>Assigned: {formatDateTime(workOrder.created_at)}</p>
                                    )}
                                    {workOrder.sla_deadline && (
                                        <p>Deadline: {formatDateTime(workOrder.sla_deadline)}</p>
                                    )}
                                    {workOrder.started_at && (
                                        <p>Started: {formatDateTime(workOrder.started_at)}</p>
                                    )}
                                    {workOrder.completed_at && (
                                        <p>Completed: {formatDateTime(workOrder.completed_at)}</p>
                                    )}
                                </div>
                            </section>

                            {/* Notes */}
                            {(workOrder.notes || workOrder.report_notes) && (
                                <section>
                                    <h3 className="text-sm font-medium text-muted-foreground mb-2">
                                        Notes
                                    </h3>
                                    {workOrder.notes && (
                                        <div className="mb-2">
                                            <p className="text-xs font-semibold text-primary/80 mb-1">Barangay</p>
                                            <p className="text-sm text-foreground/80 whitespace-pre-wrap">{workOrder.notes}</p>
                                        </div>
                                    )}
                                    {workOrder.report_notes && (
                                        <div>
                                            <p className="text-xs font-semibold text-primary/80 mb-1">Citizen</p>
                                            <p className="text-sm text-foreground/80 whitespace-pre-wrap">{workOrder.report_notes}</p>
                                        </div>
                                    )}
                                </section>
                            )}
                        </>
                    )}
                </div>

                {/* Footer: action buttons (hidden during review — review has its own buttons) */}
                {!isReadOnly && !showReview && (
                    <div className="shrink-0 border-t border-border p-5">
                        {status === "assigned" && (
                            <button
                                type="button"
                                onClick={() => onStart(workOrder.id)}
                                disabled={actionLoading}
                                className="w-full px-4 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {actionLoading ? "Starting…" : "Start Work"}
                            </button>
                        )}
                        {status === "in_progress" && (
                            <button
                                type="button"
                                onClick={() => setCameraOpen(true)}
                                disabled={actionLoading}
                                className="w-full px-4 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
                            >
                                <Camera className="size-4" />
                                Capture Cleanup Photo
                            </button>
                        )}
                        {status === "needs_redo" && (
                            <button
                                type="button"
                                onClick={() => setCameraOpen(true)}
                                disabled={actionLoading}
                                className="w-full px-4 py-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-sm font-medium rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
                            >
                                <Upload className="size-4" />
                                Re-capture Cleanup Photo
                            </button>
                        )}
                    </div>
                )}
            </aside>

            {/* Full-screen Cleaner GeoCam overlay rendered directly on document.body */}
            {cameraOpen && mounted && typeof document !== "undefined" && createPortal(
                <CleanerGeoCam
                    beforeImageUrl={workOrder.report_image_url}
                    reportLat={workOrder.report_lat ?? 14.8135}
                    reportLon={workOrder.report_lon ?? 121.0453}
                    trackingId={workOrder.report_tracking_id ?? `WO-${workOrder.id}`}
                    barangay={workOrder.report_barangay}
                    onComplete={handleCameraComplete}
                    onBack={handleCameraBack}
                />,
                document.body
            )}
        </>
    );
}
