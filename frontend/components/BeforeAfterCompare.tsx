/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useRef, useCallback } from "react";
import { SlidersHorizontal, Columns2, Layers, ZoomIn } from "lucide-react";

interface BeforeAfterCompareProps {
    beforeSrc: string;
    afterSrc: string;
    beforeLabel?: string;
    afterLabel?: string;
    className?: string;
    onEnlarge?: (src: string) => void;
}

type ViewMode = "slider" | "split" | "crossfade";

export default function BeforeAfterCompare({
    beforeSrc,
    afterSrc,
    beforeLabel = "Before (Report)",
    afterLabel = "After (Cleanup)",
    className = "",
    onEnlarge,
}: BeforeAfterCompareProps) {
    const [sliderPos, setSliderPos] = useState<number>(50); // percentage 0 - 100
    const [crossfadeOpacity, setCrossfadeOpacity] = useState<number>(50);
    const [mode, setMode] = useState<ViewMode>("slider");
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        setIsDragging(true);
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }, []);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDragging || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const clientX = e.clientX;
        const relativeX = clientX - rect.left;
        const clamped = Math.max(0, Math.min(rect.width, relativeX));
        const percentage = (clamped / rect.width) * 100;
        setSliderPos(Math.round(percentage));
    }, [isDragging]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        setIsDragging(false);
        try {
            (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
        } catch {
            // Safe fallback if pointer capture was already released
        }
    }, []);

    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            {/* Control Bar */}
            <div className="flex items-center justify-between gap-2 px-1 text-xs">
                <div className="flex items-center gap-1 bg-foreground/5 p-1 rounded-lg border border-border">
                    <button
                        type="button"
                        onClick={() => setMode("slider")}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                            mode === "slider"
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="Interactive Slider View"
                    >
                        <SlidersHorizontal size={12} />
                        Slider
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode("split")}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                            mode === "split"
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="Side by Side View"
                    >
                        <Columns2 size={12} />
                        Side-by-Side
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode("crossfade")}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                            mode === "crossfade"
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="Crossfade Overlay View"
                    >
                        <Layers size={12} />
                        Crossfade
                    </button>
                </div>

                {onEnlarge && (
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => onEnlarge(beforeSrc)}
                            className="p-1.5 rounded-md hover:bg-foreground/5 text-muted-foreground hover:text-foreground transition-colors"
                            title="Enlarge Before"
                        >
                            <ZoomIn size={13} />
                        </button>
                    </div>
                )}
            </div>

            {/* Mode: Slider View */}
            {mode === "slider" && (
                <div
                    ref={containerRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    className="relative w-full h-64 md:h-80 rounded-xl overflow-hidden select-none touch-none cursor-ew-resize bg-black border border-border shadow-md"
                >
                    {/* After Image (Background layer) */}
                    <img
                        src={afterSrc}
                        alt={afterLabel}
                        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                    />

                    {/* Before Image (Clipped layer) */}
                    <div
                        className="absolute inset-0 overflow-hidden pointer-events-none"
                        style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                    >
                        <img
                            src={beforeSrc}
                            alt={beforeLabel}
                            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                        />
                    </div>

                    {/* Divider Handle Bar */}
                    <div
                        className="absolute top-0 bottom-0 w-1 bg-white/90 shadow-[0_0_10px_rgba(0,0,0,0.5)] pointer-events-none -ml-0.5"
                        style={{ left: `${sliderPos}%` }}
                    >
                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white/90 text-zinc-900 shadow-lg flex items-center justify-center font-bold text-xs border border-zinc-200">
                            ↔
                        </div>
                    </div>

                    {/* Floating Badges */}
                    <div className="absolute top-2.5 left-2.5 pointer-events-none">
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/80 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider shadow">
                            {beforeLabel}
                        </span>
                    </div>
                    <div className="absolute top-2.5 right-2.5 pointer-events-none">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-600/80 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider shadow">
                            {afterLabel}
                        </span>
                    </div>

                    <div className="absolute bottom-2 inset-x-0 flex justify-center pointer-events-none">
                        <span className="px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white/80 text-[10px] tracking-wide">
                            Drag to compare before & after
                        </span>
                    </div>
                </div>
            )}

            {/* Mode: Side by Side View */}
            {mode === "split" && (
                <div className="grid grid-cols-2 gap-2">
                    <div className="relative rounded-xl overflow-hidden bg-black/40 border border-border aspect-video">
                        <img
                            src={beforeSrc}
                            alt={beforeLabel}
                            className="w-full h-full object-cover"
                        />
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-amber-500/80 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider">
                            {beforeLabel}
                        </span>
                    </div>
                    <div className="relative rounded-xl overflow-hidden bg-black/40 border border-border aspect-video">
                        <img
                            src={afterSrc}
                            alt={afterLabel}
                            className="w-full h-full object-cover"
                        />
                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-emerald-600/80 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider">
                            {afterLabel}
                        </span>
                    </div>
                </div>
            )}

            {/* Mode: Crossfade Overlay View */}
            {mode === "crossfade" && (
                <div className="flex flex-col gap-2">
                    <div className="relative w-full h-64 md:h-80 rounded-xl overflow-hidden bg-black border border-border shadow-md">
                        {/* Before Base */}
                        <img
                            src={beforeSrc}
                            alt={beforeLabel}
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                        {/* After Crossfade */}
                        <img
                            src={afterSrc}
                            alt={afterLabel}
                            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-150"
                            style={{ opacity: crossfadeOpacity / 100 }}
                        />
                        <div className="absolute top-2.5 left-2.5 pointer-events-none">
                            <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider">
                                {crossfadeOpacity < 50 ? beforeLabel : afterLabel} ({crossfadeOpacity}%)
                            </span>
                        </div>
                    </div>
                    {/* Opacity Slider */}
                    <div className="flex items-center gap-3 px-2 py-1 bg-foreground/5 rounded-lg border border-border text-xs">
                        <span className="text-[11px] text-muted-foreground font-semibold">Before</span>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={crossfadeOpacity}
                            onChange={(e) => setCrossfadeOpacity(Number(e.target.value))}
                            className="flex-1 accent-primary h-1.5 bg-foreground/20 rounded cursor-pointer"
                        />
                        <span className="text-[11px] text-muted-foreground font-semibold">After</span>
                    </div>
                </div>
            )}
        </div>
    );
}
