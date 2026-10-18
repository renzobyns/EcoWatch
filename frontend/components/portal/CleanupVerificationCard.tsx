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
} from "lucide-react";

export interface CleanupVerificationData {
    verdict: "PASS" | "REVIEW" | "RETAKE" | "REJECT" | string;
    phase?: string;
    reason?: string;
    requires_retake?: boolean;
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
        };
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
    actionLoading?: boolean;
}

export default function CleanupVerificationCard({
    rawResult,
    guideUsed,
    gpsDistanceM,
    vlmRaw,
    userRole,
    onForceApprove,
    onRequestRetake,
    actionLoading = false,
}: CleanupVerificationCardProps) {
    const [expanded, setExpanded] = useState(false);
    const [overrideOpen, setOverrideOpen] = useState(false);
    const [overrideAction, setOverrideAction] = useState<"approve" | "retake">("approve");
    const [overrideReason, setOverrideReason] = useState("");

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

    let parsedVlm: Record<string, unknown> | null = null;
    if (vlmRaw) {
        try {
            parsedVlm = typeof vlmRaw === "string" ? JSON.parse(vlmRaw) : vlmRaw;
        } catch {
            parsedVlm = null;
        }
    }

    const verdict = parsed.verdict?.toUpperCase() ?? "REVIEW";
    const details = parsed.details ?? {};
    const effectiveGuideUsed = guideUsed ?? details.guide_used ?? true;
    const effectiveDistance = gpsDistanceM ?? details.gps_distance_m;

    const verdictConfig = {
        PASS: {
            pill: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
            icon: <CheckCircle2 size={16} className="text-emerald-500" />,
            title: "Cleanup Verified",
            description: parsed.reason || "Positive proof confirmed: matching site landmarks, waste removed, clear photo.",
        },
        REVIEW: {
            pill: "bg-amber-500/15 text-amber-500 border-amber-500/30",
            icon: <AlertTriangle size={16} className="text-amber-500" />,
            title: "Supervisor Review Required",
            description: parsed.reason || "Borderline alignment or low AI confidence. Requires manual supervisor inspection.",
        },
        RETAKE: {
            pill: "bg-orange-500/15 text-orange-500 border-orange-500/30",
            icon: <RotateCcw size={16} className="text-orange-500" />,
            title: "Photo Retake Requested",
            description: parsed.reason || "Image quality check failed (covered lens, blur, or extreme darkness).",
        },
        REJECT: {
            pill: "bg-red-500/15 text-red-500 border-red-500/30",
            icon: <XCircle size={16} className="text-red-500" />,
            title: "Cleanup Proof Rejected",
            description: parsed.reason || "Waste still remains or photo does not match the original reported location.",
        },
    }[verdict] || {
        pill: "bg-foreground/10 text-foreground border-border",
        icon: <ShieldAlert size={16} />,
        title: `Verdict: ${verdict}`,
        description: parsed.reason || "Verification finished.",
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
                    <div className="mt-0.5 shrink-0">{verdictConfig.icon}</div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-foreground text-sm tracking-tight">
                                {verdictConfig.title}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${verdictConfig.pill}`}>
                                {verdict}
                            </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                            {verdictConfig.description}
                        </p>
                    </div>
                </div>
            </div>

            {/* Quick Metrics Strip */}
            <div className="grid grid-cols-3 divide-x divide-border border-b border-border text-center py-2 bg-foreground/[0.01]">
                <div className="px-2">
                    <div className="text-[10px] text-muted-foreground">Landmarks (SIFT)</div>
                    <div className="font-bold text-foreground mt-0.5 flex items-center justify-center gap-1">
                        <Scan size={11} className="text-primary" />
                        <span>{details.inliers !== undefined ? `${details.inliers} inliers` : "N/A"}</span>
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
                    <div className="text-[10px] text-muted-foreground">Waste Volume</div>
                    <div className="font-bold text-foreground mt-0.5 flex items-center justify-center gap-1">
                        <Sparkles size={11} className="text-emerald-500" />
                        <span>
                            {details.remaining_ratio !== undefined
                                ? details.remaining_ratio <= 0.05
                                    ? "Clean (0%)"
                                    : `${Math.round(details.remaining_ratio * 100)}% left`
                                : "Evaluated"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Expandable Phase Inspection */}
            <div className="px-3.5 py-2.5">
                <button
                    type="button"
                    onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center justify-between py-1 text-muted-foreground hover:text-foreground font-semibold text-[11px] transition-colors"
                >
                    <span className="flex items-center gap-1.5">
                        <ShieldCheck size={13} className="text-primary" />
                        Multi-Phase Anti-Fraud Breakdown
                    </span>
                    {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {expanded && (
                    <div className="mt-2.5 space-y-2 pt-2 border-t border-border">
                        {/* Phase A: Quality */}
                        <div className="p-2.5 rounded-lg bg-foreground/5 flex flex-col gap-1">
                            <div className="flex items-center justify-between font-semibold text-[11px] text-foreground">
                                <span className="flex items-center gap-1.5">
                                    <Camera size={12} className="text-primary" />
                                    Phase A: Photo Quality & Anti-Cover
                                </span>
                                <span className={details.quality?.reasons?.length ? "text-red-400 font-bold" : "text-emerald-500 font-bold"}>
                                    {details.quality?.reasons?.length ? "Failed" : "Passed"}
                                </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground grid grid-cols-2 gap-1 mt-1">
                                <div>Sharpness / Var: <span className="font-mono text-foreground">{details.quality?.blur_var !== undefined ? Math.round(details.quality.blur_var) : "N/A"}</span></div>
                                <div>Brightness: <span className="font-mono text-foreground">{details.quality?.brightness !== undefined ? Math.round(details.quality.brightness) : "N/A"}</span></div>
                                <div>Contrast: <span className="font-mono text-foreground">{details.quality?.contrast !== undefined ? Math.round(details.quality.contrast) : "N/A"}</span></div>
                                <div>Entropy: <span className="font-mono text-foreground">{details.quality?.entropy !== undefined ? Number(details.quality.entropy).toFixed(2) : "N/A"}</span></div>
                            </div>
                        </div>

                        {/* Phase B: Proximity & Site Stamping */}
                        <div className="p-2.5 rounded-lg bg-foreground/5 flex flex-col gap-1">
                            <div className="flex items-center justify-between font-semibold text-[11px] text-foreground">
                                <span className="flex items-center gap-1.5">
                                    <MapPin size={12} className="text-primary" />
                                    Phase B: GPS Proximity & Cam Session
                                </span>
                                <span className="text-foreground font-mono">
                                    {effectiveDistance != null ? `${Math.round(effectiveDistance)}m from site` : "Coordinated"}
                                </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                Cam overlay was {effectiveGuideUsed ? "active (ghost guide matched)" : "manually turned off by cleaner"}.
                            </p>
                        </div>

                        {/* Phase C: SIFT Landmarks */}
                        <div className="p-2.5 rounded-lg bg-foreground/5 flex flex-col gap-1">
                            <div className="flex items-center justify-between font-semibold text-[11px] text-foreground">
                                <span className="flex items-center gap-1.5">
                                    <Compass size={12} className="text-primary" />
                                    Phase C: Homography & SIFT Landmarks
                                </span>
                                <span className={details.inliers && details.inliers >= 15 ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>
                                    {details.inliers !== undefined ? `${details.inliers} Inliers` : "Checked"}
                                </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                Matches static physical landmarks (walls, curbs, fences) excluding garbage zone.
                            </p>
                        </div>

                        {/* Phase D & E: Waste & VLM */}
                        {(parsedVlm || details.vlm) && (
                            <div className="p-2.5 rounded-lg bg-foreground/5 flex flex-col gap-1">
                                <div className="flex items-center justify-between font-semibold text-[11px] text-foreground">
                                    <span className="flex items-center gap-1.5">
                                        <Sparkles size={12} className="text-primary" />
                                        Phase E: Gemini VLM Scene Judge
                                    </span>
                                    <span className="text-primary font-bold">
                                        {String((parsedVlm?.confidence || details.vlm?.confidence || "Normal")).toUpperCase()}
                                    </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5 italic">
                                    &ldquo;{String(parsedVlm?.remarks || details.vlm?.remarks || "Scene compared successfully.")}&rdquo;
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

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
                                    Override & Approve Cleanup
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
        </div>
    );
}
