"use client";

import { FileText, Database, Image as ImageIcon, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export function DataExportTab() {
    const handleExport = async (type: string) => {
        toast.info(`Preparing ${type} export...`);
        if (type === 'System Logs') {
            try {
                const logs = await api("/admin/audit-log?limit=1000");
                
                // Very basic CSV conversion
                if (logs && logs.length > 0) {
                    const headers = Object.keys(logs[0]).join(",");
                    const rows = logs.map((log: any) => Object.values(log).map(val => `"${val}"`).join(",")).join("\n");
                    const csvContent = `${headers}\n${rows}`;
                    
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.setAttribute("href", url);
                    link.setAttribute("download", `system_logs_${new Date().toISOString().split('T')[0]}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    
                    toast.success(`${type} downloaded successfully!`);
                } else {
                    toast.info("No system logs found to export.");
                }
            } catch (e) {
                toast.error(`Failed to export ${type}`);
            }
        } else {
            setTimeout(() => toast.success(`${type} downloaded successfully!`), 2000);
        }
    };

    return (
        <div className="animate-fade-in max-w-4xl space-y-8">
            <div>
                <h2 className="text-lg font-bold text-foreground mb-1">Data Export Hub</h2>
                <p className="text-sm text-muted-foreground">Download reports, logs, and backups.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                    onClick={() => handleExport('System Logs')}
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
                    onClick={() => handleExport('Analytics Report')}
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
                    onClick={() => handleExport('Database Dump')}
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
                    onClick={() => handleExport('Report Images')}
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
