"use client";

import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Grid, Menu, X } from "lucide-react";
import { PortalSidebar } from "./PortalSidebar";
import { PortalTopbar } from "./PortalTopbar";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { QuickSearchModal } from "@/components/QuickSearchModal";
import { ShortcutsOverlay } from "@/components/ShortcutsOverlay";

export type PortalNavCategory = 'operations' | 'performance' | 'admin';

export type PortalNavItem = {
    key: string;
    label: string;
    icon: LucideIcon;
    subtitle?: string;
    sectionBreakBefore?: boolean;
    badge?: number;
    category?: PortalNavCategory;
};

export type PortalBrand = {
    name: string;
    suffix?: string;
};

interface PortalShellProps {
    brand: PortalBrand;
    role: string;
    nav: PortalNavItem[];
    activeKey: string;
    onNavChange: (key: string) => void;
    notificationCount?: number;
    actions?: React.ReactNode;
    scrollable?: boolean;
    mobileNavStyle?: "gotyme" | "standard" | "auto";
    children: ReactNode;
}

const COLLAPSED_STORAGE_KEY = "ecowatch_sidebar_collapsed";

const CATEGORY_CONFIG: { id: PortalNavCategory; title: string; subtitle: string }[] = [
    { id: 'operations', title: 'Operations', subtitle: 'Pangunahing Aksyon' },
    { id: 'performance', title: 'Performance & Oversight', subtitle: 'Pagsubaybay' },
    { id: 'admin', title: 'Admin & Records', subtitle: 'Pangangasiwa' },
];

export function PortalShell({
    brand,
    role,
    nav,
    activeKey,
    onNavChange,
    notificationCount,
    actions,
    scrollable = true,
    mobileNavStyle = "auto",
    children,
}: PortalShellProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useKeyboardShortcuts({
        quickSearch: () => setSearchOpen(true),
        helpOverlay: () => setShortcutsOpen(true),
        closeModals: () => {
            setSearchOpen(false);
            setShortcutsOpen(false);
            setSettingsOpen(false);
            setMobileMenuOpen(false);
        },
        goDashboard: () => onNavChange(nav[0]?.key),
        goReports: () => onNavChange(nav.find(n => n.key === 'reports' || n.label.includes('Reports'))?.key || nav[1]?.key),
        goSettings: () => setSettingsOpen(true),
    });

    // Hardcoded Alt + 1-9 to jump to sidebar tabs by index
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
            if (e.altKey && !e.ctrlKey && !e.shiftKey) {
                const num = parseInt(e.key);
                if (!isNaN(num) && num >= 1 && num <= 9) {
                    const idx = num - 1;
                    const item = nav.filter(n => !n.sectionBreakBefore || n.sectionBreakBefore)[idx];
                    if (item) {
                        e.preventDefault();
                        onNavChange(item.key);
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [nav, onNavChange]);

    useEffect(() => {
        const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY);
        if (stored === "1") setCollapsed(true);
    }, []);

    // Listen for the custom event from ProfileDropdown to open settings modal
    useEffect(() => {
        const handler = () => setSettingsOpen(true);
        window.addEventListener("ecowatch:open-settings", handler);
        return () => window.removeEventListener("ecowatch:open-settings", handler);
    }, []);

    // Close mobile menu on Escape
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && mobileMenuOpen) {
                setMobileMenuOpen(false);
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [mobileMenuOpen]);

    const toggleCollapsed = () => {
        setCollapsed((prev) => {
            const next = !prev;
            localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
            return next;
        });
    };

    const handleSettingsClose = useCallback(() => setSettingsOpen(false), []);

    const pageBadge = nav.find((n) => n.key === activeKey)?.label ?? "";

    // Categorized groups for GoTyme-style mobile menu
    const categorizedNav = useMemo(() => {
        const groups: Record<PortalNavCategory, PortalNavItem[]> = {
            operations: [],
            performance: [],
            admin: [],
        };
        nav.forEach((item, index) => {
            if (item.category && groups[item.category]) {
                groups[item.category].push(item);
            } else {
                if (index < 3) groups.operations.push(item);
                else if (index < 6) groups.performance.push(item);
                else groups.admin.push(item);
            }
        });
        return groups;
    }, [nav]);

    // Determine bottom dock slots (for rich portals with >4 items)
    const primarySlotItem = nav[0]; // Usually Dashboard
    const secondarySlotItem = useMemo(() => {
        if (activeKey !== primarySlotItem?.key) {
            return nav.find(n => n.key === activeKey) || nav[1];
        }
        return nav[1] || nav[0];
    }, [nav, activeKey, primarySlotItem]);

    const hasAnyBadge = nav.some(item => Boolean(item.badge && item.badge > 0));
    const isGotymeNav = mobileNavStyle === "gotyme" || (mobileNavStyle === "auto" && nav.length > 5);

    return (
        <div className="-mt-20 h-[100dvh] sm:h-screen w-full flex bg-background overflow-hidden">
            <PortalSidebar
                brand={brand}
                nav={nav}
                activeKey={activeKey}
                onNavChange={onNavChange}
                collapsed={collapsed}
                onToggleCollapsed={toggleCollapsed}
            />
            <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
                <div className="relative z-40">
                    <PortalTopbar
                        role={role}
                        pageBadge={pageBadge}
                        notificationCount={notificationCount}
                        actions={actions}
                        onOpenMobileMenu={isGotymeNav ? () => setMobileMenuOpen(true) : undefined}
                    />
                </div>
                <div role="region" aria-label="Portal content" className={`relative flex-1 ${activeKey === "map_view" ? "flex flex-col h-full overflow-hidden p-0" : "flex flex-col " + (scrollable ? "overflow-y-auto" : "overflow-hidden") + " overflow-x-hidden px-3 sm:px-4 md:px-8 pt-4 sm:pt-6 pb-24 md:pb-6"}`}>
                    {children}
                </div>

                {/* Mobile Bottom Navigation */}
                {isGotymeNav ? (
                    /* GoTyme Bank-Inspired 3-Element Floating Dock */
                    <div className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-background/95 backdrop-blur-md border-t border-border flex items-center justify-around px-4 py-2 shadow-[0_-4px_25px_-5px_rgba(0,0,0,0.15)] pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
                        {/* Slot 1: Primary Tab (Dashboard) */}
                        {primarySlotItem && (() => {
                            const Icon = primarySlotItem.icon;
                            const isActive = primarySlotItem.key === activeKey;
                            return (
                                <button
                                    type="button"
                                    onClick={() => onNavChange(primarySlotItem.key)}
                                    className={`flex flex-col items-center justify-center w-20 h-14 gap-1 rounded-xl transition-all ${
                                        isActive 
                                            ? "text-primary" 
                                            : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                                    }`}
                                >
                                    <div className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-all ${isActive ? "bg-primary/15" : "bg-transparent"}`}>
                                        <Icon className={`size-5 ${isActive ? "scale-110" : "scale-100"}`} strokeWidth={isActive ? 2.5 : 2} />
                                        {Boolean(primarySlotItem.badge && primarySlotItem.badge > 0) && (
                                            <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-bold rounded-full px-1 min-w-[15px] h-[15px] flex items-center justify-center">
                                                {primarySlotItem.badge}
                                            </span>
                                        )}
                                    </div>
                                    <span className={`text-[10px] leading-none tracking-tight ${isActive ? "font-semibold text-primary" : "font-medium"}`}>
                                        {primarySlotItem.label}
                                    </span>
                                </button>
                            );
                        })()}

                        {/* Slot 2: GoTyme Elevated Action Menu Button */}
                        <div className="relative flex flex-col items-center justify-center">
                            <button
                                type="button"
                                onClick={() => setMobileMenuOpen(true)}
                                aria-label="Open navigation menu"
                                className="relative -mt-6 w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-600 via-primary to-teal-500 text-white shadow-lg shadow-primary/30 border-4 border-background flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-300 focus:outline-none"
                            >
                                <Grid size={22} strokeWidth={2.5} />
                                {hasAnyBadge && (
                                    <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-amber-500 rounded-full ring-2 ring-background animate-pulse" />
                                )}
                            </button>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/80 mt-1">
                                Menu
                            </span>
                        </div>

                        {/* Slot 3: Contextual / Secondary Quick Jump Tab */}
                        {secondarySlotItem && (() => {
                            const Icon = secondarySlotItem.icon;
                            const isActive = secondarySlotItem.key === activeKey;
                            return (
                                <button
                                    type="button"
                                    onClick={() => onNavChange(secondarySlotItem.key)}
                                    className={`flex flex-col items-center justify-center w-20 h-14 gap-1 rounded-xl transition-all ${
                                        isActive 
                                            ? "text-primary" 
                                            : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                                    }`}
                                >
                                    <div className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-all ${isActive ? "bg-primary/15" : "bg-transparent"}`}>
                                        <Icon className={`size-5 ${isActive ? "scale-110" : "scale-100"}`} strokeWidth={isActive ? 2.5 : 2} />
                                        {Boolean(secondarySlotItem.badge && secondarySlotItem.badge > 0) && (
                                            <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-bold rounded-full px-1 min-w-[15px] h-[15px] flex items-center justify-center">
                                                {secondarySlotItem.badge}
                                            </span>
                                        )}
                                    </div>
                                    <span className={`text-[10px] leading-none tracking-tight truncate max-w-[72px] ${isActive ? "font-semibold text-primary" : "font-medium"}`}>
                                        {secondarySlotItem.label}
                                    </span>
                                </button>
                            );
                        })()}
                    </div>
                ) : (
                    /* Standard Compact Bottom Bar for Portals with <=4 items */
                    <div className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-background/95 backdrop-blur-md border-t border-border flex items-center justify-around px-1 py-1 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.15)] pb-[calc(env(safe-area-inset-bottom)+0.25rem)]">
                        {nav.map((item) => {
                            const Icon = item.icon;
                            const isActive = item.key === activeKey;
                            return (
                                <button
                                    key={item.key}
                                    onClick={() => onNavChange(item.key)}
                                    className={`flex flex-col items-center justify-center flex-1 max-w-[5rem] h-14 gap-0.5 rounded-xl transition-all ${
                                        isActive 
                                            ? "text-primary" 
                                            : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                                    }`}
                                >
                                    <div className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-all ${isActive ? "bg-primary/15" : "bg-transparent"}`}>
                                        <Icon className={`size-5 ${isActive ? "scale-110" : "scale-100 transition-transform"}`} strokeWidth={isActive ? 2.5 : 2} />
                                        {Boolean(item.badge && item.badge > 0) && (
                                            <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-bold rounded-full px-1 min-w-[15px] h-[15px] flex items-center justify-center">
                                                {item.badge}
                                            </span>
                                        )}
                                    </div>
                                    <span className={`text-[10px] leading-tight tracking-tight text-center truncate max-w-[64px] ${isActive ? "font-semibold" : "font-medium"}`}>
                                        {item.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* GoTyme-Inspired Full Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div className="md:hidden fixed inset-0 z-[100] flex flex-col bg-background/95 backdrop-blur-2xl animate-in fade-in duration-200">
                    {/* Top Header */}
                    <div className="h-16 shrink-0 flex items-center justify-between border-b border-border/80 px-5 bg-background/60">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-white ring-1 ring-primary/40 flex items-center justify-center p-1">
                                <img src="/logo.png" alt={brand.name} className="w-full h-full object-contain" />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-foreground tracking-tight flex items-center gap-2">
                                    {brand.name}
                                    <span className="text-[10px] uppercase font-semibold text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                                        {role}
                                    </span>
                                </div>
                                <div className="text-[11px] text-muted-foreground font-medium">Portal Navigation</div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setMobileMenuOpen(false)}
                            aria-label="Close menu"
                            className="w-10 h-10 rounded-full bg-muted/80 text-foreground flex items-center justify-center hover:bg-muted active:scale-95 transition-all"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Categorized Menu Content */}
                    <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 pb-28">
                        {CATEGORY_CONFIG.map((cat) => {
                            const items = categorizedNav[cat.id];
                            if (!items || items.length === 0) return null;
                            return (
                                <div key={cat.id} className="space-y-3">
                                    <div className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground/80 flex items-center gap-2">
                                        <span>{cat.title}</span>
                                        <span className="h-px flex-1 bg-border/60" />
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        {items.map((item) => {
                                            const Icon = item.icon;
                                            const isActive = item.key === activeKey;
                                            return (
                                                <button
                                                    key={item.key}
                                                    type="button"
                                                    onClick={() => {
                                                        onNavChange(item.key);
                                                        setMobileMenuOpen(false);
                                                    }}
                                                    className={`flex flex-col items-center justify-start text-center p-2.5 rounded-2xl transition-all duration-200 active:scale-95 ${
                                                        isActive
                                                            ? "bg-primary/10 ring-2 ring-primary/50 text-primary shadow-sm"
                                                            : "bg-card border border-border/70 hover:bg-muted/50 text-foreground"
                                                    }`}
                                                >
                                                    <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center mb-2 transition-all ${
                                                        isActive
                                                            ? "bg-primary text-white shadow-md shadow-primary/30"
                                                            : "bg-muted/80 text-foreground/80"
                                                    }`}>
                                                        <Icon className={`size-6 ${isActive ? "text-white" : "text-foreground/80"}`} strokeWidth={isActive ? 2.5 : 2} />
                                                        {Boolean(item.badge && item.badge > 0) && (
                                                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-background shadow-sm">
                                                                {item.badge}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className={`text-xs font-semibold leading-tight line-clamp-2 px-1 ${
                                                        isActive ? "text-primary font-bold" : "text-foreground/90"
                                                    }`}>
                                                        {item.label}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* GoTyme Animated "Tap to close" Petal Button */}
                    <div className="fixed bottom-6 inset-x-0 flex justify-center z-[110] pointer-events-none">
                        <button
                            type="button"
                            onClick={() => setMobileMenuOpen(false)}
                            className="pointer-events-auto relative group flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-emerald-600 via-primary to-teal-600 text-white font-semibold text-sm shadow-xl shadow-primary/30 ring-4 ring-background/60 hover:scale-105 active:scale-95 transition-all"
                        >
                            <span className="absolute -inset-1 rounded-full bg-primary/30 blur-md group-hover:bg-primary/50 transition-all -z-10 animate-pulse" />
                            <X size={16} strokeWidth={2.5} />
                            <span>Tap to close</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Floating Settings Modal */}
            <SettingsModal open={settingsOpen} onClose={handleSettingsClose} role={role as any} />

            {/* Shortcut Overlays */}
            <QuickSearchModal 
                isOpen={searchOpen} 
                onClose={() => setSearchOpen(false)} 
                nav={nav}
                onNavChange={onNavChange}
                onOpenSettings={() => setSettingsOpen(true)}
            />
            <ShortcutsOverlay isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        </div>
    );
}
