"use client";

import React, { useState } from "react";
import {
    ShieldCheck,
    ShieldAlert,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Camera,
    Compass,
    Sparkles,
    MapPin,
    RotateCcw,
    ChevronDown,
    ChevronUp,
    Scan,
    FileCheck2,
    Eye,
    Maximize2,
    UserCheck,
} from "lucide-react";

export interface CleanupLayerResult {
    layer: "layer_1_integrity" | "layer_2_location" | "layer_3_mrcnn" | "layer_4_vlm" | string;
    name: string;
    status: "passed" | "failed" | "skipped" | "uncertain" | string;
    reason_code?: string;
    summary?: string;
    metrics?: {
        gps_distance_m?: number | null;
        blur_score?: number | null;
        mean_brightness?: number | null;
        contrast?: number | null;
        inliers?: number | null;
        inlier_ratio?: number | null;
        [key: string]: unknown;
    };
    maskrcnn?: {
        waste_detected?: boolean;
        confidence?: number;
        remaining_ratio_pct?: number;
        detections_count?: number;
        annotated_image_url?: string | null;
    };
    vlm?: {
        cleaned?: boolean;
        confidence?: string;
        description?: string;
        internal_reasoning?: string;
    };
}

export interface CleanupVerificationData {
    verdict: "PASS" | "REVIEW" | "RETAKE" | "REJECT" | string;
    final_status?: "approved" | "rejected" | "needs_review" | string;
    decided_by?: string;
    reason_code?: string;
    summary_message?: string;
    reason?: string;
    phase?: string;
    requires_retake?: boolean;
    attempt_count?: number;
    max_attempts?: number;
    override?: {
        override_by_id?: number;
        override_by_name?: string;
        override_role?: string;
        override_status?: string;
        remarks?: string;
        timestamp?: string;
    };
    layers?: CleanupLayerResult[];
    details?: {
        inliers?: number;
        remaining_ratio?: number;
        quality?: {
            brightness?: number;
            blur_var?: number;
            contrast?: number;
            entropy?: number;
            resolution?: [number, number];
            reasons?: string[];
        };
        guide_used?: boolean;
        gps_distance_m?: number;
        vlm?: {
            cleaned?: boolean;
            same_location?: boolean;
            confidence?: string;
            remarks?: string;
            description?: string;
            internal_reasoning?: string;
        };
        annotated_image_url?: string | null;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

interface CleanupVerificationCardProps {
    rawResult: string | CleanupVerificationData | null | undefined;
    guideUsed?: boolean | null;
    gpsDistanceM?: number | null;
    vlmRaw?: string | null;
    userRole?: "citizen" | "barangay" | "cenro" | "cleaner";
    onForceApprove?: (reason: string) => Promise<void>;
    onRequestRetake?: (reason: string) => Promise<void>;
    onRetakeNow?: () => void;
    actionLoading?: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://renzobyns-ecowatch-backend.hf.space";

function getAssetUrl(url: string | null | undefined): string {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export default function CleanupVerificationCard({
    rawResult,
    guideUsed,
    gpsDistanceM,
    vlmRaw,
    userRole = "cleaner",
    onForceApprove,
    onRequestRetake,
    onRetakeNow,
    actionLoading = false,
}: CleanupVerificationCardProps) {
    const [expanded, setExpanded] = useState(false);
    const [overrideOpen, setOverrideOpen] = useState(false);
    const [overrideAction, setOverrideAction] = useState<"approve" | "retake">("approve");
    const [overrideReason, setOverrideReason] = useState("");
    const [maskLightbox, setMaskLightbox] = useState<string | null>(null);

    if (!rawResult) {
        return (
            <div className="p-3 rounded-xl border border-dashed border-border bg-foreground/[0.02] text-xs text-muted-foreground flex items-center gap-2">
                <Scan size={14} className="text-muted-foreground/60 shrink-0" />
                <span>No anti-fraud verification result recorded yet.</span>
            </div>
        );
    }

    let parsed: CleanupVerificationData;
    try {
        parsed = typeof rawResult === "string" ? JSON.parse(rawResult) : rawResult;
    } catch {
        return (
            <div className="p-3 rounded-xl border border-border bg-card text-xs text-foreground">
                <div className="font-semibold mb-1">Verification Raw Data</div>
                <pre className="text-[10px] text-muted-foreground overflow-x-auto">{String(rawResult)}</pre>
            </div>
        );
    }

    const fallbackVlm = vlmRaw ? (() => {
        try {
            return typeof vlmRaw === "string" ? JSON.parse(vlmRaw) : (vlmRaw as unknown as Record<string, unknown>);
        } catch {
            return null;
        }
    })() : null;

    const verdict = (parsed.verdict || "REVIEW").toUpperCase();
    const finalStatus = parsed.final_status || (verdict === "PASS" ? "approved" : verdict === "REVIEW" ? "needs_review" : "rejected");
    const details = parsed.details ?? {};
    const effectiveGuideUsed = guideUsed ?? details.guide_used ?? true;
    const effectiveDistance = gpsDistanceM ?? details.gps_distance_m;
    const isOverride = parsed.decided_by === "manual_override" || Boolean(parsed.override);

    // Annotated mask URL resolution
    const maskUrl = details.annotated_image_url ||
        parsed.layers?.find((l) => l.layer === "layer_3_mrcnn")?.maskrcnn?.annotated_image_url;

    // Decided by human label
    const decidedByLabel = (() => {
        switch (parsed.decided_by) {
            case "manual_override":
                return `Manual Override (${parsed.override?.override_role?.toUpperCase() || "Supervisor"})`;
            case "layer_1_integrity":
                return "Photo & Site Integrity Gate";
            case "layer_2_location":
                return "AI Landmark Alignment (SIFT)";
            case "layer_3_mrcnn":
                return "Waste Detection (Mask R-CNN)";
            case "layer_4_vlm":
                return "Visual Scene Comparison (Gemini Flash)";
            case "max_attempts_exceeded":
                return "Safety Escalation (3 Attempts Reached)";
            case "all_passed":
                return "All AI & Sensor Checks";
            default:
                return parsed.decided_by || "AI Verification Pipeline";
        }
    })();

    const verdictConfig = {
        PASS: {
            pill: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
            icon: <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />,
            title: isOverride ? "Manually Approved Cleanup" : "Cleanup Verified",
            description: parsed.summary_message || parsed.reason || "Positive proof confirmed: matching site landmarks, waste removed, clear photo.",
        },
        REVIEW: {
            pill: "bg-amber-500/15 text-amber-500 border-amber-500/30",
            icon: <AlertTriangle size={16} className="text-amber-500 shrink-0" />,
            title: "Supervisor Review Required",
            description: parsed.summary_message || parsed.reason || "Borderline alignment or low AI confidence. Requires manual supervisor inspection.",
        },
        RETAKE: {
            pill: "bg-orange-500/15 text-orange-500 border-orange-500/30",
            icon: <RotateCcw size={16} className="text-orange-500 shrink-0" />,
            title: "Photo Retake Requested",
            description: parsed.summary_message || parsed.reason || "Image quality check failed (covered lens, blur, or extreme darkness).",
        },
        REJECT: {
            pill: "bg-red-500/15 text-red-500 border-red-500/30",
            icon: <XCircle size={16} className="text-red-500 shrink-0" />,
            title: "Cleanup Proof Needs Redo",
            description: parsed.summary_message || parsed.reason || "Waste still remains or photo does not match the original reported location.",
        },
    }[verdict] || {
        pill: "bg-foreground/10 text-foreground border-border",
        icon: <ShieldAlert size={16} className="shrink-0" />,
        title: `Verdict: ${verdict}`,
        description: parsed.summary_message || parsed.reason || "Verification finished.",
    };

    const handleActionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (overrideReason.trim().length < 8) return;
        if (overrideAction === "approve" && onForceApprove) {
            await onForceApprove(overrideReason.trim());
            setOverrideOpen(false);
            setOverrideReason("");
        } else if (overrideAction === "retake" && onRequestRetake) {
            await onRequestRetake(overrideReason.trim());
            setOverrideOpen(false);
            setOverrideReason("");
        }
    };

    return (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden text-xs">
            {/* Header Badge */}
            <div className="p-3.5 flex items-start justify-between gap-3 bg-foreground/[0.02] border-b border-border/70">
                <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5">{verdictConfig.icon}</div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-foreground text-sm tracking-tight">
                                {verdictConfig.title}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${verdictConfig.pill}`}>
                                {finalStatus}
                            </span>
                            {parsed.attempt_count && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-muted text-muted-foreground border border-border">
                                    Attempt {parsed.attempt_count}/{parsed.max_attempts || 3}
                                </span>
                            )}
                        </div>
                        <div className="text-[11px] font-medium text-primary/90 mt-1 flex items-center gap-1">
                            <span>Decided by:</span>
                            <span className="font-semibold text-foreground">{decidedByLabel}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                            {verdictConfig.description}
                        </p>
                    </div>
                </div>
            </div>

            {/* Override Audit Banner (if manual override was performed) */}
            {parsed.override && (
                <div className="px-3.5 py-2.5 bg-purple-500/10 border-b border-purple-500/20 text-purple-700 dark:text-purple-300 flex items-start gap-2">
                    <UserCheck size={14} className="mt-0.5 shrink-0" />
                    <div className="min-w-0 text-[11px]">
                        <span className="font-bold">
                            Supervisor Override by {parsed.override.override_by_name || "Admin"} ({parsed.override.override_role?.toUpperCase()}):
                        </span>{" "}
                        <span>&ldquo;{parsed.override.remarks}&rdquo;</span>
                    </div>
                </div>
            )}

            {/* Quick Metrics Strip */}
            <div className="grid grid-cols-3 divide-x divide-border border-b border-border text-center py-2 bg-foreground/[0.01]">
                <div className="px-2">
                    <div className="text-[10px] text-muted-foreground">Landmarks (SIFT)</div>
                    <div className="font-bold text-foreground mt-0.5 flex items-center justify-center gap-1">
                        <Scan size={11} className="text-primary" />
                        <span>{details.inliers !== undefined ? `${details.inliers} inliers` : "Verified"}</span>
                    </div>
                </div>
                <div className="px-2">
                    <div className="text-[10px] text-muted-foreground">Ghost Guide</div>
                    <div className="font-bold mt-0.5 flex items-center justify-center gap-1">
                        <Camera size={11} className={effectiveGuideUsed ? "text-emerald-500" : "text-amber-500"} />
                        <span className={effectiveGuideUsed ? "text-emerald-500" : "text-amber-500"}>
                            {effectiveGuideUsed ? "Used (ON)" : "Disabled (OFF)"}
                        </span>
                    </div>
                </div>
                <div className="px-2">
                    <div className="text-[10px] text-muted-foreground">Remaining Waste</div>
                    <div className="font-bold text-foreground mt-0.5 flex items-center justify-center gap-1">
                        <Sparkles size={11} className="text-emerald-500" />
                        <span>
                            {parsed.layers?.find((l) => l.layer === "layer_3_mrcnn")?.status === "bypassed"
                                ? "VLM Scene Check"
                                : details.remaining_ratio !== undefined
                                    ? details.remaining_ratio <= 0.05
                                        ? "Clean (0%)"
                                        : `${Math.round(details.remaining_ratio * 100)}% left`
                                    : "Clean"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Mask R-CNN Annotated Image Callout (if trash detected) */}
            {maskUrl && (
                <div className="px-3.5 py-2.5 bg-amber-500/5 border-b border-border flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <Eye size={14} className="text-amber-500 shrink-0" />
                        <span className="text-[11px] text-foreground font-medium truncate">
                            Mask R-CNN highlighted remaining waste in this photo
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setMaskLightbox(getAssetUrl(maskUrl))}
                        className="shrink-0 px-2.5 py-1 rounded-md bg-background border border-border hover:bg-muted text-[11px] font-semibold text-foreground flex items-center gap-1 transition-colors"
                    >
                        <Maximize2 size={11} />
                        View Highlight
                    </button>
                </div>
            )}

            {/* Expandable Layer Breakdown */}
            <div className="px-3.5 py-2.5">
                <button
                    type="button"
                    onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center justify-between py-1 text-muted-foreground hover:text-foreground font-semibold text-[11px] transition-colors"
                >
                    <span className="flex items-center gap-1.5">
                        <ShieldCheck size={13} className="text-primary" />
                        Multi-Layer Verification Breakdown
                    </span>
                    {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {expanded && (
                    <div className="mt-2.5 space-y-2 pt-2 border-t border-border">
                        {/* If layers array is available from new MC-006 backend */}
                        {parsed.layers && parsed.layers.length > 0 ? (
                            parsed.layers.map((layer) => {
                                const isPassed = layer.status === "passed";
                                const isFailed = layer.status === "failed";
                                const isBypassed = layer.status === "bypassed";

                                return (
                                    <div
                                        key={layer.layer}
                                        className={`p-2.5 rounded-lg border ${
                                            isFailed
                                                ? "bg-red-500/5 border-red-500/20"
                                                : isBypassed
                                                    ? "bg-amber-500/5 border-amber-500/20"
                                                    : isPassed
                                                        ? "bg-emerald-500/5 border-emerald-500/20"
                                                        : "bg-foreground/5 border-border"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between font-semibold text-[11px]">
                                            <span className="flex items-center gap-1.5 text-foreground">
                                                {layer.layer === "layer_1_integrity" && <Camera size={12} className="text-primary" />}
                                                {layer.layer === "layer_2_location" && <Compass size={12} className="text-primary" />}
                                                {layer.layer === "layer_3_mrcnn" && <Scan size={12} className="text-primary" />}
                                                {layer.layer === "layer_4_vlm" && <Sparkles size={12} className="text-primary" />}
                                                {layer.name}
                                            </span>
                                            <span
                                                className={`text-[10px] font-bold uppercase ${
                                                    isFailed
                                                        ? "text-red-500"
                                                        : isBypassed
                                                            ? "text-amber-500"
                                                            : isPassed
                                                                ? "text-emerald-500"
                                                                : "text-muted-foreground"
                                                }`}
                                            >
                                                {isBypassed ? "Temporarily Off" : layer.status}
                                            </span>
                                        </div>

                                        {layer.summary && (
                                            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                                                {layer.summary}
                                            </p>
                                        )}

                                        {/* Mask R-CNN details */}
                                        {layer.maskrcnn && (
                                            <div className="mt-1.5 pt-1.5 border-t border-border/50 text-[10px] text-muted-foreground flex gap-3 flex-wrap">
                                                <span>Confidence: <strong className="text-foreground">{Math.round((layer.maskrcnn.confidence || 0) * 100)}%</strong></span>
                                                <span>Remaining volume: <strong className="text-foreground">{layer.maskrcnn.remaining_ratio_pct || 0}%</strong></span>
                                                {layer.maskrcnn.detections_count !== undefined && (
                                                    <span>Detections: <strong className="text-foreground">{layer.maskrcnn.detections_count}</strong></span>
                                                )}
                                            </div>
                                        )}

                                        {/* VLM details */}
                                        {layer.vlm && (
                                            <div className="mt-1.5 pt-1.5 border-t border-border/50 text-[10px] text-muted-foreground space-y-1">
                                                <div className="italic">&ldquo;{layer.vlm.description || "Scene verified"}&rdquo;</div>
                                                {userRole === "cenro" && layer.vlm.internal_reasoning && (
                                                    <div className="font-mono text-[9px] text-primary/80 bg-primary/5 p-1 rounded">
                                                        Internal Reasoning: {layer.vlm.internal_reasoning}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Technical metrics (CENRO role only) */}
                                        {userRole === "cenro" && layer.metrics && (
                                            <div className="mt-1 pt-1 text-[9px] font-mono text-muted-foreground grid grid-cols-2 gap-1 border-t border-border/30">
                                                {Object.entries(layer.metrics).map(([k, v]) => v != null && (
                                                    <div key={k}>{k}: <span className="text-foreground font-semibold">{String(v)}</span></div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            /* Fallback to legacy phase cards */
                            <>
                                <div className="p-2.5 rounded-lg bg-foreground/5 flex flex-col gap-1">
                                    <div className="flex items-center justify-between font-semibold text-[11px] text-foreground">
                                        <span className="flex items-center gap-1.5">
                                            <Camera size={12} className="text-primary" />
                                            Phase A: Photo Quality &amp; Anti-Cover
                                        </span>
                                        <span className={details.quality?.reasons?.length ? "text-red-400 font-bold" : "text-emerald-500 font-bold"}>
                                            {details.quality?.reasons?.length ? "Failed" : "Passed"}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-2.5 rounded-lg bg-foreground/5 flex flex-col gap-1">
                                    <div className="flex items-center justify-between font-semibold text-[11px] text-foreground">
                                        <span className="flex items-center gap-1.5">
                                            <MapPin size={12} className="text-primary" />
                                            Phase B: GPS Proximity &amp; Cam Session
                                        </span>
                                        <span className="text-foreground font-mono">
                                            {effectiveDistance != null ? `${Math.round(effectiveDistance)}m from site` : "Coordinated"}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-2.5 rounded-lg bg-foreground/5 flex flex-col gap-1">
                                    <div className="flex items-center justify-between font-semibold text-[11px] text-foreground">
                                        <span className="flex items-center gap-1.5">
                                            <Compass size={12} className="text-primary" />
                                            Phase C: Homography &amp; SIFT Landmarks
                                        </span>
                                        <span className={details.inliers && details.inliers >= 15 ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>
                                            {details.inliers !== undefined ? `${details.inliers} Inliers` : "Checked"}
                                        </span>
                                    </div>
                                </div>
                                {(details.vlm || fallbackVlm) && (
                                    <div className="p-2.5 rounded-lg bg-foreground/5 flex flex-col gap-1">
                                        <div className="flex items-center justify-between font-semibold text-[11px] text-foreground">
                                            <span className="flex items-center gap-1.5">
                                                <Sparkles size={12} className="text-primary" />
                                                Phase D: Gemini VLM Scene Judge
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-0.5 italic">
                                            &ldquo;{String(details.vlm?.description || details.vlm?.remarks || fallbackVlm?.remarks || fallbackVlm?.description || "Scene verified")}&rdquo;
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Cleaner Direct Action: Retake button when failed */}
            {userRole === "cleaner" && (parsed.requires_retake || verdict === "RETAKE" || verdict === "REJECT") && onRetakeNow && (
                <div className="p-3 bg-red-500/5 border-t border-border flex items-center justify-between gap-3">
                    <span className="text-[11px] text-muted-foreground font-medium">
                        Retake required to complete resolution.
                    </span>
                    <button
                        type="button"
                        onClick={onRetakeNow}
                        disabled={actionLoading}
                        className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                        <RotateCcw size={13} />
                        Retake Photo Now
                    </button>
                </div>
            )}

            {/* Supervisor Action Bar (CENRO / Barangay only) */}
            {(userRole === "cenro" || userRole === "barangay") && (onForceApprove || onRequestRetake) && (
                <div className="p-3 bg-foreground/[0.03] border-t border-border flex flex-col gap-2">
                    {!overrideOpen ? (
                        <div className="flex items-center gap-2">
                            {onForceApprove && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOverrideAction("approve");
                                        setOverrideOpen(true);
                                    }}
                                    className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                    <FileCheck2 size={13} />
                                    Override &amp; Approve Cleanup
                                </button>
                            )}
                            {onRequestRetake && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOverrideAction("retake");
                                        setOverrideOpen(true);
                                    }}
                                    className="py-1.5 px-3 rounded-lg bg-foreground/10 hover:bg-foreground/15 text-foreground font-semibold text-[11px] transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <RotateCcw size={13} />
                                    Request Retake
                                </button>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleActionSubmit} className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-[11px] text-foreground">
                                    {overrideAction === "approve" ? "Supervisor Override: Force Approve" : "Request Cleaner Retake"}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setOverrideOpen(false)}
                                    className="text-[10px] text-muted-foreground hover:text-foreground"
                                >
                                    Cancel
                                </button>
                            </div>
                            <input
                                type="text"
                                placeholder={overrideAction === "approve" ? "Reason for override (min 8 chars)..." : "Reason why photo must be retaken..."}
                                value={overrideReason}
                                onChange={(e) => setOverrideReason(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                autoFocus
                            />
                            <div className="flex items-center gap-2 justify-end">
                                <button
                                    type="button"
                                    onClick={() => setOverrideOpen(false)}
                                    className="px-2.5 py-1 rounded-md text-[11px] text-muted-foreground hover:text-foreground"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={overrideReason.trim().length < 8 || actionLoading}
                                    className={`px-3 py-1 rounded-md text-[11px] font-bold text-white transition-opacity disabled:opacity-50 ${
                                        overrideAction === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
                                    }`}
                                >
                                    {actionLoading ? "Submitting..." : "Confirm & Save"}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}

            {/* Mask Lightbox Modal */}
            {maskLightbox && (
                <div
                    className="fixed inset-0 z-[2200] bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setMaskLightbox(null)}
                >
                    <div className="relative max-w-2xl max-h-[85vh] bg-card rounded-xl border border-border overflow-hidden p-2 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-2 pt-1">
                            <span className="text-xs font-bold text-foreground">Mask R-CNN Detection Mask</span>
                            <button
                                type="button"
                                onClick={() => setMaskLightbox(null)}
                                className="text-xs text-muted-foreground hover:text-foreground"
                            >
                                Close
                            </button>
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={maskLightbox}
                            alt="Mask R-CNN remaining waste detection overlay"
                            className="max-h-[70vh] object-contain rounded-lg border border-border"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
