"use client";

import React from "react";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

export function KpiCard({
    label,
    value,
    icon,
    tone = "neutral",
    loading = false,
    tooltip,
    tooltipSide = "bottom",
    tooltipAlign = "left",
}: {
    label?: string;
    value?: string | number;
    icon?: React.ReactNode;
    tone?: "red" | "yellow" | "emerald" | "blue" | "neutral";
    loading?: boolean;
    tooltip?: React.ReactNode;
    tooltipSide?: "top" | "bottom" | "left" | "right";
    tooltipAlign?: "left" | "right";
}) {
    const toneClasses = {
        red: "bg-destructive/10 text-destructive",
        yellow: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
        emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        blue: "bg-primary/10 text-primary",
        neutral: "bg-muted/50 text-muted-foreground",
    } as const;

    if (loading) {
        return (
            <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center justify-between gap-4 animate-pulse">
                <div className="min-w-0 flex-1">
                    <div className="h-4 bg-muted rounded w-2/3 mb-2.5" />
                    <div className="h-8 bg-muted rounded w-1/3" />
                </div>
                <div className="w-12 h-12 rounded-xl bg-muted shrink-0" />
            </div>
        );
    }

    return (
        <div className="bg-card p-4 sm:p-5 rounded-xl border border-border shadow-sm flex items-center justify-between gap-3 sm:gap-4 relative hover:z-40 focus-within:z-40">
            <div className="min-w-0 flex-1">
                {tooltip ? (
                    <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-1.5 leading-tight flex items-center gap-1.5 min-w-0">
                        <span className="truncate">{label}</span>
                        <InfoTooltip
                            className="shrink-0"
                            label={label ? `${label} info` : "More info"}
                            side={tooltipSide}
                            align={tooltipAlign}
                            content={typeof tooltip === "string" ? tooltip : undefined}
                        >
                            {typeof tooltip !== "string" ? tooltip : undefined}
                        </InfoTooltip>
                    </div>
                ) : (
                    <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-1.5 leading-tight line-clamp-2">{label}</div>
                )}
                <div className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{value}</div>
            </div>
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 ${toneClasses[tone]}`}>
                {icon}
            </div>
        </div>
    );
}
