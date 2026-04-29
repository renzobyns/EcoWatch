"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { Eye, EyeOff, ArrowLeft, ShieldCheck, Leaf, Map, BarChart3, User, Mail, Lock, CheckCircle2 } from "lucide-react";

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
                <div className="glass p-10 rounded-3xl max-w-md w-full text-center space-y-6 border border-primary/20 shadow-2xl animate-in zoom-in-95 duration-300">
                    <div className="w-20 h-20 mx-auto rounded-full eco-gradient flex items-center justify-center text-white shadow-xl shadow-primary/30">
                        <CheckCircle2 size={40} />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-3xl font-black text-white tracking-tight">Account Created!</h2>
                        <p className="text-white/50 text-sm leading-relaxed">
                            We've sent a confirmation link to <span className="text-primary font-bold">{email}</span>. Please verify your email to start reporting.
                        </p>
                    </div>
                    <Link
                        href="/login"
                        className="flex items-center justify-center gap-2 w-full py-4 eco-gradient text-white rounded-xl font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        Return to Sign In
                    </Link>
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
                    <span className="text-xl font-black text-white tracking-tighter">EcoWatch <span className="text-primary">SJDM</span></span>
                </div>

                <div className="relative z-10 max-w-md my-auto py-8">
                    <h1 className="text-3xl xl:text-4xl font-black text-white leading-tight mb-4">
                        Join the <span className="text-primary">EcoWatch</span> Movement.
                    </h1>
                    <p className="text-sm text-white/60 leading-relaxed mb-8">
                        Become a verified citizen reporter and help San Jose del Monte transition to a zero-waste future.
                    </p>
                    
                    <div className="grid grid-cols-1 gap-4">
                        {[
                            { icon: BarChart3, title: "AI Verification", desc: "Our Mask R-CNN model verifies your reports instantly." },
                            { icon: Map, title: "Spatial Routing", desc: "Reports are automatically routed to the nearest Barangay." },
                            { icon: ShieldCheck, title: "Secure Data", desc: "Your identity is protected while you help your community." }
                        ].map((feature, i) => (
                            <div key={i} className="glass p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                    <feature.icon size={20} />
                                </div>
                                <div>
                                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">{feature.title}</h3>
                                    <p className="text-[10px] text-white/40">{feature.desc}</p>
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
                    <div className="mb-8">
                        <h2 className="text-2xl lg:text-3xl font-black text-white mb-1">Create an account</h2>
                        <p className="text-sm text-white/50">Start your journey as a citizen reporter.</p>
                    </div>

                    {error && (
                        <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-400">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSignUp} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Full Name</label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors">
                                    <User size={18} />
                                </div>
                                <input 
                                    type="text" 
                                    required
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 pl-12 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:bg-white/[0.08] transition-all"
                                    placeholder="Juan Dela Cruz"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Email Address</label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors">
                                    <Mail size={18} />
                                </div>
                                <input 
                                    type="email" 
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 pl-12 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:bg-white/[0.08] transition-all"
                                    placeholder="name@company.com"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Password</label>
                                <div className="relative group">
                                    <input 
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 pr-10 text-sm text-white focus:outline-none focus:border-primary/50 transition-all"
                                        placeholder="••••••"
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-primary transition-colors">
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Confirm</label>
                                <div className="relative group">
                                    <input 
                                        type={showConfirm ? "text" : "password"}
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 pr-10 text-sm text-white focus:outline-none focus:border-primary/50 transition-all"
                                        placeholder="••••••"
                                    />
                                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-primary transition-colors">
                                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full py-4 mt-2 eco-gradient text-white rounded-xl text-sm font-bold shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-70 flex justify-center items-center gap-2"
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                "Create Account"
                            )}
                        </button>
                    </form>

                    <div className="mt-8 space-y-6">
                        <p className="text-center text-xs text-white/40">
                            Already have an account?{" "}
                            <Link href="/login" className="text-primary font-bold hover:underline underline-offset-4">
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

