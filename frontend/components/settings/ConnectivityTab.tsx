"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

type ServiceStatus = {
    status: "ok" | "error" | "warning";
    message?: string;
    latency_ms?: number;
};

type HealthResponse = {
    backend: ServiceStatus;
    database: ServiceStatus;
    supabase: ServiceStatus;
    ai: ServiceStatus;
};

export function ConnectivityTab() {
    const [health, setHealth] = useState<HealthResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastChecked, setLastChecked] = useState<string>("");

    const fetchHealth = async () => {
        setLoading(true);
        try {
            const data = await api("/health/full");
            setHealth(data);
            setLastChecked(new Date().toLocaleTimeString());
            toast.success("Health check completed");
        } catch (e) {
            toast.error("Failed to perform health check");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHealth();
    }, []);

    const renderService = (name: string, data: ServiceStatus | undefined) => {
        if (!data) {
            return (
                <div className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-2.5 h-2.5 bg-secondary rounded-full animate-pulse"></div>
                        <div>
                            <span className="text-sm font-semibold block">{name}</span>
                            <span className="text-xs text-muted-foreground mt-1 block">Checking...</span>
                        </div>
                    </div>
                </div>
            );
        }

        const isOk = data.status === "ok";
        const isWarning = data.status === "warning";
        
        let dotColor = "bg-red-500";
        let bgColor = "bg-red-500/10";
        let textColor = "text-red-600 dark:text-red-400";
        let label = data.message || "Offline";

        if (isOk) {
            dotColor = "bg-emerald-500";
            bgColor = "bg-emerald-500/10";
            textColor = "text-emerald-600 dark:text-emerald-400";
            label = "Online";
        } else if (isWarning) {
            dotColor = "bg-amber-500";
            bgColor = "bg-amber-500/10";
            textColor = "text-amber-600 dark:text-amber-400";
            label = data.message || "Warning";
        }

        return (
            <div className="p-5 flex items-center justify-between hover:bg-secondary/10 transition-colors">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className={`w-2.5 h-2.5 ${dotColor} rounded-full`}></div>
                        {isOk && <div className={`w-2.5 h-2.5 ${dotColor} rounded-full absolute top-0 left-0 animate-ping`}></div>}
                    </div>
                    <div>
                        <span className="text-sm font-semibold block">{name}</span>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded mt-1 inline-block ${textColor} ${bgColor}`}>
                            {label} {data.latency_ms !== undefined && `• ${data.latency_ms}ms`}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="animate-fade-in max-w-2xl space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-foreground mb-1">Connectivity</h2>
                    <p className="text-sm text-muted-foreground">Monitor the health of connected services.</p>
                </div>
                <button 
                    onClick={fetchHealth}
                    disabled={loading}
                    className="text-xs font-medium px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50"
                >
                    {loading ? 'Checking...' : 'Run Diagnostics'}
                </button>
            </div>

            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col divide-y divide-border/50">
                {renderService("Backend API (FastAPI)", health?.backend)}
                {renderService("Database (PostgreSQL/SQLite)", health?.database)}
                {renderService("Supabase Storage", health?.supabase)}
                {renderService("AI Model (Mask R-CNN)", health?.ai)}
            </div>

            {lastChecked && (
                <p className="text-xs text-muted-foreground text-right">Last Checked: {lastChecked}</p>
            )}
        </div>
    );
}
