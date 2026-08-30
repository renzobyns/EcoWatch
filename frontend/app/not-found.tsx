import Link from "next/link";
import { Home, Search, RefreshCw, X, ArrowRight, MapPin } from "lucide-react";

export default function NotFound() {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-10 right-10 w-72 h-72 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

            {/* Container Card */}
            <div className="w-full max-w-md bg-card/80 backdrop-blur-xl border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col relative z-10 transition-all duration-300">
                {/* Header Bar */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-muted/20">
                    <span className="text-sm font-semibold text-foreground tracking-tight">Page Not Found</span>
                    <Link
                        href="/"
                        className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        aria-label="Close and return home"
                    >
                        <X size={18} />
                    </Link>
                </div>

                {/* Main Content Area */}
                <div className="p-6 sm:p-8 flex flex-col items-center text-center space-y-6">
                    {/* Eco Globe & Sun Illustration */}
                    <div className="relative w-44 h-44 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center overflow-hidden shadow-inner p-4">
                        <svg viewBox="0 0 200 200" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                            {/* Sun */}
                            <circle cx="100" cy="45" r="24" fill="#F59E0B" fillOpacity="0.2" stroke="#F59E0B" strokeWidth="3" strokeDasharray="4 3" />
                            <circle cx="100" cy="45" r="16" fill="#F59E0B" />
                            {/* Sun Rays */}
                            <path d="M100 15V22M100 68V75M70 45H77M123 45H130M79 24L84 29M116 61L121 66M79 66L84 61M116 29L121 24" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
                            
                            {/* Globe */}
                            <circle cx="100" cy="120" r="54" fill="#6EE7B7" fillOpacity="0.3" stroke="#10B981" strokeWidth="3" />
                            {/* Continents */}
                            <path d="M75 105C72 115 80 125 90 120C100 115 110 135 125 130C135 125 145 110 135 95C125 85 105 85 95 95C85 105 78 95 75 105Z" fill="#10B981" fillOpacity="0.7" />
                            <path d="M85 140C92 145 105 142 110 148C115 152 105 160 95 158C88 155 80 148 85 140Z" fill="#10B981" fillOpacity="0.6" />
                            {/* Atmosphere Glow Ring */}
                            <circle cx="100" cy="120" r="58" stroke="#34D399" strokeWidth="1.5" strokeOpacity="0.4" />
                        </svg>
                    </div>

                    {/* 404 Badge & Headings */}
                    <div className="space-y-2">
                        <div className="inline-block text-4xl sm:text-5xl font-black text-primary tracking-tight font-mono">
                            404
                        </div>
                        <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                            Lost in the Green?
                        </h1>
                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                            We couldn&apos;t find the page you&apos;re looking for. It might have been moved or doesn&apos;t exist anymore.
                        </p>
                    </div>

                    {/* Quick Link Cards */}
                    <div className="w-full space-y-2.5 text-left">
                        <Link
                            href="/"
                            className="group flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 hover:bg-muted/80 border border-border/50 hover:border-primary/40 transition-all duration-200"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                                    <Home size={18} />
                                </div>
                                <div>
                                    <span className="text-xs font-semibold text-foreground block group-hover:text-primary transition-colors">
                                        Return to Dashboard
                                    </span>
                                    <span className="text-[11px] text-muted-foreground block">
                                        Go back to your main portal & settings
                                    </span>
                                </div>
                            </div>
                            <ArrowRight size={15} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </Link>

                        <Link
                            href="/report"
                            className="group flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 hover:bg-muted/80 border border-border/50 hover:border-primary/40 transition-all duration-200"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                                    <MapPin size={18} />
                                </div>
                                <div>
                                    <span className="text-xs font-semibold text-foreground block group-hover:text-primary transition-colors">
                                        Report & Incident Map
                                    </span>
                                    <span className="text-[11px] text-muted-foreground block">
                                        Submit a report or view active hotspots
                                    </span>
                                </div>
                            </div>
                            <ArrowRight size={15} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </Link>

                        <Link
                            href="/track/EW-DEMO"
                            className="group flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 hover:bg-muted/80 border border-border/50 hover:border-primary/40 transition-all duration-200"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                                    <Search size={18} />
                                </div>
                                <div>
                                    <span className="text-xs font-semibold text-foreground block group-hover:text-primary transition-colors">
                                        Track an Incident
                                    </span>
                                    <span className="text-[11px] text-muted-foreground block">
                                        Check resolution progress with Tracking ID
                                    </span>
                                </div>
                            </div>
                            <ArrowRight size={15} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </Link>
                    </div>

                    {/* Primary Button */}
                    <Link
                        href="/"
                        className="w-full py-3.5 px-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-200 text-center block"
                    >
                        Back to Home
                    </Link>

                    {/* Status & Footer Microtext */}
                    <div className="space-y-2 pt-2 border-t border-border/30 w-full">
                        <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <RefreshCw size={12} className="animate-spin text-emerald-500" style={{ animationDuration: '4s' }} />
                            <span>SYSTEM CHECK PASSED</span>
                        </div>
                        <p className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground/70">
                            ECOWATCH PLATFORM • ERROR CODE 0X404
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
