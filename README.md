# EcoWatch SJDM 🌿📍

EcoWatch is a geospatial reporting and environmental monitoring system for **San Jose del Monte (SJDM), Bulacan**. Citizens submit photo reports of illegal dumping; a Mask R-CNN model verifies garbage presence; ray-casting routes the report to the correct barangay; DBSCAN clustering surfaces hotspots for CENRO.

> **Capstone defense:** May 26, 2026.

---

## 📚 Table of Contents

1. [Key Features](#-key-features)
2. [Tech Stack](#-tech-stack)
3. [Project Structure](#-project-structure)
4. [Getting Started](#-getting-started)
5. [End-to-End Workflow](#-end-to-end-workflow)
6. [Roles & Portals](#-roles--portals)
7. [API Surface](#-api-surface)
8. [AI Model Details](#-ai-model-details)
9. [How to Test](#-how-to-test)
10. [Documentation Map](#-documentation-map)
11. [Known Issues](#-known-issues)
12. [License](#-license)

---

## 🚀 Key Features

- **QR-Tagged Reporting** — Physical QR stickers open the report form with GPS pre-prompted; no app install.
- **AI Verification (Mask R-CNN)** — Instance segmentation gates submissions; confidence stored on the report.
- **Spatial Accountability (Ray-Casting)** — GPS-to-barangay assignment via point-in-polygon on the SJDM GeoJSON.
- **Heatmap Analytics (DBSCAN)** — Density clustering of confirmed dumpsites for CENRO oversight.
- **Cleanup Validation** — "After" photo + AI re-verification required before a case can be marked resolved.
- **Trust Badges** — Per-report trust score surfaced on barangay/CENRO portals (computed from AI confidence, duplicate proximity, EXIF integrity).
- **RBAC + Audit Log** — Every privileged mutation is recorded; CENRO can browse the trail.
- **CSV Exports** — Barangay queue, CENRO analytics, and SLA reports all export to CSV.

> Defense-grade per-feature deep dive: [`FEATURES.md`](FEATURES.md).

---

## 🛠️ Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4, Lucide |
| Maps | Leaflet + React-Leaflet, custom barangay polygons (GeoJSON) |
| Charts | Recharts |
| Toasts | Sonner |
| Backend | FastAPI, SQLAlchemy, Shapely, Scikit-learn |
| AI/ML | TensorFlow 2.16.1 + tf-keras, Mask R-CNN (vendored `mrcnn/`) |
| Database | SQLite (dev), PostgreSQL + PostGIS via Supabase (prod) |
| Auth | Local email/password, bcrypt; session in `localStorage` |
| Hosting (planned) | Vercel (frontend), Render/Railway (backend) |

---

## 📂 Project Structure

```
EcoWatch/
├── frontend/                    Next.js app
│   ├── app/                     Route segments
│   │   ├── page.tsx             Landing page (citizen entry)
│   │   ├── report/              Citizen submission form
│   │   ├── track/[slug]/        Public report tracking
│   │   ├── barangay/            Barangay admin portal
│   │   ├── cenro/               CENRO city-wide dashboard
│   │   ├── cleaner/             Cleanup team portal
│   │   ├── login/  signup/      Auth screens
│   │   └── api/                 Next API route handlers (server-side helpers)
│   ├── components/              Shared UI (MapComponent, TrustBadge, QRCodeModal, ...)
│   └── lib/                     Client-side helpers
│
├── backend/                     FastAPI service
│   ├── main.py                  All routes (~3600 lines)
│   ├── models.py                ORM: User, Report, WorkOrder, SystemConfig, AuditLog
│   ├── database.py              Auto-selects SQLite vs PostgreSQL by DATABASE_URL
│   ├── ai_verifier.py           Mask R-CNN wrapper (mock fallback when weights missing)
│   ├── spatial_utils.py         Shapely point-in-polygon for barangay routing
│   ├── analytics.py             DBSCAN clustering + AI-quality analytics
│   ├── notifications.py         Cleaner notification helpers
│   ├── mrcnn/                   Vendored Mask R-CNN library — do NOT modify
│   ├── models/                  Trained weights (`*.h5`, gitignored)
│   ├── seed_test_data.py        Creates demo accounts + sample reports
│   └── requirements.txt
│
├── data/
│   └── sjdm_barangays.geojson   59 barangay polygons for routing + map render
│
├── database/                    Supabase production SQL (NOT used for local dev)
│   ├── schema.sql               Postgres schema + RLS policies + storage buckets
│   ├── fix_trigger.sql          Auto-profile trigger fix
│   └── email_template.html      Supabase Auth email template
│
├── docs/                        Sprint plans + design specs (defense sprint)
│   └── superpowers/
│       ├── plans/               Per-feature implementation plans (dated)
│       └── specs/               UI / data-model design specs (dated)
│
├── postman/                     Postman collections for backend API testing
│   ├── collections/  environments/  flows/
│   ├── globals/  mocks/  specs/
│   └── .postman/resources.yaml
│
└── root-level docs:
    CLAUDE.md, FEATURES.md, CODEBASE_GUIDE.md, DEFENSE_PLAN.md,
    MODEL_TRAINING.md, TESTING_CHECKLIST.md, REDESIGN_SPEC.md,
    CHANGELOG.md, IMPROVEMENTS.md, erd_dataflow.md, sitemap.md,
    techstack.md, instructions.md (historical)
```

> The `.claude/` folder you may see locally is Claude Code's session storage — not tracked in git, doesn't affect the app.

---

## 🚦 Getting Started

### Cold Start TL;DR

> **Step 0 — Install these first** (one-time, skip if you already have them):
> - **[Git](https://git-scm.com/download/win)** — to clone the repo (`git --version` to check)
> - **[Node.js 20+](https://nodejs.org/)** — comes with `npm` (`node -v` to check)
> - **[Python 3.12](https://www.python.org/downloads/release/python-3120/)** — required for TensorFlow 2.16.1 (`py -3.12 --version` to check)
>
> If you don't know what Git or npm is, install the three above before continuing. They're all free.

Fresh clone? Run these in order. The venv, `node_modules`, and `.env.local` are gitignored so you must create them locally.

```powershell
# ── STEP 1: Clone the repo ────────────────────────────────
git clone https://github.com/renzobyns/EcoWatch.git
cd EcoWatch

# ── STEP 2: BACKEND (terminal 1) ──────────────────────────
cd backend
py -3.12 -m venv venv_tf          # create venv — Python 3.12 required
.\venv_tf\Scripts\Activate.ps1    # activate
pip install -r requirements.txt   # install deps (takes a few minutes first time)
python seed_test_data.py          # create demo accounts + sample reports
uvicorn main:app --reload         # → http://localhost:8000

# ── STEP 3: FRONTEND (terminal 2) ─────────────────────────
cd frontend
npm install                       # install node packages
npm run dev                       # → http://localhost:3000
```

That's it — the app should now work end-to-end at `http://localhost:3000` with the seeded accounts (`citizen@test.com` / `barangay@test.com` / `cenro@test.com`, all `password123`).

> The AI model weights (`backend/models/mask_rcnn_garbage.h5`) are gitignored. Without them the backend falls back to a mock that returns ~80% positive — fine for UI work. See [AI Model Details](#-ai-model-details) to get the real weights.

#### Optional — `frontend/.env.local`

You **do not need this file for a basic local run.** The frontend has built-in fallbacks. Create it only if you want one of these specific things:

| Variable | Needed when |
|---|---|
| `NEXT_PUBLIC_API_URL` | Your backend runs on a non-default port or remote host. Default fallback: `http://127.0.0.1:8000`. |
| `GOOGLE_GEMINI_API_KEY` | You want real Gemini responses in the AI chat widget. Without it, chat returns simulated text. |
| `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` | You're testing the `/signup` page or OAuth callback. Login + all portals already work via local FastAPI bcrypt auth. |

If you do need one, create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
GOOGLE_GEMINI_API_KEY=your_key_here
NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

#### About the database

The database **file** (`backend/ecowatch.db`) is gitignored, so a fresh clone does not include one — but you don't need to download it from anywhere. Here's how it works:

- On first `uvicorn main:app --reload`, [backend/database.py](backend/database.py) calls SQLAlchemy `Base.metadata.create_all()` which **auto-creates** `backend/ecowatch.db` as an empty SQLite file with every table defined in [backend/models.py](backend/models.py) (`User`, `Report`, `WorkOrder`, `AuditLog`, `SystemConfig`, `Notification`).
- `python seed_test_data.py` then fills it with 3 demo accounts (`citizen@test.com` / `barangay@test.com` / `cenro@test.com`, all `password123`) and ~14 sample reports.
- The `database/` folder at the project root holds the **production** Supabase schema (`schema.sql`) — only used when deploying to Supabase Postgres, not for local dev.

So: you get the table structure from the code, an empty DB from the first boot, and demo data from the seed script. Nothing to download.

---

### Prerequisites (detailed)

- **Node.js 20+**
- **Python 3.12** (required for TensorFlow 2.16.1 compatibility)
- **Git**

### 1. Clone

```powershell
git clone https://github.com/renzobyns/EcoWatch.git
cd EcoWatch
```

### 2. Frontend Setup

```powershell
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
GOOGLE_GEMINI_API_KEY=your_key_here
NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Run the dev server:

```powershell
npm run dev          # http://localhost:3000
npm run build        # production build
npm run lint         # ESLint
```

### 3. Backend Setup

```powershell
cd backend
py -3.12 -m venv venv_tf
.\venv_tf\Scripts\Activate.ps1
pip install -r requirements.txt
```

**(Optional) Place the trained model weights** at [backend/models/mask_rcnn_garbage.h5](backend/models/mask_rcnn_garbage.h5):
- The `.h5` file (~250 MB) is **not** in the git clone — it's gitignored because it's too big for GitHub. Download separately from Google Drive (`EcoWatch/models/mask_rcnn_garbage.h5`) or Hugging Face Hub.
- **You can skip this for a basic local run.** Without the file, `ai_verifier.py` falls back to a mock that returns ~80% positive at random — the whole app still works end-to-end, but the AI isn't really looking at photos. Fine for UI/feature work; required for real demos or grading.

Seed demo data:

```powershell
python seed_test_data.py
```

Start the API:

```powershell
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API docs at http://localhost:8000/docs (Swagger UI).

### Test Accounts (after seeding)

**4 "quick demo" accounts** — these are the ones the smoke tests and docs reference:

| Role | Email | Password | Notes |
|---|---|---|---|
| Citizen | `citizen@test.com` | `password123` | Public reporting only |
| Barangay | `barangay@test.com` | `password123` | Assigned to **Muzon** |
| CENRO | `cenro@test.com` | `password123` | City-wide oversight |
| Cleaner | `cleaner@test.com` | `password123` | Assigned to **Muzon** (has WorkOrders) |

**Per-barangay accounts** — every one of the **59 SJDM barangays** gets a default barangay officer + cleaner account, so you can log in as any barangay without manually creating users (useful when a panelist asks "show me Minuyan Proper's portal").

| Pattern | Example | Role |
|---|---|---|
| `<slug>@barangay.com` | `minuyanproper@barangay.com` | barangay (assigned to that barangay) |
| `<slug>@cleaners.com` | `minuyanproper@cleaners.com` | cleaner (assigned to that barangay) |

**Slug rule:** lowercased barangay name with all non-alphanumeric characters stripped. A few examples:

| Barangay | Slug | Accounts |
|---|---|---|
| Minuyan Proper | `minuyanproper` | `minuyanproper@barangay.com`, `minuyanproper@cleaners.com` |
| San Roque | `sanroque` | `sanroque@barangay.com`, `sanroque@cleaners.com` |
| Sto. Cristo | `stocristo` | `stocristo@barangay.com`, `stocristo@cleaners.com` |
| Santo Niño | `santonino` | `santonino@barangay.com`, `santonino@cleaners.com` |
| Francisco Homes-Guijo | `franciscohomesguijo` | `franciscohomesguijo@barangay.com`, … |
| Bagong Buhay II | `bagongbuhayii` | `bagongbuhayii@barangay.com`, … |

All passwords are `password123`. Total seeded: 4 quick-demo + 118 per-barangay = **122 accounts**.

> The full source-of-truth list of barangays is [`data/sjdm_barangays.geojson`](data/sjdm_barangays.geojson) (`ADM4_EN` field). The seeder loops over it, so the account list always matches the GeoJSON.

---

## 🔁 End-to-End Workflow

### A. Citizen submits a report

```
┌──────────────────┐    ┌──────────────────┐    ┌───────────────────────┐
│  Scan QR /       │ →  │  /report page    │ →  │  POST /report/submit  │
│  open homepage   │    │  GPS + photo     │    │  (multipart form)     │
└──────────────────┘    └──────────────────┘    └───────────┬───────────┘
                                                            │
            ┌───────────────────────────────────────────────┘
            ▼
    ┌──────────────────────────┐
    │ 1. EXIF / image validate │ ai_verifier + main.py
    │ 2. Mask R-CNN inference  │ confidence ≥ 0.5 → verified
    │ 3. Ray-cast → barangay   │ spatial_utils.point_in_polygon
    │ 4. Persist Report row    │ models.Report (tracking_id EW-XXXX, slug)
    │ 5. Trust score computed  │ (AI confidence + EXIF + duplicate proximity)
    └────────────┬─────────────┘
                 ▼
        ┌─────────────────────┐
        │  Response: slug +   │
        │  /track/<slug> URL  │
        └─────────────────────┘
```

**Status flow:**
```
pending → verified | rejected
verified → deployed (barangay assigns cleaner)
deployed → resolved | failed_cleanup
```

### B. Barangay processes the report

1. Login → routed to `/barangay`.
2. Queue filtered to the user's `barangay_assignment` (e.g. Muzon).
3. Reports are sortable by SLA badge (green ≤2d, yellow 3–4d, red ≥5d).
4. Click a `verified` report → **Deploy** modal → choose cleaner + add deployment notes → `PUT /report/{id}/deploy`.
5. After cleanup, cleaner uploads "after" photo → AI re-verifies → `POST /report/{id}/resolve` (or `failed_cleanup`).
6. Export queue to CSV via the filter bar button.

### C. CENRO oversees the city

1. Login → routed to `/cenro`.
2. Four tabs: **Command Center**, **Oversight Queue**, **Audit Log**, **User Management**.
3. Command Center surfaces SLA breach count, barangay ranking, heatmap, AI-quality histogram.
4. Oversight Queue allows **reassign** (`PUT /report/{id}/reassign`) and **force-close** (`PUT /report/{id}/force-close`).
5. User Management — create / disable / reactivate barangay & cleaner accounts; CSV import/export.
6. Audit Log — every privileged mutation with `user_email`, `action`, `target_id`, `details`, `created_at`.

### D. Cleaner (per-barangay)

1. Login → `/cleaner`.
2. Sees only WorkOrders assigned to them.
3. **Start** → **Complete** (with after photo) → AI re-verifies → status updates.
4. Notifications panel pulls from `notifications.py`.

---

## 👥 Roles & Portals

| Role | Portal route | Key endpoints | Capabilities |
|---|---|---|---|
| `citizen` | `/report`, `/track/[slug]` | `POST /report/submit`, `GET /report/track/{slug}` | Submit reports, view public map, track own case |
| `barangay` | `/barangay` | `GET /reports/barangay/{name}`, `PUT /report/{id}/deploy`, `GET /reports/export` | Manage jurisdictional reports, deploy/resolve, export CSV |
| `cleaner` | `/cleaner` | `GET /work-orders/cleaner/{id}`, `PUT /work-orders/{id}/start|complete` | Pick up work, upload after-photo, complete cleanup |
| `cenro` | `/cenro` | `GET /audit-log`, `PUT /report/{id}/reassign|force-close`, `POST /users`, `GET /analytics/*` | City-wide analytics, RBAC overrides, user mgmt |

**Authentication.** Local email/password (bcrypt). Session stored in `localStorage` under `ecowatch_user`. Server gates protected endpoints via the `X-User-Id` header — disabled users return 401.

---

## 🌐 API Surface

Full route list lives in [`backend/main.py`](backend/main.py). Highlights:

**Auth & users**
- `POST /auth/register`, `POST /auth/login`
- `GET /users/me`, `PUT /users/me`, `PUT /users/me/password`
- `GET /users`, `POST /users`, `PUT /users/{id}/disable|reactivate`
- `GET/POST /users/export`, `/users/import`

**Reports**
- `POST /report/submit` (multipart)
- `GET /report/track/{slug}` — public
- `GET /reports/recent` — supports `status`, `search`, `limit`, `offset`, `date_from`
- `GET /reports/barangay/{name}` — same filters, barangay-scoped
- `GET /reports/sla-breaches?days=N`
- `GET /reports/export` — CSV
- `PUT /report/{id}/deploy|reassign|force-close`
- `POST /report/{id}/resolve`

**Work orders & cleaners**
- `POST/GET /work-orders`
- `GET /work-orders/cleaner/{id}`
- `PUT /work-orders/{id}/start|complete|reassign|priority|force-resolve`
- `GET /work-orders/breached|at-risk`
- `GET /notifications/cleaner/{id}`

**Analytics & config**
- `GET /analytics/overview|barangay-ranking|barangay-overview|sla-compliance|insights`
- `GET /analytics/barangay-overview/export|sla-export|insights-export` — CSV
- `GET /spatial/heatmaps`, `GET /spatial/barangays`
- `GET/PUT /config/sla`, `GET /config/sla/history`
- `GET /audit-log`

Interactive docs: <http://localhost:8000/docs>.

---

## 🤖 AI Model Details

| Property | Value |
|---|---|
| Architecture | Mask R-CNN (ResNet-101 + FPN backbone) |
| Framework | TensorFlow 2.16.1 + tf-keras (legacy) |
| Training data | 10 images, 75 polygon annotations |
| Training | 15 epochs, transfer learning from COCO weights |
| Final loss | 0.54 train / 0.43 validation |
| Classes | `background`, `garbage` |
| Inference | CPU (no GPU required) |
| Confidence gate | 0.5 (below → auto-rejected) |

**Retrain workflow** — see [`MODEL_TRAINING.md`](MODEL_TRAINING.md) for the full Colab notebook walkthrough including cold-start vs. continued training.

1. Add annotated images to Google Drive → `EcoWatch/garbage/`.
2. Run the Colab notebook end-to-end.
3. Download the new `mask_rcnn_garbage.h5` and drop it in [`backend/models/`](backend/models/).
4. Restart the backend — no code changes needed.

---

## ✅ How to Test

The granular per-sprint checklist is in [`TESTING_CHECKLIST.md`](TESTING_CHECKLIST.md). The sections below show the practical test recipes.

### 1. Backend smoke tests (script-based)

```powershell
cd backend
.\venv_tf\Scripts\Activate.ps1

python seed_test_data.py        # idempotent — re-seeds demo data
python test_auth.py             # auth endpoint sanity
python test_analytics.py        # DBSCAN clustering correctness
```

There is **no pytest suite** — use `py_compile` for syntax checks on touched files:

```powershell
python -m py_compile main.py models.py ai_verifier.py
```

### 2. Manual API testing (Postman / curl)

Seeded user IDs: `1` = citizen, `2` = barangay (Muzon), `3` = cenro. All protected endpoints require an `X-User-Id` header.

```bash
# Login (returns user object + sets role/id)
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"barangay@test.com","password":"password123"}'

# Pull the Muzon queue
curl http://localhost:8000/reports/barangay/Muzon \
  -H "X-User-Id: 2"

# Deploy a report (must be in `verified` state)
curl -X PUT http://localhost:8000/report/5/deploy \
  -H "X-User-Id: 2" -H "Content-Type: application/json" \
  -d '{"deployment_notes":"Dispatching crew A"}'

# Audit log (CENRO only)
curl http://localhost:8000/audit-log -H "X-User-Id: 3"
```

RBAC quick-checks:
- No `X-User-Id` → `401 Missing X-User-Id header`
- Wrong role → `403 Requires role: <role>`
- Disabled user (`is_active=false`) → `401 Invalid or disabled user`

### 3. Submit a report end-to-end (curl)

```bash
curl -X POST http://localhost:8000/report/submit \
  -F "photo=@./test.jpg" \
  -F "lat=14.8136" \
  -F "lon=121.0450" \
  -F "description=Pile of trash near canal"
```

Expected `202 Accepted` JSON:
```json
{
  "report_id": 17,
  "tracking_id": "EW-0017",
  "tracking_slug": "a1b2c3d4",
  "barangay": "Muzon",
  "ai_verified": true,
  "ai_confidence": 0.87,
  "status": "verified"
}
```

Then verify the public tracking page loads: `GET /report/track/a1b2c3d4`.

### 4. Image upload validation (X8)

| Upload | Expected |
|---|---|
| `.txt` file | `400 Only JPEG or PNG images are allowed.` |
| `.gif` (`image/gif`) | `400 Only JPEG or PNG images are allowed.` |
| Image > 10 MB | `400 Image must be 10 MB or smaller.` |
| Valid `.jpg` ≤ 10 MB | `200/202` with `report_id` |

### 5. Frontend manual tests

Start the dev server (`npm run dev`) and walk the goldens:

**Citizen flow**
- [ ] Landing page renders; map shows barangay polygons
- [ ] Click **Share QR Code** → modal opens, image renders, "Save Image" downloads
- [ ] `/report` requests geolocation, accepts photo, posts to backend, redirects to `/track/<slug>`
- [ ] `/track/<slug>` shows status, AI mask overlay, timeline

**Barangay portal (`barangay@test.com`)**
- [ ] Filter bar search debounces ~300ms (Network tab in DevTools)
- [ ] Date From/To updates the list
- [ ] SLA badges colored correctly (green ≤2d, yellow 3–4d, red ≥5d), resolved rows show `—`
- [ ] Deploy modal shows Deployment Notes textarea on `verified` reports
- [ ] **Export CSV** downloads a file containing only this barangay's reports
- [ ] Trust badge appears on each report card and detail view
- [ ] Skeleton rows during fetch; Sonner toasts for success/error
- [ ] Empty filter result shows "No reports found in this category."

**CENRO portal (`cenro@test.com`)**
- [ ] Four tabs visible: Command Center, Oversight Queue, Audit Log, User Management
- [ ] SLA breach widget on Command Center → clicking navigates to filtered Oversight Queue
- [ ] Oversight Queue filters (date, status, barangay dropdown, search) send correct query params
- [ ] Reassign report → audit log shows the action immediately after refresh
- [ ] Force-close report → status becomes `resolved`, audit entry created
- [ ] User Management: create barangay account → returned temp password → that user can log in
- [ ] Disable user → that user's login returns `403 Account disabled. Contact CENRO administrator.`
- [ ] Cannot disable own account → `400 Cannot disable your own account`
- [ ] Analytics CSV export downloads per-barangay breakdown

**Cleaner portal**
- [ ] Login as a cleaner → only their WorkOrders visible
- [ ] Start → Complete with after photo → AI re-verifies → status updates
- [ ] Notifications panel shows unread count

### 6. Database inspection

```powershell
cd backend
.\venv_tf\Scripts\python.exe inspect_db.py
```

Or a one-shot query:

```powershell
.\venv_tf\Scripts\python.exe -c "from database import engine; from sqlalchemy import text; print(list(engine.connect().execute(text('SELECT id, tracking_id, status, barangay FROM reports ORDER BY id DESC LIMIT 10'))))"
```

### 7. Pre-defense smoke (run on deployed URL)

See the **Defense Day** section of [`TESTING_CHECKLIST.md`](TESTING_CHECKLIST.md). Quick version:

- [ ] Landing loads, map renders polygons
- [ ] Citizen submit from a phone → tracking URL works
- [ ] Barangay queue → SLA badges visible → deploy with notes works
- [ ] CENRO reassign → Audit Log reflects it
- [ ] CSV exports download on both portals
- [ ] Zero red errors in browser console
- [ ] Zero Python tracebacks in `uvicorn` logs

### 8. Offline fallback (Wi-Fi failure plan)

- [ ] Set `NEXT_PUBLIC_API_URL` to laptop's LAN IP → frontend reaches backend
- [ ] Map tiles served from `backend/tiles/` (no internet required)
- [ ] `mask_rcnn_garbage.h5` present in `backend/models/`
- [ ] Full citizen → barangay → resolve loop works disconnected

---

## 📖 Documentation Map

| File | Purpose |
|---|---|
| [`README.md`](README.md) | This file — entry point, workflow, testing |
| [`CLAUDE.md`](CLAUDE.md) | Architecture cheat sheet for Claude Code sessions |
| [`FEATURES.md`](FEATURES.md) | Defense-grade per-feature deep dive (what, why, how, sources) |
| [`CODEBASE_GUIDE.md`](CODEBASE_GUIDE.md) | File-by-file walkthrough |
| [`DEFENSE_PLAN.md`](DEFENSE_PLAN.md) | Defense day talking points and demo script |
| [`MODEL_TRAINING.md`](MODEL_TRAINING.md) | Mask R-CNN Colab notebook walkthrough (cold start vs. continued) |
| [`TESTING_CHECKLIST.md`](TESTING_CHECKLIST.md) | Sprint-day "definition of done" checklist |
| [`REDESIGN_SPEC.md`](REDESIGN_SPEC.md) | UI/UX redesign spec |
| [`CHANGELOG.md`](CHANGELOG.md) | Per-sprint change log |
| [`IMPROVEMENTS.md`](IMPROVEMENTS.md) | Backlog of follow-up improvements |
| [`erd_dataflow.md`](erd_dataflow.md) | Entity-relationship diagram + data flow |
| [`sitemap.md`](sitemap.md) | Frontend route map |
| [`techstack.md`](techstack.md) | Tech stack rationale |

---

## ⚠️ Known Issues

- CORS is `allow_origins=["*"]` in [`backend/main.py`](backend/main.py) — must be locked to the Vercel domain before production deploy.
- Duplicate "Graceville" entry historically lived in the BARANGAYS array of [`frontend/app/cenro/page.tsx:22`](frontend/app/cenro/page.tsx#L22) — verify it has been removed post-C6.
- LocalStorage auth has no expiry — users stay logged in indefinitely until manual logout.
- No ORM migrations; schema applied via [`database/schema.sql`](database/schema.sql) or SQLAlchemy `create_all()` on startup. Schema changes in dev may require deleting `backend/ecowatch.db`.
- `backend/mrcnn/` is vendored from the original Matterport repo — do **not** modify; patches go in `ai_verifier.py`.

---

## 📝 License

Capstone Project — 3rd Year, 2nd Semester. Not for redistribution outside the academic context.
