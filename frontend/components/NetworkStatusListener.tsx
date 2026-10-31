"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";
import {
    getOutboxReports,
    removeOutboxReport,
    updateOutboxReportStatus,
    type OutboxReportItem,
} from "@/lib/offlineStore";
import { api } from "@/lib/api";

export default function NetworkStatusListener() {
    const [isOnline, setIsOnline] = useState<boolean>(true);
    const [outboxCount, setOutboxCount] = useState<number>(0);
    const [isSyncing, setIsSyncing] = useState<boolean>(false);
    const syncInProgressRef = useRef<boolean>(false);

    const refreshOutboxCount = useCallback(async () => {
        try {
            const reports = await getOutboxReports();
            setOutboxCount(reports.length);
        } catch {
            // Ignore if IndexedDB is not ready
        }
    }, []);

    const processOutbox = useCallback(async () => {
        if (syncInProgressRef.current) return;
        syncInProgressRef.current = true;
        setIsSyncing(true);

        try {
            const pending = await getOutboxReports();
            if (pending.length === 0) {
                setOutboxCount(0);
                return;
            }

            toast.info(`Connection restored! Uploading ${pending.length} pending report(s)...`, {
                id: "outbox-sync-toast",
            });

            let synced = 0;
            for (const item of pending) {
                try {
                    await updateOutboxReportStatus(item.id, "uploading");

                    const formData = new FormData();
                    formData.append("lat", item.lat.toString());
                    formData.append("lon", item.lon.toString());
                    if (item.deviceLat != null && item.deviceLon != null) {
                        formData.append("device_lat", item.deviceLat.toString());
                        formData.append("device_lon", item.deviceLon.toString());
                    }
                    if (item.notes) {
                        formData.append("notes", item.notes);
                    }

                    // Append photos as File objects
                    for (const photo of item.photos) {
                        const file = new File([photo.blob], photo.fileName, {
                            type: photo.fileType || "image/jpeg",
                        });
                        formData.append("images", file);
                    }

                    // Submit to backend
                    const res = await api("/report/submit", {
                        method: "POST",
                        body: formData,
                        headers: {
                            "X-User-Id": item.reporterId.toString(),
                        },
                    });

                    if (res?.tracking_url) {
                        await removeOutboxReport(item.id);
                        synced++;
                    } else {
                        await updateOutboxReportStatus(
                            item.id,
                            "failed",
                            res?.message || "Upload rejected by server"
                        );
                    }
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : "Network error";
                    await updateOutboxReportStatus(item.id, "failed", message);
                }
            }

            const remaining = await getOutboxReports();
            setOutboxCount(remaining.length);

            if (synced > 0) {
                toast.success(
                    `Successfully submitted ${synced} queued report(s) to the City Command Center!`,
                    { duration: 5000 }
                );
            }
        } finally {
            syncInProgressRef.current = false;
            setIsSyncing(false);
        }
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;

        // Register PWA Service Worker for offline app shell caching
        if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
            navigator.serviceWorker
                .register("/sw.js")
                .then((reg) => {
                    console.debug("[PWA] Service Worker registered:", reg.scope);
                })
                .catch((err) => {
                    console.debug("[PWA] Service Worker registration skipped:", err);
                });
        }

        setIsOnline(navigator.onLine);
        refreshOutboxCount();

        const handleOnline = () => {
            setIsOnline(true);
            toast.success("Back online. Checking outbox...", { duration: 3000 });
            processOutbox();
        };

        const handleOffline = () => {
            setIsOnline(false);
            toast.warning("Internet disconnected. Reports will be saved locally on your device.", {
                duration: 4000,
            });
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        // Check if there are un-synced items on mount if already online
        if (navigator.onLine) {
            processOutbox();
        }

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, [processOutbox, refreshOutboxCount]);

    if (isOnline && outboxCount === 0) {
        return null;
    }

    return (
        <div className="fixed bottom-4 left-4 z-[9999] pointer-events-auto animate-in fade-in slide-in-from-bottom-2">
            {!isOnline ? (
                <div className="glass px-3.5 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 flex items-center gap-2 text-xs font-semibold shadow-xl">
                    <WifiOff className="w-4 h-4 shrink-0 text-amber-500 animate-pulse" />
                    <span>Offline Mode — Changes saved to device</span>
                    {outboxCount > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-[10px] font-bold">
                            {outboxCount} queued
                        </span>
                    )}
                </div>
            ) : isSyncing ? (
                <div className="glass px-3.5 py-2 rounded-xl border border-primary/30 bg-primary/10 text-primary flex items-center gap-2 text-xs font-semibold shadow-xl">
                    <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
                    <span>Syncing queued reports ({outboxCount} remaining)...</span>
                </div>
            ) : outboxCount > 0 ? (
                <button
                    onClick={processOutbox}
                    className="glass px-3.5 py-2 rounded-xl border border-primary/40 bg-primary/10 hover:bg-primary/20 text-foreground flex items-center gap-2 text-xs font-semibold shadow-xl transition-all"
                >
                    <Wifi className="w-4 h-4 shrink-0 text-primary" />
                    <span>{outboxCount} pending report(s) ready to sync</span>
                    <span className="text-[11px] text-primary underline ml-1">Sync Now</span>
                </button>
            ) : null}
        </div>
    );
}
