# ✅ CHECKLIST — EcoWatch SJDM Production Readiness

> **Purpose**: This is the AI working checklist. Use this to track task completion.  
> **How to use**: Mark items `[x]` when done, `[/]` when in progress, `[ ]` when not started.  
> **Last updated**: August 16, 2026

---

## 🔴 Phase 1 — Critical (Must Do First)

### Security
- [x] Lock CORS to Vercel domain — change `allow_origins=["*"]` in `backend/main.py:197`
- [x] Remove traceback exposure — replace `traceback.format_exc()` at `backend/main.py:3926` with generic error message
- [x] Remove `bcryptjs` from `frontend/package.json` (verified: backend-only hashing via bcrypt)

### Legal Pages
- [x] Create `/privacy` page — Privacy Policy compliant with RA 10173
- [x] Create `/terms` page — Terms of Service
- [x] Fix dead `<a href="#">Terms</a>` link on `frontend/app/login/page.tsx:160-161`
- [x] Fix dead `<a href="#">Privacy</a>` link on `frontend/app/login/page.tsx:160-161`
- [x] Add consent checkbox on signup form (`frontend/app/signup/page.tsx`)
- [x] Replace vague disclaimer at `frontend/app/signup/page.tsx:292` with proper legal text

---

## 🟡 Phase 2 — High Priority

### 🔴 Mini-Phase 2.1 — Security & Abuse Protection
- [x] Install and configure `slowapi` for rate limiting (with proxy-aware IP resolver)
- [x] Add rate limit on `POST /auth/login` (15/min)
- [x] Add rate limit on `POST /auth/register` (5/min)
- [x] Add rate limit on `POST /report/submit` (15/min)
- [x] Enforce password strength on `/auth/register` & `/auth/reset-password` (min 8 chars, 1 uppercase, 1 number) + live visual checklist in signup UI
- [x] Add client-side session timeout & inactivity monitor (auto-logout after 4 hours of inactivity)

### 👥 Mini-Phase 2.2 — Account Governance & User Roles (see `production readiness.md` §14)
- [x] **Backend**: Add `role` field to `UpdateUserRequest` (CENRO-only permission)
- [x] **Backend**: Validate role transitions (require `barangay_assignment` for barangay/cleaner roles)
- [x] **Backend**: Audit-log role changes (old_role → new_role, changed_by, timestamp)
- [x] **Frontend (CENRO)**: Add "Edit User" modal with role dropdown + barangay assignment in User Management tab
- [x] **Frontend (CENRO)**: Add confirmation dialog for role changes
- [x] **Frontend (Barangay)**: Add "Edit Cleaner" functionality in Accounts tab

### 📄 Mini-Phase 2.3 — Subpages, Error Boundaries & Loading UX
- [ ] Create `/about` page — mission, vision, project background, AI workflow
- [ ] Create `/team` page — team members, roles, photos, advisers, institution
- [ ] Create `app/not-found.tsx` — custom branded 404 page
- [ ] Create `app/error.tsx` — custom error boundary with retry
- [ ] Create `app/global-error.tsx` — root-level error boundary
- [ ] Add `loading.tsx` to `app/` (root)
- [ ] Add `loading.tsx` to `app/barangay/`
- [ ] Add `loading.tsx` to `app/cenro/`
- [ ] Add `loading.tsx` to `app/cleaner/`
- [ ] Add `loading.tsx` to `app/report/`
- [ ] Add `loading.tsx` to `app/track/[id]/`
- [ ] Add `loading.tsx` to `app/profile/`
- [ ] Add `loading.tsx` to `app/login/`
- [ ] Add `loading.tsx` to `app/signup/`
- [ ] Fix duplicate "Graceville" in `frontend/app/cenro/page.tsx` barangays array

### ⚙️ Mini-Phase 2.4 — Settings Modal Cleanup & Navigation
- [ ] **General → Language**: Decide — implement basic Filipino toggle OR remove selector entirely
- [ ] **General → Shortcuts**: Decide — implement keyboard listeners OR remove the reference table
- [ ] **General → Appearance**: Wire "Compact Mode" and "Show Animations" to actual UI changes OR remove toggles
- [ ] **Connectivity Tab**: Wire "Database", "Supabase Storage", "AI Model" to real health checks OR remove fake status badges
- [ ] **Data Export Hub**: Wire "Analytics Report", "Database Dump", "Export Images" to real endpoints OR remove fake buttons
- [ ] **Notifications Tab**: Wire to backend storage OR remove the toggles
- [ ] **AI Policy Tab**: Replace hardcoded model status strings with real data from backend
- [ ] **Storage Settings**: Wire "Auto-Purge" to backend persistence OR remove dropdown
- [ ] Fix dead footer link → `/about`
- [ ] Fix dead footer link → `/contact`
- [ ] Fix dead footer link → `/terms`
- [ ] Fix dead footer link → `/privacy`

---

## 🟢 Phase 3 — Polish & Compliance

### More Subpages
- [ ] Create `/faq` page — public-facing FAQ (expand from cleaner HelpTab's 4 questions)
- [ ] Create `/contact` page — contact form or CENRO/LGU info

### SEO & Metadata
- [ ] Add per-page metadata titles (e.g., "Submit Report | EcoWatch SJDM")
- [ ] Add OpenGraph metadata to `app/layout.tsx`
- [ ] Add Twitter card metadata
- [ ] Create `app/robots.ts` (generates `robots.txt`)
- [ ] Create `app/sitemap.ts` (generates `sitemap.xml`)

### Accessibility (a11y)
- [ ] Add `alt` attribute to `<img>` at `frontend/app/barangay/page.tsx:2319`
- [ ] Add `alt` attribute to `<img>` at `frontend/app/barangay/page.tsx:2361`
- [ ] Add `aria-label` to Navbar settings button (`components/Navbar.tsx:86`)
- [ ] Add `aria-label` to QRCodeModal close button (`components/QRCodeModal.tsx:18`)
- [ ] Add `aria-label` to SettingsModal close button (`components/settings/SettingsModal.tsx:58`)
- [ ] Add `aria-label` to ThemeToggle button (`components/ThemeToggle.tsx`)
- [ ] Add `role="dialog"` + `aria-modal="true"` to SettingsModal
- [ ] Add `role="dialog"` + `aria-modal="true"` to QRCodeModal
- [ ] Add focus trapping to SettingsModal
- [ ] Add focus trapping to QRCodeModal
- [ ] Fix ultra-small font sizes: audit all `text-[9px]` and `text-[10px]` — minimum `text-[11px]`
- [ ] Audit color contrast on `text-foreground/30` and `text-foreground/40` elements
- [ ] Add skip-to-content link

### Security (continued)
- [ ] Enforce password strength on `/auth/register` endpoint
- [ ] Add CSP (Content Security Policy) headers

### Code Cleanup
- [ ] Replace `alert()` with Sonner toast in `components/QRCodeModal.tsx:55`
- [ ] Remove dead component: `components/LocationPickerMap.tsx`
- [ ] Remove dead component: `components/PinpointFullscreen.tsx`
- [ ] Remove all `console.log` statements from frontend production code
- [ ] Fix hardcoded DB size fallback at `backend/main.py:654` — use `pg_database_size()`
- [ ] Remove legacy notification shims at `backend/main.py:4373` (past 2026-06-15 cutover)

### Documentation
- [ ] Update `backend/.env.example` — add: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `FRONTEND_URL`, `GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Create `frontend/.env.example` with all required variables
- [ ] Add `LICENSE` file to project root (MIT or Apache 2.0 or proprietary capstone)
- [ ] Update `AGENTS.md` — fix references to `test_auth.py` and `test_analytics.py` (now merged into `smoke_test.py`)

---

## 🔵 Phase 4 — Completeness

### DevOps & CI/CD
- [ ] Create `.github/workflows/ci.yml` — lint + build + backend tests on PR
- [ ] Create `.github/workflows/deploy.yml` — auto-deploy to Vercel + HF Spaces
- [ ] Create `vercel.json` — security headers, redirects, regions
- [ ] Set up production env vars on Vercel
- [ ] Set up production env vars on HF Spaces

### Code Quality
- [ ] Re-enable `typescript: { ignoreBuildErrors: false }` in `next.config.ts`
- [ ] Re-enable `eslint: { ignoreDuringBuilds: false }` in `next.config.ts`
- [ ] Fix all TypeScript errors surfaced by strict mode
- [ ] Fix all ESLint errors surfaced by strict mode
- [ ] Set up Husky + lint-staged for pre-commit hooks

### Backend Architecture
- [ ] Split `main.py` into route modules (`routes/auth.py`, `routes/reports.py`, etc.)
- [ ] Add Alembic for database migrations
- [ ] Implement structured JSON logging (replace `print()` with proper logging)
- [ ] Add API versioning — prefix routes with `/api/v1/`

### Frontend Architecture
- [ ] Create shared API client layer (centralized fetch with auth headers, error handling, retry)
- [ ] Install and integrate React Query / TanStack Query for data fetching
- [ ] Extract reusable `DataTable` component from portal tables

### Settings — Full Implementation
- [ ] Implement Connectivity tab — real health checks for Database, Supabase, AI Model
- [ ] Implement Data Export — real "Analytics Report" CSV generation
- [ ] Implement Data Export — real "Database Dump" JSON generation
- [ ] Implement Data Export — real "Export Images" ZIP generation

### Testing
- [ ] Install Vitest + React Testing Library for frontend
- [ ] Write tests for auth flow components (Login, Signup, Reset)
- [ ] Write tests for report submission flow
- [ ] Write tests for tracking page
- [ ] Install Playwright for E2E testing
- [ ] Write E2E: Citizen flow (register → verify → login → submit → track)
- [ ] Write E2E: Barangay flow (login → view reports → deploy cleaner → resolve)
- [ ] Write E2E: CENRO flow (login → analytics → reassign → force close)
- [ ] Write E2E: Cleaner flow (login → view jobs → start → upload → verify)
- [ ] Run Lighthouse audit on all pages
- [ ] Run axe-core accessibility audit

---

## 🌟 Suggestions / Feature Improvements (Optional)

### Citizen Improvements
- [ ] Create citizen personal dashboard / "My Impact" page
- [ ] Add citizen feedback on cleanup ("Was this cleanup satisfactory?")
- [ ] Add social sharing buttons on tracking page (Facebook, Twitter, copy link)
- [ ] Add shareable report cards (image previews for social media)
- [ ] Add interactive onboarding tour for first-time users
- [ ] Show barangay cleanup performance to citizens (transparency)

### Barangay Improvements
- [ ] Add PDF report generation (monthly summary for council meetings)
- [ ] Add bulk actions (batch-assign, batch-close reports)
- [ ] Add cleaner performance dashboard (completion rate, avg response time, SLA per cleaner)
- [ ] Add cleaner workload calendar/timeline view
- [ ] Add priority queue view (auto-sorted by SLA urgency)
- [ ] Add smart assignment suggestions ("Cleaner B has fewer active jobs")

### CENRO Improvements
- [ ] Add executive summary one-pager for presentations
- [ ] Add PDF report generation (monthly/quarterly city-wide report)
- [ ] Add comparative analytics (month-over-month, quarter-over-quarter)
- [ ] Add automated barangay health alerts ("Barangay X dropped below 50% resolution")
- [ ] Add barangay comparison view (side-by-side 2-3 barangays)

### Cleaner Improvements
- [ ] Add personal stats dashboard (total cleanups, success rate, avg completion time)
- [ ] Expand Help tab (photo guidelines, common rejection reasons, troubleshooting, video tutorials)
- [ ] Add achievement/streak system ("5 cleanups in a row!")

### System-Wide
- [ ] PWA support (manifest.json + service worker)
- [ ] Web Push notifications (VAPID)
- [ ] Full i18n (Filipino translation)
- [ ] Announcement/news system (CENRO broadcasts to all roles)
- [ ] Inter-role messaging or escalation system
- [ ] Dark mode audit on every page/component/modal
- [ ] Unsaved changes warnings on forms
- [ ] Offline caching for map tiles (especially for cleaners in field)

---

## 📝 Notes & Decisions Log

| Date | Decision | Context |
|------|----------|---------|
| 2026-08-16 | Audit completed | Full system audit across 72 endpoints, 15 routes, 9 settings tabs |
| | | |
| | | |

---

*Update this file as tasks are completed. Mark `[/]` for in-progress, `[x]` for done.*
