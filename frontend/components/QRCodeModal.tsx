"use client";

import { useEffect, useState } from "react";

export default function QRCodeModal({ onClose }: { onClose: () => void }) {
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const reportUrl = typeof window !== "undefined" ? `${window.location.origin}/report` : "https://ecowatch-sjdm.com/report";

    useEffect(() => {
        // Generate QR code using a free API
        setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(reportUrl)}&color=065f46&bgcolor=ffffff`);
    }, [reportUrl]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="glass p-7 max-w-md w-full rounded-2xl border border-white/10 shadow-2xl relative animate-in zoom-in-95 duration-300">
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 p-1.5 text-foreground/50 hover:text-white transition-colors rounded-md hover:bg-white/10"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>

                <div className="text-center mb-6">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><rect x="7" y="7" width="3" height="3"/><rect x="14" y="7" width="3" height="3"/><rect x="7" y="14" width="3" height="3"/><rect x="14" y="14" width="3" height="3"/></svg>
                    </div>
                    <h2 className="text-xl font-bold text-white mb-1.5">Share EcoWatch</h2>
                    <p className="text-sm text-foreground/60 font-medium">
                        Print or save this QR code. Citizens can scan it to quickly report environmental issues in your barangay.
                    </p>
                </div>

                <div className="bg-white p-4 rounded-xl flex items-center justify-center mb-5 shadow-inner mx-auto w-fit">
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
                            alert("Link copied to clipboard!");
                        }}
                        className="flex-1 h-10 inline-flex items-center justify-center glass border border-white/10 text-white rounded-lg text-sm font-semibold hover:bg-white/5 transition-colors"
                    >
                        Copy Link
                    </button>
                </div>
            </div>
        </div>
    );
}
