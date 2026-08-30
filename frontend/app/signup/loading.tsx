export default function SignupLoading() {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 sm:p-6 animate-pulse">
            <div className="w-full max-w-md bg-card/70 rounded-3xl border border-border/60 p-6 sm:p-8 space-y-5">
                <div className="text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-primary/20 mx-auto" />
                    <div className="h-6 w-44 bg-muted/70 rounded-lg mx-auto" />
                    <div className="h-3.5 w-64 bg-muted/40 rounded mx-auto" />
                </div>
                <div className="space-y-3.5">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="space-y-1.5">
                            <div className="h-3 w-20 bg-muted/50 rounded" />
                            <div className="h-10 bg-muted/30 rounded-xl border border-border/40" />
                        </div>
                    ))}
                </div>
                <div className="h-11 bg-primary/20 rounded-xl" />
            </div>
        </div>
    );
}
