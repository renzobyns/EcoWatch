# Module 4 — Photo Evidence & Trust Breakdown View (admin)

## Context

Capstone panel recommendation #1 was about **fake / AI / edited / downloaded photos**. Modules 1–2
already gate those out and assign a HIGH/MED/LOW trust tier — but in the portals an admin only sees a
single coloured `TrustBadge`. They're trusting a coloured pill blindly with no way to see *why*.

Module 4 surfaces the **why**: a per-photo evidence breakdown in the barangay & CENRO drawers — GPS
A-vs-B comparison, photo time/age, camera/software metadata, AI result, and a ✓/✗ "why this tier"
checklist. **Almost all of this data already exists** in `ReportPhoto.trust_signals` (the `signals`
dict produced by `compute_trust_score` in `backend/ai_verifier.py:382-494`). Module 4 mostly **exposes
and renders** it; only two small backend additions are needed.

**Decided policy (from the post-defense decision log):** admin-only (barangay + CENRO), **never shown
to citizens** — so fakers aren't taught exactly which signal to fix. The existing citizen `TrustBadge`
on the tracking page is unchanged; the detailed breakdown is added only to admin payloads.

---

## What already exists (reuse, don't rebuild)

- `compute_trust_score` returns `{score, signals, failing_signals}`. `signals` already has:
  `gps_lat`/`gps_lon` (A=EXIF), `device_lat`/`device_lon` (B=device), `compared_against`
  (`"device"|"pin"`), `gps_distance_m`, `datetime_original`, `datetime_age_hours`,
  `has_camera_make`, `has_camera_model`, `software_tag`.
- Per-photo `trust_signals` is persisted as JSON on `ReportPhoto` and is valid JSON (the Module-3
  `Fraction` fix ensured this).
- `/reports/{id}/detail` is admin-only (`require_role("cenro","barangay")`, jurisdiction-guarded) and
  already returns `report.photos[]` with `{url, mask_url, ai_confidence, ai_verified, trust_score,
  failing_signals}`. The barangay modal **already fetches this endpoint** (Module 2 reporter card).
- The CENRO drawer's **Evidence tab** (`ReportDetailDrawer.tsx:593`) already renders each citizen photo.
- The in-app camera writes a recognizable EXIF signature: `Make="EcoWatch"`,
  `Software="EcoWatch GeoCam"` (`GeoTagCamera.tsx:58-60`) — lets us infer source (camera vs upload).

---

## Backend (1 line — `compute_trust_score` is NOT touched)

> **Critique outcome:** the originally-planned `ai_verifier.py` change is unnecessary. `source` and
> editor status are derivable on the frontend from data already in `signals` (`software_tag`) and
> `failing_signals`. Leaving `compute_trust_score` untouched keeps the change minimal and avoids the
> sensitive scoring function Module 3 just had to bug-fix.

### `backend/main.py` — expose `signals` per photo, **admin endpoint only**
In `get_report_detail` (`/reports/{id}/detail`), add `signals` to each photo dict:
```python
"signals": json.loads(getattr(p, "trust_signals", None) or "{}").get("signals", {}),
```
**Do NOT** add `signals` to the public `/report/track/{slug}` photos payload — that keeps the detailed
breakdown out of the citizen view (anti-coaching). This is the one place the two payloads diverge.
(`trust_signals` is valid JSON post the Module-3 `Fraction` fix; it's `None`/empty only until AI
verification completes — see the test note below.)

---

## Frontend

### 3. NEW `frontend/components/PhotoEvidenceDetail.tsx`
A presentational card (no fetching) rendering one photo's breakdown. Props:
`photo` (`{ signals, ai_confidence, ai_verified, trust_score, failing_signals }`) +
`report` (`{ lat, lon, created_at }`). **Derive on the frontend** (no backend `source` field):
`source = String(signals.software_tag ?? "").trim().includes("EcoWatch") ? "camera" : "upload"`;
editor flag = `failing_signals.some(s => s.startsWith("Software:"))` (always false for stored reports
since editor tags are hard-gated at submit — shown as a passed ✓ "gate worked" row). Sections:
- **Header:** source pill (📷 In-app camera / ⬆ Gallery upload) + reuse `<TrustBadge>` for the tier.
- **GPS table:** A = EXIF (`gps_lat,gps_lon`), B = device (`device_lat,device_lon`), submitted pin
  (`report.lat,lon`), and distance A↔B (`gps_distance_m`, labelled by `compared_against`).
- **Time table:** photo taken (`datetime_original`), report submitted (`report.created_at`),
  age (`datetime_age_hours`), future-dated flag (age < 0).
- **Metadata table:** camera make/model present (`has_camera_make`/`has_camera_model`),
  software tag (`software_tag`, red if `has_editor_tag`).
- **AI:** `ai_confidence` %, `ai_verified` ✓/✗.
- **"Why this tier" checklist:** ✓/✗ rows derived from `signals` + `failing_signals`
  (GPS present · A↔B ≤100 m · photo recent · camera metadata present · no editor/AI tag · live source).
Reuse `formatDate` (`@/lib/date-utils`) and the `ui/badge` pill styling already used elsewhere.
Handle missing/empty `signals` gracefully (legacy reports → "Trust details unavailable").

### 4. `frontend/components/portal/ReportDetailDrawer.tsx`
- Extend `ReportDetailPayload.report.photos[]` type (`~line 41-50`) with
  `signals?: Record<string, unknown>`.
- In `EvidenceTab` (`~line 647`), render `<PhotoEvidenceDetail photo={p} report={report} />` beneath
  each citizen photo's image/mask/confidence block.

### 5. `frontend/app/barangay/page.tsx`
- Extend the existing Module-2 detail-fetch effect to also store `data.report.photos`
  (new `reportPhotos` state alongside `reporterDetail`).
- In the modal's evidence column (right side, under the evidence image ~`line 1726`), render
  `<PhotoEvidenceDetail>` for the report's photo(s). Falls back cleanly when photos/signals are absent
  (legacy single-image reports).

---

## Tests & docs

### 6. `backend/smoke_test.py`
Add a small `s11(report)` that reuses **s4's AI-completed report** (NOT a fresh submit — `trust_signals`
is written only after `_bg_verify_submit` finishes, so a pending report has empty `signals`). Then
`GET /reports/{id}/detail` → assert `photos[0]["signals"]` is present and contains `gps_lat`,
`device_lat`, `compared_against`, `software_tag`. Also assert the public `GET /report/track/{slug}`
photos do **not** contain a `signals` key (no leak to citizens).

### 7. `TESTING_CHECKLIST.md` — Module 4 block
Breakdown visible per photo in **both** barangay modal and CENRO Evidence tab; source pill correct for
camera vs upload; GPS A/B/pin + distance shown; "why this tier" ✓/✗ matches the badge; **not** present
on the citizen `/track` page or its API response.

### 8. Mark Module 4 DONE in `docs/2026-06-07-post-defense-recommendations-plan.md` and save a copy of
this plan to `docs/2026-06-11-module-4-evidence-view-plan.md`.

---

## Critical files

| File | Change |
|------|--------|
| `backend/main.py` | add `signals` to photos in `/reports/{id}/detail` only (not `/track`) — **one line** |
| `frontend/components/PhotoEvidenceDetail.tsx` | **NEW** — per-photo breakdown card |
| `frontend/components/portal/ReportDetailDrawer.tsx` | photos type + render breakdown in Evidence tab |
| `frontend/app/barangay/page.tsx` | store detail photos + render breakdown in modal |
| `backend/smoke_test.py` | assert signals exposed on /detail, absent on /track |
| `TESTING_CHECKLIST.md`, `docs/*` | Module 4 checklist + mark DONE |

---

## Verification (end-to-end)

1. Fresh backend on port 8123; using an **AI-completed** report (poll until `verification_pending`
   is false), confirm `GET /reports/{id}/detail` → `photos[0].signals` has `gps_lat`, `device_lat`,
   `gps_distance_m`, `compared_against`, `software_tag`. (smoke test's geotag image has no EcoWatch
   signature → frontend derives `source = "upload"`, which is correct.)
2. `GET /report/track/{slug}` → photos have **no** `signals` key (citizen view stays clean).
3. Frontend: CENRO drawer → Evidence tab → breakdown card shows source pill, GPS A/B table, and a
   ✓/✗ checklist whose result matches the `TrustBadge` tier.
4. Barangay modal → same breakdown under the evidence photo, only for own-jurisdiction reports.
5. `python -m py_compile` (backend), `npx tsc --noEmit` + `npm run build` (frontend), and the smoke
   test (incl. the new signals assertions) all green. Run the smoke + edge suites to confirm no
   regression in Modules 1–3.

## Out of scope
- Changing trust tier logic or thresholds (Module 4 only explains the existing tier).
- Showing the breakdown to citizens (deliberately admin-only).
- Cleanup-photo trust scoring (citizen evidence only).
