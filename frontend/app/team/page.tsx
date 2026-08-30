/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Users, Mail, ExternalLink, Globe, BookOpen, Sparkles, Building2, Award } from "lucide-react";

interface Researcher {
    name: string;
    role: string;
    avatar: string;
    badges: string[];
    bio: string;
    email: string;
    github: string;
}

const RESEARCHERS: Researcher[] = [
    {
        name: "Renzo Boyonas",
        role: "Lead Full-Stack Architect & AI Engineer",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
        badges: ["Next.js 16", "TensorFlow", "FastAPI", "GIS"],
        bio: "Specializing in geospatial ray-casting algorithms, Mask R-CNN garbage vision segmentation, and municipal civic platform architecture for San Jose del Monte.",
        email: "mailto:renzo@ecowatch.ph",
        github: "https://github.com/renzobyns/EcoWatch",
    },
    {
        name: "Capstone Research Division",
        role: "Data Science & Spatial Analytics Lead",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
        badges: ["DBSCAN", "Python 3.12", "PostGIS", "Leaflet"],
        bio: "Leading predictive hotspot modeling, geospatial polygon routing across 59 barangays, and SLA-driven dispatch workflow for CENRO cleanup operations.",
        email: "mailto:research@ecowatch.ph",
        github: "https://github.com/renzobyns/EcoWatch",
    },
];

export default function TeamPage() {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
            <Navbar />

            <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-24 sm:pt-32 pb-16">
                {/* Ambient Background Glows */}
                <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10" />

                {/* Hero Header */}
                <div className="space-y-4 max-w-3xl mb-12 sm:mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-wide uppercase">
                        <Users size={14} />
                        <span>RESEARCH DIVISION</span>
                    </div>

                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground">
                        Dedicated to Sustainable Innovation
                    </h1>

                    <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                        Our multi-disciplinary team of researchers and environmental specialists work at the intersection of data science, computer vision, and geospatial governance to power the EcoWatch CENRO platform.
                    </p>
                </div>

                {/* Section 1: Lead Researchers */}
                <div className="space-y-6 mb-14">
                    <div className="flex items-center gap-3 border-l-4 border-emerald-500 pl-3">
                        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                            Lead Researchers
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {RESEARCHERS.map((member, i) => (
                            <div
                                key={i}
                                className="group bg-card/80 backdrop-blur-xl border border-border/70 hover:border-primary/40 rounded-3xl p-6 sm:p-7 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                            >
                                <div className="space-y-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-emerald-500/40 p-0.5 shadow-md flex-shrink-0 bg-muted">
                                            <img
                                                src={member.avatar}
                                                alt={member.name}
                                                className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform duration-300"
                                            />
                                        </div>

                                        <div className="space-y-1 min-w-0">
                                            <h3 className="text-base sm:text-lg font-bold text-foreground truncate">
                                                {member.name}
                                            </h3>
                                            <p className="text-xs sm:text-sm font-medium text-primary truncate">
                                                {member.role}
                                            </p>
                                            <div className="flex flex-wrap gap-1.5 pt-1">
                                                {member.badges.map((badge, bIdx) => (
                                                    <span
                                                        key={bIdx}
                                                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                                    >
                                                        {badge}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                                        {member.bio}
                                    </p>
                                </div>

                                <div className="pt-5 mt-5 border-t border-border/40 grid grid-cols-2 gap-3">
                                    <a
                                        href={member.email}
                                        className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-muted/40 hover:bg-muted text-foreground text-xs font-semibold border border-border/50 transition-colors"
                                    >
                                        <Mail size={13} className="text-primary" />
                                        <span>CONTACT</span>
                                    </a>
                                    <a
                                        href={member.github}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-muted/40 hover:bg-muted text-foreground text-xs font-semibold border border-border/50 transition-colors"
                                    >
                                        <BookOpen size={13} className="text-primary" />
                                        <span>RESEARCH REPO</span>
                                        <ExternalLink size={11} className="opacity-70" />
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Section 2 & 3: Strategic Adviser & Institutional Partner Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-14">
                    {/* Strategic Adviser */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 border-l-4 border-emerald-500 pl-3">
                            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                                Strategic Adviser
                            </h2>
                        </div>

                        <div className="bg-card/80 backdrop-blur-xl border border-border/70 rounded-3xl p-6 sm:p-7 shadow-sm space-y-4 h-full flex flex-col justify-between">
                            <div className="space-y-4">
                                <div className="flex items-start gap-4">
                                    <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-emerald-500/40 p-0.5 shadow-md flex-shrink-0 bg-muted">
                                        <img
                                            src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80"
                                            alt="Strategic Adviser"
                                            className="w-full h-full object-cover rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-base sm:text-lg font-bold text-foreground">
                                                Capstone Faculty Adviser
                                            </h3>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                                ADVISER
                                            </span>
                                        </div>
                                        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                                            Senior Technical & Research Adviser
                                        </p>
                                    </div>
                                </div>

                                <blockquote className="text-xs sm:text-sm text-foreground/80 italic border-l-2 border-primary/40 pl-3 leading-relaxed">
                                    &ldquo;Bridging the gap between computer vision research and local government solid waste governance in the City of San Jose del Monte.&rdquo;
                                </blockquote>
                            </div>

                            <div className="pt-4 border-t border-border/40 flex items-center justify-between">
                                <div className="flex items-center gap-3 text-muted-foreground">
                                    <Globe size={16} className="text-primary" />
                                    <span className="text-xs font-medium">Academic Research Council</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-primary font-semibold">
                                    <Award size={14} />
                                    <span>Faculty Board</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Academic & Government Institution */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 border-l-4 border-emerald-500 pl-3">
                            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                                Research Institution & Partner
                            </h2>
                        </div>

                        <div className="bg-card/80 backdrop-blur-xl border border-border/70 rounded-3xl p-6 sm:p-7 shadow-sm space-y-4 h-full flex flex-col justify-between">
                            <div className="space-y-4">
                                <div className="flex items-start gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-primary shadow-inner flex-shrink-0">
                                        <Building2 size={32} />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-base sm:text-lg font-bold text-foreground">
                                            City Government of San Jose del Monte
                                        </h3>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <span>📍 San Jose del Monte, Bulacan, Philippines</span>
                                        </p>
                                    </div>
                                </div>

                                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                                    In primary partnership with the City Environment and Natural Resources Office (CENRO) and academic divisions, providing rigorous testing data, SLA frameworks, and 59 barangay boundary polygons for deployment.
                                </p>
                            </div>

                            <div className="pt-4 border-t border-border/40">
                                <Link
                                    href="/about"
                                    className="w-full py-2.5 px-4 rounded-xl border border-primary/30 hover:border-primary text-primary hover:bg-primary/5 text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
                                >
                                    <Sparkles size={14} />
                                    <span>Explore System Architecture</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Microline */}
                <div className="text-center pt-8 border-t border-border/30">
                    <p className="text-[11px] font-mono tracking-widest text-muted-foreground uppercase">
                        ECOWATCH SJDM — RESEARCH DIVISION • 2026
                    </p>
                </div>
            </main>

            <Footer />
        </div>
    );
}
