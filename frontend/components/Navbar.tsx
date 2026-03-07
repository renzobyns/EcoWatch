"use client";

import Link from 'next/link';

export default function Navbar() {
    return (
        <nav className="fixed top-0 w-full z-50 glass border-b border-primary/20 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">
                    <div className="flex items-center">
                        <Link href="/" className="flex items-center gap-2 group">
                            <div className="w-8 h-8 eco-gradient rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                                <span className="text-white font-bold text-xl">E</span>
                            </div>
                            <span className="text-2xl font-bold tracking-tight text-gradient">
                                EcoWatch <span className="text-foreground/50 text-sm font-medium">SJDM</span>
                            </span>
                        </Link>
                    </div>

                    <div className="hidden md:flex items-center space-x-8">
                        <Link href="/dashboard" className="text-foreground/70 hover:text-primary transition-colors text-sm font-medium">Dashboard</Link>
                        <Link href="/report" className="text-foreground/70 hover:text-primary transition-colors text-sm font-medium">Report Issue</Link>
                        <button className="px-4 py-2 eco-gradient text-white rounded-full text-sm font-semibold hover:opacity-90 transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-primary/20">
                            Login
                        </button>
                    </div>

                    {/* Mobile menu button could go here */}
                </div>
            </div>
        </nav>
    );
}
