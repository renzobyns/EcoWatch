"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InfoTooltipProps {
  /** Tooltip body — plain text or rich JSX. */
  children: React.ReactNode;
  /** Which side of the trigger the panel opens toward. Default "bottom". */
  side?: "top" | "bottom";
  /** Horizontal anchoring of the panel. Default "left". */
  align?: "left" | "right";
  /** Accessible label for the trigger button. */
  label?: string;
  className?: string;
}

/**
 * Small "ⓘ" trigger that reveals an explanatory popover on hover or keyboard
 * focus. Pure Tailwind (no portal), matching the project's group-hover pattern;
 * accessible via group-focus-within so it also opens on Tab focus.
 */
export function InfoTooltip({
  children,
  side = "bottom",
  align = "left",
  label = "More info",
  className,
}: InfoTooltipProps) {
  return (
    <span className={cn("relative inline-flex group/info align-middle", className)}>
      <button
        type="button"
        aria-label={label}
        className="text-foreground/40 hover:text-foreground/80 focus:text-foreground/80 focus:outline-none transition-colors cursor-help"
      >
        <Info size={13} strokeWidth={2.5} />
      </button>
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 w-64 rounded-xl border border-border bg-background/95 backdrop-blur-xl p-3 text-left text-[11px] leading-relaxed text-foreground/80 shadow-2xl shadow-black/40",
          "opacity-0 translate-y-0.5 transition-all duration-150",
          "group-hover/info:opacity-100 group-hover/info:translate-y-0",
          "group-focus-within/info:opacity-100 group-focus-within/info:translate-y-0",
          side === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
          align === "left" ? "left-0" : "right-0"
        )}
      >
        {children}
      </span>
    </span>
  );
}
