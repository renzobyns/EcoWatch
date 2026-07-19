"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function VerifyContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get("token");

    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [message, setMessage] = useState("Verifying your email...");

    useEffect(() => {
        if (!token) {
            setStatus("error");
            setMessage("Invalid or missing verification link.");
            return;
        }

        api(`/auth/verify?token=${token}`)
            .then(() => {
                setStatus("success");
                setMessage("Email verified successfully! Your account is now active.");
            })
            .catch((err) => {
                setStatus("error");
                setMessage(err.message || "The verification link is invalid or has expired.");
            });
    }, [token]);

    return (
        <div className="w-full max-w-md p-8 bg-card border border-border shadow-2xl rounded-2xl animate-slide-up relative overflow-hidden">
            <div className="flex flex-col items-center justify-center text-center space-y-6">
                {status === "loading" && (
                    <>
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight text-foreground">Verifying Email</h2>
                            <p className="text-sm text-foreground/60 mt-2">{message}</p>
                        </div>
                    </>
                )}

                {status === "success" && (
                    <>
                        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight text-foreground">Account Verified!</h2>
                            <p className="text-sm text-foreground/60 mt-2">{message}</p>
                        </div>
                        <Button className="w-full group mt-4" onClick={() => router.push("/login")}>
                            Proceed to Sign In
                            <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </>
                )}

                {status === "error" && (
                    <>
                        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
                            <XCircle className="w-8 h-8 text-destructive" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight text-foreground">Verification Failed</h2>
                            <p className="text-sm text-foreground/60 mt-2">{message}</p>
                        </div>
                        <div className="flex gap-3 w-full mt-4">
                            <Button variant="outline" className="flex-1" onClick={() => router.push("/signup")}>
                                Sign Up
                            </Button>
                            <Button className="flex-1" onClick={() => router.push("/login")}>
                                Sign In
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default function VerifyPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
            
            <Suspense fallback={<div className="w-full max-w-md p-8 bg-card border rounded-2xl flex justify-center"><Loader2 className="animate-spin text-primary" /></div>}>
                <VerifyContent />
            </Suspense>
        </div>
    );
}
