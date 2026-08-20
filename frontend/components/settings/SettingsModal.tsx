"use client";

import { useState, useEffect } from "react";
import { X, ChevronLeft } from "lucide-react";

import { SettingsSidebar } from "@/components/settings/SettingsSidebar";
import { GeneralTab } from "@/components/settings/GeneralTab";
import { StorageSettingsTab } from "@/components/settings/StorageSettingsTab";
import { ConnectivityTab } from "@/components/settings/ConnectivityTab";
import { DataExportTab } from "@/components/settings/DataExportTab";
import { AiPolicyTab } from "@/components/settings/AiPolicyTab";
import { DeveloperTab } from "@/components/settings/DeveloperTab";
import { NotificationsTab } from "@/components/settings/NotificationsTab";

interface SettingsModalProps {
    open: boolean;
    onClose: () => void;
    role?: "cenro" | "barangay" | "cleaner" | "citizen" | "guest";
}

export function SettingsModal({ open, onClose, role = "cenro" }: SettingsModalProps) {
    const [activeTab, setActiveTab] = useState("appearance");

    // Close on Escape key
    useEffect(() => {
        if (!open) return;
        const onEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onEsc);
        return () => document.removeEventListener("keydown", onEsc);
    }, [open, onClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [open]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop — hidden on mobile since we go full-screen */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in hidden md:block"
                onClick={onClose}
            />

            {/* ===== PANEL ===== */}
            {/* Desktop: centered floating card | Mobile: full-screen takeover */}
            <div className="
                relative z-10 bg-card overflow-hidden flex flex-col
                w-full h-full 
                md:w-[95vw] md:max-w-5xl md:rounded-2xl md:border md:border-border md:shadow-2xl md:shadow-black/50 md:flex-row md:min-h-[500px] md:max-h-[85vh] md:h-auto
                animate-slide-up
            ">

                {/* ===== MOBILE TOP BAR (< md) ===== */}
                <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-border bg-card sticky top-0 z-20 shrink-0">
                    <button
                        onClick={onClose}
                        className="flex items-center justify-center w-11 h-11 -ml-2 rounded-xl hover:bg-secondary/60 transition-colors text-foreground"
                        aria-label="Close settings"
                    >
                        <ChevronLeft size={22} strokeWidth={2.5} />
                    </button>
                    <h1 className="text-base font-bold text-foreground tracking-tight">Settings</h1>
                    <button
                        onClick={onClose}
                        className="flex items-center justify-center w-11 h-11 -mr-2 rounded-xl hover:bg-secondary/60 transition-colors text-muted-foreground"
                        aria-label="Close settings"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* ===== DESKTOP CLOSE BUTTON (≥ md) ===== */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 p-2 bg-secondary/60 hover:bg-secondary rounded-full transition-colors text-muted-foreground hover:text-foreground hidden md:flex"
                >
                    <X size={18} />
                </button>

                {/* Left sidebar (desktop) + Horizontal tabs (mobile) */}
                <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} role={role.toLowerCase() as any} />
                
                {/* Right content */}
                <div className="flex-1 overflow-y-auto p-5 pb-12 md:p-8">
                    {activeTab === "language" && <GeneralTab section="language" />}
                    {activeTab === "appearance" && <GeneralTab section="appearance" />}
                    {activeTab === "shortcuts" && <GeneralTab section="shortcuts" />}
                    {activeTab === "storage" && <StorageSettingsTab />}
                    {activeTab === "connectivity" && <ConnectivityTab />}
                    {activeTab === "export" && <DataExportTab />}
                    {activeTab === "ai_policy" && <AiPolicyTab />}
                    {activeTab === "developer" && <DeveloperTab />}
                    {activeTab === "notifications" && <NotificationsTab />}
                </div>
            </div>
        </div>
    );
}
