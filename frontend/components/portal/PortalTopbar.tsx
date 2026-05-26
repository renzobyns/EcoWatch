"use client";

import { useEffect, useState } from "react";
import { ProfileDropdown } from "./ProfileDropdown";
import { NotificationDropdown } from "./NotificationDropdown";

interface PortalTopbarProps {
    role: string;
    pageBadge: string;
    notificationCount?: number;
}

interface StoredUser { id?: number; }

function emitOpenTarget(detail: { report_id: number | null; work_order_id: number | null; kind: string }) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("ecowatch:open-target", { detail }));
}

export function PortalTopbar({ role, pageBadge, notificationCount = 0 }: PortalTopbarProps) {
    const [userId, setUserId] = useState<number | null>(null);
    useEffect(() => {
        try {
            const stored = localStorage.getItem("ecowatch_user");
            if (stored) {
                const u: StoredUser = JSON.parse(stored);
                if (typeof u.id === "number") setUserId(u.id);
            }
        } catch { /* ignore */ }
    }, []);

    const listPath = userId != null ? `/notifications/user/${userId}?limit=50` : "";
    const markAllPath = userId != null ? `/notifications/user/${userId}/mark-all-read` : "";

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
                {userId != null && (
                    <NotificationDropdown
                        unreadCount={notificationCount}
                        listPath={listPath}
                        markAllPath={markAllPath}
                        onNotificationClick={(n) => emitOpenTarget({
                            report_id: n.report_id,
                            work_order_id: n.work_order_id,
                            kind: n.kind,
                        })}
                    />
                )}
                <div className="h-6 w-px bg-border" />
                <ProfileDropdown />
            </div>
        </header>
    );
}
