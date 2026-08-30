export default function CleanerLoading() {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col p-4 sm:p-6 lg:p-8 animate-pulse space-y-6 max-w-4xl mx-auto w-full">
            {/* Cleaner Header Skeleton */}
            <div className="flex items-center justify-between pb-4 border-b border-border/40">
                <div className="space-y-2">
                    <div className="h-4 w-28 bg-emerald-500/20 rounded-full" />
                    <div className="h-7 w-48 bg-muted/60 rounded-xl" />
                </div>
                <div className="w-10 h-10 rounded-full bg-muted/50" />
            </div>

            {/* Quick Stats Pill Grid Skeleton */}
            <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-card/60 rounded-2xl border border-border/50 p-3 space-y-2 text-center flex flex-col items-center justify-center">
                        <div className="h-3 w-14 bg-muted/60 rounded" />
                        <div className="h-5 w-8 bg-muted/80 rounded" />
                    </div>
                ))}
            </div>

            {/* Active Jobs Queue Skeleton */}
            <div className="space-y-4">
                <div className="h-5 w-36 bg-muted/60 rounded" />
                {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-card/60 rounded-3xl border border-border/50 p-5 space-y-4">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1.5">
                                <div className="h-4 w-24 bg-primary/20 rounded" />
                                <div className="h-5 w-48 bg-muted/70 rounded-md" />
                            </div>
                            <div className="h-6 w-20 bg-amber-500/20 rounded-full" />
                        </div>
                        <div className="h-36 bg-muted/30 rounded-2xl border border-border/30" />
                        <div className="flex gap-3 pt-2">
                            <div className="h-10 flex-1 bg-muted/40 rounded-xl" />
                            <div className="h-10 flex-1 bg-primary/20 rounded-xl" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
