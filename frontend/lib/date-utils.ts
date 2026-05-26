const parseUTC = (iso: string): Date =>
    new Date(iso.endsWith("Z") || iso.includes("+") || iso.includes("-", 10) ? iso : iso + "Z");

export function formatRelative(iso: string): string {
    const diff = Date.now() - parseUTC(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return parseUTC(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDate(iso: string): string {
    return parseUTC(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(iso: string): string {
    return parseUTC(iso).toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit",
    });
}
