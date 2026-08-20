"use client";

import { useEffect, useState, useRef } from "react";
import { Search, X, Settings } from "lucide-react";
import type { PortalNavItem } from "./portal/PortalShell";

interface QuickSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    nav: PortalNavItem[];
    onNavChange: (key: string) => void;
    onOpenSettings: () => void;
}

export function QuickSearchModal({ isOpen, onClose, nav, onNavChange, onOpenSettings }: QuickSearchModalProps) {
    const [query, setQuery] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 10);
        } else {
            setQuery("");
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const searchableItems = [
        ...nav,
        { key: "settings", label: "Settings", icon: Settings }
    ];

    const filtered = searchableItems.filter(i => i.label.toLowerCase().includes(query.toLowerCase()));

    const handleSelect = (key: string) => {
        if (key === "settings") {
            onOpenSettings();
        } else {
            onNavChange(key);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-border">
                <div className="flex items-center px-4 py-3 border-b border-border/50">
                    <Search size={20} className="text-muted-foreground mr-3" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search pages or reports..."
                        className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") onClose();
                            if (e.key === "Enter" && filtered.length > 0) {
                                handleSelect(filtered[0].key);
                            }
                        }}
                    />
                    <button onClick={onClose} className="p-1 hover:bg-secondary rounded-md text-muted-foreground">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-2 max-h-[40vh] overflow-y-auto">
                    {filtered.length > 0 ? (
                        filtered.map((item, i) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={i}
                                    onClick={() => handleSelect(item.key)}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-secondary/50 rounded-xl transition-colors text-left"
                                >
                                    <span className="text-muted-foreground"><Icon size={16} /></span>
                                    <span className="font-medium">{item.label}</span>
                                </button>
                            );
                        })
                    ) : (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            No results found for "{query}"
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
