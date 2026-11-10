"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InfoTooltipProps {
  /** Tooltip body — plain text or rich JSX. */
  children?: React.ReactNode;
  /** Tooltip content prop fallback. */
  content?: React.ReactNode;
  /** Which side of the trigger the panel opens toward. Default "bottom". */
  side?: "top" | "bottom" | "right" | "left";
  /** Horizontal anchoring of the panel (for top/bottom sides). Default "left". */
  align?: "left" | "right";
  /** Accessible label for the trigger button. */
  label?: string;
  className?: string;
  /** Custom class overrides for the popover panel. */
  panelClassName?: string;
}

/**
 * Small "ⓘ" trigger that reveals an explanatory popover on hover or keyboard
 * focus. Pure Tailwind (no portal), matching the project's group-hover pattern;
 * accessible via group-focus-within so it also opens on Tab focus.
 */
export function InfoTooltip({
  children,
  content,
  side = "bottom",
  align = "left",
  label = "More info",
  className,
  panelClassName,
}: InfoTooltipProps) {
  return (
    <span className={cn("relative inline-flex group/info align-middle group-hover/info:z-[9999] focus-within:z-[9999]", className)}>
      <button
        type="button"
        aria-label={label}
        className="w-7 h-7 -m-1.5 flex items-center justify-center rounded-full text-foreground/40 hover:text-foreground/80 focus:text-foreground/80 focus:outline-none transition-colors cursor-help"
      >
        <Info size={13} strokeWidth={2.5} />
      </button>
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-[9999] w-64 max-w-[calc(100vw-2.5rem)] break-words rounded-xl border border-border/80 bg-popover p-3 text-left text-[11px] leading-relaxed text-popover-foreground font-medium shadow-2xl shadow-black/25",
          "hidden group-hover/info:block group-focus-within/info:block opacity-0 group-hover/info:opacity-100 group-focus-within/info:opacity-100 transition-opacity duration-150",
          side === "bottom" ? "top-full mt-2 translate-y-0.5 group-hover/info:translate-y-0 group-focus-within/info:translate-y-0" : 
          side === "top" ? "bottom-full mb-2 -translate-y-0.5 group-hover/info:translate-y-0 group-focus-within/info:translate-y-0" : 
          side === "right" ? "left-0 sm:left-full top-full sm:top-0 sm:ml-3 mt-2 sm:mt-0 translate-y-1 sm:translate-y-0 sm:translate-x-1 group-hover/info:translate-y-0 group-focus-within/info:translate-y-0" :
          "right-0 sm:right-full top-full sm:top-0 sm:mr-3 mt-2 sm:mt-0 -translate-y-1 sm:translate-y-0 sm:-translate-x-1 group-hover/info:translate-y-0 group-focus-within/info:translate-y-0",
          (side === "top" || side === "bottom") && align === "left" ? "left-0" : 
          (side === "top" || side === "bottom") && align === "right" ? "right-0" : "",
          panelClassName
        )}
      >
        {children || content}
      </span>
    </span>
  );
}
