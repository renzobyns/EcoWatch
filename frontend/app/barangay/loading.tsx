export default function BarangayLoading() {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col p-4 sm:p-6 lg:p-8 animate-pulse space-y-6">
            {/* Top Bar Skeleton */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border/40">
                <div className="space-y-2">
                    <div className="h-4 w-28 bg-emerald-500/20 rounded-full" />
                    <div className="h-8 w-64 bg-muted/60 rounded-xl" />
                </div>
                <div className="flex gap-2.5">
                    <div className="h-9 w-28 bg-muted/40 rounded-xl" />
                    <div className="h-9 w-32 bg-primary/20 rounded-xl" />
                </div>
            </div>

            {/* KPI Cards Grid Skeleton */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-28 bg-card/60 rounded-2xl border border-border/50 p-4 space-y-3">
                        <div className="flex justify-between items-center">
                            <div className="h-3.5 w-20 bg-muted/60 rounded" />
                            <div className="w-8 h-8 rounded-lg bg-muted/40" />
                        </div>
                        <div className="h-7 w-16 bg-muted/80 rounded-lg" />
                    </div>
                ))}
            </div>

            {/* Navigation Tabs Skeleton */}
            <div className="flex gap-2 border-b border-border/40 pb-2">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-8 w-24 bg-muted/40 rounded-xl" />
                ))}
            </div>

            {/* Report Table / Main Content Skeleton */}
            <div className="bg-card/60 rounded-3xl border border-border/50 p-6 space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-border/30">
                    <div className="h-5 w-40 bg-muted/60 rounded-md" />
                    <div className="h-8 w-48 bg-muted/40 rounded-xl" />
                </div>
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-14 bg-muted/30 rounded-xl border border-border/30 flex items-center justify-between px-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-muted/50" />
                                <div className="h-4 w-32 bg-muted/60 rounded" />
                            </div>
                            <div className="h-4 w-24 bg-muted/40 rounded" />
                            <div className="h-6 w-16 bg-emerald-500/20 rounded-full" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
