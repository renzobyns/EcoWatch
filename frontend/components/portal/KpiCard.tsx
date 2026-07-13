"use client";

import React from "react";

export function KpiCard({
    label,
    value,
    icon,
    tone,
}: {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    tone: "red" | "yellow" | "emerald" | "blue" | "neutral";
}) {
    const toneClasses = {
        red: "bg-destructive/10 text-destructive",
        yellow: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
        emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        blue: "bg-primary/10 text-primary",
        neutral: "bg-muted/50 text-muted-foreground",
    } as const;

    return (
        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center justify-between gap-4">
            <div className="min-w-0">
                <div className="text-sm font-medium text-muted-foreground mb-1.5 truncate">{label}</div>
                <div className="text-3xl font-bold text-foreground tracking-tight">{value}</div>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${toneClasses[tone]}`}>
                {icon}
            </div>
        </div>
    );
}
