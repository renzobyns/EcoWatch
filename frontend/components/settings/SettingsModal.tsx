"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

import { SettingsSidebar } from "@/components/settings/SettingsSidebar";
import { GeneralTab } from "@/components/settings/GeneralTab";
import { StorageSettingsTab } from "@/components/settings/StorageSettingsTab";
import { ConnectivityTab } from "@/components/settings/ConnectivityTab";
import { DataExportTab } from "@/components/settings/DataExportTab";
import { AiPolicyTab } from "@/components/settings/AiPolicyTab";
import { NotificationsTab } from "@/components/settings/NotificationsTab";

interface SettingsModalProps {
    open: boolean;
    onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
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
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Floating Panel */}
            <div className="relative w-[95vw] max-w-5xl bg-card rounded-2xl border border-border shadow-2xl shadow-black/50 overflow-hidden flex flex-col md:flex-row min-h-[500px] max-h-[85vh] animate-slide-up z-10">
                
                {/* Close button */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 p-2 bg-secondary/60 hover:bg-secondary rounded-full transition-colors text-muted-foreground hover:text-foreground"
                >
                    <X size={18} />
                </button>

                {/* Left sidebar */}
                <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />
                
                {/* Right content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                    {activeTab === "language" && <GeneralTab section="language" />}
                    {activeTab === "appearance" && <GeneralTab section="appearance" />}
                    {activeTab === "shortcuts" && <GeneralTab section="shortcuts" />}
                    {activeTab === "storage" && <StorageSettingsTab />}
                    {activeTab === "connectivity" && <ConnectivityTab />}
                    {activeTab === "export" && <DataExportTab />}
                    {activeTab === "ai_policy" && <AiPolicyTab />}
                    {activeTab === "notifications" && <NotificationsTab />}
                </div>
            </div>
        </div>
    );
}
