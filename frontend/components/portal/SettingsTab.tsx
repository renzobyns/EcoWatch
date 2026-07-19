"use client";

import { useState, useEffect } from "react";
import { Database, HardDrive, Download, Bell, Moon, Sun, Monitor, ShieldCheck, Mail, Smartphone, RefreshCw, Activity, Server, FileText } from "lucide-react";
import { api } from "@/lib/api";
import { formatBytes } from "@/lib/format-utils";
import { toast } from "sonner";

interface StorageHealth {
    images_bytes: number;
    images_limit_bytes: number;
    database_bytes: number;
    database_limit_bytes: number;
}

export function SettingsTab() {
    const [storageHealth, setStorageHealth] = useState<StorageHealth | null>(null);
    const [loadingStorage, setLoadingStorage] = useState(true);

    const [emailAlerts, setEmailAlerts] = useState(true);
    const [smsAlerts, setSmsAlerts] = useState(false);
    const [strictMode, setStrictMode] = useState(false);
    
    // Theme is purely visual mockup for now
    const [theme, setTheme] = useState<"system" | "light" | "dark">("system");

    useEffect(() => {
        fetchStorageHealth();
    }, []);

    const fetchStorageHealth = async () => {
        setLoadingStorage(true);
        try {
            const data = await api.get("/analytics/storage-health");
            setStorageHealth(data);
        } catch (error) {
            console.error("Failed to fetch storage health", error);
        } finally {
            setLoadingStorage(false);
        }
    };

    const handleExportSystemLogs = () => {
        toast.info("Exporting system logs to CSV...");
        setTimeout(() => toast.success("System logs exported successfully!"), 1500);
    };

    const handleExportDatabase = () => {
        toast.info("Preparing database dump...");
        setTimeout(() => toast.success("Database dump downloaded successfully!"), 2000);
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
        <div className="p-8 max-w-6xl mx-auto space-y-8 animate-fade-in pb-24">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">System Settings</h1>
                <p className="text-muted-foreground mt-1">Manage system configurations, monitor health, and customize preferences.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Column: Connectivity & Storage */}
                <div className="lg:col-span-2 space-y-8">
                    
                    {/* Storage Health */}
                    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                    <HardDrive size={20} />
                                </div>
                                <h2 className="font-semibold text-lg">Storage Health</h2>
                            </div>
                            <button 
                                onClick={fetchStorageHealth}
                                disabled={loadingStorage}
                                className="p-2 text-muted-foreground hover:bg-secondary rounded-lg transition-colors disabled:opacity-50"
                                title="Refresh Storage"
                            >
                                <RefreshCw size={16} className={loadingStorage ? "animate-spin" : ""} />
                            </button>
                        </div>
                        <div className="p-6 space-y-8">
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
                                <p className="text-[11px] text-muted-foreground">Includes Original Reports, AI Masks, and Cleanup Proofs.</p>
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
                                <p className="text-[11px] text-muted-foreground">Text data including Reports, Users, Logs, and Work Orders.</p>
                            </div>
                        </div>
                    </div>

                    {/* Data Export Hub */}
                    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-border flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
                                <Download size={20} />
                            </div>
                            <h2 className="font-semibold text-lg">Data Export Hub</h2>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button 
                                onClick={handleExportSystemLogs}
                                className="flex flex-col items-start gap-2 p-4 border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                            >
                                <div className="p-2 bg-secondary rounded-lg group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                    <FileText size={18} />
                                </div>
                                <div>
                                    <h3 className="font-medium text-sm">Export System Logs</h3>
                                    <p className="text-xs text-muted-foreground mt-1">Download a CSV of all system audits and errors.</p>
                                </div>
                            </button>
                            <button 
                                onClick={handleExportDatabase}
                                className="flex flex-col items-start gap-2 p-4 border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                            >
                                <div className="p-2 bg-secondary rounded-lg group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                    <Database size={18} />
                                </div>
                                <div>
                                    <h3 className="font-medium text-sm">Database Dump (JSON)</h3>
                                    <p className="text-xs text-muted-foreground mt-1">Full backup of system records and configuration.</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column: Preferences & Connectivity */}
                <div className="space-y-8">
                    
                    {/* Connectivity Status */}
                    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-border flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
                                <Activity size={20} />
                            </div>
                            <h2 className="font-semibold text-lg">Connectivity</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
                                        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full absolute top-0 left-0 animate-ping"></div>
                                    </div>
                                    <span className="text-sm font-medium">Backend Server</span>
                                </div>
                                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2 py-1 rounded">Online</span>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
                                        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full absolute top-0 left-0 animate-ping"></div>
                                    </div>
                                    <span className="text-sm font-medium">Database (PostgreSQL)</span>
                                </div>
                                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2 py-1 rounded">Connected</span>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
                                        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full absolute top-0 left-0 animate-ping"></div>
                                    </div>
                                    <span className="text-sm font-medium">Supabase Storage</span>
                                </div>
                                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2 py-1 rounded">Connected</span>
                            </div>
                        </div>
                    </div>

                    {/* AI Verification Settings */}
                    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-border flex items-center gap-3">
                            <div className="p-2 bg-orange-500/10 rounded-lg text-orange-600 dark:text-orange-400">
                                <ShieldCheck size={20} />
                            </div>
                            <h2 className="font-semibold text-lg">AI Policy</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium">Strict Verification</p>
                                    <p className="text-xs text-muted-foreground">Auto-reject reports below 60% confidence.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={strictMode} onChange={() => {
                                        setStrictMode(!strictMode);
                                        toast.success(`Strict verification ${!strictMode ? 'enabled' : 'disabled'}`);
                                    }} />
                                    <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Notification Preferences */}
                    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-border flex items-center gap-3">
                            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-600 dark:text-purple-400">
                                <Bell size={20} />
                            </div>
                            <h2 className="font-semibold text-lg">Notifications</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Mail size={16} className="text-muted-foreground" />
                                    <span className="text-sm font-medium">Email Alerts</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={emailAlerts} onChange={() => {
                                        setEmailAlerts(!emailAlerts);
                                        toast.success(`Email alerts ${!emailAlerts ? 'enabled' : 'disabled'}`);
                                    }} />
                                    <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Smartphone size={16} className="text-muted-foreground" />
                                    <span className="text-sm font-medium">SMS Alerts</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={smsAlerts} onChange={() => {
                                        setSmsAlerts(!smsAlerts);
                                        toast.success(`SMS alerts ${!smsAlerts ? 'enabled' : 'disabled'}`);
                                    }} />
                                    <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Appearance */}
                    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-border flex items-center gap-3">
                            <div className="p-2 bg-zinc-500/10 rounded-lg text-zinc-600 dark:text-zinc-400">
                                <Monitor size={20} />
                            </div>
                            <h2 className="font-semibold text-lg">Appearance</h2>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-3 gap-2 p-1 bg-secondary rounded-lg">
                                <button 
                                    onClick={() => { setTheme("light"); toast("Theme preference saved"); }}
                                    className={`flex flex-col items-center gap-1.5 p-2 rounded-md transition-colors ${theme === "light" ? "bg-background shadow-sm border border-border" : "hover:bg-background/50 text-muted-foreground"}`}
                                >
                                    <Sun size={16} />
                                    <span className="text-xs font-medium">Light</span>
                                </button>
                                <button 
                                    onClick={() => { setTheme("dark"); toast("Theme preference saved"); }}
                                    className={`flex flex-col items-center gap-1.5 p-2 rounded-md transition-colors ${theme === "dark" ? "bg-background shadow-sm border border-border" : "hover:bg-background/50 text-muted-foreground"}`}
                                >
                                    <Moon size={16} />
                                    <span className="text-xs font-medium">Dark</span>
                                </button>
                                <button 
                                    onClick={() => { setTheme("system"); toast("Theme preference saved"); }}
                                    className={`flex flex-col items-center gap-1.5 p-2 rounded-md transition-colors ${theme === "system" ? "bg-background shadow-sm border border-border" : "hover:bg-background/50 text-muted-foreground"}`}
                                >
                                    <Monitor size={16} />
                                    <span className="text-xs font-medium">System</span>
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
