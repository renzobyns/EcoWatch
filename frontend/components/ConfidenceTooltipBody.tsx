/** Shared explanation for the AI Confidence tooltip, used across all report views. */
export function ConfidenceTooltipBody() {
  return (
    <div className="space-y-2">
      <p className="font-semibold text-foreground/90">AI Confidence</p>
      <p>
        The Mask R-CNN model&apos;s certainty that garbage is present in the photo — the
        highest score across all of a report&apos;s photos.
      </p>
      <p>
        A photo must score{" "}
        <span className="font-medium text-foreground/90">≥ 50%</span> to count as verified;
        below that the report is auto-rejected.
      </p>
      <p className="text-foreground/55">
        This is independent of the trust score, which checks photo metadata rather than
        image content.
      </p>
    </div>
  );
}
