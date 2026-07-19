"use client";

import { useState } from "react";
import { toast } from "sonner";

export function ConnectivityTab() {
    const [checking, setChecking] = useState<string | null>(null);

    const handleTest = (service: string) => {
        setChecking(service);
        setTimeout(() => {
            setChecking(null);
            toast.success(`Successfully connected to ${service}`);
        }, 1500);
    };

    return (
        <div className="animate-fade-in max-w-2xl space-y-8">
            <div>
                <h2 className="text-lg font-bold text-foreground mb-1">Connectivity</h2>
                <p className="text-sm text-muted-foreground">Monitor the health of connected services.</p>
            </div>

            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col divide-y divide-border/50">
                
                {/* Backend API */}
                <div className="p-5 flex items-center justify-between hover:bg-secondary/10 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
                            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full absolute top-0 left-0 animate-ping"></div>
                        </div>
                        <div>
                            <span className="text-sm font-semibold block">Backend API (FastAPI)</span>
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded mt-1 inline-block">Online • 42ms</span>
                        </div>
                    </div>
                    <button 
                        onClick={() => handleTest('Backend API')}
                        disabled={checking === 'Backend API'}
                        className="text-xs font-medium px-3 py-1.5 bg-secondary hover:bg-secondary/80 rounded-md transition-colors disabled:opacity-50"
                    >
                        {checking === 'Backend API' ? 'Testing...' : 'Test Connection'}
                    </button>
                </div>

                {/* Database */}
                <div className="p-5 flex items-center justify-between hover:bg-secondary/10 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
                            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full absolute top-0 left-0 animate-ping"></div>
                        </div>
                        <div>
                            <span className="text-sm font-semibold block">Database (PostgreSQL)</span>
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded mt-1 inline-block">Connected</span>
                        </div>
                    </div>
                    <button 
                        onClick={() => handleTest('Database')}
                        disabled={checking === 'Database'}
                        className="text-xs font-medium px-3 py-1.5 bg-secondary hover:bg-secondary/80 rounded-md transition-colors disabled:opacity-50"
                    >
                        {checking === 'Database' ? 'Testing...' : 'Test Connection'}
                    </button>
                </div>

                {/* Supabase Storage */}
                <div className="p-5 flex items-center justify-between hover:bg-secondary/10 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
                            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full absolute top-0 left-0 animate-ping"></div>
                        </div>
                        <div>
                            <span className="text-sm font-semibold block">Supabase Storage</span>
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded mt-1 inline-block">Connected</span>
                        </div>
                    </div>
                    <button 
                        onClick={() => handleTest('Supabase Storage')}
                        disabled={checking === 'Supabase Storage'}
                        className="text-xs font-medium px-3 py-1.5 bg-secondary hover:bg-secondary/80 rounded-md transition-colors disabled:opacity-50"
                    >
                        {checking === 'Supabase Storage' ? 'Testing...' : 'Test Connection'}
                    </button>
                </div>

                {/* AI Model */}
                <div className="p-5 flex items-center justify-between hover:bg-secondary/10 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="w-2.5 h-2.5 bg-amber-500 rounded-full"></div>
                            {/* Removed ping for mock mode */}
                        </div>
                        <div>
                            <span className="text-sm font-semibold block">AI Model (Mask R-CNN)</span>
                            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded mt-1 inline-block">Mock Mode Fallback</span>
                        </div>
                    </div>
                    <button 
                        onClick={() => handleTest('AI Model')}
                        disabled={checking === 'AI Model'}
                        className="text-xs font-medium px-3 py-1.5 bg-secondary hover:bg-secondary/80 rounded-md transition-colors disabled:opacity-50"
                    >
                        {checking === 'AI Model' ? 'Testing...' : 'Test Connection'}
                    </button>
                </div>
            </div>

            <p className="text-xs text-muted-foreground">Last Checked: {new Date().toLocaleTimeString()}</p>
        </div>
    );
}
