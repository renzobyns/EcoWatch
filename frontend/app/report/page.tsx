"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// We need a simple map to show the user's location
const MiniMap = dynamic(() => import("@/components/MiniMap"), { 
    ssr: false,
    loading: () => <div className="w-full h-full bg-foreground/5 animate-pulse flex items-center justify-center"><p className="text-xs font-bold text-primary">Loading Map...</p></div>
});

const PinpointFullscreen = dynamic(() => import("@/components/PinpointFullscreen"), {
    ssr: false,
    loading: () => (
        <div className="fixed inset-0 top-16 bg-background flex items-center justify-center z-0">
            <div className="glass-pro px-6 py-4 rounded-2xl flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="text-xs font-bold text-primary uppercase tracking-widest">Loading Map...</p>
            </div>
        </div>
    ),
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function ReportPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    
    // Form Data
    const [lat, setLat] = useState<number | null>(null);
    const [lon, setLon] = useState<number | null>(null);
    const [images, setImages] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [notes, setNotes] = useState("");
    
    // UI States
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Step 2: Handle Image Selection
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (files.length === 0) return;
        const total = images.length + files.length;
        if (total > 5) {
            setError("Maximum 5 photos allowed.");
            return;
        }
        setImages((prev) => [...prev, ...files]);
        setPreviewUrls((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
        setError(null);
        e.target.value = "";
    };

    const removeImage = (index: number) => {
        setImages((prev) => prev.filter((_, i) => i !== index));
        setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
    };

    // Step 3: Final Submission
    const handleSubmit = async () => {
        if (!lat || !lon || images.length === 0) {
            setError("Missing required data (Location or Image).");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        const formData = new FormData();
        formData.append("lat", lat.toString());
        formData.append("lon", lon.toString());
        if (notes) formData.append("notes", notes);
        images.forEach((img) => formData.append("images", img));

        // Optional: Check if logged in to attach reporter_id
        const storedUser = localStorage.getItem('ecowatch_user');
        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser);
                if (parsed.id) formData.append("reporter_id", parsed.id.toString());
            } catch(e) {}
        }

        try {
            const res = await fetch(`${API_URL}/report/submit`, {
                method: "POST",
                body: formData,
            });

            const data = await res.json();

            if (res.ok && data.success) {
                // Report saved. AI runs in the background — tracking page polls for the result.
                router.push(data.tracking_url);
            } else {
                setError(data.message || data.detail || "Failed to submit report.");
            }
        } catch (err) {
            console.error("Submit error:", err);
            setError("Network error. Could not connect to server.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (step === 1) {
        return (
            <>
                <PinpointFullscreen
                    lat={lat}
                    lon={lon}
                    onLocationChange={(newLat, newLon) => {
                        setLat(newLat);
                        setLon(newLon);
                        setError(null);
                    }}
                    onConfirm={() => setStep(2)}
                    onExit={() => router.push("/")}
                    onError={(msg) => setError(msg)}
                />
                {error && (
                    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[1100] max-w-md w-[calc(100vw-2rem)] animate-in fade-in slide-in-from-top-4">
                        <div className="glass-pro rounded-xl px-4 py-3 flex items-start gap-3 border border-red-500/40 shadow-[0_0_24px_-8px_rgba(239,68,68,0.6)]">
                            <svg className="text-red-400 shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            <p className="text-sm font-medium text-foreground flex-1">{error}</p>
                            <button
                                onClick={() => setError(null)}
                                className="text-foreground/50 hover:text-foreground transition-colors"
                                aria-label="Dismiss"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                    </div>
                )}
            </>
        );
    }

    return (
        <div className="min-h-screen bg-background pt-20 pb-12 px-4 flex flex-col items-center">

            <div className="w-full max-w-lg mb-6 flex items-center justify-between">
                <button
                    onClick={() => step > 1 ? setStep(step - 1) : router.push("/")}
                    className="text-foreground/80 hover:text-primary transition-colors flex items-center gap-2 text-sm font-medium"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    Back
                </button>
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-foreground/20 shadow-inner border border-border'}`} />
                    <div className="w-8 h-0.5 bg-foreground/10" />
                    <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-foreground/20 shadow-inner border border-border'}`} />
                    <div className="w-8 h-0.5 bg-foreground/10" />
                    <div className={`w-3 h-3 rounded-full ${step >= 3 ? 'bg-primary' : 'bg-foreground/20 shadow-inner border border-border'}`} />
                </div>
            </div>

            <div className="w-full max-w-lg glass p-6 md:p-7 rounded-2xl border border-border shadow-2xl relative overflow-hidden">

                {error && (
                    <div className="mb-5 p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                        <svg className="text-red-500 shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <p className="text-sm font-medium text-red-400">{error}</p>
                    </div>
                )}

                {/* STEP 2: CAMERA */}
                {step === 2 && (
                    <div className="animate-in slide-in-from-right-8 duration-300">
                        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-5 shadow-md shadow-primary/20">
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-1.5">Capture Evidence</h2>
                        <p className="text-sm text-foreground/60 font-medium mb-5">
                            Take up to 5 clear photos of the illegal waste. Our AI will verify before submission.
                        </p>

                        {/* Photo strip */}
                        {previewUrls.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                                {previewUrls.map((url, i) => (
                                    <div key={i} className="relative shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-border group">
                                        <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(i)}
                                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                                {previewUrls.length < 5 && (
                                    <label className="shrink-0 w-24 h-24 rounded-xl border-2 border-dashed border-foreground/20 hover:border-primary/50 cursor-pointer flex items-center justify-center text-foreground/40 hover:text-primary transition-colors">
                                        <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                    </label>
                                )}
                            </div>
                        )}

                        {previewUrls.length === 0 && (
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <label className="cursor-pointer glass rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all p-5 flex flex-col items-center justify-center gap-2.5 group">
                                    <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handleImageChange} />
                                    <div className="w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center text-foreground/50 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                                    </div>
                                    <span className="text-sm font-semibold text-foreground/70 text-center">Open Camera</span>
                                </label>
                                <label className="cursor-pointer glass rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all p-5 flex flex-col items-center justify-center gap-2.5 group">
                                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
                                    <div className="w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center text-foreground/50 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                    </div>
                                    <span className="text-sm font-semibold text-foreground/70 text-center">Open Gallery</span>
                                </label>
                            </div>
                        )}

                        <Button
                            onClick={() => setStep(3)}
                            disabled={images.length === 0}
                            size="lg"
                            className="w-full"
                        >
                            Continue to Review ({images.length} photo{images.length !== 1 ? "s" : ""})
                        </Button>
                    </div>
                )}

                {/* STEP 3: REVIEW & SUBMIT */}
                {step === 3 && (
                    <div className="animate-in slide-in-from-right-8 duration-300">
                        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-5 shadow-md shadow-primary/20">
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-1.5">Final Details</h2>
                        <p className="text-sm text-foreground/60 font-medium mb-6">
                            Add any helpful notes for the barangay cleanup crew (optional).
                        </p>

                        <div className="mb-6">
                            <div className="flex gap-3 mb-5">
                                <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 border border-border relative">
                                    <img src={previewUrls[0]} alt="Preview" className="w-full h-full object-cover" />
                                    {images.length > 1 && (
                                        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                            +{images.length - 1}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 h-20 rounded-lg overflow-hidden border border-border relative bg-black/50">
                                    <MiniMap lat={lat!} lon={lon!} />
                                    <div className="absolute inset-0 bg-black/20 pointer-events-none shadow-inner rounded-lg" />
                                </div>
                            </div>

                            <label className="block text-[11px] font-semibold text-foreground/50 mb-1.5 uppercase tracking-wider">Additional Notes</label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="e.g. It's behind the old church, next to the bridge..."
                                className="h-28"
                            />
                        </div>

                        <div className="flex gap-3">
                            <Button
                                onClick={() => setStep(2)}
                                disabled={isSubmitting}
                                variant="outline"
                                size="lg"
                                className="flex-1"
                            >
                                Back
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                size="lg"
                                className="flex-[2]"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        Submit Report
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
