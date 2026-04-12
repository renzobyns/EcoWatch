import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <section className="relative flex-1 flex flex-col items-center justify-center px-4 overflow-hidden py-12 md:py-20">
        {/* Background Accents */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-96 bg-primary/20 blur-[120px] rounded-full -z-10" />

        <div className="max-w-4xl mx-auto text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="inline-block px-4 py-1.5 rounded-full glass border-primary/20 text-primary text-sm font-semibold tracking-wide mb-4">
            Protecting San Jose del Monte's Waterways
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-7xl font-extrabold tracking-tight">
            Stop Waterway <br />
            <span className="text-gradient">Pollution in Real-Time</span>
          </h1>

          <p className="text-lg md:text-xl text-foreground/70 max-w-2xl mx-auto leading-relaxed">
            Scan. Report. Resolve. Join EcoWatch SJDM in monitoring illegal dumping using advanced AI and geospatial analytics to keep our community clean.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/report"
              className="w-full sm:w-auto px-8 py-4 eco-gradient text-white rounded-full text-lg font-bold shadow-xl shadow-primary/30 hover:shadow-primary/50 transition-all transform hover:-translate-y-1 active:scale-95 text-center"
            >
              Report a Violation
            </Link>
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-8 py-4 glass text-foreground rounded-full text-lg font-bold hover:bg-white/5 transition-all text-center border border-white/10"
            >
              View Analytics
            </Link>
          </div>
        </div>

        {/* Feature Cards Preview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto mt-16 md:mt-24">
          <div className="glass p-6 md:p-8 space-y-4 hover:border-primary/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></svg>
            </div>
            <h3 className="text-xl font-bold">AI Verification</h3>
            <p className="text-foreground/60 text-sm">Mask R-CNN validation ensures every report is verified and legitimate.</p>
          </div>

          <div className="glass p-6 md:p-8 space-y-4 hover:border-primary/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
            </div>
            <h3 className="text-xl font-bold">Smart Mapping</h3>
            <p className="text-foreground/60 text-sm">Geospatial routing auto-assigns reports to the correct Barangay official.</p>
          </div>

          <div className="glass p-6 md:p-8 space-y-4 hover:border-primary/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>
            </div>
            <h3 className="text-xl font-bold">Hotspot Heatmaps</h3>
            <p className="text-foreground/60 text-sm">DBSCAN clustering helps CENRO identify and prioritize high-waste zones.</p>
          </div>
        </div>
      </section>

      {/* Footer Branding */}
      <footer className="py-10 border-t border-white/5 text-center px-4">
        <p className="text-xs text-foreground/40 font-medium tracking-widest uppercase">
          San Jose del Monte City Environment and Natural Resources Office
        </p>
      </footer>
    </div>
  );
}
