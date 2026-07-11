"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Flag } from 'lucide-react';

const PORTAL_PREFIXES = ['/barangay', '/cenro', '/cleaner', '/profile'];

export default function Navbar() {
    const pathname = usePathname();
    const [profileOpen, setProfileOpen] = useState(false);
    const [user, setUser] = useState<{ name: string; initial: string; role: string } | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

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

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setProfileOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [dropdownRef]);

    if (pathname && PORTAL_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
        return null;
    }

    return (
        <nav className="fixed top-2 sm:top-4 inset-x-2 sm:inset-x-4 max-w-7xl mx-auto z-50 flex items-start justify-between gap-3 sm:gap-4 pointer-events-none">
            {/* Left Pill (Main Nav) */}
            <div className={`glass bg-background/70 backdrop-blur-xl border border-border/50 shadow-2xl rounded-2xl px-4 sm:px-6 lg:px-8 pointer-events-auto transition-all duration-300 ${user ? 'flex-1' : 'w-full'}`}>
                <div className="flex justify-between h-14 items-center gap-4">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
                        <div className="w-8 h-8 rounded-md overflow-hidden shadow-md shadow-primary/20 bg-white flex items-center justify-center p-0.5 group-hover:scale-110 transition-transform duration-300">
                            <img src="/logo.png" alt="EcoWatch" className="w-full h-full object-contain" />
                        </div>
                        <span className="text-lg font-semibold tracking-tight text-gradient">
                            EcoWatch <span className="text-foreground/50 text-xs font-medium hidden sm:inline">SJDM</span>
                        </span>
                    </Link>

                    {/* Navigation Items */}
                    <div className="flex items-center gap-2 sm:gap-6 ml-auto">
                        <Button asChild size="sm" variant="ghost" className="gap-2 h-9 rounded-xl shadow-none bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 border border-red-500/20 transition-colors">
                            <Link href="/report">
                                <Flag className="w-4 h-4" />
                                <span className="font-semibold hidden sm:inline-block">Report Issue</span>
                                <span className="font-semibold sm:hidden">Report</span>
                            </Link>
                        </Button>

                        <div className="hidden sm:block">
                            <ThemeToggle />
                        </div>

                        {!user && (
                            <Button asChild variant="outline" size="sm" className="h-9 rounded-xl shadow-sm">
                                <Link href="/login">Log In</Link>
                            </Button>
                        )}
                        
                        {/* Theme Toggle for mobile placed after Report Issue if not logged in, or handled by the left pill layout */}
                        <div className="sm:hidden block">
                             <ThemeToggle />
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Pill (User Profile) */}
            {user && (
                <div className="relative pointer-events-auto" ref={dropdownRef}>
                    <button 
                        onClick={() => setProfileOpen(!profileOpen)}
                        className="glass bg-background/70 backdrop-blur-xl border border-border/50 shadow-2xl rounded-2xl h-14 px-3 sm:px-4 flex items-center justify-center gap-2 hover:bg-background/90 transition-colors cursor-pointer"
                    >
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold text-sm shadow-inner">
                            {user.initial}
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 text-foreground/50 ${profileOpen ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
                    </button>

                    {/* Profile Dropdown */}
                    <div className={`absolute right-0 top-16 w-64 glass bg-background/95 backdrop-blur-2xl border border-border/50 shadow-2xl rounded-2xl overflow-hidden transition-all duration-300 origin-top-right ${profileOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'}`}>
                        <div className="p-4 border-b border-border/50">
                            <div className="font-semibold text-sm text-foreground truncate">{user.name}</div>
                            <div className="text-[10px] font-medium text-foreground/50 uppercase tracking-widest mt-0.5 truncate">{user.role}</div>
                        </div>
                        <div className="p-2 space-y-1">
                            {user.role === 'barangay' && (
                                <Link href="/barangay" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-foreground/5 transition-colors cursor-pointer text-emerald-500 font-medium text-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2-2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                                    Barangay Portal
                                </Link>
                            )}
                            {user.role === 'cenro' && (
                                <Link href="/cenro" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-foreground/5 transition-colors cursor-pointer text-emerald-500 font-medium text-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="21"></line></svg>
                                    CENRO Dashboard
                                </Link>
                            )}
                            {user.role === 'cleaner' && (
                                <Link href="/cleaner" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-foreground/5 transition-colors cursor-pointer text-emerald-500 font-medium text-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                                    My Jobs
                                </Link>
                            )}

                            {user.role !== 'citizen' && (
                                <div className="h-px bg-border/50 my-2 mx-2"></div>
                            )}

                            <button
                                onClick={() => {
                                    localStorage.removeItem('ecowatch_user');
                                    window.location.href = '/';
                                }}
                                className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-500/10 text-red-400 transition-colors cursor-pointer"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                                <div className="text-sm font-medium">Sign Out</div>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
}
