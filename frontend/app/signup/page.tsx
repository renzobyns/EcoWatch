"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { Eye, EyeOff, ArrowLeft, ShieldCheck, Leaf, Map, BarChart3, User, Mail, Lock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SignUpPage() {
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
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

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    role: "citizen",
                },
                emailRedirectTo: `${window.location.origin}/auth/callback`,
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
            <div className="h-screen h-[100dvh] bg-[#0a0f0a] flex items-center justify-center p-6 overflow-hidden">
                <div className="glass p-8 rounded-2xl max-w-md w-full text-center space-y-5 border border-primary/20 shadow-2xl animate-in zoom-in-95 duration-300">
                    <div className="w-16 h-16 mx-auto rounded-full eco-gradient flex items-center justify-center text-white shadow-xl shadow-primary/30">
                        <CheckCircle2 size={32} />
                    </div>
                    <div className="space-y-1.5">
                        <h2 className="text-2xl font-bold text-white tracking-tight">Account Created!</h2>
                        <p className="text-white/50 text-sm leading-relaxed">
                            We've sent a confirmation link to <span className="text-primary font-semibold">{email}</span>. Please verify your email to start reporting.
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
        <div className="h-screen h-[100dvh] bg-[#0a0f0a] flex overflow-hidden">
            {/* Left Side: Features (Desktop) */}
            <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-[#051105] border-r border-white/5 p-8 xl:p-12 flex-col justify-between">
                <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-primary/20 rounded-full blur-[120px]"></div>
                
                <div className="relative z-10 flex items-center gap-3">
                    <div className="w-8 h-8 eco-gradient rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                        <Leaf className="text-white" size={18} />
                    </div>
                    <span className="text-lg font-semibold text-white tracking-tight">EcoWatch <span className="text-primary">SJDM</span></span>
                </div>

                <div className="relative z-10 max-w-md my-auto py-8">
                    <h1 className="text-2xl xl:text-3xl font-bold text-white leading-tight mb-3">
                        Join the <span className="text-primary">EcoWatch</span> Movement.
                    </h1>
                    <p className="text-sm text-white/60 leading-relaxed mb-7">
                        Become a verified citizen reporter and help San Jose del Monte transition to a zero-waste future.
                    </p>

                    <div className="grid grid-cols-1 gap-3">
                        {[
                            { icon: BarChart3, title: "AI Verification", desc: "Our Mask R-CNN model verifies your reports instantly." },
                            { icon: Map, title: "Spatial Routing", desc: "Reports are automatically routed to the nearest Barangay." },
                            { icon: ShieldCheck, title: "Secure Data", desc: "Your identity is protected while you help your community." }
                        ].map((feature, i) => (
                            <div key={i} className="glass p-3.5 rounded-xl border border-white/5 flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                    <feature.icon size={18} />
                                </div>
                                <div>
                                    <h3 className="text-[11px] font-semibold text-white uppercase tracking-wider">{feature.title}</h3>
                                    <p className="text-[10px] text-white/40 mt-0.5">{feature.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="relative z-10 flex gap-6 text-[9px] font-bold uppercase tracking-widest text-white/30">
                    <span>© 2024 EcoWatch SJDM</span>
                </div>
            </div>

            {/* Right Side: Sign Up Form */}
            <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 sm:p-12 overflow-y-auto">
                <Link href="/" className="absolute top-6 left-6 text-white/50 hover:text-white transition-colors flex items-center gap-2">
                    <ArrowLeft size={18} />
                </Link>

                <div className="w-full max-w-md py-4">
                    <div className="mb-7">
                        <h2 className="text-xl lg:text-2xl font-bold text-white mb-1">Create an account</h2>
                        <p className="text-sm text-white/50">Start your journey as a citizen reporter.</p>
                    </div>

                    {error && (
                        <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-400">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSignUp} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest px-1">Full Name</label>
                            <div className="relative group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors pointer-events-none z-10">
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
                            <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest px-1">Email Address</label>
                            <div className="relative group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors pointer-events-none z-10">
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
                                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest px-1">Password</label>
                                <div className="relative group">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pr-9"
                                        placeholder="••••••"
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-primary transition-colors">
                                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest px-1">Confirm</label>
                                <div className="relative group">
                                    <Input
                                        type={showConfirm ? "text" : "password"}
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="pr-9"
                                        placeholder="••••••"
                                    />
                                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-primary transition-colors">
                                        {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <Button type="submit" disabled={loading} size="lg" className="w-full mt-1">
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                "Create Account"
                            )}
                        </Button>
                    </form>

                    <div className="mt-7 space-y-5">
                        <p className="text-center text-xs text-white/40">
                            Already have an account?{" "}
                            <Link href="/login" className="text-primary font-semibold hover:underline underline-offset-4">
                                Sign In
                            </Link>
                        </p>

                        <p className="text-[10px] text-white/20 text-center leading-relaxed">
                            By signing up, you agree to help keep SJDM clean and report environmental issues responsibly.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

