"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Global boundary root error caught:", error);
    }, [error]);

    return (
        <html lang="en">
            <body className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-4 font-sans antialiased">
                <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl p-8 text-center space-y-6">
                    <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto">
                        <AlertTriangle size={32} />
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold tracking-tight text-white">
                            Critical Application Error
                        </h1>
                        <p className="text-xs text-neutral-400 leading-relaxed">
                            EcoWatch encountered a fatal issue at the application root. Please reload the application to restore operations.
                        </p>
                    </div>

                    <button
                        onClick={() => reset()}
                        className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30"
                    >
                        <RefreshCw size={16} />
                        Reload Application
                    </button>

                    <p className="text-[10px] uppercase font-mono tracking-widest text-neutral-600">
                        ECOWATCH GLOBAL EXCEPTION HANDLER
                    </p>
                </div>
            </body>
        </html>
    );
}
