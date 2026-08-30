"use client";

import { FileText, Database, Image as ImageIcon, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://renzobyns-ecowatch-backend.hf.space";

function getUserIdHeader(): Record<string, string> {
    if (typeof window === "undefined") return {};
    try {
        const raw = localStorage.getItem("ecowatch_user");
        if (!raw) return {};
        const user = JSON.parse(raw);
        return user?.id ? { "X-User-Id": String(user.id) } : {};
    } catch {
        return {};
    }
}

export function DataExportTab() {
    const handleExportJsonCsv = async (type: string) => {
        toast.info(`Preparing ${type} export...`);
        try {
            if (type === 'System Logs') {
                const logs = await api("/audit-log?limit=1000");
                if (logs && logs.length > 0) {
                    const headers = Object.keys(logs[0]).join(",");
                    const rows = logs.map((log: Record<string, unknown>) => Object.values(log).map(val => `"${val}"`).join(",")).join("\n");
                    downloadBlob(new Blob([`${headers}\n${rows}`], { type: 'text/csv;charset=utf-8;' }), `system_logs_${new Date().toISOString().split('T')[0]}.csv`);
                    toast.success(`${type} downloaded successfully!`);
                } else {
                    toast.info("No system logs found to export.");
                }
            } else if (type === 'Analytics Report') {
                await downloadFileDirect("/analytics/insights-export?days=30", `analytics_report_${new Date().toISOString().split('T')[0]}.csv`);
            } else if (type === 'Database Dump') {
                await downloadFileDirect("/admin/database-dump", `database_dump_${new Date().toISOString().split('T')[0]}.json`);
            } else if (type === 'Report Images') {
                await downloadFileDirect("/admin/export-images-zip", `images_${new Date().toISOString().split('T')[0]}.zip`);
            }
        } catch (e) {
            console.error(e);
            toast.error(`Failed to export ${type}`);
        }
    };

    const downloadFileDirect = async (path: string, filename: string) => {
        const res = await fetch(`${API_URL}${path}`, {
            headers: getUserIdHeader()
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        downloadBlob(blob, filename);
        toast.success(`Export downloaded successfully!`);
    };

    const downloadBlob = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="animate-fade-in max-w-4xl space-y-8">
            <div>
                <h2 className="text-lg font-bold text-foreground mb-1">Data Export Hub</h2>
                <p className="text-sm text-muted-foreground">Download reports, logs, and backups.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                    onClick={() => handleExportJsonCsv('System Logs')}
                    className="flex flex-col items-start gap-2 p-5 border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all text-left group cursor-pointer"
                >
                    <div className="p-2.5 bg-secondary rounded-lg group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <FileText size={20} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm">Export System Logs</h3>
                        <p className="text-xs text-muted-foreground mt-1">Download a CSV of all system audits and errors.</p>
                    </div>
                </button>

                <button 
                    onClick={() => handleExportJsonCsv('Analytics Report')}
                    className="flex flex-col items-start gap-2 p-5 border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all text-left group cursor-pointer"
                >
                    <div className="p-2.5 bg-secondary rounded-lg group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <BarChart3 size={20} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm">Export Analytics Report</h3>
                        <p className="text-xs text-muted-foreground mt-1">Full analytics insights as CSV.</p>
                    </div>
                </button>

                <button 
                    onClick={() => handleExportJsonCsv('Database Dump')}
                    className="flex flex-col items-start gap-2 p-5 border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all text-left group cursor-pointer"
                >
                    <div className="p-2.5 bg-secondary rounded-lg group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <Database size={20} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm">Database Dump (JSON)</h3>
                        <p className="text-xs text-muted-foreground mt-1">Complete backup of all records and configuration.</p>
                    </div>
                </button>

                <button 
                    onClick={() => handleExportJsonCsv('Report Images')}
                    className="flex flex-col items-start gap-2 p-5 border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all text-left group cursor-pointer"
                >
                    <div className="p-2.5 bg-secondary rounded-lg group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <ImageIcon size={20} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm">Export Report Images (ZIP)</h3>
                        <p className="text-xs text-muted-foreground mt-1">Bulk download all report media. May take several minutes.</p>
                    </div>
                </button>
            </div>
        </div>
    );
}
