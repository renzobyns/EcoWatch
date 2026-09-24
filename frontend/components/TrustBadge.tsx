"use client";

import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface TrustBadgeProps {
  trust_score: "high" | "medium" | "low" | null | undefined;
  /** Human-readable reasons for this report's tier (superset of failing_signals). */
  trust_reasons?: string[];
  failing_signals?: string[];
  needs_human_review?: boolean;
  className?: string;
  /** Direction the info tooltip opens. Default "bottom". */
  tooltipSide?: "top" | "bottom";
  /** Horizontal alignment of the panel relative to the badge. Default "left". */
  align?: "left" | "right";
}

export function TrustBadge({
  trust_score,
  trust_reasons,
  failing_signals,
  className,
  tooltipSide = "bottom",
  align = "left",
}: TrustBadgeProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  // If trust_score is null or undefined, render nothing
  if (!trust_score) {
    return null;
  }

  // Determine variant and label based on trust_score
  let variant: "success" | "warning" | "destructive" = "success";
  let label = "High Trust";

  if (trust_score === "medium") {
    variant = "warning";
    label = "Med Trust";
  } else if (trust_score === "low") {
    variant = "destructive";
    label = "Low Trust";
  }

  // trust_reasons is the superset; fall back to failing_signals for older data.
  const reasons =
    trust_reasons && trust_reasons.length > 0
      ? trust_reasons
      : failing_signals ?? [];

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((prev) => !prev);
        }}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full transition-transform active:scale-95"
        title="Click or hover to view photo trust signals"
        aria-expanded={open}
      >
        <Badge
          variant={variant}
          className="cursor-pointer select-none transition-all hover:brightness-110 shadow-sm"
        >
          {label}
        </Badge>
      </button>

      {open && (
        <div
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute z-[999999] w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl p-3.5 text-left text-[11px] leading-relaxed ring-1 ring-black/5 dark:ring-white/10 animate-in fade-in zoom-in-95 duration-150",
            tooltipSide === "top" ? "bottom-full mb-2" : "top-full mt-2",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-border/70 pb-1.5">
              <p className="font-bold text-foreground text-xs">Photo Trust Score</p>
              <span className="text-[10px] font-mono text-muted-foreground uppercase">{label}</span>
            </div>
            <p className="text-muted-foreground">
              Rates how genuine a report&apos;s{" "}
              <span className="font-medium text-foreground">photo evidence</span>{" "}
              looks from its EXIF metadata (camera make/model, timestamp, GPS consistency). Independent of AI garbage detection.
            </p>
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-start gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
                <p className="text-muted-foreground">
                  <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">High:</strong> Genuine camera shot, intact metadata, GPS &lt;100m.
                </p>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="size-2 rounded-full bg-amber-500 mt-1 shrink-0" />
                <p className="text-muted-foreground">
                  <strong className="text-amber-600 dark:text-amber-400 font-semibold">Medium:</strong> EXIF missing or stripped (chat upload / screenshot).
                </p>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="size-2 rounded-full bg-rose-500 mt-1 shrink-0" />
                <p className="text-muted-foreground">
                  <strong className="text-rose-600 dark:text-rose-400 font-semibold">Low:</strong> Editing tag, mismatched time, or GPS &gt;500m off pin.
                </p>
              </div>
            </div>
            <div className="border-t border-border/70 pt-1.5 mt-1">
              <p className="mb-1 font-semibold text-foreground">Signals for this report:</p>
              {reasons.length > 0 ? (
                <ul className="space-y-0.5 text-muted-foreground">
                  {reasons.map((r) => (
                    <li key={r} className="flex items-start gap-1">
                      <span className="text-amber-500 shrink-0">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <span>✓</span> All metadata present and consistent.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
