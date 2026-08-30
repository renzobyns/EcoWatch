export default function ReportLoading() {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col p-4 sm:p-8 animate-pulse">
            <div className="max-w-2xl mx-auto w-full space-y-6 pt-16 sm:pt-20">
                {/* Header Skeleton */}
                <div className="text-center space-y-2">
                    <div className="h-4 w-32 bg-primary/20 rounded-full mx-auto" />
                    <div className="h-8 w-64 bg-muted/60 rounded-xl mx-auto" />
                    <div className="h-4 w-80 bg-muted/40 rounded-md mx-auto" />
                </div>

                {/* Form Card Skeleton */}
                <div className="bg-card/70 rounded-3xl border border-border/60 p-6 sm:p-8 space-y-6">
                    {/* Photo upload area */}
                    <div className="h-44 sm:h-52 bg-muted/30 rounded-2xl border-2 border-dashed border-border/60 flex flex-col items-center justify-center space-y-2">
                        <div className="w-12 h-12 rounded-full bg-muted/50" />
                        <div className="h-4 w-40 bg-muted/60 rounded" />
                    </div>

                    {/* GPS map container skeleton */}
                    <div className="h-40 bg-muted/30 rounded-2xl border border-border/40" />

                    {/* Inputs */}
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <div className="h-3.5 w-24 bg-muted/60 rounded" />
                            <div className="h-10 bg-muted/30 rounded-xl border border-border/40" />
                        </div>
                        <div className="space-y-1.5">
                            <div className="h-3.5 w-32 bg-muted/60 rounded" />
                            <div className="h-24 bg-muted/30 rounded-xl border border-border/40" />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="h-12 bg-primary/20 rounded-2xl" />
                </div>
            </div>
        </div>
    );
}
