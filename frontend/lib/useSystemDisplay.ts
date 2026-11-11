"use client";

import { useSyncExternalStore, useEffect } from "react";
import { api } from "./api";

function subscribe(callback: () => void) {
    const handleStorage = (e: StorageEvent) => {
        if (e.key === "ecowatch_dev_telemetry" || e.key === "ecowatch_gemini_display") {
            callback();
        }
    };
    const handleCustom = () => callback();

    window.addEventListener("storage", handleStorage);
    window.addEventListener("ecowatch:config-changed", handleCustom);

    return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener("ecowatch:config-changed", handleCustom);
    };
}

function getSnapshot(): boolean {
    if (typeof window === "undefined") return false;
    try {
        const local = localStorage.getItem("ecowatch_dev_telemetry") ?? localStorage.getItem("ecowatch_gemini_display");
        return local === "true";
    } catch {
        return false;
    }
}

function getServerSnapshot(): boolean {
    return false;
}

/**
 * Shared hook to determine whether Developer Telemetry (Gemini Display) is active.
 * Defaults strictly to FALSE (Defense Mode - Pure Mask R-CNN) during SSR.
 */
export function useSystemDisplay() {
    const geminiDisplay = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    useEffect(() => {
        let mounted = true;

        // Scrub legacy key and migrate if needed
        try {
            const legacyGemini = localStorage.getItem("ecowatch_gemini_display");
            if (legacyGemini !== null) {
                if (localStorage.getItem("ecowatch_dev_telemetry") === null) {
                    localStorage.setItem("ecowatch_dev_telemetry", legacyGemini);
                }
                localStorage.removeItem("ecowatch_gemini_display");
                window.dispatchEvent(new CustomEvent("ecowatch:config-changed"));
            }
        } catch {
            // Ignore storage access errors
        }

        // Authoritative check from public endpoint
        const fetchConfig = async () => {
            try {
                const res = await api("/system-config/public", { cache: "no-store" });
                if (mounted && res && typeof res.gemini_display === "boolean") {
                    const currentVal = localStorage.getItem("ecowatch_dev_telemetry");
                    const newVal = String(res.gemini_display);
                    if (currentVal !== newVal) {
                        localStorage.setItem("ecowatch_dev_telemetry", newVal);
                        localStorage.removeItem("ecowatch_gemini_display");
                        window.dispatchEvent(
                            new CustomEvent("ecowatch:config-changed", {
                                detail: { gemini_display: res.gemini_display },
                            })
                        );
                    }
                }
            } catch {
                // If offline or network error, safely retain local/default false
            }
        };
        fetchConfig();

        return () => {
            mounted = false;
        };
    }, []);

    return { geminiDisplay };
}
