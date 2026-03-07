export default function ReportPage() {
    return (
        <div className="p-8 max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold text-gradient mb-8">Report Environmental Issue</h1>
            <form className="glass p-8 space-y-6">
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-primary">Capture GPS & Photo</label>
                    <div className="w-full h-48 bg-white/5 rounded-xl border-2 border-dashed border-primary/20 flex flex-col items-center justify-center text-foreground/40 hover:bg-white/10 transition-colors cursor-pointer group">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2 group-hover:text-primary transition-colors"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                        <p>Click to Upload or Snap Photo</p>
                        <p className="text-xs italic">(Automatic Mask R-CNN Verification Triggered)</p>
                    </div>
                </div>
                <button type="submit" className="w-full py-4 eco-gradient text-white rounded-xl text-lg font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all">Submit Issue</button>
            </form>
        </div>
    );
}
