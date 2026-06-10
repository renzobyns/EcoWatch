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
| Geo-tag camera | `getUserMedia` + `navigator.geolocation`; EXIF write via `piexifjs`, read via `exifr` (both auto-installed by `npm install`) |
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

> **Two Module 1 gotchas when testing the report flow:** (1) `/report` now **requires login**
> (log in as `citizen@test.com` first), and (2) the photo step uses a **live geo-tag camera**
> that needs a *secure context* and an in-SJDM GPS fix — open the app at `http://localhost:3000`
> (not a bare IP), and on desktop fake your location to an SJDM coordinate in DevTools. Full
> walk-through: [Geo-tag camera & upload testing](#-geo-tag-camera--upload-testing-module-1).

> The AI model weights (`backend/models/mask_rcnn_garbage.h5`) are gitignored. Without them the backend falls back to a mock that returns ~80% positive — fine for UI work. See [AI Model Details](#-ai-model-details) to get the real weights.

#### Running it again (after the first-time setup)

The venv, `node_modules`, and DB already exist, so subsequent runs are just **two commands in two terminals**:

```powershell
# Terminal 1 — backend
cd backend; .\venv_tf\Scripts\Activate.ps1; uvicorn main:app --reload

# Terminal 2 — frontend
cd frontend; npm run dev
```

Start the **backend first**, then the frontend. Re-run `python seed_test_data.py` only if you want to wipe and reset the demo data (it clears existing rows first).

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

### ✅ Verify Your Setup Works

After running the steps above, **before you start clicking around**, prove the setup actually works end-to-end. The repo ships with two verification tools — one automated, one manual checklist — and a [`VERIFY_SETUP.md`](VERIFY_SETUP.md) that walks through both.

#### Automated backend smoke test (5 minutes)

With the backend running (`uvicorn main:app --reload`) and the DB seeded:

```powershell
cd backend
.\venv_tf\Scripts\Activate.ps1
python smoke_test.py
```

Runs ~40 individual checks across 9 sections — health, auth (all 4 quick-demo + per-barangay accounts), ray-casting, DBSCAN clustering, full report submission pipeline (image upload + Mask R-CNN inference + spatial routing + tracking), RBAC, cross-portal visibility, work-order lifecycle, and Mask R-CNN mode detection (real vs mock). The submit section also verifies **Module 1's geotag hard gate** — it injects a Muzon geotag so the report passes, and confirms a geotag-less photo is rejected with `422`.

Expected output ends with:

```
SUMMARY
  Passed: 40
  Failed: 0

All workflows verified. The setup is good to go.
```

> **Real-model timing:** the AI-verification check waits up to **90s** (configurable via
> `ECOWATCH_AI_TIMEOUT`). On a modest CPU the real Mask R-CNN can be slower than that — if
> that single check is the only red line, your setup is fine. For a fast, fully-green run,
> test in **mock mode** (temporarily rename `backend/models/mask_rcnn_garbage.h5`); mock
> verification returns in ~1s.

Anything red? Each FAIL line gives you the endpoint, status code, and response body — no guessing where to look.

#### Manual UI checklist (10 minutes)

With both servers running, walk through the checkboxes in [`VERIFY_SETUP.md`](VERIFY_SETUP.md) Part 2 — covers every portal tab, every cross-portal reflection, and the cleaner finish-cleanup-with-photo flow. The smoke test can't see the browser, so this is how you verify rendering, charts, maps, drag/drop, etc.

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

#### (Optional) Add the trained Mask R-CNN model

> **TL;DR:** You can **skip this entirely** for a basic local run — `ai_verifier.py` auto-falls-back to mock mode (returns ~80% positive at random). The app works end-to-end either way. Only follow these steps if you want the real AI verifying photos for a demo or grading.

The model weights (`mask_rcnn_garbage.h5`, ~250 MB) are too big for git and not in the clone. Here's exactly what to do:

1. **Download** `mask_rcnn_garbage.h5` from one of these sources:
   - Google Drive: `EcoWatch/models/mask_rcnn_garbage.h5` (project-internal link)
   - Hugging Face Hub (planned mirror — see [techstack.md](techstack.md))
2. **Drop it into the folder** — the path must be exactly:

   ```
   backend/models/mask_rcnn_garbage.h5
   ```

   The `backend/models/` folder is auto-created the first time you run `uvicorn main:app --reload` (or start any Python file that imports `ai_verifier`), so you don't have to `mkdir` it yourself. If you'd rather create it manually first, that's fine too.

3. **Restart the backend.** On startup, [ai_verifier.py:45](backend/ai_verifier.py#L45) checks for the file. If present → loads real Mask R-CNN. If missing → logs `"Model not found at: ..."` and runs in mock mode.

> The vendored Mask R-CNN library lives at [backend/mrcnn/](backend/mrcnn/) and **is** in the git clone — no separate install needed. (Earlier versions accidentally gitignored this folder; it's tracked now.)

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

> **Module 1 update:** `/report` requires login, and the **location is derived from the
> photo's geotag** (live geo-tag camera or a geotagged upload) — there is no manual map pin.
> At submit the server **hard-gates** every photo (must have an in-SJDM EXIF geotag, no
> editor/AI software tag) *before* persisting; the Mask R-CNN check then runs asynchronously.

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
- `POST /report/submit` (multipart) — **requires `reporter_id`** (logged-in user)
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

### 1. Backend test scripts

```powershell
cd backend
.\venv_tf\Scripts\Activate.ps1

python seed_test_data.py        # idempotent — (re)creates demo accounts + reports
python smoke_test.py            # full end-to-end suite (needs the server running — see "Verify Your Setup Works" above)
python test_report_detail.py    # report-detail endpoint checks
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

> **Module 1 changed this endpoint.** The photo field is **`images`** (1–5 files, not
> `photo`), notes use **`notes`** (not `description`), and **every photo must carry an
> in-SJDM EXIF geotag** or the server hard-rejects it with `422`. There are also two new
> optional fields, `device_lat`/`device_lon` (the live device GPS = "signal B", used for the
> trust A-vs-B comparison). A plain `test.jpg` with no geotag will now be **rejected** — this
> is expected, and is why the smoke test injects a geotag (see [below](#1-backend-smoke-tests-script-based)).

First make a geotagged-in-SJDM test image (Pillow is already in the venv):

```powershell
cd backend; .\venv_tf\Scripts\Activate.ps1
python -c "from PIL import Image; im=Image.new('RGB',(640,480),(110,110,110)); ex=im.getexif(); ex[0x8825]={1:'N',2:(14.0,48.0,55.8),3:'E',4:(121.0,1.0,30.7)}; im.save('geotagged_muzon.jpg',exif=ex)"
```

Then submit it:

```bash
curl -X POST http://localhost:8000/report/submit \
  -F "images=@./geotagged_muzon.jpg" \
  -F "lat=14.8155" \
  -F "lon=121.0252" \
  -F "device_lat=14.8155" \
  -F "device_lon=121.0252" \
  -F "notes=Pile of trash near canal" \
  -F "reporter_id=1"
```

Expected `202 Accepted` JSON (AI runs **async** in a background task, so status is `pending`
until it finishes — poll the tracking endpoint):

```json
{
  "success": true,
  "message": "Report received. AI verification is running in the background.",
  "report_id": 17,
  "tracking_id": "EW-0017",
  "tracking_url": "/track/a1b2c3d4",
  "barangay_assigned": "Muzon",
  "status": "pending",
  "verification_pending": true
}
```

Sanity-check the rejection too — submitting `test.jpg` (no geotag) should return
`422 "A photo has no location data (geotag)."` Then verify the public tracking page polls to
completion: `GET /report/track/a1b2c3d4`.

### 4. Image upload validation (X8)

Checks run in order: **MIME → size → geotag → editor/AI tag → SJDM geofence**.

| Upload | Expected |
|---|---|
| `.txt` file | `400 Only JPEG or PNG images are allowed.` |
| `.gif` (`image/gif`) | `400 Only JPEG or PNG images are allowed.` |
| Image > 10 MB | `400 Image must be 10 MB or smaller.` |
| Valid `.jpg`, **no EXIF geotag** | `422 A photo has no location data (geotag).` *(Module 1)* |
| Valid `.jpg`, **editor/AI software tag** (Photoshop, Canva, Midjourney…) | `422 …edited or AI-generated…` *(Module 1)* |
| Valid `.jpg`, geotag **outside SJDM** | `422 …taken outside San Jose del Monte…` *(Module 1)* |
| Valid `.jpg` ≤ 10 MB, **in-SJDM geotag** | `202` with `report_id` |

### 5. Frontend manual tests

Start the dev server (`npm run dev`) and walk the goldens:

**Citizen flow** *(updated — Module 1 geo-tag camera; see [Geo-tag camera & upload testing](#-geo-tag-camera--upload-testing-module-1))*
- [ ] Landing page renders; map shows barangay polygons
- [ ] Click **Share QR Code** → modal opens, image renders, "Save Image" downloads
- [ ] Visiting `/report` **logged out** redirects to `/login?redirect=/report`
- [ ] Logged in as `citizen@test.com`, `/report` shows a **Take Photo / Upload** chooser (no manual map pin)
- [ ] **Take Photo** opens the live geo-tag camera, burns a location/time stamp, auto-pins from the photo's GPS; shutter fires instantly with a flash, and tapping a thumbnail opens a full-screen preview (Close / Delete)
- [ ] **Upload** a photo with no geotag → rejected; an edited/AI photo → rejected; a photo outside SJDM → rejected
- [ ] Review screen shows a **read-only** "from your photo" location card, then submit → redirects to `/track/<slug>`
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

### 📸 Geo-tag camera & upload testing (Module 1)

Module 1 replaced the old "drop a map pin" step. **Location now comes only from the
photo** — the live camera reads GPS at the shutter, and gallery uploads must already
carry an EXIF geotag. This adds two hard requirements that trip people up when testing:

**1. Secure context (required for camera + GPS).** Browsers only expose the camera and
`navigator.geolocation` on a *secure context*:
- **Desktop:** open the app at `http://localhost:3000` (NOT `http://127.0.0.1:3000` or a
  LAN IP — `localhost` is treated as secure, a bare IP is not).
- **Phone / another device:** you must serve the frontend over **HTTPS**. Quickest is a
  tunnel: `npx localtunnel --port 3000` (or `cloudflared tunnel --url http://localhost:3000`),
  then open the `https://…` URL on the phone. Over plain `http://<laptop-ip>:3000` the
  camera button will silently do nothing.

**2. The GPS must be inside SJDM.** The camera and uploads are geofenced to San Jose del
Monte. On a desktop your real location is almost certainly *outside* SJDM, so the camera
shows "outside SJDM." Override it in **Chrome/Edge DevTools → ⋮ → More tools → Sensors →
Location → Other…** and enter an in-SJDM coordinate, e.g. **`14.8155, 121.0252`** (Muzon)
or `14.8197, 121.0478` (Dulong Bayan). Keep that tab open while testing.

**Checklist**
- [ ] Logged out, `/report` redirects to login (Module 2 accountability is partially wired here)
- [ ] With a faked in-SJDM location, **Take Photo** shows a green "Brgy. … ±Nm" chip and a
      burned-in stamp; **Done → Submit** lands on `/track/<slug>` with a trust tier
- [ ] **Upload** a screenshot / Messenger photo (EXIF stripped) → *"no location data"* reject
- [ ] **Upload** a photo exported from Photoshop/Canva/Snapseed → *"edited or AI-generated"* reject
- [ ] **Upload** a geotagged photo taken outside SJDM → *"outside San Jose del Monte"* reject
- [ ] The **upload-accept** path needs a real photo whose own EXIF GPS is inside SJDM — easiest
      is one taken on a phone physically in SJDM (the DevTools override does **not** change a
      file's EXIF). To craft one for a quick test, see the snippet under
      [Submit a report end-to-end](#3-submit-a-report-end-to-end-curl).

> **Why uploads can feel strict:** any photo whose EXIF was stripped (Facebook/Messenger,
> screenshots) or that carries an editor/AI tag is rejected by design — that's the anti-fake
> -photo recommendation. Those users are expected to re-take with the in-app camera.

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
