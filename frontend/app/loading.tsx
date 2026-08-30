export default function Loading() {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col p-4 sm:p-8 animate-pulse">
            {/* Header / Navbar placeholder */}
            <div className="w-full max-w-7xl mx-auto h-14 bg-muted/40 rounded-2xl border border-border/40 mb-8" />

            <div className="max-w-7xl mx-auto w-full space-y-6 flex-1">
                {/* Hero / Top Banner skeleton */}
                <div className="w-full h-48 sm:h-64 bg-muted/30 rounded-3xl border border-border/40 p-6 flex flex-col justify-end space-y-3">
                    <div className="h-6 w-36 bg-muted/60 rounded-full" />
                    <div className="h-8 sm:h-12 w-3/4 max-w-lg bg-muted/60 rounded-xl" />
                    <div className="h-4 w-1/2 max-w-sm bg-muted/40 rounded-lg" />
                </div>

                {/* Cards grid skeleton */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-32 bg-muted/30 rounded-2xl border border-border/40 p-4 space-y-3">
                            <div className="h-4 w-24 bg-muted/60 rounded-md" />
                            <div className="h-8 w-16 bg-muted/60 rounded-lg" />
                            <div className="h-3 w-32 bg-muted/40 rounded-md" />
                        </div>
                    ))}
                </div>

                {/* Main Content Area skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 h-96 bg-muted/30 rounded-3xl border border-border/40" />
                    <div className="h-96 bg-muted/30 rounded-3xl border border-border/40" />
                </div>
            </div>
        </div>
    );
}
