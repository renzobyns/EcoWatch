"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, ArrowLeft, ShieldCheck, Leaf, Map, BarChart3, User, Mail, Check } from "lucide-react";
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://renzobyns-ecowatch-backend.hf.space";

export default function SignUpPage() {
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Real-time password criteria
    const hasMinLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
    const isPasswordValid = hasMinLength && hasUppercase && hasNumber && passwordsMatch;

    const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
        if (!credentialResponse.credential) return;
        setLoading(true);
        setError(null);
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
            setError(err instanceof Error ? err.message : "Server error during Google signup.");
        } finally {
            setLoading(false);
        }
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!isPasswordValid) {
            if (!hasMinLength) setError("Password must be at least 8 characters long.");
            else if (!hasUppercase) setError("Password must contain at least one uppercase letter (A-Z).");
            else if (!hasNumber) setError("Password must contain at least one number (0-9).");
            else if (!passwordsMatch) setError("Passwords do not match.");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email,
                    password,
                    full_name: fullName,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setSuccess(true);
            } else {
                setError(data.detail || "Failed to create account. Please try again.");
            }
        } catch (err) {
            console.error(err);
            setError("Server error. Please check if the backend is running.");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="h-[calc(100vh-5rem)] bg-background flex items-center justify-center p-6 overflow-hidden">
                <div className="glass p-8 rounded-2xl max-w-md w-full text-center space-y-5 border border-primary/20 shadow-2xl animate-in zoom-in-95 duration-300">
                    <div className="w-16 h-16 mx-auto rounded-full eco-gradient flex items-center justify-center text-white shadow-xl shadow-primary/30">
                        <Mail size={32} />
                    </div>
                    <div className="space-y-1.5">
                        <h2 className="text-2xl font-bold text-foreground tracking-tight">Check your email</h2>
                        <p className="text-foreground/60 text-sm leading-relaxed">
                            We&apos;ve sent a verification link to <span className="text-primary font-semibold">{email}</span>. Please verify your email to activate your account.
                        </p>
                    </div>
                    <Button asChild size="lg" className="w-full">
                        <Link href="/login">Return to Sign In</Link>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-5rem)] bg-background flex overflow-hidden">
            {/* Left Side: Features (Desktop) — adapts to theme */}
            <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-emerald-50 dark:bg-[#051105] text-foreground border-r border-border p-8 xl:p-12 flex-col justify-between">
                <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-primary/20 rounded-full blur-[120px]"></div>
                
                <div className="relative z-10 flex items-center gap-3">
                    <div className="w-8 h-8 eco-gradient rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                        <Leaf className="text-white" size={18} />
                    </div>
                    <span className="text-lg font-semibold tracking-tight">EcoWatch <span className="text-primary">SJDM</span></span>
                </div>

                <div className="relative z-10 max-w-md my-auto py-8">
                    <h1 className="text-2xl xl:text-3xl font-bold leading-tight mb-3">
                        Join the <span className="text-primary">EcoWatch</span> Movement.
                    </h1>
                    <p className="text-sm text-foreground/70 leading-relaxed mb-7">
                        Become a verified citizen reporter and help San Jose del Monte transition to a zero-waste future.
                    </p>

                    <div className="grid grid-cols-1 gap-3">
                        {[
                            { icon: BarChart3, title: "AI Verification", desc: "Our Mask R-CNN model verifies your reports instantly." },
                            { icon: Map, title: "Spatial Routing", desc: "Reports are automatically routed to the nearest Barangay." },
                            { icon: ShieldCheck, title: "Secure Data", desc: "Your identity is protected while you help your community." }
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

                <div className="relative z-10 flex gap-6 text-[9px] font-bold uppercase tracking-widest text-foreground/40 mt-4">
                    <Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
                    <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
                    <span>© 2026 EcoWatch SJDM</span>
                </div>
            </div>

            {/* Right Side: Sign Up Form */}
            <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 sm:p-12 overflow-y-auto">
                <Link href="/" className="absolute top-6 left-6 text-foreground/50 hover:text-foreground transition-colors flex items-center gap-2">
                    <ArrowLeft size={18} />
                </Link>

                <div className="w-full max-w-md py-4">
                    <div className="mb-7">
                        <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-1">Create an account</h2>
                        <p className="text-sm text-foreground/50">Start your journey as a citizen reporter.</p>
                    </div>

                    {error && (
                        <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-400">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSignUp} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-foreground/60 uppercase tracking-widest px-1">Full Name</label>
                            <div className="relative group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/30 group-focus-within:text-primary transition-colors pointer-events-none z-10">
                                    <User size={16} />
                                </div>
                                <Input
                                    type="text"
                                    required
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="pl-10"
                                    placeholder="Juan Dela Cruz"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-foreground/60 uppercase tracking-widest px-1">Email Address</label>
                            <div className="relative group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/30 group-focus-within:text-primary transition-colors pointer-events-none z-10">
                                    <Mail size={16} />
                                </div>
                                <Input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10"
                                    placeholder="name@company.com"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-semibold text-foreground/60 uppercase tracking-widest px-1">Password</label>
                                <div className="relative group">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pr-9"
                                        placeholder="••••••"
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-primary transition-colors">
                                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-semibold text-foreground/60 uppercase tracking-widest px-1">Confirm</label>
                                <div className="relative group">
                                    <Input
                                        type={showConfirm ? "text" : "password"}
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="pr-9"
                                        placeholder="••••••"
                                    />
                                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-primary transition-colors">
                                        {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Password Requirements Live Checklist */}
                        {password.length > 0 && (
                            <div className="p-3 rounded-xl bg-card/60 border border-border/50 text-[11px] space-y-1.5 animate-in fade-in-50 duration-200">
                                <span className="text-foreground/50 font-semibold uppercase tracking-wider text-[10px] block mb-1">
                                    Password Requirements:
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                    <div className={`flex items-center gap-1.5 transition-colors ${hasMinLength ? "text-emerald-500 font-medium" : "text-foreground/40"}`}>
                                        {hasMinLength ? <Check size={12} className="shrink-0 text-emerald-500" /> : <div className="w-1.5 h-1.5 rounded-full bg-foreground/30 mx-0.5 shrink-0" />}
                                        <span>8+ characters</span>
                                    </div>
                                    <div className={`flex items-center gap-1.5 transition-colors ${hasUppercase ? "text-emerald-500 font-medium" : "text-foreground/40"}`}>
                                        {hasUppercase ? <Check size={12} className="shrink-0 text-emerald-500" /> : <div className="w-1.5 h-1.5 rounded-full bg-foreground/30 mx-0.5 shrink-0" />}
                                        <span>1+ uppercase letter</span>
                                    </div>
                                    <div className={`flex items-center gap-1.5 transition-colors ${hasNumber ? "text-emerald-500 font-medium" : "text-foreground/40"}`}>
                                        {hasNumber ? <Check size={12} className="shrink-0 text-emerald-500" /> : <div className="w-1.5 h-1.5 rounded-full bg-foreground/30 mx-0.5 shrink-0" />}
                                        <span>1+ number (0-9)</span>
                                    </div>
                                    <div className={`flex items-center gap-1.5 transition-colors ${passwordsMatch ? "text-emerald-500 font-medium" : "text-foreground/40"}`}>
                                        {passwordsMatch ? <Check size={12} className="shrink-0 text-emerald-500" /> : <div className="w-1.5 h-1.5 rounded-full bg-foreground/30 mx-0.5 shrink-0" />}
                                        <span>Passwords match</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Consent Checkbox for RA 10173 & Terms */}
                        <div className="flex items-start gap-2.5 pt-1 px-0.5">
                            <input
                                id="terms-consent"
                                type="checkbox"
                                checked={agreedToTerms}
                                onChange={(e) => setAgreedToTerms(e.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary accent-primary cursor-pointer shrink-0"
                                required
                            />
                            <label htmlFor="terms-consent" className="text-[11px] text-foreground/70 leading-relaxed cursor-pointer select-none">
                                I agree to the{" "}
                                <Link href="/terms" target="_blank" className="text-primary font-medium hover:underline underline-offset-2">
                                    Terms of Service
                                </Link>{" "}
                                and acknowledge the{" "}
                                <Link href="/privacy" target="_blank" className="text-primary font-medium hover:underline underline-offset-2">
                                    Privacy Policy
                                </Link>{" "}
                                in accordance with RA 10173.
                            </label>
                        </div>

                        <Button type="submit" disabled={loading || !agreedToTerms || !isPasswordValid} size="lg" className="w-full mt-2">
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                "Create Account"
                            )}
                        </Button>
                    </form>

                    <div className="mt-7 space-y-5">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-border"></div>
                            </div>
                            <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                                <span className="bg-background px-4 text-foreground/40 font-semibold">Or continue with</span>
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

                        <p className="text-center text-xs text-foreground/50">
                            Already have an account?{" "}
                            <Link href="/login" className="text-primary font-semibold hover:underline underline-offset-4">
                                Sign In
                            </Link>
                        </p>

                        <p className="text-[10px] text-foreground/40 text-center leading-relaxed">
                            Protected by the Philippine Data Privacy Act of 2012 (RA 10173). Your reports help keep the City of San Jose del Monte clean.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

