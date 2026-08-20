"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type ShortcutAction = 
    | "quickSearch" 
    | "helpOverlay" 
    | "closeModals" 
    | "goDashboard" 
    | "goReports" 
    | "goSettings";

export type ShortcutsMap = Record<ShortcutAction, string>;

export const DEFAULT_SHORTCUTS: ShortcutsMap = {
    quickSearch: "ctrl+k",
    helpOverlay: "shift+?",
    closeModals: "escape",
    goDashboard: "alt+d",
    goReports: "alt+r",
    goSettings: "alt+s",
};

export const ACTION_DESCRIPTIONS: Record<ShortcutAction, string> = {
    quickSearch: "Quick search / jump to",
    helpOverlay: "Show shortcuts help",
    closeModals: "Close modals",
    goDashboard: "Go to Dashboard",
    goReports: "Go to Reports",
    goSettings: "Go to Settings",
};

interface ShortcutsContextType {
    shortcuts: ShortcutsMap;
    updateShortcut: (action: ShortcutAction, combination: string) => void;
    resetShortcuts: () => void;
}

const ShortcutsContext = createContext<ShortcutsContextType | undefined>(undefined);

export function ShortcutsProvider({ children }: { children: React.ReactNode }) {
    const [shortcuts, setShortcuts] = useState<ShortcutsMap>(DEFAULT_SHORTCUTS);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem("ecowatch_shortcuts");
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setShortcuts({ ...DEFAULT_SHORTCUTS, ...parsed });
            } catch (e) {
                console.error("Failed to parse shortcuts", e);
            }
        }
        setMounted(true);
    }, []);

    const updateShortcut = (action: ShortcutAction, combination: string) => {
        setShortcuts(prev => {
            const next = { ...prev, [action]: combination.toLowerCase() };
            localStorage.setItem("ecowatch_shortcuts", JSON.stringify(next));
            return next;
        });
    };

    const resetShortcuts = () => {
        setShortcuts(DEFAULT_SHORTCUTS);
        localStorage.removeItem("ecowatch_shortcuts");
    };

    if (!mounted) {
        return <>{children}</>;
    }

    return (
        <ShortcutsContext.Provider value={{ shortcuts, updateShortcut, resetShortcuts }}>
            {children}
        </ShortcutsContext.Provider>
    );
}

export function useShortcutsContext() {
    const context = useContext(ShortcutsContext);
    if (context === undefined) {
        // Fallback for when context is not available (e.g. before mount)
        return {
            shortcuts: DEFAULT_SHORTCUTS,
            updateShortcut: () => {},
            resetShortcuts: () => {}
        };
    }
    return context;
}
