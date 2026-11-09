export const parseUTC = (iso: string): Date => {
    if (!iso) return new Date(NaN);
    const clean = String(iso).trim();
    return new Date(clean.endsWith("Z") || clean.includes("+") || clean.includes("-", 10) ? clean : clean + "Z");
};

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

/**
 * Format camera EXIF DateTimeOriginal (which is already recorded in camera local time "YYYY:MM:DD HH:MM:SS").
 */
export function formatExifDate(val: string): string {
    if (!val) return "—";
    const clean = String(val).trim();
    if (/^\d{4}:\d{2}:\d{2}/.test(clean)) {
        const parts = clean.split(" ");
        const d = parts[0].replace(/:/g, "-");
        const t = parts[1] || "";
        const dateObj = new Date(`${d}T${t}`);
        if (!isNaN(dateObj.getTime())) {
            return dateObj.toLocaleString("en-US", {
                month: "short", day: "numeric", year: "numeric",
                hour: "numeric", minute: "2-digit",
            });
        }
    }
    return formatDateTime(clean);
}
