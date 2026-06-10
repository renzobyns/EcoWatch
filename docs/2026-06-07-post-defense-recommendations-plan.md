# EcoWatch — Post-Defense Recommendations Plan

_Saved 2026-06-07. Working notes for the four panel recommendations after the capstone defense._

## Context

After the capstone defense, the panel raised four recommendations to make reports
more trustworthy and accountable. This plan addresses all four. Three of them collapse
into **one core feature — an in-app geo-tagging camera** — plus a login requirement and
an admin-side duplicate review.

**Problems being solved**

1. **Fake / AI-generated / edited / downloaded photos** get submitted as evidence.
2. **No auto-pin** — citizens manually drop a map pin, which can be wrong or gamed.
3. **Anonymous reports** can't be validated → no accountability.
4. **Duplicate reports** — many submissions for the same single dumping incident.

**What already exists (do not rebuild)**

- Backend already reads EXIF GPS, camera make/model, and editor/AI software tags and
  assigns a HIGH/MEDIUM/LOW trust tier in `backend/ai_verifier.py` → `compute_trust_score()`.
  It already flags edited/AI photos and GPS mismatch >500m, and exposes `trust_reasons`.
- `navigator.geolocation` is already used in `frontend/components/PinpointFullscreen.tsx`.
- DBSCAN proximity clustering exists in `backend/analytics.py` (`get_heatmap_clusters`,
  eps≈100m) and `haversine_distance()` lives in `backend/ai_verifier.py` — reuse these.
- Auth is complete: `/auth/register`, `/auth/login`, and `frontend/app/login` + `frontend/app/signup`.

**Key technical reality driving the design:** photos captured by a web app's in-app camera
(`getUserMedia` → canvas) have **no EXIF/geo-tag**. So "require a geo-tag" cannot mean
"check EXIF after upload." Instead we build a camera that captures the live GPS **at the
moment of the snap** and writes it into the photo ourselves. With **no file picker**, users
cannot submit saved/AI/downloaded images — this is the strongest fix for problems 1–2.

Reference apps: GPS Map Camera, Tagofy, Solocator (live camera + burned-in location/time stamp).

---

## Module 1 — Geo-tag capture + photo validation (frontend + backend) — solves #1 and #2

Two ways to add a photo, with **different trust ceilings**:

- **Path A — In-app geo-tag camera (live capture).** Highest trust. Device GPS grabbed at the
  shutter; cannot be a saved / AI / downloaded file.
- **Path B — Upload from gallery.** Allowed, but **must carry a valid EXIF geotag or it is denied
  at the door** (decided: reject outright — see Decisions Log). Then it goes through trust scoring.

### Two coordinates per report (decided: capture both, compare A vs B)

- **A = EXIF GPS** — where the photo *claims* it was taken (user-controlled, spoofable, strippable).
- **B = live device GPS** — captured live at the moment of capture/upload via
  `navigator.geolocation.getCurrentPosition({ enableHighAccuracy: true })` (where the uploader
  physically is *now*; harder to fake).
- Camera path: **B is primary** and becomes the auto-pin. Upload path: **B is captured at upload**
  purely to cross-check against the photo's EXIF (A). Trust scoring compares **A vs B**, not just
  EXIF-vs-pin (this is the new signal vs. what exists today).

### Hard gates — reject BEFORE any AI/scoring

| Rule | Result if failed |
|---|---|
| Upload (Path B) has **no EXIF geotag** | ❌ Denied at upload, never scored |
| Upload (Path B) has an **editor/AI software tag** (Photoshop, Snapseed, Midjourney…) | ❌ Denied (evidence of tampering, not scored) |
| GPS (from photo geotag) **outside SJDM** | ❌ Denied with a clear message (no manual pin to correct it) |
| Not a valid image / >10 MB / >5 photos | ❌ Denied (already enforced in `save_upload`) |

### Trust score — reuse existing thresholds (100 m / 500 m / 24 h)

| Signal | HIGH | MEDIUM | LOW → manual review |
|---|---|---|---|
| Source | Live in-app camera | Gallery upload, geotag OK | — |
| EXIF (A) vs device (B) distance | ≤ 100 m | 100–500 m, or B denied/missing | **> 500 m** |
| Photo time (DateTimeOriginal) | recent | within ~24 h | **> 24 h old, or future** |
| Camera make/model | present | missing | — |
| Editor/AI software tag (Photoshop, Midjourney…) | none | none | **present → REJECTED (hard gate, not scored)** |

**Note — the camera path (A) is inherently HIGH trust:** the citizen used our own live camera, so
the photo can't be a saved/AI/old file, and A and B coincide. The hard gates and the A-vs-B
comparison above therefore matter **mainly for gallery uploads (Path B)**.

Only photos that **pass the hard gates** proceed to Mask R-CNN AI verification. LOW-trust photos
that still pass AI detection are **accepted but flagged** (`needs_human_review`).

### Who reviews flagged (LOW-trust) reports (decided)

- **Barangay = first-line reviewer** (their jurisdiction) — clears or rejects the flag.
- **CENRO = oversight + override** — sees all flagged reports city-wide; can reverse, reassign,
  or force-close (existing powers).
- **One reviewer clears a flag** — not a two-person mandatory gate.

### New component: `frontend/components/GeoTagCamera.tsx` (Path A)
- Live rear camera via `getUserMedia({ video: { facingMode: 'environment' } })`.
- On shutter: read fresh GPS (B), draw the frame to `<canvas>`, **burn an overlay stamp**
  (barangay, `lat,lon`, PH date/time, accuracy ±Nm), and write GPS into the JPEG's EXIF with
  **piexifjs** so the backend trust scoring reads a real geotag.
- Export a JPEG `Blob` + `{lat, lon, accuracy, timestamp}`.
- Handle denied camera/location permissions with a clear inline message + retry.

### Upload path validation (Path B)
- On file select, read EXIF client-side with **`exifr`** (already in `package.json`). No GPS →
  show "This photo has no location data — use the in-app camera instead" and block it.
- Still capture live device GPS (B) at upload for the A-vs-B comparison.

**Dependency:** add `piexifjs` to `frontend/package.json` for writing EXIF (`exifr` already present
for reading).

**Wire into the report flow:** `frontend/app/report/page.tsx` — trimmed to **3 steps**:
- **(1) Login gate** → **(2) Add photo(s)** (camera primary, or validated upload) → **(3) Review & submit.**
- **Location is never user-editable.** It is derived solely from the photo (B/live GPS for camera,
  EXIF/A for upload) and shown **read-only** on the review screen ("📍 Brgy. X — from your photo").
- **No confirm-location screen and no manual pinning** — there is nothing for the citizen to set,
  so the old map-pin step is dropped from the citizen flow.
- Warn if a later photo's coordinate is beyond ~150 m from the first.
- **`PinpointFullscreen`** (the manual-pin map) is removed from the citizen flow but **kept in the
  repo** for possible barangay/CENRO location-correction later (accountable admins may pin; citizens
  may not). Specifically remove from the citizen path: drag-to-pin, "Use Current Location," "Go to
  Coordinates," and barangay search/nearby-jump.

**Backend** (`backend/main.py`, `backend/ai_verifier.py`)
- Accept a new optional `device_lat`/`device_lon` (signal B) on `/report/submit`; pass it into
  `compute_trust_score()` as the comparison anchor alongside the existing EXIF read.
- Enforce the **no-geotag hard reject** AND the **editor/AI software-tag hard reject** server-side too
  (defense in depth — don't trust the client). Reuses the existing `_KNOWN_EDITOR_KEYWORDS` list in
  `ai_verifier.py`; just promote a match from LOW-trust to outright reject.

**Testing caveat:** `getUserMedia` + geolocation require a **secure context**. `localhost` works on
desktop; to test on a real phone you must serve the frontend over **HTTPS** (e.g. a tunnel).

---

## Module 2 — Require login to submit (accountability) — solves #3

**Frontend** (`frontend/app/report/page.tsx`)
- Gate the page: if no `ecowatch_user` in `localStorage`, redirect to `/login` (with return URL).
- Make `reporter_id` mandatory in `handleSubmit` (it's currently best-effort/optional).

**Backend** (`backend/main.py`)
- `/report/submit` (currently `backend/main.py:1572`): make `reporter_id` **required** and validate
  the user exists/active; reject with 401/400 otherwise.
- **Expose reporter identity to admins:** add `reporter_name`, `reporter_phone`, `reporter_email`
  to `ReportResponse` (`backend/main.py:284`) and populate them from the `Report.reporter`
  relationship in the report serialization. Show these in the barangay/CENRO report drawers
  so reports can be validated and followed up.
- Keep the DB column `reporter_id` nullable (legacy rows) but enforce presence at the API.

---

## Module 3 — Duplicate detection, admin-confirmed — solves #4

**Model changes** (`backend/models.py`)
- Add `duplicate_of_id = Column(Integer, ForeignKey("reports.id"), nullable=True)` + self-relationship.
- Add `ReportStatus.DUPLICATE = "duplicate"` to the enum (`backend/models.py:8`).
- Add the column via the existing raw-`ALTER TABLE` migration pattern (see `backend/main.py:56`).

**Proximity helper** (`backend/analytics.py`)
- Add `find_nearby_reports(report, db, radius_m=100, within_days=7)` that returns other **open**
  reports near a given report, reusing `haversine_distance()` (move/import it from `ai_verifier.py`).

**Endpoints** (`backend/main.py`)
- Include a lightweight `possible_duplicate_of` (id + distance) on reports in the barangay/CENRO
  list responses (computed via the helper), OR a dedicated `GET /reports/{id}/possible-duplicates`.
- `POST /reports/{id}/mark-duplicate` (barangay/CENRO only): sets `duplicate_of_id`, sets status to
  `DUPLICATE`, and removes the report from active queues/heatmap. Audit-log the action.

**Admin UI** (`frontend/app/barangay/page.tsx`, `frontend/app/cenro/page.tsx`)
- On a report with a nearby match, show a badge: **"⚠ Possible duplicate of EW-XXXX (47m away)"**.
- Clicking opens both reports side-by-side; admin confirms → calls `mark-duplicate` (link/merge),
  or dismisses to keep it as a distinct report.

---

## Module 4 — Photo evidence & trust breakdown view (admin) — transparency for #1

A detail view in the **barangay and CENRO** report drawers that explains *why* a photo got its
HIGH/MEDIUM/LOW tier — so reviewers aren't trusting a coloured badge blindly. Most data already
exists (`ReportPhoto.trust_signals`, `trust_score`, `ai_confidence`); this module surfaces it as a
structured table + checklist.

**New component:** `frontend/components/PhotoEvidenceDetail.tsx`, shown per photo:
- **Source:** in-app camera (live) vs gallery upload.
- **GPS comparison table:** A = EXIF GPS · B = device GPS · submitted pin · distance A↔B (m).
- **Time table:** photo taken (DateTimeOriginal) · report submitted · age · future-dated? flag.
- **Camera/metadata table:** make/model (present/missing) · software/editor tag (none / "Photoshop ⚠").
- **AI verification:** confidence % · verified yes/no.
- **"Why this tier" checklist:** passed ✓ / failed ✗ checks driving the tier (maps directly to the
  existing `trust_signals.signals`, `failing_signals`, and `trust_reasons`).

**Backend** (`backend/ai_verifier.py`, `backend/main.py`)
- Have `compute_trust_score()` return the **structured comparison values** (A, B, distance, photo
  age, make/model, software) — not just the tier string — and persist them in `trust_signals`.
- Expose this structured object per photo in the `photos: List[dict]` already on `ReportResponse`.

**Depends on Module 1** (which produces A, B, and the signals). Build order: Module 1 → Module 4.

---

## Critical files

| File | Change |
|------|--------|
| `frontend/components/GeoTagCamera.tsx` | **NEW** Path A: live camera + device GPS + stamp + EXIF write |
| `frontend/app/report/page.tsx` | login gate, camera + validated-upload flow, auto-pin |
| `frontend/components/PhotoEvidenceDetail.tsx` | **NEW** Module 4: admin metadata/trust breakdown table |
| `frontend/package.json` | add `piexifjs` (`exifr` already present) |
| `frontend/app/barangay/page.tsx`, `frontend/app/cenro/page.tsx` | reporter identity + duplicate badge/confirm + evidence panel |
| `backend/main.py` | require `reporter_id`; `device_lat/lon` + A-vs-B; reporter & structured trust detail on `ReportResponse`; duplicate endpoints |
| `backend/ai_verifier.py` | compare EXIF (A) vs device (B); return structured trust detail |
| `backend/models.py` | `duplicate_of_id` FK + `ReportStatus.DUPLICATE` |
| `backend/analytics.py` | `find_nearby_reports()` reusing `haversine_distance` |

---

## Wireframes to make

Design these screens before/while building (✱ = brand-new screen):

1. ✱ **In-app geo-tag camera** (Path A) — live viewfinder, burned-in stamp, shutter button, and the
   permission states (camera denied, location denied, acquiring GPS).
2. ✱ **Add-photo chooser** — "Take photo" (camera, primary) vs "Upload", including the **no-geotag
   rejection** message on upload.
3. **Review & submit** — read-only location card ("from your photo," not editable) + notes + submit +
   success/tracking screen. *(No separate location-confirm screen; location is never user-editable.)*
4. **Login-required gate** on `/report` (redirect to existing login).
5. **Report detail drawer w/ reporter identity** (barangay & CENRO) — name + phone.
6. ✱ **Photo evidence & trust breakdown panel** (Module 4) — GPS/time/camera tables + "why this
   tier" ✓/✗ checklist. *This is the big one you described.*
7. **Possible-duplicate** — badge + side-by-side compare/confirm (barangay & CENRO).

---

## Verification

1. **Backend:** `cd backend; .\venv_tf\Scripts\Activate.ps1; uvicorn main:app --reload`.
2. **Frontend:** `cd frontend; npm install; npm run dev` (installs `piexifjs`).
3. **Login gate:** open `/report` logged out → redirected to `/login`. Log in as
   `citizen@test.com` / `password123` → reach the report flow.
4. **Geo-tag camera:** on `localhost` (desktop) grant camera + location; capture a photo →
   verify the burned-in stamp and that the map auto-pins to the captured GPS. Submit.
5. **Geo-tag survives to backend:** confirm the new report shows a trust tier and that
   `trust_reasons` reflect a real GPS reading (not "No GPS in photo metadata").
6. **No file picker:** confirm there is no way to attach a saved image.
7. **Accountability:** in the barangay/CENRO portal, open the report → reporter name/phone show.
8. **Duplicates:** submit two reports within ~50m. In the admin portal, the second shows
   "Possible duplicate of EW-XXXX". Click → confirm → it moves to `DUPLICATE` and leaves the
   active queue and heatmap.
9. **Backend tests:** extend `backend/test_auth.py` (reporter_id required) and add a duplicate
   test alongside `backend/test_analytics.py`.
10. **Phone test (optional):** serve frontend over HTTPS (tunnel) to exercise the real camera.

---

## Decisions Log

- **Scope:** all four recommendations.
- **Photo source:** keep BOTH an in-app geo-tag camera (Path A, primary) AND gallery upload (Path B).
- **Trust validation applies mainly to uploads:** the camera path is inherently HIGH trust (own live
  camera, can't be a saved/AI/old file); A-vs-B comparison + hard gates chiefly govern uploads.
- **New Module 4 — photo evidence/trust breakdown view** for barangay & CENRO (a table + checklist
  explaining *why* a photo is high/medium/low; surfaces data the backend already computes).
- **Module 4 visibility: admins only** (barangay + CENRO) — not shown to citizens, so fakers aren't
  taught exactly which signal to fix.
- **No-geotag upload:** ❌ reject outright (not scored). Accepted downside: legit photos with
  EXIF stripped by Messenger/FB/screenshots get blocked — those users must use the in-app camera.
- **Two coordinates:** capture EXIF GPS (A) AND live device GPS (B); trust scoring compares A vs B.
- **LOW-trust photos:** accepted but flagged; reviewed by barangay (first-line) with CENRO override;
  one reviewer clears the flag.
- **Identity:** require login to submit; reporter name/phone visible to barangay & CENRO.
- **Duplicates:** admin-confirmed (barangay/CENRO see a "possible duplicate" badge and link them).
- **No manual pinning / no confirm screen:** citizens never set or move location; it's derived from
  the photo geotag and shown read-only on review. Flow trimmed to 3 steps (login → add photo → review).
- **Photo geotag outside SJDM → reject** with a clear message (no pin to correct it).
- **Edited/AI-tagged uploads → reject (STRICT):** ANY match in `_KNOWN_EDITOR_KEYWORDS` — both
  human-editor apps (Photoshop, Snapseed, Canva, Facetune…) AND AI generators (Midjourney, Stable
  Diffusion, DALL-E) — is a hard gate (reject), not just a LOW flag. Trade-off accepted: also blocks
  genuine photos lightly cropped/rotated in a tagging app; those users must re-take via the in-app camera.
- **`PinpointFullscreen` manual-pin tools removed** from the citizen flow (drag, "use current
  location," coordinate entry, barangay search); component reserved for possible admin correction.
- **Visily wireframe brief** saved at `docs/visily-brief-module-1.md` (5 screens).

## Open questions to revisit before building

- **Pseudonymity vs. full identity:** we chose "require login, identity visible to barangay/CENRO."
  Revisit if reporters fear retaliation reporting illegal dumping.
- **Geo-tag camera deep-dive:** Renzo may still want an interactive mockup (accuracy, permissions,
  offline, look-and-feel) before/while implementing.
- **Duplicate radius/time window:** 100m / 7 days are starting defaults — tune with real data.
