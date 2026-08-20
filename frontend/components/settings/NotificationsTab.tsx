"use client";

import { Mail, Smartphone, Bell, Info } from "lucide-react";

export function NotificationsTab() {
    return (
        <div className="animate-fade-in max-w-2xl space-y-8 pb-12">
            <div>
                <h2 className="text-lg font-bold text-foreground mb-1">Notification Preferences</h2>
                <p className="text-sm text-muted-foreground">Control how and when you receive alerts.</p>
            </div>

            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex gap-3 items-start">
                <Info className="text-primary mt-0.5 shrink-0" size={18} />
                <div>
                    <h3 className="font-semibold text-primary text-sm">Coming Soon: External Notifications</h3>
                    <p className="text-xs text-primary/80 mt-1">
                        Email, SMS, and Push notifications require external services (Resend, Twilio) and domain verification. 
                        These features are disabled until production deployment. You will still receive in-app alerts.
                    </p>
                </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 shadow-sm opacity-60 pointer-events-none">
                <div className="flex items-center justify-between py-3 border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-secondary rounded-lg"><Mail size={16} className="text-foreground" /></div>
                        <div>
                            <span className="text-sm font-medium block flex items-center gap-2">
                                Email Alerts 
                                <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground uppercase font-bold tracking-wider">Coming Soon</span>
                            </span>
                            <span className="text-xs text-muted-foreground">Receive alerts via email to your registered address</span>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                        <input type="checkbox" className="sr-only peer" disabled />
                        <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                    </label>
                </div>
                
                <div className="flex items-center justify-between py-3 border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-secondary rounded-lg"><Smartphone size={16} className="text-foreground" /></div>
                        <div>
                            <span className="text-sm font-medium block flex items-center gap-2">
                                SMS Alerts
                                <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground uppercase font-bold tracking-wider">Coming Soon</span>
                            </span>
                            <span className="text-xs text-muted-foreground">Receive critical alerts via SMS (+63 9XX XXX XXXX)</span>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                        <input type="checkbox" className="sr-only peer" disabled />
                        <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                    </label>
                </div>

                <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-secondary rounded-lg"><Bell size={16} className="text-foreground" /></div>
                        <div>
                            <span className="text-sm font-medium block flex items-center gap-2">
                                Push Notifications
                                <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground uppercase font-bold tracking-wider">Coming Soon</span>
                            </span>
                            <span className="text-xs text-muted-foreground">Browser push notifications for urgent alerts</span>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                        <input type="checkbox" className="sr-only peer" disabled />
                        <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                    </label>
                </div>
            </div>

            <div className="opacity-60 pointer-events-none">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    Notification Frequency
                </h3>
                <div className="p-1 bg-secondary rounded-lg inline-flex w-full sm:w-auto">
                    {[
                        { id: 'realtime', label: 'Real-time' },
                        { id: 'hourly', label: 'Hourly Digest' },
                        { id: 'daily', label: 'Daily Digest' }
                    ].map(opt => (
                        <button
                            key={opt.id}
                            disabled
                            className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-md transition-all ${opt.id === 'realtime' ? "bg-background shadow-sm border border-border" : "text-muted-foreground"}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="opacity-60 pointer-events-none">
                <h3 className="text-sm font-semibold mb-3">Alert Categories</h3>
                <div className="bg-card rounded-xl border border-border p-4 shadow-sm divide-y divide-border/50">
                    {[
                        { id: 'newReports', label: 'New Reports', desc: 'When a new report is verified in your jurisdiction' },
                        { id: 'slaBreaches', label: 'SLA Breaches', desc: 'When a report passes its deadline (Priority High)' },
                        { id: 'cleanupCompleted', label: 'Cleanup Completed', desc: 'When a cleanup team resolves a work order' },
                        { id: 'systemAlerts', label: 'System Alerts', desc: 'Server health, storage warnings, AI fallback mode' },
                        { id: 'accountChanges', label: 'Account Changes', desc: 'Password updates, role assignments' },
                    ].map(cat => (
                        <label key={cat.id} className="flex items-center gap-4 py-3 cursor-pointer group">
                            <input 
                                type="checkbox" 
                                checked={true}
                                disabled
                                className="w-4 h-4 rounded border-border text-primary focus:ring-primary bg-background" 
                            />
                            <div>
                                <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{cat.label}</p>
                                <p className="text-xs text-muted-foreground">{cat.desc}</p>
                            </div>
                        </label>
                    ))}
                </div>
            </div>

            <div className="opacity-60 pointer-events-none">
                <h3 className="text-sm font-semibold mb-3">Quiet Hours</h3>
                <div className="flex items-center gap-4">
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">From</label>
                        <input type="time" defaultValue="22:00" disabled className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors" />
                    </div>
                    <div className="text-muted-foreground pt-4">to</div>
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">To</label>
                        <input type="time" defaultValue="07:00" disabled className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors" />
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Non-critical notifications will be suppressed during these hours.</p>
            </div>
        </div>
    );
}
