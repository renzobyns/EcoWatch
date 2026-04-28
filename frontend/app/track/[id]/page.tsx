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
            <div className="min-h-screen bg-[#0a0f0a] flex flex-col items-center justify-center">
                <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
                <p className="text-primary font-bold animate-pulse">Locating Report...</p>
            </div>
        );
    }

    if (error || !report) {
        return (
            <div className="min-h-screen bg-[#0a0f0a] flex flex-col items-center justify-center p-4 text-center">
                <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                </div>
                <h1 className="text-3xl font-black text-white mb-2">Report Not Found</h1>
                <p className="text-foreground/60 mb-8 max-w-md">
                    We couldn't find a report with tracking ID "{trackingId}". It may have been rejected by the AI or the ID is incorrect.
                </p>
                <Link href="/" className="px-8 py-3 eco-gradient text-white font-bold rounded-full">Return Home</Link>
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
        <div className="min-h-screen bg-[#0a0f0a] pt-24 pb-12 px-4 flex flex-col items-center">
            <div className="w-full max-w-2xl">
                
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <Link href="/" className="text-white hover:text-primary transition-colors flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                        Back to Map
                    </Link>
                    <div className="text-right">
                        <div className="text-xs font-bold text-foreground/50 uppercase tracking-widest">Tracking ID</div>
                        <div className="text-xl font-black text-primary">{report.tracking_id}</div>
                    </div>
                </div>

                {/* Main Card */}
                <div className="glass rounded-3xl border border-white/10 shadow-2xl overflow-hidden mb-8">
                    {/* Status Banner */}
                    <div className={`p-6 text-center border-b border-white/10 ${
                        report.status === 'resolved' ? 'bg-green-500/10' :
                        isRejected || isFailed ? 'bg-red-500/10' : 'bg-primary/10'
                    }`}>
                        <h2 className={`text-2xl font-black uppercase tracking-widest ${
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
                        <div className="p-8 border-b border-white/5 bg-black/20">
                            <div className="relative">
                                {/* Track Line */}
                                <div className="absolute top-1/2 left-0 w-full h-1 bg-white/10 -translate-y-1/2 rounded-full" />
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
                                                      'bg-[#1a1a1a] border-2 border-white/20 text-foreground/30'}`}
                                                >
                                                    {isActive && !isErrorStep ? "✓" : isErrorStep ? "✕" : idx + 1}
                                                </div>
                                                <span className={`mt-3 text-[10px] font-bold uppercase tracking-widest ${isActive ? 'text-white' : 'text-foreground/40'}`}>
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
                            <h3 className="text-sm font-bold text-white/50 uppercase tracking-widest mb-4">Evidence Photo</h3>
                            <div className="w-full aspect-square rounded-2xl overflow-hidden bg-black/50 border border-white/10 relative">
                                {report.image_url ? (
                                    <img src={`${API_URL}${report.image_url}`} alt="Report Evidence" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-white/20">No Image</div>
                                )}
                                
                                {/* AI Confidence Badge */}
                                {report.ai_confidence && (
                                    <div className="absolute bottom-3 right-3 glass px-3 py-1.5 rounded-lg border border-primary/30 flex items-center gap-2 backdrop-blur-md">
                                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                        <span className="text-xs font-bold text-white">AI Confidence: {(report.ai_confidence * 100).toFixed(0)}%</span>
                                    </div>
                                )}
                            </div>
                            
                            {/* Cleanup Photo (if resolved or failed) */}
                            {report.cleanup_image_url && (
                                <div className="mt-4">
                                    <h3 className="text-sm font-bold text-white/50 uppercase tracking-widest mb-2">Cleanup Verification</h3>
                                    <div className="w-full h-32 rounded-xl overflow-hidden border border-white/10 relative">
                                        <img src={`${API_URL}${report.cleanup_image_url}`} alt="Cleanup" className="w-full h-full object-cover" />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-6">
                            <div>
                                <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-1">Assigned Barangay</h3>
                                <p className="text-xl font-black text-white">{report.barangay || "Locating..."}</p>
                            </div>

                            <div>
                                <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-1">Date Reported</h3>
                                <p className="text-base font-medium text-white/90">
                                    {new Date(report.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                </p>
                            </div>

                            {report.notes && (
                                <div>
                                    <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-1">Citizen Notes</h3>
                                    <p className="text-sm text-white/80 bg-white/5 p-4 rounded-xl border border-white/5 italic">
                                        "{report.notes}"
                                    </p>
                                </div>
                            )}

                            <div>
                                <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-2">Location Map</h3>
                                <div className="w-full h-32 rounded-xl overflow-hidden border border-white/10 bg-black relative">
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
