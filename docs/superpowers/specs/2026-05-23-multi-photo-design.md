# Multi-Photo Reports & Cleanup Verification — Design Spec

**Date:** 2026-05-23
**Branch:** defense-sprint
**Status:** Approved

---

## Problem

Currently each report accepts exactly one evidence photo, and each cleanup submission accepts exactly one proof photo. A single photo is often insufficient to capture a large or spread-out dump site from different angles, and a single cleanup photo may not convince the AI verifier. This spec adds multi-photo support (up to 5 photos each) without breaking existing records.

---

## Goals

1. Citizens can upload 1–5 evidence photos per report.
2. Cleaners can upload 1–5 cleanup proof photos per work order completion.
3. AI runs on all uploaded photos; **any single photo passing the 0.5 threshold** is enough to pass the batch (ANY-wins aggregation).
4. If some photos in a batch fail to save (disk error, decode error), the working ones are saved and the submission proceeds — bad photos are silently dropped, not fatal.
5. Existing single-photo records remain intact via a startup migration that copies `image_url` / `cleanup_image_url` into the new tables.

---

## Out of Scope

- Deleting individual photos after upload
- Photo ordering / reordering
- Per-photo captions
- Video uploads

---

## Database Schema

### New table: `report_photos`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK AUTOINCREMENT | |
| `report_id` | INTEGER FK → reports.id NOT NULL | |
| `file_path` | VARCHAR NOT NULL | relative path under `uploads/` |
| `ai_confidence` | FLOAT NULL | null = not yet verified |
| `ai_verified` | BOOLEAN NULL | null = pending |
| `ai_mask_path` | VARCHAR NULL | path to generated mask image |
| `uploaded_at` | DATETIME default now | |

### New table: `cleanup_photos`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK AUTOINCREMENT | |
| `work_order_id` | INTEGER FK → work_orders.id NOT NULL | |
| `file_path` | VARCHAR NOT NULL | |
| `ai_confidence` | FLOAT NULL | |
| `ai_verified` | BOOLEAN NULL | |
| `uploaded_at` | DATETIME default now | |

### Existing columns kept (backward compat)

`reports.image_url`, `reports.ai_mask_url`, `reports.ai_confidence`, `reports.cleanup_image_url` are **not removed**. The startup migration copies their values into the new tables if the new tables are empty for that record. The old columns continue to hold the "primary" (first) photo for API consumers that haven't been updated yet.

---

## AI Aggregation Logic

```
results = verify_images_async([photo1_bytes, photo2_bytes, ...])
any_verified = any(r["verified"] for r in results)
best = max(results, key=lambda r: r["confidence"])
```

- If `any_verified` is True → report/cleanup passes.
- `best.confidence` is stored as the report's `ai_confidence` (most confident passing result wins; if none pass, most confident failing result).
- `best.mask_bytes` is stored as `ai_mask_url` (first passing photo's mask).

---

## Partial Upload Failure Handling

When the server receives N files:
1. Attempt to read + save each file to disk independently inside a try/except.
2. Collect only the successfully saved file paths into a list.
3. If the list is non-empty → proceed with AI verification on the saved files.
4. If the list is empty (all failed to save) → return HTTP 422 "No photos could be saved. Please try again."

---

## API Changes

### `POST /report/submit`

- Accept `images: List[UploadFile]` (was `image: UploadFile`).
- Validate: 1 ≤ len(images) ≤ 5. Return 422 if outside range.
- Save each file, insert rows into `report_photos`.
- First saved path also written to `reports.image_url` (backward compat).
- Background task (`_bg_verify_submit`) reads `report_photos` rows, calls `verify_images_async`, updates each row + report aggregate columns.

### `POST /report/{id}/resolve`  (barangay)

- Accept `cleanup_images: List[UploadFile]` (was `cleanup_image: UploadFile`).
- Validate: 1 ≤ len ≤ 5.
- Save each file, insert rows into `cleanup_photos`.
- First saved path also written to `reports.cleanup_image_url`.
- Background task (`_bg_verify_resolve`) runs AI on the batch.

### `PUT /work-orders/{id}/complete`  (cleaner)

- Accept `cleanup_images: List[UploadFile]` (was `cleanup_image: UploadFile`).
- Validate: 1 ≤ len ≤ 5.
- Save each file, insert rows into `cleanup_photos` (work_order_id = wo.id).
- First saved path also written to `reports.cleanup_image_url` via the linked report.
- Background task (`_bg_verify_complete`) runs AI on the batch.

---

## Startup Migration

In `main.py`'s `@app.on_event("startup")`:

```python
def _migrate_single_photos_to_tables(db):
    # For each report with image_url set but no report_photos rows:
    #   INSERT INTO report_photos (report_id, file_path, ai_confidence, ai_verified, ai_mask_path)
    #   VALUES (report.id, report.image_url, report.ai_confidence,
    #           (report.ai_confidence >= 0.5 if not None else None), report.ai_mask_url)
    #
    # For each report with cleanup_image_url set but no cleanup_photos rows linked via its work order:
    #   Find the work order for this report, insert into cleanup_photos.
```

This runs once on startup — subsequent runs skip already-migrated records.

---

## Frontend Changes

### `frontend/app/report/page.tsx` — Step 2 (Camera)

- `<input type="file" multiple accept="image/*">` (add `multiple` attribute).
- `image: File | null` state → `images: File[]` state.
- Preview shows a horizontal scroll strip of thumbnails (up to 5).
- "Remove" button per thumbnail.
- `formData.append("images", file)` for each file in loop (was single `formData.append("image", image)`).

### `frontend/components/portal/CleanerJobDrawer.tsx`

- Complete button triggers `<input type="file" multiple accept="image/*">`.
- `onComplete(workOrderId, image: File)` prop signature → `onComplete(workOrderId, images: File[])`.
- Preview strip (same as report form).
- FormData appends each file under key `"cleanup_images"`.

### `frontend/app/cleaner/page.tsx`

- `handleComplete(workOrderId, image: File)` → `handleComplete(workOrderId, images: File[])`.
- `formData.append("cleanup_image", image)` → loop appending `"cleanup_images"`.

### `frontend/app/track/[id]/page.tsx`

- If `report.photos` array present (new API field), render a horizontal photo strip below the main evidence photo.
- Fallback: if `report.photos` absent, render single `report.image_url` as before (backward compat).

### `GET /report/track/{tracking_id}` response

- Add `photos: list[{url, ai_confidence, ai_verified}]` field.
- Populated from `report_photos` rows.

---

## Files to Create / Modify

| File | Action | Summary |
|------|--------|---------|
| `backend/models.py` | **Modify** | Add `ReportPhoto` and `CleanupPhoto` SQLAlchemy models |
| `backend/main.py` | **Modify** | Startup migration, 3 endpoint updates, track response update |
| `frontend/app/report/page.tsx` | **Modify** | Multi-file picker + preview strip in step 2 |
| `frontend/components/portal/CleanerJobDrawer.tsx` | **Modify** | Multi-file picker + updated `onComplete` prop |
| `frontend/app/cleaner/page.tsx` | **Modify** | Update `handleComplete` signature + FormData loop |
| `frontend/app/track/[id]/page.tsx` | **Modify** | Render `photos` array if present |

---

## Testing Checklist

- [ ] Submit report with 1 photo → still works exactly as before
- [ ] Submit report with 3 photos → all saved, AI runs on all, any-wins logic applied
- [ ] Submit report with 5 photos → boundary check passes
- [ ] Submit report with 6 photos → server returns 422
- [ ] One of 3 photos is corrupt → 2 saved, AI runs, submission succeeds
- [ ] All photos corrupt → 422 returned
- [ ] Old report (single image_url, no report_photos rows) → startup migration backfills it
- [ ] Track page shows photo strip for multi-photo report
- [ ] Track page still works for old single-photo reports
- [ ] Cleaner uploads 2 cleanup photos → both saved, AI batch runs
