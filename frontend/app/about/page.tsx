import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Sparkles, Shield, ArrowRight, Flag, Building2 } from "lucide-react";

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
            <Navbar />

            <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-24 sm:pt-32 pb-16">
                {/* Ambient Glows */}
                <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10" />

                {/* Hero Banner */}
                <div className="space-y-4 max-w-3xl mb-14 sm:mb-18">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-wide uppercase">
                        <Sparkles size={14} />
                        <span>ECOWATCH SJDM • RESEARCH & ARCHITECTURE</span>
                    </div>

                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground leading-[1.15]">
                        Intelligent Geospatial AI for San Jose del Monte
                    </h1>

                    <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                        EcoWatch is an automated civic monitoring platform designed specifically for the City of San Jose del Monte, Bulacan. By fusing computer vision segmentation with ray-casting spatial routing, EcoWatch bridges the gap between citizens, barangay cleanup units, and CENRO administrators.
                    </p>
                </div>

                {/* Mission & Vision Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
                    <div className="bg-card/80 backdrop-blur-xl border border-border/70 rounded-3xl p-6 sm:p-8 space-y-3 shadow-sm hover:border-primary/40 transition-colors">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shadow-inner">
                            <Shield size={24} />
                        </div>
                        <h2 className="text-lg sm:text-xl font-bold text-foreground">Our Mission</h2>
                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                            To eliminate illegal waste dumping in San Jose del Monte by empowering every citizen with instant AI verification tools, ensuring full transparency and rapid cleanup dispatch under Republic Act 9003.
                        </p>
                    </div>

                    <div className="bg-card/80 backdrop-blur-xl border border-border/70 rounded-3xl p-6 sm:p-8 space-y-3 shadow-sm hover:border-primary/40 transition-colors">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center shadow-inner">
                            <Building2 size={24} />
                        </div>
                        <h2 className="text-lg sm:text-xl font-bold text-foreground">Our Vision</h2>
                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                            A clean, resilient, and data-driven smart city where municipal waste management is fully automated, responsive, and accountable across all 59 jurisdictional barangays.
                        </p>
                    </div>
                </div>

                {/* Section: 4-Step AI Technology Pipeline */}
                <div className="space-y-8 mb-16">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3 border-l-4 border-emerald-500 pl-3">
                            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                                How EcoWatch Works — The AI Pipeline
                            </h2>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                            Every citizen report traverses an automated four-stage pipeline from camera capture to field resolution.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {/* Step 1 */}
                        <div className="bg-card/80 backdrop-blur-xl border border-border/70 rounded-3xl p-6 space-y-3 relative group hover:border-primary/40 transition-all">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary font-mono font-bold text-sm flex items-center justify-center border border-primary/20">
                                01
                            </div>
                            <h3 className="text-sm sm:text-base font-bold text-foreground">Geotagged Capture</h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Citizens take a live photo. EcoWatch extracts high-precision GPS coordinates with tamper detection and cross-verifies device accuracy.
                            </p>
                        </div>

                        {/* Step 2 */}
                        <div className="bg-card/80 backdrop-blur-xl border border-border/70 rounded-3xl p-6 space-y-3 relative group hover:border-primary/40 transition-all">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 font-mono font-bold text-sm flex items-center justify-center border border-emerald-500/20">
                                02
                            </div>
                            <h3 className="text-sm sm:text-base font-bold text-foreground">Mask R-CNN Vision</h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Custom Mask R-CNN neural network segments waste boundaries, generates bounding boxes, and calculates an objective confidence score.
                            </p>
                        </div>

                        {/* Step 3 */}
                        <div className="bg-card/80 backdrop-blur-xl border border-border/70 rounded-3xl p-6 space-y-3 relative group hover:border-primary/40 transition-all">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 font-mono font-bold text-sm flex items-center justify-center border border-blue-500/20">
                                03
                            </div>
                            <h3 className="text-sm sm:text-base font-bold text-foreground">Ray-Casting Routing</h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Shapely geometric point-in-polygon algorithm instantly maps the exact coordinates against 59 SJDM GeoJSON boundaries for zero-delay routing.
                            </p>
                        </div>

                        {/* Step 4 */}
                        <div className="bg-card/80 backdrop-blur-xl border border-border/70 rounded-3xl p-6 space-y-3 relative group hover:border-primary/40 transition-all">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 font-mono font-bold text-sm flex items-center justify-center border border-amber-500/20">
                                04
                            </div>
                            <h3 className="text-sm sm:text-base font-bold text-foreground">DBSCAN Clustering</h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Density-based spatial clustering aggregates recurring dumpsites into chronic hotspot heatmaps with automated SLA escalation for CENRO.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Section: Platform Metrics Banner */}
                <div className="bg-card/80 backdrop-blur-xl border border-border/80 rounded-3xl p-6 sm:p-10 shadow-lg mb-16">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
                        <div className="space-y-1">
                            <div className="text-2xl sm:text-4xl font-black text-primary font-mono">59</div>
                            <p className="text-xs font-semibold text-foreground">Barangays Covered</p>
                            <p className="text-[11px] text-muted-foreground">100% City-wide SJDM scope</p>
                        </div>
                        <div className="space-y-1">
                            <div className="text-2xl sm:text-4xl font-black text-emerald-500 font-mono">&lt;2.5s</div>
                            <p className="text-xs font-semibold text-foreground">AI Inference Speed</p>
                            <p className="text-[11px] text-muted-foreground">Real-time Mask R-CNN</p>
                        </div>
                        <div className="space-y-1">
                            <div className="text-2xl sm:text-4xl font-black text-blue-500 font-mono">100%</div>
                            <p className="text-xs font-semibold text-foreground">Automated Routing</p>
                            <p className="text-[11px] text-muted-foreground">Ray-casting boundary assignment</p>
                        </div>
                        <div className="space-y-1">
                            <div className="text-2xl sm:text-4xl font-black text-amber-500 font-mono">RA 9003</div>
                            <p className="text-xs font-semibold text-foreground">Compliance Framework</p>
                            <p className="text-[11px] text-muted-foreground">Solid Waste Management Act</p>
                        </div>
                    </div>
                </div>

                {/* Call to Action Card */}
                <div className="rounded-3xl bg-gradient-to-r from-emerald-500/10 via-primary/10 to-blue-500/10 border border-primary/30 p-8 sm:p-10 text-center space-y-5">
                    <h2 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">
                        Ready to Help Clean Up San Jose del Monte?
                    </h2>
                    <p className="text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
                        Join your fellow citizens in reporting illegal dumpsites. Every verified report directly mobilizes local barangay cleanup teams.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                        <Link
                            href="/report"
                            className="w-full sm:w-auto py-3 px-6 rounded-2xl bg-primary text-primary-foreground font-semibold text-xs sm:text-sm hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                        >
                            <Flag size={16} />
                            <span>Report an Illegal Dump</span>
                        </Link>
                        <Link
                            href="/team"
                            className="w-full sm:w-auto py-3 px-6 rounded-2xl bg-card/80 hover:bg-muted text-foreground font-semibold text-xs sm:text-sm border border-border/60 transition-all flex items-center justify-center gap-2"
                        >
                            <span>Meet the Research Team</span>
                            <ArrowRight size={16} />
                        </Link>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
