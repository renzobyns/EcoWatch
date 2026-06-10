# EcoWatch SJDM — Testing Checklist
> Definition of Done per sprint day. Use Postman for backend, browser for frontend.
> User IDs in local DB: `1` = citizen, `2` = barangay (Muzon), `3` = cenro

---

## How to Run Each Section

**Backend** — Open Postman, set the header `X-User-Id` to the right user, hit Send.
**Frontend** — Start the dev server (`npm run dev`), open `http://localhost:3000`, click through.
**Database** — Run in VS Code terminal: `cd backend && venv_tf\Scripts\python.exe -c "from database import engine; from sqlalchemy import text; ..."` to inspect rows.

---

## Day 2 — RBAC + Audit Log

### Backend
- [ ] `PUT /report/{id}/deploy` with no header → `401 Missing X-User-Id header`
- [ ] `PUT /report/{id}/deploy` with `X-User-Id: 3` (cenro) → `403 Requires role: barangay`
- [ ] `PUT /report/{id}/deploy` with `X-User-Id: 2` (barangay) + report is `verified` → `200`, status becomes `deployed`
- [ ] `POST /report/{id}/resolve` with `X-User-Id: 3` → `403 Requires role: barangay`
- [ ] `PUT /report/{id}/reassign` with `X-User-Id: 2` (barangay) → `403 Requires role: cenro`
- [ ] `PUT /report/{id}/reassign` with `X-User-Id: 3` + body `new_barangay=Graceville` → `200`, barangay updated
- [ ] `PUT /report/{id}/force-close` with `X-User-Id: 2` → `403 Requires role: cenro`
- [ ] `PUT /report/{id}/force-close` with `X-User-Id: 3` → `200`, status becomes `resolved`
- [ ] `GET /audit-log` with `X-User-Id: 2` → `403`
- [ ] `GET /audit-log` with `X-User-Id: 3` → `200`, entries list includes the actions above
- [ ] Each audit entry has: `action`, `user_email`, `target_id`, `details`, `created_at`
- [ ] Disabled user (`is_active=false`) → `401 Invalid or disabled user` on any request

---

## Day 3 — Filtering, Exports, SLA, User Management

### X3 — Report Filtering
- [ ] `GET /reports/recent?status=pending` → only pending reports
- [ ] `GET /reports/recent?search=EW-0005` → exactly 1 result with that tracking ID
- [ ] `GET /reports/recent?limit=3&offset=3` → different 3 reports than `offset=0`
- [ ] `GET /reports/barangay/Muzon?status=deployed` → only deployed reports from Muzon
- [ ] `GET /reports/barangay/Muzon?date_from=2026-05-16T00:00:00` → reports after that date only

### X4 — CSV Export
- [ ] `GET /reports/export` with `X-User-Id: 2` → `200`, `Content-Type: text/csv`, filename in header
- [ ] CSV header row: `tracking_id,created_at,barangay,status,lat,lon,ai_confidence,...`
- [ ] Barangay user export → only their barangay's reports in file (no other barangays)
- [ ] `GET /reports/export` with `X-User-Id: 1` (citizen) → `403`
- [ ] `GET /reports/export` with no header → `401`
- [ ] Empty filter result → CSV with header row only, no data rows

### X5 — SLA Breaches
- [ ] `GET /reports/sla-breaches?days=1` → returns reports older than 1 day still active
- [ ] Response only contains `pending`, `verified`, or `deployed` statuses (never `resolved` or `rejected`)
- [ ] `GET /reports/sla-breaches?days=999` → returns all active reports

### X6 — User Management
- [ ] `GET /users` with `X-User-Id: 3` → all users listed
- [ ] `GET /users?role=barangay` → only barangay users
- [ ] `GET /users` with `X-User-Id: 2` → `403`
- [ ] `POST /users` with `X-User-Id: 3`, body `{"email":"x@test.com","full_name":"X","barangay_assignment":"Graceville"}` → `200`, returns `user` + `temporary_password`
- [ ] New user can log in via `POST /auth/login` with that temp password
- [ ] `POST /users` with duplicate email → `400 Email already registered`
- [ ] `PUT /users/{id}/disable` with `X-User-Id: 3` → `200`, user disabled
- [ ] Disabled user login → `403 Account disabled. Contact CENRO administrator.`
- [ ] `PUT /users/3/disable` with `X-User-Id: 3` (self) → `400 Cannot disable your own account`

### X7 — Logging
- [ ] No `print()` calls in `backend/ai_verifier.py` (grep: should return nothing)
- [ ] `logger.warning / logger.info / logger.exception` used instead

### X8 — Image Validation
- [ ] Upload a `.txt` file to `/report/submit` → `400 Only JPEG or PNG images are allowed.`
- [ ] Upload a `.gif` (type: `image/gif`) → `400 Only JPEG or PNG images are allowed.`
- [ ] Upload an image > 10 MB → `400 Image must be 10 MB or smaller.`
- [ ] Upload a valid `.jpg` → `200` with `report_id`

---

## Day 4 — Barangay Portal Frontend

### C6 — Graceville Duplicate
- [ ] Search BARANGAYS array in `frontend/app/cenro/page.tsx` → only one `"Graceville"` entry

### B1 — Filter Bar
- [ ] Typing in search box → reports update after ~300ms (debounce), not on every keypress
- [ ] Changing date From/To → report list updates
- [ ] Clearing all filters → full list returns
- [ ] Filter params are sent as query strings to `/reports/barangay/{name}` (check Network tab in browser DevTools)

### B2 — SLA Badge
- [ ] Each active report row shows a colored pill (green/yellow/red) in the "Open" column
- [ ] Resolved reports show a dash `—` in the "Open" column (no badge)
- [ ] Badge color: ≤2 days = green, 3–4 days = yellow, ≥5 days = red

### B3 — Deployment Notes
- [ ] Deploy modal shows a "Deployment Notes" textarea when report is `verified`
- [ ] Fill in notes and click Deploy → notes appear in the modal's "Deployment Notes" section after deploy
- [ ] Deploy without notes → works fine, notes section hidden (not blank section shown)
- [ ] `GET /reports/barangay/{name}` response includes `deployment_notes` field

### B4 — Export CSV Button
- [ ] "Export CSV" button is visible in the filter bar
- [ ] Click it → browser downloads a `.csv` file
- [ ] CSV only contains reports from the logged-in barangay's assignment
- [ ] Active search/date filters are reflected in the export

### B5 — Toasts + Skeleton
- [ ] On page load, skeleton rows (grey animated bars) appear while data is fetching
- [ ] Successful deploy → green success toast appears top-right
- [ ] Failed action (e.g. network off) → red error toast appears
- [ ] "No reports found in this category." message appears when filtered list is empty

---

## Day 5 — CENRO Portal Frontend (fill in after Day 5)

### C1 — Audit Log Tab
- [ ] 4th tab exists in CENRO dashboard
- [ ] Table shows: timestamp, user email, action, target report ID
- [ ] Most recent entry is at the top

### C2 — User Management Tab
- [ ] Tab shows list of barangay accounts
- [ ] "Add Barangay Account" modal opens, fill form, submit → new user appears in list
- [ ] "Disable" button sets user inactive; disabled badge shown

### C3 — SLA Breaches Widget
- [ ] Command Center tab shows a card with count of SLA-breaching reports
- [ ] Clicking it navigates to Oversight Queue pre-filtered

### C4 — Oversight Queue Filters
- [ ] Date range, status, barangay dropdown, search all work
- [ ] Filters send correct query params (check Network tab)

### C5 — Analytics Export
- [ ] "Export Analytics CSV" button downloads a file
- [ ] File contains per-barangay breakdown (total, resolved, deployed, pending)

---

## Module 4 (Post-Defense) — Photo Evidence & Trust Breakdown View

> Recommendation #1 (anti-fake photos). Admins can now see *why* a photo is HIGH, MEDIUM, or LOW
> trust — GPS A-vs-B comparison, photo time/age, camera metadata, AI result, and a ✓/✗ checklist.
> Shown only to barangay & CENRO admins; never on the citizen tracking page (anti-coaching).

### M4-A — Backend (`GET /reports/{id}/detail`)
- [ ] `GET /reports/{id}/detail` with barangay `X-User-Id` → `photos[0].signals` is a non-empty dict
- [ ] `signals` contains `gps_lat`, `gps_lon`, `compared_against`, `software_tag`, `datetime_age_hours`
- [ ] `GET /report/track/{slug}` (public, no auth) → `photos[0]` does **NOT** have a `signals` key

### M4-B — CENRO drawer Evidence tab
- [ ] Log in as `cenro@test.com` → open any verified/resolved report → Evidence tab
- [ ] Each citizen photo has an **Evidence Breakdown** card below the image/mask block
- [ ] Card shows source pill: **📷 In-app camera** or **⬆ Gallery upload** (based on `software_tag`)
- [ ] Card shows the `TrustBadge` tier (matches the badge shown elsewhere on the report)
- [ ] **Location** section: A (EXIF), B (device), submitted pin, and A↔B distance are all shown
- [ ] **Time** section: photo taken timestamp, report submitted, and age in human-readable form
- [ ] **Metadata** section: camera make/model present/missing, software tag value
- [ ] **AI** section: confidence % and verified ✓/✗
- [ ] **Why this tier** checklist: ✓/✗ rows match the failing signals on the TrustBadge tooltip

### M4-C — Barangay modal Evidence column
- [ ] Log in as `barangay@test.com` → open any report → Evidence Photo section
- [ ] Same **Evidence Breakdown** card appears below the photo + TrustBadge
- [ ] Card shows correct source, GPS A/B, time, metadata, and checklist
- [ ] For a HIGH-trust report → all checklist rows are ✓
- [ ] For a MEDIUM-trust report → at least one row is ✗ explaining why it's not HIGH

### M4-D — Citizen tracking page (no leak)
- [ ] Visit `/track/<slug>` → trust badge visible, but **no evidence breakdown card** anywhere
- [ ] Network tab: `GET /report/track/{slug}` response has no `signals` key in photos array

### M4-E — Legacy / pending reports
- [ ] A report whose AI verification is still running shows `"Trust details unavailable"` in the card
- [ ] No JS error in console when `signals` is `{}` or absent

---

## Module 3 (Post-Defense) — Duplicate Detection

> Recommendation #4. Many citizens report the same dumping incident; admins confirm duplicates
> to collapse them to one active cleanup. A report is auto-flagged at submit if an OPEN report
> exists within 100 m / 7 days. Identity now comes from the **session header (X-User-Id)**, not
> a spoofable `reporter_id` form field (security hardening of Module 2).

### M3-A — Security hardening (`POST /report/submit`)
- [ ] Submit with **no `X-User-Id` header** → `401` (identity is the session, not a form field)
- [ ] Submit with a valid `X-User-Id` → `202`; a `reporter_id` form field is now ignored entirely
- [ ] Confirm the citizen flow still works end-to-end in the browser (api() sends the header)

### M3-B — Auto-flag at submit
- [ ] Submit report A in Muzon, then report B at the **same coords** → B's response has `possible_duplicate_flag: true`
- [ ] Submit a report far from any open report → `possible_duplicate_flag: false`
- [ ] Flag is based on **open** reports only (rejected/resolved/duplicate don't count)

### M3-C — Endpoints (curl/Postman)
- [ ] `GET /reports/{B}/possible-duplicates` (X-User-Id = barangay) → lists A with `distance_m < 100`
- [ ] `POST /reports/{B}/mark-duplicate` body `{"duplicate_of_id": A}` (barangay) → `200`, status `duplicate`
- [ ] `POST /reports/{B}/mark-duplicate` as **citizen** → `403`
- [ ] `mark-duplicate` on a **deployed/resolved** report → `422` (only pending/verified allowed)
- [ ] Barangay calling either endpoint for a **non-jurisdiction** report → `403`

### M3-D — Queue & heatmap exclusion
- [ ] After mark-duplicate, report B is **absent** from `GET /reports/barangay/Muzon` and `/reports/recent`
- [ ] `GET /spatial/heatmaps` does not include the duplicate (status whitelist excludes it)
- [ ] `?status=duplicate` filter **does** return duplicates (explicit opt-in)

### M3-E — Frontend
- [ ] Flagged report shows a **⚠ Dup?** badge in the barangay queue row and CENRO oversight row
- [ ] Barangay modal shows a "Possible Duplicates" panel with the nearby report + "Confirm Duplicate"
- [ ] CENRO drawer Overview tab shows the same alert at the top
- [ ] Clicking "Confirm Duplicate" → toast, report leaves the queue, drawer/modal closes

---

## Module 2 (Post-Defense) — Login Required & Reporter Accountability

> Recommendation #3 (accountability). Every submission must be tied to a verified account.
> Reporter identity is visible to barangay and CENRO admins only — never on public routes.
> **Note:** Module 3 hardened the submit auth — identity is the `X-User-Id` session header,
> not the `reporter_id` form field described below.

### M2-A — Backend enforcement (`POST /report/submit`, curl/Postman)
- [ ] Submit with **no `reporter_id`** field → `401 Please log in to submit a report.`
- [ ] Submit with a **nonexistent `reporter_id`** (e.g. `999999`) → `401 Your account is invalid or disabled.`
- [ ] Submit with a **disabled user's `reporter_id`** (disable via CENRO portal first) → `401`
- [ ] The 401 fires **before** any image is saved (confirm no new file in `backend/uploads/`)
- [ ] Submit with a valid active `reporter_id` + geotagged SJDM photo → `202` (Module 1 gate still works)

### M2-B — Reporter identity in admin drawers
- [ ] Log in as `cenro@test.com` → open any report → Overview tab shows reporter name/email/phone
- [ ] Log in as `barangay@test.com` (Muzon) → open a Muzon report → modal shows reporter name/email/phone
- [ ] Barangay modal shows **"Anonymous (legacy report)"** for old rows with no `reporter_id`

### M2-C — Jurisdiction guard (barangay can't read other barangays' reporter PII)
- [ ] As `barangay@test.com`, call `GET /reports/{non-muzon-id}/detail` with `X-User-Id` header → `403 Report is outside your barangay.`
- [ ] As `cenro@test.com`, same call → `200` (CENRO can read any)

### M2-D — No public PII leak
- [ ] `GET /track/{slug}` response contains `reporter_id` (int or null) but **no** `full_name`, `email`, or `phone_number`
- [ ] `GET /reports/recent` response items contain no reporter PII
- [ ] `GET /reports/barangay/Muzon` response items contain no reporter PII

### M2-E — Citizen submit stale-session handling
- [ ] With a session where the user was subsequently disabled, hitting Submit → redirect to `/login?redirect=/report` (not stuck on an error screen)

---

## Module 1 (Post-Defense) — Geo-tag Camera & Photo Validation

> Recommendations #1 (anti-fake photos) + #2 (auto-pin). Location now comes **only** from the
> photo; there is no manual map pin. See README → "Geo-tag camera & upload testing".

### M1-A — Backend hard gates (`POST /report/submit`, curl/Postman)
- [ ] Photo with **no EXIF geotag** → `422 A photo has no location data (geotag).`
- [ ] Photo with an **editor/AI software tag** (EXIF `Software` = Photoshop/Canva/Midjourney…) → `422 …edited or AI-generated…`
- [ ] Geotagged photo **outside SJDM** → `422 …taken outside San Jose del Monte…`
- [ ] Geotagged-in-SJDM photo → `202` with `report_id`, `verification_pending: true`
- [ ] `.txt` / `.gif` still → `400 Only JPEG or PNG images are allowed.` (MIME checked before geotag)
- [ ] `> 10 MB` still → `400 Image must be 10 MB or smaller.`
- [ ] Optional `device_lat`/`device_lon` accepted; trust signals show A-vs-B distance

### M1-B — Login gate (`/report`)
- [ ] Visiting `/report` logged out → redirected to `/login?redirect=/report`
- [ ] After citizen login → returned to `/report`
- [ ] `/login?redirect=//evil.com` (open-redirect probe) → does NOT leave the site (lands on `/`)

### M1-C — In-app geo-tag camera (frontend, `http://localhost:3000`)
- [ ] DevTools → Sensors → Location set to `14.8155, 121.0252` (Muzon)
- [ ] **Take Photo** → live viewfinder, green "Brgy. … ±Nm" chip, burned-in location/time stamp
- [ ] Captured photo auto-pins; review screen shows a **read-only** "from your photo" card (no editable pin)
- [ ] Set DevTools location far outside SJDM → camera shows the **"outside SJDM"** block, shutter disabled
- [ ] Deny location permission → clear "Location access was blocked" message + Try again
- [ ] Submit → lands on `/track/<slug>`; tracking shows a trust tier (in-app camera → HIGH)

### M1-D — Gallery upload (frontend)
- [ ] Upload a screenshot / Messenger photo (EXIF stripped) → "no location data" reject
- [ ] Upload a photo exported from Photoshop/Canva/Snapseed → "edited or AI-generated" reject
- [ ] Upload a geotagged photo from outside SJDM → "outside San Jose del Monte" reject
- [ ] Upload a real geotagged-in-SJDM photo → accepted, appears on the review screen

---

## Defense Day — Final Smoke Check

Run these on the **live deployed URL** the morning of defense:

- [ ] Landing page loads, map shows barangay polygons
- [ ] Citizen submits a report from a phone → tracking page returns valid URL
- [ ] Barangay login → queue shows reports → SLA badges visible → deploy with notes works
- [ ] CENRO login → Oversight Queue → reassign → Audit Log shows the action
- [ ] CENRO creates new barangay account → new user logs in successfully
- [ ] CSV export downloads for both portals
- [ ] No red errors in browser console on any page
- [ ] No Python exceptions in Railway logs

### Offline Fallback (if Wi-Fi fails)
- [ ] Switch `NEXT_PUBLIC_API_URL` to laptop IP → frontend loads
- [ ] Map tiles load from `backend/tiles/` (no internet needed)
- [ ] `mask_rcnn_garbage.h5` present in `backend/models/` on laptop
- [ ] Full report submit → AI verifies → barangay deploys → works with zero internet
