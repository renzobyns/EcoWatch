"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Navbar() {
    const [menuOpen, setMenuOpen] = useState(false);
    const [user, setUser] = useState<{ name: string; initial: string } | null>(null);

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("full_name")
                    .eq("id", authUser.id)
                    .single();
                if (profile) {
                    setUser({
                        name: profile.full_name,
                        initial: profile.full_name.charAt(0).toUpperCase(),
                    });
                }
            }
        };
        fetchUser();
    }, []);

    const links = [
        { href: "/", label: "Home" },
        { href: "/report", label: "Report Issue" },
        { href: "/barangay", label: "Barangay Portal" },
        { href: "/dashboard", label: "CENRO Dashboard" },
    ];

    return (
        <nav className="fixed top-0 w-full z-50 glass border-b border-primary/20 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">

                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="w-10 h-10 rounded-lg overflow-hidden shadow-lg shadow-primary/20 bg-white flex items-center justify-center p-0.5 group-hover:scale-110 transition-transform duration-300">
                            <img src="/logo.png" alt="EcoWatch" className="w-full h-full object-contain" />
                        </div>
                        <span className="text-2xl font-bold tracking-tight text-gradient">
                            EcoWatch <span className="text-foreground/50 text-sm font-medium">SJDM</span>
                        </span>
                    </Link>

                    {/* Desktop Nav */}
                    <div className="hidden md:flex items-center space-x-8">
                        <Link href="/" className="text-foreground/70 hover:text-primary transition-colors text-sm font-medium underline-offset-4 hover:underline">Home</Link>
                        <Link href="/report" className="text-foreground/70 hover:text-primary transition-colors text-sm font-medium underline-offset-4 hover:underline">Report Issue</Link>
                        <div className="h-4 w-px bg-white/10 mx-2" />
                        <Link href="/barangay" className="text-foreground/70 hover:text-primary transition-colors text-sm font-medium">Barangay Portal</Link>
                        <Link href="/dashboard" className="text-foreground/70 hover:text-primary transition-colors text-sm font-medium">CENRO Dashboard</Link>

                        {user ? (
                            <Link href="/profile" className="flex items-center gap-2 group">
                                <div className="w-9 h-9 rounded-full eco-gradient flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                                    {user.initial}
                                </div>
                                <span className="text-sm font-semibold text-foreground/80 group-hover:text-primary transition-colors">{user.name}</span>
                            </Link>
                        ) : (
                            <Link href="/login" className="px-4 py-2 eco-gradient text-white rounded-full text-sm font-semibold hover:opacity-90 transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-primary/20">
                                Log In
                            </Link>
                        )}
                    </div>

                    {/* Mobile Hamburger Button */}
                    <button
                        className="md:hidden flex flex-col justify-center items-center w-10 h-10 gap-1.5 rounded-lg hover:bg-white/5 transition-colors"
                        onClick={() => setMenuOpen(!menuOpen)}
                        aria-label="Toggle menu"
                    >
                        <span className={`block w-6 h-0.5 bg-foreground/70 transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
                        <span className={`block w-6 h-0.5 bg-foreground/70 transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
                        <span className={`block w-6 h-0.5 bg-foreground/70 transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Mobile Dropdown Menu */}
            <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${menuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="glass border-t border-white/5 bg-[#0a0f0a]/95 backdrop-blur-2xl shadow-2xl shadow-black px-4 py-4 space-y-1">
                    {links.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setMenuOpen(false)}
                            className="block px-4 py-3 rounded-xl text-foreground/80 hover:bg-white/5 hover:text-primary transition-colors text-sm font-medium"
                        >
                            {link.label}
                        </Link>
                    ))}
                    <div className="pt-2">
                        {user ? (
                            <Link href="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors">
                                <div className="w-8 h-8 rounded-full eco-gradient flex items-center justify-center text-white text-xs font-bold shadow shadow-primary/20">
                                    {user.initial}
                                </div>
                                <span className="text-sm font-semibold text-foreground/80">{user.name}</span>
                            </Link>
                        ) : (
                            <Link href="/login" onClick={() => setMenuOpen(false)} className="block w-full py-3 eco-gradient text-white rounded-xl text-sm font-semibold shadow-lg shadow-primary/20 text-center">
                                Log In
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
