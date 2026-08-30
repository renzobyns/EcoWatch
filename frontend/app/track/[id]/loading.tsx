export default function TrackLoading() {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col p-4 sm:p-8 animate-pulse">
            <div className="max-w-3xl mx-auto w-full space-y-6 pt-16 sm:pt-20">
                {/* Header Skeleton */}
                <div className="text-center space-y-2">
                    <div className="h-4 w-32 bg-primary/20 rounded-full mx-auto" />
                    <div className="h-8 w-64 bg-muted/60 rounded-xl mx-auto" />
                </div>

                {/* Tracking Progress Card Skeleton */}
                <div className="bg-card/70 rounded-3xl border border-border/60 p-6 sm:p-8 space-y-6">
                    <div className="flex justify-between items-center pb-4 border-b border-border/30">
                        <div className="h-5 w-32 bg-muted/60 rounded" />
                        <div className="h-6 w-24 bg-emerald-500/20 rounded-full" />
                    </div>

                    {/* Stepper Timeline Skeleton */}
                    <div className="grid grid-cols-4 gap-2 py-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex flex-col items-center space-y-2">
                                <div className="w-8 h-8 rounded-full bg-muted/50" />
                                <div className="h-3 w-16 bg-muted/40 rounded" />
                            </div>
                        ))}
                    </div>

                    {/* Image & Details Skeleton */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        <div className="h-48 bg-muted/30 rounded-2xl border border-border/40" />
                        <div className="space-y-3">
                            <div className="h-4 w-28 bg-muted/60 rounded" />
                            <div className="h-4 w-44 bg-muted/40 rounded" />
                            <div className="h-16 bg-muted/30 rounded-xl border border-border/30" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
