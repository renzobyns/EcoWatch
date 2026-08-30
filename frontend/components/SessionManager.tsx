"use client";

import { useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

// Inactivity timeout: 4 hours (in milliseconds)
const INACTIVITY_TIMEOUT_MS = 4 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 30 * 1000; // Check every 30 seconds

// Routes that require active authentication and should redirect if expired
const PROTECTED_ROUTE_PREFIXES = [
    "/barangay",
    "/cenro",
    "/cleaner",
    "/profile",
    "/report"
];

export default function SessionManager() {
    const pathname = usePathname();
    const router = useRouter();

    const isProtectedRoute = useCallback((path: string | null) => {
        if (!path) return false;
        return PROTECTED_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
    }, []);

    const handleSessionExpired = useCallback(() => {
        try {
            localStorage.removeItem("ecowatch_user");
            localStorage.removeItem("ecowatch_last_active");
        } catch {
            // Ignore localStorage errors
        }

        if (isProtectedRoute(pathname)) {
            toast.error("Your session has expired due to inactivity. Please sign in again.");
            router.push("/login?expired=1");
        }
    }, [pathname, isProtectedRoute, router]);

    // Record user activity
    const updateActivity = useCallback(() => {
        try {
            const userStr = localStorage.getItem("ecowatch_user");
            if (userStr) {
                localStorage.setItem("ecowatch_last_active", String(Date.now()));
            }
        } catch {
            // Ignore localStorage errors
        }
    }, []);

    useEffect(() => {
        // Initial activity stamp
        updateActivity();

        // Throttled activity event listener
        let lastLogged = Date.now();
        const onUserActivity = () => {
            const now = Date.now();
            if (now - lastLogged > 10000) { // Throttle writes to at most once per 10s
                lastLogged = now;
                updateActivity();
            }
        };

        const events = ["mousedown", "keydown", "touchstart", "scroll"];
        events.forEach((evt) => window.addEventListener(evt, onUserActivity, { passive: true }));

        // Periodic expiration check
        const intervalId = setInterval(() => {
            try {
                const userStr = localStorage.getItem("ecowatch_user");
                if (!userStr) return;

                const lastActiveStr = localStorage.getItem("ecowatch_last_active");
                if (lastActiveStr) {
                    const lastActive = parseInt(lastActiveStr, 10);
                    if (!isNaN(lastActive) && Date.now() - lastActive > INACTIVITY_TIMEOUT_MS) {
                        handleSessionExpired();
                    }
                }
            } catch {
                // Ignore localStorage errors
            }
        }, CHECK_INTERVAL_MS);

        return () => {
            events.forEach((evt) => window.removeEventListener(evt, onUserActivity));
            clearInterval(intervalId);
        };
    }, [updateActivity, handleSessionExpired]);

    // Validate on route transition
    useEffect(() => {
        try {
            const userStr = localStorage.getItem("ecowatch_user");
            if (userStr) {
                const lastActiveStr = localStorage.getItem("ecowatch_last_active");
                if (lastActiveStr) {
                    const lastActive = parseInt(lastActiveStr, 10);
                    if (!isNaN(lastActive) && Date.now() - lastActive > INACTIVITY_TIMEOUT_MS) {
                        handleSessionExpired();
                        return;
                    }
                }
                updateActivity();
            }
        } catch {
            // Ignore localStorage errors
        }
    }, [pathname, updateActivity, handleSessionExpired]);

    return null;
}
