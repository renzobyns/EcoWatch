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
