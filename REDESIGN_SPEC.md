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

### 1. Dashboard

**What it is:**
The first page a CENRO officer sees when they log in. It's the city pulse — a high-level command view showing the current state of all reports across SJDM at a glance. NOT a charts/analytics page (that's module 5). Think of it as the "situation room" — numbers, alerts, and quick context.

**What should be on it:**

- **Page header:** "SJDM EcoWatch — Command Center" + today's date
- **Export button** (top right): Downloads analytics CSV of all reports

**KPI Row (4 stat cards across the top):**
| Card | Value |
|------|-------|
| Total Reports | All-time count |
| Active Reports | Pending + Verified + Deployed combined |
| Resolved | Total resolved count + success rate % |
| Avg. Resolution | Average days from submission to resolution |

**Alert Row (2 cards side by side):**
- **SLA Breach Alert card** (red border if breaches exist):
  - Big number: how many reports are currently past SLA
  - List of top 3 oldest breaching reports (Tracking ID, Days Open, Barangay)
  - "Manage Breaches →" link that navigates to SLA Management module
- **Recent Activity Feed card:**
  - Last 10 events across the city (report submitted, team deployed, resolved, override made)
  - Format: "[timestamp] [EW-0042] was deployed in Muzon"
  - Auto-refreshes (or manual refresh button)

**Quick Metrics Row (3 smaller cards):**
- Status breakdown (small donut/pie: pending vs deployed vs resolved)
- Top performing barangay this month (name + resolution rate %)
- Reports this week vs last week (number + trend arrow up/down)

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
