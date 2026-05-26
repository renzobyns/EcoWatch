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
            try {
                const data = await api(`/notifications/user/${userId}/unread-count`);
                if (!cancelled && typeof data?.unread_count === "number") {
                    setUnread(data.unread_count);
                }
            } catch { /* silent — background poll */ }
        };
        tick();
        const id = setInterval(tick, UNREAD_POLL_MS);
        return () => { cancelled = true; clearInterval(id); };
    }, [userId]);
    return [unread, setUnread] as const;
}
