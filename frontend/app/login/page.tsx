"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const supabase = createClient();
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }

        // Fetch user role and redirect accordingly
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: profile } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", user.id)
                .single();

            if (profile?.role === "cenro") {
                window.location.href = "/dashboard";
            } else if (profile?.role === "barangay") {
                window.location.href = "/barangay";
            } else {
                window.location.href = "/";
            }
        }
    };

    return (
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
            <div className="w-full max-w-md space-y-8">

                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="w-16 h-16 mx-auto rounded-2xl overflow-hidden bg-white p-1 shadow-lg shadow-primary/20">
                        <img src="/logo.png" alt="EcoWatch" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-gradient">Welcome Back</h1>
                    <p className="text-foreground/50 text-sm">Sign in to your EcoWatch SJDM account</p>
                </div>

                {/* Form */}
                <form onSubmit={handleLogin} className="glass p-8 rounded-2xl space-y-6 border border-white/10">
                    {error && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground/80">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@email.com"
                            required
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary/50 transition-colors"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground/80">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary/50 transition-colors"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 eco-gradient text-white rounded-xl text-lg font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                    >
                        {loading ? "Signing in..." : "Sign In"}
                    </button>
                </form>

                {/* Footer */}
                <p className="text-center text-sm text-foreground/40">
                    Don&apos;t have an account?{" "}
                    <Link href="/signup" className="text-primary hover:underline font-semibold">
                        Create one
                    </Link>
                </p>
            </div>
        </div>
    );
}
