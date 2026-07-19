"use client";

import { Settings, HardDrive, Wifi, Download, ShieldCheck, Bell, ChevronDown } from "lucide-react";
import { useState } from "react";

interface SettingsSidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

type SettingsCategory = {
    key: string;
    label: string;
    icon: any;
    subItems?: { key: string; label: string }[];
};

const SETTINGS_CATEGORIES: SettingsCategory[] = [
    {
        key: "general",
        label: "General",
        icon: Settings,
        subItems: [
            { key: "language", label: "Language & Region" },
            { key: "appearance", label: "Appearance" },
            { key: "shortcuts", label: "Keyboard Shortcuts" },
        ],
    },
    { key: "storage", label: "Storage Settings", icon: HardDrive },
    { key: "connectivity", label: "Connectivity", icon: Wifi },
    { key: "export", label: "Data Export Hub", icon: Download },
    { key: "ai_policy", label: "AI Policy", icon: ShieldCheck },
    { key: "notifications", label: "Notifications", icon: Bell },
];

export function SettingsSidebar({ activeTab, onTabChange }: SettingsSidebarProps) {
    const [expandedAccordion, setExpandedAccordion] = useState<string | null>("general");

    const handleCategoryClick = (category: SettingsCategory) => {
        if (category.subItems) {
            setExpandedAccordion(expandedAccordion === category.key ? null : category.key);
        } else {
            onTabChange(category.key);
        }
    };

    return (
        <div className="md:w-64 border-b md:border-b-0 md:border-r border-border bg-muted/30 flex flex-col">
            <div className="p-6 hidden md:block">
                <h1 className="text-xl font-bold text-foreground">Settings</h1>
            </div>
            <div className="flex md:hidden overflow-x-auto gap-2 p-3 hide-scrollbar">
                {SETTINGS_CATEGORIES.map((cat) => (
                    <div key={cat.key} className="flex flex-col gap-1">
                        {cat.subItems ? (
                            cat.subItems.map((sub) => (
                                <button
                                    key={sub.key}
                                    onClick={() => onTabChange(sub.key)}
                                    className={`shrink-0 px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                                        activeTab === sub.key
                                            ? "bg-primary/10 text-primary"
                                            : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
                                    }`}
                                >
                                    {sub.label}
                                </button>
                            ))
                        ) : (
                            <button
                                onClick={() => onTabChange(cat.key)}
                                className={`shrink-0 px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                                    activeTab === cat.key
                                        ? "bg-primary/10 text-primary"
                                        : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
                                }`}
                            >
                                {cat.label}
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <div className="hidden md:flex flex-col gap-1 p-3">
                {SETTINGS_CATEGORIES.map((cat) => {
                    const isExpanded = expandedAccordion === cat.key;
                    const hasActiveSubItem = cat.subItems?.some((sub) => sub.key === activeTab);
                    const isActive = activeTab === cat.key || hasActiveSubItem;

                    return (
                        <div key={cat.key}>
                            <button
                                onClick={() => handleCategoryClick(cat)}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                    isActive && !cat.subItems
                                        ? "bg-primary/10 text-primary"
                                        : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <cat.icon size={18} className={isActive ? "text-primary" : ""} />
                                    <span className={isActive && !cat.subItems ? "font-semibold" : ""}>{cat.label}</span>
                                </div>
                                {cat.subItems && (
                                    <ChevronDown
                                        size={16}
                                        className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                                    />
                                )}
                            </button>
                            
                            {cat.subItems && isExpanded && (
                                <div className="mt-1 ml-9 flex flex-col gap-1 animate-slide-up">
                                    {cat.subItems.map((sub) => {
                                        const isSubActive = activeTab === sub.key;
                                        return (
                                            <button
                                                key={sub.key}
                                                onClick={() => onTabChange(sub.key)}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                                    isSubActive
                                                        ? "bg-primary/10 text-primary font-semibold"
                                                        : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
                                                }`}
                                            >
                                                {sub.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
