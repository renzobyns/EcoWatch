"use client";

import { ReactNode, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { PortalSidebar } from "./PortalSidebar";
import { PortalTopbar } from "./PortalTopbar";

export type PortalNavItem = {
    key: string;
    label: string;
    icon: LucideIcon;
    subtitle?: string;
    sectionBreakBefore?: boolean;
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
    children: ReactNode;
}

const COLLAPSED_STORAGE_KEY = "ecowatch_sidebar_collapsed";

export function PortalShell({
    brand,
    role,
    nav,
    activeKey,
    onNavChange,
    notificationCount,
    actions,
    scrollable = true,
    children,
}: PortalShellProps) {
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY);
        if (stored === "1") setCollapsed(true);
    }, []);

    const toggleCollapsed = () => {
        setCollapsed((prev) => {
            const next = !prev;
            localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
            return next;
        });
    };

    const pageBadge = nav.find((n) => n.key === activeKey)?.label ?? "";

    return (
        <div className="-mt-16 h-screen w-full flex bg-background overflow-hidden">
            <PortalSidebar
                brand={brand}
                nav={nav}
                activeKey={activeKey}
                onNavChange={onNavChange}
                collapsed={collapsed}
                onToggleCollapsed={toggleCollapsed}
            />
            <div className="flex-1 flex flex-col min-w-0">
                <div className="relative z-40">
                    <PortalTopbar
                        role={role}
                        pageBadge={pageBadge}
                        notificationCount={notificationCount}
                        actions={actions}
                    />
                </div>
                <main className={`relative flex-1 px-4 md:px-8 py-6 md:pb-6 ${scrollable ? "overflow-y-auto" : "overflow-hidden"}`}>
                    {children}
                    {/* Explicit spacer to prevent content from hiding behind fixed mobile nav (browsers collapse pb on overflow containers) */}
                    <div className="h-24 md:hidden shrink-0" />
                </main>

                {/* Mobile Bottom Navigation */}
                <div className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-background/95 backdrop-blur-md border-t border-border flex items-center justify-around px-1 py-1.5 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.15)] pb-[env(safe-area-inset-bottom)]">
                    {nav.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.key === activeKey;
                        return (
                            <button
                                key={item.key}
                                onClick={() => onNavChange(item.key)}
                                className={`flex flex-col items-center justify-center w-full max-w-[4.5rem] h-14 gap-1 rounded-xl transition-all ${
                                    isActive 
                                        ? "text-primary" 
                                        : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                                }`}
                            >
                                <div className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-all ${isActive ? "bg-primary/15" : "bg-transparent"}`}>
                                    <Icon className={`size-5 ${isActive ? "scale-110" : "scale-100 transition-transform"}`} strokeWidth={isActive ? 2.5 : 2} />
                                </div>
                                <span className={`text-[10px] leading-none tracking-tight ${isActive ? "font-semibold" : "font-medium"}`}>
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
