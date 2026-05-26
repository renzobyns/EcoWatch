# Report Status Lifecycle Redesign + Map Coloring

**Date:** 2026-05-26
**Status:** Approved

## Problem

The current report status flow (`pending → verified → deployed → resolved | failed_cleanup`) has three issues:

1. `deployed` is semantically wrong — it doesn't communicate that a cleaner has been *assigned*.
2. There is no `in_progress` state — once a cleaner starts cleaning, no report-level status reflects active work.
3. Map coloring is broken — `pending`, `verified`, and `failed_cleanup` all show as red; users cannot tell them apart.

## New Status Lifecycle

```
(citizen submits)
       ↓
   pending ──AI──→ rejected  (terminal; gray on map)
       ↓
   verified
       ↓  barangay creates work order
   assigned
       ↓  cleaner starts job
  in_progress
       ↓  cleaner uploads cleanup photos; AI verifies
  resolved              failed_cleanup
  (terminal)                ↓  barangay retries
                         assigned  ← loops back

CENRO force-close: any status → resolved
```

`deployed` is removed entirely from the enum and codebase.

## Transition Table

| From | To | Actor | Mechanism |
|---|---|---|---|
| (new) | `pending` | Citizen | `POST /report/submit` |
| `pending` | `verified` / `rejected` | AI | `_bg_verify_submit` background task |
| `verified` | `assigned` | Barangay | `POST /work-orders` OR `PUT /report/{id}/assign` |
| `assigned` | `in_progress` | Cleaner | `PUT /work-orders/{id}/start` (line 2068) |
| `in_progress` | `resolved` / `failed_cleanup` | AI | `_bg_verify_complete` background task |
| `failed_cleanup` | `assigned` | Barangay retries | `PUT /report/{id}/retry` (new endpoint) |
| any | `resolved` | CENRO | `PUT /report/{id}/force-close` (unchanged) |

## Map Color Scheme (severity gradient)

| Status | Color | Hex |
|---|---|---|
| `pending` | Red | `#ef4444` |
| `verified` | Orange | `#f97316` |
| `assigned` | Yellow | `#eab308` |
| `in_progress` | Blue | `#3b82f6` |
| `resolved` | Green | `#22c55e` |
| `failed_cleanup` | Dark Red | `#b91c1c` |
| `rejected` | Gray | `#6b7280` |

Same color logic applies to status badges across all portals.

## Files Changed

| File | Change |
|---|---|
| `backend/models.py` | Remove `DEPLOYED`, add `ASSIGNED` + `IN_PROGRESS` to `ReportStatus` enum |
| `backend/main.py` | All status references, WO start trigger, new retry endpoint |
| `frontend/components/MapComponent.tsx` | Pin color map |
| `frontend/app/cenro/page.tsx` | Badge colors, filter dropdowns |
| `frontend/app/barangay/page.tsx` | Badge colors, filter dropdowns, retry button |

## Notes

- WorkOrder statuses (`assigned`, `in_progress`, `needs_redo`, `completed`, `verified`) are **not changed**.
- `rejected` status is unchanged — gray on the map.
- Dev SQLite DB should be wiped and re-seeded after backend changes.
