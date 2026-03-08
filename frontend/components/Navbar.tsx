"use client";

import Link from 'next/link';
import Image from 'next/image';

export default function Navbar() {
    return (
        <nav className="fixed top-0 w-full z-50 glass border-b border-primary/20 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">
                    <div className="flex items-center">
                        <Link href="/" className="flex items-center gap-2 group">
                            <div className="w-10 h-10 rounded-lg overflow-hidden shadow-lg shadow-primary/20 bg-white flex items-center justify-center p-0.5 group-hover:scale-110 transition-transform duration-300">
                                <img
                                    src="/logo.png"
                                    alt="EcoWatch"
                                    className="w-full h-full object-contain"
                                />
                            </div>
                            <span className="text-2xl font-bold tracking-tight text-gradient">
                                EcoWatch <span className="text-foreground/50 text-sm font-medium">SJDM</span>
                            </span>
                        </Link>
                    </div>

                    <div className="hidden md:flex items-center space-x-8">
                        <Link href="/" className="text-foreground/70 hover:text-primary transition-colors text-sm font-medium underline-offset-4 hover:underline">Home</Link>
                        <Link href="/report" className="text-foreground/70 hover:text-primary transition-colors text-sm font-medium underline-offset-4 hover:underline">Report Issue</Link>

                        {/* Internal Portals */}
                        <div className="h-4 w-px bg-white/10 mx-2" />

                        <Link href="/barangay" className="text-foreground/70 hover:text-primary transition-colors text-sm font-medium">Barangay Portal</Link>
                        <Link href="/dashboard" className="text-foreground/70 hover:text-primary transition-colors text-sm font-medium">CENRO Dashboard</Link>

                        <button className="px-4 py-2 eco-gradient text-white rounded-full text-sm font-semibold hover:opacity-90 transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-primary/20">
                            Log In
                        </button>
                    </div>

                    {/* Mobile menu button could go here */}
                </div>
            </div>
        </nav>
    );
}
