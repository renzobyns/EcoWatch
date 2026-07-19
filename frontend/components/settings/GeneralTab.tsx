"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/components/ThemeProvider";

interface GeneralTabProps {
    section: "language" | "appearance" | "shortcuts";
}

export function GeneralTab({ section }: GeneralTabProps) {
    const { theme, setTheme } = useTheme();
    const [language, setLanguage] = useState("English");
    const [dateFormat, setDateFormat] = useState("MM/DD/YYYY");
    const [showAnimations, setShowAnimations] = useState(true);
    const [compactMode, setCompactMode] = useState(false);
    
    // Custom state for system theme preference if we support it via local storage
    const [displayTheme, setDisplayTheme] = useState<"light" | "dark" | "system">("system");

    useEffect(() => {
        const lang = localStorage.getItem("ecowatch_language");
        if (lang) setLanguage(lang);
        const format = localStorage.getItem("ecowatch_date_format");
        if (format) setDateFormat(format);
        const anim = localStorage.getItem("ecowatch_animations");
        if (anim) setShowAnimations(anim === "true");
        const compact = localStorage.getItem("ecowatch_compact");
        if (compact) setCompactMode(compact === "true");
        
        const storedThemePref = localStorage.getItem("ecowatch_theme_preference");
        if (storedThemePref) {
            setDisplayTheme(storedThemePref as any);
        } else {
            setDisplayTheme(theme);
        }
    }, [theme]);

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
                <h2 className="text-lg font-bold text-foreground mb-1">Language & Region</h2>
                <p className="text-sm text-muted-foreground mb-8">Choose your preferred language and regional settings.</p>

                <div className="space-y-8">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-3">Display Language</label>
                        <div className="p-1 bg-secondary rounded-lg inline-flex">
                            <button
                                onClick={() => { setLanguage("English"); localStorage.setItem("ecowatch_language", "English"); }}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${language === "English" ? "bg-background shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                English
                            </button>
                            <button
                                onClick={() => { setLanguage("Filipino"); localStorage.setItem("ecowatch_language", "Filipino"); }}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${language === "Filipino" ? "bg-background shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                Filipino
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-3">Date Format</label>
                        <select
                            value={dateFormat}
                            onChange={(e) => { setDateFormat(e.target.value); localStorage.setItem("ecowatch_date_format", e.target.value); }}
                            className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
                        >
                            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-3">Timezone</label>
                        <input
                            type="text"
                            disabled
                            value="Asia/Manila (UTC+8)"
                            className="bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground cursor-not-allowed w-full max-w-sm"
                        />
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

                    <div className="py-4 border-y border-border/50 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-foreground">Show Animations</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Enable or disable UI micro-animations</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={showAnimations} onChange={() => {
                                setShowAnimations(!showAnimations);
                                localStorage.setItem("ecowatch_animations", String(!showAnimations));
                            }} />
                            <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                    </div>

                    <div className="pb-4 border-b border-border/50 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-foreground">Compact Mode</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Reduce padding and spacing across dashboards</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={compactMode} onChange={() => {
                                setCompactMode(!compactMode);
                                localStorage.setItem("ecowatch_compact", String(!compactMode));
                            }} />
                            <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                    </div>

                </div>
            </div>
        );
    }

    if (section === "shortcuts") {
        return (
            <div className="animate-fade-in max-w-2xl">
                <h2 className="text-lg font-bold text-foreground mb-1">Keyboard Shortcuts</h2>
                <p className="text-sm text-muted-foreground mb-8">Quick reference for available keyboard shortcuts.</p>

                <div className="bg-card rounded-xl border border-border overflow-hidden">
                    {[
                        { key: "Ctrl + K", desc: "Quick Search" },
                        { key: "Alt + 1–9", desc: "Jump to sidebar tab" },
                        { key: "Ctrl + E", desc: "Export current view" },
                        { key: "Escape", desc: "Close modal or drawer" },
                        { key: "Ctrl + /", desc: "Toggle shortcuts reference" },
                    ].map((shortcut, i) => (
                        <div key={i} className="flex items-center justify-between px-6 py-4 border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                            <kbd className="px-2 py-1 bg-secondary border border-border rounded text-xs font-mono font-semibold text-foreground">{shortcut.key}</kbd>
                            <span className="text-sm text-muted-foreground">{shortcut.desc}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return null;
}
