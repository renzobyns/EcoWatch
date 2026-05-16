# EcoWatch SJDM — Codebase Guide
> What every file does, in plain language. Read this before touching any code.

---

## BACKEND FILES (`backend/`)

---

### `database.py` — DB Connection
**One job**: connect the app to a database.

Reads the `DATABASE_URL` environment variable:
- If not set → uses **SQLite** (a file called `ecowatch.db` on your laptop, zero setup)
- If set to a Supabase URL → uses **PostgreSQL** (cloud)

Same code works for both. You never change this file — you just change the env var.

Key thing: `get_db()` at the bottom is a **dependency** that every API route uses to borrow a database session for one request, then automatically close it.

---

### `models.py` — Database Tables (ORM)
**One job**: define what the database tables look like, in Python.

SQLAlchemy reads these Python classes and turns them into actual DB tables. Two tables:

**`User` table** — stores accounts
- `role` = citizen / barangay / cenro (this controls what each user can see)
- `barangay_assignment` = only filled for barangay role (tells the portal which barangay to show)
- `password_hash` = bcrypt-hashed password, never plain text

**`Report` table** — stores every incident report
- `lat`, `lon` = where the dumping is
- `barangay` = auto-computed by ray-casting (not typed by user)
- `reporter_id` = nullable — allows anonymous reports without an account
- `status` = one of 6 values (see ReportStatus enum below)
- `ai_confidence` = float 0.0–1.0 from Mask R-CNN
- `tracking_id` = human-readable ID like `EW-0042`
- `tracking_url` = random slug like `/track/a3f9c2b1`
- `image_url`, `ai_mask_url`, `cleanup_image_url` = file paths to uploaded photos

**`ReportStatus` enum** — the 6 lifecycle steps:
```
PENDING → VERIFIED or REJECTED (AI decides)
VERIFIED → DEPLOYED (barangay dispatches team)
DEPLOYED → RESOLVED or FAILED_CLEANUP (AI checks cleanup photo)
```

> **What we're adding on Day 2**: `AuditLog` table (tracks every admin action), `is_active` on User (for disabling accounts), `deployment_notes` on Report.

---

### `main.py` — API Routes (The Orchestrator)
**One job**: define all HTTP endpoints and wire them to the right modules.

This is the biggest file (535 lines). Every time the frontend calls the backend, it hits an endpoint here. Structure:

**Boot-up (lines 1–37)**
- Imports all other modules
- Line 19: `create_all()` auto-creates DB tables on every server start — that's why you never run migrations manually in dev
- CORS is currently `allow_origins=["*"]` — allows all domains. We lock this to Vercel URL on Day 7

**Pydantic Schemas (lines 40–86)**
- `LoginRequest`, `ReportResponse`, etc. — these are like TypeScript interfaces for Python
- They define exactly what JSON goes in and what JSON comes out of each endpoint

**Helper Functions (lines 93–120)**
- `generate_tracking_id()` — makes `EW-0001` style IDs by counting existing reports
- `save_upload()` — saves a photo file to `backend/uploads/` and returns the URL
- `hash_password()` / `verify_password()` — bcrypt wrappers

**Endpoints by group:**

| Group | Endpoints | Notes |
|-------|-----------|-------|
| Health | `GET /`, `GET /health` | Just status pings |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/users` | No RBAC yet — **we add this Day 2** |
| Spatial | `POST /report/validate-location`, `GET /spatial/barangays` | Location validation + GeoJSON for map |
| Report Submit | `POST /report/submit` | Biggest pipeline: image → AI → spatial → DB in one request |
| Tracking | `GET /report/track/{slug}`, `GET /reports/recent`, `GET /reports/barangay/{name}` | Public reads |
| Barangay Actions | `PUT /report/{id}/deploy`, `POST /report/{id}/resolve` | No auth check yet — **we fix Day 2** |
| CENRO Actions | `PUT /report/{id}/reassign`, `PUT /report/{id}/force-close` | No auth check yet — **we fix Day 2** |
| Analytics | `GET /spatial/heatmaps`, `GET /analytics/overview`, `GET /analytics/barangay-ranking` | Read-only stats |

**The submit pipeline** (`POST /report/submit`) is the most important endpoint:
1. Read image bytes
2. Run Mask R-CNN (`verifier.verify_image()`)
3. Save photo to disk
4. Ray-casting to find barangay (`spatial_utils`)
5. Generate tracking ID + slug
6. Save Report row to DB

---

### `ai_verifier.py` — Mask R-CNN Wrapper
**One job**: load the AI model once and run garbage detection on photos.

Built as a **singleton** — `verifier = AIVerifier()` at the bottom (line 196). The class loads on server boot; every report submission reuses the same loaded model. This is critical — loading TensorFlow takes 30–60 seconds, you cannot do it per-request.

**Three main methods:**

`__init__()` — checks if `models/mask_rcnn_garbage.h5` exists
- Exists → loads real Mask R-CNN
- Missing → falls back to **mock mode** (random results). This is your safety net for defense.

`verify_image(image_bytes)` — the actual detection
- Takes raw bytes from an upload
- Decodes with OpenCV, runs `model.detect()`
- Returns `{ verified: bool, confidence: float, instances_found: int, boxes: [...] }`
- Threshold is **0.5** — below 50% confidence = rejected

`generate_mask_image()` — the wow-factor
- Paints colored masks + bounding boxes over the original photo
- Returns JPEG bytes — this is the image with the green/red overlay you see on the portal

`_mock_verify()` — fallback when model not loaded
- Returns random results (80% chance of "waste detected")
- Makes the whole system demoed without needing GPU

**Defense Q&A answers:**
- "Why Mask R-CNN not YOLO?" → Instance segmentation gives pixel-level masks, not just boxes — more precise for showing waste regions
- "Confidence threshold?" → 0.5 (50%)
- "What if model fails to load?" → Mock fallback, system stays available

---

### `spatial_utils.py` — Ray-Casting (Barangay Finder)
**One job**: given a lat/lon, figure out which SJDM barangay it's inside.

One function: `get_barangay_from_coords(lat, lon)`
1. Loads `data/sjdm_barangays.geojson` (59 barangay polygons)
2. Creates a `Point(lon, lat)` — **note**: Shapely uses (x, y) = (lon, lat), not (lat, lon). Common gotcha.
3. Loops through every barangay polygon, returns the first one containing the point
4. Returns `{"error": "..."}` if outside SJDM

This is called automatically during every report submission. Citizens never see it — they just pick a location on the map and the system silently assigns the right barangay.

---

### `analytics.py` — DBSCAN Hotspot Detection
**One job**: cluster report coordinates into "hotspot" zones for the CENRO heatmap.

One function: `get_heatmap_clusters(reports)`

Uses **DBSCAN** (a clustering algorithm) with:
- `eps=0.001` degrees ≈ **~100 meters** radius
- `min_samples=2` — need at least 2 reports to count as a hotspot

Reports that don't cluster (`label = -1`) are "noise" — lone reports, not shown as hotspots.
Each cluster gets a centroid (center point), an `intensity` count, and individual point list.

**Defense Q&A: "Why DBSCAN not K-Means?"**
K-Means needs you to say "find me exactly N clusters" upfront. DBSCAN discovers clusters automatically — perfect when you don't know how many dumping hotspots SJDM has.

---

### `seed_test_data.py` — Demo Data Generator
**One job**: create test users + reports for development.

Run it once: `python seed_test_data.py`

Creates:
- `citizen@test.com` / `password123`
- `barangay@test.com` / `password123` (assigned to Muzon)
- `cenro@test.com` / `password123`
- 14 demo reports spread across different barangays + statuses

Use this on Day 7 to seed the production Supabase database before the defense.

---

### `test_auth.py` and `test_analytics.py` — Integration Tests
Basic tests that hit real endpoints and assert results. Not unit tests — they need the server running and a real DB. Keep them, don't delete. We'll add RBAC negative tests (wrong role → 403) on Day 6.

---

### `mrcnn/` folder — Vendored Mask R-CNN Library
**Do not touch.** This is a copy of the open-source Mask R-CNN library adapted for TensorFlow 2. It contains:
- `model.py` — the actual neural network architecture (130KB)
- `config.py` — base configuration class
- `utils.py` — image processing utilities
- `visualize.py` — mask drawing utilities

Treat it like `node_modules` — it's a dependency, not your code.

---

## FRONTEND FILES (`frontend/`)

---

### `app/layout.tsx` — Root Layout
**One job**: wrap every page with the Navbar and global styles.

Mounts `<Navbar>` at the top, adds `pt-16` padding to the main content so it doesn't hide under the fixed navbar. Everything else is just HTML boilerplate (`<html lang="en">`, dark theme, antialiasing).

> **What we're adding on Day 6**: `<ErrorBoundary>` wrapper here so a crashed component shows a friendly error instead of a blank page.

---

### `components/Navbar.tsx` — Navigation Bar
**One job**: show the right links based on who's logged in.

Reads `ecowatch_user` from `localStorage` on mount. Based on the `role` field:
- `barangay` → shows "Barangay Portal" link
- `cenro` → shows "CENRO Dashboard" link
- Not logged in → shows "Log In" button

Has a responsive mobile hamburger menu (the 3-line icon that becomes an X).

**Known issue (line 21)**: `catch(e) {}` silently swallows JSON parse errors. If localStorage is corrupted, the user just stays "logged out" with no error. We fix this on Day 6.

---

### `app/login/page.tsx` — Login Page
Sends `POST /auth/login` with email + password. On success, saves the user object to `localStorage` as `ecowatch_user`, then redirects based on role:
- barangay → `/barangay`
- cenro → `/cenro`
- citizen → `/`

---

### `app/report/page.tsx` — Report Submission Form
The citizen-facing form. Has:
- `LocationPickerMap` — drop a pin on the map
- Photo upload input
- Notes text field
- Sends `POST /report/submit` as `multipart/form-data`
- Shows tracking ID on success

---

### `app/track/[id]/page.tsx` — Public Report Tracker
No login needed. Takes the tracking slug from the URL, calls `GET /report/track/{slug}`, shows current status, AI confidence, photos, and timeline. Citizens share this link to check their report.

---

### `app/barangay/page.tsx` — Barangay Admin Portal
**Role-protected** — redirects to `/` if not barangay role.

Three-tab layout: Pending | Deployed | Done

**What it does:**
- Fetches reports for `user.barangay_assignment` on load
- Shows a table with tracking ID, date, status badge, AI confidence, and a "Manage" button
- Clicking "Manage" opens a modal showing the location mini-map, citizen photo, AI overlay
- From the modal: Deploy button (sends `PUT /report/{id}/deploy`) or upload cleanup photo + Resolve button (sends `POST /report/{id}/resolve`)
- Right sidebar: `MapComponent` showing only this barangay's reports

**What we're adding on Day 4:**
- Search + date filter bar
- SLA age badges (green/yellow/red by how many days old)
- Deployment notes field in the deploy modal
- CSV export button
- Toast notifications instead of inline error divs

---

### `app/cenro/page.tsx` — CENRO Command Center
**Role-protected** — redirects to `/` if not cenro role.

Three-tab layout: Command Center | Overview Map | Oversight Queue

**Command Center tab:**
- 4 KPI cards (Total Reports, Active, Deployed, Success Rate)
- Pie chart of status breakdown (Recharts)
- 14-day trend line chart (Recharts)
- City-wide map
- Barangay leaderboard (ranked by resolution rate)
- Recent activity feed (last 10 reports)

**Overview Map tab:**
- Full-size map with all report pins + hotspot heatmap circles
- Two stat cards (success rate, total reports)

**Oversight Queue tab:**
- Table of ALL reports city-wide
- "Oversight" button per row → opens modal with Reassign and Force Close actions

**Known bug (line 22):** `"Graceville"` appears twice in the `BARANGAYS` array. First fix on Day 4.

**What we're adding on Day 5:**
- Audit Log tab (4th tab)
- User Management tab (5th tab)
- SLA Breaches widget on Command Center
- Date range filter + search on Oversight Queue
- CSV export button

---

### `components/MapComponent.tsx` — The Leaflet Map
**One job**: render an interactive map with barangay boundaries, report pins, and hotspot circles.

On mount:
1. Fetches barangay GeoJSON from `GET /spatial/barangays`
2. Draws the 59 barangay boundary polygons (hover to highlight, click to focus)
3. Plots a colored pin per report (Red = Pending/Verified, Yellow = Deployed, Green = Resolved)
4. Draws red semi-transparent circles for heatmap hotspots

Each pin has a popup with the report photo, status, barangay, and link to the tracking page.

Accepts a `focusedBarangay` prop — when set, auto-zooms to that barangay's bounds and filters pins to only that barangay.

If the backend is unreachable, shows a banner "Backend unavailable — map overlay disabled" and still loads the base map.

**What we're adding on Day 7.5 (offline mode):** A `OFFLINE_MODE` env flag that swaps the CartoDB CDN tile URL to a local `/tiles/{z}/{x}/{y}.png` path — so the map works with zero internet.

---

### `components/LocationPickerMap.tsx` — Report Form Map
A smaller, simpler version of MapComponent used only on the report submission form. Lets citizens click anywhere on the map to drop a pin and get coordinates. Those coordinates feed into the `POST /report/submit` call.

---

### `components/FloatingChat.tsx` — AI Chatbot Widget
A floating chat button that connects to Gemini AI. Nice-to-have feature, not core to the defense demo. Don't touch it — if it breaks, disable it; don't waste time fixing it.

---

### `components/QRCodeModal.tsx` — QR Code Display
Shows a printable QR code that links to `/report`. Used for physical QR stickers that go near waterways. Citizens scan → go straight to the report form.

---

## DATA FILES

---

### `data/sjdm_barangays.geojson` — The 59 Barangay Polygons
GeoJSON file with the exact geographic boundaries of all 59 SJDM barangays.

Each feature has:
- `ADM4_EN` — barangay name (e.g. `"Muzon"`)
- `ADM4_PCODE` — government code
- `geometry` — polygon coordinates

Used by two things:
1. `spatial_utils.py` — ray-casting to assign reports to a barangay
2. `MapComponent.tsx` — drawing the boundary overlays on the map

---

## HOW THE PIECES CONNECT (Full Flow)

```
Citizen submits report
        ↓
frontend/app/report/page.tsx   (form + location picker)
        ↓ POST /report/submit (multipart/form-data)
backend/main.py                (orchestrator)
        ├── ai_verifier.py     → Mask R-CNN detects garbage
        ├── spatial_utils.py   → Ray-casting finds barangay
        └── models.py / DB     → Report saved with tracking ID
        ↓
Barangay admin logs in
        ↓
frontend/app/barangay/page.tsx → fetches /reports/barangay/{name}
        ↓ Deploy / Resolve actions → main.py updates status
        ↓ Resolve triggers ai_verifier again on cleanup photo
        ↓
CENRO logs in
        ↓
frontend/app/cenro/page.tsx    → fetches /reports/recent + /spatial/heatmaps
        ↓                         analytics.py runs DBSCAN for hotspots
        └── Reassign / Force-close → main.py updates status
```

---

## THINGS WE ARE CHANGING (Defense Sprint)

| What | File(s) | When |
|------|---------|------|
| Add AuditLog model, `is_active` on User | `models.py` | Day 2 |
| Add RBAC (`require_role` dependency) | `main.py` | Day 2 |
| Add filtering + CSV export + SLA endpoints | `main.py` | Day 3 |
| Add `deployment_notes` column on Report | `models.py` | Day 4 |
| Barangay portal: filters, SLA badges, export, toasts | `app/barangay/page.tsx` | Day 4 |
| Fix duplicate Graceville | `app/cenro/page.tsx` line 22 | Day 4 |
| CENRO portal: audit log tab, user mgmt tab, SLA widget | `app/cenro/page.tsx` | Day 5 |
| Error boundaries, skeletons, pagination | `layout.tsx`, portals | Day 6 |
| Offline tile swap | `components/MapComponent.tsx` | Day 7.5 |
| Replace `print()` with `logging` | `ai_verifier.py` | Day 3 |

---

## REFERENCES (Legal & Technical Basis)

These are the real-world standards EcoWatch is built on. Use these during defense Q&A when panelists ask "why did you build it this way?"

---

### RA 9003 — Ecological Solid Waste Management Act of 2000

**What it is**: The main Philippine law on solid waste management.

**Key points to cite:**

- Mandates every LGU (Local Government Unit) to have a 10-year Solid Waste Management Plan
- Barangays are legally required to maintain their own waste collection programs
- CENRO is the designated city-level enforcer — their job is literally to monitor and act on violations

**Use when asked**: "Why does CENRO need this system?" → "Under RA 9003, CENRO is mandated to monitor illegal dumping. EcoWatch digitizes that mandate."

---

### DENR Memorandum Circulars on Solid Waste Management

**What it is**: DENR (Dept. of Environment and Natural Resources) operational guidelines for LGUs.

**Key points to cite:**

- Requires LGUs to report solid waste data to DENR periodically
- Mandates cleanup of illegal dump sites near waterways within a set timeframe
- CENRO reports to DENR — the CSV export feature directly supports this reporting chain

**Use when asked**: "What's the real-world use case for the export feature?" → "CENRO submits periodic reports to DENR. Our CSV export generates exactly that data."

---

### DILG Memorandum Circular 2018-152 — LGU Solid Waste Management

**What it is**: Dept. of Interior and Local Government circular specifically for barangay-level responsibilities.

**Key points to cite:**

- Barangay captains are accountable for waste complaints in their jurisdiction
- Each barangay must have a designated environmental officer
- Complaints must be logged and acted on — EcoWatch's report lifecycle (pending → deployed → resolved) maps directly to this

**Use when asked**: "Why does the barangay portal only show reports from one barangay?" → "Under DILG MC 2018-152, barangay officials are only accountable for their own jurisdiction. Jurisdictional isolation is a compliance requirement."

---

### Quezon City CESU Online Reporting Portal

**What it is**: Quezon City's City Environment and Sanitation Unit has a citizen-facing reporting portal for environmental violations — the closest Philippine government analogue to EcoWatch.

**Key points to cite:**

- Similar role structure: citizen reports → barangay-level response → city oversight
- Uses photo evidence for verification (same approach we use, but without AI)
- Shows that this type of system is already deployed and accepted by Philippine LGUs

**Use when asked**: "Is this realistic for a Philippine city?" → "Yes — Quezon City already runs a similar system. EcoWatch adds AI verification and automated barangay routing that QC's system lacks."

---

### SeeClickFix (US) / FixMyStreet (UK)

**What it is**: International citizen-reporting platforms used by hundreds of municipalities for infrastructure and environmental complaints.

**Key points to cite:**

- SeeClickFix: used by 300+ US cities, same model (citizen reports → government action → public tracking)
- FixMyStreet: UK government-backed, open-source, same lifecycle we implemented
- Both use public tracking IDs (like our `EW-0042` system)
- Neither has AI image verification — that's EcoWatch's differentiator

**Use when asked**: "Is this an original idea?" → "The citizen-reporting model follows established international patterns (SeeClickFix, FixMyStreet). Our contribution is adding Mask R-CNN AI verification and automatic jurisdictional routing via ray-casting — neither of which these platforms have."

---

### BLGF Reporting Templates (Bureau of Local Government Finance)

**What it is**: Standard report formats that LGUs use for official government submissions.

**Key points to cite:**

- LGU performance reports often include environmental compliance metrics
- CENRO needs to justify budget allocation — resolution rate data is a key metric
- Our barangay ranking and analytics CSV align with the format CENRO already uses for manual reporting

**Use when asked**: "What does your CSV export look like?" → "It follows the structure of BLGF-aligned LGU performance reports — barangay name, total reports, resolved count, resolution rate, date range."

---

### DENR CENRO Operational Manual

**What it is**: The job description and workflow manual for City Environment and Natural Resources Officers.

**Key points to cite:**

- CENRO officers receive and dispatch complaints — currently done manually via phone/paper
- They coordinate with barangay officials, not citizens directly
- They track compliance and escalate to DENR if barangays don't act

**Use when asked**: "Why does CENRO need a separate portal from the barangay?" → "CENRO's role is strategic oversight, not ground-level response. The manual defines CENRO as the coordinator, not the executor — which is exactly why we separated the two portals."
