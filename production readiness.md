# 🌿 EcoWatch SJDM — Production Readiness Master Document

> **Last updated**: August 16, 2026  
> **Purpose**: Complete reference document for everything needed to bring EcoWatch SJDM to production-ready, defense-ready, and deployment-ready status.  
> **How to use**: Read this end-to-end, then use the companion `CHECKLIST productionready.md` to track progress.

---

## Table of Contents

1. [Current System Status](#1-current-system-status)
2. [Complete Unfinished Features (Settings)](#2-complete-unfinished-features-settings)
3. [Legal & Compliance Pages](#3-legal--compliance-pages)
4. [ISO 25010 Quality Standardization](#4-iso-25010-quality-standardization)
5. [Missing Subpages & Content](#5-missing-subpages--content)
6. [Security Hardening](#6-security-hardening)
7. [Deployment & DevOps](#7-deployment--devops)
8. [Testing Strategy](#8-testing-strategy)
9. [Documentation Gaps](#9-documentation-gaps)
10. [Known Bugs & Cleanup](#10-known-bugs--cleanup)
11. [Nice-to-Have Features](#11-nice-to-have-features)
12. [Prioritized Action Plan](#12-prioritized-action-plan)
13. [Suggestions to Improve the System](#13-suggestions-to-improve-the-system)
14. [Account Management](#14-account-management)

---

## 1. Current System Status

### What's Working (the good news)

| Area | Status | Details |
|------|--------|---------|
| **Backend API** | ✅ 100% (72/72 endpoints) | All routes fully implemented with RBAC, Pydantic validation, audit logging |
| **Report Submission** | ✅ Complete | Multi-photo, EXIF GPS extraction, SJDM boundary validation, AI verification |
| **AI Verification** | ✅ Complete | Mask R-CNN inference with mock fallback, confidence scoring, mask overlays |
| **Barangay Routing** | ✅ Complete | Shapely ray-casting against 59 barangay polygons |
| **DBSCAN Heatmap** | ✅ Complete | Clustering with eps=0.001° (~100m), min_samples=2 |
| **Report Tracking** | ✅ Complete | Progress stepper, SLA countdown, before/after evidence |
| **Barangay Portal** | ✅ Complete (5 tabs) | Dashboard, Reports, Map, Workorders, Accounts |
| **CENRO Portal** | ✅ Complete (9 tabs) | Command Center, City Map, Oversight, SLA, Analytics, Barangay Mgmt, Evidence, Audit Log, User Mgmt |
| **Cleaner Portal** | ✅ Complete (5 tabs) | Dashboard, Jobs, Map, History, Help |
| **Notifications** | ✅ Complete | In-app notifications with unread count, synthetic CENRO alerts |
| **Auth** | ✅ Complete | Login, register, Google OAuth, email verification, password reset |
| **AI Chatbot** | ✅ Complete | Gemini 2.0 Flash streaming via FloatingChat |

### What Needs Work

| Area | Status | Estimate |
|------|--------|----------|
| Settings Modal (9 tabs) | ⚠️ ~30% functional | 5-8 hrs to fix |
| Legal & Compliance Pages | ❌ 0% — nothing exists | 3-4 hrs |
| Missing Subpages (About, Team, FAQ, etc.) | ❌ 0% | 4-5 hrs |
| Security Hardening | 🟡 ~60% | 3-4 hrs |
| SEO & Accessibility | ⚠️ ~20% | 3-4 hrs |
| CI/CD Pipeline | ❌ Manual only | 2-3 hrs |
| Frontend Tests | ❌ None | 4-6 hrs |

---

## 2. Complete Unfinished Features (Settings)

The settings system at `frontend/components/settings/SettingsModal.tsx` has 9 tabs. Most are stubs.

### ✅ Working
| Tab | Status | What Works |
|-----|--------|------------|
| **Developer Options** | ✅ Complete | Email verification toggle wired to `GET/PUT /config/email-verification` |
| **AI Policy** | ⚠️ Partial | Confidence threshold slider works, but model status metrics are hardcoded strings |

### ⚠️ Partial
| Tab | What Works | What Doesn't |
|-----|------------|--------------|
| **General → Appearance** | Theme switcher (Light/Dark/System) | "Compact Mode" and "Show Animations" toggles only write localStorage, no UI effect |
| **Storage Settings** | Storage bars fetch real data from `/analytics/storage-health` | "Auto-Purge" dropdown only writes localStorage |

### ❌ Stubbed / Non-Functional
| Tab | Issue |
|-----|-------|
| **General → Language** | Language selector (EN/FIL/ES) only saves to localStorage. No i18n framework installed |
| **General → Shortcuts** | Read-only reference table. Zero keyboard listeners wired |
| **Connectivity** | Only "Backend API" checks `/health`. Database, Supabase Storage, AI Model show hardcoded "Connected" |
| **Data Export Hub** | Only "Export System Logs" is real. "Analytics Report", "Database Dump", "Export Images" are fake `setTimeout` → toast |
| **Notifications** | Email, SMS, Push, Quiet Hours toggles only save to localStorage. No VAPID/SMS gateway |

### Recommendation
> For anything you can't fully implement: **remove the UI**. A clean settings modal with 4 working tabs is better than 9 tabs where 5 are obviously fake. Panelists *will* click everything.

---

## 3. Legal & Compliance Pages

### Why This Matters
The **Philippine Data Privacy Act (RA 10173)** requires privacy policy disclosure for any system that processes personal information. EcoWatch collects:
- Full names and email addresses
- GPS coordinates (precise location)
- Photos (potentially containing faces, license plates)
- Device EXIF data (camera model, timestamps)
- Browsing behavior (localStorage session)

**A privacy policy is legally mandatory.**

### Pages to Create
| Page | Route | Content |
|------|-------|---------|
| **Privacy Policy** | `/privacy` | What data is collected, how it's processed, who accesses it, retention period, user rights under RA 10173, third-party services, DPO contact |
| **Terms of Service** | `/terms` | Acceptable use, content ownership, disclaimer, account termination, government data sharing |
| **Community Guidelines** | (can be section in Terms) | No false reports, no harassment, photo requirements |

### Integration Tasks
- Fix dead `<a href="#">Terms</a>` and `<a href="#">Privacy</a>` links on login page
- Add consent checkbox on signup: "I agree to the Terms of Service and Privacy Policy"
- Add location consent explanation before GPS access in report flow
- Add photo consent notice (photos reviewed by AI + government officials)
- Replace vague signup disclaimer with proper legal agreement text

---

## 4. ISO 25010 Quality Standardization

### 4.1 Functional Suitability ✅ Mostly Complete
- [x] Report submission, tracking, management
- [x] AI verification with fallback
- [x] Barangay routing
- [x] DBSCAN clustering
- [x] Auth (login, register, OAuth, password reset, email verify)
- [x] Notifications
- [x] Data export (CSV)
- [ ] Settings features mostly stubbed
- [ ] i18n not implemented

### 4.2 Performance Efficiency
- [ ] Add `loading.tsx` files to ALL route folders (currently missing everywhere)
- [ ] Lazy load images in report lists and evidence galleries
- [ ] Verify pagination works on all list endpoints
- [ ] Document Mask R-CNN inference latency benchmarks

### 4.3 Compatibility
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Mobile device testing (iOS Safari, Android Chrome)
- [ ] Verify responsive design at 320px → 1920px+
- [ ] Document minimum browser requirements (WebRTC, Geolocation API)

### 4.4 Usability
- [ ] Tooltips on all dashboard KPI metrics
- [ ] Consistent form validation with specific error messages
- [ ] Empty state illustrations for data-less pages
- [ ] Replace native `alert()` with Sonner toast (QRCodeModal)
- [ ] Keyboard navigation on all interactive elements
- [ ] Breadcrumb navigation on nested pages

### 4.5 Reliability
- [ ] Custom 404 page (`app/not-found.tsx`)
- [ ] Custom error boundary (`app/error.tsx`, `app/global-error.tsx`)
- [ ] Retry logic for failed API calls
- [ ] Offline detection banner
- [x] Health check endpoint (`GET /health`)
- [x] Orphaned verification auto-resume on startup
- [x] Graceful AI degradation (mock fallback)

### 4.6 Security
- [ ] 🔴 Lock CORS to Vercel domain (currently `allow_origins=["*"]`)
- [ ] 🔴 Add rate limiting (`slowapi`) on auth + submit endpoints
- [ ] 🔴 Remove traceback exposure at `main.py:3617`
- [ ] 🟡 Enforce password strength on `/auth/register`
- [ ] 🟡 Add client-side session timeout
- [ ] Remove `bcryptjs` from frontend `package.json`
- [x] SQL injection protection (SQLAlchemy ORM)
- [x] CSV injection protection
- [x] Bcrypt password hashing
- [x] RBAC + jurisdiction guards
- [x] User enumeration prevention

### 4.7 Maintainability
- [ ] Standardize error response format across all endpoints
- [ ] Add `loading.tsx` files consistently
- [ ] Remove dead components (LocationPickerMap, PinpointFullscreen)
- [ ] Remove `console.log` from frontend
- [ ] Re-enable TypeScript + ESLint build checks in `next.config.ts`
- [ ] Consider splitting `main.py` (4,397 lines) into route modules

### 4.8 Portability
- [x] Docker deployment configured
- [x] Database auto-switching (SQLite ↔ PostgreSQL)
- [ ] Update `backend/.env.example` (missing 6 variables)
- [ ] Create `frontend/.env.example`
- [ ] Add Alembic for database migrations

---

## 5. Missing Subpages & Content

### Informational Pages
| Page | Route | Purpose |
|------|-------|---------|
| **About** | `/about` | What is EcoWatch SJDM? Mission, vision, SJDM context, how it works |
| **Team** | `/team` | Team members with photos, roles, advisers, academic institution |
| **Contact** | `/contact` | Contact form or CENRO/LGU info, feedback channel |
| **FAQ** | `/faq` | Public FAQ (currently only 4 questions in cleaner HelpTab) |
| **How It Works** | `/how-it-works` or section in About | Visual step-by-step guide |

### Error & System Pages
| Page | File | Purpose |
|------|------|---------|
| **404 Not Found** | `app/not-found.tsx` | Branded page with helpful navigation |
| **Error Boundary** | `app/error.tsx` + `app/global-error.tsx` | Friendly error page with retry |

### Navigation Fixes
- Fix dead footer links to `/about`, `/contact`, `/terms`, `/privacy`
- Ensure Navbar includes Privacy Policy link

---

## 6. Security Hardening

Priority-ordered:

| # | Task | Severity | Effort |
|---|------|----------|--------|
| 1 | Lock CORS to Vercel domain in `main.py` | 🔴 Critical | 5 min |
| 2 | Remove traceback exposure at `main.py:3617` | 🔴 Critical | 5 min |
| 3 | Add rate limiting (`slowapi`) on auth + submit | 🔴 Critical | 1 hr |
| 4 | Enforce password strength on `/auth/register` | 🟡 High | 15 min |
| 5 | Add client-side session timeout (auto-logout) | 🟡 High | 1 hr |
| 6 | Remove `bcryptjs` from frontend `package.json` | 🟡 Medium | 5 min |
| 7 | Re-enable TS + ESLint build checks | 🟡 Medium | varies |
| 8 | Add Content Security Policy headers | 🟡 Medium | 1 hr |

---

## 7. Deployment & DevOps

- **Sync live backend** — Vercel frontend hitting old HF Spaces backend
- **Set up CI/CD** — GitHub Actions for lint, build, test, auto-deploy
- **Add `vercel.json`** — security headers, redirects, regions
- **Add `robots.txt`** via `app/robots.ts`
- **Add `sitemap.xml`** via `app/sitemap.ts`
- **SEO metadata** on all pages (OpenGraph, Twitter cards, per-page titles)

---

## 8. Testing Strategy

### ✅ What Exists
- Backend smoke test suite (`smoke_test.py`, 784 lines) — auth, spatial, analytics, reports, RBAC, work orders
- Report detail test (`test_report_detail.py`)
- Manual QA checklist (`TESTING_CHECKLIST.md`)

### ❌ What's Missing
- Frontend unit tests (no Jest/Vitest/React Testing Library)
- E2E tests (no Playwright/Cypress)
- Cross-browser testing documentation
- Mobile device testing documentation
- Load/performance testing
- Accessibility audit (Lighthouse/axe-core)

### Note
> `AGENTS.md` references `test_auth.py` and `test_analytics.py` which were merged into `smoke_test.py` — update the docs.

---

## 9. Documentation Gaps

### Already Excellent (17 markdown docs!)
- README.md (762 lines), CODEBASE_GUIDE.md, DEFENSE_PLAN.md, FEATURES.md, HOSTING_GUIDE.md, MODEL_TRAINING.md, erd_dataflow.md, TESTING_CHECKLIST.md, sitemap.md, techstack.md, CHANGELOG.md, and more

### Still Missing
- **`LICENSE` file** — only a disclaimer blurb in README
- **Frontend `.env.example`** — no template
- **Backend `.env.example` update** — missing `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `FRONTEND_URL`, `GOOGLE_CLIENT_ID`, Supabase keys
- **Exportable Postman collection** — `postman/` has workspace metadata but no importable JSON

---

## 10. Known Bugs & Cleanup

- [ ] Fix duplicate "Graceville" in `cenro/page.tsx` barangays array
- [ ] Replace `alert()` with Sonner toast in `QRCodeModal.tsx:55`
- [ ] Remove dead components: `LocationPickerMap.tsx`, `PinpointFullscreen.tsx`
- [ ] Remove `console.log` debug statements from frontend
- [ ] Fix hardcoded DB size fallback (`main.py:654`) — use `pg_database_size()` for PostgreSQL
- [ ] Remove legacy notification shims past cutover date (`main.py:4373`)
- [ ] Add missing `alt` on images in `barangay/page.tsx:2319, 2361`
- [ ] Add `aria-label` to icon buttons (Navbar settings, QRCodeModal close, SettingsModal close, ThemeToggle)
- [ ] Add `role="dialog"`, `aria-modal="true"`, focus trapping on custom modals
- [ ] Fix ultra-small font sizes (`text-[9px]`, `text-[10px]`) for mobile readability

---

## 11. Nice-to-Have Features

- PWA support (manifest.json + service worker for "Add to Home Screen")
- Web Push notifications (VAPID)
- Full i18n (Filipino translation via `next-intl`)
- Before/after photo gallery (public showcase)
- Dark mode toggle in navbar (quick access)
- `docker-compose.yml` for one-command local dev
- `.editorconfig` / `.prettierrc` for code formatting
- Gamification (badges/points for citizen reporters)

---

## 12. Prioritized Action Plan

### 🔴 Phase 1 — Critical (Do Immediately) — ~2.5 hours
| # | Task | Time |
|---|------|------|
| 1 | Lock CORS to Vercel domain | 5 min |
| 2 | Remove traceback exposure at `main.py:3617` | 5 min |
| 3 | Create Privacy Policy page (`/privacy`) | 1.5 hr |
| 4 | Create Terms of Service page (`/terms`) | 1 hr |
| 5 | Fix dead legal links on login/signup | 15 min |

### 🟡 Phase 2 — High Priority — ~8 hours
| # | Task | Time |
|---|------|------|
| 7 | Add rate limiting (`slowapi`) | 1 hr |
| 8 | Clean up Settings modal (remove or implement stubs) | 3 hr |
| 9 | Create About page | 1 hr |
| 10 | Create Team page | 1 hr |
| 11 | Create custom 404 + error pages | 1 hr |
| 12 | Add consent checkbox to signup | 15 min |
| 13 | Fix duplicate Graceville bug | 5 min |
| 14 | Add `loading.tsx` to all routes | 30 min |

### 🟢 Phase 3 — Polish & Compliance — ~8 hours
| # | Task | Time |
|---|------|------|
| 15 | Create FAQ page | 1 hr |
| 16 | Create Contact page | 1 hr |
| 17 | Add SEO metadata (OpenGraph, per-page titles) | 1 hr |
| 18 | Add `robots.txt` + `sitemap.xml` | 30 min |
| 19 | Fix accessibility (alt text, aria-labels, focus trapping) | 1.5 hr |
| 20 | Enforce password strength on registration | 15 min |
| 21 | Add client-side session timeout | 1 hr |
| 22 | Remove dead components + console.logs | 30 min |
| 23 | Update `.env.example` files | 30 min |
| 24 | Add `LICENSE` file | 5 min |

### 🔵 Phase 4 — Completeness — ~15 hours
| # | Task | Time |
|---|------|------|
| 25 | Set up CI/CD (GitHub Actions) | 2 hr |
| 26 | Re-enable TypeScript + ESLint builds | 3 hr |
| 27 | Implement real Connectivity tab checks | 1 hr |
| 28 | Implement real Data Export buttons | 2 hr |
| 29 | Add frontend tests (Vitest + RTL) | 4 hr |
| 30 | Split `main.py` into route modules | 3 hr |
| 31 | Add Alembic for database migrations | 2 hr |

> **Total**: ~35 hours for full production readiness.  
> **Minimum viable launch** (Phases 1-2): ~11 hours.

---

## 13. Suggestions to Improve the System

### 🏗️ As a Senior Developer

#### System Architecture
1. **Split `main.py` into route modules** — A 4,397-line monolith is a maintenance nightmare. Break into: `routes/auth.py`, `routes/reports.py`, `routes/analytics.py`, `routes/admin.py`, `routes/workorders.py`, `routes/notifications.py`, `routes/spatial.py`, `routes/config.py`
2. **Add API versioning** — Prefix all routes with `/api/v1/` so you can evolve the API without breaking clients
3. **Replace `X-User-Id` header auth with JWT** — Current auth is trivially spoofable. Use proper JWT tokens with expiry and refresh flow
4. **Add a background job queue** — Use Celery/Redis or even FastAPI's built-in BackgroundTasks more systematically for AI inference, email dispatch, and report processing
5. **Implement proper database migrations** — Alembic instead of startup `ALTER TABLE` hacks. Version your schema properly
6. **Add structured logging** — Use Python's `logging` with structured JSON output for production. Add request ID tracing across API calls
7. **Add health check depth** — Current `/health` just returns OK. Add deep health checks: database connectivity, Supabase connection, model file presence, disk space

#### Frontend Architecture
8. **Create a shared API client layer** — Replace scattered `fetch()` calls with a centralized API client that handles auth headers, error responses, token refresh, and retry logic
9. **Add React Query (TanStack Query)** — Replace manual `useEffect` + `useState` data fetching with proper cache management, background refetching, and optimistic updates
10. **Create reusable data table component** — The barangay, CENRO, and cleaner portals all have similar tables. Extract a shared `DataTable` with sorting, filtering, pagination, and export built in
11. **Add proper state management** — Replace scattered `localStorage` reads with a proper context or Zustand store for user session, theme, and settings

#### Code Quality
12. **Re-enable TypeScript strict mode** — `ignoreBuildErrors: true` is hiding real bugs. Fix the type errors properly
13. **Set up pre-commit hooks** — Use Husky + lint-staged to enforce linting and formatting before commits
14. **Add error monitoring** — Integrate Sentry for both frontend and backend to catch production errors

---

### 🧪 As a QA Tester / Quality Assurance

#### Critical Test Gaps
1. **No automated E2E tests** — The most critical user flows (register → login → submit report → track → resolve) have zero automated coverage. Add Playwright tests for at minimum:
   - Citizen: Register → Verify Email → Login → Submit Report → View Tracking → See Status Change
   - Barangay: Login → View Reports → Deploy Cleaner → Upload Cleanup → Verify Resolution
   - CENRO: Login → View Analytics → Reassign Report → Force Close → Check Audit Log
   - Cleaner: Login → View Jobs → Start Work → Upload Proof → See Verification Result

2. **Settings modal is a testing landmine** — Every stubbed toggle is a potential "this doesn't work" moment during demo/defense. Either implement or remove. Half-working UI is worse than no UI

3. **No offline/error resilience testing** — What happens when:
   - User loses internet mid-report-submission?
   - Backend goes down while cleaner is uploading proof?
   - AI model inference takes >30 seconds?
   - User submits a 50MB photo? (backend caps at 10MB but does frontend validate?)

4. **No load testing** — If 100 citizens submit reports simultaneously, does the system hold? What about 50 concurrent Mask R-CNN inferences?

5. **Mobile testing is critical** — Citizens will primarily use phones. Test:
   - Camera permission flow on iOS Safari
   - GPS accuracy on Android Chrome
   - Photo upload from gallery vs camera
   - Map performance on low-end devices
   - Touch targets for small buttons

6. **Accessibility audit needed** — Run Lighthouse and axe-core on every page. Fix:
   - Missing alt text on images
   - Missing aria-labels on icon buttons
   - Low contrast text (`text-foreground/30`)
   - Ultra-small fonts (`text-[9px]`)
   - No focus trapping in modals
   - No skip-to-content link

7. **Data validation edge cases** — Test:
   - Report with exactly 5 photos (max)
   - Report with no description
   - Special characters in barangay names (apostrophes, ñ)
   - Very long descriptions (>10,000 chars)
   - Duplicate email registration
   - Password with emoji or unicode

---

### 👤 As a Client / End User

#### For Citizens
1. **"I submitted a report... now what?"** — After submitting, citizens land back on the map with no clear next step. Add:
   - A **personal dashboard** showing their report history, resolution stats, and impact metrics ("You've helped clean up 3 dump sites!")
   - **Email notifications** when their report status changes (verified → assigned → resolved)
   - **Push notifications** for mobile users
   - A **"My Impact" page** with visual stats and a map of all their submitted reports

2. **"Can I see how my barangay is doing?"** — Citizens should be able to view:
   - Their barangay's cleanup performance ranking
   - Resolution rate compared to other barangays
   - A mini leaderboard showing most responsive barangays
   - This builds trust and accountability

3. **"How do I know my report was actually addressed?"** — The tracking page is good, but add:
   - **Before/after photo comparison** more prominently
   - **Cleanup team info** (which team resolved it, when)
   - **Feedback option** — "Was this cleanup satisfactory?" (yes/no + comment)

4. **"I don't know how to use this"** — Add:
   - An **interactive onboarding tour** for first-time users (tooltip walkthrough)
   - A **"How It Works" page** with animated step-by-step visuals
   - The floating chatbot helps, but a structured guide is better for first impressions

5. **"I want to share this with my neighbors"** — The QR code is great, but also add:
   - **Social sharing buttons** (Facebook, Twitter, copy link) on the tracking page
   - **Shareable report cards** — a nice image preview with the report photo, status, and tracking link for easy sharing on social media

#### For Barangay Admins
6. **"I need to report to my superiors"** — Barangay captains need to present to their council. Add:
   - **PDF report generation** — Monthly summary with charts, resolution stats, before/after photos
   - **Print-friendly views** for the dashboard and report tables
   - **Exportable charts** (the Recharts data should be downloadable as images)

7. **"I have too many reports to manage"** — Add:
   - **Bulk actions** — select multiple reports and batch-assign to a cleaner, batch-close, batch-export
   - **Priority queue view** — auto-sorted by SLA urgency (breached first, then at-risk, then normal)
   - **Smart assignment suggestions** — "Cleaner A has 2 active jobs, Cleaner B has 0. Assign to B?"

8. **"When did my cleaners last work?"** — The cleaner accounts tab is basic. Add:
   - **Cleaner performance dashboard** — completion rate, average response time, SLA compliance per cleaner
   - **Cleaner workload view** — calendar/timeline showing each cleaner's assignments and availability
   - **Cleaner location on map** (if they opt in) — see where your team is right now

9. **"I need to talk to CENRO"** — Add:
   - **Inter-role messaging** or at minimum an **escalation button** that notifies CENRO with a message
   - **Announcement system** — CENRO can broadcast messages to all barangay admins

#### For CENRO Officials
10. **"I need this for my presentation to the mayor"** — Add:
    - **Executive summary dashboard** — a single-page view with the 5 most important KPIs, a trend chart, and top 3 problem barangays
    - **PDF report generation** — monthly/quarterly city-wide report with all analytics
    - **Comparative analytics** — month-over-month, quarter-over-quarter trends with percentage changes
    - **Exportable charts** as images for PowerPoint presentations

11. **"Which barangays need intervention?"** — The barangay management tab exists but enhance with:
    - **Health scoring system** — Red/Yellow/Green barangay health based on resolution rate, SLA compliance, and trend direction
    - **Automated alerts** — "Barangay X has dropped below 50% resolution rate" pushed to CENRO notification
    - **Barangay comparison view** — side-by-side comparison of any 2-3 barangays

12. **"I want to see the big picture"** — Add:
    - **Waste type classification** — If the AI can detect waste types (plastic, organic, hazardous), show distribution charts
    - **Seasonal trends** — Are there more reports during rainy season? After fiestas?
    - **Prediction module** — Based on historical data, predict which areas are likely to have new dump sites

#### For Cleanup Teams
13. **"I need directions to the dump site"** — Add:
    - **"Open in Google Maps" button** on job cards — one-tap navigation to the GPS coordinates
    - **Optimized route view** — if cleaner has multiple jobs, show the most efficient route order

14. **"I want to see my performance"** — Add:
    - **Personal stats dashboard** — total cleanups, success rate, average completion time, SLA compliance
    - **Streak/achievement system** — "5 cleanups in a row!", "100% SLA compliance this month!"
    - **Monthly summary** — how many jobs completed, average time, comparison to team average

15. **"The help section is too basic"** — Expand the Help tab:
    - **Photo guidelines** — examples of what makes a good cleanup proof photo
    - **Common rejection reasons** — why AI might reject a cleanup (waste still visible)
    - **Troubleshooting guide** — camera not working, GPS inaccurate, upload failing
    - **Video tutorials** — short clips showing the workflow

#### For Everyone
16. **"Dark mode looks off in some places"** — Do a thorough dark mode audit on every page and component. Test every tab, modal, and drawer in both themes
17. **"The loading takes too long"** — Add skeleton loaders to all pages (not just spinners). Users should see the page structure immediately with placeholder content
18. **"I accidentally navigated away"** — Add unsaved changes warnings on forms (report submission, profile edit, settings)
19. **"Announcements and news"** — Add a system-wide announcement banner that CENRO can use to broadcast maintenance windows, new features, or important notices
20. **"Make it feel like a real app"** — PWA support with "Add to Home Screen", offline caching for the map tiles, and push notifications would make this feel professional

---

### 📋 Summary of Top 10 Most Impactful Suggestions

| # | Suggestion | Impact | Effort | Who Benefits |
|---|-----------|--------|--------|-------------|
| 1 | Citizen personal dashboard / "My Impact" page | 🔥 High | 4 hr | Citizens |
| 2 | PDF report generation for barangay + CENRO | 🔥 High | 4 hr | Barangay, CENRO |
| 3 | Bulk actions for report management | 🔥 High | 3 hr | Barangay |
| 4 | "Open in Google Maps" for cleaners | 🔥 High | 30 min | Cleaners |
| 5 | Interactive onboarding tour | 🟡 Medium | 2 hr | All new users |
| 6 | Clean up / remove stubbed Settings tabs | 🟡 Medium | 2 hr | All roles |
| 7 | Cleaner performance dashboard | 🟡 Medium | 3 hr | Barangay, Cleaner |
| 8 | Social sharing on tracking page | 🟡 Medium | 1 hr | Citizens |
| 9 | Barangay health scoring (Red/Yellow/Green) | 🟡 Medium | 2 hr | CENRO |
| 10 | Executive summary one-pager for CENRO | 🟡 Medium | 3 hr | CENRO |

---

## 14. Account Management

### Current State
The backend has a `PUT /users/{user_id}` endpoint that allows CENRO/barangay admins to edit `full_name`, `email`, `phone_number`, and `barangay_assignment`. However, **there is no way to change a user's role** through the admin interface.

### The Problem
- A citizen who becomes a barangay officer cannot have their role updated — they'd need a new account.
- CENRO cannot promote/demote users (e.g., citizen → barangay, barangay → cleaner, or revoking officer status back to citizen).
- There is no UI in the CENRO "User Management" tab to edit user details or roles.
- Barangay admins can only manage cleaners in their own jurisdiction — but there's no interface to do even that beyond what the "Accounts" tab shows.

### What's Needed

#### Backend
1. **Add `role` field to `UpdateUserRequest`** — Allow CENRO to change a user's role between `citizen`, `barangay`, `cleaner`, `cenro`.
   - Only CENRO should be allowed to change roles (not barangay admins).
   - When changing to `barangay` or `cleaner`, require `barangay_assignment` to be set.
   - When changing from `barangay`/`cleaner` to `citizen`, clear `barangay_assignment`.
   - Log the change in the audit trail (who changed what, old role → new role).
2. **Validate role transitions** — Prevent invalid states (e.g., a cleaner with no barangay assignment).
3. **Consider adding a `PUT /users/{user_id}/role` dedicated endpoint** — Separate from general profile edits for clearer RBAC and audit logging.

#### Frontend — CENRO User Management Tab
4. **Add "Edit User" modal/drawer** — When CENRO clicks a user in the User Management tab, show an edit form with:
   - Full name (editable)
   - Email (editable)
   - Phone number (editable)
   - **Role dropdown** (citizen / barangay / cleaner / cenro)
   - **Barangay assignment dropdown** (shown only when role is `barangay` or `cleaner`)
   - Disable/reactivate toggle
   - Reset password button
5. **Add role badge in user list** — Show the user's current role clearly in the table with colored badges.
6. **Add confirmation dialog for role changes** — "Are you sure you want to change [User Name] from Citizen to Barangay Officer assigned to Muzon?" with audit reason.

#### Frontend — Barangay Accounts Tab
7. **Add "Edit Cleaner" functionality** — Barangay admins should be able to edit their cleaners' names, emails, and phone numbers directly from the Accounts tab.
8. **Show cleaner status** — Active vs disabled, last login date, number of completed jobs.

#### Security Considerations
- Role changes MUST be audit-logged with old_role → new_role, changed_by, and timestamp.
- Only CENRO can change roles — this is a **hard rule**.
- Changing a user's role should NOT affect their existing reports or work orders.
- Consider adding a "reason" field for role changes for accountability.

### Impact
- **Who benefits**: CENRO admins (proper user governance), barangay admins (cleaner management)
- **Effort estimate**: ~4-5 hours (backend role endpoint + frontend edit modal + validation)
- **Priority**: 🟡 High — needed for proper account governance before production

---

*This document should be reviewed and updated as tasks are completed. Use the companion `CHECKLIST productionready.md` for tracking progress.*
