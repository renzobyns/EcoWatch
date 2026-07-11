"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';

const PORTAL_PREFIXES = ['/barangay', '/cenro', '/cleaner', '/profile'];

export default function Navbar() {
    const pathname = usePathname();
    const [menuOpen, setMenuOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [user, setUser] = useState<{ name: string; initial: string; role: string } | null>(null);

    useEffect(() => {
        // Local-first auth: check localStorage
        const storedUser = localStorage.getItem('ecowatch_user');
        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser);
                setUser({
                    name: parsed.full_name,
                    initial: parsed.full_name.charAt(0).toUpperCase(),
                    role: parsed.role
                });
            } catch(e) {}
        }
    }, []);

    const publicLinks = [
        { href: "/report", label: "Report Issue" },
    ];

    if (pathname && PORTAL_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
        return null;
    }

    return (
        <nav className="fixed top-2 sm:top-4 inset-x-2 sm:inset-x-4 max-w-7xl mx-auto z-50 flex items-start justify-between gap-3 sm:gap-4 pointer-events-none">
            {/* Left Pill (Main Nav) */}
            <div className={`glass bg-background/70 backdrop-blur-xl border border-border/50 shadow-2xl rounded-2xl px-4 sm:px-6 lg:px-8 pointer-events-auto transition-all duration-300 ${user ? 'flex-1' : 'w-full'}`}>
                <div className="flex justify-between h-14 items-center">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 rounded-md overflow-hidden shadow-md shadow-primary/20 bg-white flex items-center justify-center p-0.5 group-hover:scale-110 transition-transform duration-300">
                            <img src="/logo.png" alt="EcoWatch" className="w-full h-full object-contain" />
                        </div>
                        <span className="text-lg font-semibold tracking-tight text-gradient">
                            EcoWatch <span className="text-foreground/50 text-xs font-medium">SJDM</span>
                        </span>
                    </Link>

                    {/* Desktop Nav */}
                    <div className="hidden md:flex items-center space-x-6">
                        {publicLinks.map((link) => (
                            <Link key={link.href} href={link.href} className="text-foreground/70 hover:text-primary transition-colors text-sm font-medium">
                                {link.label}
                            </Link>
                        ))}

                        {user && user.role === 'barangay' && (
                            <Link href="/barangay" className="text-emerald-500 hover:text-emerald-400 transition-colors text-sm font-medium">Barangay Portal</Link>
                        )}
                        {user && user.role === 'cenro' && (
                            <Link href="/cenro" className="text-emerald-500 hover:text-emerald-400 transition-colors text-sm font-medium">CENRO Dashboard</Link>
                        )}
                        {user && user.role === 'cleaner' && (
                            <Link href="/cleaner" className="text-emerald-500 hover:text-emerald-400 transition-colors text-sm font-medium">My Jobs</Link>
                        )}

                        <ThemeToggle />

                        {!user && (
                            <Button asChild variant="outline" size="sm">
                                <Link href="/login">Log In</Link>
                            </Button>
                        )}
                    </div>

                    {/* Mobile Hamburger Button */}
                    <div className="md:hidden flex items-center gap-1">
                        <ThemeToggle />
                        <button
                            className="flex flex-col justify-center items-center w-10 h-10 gap-1.5 rounded-lg hover:bg-foreground/5 transition-colors cursor-pointer"
                            onClick={() => setMenuOpen(!menuOpen)}
                            aria-label="Toggle menu"
                        >
                            <span className={`block w-6 h-0.5 bg-foreground/70 transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
                            <span className={`block w-6 h-0.5 bg-foreground/70 transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
                            <span className={`block w-6 h-0.5 bg-foreground/70 transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Mobile Dropdown Menu (Left Pill) */}
                <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${menuOpen ? 'max-h-96 opacity-100 mb-4' : 'max-h-0 opacity-0'}`}>
                    <div className="border-t border-border pt-2 pb-2 space-y-1">
                        {publicLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setMenuOpen(false)}
                                className="block px-4 py-2.5 rounded-lg text-foreground/80 hover:bg-foreground/5 hover:text-primary transition-colors text-sm font-medium"
                            >
                                {link.label}
                            </Link>
                        ))}
                        {user && user.role === 'barangay' && (
                            <Link href="/barangay" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 rounded-lg text-emerald-500 hover:bg-foreground/5 transition-colors text-sm font-medium">
                                Barangay Portal
                            </Link>
                        )}
                        {user && user.role === 'cenro' && (
                            <Link href="/cenro" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 rounded-lg text-emerald-500 hover:bg-foreground/5 transition-colors text-sm font-medium">
                                CENRO Dashboard
                            </Link>
                        )}
                        {user && user.role === 'cleaner' && (
                            <Link href="/cleaner" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 rounded-lg text-emerald-500 hover:bg-foreground/5 transition-colors text-sm font-medium">
                                My Jobs
                            </Link>
                        )}
                        {!user && (
                            <div className="pt-2 border-t border-border mt-2">
                                <Button asChild className="w-full">
                                    <Link href="/login" onClick={() => setMenuOpen(false)}>Log In</Link>
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Pill (User Profile) */}
            {user && (
                <div className="relative pointer-events-auto">
                    <button 
                        onClick={() => setProfileOpen(!profileOpen)}
                        className="glass bg-background/70 backdrop-blur-xl border border-border/50 shadow-2xl rounded-2xl h-14 px-3 sm:px-4 flex items-center justify-center gap-2 hover:bg-background/90 transition-colors cursor-pointer"
                    >
                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shadow-inner">
                            {user.initial}
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 text-foreground/50 ${profileOpen ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
                    </button>

                    {/* Profile Dropdown */}
                    <div className={`absolute right-0 top-16 w-56 glass bg-background/95 backdrop-blur-2xl border border-border/50 shadow-2xl rounded-2xl overflow-hidden transition-all duration-300 origin-top-right ${profileOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'}`}>
                        <div className="p-4 border-b border-border/50">
                            <div className="font-semibold text-sm text-foreground truncate">{user.name}</div>
                            <div className="text-[10px] font-medium text-foreground/50 uppercase tracking-widest mt-0.5 truncate">{user.role}</div>
                        </div>
                        <div className="p-2">
                            <button
                                onClick={() => {
                                    localStorage.removeItem('ecowatch_user');
                                    window.location.href = '/';
                                }}
                                className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-500/10 text-red-400 transition-colors cursor-pointer"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                                <div className="text-sm font-medium">Sign Out</div>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
}
