# EcoWatch SJDM Project Rules & Guidelines

This file provides project-scoped rules and environment context for Antigravity, automatically loaded on startup.

## Development Commands

### Frontend (`frontend/`)
- Install dependencies: `npm install`
- Dev server: `npm run dev` (starts on http://localhost:3000)
- Production build: `npm run build`
- Linter: `npm run lint`

### Backend (`backend/`)
- Create virtual environment (Python 3.12 required): `py -3.12 -m venv venv_tf`
- Activate virtual environment: `.\venv_tf\Scripts\Activate.ps1`
- Install dependencies: `pip install -r requirements.txt`
- Run dev server: `uvicorn main:app --reload` (starts on http://localhost:8000)
- Seed test data: `python seed_test_data.py`
- Run auth smoke tests: `python test_auth.py`
- Run analytics/DBSCAN tests: `python test_analytics.py`

## Architecture & Flow
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind v4, Leaflet.
- **Backend**: FastAPI, SQLAlchemy, Shapely (ray-casting for barangay boundaries), Scikit-learn (DBSCAN for hotspot analytics), TensorFlow 2.16 (Mask R-CNN).
- **Database**: SQLite locally (`backend/ecowatch.db`), PostgreSQL+PostGIS via Supabase in production.
- **AI Verification**: Mask R-CNN model file is located at `backend/models/mask_rcnn_garbage.h5` (gitignored). If missing, `ai_verifier.py` falls back to an 80% positive mock.

## Rules & Constraints
- Always preserve existing comments and docstrings.
- Lock CORS to the Vercel domain before production deployment (currently `allow_origins=["*"]` in `main.py`).
- Fix the duplicate "Graceville" entry in the barangays array at `frontend/app/cenro/page.tsx:22` when editing CENRO-related code.
- Auth uses local bcrypt with persistent `localStorage` (`ecowatch_user`).

## Strict UI/UX & Quality Protocol
When building, auditing, or modifying any frontend page or component, Antigravity MUST enforce the following:
1. **Premium Aesthetics**: Ensure modern glassmorphism, precise padding/margins, and correct CSS variables to support Light/Dark mode.
2. **Empty & Error States**: Never leave a blank screen. Always implement beautiful fallback components for empty lists or failed APIs.
3. **Loader Rules**: 
   - Use **Skeletal UI** (e.g., `animate-pulse` placeholders or Next.js `loading.tsx`) for page transitions, dashboard cards, and data lists.
   - Use **Spinners** ONLY for transactional actions (submitting forms, logging in, saving data).
4. **Responsiveness**: Verify the layout scales perfectly across mobile (`sm`), tablet (`md`), and desktop (`lg`) without horizontal overflow.
5. **The 3x Test Guarantee**:
   - Always verify TypeScript/Syntax by running `npm run lint` or `npm run build` after modifications.
   - Run the backend test scripts (`test_analytics.py`, etc.) if backend logic was changed.
   - Provide a clear manual testing checklist to the user to visually verify the frontend changes in their browser.
6. **Data Clarity & Tooltips**: Ensure all data and metrics presented to the user are easily understandable. If a metric or record might be unfamiliar or its origin unclear, add a tooltip explaining exactly what the data means and where it was sourced from.
