import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] items-center justify-center bg-[#0a0f0a] relative overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-96 bg-primary/20 blur-[120px] rounded-full -z-10" />

      <div className="max-w-6xl w-full px-4 text-center space-y-12 z-10">
        <div className="space-y-4">
          <div className="inline-block px-4 py-1.5 rounded-full glass border-primary/20 text-primary text-xs font-bold tracking-widest uppercase mb-4">
            System Testing Environment
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white mb-2">
            EcoWatch <span className="text-gradient">SJDM</span>
          </h1>
          <p className="text-foreground/60 max-w-2xl mx-auto font-medium">
            Select a module to begin testing the environmental monitoring workflows.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8">
          {/* Module 1: Auth / Landing / Citizen */}
          <Link href="/login" className="group">
            <div className="glass p-8 h-full flex flex-col items-center justify-center space-y-6 border-white/5 hover:border-primary/40 hover:bg-white/5 transition-all duration-500 rounded-3xl transform hover:-translate-y-2">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-bold text-white uppercase tracking-tight">Citizen Portal</h3>
                <p className="text-xs text-foreground/50 mt-2">Authentication, Reporting, and Public Landing Page.</p>
              </div>
              <div className="px-6 py-2 rounded-full border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest group-hover:bg-primary group-hover:text-white transition-colors">
                Launch Module
              </div>
            </div>
          </Link>

          {/* Module 2: Barangay */}
          <Link href="/barangay" className="group">
            <div className="glass p-8 h-full flex flex-col items-center justify-center space-y-6 border-white/5 hover:border-emerald-500/40 hover:bg-white/5 transition-all duration-500 rounded-3xl transform hover:-translate-y-2">
              <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-bold text-white uppercase tracking-tight">Barangay Site</h3>
                <p className="text-xs text-foreground/50 mt-2">Local Jurisdictional Management & Cleanup Verification.</p>
              </div>
              <div className="px-6 py-2 rounded-full border border-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase tracking-widest group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                Launch Module
              </div>
            </div>
          </Link>

          {/* Module 3: CENRO */}
          <Link href="/cenro" className="group">
            <div className="glass p-8 h-full flex flex-col items-center justify-center space-y-6 border-white/5 hover:border-blue-500/40 hover:bg-white/5 transition-all duration-500 rounded-3xl transform hover:-translate-y-2">
              <div className="w-20 h-20 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" /></svg>
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-bold text-white uppercase tracking-tight">CENRO Dashboard</h3>
                <p className="text-xs text-foreground/50 mt-2">City-Wide Spatial Analytics and DBSCAN Heatmaps.</p>
              </div>
              <div className="px-6 py-2 rounded-full border border-blue-500/20 text-blue-500 text-[10px] font-bold uppercase tracking-widest group-hover:bg-blue-500 group-hover:text-white transition-colors">
                Launch Module
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-8 text-center w-full">
        <p className="text-[10px] text-foreground/30 font-bold tracking-[0.2em] uppercase">
          San Jose del Monte Environmental Monitoring System
        </p>
      </footer>
    </div>
  );
}
