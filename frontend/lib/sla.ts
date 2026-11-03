/**
 * Shared SLA status and deadline helpers for barangay, cleaner, and CENRO pages.
 */

export type SLAColor = "green" | "yellow" | "red";

export const SLA_PILL_CLASSES: Record<SLAColor, string> = {
    green: "bg-green-500/20 text-green-400",
    yellow: "bg-yellow-500/20 text-yellow-400",
    red: "bg-red-500/20 text-red-400",
};

/**
 * Compute SLA status from created_at timestamp and current status.
 * Returns days elapsed and color (green/yellow/red) for display.
 * Only applies to active statuses; returns null for resolved/rejected.
 */
export function slaInfo(
    createdAt: string,
    status: string
): { days: number; color: SLAColor } | null {
    const active = ["pending", "verified", "assigned", "in_progress", "failed_cleanup", "ai_verified", "ai_rejected"].includes(status);
    if (!active) return null;
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
    const color: SLAColor = days <= 2 ? "green" : days <= 4 ? "yellow" : "red";
    return { days, color };
}

/**
 * Format a work order SLA deadline as a relative time label.
 * E.g., "in 2 days", "2 hours ago", "overdue by 3 days"
 */
export function slaDeadlineLabel(deadline: string | Date): string {
    const deadlineDate = typeof deadline === "string" ? new Date(deadline) : deadline;
    const now = Date.now();
    const deltaMs = deadlineDate.getTime() - now;
    const deltaDays = Math.floor(deltaMs / 86400000);
    const deltaHours = Math.floor((deltaMs % 86400000) / 3600000);

    if (deltaDays > 0) {
        return `in ${deltaDays}d ${Math.abs(deltaHours)}h`;
    } else if (deltaDays === 0) {
        if (deltaHours >= 0) {
            return `in ${deltaHours}h`;
        } else {
            return `overdue ${Math.abs(deltaHours)}h`;
        }
    } else {
        return `overdue ${Math.abs(deltaDays)}d ${Math.abs(deltaHours)}h`;
    }
}

/**
 * Get the SLA color based on deadline and current time.
 */
export function slaDeadlineColor(deadline: string | Date): SLAColor {
    const deadlineDate = typeof deadline === "string" ? new Date(deadline) : deadline;
    const now = Date.now();
    const deltaMs = deadlineDate.getTime() - now;
    const deltaDays = Math.floor(deltaMs / 86400000);

    if (deltaMs < 0) {
        // Past deadline
        return "red";
    } else if (deltaDays <= 1) {
        // Within 1 day
        return "red";
    } else if (deltaDays <= 3) {
        // 1-3 days
        return "yellow";
    } else {
        // 3+ days
        return "green";
    }
}

/**
 * Format elapsed open time as DD:HH:MM:SS format.
 * E.g., "00:00:16:00" for 16 minutes.
 */
export function formatDurationDHMS(
    createdAt: string | Date | number,
    resolvedAt?: string | Date | number | null
): string {
    const start = typeof createdAt === "number" ? createdAt : new Date(createdAt).getTime();
    const end = resolvedAt
        ? (typeof resolvedAt === "number" ? resolvedAt : new Date(resolvedAt).getTime())
        : Date.now();
    const diffMs = Math.max(0, end - start);

    const totalSecs = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;

    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Format average resolve days into DD:HH:MM:SS string.
 */
export function formatDaysToDHMS(daysDecimal: number): string {
    const totalSecs = Math.max(0, Math.round(daysDecimal * 86400));
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;

    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
