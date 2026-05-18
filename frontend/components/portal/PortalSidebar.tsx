"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { PortalBrand, PortalNavItem } from "./PortalShell";

interface PortalSidebarProps {
    brand: PortalBrand;
    nav: PortalNavItem[];
    activeKey: string;
    onNavChange: (key: string) => void;
    collapsed: boolean;
    onToggleCollapsed: () => void;
}

export function PortalSidebar({
    brand,
    nav,
    activeKey,
    onNavChange,
    collapsed,
    onToggleCollapsed,
}: PortalSidebarProps) {
    return (
        <aside
            className={`${
                collapsed ? "w-16" : "w-60"
            } shrink-0 flex flex-col border-r border-border glass-pro transition-[width] duration-300`}
        >
            {/* Brand */}
            <div
                className={`h-16 flex items-center gap-2 border-b border-border ${
                    collapsed ? "justify-center px-2" : "px-4"
                }`}
            >
                <Link href="/" className="flex items-center gap-2 group">
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-white ring-1 ring-primary/40 flex items-center justify-center p-1 group-hover:scale-105 transition-transform">
                        <img
                            src="/logo.png"
                            alt={brand.name}
                            className="w-full h-full object-contain"
                        />
                    </div>
                    {!collapsed && (
                        <div className="flex flex-col leading-none">
                            <span className="text-base font-semibold text-gradient">
                                {brand.name}
                            </span>
                            {brand.suffix && (
                                <span className="text-[10px] uppercase tracking-widest text-foreground/50 mt-0.5">
                                    {brand.suffix}
                                </span>
                            )}
                        </div>
                    )}
                </Link>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1 scrollbar-hide">
                {nav.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.key === activeKey;
                    return (
                        <div key={item.key}>
                            {item.sectionBreakBefore && (
                                <div className="my-2 mx-2 border-t border-border" />
                            )}
                            <button
                                type="button"
                                onClick={() => onNavChange(item.key)}
                                title={collapsed ? item.label : undefined}
                                className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-colors border-l-2 ${
                                    collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
                                } ${
                                    isActive
                                        ? "bg-primary/15 text-primary border-primary"
                                        : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground border-transparent"
                                }`}
                            >
                                <Icon className="size-5 shrink-0" />
                                {!collapsed && (
                                    <div className="flex-1 text-left leading-tight min-w-0">
                                        <div className="truncate">{item.label}</div>
                                        {item.subtitle && (
                                            <div
                                                className={`text-[10px] font-normal mt-0.5 truncate ${
                                                    isActive
                                                        ? "text-primary/70"
                                                        : "text-foreground/40"
                                                }`}
                                            >
                                                {item.subtitle}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </button>
                        </div>
                    );
                })}
            </nav>

            {/* Bottom: theme toggle + collapse */}
            <div
                className={`border-t border-border p-3 flex items-center ${
                    collapsed ? "flex-col gap-2" : "justify-between gap-2"
                }`}
            >
                <div className="flex items-center gap-2">
                    <ThemeToggle />
                    {!collapsed && (
                        <span className="text-xs text-foreground/60 font-medium">
                            Theme
                        </span>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onToggleCollapsed}
                    className="size-9 rounded-md flex items-center justify-center text-foreground/60 hover:bg-foreground/5 hover:text-foreground transition-colors"
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {collapsed ? (
                        <ChevronRight className="size-4" />
                    ) : (
                        <ChevronLeft className="size-4" />
                    )}
                </button>
            </div>
        </aside>
    );
}
