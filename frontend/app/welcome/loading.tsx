export default function WelcomeLoading() {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 sm:p-8 animate-pulse">
            <div className="max-w-xl mx-auto w-full space-y-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/20 mx-auto" />
                <div className="space-y-2">
                    <div className="h-8 w-64 bg-muted/70 rounded-xl mx-auto" />
                    <div className="h-4 w-80 bg-muted/40 rounded-md mx-auto" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-32 bg-card/70 rounded-2xl border border-border/50 p-4 space-y-3 flex flex-col items-center justify-center">
                            <div className="w-8 h-8 rounded-lg bg-muted/50" />
                            <div className="h-4 w-28 bg-muted/70 rounded" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
