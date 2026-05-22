"use client";

import { useEffect, useState } from "react";
import { Phone, Mail, BookOpen, HelpCircle, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";

interface HelpTabProps {
    user: any;
}

interface BarangayAdmin {
    id: number;
    full_name: string;
    email: string;
    phone_number: string | null;
    barangay_assignment: string | null;
    is_active: boolean;
}

const FAQ = [
    {
        q: "What if I can't reach the site?",
        a: "Contact your barangay supervisor first. If the location is inaccessible, they can reassign or reprioritize the job.",
    },
    {
        q: "Can the AI be wrong?",
        a: "Yes. The AI is a verifier, not a judge. If it rejects a clean photo, retry with a clearer shot framed on the same area. Your supervisor can force-resolve if needed.",
    },
    {
        q: "Who decides the SLA deadline?",
        a: "CENRO sets the SLA policy per priority (high/medium/low). Your barangay picks the priority when deploying the job, which determines your deadline.",
    },
    {
        q: "What happens after I submit my photo?",
        a: "Our AI checks for visible waste. If clean: status → Verified, job closed. If still dirty: status → Needs Redo, you'll get a notification to try again.",
    },
];

export function HelpTab({ user }: HelpTabProps) {
    const [supervisor, setSupervisor] = useState<BarangayAdmin | null>(null);
    const [loading, setLoading] = useState(true);
    const [openFaq, setOpenFaq] = useState<number | null>(0);

    useEffect(() => {
        if (!user?.barangay_assignment) {
            setLoading(false);
            return;
        }
        const load = async () => {
            try {
                const data = await api(`/users?role=barangay&barangay=${encodeURIComponent(user.barangay_assignment)}`);
                if (Array.isArray(data)) {
                    const active = data.find((u: BarangayAdmin) => u.is_active);
                    setSupervisor(active ?? data[0] ?? null);
                }
            } catch {
                setSupervisor(null);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user?.barangay_assignment]);

    return (
        <div className="space-y-5 animate-slide-up max-w-3xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                    Help & <span className="text-primary">Support</span>
                </h1>
                <p className="text-xs text-foreground/50 mt-1">Reach your supervisor or learn how the cleaner workflow works.</p>
            </div>

            {/* Supervisor card */}
            <section className="glass rounded-2xl border border-border shadow-2xl p-5">
                <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-foreground/50 mb-3">
                    Your Supervisor
                </h3>
                {loading ? (
                    <div className="text-sm text-foreground/50 py-4">Loading…</div>
                ) : !user?.barangay_assignment ? (
                    <p className="text-sm text-foreground/60">
                        Supervisor not assigned. Please contact CENRO.
                    </p>
                ) : !supervisor ? (
                    <p className="text-sm text-foreground/60">
                        Supervisor information unavailable for {user.barangay_assignment}.
                    </p>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="size-12 rounded-full eco-gradient flex items-center justify-center text-white font-bold text-lg shadow-md shadow-primary/20">
                                {supervisor.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p className="font-bold text-foreground">{supervisor.full_name}</p>
                                <p className="text-xs text-foreground/60">
                                    Barangay Coordinator · {supervisor.barangay_assignment}
                                </p>
                            </div>
                        </div>
                        <div className="space-y-1.5 pl-15">
                            {supervisor.phone_number && (
                                <p className="text-sm text-foreground/80 flex items-center gap-2">
                                    <Phone className="size-3.5 text-primary" />
                                    {supervisor.phone_number}
                                </p>
                            )}
                            <p className="text-sm text-foreground/80 flex items-center gap-2">
                                <Mail className="size-3.5 text-primary" />
                                {supervisor.email}
                            </p>
                        </div>
                        <div className="flex gap-2 pt-1">
                            {supervisor.phone_number && (
                                <a
                                    href={`tel:${supervisor.phone_number.replace(/\s+/g, "")}`}
                                    className="px-3 py-2 rounded-lg eco-gradient text-white text-xs font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all inline-flex items-center gap-2"
                                >
                                    <Phone className="size-3.5" />
                                    Call
                                </a>
                            )}
                            <a
                                href={`mailto:${supervisor.email}`}
                                className="px-3 py-2 rounded-lg glass border border-border text-foreground text-xs font-bold hover:bg-foreground/10 transition-colors inline-flex items-center gap-2"
                            >
                                <Mail className="size-3.5" />
                                Email
                            </a>
                        </div>
                    </div>
                )}
            </section>

            {/* How to use */}
            <section className="glass rounded-2xl border border-border shadow-2xl p-5">
                <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-foreground/50 mb-3 flex items-center gap-2">
                    <BookOpen className="size-3.5" />
                    How to Use
                </h3>
                <ol className="space-y-2.5 text-sm text-foreground/80">
                    <li className="flex gap-3">
                        <span className="shrink-0 size-6 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center">1</span>
                        Open <strong className="text-foreground">My Jobs</strong> to see what your barangay has dispatched to you.
                    </li>
                    <li className="flex gap-3">
                        <span className="shrink-0 size-6 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center">2</span>
                        Tap <strong className="text-foreground">Start</strong> when you're on-site and ready to begin.
                    </li>
                    <li className="flex gap-3">
                        <span className="shrink-0 size-6 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center">3</span>
                        After cleaning, tap <strong className="text-foreground">Upload Photo</strong> and capture a clear shot of the area.
                    </li>
                    <li className="flex gap-3">
                        <span className="shrink-0 size-6 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center">4</span>
                        Our AI verifies — if clean, the job auto-closes as <strong className="text-green-400">Resolved</strong>.
                    </li>
                    <li className="flex gap-3">
                        <span className="shrink-0 size-6 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center">5</span>
                        If AI still sees waste, status flips to <strong className="text-yellow-400">Needs Redo</strong>. Clean again and re-upload.
                    </li>
                </ol>
            </section>

            {/* FAQ */}
            <section className="glass rounded-2xl border border-border shadow-2xl p-5">
                <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-foreground/50 mb-3 flex items-center gap-2">
                    <HelpCircle className="size-3.5" />
                    FAQ
                </h3>
                <ul className="divide-y divide-border">
                    {FAQ.map((item, idx) => {
                        const open = openFaq === idx;
                        return (
                            <li key={item.q}>
                                <button
                                    type="button"
                                    onClick={() => setOpenFaq(open ? null : idx)}
                                    className="w-full text-left py-3 flex items-center justify-between gap-3 group"
                                >
                                    <span className="text-sm font-bold text-foreground/90 group-hover:text-foreground">{item.q}</span>
                                    <ChevronDown
                                        className={`size-4 text-foreground/40 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
                                    />
                                </button>
                                {open && (
                                    <p className="pb-3 text-sm text-foreground/70 leading-relaxed">{item.a}</p>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </section>
        </div>
    );
}
