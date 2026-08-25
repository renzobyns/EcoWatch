"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

const MiniMap = dynamic(() => import("@/components/MiniMap"), { ssr: false });
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://renzobyns-ecowatch-backend.hf.space";

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
    const [mapModalOpen, setMapModalOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [activeMobileLabel, setActiveMobileLabel] = useState<number | null>(null);
    const [scanProgress, setScanProgress] = useState(0);
    const wasPending = useRef<boolean | null>(null);

    // Simulate Mask R-CNN scanning progress
    useEffect(() => {
        if (!report) return;

        if (report.verification_pending) {
            setScanProgress(0); // Start from 0%
            const interval = setInterval(() => {
                setScanProgress(p => p < 99 ? p + Math.floor(Math.random() * 8) + 1 : 99);
            }, 300);
            return () => clearInterval(interval);
        } else {
            setScanProgress(100);
        }
    }, [report?.verification_pending, report === null]);

    // Auto-show mask when scan finishes successfully
    useEffect(() => {
        if (report) {
            if (wasPending.current === true && report.verification_pending === false) {
                if (report.status === "verified") {
                    setShowAiMask(true);
                }
            }
            wasPending.current = report.verification_pending;
        }
    }, [report]);

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
                        <div className="p-8 border-b border-border dark:bg-black/20 bg-foreground/[0.02]">
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
                                                      'dark:bg-[#1a1a1a] bg-background border-2 border-foreground/20 text-foreground/30'}`}
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
                                        <div 
                                            className="w-full aspect-square rounded-lg overflow-hidden bg-black/50 border border-border relative cursor-pointer group/evidence"
                                            onClick={() => activeImageUrl && setPreviewImage(`${API_URL}${showAiMask && activeMaskUrl ? activeMaskUrl : activeImageUrl}`)}
                                            title="Click to zoom"
                                        >
                                            {activeMaskUrl && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setShowAiMask(!showAiMask); }}
                                                    className={`absolute top-3 right-3 z-10 px-3 py-1.5 text-[11px] font-bold rounded-full transition-all backdrop-blur-md border flex items-center gap-2 ${showAiMask ? 'bg-primary/90 text-white border-primary shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-black/40 text-white/90 border-white/10 hover:bg-black/60'}`}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                                                    {showAiMask ? "Hide AI Mask" : "View AI Mask"}
                                                </button>
                                            )}
                                            {activeImageUrl ? (
                                                <>
                                                    <img
                                                        src={`${API_URL}${showAiMask && activeMaskUrl ? activeMaskUrl : activeImageUrl}`}
                                                        alt="Report Evidence"
                                                        className="w-full h-full object-cover transition-transform duration-300 group-hover/evidence:scale-105"
                                                        onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }}
                                                    />
                                                    <div className="hidden absolute inset-0 flex items-center justify-center text-foreground/30 uppercase tracking-widest text-sm bg-black/20">Image unavailable</div>
                                                </>
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center text-foreground/30">No Image</div>
                                            )}
                                            {report?.verification_pending && (
                                                <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden rounded-lg">
                                                    <style>{`
                                                        @keyframes scanline {
                                                            0% { top: 0%; opacity: 0; }
                                                            10% { opacity: 1; }
                                                            90% { opacity: 1; }
                                                            100% { top: 100%; opacity: 0; }
                                                        }
                                                        @keyframes draw-box {
                                                            0%, 100% { opacity: 0; transform: scale(0.95); }
                                                            50% { opacity: 1; transform: scale(1); }
                                                        }
                                                    `}</style>
                                                    
                                                    {/* Dark overlay goes FIRST so elements below are drawn ON TOP of it */}
                                                    <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

                                                    {/* Sweeping Laser Line (Z-index 10) */}
                                                    <div className="absolute left-0 right-0 h-[2px] bg-primary shadow-[0_0_20px_5px_#10b981] animate-[scanline_2.5s_linear_infinite] z-10" />
                                                    
                                                    {/* Simulated RPN Bounding Boxes (Z-index 10) - Brighter borders */}
                                                    <div className="absolute top-[25%] left-[20%] w-[45%] h-[40%] border-2 border-primary bg-primary/10 rounded-sm animate-[draw-box_1.5s_ease-in-out_infinite] z-10" />
                                                    <div className="absolute top-[55%] left-[55%] w-[30%] h-[30%] border-2 border-primary bg-primary/10 rounded-sm animate-[draw-box_1.8s_ease-in-out_infinite_0.4s] z-10" />
                                                    <div className="absolute top-[15%] left-[65%] w-[20%] h-[25%] border-2 border-primary bg-primary/10 rounded-sm animate-[draw-box_2.1s_ease-in-out_infinite_0.8s] z-10" />

                                                    {/* Progress Overlay Box (Centered on top) */}
                                                    <div className="absolute inset-0 flex items-center justify-center flex-col gap-3 z-20">
                                                        <div className="bg-black/90 px-6 py-5 rounded-2xl border border-primary/30 flex flex-col items-center gap-3 backdrop-blur-xl shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                                                            <div className="relative w-14 h-14 flex items-center justify-center">
                                                                <svg className="animate-spin w-full h-full text-primary" viewBox="0 0 24 24">
                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                                </svg>
                                                                <span className="absolute text-xs font-bold text-white">{scanProgress}%</span>
                                                            </div>
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-[13px] font-bold text-white tracking-widest uppercase mb-1 drop-shadow-md">Mask R-CNN Scanning</span>
                                                                <span className="text-[10px] font-mono text-primary uppercase opacity-80">
                                                                    {scanProgress < 30 ? "Extracting features..." : 
                                                                     scanProgress < 60 ? "Proposing regions..." : 
                                                                     scanProgress < 90 ? "Generating masks..." : "Finalizing output..."}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {!report?.verification_pending && activeConfidence && (
                                                <div className="absolute bottom-3 right-3 glass px-3 py-1.5 rounded-md border border-primary/30 flex items-center gap-2 backdrop-blur-md">
                                                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                                    <span className="text-xs font-bold text-foreground">AI Confidence: {(activeConfidence * 100).toFixed(0)}%</span>
                                                </div>
                                            )}
                                        </div>

                                        {photos && photos.length > 1 && (
                                            <div className="mt-3">
                                                <p className="text-xs font-medium text-foreground/40 mb-2">
                                                    {photos.length} Photos Attached
                                                </p>
                                                <div className="flex gap-2 overflow-x-auto pb-1">
                                                    {photos.map((photo: any, i: number) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => selectPhoto(i)}
                                                            className={`relative shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 transition-all focus:outline-none ${i === selectedPhotoIdx ? 'border-primary shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'border-border hover:border-primary/50'}`}
                                                        >
                                                            <img
                                                                src={`${API_URL}${photo.url}`}
                                                                alt={`Evidence ${i + 1}`}
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }}
                                                            />
                                                            <div className="hidden absolute inset-0 flex items-center justify-center text-[8px] text-foreground/40 uppercase text-center px-1">Img NA</div>
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
                                    <div className="flex items-center gap-2 mb-2 text-foreground/50">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
                                        <h3 className="text-xs font-semibold">Cleanup Verification</h3>
                                    </div>
                                    <div 
                                        className="w-full h-32 rounded-lg overflow-hidden border border-border relative cursor-pointer group/cleanup"
                                        onClick={() => setPreviewImage(`${API_URL}${report.cleanup_image_url}`)}
                                        title="Click to zoom"
                                    >
                                        <img 
                                            src={`${API_URL}${report.cleanup_image_url}`} 
                                            alt="Cleanup" 
                                            className="w-full h-full object-cover transition-transform duration-300 group-hover/cleanup:scale-105" 
                                            onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }}
                                        />
                                        <div className="hidden absolute inset-0 flex items-center justify-center text-xs text-foreground/40 uppercase tracking-widest text-center px-4 bg-muted border border-border">Image unavailable</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-6 flex flex-col h-full">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 p-2 rounded-lg bg-foreground/5 text-foreground/50 border border-foreground/10">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                                </div>
                                <div>
                                    <p className="text-[11px] font-medium text-foreground/40 uppercase tracking-wider mb-0.5">Assigned Barangay</p>
                                    <p className="text-base font-semibold text-foreground">{report.barangay || "Locating..."}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 p-2 rounded-lg bg-foreground/5 text-foreground/50 border border-foreground/10">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                </div>
                                <div>
                                    <p className="text-[11px] font-medium text-foreground/40 uppercase tracking-wider mb-0.5">Date Reported</p>
                                    <p className="text-sm font-medium text-foreground/90">
                                        {new Date(report.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                    </p>
                                </div>
                            </div>

                            {report.notes && (
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 p-2 rounded-lg bg-foreground/5 text-foreground/50 border border-foreground/10">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[11px] font-medium text-foreground/40 uppercase tracking-wider mb-1">Citizen Notes</p>
                                        <p className="text-sm text-foreground/80 leading-relaxed italic bg-foreground/5 p-3 rounded-lg border border-border">
                                            "{report.notes}"
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="flex-1 flex flex-col pt-2 min-h-[192px]">
                                <div 
                                    className="relative bg-black rounded-lg overflow-hidden border border-border h-full group/map cursor-pointer shadow-sm flex-1"
                                    onClick={() => setMapModalOpen(true)}
                                >
                                    <MiniMap lat={report.lat} lon={report.lon} barangay={report.barangay} />
                                    <div className="absolute inset-0 bg-black/10 group-hover/map:bg-black/20 transition-colors pointer-events-none shadow-inner" />
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setMapModalOpen(true); }}
                                        className="absolute bottom-3 right-3 p-2 rounded-lg bg-black/60 text-white backdrop-blur-md border border-white/10 hover:bg-black/80 transition-colors z-10 shadow-lg flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
                                        title="View Full Map"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                                        </svg>
                                        Expand Map
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Image Preview Modal */}
            {previewImage && (
                <div 
                    className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out"
                    onClick={() => setPreviewImage(null)}
                >
                    <button 
                        onClick={() => setPreviewImage(null)}
                        className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer z-[101]"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>
                    </button>
                    <img 
                        src={previewImage} 
                        alt="Preview" 
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" 
                    />
                </div>
            )}

            {/* Map Fullscreen Modal */}
            {mapModalOpen && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 md:p-12 backdrop-blur-sm">
                    <div className="w-full h-full relative rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-black">
                        <button 
                            onClick={() => setMapModalOpen(false)}
                            className="absolute top-4 right-4 p-2.5 bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 rounded-full transition-colors cursor-pointer z-[101] shadow-xl"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>
                        </button>
                        <div className="w-full h-full">
                            <MiniMap lat={report.lat} lon={report.lon} barangay={report.barangay} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
