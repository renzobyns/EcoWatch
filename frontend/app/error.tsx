"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from "lucide-react";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        // Log client-side error to console for monitoring
        console.error("App boundary error caught:", error);
    }, [error]);

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
            {/* Ambient Red/Amber Glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="w-full max-w-md bg-card/80 backdrop-blur-xl border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col relative z-10">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-muted/20">
                    <span className="text-sm font-semibold text-foreground tracking-tight">System Exception</span>
                    <span className="text-[10px] font-mono uppercase bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full font-semibold border border-red-500/20">
                        Error 500
                    </span>
                </div>

                <div className="p-6 sm:p-8 flex flex-col items-center text-center space-y-6">
                    {/* Error Icon */}
                    <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-inner">
                        <AlertTriangle size={36} />
                    </div>

                    {/* Headline */}
                    <div className="space-y-2">
                        <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                            Something Went Off-Grid
                        </h1>
                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                            An unexpected anomaly occurred while processing your request. The system has safely halted execution to protect your session.
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="w-full space-y-2.5">
                        <button
                            onClick={() => reset()}
                            className="w-full py-3 px-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={16} />
                            Try Again
                        </button>
                        <Link
                            href="/"
                            className="w-full py-3 px-4 rounded-2xl bg-muted/50 hover:bg-muted text-foreground font-semibold text-sm border border-border/60 transition-all flex items-center justify-center gap-2"
                        >
                            <Home size={16} />
                            Return to Safety (Home)
                        </Link>
                    </div>

                    {/* Technical Error Details Accordion */}
                    <div className="w-full pt-2 border-t border-border/30 text-left">
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className="w-full flex items-center justify-between text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
                        >
                            <span>Technical Diagnostic Details</span>
                            {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        {showDetails && (
                            <div className="mt-2 p-3 bg-muted/40 rounded-xl border border-border text-[11px] font-mono text-muted-foreground break-all space-y-1">
                                <p><strong>Message:</strong> {error.message || "Unknown client runtime exception"}</p>
                                {error.digest && <p><strong>Digest ID:</strong> {error.digest}</p>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
