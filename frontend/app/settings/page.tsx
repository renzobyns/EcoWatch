"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    LayoutDashboard, Map, FileText, ShieldCheck, BarChart3, Building2,
    Image as ImageIcon, History, BookUser, UserCircle, Briefcase, HelpCircle,
    ClipboardList, Settings
} from "lucide-react";
import { PortalShell, type PortalNavItem } from "@/components/portal/PortalShell";
import { SettingsTab } from "@/components/portal/SettingsTab";

const CENRO_NAV_SETTINGS: PortalNavItem[] = [
    { key: "command_center", label: "Dashboard", icon: LayoutDashboard },
    { key: "overview", label: "City Map", icon: Map },
    { key: "oversight", label: "Reports", icon: FileText },
    { key: "sla_management", label: "SLA Management", icon: ShieldCheck },
    { key: "analytics", label: "Analytics", icon: BarChart3 },
    { key: "barangay_management", label: "Barangay Management", icon: Building2 },
    { key: "gallery", label: "Evidence Gallery", icon: ImageIcon, sectionBreakBefore: true },
    { key: "audit", label: "Audit Log", icon: History },
    { key: "users", label: "Accounts", icon: BookUser },
    { key: "settings", label: "Settings", icon: Settings, sectionBreakBefore: true },
];

const BARANGAY_NAV_SETTINGS: PortalNavItem[] = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "reports", label: "Reports", icon: FileText },
    { key: "map_view", label: "Map View", icon: Map },
    { key: "workorders", label: "Workorders", icon: ClipboardList, sectionBreakBefore: true },
    { key: "accounts", label: "Accounts", icon: BookUser },
    { key: "settings", label: "Settings", icon: Settings, sectionBreakBefore: true },
];

const CLEANER_NAV_SETTINGS: PortalNavItem[] = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, subtitle: "My day at a glance" },
    { key: "jobs", label: "My Jobs", icon: Briefcase },
    { key: "map_view", label: "Map View", icon: Map },
    { key: "history", label: "History", icon: History, sectionBreakBefore: true },
    { key: "help", label: "Help", icon: HelpCircle },
    { key: "settings", label: "Settings", icon: Settings, sectionBreakBefore: true },
];

const PORTAL_ROUTES: Record<string, string> = {
    cenro: "/cenro",
    barangay: "/barangay",
    cleaner: "/cleaner",
};

export default function SettingsPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const stored = localStorage.getItem("ecowatch_user");
        if (!stored) {
            router.push("/login");
            return;
        }
        try {
            setUser(JSON.parse(stored));
        } catch (e) {
            router.push("/login");
        }
    }, [router]);

    if (!mounted || !user) return null;

    let nav: PortalNavItem[] = [];
    if (user.role === "cenro") nav = CENRO_NAV_SETTINGS;
    else if (user.role === "barangay") nav = BARANGAY_NAV_SETTINGS;
    else if (user.role === "cleaner") nav = CLEANER_NAV_SETTINGS;

    const brandName = user.role === "cenro" 
        ? { name: "EcoWatch", suffix: "CJSDM" } 
        : { name: "EcoWatch", suffix: user.barangay_assignment || "Unit" };

    return (
        <PortalShell
            brand={brandName}
            role={user.role.toUpperCase()}
            nav={nav}
            activeKey="settings"
            onNavChange={(key) => {
                const baseRoute = PORTAL_ROUTES[user.role] || "/";
                router.push(baseRoute + "?tab=" + key);
            }}
        >
            <div className="h-full overflow-y-auto">
                <SettingsTab />
            </div>
        </PortalShell>
    );
}
