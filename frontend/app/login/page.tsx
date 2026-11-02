"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Leaf, Eye, EyeOff, ShieldCheck, Map, BarChart3, Clock } from "lucide-react";
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
    const router = useRouter();
    const [checkingAuth, setCheckingAuth] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const isExpired = params.get("expired") === "1" || params.get("session_expired") === "true";
            if (isExpired) {
                setSessionExpiredNotice(true);

                try {
                    localStorage.removeItem("ecowatch_user");
                    localStorage.removeItem("ecowatch_last_active");
                } catch {}
                setCheckingAuth(false);
                return;
            }

            // Guest-only guard: redirect already authenticated users to their portal
            const stored = localStorage.getItem("ecowatch_user");
            if (stored) {
                try {
                    const user = JSON.parse(stored);
                    if (user && user.role) {
                        const redirect = params.get("redirect");
                        const safeRedirect =
                            redirect &&
                            redirect.startsWith("/") &&
                            !redirect.startsWith("//") &&
                            !redirect.startsWith("/\\")
                                ? redirect
                                : null;

                        if (user.role === "barangay") {
                            router.replace("/barangay");
                        } else if (user.role === "cenro") {
                            router.replace("/cenro");
                        } else if (user.role === "cleaner") {
                            router.replace("/cleaner");
                        } else if (safeRedirect) {
                            router.replace(safeRedirect);
                        } else {
                            router.replace("/");
                        }
                        return;
                    }
                } catch {
                    localStorage.removeItem("ecowatch_user");
                }
            }

            setCheckingAuth(false);

        }
    }, [router]);

    const handleResend = async () => {
        setResending(true);
        try {
            await api("/auth/resend-verification", {
                method: "POST",
                body: JSON.stringify({ email }),
            });
            setError("Verification email resent. Please check your inbox.");
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to resend email. Please try again.");
        } finally {
            setResending(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const data = await api("/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password }),
            });

            if (data.success) {
                localStorage.setItem("ecowatch_user", JSON.stringify(data.user));
                
                const params = new URLSearchParams(window.location.search);
                const redirect = params.get("redirect");
                const safeRedirect =
                    redirect &&
                    redirect.startsWith("/") &&
                    !redirect.startsWith("//") &&
                    !redirect.startsWith("/\\")
                        ? redirect
                        : null;
                if (data.user.role === "barangay") {
                    window.location.href = "/barangay";
                } else if (data.user.role === "cenro") {
                    window.location.href = "/cenro";
                } else if (data.user.role === "cleaner") {
                    window.location.href = "/cleaner";
                } else if (safeRedirect) {
                    window.location.href = safeRedirect;
                } else {
                    window.location.href = "/";
                }
            } else {
                setError(data.detail || "Invalid email or password");
            }
        } catch (err: unknown) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Server error. Please try again later.");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
        if (!credentialResponse.credential) return;
        setLoading(true);
        setError("");
        try {
            const data = await api("/auth/google", {
                method: "POST",
                body: JSON.stringify({ credential: credentialResponse.credential }),
            });
            if (data.success) {
                localStorage.setItem("ecowatch_user", JSON.stringify(data.user));
                
                const params = new URLSearchParams(window.location.search);
                const redirect = params.get("redirect");
                const safeRedirect = redirect && redirect.startsWith("/") && !redirect.startsWith("//") && !redirect.startsWith("/\\") ? redirect : null;
                
                if (data.user.role === "barangay") window.location.href = "/barangay";
                else if (data.user.role === "cenro") window.location.href = "/cenro";
                else if (data.user.role === "cleaner") window.location.href = "/cleaner";
                else if (safeRedirect) window.location.href = safeRedirect;
                else window.location.href = "/";
            } else {
                setError(data.detail || "Google login failed");
            }
        } catch (err: unknown) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Server error during Google login.");
        } finally {
            setLoading(false);
        }
    };

    if (checkingAuth) {
        return (
            <div className="min-h-[calc(100dvh-5rem)] bg-background flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <p className="text-xs text-muted-foreground animate-pulse">Checking session...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100dvh-5rem)] lg:h-[calc(100dvh-5rem)] bg-background flex overflow-hidden">
            {/* Left Side: Marketing/Testimonial (Desktop Only) — adapts to theme */}
            <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-emerald-50 dark:bg-[#051105] text-foreground border-r border-border p-8 xl:p-12 flex-col justify-between">
                {/* Background Decor */}
                <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-primary/20 rounded-full blur-[120px]"></div>
                
                {/* Logo Section */}
                <div className="relative z-10 flex items-center gap-3">
                    <div className="w-8 h-8 eco-gradient rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                        <Leaf className="text-white" size={18} />
                    </div>
                    <span className="text-lg font-semibold tracking-tight">EcoWatch <span className="text-primary">SJDM</span></span>
                </div>

                {/* Feature Highlight - Internal Scroll if needed */}
                <div className="relative z-10 max-w-md my-auto py-8 overflow-y-auto scrollbar-hide">
                    <h1 className="text-2xl xl:text-3xl font-bold leading-tight mb-3">
                        Advanced Spatial Intelligence for a <span className="text-primary">Cleaner City.</span>
                    </h1>
                    <p className="text-sm text-foreground/70 leading-relaxed mb-7">
                        The official EcoWatch portal for San Jose del Monte officials and citizens. Powered by spatial data and AI verification.
                    </p>

                    <div className="grid grid-cols-1 gap-3">
                        {[
                            { icon: BarChart3, title: "AI Verification", desc: "Automated waste detection using machine learning." },
                            { icon: Map, title: "Spatial Routing", desc: "Intelligent report assignment via Ray-Casting." },
                            { icon: ShieldCheck, title: "Public Tracking", desc: "Real-time transparency for every citizen report." }
                        ].map((feature, i) => (
                            <div key={i} className="glass p-3.5 rounded-xl border border-border/50 flex items-center gap-3 hover:bg-foreground/5 transition-all">
                                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                    <feature.icon size={18} />
                                </div>
                                <div>
                                    <h3 className="text-[11px] font-semibold uppercase tracking-wider">{feature.title}</h3>
                                    <p className="text-[10px] text-foreground/50 mt-0.5">{feature.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer Links */}
                <div className="relative z-10 flex gap-6 text-[9px] font-bold uppercase tracking-widest text-foreground/40 mt-4">
                    <Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
                    <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
                    <span>© 2026 EcoWatch SJDM</span>
                </div>
            </div>

            {/* Right Side: Login Form */}
            <div className="w-full lg:w-1/2 flex flex-col items-center justify-start lg:justify-center p-6 sm:p-12 overflow-y-auto">
                <div className="w-full max-w-md my-auto py-6">
                    {/* Mobile Back Link */}
                    <Link 
                        href="/" 
                        className="lg:hidden inline-flex items-center gap-1.5 text-xs font-medium text-foreground/60 hover:text-foreground mb-4 transition-colors group"
                        aria-label="Back to home"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                        <span>Back to home</span>
                    </Link>

                    <div className="mb-8 lg:mb-10">
                        <div className="lg:hidden mb-4 flex items-center gap-2.5">
                            <div className="w-9 h-9 eco-gradient rounded-xl flex items-center justify-center shadow-md shadow-primary/20">
                                <Leaf className="text-white" size={20} />
                            </div>
                            <span className="text-base font-semibold tracking-tight">EcoWatch <span className="text-primary">SJDM</span></span>
                        </div>
                        <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-1">Log in to your account</h2>
                        <p className="text-sm text-foreground/50">Welcome back! Please enter your details.</p>
                    </div>

                    {sessionExpiredNotice && (
                        <div 
                            role="status" 
                            aria-live="polite" 
                            className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-medium text-amber-600 dark:text-amber-400 flex items-start gap-2.5 animate-in fade-in-50 duration-200"
                        >
                            <Clock size={16} className="shrink-0 mt-0.5" />
                            <span>Your session has expired due to inactivity. Please sign in again to continue.</span>
                        </div>
                    )}

                    {error && (
                        <div 
                            role="alert" 
                            aria-live="assertive" 
                            className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-500 flex flex-col gap-2"
                        >
                            <span>{error}</span>
                            {error.includes("verify") && (
                                <button
                                    type="button"
                                    onClick={handleResend}
                                    disabled={resending}
                                    className="text-left font-bold hover:underline"
                                >
                                    {resending ? "Resending..." : "Resend verification email"}
                                </button>
                            )}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-1.5">
                            <label htmlFor="login-email" className="text-[11px] font-semibold text-foreground/60 uppercase tracking-widest px-1">Email Address</label>
                            <Input
                                id="login-email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@company.com"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center px-1">
                                <label htmlFor="login-password" className="text-[11px] font-semibold text-foreground/60 uppercase tracking-widest">Password</label>
                                <Link href="/auth/reset" className="text-[10px] font-semibold text-primary hover:text-primary-dark uppercase tracking-widest transition-colors">
                                    Forgot Password?
                                </Link>
                            </div>
                            <div className="relative group">
                                <Input
                                    id="login-password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pr-11"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-foreground/40 hover:text-primary transition-colors cursor-pointer"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <Button type="submit" disabled={loading} size="lg" className="w-full">
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                "Sign In"
                            )}
                        </Button>
                    </form>

                    <div className="mt-6 space-y-5">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-border"></div>
                            </div>
                            <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                                <span className="bg-background px-4 text-foreground/60 font-semibold">Or continue with</span>
                            </div>
                        </div>

                        <div className="flex justify-center w-full">
                            <GoogleLogin
                                onSuccess={handleGoogleSuccess}
                                onError={() => setError("Google login was canceled or failed.")}
                                theme="filled_black"
                                shape="pill"
                                text="continue_with"
                                width="300px"
                            />
                        </div>

                        <p className="text-center text-xs text-foreground/60">
                            Don&apos;t have an account?{" "}
                            <Link href="/signup" className="text-primary font-semibold hover:underline underline-offset-4">
                                Sign up
                            </Link>
                        </p>
                    </div>

                    {/* Test Account Helper - Interactive */}
                    <div className="mt-8 p-3.5 rounded-xl bg-primary/5 border border-primary/10">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="text-primary" size={14} />
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">Testing Portal</span>
                            </div>
                            <span className="text-[9px] text-muted-foreground font-mono">pw: password123</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {['citizen@test.com', 'barangay@test.com', 'cenro@test.com', 'cleaner@test.com'].map(acc => (
                                <button
                                    key={acc}
                                    type="button"
                                    onClick={() => {
                                        setEmail(acc);
                                        setPassword("password123");
                                    }}
                                    title={`Click to populate ${acc}`}
                                    className="text-[9px] font-mono text-foreground/80 bg-foreground/5 hover:bg-primary/15 hover:text-primary hover:border-primary/40 px-2 py-1 rounded-md border border-border/80 transition-all cursor-pointer active:scale-95"
                                >
                                    {acc}
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-snug">
                            All 62 barangays: <span className="font-mono text-foreground/80">&lt;name&gt;@barangay.com</span> &amp; <span className="font-mono text-foreground/80">&lt;name&gt;@cleaners.com</span> (e.g., <span className="font-mono text-primary font-medium">muzonproper@barangay.com</span>)
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
