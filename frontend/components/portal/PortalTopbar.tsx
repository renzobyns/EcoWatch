"use client";

import { Bell } from "lucide-react";
import { ProfileDropdown } from "./ProfileDropdown";

interface PortalTopbarProps {
    role: string;
    pageBadge: string;
    notificationCount?: number;
}

export function PortalTopbar({
    role,
    pageBadge,
    notificationCount = 0,
}: PortalTopbarProps) {
    return (
        <header className="h-16 shrink-0 flex items-center justify-between border-b border-border glass px-4 md:px-6">
            <div className="flex items-center gap-3 min-w-0">
                <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-foreground/50 shrink-0">
                    {role}
                </span>
                <span className="h-5 w-px bg-border shrink-0" />
                {pageBadge && (
                    <span className="px-3 py-1 rounded-full bg-primary/15 text-primary text-[11px] font-bold uppercase tracking-widest border border-primary/30 truncate">
                        {pageBadge}
                    </span>
                )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
                <button
                    type="button"
                    className="relative size-10 rounded-full flex items-center justify-center text-foreground/70 hover:bg-foreground/5 hover:text-foreground transition-colors"
                    aria-label={`${notificationCount} notifications`}
                >
                    <Bell className="size-5" />
                    {notificationCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                            {notificationCount > 99 ? "99+" : notificationCount}
                        </span>
                    )}
                </button>
                <div className="h-6 w-px bg-border" />
                <ProfileDropdown />
            </div>
        </header>
    );
}
