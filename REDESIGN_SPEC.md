# EcoWatch Portal Redesign Spec
**Status:** Planning | **Last Updated:** May 18, 2026

Both portals move from top-tab navigation to a **left sidebar**. This document defines every module — what it is, what it does, and exactly what should be on it. Use this to wireframe and finalize before any code is written.

---

## CENRO Portal — Module List

**Sidebar order (top to bottom):**
1. Dashboard
2. City Map
3. Reports
4. SLA Management
5. Analytics
6. Barangay Management
7. Evidence Gallery
8. Audit Log
9. Accounts

**Sidebar bottom (always visible):**
- Dark Mode / Light Mode toggle
- User avatar + full name + "CENRO Officer" role label
- Sign Out button

---

### 1. Dashboard — Detailed Spec

**What it is:**
The first page a CENRO officer sees when they log in. The "situation room" of SJDM — numbers, alerts, and live activity at a glance. NOT a charts/analytics page (charts moved to Module 5). NOT a map page (map is Module 2). Dashboard's job: tell the officer **what is happening right now and what needs their attention**.

**Grounded in current design:** This spec is based on the existing Command Center in [frontend/app/cenro/page.tsx:540-738](frontend/app/cenro/page.tsx#L540-L738). We keep what works, strip out the chart/map clutter (moved elsewhere), and tighten the focus to KPIs + alerts + activity.

---

#### Section 1.1 — Top Bar

**Visual:** Full-width row, sits at the top of the dashboard scroll area.

| Element | Position | Description |
|---------|----------|-------------|
| Page title | Left | "SJDM Command Center" — big heading |
| Subtitle | Below title | "Real-time city overview · [Today's Date]" — small muted text |
| Export button | Right | Same as current: `Download` icon + "Export Analytics CSV" — calls `handleExportAnalytics`, downloads summary CSV |

**Style:** Keep current glass aesthetic. Title uses tracking-tight bold; export button uses `bg-primary/20 border border-primary/30 text-primary` (existing pattern).

---

#### Section 1.2 — KPI Stat Cards (KEPT — the 4 cards we agreed on)

**Visual:** Grid of 4 cards. Mobile = 2 columns (grid-cols-2), desktop = 4 columns (md:grid-cols-4). Gap of 6 between cards.

**Style per card:** `glass-pro p-5 rounded-2xl bento-card` (existing class — keep).
- Tiny uppercase label at top: 11px, foreground/50, tracking-widest, semibold
- Big number below: 3xl, bold, tracking-tight, colored per card

| # | Label | Value Source | Color | Notes |
|---|-------|-------------|-------|-------|
| 1 | Total Reports | `stats.total` (from `GET /analytics/overview`) | emerald-400 | All-time count |
| 2 | Active/Pending | `pending` (computed: pending + verified statuses) | red-400 | Reports needing action |
| 3 | Teams Deployed | `stats.deployed` | yellow-400 | Active cleanup teams in field |
| 4 | Success Rate | `successRate` (resolved / total × 100) | green-400 | % suffix appended |

**Optional enhancement (small):** Add a tiny trend indicator under the number — "↑ 12% vs last week" or "↓ 3% vs last week" — but only if there's time. Skip if not.

---

#### Section 1.3 — SLA Breach Alert Card (KEPT, refined)

**Visual:** Full-width card immediately below the KPI row. Same `glass-pro p-6 rounded-[2.5rem]` style as current.

**Behavior:** Red accent when breaches > 0, green when zero. Background blur orb (red-500/5 or green-500/5) for depth.

**Header row (left side):**
- Icon: `AlertTriangle` in a `w-14 h-14 rounded-2xl` container. Red bg if breaches exist, green if none.
- Label (small uppercase): "SLA Breaches (Low: Xd / Med: Yd / High: Zd)" — shows current SLA thresholds inline
- Big number: count of breaches, red if >0, green if 0

**Header row (right side):**
- Button (shown only if breaches > 0): "Manage All Breaches →" — navigates to **SLA Management** module (not Oversight Queue anymore — SLA page is now the canonical destination)

**Body (when breaches > 0):**
- Grid of top 3 oldest breaching reports, each in a mini card:
  - Tracking ID (mono font, bold)
  - SLA badge: "Xd open" — colored pill (red for breach)
  - Barangay name (emerald accent)
  - Status (uppercase tiny text)

**Body (when zero breaches):**
- Italic text: "No active breaches — all reports within SLA threshold."

**Data source:**
- `slaBreaches` from `GET /reports/sla-breaches`
- `slaPolicy` from `GET /config/sla`

---

#### Section 1.4 — Today's Snapshot (NEW, slim row)

**Why add:** With charts removed, we need a small "what happened today" pulse to give the Dashboard a sense of real-time motion. Quick to scan, no deep analytics.

**Visual:** Single full-width card, 3 inline metric blocks separated by dividers. Compact — no big numbers, just glanceable stats.

**Style:** `glass-pro p-5 rounded-2xl` — slim profile, less visual weight than KPI cards.

**Contents (3 inline stats):**
| Stat | Source | Display |
|------|--------|---------|
| New Reports Today | Filter reports where `created_at` is today | "12 new reports" + small `Plus` icon |
| Deployments Today | Filter reports where `deployed_at` is today | "5 teams deployed" + small `Truck` icon |
| Resolved Today | Filter reports where `resolved_at` is today | "8 resolved" + small `CheckCircle` icon |

**Computed client-side** from the existing `reports` array — no new API needed.

---

#### Section 1.5 — Two-Column Bottom Grid

**Layout:** Grid of 2 equal columns on desktop (lg:grid-cols-2). Stacks vertically on mobile.

---

##### LEFT COLUMN: Barangay Rankings (KEPT, refined)

**Visual:** `glass-pro p-8 rounded-[2.5rem] bento-card` — same as current.

**Header:** "Barangay Rankings" (uppercase, tracking-widest, foreground/40)

**Body:** Scrollable list, **show top 5 only** (currently shows full list — we trim for cleaner Dashboard). Each row:
- Left side: rank number badge (1, 2, 3...) in a small square + barangay name
- Right side: resolution rate % (emerald) + "X reports" tiny label
- Hover: subtle background highlight (already implemented)

**Footer:** "View All Barangays →" link — navigates to **Barangay Management** module.

**Data source:** `barangayStats` (already computed from `GET /analytics/barangay-ranking`), sliced to top 5.

---

##### RIGHT COLUMN: Live City Feed (KEPT)

**Visual:** `glass-pro p-8 rounded-[2.5rem] bento-card` — same as current.

**Header:** "Live City Feed" (uppercase, tracking-widest, foreground/40)

**Body:** Scrollable timeline, **show 10 most recent events**. Each entry:
- Left rail: vertical border line + small emerald dot with pulse glow
- Content:
  - Bold tracking ID: "Report EW-XXXX"
  - Subtle line: "[Barangay] · [HH:MM]"
  - Status pill (colored: green/yellow/red by status)

**Empty state:** "No recent activity — reports will appear here as they come in."

**Data source:** `recentFeed` (already computed from `reports`, sorted by `created_at` desc, sliced to 10).

---

#### Section 1.6 — What's REMOVED from current Dashboard

These belonged on the old Command Center but are gone in the redesign — they live on dedicated pages now:

| Removed | Where it went | Why |
|---------|--------------|-----|
| Status Breakdown pie chart | Analytics page (Module 5) | Dashboard is for KPIs/alerts, not charts |
| City-Wide Trend line chart | Analytics page (Module 5) | Same — charts belong on Analytics |
| Live City Map widget | City Map page (Module 2) | Map deserves full-screen treatment |
| SLA Policy edit card | SLA Management page (Module 4) | Configuration lives with the breach monitor |

---

#### Section 1.7 — Final Layout Order (top to bottom)

```
┌─────────────────────────────────────────────────────────────┐
│ Section 1.1 — Top Bar                                       │
│ "SJDM Command Center" + date         [Export Analytics CSV] │
├─────────────────────────────────────────────────────────────┤
│ Section 1.2 — KPI Cards (4 across)                          │
│ ┌────────┐ ┌────────────┐ ┌──────────┐ ┌────────────┐       │
│ │ Total  │ │  Active/   │ │  Teams   │ │  Success   │       │
│ │Reports │ │  Pending   │ │ Deployed │ │   Rate     │       │
│ │  142   │ │     23     │ │    8     │ │    74%     │       │
│ └────────┘ └────────────┘ └──────────┘ └────────────┘       │
├─────────────────────────────────────────────────────────────┤
│ Section 1.3 — SLA Breach Alert (full width)                 │
│ ⚠  SLA Breaches: 4 (Low:7d / Med:5d / High:3d)              │
│    [EW-0034 · 8d · Muzon] [EW-0041 · 6d · ...]   [Manage →] │
├─────────────────────────────────────────────────────────────┤
│ Section 1.4 — Today's Snapshot (slim, full width)           │
│ + 12 new today    🚛 5 deployed today    ✓ 8 resolved today │
├─────────────────────────────────────────────────────────────┤
│ Section 1.5 — Two-Column Bottom Grid                        │
│ ┌──────────────────────────┐ ┌────────────────────────────┐ │
│ │ BARANGAY RANKINGS        │ │ LIVE CITY FEED             │ │
│ │ 1. Muzon          92%    │ │ ● Report EW-0042           │ │
│ │ 2. San Roque      85%    │ │   Muzon · 14:32 [resolved] │ │
│ │ 3. Sto. Cristo    78%    │ │ ● Report EW-0041           │ │
│ │ 4. Tungkong Mangga 71%   │ │   San Jose · 14:28 [dep.]  │ │
│ │ 5. Kaybanban      65%    │ │ ... (10 entries total)     │ │
│ │ [View All Barangays →]   │ │                            │ │
│ └──────────────────────────┘ └────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

#### Section 1.8 — Data Sources Summary

| API Endpoint | Used For |
|--------------|----------|
| `GET /analytics/overview` | KPI card values (total, deployed, resolved counts) |
| `GET /analytics/barangay-ranking` | Barangay Rankings list (top 5) |
| `GET /reports/sla-breaches` | SLA Breach Alert (count + top 3) |
| `GET /config/sla` | SLA policy thresholds shown in alert header |
| `GET /reports/recent?limit=200` | Today's Snapshot stats + Live City Feed |
| `GET /reports/export` (triggered on click) | Export Analytics CSV button |

**No new endpoints needed.** Everything required already exists in the backend.

---

### 2. City Map

**What it is:**
The spatial intelligence view of SJDM. Where are the garbage problems geographically? Which zones are hotspots? This is different from the Dashboard — the Dashboard shows numbers, this shows the actual map. Full-screen, immersive.

**What should be on it:**

- **Left panel (collapsible sidebar ~280px wide):**
  - Total active reports count
  - Active hotspot clusters count
  - City success rate %
  - **Filter controls:**
    - Status dropdown (All / Pending / Verified / Deployed / Resolved)
    - Date range picker (From → To)
  - **Map legend:**
    - Pin colors by status (red = pending, yellow = deployed, green = resolved)
    - Hotspot ring guide (intensity levels)

- **Main area (full remaining width):**
  - Leaflet map fixed to SJDM bounding box
  - Barangay polygon overlays (59 barangays, colored by report density — low density = light, high density = dark red)
  - Report pins on the map (color-coded by status)
  - DBSCAN hotspot circles (red rings showing garbage concentration zones)
  - **Interactions:**
    - Click a barangay polygon → tooltip shows: barangay name, report count, resolution rate
    - Click a report pin → popup with: Tracking ID, status, days open, barangay, "View in Reports →" link
    - Zoom/pan freely within SJDM

---

### 3. Reports

**What it is:**
The primary intervention table. This is where CENRO reviews individual reports across all barangays and exercises override authority: reassign a report to the correct barangay, or force-close a report that's been stuck. Every CENRO action logged automatically.

**What should be on it:**

- **Filter bar (sticky, always visible at top):**
  - Search input: searches by Tracking ID or report notes (debounced 300ms)
  - Status dropdown: All / Pending / Verified / Deployed / Resolved / Failed Cleanup / Rejected
  - Barangay dropdown: All + list of all 59 barangays
  - Date range: "From" date + "To" date
  - "Clear Filters" button

- **Report Table:**
  | Column | Description |
  |--------|-------------|
  | Tracking ID | EW-XXXX format, clickable |
  | Barangay | Assigned barangay name |
  | Status | Colored pill (Pending/Verified/Deployed/Resolved/etc.) |
  | SLA | Days open badge — green ≤2d, yellow 3–4d, red ≥5d |
  | AI Confidence | Percentage from Mask R-CNN |
  | Submitted | Date submitted |
  | Actions | "Reassign" button + "Force Close" button per row |

- **Pagination:** 50 reports per page, Previous/Next controls, "Showing X–Y of Z"

- **Empty state:** "No reports match your filters — try adjusting the search or clearing filters"

- **Reassign Modal (opens from row):**
  - Heading: "Reassign Report [EW-XXXX]"
  - Current barangay shown (read-only)
  - Barangay dropdown to select new barangay
  - Reason textarea (required — "why are you reassigning?")
  - "Confirm Reassign" button (triggers API + writes audit log)
  - "Cancel" button

- **Force Close Modal (opens from row):**
  - Warning: "This permanently marks the report as Resolved. Use only when cleanup is confirmed but unlogged."
  - Reason textarea (required)
  - "Confirm Force Close" button (red — triggers API + writes audit log)
  - "Cancel" button

---

### 4. SLA Management

**What it is:**
Service Level Agreement monitoring and configuration. CENRO sets how many days each priority level has for resolution. Reports that exceed those days are "SLA breaches" — a compliance and accountability concern. This page has two parts: seeing current breaches, and configuring the thresholds.

**What should be on it:**

**Two sub-tabs within the page:** `Breach Monitor` | `Configuration`

---

**Sub-tab: Breach Monitor**

- **Header stats:**
  - Total Breaches (big number, red if >0, green if 0)
  - "As of [timestamp]" + Refresh button
- **Breach Table:**
  | Column | Description |
  |--------|-------------|
  | Tracking ID | EW-XXXX |
  | Barangay | Assigned barangay |
  | Priority | Colored pill: Low (green) / Medium (yellow) / High (red) |
  | Days Open | Number — the older the worse |
  | Status | Current report status |
  | Action | "Manage" button → opens in Reports view |
  - Sorted by Days Open, descending (worst first)
- **Empty state (shown when zero breaches, make it green/positive):**
  "All reports are within SLA thresholds. Barangays are performing well."

---

**Sub-tab: Configuration**

- **SLA Thresholds card:**
  - Three rows: Low Priority | Medium Priority | High Priority
  - Each row shows current value in days + edit input field
  - "Save Changes" button → calls `PUT /config/sla` → success toast
  - Example: Low = 7 days, Medium = 5 days, High = 3 days

- **Severity Classification card (informational — no DB edit needed):**
  - Heading: "What each priority level means"
  - Three blocks explaining garbage severity:
    - **Low** — General litter: plastic bottles, paper, scattered trash. No immediate health or environmental hazard. Standard cleanup window applies.
    - **Medium** — Bulk waste: old appliances, construction debris, accumulated residential garbage. Aesthetic blight, minor leachate risk. Escalated priority.
    - **High** — Health hazard: decomposing organic waste (nangangamoy, may langgam at insekto), industrial chemicals, medical/biohazard waste. Active risk of disease spread (nagkakasakit yung mga residente sa paligid). Urgent response required.
  - This is a static info panel — explains the classification system to CENRO officers and serves as the policy reference.

---

### 5. Analytics

**What it is:**
The data intelligence page. Trends, comparisons, and insights over time. This is where the charts live — separate from Dashboard so the landing page stays clean and this page can go deep. Useful for monthly CENRO reports and council presentations.

**What should be on it:**

- **Date range filter (top of page, affects all charts below):**
  - Quick presets: Last 7 days / Last 30 days / Last 3 months / Custom range
  - Custom date pickers (From → To)
  - "Apply" button

- **Row 1 — Summary cards (3 across):**
  - Total reports in selected period
  - Average resolution time (days) in period
  - SLA compliance rate % (reports resolved within SLA / total resolved)

- **Row 2 — Trend chart (full width):**
  - Line chart: Daily report submissions over the selected period
  - Multiple lines: Total submitted / Resolved / Deployed (so you can see throughput)
  - X-axis: dates | Y-axis: count
  - Tooltip on hover showing exact numbers

- **Row 3 — Two charts side by side:**
  - **Left — Barangay Report Volume (horizontal bar chart):**
    - Top 10 barangays by total reports in period
    - Bars colored by resolution rate (green = high, red = low)
  - **Right — Status Distribution (pie/donut chart):**
    - Current status breakdown across all reports: Pending, Verified, Deployed, Resolved, Failed, Rejected

- **Row 4 — Barangay Performance Table (full width):**
  | Barangay | Total | Pending | Deployed | Resolved | Resolution Rate | Rating |
  |---------|-------|---------|---------|---------|-----------------|--------|
  - Sortable by any column (click header)
  - Resolution Rate colored: green ≥70%, yellow 40–69%, red <40%
  - Rating: "High Performer" / "Needs Monitoring" / "Critical" based on rate

- **Export button (top right):** "Export CSV" → downloads full analytics table

---

### 6. Barangay Management

**What it is:**
City-wide view of all 59 barangays and their performance. CENRO uses this to monitor which barangays are keeping up with reports and which need intervention. Clicking a barangay gives a quick drill-down without leaving the page.

**What should be on it:**

- **Header:** "Barangay Management — 59 Barangays, SJDM" + search input (filter table by name)

- **Barangay Table:**
  | Barangay | Total Reports | Pending | Deployed | Resolved | Res. Rate | Status |
  |---------|--------------|---------|---------|---------|-----------|--------|
  - Resolution Rate: colored (green/yellow/red thresholds)
  - Status pill: "On Track" (green) / "At Risk" (yellow) / "Critical" (red)
  - Row is clickable

- **Drawer panel (slides in from right when row clicked):**
  - Barangay name as heading + status badge
  - Stats recap (same as table columns)
  - "View Reports" button → navigates to Reports module, pre-filtered to this barangay
  - "View Accounts" button → navigates to Accounts module, pre-filtered to this barangay
  - Mini report preview: top 3 oldest pending reports for this barangay
    - Format: [EW-XXXX] — [X] days open — [Status]

---

### 7. Evidence Gallery

**What it is:**
Visual proof of the report lifecycle. Every report has up to 3 images: the original complaint photo, the AI-processed detection mask, and the cleanup proof photo. This page shows them side by side in a grid. Impressive for demo — shows the full before/after story.

**What should be on it:**

- **Filter bar:**
  - Barangay dropdown
  - Status dropdown (show only Resolved / show all)
  - Date range picker

- **Photo Grid (3 columns):**
  - Each card represents one report:
    - **Top:** Tracking ID pill + Status badge + Barangay name
    - **Image row (3 thumbnails side by side):**
      - "Original" — citizen's submission photo
      - "AI Detection" — Mask R-CNN overlay with garbage detected region highlighted
      - "Cleanup Proof" — barangay's after-photo (greyed out / placeholder if not resolved yet)
    - **Footer:** Date submitted, AI Confidence %, cleanup date (if resolved)
    - Click any thumbnail → lightbox full-screen view with caption

- **Empty state:** "No evidence photos to display — adjust filters or check if reports have been resolved"

---

### 8. Audit Log

**What it is:**
The accountability and compliance trail. Every CENRO override action — reassigning a report, force-closing, creating an account, disabling an account, changing SLA thresholds — is recorded here automatically with who did it, when, and what changed. This is the answer to the Q&A question: "How do you prevent abuse of admin power?"

**What should be on it:**

- **Filter bar:**
  - Action type dropdown: All / Reassign / Force Close / Create User / Disable User / Update SLA / Deploy Override / Resolve Override

- **Audit Table:**
  | Timestamp | User (email) | Action | Target | Details |
  |----------|-------------|--------|--------|---------|
  - Timestamp: full date + time
  - Action: colored pill
    - Reassign = blue
    - Force Close = red
    - Create User = green
    - Disable User = orange
    - Update SLA = purple
  - Target: what was acted on (e.g., "Report EW-0042" or "User barangay@sjdm.gov.ph")
  - Details: expandable row — click to expand and see the full detail JSON (shows old value → new value, reason given, etc.)

- **Pagination:** 50 entries per page, "Load More" button at bottom

- **Empty state:** "No audit entries yet — actions taken by CENRO officers will appear here"

---

### 9. Accounts

**What it is:**
User account management for the entire system. CENRO creates and manages barangay coordinator accounts and cleaner accounts. If a coordinator leaves, CENRO disables the account here. If a new barangay needs to be onboarded, CENRO creates an account here.

**What should be on it:**

- **Header:** "System Accounts" + "+ Add Account" button (top right)

- **Filter bar:**
  - Role dropdown: All / Barangay Coordinator / Cleaner
  - Barangay dropdown: filter to specific barangay
  - Status toggle: Active / Disabled / All

- **Accounts Table:**
  | Name | Email | Role | Barangay | Status | Action |
  |------|-------|------|---------|--------|--------|
  - Role: colored pill (Coordinator = blue, Cleaner = grey)
  - Status: Active (green) / Disabled (red/grey)
  - Action: "Disable" button (for active accounts), "Enable" button (for disabled accounts)

- **Disable Confirmation Dialog:**
  - "Are you sure you want to disable [name]? They will no longer be able to log in."
  - "Confirm Disable" (red) + "Cancel"

- **Add Account Modal:**
  - Fields: Email address, Full Name, Role (dropdown: Barangay Coordinator / Cleaner), Barangay Assignment (dropdown of all 59)
  - "Create Account" button
  - On success → system auto-generates a temporary password

- **Temp Password Modal (shown after creation):**
  - "Account created successfully"
  - Shows the generated password in a highlighted box
  - "Copy to Clipboard" button
  - Warning: "This password will only be shown once. Share it with the user securely."
  - "Done" to dismiss

---
---

## Barangay Portal — Module List

**Sidebar order (top to bottom):**
1. Dashboard
2. Reports
3. Map View
4. My Team

**Sidebar bottom (always visible):**
- Dark Mode / Light Mode toggle
- User avatar + full name + "[Barangay Name]" label
- Sign Out button

---

### 1. Dashboard

**What it is:**
The landing page for a barangay coordinator. Shows the current health of their jurisdiction at a glance — how many reports are pending, how their team is performing on SLA, and a live map of their barangay. Equivalent to CENRO's Dashboard but scoped to one barangay.

**What should be on it:**

**Layout: Two-column (60% left, 40% right)**

- **Left column:**
  - Header: "[Barangay Name] — Coordinator Dashboard" + today's date + "Export CSV" button
  - **Stat cards (3 across):**
    | Card | Value |
    |------|-------|
    | Pending Reports | Verified reports needing team dispatch |
    | Active Deployments | Reports with deployed teams in the field |
    | Total Resolved | Lifetime resolved count |
  - **SLA Performance card:**
    - % of reports resolved within SLA threshold
    - Breach count with red badge if >0
    - "View Breaches →" — shows which reports are overdue
  - **Recent Reports (last 5):**
    - Mini list: Tracking ID | Status pill | Days open
    - "View All Reports →" button

- **Right column:**
  - Live Leaflet map focused on their barangay (boundary highlighted in emerald)
  - Report pins visible (color-coded by status)
  - "Open Full Map →" link to Map View module

---

### 2. Reports

**What it is:**
The core work page. Every report assigned to this barangay lives here. The coordinator reviews incoming reports, dispatches cleanup teams, and marks completed cleanups as resolved. The report lifecycle happens entirely here.

**What should be on it:**

- **Page header:** "[Barangay Name] — Reports" + "Export CSV" button

- **Filter bar (sticky):**
  - Search input: by Tracking ID or notes (debounced 300ms)
  - Date range pickers (From → To)
  - "Clear Filters" button

- **Status tabs (within the page — not sidebar items):**
  `Pending` | `Deployed` | `Done` | `All`
  - Pending = Verified reports awaiting team dispatch
  - Deployed = Reports with active cleanup teams
  - Done = Resolved reports
  - All = Everything

- **Report Table:**
  | Column | Description |
  |--------|-------------|
  | Tracking ID | EW-XXXX |
  | Submitted | Date submitted |
  | Status | Colored pill |
  | SLA | Days open badge (green/yellow/red) |
  | AI Confidence | % from Mask R-CNN |
  | Manage | Button → opens Report Detail Modal |

- **Report Detail Modal (full-featured):**

  Two-column layout:

  *Left column:*
  - Mini map showing exact pin location of the report
  - Citizen notes (if any, in italic)
  - Deployment notes (if already deployed — who was sent, when)
  - Submission timestamp

  *Right column:*
  - Large evidence photo with AI confidence % overlay badge
  - **Action area — changes based on report status:**

    **If status = Verified (needs deployment):**
    - Priority selector: Low / Medium / High (each shows the SLA days)
    - "Assign To" dropdown: active cleaners from My Team
    - Deployment notes textarea (optional — "who was dispatched, what route")
    - "Deploy Cleanup Team" button (emerald green)

    **If status = Deployed or Failed Cleanup (needs proof):**
    - File upload area: "Upload Cleanup Photo" (drag/drop or click to browse)
    - Image preview thumbnail after selecting
    - If Failed Cleanup: red warning banner "Previous cleanup attempt failed — garbage still detected. Ensure thorough cleanup before submitting."
    - "Mark as Resolved" button → triggers AI re-verification

    **If status = Resolved:**
    - Green checkmark + "Cleanup Verified" text
    - Cleanup proof image thumbnail
    - Resolution timestamp

---

### 3. Map View

**What it is:**
Full-screen map focused on the barangay's jurisdiction. The barangay coordinator can see exactly where each report is on the map, filter by status, and click pins to manage reports directly from the map.

**What should be on it:**

- **Top filter bar (overlay on map):**
  - Status filter: All / Pending / Deployed / Resolved
  - Small legend showing pin colors

- **Map (full height and width):**
  - Leaflet map
  - Barangay polygon outline highlighted (emerald green border)
  - Report pins on the map, color-coded by status
  - **Click a report pin → popup shows:**
    - Tracking ID
    - Status pill
    - Days open
    - "Manage" button → opens Report Detail Modal (same modal as in Reports module)

---

### 4. My Team

**What it is:**
Cleanup team management. The barangay coordinator manages their team of cleaners here — adding new members when someone joins, disabling accounts when someone leaves. Cleaners are assigned to reports in the Deploy action.

**What should be on it:**

- **Header:** "My Cleanup Team — [Barangay Name]" + "+ Add Cleaner" button

- **Team Table:**
  | Name | Email | Status | Action |
  |------|-------|--------|--------|
  - Status: Active (green pill) / Disabled (grey pill)
  - Action: "Disable" button for active members

- **Disable Confirmation Dialog:**
  - "Are you sure you want to disable [name]? They can no longer be assigned to reports."
  - "Confirm" (red) + "Cancel"

- **Add Cleaner Modal:**
  - Fields: Email address, Full Name
  - Barangay assignment is auto-filled (the coordinator's own barangay)
  - "Create Cleaner Account" button
  - On success → temp password modal (same pattern as CENRO Accounts)

- **Temp Password Modal:**
  - Shows generated password in highlighted box
  - "Copy to Clipboard" button
  - "This will only be shown once" warning
  - "Done" to close

---

## Summary — Total Modules

| Portal | Module Count | Modules |
|--------|-------------|---------|
| CENRO | 9 | Dashboard, City Map, Reports, SLA Management, Analytics, Barangay Management, Evidence Gallery, Audit Log, Accounts |
| Barangay | 4 | Dashboard, Reports, Map View, My Team |
| **Total** | **13** | |

---

## Shared Design Decisions

| Decision | Choice |
|----------|--------|
| Navigation | Left sidebar (fixed, always visible) |
| Active state | Emerald green background + white text on active sidebar item |
| Sidebar width | 240px expanded (desktop), icon-only on mobile |
| Theme toggle | Bottom of sidebar — sun/moon icon toggle |
| Color system | Existing: emerald green accent, dark background, glassmorphism cards |
| Notifications | Toast (sonner) — success (green), error (red), warning (yellow) |
| Empty states | Every table/list has a friendly empty state with icon + message |
| Confirmation | All destructive actions (disable, force close) require a confirmation dialog |
| Pagination | 50 rows per page on all tables |
| SLA badges | Reusable component: green ≤2d, yellow 3–4d, red ≥5d |
| Status pills | Reusable component with consistent colors across both portals |
