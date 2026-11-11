"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, ImageIcon, FileDown, Activity, Image as ImageIconSolid, CheckSquare, ListChecks, Camera, Sparkles, CheckCircle2, Clock } from "lucide-react";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { DateRange } from "react-day-picker";
import { TrustBadge } from "@/components/TrustBadge";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { ConfidenceTooltipBody } from "@/components/ConfidenceTooltipBody";
import { formatDate } from "@/lib/date-utils";
import { QueueReport } from "@/components/portal/ReportDetailDrawer";
import { toast } from "sonner";
import { KpiCard } from "@/components/portal/KpiCard";
import { formatBytes } from "@/lib/format-utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/backend";

interface EvidenceGalleryTabProps {
    reports: QueueReport[];
    barangays: readonly string[];
    onReportClick: (report: QueueReport) => void;
    loading?: boolean;
}

const STATUS_OPTIONS = [
    { value: "all", label: "All Statuses" },
    { value: "pending", label: "Pending" },
    { value: "verified", label: "Verified" },
    { value: "assigned", label: "Assigned" },
    { value: "in_progress", label: "In Progress" },
    { value: "resolved", label: "Resolved" },
    { value: "failed_cleanup", label: "Failed Cleanup" },
    { value: "rejected", label: "Rejected" },
];

export function EvidenceGalleryTab({ reports, barangays, onReportClick, loading = false }: EvidenceGalleryTabProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedBarangay, setSelectedBarangay] = useState("all");
    const [selectedStatus, setSelectedStatus] = useState("all");
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
    const [page, setPage] = useState(1);
    const [exporting, setExporting] = useState(false);

    const pageSize = 12;

    const galleryReports = useMemo(() => reports.filter(r => r.image_url), [reports]);

    const filteredAndSortedReports = useMemo(() => {
        let result = galleryReports;

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(r => r.tracking_id?.toLowerCase().includes(q));
        }

        if (selectedBarangay !== "all") {
            result = result.filter(r => r.barangay === selectedBarangay);
        }

        if (selectedStatus !== "all") {
            result = result.filter(r => r.status === selectedStatus);
        }

        if (dateRange?.from) {
            const start = new Date(dateRange.from);
            start.setHours(0, 0, 0, 0);
            result = result.filter(r => {
                const reportDate = new Date(r.created_at.endsWith("Z") ? r.created_at : r.created_at + "Z");
                if (reportDate < start) return false;
                if (dateRange.to) {
                    const end = new Date(dateRange.to);
                    end.setHours(23, 59, 59, 999);
                    if (reportDate > end) return false;
                }
                return true;
            });
        }

        result.sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
        });

        return result;
    }, [galleryReports, searchQuery, selectedBarangay, selectedStatus, dateRange, sortOrder]);

    useEffect(() => setPage(1), [searchQuery, selectedBarangay, selectedStatus, dateRange, sortOrder]);

    const totalPages = Math.max(1, Math.ceil(filteredAndSortedReports.length / pageSize));
    const paginated = filteredAndSortedReports.slice((page - 1) * pageSize, page * pageSize);

    const handleExport = () => {
        setExporting(true);
        try {
            const csvRows = [
                ["Tracking ID", "Barangay", "Status", "Reported Date", "AI Confidence", "Original Image", "AI Mask", "Cleanup Proof"]
            ];
            filteredAndSortedReports.forEach(r => {
                csvRows.push([
                    r.tracking_id || "",
                    r.barangay || "Unassigned",
                    r.status,
                    r.created_at,
                    r.ai_confidence ? (r.ai_confidence * 100).toFixed(0) + "%" : "N/A",
                    r.image_url ? `${API_URL}${r.image_url}` : "None",
                    r.ai_mask_url ? `${API_URL}${r.ai_mask_url}` : "None",
                    r.cleanup_image_url ? `${API_URL}${r.cleanup_image_url}` : "None",
                ]);
            });
            const csvContent = csvRows.map(row => row.join(",")).join("\n");
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `evidence_gallery_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Gallery data exported.");
        } catch {
            toast.error("Export failed.");
        } finally {
            setExporting(false);
        }
    };

    // KPIs
    const totalImages = filteredAndSortedReports.length;
    const verifiedMasks = filteredAndSortedReports.filter(r => r.ai_mask_url).length;
    const highConfidence = filteredAndSortedReports.filter(r => (r.ai_confidence || 0) > 0.8).length;
    const cleanupsDocumented = filteredAndSortedReports.filter(r => r.cleanup_image_url).length;

    return (
        <div className="flex flex-col gap-6 pb-8 w-full shrink-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Evidence Gallery</h1>
                    <p className="text-sm text-foreground/50 mt-1">Review photo evidence, AI segmentations, and cleanup proofs.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleExport}
                        disabled={exporting || filteredAndSortedReports.length === 0}
                        className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                    >
                        <FileDown size={14} />
                        {exporting ? "Exporting…" : "Export CSV"}
                    </button>
                </div>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0 animate-slide-up">
                <KpiCard
                    label="Total Images (Filtered)"
                    value={totalImages}
                    icon={<ImageIconSolid size={22} />}
                    tone="blue"
                    loading={loading}
                />
                <KpiCard
                    label="AI Detected Masks"
                    value={verifiedMasks}
                    icon={<Activity size={22} />}
                    tone="emerald"
                    loading={loading}
                />
                <KpiCard
                    label="High Confidence (>80%)"
                    value={highConfidence}
                    icon={<ListChecks size={22} />}
                    tone="emerald"
                    loading={loading}
                />
                <KpiCard
                    label="Cleanups Documented"
                    value={cleanupsDocumented}
                    icon={<CheckSquare size={22} />}
                    tone={cleanupsDocumented > 0 ? "blue" : "neutral"}
                    loading={loading}
                />
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0">
                <div className="relative w-full sm:w-auto sm:flex-1 sm:min-w-[200px] sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" size={14} />
                    <input
                        type="text"
                        placeholder="Search by Tracking ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                </div>

                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                    <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs sm:text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    >
                        {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>

                    <select
                        value={selectedBarangay}
                        onChange={(e) => setSelectedBarangay(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs sm:text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    >
                        <option value="all">All Barangays</option>
                        {barangays.map((b) => (
                            <option key={b} value={b}>{b}</option>
                        ))}
                    </select>
                </div>

                <div className="w-full sm:w-auto flex items-center gap-2">
                    <div className="flex-1 sm:flex-none">
                        <DateRangePicker 
                            date={dateRange} 
                            onDateChange={setDateRange} 
                        />
                    </div>
                    <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
                        className="px-3 py-2 bg-background border border-border rounded-lg text-xs sm:text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                    </select>
                </div>
            </div>

            {/* Gallery Grid */}
            <div className="flex-1 animate-slide-up">
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-pulse">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="bg-card rounded-xl border border-border overflow-hidden h-72 flex flex-col justify-between p-4">
                                <div className="space-y-2">
                                    <div className="h-4 bg-muted rounded w-1/3" />
                                    <div className="h-3 bg-muted rounded w-1/2" />
                                </div>
                                <div className="flex-1 bg-muted/60 rounded my-3" />
                                <div className="h-4 bg-muted rounded w-2/3" />
                            </div>
                        ))}
                    </div>
                ) : paginated.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-muted-foreground py-24 bg-card rounded-xl border border-border border-dashed shadow-sm">
                        <ImageIcon size={48} className="mb-4 opacity-20" />
                        <p className="text-sm font-medium">No images match your filters.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                        {paginated.map((report) => (
                            <EvidenceCard 
                                key={report.id} 
                                report={report} 
                                onReportClick={onReportClick} 
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between bg-card p-4 rounded-xl border border-border shadow-sm shrink-0 mt-auto">
                    <span className="text-xs text-muted-foreground font-medium">
                        Page {page} of {totalPages} ({filteredAndSortedReports.length} total images)
                    </span>
                    <div className="flex items-center gap-2">
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted disabled:opacity-50 transition-colors text-foreground">Previous</button>
                        <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted disabled:opacity-50 transition-colors text-foreground">Next</button>
                    </div>
                </div>
            )}
        </div>
    );
}


interface EvidenceCardProps {
    report: QueueReport;
    onReportClick: (report: QueueReport) => void;
}

function EvidenceCard({ report, onReportClick }: EvidenceCardProps) {
    const [mobilePhoto, setMobilePhoto] = useState<"original" | "ai_mask" | "cleanup">(
        report.ai_mask_url ? "ai_mask" : "original"
    );

    return (
        <div 
            onClick={() => onReportClick(report)}
            className="bg-card rounded-xl border border-border overflow-hidden hover:border-primary/50 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col"
        >
            {/* Card Header */}
            <div className="p-3.5 sm:p-4 border-b border-border flex items-center justify-between shrink-0">
                <div className="min-w-0">
                    <div className="font-mono text-xs font-bold text-foreground mb-0.5 truncate">{report.tracking_id}</div>
                    <div className="text-xs text-muted-foreground truncate">{report.barangay || 'Unassigned'}</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ml-2 uppercase tracking-wider ${
                    report.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                    report.status === 'assigned' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20' :
                    report.status === 'in_progress' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' :
                    report.status === 'verified' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20' :
                    report.status === 'pending' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                    report.status === 'failed_cleanup' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                    report.status === 'rejected' ? 'bg-muted text-muted-foreground border border-border' :
                    'bg-muted text-foreground border border-border'
                }`}>
                    {report.status.replace(/_/g, " ")}
                </span>
            </div>

            {/* Mobile View (< md): High-Res Photo with Segmented Pill Switcher */}
            <div className="md:hidden flex flex-col p-2.5 gap-2 bg-muted/20">
                {/* Segmented Switcher */}
                <div className="flex items-center p-1 bg-muted/70 border border-border/60 rounded-xl gap-1 text-[11px] font-semibold">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setMobilePhoto("original"); }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all ${
                            mobilePhoto === "original"
                                ? "bg-background text-foreground shadow-sm ring-1 ring-border font-bold"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <Camera size={13} />
                        <span>Original</span>
                    </button>
                    <button
                        type="button"
                        disabled={!report.ai_mask_url}
                        onClick={(e) => { e.stopPropagation(); setMobilePhoto("ai_mask"); }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all ${
                            mobilePhoto === "ai_mask"
                                ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-500/30 font-bold"
                                : report.ai_mask_url
                                ? "text-muted-foreground hover:text-foreground"
                                : "opacity-40 cursor-not-allowed"
                        }`}
                    >
                        <Sparkles size={13} />
                        <span>AI Mask</span>
                        {report.ai_confidence ? (
                            <span className="text-[9px] font-mono px-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                {(report.ai_confidence * 100).toFixed(0)}%
                            </span>
                        ) : null}
                    </button>
                    <button
                        type="button"
                        disabled={!report.cleanup_image_url}
                        onClick={(e) => { e.stopPropagation(); setMobilePhoto("cleanup"); }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all ${
                            mobilePhoto === "cleanup"
                                ? "bg-background text-primary shadow-sm ring-1 ring-primary/30 font-bold"
                                : report.cleanup_image_url
                                ? "text-muted-foreground hover:text-foreground"
                                : "opacity-40 cursor-not-allowed"
                        }`}
                    >
                        <CheckCircle2 size={13} />
                        <span>Proof</span>
                    </button>
                </div>

                {/* Single High-Res 4:3 Image Preview */}
                <div className="w-full aspect-[4/3] bg-muted/60 rounded-xl relative overflow-hidden group border border-border/40">
                    {mobilePhoto === "original" && (
                        report.image_url ? (
                            <img 
                                src={`${API_URL}${report.image_url}`} 
                                alt="Original Citizen Submission" 
                                className="w-full h-full object-cover" 
                                loading="lazy" 
                                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">No original photo</div>
                        )
                    )}
                    {mobilePhoto === "ai_mask" && (
                        report.ai_mask_url ? (
                            <img 
                                src={`${API_URL}${report.ai_mask_url}`} 
                                alt="AI Detection Mask" 
                                className="w-full h-full object-cover" 
                                loading="lazy" 
                                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-xs text-muted-foreground p-4 text-center">
                                <Sparkles size={24} className="mb-2 opacity-40 text-muted-foreground" />
                                <span>No AI detection mask generated</span>
                            </div>
                        )
                    )}
                    {mobilePhoto === "cleanup" && (
                        report.cleanup_image_url ? (
                            <img 
                                src={`${API_URL}${report.cleanup_image_url}`} 
                                alt="Cleanup Resolution Proof" 
                                className="w-full h-full object-cover" 
                                loading="lazy" 
                                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-xs text-muted-foreground p-4 text-center">
                                <Clock size={24} className="mb-2 opacity-40 text-muted-foreground" />
                                <span className="font-semibold text-foreground/80">Pending Cleanup Proof</span>
                                <span className="text-[10px] text-muted-foreground mt-0.5">Crew has not uploaded resolution photo yet</span>
                            </div>
                        )
                    )}
                    <div className="hidden absolute inset-0 flex items-center justify-center text-xs text-foreground/40 uppercase tracking-widest text-center px-1">Img NA</div>
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                        <span className="px-2 py-0.5 rounded-md bg-background/90 backdrop-blur-md text-[10px] font-semibold text-foreground border border-border/60 shadow-sm capitalize">
                            {mobilePhoto === "ai_mask" ? "AI Detection (Mask R-CNN)" : mobilePhoto === "cleanup" ? "Resolution Photo" : "Citizen Submission"}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-background/90 backdrop-blur-md text-[9px] font-mono text-muted-foreground border border-border/60">
                            {mobilePhoto === "ai_mask" ? formatBytes(report.ai_mask_size_bytes) : mobilePhoto === "cleanup" ? formatBytes(report.cleanup_size_bytes) : formatBytes(report.image_size_bytes)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Desktop View (>= md): 3-Column Comparison Row */}
            <div className="hidden md:grid grid-cols-3 gap-0.5 p-0.5 bg-muted/50 shrink-0">
                {/* Original */}
                <div className="aspect-square bg-muted relative overflow-hidden group">
                    {report.image_url ? (
                        <>
                            <img 
                                src={`${API_URL}${report.image_url}`} 
                                alt="Original" 
                                className="w-full h-full object-cover" 
                                loading="lazy" 
                                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }}
                            />
                            <div className="hidden absolute inset-0 flex items-center justify-center text-[10px] text-foreground/40 uppercase tracking-widest text-center px-1">Img NA</div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-[10px] text-muted-foreground">No original</div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-background/80 text-[9px] font-medium p-1 text-center backdrop-blur-sm">
                        Original <span className="text-muted-foreground/80 font-normal">({formatBytes(report.image_size_bytes)})</span>
                    </div>
                </div>

                {/* AI Mask */}
                <div className="aspect-square bg-muted relative overflow-hidden group">
                    {report.ai_mask_url ? (
                        <>
                            <img 
                                src={`${API_URL}${report.ai_mask_url}`} 
                                alt="AI Detection" 
                                className="w-full h-full object-cover" 
                                loading="lazy" 
                                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }}
                            />
                            <div className="hidden absolute inset-0 flex items-center justify-center text-[10px] text-foreground/40 uppercase tracking-widest text-center px-1">Img NA</div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-[10px] text-muted-foreground">No mask</div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-background/80 text-[9px] font-medium p-1 text-center backdrop-blur-sm">
                        AI Mask <span className="text-muted-foreground/80 font-normal">({formatBytes(report.ai_mask_size_bytes)})</span>
                    </div>
                </div>

                {/* Cleanup Proof */}
                <div className="aspect-square bg-muted relative overflow-hidden group">
                    {report.cleanup_image_url ? (
                        <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                                src={`${API_URL}${report.cleanup_image_url}`} 
                                alt="Cleanup Proof" 
                                className="w-full h-full object-cover" 
                                loading="lazy" 
                                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }}
                            />
                            <div className="hidden absolute inset-0 flex items-center justify-center text-[10px] text-foreground/40 uppercase tracking-widest text-center px-1">Img NA</div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-[10px] text-muted-foreground">Pending</div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-background/80 text-[9px] font-medium p-1 text-center backdrop-blur-sm">
                        Cleanup <span className="text-muted-foreground/80 font-normal">({formatBytes(report.cleanup_size_bytes)})</span>
                    </div>
                </div>
            </div>

            {/* Footer / Meta */}
            <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between gap-2.5 sm:gap-3 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                    <span>Reported: {formatDate(report.created_at)}</span>
                    {report.ai_confidence && (
                        <div className="flex items-center gap-1">
                            <span className="font-medium text-foreground">AI: {(report.ai_confidence * 100).toFixed(0)}%</span>
                            <InfoTooltip side="top" label="How is AI confidence computed?">
                                <ConfidenceTooltipBody />
                            </InfoTooltip>
                        </div>
                    )}
                </div>
                <TrustBadge
                    trust_score={report.trust_score as "high" | "medium" | "low" | null | undefined}
                    trust_reasons={report.trust_reasons}
                    failing_signals={report.failing_signals}
                    needs_human_review={report.needs_human_review}
                    tooltipSide="top"
                />
            </div>
        </div>
    );
}
