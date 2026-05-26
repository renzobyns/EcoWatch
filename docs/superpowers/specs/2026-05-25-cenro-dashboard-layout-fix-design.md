# CENRO Dashboard Layout Fix — Design Spec

**Date:** 2026-05-25
**File:** `frontend/app/cenro/page.tsx` (command_center tab only)
**Goal:** Eliminate excessive vertical scrolling on the CENRO Dashboard tab. Everything should fit in one viewport on a 1920×1080 screen (accounting for real browser chrome), and scale naturally on larger screens.

---

## Problem

The `command_center` tab stacks content in this order:
1. Export button row
2. 4 KPI cards
3. SLA Breaches card (full-width, ~90px tall)
4. SLA Policy card (full-width, ~70px tall)
5. 3-column grid: [Status Breakdown + Trend] | [Map] | [Rankings + Feed]

Steps 3 and 4 consume ~160px before the main grid starts, pushing the chart and map panels far down the page. Combined with a duplicate `overflow-y-auto` on the command_center wrapper that fights the PortalShell's own scroll container, the panels lose proper height inheritance and the whole section overflows the viewport badly.

---

## Design

### Section 1 — KPI Row + Export (unchanged content, tighter layout)

Move the Export CSV button from its own standalone row to **inline with the KPI row**, right-aligned. The KPI grid becomes `grid-cols-4` taking `flex:1`, the export button sits next to it.

- Saves one full row (~40px) of vertical space
- No content removed

### Section 2 — Merged SLA Bar (replaces two full-width cards)

Replace the two separate SLA cards with **one horizontal strip** (~52px tall):

```
[ ⚠️ icon ] [ SLA BREACHES: 4  View Queue → ]  [ | ]  [ SLA POLICY: Low 10d  Med 5d  High 2d  Edit Policy → ]
```

- Left side: breach icon + count + breach tracking-ID pills + "View Queue →" link
- Vertical divider
- Right side: policy pills (color-coded green/yellow/red) + "Edit Policy →" link
- Net saving: ~110px vs two separate cards

### Section 3 — Main Grid (the structural change)

Replace the current `grid-cols-3` layout with `grid-cols-[1.6fr_1fr]`:

**Left column (60% width) — Map hero**
- The Leaflet map fills the entire left column height
- "Live City Map" label badge stays in top-left corner
- Replaces the original center column

**Right column (40% width) — 2×2 panel grid**

```
┌─────────────────┬─────────────────┐
│ Status Breakdown│ Barangay        │
│ (pie chart)     │ Rankings (list) │
├─────────────────┼─────────────────┤
│ City-Wide Trend │ Live City Feed  │
│ (line chart)    │ (timeline list) │
└─────────────────┴─────────────────┘
```

- `grid-rows-2 grid-cols-2` with `gap-5`
- Each panel uses `flex flex-col min-h-0` — content areas are `overflow-y-auto` so lists scroll internally
- At 1920×1080: each panel gets ~420px height — spacious, not cramped

### Section 4 — Scroll Container Fix (technical)

The command_center wrapper currently has `overflow-y-auto` on itself AND is a child of PortalShell's `<main>` which also has `overflow-y-auto`. This creates two competing scroll contexts and breaks `flex-1 min-h-0` height inheritance.

**Fix:** Remove `overflow-y-auto scrollbar-hide` from the command_center wrapper div (line ~970). The wrapper stays `flex-1 flex flex-col gap-6 min-h-0 pb-8`. PortalShell's `<main>` handles scrolling if content ever overflows.

---

## Height Budget at 1920×1080 (real-world)

The actual usable viewport is smaller than the raw screen height due to OS and browser chrome:

| Deduction | Height |
|---|---|
| Windows taskbar | ~40px |
| Chrome tab bar | ~35px |
| Chrome address/search bar | ~35px |
| Chrome bookmarks bar | ~35px |
| **Actual browser viewport** | **~935px** |

Then inside the app:

| Element | Height |
|---|---|
| PortalShell topbar | ~60px |
| Top padding (py-6) | ~24px |
| KPI row | ~52px |
| gap | ~6px |
| SLA bar | ~52px |
| gap | ~6px |
| **Remaining for map + 2×2 grid** | **~735px** |

Each 2×2 panel row: (735 − 5) ÷ 2 ≈ **365px tall**. Comfortable for pie charts, line charts, and scrollable lists. Map gets the full 735px.

## Responsiveness on Larger Screens

The layout scales automatically — no extra breakpoints needed:

- All sizing uses `flex-1`, `fr` units, and `min-h-0` so panels grow with the viewport
- The existing `max-w-[1600px] mx-auto` wrapper on the cenro page caps content width on ultra-wide displays (panels won't stretch absurdly on 4K)
- Recharts' `ResponsiveContainer width="100%" height="100%"` fills whatever height the panel gives it
- The 2×2 grid uses `grid-rows-2 grid-cols-2` — at larger heights each panel simply gets taller, which looks better not worse

---

## Scope

- **Only** the `command_center` tab section in `frontend/app/cenro/page.tsx` (lines ~968–1168)
- No backend changes
- No other tabs affected
- No new components — pure JSX/Tailwind changes within the existing render tree
