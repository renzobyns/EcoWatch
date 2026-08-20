"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useShortcutsContext, ACTION_DESCRIPTIONS, ShortcutAction } from "@/contexts/ShortcutsContext";

interface ShortcutsOverlayProps {
    isOpen: boolean;
    onClose: () => void;
}

const formatKeyDisplay = (combo: string) => {
    return combo.split('+').map(p => {
        if (p === 'ctrl') return 'Ctrl';
        if (p === 'alt') return 'Alt';
        if (p === 'shift') return 'Shift';
        if (p === 'escape') return 'Esc';
        return p.toUpperCase();
    }).join(' + ');
};

export function ShortcutsOverlay({ isOpen, onClose }: ShortcutsOverlayProps) {
    const { shortcuts } = useShortcutsContext();

    if (!isOpen) return null;

    const shortcutItems = [
        { key: "Alt + 1-9", desc: "Jump to sidebar tab by index" },
        ...Object.entries(shortcuts).map(([action, combo]) => ({
            key: formatKeyDisplay(combo as string),
            desc: ACTION_DESCRIPTIONS[action as ShortcutAction],
        }))
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-border">
                <div className="flex items-center justify-between p-4 border-b border-border/50">
                    <h2 className="font-semibold">Keyboard Shortcuts</h2>
                    <button onClick={onClose} className="p-1 hover:bg-secondary rounded-md text-muted-foreground transition-colors">
                        <X size={18} />
                    </button>
                </div>
                <div className="p-4 space-y-2">
                    {shortcutItems.map((s, i) => (
                        <div key={i} className="flex justify-between items-center text-sm py-2 px-3 hover:bg-secondary/20 rounded-md">
                            <span className="text-muted-foreground">{s.desc}</span>
                            <kbd className="font-mono text-xs font-semibold bg-secondary px-2 py-1 rounded border border-border">
                                {s.key}
                            </kbd>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
