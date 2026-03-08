"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function WelcomePage() {
    const [name, setName] = useState<string>("there");

    useEffect(() => {
        const fetchUser = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("full_name")
                    .eq("id", user.id)
                    .single();
                if (profile?.full_name) setName(profile.full_name);
            }
        };
        fetchUser();
    }, []);

    return (
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
            <div className="max-w-lg text-center space-y-8">
                {/* Animated check */}
                <div className="w-24 h-24 mx-auto rounded-full eco-gradient flex items-center justify-center shadow-2xl shadow-primary/30 animate-in zoom-in duration-500">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                    </svg>
                </div>

                <div className="space-y-3">
                    <h1 className="text-4xl font-extrabold text-gradient">Welcome, {name}!</h1>
                    <p className="text-foreground/60">
                        Your email has been verified. You&apos;re now an official EcoWatch SJDM citizen reporter.
                    </p>
                </div>

                <div className="glass p-6 rounded-2xl border border-white/10 space-y-4 text-left">
                    <p className="text-sm font-bold text-foreground/80">Here&apos;s what you can do now:</p>
                    <div className="space-y-3">
                        <div className="flex items-start gap-3">
                            <span className="w-8 h-8 rounded-lg eco-gradient flex items-center justify-center text-white text-sm font-bold shrink-0 shadow shadow-primary/20">1</span>
                            <div>
                                <p className="font-semibold text-sm">Report illegal dumping</p>
                                <p className="text-xs text-foreground/40">Snap a photo and pin the location on our map</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="w-8 h-8 rounded-lg eco-gradient flex items-center justify-center text-white text-sm font-bold shrink-0 shadow shadow-primary/20">2</span>
                            <div>
                                <p className="font-semibold text-sm">Track your reports</p>
                                <p className="text-xs text-foreground/40">See real-time status from Pending to Resolved</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="w-8 h-8 rounded-lg eco-gradient flex items-center justify-center text-white text-sm font-bold shrink-0 shadow shadow-primary/20">3</span>
                            <div>
                                <p className="font-semibold text-sm">Help keep SJDM clean</p>
                                <p className="text-xs text-foreground/40">Every report helps our AI identify pollution hotspots</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        href="/report"
                        className="px-8 py-4 eco-gradient text-white rounded-xl text-lg font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-95 text-center"
                    >
                        Report a Violation
                    </Link>
                    <Link
                        href="/profile"
                        className="px-8 py-4 glass text-foreground rounded-xl text-lg font-bold hover:bg-white/5 transition-all text-center border border-white/10"
                    >
                        View My Profile
                    </Link>
                </div>
            </div>
        </div>
    );
}
