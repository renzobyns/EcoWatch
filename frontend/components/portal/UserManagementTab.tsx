"use client";

import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import { Search, UserPlus, Upload, Download, MoreVertical, ShieldCheck, FileText, AlertCircle, Users, Copy, Key, X, Eye, Edit2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/date-utils";

export interface BarangayUser {
    id: number;
    email: string;
    full_name: string;
    role: string;
    barangay_assignment: string | null;
    phone_number: string | null;
    is_active: boolean;
    created_at: string | null;
    last_login_at: string | null;
}

const BARANGAYS = [
    "Assumption", "Bagong Buhay I", "Bagong Buhay II", "Bagong Buhay III",
    "Citrus", "Ciudad Real", "Dulong Bayan", "Fatima I", "Fatima II", "Fatima III",
    "Minuyan I", "Minuyan II", "Minuyan III", "Minuyan IV", "Minuyan V",
    "San Martin I", "San Martin II", "San Martin III", "San Martin IV",
    "Santa Cruz I", "Santa Cruz II", "Santa Cruz III", "Santa Cruz IV", "Santa Cruz V",
    "Santo Cristo", "Kaypian", "Gaya-gaya", "Graceville",
    "Maharlika", "Muzon", "Poblacion", "Poblacion I", "San Isidro", "San Manuel",
    "San Roque", "Tungkong Mangga", "Graceville",
    "Minuyan Proper", "San Pedro", "San Rafael I", "San Rafael II", "San Rafael III",
    "San Rafael IV", "San Rafael V", "Lawang Pari", "Kaybanban",
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface UserManagementTabProps {
    onBarangayAdminChange?: () => void;
}

export interface UserManagementRef {
    openCreateForBarangay: (barangay: string) => void;
    openEditForBarangay: (admin: BarangayUser | Record<string, unknown>, barangay: string) => void;
}

// Custom hook to debounce search
function useDebounce<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(t);
    }, [value, delayMs]);
    return debounced;
}

export const UserManagementTab = forwardRef<UserManagementRef, UserManagementTabProps>(({ onBarangayAdminChange }, ref) => {
    const [barangayUsers, setBarangayUsers] = useState<BarangayUser[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    
    // Filters & Pagination
    const [userRoleFilter, setUserRoleFilter] = useState("all");
    const [userStatusFilter, setUserStatusFilter] = useState("all");
    const [userSearch, setUserSearch] = useState("");
    const debouncedUserSearch = useDebounce(userSearch, 300);
    const [userPage, setUserPage] = useState(1);
    
    // Actions Menu
    const [userActionsMenu, setUserActionsMenu] = useState<number | null>(null);

    // Modals
    const [showCreateUserModal, setShowCreateUserModal] = useState(false);
    const [createForm, setCreateForm] = useState({ email: "", full_name: "", phone_number: "", barangay_assignment: "", role: "barangay" });
    const [createPending, setCreatePending] = useState(false);
    const [createdCredential, setCreatedCredential] = useState<{ email: string; password: string } | null>(null);

    const [showEditUserModal, setShowEditUserModal] = useState(false);
    const [editTarget, setEditTarget] = useState<BarangayUser | null>(null);
    const [editForm, setEditForm] = useState({ full_name: "", email: "", phone_number: "", barangay_assignment: "" });
    const [editPending, setEditPending] = useState(false);

    const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
    const [resetTarget, setResetTarget] = useState<BarangayUser | null>(null);
    const [resetPending, setResetPending] = useState(false);
    const [resetCredential, setResetCredential] = useState<{ email: string; password: string } | null>(null);

    const [disabling, setDisabling] = useState<Set<number>>(new Set());
    const [reactivating, setReactivating] = useState<Set<number>>(new Set());

    useImperativeHandle(ref, () => ({
        openCreateForBarangay: (barangay: string) => {
            setCreateForm({ email: "", full_name: "", phone_number: "", barangay_assignment: barangay, role: "barangay" });
            setShowCreateUserModal(true);
        },
        openEditForBarangay: (admin: BarangayUser | Record<string, unknown>, barangay: string) => {
            setEditTarget({
                id: admin.id,
                email: admin.email,
                full_name: admin.full_name,
                role: "barangay",
                barangay_assignment: barangay,
                phone_number: admin.phone_number,
                is_active: true,
                created_at: null,
                last_login_at: admin.last_login_at,
            });
            setEditForm({
                full_name: admin.full_name,
                email: admin.email,
                phone_number: admin.phone_number || "",
                barangay_assignment: barangay,
            });
            setShowEditUserModal(true);
        }
    }));

    // Import Flow
    const [showImportModal, setShowImportModal] = useState(false);
    const [importStep, setImportStep] = useState(1);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importResults, setImportResults] = useState<Record<string, unknown>[]>([]);
    const [importSummary, setImportSummary] = useState<{ created: number; failed: number } | null>(null);
    const [importPending, setImportPending] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setUsersLoading(true);
        try {
            const data = await api(`/users`);
            if (Array.isArray(data)) setBarangayUsers(data);
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to load users");
        } finally {
            setUsersLoading(false);
        }
    };

    const handleCreateUser = async () => {
        const needsBarangay = ["barangay", "cleaner"].includes(createForm.role);
        if (needsBarangay && !createForm.barangay_assignment) {
            toast.error("Barangay assignment is required for this role.");
            return;
        }
        setCreatePending(true);
        try {
            const payload: Record<string, unknown> = {
                email: createForm.email.trim(),
                full_name: createForm.full_name.trim(),
                role: createForm.role,
                phone_number: createForm.phone_number.trim() || null,
            };
            if (needsBarangay) payload.barangay_assignment = createForm.barangay_assignment;
            const data = await api(`/users`, { method: "POST", body: JSON.stringify(payload) });
            if (data?.user && data?.temporary_password) {
                setCreatedCredential({ email: data.user.email, password: data.temporary_password });
                setCreateForm({ email: "", full_name: "", phone_number: "", barangay_assignment: "", role: "barangay" });
                toast.success("Account created.");
                fetchUsers();
                if (createForm.role === "barangay" && onBarangayAdminChange) {
                    onBarangayAdminChange();
                }
            }
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to create account");
        } finally {
            setCreatePending(false);
        }
    };

    const handleEditUser = async () => {
        if (!editTarget) return;
        if (!editForm.full_name.trim() || !editForm.email.trim()) {
            toast.error("Name and email are required.");
            return;
        }
        setEditPending(true);
        try {
            const payload: Record<string, unknown> = {
                full_name: editForm.full_name.trim(),
                email: editForm.email.trim(),
                phone_number: editForm.phone_number.trim() || null,
            };
            const needsBarangay = ["barangay", "cleaner"].includes(editTarget.role);
            if (needsBarangay) payload.barangay_assignment = editForm.barangay_assignment || null;
            const updated = await api(`/users/${editTarget.id}`, { method: "PUT", body: JSON.stringify(payload) });
            setBarangayUsers((prev) => prev.map((u) => (u.id === editTarget.id ? { ...u, ...updated } : u)));
            setShowEditUserModal(false);
            toast.success("Account updated.");
            if (editTarget.role === "barangay" && onBarangayAdminChange) {
                onBarangayAdminChange();
            }
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to update account");
        } finally {
            setEditPending(false);
        }
    };

    const handleDisableUser = async (targetId: number, targetEmail: string) => {
        if (!confirm(`Disable ${targetEmail}? They will no longer be able to log in.`)) return;
        setDisabling((s) => new Set(s).add(targetId));
        try {
            await api(`/users/${targetId}/disable`, { method: "PUT" });
            setBarangayUsers((prev) => prev.map((u) => (u.id === targetId ? { ...u, is_active: false } : u)));
            toast.success("Account disabled.");
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to disable account");
        } finally {
            setDisabling((s) => {
                const n = new Set(s);
                n.delete(targetId);
                return n;
            });
        }
    };

    const handleReactivateUser = async (targetId: number, targetEmail: string) => {
        if (!confirm(`Reactivate ${targetEmail}? They will be able to log in again.`)) return;
        setReactivating((s) => new Set(s).add(targetId));
        try {
            await api(`/users/${targetId}/reactivate`, { method: "PUT" });
            setBarangayUsers((prev) => prev.map((u) => (u.id === targetId ? { ...u, is_active: true } : u)));
            toast.success("Account reactivated.");
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to reactivate account");
        } finally {
            setReactivating((s) => { const n = new Set(s); n.delete(targetId); return n; });
        }
    };

    const openEditUser = (u: BarangayUser) => {
        setEditTarget(u);
        setEditForm({ full_name: u.full_name, email: u.email, phone_number: u.phone_number || "", barangay_assignment: u.barangay_assignment || "" });
        setShowEditUserModal(true);
        setUserActionsMenu(null);
    };

    const openResetPassword = (u: BarangayUser) => {
        setResetTarget(u);
        setResetCredential(null);
        setShowResetPasswordModal(true);
        setUserActionsMenu(null);
    };

    const handleResetPassword = async () => {
        if (!resetTarget) return;
        setResetPending(true);
        try {
            const data = await api(`/users/${resetTarget.id}/reset-password`, { method: "POST" });
            setResetCredential({ email: data.email, password: data.temporary_password });
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to reset password");
        } finally {
            setResetPending(false);
        }
    };

    const downloadString = (content: string, filename: string) => {
        const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const downloadImportTemplate = () => {
        const csv = "email,full_name,role,barangay_assignment,phone_number\ncitizen@example.com,Juan dela Cruz,citizen,,09171234567\ncoord@example.com,Maria Santos,barangay,Muzon,\ncleaner@example.com,Pedro Reyes,cleaner,Muzon,";
        downloadString(csv, "ecowatch_import_template.csv");
    };

    const handleExportCSV = async () => {
        try {
            const storedUser = localStorage.getItem("ecowatch_user");
            const userId = storedUser ? JSON.parse(storedUser).id : null;
            const res = await fetch(`${API_URL}/users/export`, {
                headers: { "X-User-Id": String(userId) },
            });
            if (!res.ok) throw new Error("Export failed");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `ecowatch_accounts_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            toast.success("Accounts exported.");
        } catch {
            toast.error("Export failed.");
        }
    };

    const handleImportCSV = async () => {
        if (!importFile) return;
        setImportPending(true);
        try {
            const storedUser = localStorage.getItem("ecowatch_user");
            const userId = storedUser ? JSON.parse(storedUser).id : null;
            const formData = new FormData();
            formData.append("file", importFile);
            const res = await fetch(`${API_URL}/users/import`, {
                method: "POST",
                headers: { "X-User-Id": String(userId) },
                body: formData,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Import failed");
            setImportResults(data.results || []);
            setImportSummary({ created: data.created, failed: data.failed });
            setImportStep(4);
            fetchUsers();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Import failed");
        } finally {
            setImportPending(false);
        }
    };

    const filteredUsers = useMemo(() => {
        let result = barangayUsers;
        if (userRoleFilter !== "all") result = result.filter(u => u.role === userRoleFilter);
        if (userStatusFilter === "active") result = result.filter(u => u.is_active);
        else if (userStatusFilter === "disabled") result = result.filter(u => !u.is_active);
        if (debouncedUserSearch) {
            const q = debouncedUserSearch.toLowerCase();
            result = result.filter(u => 
                u.full_name.toLowerCase().includes(q) || 
                u.email.toLowerCase().includes(q) || 
                (u.barangay_assignment || "").toLowerCase().includes(q)
            );
        }
        return result;
    }, [barangayUsers, userRoleFilter, userStatusFilter, debouncedUserSearch]);

    const userItemsPerPage = 15;
    const userTotalPages = Math.ceil(filteredUsers.length / userItemsPerPage) || 1;
    const displayedUsers = filteredUsers.slice((userPage - 1) * userItemsPerPage, userPage * userItemsPerPage);

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-background rounded-2xl animate-slide-up">
            {/* Header & Tools */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Accounts</h2>
                    <p className="text-sm text-muted-foreground mt-1">Manage platform users, roles, and access controls.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                        <Download size={16} /> Export
                    </button>
                    <button onClick={() => { setShowImportModal(true); setImportStep(1); setImportFile(null); }} className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                        <Upload size={16} /> Import
                    </button>
                    <button onClick={() => { setShowCreateUserModal(true); setCreatedCredential(null); setCreateForm({ email: "", full_name: "", phone_number: "", barangay_assignment: "", role: "barangay" }); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
                        <UserPlus size={16} /> Add User
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <input 
                        type="text" 
                        placeholder="Search name, email, or barangay..." 
                        value={userSearch} 
                        onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }} 
                        className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" 
                    />
                </div>
                <select value={userRoleFilter} onChange={(e) => { setUserRoleFilter(e.target.value); setUserPage(1); }} className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary transition-colors">
                    <option value="all">All Roles</option>
                    <option value="cenro">CENRO Admin</option>
                    <option value="barangay">Barangay Admin</option>
                    <option value="cleaner">Cleanup Worker</option>
                    <option value="citizen">Citizen</option>
                </select>
                <select value={userStatusFilter} onChange={(e) => { setUserStatusFilter(e.target.value); setUserPage(1); }} className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary transition-colors">
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                </select>
                <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">Showing {filteredUsers.length} account{filteredUsers.length !== 1 ? "s" : ""}</span>
            </div>

            {/* Table Area */}
            <div className="flex-1 bg-card rounded-2xl border border-border flex flex-col min-h-0 shadow-sm overflow-hidden">
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border text-xs text-muted-foreground font-medium tracking-tight bg-card sticky top-0 z-10 shadow-sm">
                                <th className="p-4 pl-5 w-10"></th>
                                <th className="p-4">Full Name</th>
                                <th className="p-4">Email Address</th>
                                <th className="p-4">Role</th>
                                <th className="p-4">Barangay</th>
                                <th className="p-4">Phone Number</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Last Login</th>
                                <th className="p-4 w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {usersLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="border-b border-border">
                                        {Array.from({ length: 9 }).map((__, j) => (
                                            <td key={j} className="p-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                                        ))}
                                    </tr>
                                ))
                            ) : displayedUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="p-12 text-center">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                                                <Users size={24} />
                                            </div>
                                            <div className="text-foreground font-medium">No accounts found</div>
                                            <div className="text-xs text-muted-foreground">Try adjusting your search or filters.</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                displayedUsers.map((u) => (
                                    <tr key={u.id} className={`border-b border-border hover:bg-muted/50 transition-colors ${!u.is_active ? 'opacity-50 grayscale' : ''}`}>
                                        <td className="p-4 pl-5">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase">
                                                {u.full_name.charAt(0)}
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm font-medium text-foreground">{u.full_name}</td>
                                        <td className="p-4 text-sm text-foreground">{u.email}</td>
                                        <td className="p-4">
                                            <span className="px-2.5 py-1 rounded-md text-xs font-semibold uppercase bg-muted text-foreground border border-border">
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-foreground">{u.barangay_assignment || "—"}</td>
                                        <td className="p-4 text-sm text-foreground">{u.phone_number || "—"}</td>
                                        <td className="p-4">
                                            {u.is_active ? (
                                                <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Active</span>
                                            ) : (
                                                <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">Disabled</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-xs text-muted-foreground">
                                            {u.last_login_at ? formatDateTime(u.last_login_at) : "Never"}
                                        </td>
                                        <td className="p-4 relative">
                                            <button onClick={() => setUserActionsMenu(userActionsMenu === u.id ? null : u.id)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors">
                                                <MoreVertical size={16} />
                                            </button>
                                            {userActionsMenu === u.id && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => setUserActionsMenu(null)} />
                                                    <div className="absolute right-8 top-4 z-50 w-48 bg-[#f5faf6] dark:bg-[#0f1410] border border-border rounded-xl shadow-lg p-1 animate-in fade-in zoom-in duration-200">
                                                        <button onClick={() => openEditUser(u)} className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted rounded-md transition-colors">Edit Details</button>
                                                        <button onClick={() => openResetPassword(u)} className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted rounded-md transition-colors">Reset Password</button>
                                                        {u.role !== 'cenro' && (
                                                            <>
                                                                <div className="h-px bg-border my-1" />
                                                                {u.is_active ? (
                                                                    <button onClick={() => handleDisableUser(u.id, u.email)} disabled={disabling.has(u.id)} className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors disabled:opacity-50">
                                                                        {disabling.has(u.id) ? "Disabling..." : "Disable Account"}
                                                                    </button>
                                                                ) : (
                                                                    <button onClick={() => handleReactivateUser(u.id, u.email)} disabled={reactivating.has(u.id)} className="w-full text-left px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors disabled:opacity-50">
                                                                        {reactivating.has(u.id) ? "Reactivating..." : "Reactivate Account"}
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="p-4 border-t border-border flex items-center justify-between bg-card shrink-0">
                    <span className="text-xs text-muted-foreground font-medium">Page {userPage} of {userTotalPages}</span>
                    <div className="flex items-center gap-2">
                        <button disabled={userPage === 1} onClick={() => setUserPage(p => p - 1)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted disabled:opacity-50 transition-colors text-foreground">Previous</button>
                        <button disabled={userPage === userTotalPages} onClick={() => setUserPage(p => p + 1)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted disabled:opacity-50 transition-colors text-foreground">Next</button>
                    </div>
                </div>
            </div>

            {/* CREATE MODAL */}
            {showCreateUserModal && (
                <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-lg flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-border">
                            <h2 className="text-xl font-bold text-foreground">Add New User</h2>
                            <p className="text-sm text-muted-foreground mt-1">Create a new platform account.</p>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-4">
                            {createdCredential ? (
                                <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-center">
                                    <ShieldCheck className="mx-auto mb-2 text-emerald-500" size={32} />
                                    <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-1">Account Created Successfully!</div>
                                    <div className="text-xs text-muted-foreground mb-4">Please securely share these credentials with the user. They will be forced to change the password on their first login.</div>
                                    <div className="bg-background rounded-lg p-3 text-left border border-border space-y-2">
                                        <div><span className="text-xs text-muted-foreground">Email:</span><br /><span className="font-mono text-sm font-medium text-foreground">{createdCredential.email}</span></div>
                                        <div><span className="text-xs text-muted-foreground">Temp Password:</span><br /><span className="font-mono text-sm font-medium text-foreground">{createdCredential.password}</span></div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Full Name</label>
                                        <input type="text" value={createForm.full_name} onChange={e => setCreateForm({ ...createForm, full_name: e.target.value })} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary transition-colors" placeholder="e.g. Juan dela Cruz" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Email Address</label>
                                        <input type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary transition-colors" placeholder="juan@example.com" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Phone Number (Optional)</label>
                                        <input type="tel" value={createForm.phone_number} onChange={e => setCreateForm({ ...createForm, phone_number: e.target.value })} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary transition-colors" placeholder="0917..." />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Role</label>
                                        <select value={createForm.role} onChange={e => setCreateForm({ ...createForm, role: e.target.value, barangay_assignment: "" })} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary transition-colors">
                                            <option value="cenro">CENRO Admin (City-wide)</option>
                                            <option value="barangay">Barangay Admin</option>
                                            <option value="cleaner">Cleanup Worker</option>
                                            <option value="citizen">Citizen</option>
                                        </select>
                                    </div>
                                    {["barangay", "cleaner"].includes(createForm.role) && (
                                        <div>
                                            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Assigned Barangay <span className="text-destructive">*</span></label>
                                            <select value={createForm.barangay_assignment} onChange={e => setCreateForm({ ...createForm, barangay_assignment: e.target.value })} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary transition-colors">
                                                <option value="">Select Barangay</option>
                                                {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="p-4 border-t border-border flex justify-end gap-3 bg-muted/20">
                            {createdCredential ? (
                                <button onClick={() => { setShowCreateUserModal(false); setCreatedCredential(null); }} className="px-4 py-2 bg-card border border-border text-foreground text-sm font-medium rounded-lg hover:bg-muted transition-colors">Close</button>
                            ) : (
                                <>
                                    <button onClick={() => setShowCreateUserModal(false)} className="px-4 py-2 bg-transparent text-muted-foreground hover:text-foreground text-sm font-medium rounded-lg transition-colors">Cancel</button>
                                    <button onClick={handleCreateUser} disabled={createPending || !createForm.email || !createForm.full_name} className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50">
                                        {createPending ? "Creating..." : "Create Account"}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT MODAL */}
            {showEditUserModal && (
                <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-lg flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-border">
                            <h2 className="text-xl font-bold text-foreground">Edit Account Details</h2>
                            <p className="text-sm text-muted-foreground mt-1">Updating details for {editTarget?.email}</p>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Full Name</label>
                                <input type="text" value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Email Address</label>
                                <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Phone Number (Optional)</label>
                                <input type="tel" value={editForm.phone_number} onChange={e => setEditForm({ ...editForm, phone_number: e.target.value })} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
                            </div>
                            {editTarget && ["barangay", "cleaner"].includes(editTarget.role) && (
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Assigned Barangay <span className="text-destructive">*</span></label>
                                    <select value={editForm.barangay_assignment} onChange={e => setEditForm({ ...editForm, barangay_assignment: e.target.value })} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary transition-colors">
                                        <option value="">Select Barangay</option>
                                        {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-border flex justify-end gap-3 bg-muted/20">
                            <button onClick={() => setShowEditUserModal(false)} className="px-4 py-2 bg-transparent text-muted-foreground hover:text-foreground text-sm font-medium rounded-lg transition-colors">Cancel</button>
                            <button onClick={handleEditUser} disabled={editPending || !editForm.email || !editForm.full_name} className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50">
                                {editPending ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* RESET PASSWORD MODAL */}
            {showResetPasswordModal && resetTarget && (
                <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-sm rounded-2xl border border-border shadow-lg flex flex-col">
                        <div className="p-6 text-center">
                            {resetCredential ? (
                                <>
                                    <ShieldCheck className="mx-auto mb-4 text-emerald-500" size={40} />
                                    <h2 className="text-lg font-bold text-foreground">Password Reset</h2>
                                    <p className="text-sm text-muted-foreground mt-2 mb-6">New temporary password generated for <strong>{resetTarget.email}</strong>.</p>
                                    <div className="bg-background border border-border p-3 rounded-lg text-left">
                                        <span className="text-xs text-muted-foreground block mb-1">Temporary Password:</span>
                                        <span className="font-mono font-medium text-foreground text-sm">{resetCredential.password}</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="mx-auto mb-4 text-amber-500" size={40} />
                                    <h2 className="text-lg font-bold text-foreground">Reset Password</h2>
                                    <p className="text-sm text-muted-foreground mt-2 mb-6">Are you sure you want to reset the password for <strong>{resetTarget.email}</strong>? They will be given a temporary password.</p>
                                </>
                            )}
                        </div>
                        <div className="p-4 border-t border-border flex justify-end gap-3 bg-muted/20 rounded-b-2xl">
                            {resetCredential ? (
                                <button onClick={() => setShowResetPasswordModal(false)} className="w-full py-2 bg-card border border-border text-foreground text-sm font-medium rounded-lg hover:bg-muted transition-colors">Close</button>
                            ) : (
                                <>
                                    <button onClick={() => setShowResetPasswordModal(false)} className="px-4 py-2 bg-transparent text-muted-foreground hover:text-foreground text-sm font-medium rounded-lg transition-colors">Cancel</button>
                                    <button onClick={handleResetPassword} disabled={resetPending} className="px-4 py-2 bg-destructive text-destructive-foreground text-sm font-medium rounded-lg hover:bg-destructive/90 transition-colors shadow-sm disabled:opacity-50">
                                        {resetPending ? "Resetting..." : "Reset Password"}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* IMPORT MODAL */}
            {showImportModal && (
                <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-xl rounded-2xl border border-border shadow-lg flex flex-col">
                        <div className="p-6 border-b border-border">
                            <h2 className="text-xl font-bold text-foreground">Bulk Import Accounts</h2>
                            <p className="text-sm text-muted-foreground mt-1">Upload a CSV file to create multiple accounts at once.</p>
                        </div>
                        <div className="p-6">
                            {importStep === 1 && (
                                <div className="space-y-6">
                                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-foreground/80">
                                        <p className="font-semibold text-foreground mb-2">Instructions:</p>
                                        <ol className="list-decimal pl-5 space-y-1">
                                            <li>Download the template CSV below.</li>
                                            <li>Fill it with user data. <strong>role</strong> must be one of: <code>cenro</code>, <code>barangay</code>, <code>cleaner</code>, <code>citizen</code>.</li>
                                            <li>If role requires a barangay, ensure it matches official spellings exactly.</li>
                                            <li>Upload the filled CSV here. Temp passwords will be generated automatically.</li>
                                        </ol>
                                        <button onClick={downloadImportTemplate} className="mt-4 flex items-center gap-2 text-primary hover:underline font-medium">
                                            <Download size={14} /> Download Template
                                        </button>
                                    </div>
                                    <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center bg-background text-center transition-colors hover:border-primary/50 relative">
                                        <Upload size={32} className="text-muted-foreground mb-3" />
                                        <div className="font-medium text-foreground">Click to browse or drag file here</div>
                                        <div className="text-xs text-muted-foreground mt-1">Supports .csv (Max 100 rows)</div>
                                        <input
                                            type="file"
                                            accept=".csv"
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            onChange={(e) => {
                                                const f = e.target.files?.[0];
                                                if (f) { setImportFile(f); setImportStep(2); }
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {importStep === 2 && importFile && (
                                <div className="text-center py-8">
                                    <FileText size={48} className="mx-auto text-primary mb-4 opacity-50" />
                                    <h3 className="font-medium text-lg text-foreground mb-1">File Selected</h3>
                                    <p className="text-sm text-muted-foreground">{importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)</p>
                                    <div className="mt-6 flex justify-center gap-3">
                                        <button onClick={() => setImportStep(1)} className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted text-foreground transition-colors">Change File</button>
                                        <button onClick={handleImportCSV} disabled={importPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2">
                                            {importPending && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                            {importPending ? "Processing..." : "Start Import"}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {importStep === 4 && importSummary && (
                                <div className="space-y-4">
                                    <div className="flex gap-4 mb-6">
                                        <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-center">
                                            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{importSummary.created}</div>
                                            <div className="text-xs font-semibold text-emerald-600/70 uppercase">Created</div>
                                        </div>
                                        <div className="flex-1 bg-destructive/10 border border-destructive/20 p-4 rounded-xl text-center">
                                            <div className="text-2xl font-bold text-destructive">{importSummary.failed}</div>
                                            <div className="text-xs font-semibold text-destructive/70 uppercase">Failed</div>
                                        </div>
                                    </div>
                                    <div className="text-sm font-semibold text-foreground mb-2">Import Results Log:</div>
                                    <div className="bg-background border border-border rounded-lg max-h-48 overflow-y-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-card sticky top-0 border-b border-border">
                                                <tr>
                                                    <th className="px-3 py-2 font-medium text-muted-foreground">Email</th>
                                                    <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
                                                    <th className="px-3 py-2 font-medium text-muted-foreground">Details</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {importResults.map((r, i) => (
                                                    <tr key={i}>
                                                        <td className="px-3 py-2 font-mono text-xs">{r.email}</td>
                                                        <td className="px-3 py-2">
                                                            {r.status === "success" ? (
                                                                <span className="text-xs font-semibold text-emerald-500">Success</span>
                                                            ) : (
                                                                <span className="text-xs font-semibold text-destructive">Failed</span>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 text-xs text-muted-foreground">
                                                            {r.status === "success" ? (
                                                                <span className="font-mono text-foreground font-medium">Temp PW: {r.temporary_password}</span>
                                                            ) : (
                                                                r.error || "Unknown error"
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {importSummary.created > 0 && (
                                        <div className="text-xs text-amber-500 font-semibold bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-center mt-4">
                                            IMPORTANT: Please copy the temporary passwords now. They will not be shown again.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-border flex justify-end bg-muted/20 rounded-b-2xl">
                            {(importStep === 1 || importStep === 4) && (
                                <button onClick={() => setShowImportModal(false)} className="px-4 py-2 bg-card border border-border rounded-lg text-sm font-medium hover:bg-muted text-foreground transition-colors">
                                    {importStep === 4 ? "Done" : "Cancel"}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

UserManagementTab.displayName = "UserManagementTab";
