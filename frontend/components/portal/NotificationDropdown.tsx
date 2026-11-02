"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, Briefcase, AlertTriangle, CheckCircle2, ArrowRightLeft, Shield, Sparkles, X,
         Clock, Flame, MapPin, AlertOctagon, ShieldAlert, Zap, Hourglass } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";
import { formatRelative } from "@/lib/date-utils";

interface Notification {
    id: number;
    kind: string;
    title: string;
    body: string;
    work_order_id: number | null;
    report_id: number | null;
    is_read: boolean;
    created_at: string;
}

const ICON_MAP: Record<string, { icon: typeof Bell; color: string }> = {
    // Cleaner kinds
    job_assigned: { icon: Briefcase, color: "text-emerald-400" },
    priority_changed: { icon: Sparkles, color: "text-yellow-400" },
    reassigned: { icon: ArrowRightLeft, color: "text-blue-400" },
    needs_redo: { icon: AlertTriangle, color: "text-red-400" },
    verified: { icon: CheckCircle2, color: "text-green-400" },
    force_resolved: { icon: Shield, color: "text-purple-400" },
    rejected: { icon: AlertTriangle, color: "text-orange-400" },
    // Barangay kinds
    report_verified_in_barangay: { icon: CheckCircle2, color: "text-emerald-400" },
    cleanup_verified: { icon: CheckCircle2, color: "text-green-400" },
    cleanup_needs_redo: { icon: AlertTriangle, color: "text-red-400" },
    sla_approaching: { icon: Clock, color: "text-yellow-400" },
    sla_breached: { icon: Flame, color: "text-red-500" },
    report_reassigned_in: { icon: MapPin, color: "text-blue-400" },
    report_reassigned_out: { icon: MapPin, color: "text-foreground/50" },
    // CENRO kinds
    cenro_sla_breached: { icon: AlertOctagon, color: "text-red-500" },
    cenro_force_resolved: { icon: ShieldAlert, color: "text-purple-400" },
    cenro_high_priority_deployed: { icon: Zap, color: "text-yellow-400" },
    cenro_stale_deploy: { icon: Hourglass, color: "text-orange-400" },
};

interface NotificationDropdownProps {
    unreadCount?: number;
    listPath: string;        // e.g. `/notifications/user/${userId}?limit=50`
    markAllPath: string;     // e.g. `/notifications/user/${userId}/mark-all-read`
    onNotificationClick?: (n: Notification) => void;
}

export function NotificationDropdown({
    unreadCount = 0,
    listPath,
    markAllPath,
    onNotificationClick,
}: NotificationDropdownProps) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<Notification[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [markAllPending, setMarkAllPending] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true);
        const check = () => setIsMobile(window.innerWidth < 640);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    // Close on outside click / Escape
    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                // If on mobile, backdrop handles dismiss
                if (!isMobile) setOpen(false);
            }
        };
        const onEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onClick);
        document.addEventListener("keydown", onEsc);
        return () => {
            document.removeEventListener("mousedown", onClick);
            document.removeEventListener("keydown", onEsc);
        };
    }, [open, isMobile]);

    const fetchList = async () => {
        if (!listPath) return;
        setLoading(true);
        setLoadError(false);
        try {
            const data = await api(listPath);
            if (Array.isArray(data)) setItems(data);
            else setItems([]);
        } catch {
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    };

    // Lazy-load on first open
    useEffect(() => {
        if (open && items === null && listPath) {
            fetchList();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, listPath]);

    const handleClickItem = (n: Notification) => {
        if (!n.is_read) {
            // Optimistic read mark
            setItems((prev) => prev ? prev.map((it) => it.id === n.id ? { ...it, is_read: true } : it) : prev);
            api(`/notifications/${n.id}/read`, { method: "POST" }).catch(() => { /* silent */ });
        }
        setOpen(false);
        onNotificationClick?.(n);
    };

    const handleMarkAll = async () => {
        if (!markAllPath || markAllPending || !items) return;
        const snapshot = items;
        setItems(items.map((it) => ({ ...it, is_read: true })));
        setMarkAllPending(true);
        try {
            await api(markAllPath, { method: "POST" });
            toast.success("All notifications marked as read");
        } catch (err) {
            setItems(snapshot);
            toast.error(err instanceof ApiError ? err.message : "Couldn't mark all as read.");
        } finally {
            setMarkAllPending(false);
        }
    };

    const dropdownContent = (
        <>
            <div className="p-4 border-b border-border flex items-center justify-between shrink-0 bg-card">
                <div className="flex items-center gap-2">
                    <div className="text-sm font-bold text-foreground">Notifications</div>
                    {unreadCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                            {unreadCount}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={handleMarkAll}
                        disabled={markAllPending || !items || items.every((i) => i.is_read)}
                        className="text-[11px] uppercase tracking-widest font-bold text-primary hover:text-primary/80 disabled:opacity-30 disabled:cursor-not-allowed px-1.5 py-1 rounded"
                    >
                        {markAllPending ? "..." : "Mark all"}
                    </button>
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="size-8 rounded-lg flex items-center justify-center text-foreground/50 hover:text-foreground hover:bg-foreground/5 active:scale-95 transition-all"
                        aria-label="Close notifications"
                    >
                        <X className="size-4" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {loading && (
                    <div className="p-8 text-center text-foreground/50">
                        <div className="inline-block w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        <p className="mt-2 text-xs font-bold">Loading…</p>
                    </div>
                )}
                {!loading && loadError && (
                    <div className="p-8 text-center">
                        <p className="text-xs text-foreground/60 mb-2">Couldn&apos;t load notifications.</p>
                        <button
                            type="button"
                            onClick={fetchList}
                            className="text-[11px] uppercase tracking-widest font-bold text-primary hover:text-primary/80"
                        >
                            Tap to retry
                        </button>
                    </div>
                )}
                {!loading && !loadError && items && items.length === 0 && (
                    <div className="p-8 text-center text-foreground/50">
                        <Bell className="size-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm font-bold">You&apos;re all caught up.</p>
                    </div>
                )}
                {!loading && !loadError && items && items.length > 0 && (
                    <ul className="divide-y divide-border">
                        {items.map((n) => {
                            const meta = ICON_MAP[n.kind] ?? { icon: Bell, color: "text-foreground/60" };
                            const Icon = meta.icon;
                            return (
                                <li key={n.id}>
                                    <button
                                        type="button"
                                        onClick={() => handleClickItem(n)}
                                        className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-foreground/5 transition-colors ${
                                            !n.is_read ? "bg-primary/5" : ""
                                        }`}
                                    >
                                        <div className={`shrink-0 mt-0.5 ${meta.color}`}>
                                            <Icon className="size-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-bold text-foreground truncate">{n.title}</p>
                                                {!n.is_read && (
                                                    <span className="shrink-0 size-2 rounded-full bg-primary" />
                                                )}
                                            </div>
                                            <p className="text-xs text-foreground/60 mt-0.5 line-clamp-2">{n.body}</p>
                                            <p className="text-[10px] uppercase tracking-widest text-foreground/40 mt-1 font-semibold">
                                                {formatRelative(n.created_at)}
                                            </p>
                                        </div>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </>
    );

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen((p) => !p)}
                className="relative size-10 rounded-full flex items-center justify-center text-foreground/70 hover:bg-foreground/5 hover:text-foreground transition-colors"
                aria-label={`${unreadCount} notifications`}
                aria-haspopup="menu"
                aria-expanded={open}
            >
                <Bell className="size-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Desktop Popover */}
            {open && !isMobile && (
                <div
                    role="menu"
                    className="absolute right-0 top-full mt-2 w-[380px] max-h-[480px] bg-card rounded-xl border border-border shadow-2xl shadow-black/40 overflow-hidden z-50 backdrop-blur-xl flex flex-col animate-in fade-in zoom-in-95 duration-200"
                >
                    {dropdownContent}
                </div>
            )}

            {/* Mobile Modal via Portal onto document.body to escape glass/backdrop-filter clipping */}
            {open && isMobile && mounted && typeof document !== "undefined" && createPortal(
                <div className="fixed inset-0 z-[100] flex flex-col pointer-events-auto">
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={() => setOpen(false)}
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Notifications"
                        className="fixed inset-x-3 top-16 bottom-20 z-[101] bg-card rounded-2xl border border-border shadow-2xl shadow-black/50 overflow-hidden flex flex-col animate-in slide-in-from-top-2 duration-200"
                    >
                        {dropdownContent}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
