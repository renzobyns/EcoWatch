"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, User, Settings, LogOut } from "lucide-react";

interface StoredUser {
    full_name?: string;
    email?: string;
    role?: string;
    barangay_assignment?: string;
}

function roleLabelFor(user: StoredUser | null): string {
    if (!user?.role) return "";
    if (user.role === "cenro") return "CENRO Officer";
    if (user.role === "barangay")
        return user.barangay_assignment
            ? `${user.barangay_assignment} Coordinator`
            : "Barangay Coordinator";
    if (user.role === "cleaner") return "Cleaner";
    return user.role;
}

export function ProfileDropdown() {
    const [open, setOpen] = useState(false);
    const [user, setUser] = useState<StoredUser | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        try {
            const stored = localStorage.getItem("ecowatch_user");
            if (stored) setUser(JSON.parse(stored));
        } catch {
            /* ignore */
        }
    }, []);

    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node))
                setOpen(false);
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
    }, [open]);

    const initial = user?.full_name?.charAt(0).toUpperCase() ?? "?";
    const displayRole = user?.role ? user.role.toUpperCase() : "";

    const signOut = () => {
        localStorage.removeItem("ecowatch_user");
        window.location.href = "/";
    };

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen((p) => !p)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-foreground/5 transition-colors"
                aria-haspopup="menu"
                aria-expanded={open}
            >
                <div className="size-9 rounded-full eco-gradient flex items-center justify-center text-white font-bold text-sm shadow-md shadow-primary/20">
                    {initial}
                </div>
                <div className="text-right hidden sm:block leading-tight">
                    <div className="text-sm font-semibold text-foreground">
                        {user?.full_name ?? "Account"}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-foreground/50">
                        {displayRole}
                    </div>
                </div>
                <ChevronDown
                    className={`size-4 text-foreground/50 transition-transform ${
                        open ? "rotate-180" : ""
                    }`}
                />
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute right-0 top-full mt-2 w-64 bg-card rounded-xl border border-border shadow-2xl shadow-black/40 overflow-hidden z-50 backdrop-blur-xl"
                >
                    <div className="p-4 border-b border-border">
                        <div className="text-sm font-bold text-foreground truncate">
                            {user?.full_name ?? "—"}
                        </div>
                        {user?.email && (
                            <div className="text-xs text-foreground/60 mt-0.5 truncate">
                                {user.email}
                            </div>
                        )}
                        <div className="text-[10px] uppercase tracking-widest text-primary mt-1 font-semibold">
                            {roleLabelFor(user)}
                        </div>
                    </div>
                    <div className="py-1">
                        <Link
                            href="/profile"
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 hover:bg-foreground/5 hover:text-foreground transition-colors"
                        >
                            <User className="size-4" />
                            Profile
                        </Link>
                        <Link
                            href="/settings"
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 hover:bg-foreground/5 hover:text-foreground transition-colors"
                        >
                            <Settings className="size-4" />
                            Settings
                        </Link>
                    </div>
                    <div className="border-t border-border py-1">
                        <button
                            type="button"
                            onClick={signOut}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                            <LogOut className="size-4" />
                            Sign Out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
