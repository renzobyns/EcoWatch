"use client";

import { useState, useEffect } from "react";
import { Database, Server, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { formatBytes } from "@/lib/format-utils";

interface StorageHealth {
    images_bytes: number;
    images_limit_bytes: number;
    database_bytes: number;
    database_limit_bytes: number;
}

export function StorageSettingsTab() {
    const [storageHealth, setStorageHealth] = useState<StorageHealth | null>(null);
    const [loading, setLoading] = useState(true);
    const [purgePolicy, setPurgePolicy] = useState("never");

    useEffect(() => {
        fetchStorageHealth();
        const storedPolicy = localStorage.getItem("ecowatch_purge_policy");
        if (storedPolicy) setPurgePolicy(storedPolicy);
    }, []);

    const fetchStorageHealth = async () => {
        setLoading(true);
        try {
            const data = await api("/analytics/storage-health");
            setStorageHealth(data);
        } catch (error) {
            console.error("Failed to fetch storage health", error);
        } finally {
            setLoading(false);
        }
    };

    const renderProgressBar = (used: number, total: number) => {
        const percent = Math.min((used / total) * 100, 100);
        let colorClass = "bg-primary";
        if (percent > 85) colorClass = "bg-destructive";
        else if (percent > 65) colorClass = "bg-amber-500";

        return (
            <div className="w-full bg-secondary/50 rounded-full h-2.5 mt-3 mb-1 overflow-hidden">
                <div 
                    className={`h-2.5 rounded-full ${colorClass} transition-all duration-500`} 
                    style={{ width: `${percent}%` }}
                ></div>
            </div>
        );
    };

    return (
        <div className="animate-fade-in max-w-2xl space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-foreground mb-1">Storage Health</h2>
                    <p className="text-sm text-muted-foreground">Monitor your system's storage usage across media and database.</p>
                </div>
                <button 
                    onClick={fetchStorageHealth}
                    disabled={loading}
                    className="p-2 text-muted-foreground hover:bg-secondary rounded-lg transition-colors disabled:opacity-50"
                    title="Refresh Storage"
                >
                    <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden p-6 space-y-8">
                {/* Images Storage */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Database size={16} className="text-muted-foreground" />
                            <span className="font-medium text-sm">Media Storage (Images & Masks)</span>
                        </div>
                        {storageHealth ? (
                            <span className="text-sm text-muted-foreground font-mono">
                                <span className="font-semibold text-foreground">{formatBytes(storageHealth.images_bytes)}</span> / {formatBytes(storageHealth.images_limit_bytes)}
                            </span>
                        ) : (
                            <div className="h-4 w-24 bg-secondary rounded animate-pulse"></div>
                        )}
                    </div>
                    {storageHealth ? (
                        renderProgressBar(storageHealth.images_bytes, storageHealth.images_limit_bytes)
                    ) : (
                        <div className="w-full bg-secondary rounded-full h-2.5 mt-3 mb-1 animate-pulse"></div>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-1">Includes Original Reports, AI Masks, and Cleanup Proofs.</p>
                </div>

                {/* Database Storage */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Server size={16} className="text-muted-foreground" />
                            <span className="font-medium text-sm">Database Storage (Records)</span>
                        </div>
                        {storageHealth ? (
                            <span className="text-sm text-muted-foreground font-mono">
                                <span className="font-semibold text-foreground">{formatBytes(storageHealth.database_bytes)}</span> / {formatBytes(storageHealth.database_limit_bytes)}
                            </span>
                        ) : (
                            <div className="h-4 w-24 bg-secondary rounded animate-pulse"></div>
                        )}
                    </div>
                    {storageHealth ? (
                        renderProgressBar(storageHealth.database_bytes, storageHealth.database_limit_bytes)
                    ) : (
                        <div className="w-full bg-secondary rounded-full h-2.5 mt-3 mb-1 animate-pulse"></div>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-1">Text data including Reports, Users, Logs, and Work Orders.</p>
                </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
                <h3 className="font-semibold text-sm">Data Retention Policy</h3>
                <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Auto-Purge Resolved Reports</label>
                    <select
                        value={purgePolicy}
                        onChange={(e) => { setPurgePolicy(e.target.value); localStorage.setItem("ecowatch_purge_policy", e.target.value); }}
                        className="w-full max-w-sm bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
                    >
                        <option value="never">Never (Keep Forever)</option>
                        <option value="6_months">After 6 Months</option>
                        <option value="1_year">After 1 Year</option>
                    </select>
                    <p className="text-[11px] text-muted-foreground mt-2">Archived reports will have their media deleted to save space, but text records will remain.</p>
                </div>
            </div>
        </div>
    );
}
