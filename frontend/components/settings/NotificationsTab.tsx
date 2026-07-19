"use client";

import { useState, useEffect } from "react";
import { Mail, Smartphone, Bell } from "lucide-react";

export function NotificationsTab() {
    const [emailAlerts, setEmailAlerts] = useState(true);
    const [smsAlerts, setSmsAlerts] = useState(false);
    const [pushAlerts, setPushAlerts] = useState(true);
    
    const [frequency, setFrequency] = useState("realtime");
    
    // Categories
    const [cats, setCats] = useState({
        newReports: true,
        slaBreaches: true,
        cleanupCompleted: false,
        systemAlerts: true,
        accountChanges: true
    });

    useEffect(() => {
        // Load initial state if we wanted to
        const loadPref = (key: string, setter: (val: boolean) => void) => {
            const v = localStorage.getItem(`ecowatch_notif_${key}`);
            if (v !== null) setter(v === "true");
        };
        loadPref("email", setEmailAlerts);
        loadPref("sms", setSmsAlerts);
        loadPref("push", setPushAlerts);
        
        const f = localStorage.getItem("ecowatch_notif_freq");
        if (f) setFrequency(f);
    }, []);

    const savePref = (key: string, value: boolean, setter: (val: boolean) => void) => {
        setter(value);
        localStorage.setItem(`ecowatch_notif_${key}`, String(value));
    };

    return (
        <div className="animate-fade-in max-w-2xl space-y-8 pb-12">
            <div>
                <h2 className="text-lg font-bold text-foreground mb-1">Notification Preferences</h2>
                <p className="text-sm text-muted-foreground">Control how and when you receive alerts.</p>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
                <div className="flex items-center justify-between py-3 border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-secondary rounded-lg"><Mail size={16} className="text-foreground" /></div>
                        <div>
                            <span className="text-sm font-medium block">Email Alerts</span>
                            <span className="text-xs text-muted-foreground">Receive alerts via email to your registered address</span>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                        <input type="checkbox" className="sr-only peer" checked={emailAlerts} onChange={() => savePref('email', !emailAlerts, setEmailAlerts)} />
                        <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                </div>
                
                <div className="flex items-center justify-between py-3 border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-secondary rounded-lg"><Smartphone size={16} className="text-foreground" /></div>
                        <div>
                            <span className="text-sm font-medium block">SMS Alerts</span>
                            <span className="text-xs text-muted-foreground">Receive critical alerts via SMS (+63 9XX XXX XXXX)</span>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                        <input type="checkbox" className="sr-only peer" checked={smsAlerts} onChange={() => savePref('sms', !smsAlerts, setSmsAlerts)} />
                        <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                </div>

                <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-secondary rounded-lg"><Bell size={16} className="text-foreground" /></div>
                        <div>
                            <span className="text-sm font-medium block">Push Notifications</span>
                            <span className="text-xs text-muted-foreground">Browser push notifications for urgent alerts</span>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                        <input type="checkbox" className="sr-only peer" checked={pushAlerts} onChange={() => savePref('push', !pushAlerts, setPushAlerts)} />
                        <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                </div>
            </div>

            <div>
                <h3 className="text-sm font-semibold mb-3">Notification Frequency</h3>
                <div className="p-1 bg-secondary rounded-lg inline-flex w-full sm:w-auto">
                    {[
                        { id: 'realtime', label: 'Real-time' },
                        { id: 'hourly', label: 'Hourly Digest' },
                        { id: 'daily', label: 'Daily Digest' }
                    ].map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => {
                                setFrequency(opt.id);
                                localStorage.setItem("ecowatch_notif_freq", opt.id);
                            }}
                            className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-md transition-all ${frequency === opt.id ? "bg-background shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <div>
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
                                checked={cats[cat.id as keyof typeof cats]}
                                onChange={() => setCats(prev => ({...prev, [cat.id]: !prev[cat.id as keyof typeof cats]}))}
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

            <div>
                <h3 className="text-sm font-semibold mb-3">Quiet Hours</h3>
                <div className="flex items-center gap-4">
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">From</label>
                        <input type="time" defaultValue="22:00" className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors" />
                    </div>
                    <div className="text-muted-foreground pt-4">to</div>
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">To</label>
                        <input type="time" defaultValue="07:00" className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors" />
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Non-critical notifications will be suppressed during these hours.</p>
            </div>
        </div>
    );
}
