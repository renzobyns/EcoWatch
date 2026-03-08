"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function SignUpPage() {
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        setLoading(true);
        const supabase = createClient();

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    role: "citizen",  // All public sign-ups default to citizen
                }
            }
        });

        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }

        setSuccess(true);
        setLoading(false);
    };

    if (success) {
        return (
            <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
                <div className="glass p-10 rounded-2xl max-w-md text-center space-y-4 border border-primary/20">
                    <div className="w-16 h-16 mx-auto rounded-full eco-gradient flex items-center justify-center text-3xl shadow-lg shadow-primary/30">
                        ✓
                    </div>
                    <h2 className="text-2xl font-extrabold text-gradient">Account Created!</h2>
                    <p className="text-foreground/60 text-sm">
                        Check your email for a confirmation link. Once confirmed, you can sign in.
                    </p>
                    <Link
                        href="/login"
                        className="inline-block px-8 py-3 eco-gradient text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-95"
                    >
                        Go to Sign In
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md space-y-8">

                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="w-16 h-16 mx-auto rounded-2xl overflow-hidden bg-white p-1 shadow-lg shadow-primary/20">
                        <img src="/logo.png" alt="EcoWatch" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-gradient">Join EcoWatch</h1>
                    <p className="text-foreground/50 text-sm">Help protect San Jose del Monte&apos;s waterways</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSignUp} className="glass p-8 rounded-2xl space-y-5 border border-white/10">
                    {error && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground/80">Full Name</label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Juan Dela Cruz"
                            required
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary/50 transition-colors"
                        />
                    </div>

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
                            placeholder="At least 6 characters"
                            required
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary/50 transition-colors"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground/80">Confirm Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
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
                        {loading ? "Creating account..." : "Create Account"}
                    </button>

                    <p className="text-[10px] text-foreground/30 text-center leading-relaxed">
                        By signing up, you agree to help keep SJDM clean and report responsibly.
                    </p>
                </form>

                {/* Footer */}
                <p className="text-center text-sm text-foreground/40">
                    Already have an account?{" "}
                    <Link href="/login" className="text-primary hover:underline font-semibold">
                        Sign In
                    </Link>
                </p>
            </div>
        </div>
    );
}
