"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, MailOpen } from "lucide-react";
import { api } from "@/lib/api";

export function DeveloperTab() {
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [emailVerificationEnabled, setEmailVerificationEnabled] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api("/config/email-verification")
            .then(data => setEmailVerificationEnabled(data.enabled))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const handleToggle = async (checked: boolean) => {
        setUpdating(true);
        setError(null);
        try {
            const data = await api("/config/email-verification", {
                method: "PUT",
                body: JSON.stringify({ enabled: checked }),
            });
            setEmailVerificationEnabled(data.enabled);
        } catch (err) {
            const error = err as Error;
            setError(error.message || "Failed to update configuration.");
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-48 text-foreground/50">
                <Loader2 size={24} className="animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="border-b border-border pb-4">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">Developer Options</h2>
                <p className="text-sm text-foreground/50 mt-1">
                    Advanced system configuration and testing toggles. For CENRO administrators only.
                </p>
            </div>

            {error && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20 font-medium">
                    {error}
                </div>
            )}

            <div className="space-y-4">
                <div className="glass p-5 rounded-xl border border-border flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${emailVerificationEnabled ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
                            {emailVerificationEnabled ? <Mail size={20} /> : <MailOpen size={20} />}
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground text-sm">Require Email Verification</h3>
                            <p className="text-xs text-foreground/60 mt-1 leading-relaxed max-w-lg">
                                When enabled, new users must click a link sent to their email to activate their account. 
                                <strong> Turn this off for local offline testing</strong> where Resend cannot deliver emails.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {updating && <Loader2 size={16} className="animate-spin text-foreground/30" />}
                        <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={emailVerificationEnabled} 
                                onChange={(e) => handleToggle(e.target.checked)} 
                                disabled={updating} 
                            />
                            <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
}
