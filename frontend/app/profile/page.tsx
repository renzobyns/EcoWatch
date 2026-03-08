"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

interface Profile {
    full_name: string;
    role: string;
    barangay: string | null;
    created_at: string;
}

export default function ProfilePage() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [email, setEmail] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchProfile = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.push("/login");
                return;
            }

            setEmail(user.email || "");

            const { data: profile } = await supabase
                .from("profiles")
                .select("full_name, role, barangay, created_at")
                .eq("id", user.id)
                .single();

            if (profile) setProfile(profile);
            setLoading(false);
        };
        fetchProfile();
    }, [router]);

    const handleSignOut = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/");
    };

    if (loading) {
        return (
            <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
                <div className="glass p-8 rounded-2xl animate-pulse text-foreground/40">Loading profile...</div>
            </div>
        );
    }

    if (!profile) return null;

    const roleBadge = {
        citizen: { label: "Citizen Reporter", color: "bg-primary/20 text-primary" },
        barangay: { label: "Barangay Admin", color: "bg-blue-500/20 text-blue-400" },
        cenro: { label: "CENRO Admin", color: "bg-yellow-500/20 text-yellow-400" },
    }[profile.role] || { label: "User", color: "bg-white/10 text-foreground/60" };

    const joinDate = new Date(profile.created_at).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    return (
        <div className="min-h-[calc(100vh-4rem)] px-4 py-12">
            <div className="max-w-2xl mx-auto space-y-8">

                {/* Profile Header */}
                <div className="glass p-8 rounded-2xl border border-white/10 text-center space-y-4">
                    <div className="w-20 h-20 mx-auto rounded-full eco-gradient flex items-center justify-center text-3xl font-bold text-white shadow-lg shadow-primary/30">
                        {profile.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h1 className="text-2xl font-extrabold">{profile.full_name}</h1>
                        <p className="text-foreground/50 text-sm">{email}</p>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${roleBadge.color}`}>
                            {roleBadge.label}
                        </span>
                        <span className="text-xs text-foreground/30">Joined {joinDate}</span>
                    </div>
                </div>

                {/* Report History (placeholder) */}
                <div className="glass p-6 rounded-2xl border border-white/10 space-y-4">
                    <h2 className="text-lg font-bold">My Reports</h2>
                    <div className="p-8 text-center text-foreground/30 border border-dashed border-white/10 rounded-xl">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 text-foreground/20">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14,2 14,8 20,8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10,9 9,9 8,9" />
                        </svg>
                        <p className="text-sm font-medium">No reports yet</p>
                        <p className="text-xs text-foreground/20 mt-1">Your submitted reports will appear here</p>
                    </div>
                </div>

                {/* Account Actions */}
                <div className="glass p-6 rounded-2xl border border-white/10 space-y-4">
                    <h2 className="text-lg font-bold">Account</h2>
                    <button
                        onClick={handleSignOut}
                        className="w-full py-3 rounded-xl border border-red-500/20 text-red-400 font-semibold text-sm hover:bg-red-500/10 transition-colors active:scale-95"
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}
