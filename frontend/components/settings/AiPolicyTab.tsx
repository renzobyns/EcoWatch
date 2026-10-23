"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export function AiPolicyTab() {
    const [threshold, setThreshold] = useState(0.5);
    const [enableCleanupMrcnn, setEnableCleanupMrcnn] = useState(true);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const data = await api("/admin/system-config");
                if (data && typeof data.ai_confidence_threshold === "number") {
                    setThreshold(data.ai_confidence_threshold);
                }
                if (data && typeof data.enable_cleanup_mrcnn === "boolean") {
                    setEnableCleanupMrcnn(data.enable_cleanup_mrcnn);
                }
            } catch (err) {
                console.error("Failed to fetch system config", err);
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, []);

    const updateThreshold = async (val: number) => {
        setThreshold(val);
        try {
            await api("/admin/system-config", {
                method: "PATCH",
                body: JSON.stringify({ ai_confidence_threshold: val })
            });
            toast.success("AI threshold updated successfully!");
        } catch {
            toast.error("Failed to update AI threshold on server");
        }
    };

    const updateCleanupMrcnn = async (val: boolean) => {
        setEnableCleanupMrcnn(val);
        try {
            await api("/admin/system-config", {
                method: "PATCH",
                body: JSON.stringify({ enable_cleanup_mrcnn: val })
            });
            toast.success(val ? "Mask R-CNN enabled for cleanup!" : "Mask R-CNN bypassed for cleanup (VLM-only mode)!");
        } catch {
            setEnableCleanupMrcnn(!val); // revert on error
            toast.error("Failed to update cleanup AI policy on server");
        }
    };

    if (loading) {
        return <div className="animate-pulse space-y-8 max-w-2xl">
            <div className="h-8 bg-secondary rounded w-1/3"></div>
            <div className="h-32 bg-secondary rounded-xl"></div>
        </div>;
    }

    return (
        <div className="animate-fade-in max-w-2xl space-y-8">
            <div>
                <h2 className="text-lg font-bold text-foreground mb-1">AI Verification Policy</h2>
                <p className="text-sm text-muted-foreground">Configure how the Mask R-CNN model processes incoming reports.</p>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 space-y-8 shadow-sm">
                
                {/* Confidence Threshold */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <label className="text-sm font-medium text-foreground">Confidence Threshold</label>
                        <span className="text-sm font-mono text-primary font-bold bg-primary/10 px-2 py-0.5 rounded">
                            {threshold.toFixed(2)}
                        </span>
                    </div>
                    <input 
                        type="range" 
                        min="0.1" max="1.0" step="0.05"
                        value={threshold}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setThreshold(val); // optimistic update for slider smoothness
                        }}
                        onMouseUp={(e) => {
                            const val = parseFloat((e.target as HTMLInputElement).value);
                            updateThreshold(val);
                        }}
                        onTouchEnd={(e) => {
                            const val = parseFloat((e.target as HTMLInputElement).value);
                            updateThreshold(val);
                        }}
                        className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <p className="text-xs text-muted-foreground mt-3">Reports below this confidence level will be flagged or auto-rejected.</p>
                </div>

                <div className="w-full h-px bg-border/50"></div>

                {/* Mask R-CNN Cleanup Toggle */}
                <div className="flex items-center justify-between">
                    <div className="pr-4">
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">Mask R-CNN on Cleanup Proofs</p>
                            {!enableCleanupMrcnn ? (
                                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30">
                                    Temporarily Off
                                </span>
                            ) : (
                                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                                    Active
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            When enabled, Mask R-CNN runs instance segmentation on cleanup photos. When toggled OFF, cleanup relies exclusively on Gemini Flash VLM Before-vs-After reasoning.
                        </p>
                    </div>
                    <label className="relative inline-flex items-center shrink-0 cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={enableCleanupMrcnn} 
                            onChange={(e) => updateCleanupMrcnn(e.target.checked)} 
                        />
                        <div className="w-11 h-6 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                </div>

                <div className="w-full h-px bg-border/50"></div>

                {/* Auto-Reject */}
                <div className="flex items-center justify-between opacity-50 cursor-not-allowed group relative">
                    <div>
                        <p className="text-sm font-medium">Auto-Reject Below Threshold</p>
                        <p className="text-xs text-muted-foreground mt-0.5">When disabled, low-confidence reports are sent for human review. (Coming Soon)</p>
                    </div>
                    <label className="relative inline-flex items-center shrink-0 ml-4 pointer-events-none">
                        <input type="checkbox" className="sr-only peer" checked={true} readOnly />
                        <div className="w-9 h-5 bg-primary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                    </label>
                </div>
            </div>

            {/* Model Status */}
            <div>
                <h3 className="text-sm font-semibold mb-3">Current Model Status</h3>
                <div className="bg-secondary/30 rounded-xl p-5 border border-border shadow-sm">
                    <div className="flex justify-between py-2 border-b border-border/50 text-sm">
                        <span className="text-muted-foreground">Model Architecture</span>
                        <span className="font-medium text-foreground">Mask R-CNN (TensorFlow)</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/50 text-sm">
                        <span className="text-muted-foreground">Cleanup Verification Mode</span>
                        <span className={`font-medium ${enableCleanupMrcnn ? "text-emerald-500" : "text-amber-500"}`}>
                            {enableCleanupMrcnn ? "Mask R-CNN + Gemini Flash" : "Gemini Flash Only (Mask R-CNN Off)"}
                        </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/50 text-sm">
                        <span className="text-muted-foreground">Running Mode</span>
                        <span className="font-medium text-amber-500">Auto-Detected Fallback</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/50 text-sm">
                        <span className="text-muted-foreground">Detection Classes</span>
                        <span className="font-medium text-foreground">bottle, cup, trash bag, debris</span>
                    </div>
                    <div className="flex justify-between py-2 text-sm">
                        <span className="text-muted-foreground">Threshold Target</span>
                        <span className="font-medium text-foreground">{threshold.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
