export default function ProfileLoading() {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col p-4 sm:p-8 animate-pulse">
            <div className="max-w-3xl mx-auto w-full space-y-6 pt-16 sm:pt-20">
                {/* Profile Card Skeleton */}
                <div className="bg-card/70 rounded-3xl border border-border/60 p-6 sm:p-8 space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-muted/60" />
                        <div className="space-y-2">
                            <div className="h-6 w-48 bg-muted/70 rounded-lg" />
                            <div className="h-4 w-36 bg-muted/40 rounded" />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border/30">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-16 bg-muted/30 rounded-xl p-3 space-y-1 text-center">
                                <div className="h-3 w-16 bg-muted/50 rounded mx-auto" />
                                <div className="h-5 w-8 bg-muted/70 rounded mx-auto" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Submissions List Skeleton */}
                <div className="bg-card/70 rounded-3xl border border-border/60 p-6 space-y-4">
                    <div className="h-5 w-40 bg-muted/60 rounded" />
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-16 bg-muted/30 rounded-xl border border-border/30 flex items-center justify-between px-4">
                            <div className="h-4 w-32 bg-muted/60 rounded" />
                            <div className="h-6 w-20 bg-muted/40 rounded-full" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
