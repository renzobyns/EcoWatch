"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    UserCircle, Mail, Calendar, MapPin, Building2, Shield, LogOut,
    Pencil, Save, X, KeyRound, Activity, CheckCircle, Truck,
    GitBranch, ShieldX, Settings, UserPlus, ClipboardList,
    LayoutDashboard, FileText, Map, ShieldCheck, BarChart3,
    Image as ImageIcon, History, BookUser, Briefcase, Users, AlertCircle,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { PortalShell, type PortalNavItem } from "@/components/portal/PortalShell";

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
        badge: "bg-yellow-500/20 text-yellow-300",
        department: "City Environment and Natural Resources Office",
        location: "City-wide (CENRO HQ)",
    },
    barangay: {
        label: "Barangay Coordinator",
        badge: "bg-blue-500/20 text-blue-300",
        department: "Barangay Environmental Unit",
        location: "",
    },
    cleaner: {
        label: "Cleanup Team Member",
        badge: "bg-purple-500/20 text-purple-300",
        department: "Barangay Cleanup Division",
        location: "",
    },
    citizen: {
        label: "Citizen Reporter",
        badge: "bg-primary/20 text-primary",
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
    { key: "cleaners", label: "Cleaners", icon: Users },
    { key: "accounts", label: "Accounts", icon: BookUser },
    { key: "profile", label: "Profile View", icon: UserCircle, sectionBreakBefore: true },
];

const CLEANER_NAV_PROFILE: PortalNavItem[] = [
    { key: "jobs", label: "Jobs", icon: Briefcase },
    { key: "profile", label: "Profile View", icon: UserCircle, sectionBreakBefore: true },
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
    pending: "bg-yellow-500/20 text-yellow-300",
    verified: "bg-blue-500/20 text-blue-300",
    resolved: "bg-green-500/20 text-green-400",
    rejected: "bg-red-500/20 text-red-400",
    deployed: "bg-purple-500/20 text-purple-300",
    assigned: "bg-foreground/10 text-foreground/60",
    in_progress: "bg-yellow-500/20 text-yellow-300",
    completed: "bg-green-500/20 text-green-400",
    needs_redo: "bg-red-500/20 text-red-400",
};

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function StatusBadge({ status }: { status: string }) {
    const cls = STATUS_BADGE[status] ?? "bg-foreground/10 text-foreground/60";
    return (
        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase ${cls}`}>
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
        <div className="bg-foreground/5 rounded-xl p-4 flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest text-foreground/40 font-semibold">
                {label}
            </span>
            <span className="text-2xl font-bold text-foreground">{value}</span>
            {sub && (
                <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md w-fit ${
                    positive === true ? "bg-green-500/20 text-green-400"
                    : positive === false ? "bg-red-500/20 text-red-400"
                    : "text-foreground/40"
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
            <div className="flex justify-between text-[11px] font-semibold mb-1">
                <span className="text-foreground/50 uppercase tracking-widest">SLA Compliance</span>
                <span className="text-primary">{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-foreground/10 overflow-hidden">
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
    if (action === "reassign") return <GitBranch className={`${cls} text-blue-400`} />;
    if (action === "force_close") return <ShieldX className={`${cls} text-red-400`} />;
    if (action === "update_sla_config") return <Settings className={`${cls} text-yellow-400`} />;
    if (action === "create_user") return <UserPlus className={`${cls} text-green-400`} />;
    if (action === "deploy") return <Truck className={`${cls} text-green-400`} />;
    if (action === "resolve") return <CheckCircle className={`${cls} text-green-400`} />;
    return <Activity className={`${cls} text-foreground/40`} />;
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
    const [currentPw, setCurrentPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [confirmPw, setConfirmPw] = useState("");
    const [saving, setSaving] = useState(false);

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="glass p-6 max-w-sm w-full rounded-2xl border border-border shadow-2xl">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-primary" /> Change Password
                    </h3>
                    <button onClick={onClose} className="text-foreground/40 hover:text-foreground transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="space-y-3 mb-5">
                    {(
                        [
                            { label: "Current Password", val: currentPw, set: setCurrentPw },
                            { label: "New Password", val: newPw, set: setNewPw },
                            { label: "Confirm New Password", val: confirmPw, set: setConfirmPw },
                        ] as { label: string; val: string; set: (v: string) => void }[]
                    ).map(({ label, val, set }) => (
                        <div key={label}>
                            <label className="block text-[11px] uppercase tracking-widest text-foreground/40 font-semibold mb-1">
                                {label}
                            </label>
                            <input
                                type="password"
                                value={val}
                                onChange={(e) => set(e.target.value)}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                                placeholder="••••••••"
                            />
                        </div>
                    ))}
                </div>
                <div className="flex gap-3">
                    <button onClick={onClose} disabled={saving}
                        className="flex-1 px-4 py-2 glass border border-border text-foreground text-sm font-bold rounded-lg hover:bg-foreground/10 transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSubmit} disabled={saving}
                        className="flex-1 px-4 py-2 eco-gradient text-white text-sm font-bold rounded-lg shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
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
    const [editMode, setEditMode] = useState(false);
    const [editName, setEditName] = useState("");
    const [editEmail, setEditEmail] = useState("");
    const [saving, setSaving] = useState(false);
    const [showPwModal, setShowPwModal] = useState(false);

    useEffect(() => {
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

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white p-1 shadow-[0_0_30px_rgba(16,185,129,0.3)] animate-pulse">
                    <img src="/logo.png" alt="Loading..." className="w-full h-full object-contain" />
                </div>
                <div className="text-emerald-500 font-bold tracking-widest uppercase text-sm animate-pulse">
                    Loading Profile...
                </div>
            </div>
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
    };
    const portalNav = navMap[profileData.role];

    const brandMap: Record<string, { name: string; suffix: string }> = {
        cenro: { name: "EcoWatch", suffix: "CJSDM" },
        barangay: { name: "Barangay Ops", suffix: profileData.barangay_assignment ?? "" },
        cleaner: { name: "EcoWatch", suffix: "Cleaner" },
    };

    const identityHeader = (
        <div className="glass-pro p-6 rounded-2xl border border-border shadow-2xl mb-6">
            <div className="flex items-start gap-5">
                <div className="w-20 h-20 shrink-0 rounded-2xl eco-gradient flex items-center justify-center text-3xl font-bold text-white shadow-lg shadow-primary/30">
                    {profileData.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h1 className="text-xl font-bold text-foreground truncate">{profileData.full_name}</h1>
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${roleConfig.badge}`}>
                            {roleConfig.label}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                            profileData.is_active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                        }`}>
                            {profileData.is_active ? "Active" : "Inactive"}
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground/50 mb-3">
                        {locationDisplay && (
                            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {locationDisplay}</span>
                        )}
                        <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {roleConfig.department}</span>
                        <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {profileData.email}</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Member since {formatDate(profileData.created_at)}</span>
                    </div>
                    <button onClick={() => setEditMode(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 glass border border-border text-foreground/70 text-xs font-semibold rounded-lg hover:bg-foreground/10 hover:text-foreground transition-colors">
                        <Pencil className="w-3 h-3" /> Edit Profile
                    </button>
                </div>
            </div>
        </div>
    );

    const metricsPanel = (
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <div className="glass-pro p-6 rounded-2xl border border-border shadow-2xl">
                <h2 className="text-sm font-bold text-foreground/70 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" /> Activity Metrics
                </h2>
                {profileData.role === "cenro" && (
                    <>
                        <div className="grid grid-cols-2 gap-3">
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
                    <div className="grid grid-cols-2 gap-3">
                        <StatCard label="Total Reports" value={profileData.stats.total_reports ?? 0} />
                        <StatCard label="Resolved" value={profileData.stats.resolved_count ?? 0} />
                        <StatCard label="Pending" value={profileData.stats.pending_count ?? 0} />
                        <StatCard label="Work Orders" value={profileData.stats.deployed_work_orders ?? 0} />
                    </div>
                )}
                {profileData.role === "cleaner" && (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <StatCard label="Total Assigned" value={profileData.stats.total_assigned ?? 0} />
                            <StatCard label="In Progress" value={profileData.stats.in_progress ?? 0} />
                            <StatCard label="Completed" value={profileData.stats.completed ?? 0} />
                            <StatCard label="On-Time Rate" value={`${profileData.stats.sla_compliance ?? 0}%`} />
                        </div>
                        <SlaBar pct={profileData.stats.sla_compliance ?? 0} />
                    </>
                )}
                {profileData.role === "citizen" && (
                    <div className="grid grid-cols-2 gap-3">
                        <StatCard label="Submitted" value={profileData.stats.total_submitted ?? 0} />
                        <StatCard label="Pending" value={profileData.stats.pending ?? 0} />
                        <StatCard label="Verified" value={profileData.stats.verified ?? 0} />
                        <StatCard label="Resolved" value={profileData.stats.resolved ?? 0} />
                    </div>
                )}
            </div>
            <div className="glass-pro p-6 rounded-2xl border border-border shadow-2xl">
                <h2 className="text-sm font-bold text-foreground/70 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" />
                    {profileData.role === "cenro" ? "Audit History" : "Recent Activity"}
                </h2>
                {profileData.recent_activity.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-foreground/30">
                        <AlertCircle className="w-8 h-8 mb-2" />
                        <span className="text-sm font-medium">No activity yet</span>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {profileData.role === "cenro"
                            ? profileData.recent_activity.map((entry: any) => (
                                <div key={entry.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-foreground/5">
                                    <div className="mt-0.5 shrink-0"><AuditIcon action={entry.action} /></div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-foreground">
                                            {AUDIT_ACTION_DISPLAY[entry.action] ?? entry.action}
                                        </p>
                                        <p className="text-[11px] text-foreground/40 mt-0.5">
                                            {entry.target_type} #{entry.target_id} · {formatDate(entry.created_at)}
                                        </p>
                                    </div>
                                </div>
                            ))
                            : profileData.recent_activity.map((entry: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-foreground/5">
                                    <div>
                                        <p className="text-xs font-mono font-bold text-foreground">
                                            {entry.tracking_id ?? entry.report_tracking_id ?? `WO-${entry.id}`}
                                        </p>
                                        <p className="text-[11px] text-foreground/40 mt-0.5">{formatDate(entry.created_at)}</p>
                                    </div>
                                    <StatusBadge status={entry.status} />
                                </div>
                            ))}
                    </div>
                )}
            </div>
        </div>
    );

    const accountConfig = (
        <div className="glass-pro p-6 rounded-2xl border border-border shadow-2xl">
            <h2 className="text-sm font-bold text-foreground/70 uppercase tracking-widest mb-5 flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" /> Account Configuration
            </h2>
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
                <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase tracking-widest text-foreground/40 font-semibold">Full Name</span>
                    {editMode ? (
                        <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                            className="w-full bg-background border border-primary/40 rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
                    ) : (
                        <span className="text-sm font-semibold text-foreground">{profileData.full_name}</span>
                    )}
                </div>
                <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase tracking-widest text-foreground/40 font-semibold">Email Address</span>
                    {editMode ? (
                        <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                            className="w-full bg-background border border-primary/40 rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
                    ) : (
                        <span className="text-sm font-semibold text-foreground">{profileData.email}</span>
                    )}
                </div>
                <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase tracking-widest text-foreground/40 font-semibold">Role</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold w-fit ${roleConfig.badge}`}>
                        {roleConfig.label}
                    </span>
                </div>
                <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase tracking-widest text-foreground/40 font-semibold">Zone / Assignment</span>
                    <span className="text-sm font-semibold text-foreground">{locationDisplay || "—"}</span>
                </div>
            </div>
            {editMode && (
                <div className="flex gap-3 mb-6">
                    <button onClick={handleCancelEdit} disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 glass border border-border text-foreground text-sm font-bold rounded-lg hover:bg-foreground/10 transition-colors">
                        <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                    <button onClick={handleSaveProfile} disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 eco-gradient text-white text-sm font-bold rounded-lg shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
                        <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            )}
            <div className="pt-5 border-t border-border">
                <h3 className="text-[11px] uppercase tracking-widest text-foreground/40 font-semibold mb-3">Security</h3>
                <div className="flex flex-wrap gap-3">
                    <button onClick={() => setShowPwModal(true)}
                        className="flex items-center gap-2 px-4 py-2 glass border border-border text-foreground text-sm font-bold rounded-lg hover:bg-foreground/10 transition-colors">
                        <KeyRound className="w-3.5 h-3.5 text-primary" /> Change Password
                    </button>
                    <button onClick={handleSignOut}
                        className="flex items-center gap-2 px-4 py-2 glass border border-red-500/20 text-red-400 text-sm font-bold rounded-lg hover:bg-red-500/10 transition-colors">
                        <LogOut className="w-3.5 h-3.5" /> Sign Out
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
                    <div className="max-w-4xl mx-auto">
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
                <div className="max-w-4xl mx-auto">
                    {identityHeader}
                    {metricsPanel}
                    {accountConfig}
                </div>
            </div>
            {showPwModal && <ChangePasswordModal onClose={() => setShowPwModal(false)} />}
        </>
    );
}
