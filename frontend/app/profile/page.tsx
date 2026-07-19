"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
    UserCircle, Mail, Calendar, MapPin, Building2, Shield, LogOut,
    Pencil, Save, X, KeyRound, Activity, CheckCircle, Truck,
    GitBranch, ShieldX, Settings, UserPlus, ClipboardList,
    LayoutDashboard, FileText, Map, ShieldCheck, BarChart3,
    Image as ImageIcon, History, BookUser, Briefcase, Users, AlertCircle,
    Eye, EyeOff, HelpCircle, Search, ArrowDownUp, ChevronLeft, ChevronRight,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { PortalShell, type PortalNavItem } from "@/components/portal/PortalShell";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { DateRange } from "react-day-picker";
import { isWithinInterval, startOfDay, endOfDay } from "date-fns";

interface ProfileData {
    id: number;
    email: string;
    full_name: string;
    role: string;
    barangay_assignment: string | null;
    is_active: boolean;
    created_at: string;
    stats: Record<string, number>;
    recent_activity: any[];
}

const ROLE_CONFIG: Record<string, { label: string; badge: string; department: string; location: string }> = {
    cenro: {
        label: "CENRO Officer",
        badge: "bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-400",
        department: "City Environment and Natural Resources Office",
        location: "City-wide (CENRO HQ)",
    },
    barangay: {
        label: "Barangay Coordinator",
        badge: "bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400",
        department: "Barangay Environmental Unit",
        location: "",
    },
    cleaner: {
        label: "Cleanup Team Member",
        badge: "bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400",
        department: "Barangay Cleanup Division",
        location: "",
    },
    citizen: {
        label: "Citizen Reporter",
        badge: "bg-primary/10 border border-primary/20 text-primary",
        department: "EcoWatch Community",
        location: "San Jose del Monte",
    },
};

const CENRO_NAV_PROFILE: PortalNavItem[] = [
    { key: "command_center", label: "Dashboard", icon: LayoutDashboard },
    { key: "overview", label: "City Map", icon: Map },
    { key: "oversight", label: "Reports", icon: FileText },
    { key: "sla_management", label: "SLA Management", icon: ShieldCheck },
    { key: "analytics", label: "Analytics", icon: BarChart3 },
    { key: "barangay_management", label: "Barangay Management", icon: Building2 },
    { key: "gallery", label: "Evidence Gallery", icon: ImageIcon, sectionBreakBefore: true },
    { key: "audit", label: "Audit Log", icon: History },
    { key: "users", label: "Accounts", icon: BookUser },
    { key: "profile", label: "Profile View", icon: UserCircle, sectionBreakBefore: true },
];

const BARANGAY_NAV_PROFILE: PortalNavItem[] = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "reports", label: "Reports", icon: FileText },
    { key: "map_view", label: "Map View", icon: Map },
    { key: "workorders", label: "Workorders", icon: ClipboardList, sectionBreakBefore: true },
    { key: "accounts", label: "Accounts", icon: BookUser },
    { key: "profile", label: "Profile View", icon: UserCircle, sectionBreakBefore: true },
];

const CLEANER_NAV_PROFILE: PortalNavItem[] = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, subtitle: "My day at a glance" },
    { key: "jobs", label: "My Jobs", icon: Briefcase },
    { key: "map_view", label: "Map View", icon: Map },
    { key: "history", label: "History", icon: History, sectionBreakBefore: true },
    { key: "help", label: "Help", icon: HelpCircle },
    { key: "profile", label: "Profile View", icon: UserCircle, sectionBreakBefore: true },
];

const CITIZEN_NAV_PROFILE: PortalNavItem[] = [
    { key: "map", label: "Interactive Map", icon: Map },
    { key: "profile", label: "My Profile", icon: UserCircle },
];

const PORTAL_ROUTES: Record<string, string> = {
    cenro: "/cenro",
    barangay: "/barangay",
    cleaner: "/cleaner",
};

const AUDIT_ACTION_DISPLAY: Record<string, string> = {
    reassign: "Reassigned Report",
    force_close: "Forced-close Report",
    update_sla_config: "Updated SLA Config",
    create_user: "Created User Account",
    deploy: "Deployed Cleanup Team",
    resolve: "Resolved Report",
};

const STATUS_BADGE: Record<string, string> = {
    pending: "bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-400",
    verified: "bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400",
    resolved: "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    rejected: "bg-muted border-border text-muted-foreground",
    deployed: "bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400",
    assigned: "bg-muted border-border text-muted-foreground",
    in_progress: "bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-400",
    completed: "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    needs_redo: "bg-destructive/10 border border-destructive/20 text-destructive",
};

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function StatusBadge({ status }: { status: string }) {
    const cls = STATUS_BADGE[status] ?? "bg-muted border-border text-muted-foreground";
    return (
        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-widest ${cls}`}>
            {status.replace(/_/g, " ")}
        </span>
    );
}

function StatCard({
    label, value, sub, positive,
}: {
    label: string; value: string | number; sub?: string; positive?: boolean;
}) {
    return (
        <div className="bg-muted/30 rounded-lg border border-border p-4 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted-foreground">
                {label}
            </span>
            <span className="text-2xl font-bold text-foreground">{value}</span>
            {sub && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-md w-fit border ${
                    positive === true ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    : positive === false ? "bg-destructive/10 border-destructive/20 text-destructive"
                    : "bg-muted border-border text-muted-foreground"
                }`}>
                    {sub}
                </span>
            )}
        </div>
    );
}

function SlaBar({ pct }: { pct: number }) {
    return (
        <div className="mt-4">
            <div className="flex justify-between text-sm font-medium mb-1.5">
                <span className="text-muted-foreground">SLA Compliance</span>
                <span className="text-primary font-bold">{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                    className="h-full rounded-full bg-primary transition-all duration-700"
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

function AuditIcon({ action }: { action: string }) {
    const cls = "w-4 h-4";
    if (action === "reassign") return <GitBranch className={`${cls} text-blue-500`} />;
    if (action === "force_close") return <ShieldX className={`${cls} text-destructive`} />;
    if (action === "update_sla_config") return <Settings className={`${cls} text-yellow-500`} />;
    if (action === "create_user") return <UserPlus className={`${cls} text-emerald-500`} />;
    if (action === "deploy") return <Truck className={`${cls} text-emerald-500`} />;
    if (action === "resolve") return <CheckCircle className={`${cls} text-emerald-500`} />;
    return <Activity className={`${cls} text-muted-foreground`} />;
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
    const [currentPw, setCurrentPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [confirmPw, setConfirmPw] = useState("");
    const [saving, setSaving] = useState(false);
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const handleSubmit = async () => {
        if (!currentPw || !newPw || !confirmPw) {
            toast.error("Please fill in all password fields");
            return;
        }
        setSaving(true);
        try {
            await api("/users/me/password", {
                method: "PUT",
                body: JSON.stringify({
                    current_password: currentPw,
                    new_password: newPw,
                    confirm_new_password: confirmPw,
                }),
            });
            toast.success("Password updated successfully");
            onClose();
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to update password");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-card p-6 max-w-sm w-full rounded-xl border border-border shadow-lg">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <KeyRound className="w-5 h-5 text-primary" /> Change Password
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                        <X size={18} />
                    </button>
                </div>
                <div className="space-y-4 mb-6">
                    {(
                        [
                            { label: "Current Password", val: currentPw, set: setCurrentPw, show: showCurrent, toggle: () => setShowCurrent(v => !v) },
                            { label: "New Password", val: newPw, set: setNewPw, show: showNew, toggle: () => setShowNew(v => !v) },
                            { label: "Confirm New Password", val: confirmPw, set: setConfirmPw, show: showConfirm, toggle: () => setShowConfirm(v => !v) },
                        ] as { label: string; val: string; set: (v: string) => void; show: boolean; toggle: () => void }[]
                    ).map(({ label, val, set, show, toggle }) => (
                        <div key={label}>
                            <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                                {label}
                            </label>
                            <div className="relative">
                                <input
                                    type={show ? "text" : "password"}
                                    value={val}
                                    onChange={(e) => set(e.target.value)}
                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 pr-10 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={toggle}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex gap-3">
                    <button onClick={onClose} disabled={saving}
                        className="flex-1 px-4 py-2 bg-secondary border border-border text-secondary-foreground text-sm font-medium rounded-lg hover:bg-secondary/80 transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSubmit} disabled={saving}
                        className="flex-1 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        {saving ? "Saving..." : "Update"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ProfilePage() {
    const router = useRouter();
    const [profileData, setProfileData] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editName, setEditName] = useState("");
    const [editEmail, setEditEmail] = useState("");
    const [saving, setSaving] = useState(false);
    const [showPwModal, setShowPwModal] = useState(false);

    // Audit History states
    const [auditSearch, setAuditSearch] = useState("");
    const [auditDateRange, setAuditDateRange] = useState<DateRange | undefined>(undefined);
    const [auditSortDesc, setAuditSortDesc] = useState(true);
    const [auditPage, setAuditPage] = useState(1);
    const ITEMS_PER_PAGE = 5;

    useEffect(() => {
        setMounted(true);
        const stored = localStorage.getItem("ecowatch_user");
        if (!stored) { router.push("/login"); return; }
        fetchProfile();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const data = await api("/users/me");
            setProfileData(data);
            setEditName(data.full_name);
            setEditEmail(data.email);
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                router.push("/login");
            } else {
                toast.error(err instanceof ApiError ? err.message : "Failed to load profile");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!profileData) return;
        const payload: Record<string, string> = {};
        if (editName.trim() !== profileData.full_name) payload.full_name = editName.trim();
        if (editEmail.trim().toLowerCase() !== profileData.email) payload.email = editEmail.trim().toLowerCase();
        if (Object.keys(payload).length === 0) { setEditMode(false); return; }
        setSaving(true);
        try {
            const updated = await api("/users/me", {
                method: "PUT",
                body: JSON.stringify(payload),
            });
            setProfileData((prev) =>
                prev ? { ...prev, full_name: updated.full_name, email: updated.email } : prev
            );
            setEditName(updated.full_name);
            setEditEmail(updated.email);
            const stored = localStorage.getItem("ecowatch_user");
            if (stored) {
                const parsed = JSON.parse(stored);
                parsed.full_name = updated.full_name;
                parsed.email = updated.email;
                localStorage.setItem("ecowatch_user", JSON.stringify(parsed));
            }
            toast.success("Profile updated successfully");
            setEditMode(false);
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to save profile");
        } finally {
            setSaving(false);
        }
    };

    const handleCancelEdit = () => {
        if (profileData) { setEditName(profileData.full_name); setEditEmail(profileData.email); }
        setEditMode(false);
    };

    const handleSignOut = () => {
        localStorage.removeItem("ecowatch_user");
        router.push("/");
    };

    const handleNavChange = (key: string) => {
        if (key === "profile" || !profileData) return;
        router.push(PORTAL_ROUTES[profileData.role] ?? "/");
    };

    // Filter, Sort and Paginate History
    const filteredHistory = useMemo(() => {
        if (!profileData?.recent_activity) return [];
        let data = [...profileData.recent_activity];

        // Search Filter
        if (auditSearch.trim()) {
            const q = auditSearch.toLowerCase();
            data = data.filter((entry) => {
                const displayAction = AUDIT_ACTION_DISPLAY[entry.action] ?? entry.action ?? "";
                const trackingId = entry.tracking_id ?? entry.report_tracking_id ?? `WO-${entry.id}` ?? "";
                const targetId = entry.target_id ? String(entry.target_id) : "";
                return (
                    displayAction.toLowerCase().includes(q) ||
                    trackingId.toLowerCase().includes(q) ||
                    targetId.includes(q)
                );
            });
        }

        // Date Range Filter
        if (auditDateRange?.from) {
            data = data.filter((entry) => {
                const date = new Date(entry.created_at);
                const from = startOfDay(auditDateRange.from!);
                const to = auditDateRange.to ? endOfDay(auditDateRange.to) : endOfDay(auditDateRange.from!);
                return isWithinInterval(date, { start: from, end: to });
            });
        }

        // Sort
        data.sort((a, b) => {
            const dA = new Date(a.created_at).getTime();
            const dB = new Date(b.created_at).getTime();
            return auditSortDesc ? dB - dA : dA - dB;
        });

        return data;
    }, [profileData, auditSearch, auditDateRange, auditSortDesc]);

    const totalPages = Math.max(1, Math.ceil(filteredHistory.length / ITEMS_PER_PAGE));
    const paginatedHistory = filteredHistory.slice((auditPage - 1) * ITEMS_PER_PAGE, auditPage * ITEMS_PER_PAGE);

    // Reset pagination when filters change
    useEffect(() => {
        setAuditPage(1);
    }, [auditSearch, auditDateRange, auditSortDesc]);

    // SSR guard: return null on first render so server and client agree (no hydration mismatch)
    if (!mounted) return null;

    // --- Skeletal loader: rendered inside PortalShell so nav is immediately visible ---
    if (loading) {
        // Derive nav / brand from localStorage so PortalShell is correct even before API responds
        let skeletonNav: PortalNavItem[] = BARANGAY_NAV_PROFILE;
        let skeletonBrand = { name: "Barangay Ops", suffix: "" };
        let skeletonRole = "BARANGAY";
        try {
            const raw = localStorage.getItem("ecowatch_user");
            if (raw) {
                const u = JSON.parse(raw);
                const navMap: Record<string, PortalNavItem[]> = {
                    cenro: CENRO_NAV_PROFILE, barangay: BARANGAY_NAV_PROFILE, cleaner: CLEANER_NAV_PROFILE, citizen: CITIZEN_NAV_PROFILE,
                };
                skeletonNav = navMap[u.role] ?? BARANGAY_NAV_PROFILE;
                skeletonRole = (u.role ?? "barangay").toUpperCase();
                const brandMap: Record<string, { name: string; suffix: string }> = {
                    cenro: { name: "EcoWatch", suffix: "CJSDM" },
                    barangay: { name: "Barangay Ops", suffix: u.barangay_assignment ?? "" },
                    cleaner: { name: "EcoWatch", suffix: "Cleaner" },
                    citizen: { name: "EcoWatch", suffix: "Citizen" },
                };
                skeletonBrand = brandMap[u.role] ?? skeletonBrand;
            }
        } catch { /* use defaults */ }

        return (
            <PortalShell brand={skeletonBrand} role={skeletonRole} nav={skeletonNav} activeKey="profile" onNavChange={() => {}}>
                <div className="max-w-4xl mx-auto pb-10 animate-pulse">
                    {/* Identity header skeleton */}
                    <div className="bg-card p-6 rounded-xl border border-border shadow-sm mb-6 flex items-start gap-5">
                        <div className="w-20 h-20 shrink-0 rounded-xl bg-muted" />
                        <div className="flex-1 min-w-0 space-y-3">
                            <div className="flex gap-2">
                                <div className="h-7 bg-muted rounded w-40" />
                                <div className="h-5 bg-muted rounded w-24 self-center" />
                                <div className="h-5 bg-muted rounded w-16 self-center" />
                            </div>
                            <div className="flex gap-4">
                                <div className="h-4 bg-muted rounded w-20" />
                                <div className="h-4 bg-muted rounded w-36" />
                                <div className="h-4 bg-muted rounded w-32" />
                            </div>
                            <div className="h-9 bg-muted rounded w-32" />
                        </div>
                    </div>

                    {/* Metrics + Activity grid skeleton */}
                    <div className="grid lg:grid-cols-2 gap-6 mb-6">
                        {/* Activity Metrics skeleton */}
                        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                            <div className="h-5 bg-muted rounded w-36 mb-5" />
                            <div className="grid grid-cols-2 gap-4">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="bg-muted/30 rounded-lg border border-border p-4 space-y-2">
                                        <div className="h-4 bg-muted rounded w-24" />
                                        <div className="h-8 bg-muted rounded w-12" />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Recent Activity skeleton */}
                        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                            <div className="h-5 bg-muted rounded w-36 mb-5" />
                            {/* Toolbar */}
                            <div className="flex gap-3 mb-4">
                                <div className="h-9 bg-muted rounded flex-1" />
                                <div className="h-9 bg-muted rounded w-28" />
                                <div className="h-9 bg-muted rounded w-9 shrink-0" />
                            </div>
                            {/* Rows */}
                            <div className="space-y-2">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                                        <div className="space-y-1.5 flex-1 min-w-0">
                                            <div className="h-4 bg-muted rounded w-24" />
                                            <div className="h-3 bg-muted rounded w-16" />
                                        </div>
                                        <div className="h-5 bg-muted rounded w-16 ml-3 shrink-0" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Account Config skeleton */}
                    <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                        <div className="h-5 bg-muted rounded w-44 mb-6" />
                        <div className="grid sm:grid-cols-2 gap-6 mb-8">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="space-y-2">
                                    <div className="h-4 bg-muted rounded w-20" />
                                    <div className="h-5 bg-muted rounded w-36" />
                                </div>
                            ))}
                        </div>
                        <div className="pt-6 border-t border-border flex gap-3">
                            <div className="h-9 bg-muted rounded w-36" />
                            <div className="h-9 bg-muted rounded w-28" />
                        </div>
                    </div>
                </div>
            </PortalShell>
        );
    }

    if (!profileData) return null;

    const roleConfig = ROLE_CONFIG[profileData.role] ?? ROLE_CONFIG.citizen;
    const locationDisplay =
        profileData.role === "barangay" || profileData.role === "cleaner"
            ? (profileData.barangay_assignment ?? "")
            : roleConfig.location;

    const navMap: Record<string, PortalNavItem[]> = {
        cenro: CENRO_NAV_PROFILE,
        barangay: BARANGAY_NAV_PROFILE,
        cleaner: CLEANER_NAV_PROFILE,
        citizen: CITIZEN_NAV_PROFILE,
    };
    const portalNav = navMap[profileData.role] ?? CITIZEN_NAV_PROFILE;

    const brandMap: Record<string, { name: string; suffix: string }> = {
        cenro: { name: "EcoWatch", suffix: "CJSDM" },
        barangay: { name: "Barangay Ops", suffix: profileData.barangay_assignment ?? "" },
        cleaner: { name: "EcoWatch", suffix: "Cleaner" },
        citizen: { name: "EcoWatch", suffix: "Citizen" },
    };

    const identityHeader = (
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm mb-6">
            <div className="flex items-start gap-5">
                <div className="w-20 h-20 shrink-0 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-3xl font-bold text-primary">
                    {profileData.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h1 className="text-2xl font-bold text-foreground truncate">{profileData.full_name}</h1>
                        <span className={`px-2 py-0.5 rounded border text-[10px] uppercase tracking-widest font-bold shrink-0 ${roleConfig.badge}`}>
                            {roleConfig.label}
                        </span>
                        <span className={`px-2 py-0.5 rounded border text-[10px] uppercase tracking-widest font-bold shrink-0 ${
                            profileData.is_active 
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                                : "bg-destructive/10 border-destructive/20 text-destructive"
                        }`}>
                            {profileData.is_active ? "Active" : "Inactive"}
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-muted-foreground mb-4">
                        {locationDisplay && (
                            <span className="flex items-center gap-1.5"><MapPin size={16} /> {locationDisplay}</span>
                        )}
                        <span className="flex items-center gap-1.5"><Building2 size={16} /> {roleConfig.department}</span>
                        <span className="flex items-center gap-1.5"><Mail size={16} /> {profileData.email}</span>
                        <span className="flex items-center gap-1.5"><Calendar size={16} /> Member since {formatDate(profileData.created_at)}</span>
                    </div>
                    <button onClick={() => setEditMode(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-secondary border border-border text-secondary-foreground text-sm font-medium rounded-lg hover:bg-secondary/80 transition-colors">
                        <Pencil size={14} /> Edit Profile
                    </button>
                </div>
            </div>
        </div>
    );

    const metricsPanel = (
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                <h2 className="text-base font-bold text-foreground mb-5 flex items-center gap-2">
                    <Activity size={18} className="text-primary" /> Activity Metrics
                </h2>
                {profileData.role === "cenro" && (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            <StatCard label="Total Reports" value={profileData.stats.total_reports ?? 0}
                                sub={`${(profileData.stats.growth_pct ?? 0) > 0 ? "+" : ""}${profileData.stats.growth_pct ?? 0}% this month`}
                                positive={(profileData.stats.growth_pct ?? 0) >= 0} />
                            <StatCard label="Resolution Rate" value={`${profileData.stats.resolution_rate ?? 0}%`} />
                            <StatCard label="Pending Reports" value={profileData.stats.pending_count ?? 0} />
                            <StatCard label="System Overrides" value={profileData.stats.system_overrides ?? 0} />
                        </div>
                        <SlaBar pct={profileData.stats.sla_compliance ?? 0} />
                    </>
                )}
                {profileData.role === "barangay" && (
                    <div className="grid grid-cols-2 gap-4">
                        <StatCard label="Total Reports" value={profileData.stats.total_reports ?? 0} />
                        <StatCard label="Resolved" value={profileData.stats.resolved_count ?? 0} />
                        <StatCard label="Pending" value={profileData.stats.pending_count ?? 0} />
                        <StatCard label="Work Orders" value={profileData.stats.deployed_work_orders ?? 0} />
                    </div>
                )}
                {profileData.role === "cleaner" && (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            <StatCard label="Total Assigned" value={profileData.stats.total_assigned ?? 0} />
                            <StatCard label="In Progress" value={profileData.stats.in_progress ?? 0} />
                            <StatCard label="Completed" value={profileData.stats.completed ?? 0} />
                            <StatCard label="On-Time Rate" value={`${profileData.stats.sla_compliance ?? 0}%`} />
                        </div>
                        <SlaBar pct={profileData.stats.sla_compliance ?? 0} />
                    </>
                )}
                {profileData.role === "citizen" && (
                    <div className="grid grid-cols-2 gap-4">
                        <StatCard label="Submitted" value={profileData.stats.total_submitted ?? 0} />
                        <StatCard label="Pending" value={profileData.stats.pending ?? 0} />
                        <StatCard label="Verified" value={profileData.stats.verified ?? 0} />
                        <StatCard label="Resolved" value={profileData.stats.resolved ?? 0} />
                    </div>
                )}
            </div>
            <div className="bg-card p-6 rounded-xl border border-border shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                        <History size={18} className="text-primary" />
                        {profileData.role === "cenro" ? "Audit History" : "Recent Activity"}
                    </h2>
                </div>

                {/* Audit Toolbar */}
                <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
                    <div className="relative flex-1 w-full">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search activity..."
                            value={auditSearch}
                            onChange={(e) => setAuditSearch(e.target.value)}
                            className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <DateRangePicker
                            value={auditDateRange}
                            onChange={setAuditDateRange}
                            className="bg-background border-border"
                        />
                        <button
                            onClick={() => setAuditSortDesc(!auditSortDesc)}
                            className="p-2 border border-border bg-background rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                            title="Toggle Sort Order"
                        >
                            <ArrowDownUp size={16} />
                        </button>
                    </div>
                </div>

                {/* Audit List */}
                {paginatedHistory.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-12 text-center border border-border border-dashed rounded-lg bg-muted/20">
                        <AlertCircle className="w-8 h-8 text-muted-foreground/30 mb-2" />
                        <span className="text-sm font-medium text-muted-foreground">No matching activity</span>
                    </div>
                ) : (
                    <div className="flex-1 space-y-2">
                        {profileData.role === "cenro"
                            ? paginatedHistory.map((entry: any) => (
                                <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20">
                                    <div className="mt-0.5 shrink-0"><AuditIcon action={entry.action} /></div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-foreground">
                                            {AUDIT_ACTION_DISPLAY[entry.action] ?? entry.action}
                                        </p>
                                        <p className="text-xs font-medium text-muted-foreground mt-0.5">
                                            {entry.target_type} #{entry.target_id} · {formatDate(entry.created_at)}
                                        </p>
                                    </div>
                                </div>
                            ))
                            : paginatedHistory.map((entry: any, idx: number) => {
                                const trackingId = entry.tracking_id ?? entry.report_tracking_id;
                                const content = (
                                    <>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                                                {trackingId ?? `WO-${entry.id}`}
                                            </p>
                                            <p className="text-xs font-medium text-muted-foreground mt-0.5">{formatDate(entry.created_at)}</p>
                                        </div>
                                        <div className="shrink-0 ml-3">
                                            <StatusBadge status={entry.status} />
                                        </div>
                                    </>
                                );
                                const className = `flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20 group ${
                                    trackingId ? "hover:bg-foreground/5 transition-colors cursor-pointer" : ""
                                }`;

                                if (trackingId) {
                                    return (
                                        <Link href={`/track/${trackingId}`} key={idx} className={className}>
                                            {content}
                                        </Link>
                                    );
                                }
                                return (
                                    <div key={idx} className={className}>
                                        {content}
                                    </div>
                                );
                            })}
                    </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 mt-auto border-t border-border">
                        <span className="text-xs font-medium text-muted-foreground">
                            Page {auditPage} of {totalPages}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                                disabled={auditPage === 1}
                                className="p-1.5 rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <div className="flex gap-1 px-1">
                                {Array.from({ length: totalPages }).map((_, i) => {
                                    const p = i + 1;
                                    // Show first, last, current, and adjacent pages
                                    if (p === 1 || p === totalPages || Math.abs(p - auditPage) <= 1) {
                                        return (
                                            <button
                                                key={p}
                                                onClick={() => setAuditPage(p)}
                                                className={`w-7 h-7 rounded-md text-xs font-semibold flex items-center justify-center transition-colors ${
                                                    p === auditPage
                                                        ? "bg-primary text-primary-foreground"
                                                        : "bg-background border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                                                }`}
                                            >
                                                {p}
                                            </button>
                                        );
                                    }
                                    if (p === auditPage - 2 || p === auditPage + 2) {
                                        return <span key={p} className="text-xs text-muted-foreground px-1">...</span>;
                                    }
                                    return null;
                                })}
                            </div>
                            <button
                                onClick={() => setAuditPage(p => Math.min(totalPages, p + 1))}
                                disabled={auditPage === totalPages}
                                className="p-1.5 rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const accountConfig = (
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
            <h2 className="text-base font-bold text-foreground mb-6 flex items-center gap-2">
                <Shield size={18} className="text-primary" /> Account Configuration
            </h2>
            <div className="grid sm:grid-cols-2 gap-6 mb-8">
                <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Full Name</span>
                    {editMode ? (
                        <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
                    ) : (
                        <span className="text-base font-semibold text-foreground">{profileData.full_name}</span>
                    )}
                </div>
                <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Email Address</span>
                    {editMode ? (
                        <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
                    ) : (
                        <span className="text-base font-semibold text-foreground">{profileData.email}</span>
                    )}
                </div>
                <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Role</span>
                    <span className={`px-2.5 py-0.5 rounded border text-xs font-bold w-fit ${roleConfig.badge}`}>
                        {roleConfig.label}
                    </span>
                </div>
                <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Zone / Assignment</span>
                    <span className="text-base font-semibold text-foreground">{locationDisplay || "—"}</span>
                </div>
            </div>
            {editMode && (
                <div className="flex gap-3 mb-8">
                    <button onClick={handleCancelEdit} disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-secondary border border-border text-secondary-foreground text-sm font-medium rounded-lg hover:bg-secondary/80 transition-colors">
                        <X size={16} /> Cancel
                    </button>
                    <button onClick={handleSaveProfile} disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        <Save size={16} /> {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            )}
            <div className="pt-6 border-t border-border">
                <h3 className="text-sm font-medium text-muted-foreground mb-4">Security Actions</h3>
                <div className="flex flex-wrap gap-3">
                    <button onClick={() => setShowPwModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-secondary border border-border text-secondary-foreground text-sm font-medium rounded-lg hover:bg-secondary/80 transition-colors">
                        <KeyRound size={16} className="text-primary" /> Change Password
                    </button>
                    <button onClick={handleSignOut}
                        className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium rounded-lg hover:bg-destructive/20 transition-colors">
                        <LogOut size={16} /> Sign Out
                    </button>
                </div>
            </div>
        </div>
    );

    if (portalNav) {
        const brand = brandMap[profileData.role] ?? { name: "EcoWatch", suffix: "" };
        return (
            <>
                <PortalShell
                    brand={brand}
                    role={profileData.role.toUpperCase()}
                    nav={portalNav}
                    activeKey="profile"
                    onNavChange={handleNavChange}
                >
                    <div className="max-w-4xl mx-auto pb-10">
                        {identityHeader}
                        {metricsPanel}
                        {accountConfig}
                    </div>
                </PortalShell>
                {showPwModal && <ChangePasswordModal onClose={() => setShowPwModal(false)} />}
            </>
        );
    }

    return (
        <>
            <div className="min-h-[calc(100vh-4rem)] px-4 py-12">
                <div className="max-w-4xl mx-auto pb-10">
                    {identityHeader}
                    {metricsPanel}
                    {accountConfig}
                </div>
            </div>
            {showPwModal && <ChangePasswordModal onClose={() => setShowPwModal(false)} />}
        </>
    );
}
