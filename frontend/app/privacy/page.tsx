"use client";

import { useState } from "react";
import Link from "next/link";
import { 
    Shield, 
    ShieldCheck, 
    Lock, 
    Eye, 
    FileText, 
    Server, 
    MapPin, 
    Cpu, 
    Mail, 
    Building2, 
    Clock, 
    ArrowLeft, 
    CheckCircle2, 
    HelpCircle,
    UserCheck,
    AlertCircle
} from "lucide-react";
import Footer from "@/components/Footer";

// Centralized Contact & DPO Details (Easily Editable)
const LEGAL_CONFIG = {
    dpoName: "Data Protection Officer",
    officeName: "City Environment and Natural Resources Office (CENRO)",
    officeAddress: "City Hall Complex, Barangay Dulong Bayan, City of San Jose del Monte, Bulacan, 3023",
    email: "ecowatch.sjdm@gmail.com",
    backupEmail: "cenro.sjdm@gmail.com",
    officeHours: "Monday – Friday, 8:00 AM – 5:00 PM PST",
    lastUpdated: "August 30, 2026",
    effectiveDate: "August 16, 2026",
    version: "1.0.0"
};

const SECTIONS = [
    { id: "overview", title: "1. Overview & Statutory Authority" },
    { id: "data-collected", title: "2. Information We Collect" },
    { id: "ai-processing", title: "3. AI & Computer Vision Processing" },
    { id: "purpose-sharing", title: "4. Purpose & Data Sharing" },
    { id: "security-storage", title: "5. Data Security & Retention" },
    { id: "citizen-rights", title: "6. Your Rights Under RA 10173" },
    { id: "dpo-contact", title: "7. Contact & Data Protection Officer" },
];

export default function PrivacyPolicyPage() {
    const [activeSection, setActiveSection] = useState("overview");

    const scrollToSection = (id: string) => {
        setActiveSection(id);
        const element = document.getElementById(id);
        if (element) {
            const yOffset = -100;
            const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: "smooth" });
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
            {/* Header / Hero */}
            <div className="relative overflow-hidden border-b border-border/50 bg-card/30 backdrop-blur-md">
                <div className="absolute inset-0 bg-radial-gradient from-primary/10 via-transparent to-transparent opacity-50" />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 relative z-10">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <Link 
                            href="/"
                            className="inline-flex items-center gap-2 text-xs font-semibold text-foreground/60 hover:text-primary transition-colors group"
                        >
                            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                            Back to Home
                        </Link>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20 self-start sm:self-auto">
                            <ShieldCheck size={13} />
                            Republic Act No. 10173 Compliant
                        </div>
                    </div>

                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
                        Privacy <span className="text-gradient">Policy</span>
                    </h1>
                    <p className="mt-3 text-sm sm:text-base text-foreground/70 max-w-3xl leading-relaxed">
                        EcoWatch SJDM is committed to protecting your personal information and upholding the privacy rights of all citizens under the Philippine Data Privacy Act of 2012.
                    </p>

                    <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-foreground/50 border-t border-border/40 pt-4">
                        <span><strong>Effective Date:</strong> {LEGAL_CONFIG.effectiveDate}</span>
                        <span>•</span>
                        <span><strong>Last Revised:</strong> {LEGAL_CONFIG.lastUpdated}</span>
                        <span>•</span>
                        <span><strong>Jurisdiction:</strong> San Jose del Monte, Bulacan, Philippines</span>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* Left Sticky Table of Contents (Desktop) */}
                    <div className="hidden lg:block lg:col-span-4 xl:col-span-3">
                        <div className="sticky top-28 space-y-4">
                            <div className="glass p-5 rounded-2xl border border-border/50 space-y-3">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/80 flex items-center gap-2">
                                    <FileText size={14} className="text-primary" />
                                    Table of Contents
                                </h3>
                                <nav className="space-y-1">
                                    {SECTIONS.map((sec) => (
                                        <button
                                            key={sec.id}
                                            onClick={() => scrollToSection(sec.id)}
                                            className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-center justify-between ${
                                                activeSection === sec.id 
                                                    ? "bg-primary/15 text-primary font-semibold shadow-sm" 
                                                    : "text-foreground/60 hover:bg-card hover:text-foreground"
                                            }`}
                                        >
                                            <span className="truncate">{sec.title}</span>
                                        </button>
                                    ))}
                                </nav>
                            </div>

                            {/* Quick Help Card */}
                            <div className="glass p-4 rounded-2xl border border-border/50 text-xs space-y-2">
                                <div className="font-semibold flex items-center gap-1.5 text-foreground/90">
                                    <HelpCircle size={14} className="text-primary" />
                                    Need Privacy Assistance?
                                </div>
                                <p className="text-foreground/60 leading-relaxed">
                                    You have the right to request data access, correction, or deletion anytime.
                                </p>
                                <button
                                    onClick={() => scrollToSection("dpo-contact")}
                                    className="w-full py-1.5 px-3 rounded-lg eco-gradient text-white font-medium text-[11px] hover:opacity-90 transition-opacity"
                                >
                                    Contact DPO
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Prose Content */}
                    <div className="lg:col-span-8 xl:col-span-9 space-y-10">
                        
                        {/* Section 1: Overview */}
                        <section id="overview" className="glass p-6 sm:p-8 rounded-3xl border border-border/50 space-y-4 scroll-mt-28">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                    <Shield size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg sm:text-xl font-bold text-foreground">1. Overview & Statutory Authority</h2>
                                    <p className="text-xs text-foreground/50">Mandate under Republic Act No. 10173</p>
                                </div>
                            </div>
                            <div className="text-xs sm:text-sm text-foreground/80 leading-relaxed space-y-3 pt-2">
                                <p>
                                    EcoWatch SJDM is a municipal civic technology and environmental monitoring system created for the City of San Jose del Monte, Bulacan. This platform operates in alignment with the <strong>Philippine Data Privacy Act of 2012 (Republic Act No. 10173)</strong>, its Implementing Rules and Regulations (IRR), and administrative issuances by the National Privacy Commission (NPC).
                                </p>
                                <p>
                                    Our primary mission is to facilitate citizen-driven reporting of illegal solid waste dumping, enhance municipal collection logistics, and assist the <strong>City Environment and Natural Resources Office (CENRO)</strong> and the 59 SJDM Barangay Local Government Units in maintaining environmental compliance.
                                </p>
                            </div>
                        </section>

                        {/* Section 2: Data Collected */}
                        <section id="data-collected" className="glass p-6 sm:p-8 rounded-3xl border border-border/50 space-y-4 scroll-mt-28">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                    <Eye size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg sm:text-xl font-bold text-foreground">2. Information We Collect</h2>
                                    <p className="text-xs text-foreground/50">Categories of personal and geospatial data</p>
                                </div>
                            </div>
                            
                            <div className="text-xs sm:text-sm text-foreground/80 leading-relaxed space-y-4 pt-2">
                                <p>
                                    When you interact with EcoWatch SJDM, we collect only the minimum necessary data to verify and resolve environmental reports:
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                    <div className="p-4 rounded-2xl bg-card/60 border border-border/40 space-y-2">
                                        <div className="font-semibold text-foreground flex items-center gap-2">
                                            <UserCheck size={16} className="text-primary" />
                                            A. Account Information
                                        </div>
                                        <p className="text-xs text-foreground/60 leading-relaxed">
                                            Full name, email address, phone number (optional), role designation (Citizen, Barangay Officer, Cleaner, CENRO Administrator), and encrypted password hashes.
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-card/60 border border-border/40 space-y-2">
                                        <div className="font-semibold text-foreground flex items-center gap-2">
                                            <MapPin size={16} className="text-primary" />
                                            B. Geolocation Data
                                        </div>
                                        <p className="text-xs text-foreground/60 leading-relaxed">
                                            Precise GPS coordinates (latitude and longitude) captured via device sensors or extracted from photo EXIF metadata during report submission.
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-card/60 border border-border/40 space-y-2">
                                        <div className="font-semibold text-foreground flex items-center gap-2">
                                            <FileText size={16} className="text-primary" />
                                            C. Photographic Evidence
                                        </div>
                                        <p className="text-xs text-foreground/60 leading-relaxed">
                                            Photos of waste sites uploaded by citizens, as well as before/after resolution photos submitted by cleanup personnel.
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-card/60 border border-border/40 space-y-2">
                                        <div className="font-semibold text-foreground flex items-center gap-2">
                                            <Server size={16} className="text-primary" />
                                            D. Technical & Telemetry Data
                                        </div>
                                        <p className="text-xs text-foreground/60 leading-relaxed">
                                            IP address, browser type, device camera timestamp, and audit trail logs of administrative status changes and work orders.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Section 3: AI Processing */}
                        <section id="ai-processing" className="glass p-6 sm:p-8 rounded-3xl border border-border/50 space-y-4 scroll-mt-28">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                    <Cpu size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg sm:text-xl font-bold text-foreground">3. AI & Computer Vision Processing</h2>
                                    <p className="text-xs text-foreground/50">Mask R-CNN & automated garbage verification</p>
                                </div>
                            </div>

                            <div className="text-xs sm:text-sm text-foreground/80 leading-relaxed space-y-3 pt-2">
                                <p>
                                    EcoWatch SJDM employs automated artificial intelligence pipelines to ensure the authenticity and efficiency of report intake:
                                </p>
                                <ul className="space-y-2 list-disc list-inside text-foreground/70">
                                    <li>
                                        <strong>Instance Segmentation (Mask R-CNN)</strong>: Uploaded images are analyzed by our fine-tuned computer vision model to detect garbage clusters, compute confidence scores, and generate visual mask overlays.
                                    </li>
                                    <li>
                                        <strong>Spatial Ray-Casting</strong>: GPS points are tested against San Jose del Monte&apos;s 59 barangay boundary polygons (`sjdm_barangays.geojson`) using Shapely point-in-polygon algorithms to automatically assign jurisdictional responsibility.
                                    </li>
                                    <li>
                                        <strong>DBSCAN Hotspot Clustering</strong>: Unresolved report coordinates are clustered geographically (epsilon ≈ 100m) to generate real-time heatmaps for city environmental planners without exposing individual identity on public views.
                                    </li>
                                    <li>
                                        <strong>Privacy Pre-Processing</strong>: Citizen faces or vehicle license plates accidentally captured in background surroundings are not used for facial recognition or vehicle tracking.
                                    </li>
                                </ul>
                            </div>
                        </section>

                        {/* Section 4: Purpose & Sharing */}
                        <section id="purpose-sharing" className="glass p-6 sm:p-8 rounded-3xl border border-border/50 space-y-4 scroll-mt-28">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                    <Building2 size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg sm:text-xl font-bold text-foreground">4. Purpose & Data Sharing</h2>
                                    <p className="text-xs text-foreground/50">How your information is used and routed</p>
                                </div>
                            </div>

                            <div className="text-xs sm:text-sm text-foreground/80 leading-relaxed space-y-3 pt-2">
                                <p>
                                    Your data is used strictly for environmental protection, waste clearance dispatch, and statistical municipal reporting:
                                </p>
                                <div className="space-y-2.5">
                                    <div className="flex items-start gap-2.5">
                                        <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
                                        <span><strong>Barangay Local Government Units:</strong> Assigned barangay officers receive report details and coordinates to dispatch local cleanup teams.</span>
                                    </div>
                                    <div className="flex items-start gap-2.5">
                                        <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
                                        <span><strong>City ENRO Oversight:</strong> CENRO administrators monitor city-wide resolution rates, SLA adherence, and chronic dumping hotspots.</span>
                                    </div>
                                    <div className="flex items-start gap-2.5">
                                        <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
                                        <span><strong>Infrastructure Partners:</strong> Secure cloud infrastructure (Supabase PostgreSQL, Vercel hosting, Google Gemini API for AI chat assistant) processing data under strict data protection terms.</span>
                                    </div>
                                </div>
                                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5 mt-4">
                                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                    <span><strong>Zero Commercial Exploitation:</strong> EcoWatch SJDM never sells, rents, monetizes, or shares citizen personal information with advertisers or commercial data brokers.</span>
                                </div>
                            </div>
                        </section>

                        {/* Section 5: Security & Storage */}
                        <section id="security-storage" className="glass p-6 sm:p-8 rounded-3xl border border-border/50 space-y-4 scroll-mt-28">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                    <Lock size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg sm:text-xl font-bold text-foreground">5. Data Security & Retention</h2>
                                    <p className="text-xs text-foreground/50">Technical and organizational safeguards</p>
                                </div>
                            </div>

                            <div className="text-xs sm:text-sm text-foreground/80 leading-relaxed space-y-3 pt-2">
                                <p>
                                    We implement industry-standard physical, electronic, and procedural safeguards:
                                </p>
                                <ul className="space-y-2 list-disc list-inside text-foreground/70">
                                    <li><strong>Encryption in Transit:</strong> All communications between your browser and our backend are encrypted via TLS 1.3 / HTTPS.</li>
                                    <li><strong>Password Hashing:</strong> Passwords are cryptographically salted and hashed using bcrypt on the backend server. Plaintext passwords are never stored.</li>
                                    <li><strong>Role-Based Access Control (RBAC):</strong> Access to user contact numbers and raw evidence is restricted strictly based on administrative role.</li>
                                    <li><strong>Retention Period:</strong> Active reports and audit logs are retained for municipal compliance and analytics for up to 3 years, after which identifiable personal records may be anonymized.</li>
                                </ul>
                            </div>
                        </section>

                        {/* Section 6: Citizen Rights */}
                        <section id="citizen-rights" className="glass p-6 sm:p-8 rounded-3xl border border-border/50 space-y-4 scroll-mt-28">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                    <UserCheck size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg sm:text-xl font-bold text-foreground">6. Your Rights Under RA 10173</h2>
                                    <p className="text-xs text-foreground/50">Statutory protections for data subjects</p>
                                </div>
                            </div>

                            <div className="text-xs sm:text-sm text-foreground/80 leading-relaxed space-y-3 pt-2">
                                <p>
                                    As a data subject under the Data Privacy Act of 2012, you possess the following enforceable rights:
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="p-3.5 rounded-xl bg-card/50 border border-border/40">
                                        <h4 className="font-semibold text-xs text-primary mb-1">Right to be Informed</h4>
                                        <p className="text-[11px] text-foreground/60 leading-relaxed">Knowing how your personal data is collected, handled, and processed.</p>
                                    </div>
                                    <div className="p-3.5 rounded-xl bg-card/50 border border-border/40">
                                        <h4 className="font-semibold text-xs text-primary mb-1">Right to Access</h4>
                                        <p className="text-[11px] text-foreground/60 leading-relaxed">Requesting a copy of your submitted reports and account information.</p>
                                    </div>
                                    <div className="p-3.5 rounded-xl bg-card/50 border border-border/40">
                                        <h4 className="font-semibold text-xs text-primary mb-1">Right to Rectification</h4>
                                        <p className="text-[11px] text-foreground/60 leading-relaxed">Correcting erroneous or outdated personal data in your profile.</p>
                                    </div>
                                    <div className="p-3.5 rounded-xl bg-card/50 border border-border/40">
                                        <h4 className="font-semibold text-xs text-primary mb-1">Right to Erasure & Blocking</h4>
                                        <p className="text-[11px] text-foreground/60 leading-relaxed">Requesting deletion or suspension of your account upon verified request.</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Section 7: DPO Contact */}
                        <section id="dpo-contact" className="glass p-6 sm:p-8 rounded-3xl border border-primary/30 bg-primary/5 space-y-5 scroll-mt-28">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl eco-gradient flex items-center justify-center text-white shrink-0 shadow-md shadow-primary/20">
                                    <Building2 size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg sm:text-xl font-bold text-foreground">7. Contact & Data Protection Officer</h2>
                                    <p className="text-xs text-foreground/60">Official inquiries, data requests, and complaints</p>
                                </div>
                            </div>

                            <div className="text-xs sm:text-sm text-foreground/80 leading-relaxed space-y-4 pt-1">
                                <p>
                                    If you wish to exercise your rights under RA 10173, submit an inquiry, or report a suspected data privacy incident, you may contact our office:
                                </p>

                                <div className="p-5 rounded-2xl bg-card/80 border border-border/60 space-y-3.5">
                                    <div className="flex items-start gap-3">
                                        <Building2 size={16} className="text-primary mt-0.5 shrink-0" />
                                        <div>
                                            <span className="font-semibold block text-foreground">{LEGAL_CONFIG.officeName}</span>
                                            <span className="text-xs text-foreground/60 leading-relaxed">{LEGAL_CONFIG.officeAddress}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <Mail size={16} className="text-primary shrink-0" />
                                        <div>
                                            <span className="text-xs text-foreground/60">Official Email: </span>
                                            <a href={`mailto:${LEGAL_CONFIG.email}`} className="text-primary font-semibold hover:underline">
                                                {LEGAL_CONFIG.email}
                                            </a>
                                            {LEGAL_CONFIG.backupEmail && (
                                                <span className="text-xs text-foreground/40"> (or {LEGAL_CONFIG.backupEmail})</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <Clock size={16} className="text-primary shrink-0" />
                                        <span className="text-xs text-foreground/60">
                                            <strong>Office Hours:</strong> {LEGAL_CONFIG.officeHours}
                                        </span>
                                    </div>
                                </div>

                                <p className="text-[11px] text-foreground/50 italic">
                                    Note: You may also file a formal complaint with the National Privacy Commission (NPC) of the Philippines via https://privacy.gov.ph if you believe your rights have been compromised.
                                </p>
                            </div>
                        </section>

                    </div>
                </div>
            </div>

            {/* Footer */}
            <Footer />
        </div>
    );
}
