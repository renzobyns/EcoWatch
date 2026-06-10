# Module 3 — Duplicate Detection + Security Fix

## Corrections applied after self-critique (2026-06-11)

- **Drop the self-referential relationship** on `Report` — keep only the `duplicate_of_id` column.
  No endpoint traverses the relationship; the adjacency-list config is risk for no gain.
- **Migration uses `BOOLEAN DEFAULT 0` (no `NOT NULL`)** for SQLite portability; existing rows
  get `0`, model keeps `default=False`.
- **`mark-duplicate` guards status**: only `pending`/`verified` reports may be marked → `422` otherwise
  (prevents orphaning an in-flight work order).
- **Smoke section is `s10_duplicate_detection`** (`s9_ai_verifier_mode` already exists), wired in `main()`.
- **`mark-duplicate` takes a typed `MarkDuplicateRequest(BaseModel)` body.**
- **Heatmap needs NO change** — `/spatial/heatmaps` already whitelists active statuses, so `DUPLICATE`
  is excluded automatically (verified `main.py:2801`).

## Context

**Security fix (uncommitted, must ship first):** The Module 2 commit left `reporter_id`
as a client-supplied form field — any caller can claim to be any user. The rest of the API
uses `Depends(get_current_user)` (reads `X-User-Id` header). This commit tightens `/report/submit`
to the same pattern, then piggybacks Module 3 on top.

**Module 3** closes capstone panel recommendation #4: *duplicate reports* — many citizens submit
for the same single dumping incident. The panel wants admins to be able to spot and confirm
duplicates, collapsing them to one active cleanup.

---

## Part A — Security Fix (reporter_id → get_current_user)

### Backend — `backend/main.py` `submit_report`
- Replace the `reporter_id: Optional[int] = Form(None)` parameter + manual `_reporter` query
  with `_reporter: models.User = Depends(get_current_user)` (same dependency every other
  protected endpoint uses). FastAPI will enforce the `X-User-Id` header automatically.
- Derive `reporter_id = _reporter.id` server-side; remove the manual 401 checks (get_current_user
  already raises 401 for missing/invalid/disabled users).
- Result: the whole reporter validation block collapses to one dependency line.

### Frontend — `frontend/app/report/page.tsx`
- The submit `fetch()` currently uses raw `fetch` without the `api()` helper.
  Switch to the `api()` helper (already imported elsewhere in the project at `frontend/lib/api.ts`)
  which auto-attaches `X-User-Id` from localStorage — so we get the auth for free.
- Remove `formData.append("reporter_id", ...)` (no longer needed).
- Keep the `res.status === 401` redirect; `api()` throws `ApiError`, so wrap in try/catch on
  `err instanceof ApiError && err.status === 401` → redirect to login.

### Smoke test — `backend/smoke_test.py`
- Both submit calls currently pass `reporter_id` in `data={}`. Switch them to
  `post(..., user_id=citizen_id)` which sets the `X-User-Id` header via the existing helper.
- The anonymous→401 test already submits with no `reporter_id` and no `user_id` — it
  will now get a 401 from `get_current_user` (same result, same assertion).

---

## Part B — Module 3 (Duplicate Detection)

### 1. Model — `backend/models.py`

Add to `ReportStatus` enum:
```python
DUPLICATE = "duplicate"
```

Add to `Report` model:
```python
duplicate_of_id = Column(Integer, ForeignKey("reports.id"), nullable=True)
possible_duplicate_flag = Column(Boolean, nullable=False, default=False)
# Relationships:
duplicate_of = relationship("Report", remote_side="Report.id", foreign_keys=[duplicate_of_id])
```

### 2. Migration — `backend/main.py` startup ALTER TABLE block (~line 54)

Add two lines to the existing migration tuple (same try/pass pattern):
```python
"ALTER TABLE reports ADD COLUMN duplicate_of_id INTEGER REFERENCES reports(id)",
"ALTER TABLE reports ADD COLUMN possible_duplicate_flag BOOLEAN NOT NULL DEFAULT 0",
```

### 3. Proximity helper — `backend/analytics.py`

- **Expose `haversine_distance`** as a public function in `analytics.py`
  (copy the `_haversine_distance` implementation from `ai_verifier.py:273-281` — same math,
  just public and importable without pulling in all of ai_verifier):
  ```python
  def haversine_distance(lat1, lon1, lat2, lon2) -> float:
      ...  # same math as ai_verifier._haversine_distance
  ```

- **Add `find_nearby_reports`**:
  ```python
  def find_nearby_reports(report, db, radius_m=100, within_days=7):
      """Return open reports within radius_m meters and within_days days of report."""
  ```
  - Query all `Report` rows with `status NOT IN ('rejected','resolved','duplicate')` and
    `created_at >= now - timedelta(days=within_days)` and `id != report.id`
  - Filter to those where `haversine_distance(report.lat, report.lon, r.lat, r.lon) <= radius_m`
  - Return as a list of dicts: `{id, tracking_id, lat, lon, barangay, status, created_at, distance_m}`

### 4. Pydantic — `backend/main.py` `ReportResponse` (~line 285)

Add two fields:
```python
possible_duplicate_flag: bool = False
duplicate_of_id: Optional[int] = None
```
These serialize automatically from the ORM (both are columns on `Report`).

### 5. Set the flag at submit time — `backend/main.py` submit_report

After `db.commit(); db.refresh(new_report)`, add:
```python
from analytics import find_nearby_reports
nearby = find_nearby_reports(new_report, db, radius_m=100, within_days=7)
if nearby:
    new_report.possible_duplicate_flag = True
    db.commit()
```
This runs synchronously (fast — just a DB filter + N haversine calls on a small dataset).

### 6. New endpoints — `backend/main.py`

**`GET /reports/{report_id}/possible-duplicates`** — `require_role("cenro", "barangay")` with jurisdiction guard
```
Returns: list of nearby reports (same shape as find_nearby_reports output)
```

**`POST /reports/{report_id}/mark-duplicate`** — `require_role("cenro", "barangay")` with jurisdiction guard
```
Body (JSON): { "duplicate_of_id": int }
Effect:
  - Sets report.duplicate_of_id = body.duplicate_of_id
  - Sets report.status = "duplicate"
  - Sets report.possible_duplicate_flag = False
  - Audit-logs the action (reuse write_audit())
  - Returns updated ReportResponse
```

**No "dismiss" endpoint** — admin just leaves the report as-is; the badge disappears naturally
when the report resolves/rejects or the nearby original resolves. (Flag as future work.)

### 7. Filter DUPLICATE out of active queues

In `_apply_report_filters` (already filters `REJECTED`), extend the default exclusion:
```python
query = query.filter(models.Report.status.notin_([
    models.ReportStatus.REJECTED,
    models.ReportStatus.DUPLICATE,
]))
```
Duplicate reports vanish from active queues and the heatmap automatically.

### 8. Jurisdiction guard on the two new endpoints

Both new endpoints accept `report_id`. After fetching the report, enforce:
```python
if _user.role == "barangay" and report.barangay != _user.barangay_assignment:
    raise HTTPException(status_code=403, detail="Report is outside your barangay.")
```
(Same pattern already used in `/reports/{id}/detail`.)

---

## Part C — Frontend

### 9. Extend `QueueReport` interface — `frontend/components/portal/ReportDetailDrawer.tsx` (~line 17)

```typescript
possible_duplicate_flag?: boolean;
duplicate_of_id?: number | null;
```

### 10. Duplicate badge in Barangay report table — `frontend/app/barangay/page.tsx`

In the row render loop (~line 1543), add a badge in the tracking_id cell (or its own cell):
```tsx
{report.possible_duplicate_flag && report.status !== 'duplicate' && (
  <Badge variant="warning" className="ml-2 text-[9px]">⚠ Possible Dup</Badge>
)}
```
Use the existing `Badge` component from `frontend/components/ui/badge.tsx` — variant "warning".

### 11. Duplicate badge in CENRO Oversight Queue — `frontend/app/cenro/page.tsx`

Same badge in the oversight queue row (~line 1389).

### 12. Possible-duplicate section in Barangay modal — `frontend/app/barangay/page.tsx`

When `selectedReport.possible_duplicate_flag && selectedReport.status !== 'duplicate'`:
- On modal open (alongside the reporter detail fetch), call
  `api(\`/reports/${report.id}/possible-duplicates\`)` → store in `duplicateMatches` state.
- Render a collapsible "Possible Duplicates" section in the modal's **right column** above
  "Take Action":
  ```
  ⚠ Possible Duplicate of EW-XXXX (47 m away, Muzon, 2 days ago)
  [Confirm as Duplicate ▼]  ← button; clicking calls mark-duplicate, refreshes report
  ```
- On confirm: call `api('/reports/{id}/mark-duplicate', { method: "POST", body: JSON.stringify({duplicate_of_id: match.id}) })` → toast success → close modal (report removed from active queue).

### 13. Possible-duplicate section in CENRO drawer — `frontend/components/portal/ReportDetailDrawer.tsx`

In the **Overview** tab, insert an alert block at the top (before the Status/IDs section, ~line 374)
when `report.possible_duplicate_flag && report.status !== 'duplicate'`:
```tsx
<DuplicateAlert reportId={report.id} />
```
Inline component (no new file needed — define at the top of the file):
- Fetches `/reports/{id}/possible-duplicates` on mount.
- Shows each match with tracking_id, barangay, distance, date.
- "Confirm as Duplicate" button → calls `mark-duplicate` → calls `onUpdate()` (existing
  callback to refresh parent state).

---

## Part D — Tests & Docs

### 14. Smoke test — `backend/smoke_test.py`

Add `s9_duplicate_detection(users, report_info)` section (after s8 or wherever report_info is available):
- Submit a second geotagged report at the same Muzon coordinates as the first (s4's report).
- Assert `possible_duplicate_flag: true` in the response body.
- Call `GET /reports/{id}/possible-duplicates` → assert at least 1 result with `distance_m < 100`.
- Call `POST /reports/{id}/mark-duplicate` with `duplicate_of_id` = first report's id → assert `status == "duplicate"`.
- Call `GET /reports/barangay/Muzon` → assert the duplicate report is **no longer in the list**.

### 15. `TESTING_CHECKLIST.md` — add Module 3 block

- Backend: submit near-duplicate → flag set; GET possible-duplicates returns result; mark-duplicate changes status; duplicate absent from queue/heatmap
- Backend RBAC: barangay can only call mark-duplicate on own-jurisdiction reports; citizen → 403
- Frontend: badge visible on flagged report; confirm flow removes report from queue
- Edge case: mark-duplicate on already-resolved report → 422 or 400

### 16. Plan doc

Mark Module 3 DONE in `docs/2026-06-07-post-defense-recommendations-plan.md`.

---

## Critical Files

| File | Change |
|------|--------|
| `backend/models.py` | Add `DUPLICATE` status, `duplicate_of_id` FK, `possible_duplicate_flag` bool, relationship |
| `backend/main.py` | Migration, `ReportResponse` fields, security fix, submit flag-set, 2 new endpoints, queue filter |
| `backend/analytics.py` | Public `haversine_distance`, new `find_nearby_reports` |
| `frontend/components/portal/ReportDetailDrawer.tsx` | Extend `QueueReport` interface, `DuplicateAlert` section in Overview tab |
| `frontend/app/barangay/page.tsx` | Badge in row, fetch possible-duplicates on modal open, confirm flow |
| `frontend/app/cenro/page.tsx` | Badge in Oversight Queue row |
| `frontend/app/report/page.tsx` | Switch to `api()` helper, drop `reporter_id` form field |
| `backend/smoke_test.py` | Security fix (user_id header), new s9 duplicate section |
| `TESTING_CHECKLIST.md` | Module 3 block |
| `docs/2026-06-07-post-defense-recommendations-plan.md` | Mark Module 3 DONE |

---

## Verification (end-to-end)

1. **Security fix smoke check:** submit with no `X-User-Id` header → `401`; with valid `X-User-Id` → `202`.
2. **Duplicate flag set:** submit two reports within 100m (both geotagged Muzon) → second report has `possible_duplicate_flag: true`.
3. **Badge visible:** open barangay portal → flagged report shows "⚠ Possible Dup" badge in the row.
4. **Possible-duplicates endpoint:** `GET /reports/{id}/possible-duplicates` (with `X-User-Id: 2`) → returns first report with `distance_m ≈ 0`.
5. **Confirm flow:** click "Confirm as Duplicate" in modal → report status becomes `duplicate`; report disappears from barangay queue.
6. **Queue clean:** `GET /reports/barangay/Muzon` → duplicate report absent; heatmap not affected.
7. **Jurisdiction guard:** barangay user calls `/reports/{non-muzon-id}/possible-duplicates` → `403`.
8. **Smoke test green:** `python smoke_test.py` → s9 passes (plus security fix assertions pass).

## Out of scope
- "Dismiss" duplicate (flag it as reviewed/distinct) — noted as future work.
- Auto-flagging the *original* report when a near-duplicate arrives — only the new report gets the flag.
- Module 4 (trust-breakdown admin view).
