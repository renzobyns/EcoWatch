"use client";

import { useCallback, useRef } from "react";

/**
 * Hook to detect 5 rapid clicks on the EcoWatch logo within 2 seconds
 * to trigger the secret developer options modal.
 */
export function useDevTrigger(requiredClicks = 5, timeWindowMs = 2000) {
    const clickTimestamps = useRef<number[]>([]);

    const handleLogoClick = useCallback((e?: React.MouseEvent) => {
        const now = Date.now();
        clickTimestamps.current = clickTimestamps.current.filter((t) => now - t < timeWindowMs);
        clickTimestamps.current.push(now);

        if (clickTimestamps.current.length >= requiredClicks) {
            clickTimestamps.current = [];
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("ecowatch:open-dev-options"));
            }
        }
    }, [requiredClicks, timeWindowMs]);

    return { handleLogoClick };
}
