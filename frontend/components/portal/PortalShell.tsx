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
                    />
                </div>
                <main className="relative z-0 flex-1 overflow-y-auto px-4 md:px-8 py-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
