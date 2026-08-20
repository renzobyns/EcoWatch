"use client";

import { Settings, HardDrive, Wifi, Download, ShieldCheck, Bell, Wrench, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface SettingsSidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    role?: "cenro" | "barangay" | "cleaner" | "citizen" | "guest";
}

type SettingsCategory = {
    key: string;
    label: string;
    icon: any;
    subItems?: { key: string; label: string }[];
    roles?: string[];
};

const SETTINGS_CATEGORIES: SettingsCategory[] = [
    {
        key: "general",
        label: "General",
        icon: Settings,
        roles: ["cenro", "barangay", "cleaner", "citizen", "guest"],
        subItems: [
            { key: "language", label: "Language" },
            { key: "appearance", label: "Appearance" },
            { key: "shortcuts", label: "Keyboard Shortcuts" },
        ],
    },
    { key: "storage", label: "Storage Settings", icon: HardDrive, roles: ["cenro"] },
    { key: "connectivity", label: "Connectivity", icon: Wifi, roles: ["cenro"] },
    { key: "export", label: "Data Export Hub", icon: Download, roles: ["cenro", "barangay"] },
    { key: "ai_policy", label: "AI Policy", icon: ShieldCheck, roles: ["cenro"] },
    { key: "developer", label: "Developer Options", icon: Wrench, roles: ["cenro"] },
    { key: "notifications", label: "Notifications", icon: Bell, roles: ["cenro", "barangay", "cleaner", "citizen"] },
];

export function SettingsSidebar({ activeTab, onTabChange, role = "cenro" }: SettingsSidebarProps) {
    const [expandedAccordion, setExpandedAccordion] = useState<string | null>("general");
    const mobileTabsRef = useRef<HTMLDivElement>(null);

    const handleCategoryClick = (category: SettingsCategory) => {
        if (category.subItems) {
            setExpandedAccordion(expandedAccordion === category.key ? null : category.key);
        } else {
            onTabChange(category.key);
        }
    };

    // Filter categories and subItems based on role
    const normalizedRole = role.toLowerCase();
    const filteredCategories = SETTINGS_CATEGORIES.filter(cat => !cat.roles || cat.roles.includes(normalizedRole)).map(cat => {
        if (cat.key === "general") {
            return {
                ...cat,
                subItems: cat.subItems?.filter(sub => {
                    if (normalizedRole === "cleaner" || normalizedRole === "citizen" || normalizedRole === "guest") {
                        return sub.key === "language" || sub.key === "appearance";
                    }
                    return true; // cenro, barangay see all
                })
            };
        }
        return cat;
    });

    // Build a flat list of mobile tabs from filtered categories
    const mobileTabs: { key: string; label: string }[] = [];
    filteredCategories.forEach(cat => {
        if (cat.subItems) {
            cat.subItems.forEach(sub => mobileTabs.push({ key: sub.key, label: sub.label }));
        } else {
            mobileTabs.push({ key: cat.key, label: cat.label });
        }
    });

    // Auto-scroll active tab into view on mobile
    useEffect(() => {
        if (!mobileTabsRef.current) return;
        const container = mobileTabsRef.current;
        const activeButton = container.querySelector(`[data-tab-key="${activeTab}"]`) as HTMLElement | null;
        if (activeButton) {
            const scrollLeft = activeButton.offsetLeft - container.offsetWidth / 2 + activeButton.offsetWidth / 2;
            container.scrollTo({ left: scrollLeft, behavior: "smooth" });
        }
    }, [activeTab]);

    return (
        <div className="md:w-64 border-b md:border-b-0 md:border-r border-border bg-muted/30 md:bg-muted/30 flex flex-col shrink-0">
            {/* ===== DESKTOP SIDEBAR (≥ md) — unchanged ===== */}
            <div className="p-6 hidden md:block">
                <h1 className="text-xl font-bold text-foreground">Settings</h1>
            </div>

            <div className="hidden md:flex flex-col gap-1 p-3">
                {filteredCategories.map((cat) => {
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

            {/* ===== MOBILE HORIZONTAL TABS (< md) ===== */}
            <div 
                ref={mobileTabsRef}
                className="flex md:hidden overflow-x-auto gap-0 px-4 bg-card sticky top-0 z-10 hide-scrollbar"
            >
                {mobileTabs.map((tab) => {
                    const isActive = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            data-tab-key={tab.key}
                            onClick={() => onTabChange(tab.key)}
                            className={`shrink-0 px-4 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
                                isActive
                                    ? "text-primary"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {tab.label}
                            {/* Active underline indicator */}
                            {isActive && (
                                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
