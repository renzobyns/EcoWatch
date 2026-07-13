"use client";

import { useState, useMemo } from "react";
import { Search, ImageIcon } from "lucide-react";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { DateRange } from "react-day-picker";
import { TrustBadge } from "@/components/TrustBadge";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { ConfidenceTooltipBody } from "@/components/ConfidenceTooltipBody";
import { formatDate } from "@/lib/date-utils";
import { QueueReport } from "@/components/portal/ReportDetailDrawer";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface EvidenceGalleryTabProps {
    reports: QueueReport[];
    barangays: readonly string[];
    onReportClick: (report: QueueReport) => void;
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

export function EvidenceGalleryTab({ reports, barangays, onReportClick }: EvidenceGalleryTabProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedBarangay, setSelectedBarangay] = useState("all");
    const [selectedStatus, setSelectedStatus] = useState("all");
    const [dateRange, setDateRange] = useState<DateRange | undefined>();

    const filteredReports = useMemo(() => {
        return reports.filter((r) => {
            // Must have an image to be in the gallery
            if (!r.image_url) return false;

            // Search by tracking ID
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const trackingMatch = r.tracking_id?.toLowerCase().includes(q);
                if (!trackingMatch) return false;
            }

            // Barangay filter
            if (selectedBarangay !== "all" && r.barangay !== selectedBarangay) {
                return false;
            }

            // Status filter
            if (selectedStatus !== "all" && r.status !== selectedStatus) {
                return false;
            }

            // Date Range filter
            if (dateRange?.from) {
                const reportDate = new Date(
                    r.created_at.endsWith("Z") || r.created_at.includes("+") || r.created_at.includes("-", 10)
                        ? r.created_at
                        : r.created_at + "Z"
                );
                
                // Compare to start date (start of day)
                const start = new Date(dateRange.from);
                start.setHours(0, 0, 0, 0);
                if (reportDate < start) return false;

                // Compare to end date (end of day) if selected
                if (dateRange.to) {
                    const end = new Date(dateRange.to);
                    end.setHours(23, 59, 59, 999);
                    if (reportDate > end) return false;
                }
            }

            return true;
        });
    }, [reports, searchQuery, selectedBarangay, selectedStatus, dateRange]);

    return (
        <div className="flex-1 flex flex-col h-full bg-background min-h-0 animate-slide-up">
            {/* Toolbar */}
            <div className="p-4 border-b border-border bg-card shrink-0 flex flex-col md:flex-row items-stretch md:items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search size={16} className="text-muted-foreground" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search by Tracking ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <select
                        value={selectedBarangay}
                        onChange={(e) => setSelectedBarangay(e.target.value)}
                        className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors cursor-pointer"
                    >
                        <option value="all">All Barangays</option>
                        {barangays.map((b) => (
                            <option key={b} value={b}>{b}</option>
                        ))}
                    </select>

                    <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors cursor-pointer"
                    >
                        {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>

                    <DateRangePicker 
                        date={dateRange}
                        onDateChange={setDateRange}
                    />
                </div>
            </div>

            {/* Gallery Grid */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-muted/20">
                {filteredReports.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                        <ImageIcon size={48} className="mb-4 opacity-20" />
                        <p className="text-sm font-medium">No images match your filters.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredReports.map((report) => (
                            <div 
                                key={report.id} 
                                onClick={() => onReportClick(report)}
                                className="bg-card rounded-xl border border-border overflow-hidden hover:border-primary/50 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col"
                            >
                                <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
                                    <div className="min-w-0">
                                        <div className="font-mono text-xs font-bold text-foreground mb-1 truncate">{report.tracking_id}</div>
                                        <div className="text-xs text-muted-foreground truncate">{report.barangay || 'Unassigned'}</div>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold shrink-0 ml-2 ${
                                        report.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                                        report.status === 'assigned' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20' :
                                        report.status === 'in_progress' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' :
                                        report.status === 'verified' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20' :
                                        report.status === 'pending' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                                        report.status === 'failed_cleanup' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                                        report.status === 'rejected' ? 'bg-muted text-muted-foreground border border-border' :
                                        'bg-muted text-foreground border border-border'
                                    }`}>
                                        {report.status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                                    </span>
                                </div>

                                <div className="grid grid-cols-3 gap-0.5 p-0.5 bg-muted/50 shrink-0">
                                    {/* Original */}
                                    <div className="aspect-square bg-muted relative overflow-hidden group">
                                        {report.image_url ? (
                                            <img src={`${API_URL}${report.image_url}`} alt="Original" className="w-full h-full object-cover" loading="lazy" />
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-[10px] text-muted-foreground">No original</div>
                                        )}
                                        <div className="absolute bottom-0 inset-x-0 bg-background/80 text-[9px] font-medium p-1 text-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">Original</div>
                                    </div>

                                    {/* AI Mask */}
                                    <div className="aspect-square bg-muted relative overflow-hidden group">
                                        {report.ai_mask_url ? (
                                            <img src={`${API_URL}${report.ai_mask_url}`} alt="AI Detection" className="w-full h-full object-cover" loading="lazy" />
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-[10px] text-muted-foreground">No mask</div>
                                        )}
                                        <div className="absolute bottom-0 inset-x-0 bg-background/80 text-[9px] font-medium p-1 text-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">AI Mask</div>
                                    </div>

                                    {/* Cleanup Proof */}
                                    <div className="aspect-square bg-muted relative overflow-hidden group">
                                        {report.cleanup_image_url ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={`${API_URL}${report.cleanup_image_url}`} alt="Cleanup Proof" className="w-full h-full object-cover" loading="lazy" />
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-[10px] text-muted-foreground">Pending</div>
                                        )}
                                        <div className="absolute bottom-0 inset-x-0 bg-background/80 text-[9px] font-medium p-1 text-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">Cleanup</div>
                                    </div>
                                </div>

                                <div className="p-4 flex-1 flex flex-col justify-between gap-3 text-xs text-muted-foreground">
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
                                        trust_score={report.trust_score}
                                        trust_reasons={report.trust_reasons}
                                        failing_signals={report.failing_signals}
                                        needs_human_review={report.needs_human_review}
                                        tooltipSide="top"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
