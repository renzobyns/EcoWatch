"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

const MiniMap = dynamic(() => import("@/components/MiniMap"), { ssr: false });
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const STATUS_STEPS = ["pending", "verified", "deployed", "resolved"];

export default function TrackReportPage() {
    const params = useParams();
    const trackingId = params.id as string;
    
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAiMask, setShowAiMask] = useState(false);

    useEffect(() => {
        const fetchReport = async () => {
            try {
                const res = await fetch(`${API_URL}/report/track/${trackingId}`);
                if (!res.ok) {
                    throw new Error(res.status === 404 ? "Report not found" : "Server error");
                }
                const data = await res.json();
                setReport(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchReport();
    }, [trackingId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white p-1 shadow-[0_0_30px_rgba(16,185,129,0.3)] animate-pulse">
                    <img src="/logo.png" alt="Loading..." className="w-full h-full object-contain" />
                </div>
                <div className="text-emerald-500 font-bold tracking-widest uppercase text-sm animate-pulse">Locating Report...</div>
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
    if (isFailed) currentStepIndex = 2; // Deployed, but failed resolving

    return (
        <div className="min-h-screen bg-background pt-20 pb-12 px-4 flex flex-col items-center">
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
                    <div className={`p-6 text-center border-b border-border ${
                        report.status === 'resolved' ? 'bg-green-500/10' :
                        isRejected || isFailed ? 'bg-red-500/10' : 'bg-primary/10'
                    }`}>
                        <h2 className={`text-xl font-semibold uppercase tracking-widest ${
                            report.status === 'resolved' ? 'text-green-500' :
                            isRejected || isFailed ? 'text-red-500' : 'text-primary'
                        }`}>
                            {isFailed ? "Cleanup Failed" : report.status}
                        </h2>
                        <p className="text-sm text-foreground/60 mt-2 font-medium">
                            {report.status === 'pending' && "Report received, waiting for AI verification."}
                            {report.status === 'verified' && "AI Verified! Awaiting barangay deployment."}
                            {report.status === 'deployed' && "Cleanup team has been deployed to the location!"}
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
                                    style={{ width: `${Math.max(0, (currentStepIndex / 3) * 100)}%` }}
                                />
                                
                                {/* Steps */}
                                <div className="relative flex justify-between">
                                    {["Pending", "Verified", "Deployed", "Resolved"].map((stepLabel, idx) => {
                                        const isActive = idx <= currentStepIndex;
                                        const isCurrent = idx === currentStepIndex;
                                        const isErrorStep = isFailed && idx === 3; // Red cross on resolved if failed

                                        return (
                                            <div key={stepLabel} className="flex flex-col items-center">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors z-10 
                                                    ${isActive && !isErrorStep ? 'bg-primary text-white shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 
                                                      isErrorStep ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 
                                                      'bg-[#1a1a1a] border-2 border-foreground/20 text-foreground/30'}`}
                                                >
                                                    {isActive && !isErrorStep ? "✓" : isErrorStep ? "✕" : idx + 1}
                                                </div>
                                                <span className={`mt-3 text-[10px] font-bold uppercase tracking-widest ${isActive ? 'text-foreground' : 'text-foreground/40'}`}>
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
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-foreground/50 uppercase tracking-widest">Evidence Photo</h3>
                                {report.ai_mask_url && (
                                    <button 
                                        onClick={() => setShowAiMask(!showAiMask)}
                                        className={`px-3 py-1 text-xs font-bold rounded-full transition-all flex items-center gap-2 ${showAiMask ? 'bg-primary text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-foreground/10 text-foreground/70 hover:bg-foreground/20'}`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                                        {showAiMask ? "Hide AI Mask" : "View AI Mask"}
                                    </button>
                                )}
                            </div>
                            <div className="w-full aspect-square rounded-2xl overflow-hidden bg-black/50 border border-border relative">
                                {report.image_url ? (
                                    <>
                                        <img 
                                            src={`${API_URL}${showAiMask && report.ai_mask_url ? report.ai_mask_url : report.image_url}`} 
                                            alt="Report Evidence" 
                                            className="w-full h-full object-cover transition-opacity duration-300" 
                                        />
                                    </>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-foreground/30">No Image</div>
                                )}
                                
                                {/* AI Confidence Badge */}
                                {report.ai_confidence && (
                                    <div className="absolute bottom-3 right-3 glass px-3 py-1.5 rounded-lg border border-primary/30 flex items-center gap-2 backdrop-blur-md">
                                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                        <span className="text-xs font-bold text-foreground">AI Confidence: {(report.ai_confidence * 100).toFixed(0)}%</span>
                                    </div>
                                )}
                            </div>
                            
                            {/* Cleanup Photo (if resolved or failed) */}
                            {report.cleanup_image_url && (
                                <div className="mt-4">
                                    <h3 className="text-sm font-bold text-foreground/50 uppercase tracking-widest mb-2">Cleanup Verification</h3>
                                    <div className="w-full h-32 rounded-xl overflow-hidden border border-border relative">
                                        <img src={`${API_URL}${report.cleanup_image_url}`} alt="Cleanup" className="w-full h-full object-cover" />
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
                                <div className="w-full h-32 rounded-xl overflow-hidden border border-border bg-black relative">
                                    <MiniMap lat={report.lat} lon={report.lon} />
                                    <div className="absolute inset-0 bg-black/20 pointer-events-none shadow-inner rounded-xl" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
