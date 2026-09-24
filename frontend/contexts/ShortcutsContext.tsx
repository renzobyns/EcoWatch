"use client";

import React, { createContext, useContext, useSyncExternalStore, useCallback, useMemo } from "react";

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

function subscribe(callback: () => void) {
    window.addEventListener("storage", callback);
    window.addEventListener("ecowatch:shortcuts-updated", callback);
    return () => {
        window.removeEventListener("storage", callback);
        window.removeEventListener("ecowatch:shortcuts-updated", callback);
    };
}

function getSnapshot(): string {
    try {
        return localStorage.getItem("ecowatch_shortcuts") ?? "";
    } catch {
        return "";
    }
}

function getServerSnapshot(): string {
    return "";
}

export function ShortcutsProvider({ children }: { children: React.ReactNode }) {
    const rawShortcuts = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const shortcuts = useMemo<ShortcutsMap>(() => {
        if (!rawShortcuts) return DEFAULT_SHORTCUTS;
        try {
            const parsed = JSON.parse(rawShortcuts);
            return { ...DEFAULT_SHORTCUTS, ...parsed };
        } catch {
            return DEFAULT_SHORTCUTS;
        }
    }, [rawShortcuts]);

    const updateShortcut = useCallback((action: ShortcutAction, combination: string) => {
        try {
            const current = localStorage.getItem("ecowatch_shortcuts");
            const parsed = current ? JSON.parse(current) : {};
            const next = { ...DEFAULT_SHORTCUTS, ...parsed, [action]: combination.toLowerCase() };
            localStorage.setItem("ecowatch_shortcuts", JSON.stringify(next));
            window.dispatchEvent(new Event("ecowatch:shortcuts-updated"));
        } catch { /* ignore */ }
    }, []);

    const resetShortcuts = useCallback(() => {
        try {
            localStorage.removeItem("ecowatch_shortcuts");
            window.dispatchEvent(new Event("ecowatch:shortcuts-updated"));
        } catch { /* ignore */ }
    }, []);

    return (
        <ShortcutsContext.Provider value={{ shortcuts, updateShortcut, resetShortcuts }}>
            {children}
        </ShortcutsContext.Provider>
    );
}

export function useShortcutsContext() {
    const context = useContext(ShortcutsContext);
    if (context === undefined) {
        return {
            shortcuts: DEFAULT_SHORTCUTS,
            updateShortcut: () => {},
            resetShortcuts: () => {}
        };
    }
    return context;
}
