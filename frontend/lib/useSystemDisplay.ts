"use client";

import { useState, useEffect } from "react";
import { api } from "./api";

/**
 * Shared hook to determine whether Developer Telemetry (Gemini Display) is active.
 * Defaults strictly to FALSE (Defense Mode - Pure Mask R-CNN).
 */
export function useSystemDisplay() {
    const [geminiDisplay, setGeminiDisplay] = useState<boolean>(() => {
        if (typeof window !== "undefined") {
            const local = localStorage.getItem("ecowatch_gemini_display");
            if (local !== null) return local === "true";
        }
        return false;
    });

    useEffect(() => {
        let mounted = true;
        const fetchConfig = async () => {
            try {
                const res = await api("/system-config/public");
                if (mounted && res && typeof res.gemini_display === "boolean") {
                    setGeminiDisplay(res.gemini_display);
                    localStorage.setItem("ecowatch_gemini_display", String(res.gemini_display));
                }
            } catch {
                // If offline or network error, safely retain local/default false
            }
        };
        fetchConfig();

        const handleConfigChange = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail && typeof customEvent.detail.gemini_display === "boolean") {
                setGeminiDisplay(customEvent.detail.gemini_display);
            }
        };

        window.addEventListener("ecowatch:config-changed", handleConfigChange);
        return () => {
            mounted = false;
            window.removeEventListener("ecowatch:config-changed", handleConfigChange);
        };
    }, []);

    return { geminiDisplay };
}
