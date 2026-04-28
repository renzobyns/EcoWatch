"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
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
                // Save user to localStorage (Local-first dev approach)
                localStorage.setItem("ecowatch_user", JSON.stringify(data.user));

                // Route based on role
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
        <div className="min-h-screen bg-[#0a0f0a] flex flex-col items-center justify-center p-4">
            <Link href="/" className="absolute top-8 left-8 text-white/50 hover:text-white transition-colors flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Back to Home
            </Link>

            <div className="w-full max-w-md glass p-8 rounded-3xl border border-white/10 shadow-2xl">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                    </div>
                    <h2 className="text-2xl font-black text-white">Welcome Back</h2>
                    <p className="text-sm text-white/50">Sign in to the EcoWatch Portal</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm font-medium text-red-400 text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-white/50 mb-2 uppercase tracking-wider">Email Address</label>
                        <input 
                            type="email" 
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors"
                            placeholder="e.g. admin@muzon.gov.ph"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-white/50 mb-2 uppercase tracking-wider">Password</label>
                        <input 
                            type="password" 
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-primary/50 transition-colors"
                            placeholder="••••••••"
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-4 mt-4 eco-gradient text-white rounded-xl font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-70 flex justify-center items-center gap-2"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            "Sign In"
                        )}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-white/10 text-center">
                    <p className="text-xs text-white/40 mb-2">Default test accounts:</p>
                    <div className="flex justify-center gap-4 text-xs font-mono text-primary/80">
                        <span>citizen@test.com</span>
                        <span>barangay@test.com</span>
                        <span>cenro@test.com</span>
                    </div>
                    <p className="text-[10px] text-white/30 mt-1">password: password123</p>
                </div>
            </div>
        </div>
    );
}
