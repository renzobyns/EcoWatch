"use client";

import { TrustBadge } from "@/components/TrustBadge";
import { formatDateTime } from "@/lib/date-utils";
import { formatBytes } from "@/lib/format-utils";

export interface PhotoEvidenceDetailProps {
    photo: {
        signals?: Record<string, unknown>;
        ai_confidence: number | null;
        ai_verified: boolean | null;
        trust_score: string | null;
        failing_signals: string[];
        file_size_bytes?: number;
    };
    report: {
        lat: number;
        lon: number;
        created_at: string;
    };
}

function fmt(val: unknown, decimals = 6): string {
    const n = Number(val);
    if (val == null || val === "" || isNaN(n)) return "—";
    return n.toFixed(decimals);
}

function fmtDist(val: unknown): string {
    const n = Number(val);
    if (val == null || isNaN(n)) return "—";
    return `${Math.round(n)} m`;
}

function fmtAge(hours: unknown): string {
    const h = Number(hours);
    if (hours == null || isNaN(h)) return "—";
    if (h < 0) return `${Math.abs(h).toFixed(1)} h in the future`;
    if (h < 1) return `${Math.round(h * 60)} min`;
    if (h < 24) return `${h.toFixed(1)} h`;
    return `${(h / 24).toFixed(1)} days`;
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
    return (
        <div className="flex items-start justify-between gap-3 py-1 border-b border-border/50 last:border-0">
            <span className="text-[10px] text-foreground/40 uppercase tracking-wider shrink-0">{label}</span>
            <span className={`text-[11px] font-mono text-right ${warn ? "text-amber-400" : "text-foreground/80"}`}>{value}</span>
        </div>
    );
}

function CheckRow({ label, pass }: { label: string; pass: boolean }) {
    return (
        <div className={`flex items-center gap-2 text-[11px] ${pass ? "text-foreground/70" : "text-amber-400"}`}>
            <span className={`text-xs font-bold ${pass ? "text-emerald-400" : "text-amber-400"}`}>{pass ? "✓" : "✗"}</span>
            {label}
        </div>
    );
}

export function PhotoEvidenceDetail({ photo, report }: PhotoEvidenceDetailProps) {
    const signals = photo.signals ?? {};
    const failing = photo.failing_signals ?? [];

    if (Object.keys(signals).length === 0) {
        return (
            <div className="mt-2 px-3 py-2 rounded-lg bg-foreground/5 text-[10px] text-foreground/30 text-center">
                Trust details unavailable (verification pending or legacy report)
            </div>
        );
    }

    const softwareTag = String(signals.software_tag ?? "").trim();
    const isInAppCamera = softwareTag.includes("EcoWatch");
    const source = isInAppCamera ? "In-app camera" : "Gallery upload";
    const sourceIcon = isInAppCamera ? "📷" : "⬆";

    const gpsLat = signals.gps_lat;
    const gpsLon = signals.gps_lon;
    const devLat = signals.device_lat;
    const devLon = signals.device_lon;
    const comparedAgainst = String(signals.compared_against ?? "pin");
    const distanceM = signals.gps_distance_m;

    const datetimeOriginal = signals.datetime_original as string | null | undefined;
    const ageHours = signals.datetime_age_hours as number | null | undefined;
    const isFuture = typeof ageHours === "number" && ageHours < 0;

    const hasMake = signals.has_camera_make === true;
    const hasModel = signals.has_camera_model === true;
    const hasEditorTag = failing.some(s => String(s).toLowerCase().startsWith("software:"));

    // Checklist conditions
    const hasGps = gpsLat != null && gpsLon != null;
    const distNum = Number(distanceM);
    const gpsClose = !isNaN(distNum) && distNum <= 100;
    const gpsOk = !isNaN(distNum) && distNum <= 500;
    const isRecent = typeof ageHours === "number" && ageHours >= 0 && ageHours <= 24;
    const hasCameraMetadata = hasMake && hasModel;
    const noEditorTag = !hasEditorTag;

    return (
        <div className="mt-3 rounded-xl border border-border bg-foreground/[0.03] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border bg-foreground/5">
                <div className="flex items-center gap-2">
                    <span className="text-sm">{sourceIcon}</span>
                    <span className="text-[11px] font-semibold text-foreground/80">{source}</span>
                </div>
                <TrustBadge
                    trust_score={photo.trust_score as "high" | "medium" | "low" | null}
                    failing_signals={failing}
                />
            </div>

            <div className="px-3 py-2 space-y-3">
                {/* GPS A vs B */}
                <div>
                    <div className="text-[9px] text-foreground/30 uppercase tracking-widest mb-1">Location (A vs B)</div>
                    <div className="space-y-0">
                        <Row label="A · Photo GPS (EXIF)" value={hasGps ? `${fmt(gpsLat)}, ${fmt(gpsLon)}` : "—"} />
                        {devLat != null ? (
                            <Row label={`B · Device GPS (${comparedAgainst})`} value={`${fmt(devLat)}, ${fmt(devLon)}`} />
                        ) : (
                            <Row label="B · Device GPS" value="—" />
                        )}
                        <Row label="Submitted pin" value={`${fmt(report.lat)}, ${fmt(report.lon)}`} />
                        <Row
                            label={`Distance A↔B (vs ${comparedAgainst})`}
                            value={distanceM != null ? fmtDist(distanceM) : "—"}
                            warn={!isNaN(distNum) && distNum > 100}
                        />
                    </div>
                </div>

                {/* Time */}
                <div>
                    <div className="text-[9px] text-foreground/30 uppercase tracking-widest mb-1">Time</div>
                    <div className="space-y-0">
                        <Row
                            label="Photo taken"
                            value={datetimeOriginal ? formatDateTime(datetimeOriginal) : "—"}
                        />
                        <Row label="Report submitted" value={formatDateTime(report.created_at)} />
                        <Row label="Age" value={fmtAge(ageHours)} warn={isFuture} />
                        {photo.file_size_bytes != null && (
                            <Row label="File Size" value={formatBytes(photo.file_size_bytes)} />
                        )}
                    </div>
                </div>

                {/* Metadata */}
                <div>
                    <div className="text-[9px] text-foreground/30 uppercase tracking-widest mb-1">Metadata</div>
                    <div className="space-y-0">
                        <Row label="Camera make / model" value={hasCameraMetadata ? "✓ present" : !hasMake && !hasModel ? "✗ missing" : "⚠ partial"} warn={!hasCameraMetadata} />
                        <Row label="Software tag" value={softwareTag || "(none)"} warn={hasEditorTag} />
                    </div>
                </div>

                {/* AI */}
                <div>
                    <div className="text-[9px] text-foreground/30 uppercase tracking-widest mb-1">AI Verification</div>
                    <div className="space-y-0">
                        <Row
                            label="Confidence"
                            value={photo.ai_confidence != null ? `${(photo.ai_confidence * 100).toFixed(1)}%` : "—"}
                        />
                        <Row
                            label="Result"
                            value={photo.ai_verified === true ? "✓ verified" : photo.ai_verified === false ? "✗ rejected" : "—"}
                            warn={photo.ai_verified === false}
                        />
                    </div>
                </div>

                {/* Why this tier checklist */}
                <div>
                    <div className="text-[9px] text-foreground/30 uppercase tracking-widest mb-1.5">Why this tier</div>
                    <div className="space-y-1">
                        {isInAppCamera && <CheckRow label="Live in-app camera" pass={true} />}
                        <CheckRow label="Photo GPS present" pass={hasGps} />
                        {hasGps && (
                            <CheckRow
                                label={gpsClose ? `A↔B within 100 m (${fmtDist(distanceM)})` : gpsOk ? `A↔B within 500 m (${fmtDist(distanceM)})` : `A↔B is ${fmtDist(distanceM)} — outside 500 m`}
                                pass={gpsOk}
                            />
                        )}
                        <CheckRow label={isRecent ? `Photo is recent (${fmtAge(ageHours)})` : isFuture ? `Photo is future-dated (${fmtAge(ageHours)})` : `Photo age: ${fmtAge(ageHours)}`} pass={isRecent} />
                        <CheckRow label="Camera make/model present" pass={hasCameraMetadata} />
                        <CheckRow label="No editor/AI software tag" pass={noEditorTag} />
                    </div>
                </div>
            </div>
        </div>
    );
}
