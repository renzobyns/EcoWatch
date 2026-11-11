"use client";

import { useState, useEffect } from "react";
import { X, ShieldCheck, Cpu, Sparkles, Scan, Mail, MailOpen } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export function DevOptionsModal() {
    const [open, setOpen] = useState(false);
    const [enableCleanupMrcnn, setEnableCleanupMrcnn] = useState(true);
    const [geminiDisplay, setGeminiDisplay] = useState(false);
    const [emailVerificationEnabled, setEmailVerificationEnabled] = useState(true);
    const [updatingEmailVerif, setUpdatingEmailVerif] = useState(false);


    // Listen for custom trigger event (5 logo clicks)
    useEffect(() => {
        const handleOpen = () => setOpen(true);
        window.addEventListener("ecowatch:open-dev-options", handleOpen);
        return () => window.removeEventListener("ecowatch:open-dev-options", handleOpen);
    }, []);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && open) {
                setOpen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open]);

    // Fetch initial config when opened
    useEffect(() => {
        if (!open) return;

        const loadConfig = async () => {
            try {
                // Fetch public presentation config (unauthenticated & fast)
                const data = await api("/system-config/public", { cache: "no-store" });

                if (data) {
                    if (typeof data.enable_cleanup_mrcnn === "boolean") {
                        setEnableCleanupMrcnn(data.enable_cleanup_mrcnn);
                        localStorage.setItem("ecowatch_enable_cleanup_mrcnn", String(data.enable_cleanup_mrcnn));
                    }
                    if (typeof data.gemini_display === "boolean") {
                        setGeminiDisplay(data.gemini_display);
                        localStorage.setItem("ecowatch_dev_telemetry", String(data.gemini_display));
                        localStorage.removeItem("ecowatch_gemini_display");
                    }
                    if (typeof data.email_verification_enabled === "boolean") {
                        setEmailVerificationEnabled(data.email_verification_enabled);
                    }
                    // Dispatch to ensure page telemetry immediately syncs with actual database config
                    window.dispatchEvent(
                        new CustomEvent("ecowatch:config-changed", {
                            detail: {
                                enable_cleanup_mrcnn: data.enable_cleanup_mrcnn,
                                gemini_display: data.gemini_display,
                            },
                        })
                    );
                }
            } catch (err) {
                console.error("Failed to load dev config", err);
                // Fallback to local storage
                try {
                    const localTelemetry = localStorage.getItem("ecowatch_dev_telemetry");
                    const legacyGemini = localStorage.getItem("ecowatch_gemini_display");
                    if (legacyGemini !== null) {
                        if (localTelemetry === null) {
                            localStorage.setItem("ecowatch_dev_telemetry", legacyGemini);
                            setGeminiDisplay(legacyGemini === "true");
                        }
                        localStorage.removeItem("ecowatch_gemini_display");
                    } else if (localTelemetry !== null) {
                        setGeminiDisplay(localTelemetry === "true");
                    }
                    const localMrcnn = localStorage.getItem("ecowatch_enable_cleanup_mrcnn");
                    if (localMrcnn !== null) setEnableCleanupMrcnn(localMrcnn === "true");
                } catch {
                    // Ignore storage access errors
                }
            }
        };

        loadConfig();
    }, [open]);

    const updateCleanupMrcnn = async (val: boolean) => {
        setEnableCleanupMrcnn(val);
        localStorage.setItem("ecowatch_enable_cleanup_mrcnn", String(val));
        try {
            await api("/system-config/dev-toggle", {
                method: "POST",
                body: JSON.stringify({ enable_cleanup_mrcnn: val }),
            });
            toast.success(val ? "Mask R-CNN on cleanup proofs enabled!" : "Mask R-CNN on cleanup bypassed!");
        } catch {
            // Local state preserved even if network error
            toast.info(val ? "Cleanup Mask R-CNN enabled locally" : "Cleanup Mask R-CNN bypassed locally");
        }

        window.dispatchEvent(
            new CustomEvent("ecowatch:config-changed", {
                detail: { enable_cleanup_mrcnn: val, gemini_display: geminiDisplay },
            })
        );
    };

    const updateGeminiDisplay = async (val: boolean) => {
        setGeminiDisplay(val);
        localStorage.setItem("ecowatch_dev_telemetry", String(val));
        localStorage.removeItem("ecowatch_gemini_display");
        try {
            await api("/system-config/dev-toggle", {
                method: "POST",
                body: JSON.stringify({ gemini_display: val }),
            });
            toast.success(
                val
                    ? "Developer Mode: Gemini telemetry visible"
                    : "Defense Mode: Pure Mask R-CNN presentation active"
            );
        } catch {
            toast.info(
                val
                    ? "Developer Mode active (locally)"
                    : "Defense Mode active (locally)"
            );
        }

        window.dispatchEvent(
            new CustomEvent("ecowatch:config-changed", {
                detail: { enable_cleanup_mrcnn: enableCleanupMrcnn, gemini_display: val },
            })
        );
    };

    const updateEmailVerification = async (val: boolean) => {
        setUpdatingEmailVerif(true);
        setEmailVerificationEnabled(val);
        try {
            await api("/system-config/dev-toggle", {
                method: "POST",
                body: JSON.stringify({ email_verification_enabled: val }),
            });
            toast.success(val ? "Email verification required for new users." : "Email verification disabled (test mode).");
        } catch (err) {
            setEmailVerificationEnabled(!val);
            const error = err as Error;
            toast.error(error.message || "Failed to update email verification configuration.");
        } finally {
            setUpdatingEmailVerif(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
            <div className="relative w-full max-w-lg bg-card border border-border/80 shadow-2xl rounded-2xl overflow-hidden p-6 text-foreground space-y-6 animate-scale-up">
                
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                                <Cpu size={18} />
                            </span>
                            <h3 className="text-base font-bold tracking-tight">EcoWatch Developer Options</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Hidden administrative controls. Controls system presentation and cleanup verification.
                        </p>
                    </div>
                    <button
                        onClick={() => setOpen(false)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Status Indicator Pill */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/30">
                    <span className="text-xs font-medium text-muted-foreground">Active Presentation Mode:</span>
                    {!geminiDisplay ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                            <ShieldCheck size={14} />
                            Defense Mode (Mask R-CNN Only)
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            <Sparkles size={14} />
                            🛠️ Developer Mode (Gemini Visible)
                        </span>
                    )}
                </div>

                {/* The Toggles */}
                <div className="space-y-4">
                    {/* Toggle 1: Mask R-CNN Cleanup Proofs */}
                    <div className="p-4 rounded-xl border border-border bg-card/60 flex items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Scan size={15} className={enableCleanupMrcnn ? "text-emerald-500" : "text-muted-foreground"} />
                                <span className={`text-sm font-semibold ${enableCleanupMrcnn ? "text-foreground" : "text-muted-foreground"}`}>Mask R-CNN on Cleanup Proofs</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                When enabled, Mask R-CNN runs instance segmentation on cleaner resolution proofs. When toggled off, relies on automated visual scene comparison.
                            </p>
                        </div>
                        <label className="relative inline-flex items-center shrink-0 cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={enableCleanupMrcnn}
                                onChange={(e) => updateCleanupMrcnn(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-neutral-300 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 dark:after:border-neutral-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>

                    {/* Toggle 2: Developer AI Telemetry (Gemini Display) */}
                    <div className="p-4 rounded-xl border border-border bg-card/60 flex items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Sparkles size={15} className={geminiDisplay ? "text-amber-500" : "text-muted-foreground"} />
                                <span className={`text-sm font-semibold ${geminiDisplay ? "text-foreground" : "text-muted-foreground"}`}>Developer AI Telemetry (Gemini Display)</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {geminiDisplay ? (
                                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                                        Exposing raw external AI provider names, latency metrics, and scene descriptions for debugging.
                                    </span>
                                ) : (
                                    <span>
                                        <span>Disabled (Defense Mode): All Gemini/VLM labels, model names, and latency are disguised as pure Mask R-CNN.</span>
                                    </span>
                                )}
                            </p>
                        </div>
                        <label className="relative inline-flex items-center shrink-0 cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={geminiDisplay}
                                onChange={(e) => updateGeminiDisplay(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-neutral-300 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 dark:after:border-neutral-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>

                    {/* Toggle 3: Require Email Verification */}
                    <div className="p-4 rounded-xl border border-border bg-card/60 flex items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                {emailVerificationEnabled ? (
                                    <Mail size={15} className="text-primary" />
                                ) : (
                                    <MailOpen size={15} className="text-destructive" />
                                )}
                                <span className={`text-sm font-semibold ${emailVerificationEnabled ? "text-foreground" : "text-muted-foreground"}`}>Require Email Verification</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                When enabled, new users must verify their email address before logging in. Turn this off for local or offline testing without email delivery.
                            </p>
                        </div>
                        <label className="relative inline-flex items-center shrink-0 cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={emailVerificationEnabled}
                                onChange={(e) => updateEmailVerification(e.target.checked)}
                                disabled={updatingEmailVerif}
                            />
                            <div className="w-11 h-6 bg-neutral-300 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 dark:after:border-neutral-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>
                </div>

                {/* Footer Notes */}
                <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>💡 Tip: Click the EcoWatch logo 5 times to reopen.</span>
                    <button
                        onClick={() => setOpen(false)}
                        className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
