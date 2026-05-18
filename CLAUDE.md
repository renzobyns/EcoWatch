# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Summary

**EcoWatch SJDM** — A geolocation-based environmental monitoring system for San Jose del Monte, Bulacan. Citizens submit photo reports of illegal dumping; AI (Mask R-CNN) verifies garbage presence; ray-casting routes the report to the correct barangay; DBSCAN clustering generates heatmap hotspots.

**Defense date: May 26, 2026** (capstone project).

---

## Dev Commands

### Frontend (`frontend/`)
```powershell
npm install
npm run dev       # http://localhost:3000
npm run build
npm run lint
```

### Backend (`backend/`)
```powershell
# Activate venv first
.\venv\Scripts\Activate.ps1

pip install -r requirements.txt
uvicorn main:app --reload                        # http://localhost:8000
python seed_test_data.py                         # Seed demo accounts + reports
python test_auth.py                              # Auth endpoint smoke tests
python test_analytics.py                         # DBSCAN clustering tests
```

### Environment variables (frontend)
Copy `.env.local` — required keys:
```
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
GOOGLE_GEMINI_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## Architecture

```
frontend/ (Next.js 16, React 19, TypeScript, Tailwind v4, Leaflet)
    → REST API calls →
backend/ (FastAPI, SQLAlchemy, Shapely, Scikit-learn, TensorFlow 2.16)
    → SQLite (dev) / PostgreSQL+PostGIS via Supabase (prod)
    → Mask R-CNN weights from Hugging Face Hub (downloaded on startup)
```

### Request flow — report submission
1. Citizen POSTs photo + GPS to `POST /report/submit`
2. `ai_verifier.py` runs Mask R-CNN inference → returns confidence score
3. `spatial_utils.py` ray-casts GPS coords against `data/sjdm_barangays.geojson` → assigns barangay
4. Report saved to DB with a unique tracking slug (`EW-XXXX`)
5. Frontend displays confirmation + shareable tracking URL

### Key source files
| File | Responsibility |
|------|----------------|
| `backend/main.py` | All FastAPI routes (~535 lines) |
| `backend/models.py` | SQLAlchemy ORM: User, Report, WorkOrder, SystemConfig, AuditLog |
| `backend/database.py` | Engine setup — auto-selects SQLite (dev) vs PostgreSQL (prod via `DATABASE_URL` env var) |
| `backend/ai_verifier.py` | Mask R-CNN wrapper; falls back to mock 80% positive if model file absent |
| `backend/spatial_utils.py` | Shapely point-in-polygon for barangay routing |
| `backend/analytics.py` | DBSCAN clustering (eps=0.001°, min_samples=2) for heatmap hotspots |
| `frontend/app/barangay/page.tsx` | Barangay admin portal |
| `frontend/app/cenro/page.tsx` | CENRO city-wide dashboard |
| `frontend/app/cleaner/page.tsx` | Cleanup team portal |
| `frontend/components/MapComponent.tsx` | Leaflet map with barangay boundaries, pins, heatmap overlay |
| `data/sjdm_barangays.geojson` | 59 barangay polygons — used for ray-casting and map rendering |

---

## Roles & Access

| Role | Portal route | Key capabilities |
|------|-------------|-----------------|
| citizen | `/report`, `/track/[id]` | Submit reports, view public map |
| barangay | `/barangay` | Manage jurisdictional reports, deploy & resolve cleanup |
| cenro | `/cenro` | City-wide analytics, barangay ranking, reassign/force-close reports |

Auth is local email/password (bcrypt). Session is stored in `localStorage` as `ecowatch_user` — no token expiry. Role is checked client-side from this object and server-side on protected endpoints.

**Test accounts** (after running `seed_test_data.py`):
- `citizen@test.com` / `password123`
- `barangay@test.com` / `password123` (assigned to Muzon)
- `cenro@test.com` / `password123`

---

## Report Lifecycle

```
pending → verified | rejected → deployed → resolved | failed_cleanup
```

Status transitions are driven by API calls; WorkOrder tracks assigned cleaner, priority, and SLA deadline (configurable per CENRO via `system_config` table).

---

## AI / ML Notes

- **Model file**: `backend/models/mask_rcnn_garbage.h5` — **gitignored**. Must be downloaded manually from Google Drive or Hugging Face Hub and placed there. Without it, `ai_verifier.py` uses a mock that returns 80% positive at random.
- **Confidence threshold**: 0.5 — reports below this are auto-rejected.
- **Vendored library**: `backend/mrcnn/` is the Mask R-CNN source, checked in as-is — do not modify.

---

## Database

- **Dev**: SQLite file at `backend/ecowatch.db` (auto-created on first run, gitignored).
- **Prod**: PostgreSQL with PostGIS via Supabase (`DATABASE_URL` env var triggers switch in `database.py`).
- **Migrations**: No ORM migrations; schema is applied via `database/schema.sql` or SQLAlchemy `create_all()` on startup.

---

## Known Issues

- CORS is `allow_origins=["*"]` in `main.py` — must be locked to the Vercel domain before production deploy.
- Duplicate "Graceville" entry in the barangays array in `frontend/app/cenro/page.tsx:22`.
- LocalStorage auth has no expiry — users stay logged in indefinitely until manual logout.
