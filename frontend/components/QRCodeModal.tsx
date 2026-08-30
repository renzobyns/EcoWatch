/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function QRCodeModal({ onClose }: { onClose: () => void }) {
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const reportUrl = typeof window !== "undefined" ? `${window.location.origin}/report` : "https://ecowatch-sjdm.com/report";

    useEffect(() => {
        // Generate QR code using a free API
        setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(reportUrl)}&color=065f46&bgcolor=ffffff`);
    }, [reportUrl]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="glass p-7 max-w-md w-full rounded-2xl border border-border shadow-2xl relative animate-in zoom-in-95 duration-300">
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 p-1.5 text-foreground/50 hover:text-foreground transition-colors rounded-md hover:bg-foreground/10"
                >
                    ✕
                </button>

                <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-gradient">Scan to Report</h3>
                    <p className="text-foreground/70 text-sm mt-1">Open camera app and scan this code to submit a new illegal dumping report on mobile.</p>
                </div>

                <div className="bg-white p-4 rounded-xl flex items-center justify-center shadow-inner mb-6 mx-auto w-fit border border-emerald-900/10">
                    {qrCodeUrl ? (
                        <img src={qrCodeUrl} alt="Report QR Code" className="w-44 h-44" />
                    ) : (
                        <div className="w-44 h-44 bg-gray-100 animate-pulse rounded-lg"></div>
                    )}
                </div>

                <div className="flex gap-3">
                    <a
                        href={qrCodeUrl || "#"}
                        download="EcoWatch-QR.png"
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 h-10 inline-flex items-center justify-center eco-gradient text-white rounded-lg text-sm font-semibold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-95"
                    >
                        Save Image
                    </a>
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(reportUrl);
                            toast.success("Report link copied to clipboard!");
                        }}
                        className="flex-1 h-10 inline-flex items-center justify-center glass border border-border text-foreground rounded-lg text-sm font-semibold hover:bg-foreground/5 transition-colors cursor-pointer"
                    >
                        Copy Link
                    </button>
                </div>
            </div>
        </div>
    );
}
