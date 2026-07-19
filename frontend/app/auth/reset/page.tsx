"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, ArrowRight, KeyRound, Mail } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

function ResetContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get("token");

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleForgotSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await api("/auth/forgot-password", {
                method: "POST",
                body: JSON.stringify({ email })
            });
            setSuccess(true);
        } catch (err) {
            const error = err as Error;
            setError(error.message || "Something went wrong.");
        } finally {
            setLoading(false);
        }
    };

    const handleResetSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirm) {
            setError("Passwords do not match.");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            await api("/auth/reset-password", {
                method: "POST",
                body: JSON.stringify({ token, new_password: password })
            });
            setSuccess(true);
        } catch (err) {
            const error = err as Error;
            setError(error.message || "Invalid or expired token.");
        } finally {
            setLoading(false);
        }
    };

    // PHASE 2: Resetting the password (token exists)
    if (token) {
        if (success) {
            return (
                <div className="w-full max-w-md p-8 bg-card border shadow-2xl rounded-2xl text-center space-y-6">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
                        <KeyRound className="w-8 h-8 text-emerald-500" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-foreground">Password Reset!</h2>
                        <p className="text-sm text-foreground/60 mt-2">Your password has been successfully updated.</p>
                    </div>
                    <Button className="w-full group" onClick={() => router.push("/login")}>
                        Proceed to Sign In
                        <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                </div>
            );
        }

        return (
            <div className="w-full max-w-md p-8 bg-card border shadow-2xl rounded-2xl">
                <div className="mb-8">
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Set New Password</h2>
                    <p className="text-sm text-foreground/60 mt-2">Enter your new password below.</p>
                </div>
                
                {error && (
                    <div className="mb-6 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
                        {error}
                    </div>
                )}

                <form onSubmit={handleResetSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-foreground/60 uppercase tracking-widest px-1">New Password</label>
                        <Input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-foreground/60 uppercase tracking-widest px-1">Confirm Password</label>
                        <Input
                            type="password"
                            required
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                        />
                    </div>
                    <Button type="submit" className="w-full mt-4" disabled={loading}>
                        {loading ? <Loader2 size={16} className="animate-spin" /> : "Reset Password"}
                    </Button>
                </form>
            </div>
        );
    }

    // PHASE 1: Forgot password (no token)
    if (success) {
        return (
            <div className="w-full max-w-md p-8 bg-card border shadow-2xl rounded-2xl text-center space-y-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                    <Mail className="w-8 h-8 text-primary" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Check Your Email</h2>
                    <p className="text-sm text-foreground/60 mt-2">
                        If an account exists for that email, we have sent a password reset link.
                    </p>
                </div>
                <Button variant="outline" className="w-full" onClick={() => router.push("/login")}>
                    Back to Sign In
                </Button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md p-8 bg-card border shadow-2xl rounded-2xl">
            <div className="mb-8">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Reset Password</h2>
                <p className="text-sm text-foreground/60 mt-2">
                    Enter your email address and we&apos;ll send you a link to reset your password.
                </p>
            </div>
            
            {error && (
                <div className="mb-6 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
                    {error}
                </div>
            )}

            <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-foreground/60 uppercase tracking-widest px-1">Email Address</label>
                    <Input
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>
                <Button type="submit" className="w-full mt-4" disabled={loading}>
                    {loading ? <Loader2 size={16} className="animate-spin" /> : "Send Reset Link"}
                </Button>
            </form>

            <p className="text-center text-xs text-foreground/50 mt-6">
                Remember your password?{" "}
                <Link href="/login" className="text-primary font-semibold hover:underline underline-offset-4">
                    Sign in
                </Link>
            </p>
        </div>
    );
}

export default function ResetPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
            
            <Suspense fallback={<div className="w-full max-w-md p-8 bg-card border rounded-2xl flex justify-center"><Loader2 className="animate-spin text-primary" /></div>}>
                <ResetContent />
            </Suspense>
        </div>
    );
}
