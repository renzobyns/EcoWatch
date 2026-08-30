"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { useShortcutsContext, ACTION_DESCRIPTIONS, ShortcutAction } from "@/contexts/ShortcutsContext";
import { RotateCcw } from "lucide-react";

interface GeneralTabProps {
    section: "language" | "appearance" | "shortcuts";
}

function KeybindingRow({ 
    action, 
    combo, 
    onUpdate 
}: { 
    action: ShortcutAction; 
    combo: string; 
    onUpdate: (action: ShortcutAction, newCombo: string) => void;
}) {
    const [recording, setRecording] = useState(false);

    const formatCombo = (c: string) => c.split('+').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' + ');

    const handleKeyDown = (e: React.KeyboardEvent) => {
        e.preventDefault();
        
        // Ignore modifier-only keypresses
        if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;

        let newCombo = '';
        if (e.ctrlKey || e.metaKey) newCombo += 'ctrl+';
        if (e.altKey) newCombo += 'alt+';
        if (e.shiftKey) newCombo += 'shift+';
        
        let key = e.key.toLowerCase();
        // Standardize some keys
        if (key === ' ') key = 'space';
        if (key === 'escape') key = 'escape';
        
        newCombo += key;
        
        onUpdate(action, newCombo);
        setRecording(false);
    };

    return (
        <div className="flex items-center justify-between px-6 py-4 border-b border-border last:border-0 hover:bg-secondary/10 transition-colors">
            <span className="text-sm font-medium text-foreground">{ACTION_DESCRIPTIONS[action]}</span>
            {recording ? (
                <input
                    autoFocus
                    type="text"
                    onKeyDown={handleKeyDown}
                    onBlur={() => setRecording(false)}
                    placeholder="Press keys..."
                    className="w-32 bg-primary/10 border border-primary text-primary px-3 py-1.5 rounded-md text-xs font-mono text-center outline-none ring-2 ring-primary/20"
                    readOnly
                />
            ) : (
                <button
                    onClick={() => setRecording(true)}
                    className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 border border-border rounded-md text-xs font-mono font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer min-w-[80px] text-center"
                >
                    {formatCombo(combo)}
                </button>
            )}
        </div>
    );
}


export function GeneralTab({ section }: GeneralTabProps) {
    const { theme, setTheme } = useTheme();
    const [language, setLanguage] = useState<string>(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("ecowatch_language") || "English";
        }
        return "English";
    });
    const [displayTheme, setDisplayTheme] = useState<"light" | "dark" | "system">(() => {
        if (typeof window !== "undefined") {
            const stored = localStorage.getItem("ecowatch_theme_preference");
            if (stored === "light" || stored === "dark" || stored === "system") return stored;
        }
        return theme;
    });
    const { shortcuts, updateShortcut, resetShortcuts } = useShortcutsContext();

    const triggerTranslation = (targetLangCode: string) => {
        setTimeout(() => {
            const googSelect = document.querySelector('.goog-te-combo') as HTMLSelectElement;
            if (googSelect) {
                googSelect.value = targetLangCode;
                googSelect.dispatchEvent(new Event('change'));
            }
        }, 500); // Give widget time to load
    };

    const restoreEnglish = () => {
        const iframe = document.querySelector('.goog-te-banner-frame') as HTMLIFrameElement;
        if (iframe) {
            const innerDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (innerDoc) {
                const restoreBtn = innerDoc.querySelector('button[id*="restore"]') as HTMLButtonElement | null;
                if (restoreBtn) restoreBtn.click();
                return;
            }
        }
        
        document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + location.hostname + ";";
        window.location.reload();
    };

    useEffect(() => {
        const lang = localStorage.getItem("ecowatch_language");
        if (lang === "Filipino") {
            triggerTranslation("tl");
        }
    }, []);

    const handleLanguageSelect = (lang: "English" | "Filipino") => {
        setLanguage(lang);
        localStorage.setItem("ecowatch_language", lang);
        
        if (lang === "Filipino") {
            triggerTranslation("tl");
        } else {
            restoreEnglish();
        }
    };

    const handleThemeSelect = (t: "light" | "dark" | "system") => {
        setDisplayTheme(t);
        localStorage.setItem("ecowatch_theme_preference", t);
        if (t === "system") {
            const sys = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
            setTheme(sys);
        } else {
            setTheme(t);
        }
    };

    if (section === "language") {
        return (
            <div className="animate-fade-in max-w-2xl">
                <h2 className="text-lg font-bold text-foreground mb-1">Language</h2>
                <p className="text-sm text-muted-foreground mb-8">Choose your preferred display language.</p>

                <div className="space-y-8">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-3">Display Language</label>
                        <div className="p-1 bg-secondary rounded-lg inline-flex">
                            <button
                                onClick={() => handleLanguageSelect("English")}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${language === "English" ? "bg-background shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                English
                            </button>
                            <button
                                onClick={() => handleLanguageSelect("Filipino")}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${language === "Filipino" ? "bg-background shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                Filipino
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        );
    }

    if (section === "appearance") {
        return (
            <div className="animate-fade-in max-w-3xl">
                <h2 className="text-lg font-bold text-foreground mb-1">Appearance</h2>
                <p className="text-sm text-muted-foreground mb-8">Choose your style or customize your theme.</p>

                <div className="space-y-8">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-3">Theme</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {/* Light Mode */}
                            <button
                                onClick={() => handleThemeSelect("light")}
                                className={`p-4 rounded-xl border-2 transition-all text-left ${displayTheme === "light" ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border hover:shadow-md hover:border-primary/50"}`}
                            >
                                <div className="h-28 rounded-lg border border-border/50 bg-white p-2 mb-4 shadow-sm flex flex-col gap-2">
                                    <div className="h-4 w-1/3 bg-slate-200 rounded"></div>
                                    <div className="flex gap-2 flex-1">
                                        <div className="w-1/4 bg-slate-100 rounded border border-slate-200"></div>
                                        <div className="flex-1 bg-slate-50 rounded border border-slate-200 flex flex-col gap-1.5 p-1.5">
                                            <div className="h-2 w-1/2 bg-slate-200 rounded"></div>
                                            <div className="h-2 w-full bg-slate-200 rounded"></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${displayTheme === "light" ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                                        {displayTheme === "light" && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                    </div>
                                    <span className="text-sm font-medium text-foreground">Light Mode</span>
                                </div>
                            </button>

                            {/* Dark Mode */}
                            <button
                                onClick={() => handleThemeSelect("dark")}
                                className={`p-4 rounded-xl border-2 transition-all text-left ${displayTheme === "dark" ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border hover:shadow-md hover:border-primary/50"}`}
                            >
                                <div className="h-28 rounded-lg border border-zinc-700 bg-zinc-950 p-2 mb-4 shadow-sm flex flex-col gap-2">
                                    <div className="h-4 w-1/3 bg-zinc-800 rounded"></div>
                                    <div className="flex gap-2 flex-1">
                                        <div className="w-1/4 bg-zinc-900 rounded border border-zinc-800"></div>
                                        <div className="flex-1 bg-zinc-900 rounded border border-zinc-800 flex flex-col gap-1.5 p-1.5">
                                            <div className="h-2 w-1/2 bg-zinc-800 rounded"></div>
                                            <div className="h-2 w-full bg-zinc-800 rounded"></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${displayTheme === "dark" ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                                        {displayTheme === "dark" && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                    </div>
                                    <span className="text-sm font-medium text-foreground">Dark Mode</span>
                                </div>
                            </button>

                            {/* System Preference */}
                            <button
                                onClick={() => handleThemeSelect("system")}
                                className={`p-4 rounded-xl border-2 transition-all text-left ${displayTheme === "system" ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border hover:shadow-md hover:border-primary/50"}`}
                            >
                                <div className="h-28 rounded-lg border border-border/50 bg-gradient-to-r from-white to-zinc-950 mb-4 shadow-sm flex overflow-hidden">
                                     <div className="flex-1 p-2 flex flex-col gap-2 border-r border-border/50">
                                         <div className="h-4 w-1/3 bg-slate-200 rounded"></div>
                                         <div className="flex-1 bg-slate-50 rounded border border-slate-200"></div>
                                     </div>
                                     <div className="flex-1 p-2 flex flex-col gap-2">
                                         <div className="h-4 w-1/3 bg-zinc-800 rounded"></div>
                                         <div className="flex-1 bg-zinc-900 rounded border border-zinc-800"></div>
                                     </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${displayTheme === "system" ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                                        {displayTheme === "system" && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                    </div>
                                    <span className="text-sm font-medium text-foreground">System</span>
                                </div>
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        );
    }

    if (section === "shortcuts") {
        return (
            <div className="animate-fade-in max-w-2xl">
                <div className="flex items-start justify-between mb-8">
                    <div>
                        <h2 className="text-lg font-bold text-foreground mb-1">Keyboard Shortcuts</h2>
                        <p className="text-sm text-muted-foreground">Customize your keyboard shortcuts. Click a key combination to record a new one.</p>
                    </div>
                    <button 
                        onClick={resetShortcuts}
                        className="flex items-center gap-2 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground text-sm font-medium rounded-md transition-colors border border-border"
                    >
                        <RotateCcw size={14} />
                        Reset Defaults
                    </button>
                </div>

                <div className="bg-card rounded-xl border border-border overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border last:border-0 hover:bg-secondary/10 transition-colors opacity-70">
                        <span className="text-sm font-medium text-foreground">Jump to sidebar tab by index</span>
                        <div className="px-3 py-1.5 bg-secondary border border-border rounded-md text-xs font-mono font-semibold text-muted-foreground min-w-[80px] text-center cursor-not-allowed">
                            Alt + 1-9
                        </div>
                    </div>
                    {(Object.keys(shortcuts) as ShortcutAction[]).map((action) => (
                        <KeybindingRow 
                            key={action}
                            action={action}
                            combo={shortcuts[action]}
                            onUpdate={updateShortcut}
                        />
                    ))}
                </div>
            </div>
        );
    }

    return null;
}
