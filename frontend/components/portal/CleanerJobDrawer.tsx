"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { X, MapPin, Clock, FileText, ExternalLink, Camera, Upload } from "lucide-react";
import { toast } from "sonner";
import { slaDeadlineLabel, slaDeadlineColor, SLA_PILL_CLASSES } from "@/lib/sla";

const MiniMap = dynamic(() => import("@/components/MiniMap"), { ssr: false });
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface CleanerJobDrawerProps {
    workOrder: any;
    onClose: () => void;
    onStart: (workOrderId: number) => Promise<void> | void;
    onComplete: (workOrderId: number, images: File[]) => Promise<void> | void;
    actionLoading?: boolean;
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function CleanerJobDrawer({
    workOrder,
    onClose,
    onStart,
    onComplete,
    actionLoading = false,
}: CleanerJobDrawerProps) {
    const [photoModalOpen, setPhotoModalOpen] = useState(false);
    const [cleanupImages, setCleanupImages] = useState<File[]>([]);
    const [cleanupPreviews, setCleanupPreviews] = useState<string[]>([]);

    // Close drawer on Escape
    useEffect(() => {
        const onEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (photoModalOpen) {
                    setPhotoModalOpen(false);
                } else {
                    onClose();
                }
            }
        };
        document.addEventListener("keydown", onEsc);
        return () => document.removeEventListener("keydown", onEsc);
    }, [onClose, photoModalOpen]);

    if (!workOrder) return null;

    const status = workOrder.status as string;
    const isReadOnly = status === "verified" || status === "completed";
    const hasCoords = workOrder.report_lat != null && workOrder.report_lon != null;

    const sla = workOrder.sla_deadline ? slaDeadlineLabel(workOrder.sla_deadline) : null;
    const slaColor = workOrder.sla_deadline ? slaDeadlineColor(workOrder.sla_deadline) : null;

    const gmapsHref = hasCoords
        ? `https://www.google.com/maps/dir/?api=1&destination=${workOrder.report_lat},${workOrder.report_lon}`
        : "#";

    const handlePickImages = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (files.length === 0) return;
        const oversized = files.filter((f) => f.size > MAX_UPLOAD_BYTES);
        if (oversized.length > 0) {
            toast.error("Each image must be 10 MB or smaller.");
            return;
        }
        const total = cleanupImages.length + files.length;
        if (total > 5) {
            toast.error("Maximum 5 cleanup photos allowed.");
            return;
        }
        setCleanupImages((prev) => [...prev, ...files]);
        files.forEach((file) => {
            const reader = new FileReader();
            reader.onload = (ev) =>
                setCleanupPreviews((prev) => [...prev, ev.target?.result as string]);
            reader.readAsDataURL(file);
        });
        e.target.value = "";
    };

    const removeCleanupImage = (index: number) => {
        setCleanupImages((prev) => prev.filter((_, i) => i !== index));
        setCleanupPreviews((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmitPhoto = async () => {
        if (cleanupImages.length === 0) {
            toast.error("Please choose at least one photo.");
            return;
        }
        await onComplete(workOrder.id, cleanupImages);
        setCleanupImages([]);
        setCleanupPreviews([]);
        setPhotoModalOpen(false);
    };

    const closePhotoModal = () => {
        setPhotoModalOpen(false);
        setCleanupImages([]);
        setCleanupPreviews([]);
    };

    const priorityClass =
        workOrder.priority === "high"
            ? "bg-red-500/20 text-red-400 border-red-500/30"
            : workOrder.priority === "low"
              ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
              : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";

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
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border ${priorityClass}`}
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
                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
                    {/* Citizen evidence */}
                    <section>
                        <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-foreground/50 mb-2 flex items-center gap-2">
                            <FileText className="size-3.5" />
                            {isReadOnly ? "Before / After" : "Citizen Evidence"}
                        </h3>
                        {isReadOnly && workOrder.report_cleanup_image_url ? (
                            <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-xl overflow-hidden bg-black/30 border border-border">
                                    <div className="text-[10px] uppercase tracking-widest font-bold text-foreground/50 p-2 border-b border-border bg-black/20">Before</div>
                                    {workOrder.report_image_url ? (
                                        <img
                                            src={`${API_URL}${workOrder.report_image_url}`}
                                            alt="Citizen evidence"
                                            className="w-full h-32 object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-32 flex items-center justify-center text-xs text-foreground/40">No photo</div>
                                    )}
                                </div>
                                <div className="rounded-xl overflow-hidden bg-black/30 border border-border">
                                    <div className="text-[10px] uppercase tracking-widest font-bold text-foreground/50 p-2 border-b border-border bg-black/20">After</div>
                                    <img
                                        src={`${API_URL}${workOrder.report_cleanup_image_url}`}
                                        alt="Cleanup verification"
                                        className="w-full h-32 object-cover"
                                    />
                                </div>
                            </div>
                        ) : workOrder.report_image_url ? (
                            <div className="rounded-xl overflow-hidden bg-black/30 border border-border">
                                <img
                                    src={`${API_URL}${workOrder.report_image_url}`}
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
                        <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-foreground/50 mb-2 flex items-center gap-2">
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
                        <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-foreground/50 mb-2 flex items-center gap-2">
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
                        <div className="mt-2 text-xs text-foreground/60 space-y-0.5">
                            {workOrder.created_at && (
                                <p>Assigned: {new Date(workOrder.created_at).toLocaleString()}</p>
                            )}
                            {workOrder.sla_deadline && (
                                <p>Deadline: {new Date(workOrder.sla_deadline).toLocaleString()}</p>
                            )}
                            {workOrder.started_at && (
                                <p>Started: {new Date(workOrder.started_at).toLocaleString()}</p>
                            )}
                            {workOrder.completed_at && (
                                <p>Completed: {new Date(workOrder.completed_at).toLocaleString()}</p>
                            )}
                        </div>
                    </section>

                    {/* Notes */}
                    {(workOrder.notes || workOrder.report_notes) && (
                        <section>
                            <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-foreground/50 mb-2">
                                Notes
                            </h3>
                            {workOrder.notes && (
                                <div className="mb-2">
                                    <p className="text-[10px] uppercase tracking-widest font-bold text-primary/80 mb-1">Barangay</p>
                                    <p className="text-sm text-foreground/80 whitespace-pre-wrap">{workOrder.notes}</p>
                                </div>
                            )}
                            {workOrder.report_notes && (
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest font-bold text-primary/80 mb-1">Citizen</p>
                                    <p className="text-sm text-foreground/80 whitespace-pre-wrap">{workOrder.report_notes}</p>
                                </div>
                            )}
                        </section>
                    )}
                </div>

                {/* Footer: action buttons */}
                {!isReadOnly && (
                    <div className="shrink-0 border-t border-border p-5">
                        {status === "assigned" && (
                            <button
                                type="button"
                                onClick={() => onStart(workOrder.id)}
                                disabled={actionLoading}
                                className="w-full px-4 py-3 eco-gradient text-white text-sm font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                            >
                                {actionLoading ? "Starting…" : "Start Work"}
                            </button>
                        )}
                        {status === "in_progress" && (
                            <button
                                type="button"
                                onClick={() => setPhotoModalOpen(true)}
                                disabled={actionLoading}
                                className="w-full px-4 py-3 eco-gradient text-white text-sm font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2"
                            >
                                <Camera className="size-4" />
                                Upload Cleanup Photo
                            </button>
                        )}
                        {status === "needs_redo" && (
                            <button
                                type="button"
                                onClick={() => setPhotoModalOpen(true)}
                                disabled={actionLoading}
                                className="w-full px-4 py-3 bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 text-sm font-bold rounded-xl hover:bg-yellow-500/30 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
                            >
                                <Upload className="size-4" />
                                Re-attempt Upload
                            </button>
                        )}
                    </div>
                )}
            </aside>

            {/* Nested photo upload modal */}
            {photoModalOpen && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="glass p-6 max-w-lg w-full rounded-2xl border border-border shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-bold text-foreground mb-1">Upload Cleanup Photo</h3>
                        <p className="text-sm text-foreground/60 mb-4">
                            {status === "needs_redo"
                                ? "Please clean more thoroughly and upload a new photo."
                                : "Take a clear photo showing the cleaned area."}
                        </p>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                            {/* BEFORE */}
                            <div className="rounded-xl overflow-hidden border border-border bg-black/30">
                                <div className="text-[10px] uppercase tracking-widest font-bold text-foreground/50 p-2 border-b border-border bg-black/20">Before</div>
                                {workOrder.report_image_url ? (
                                    <img
                                        src={`${API_URL}${workOrder.report_image_url}`}
                                        alt="Before"
                                        className="w-full h-32 object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-32 flex items-center justify-center text-xs text-foreground/40">No photo</div>
                                )}
                            </div>

                            {/* AFTER — multi-photo */}
                            <div className="rounded-xl overflow-hidden border border-border bg-black/30">
                                <div className="text-[10px] uppercase tracking-widest font-bold text-foreground/50 p-2 border-b border-border bg-black/20">
                                    After ({cleanupImages.length}/5)
                                </div>
                                {cleanupPreviews.length === 0 ? (
                                    <label className="w-full h-32 flex items-center justify-center cursor-pointer group">
                                        <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handlePickImages} />
                                        <div className="text-center">
                                            <Camera className="size-6 mx-auto mb-1 text-foreground/40 group-hover:text-primary transition-colors" />
                                            <p className="text-[10px] font-bold text-foreground/50">Tap to capture</p>
                                        </div>
                                    </label>
                                ) : (
                                    <div className="flex gap-1 overflow-x-auto p-1">
                                        {cleanupPreviews.map((url, i) => (
                                            <div key={url} className="relative shrink-0 w-20 h-20 rounded-lg overflow-hidden group">
                                                <img src={url} alt={`After ${i + 1}`} className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => removeCleanupImage(i)}
                                                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                        {cleanupImages.length < 5 && (
                                            <label className="shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-foreground/20 hover:border-primary/50 cursor-pointer flex items-center justify-center text-foreground/40 hover:text-primary transition-colors">
                                                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePickImages} />
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                            </label>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <p className="text-[11px] text-foreground/50 mb-4 text-center">
                            Tip: frame the SAME area from the same angle.
                        </p>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={closePhotoModal}
                                disabled={actionLoading}
                                className="flex-1 px-4 py-2.5 glass border border-border text-foreground text-sm font-bold rounded-xl hover:bg-foreground/10 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmitPhoto}
                                disabled={cleanupImages.length === 0 || actionLoading}
                                className="flex-1 px-4 py-2.5 eco-gradient text-white text-sm font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                            >
                                {actionLoading ? "Uploading…" : "Submit"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
