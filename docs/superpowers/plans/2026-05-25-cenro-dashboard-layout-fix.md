# CENRO Dashboard Layout Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the CENRO `command_center` tab so everything fits in one viewport on a 1920×1080 screen — map as hero on the left, 2×2 panel grid on the right, SLA cards merged into one horizontal bar.

**Architecture:** Pure JSX/Tailwind changes to a single file (`frontend/app/cenro/page.tsx`, lines ~968–1168). No new components, no backend changes. Three structural edits: (1) remove duplicate scroll container + inline Export with KPIs, (2) replace two SLA cards with one horizontal strip, (3) replace 3-column grid with map-hero (1.6fr) + 2×2 panel grid (1fr).

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, Recharts, Leaflet (MapComponent)

> **Note on TDD:** This is a pure layout/style change with no testable logic. Unit tests don't apply. Visual verification against the live dev server substitutes for automated tests.

---

## Files

| Action | File | Lines |
|---|---|---|
| Modify | `frontend/app/cenro/page.tsx` | ~968–1168 (command_center tab JSX only) |

No other files touched.

---

### Task 1: Remove duplicate scroll container + inline Export with KPIs

**Files:**
- Modify: `frontend/app/cenro/page.tsx:968–1002`

- [ ] **Step 1: Remove `overflow-y-auto scrollbar-hide` from command_center wrapper**

Find this line (~970):
```tsx
<div className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto scrollbar-hide pb-8">
```
Replace with:
```tsx
<div className="flex-1 flex flex-col gap-6 min-h-0 pb-8">
```

This fixes the competing scroll contexts. PortalShell's `<main>` (which already has `overflow-y-auto`) is now the sole scroll container.

- [ ] **Step 2: Inline the Export button with the KPI row**

Find the entire `flex flex-col gap-4 shrink-0` wrapper block (~973–1002):
```tsx
<div className="flex flex-col gap-4 shrink-0">
    <div className="flex items-center justify-end">
        <button
            onClick={handleExportAnalytics}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/20 border border-primary/30 text-primary text-xs font-bold uppercase tracking-widest hover:bg-primary/30 transition-colors"
            title="Export analytics summary as CSV"
        >
            <Download size={14} />
            Export Analytics CSV
        </button>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 animate-slide-up stagger-1">
        <div className="glass-pro p-5 rounded-2xl bento-card">
            <div className="text-[11px] text-foreground/50 uppercase tracking-widest font-semibold mb-1.5">Total Reports</div>
            <div className="text-3xl font-bold text-emerald-400 tracking-tight">{stats.total}</div>
        </div>
        <div className="glass-pro p-5 rounded-2xl bento-card">
            <div className="text-[11px] text-foreground/50 uppercase tracking-widest font-semibold mb-1.5">Active/Pending</div>
            <div className="text-3xl font-bold text-red-400 tracking-tight">{pending}</div>
        </div>
        <div className="glass-pro p-5 rounded-2xl bento-card">
            <div className="text-[11px] text-foreground/50 uppercase tracking-widest font-semibold mb-1.5">Teams Deployed</div>
            <div className="text-3xl font-bold text-yellow-400 tracking-tight">{stats.deployed}</div>
        </div>
        <div className="glass-pro p-5 rounded-2xl bento-card">
            <div className="text-[11px] text-foreground/50 uppercase tracking-widest font-semibold mb-1.5">Success Rate</div>
            <div className="text-3xl font-bold text-green-400 tracking-tight">{successRate}%</div>
        </div>
    </div>
</div>
```

Replace with:
```tsx
<div className="flex items-start gap-4 shrink-0 animate-slide-up stagger-1">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 flex-1">
        <div className="glass-pro p-5 rounded-2xl bento-card">
            <div className="text-[11px] text-foreground/50 uppercase tracking-widest font-semibold mb-1.5">Total Reports</div>
            <div className="text-3xl font-bold text-emerald-400 tracking-tight">{stats.total}</div>
        </div>
        <div className="glass-pro p-5 rounded-2xl bento-card">
            <div className="text-[11px] text-foreground/50 uppercase tracking-widest font-semibold mb-1.5">Active/Pending</div>
            <div className="text-3xl font-bold text-red-400 tracking-tight">{pending}</div>
        </div>
        <div className="glass-pro p-5 rounded-2xl bento-card">
            <div className="text-[11px] text-foreground/50 uppercase tracking-widest font-semibold mb-1.5">Teams Deployed</div>
            <div className="text-3xl font-bold text-yellow-400 tracking-tight">{stats.deployed}</div>
        </div>
        <div className="glass-pro p-5 rounded-2xl bento-card">
            <div className="text-[11px] text-foreground/50 uppercase tracking-widest font-semibold mb-1.5">Success Rate</div>
            <div className="text-3xl font-bold text-green-400 tracking-tight">{successRate}%</div>
        </div>
    </div>
    <button
        onClick={handleExportAnalytics}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/20 border border-primary/30 text-primary text-xs font-bold uppercase tracking-widest hover:bg-primary/30 transition-colors shrink-0 self-stretch"
        title="Export analytics summary as CSV"
    >
        <Download size={14} />
        Export Analytics CSV
    </button>
</div>
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:3000/cenro`, log in as `cenro@test.com / password123`, navigate to Dashboard tab. The export button should now sit to the right of the 4 KPI cards on the same row. No standalone button row above.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/cenro/page.tsx
git commit -m "fix(cenro): inline export btn with KPI row, remove duplicate scroll container"
```

---

### Task 2: Replace two SLA cards with one merged horizontal bar

**Files:**
- Modify: `frontend/app/cenro/page.tsx:1004–1086`

- [ ] **Step 1: Delete both SLA cards and replace with merged bar**

Find the SLA Breaches card block (~1004–1056):
```tsx
{/* C3 — SLA Breaches Card */}
<div className="glass-pro p-6 rounded-[2.5rem] border border-border shrink-0 animate-slide-up stagger-2 overflow-hidden relative">
```
…all the way through to the closing `</div>` of the SLA Policy card (~1086):
```tsx
                </button>
            </div>
        </div>
    </div>
```

Delete both cards entirely and insert this single merged bar in their place:

```tsx
{/* Merged SLA bar */}
<div className="glass-pro px-5 py-4 rounded-2xl border border-border shrink-0 flex items-center gap-5 animate-slide-up stagger-2 overflow-hidden relative">
    <div className="absolute top-0 right-0 w-48 h-48 bg-red-500/5 rounded-full blur-[60px] pointer-events-none" />

    {/* Breach icon */}
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative z-10 ${slaBreaches.length > 0 ? 'bg-red-500/20 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-green-500/20 text-green-400'}`}>
        <AlertTriangle size={20} />
    </div>

    {/* Breach info */}
    <div className="min-w-0 relative z-10">
        <div className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest mb-0.5">SLA Breaches</div>
        <div className={`text-xl font-bold leading-none mb-1.5 ${slaBreaches.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {slaBreaches.length}
        </div>
        {slaBreaches.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
                {slaBreaches.slice(0, 3).map((r) => {
                    const sla = slaInfo(r.created_at, r.status);
                    return (
                        <span key={r.id} className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400">
                            {r.tracking_id}{sla ? ` ${sla.days}d` : ''}
                        </span>
                    );
                })}
            </div>
        ) : (
            <p className="text-[10px] text-foreground/40 italic">All on schedule</p>
        )}
    </div>

    {slaBreaches.length > 0 && (
        <button
            onClick={() => {
                setOversightStatus("");
                setOversightSearch("");
                setOversightDateFrom("");
                setOversightDateTo("");
                setOversightBarangay("");
                setActiveTab('oversight');
            }}
            className="text-xs font-bold text-primary hover:text-emerald-300 underline underline-offset-4 shrink-0 relative z-10"
        >
            View Queue →
        </button>
    )}

    {/* Divider */}
    <div className="w-px self-stretch bg-border shrink-0 mx-1 relative z-10" />

    {/* Policy info */}
    <div className="min-w-0 relative z-10">
        <div className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest mb-2">SLA Policy</div>
        <div className="flex gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-400">Low {slaPolicy.low}d</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500/10 text-yellow-400">Med {slaPolicy.medium}d</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400">High {slaPolicy.high}d</span>
        </div>
        <button
            onClick={() => setShowSlaModal(true)}
            className="text-[10px] font-bold text-primary hover:text-emerald-300"
        >
            Edit Policy →
        </button>
    </div>
</div>
```

- [ ] **Step 2: Verify in browser**

Reload `http://localhost:3000/cenro`. The Dashboard tab should now show one slim horizontal bar instead of two stacked cards. Left side: breach count + pills. Right of divider: Low/Med/High pills + Edit Policy link. The map + charts should now be visible without scrolling.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/cenro/page.tsx
git commit -m "fix(cenro): merge SLA breaches and policy into single horizontal bar"
```

---

### Task 3: Replace 3-column grid with map-hero + 2×2 panel grid

**Files:**
- Modify: `frontend/app/cenro/page.tsx:1088–1167`

- [ ] **Step 1: Replace the entire main grid block**

Find the main grid opening tag (~1089):
```tsx
<div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
```
…all the way through its closing `</div>` at ~1167 (the one that closes the 3-column grid, NOT the outer command_center wrapper).

Delete it entirely and replace with:

```tsx
{/* Main Grid — Map hero + 2×2 panels */}
<div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6 min-h-0">

    {/* Left: Map hero */}
    <div className="glass rounded-2xl border border-border overflow-hidden relative min-h-[300px] animate-slide-up stagger-3">
        <div className="absolute top-4 left-4 z-[1000] glass px-3 py-1.5 rounded-full text-[10px] font-bold text-foreground uppercase tracking-widest border border-foreground/20 pointer-events-none">Live City Map</div>
        <MapComponent height="100%" reports={reports} heatmaps={heatmaps} focusedBarangay={null} onBarangayClick={() => {}} />
    </div>

    {/* Right: 2×2 panel grid */}
    <div className="grid grid-cols-2 grid-rows-2 gap-6 min-h-0 animate-slide-up stagger-4">

        {/* Top-left: Status Breakdown */}
        <div className="glass-pro p-6 rounded-[2rem] flex flex-col min-h-0 bento-card">
            <h3 className="text-[11px] font-bold text-foreground/40 uppercase tracking-widest mb-4 shrink-0">Status Breakdown</h3>
            <div className="flex-1 relative min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={8} dataKey="value">
                            {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />)}
                        </Pie>
                        <Tooltip
                            contentStyle={{ backgroundColor: 'rgba(10, 15, 10, 0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }}
                            itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-3 shrink-0">
                {pieData.map(d => (
                    <div key={d.name} className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest text-foreground/60">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></div>
                        {d.name}
                    </div>
                ))}
            </div>
        </div>

        {/* Top-right: Barangay Rankings */}
        <div className="glass-pro p-6 rounded-[2rem] flex flex-col min-h-0 bento-card">
            <h3 className="text-[11px] font-bold text-foreground/40 uppercase tracking-widest mb-4 shrink-0">Barangay Rankings</h3>
            <div className="flex-1 overflow-y-auto pr-1 space-y-3 scrollbar-hide">
                {barangayStats.map((b, i) => (
                    <div key={b.name} className="flex items-center justify-between p-3 rounded-xl bg-foreground/[0.03] border border-border hover:bg-foreground/[0.08] transition-colors group">
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-foreground/5 flex items-center justify-center text-xs font-semibold text-foreground/30 group-hover:text-primary transition-colors">{i + 1}</div>
                            <div className="text-sm font-bold text-foreground/90 truncate">{b.name}</div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                            <div className="text-sm font-semibold text-emerald-400">{b.rate.toFixed(0)}%</div>
                            <div className="text-[10px] text-foreground/30 uppercase tracking-widest font-bold">{b.resolved} reports</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Bottom-left: City-Wide Trend */}
        <div className="glass-pro p-6 rounded-[2rem] flex flex-col min-h-0 bento-card">
            <h3 className="text-[11px] font-bold text-foreground/40 uppercase tracking-widest mb-4 shrink-0">City-Wide Trend</h3>
            <div className="flex-1 relative min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" fontSize={10} tickMargin={12} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(10, 15, 10, 0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }} />
                        <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#0a0f0a' }} activeDot={{ r: 6, fill: '#34d399' }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Bottom-right: Live City Feed */}
        <div className="glass-pro p-6 rounded-[2rem] flex flex-col min-h-0 bento-card">
            <h3 className="text-[11px] font-bold text-foreground/40 uppercase tracking-widest mb-4 shrink-0">Live City Feed</h3>
            <div className="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-hide">
                {recentFeed.map(r => (
                    <div key={r.id} className="relative pl-5 border-l border-border">
                        <div className="absolute w-2 h-2 rounded-full bg-emerald-500 -left-[4px] top-1.5 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
                        <div className="text-[12px] font-semibold text-foreground mb-0.5 tracking-tight">Report {r.tracking_id}</div>
                        <div className="text-[10px] text-foreground/40 mb-2 font-medium uppercase tracking-wider">{r.barangay} • {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-widest ${r.status === 'resolved' ? 'bg-green-500/20 text-green-400' : r.status === 'deployed' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>{r.status}</span>
                    </div>
                ))}
            </div>
        </div>

    </div>
</div>
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors. If there are errors, they will be in the JSX structure — check for mismatched closing tags.

- [ ] **Step 3: Verify in browser — golden path**

Reload `http://localhost:3000/cenro`. On the Dashboard tab, confirm:

1. Map occupies ~60% of the horizontal space on the left — full height, no scroll needed to see it
2. Right side shows a 2×2 grid: Status Breakdown (top-left), Barangay Rankings (top-right), City-Wide Trend (bottom-left), Live City Feed (bottom-right)
3. Pie chart renders correctly in the smaller panel
4. Line chart renders correctly in the smaller panel
5. Rankings list scrolls internally when there are many barangays
6. Feed list scrolls internally
7. No panel is cut off without scrolling the page at all
8. Resize browser to a narrower width — at `lg` breakpoint and below, the layout stacks to single column (map on top, 2×2 below)

- [ ] **Step 4: Verify other tabs are unaffected**

Click through: City Map, Reports, SLA Management, Analytics, Barangay Management, Evidence Gallery, Audit Log, Accounts. None of these should look different — only the Dashboard tab changed.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/cenro/page.tsx
git commit -m "feat(cenro): map-hero layout with 2x2 panel grid on dashboard"
```
