"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ArrowLeft, Chrome, ShieldCheck, Leaf, Map, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                localStorage.setItem("ecowatch_user", JSON.stringify(data.user));
                if (data.user.role === "barangay") {
                    window.location.href = "/barangay";
                } else if (data.user.role === "cenro") {
                    window.location.href = "/cenro";
                } else {
                    window.location.href = "/";
                }
            } else {
                setError(data.detail || "Invalid email or password");
            }
        } catch (err) {
            console.error(err);
            setError("Server error. Please try again later.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen h-[100dvh] bg-[#0a0f0a] flex overflow-hidden">
            {/* Left Side: Marketing/Testimonial (Desktop Only) */}
            <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-[#051105] border-r border-white/5 p-8 xl:p-12 flex-col justify-between">
                {/* Background Decor */}
                <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-primary/20 rounded-full blur-[120px]"></div>
                
                {/* Logo Section */}
                <div className="relative z-10 flex items-center gap-3">
                    <div className="w-8 h-8 eco-gradient rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                        <Leaf className="text-white" size={18} />
                    </div>
                    <span className="text-lg font-semibold text-white tracking-tight">EcoWatch <span className="text-primary">SJDM</span></span>
                </div>

                {/* Feature Highlight - Internal Scroll if needed */}
                <div className="relative z-10 max-w-md my-auto py-8 overflow-y-auto scrollbar-hide">
                    <h1 className="text-2xl xl:text-3xl font-bold text-white leading-tight mb-3">
                        Advanced Spatial Intelligence for a <span className="text-primary">Cleaner City.</span>
                    </h1>
                    <p className="text-sm text-white/60 leading-relaxed mb-7">
                        The official EcoWatch portal for San Jose del Monte officials and citizens. Powered by spatial data and AI verification.
                    </p>

                    <div className="grid grid-cols-1 gap-3">
                        {[
                            { icon: BarChart3, title: "AI Verification", desc: "Automated waste detection using machine learning." },
                            { icon: Map, title: "Spatial Routing", desc: "Intelligent report assignment via Ray-Casting." },
                            { icon: ShieldCheck, title: "Public Tracking", desc: "Real-time transparency for every citizen report." }
                        ].map((feature, i) => (
                            <div key={i} className="glass p-3.5 rounded-xl border border-white/5 flex items-center gap-3 hover:bg-white/5 transition-all">
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

                {/* Footer Links */}
                <div className="relative z-10 flex gap-6 text-[9px] font-bold uppercase tracking-widest text-white/30 mt-4">
                    <a href="#" className="hover:text-primary transition-colors">Privacy</a>
                    <a href="#" className="hover:text-primary transition-colors">Terms</a>
                    <span>© 2024 EcoWatch SJDM</span>
                </div>
            </div>

            {/* Right Side: Login Form */}
            <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 sm:p-12 overflow-y-auto">
                <Link href="/" className="lg:hidden absolute top-6 left-6 text-white/50 hover:text-white transition-colors flex items-center gap-2">
                    <ArrowLeft size={18} />
                </Link>

                <div className="w-full max-w-md py-4">
                    <div className="mb-8 lg:mb-10">
                        <div className="lg:hidden mb-6">
                            <div className="w-10 h-10 eco-gradient rounded-xl flex items-center justify-center mb-4">
                                <Leaf className="text-white" size={24} />
                            </div>
                        </div>
                        <h2 className="text-xl lg:text-2xl font-bold text-white mb-1">Log in to your account</h2>
                        <p className="text-sm text-white/50">Welcome back! Please enter your details.</p>
                    </div>

                    {error && (
                        <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-400">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest px-1">Email Address</label>
                            <Input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@company.com"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">Password</label>
                                <Link href="/auth/reset" className="text-[10px] font-semibold text-primary hover:text-primary-dark uppercase tracking-widest transition-colors">
                                    Forgot Password?
                                </Link>
                            </div>
                            <div className="relative group">
                                <Input
                                    type={showPassword ? "text" : "password"}
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
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-primary transition-colors cursor-pointer"
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
                                <div className="w-full border-t border-white/10"></div>
                            </div>
                            <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                                <span className="bg-[#0a0f0a] px-4 text-white/30 font-semibold">Or continue with</span>
                            </div>
                        </div>

                        <Button variant="outline" className="w-full group">
                            <Chrome className="text-white/40 group-hover:text-primary transition-colors" size={16} />
                            Sign in with Google
                        </Button>

                        <p className="text-center text-xs text-white/40">
                            Don't have an account?{" "}
                            <Link href="/signup" className="text-primary font-semibold hover:underline underline-offset-4">
                                Sign up
                            </Link>
                        </p>
                    </div>

                    {/* Test Account Helper - Compact */}
                    <div className="mt-8 p-3 rounded-xl bg-primary/5 border border-primary/10">
                        <div className="flex items-center gap-2 mb-2">
                            <ShieldCheck className="text-primary" size={13} />
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">Testing Portal</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {['citizen@test.com', 'barangay@test.com', 'cenro@test.com'].map(acc => (
                                <span key={acc} className="text-[9px] font-mono text-white/30 bg-black/40 px-1.5 py-0.5 rounded border border-white/5">{acc}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
