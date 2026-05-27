import { Badge } from "@/components/ui/badge";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

export interface TrustBadgeProps {
  trust_score: "high" | "medium" | "low" | null | undefined;
  /** Human-readable reasons for this report's tier (superset of failing_signals). */
  trust_reasons?: string[];
  failing_signals?: string[];
  needs_human_review?: boolean;
  className?: string;
  /** Direction the info tooltip opens. Use "top" when the badge sits near the bottom of a card. */
  tooltipSide?: "top" | "bottom";
}

export function TrustBadge({
  trust_score,
  trust_reasons,
  failing_signals,
  className,
  tooltipSide = "bottom",
}: TrustBadgeProps) {
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
    <div className={className}>
      <span className="inline-flex items-center gap-1.5">
        <Badge variant={variant}>{label}</Badge>
        <InfoTooltip side={tooltipSide} label="What does the trust score mean?">
          <div className="space-y-2">
            <p className="font-semibold text-foreground/90">Trust score</p>
            <p>
              Rates how genuine a report&apos;s{" "}
              <span className="font-medium text-foreground/90">photo evidence</span>{" "}
              looks, from its EXIF metadata — camera make/model, capture time, GPS, and any
              editing-software tag. Separate from the AI&apos;s garbage-detection confidence.
            </p>
            <div className="space-y-1">
              <p>
                <span className="font-semibold text-green-500">High</span> — a real camera
                shot: camera make/model + capture time + GPS within 100 m of the report pin.
              </p>
              <p>
                <span className="font-semibold text-yellow-500">Medium</span> — metadata
                missing (a downloaded image, screenshot, or photo sent via Messenger/WhatsApp,
                which strip EXIF), or GPS 100–500 m off. Unverifiable, not necessarily fake.
              </p>
              <p>
                <span className="font-semibold text-red-500">Low</span> — a red flag:
                edited/AI-tool tag (Photoshop, GIMP, Midjourney, DALL·E…), photo GPS &gt;500 m
                from the pin, capture time &gt;24 h before the report or in the future, or
                unreadable EXIF. Flagged for human review.
              </p>
            </div>
            <div className="border-t border-border pt-1.5">
              <p className="mb-1 font-semibold text-foreground/90">This report:</p>
              {reasons.length > 0 ? (
                <ul className="space-y-0.5">
                  {reasons.map((r) => (
                    <li key={r}>• {r}</li>
                  ))}
                </ul>
              ) : (
                <p>All metadata present and consistent.</p>
              )}
            </div>
          </div>
        </InfoTooltip>
      </span>
    </div>
  );
}
