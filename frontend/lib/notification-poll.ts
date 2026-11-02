"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const UNREAD_POLL_MS = 30000;

export function useUnreadNotificationCount(userId: number | null | undefined) {
    const [unread, setUnread] = useState(0);
    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        const tick = async () => {
            // Cancel poll if user switched in localStorage (e.g. multi-tab login)
            if (typeof window !== "undefined") {
                try {
                    const raw = localStorage.getItem("ecowatch_user");
                    if (raw) {
                        const current = JSON.parse(raw);
                        if (current?.id && current.id !== userId) {
                            cancelled = true;
                            clearInterval(id);
                            return;
                        }
                    }
                } catch {
                    /* ignore parsing error */
                }
            }

            try {
                const data = await api(`/notifications/user/${userId}/unread-count`);
                if (!cancelled && typeof data?.unread_count === "number") {
                    setUnread(data.unread_count);
                }
            } catch (err: any) {
                // If 403 Forbidden (auth mismatch from stale session), terminate polling immediately
                if (err?.status === 403) {
                    cancelled = true;
                    clearInterval(id);
                }
            }
        };
        tick();
        const id = setInterval(tick, UNREAD_POLL_MS);
        return () => { cancelled = true; clearInterval(id); };
    }, [userId]);
    return [unread, setUnread] as const;
}
