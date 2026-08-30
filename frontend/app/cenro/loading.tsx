export default function CenroLoading() {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col p-4 sm:p-6 lg:p-8 animate-pulse space-y-6">
            {/* Header Skeleton */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border/40">
                <div className="space-y-2">
                    <div className="h-4 w-36 bg-emerald-500/20 rounded-full" />
                    <div className="h-8 w-72 bg-muted/60 rounded-xl" />
                </div>
                <div className="flex gap-2.5">
                    <div className="h-9 w-32 bg-muted/40 rounded-xl" />
                    <div className="h-9 w-36 bg-primary/20 rounded-xl" />
                </div>
            </div>

            {/* City-Wide KPI Metric Grid Skeleton */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-24 bg-card/60 rounded-2xl border border-border/50 p-3.5 space-y-2">
                        <div className="h-3 w-16 bg-muted/60 rounded" />
                        <div className="h-6 w-12 bg-muted/80 rounded-lg" />
                        <div className="h-2.5 w-20 bg-muted/40 rounded" />
                    </div>
                ))}
            </div>

            {/* Main Dashboard Layout Skeleton (Chart + Map) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-card/60 rounded-3xl border border-border/50 p-6 space-y-4 h-96 flex flex-col justify-between">
                    <div className="flex justify-between items-center">
                        <div className="h-5 w-48 bg-muted/60 rounded" />
                        <div className="h-8 w-32 bg-muted/40 rounded-xl" />
                    </div>
                    <div className="h-64 bg-muted/20 rounded-2xl flex items-end p-4 gap-3">
                        {[40, 65, 80, 50, 90, 75, 60, 85, 95, 70].map((h, idx) => (
                            <div key={idx} className="flex-1 bg-muted/50 rounded-t-lg" style={{ height: `${h}%` }} />
                        ))}
                    </div>
                </div>

                <div className="bg-card/60 rounded-3xl border border-border/50 p-6 space-y-4 h-96">
                    <div className="h-5 w-36 bg-muted/60 rounded" />
                    <div className="h-72 bg-muted/30 rounded-2xl border border-border/30" />
                </div>
            </div>
        </div>
    );
}
