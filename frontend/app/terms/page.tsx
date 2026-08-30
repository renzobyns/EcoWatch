"use client";

import { useState } from "react";
import Link from "next/link";
import { 
    FileText, 
    Scale, 
    ShieldAlert, 
    CheckCircle2, 
    AlertTriangle, 
    Building2, 
    Mail, 
    Clock, 
    ArrowLeft, 
    Sparkles, 
    Gavel, 
    Trash2, 
    Cpu, 
    UserCheck
} from "lucide-react";
import Footer from "@/components/Footer";

// Centralized Contact & Legal Configuration (Easily Editable)
const LEGAL_CONFIG = {
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
    { id: "acceptance", title: "1. Acceptance & User Roles" },
    { id: "reporting-rules", title: "2. Citizen Reporting Rules" },
    { id: "prohibited", title: "3. Prohibited Activities" },
    { id: "media-license", title: "4. Media Licensing & Evidence" },
    { id: "ai-disclaimer", title: "5. AI Verification Disclaimer" },
    { id: "sla-cleanup", title: "6. SLAs & Cleanup Workorders" },
    { id: "termination", title: "7. Account Suspension & Liability" },
    { id: "governing-law", title: "8. Governing Law & Inquiries" },
];

export default function TermsOfServicePage() {
    const [activeSection, setActiveSection] = useState("acceptance");

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
                            <Scale size={13} />
                            City of San Jose del Monte Civic Terms
                        </div>
                    </div>

                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
                        Terms of <span className="text-gradient">Service</span>
                    </h1>
                    <p className="mt-3 text-sm sm:text-base text-foreground/70 max-w-3xl leading-relaxed">
                        Please review these terms and community standards carefully. By accessing or reporting through EcoWatch SJDM, you agree to comply with our civic engagement policies.
                    </p>

                    <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-foreground/50 border-t border-border/40 pt-4">
                        <span><strong>Effective Date:</strong> {LEGAL_CONFIG.effectiveDate}</span>
                        <span>•</span>
                        <span><strong>Last Revised:</strong> {LEGAL_CONFIG.lastUpdated}</span>
                        <span>•</span>
                        <span><strong>Jurisdiction:</strong> City of San Jose del Monte, Bulacan</span>
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

                            {/* Community Commitment Card */}
                            <div className="glass p-4 rounded-2xl border border-border/50 text-xs space-y-2">
                                <div className="font-semibold flex items-center gap-1.5 text-foreground/90">
                                    <Sparkles size={14} className="text-primary" />
                                    Clean SJDM Commitment
                                </div>
                                <p className="text-foreground/60 leading-relaxed">
                                    EcoWatch empowers citizens to act as environmental guardians for a cleaner, healthier community.
                                </p>
                                <Link
                                    href="/report"
                                    className="block text-center w-full py-1.5 px-3 rounded-lg eco-gradient text-white font-medium text-[11px] hover:opacity-90 transition-opacity"
                                >
                                    Submit a Report
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Right Prose Content */}
                    <div className="lg:col-span-8 xl:col-span-9 space-y-10">
                        
                        {/* Section 1: Acceptance & Roles */}
                        <section id="acceptance" className="glass p-6 sm:p-8 rounded-3xl border border-border/50 space-y-4 scroll-mt-28">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                    <UserCheck size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg sm:text-xl font-bold text-foreground">1. Acceptance of Terms & User Roles</h2>
                                    <p className="text-xs text-foreground/50">Binding agreement for all platform participants</p>
                                </div>
                            </div>
                            <div className="text-xs sm:text-sm text-foreground/80 leading-relaxed space-y-3 pt-2">
                                <p>
                                    By registering, creating an account, or submitting reports via EcoWatch SJDM, you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the application.
                                </p>
                                <p>
                                    EcoWatch SJDM recognizes four distinct operational roles with customized jurisdictional access:
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                    <div className="p-3.5 rounded-xl bg-card/60 border border-border/40">
                                        <span className="font-semibold text-xs text-primary block">Citizen Reporters</span>
                                        <span className="text-[11px] text-foreground/60">Community members submitting photographic reports and tracking cleanup statuses.</span>
                                    </div>
                                    <div className="p-3.5 rounded-xl bg-card/60 border border-border/40">
                                        <span className="font-semibold text-xs text-primary block">Barangay Officers</span>
                                        <span className="text-[11px] text-foreground/60">Officials managing localized workorders across the 59 SJDM Barangays.</span>
                                    </div>
                                    <div className="p-3.5 rounded-xl bg-card/60 border border-border/40">
                                        <span className="font-semibold text-xs text-primary block">Cleanup Personnel</span>
                                        <span className="text-[11px] text-foreground/60">Field teams executing site cleanups and uploading verifiable after-remediation proof.</span>
                                    </div>
                                    <div className="p-3.5 rounded-xl bg-card/60 border border-border/40">
                                        <span className="font-semibold text-xs text-primary block">CENRO Administrators</span>
                                        <span className="text-[11px] text-foreground/60">City Environment officials overseeing city-wide analytics, SLA enforcement, and escalations.</span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Section 2: Reporting Rules */}
                        <section id="reporting-rules" className="glass p-6 sm:p-8 rounded-3xl border border-border/50 space-y-4 scroll-mt-28">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                    <Trash2 size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg sm:text-xl font-bold text-foreground">2. Citizen Reporting & Verification Rules</h2>
                                    <p className="text-xs text-foreground/50">Standards for valid solid waste violation submissions</p>
                                </div>
                            </div>
                            
                            <div className="text-xs sm:text-sm text-foreground/80 leading-relaxed space-y-3 pt-2">
                                <p>
                                    To ensure actionable dispatch for cleanup teams, all submitted reports must meet the following criteria:
                                </p>
                                <ul className="space-y-2.5">
                                    <li className="flex items-start gap-2.5">
                                        <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
                                        <span><strong>Geographic Boundary:</strong> Reports must originate within the territorial boundaries of the City of San Jose del Monte, Bulacan. Reports falling outside will be flagged or rejected by spatial boundary checks.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
                                        <span><strong>Clear Photographic Evidence:</strong> Images must clearly capture the uncollected solid waste or illegal dump site in good lighting without heavy digital filters or obstructions.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
                                        <span><strong>Accurate GPS Pin:</strong> The report location must correspond to the actual physical location of the waste site.</span>
                                    </li>
                                </ul>
                            </div>
                        </section>

                        {/* Section 3: Prohibited Conduct */}
                        <section id="prohibited" className="glass p-6 sm:p-8 rounded-3xl border border-border/50 space-y-4 scroll-mt-28">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                                    <ShieldAlert size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg sm:text-xl font-bold text-foreground">3. Prohibited Activities</h2>
                                    <p className="text-xs text-foreground/50">Violations subject to account suspension and legal referral</p>
                                </div>
                            </div>

                            <div className="text-xs sm:text-sm text-foreground/80 leading-relaxed space-y-3 pt-2">
                                <p>Users must strictly avoid the following abusive behaviors:</p>
                                <div className="space-y-2 text-foreground/75">
                                    <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 flex items-start gap-2.5">
                                        <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                                        <span><strong>Fraudulent or Fabricated Reports:</strong> Submitting fake photos, downloaded internet images, stock photos, or re-submitting previously resolved dump sites.</span>
                                    </div>
                                    <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 flex items-start gap-2.5">
                                        <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                                        <span><strong>Harassment & Disparagement:</strong> Using report description fields to harass, defame, or target specific individuals, neighbors, or barangay officials.</span>
                                    </div>
                                    <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 flex items-start gap-2.5">
                                        <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                                        <span><strong>Spamming & Denial of Service:</strong> Flooding the API with rapid duplicate requests, automated bot scripts, or attempting unauthorized SQL/system manipulation.</span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Section 4: Media Licensing */}
                        <section id="media-license" className="glass p-6 sm:p-8 rounded-3xl border border-border/50 space-y-4 scroll-mt-28">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg sm:text-xl font-bold text-foreground">4. Media Licensing & Evidence Rights</h2>
                                    <p className="text-xs text-foreground/50">Ownership and municipal use of uploaded photos</p>
                                </div>
                            </div>

                            <div className="text-xs sm:text-sm text-foreground/80 leading-relaxed space-y-3 pt-2">
                                <p>
                                    You retain ownership of the photos you take. However, by uploading photos through EcoWatch SJDM, you grant the City Government of San Jose del Monte, CENRO, and EcoWatch a <strong>royalty-free, non-exclusive, perpetual license</strong> to:
                                </p>
                                <ul className="space-y-1.5 list-disc list-inside text-foreground/70">
                                    <li>Process photos through AI computer vision models for segmentation and scoring.</li>
                                    <li>Display before/after images to assigned barangay cleanup crews and city administrators.</li>
                                    <li>Utilize anonymized imagery in municipal environmental compliance reports and research.</li>
                                </ul>
                            </div>
                        </section>

                        {/* Section 5: AI Disclaimer */}
                        <section id="ai-disclaimer" className="glass p-6 sm:p-8 rounded-3xl border border-border/50 space-y-4 scroll-mt-28">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                    <Cpu size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg sm:text-xl font-bold text-foreground">5. AI Verification Disclaimer</h2>
                                    <p className="text-xs text-foreground/50">Machine learning models as assistive decision support</p>
                                </div>
                            </div>

                            <div className="text-xs sm:text-sm text-foreground/80 leading-relaxed space-y-3 pt-2">
                                <p>
                                    EcoWatch uses <strong>Mask R-CNN</strong> deep learning algorithms and spatial heuristics to assist verification. While these models achieve high precision in municipal waste detection, they are assistive decision-support tools:
                                </p>
                                <ul className="space-y-2 list-disc list-inside text-foreground/70">
                                    <li>AI verification confidence scores do not replace official barangay or CENRO sanitary inspection findings.</li>
                                    <li>Low-confidence or edge-case submissions remain eligible for manual administrative verification.</li>
                                    <li>Neither EcoWatch nor the City LGU guarantees that 100% of non-waste objects will be filtered without occasional human review.</li>
                                </ul>
                            </div>
                        </section>

                        {/* Section 6: SLAs & Workorders */}
                        <section id="sla-cleanup" className="glass p-6 sm:p-8 rounded-3xl border border-border/50 space-y-4 scroll-mt-28">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                    <Clock size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg sm:text-xl font-bold text-foreground">6. Service Level Agreements (SLAs)</h2>
                                    <p className="text-xs text-foreground/50">Resolution timelines and operational commitments</p>
                                </div>
                            </div>

                            <div className="text-xs sm:text-sm text-foreground/80 leading-relaxed space-y-3 pt-2">
                                <p>
                                    Once a report is verified, a workorder is generated and assigned an SLA resolution window based on severity (Low, Medium, High). While Barangay and CENRO teams strive to meet all resolution targets:
                                </p>
                                <ul className="space-y-1.5 list-disc list-inside text-foreground/70">
                                    <li>Inclement weather, natural calamities, and heavy equipment availability may affect resolution schedules.</li>
                                    <li>Citizens can track active countdowns directly on the public Tracking portal.</li>
                                    <li>Chronic SLA breaches are automatically escalated to the CENRO Command Center.</li>
                                </ul>
                            </div>
                        </section>

                        {/* Section 7: Account Suspension */}
                        <section id="termination" className="glass p-6 sm:p-8 rounded-3xl border border-border/50 space-y-4 scroll-mt-28">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                                    <Gavel size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg sm:text-xl font-bold text-foreground">7. Account Suspension & Legal Liability</h2>
                                    <p className="text-xs text-foreground/50">Sanctions for non-compliance and ordinance violations</p>
                                </div>
                            </div>

                            <div className="text-xs sm:text-sm text-foreground/80 leading-relaxed space-y-3 pt-2">
                                <p>
                                    CENRO and EcoWatch administrators reserve the right to suspend or permanently ban any user account found in breach of these terms. Repeated false reporting or malicious misuse may also be subject to sanctions under relevant local ordinances of the City of San Jose del Monte and national environmental laws (e.g., <strong>Republic Act No. 9003 - Ecological Solid Waste Management Act of 2000</strong>).
                                </p>
                            </div>
                        </section>

                        {/* Section 8: Governing Law */}
                        <section id="governing-law" className="glass p-6 sm:p-8 rounded-3xl border border-primary/30 bg-primary/5 space-y-5 scroll-mt-28">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl eco-gradient flex items-center justify-center text-white shrink-0 shadow-md shadow-primary/20">
                                    <Building2 size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg sm:text-xl font-bold text-foreground">8. Governing Law & Inquiries</h2>
                                    <p className="text-xs text-foreground/60">Jurisdiction and official communication channels</p>
                                </div>
                            </div>

                            <div className="text-xs sm:text-sm text-foreground/80 leading-relaxed space-y-4 pt-1">
                                <p>
                                    These Terms of Service are governed by the laws of the Republic of the Philippines. Any disputes arising out of the use of this system shall be resolved under the jurisdiction of the appropriate courts in the City of San Jose del Monte, Bulacan.
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
                                            <span className="text-xs text-foreground/60">Official Correspondence: </span>
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
