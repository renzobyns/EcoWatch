# EcoWatch SJDM — Agent Rules

> **One-liner**: Geolocation-based illegal dumping monitor for San Jose del Monte, Bulacan.
> Citizens submit photo reports → Mask R-CNN verifies garbage → ray-casting routes to barangay → DBSCAN clusters hotspots.
>
> **Stack**: Next.js 16 / React 19 / Tailwind v4 / Leaflet → FastAPI / SQLAlchemy / TensorFlow 2.16 → SQLite (dev) / Supabase PostgreSQL (prod).
>
> **Defense date**: Final defense by Midterms (current semester). *(Initial oral defense: May 26, 2026.)*

---

## 1 · Commands

### Frontend (`frontend/`)
```powershell
npm install
npm run dev       # http://localhost:3000
npm run build     # production build — MUST pass before any PR
npm run lint      # MUST pass before claiming task complete
```

### Backend (`backend/`)
```powershell
py -3.12 -m venv venv_tf              # first time only
.\venv_tf\Scripts\Activate.ps1        # activate

pip install -r requirements.txt
uvicorn main:app --reload             # http://localhost:8000
python seed_test_data.py              # seed demo accounts + reports
python test_auth.py                   # auth endpoint smoke tests
python test_analytics.py              # DBSCAN clustering tests
```

---

## 2 · Thinking & Planning

Before writing any code, the agent MUST:

1. **Read before editing.** Open and read every file you plan to modify. Never assume file contents from memory alone.
2. **State your assumptions.** If the task is ambiguous, list what you assume before proceeding. If any assumption is risky, escalate (see §3).
3. **Scope your changes.** Touch only what you must. Do not refactor, rename, or "clean up" code outside the scope of the current task.
4. **Plan multi-file changes.** If a task touches 3+ files, write a short plan (which files, what changes, in what order) before editing anything.
5. **Think about side effects.** Before modifying a shared utility, component, or API endpoint, consider who else depends on it.

---

## 3 · Decision-Making & Escalation

### When to proceed without asking
- The task is clear, scoped, and low-risk (e.g., fix a typo, add a tooltip, update copy).
- You have high confidence the change won't break other parts of the system.
- The change is covered by existing tests or can be verified with `npm run build` / `npm run lint`.

### When to STOP and ask the user
- The task requires **choosing between two or more valid approaches** with meaningful tradeoffs.
- You need to **modify a database schema** (adding/removing columns, changing types).
- You need to **change or remove a public API endpoint** that other parts of the system depend on.
- The task is **vague or underspecified** — don't guess, ask.
- You're about to **delete files or remove significant functionality**.
- A change would affect **auth flow, user sessions, or role-based access**.
- You encounter a **contradiction** between instructions in this file and what the code actually does.

---

## 4 · Never-Do Rules (Invariants)

These are hard rules. Do not break them under any circumstances:

- **NEVER hardcode API keys, secrets, or credentials** in source code, comments, logs, commit messages, or this file. (See §5 Security.)
- **NEVER modify `backend/mrcnn/`** — this is the vendored Mask R-CNN library, checked in as-is.
- **NEVER commit `.env*` files, `ecowatch.db`, or `*.h5` model weights** — they are gitignored for a reason.
- **NEVER remove or weaken authentication checks** on protected endpoints.
- **NEVER use `allow_origins=["*"]` in production** — it is currently set this way in `main.py` for dev only.
- **NEVER run destructive database commands** (`DROP TABLE`, `DELETE FROM` without `WHERE`) without explicit user approval.
- **Preserve all existing comments and docstrings** unrelated to your changes.

---

## 5 · Security

### API keys & secrets
- All secrets live in **environment variables only** — loaded via `.env.local` (frontend) and `.env` or system env vars (backend).
- `.env*` is in `.gitignore`. Never create env files outside this pattern.
- If a new secret is needed, **tell the user to add it to their `.env.local`** — never write the actual value anywhere in the codebase.
- When writing example configs or documentation, use placeholders: `YOUR_API_KEY_HERE` or `...`.

### Frontend environment variables (required in `.env.local`)
```
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
GOOGLE_GEMINI_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

> **Rule**: Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. Only Supabase anon key and API URL should use this prefix. Server-only secrets (like `GOOGLE_GEMINI_API_KEY`) should NOT have the `NEXT_PUBLIC_` prefix — move them to server-side API routes or route handlers instead.

### Auth
- Auth is local email/password (bcrypt). Session stored in `localStorage` as `ecowatch_user`.
- No token expiry — users stay logged in until manual logout (known limitation).
- Role is checked client-side from this object AND server-side on protected endpoints. Both checks must remain.

---

## 6 · Testing & Verification

### Before claiming any task complete, run:

| Check | Command | Must pass? |
|-------|---------|-----------|
| TypeScript compilation | `npm run build` | ✅ Yes |
| Lint | `npm run lint` | ✅ Yes |
| Auth smoke tests | `python test_auth.py` | ✅ If auth was touched |
| DBSCAN analytics tests | `python test_analytics.py` | ✅ If analytics was touched |

### Testing mindset
- **Reproduce before fixing.** If fixing a bug, first confirm you understand how it manifests.
- **Verify the fix, not just the code.** After a change, run the relevant commands above. Don't just eyeball it.
- **If no test exists and the change is non-trivial**, tell the user and suggest what test to add.

---

## 7 · Definition of Done

A task is **done** when ALL of the following are true:

- [ ] `npm run build` passes with zero errors.
- [ ] `npm run lint` passes with zero errors.
- [ ] Relevant backend test scripts pass (if backend was touched).
- [ ] The change has been **visually verified** or a clear manual testing checklist is provided to the user.
- [ ] No new `console.log` / debug statements are left in committed code.
- [ ] No hardcoded secrets, API keys, or credentials exist in the changeset.
- [ ] All new UI states are handled (loading, empty, error — see §8).
- [ ] The change is responsive across mobile, tablet, and desktop (see §8).

---

## 8 · UI/UX & Responsiveness Protocol

When building, auditing, or modifying any frontend page or component:

### Aesthetics
- Use modern glassmorphism with precise padding/margins.
- Use correct CSS variables to support **Light/Dark mode**.

### States — never leave a blank screen
- **Loading**: Use **skeletal UI** (`animate-pulse` placeholders or Next.js `loading.tsx`) for page transitions, dashboard cards, and data lists.
- **Transactional actions** (form submit, login, save): Use **spinners only** for these.
- **Empty**: Beautiful fallback components when lists are empty or no data exists.
- **Error**: Graceful error states with retry options when API calls fail.

### Responsiveness — think about the user's device
Always verify layout across these breakpoints:

| Breakpoint | Target | Considerations |
|-----------|--------|----------------|
| `sm` (≤640px) | Mobile phones | Touch targets ≥44px, no horizontal overflow, stacked layouts, collapsible navs |
| `md` (641–1024px) | Tablets / small laptops | Flexible grids, sidebar toggles |
| `lg` (≥1025px) | Desktop | Full layouts, multi-column dashboards |

**Also consider:**
- **OS differences**: Windows, macOS, Android, iOS may render fonts and scrollbars differently. Avoid OS-specific assumptions.
- **Browser differences**: Test behavior in Chrome, Firefox, Safari (especially for CSS like `backdrop-filter` used in glassmorphism). Use standard CSS with fallbacks.
- **Touch vs. mouse**: Ensure hover states degrade gracefully on touch devices (no content hidden behind hover-only interactions).

### Data clarity
- If a metric or record might be unfamiliar, add a **tooltip** explaining what the data means and where it was sourced from.

---

## 9 · Known Issues

- CORS is `allow_origins=["*"]` in `main.py` — must be locked to the Vercel domain before production deploy.
- Duplicate "Graceville" entry in the barangays array at `frontend/app/cenro/page.tsx:22` — fix when editing CENRO-related code.
- LocalStorage auth has no expiry — users stay logged in indefinitely until manual logout.
- `GOOGLE_GEMINI_API_KEY` uses `NEXT_PUBLIC_` prefix pattern check needed — may be exposed to browser.

---

## 10 · Errors Corrected (Living Log)

> When the user corrects a mistake, append a line here so the agent never repeats it.

<!-- Example:
- 2026-08-29: Do not use `var()` tokens from Tailwind v3 — we are on Tailwind v4, use the new `@theme` syntax.
-->

*(No entries yet.)*

---

## 11 · Current Phase — Production Readiness

> We are in the **production readiness phase**. The goal is to make EcoWatch fully complete and defense-ready.

### Key documents (read these when working on features or fixes)

| File | Purpose | Agent rules |
|------|---------|-------------|
| [`production readiness.md`](../production%20readiness.md) | **Requirements & documentation** — what needs to be done, feature specs, suggestions, system gaps | ✅ Read for context. ✅ Modify when new requirements are discovered or the user adds features. |
| [`CHECKLIST productionready.md`](../CHECKLIST%20productionready.md) | **Task tracker** — checkbox list tracking progress | ✅ This is the ONLY file the agent should update for task progress (`[ ]` → `[/]` → `[x]`). |

### Workflow
1. Before starting a production-readiness task, **read `production readiness.md`** to understand the full context and requirements.
2. Track progress **only** in `CHECKLIST productionready.md` — mark items `[/]` when in progress, `[x]` when done.
3. If you discover something new that's missing or broken, **add it to `production readiness.md`** (requirements) AND add a corresponding checkbox to `CHECKLIST productionready.md` (tracking).
4. If something is **high-priority**, flag it in the "High-Priority Reminders" section below so the user sees it immediately.

### 🔴 High-Priority Reminders
> Items the agent has flagged as urgent. Review these first.

- **Settings Modal Stubs**: Multiple tabs in settings modal are stubs — need cleanup or implementation (Mini-Phase 2.4).

---

## Reference · Architecture Details

<details>
<summary>Expand for full architecture, key files, and role details</summary>

### System diagram
```
frontend/ (Next.js 16, React 19, TypeScript, Tailwind v4, Leaflet)
    → REST API calls →
backend/ (FastAPI, SQLAlchemy, Shapely, Scikit-learn, TensorFlow 2.16)
    → SQLite (dev) / PostgreSQL+PostGIS via Supabase (prod)
    → Mask R-CNN weights from Hugging Face Hub (downloaded on startup)
```

### Report submission flow
1. Citizen POSTs photo + GPS to `POST /report/submit`
2. `ai_verifier.py` runs Mask R-CNN inference → confidence score
3. `spatial_utils.py` ray-casts GPS against `data/sjdm_barangays.geojson` → assigns barangay
4. Report saved with unique tracking slug (`EW-XXXX`)
5. Frontend displays confirmation + shareable tracking URL

### Report lifecycle
```
pending → verified | rejected → deployed → resolved | failed_cleanup
```
WorkOrder tracks assigned cleaner, priority, and SLA deadline (configurable per CENRO via `system_config` table).

### Key source files
| File | Responsibility |
|------|----------------|
| `backend/main.py` | All FastAPI routes (~3600 lines) |
| `backend/models.py` | SQLAlchemy ORM: User, Report, WorkOrder, SystemConfig, AuditLog |
| `backend/database.py` | Engine setup — auto-selects SQLite (dev) vs PostgreSQL (prod) |
| `backend/ai_verifier.py` | Mask R-CNN wrapper; mock fallback if model absent |
| `backend/spatial_utils.py` | Shapely point-in-polygon for barangay routing |
| `backend/analytics.py` | DBSCAN clustering (eps=0.001°, min_samples=2) |
| `frontend/app/barangay/page.tsx` | Barangay admin portal |
| `frontend/app/cenro/page.tsx` | CENRO city-wide dashboard |
| `frontend/app/cleaner/page.tsx` | Cleanup team portal |
| `frontend/components/MapComponent.tsx` | Leaflet map with boundaries, pins, heatmap |
| `data/sjdm_barangays.geojson` | 59 barangay polygons |

### Roles & access
| Role | Portal route | Key capabilities |
|------|-------------|-----------------|
| citizen | `/report`, `/track/[id]` | Submit reports, view public map |
| barangay | `/barangay` | Manage jurisdictional reports, deploy & resolve cleanup |
| cenro | `/cenro` | City-wide analytics, barangay ranking, reassign/force-close |

### Test accounts (after `seed_test_data.py`)
- `citizen@test.com` / `password123`
- `barangay@test.com` / `password123` (assigned to Muzon)
- `cenro@test.com` / `password123`

### AI / ML notes
- Model: `backend/models/mask_rcnn_garbage.h5` — gitignored, download from HuggingFace.
- Confidence threshold: 0.5 — below this → auto-rejected.
- Vendored `backend/mrcnn/` — do NOT modify.

### Database
- Dev: SQLite at `backend/ecowatch.db` (auto-created, gitignored).
- Prod: PostgreSQL+PostGIS via Supabase (`DATABASE_URL` env var).
- No ORM migrations; schema via `database/schema.sql` or `create_all()` on startup.

</details>
