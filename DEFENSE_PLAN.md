# EcoWatch SJDM — Defense Sprint Plan (May 16 → May 26, 2026)

## Context

The EcoWatch SJDM capstone defense is on **May 25–26, 2026**. As of today (May 16), the core happy path works end-to-end: citizens submit reports, Mask R-CNN verifies them, ray-casting assigns the correct barangay, and barangay/CENRO portals can manage the lifecycle. However, both portals feel "kulang" (insufficient) for a real CENRO product — they lack the accountability, filtering, exports, and admin tooling a municipal LGU would actually need. Backend endpoints also have **no role-based access control** (anyone who knows the URL can `/deploy`, `/reassign`, or `/force-close`), which would be an obvious gap during defense Q&A.

**Budget**: ~30 working hours across 9 days (3–4 hrs/day, school + other classes ongoing).
**Demo target**: Live deployed URL (Vercel + Railway + Supabase) as primary, **fully offline-capable local laptop as backup** (OLFU QC Wi-Fi is mid-to-weak — true offline is the only safe fallback).
**Strategy**: Add 4–5 high-impact features per portal + polish the rest + deploy with buffer + **bake offline-mode into the same codebase** (one repo, two run modes via env vars).

This plan extends and aligns with **[techstack.md](techstack.md)** — it does not replace it. The Vercel + Railway + Supabase + Hugging Face stack stays as-is. The additions here are: feature scope for both portals, RBAC + audit log, file-by-file learning, and a proper **offline-resilience section** (techstack.md line 190 mentions "local fallback laptop" in one sentence; §7 below makes it real).

---

## 1. Prioritization of Features

Features are ranked **P0 (must)**, **P1 (should)**, **P2 (nice)** based on a defense-day cost/value lens: does this make the demo defensible to panelists who ask *"Would CENRO actually use this?"*

### Barangay Portal (`frontend/app/barangay/page.tsx`)

| # | Feature | P | Why it matters |
|---|---------|---|----------------|
| B1 | **Search + status + date filters** on the report queue | P0 | Every LGU portal has this; without it the queue is unusable past ~20 reports |
| B2 | **SLA badge** ("Pending 3 days", red if > 5) on each report row | P0 | Shows accountability is built in — direct quote during Q&A: "we surface SLA breaches" |
| B3 | **Deployment notes** (who was dispatched, when) captured on deploy | P0 | Real cleanup teams have names; no notes = toy demo |
| B4 | **CSV export** of barangay's monthly reports | P1 | Barangay officials submit paper reports to CENRO — this maps directly |
| B5 | Loading skeletons + empty states + toast notifications | P1 | Production feel; cheap to add |
| B6 | Real-time refresh (10s polling on the queue) | P2 | Skip unless time at end of week |

### CENRO Portal (`frontend/app/cenro/page.tsx`)

| # | Feature | P | Why it matters |
|---|---------|---|----------------|
| C1 | **Audit log** — every override action recorded (who, when, what, why) | P0 | Without this, "force-close" is indefensible. Pure red flag for any compliance-aware panelist |
| C2 | **User management** — CENRO creates/disables barangay accounts | P0 | Currently no way to onboard new barangays via UI; embarrassing if asked |
| C3 | **SLA breaches widget** on Command Center (list of reports past threshold) | P0 | Strategic-tier insight expected from a city-level dashboard |
| C4 | **Date range filter + advanced search** on Oversight Queue | P0 | "Show me May 2026 reports" — basic LGU need |
| C5 | **Analytics CSV/PDF export** for council meetings | P1 | "Can you generate a monthly report?" is a near-certain Q&A question |
| C6 | Fix duplicate "Graceville" entry in BARANGAYS array | P0 | Visible data bug — single-line fix |
| C7 | Configurable thresholds (AI confidence cutoff, SLA days) | P2 | Nice but skip if tight |

### Backend (`backend/main.py`, `models.py`)

| # | Feature | P | Why it matters |
|---|---------|---|----------------|
| X1 | **Role-based access control** on `/deploy`, `/resolve`, `/reassign`, `/force-close`, `/users/*` | P0 | Currently anyone can call admin endpoints. **Critical** — first thing a security-minded panelist will probe |
| X2 | **AuditLog model** + auto-write on every override | P0 | Backs feature C1 |
| X3 | Query params (status, date_from, date_to, search, limit, offset) on `/reports/*` | P0 | Backs B1 + C4 |
| X4 | `GET /reports/export` returning CSV | P1 | Backs B4 + C5 |
| X5 | `GET /reports/sla-breaches?days=N` | P0 | Backs B2 + C3 |
| X6 | `POST /users`, `PUT /users/{id}/disable`, `GET /users` (CENRO-only) | P0 | Backs C2 |
| X7 | Replace `print()` with `logging` in `ai_verifier.py` | P1 | Professional polish |
| X8 | Image upload size + MIME validation | P1 | Defensive coding talking point |

---

## 2. Research & References

Defensible "we based this on documented standards" answers during Q&A. Read these on Day 1 (15 min skim each, no deep dive):

| Source | Why |
|--------|-----|
| **RA 9003 — Ecological Solid Waste Management Act of 2000** | Legal foundation; cite when asked "why does CENRO need this?" |
| **DENR Memorandum Circulars on Solid Waste Management** | Operational standards CENRO follows |
| **DILG Memorandum Circular 2018-152** (LGU Solid Waste Mgmt) | Barangay-level responsibilities — backs the barangay portal scope |
| **Quezon City CESU online reporting portal** (public site) | Closest Philippine analogue; mirror their UX patterns |
| **SeeClickFix (US) / FixMyStreet (UK)** | International citizen-reporting precedents — cite as "industry pattern" |
| **BLGF reporting templates** (Bureau of Local Government Finance) | Format for CSV/PDF exports |
| **DENR CENRO operational manual** | Job functions of CENRO officers — informs C2 user-management features |

If the optional CENRO/Barangay interview happens (target: before May 20), bring this question list: *(1) How are dumping reports received today? (2) Who routes a complaint to a barangay? (3) What metrics matter to your monthly report? (4) Who creates new barangay/CENRO accounts in an existing system? (5) What's your SLA target for cleanup deployment?*

---

## 3. Development Timeline (Day-by-Day)

> Hours are budget caps, not targets. If a day finishes early, **stop** — banked time is for slippage later.

### **Day 1 — Sat May 16 (today): Setup + Learning Pass** (3 hrs)
- [ ] Read this plan together as a team; confirm feature priorities
- [ ] Walk through every file in §5 Learning Objectives — 1 hour, no editing
- [ ] Create a GitHub branch `defense-sprint` off `master`
- [ ] Open issues/tickets for B1–B5, C1–C6, X1–X8 (one per row above)
- [ ] Skim the §2 references (15 min total)
- [ ] Decide who owns frontend vs backend (if working as pair)

### **Day 2 — Sun May 17: Backend foundations (RBAC + Audit Log)** (4 hrs)
- [ ] **X1**: Add a simple `require_role(role)` FastAPI dependency reading user ID from request header (`X-User-Id`) — query DB, check role. Apply to `/report/{id}/deploy` (barangay), `/resolve` (barangay), `/reassign` (cenro), `/force-close` (cenro)
- [ ] **X2**: Add `AuditLog` SQLAlchemy model in [backend/models.py](backend/models.py): `id`, `user_id`, `action` (str), `target_type` (str), `target_id` (int), `details` (Text/JSON), `created_at`. Run `Base.metadata.create_all`
- [ ] Wrap deploy/resolve/reassign/force-close handlers in [backend/main.py](backend/main.py) to write an AuditLog row after each successful action
- [ ] Add `GET /audit-log?limit=&offset=` (CENRO-only) returning newest first
- [ ] Smoke-test with curl/Postman: unauthorized role → 403, authorized → 200 + audit row written

### **Day 3 — Mon May 18: Backend filtering, exports, SLA, user mgmt** (4 hrs)
- [ ] **X3**: Add query params to `/reports/recent` and `/reports/barangay/{name}`: `status`, `date_from`, `date_to`, `search` (matches tracking_id or notes), `limit`, `offset`
- [ ] **X4**: Add `GET /reports/export?barangay=&date_from=&date_to=` returning CSV (use Python `csv` module + `StreamingResponse`)
- [ ] **X5**: Add `GET /reports/sla-breaches?days=3` returning reports where `status IN (pending, verified, deployed) AND created_at < now() - days`
- [ ] **X6**: Add `POST /users` (cenro-only, create barangay account), `PUT /users/{id}/disable` (soft-delete via `is_active` bool on User), `GET /users?role=barangay` (cenro-only)
- [ ] Add `is_active` field to User model; gate login on it
- [ ] **X7**: Replace 6 `print()` statements in [backend/ai_verifier.py](backend/ai_verifier.py) with `logging.getLogger(__name__)`
- [ ] **X8**: Add file size (≤ 10MB) and MIME type (image/jpeg, image/png) check in the upload helper

### **Day 4 — Tue May 19: Barangay portal frontend (B1–B5)** (4 hrs)
- [ ] **C6 (fix first)**: Remove duplicate "Graceville" in BARANGAYS array — single line in [frontend/app/cenro/page.tsx](frontend/app/cenro/page.tsx)
- [ ] **B1**: Filter bar above the queue table — search input (debounced 300ms), status dropdown, date range pickers. Wire to backend query params
- [ ] **B2**: Compute `daysOpen = (now - created_at)` per row; render a badge: green ≤ 2d, yellow 3–4d, red ≥ 5d
- [ ] **B3**: Add `deploymentNotes` textarea to the "Deploy" modal action; pass as form data; persist via a new column `deployment_notes` on Report (also add migration / `Base.metadata.create_all`)
- [ ] **B4**: "Export CSV" button next to filter bar → calls `/reports/export` with current filters → triggers file download
- [ ] **B5**: Replace inline error `<div>`s with a toast library (`sonner` — minimal, ~5KB). Add a skeleton row (3 grey bars) shown while `loading=true`

### **Day 5 — Wed May 20: CENRO portal frontend (C1–C5)** (4 hrs)
- [ ] **C1**: New "Audit Log" tab (4th tab in CENRO dashboard) — table of audit entries (timestamp, user, action, target). Sortable by date desc. Filter by action type
- [ ] **C2**: New "User Management" tab — list barangay accounts, "Add Barangay Account" modal (email, full_name, barangay_assignment, generate password), "Disable" button per row
- [ ] **C3**: Add "SLA Breaches" card to Command Center view showing count + top 3 oldest breaching reports — click → navigate to Oversight Queue pre-filtered
- [ ] **C4**: Filter bar on Oversight Queue (mirror of B1) — date range, status, barangay dropdown, search
- [ ] **C5**: "Export Analytics CSV" button on Command Center → exports stats by barangay + status breakdown

### **Day 6 — Thu May 21: Cross-cutting polish + buffer** (3 hrs)
- [ ] Frontend `<ErrorBoundary>` wrapper in [frontend/app/layout.tsx](frontend/app/layout.tsx) with friendly fallback UI
- [ ] Confirmation dialog before "Disable user" and "Force Close" (the latter exists already; double-check)
- [ ] Loading skeletons on CENRO charts (Recharts `<Skeleton>` or grey placeholder boxes)
- [ ] Pagination controls on Oversight Queue + Audit Log (50 rows/page)
- [ ] Empty states with helpful CTA (e.g., "No reports yet — share your QR codes")
- [ ] Replace silent `catch(e) {}` in [frontend/components/Navbar.tsx](frontend/components/Navbar.tsx) with explicit handling
- [ ] **Buffer**: any P1 that slipped from Days 2–5 goes here

### **Day 7 — Fri May 22: Deployment** (4 hrs)
- [ ] **Hugging Face**: Create repo `<username>/ecowatch-mrcnn-weights`, upload `mask_rcnn_garbage.h5` (~250MB), copy the raw download URL
- [ ] **Backend on Railway**:
  - Add a `Procfile` or `railway.toml` (uvicorn main:app --host 0.0.0.0 --port $PORT)
  - Add boot script that downloads weights from HF URL on first start if `models/mask_rcnn_garbage.h5` missing
  - Set env vars: `DATABASE_URL` (Supabase Postgres), `HF_WEIGHTS_URL`, `ALLOWED_ORIGINS` (Vercel URL)
  - Persistent volume for `/uploads` (Railway "Volume" feature)
  - Deploy; wait for first successful boot (8GB RAM plan — TF will take ~60s)
- [ ] **Database on Supabase**: Project Free tier (upgrade to Pro on May 20 if not done — though answer was Pro May 20; double-check), enable PostGIS extension, run `Base.metadata.create_all` via a one-off script
- [ ] Seed prod DB: test accounts (citizen / barangay / cenro), 14 demo reports (from `seed_test_data.py`)
- [ ] **Frontend on Vercel**: Import the repo, set `NEXT_PUBLIC_API_URL` = Railway URL, deploy
- [ ] Update backend CORS to allow Vercel domain (`https://<project>.vercel.app`)
- [ ] Browse the deployed URL — verify map loads, login works, sample report submission works

### **Day 7.5 — Fri evening May 22: Offline-mode hardening** (1 hr, folded into Day 7 buffer)
- [ ] Pre-cache Leaflet tiles for the SJDM bounding box at zoom 12–17 → save as a local tile pack (use [leaflet-offline](https://github.com/allartk/leaflet-offline) or download via a simple Python script + `requests`)
- [ ] Add `OFFLINE_MODE=true` env flag in [frontend/components/MapComponent.tsx](frontend/components/MapComponent.tsx) — when set, swap tile URL from CartoDB CDN to a local `/tiles/{z}/{x}/{y}.png` path served by the backend
- [ ] Verify `mask_rcnn_garbage.h5` is present in `backend/models/` on the laptop (one-time download from HF, then commit to a local archive, **not** to git)
- [ ] Snapshot Supabase prod DB → import into a local PostgreSQL (or fall back to SQLite — `database.py` already supports both)
- [ ] Document the **2-command switch** in `OFFLINE_README.md`: `docker compose up` (or `uvicorn` + `npm run dev`) on the laptop, then point a phone to the laptop's hotspot SSID

### **Day 8 — Sat May 23: End-to-end testing + bug fixes** (3 hrs)
- [ ] Run the **5 user journeys** on the deployed URL:
  1. Anonymous citizen submits a report from a phone (use real phone camera)
  2. Barangay admin sees the report, deploys with notes, uploads cleanup photo
  3. CENRO views the report in Oversight Queue, reassigns to wrong barangay, audit log captures it
  4. CENRO creates a new barangay account, the new user can log in
  5. CSV export downloads with correct columns
- [ ] Mobile responsiveness sweep (Chrome devtools + your phone)
- [ ] Cold-start test: stop Railway service, restart, time-to-first-response (should be < 90s after weights cached)
- [ ] Fix bugs found — strict cutoff at hour 3; defer cosmetic bugs to Day 9

### **Day 9 — Sun May 24: Defense prep + rehearsal** (3 hrs)
- [ ] Write a **5-minute demo script** (literal click-by-click sequence + speaker notes)
- [ ] Re-seed prod DB with curated demo data (visually impressive: spread across barangays, mix of statuses, recent dates)
- [ ] Rehearse the demo 2x end-to-end against the live URL
- [ ] Prepare **backup plan card** (laminated/printed): local laptop URL + how to switch to it within 30 seconds
- [ ] Final smoke test at end of day — full happy path
- [ ] Print/finalize defense slides if your school requires them

### **Day 10 — Mon May 25 + Tue May 26: Defense**
- Morning of: 10-min smoke check (login, submit, view), nothing else
- Run with the live URL; switch to local laptop ONLY if URL fails

---

## 4. Optimization Strategies

### Code-level

**Backend** ([backend/main.py](backend/main.py)):
- **RBAC pattern**: One reusable FastAPI `Depends` function (`require_role("cenro")` etc.) — apply via decorator-like dependency injection. Do not duplicate auth logic in every route handler.
- **Try/except scope**: Wrap *only* the I/O boundary (DB call, file I/O, model inference), not the entire route. Bubble up `HTTPException` with specific status codes (400 validation, 403 role, 404 not found, 500 server). Avoid catch-all `except Exception` that swallows everything.
- **Logging**: Replace `print()` calls in [backend/ai_verifier.py](backend/ai_verifier.py) and [backend/spatial_utils.py](backend/spatial_utils.py) with module-level `logger = logging.getLogger(__name__)`. Configure root logger once in `main.py` with INFO level + timestamp format.
- **Validation**: Use Pydantic `Field(..., ge=-90, le=90)` style constraints on lat/lon. Validate file size and MIME at the upload helper, not the endpoint.
- **No premature optimization**: Don't add caching, Redis, or async DB drivers — SQLAlchemy sync is fine for defense scale.

**Frontend** (`frontend/app/**`):
- **Try/catch**: Only around `fetch()` calls. Always set `loading=false` in `finally`. Show toast on error, never silent-catch.
- **API helper**: Extract a single `api()` wrapper in `frontend/lib/api.ts` — handles base URL, JSON parsing, error normalization. Replace inline `fetch()` calls in both portal pages.
- **Debouncing**: Search inputs debounce 300ms before firing API call (use a tiny `useDebounce` hook, no library).
- **No state managers**: `useState` + URL params are sufficient — don't introduce Redux/Zustand this late.

### File management

- **Delete**: None of the existing Python files are dead — all referenced. Do NOT delete `seed_test_data.py`, `test_*.py`, or anything in `mrcnn/`.
- **Add to .gitignore**: `backend/uploads/*` (already there per recent commit), `backend/ecowatch.db` (already there), `backend/models/*.h5` (already there).
- **Clean before deploy**: `__pycache__` directories, any `.bak` files, the 26 test images in `backend/uploads/` — keep 3–4 for demo, delete the rest.

### Testing

- Keep `test_auth.py` and `test_analytics.py` — extend with one test per new RBAC-protected endpoint (negative case: wrong role → 403).
- **Manual E2E checklist** is more valuable than automated tests at this stage. Build it Day 8.

---

## 5. Learning Objectives — What Each File Does

Take 1 hour on Day 1 to walk through these. The team should be able to answer *"what does X file do?"* during defense.

### Backend

| File | Purpose (one sentence) |
|------|----------|
| [backend/main.py](backend/main.py) | FastAPI app entry point; defines all HTTP endpoints, CORS, request/response Pydantic schemas, and orchestrates calls to other modules |
| [backend/models.py](backend/models.py) | SQLAlchemy ORM models — `User`, `Report`, and the `ReportStatus` enum — these become DB tables |
| [backend/database.py](backend/database.py) | SQLAlchemy engine + session factory; reads `DATABASE_URL` env var (Postgres in prod, SQLite locally) |
| [backend/ai_verifier.py](backend/ai_verifier.py) | Wraps Mask R-CNN inference — loads `.h5` weights, runs garbage detection on an image, returns confidence + a colored mask overlay PNG |
| [backend/spatial_utils.py](backend/spatial_utils.py) | Ray-casting (point-in-polygon) using Shapely — given a lat/lon, returns the SJDM barangay from `data/sjdm_barangays.geojson` |
| [backend/analytics.py](backend/analytics.py) | DBSCAN clustering (scikit-learn) over active report coordinates → returns hotspot clusters with intensity scores |
| [backend/seed_test_data.py](backend/seed_test_data.py) | Dev utility — creates 3 test users + 14 demo reports for local development |
| [backend/test_auth.py](backend/test_auth.py) | Integration tests for `/auth/register` and `/auth/login` |
| [backend/test_analytics.py](backend/test_analytics.py) | Integration tests for spatial point-in-polygon + DBSCAN hotspot detection |
| [backend/mrcnn/](backend/mrcnn/) | Vendored Mask R-CNN library (model.py, config.py, utils.py, visualize.py) — **do not modify**, treat as a black box |

### Frontend

| File | Purpose (one sentence) |
|------|----------|
| [frontend/app/layout.tsx](frontend/app/layout.tsx) | Root layout — sets `<html>`, mounts the `<Navbar>`, applies global font and dark theme |
| [frontend/app/page.tsx](frontend/app/page.tsx) | Landing page — full-screen Leaflet map showing all reports + heatmaps, with CTA buttons for citizen reporting |
| [frontend/app/report/page.tsx](frontend/app/report/page.tsx) | Public report submission form — location picker map, photo upload, notes field |
| [frontend/app/track/[id]/page.tsx](frontend/app/track) | Public status tracker — lookup by tracking slug, no auth required |
| [frontend/app/login/page.tsx](frontend/app/login/page.tsx) | Login screen — stores user in localStorage on success |
| [frontend/app/signup/page.tsx](frontend/app/signup/page.tsx) | Citizen signup screen |
| [frontend/app/barangay/page.tsx](frontend/app/barangay/page.tsx) | Barangay admin portal — report queue, deploy/resolve actions, jurisdictional map |
| [frontend/app/cenro/page.tsx](frontend/app/cenro/page.tsx) | CENRO command center — analytics dashboard, hotspot map, oversight queue, override actions |
| [frontend/components/Navbar.tsx](frontend/components/Navbar.tsx) | Top navigation — role-aware links, mobile hamburger, sign-out |
| [frontend/components/MapComponent.tsx](frontend/components/MapComponent.tsx) | Leaflet map wrapper — renders barangay boundaries (GeoJSON), report pins, hotspot heatmap circles |
| [frontend/components/LocationPickerMap.tsx](frontend/components/LocationPickerMap.tsx) | Smaller map used in the report form — lets the citizen drop a pin |
| [frontend/components/FloatingChat.tsx](frontend/components/FloatingChat.tsx) | Gemini AI chatbot widget (nice-to-have, not core) |
| [frontend/components/QRCodeModal.tsx](frontend/components/QRCodeModal.tsx) | Modal that displays a printable QR code linking to `/report` for physical signage |

### Data & Config

| File | Purpose |
|------|---------|
| [data/sjdm_barangays.geojson](data/sjdm_barangays.geojson) | 59 barangay polygons with `ADM4_EN` (name) and `ADM4_PCODE` properties; powers ray-casting + map overlays |
| [backend/requirements.txt](backend/requirements.txt) | Python deps — TensorFlow 2.16.1 is the heavyweight (~500MB) |
| [techstack.md](techstack.md) | Existing deployment notes — read before Day 7 |

---

## 6. Deployment Plan

### Pre-deployment (Day 7 morning)

1. **Hugging Face Hub**: Create `<username>/ecowatch-mrcnn-weights` repo, `huggingface-cli upload` the `.h5` file, note the raw URL.
2. **Supabase**: Provision project (existing if already created), enable PostGIS extension via SQL editor (`CREATE EXTENSION IF NOT EXISTS postgis;`), grab the connection string.

### Railway (Backend)

1. New project → "Deploy from GitHub repo" → select EcoWatch repo → root = `backend/`.
2. Add a `railway.toml`:
   ```
   [build]
   builder = "NIXPACKS"
   [deploy]
   startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT"
   ```
3. Env vars: `DATABASE_URL`, `HF_WEIGHTS_URL`, `ALLOWED_ORIGINS=https://<vercel-url>`.
4. Add a startup hook in `main.py` (`@app.on_event("startup")`) that downloads `HF_WEIGHTS_URL` → `models/mask_rcnn_garbage.h5` if missing.
5. Attach a persistent volume mounted at `/app/uploads`.
6. Plan: Hobby ($5/mo, 8GB RAM — required for TF).

### Vercel (Frontend)

1. Import repo, root = `frontend/`.
2. Env var: `NEXT_PUBLIC_API_URL=https://<railway-url>`.
3. Default Next.js 16 build settings work.
4. Free Hobby plan.

### Post-deployment verification

- [ ] Open Vercel URL → landing page renders, map loads, barangay polygons appear
- [ ] Submit a test report from a phone → tracking page returns a valid URL
- [ ] Log in as test barangay user → queue shows the report → deploy works → audit log row appears
- [ ] Log in as CENRO → user management creates a new barangay account → log out, log in as new user → success
- [ ] Cold-start: Railway sleep → wake → first request returns within 90s (TF model load)

### Post-deployment maintenance (Day 8 onward)

- Keep Railway warm with a cron pinger (UptimeRobot free tier, 5-min interval) — avoids cold starts during the defense window.
- Monitor Railway logs daily for crashes.
- Do not push to `master` between Day 9 morning and the defense — only push hotfixes to `defense-sprint` branch.

---

## 7. Offline / Venue-Network Resilience (addresses OLFU Wi-Fi risk)

**Why this exists**: OLFU QC Wi-Fi is mid-to-weak. Even if Railway/Vercel are up, the venue connection can drop the request. A "local laptop" without prep still fails because Leaflet tiles, Mask R-CNN weights, and Postgres are all cloud-dependent. We need a laptop that runs the **entire stack with zero internet** — and we get there without forking the codebase.

### Strategy: One codebase, two modes — NOT a separate branch

Maintain a **single `master` branch** that runs in either mode based on env vars. A parallel offline branch would force you to hand-merge every feature fix into two places — pure pain with 9 days on the clock.

| Concern | Online mode (env) | Offline mode (env) |
|---------|-------------------|---------------------|
| Frontend API URL | `NEXT_PUBLIC_API_URL=https://<railway>` | `NEXT_PUBLIC_API_URL=http://192.168.x.x:8000` (laptop IP) |
| Backend DB | `DATABASE_URL=postgres://...supabase...` | `DATABASE_URL=sqlite:///./ecowatch.db` (or local Postgres) |
| Mask R-CNN weights | Downloaded from HF on startup | Pre-baked in `backend/models/mask_rcnn_garbage.h5` |
| Map tiles | CartoDB CDN | Local tile pack served from `backend/tiles/` |
| File uploads | Supabase Storage | Local `backend/uploads/` (already works) |
| Toggle flag | `OFFLINE_MODE=false` | `OFFLINE_MODE=true` |

[backend/database.py](backend/database.py) already abstracts SQLite vs Postgres via `DATABASE_URL` — zero new code there. The only new code is the **tile-URL swap** in [frontend/components/MapComponent.tsx](frontend/components/MapComponent.tsx) (one ternary on the `TileLayer` URL).

### What to prep before defense (covered in Day 7.5)

1. **Tile pack**: download SJDM bbox tiles once at zoom 12–17 (~50MB), store at `backend/tiles/{z}/{x}/{y}.png`. Backend serves them via FastAPI `StaticFiles`. Commit a `.gitignore` rule for `backend/tiles/*` — too big for git; archive as a zip.
2. **Model weights**: keep `mask_rcnn_garbage.h5` (~250MB) on the laptop. Archive separately (USB stick + Drive backup).
3. **Local DB snapshot**: Day 9 — dump prod Supabase → restore to local SQLite/Postgres so demo data matches what you've been showing.
4. **Hotspot procedure**: phone tethers to laptop. Laptop becomes the "venue" Wi-Fi network. Panelist's phone (if part of demo) connects to your hotspot.
5. **Switch drill**: rehearse the cutover on Day 9 — should be under 60 seconds. Two `.env.local` files saved, swap them and restart.

### When to switch modes

- **Defense morning**: open live URL on a backup phone. If it loads in < 5s, go live.
- **If it lags or fails**: announce "we'll switch to our local instance for reliability" — switch in under 1 min — continue demo. Frame it as a **feature**, not a fallback ("EcoWatch can run on-prem for barangays without reliable internet" is actually a defensible CENRO talking point).

### What this section explicitly does NOT do

- **No PWA / Service Worker offline-first frontend.** Out of scope for 9 days. Real offline-first apps need weeks of caching work and would add bugs.
- **No offline Mask R-CNN download from inside the running app.** Pre-load only.
- **No second git branch.** Same `master`, two `.env.local` files.

---

## Verification — How We'll Know We're Ready

By **end of Day 8**, all of these should pass on the deployed URL:

1. Anonymous citizen submits a report from a phone in under 2 minutes → tracking page loads
2. Barangay admin sees only their jurisdiction's reports → SLA badges visible → can deploy with notes → cleanup photo upload re-verifies via Mask R-CNN
3. CENRO sees Audit Log entries for every override action with timestamps
4. CENRO creates a new barangay account via UI → new user can log in
5. CSV export downloads for both barangay monthly report and CENRO analytics
6. Cold-start latency < 90s; warm requests < 2s
7. Backend rejects calls to admin endpoints with wrong role (curl returns 403)
8. No console errors on any page load; no Python exceptions in Railway logs for the 5 user journeys

If any of these fail on Day 8, Day 9 is the fix day. If any fail on Day 9 morning, fall back to local laptop demo.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| 3–4 hrs/day slips to 2 hrs on a busy school day | P2 items skipped first; Day 6 is the buffer day |
| Railway cold start kills demo opening | UptimeRobot pinger; warm the service 1 hr before defense starts |
| Mask R-CNN OOMs on Railway 8GB | Mock mode fallback already implemented in `ai_verifier.py` |
| Supabase free tier limits hit during defense | Pro upgrade scheduled May 20 (per techstack.md) |
| Team member sick / unavailable | Pair-program on backend Days 2–3; either person can ship deploy Day 7 |
| Live URL fails during defense | **§7 offline mode** — local laptop with cached tiles + local weights + local DB; phone hotspot for client devices; switch < 60s |
| OLFU venue Wi-Fi too weak to reach Vercel/Railway | Same as above — default to offline mode if backup phone shows > 5s load time on live URL |
| Forgot to pre-cache tiles or weights before going to venue | Day 9 morning checklist explicitly verifies `backend/tiles/` and `backend/models/*.h5` exist on the laptop |
