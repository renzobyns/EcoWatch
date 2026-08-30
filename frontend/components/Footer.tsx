"use client";

import Link from "next/link";
import { Shield, FileText, Sparkles, Building2, Mail } from "lucide-react";

export default function Footer() {
    const currentYear = 2026;

    return (
        <footer className="w-full border-t border-border/40 bg-background/60 backdrop-blur-xl mt-16 transition-colors">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
                    {/* Brand & Purpose */}
                    <div className="md:col-span-2 space-y-4">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl eco-gradient flex items-center justify-center text-white shadow-md shadow-primary/20">
                                <Sparkles size={16} />
                            </div>
                            <span className="text-lg font-bold tracking-tight text-foreground">
                                EcoWatch <span className="text-primary">SJDM</span>
                            </span>
                        </div>
                        <p className="text-xs text-foreground/60 leading-relaxed max-w-sm">
                            San Jose del Monte&apos;s AI-powered civic monitoring platform for illegal waste dumping. 
                            Empowering citizens and local government for a cleaner, greener Bulacan.
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-foreground/50">
                            <Building2 size={13} className="text-primary" />
                            <span>City Environment and Natural Resources Office (CENRO)</span>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/80">Navigation</h4>
                        <ul className="space-y-2 text-xs text-foreground/60">
                            <li>
                                <Link href="/" className="hover:text-primary transition-colors">Home & Map</Link>
                            </li>
                            <li>
                                <Link href="/report" className="hover:text-primary transition-colors">Report Violation</Link>
                            </li>
                            <li>
                                <Link href="/login" className="hover:text-primary transition-colors">Portal Login</Link>
                            </li>
                        </ul>
                    </div>

                    {/* Legal & Governance */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/80">Legal & Privacy</h4>
                        <ul className="space-y-2 text-xs text-foreground/60">
                            <li>
                                <Link href="/privacy" className="hover:text-primary transition-colors flex items-center gap-1.5">
                                    <Shield size={12} className="text-primary/70" />
                                    Privacy Policy (RA 10173)
                                </Link>
                            </li>
                            <li>
                                <Link href="/terms" className="hover:text-primary transition-colors flex items-center gap-1.5">
                                    <FileText size={12} className="text-primary/70" />
                                    Terms of Service
                                </Link>
                            </li>
                            <li className="pt-1 text-[11px] text-foreground/40 flex items-center gap-1.5">
                                <Mail size={12} />
                                ecowatch.sjdm@gmail.com
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                    <p className="text-[11px] text-foreground/40">
                        © {currentYear} EcoWatch SJDM. City of San Jose del Monte, Bulacan. All rights reserved.
                    </p>
                    <div className="flex items-center gap-4 text-[11px] text-foreground/40">
                        <span className="inline-flex items-center gap-1 text-primary/80 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            RA 10173 Compliant
                        </span>
                        <span>•</span>
                        <Link href="/privacy" className="hover:text-foreground/70 transition-colors">Privacy</Link>
                        <span>•</span>
                        <Link href="/terms" className="hover:text-foreground/70 transition-colors">Terms</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
