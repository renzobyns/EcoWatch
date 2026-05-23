import { Badge } from "@/components/ui/badge";

export interface TrustBadgeProps {
  trust_score: "high" | "medium" | "low" | null | undefined;
  failing_signals?: string[];
  needs_human_review?: boolean;
  className?: string;
}

export function TrustBadge({
  trust_score,
  failing_signals,
  needs_human_review,
  className,
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

  return (
    <div className={className}>
      <Badge variant={variant}>{label}</Badge>

      {/* Collapsible details section for LOW trust */}
      {trust_score === "low" && (
        <details className="mt-1">
          <summary className="text-[10px] text-foreground/50 cursor-pointer select-none">
            Why flagged?
          </summary>
          <ul className="mt-1 space-y-0.5 pl-2">
            {(failing_signals ?? []).map((s) => (
              <li key={s} className="text-[10px] text-red-400">
                • {s}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
