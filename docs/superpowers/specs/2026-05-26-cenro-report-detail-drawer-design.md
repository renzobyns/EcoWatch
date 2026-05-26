# CENRO Report Detail Drawer — Design Spec

**Date:** 2026-05-26
**Author:** Renzo (with Claude)
**Status:** Approved — ready for implementation plan

---

## Problem

The CENRO **Global Report Queue** (`/cenro` → Reports tab) currently exposes a single small "Oversight" button per row that opens a centered modal containing only two actions: reassign barangay and force-close. The modal shows no evidence photos, no reporter info, no work-order history, and no audit timeline.

CENRO operators need a single place to inspect a report in depth — evidence, reporter, location, trust signals, all work orders for it, and the override history — without leaving the queue. The existing per-row affordance is also under-discoverable (a small button in an "Action" column).

The `BarangayDetailDrawer` on the same page already establishes a rich right-side drawer pattern (480px, tabbed, lazy-loaded). The report detail experience should mirror it.

## Goals

1. Clicking **any cell of a row** in the Global Report Queue opens a right-side drawer showing the full detail of that report.
2. Drawer is visually and structurally consistent with `BarangayDetailDrawer.tsx` (480px wide, slide-in, tabbed, lazy-loaded, footer actions).
3. All current oversight actions (reassign barangay, force-close) move into the drawer footer; the dedicated **Oversight** button column is removed.
4. Drawer surfaces information the current modal hides: citizen photo + AI mask side-by-side, reporter info, location, trust score, work orders, audit timeline.

## Non-goals

- No new analytics or aggregations.
- No edit-in-place for fields other than the two existing overrides (reassign, force-close).
- No map tab. Lat/lon shown as text + "Open in Maps" link only.
- No real-time updates (drawer reads fresh on open; existing list refresh handles staleness).

---

## UI changes — `frontend/app/cenro/page.tsx`

### Table changes (Oversight tab, around lines 1304–1376)

- **Remove the `Action` column** (header + every row's `<td>` with the Oversight button). The right edge becomes the Date Reported column.
- Make the `<tr>` clickable: add `onClick={() => { setSelectedReport(report); setNewBarangay(report.barangay); }}` and `className="... cursor-pointer hover:bg-foreground/5"` (hover state already exists).
- Keep all filter state, table layout, SLA pill, status pill exactly as-is.

### Modal removal

- **Delete the JSX block** at [cenro/page.tsx:1757-1827](frontend/app/cenro/page.tsx#L1757-L1827) ("Oversight Detail Modal").
- Keep all related state and handlers: `selectedReport`, `newBarangay`, `handleReassign`, `handleForceClose`. They are wired into the new drawer's footer.

### Drawer mount

- Mount `<ReportDetailDrawer>` once at the page level, alongside the existing `<BarangayDetailDrawer>` (around line 954). Props:
  - `open={selectedReport !== null}`
  - `report={selectedReport}`
  - `newBarangay`, `setNewBarangay`
  - `onClose={() => setSelectedReport(null)}`
  - `onReassign={() => handleReassign(selectedReport!.id)}`
  - `onForceClose={() => handleForceClose(selectedReport!.id)}`
  - `actionLoading`

---

## New component — `frontend/components/portal/ReportDetailDrawer.tsx`

Modeled on `BarangayDetailDrawer.tsx` (same file structure: top-level component + four sub-tab components + shared `TabLoading` / `TabError` / `TabEmpty` helpers, copied verbatim or extracted to a shared util).

### Layout (matches BarangayDetailDrawer exactly)

```
┌─────────────────────────────────────────┐
│ Header: Report EW-XXXX  [STATUS PILL] ✕ │
│         Barangay · Reported 5/26/2026   │
├─────────────────────────────────────────┤
│ [Overview] [Evidence] [Work Orders] [..]│  ← tab strip
├─────────────────────────────────────────┤
│                                         │
│   Tab content (scrollable)              │
│                                         │
├─────────────────────────────────────────┤
│ [Reassign Barangay ▾] [Force Close]     │  ← footer
└─────────────────────────────────────────┘
```

- 480px max width, slide-in from right, dimmed backdrop (`bg-black/70`), close on backdrop click.
- Header text uses the same typography ramp as `BarangayDetailDrawer` (lg bold name, status pill, foreground/40 sub-line).

### Tabs

#### 1. Overview (no extra fetch — reads `selectedReport` directly)

Five stacked cards using the `glass-pro` style:

| Card | Contents |
|---|---|
| **Status & ID** | Large status pill, tracking ID, current barangay, reported timestamp, deployed timestamp (if any), resolved timestamp (if any). |
| **Reporter** | Avatar (initial), full name, email, phone. If `reporter_id` is null → "Anonymous report" placeholder. |
| **Location** | `lat, lon` numeric coords + button **"Open in Maps"** (target `https://www.google.com/maps?q=<lat>,<lon>`, opens in new tab). |
| **AI Verification** | Reuse existing `TrustBadge` component (`trust_score`, `failing_signals`, `needs_human_review`). Below it: `ai_confidence` as a percentage. |
| **Notes** | Two labeled blocks. **Citizen notes** = `notes`. **Deployment notes** = `deployment_notes`. Each block omitted if its field is empty. |

#### 2. Evidence (lazy-fetched: `GET /reports/{id}/detail` — see backend section)

- **Citizen photo block**: original photo + AI-mask overlay shown side-by-side on desktop, stacked on narrow widths. Each photo is `<img>` with `cursor-pointer`; click → lightbox (reuse `ImageLightbox` if present, else simple full-screen overlay).
- AI confidence percentage displayed under the mask image.
- If `report_photos` returns multiple citizen photos: render each as a "citizen photo + mask" pair, top-to-bottom.
- **Cleanup proof block** (below citizen photos): list of `cleanup_photos`, each with timestamp + cleaner name + AI confidence + verified/failed pill. Hidden if list is empty.
- Empty state when both lists are empty: "No evidence uploaded yet."

#### 3. Work Orders (data from the same `/reports/{id}/detail` payload)

- Vertical list, newest first, of every `WorkOrder` belonging to this report (multi-WO case for failed_cleanup → redo).
- Per row card (`glass-pro` rounded-xl):
  - Top line: priority pill + status pill + created-at (relative)
  - Cleaner: full name + email
  - SLA deadline (formatted date)
  - Started / completed timestamps if present
  - WO notes if present
- Empty state: "No work orders assigned yet."

#### 4. Timeline (lazy-fetched: `GET /audit-log?target_id=<report.id>`)

- Chronological list (newest first) of audit-log entries scoped to this report.
- Per entry:
  - Action label (e.g. `Reassign`, `Force Close`, `Deploy`, `Resolve`) — normalized to title case with spaces.
  - User email (or "System" if `user_id` null).
  - Relative timestamp.
  - Parsed `details` rendered as a small key/value list (e.g. `from: Muzon`, `to: San Roque`, `reason: …`).
- Empty state: "No override actions recorded for this report."

### Footer actions

Mirrors the BarangayDetailDrawer footer layout (lines 354–385):

- **Reassign Barangay**: `<select>` of all barangays (default = current `report.barangay`) + emerald primary button **"Update Route"**. Disabled when value equals current barangay or `actionLoading` is true. Calls `onReassign`.
- **Force Close**: full-width red destructive button **"Force Close Ticket"**. Disabled when status is already `resolved` or `actionLoading` is true. Calls `onForceClose`.
- Both buttons inside a single footer row, vertically stacked (since the reassign control needs the full width for the select).

### State & lazy-load pattern (copied from BarangayDetailDrawer)

- `activeTab: "overview" | "evidence" | "work_orders" | "timeline"` — defaults to `"overview"`.
- Per-tab state: `data`, `loading`, `error`, `fetched`. Effect resets all four on `report?.id` change.
- Effect triggers fetch on tab switch only if `!fetched && !loading`.
- Evidence + Work Orders share a single `/reports/{id}/detail` fetch (one network call covers both tabs).
- Timeline uses a separate `/audit-log?target_id=<id>` fetch (different endpoint, kept independent).

---

## Backend changes — `backend/main.py`

### 1. New endpoint: `GET /reports/{id}/detail`

Returns one fully-hydrated report payload covering the Evidence + Work Orders tabs in a single round-trip. Role-guarded to `cenro` for now (barangay can extend later if reused).

**Response shape:**
```json
{
  "report": { ...ReportResponse fields, including photos[] },
  "cleanup_photos": [
    { "id", "url", "ai_confidence", "ai_verified", "uploaded_at",
      "work_order_id", "cleaner": { "id", "full_name", "email" } }
  ],
  "work_orders": [
    { "id", "priority", "status", "sla_deadline", "notes",
      "created_at", "started_at", "completed_at",
      "assigned_cleaner": { "id", "full_name", "email" } }
  ]
}
```

Implementation: ~30 lines. Joinedload `report_photos`, `cleanup_photos`, `work_orders` + cleaner. Reuse `serialize_work_order` for the work-order list. Reuse the photo-serialization block from the single-report endpoint at [main.py:1592-1604](backend/main.py#L1592-L1604).

### 2. Augment `GET /audit-log` with `target_id` filter

At [main.py:2504-2538](backend/main.py#L2504-L2538), add an optional `target_id: Optional[int] = None` parameter. When present, append `.filter(models.AuditLog.target_id == target_id)` to the query before pagination. ~3 lines.

No changes needed to the audit-log row shape — frontend uses existing fields (`action`, `user_email`, `details`, `created_at`).

---

## Data model — TypeScript types

In `frontend/lib/api.ts` or a co-located types file:

```ts
type ReportDetail = {
  report: QueueReport; // existing shape + photos[]
  cleanup_photos: CleanupPhoto[];
  work_orders: WorkOrder[];
};

type WorkOrder = {
  id: number;
  priority: "low" | "medium" | "high";
  status: "assigned" | "in_progress" | "completed" | "verified" | "needs_redo";
  sla_deadline: string;   // ISO
  notes: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  assigned_cleaner: { id: number; full_name: string; email: string };
};

type CleanupPhoto = {
  id: number;
  url: string;
  ai_confidence: number | null;
  ai_verified: boolean | null;
  uploaded_at: string;
  work_order_id: number | null;
  cleaner: { id: number; full_name: string; email: string } | null;
};
```

---

## Edge cases

| Case | Behaviour |
|---|---|
| Anonymous report (`reporter_id` null) | Overview shows "Anonymous report" card with no contact info. |
| No image yet (rare — async verification still pending) | Evidence tab shows skeleton + small "AI verification in progress…" line if `verification_pending` is true; otherwise "No evidence uploaded yet." |
| No work orders | Work Orders tab empty state, no fetch retry. |
| Report status changes while drawer is open | Drawer does not auto-refresh. After action (reassign/force-close), the existing list-level updater logic at [cenro/page.tsx:632,650](frontend/app/cenro/page.tsx) updates `queueReports`; the drawer reads from the new `selectedReport` (parent passes updated object). |
| Multiple citizen photos (multi-photo reports) | Each rendered as its own "photo + AI mask" pair, top-down in Evidence tab. |
| Lightbox closing | Close on backdrop click and `Esc` key. |
| Drawer open across status filter change | If the user changes filters and the open report is filtered out of the list, the drawer stays open until explicitly closed. |

---

## Out of scope (deliberately)

- Editing reporter, location, photos, notes, deployment notes from the drawer.
- Creating new work orders (CENRO uses barangay portal for that).
- Push notifications on report change.
- Map preview tab (lat/lon link suffices).
- Failing-signals detail page (`TrustBadge` already surfaces them).

---

## Acceptance criteria

1. Clicking any row in the Global Report Queue (CENRO) opens a 480px right-side drawer; backdrop dims; close on ✕ or backdrop click.
2. The "Action" column and "Oversight" button are removed from the queue table.
3. The old centered Oversight modal JSX is removed; no regression in reassign / force-close behavior.
4. Drawer header shows tracking ID + status pill + barangay + reported date.
5. Drawer has four tabs: **Overview**, **Evidence**, **Work Orders**, **Timeline**.
6. Overview shows reporter card, location card, trust badge + AI confidence, citizen + deployment notes.
7. Evidence shows citizen photo + AI mask side-by-side, plus cleanup proof photos if any.
8. Work Orders shows all WOs for the report with cleaner, priority, status, SLA.
9. Timeline shows audit log entries filtered to this report only (with backend filter wired up).
10. Drawer footer offers Reassign Barangay (select + Update Route) and Force Close Ticket. Disabled states match the old modal.
11. After a successful reassign or force-close, the queue list reflects the new status, and the drawer either updates or can be closed without inconsistency.
12. Anonymous reports show "Anonymous report" in place of the reporter card.
13. Tabs lazy-load on first activation; no network call for Timeline until that tab is opened.

---

## Open questions

None at spec-approval time.

## Risks

- **Endpoint bloat**: `/reports/{id}/detail` duplicates some serialization logic. Mitigation: extract the photo-list serializer into a shared helper.
- **480px drawer width on narrow laptops**: existing barangay drawer already lives at this width and works in the same page — same constraint applies, no new risk.
- **Audit log size**: filtering by `target_id` reads from an indexed column (`target_id` is already `index=True` in [models.py:146](backend/models.py#L146)); no performance concern.
