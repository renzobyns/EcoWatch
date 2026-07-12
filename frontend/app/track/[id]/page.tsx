"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

const MiniMap = dynamic(() => import("@/components/MiniMap"), { ssr: false });
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const STATUS_STEPS = ["pending", "verified", "assigned", "in_progress", "resolved"];

const STATUS_COLORS: Record<string, { text: string, bg: string, bgLight: string, glow: string }> = {
    pending: { text: 'text-amber-500', bg: 'bg-amber-500', bgLight: 'bg-amber-500/10', glow: 'shadow-[0_0_15px_rgba(245,158,11,0.5)]' },
    verified: { text: 'text-primary', bg: 'bg-primary', bgLight: 'bg-primary/10', glow: 'shadow-[0_0_15px_rgba(16,185,129,0.5)]' },
    assigned: { text: 'text-blue-500', bg: 'bg-blue-500', bgLight: 'bg-blue-500/10', glow: 'shadow-[0_0_15px_rgba(59,130,246,0.5)]' },
    in_progress: { text: 'text-purple-500', bg: 'bg-purple-500', bgLight: 'bg-purple-500/10', glow: 'shadow-[0_0_15px_rgba(168,85,247,0.5)]' },
    resolved: { text: 'text-green-500', bg: 'bg-green-500', bgLight: 'bg-green-500/10', glow: 'shadow-[0_0_15px_rgba(34,197,94,0.5)]' },
    rejected: { text: 'text-red-500', bg: 'bg-red-500', bgLight: 'bg-red-500/10', glow: 'shadow-[0_0_15px_rgba(239,68,68,0.5)]' },
    failed_cleanup: { text: 'text-red-500', bg: 'bg-red-500', bgLight: 'bg-red-500/10', glow: 'shadow-[0_0_15px_rgba(239,68,68,0.5)]' },
};

export default function TrackReportPage() {
    const params = useParams();
    const trackingId = params.id as string;
    
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAiMask, setShowAiMask] = useState(false);
    const [selectedPhotoIdx, setSelectedPhotoIdx] = useState(0);
    const [mapExpanded, setMapExpanded] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [activeMobileLabel, setActiveMobileLabel] = useState<number | null>(null);

    function selectPhoto(idx: number) {
        setSelectedPhotoIdx(idx);
        setShowAiMask(false);
    }

    useEffect(() => {
        let cancelled = false;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        const fetchReport = async () => {
            try {
                const res = await fetch(`${API_URL}/report/track/${trackingId}`);
                if (!res.ok) {
                    throw new Error(res.status === 404 ? "Report not found" : "Server error");
                }
                const data = await res.json();
                if (cancelled) return;
                setReport(data);
                setError(null);
                // Poll while AI verification is still running in the background.
                if (data?.verification_pending) {
                    timeoutId = setTimeout(fetchReport, 3000);
                }
            } catch (err: any) {
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchReport();
        return () => {
            cancelled = true;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [trackingId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background pt-4 pb-8 px-4 flex flex-col items-center">
                <div className="w-full max-w-2xl">
                    <div className="flex items-center justify-between mb-6 opacity-50">
                        <div className="w-24 h-4 bg-foreground/10 rounded animate-pulse" />
                        <div className="w-32 h-6 bg-foreground/10 rounded animate-pulse" />
                    </div>
                    <div className="w-full glass rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col gap-6 p-6">
                        <div className="w-full h-24 bg-foreground/5 animate-pulse rounded-xl" />
                        <div className="w-full h-16 bg-foreground/5 animate-pulse rounded-xl" />
                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="flex flex-col gap-4">
                                <div className="w-32 h-4 bg-foreground/10 rounded animate-pulse" />
                                <div className="w-full aspect-square bg-foreground/5 animate-pulse rounded-2xl" />
                            </div>
                            <div className="flex flex-col gap-6">
                                <div className="space-y-2">
                                    <div className="w-24 h-3 bg-foreground/10 rounded animate-pulse" />
                                    <div className="w-48 h-6 bg-foreground/5 animate-pulse rounded" />
                                </div>
                                <div className="space-y-2">
                                    <div className="w-24 h-3 bg-foreground/10 rounded animate-pulse" />
                                    <div className="w-36 h-6 bg-foreground/5 animate-pulse rounded" />
                                </div>
                                <div className="space-y-2">
                                    <div className="w-24 h-3 bg-foreground/10 rounded animate-pulse" />
                                    <div className="w-full h-16 bg-foreground/5 animate-pulse rounded-xl" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !report) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
                <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Report Not Found</h1>
                <p className="text-foreground/60 mb-8 max-w-md">
                    We couldn't find a report with tracking ID "{trackingId}". It may have been rejected by the AI or the ID is incorrect.
                </p>
                <Link href="/" className="h-11 px-7 inline-flex items-center eco-gradient text-white text-sm font-semibold rounded-lg">Return Home</Link>
            </div>
        );
    }

    // Determine progress
    const isRejected = report.status === "rejected";
    const isFailed = report.status === "failed_cleanup";
    let currentStepIndex = STATUS_STEPS.indexOf(report.status);
    
    // Fallbacks for edge cases
    if (isRejected) currentStepIndex = -1;
    if (isFailed) currentStepIndex = 3; // in_progress step, but failed resolving

    return (
        <div className="min-h-screen bg-background pt-4 pb-8 px-4 flex flex-col items-center">
            <div className="w-full max-w-2xl">

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <Link href="/" className="text-foreground/80 hover:text-primary transition-colors flex items-center gap-2 text-sm font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                        Back to Map
                    </Link>
                    <div className="text-right">
                        <div className="text-[11px] font-semibold text-foreground/50 uppercase tracking-widest">Tracking ID</div>
                        <div className="text-base font-semibold text-primary">{report.tracking_id}</div>
                    </div>
                </div>

                {/* Main Card */}
                <div className="glass rounded-2xl border border-border shadow-2xl overflow-hidden mb-8">
                    {/* Status Banner */}
                    <div className={`p-6 text-center border-b border-border ${STATUS_COLORS[report.status]?.bgLight || 'bg-foreground/10'}`}>
                        <h2 className={`text-xl font-semibold uppercase tracking-widest ${STATUS_COLORS[report.status]?.text || 'text-foreground'}`}>
                            {isFailed ? "Cleanup Failed" : report.status}
                        </h2>
                        <p className="text-sm text-foreground/60 mt-2 font-medium">
                            {report.status === 'pending' && "Report received, waiting for AI verification."}
                            {report.status === 'verified' && "AI Verified! Awaiting barangay assignment."}
                            {report.status === 'assigned' && "Cleanup team has been assigned to the location!"}
                            {report.status === 'in_progress' && "Cleanup is actively in progress!"}
                            {report.status === 'resolved' && "Issue resolved. Thank you for keeping SJDM clean!"}
                            {isFailed && "The cleanup attempt was rejected by the AI. A retry is required."}
                            {isRejected && "This report was rejected by the AI (No waste detected)."}
                        </p>
                    </div>

                    {/* Progress Bar (Only show if not rejected) */}
                    {!isRejected && (
                        <div className="p-8 border-b border-border bg-black/20">
                            <div className="relative">
                                {/* Track Line */}
                                <div className="absolute top-1/2 left-0 w-full h-1 bg-foreground/10 -translate-y-1/2 rounded-full" />
                                {/* Fill Line */}
                                <div 
                                    className={`absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full transition-all duration-1000 ${isFailed ? 'bg-red-500' : 'eco-gradient'}`}
                                    style={{ width: `${Math.max(0, (currentStepIndex / 4) * 100)}%` }}
                                />
                                
                                {/* Steps */}
                                <div className="relative flex justify-between">
                                    {["Pending", "Verified", "Assigned", "In Progress", "Resolved"].map((stepLabel, idx) => {
                                        const isActive = idx <= currentStepIndex;
                                        const isCurrent = idx === currentStepIndex;
                                        const isErrorStep = isFailed && idx === 4; // Red cross on resolved if failed

                                        return (
                                            <div 
                                                key={stepLabel} 
                                                className="flex flex-col items-center cursor-pointer sm:cursor-default"
                                                onClick={() => setActiveMobileLabel(activeMobileLabel === idx ? null : idx)}
                                            >
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors z-10 
                                                    ${isActive && !isErrorStep ? 'bg-primary text-white shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 
                                                      isErrorStep ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 
                                                      'bg-[#1a1a1a] border-2 border-foreground/20 text-foreground/30'}`}
                                                >
                                                    {isActive && !isErrorStep ? "✓" : isErrorStep ? "✕" : idx + 1}
                                                </div>
                                                <span className={`mt-3 text-[10px] font-bold uppercase tracking-widest ${activeMobileLabel === idx ? 'block' : 'hidden sm:block'} ${isActive ? 'text-foreground' : 'text-foreground/40'}`}>
                                                    {stepLabel}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Report Details */}
                    <div className="p-6 md:p-8 grid md:grid-cols-2 gap-8">
                        <div>
                            {(() => {
                                const photos = Array.isArray(report.photos) && report.photos.length > 0 ? report.photos : null;
                                const activePhoto = photos ? photos[selectedPhotoIdx] : null;
                                const activeImageUrl = activePhoto?.url ?? report.image_url;
                                const activeMaskUrl = activePhoto?.mask_url ?? report.ai_mask_url;
                                const activeConfidence = activePhoto?.ai_confidence ?? report.ai_confidence;
                                return (
                                    <>
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-sm font-bold text-foreground/50 uppercase tracking-widest">Evidence Photo</h3>
                                            {activeMaskUrl && (
                                                <button
                                                    onClick={() => setShowAiMask(!showAiMask)}
                                                    className={`px-3 py-1 text-xs font-bold rounded-full transition-all flex items-center gap-2 ${showAiMask ? 'bg-primary text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-foreground/10 text-foreground/70 hover:bg-foreground/20'}`}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                                                    {showAiMask ? "Hide AI Mask" : "View AI Mask"}
                                                </button>
                                            )}
                                        </div>
                                        <div 
                                            className="w-full aspect-square rounded-2xl overflow-hidden bg-black/50 border border-border relative cursor-pointer group/evidence"
                                            onClick={() => activeImageUrl && setPreviewImage(`${API_URL}${showAiMask && activeMaskUrl ? activeMaskUrl : activeImageUrl}`)}
                                            title="Click to zoom"
                                        >
                                            {activeImageUrl ? (
                                                <img
                                                    src={`${API_URL}${showAiMask && activeMaskUrl ? activeMaskUrl : activeImageUrl}`}
                                                    alt="Report Evidence"
                                                    className="w-full h-full object-cover transition-transform duration-300 group-hover/evidence:scale-105"
                                                />
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center text-foreground/30">No Image</div>
                                            )}
                                            {activeConfidence && (
                                                <div className="absolute bottom-3 right-3 glass px-3 py-1.5 rounded-lg border border-primary/30 flex items-center gap-2 backdrop-blur-md">
                                                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                                    <span className="text-xs font-bold text-foreground">AI Confidence: {(activeConfidence * 100).toFixed(0)}%</span>
                                                </div>
                                            )}
                                        </div>

                                        {photos && photos.length > 1 && (
                                            <div className="mt-3">
                                                <p className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest mb-2">
                                                    All Evidence Photos ({photos.length})
                                                </p>
                                                <div className="flex gap-2 overflow-x-auto pb-1">
                                                    {photos.map((photo: any, i: number) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => selectPhoto(i)}
                                                            className={`relative shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all focus:outline-none ${i === selectedPhotoIdx ? 'border-primary shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'border-border hover:border-primary/50'}`}
                                                        >
                                                            <img
                                                                src={`${API_URL}${photo.url}`}
                                                                alt={`Evidence ${i + 1}`}
                                                                className="w-full h-full object-cover"
                                                            />
                                                            {photo.ai_verified != null && (
                                                                <div className={`absolute bottom-0 inset-x-0 text-center text-[9px] font-bold py-0.5 ${photo.ai_verified ? 'bg-primary/80 text-white' : 'bg-red-500/80 text-white'}`}>
                                                                    {photo.ai_verified ? "✓ Pass" : "✕ Fail"}
                                                                </div>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}

                            {/* Cleanup Photo (if resolved or failed) */}
                            {report.cleanup_image_url && (
                                <div className="mt-4">
                                    <h3 className="text-sm font-bold text-foreground/50 uppercase tracking-widest mb-2">Cleanup Verification</h3>
                                    <div 
                                        className="w-full h-32 rounded-xl overflow-hidden border border-border relative cursor-pointer group/cleanup"
                                        onClick={() => setPreviewImage(`${API_URL}${report.cleanup_image_url}`)}
                                        title="Click to zoom"
                                    >
                                        <img 
                                            src={`${API_URL}${report.cleanup_image_url}`} 
                                            alt="Cleanup" 
                                            className="w-full h-full object-cover transition-transform duration-300 group-hover/cleanup:scale-105" 
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-6">
                            <div>
                                <h3 className="text-xs font-bold text-foreground/50 uppercase tracking-widest mb-1">Assigned Barangay</h3>
                                <p className="text-lg font-semibold text-foreground">{report.barangay || "Locating..."}</p>
                            </div>

                            <div>
                                <h3 className="text-xs font-bold text-foreground/50 uppercase tracking-widest mb-1">Date Reported</h3>
                                <p className="text-base font-medium text-foreground/90">
                                    {new Date(report.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                </p>
                            </div>

                            {report.notes && (
                                <div>
                                    <h3 className="text-xs font-bold text-foreground/50 uppercase tracking-widest mb-1">Citizen Notes</h3>
                                    <p className="text-sm text-foreground/80 bg-foreground/5 p-4 rounded-xl border border-border italic">
                                        "{report.notes}"
                                    </p>
                                </div>
                            )}

                            <div>
                                <h3 className="text-xs font-bold text-foreground/50 uppercase tracking-widest mb-2">Location Map</h3>
                                <div className={`relative bg-black transition-all duration-300 rounded-xl overflow-hidden border border-border ${mapExpanded ? "h-64" : "h-32"}`}>
                                    <MiniMap lat={report.lat} lon={report.lon} />
                                    <div className="absolute inset-0 bg-black/20 pointer-events-none shadow-inner rounded-xl" />
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
                        </div>
                    </div>
                </div>

            </div>

            {previewImage && (
                <div className="fixed inset-0 z-[1400] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setPreviewImage(null)}>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}
                        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                        title="Close preview"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                        src={previewImage} 
                        alt="Evidence Preview" 
                        className="max-w-full max-h-[85vh] rounded-lg object-contain shadow-2xl animate-in zoom-in-95 duration-300"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}
