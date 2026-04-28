"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

// We need a simple map to show the user's location
const MiniMap = dynamic(() => import("@/components/MiniMap"), { 
    ssr: false,
    loading: () => <div className="w-full h-full bg-white/5 animate-pulse flex items-center justify-center"><p className="text-xs font-bold text-primary">Loading Map...</p></div>
});

const LocationPickerMap = dynamic(() => import("@/components/LocationPickerMap"), {
    ssr: false,
    loading: () => <div className="w-full h-48 bg-white/5 animate-pulse rounded-2xl flex items-center justify-center"><p className="text-xs font-bold text-primary">Loading Map...</p></div>
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function ReportPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    
    // Form Data
    const [lat, setLat] = useState<number | null>(null);
    const [lon, setLon] = useState<number | null>(null);
    const [image, setImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [notes, setNotes] = useState("");
    
    // UI States
    const [isLocating, setIsLocating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Step 1: Get GPS Location
    const handleGetLocation = () => {
        setIsLocating(true);
        setError(null);
        
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLat(position.coords.latitude);
                    setLon(position.coords.longitude);
                    setIsLocating(false);
                    // Don't auto-advance to step 2, let them adjust the pin if needed
                },
                (err) => {
                    console.error("Location error:", err);
                    setError("Failed to get location. Please enable GPS and try again.");
                    setIsLocating(false);
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            setError("Geolocation is not supported by your browser.");
            setIsLocating(false);
        }
    };

    // Step 2: Handle Image Selection
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImage(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            setError(null);
        }
    };

    // Step 3: Final Submission
    const handleSubmit = async () => {
        if (!lat || !lon || !image) {
            setError("Missing required data (Location or Image).");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        const formData = new FormData();
        formData.append("lat", lat.toString());
        formData.append("lon", lon.toString());
        if (notes) formData.append("notes", notes);
        formData.append("image", image);

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
                // Success! Redirect to tracking page
                router.push(data.tracking_url);
            } else {
                // AI Rejected it or server error
                setError(data.message || "Failed to submit report.");
            }
        } catch (err) {
            console.error("Submit error:", err);
            setError("Network error. Could not connect to server.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0f0a] pt-24 pb-12 px-4 flex flex-col items-center">
            
            <div className="w-full max-w-lg mb-8 flex items-center justify-between">
                <button 
                    onClick={() => step > 1 ? setStep(step - 1) : router.push("/")} 
                    className="text-white hover:text-primary transition-colors flex items-center gap-2 font-bold"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    Back
                </button>
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-white/20 shadow-inner border border-white/5'}`} />
                    <div className="w-8 h-0.5 bg-white/10" />
                    <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-white/20 shadow-inner border border-white/5'}`} />
                    <div className="w-8 h-0.5 bg-white/10" />
                    <div className={`w-3 h-3 rounded-full ${step >= 3 ? 'bg-primary' : 'bg-white/20 shadow-inner border border-white/5'}`} />
                </div>
            </div>

            <div className="w-full max-w-lg glass p-6 md:p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
                
                {error && (
                    <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                        <svg className="text-red-500 shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <p className="text-sm font-medium text-red-400">{error}</p>
                    </div>
                )}

                {/* STEP 1: LOCATION */}
                {step === 1 && (
                    <div className="animate-in slide-in-from-right-8 duration-300">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 shadow-lg shadow-primary/20">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        </div>
                        <h2 className="text-3xl font-black text-white mb-2">Pinpoint Location</h2>
                        <p className="text-foreground/60 font-medium mb-6">
                            We need your GPS coordinates to assign the cleanup team to the correct barangay. Drag the pin to adjust.
                        </p>

                        <div className="h-64 mb-6">
                            <LocationPickerMap 
                                initialLat={lat || 14.82} 
                                initialLon={lon || 121.05} 
                                onLocationChange={(newLat, newLon) => {
                                    setLat(newLat);
                                    setLon(newLon);
                                }} 
                            />
                        </div>

                        <div className="flex gap-4">
                            <button 
                                onClick={handleGetLocation}
                                disabled={isLocating}
                                className="flex-1 py-4 glass text-white rounded-2xl font-bold hover:bg-white/5 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:scale-100"
                            >
                                {isLocating ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                                )}
                                Auto-Locate
                            </button>
                            <button 
                                onClick={() => setStep(2)}
                                disabled={!lat || !lon}
                                className="flex-1 py-4 eco-gradient text-white rounded-2xl font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none"
                            >
                                Confirm Location
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 2: CAMERA */}
                {step === 2 && (
                    <div className="animate-in slide-in-from-right-8 duration-300">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 shadow-lg shadow-primary/20">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        </div>
                        <h2 className="text-3xl font-black text-white mb-2">Capture Evidence</h2>
                        <p className="text-foreground/60 font-medium mb-6">
                            Take a clear photo of the illegal waste. Our AI will verify the image before submission.
                        </p>

                        {previewUrl ? (
                            <div className="mb-8 relative h-64 rounded-2xl overflow-hidden border border-white/10 group">
                                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                <button 
                                    onClick={() => {
                                        setPreviewUrl(null);
                                        setImage(null);
                                    }}
                                    className="absolute top-4 right-4 glass px-3 py-1.5 rounded-full text-xs font-bold text-white hover:bg-red-500/80 transition-colors shadow-xl opacity-0 group-hover:opacity-100"
                                >
                                    Remove
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <label className="cursor-pointer glass rounded-2xl border border-white/10 hover:border-primary/50 hover:bg-primary/5 transition-all p-6 flex flex-col items-center justify-center gap-3 group">
                                    <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} className="hidden" />
                                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/50 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                                    </div>
                                    <span className="text-sm font-bold text-white/70 text-center">Open Camera</span>
                                </label>
                                
                                <label className="cursor-pointer glass rounded-2xl border border-white/10 hover:border-primary/50 hover:bg-primary/5 transition-all p-6 flex flex-col items-center justify-center gap-3 group">
                                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/50 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                    </div>
                                    <span className="text-sm font-bold text-white/70 text-center">Open Gallery</span>
                                </label>
                            </div>
                        )}

                        <div className="flex gap-4">
                            <button 
                                onClick={() => setStep(3)}
                                disabled={!image}
                                className="w-full py-4 eco-gradient text-white rounded-2xl font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none"
                            >
                                Continue to Review
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 3: REVIEW & SUBMIT */}
                {step === 3 && (
                    <div className="animate-in slide-in-from-right-8 duration-300">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 shadow-lg shadow-primary/20">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        </div>
                        <h2 className="text-3xl font-black text-white mb-2">Final Details</h2>
                        <p className="text-foreground/60 font-medium mb-8">
                            Add any helpful notes for the barangay cleanup crew (optional).
                        </p>

                        <div className="mb-8">
                            <div className="flex gap-4 mb-6">
                                <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 border border-white/10">
                                    <img src={previewUrl!} alt="Preview" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 h-24 rounded-xl overflow-hidden border border-white/10 relative bg-black/50">
                                    <MiniMap lat={lat!} lon={lon!} />
                                    <div className="absolute inset-0 bg-black/20 pointer-events-none shadow-inner rounded-xl" />
                                </div>
                            </div>

                            <label className="block text-xs font-bold text-white/50 mb-2 uppercase tracking-wider">Additional Notes</label>
                            <textarea 
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="e.g. It's behind the old church, next to the bridge..."
                                className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors resize-none h-32"
                            />
                        </div>

                        <div className="flex gap-4">
                            <button 
                                onClick={() => setStep(2)}
                                disabled={isSubmitting}
                                className="flex-1 py-4 glass border border-white/10 text-white rounded-2xl font-bold hover:bg-white/5 transition-colors disabled:opacity-50"
                            >
                                Back
                            </button>
                            <button 
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="flex-[2] py-4 eco-gradient text-white rounded-2xl font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:scale-100"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Running AI...
                                    </>
                                ) : (
                                    <>
                                        Submit Report
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
