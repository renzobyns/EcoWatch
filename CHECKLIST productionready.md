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
- [x] Create `/about` page — mission, vision, project background, AI workflow
- [x] Create `/team` page — team members, roles, photos, advisers, institution
- [x] Create `app/not-found.tsx` — custom branded 404 page
- [x] Create `app/error.tsx` — custom error boundary with retry
- [x] Create `app/global-error.tsx` — root-level error boundary
- [x] Add `loading.tsx` to `app/` (root)
- [x] Add `loading.tsx` to `app/barangay/`
- [x] Add `loading.tsx` to `app/cenro/`
- [x] Add `loading.tsx` to `app/cleaner/`
- [x] Add `loading.tsx` to `app/report/`
- [x] Add `loading.tsx` to `app/track/[id]/`
- [x] Add `loading.tsx` to `app/profile/`
- [x] Add `loading.tsx` to `app/login/`
- [x] Add `loading.tsx` to `app/signup/`
- [x] Fix duplicate "Graceville" in `frontend/app/cenro/page.tsx` barangays array

### ⚙️ Mini-Phase 2.4 — Settings Modal Cleanup & Navigation
- [x] **General → Language**: Real Google Translate integration (English / Filipino toggle) + localStorage persistence
- [x] **General → Shortcuts**: Interactive keyboard shortcuts recorder and reset default listeners
- [x] **General → Appearance**: Light / Dark / System theme switcher with real instant theme sync
- [x] **Connectivity Tab**: Real health checks for Backend, Database, Supabase Storage, and AI Model via `/health/full`
- [x] **Data Export Hub**: Real CSV, JSON, and ZIP file export endpoints (System Logs, Analytics, DB Dump, Images)
- [x] **Notifications Tab**: Clear informative disclaimer for external providers (Resend/SMS domain verification)
- [x] **AI Policy Tab**: Real AI confidence threshold configuration via `PATCH /admin/system-config`
- [x] **Storage Settings**: Real media & database storage health metrics via `/analytics/storage-health`
- [x] Fix dead footer link → `/about`
- [x] Fix dead footer link → `/team`
- [x] Fix dead footer link → `/terms`
- [x] Fix dead footer link → `/privacy`
- [x] Replace `alert()` with Sonner toast in `QRCodeModal.tsx`

### 🛡️ Mini-Phase 2.5 — Two-Layer Human-in-the-Loop Verification System
- [x] **Database Schema**: Add `ai_verified` and `ai_rejected` enum statuses to `ReportStatus`
- [x] **Database Schema**: Add `human_verified_by`, `human_verified_at`, `human_verification_notes`, `human_verification_action` columns with auto-migration DDL
- [x] **Backend Logic**: Update Mask R-CNN background task to route to `ai_verified` / `ai_rejected`
- [x] **Backend API**: Add `POST /report/{report_id}/human-verify` endpoint with RBAC (Barangay/CENRO), override logging, and CENRO alert triggers
- [x] **Backend API**: Add `GET /reports/pending-review` endpoint with barangay jurisdiction filtering
- [x] **Backend Guard**: Add 409 Conflict enforcement on `PUT /report/{id}/assign` blocking unverified reports
- [x] **Backend Analytics**: Update timeline, leaderboards, and AI quality metrics for two-layer statuses
- [x] **Frontend Navigation**: Add Review Queue counter badge to `PortalSidebar` and mobile nav
- [x] **Frontend Barangay Portal**: Add dedicated "Review" tab with All/AI Verified/AI Rejected filters, trust scores, and preset rejection reasons
- [x] **Frontend Deployment Gate**: Add verification gate modal intercepting cleaner dispatch on unconfirmed reports
- [x] **Frontend CENRO Portal**: Add Human Verification banner with Approve/Reject actions in `ReportDetailDrawer` and status filters in `OversightTab`
- [x] **Automated Testing**: Comprehensive end-to-end verification test suite in `backend/test_human_verification.py`

### 🧠 Mini-Phase 2.6 — Three-Layer VLM Verification (Gemini Flash + Mask R-CNN + CENRO HITL) *(see `production readiness.md` §15)*

#### Phase 0: Evaluation Dataset
- [ ] Collect 100-200 labeled test images (dumpsites, food in plastic, selfies, clean streets, blurry night, construction debris, indoor rooms, pet photos)
- [ ] Create CSV manifest: `filename, expected_is_waste, expected_category, notes`

#### Phase 1: API Configuration
- [x] Obtain Gemini Flash API key from Google AI Studio
- [x] Store `GOOGLE_GEMINI_API_KEY` in `backend/.env` (gitignored, server-side only)
- [x] Verify API key works (HTTP 200 from Google AI Studio)

#### Phase 2: VLM Service Module (`backend/vlm_service.py`)
- [x] Define Pydantic `VLMResult` model (`is_waste_issue`, `category`, `confidence`, `description`, `rejection_reason`)
- [x] Implement `verify_with_vlm()` function with multi-image batch support
- [x] EXIF stripping via Pillow before base64 encoding (RA 10173 compliance)
- [x] Image preprocessing: resize to max 1024px long side + JPEG 75% compression
- [x] SHA-256 image hash cache to avoid duplicate API calls
- [x] Timeout handling (18s) with connection pooling & multi-model fallback chain
- [x] Structured logging: provider, latency_ms, result, cache_hit
- [x] Graceful fallback: never raises, returns result or fallback indicator

#### Phase 3: Unit Testing & Edge-Case Validation (`backend/test_vlm.py`)
- [x] CLI test script processing eval dataset images and real uploads
- [x] Tested EXIF stripping (RA 10173 privacy verified)
- [x] Tested prank/non-waste rejection (clean blue surface rejected with high confidence)
- [x] Tested SHA-256 quota cache hit (1ms latency, 0 tokens consumed)
- [x] Tested real upload photo (`cleanup_3eedc01c.jpg` correctly classified)
- [x] Tested Before vs. After cleanup proof verification fallback

#### Phase 4: Pipeline Integration (`backend/main.py`)
- [x] Modify `_verify_report_photos_task()` — call VLM first, conditionally run Mask R-CNN per Decision Table
- [x] Add DB columns to Report model: `vlm_result` (JSON), `vlm_category`, `vlm_confidence`, `vlm_description`, `vlm_provider`, `vlm_latency_ms`
- [x] Implement full Decision Table status routing (verified / pending_review / rejected / unverified)
- [x] Daily budget guard: skip VLM when approaching 1,400 daily calls
- [x] Update analytics endpoints to include VLM metrics
- [x] Ensure citizen reports are NEVER lost if VLM is down (accept → queue → verify later)

#### Phase 5: CENRO Portal — Side-by-Side Review UI
- [x] Display VLM natural language reason alongside Mask R-CNN mask overlay in `ReportDetailDrawer`
- [x] Show Decision Table outcome label (e.g., "Disagreement: VLM not_waste vs Mask R-CNN detected")
- [x] Add VLM category badges and confidence indicators to report cards
- [x] Preserve existing Override / Confirm actions with audit logging

#### Phase 6: Cleanup Proof VLM Verification
- [x] Implement before-vs-after comparison API call (original dump photo + cleanup proof)
- [x] Auto-resolve if `cleaned: true` with high confidence
- [x] Flag for barangay review if `cleaned: false` with Gemini's remarks
- [x] Add `cleanup_vlm_result` column to WorkOrder or Report model

#### Phase 7: Monitoring & Observability
- [x] Daily VLM usage counter (track calls against 1,500/day budget)
- [x] Log every fallback event (VLM → Mask R-CNN only)
- [x] Add VLM health status to `/health/full` endpoint
- [x] Add VLM usage metrics to CENRO Command Center (calls today, cache hit rate, avg latency, fallback count)

#### Privacy & Compliance
- [x] Verify EXIF is fully stripped before any image is sent to Google API
- [x] Update Privacy Policy (`/privacy`) to disclose third-party AI photo processing
- [x] Update report submission consent notice to mention AI analysis by external service

---

### 🛡️ Mini-Phase 2.7 — Cleanup Verification Pipeline (MC-005: 6-Phase Anti-Fraud Proofing) *(see `production readiness.md` §16)*

> **Branch**: `feat/cleanup-verification-pipeline`
> **Full Spec**: [`ecowatch-cleanup-verification.md`](ecowatch-cleanup-verification.md)

#### Phase A: Backend — Quality Gate & Enforcement Engine

##### A.1 — Quality & Anti-Cover Check Module (`backend/cleanup_verifier.py`)
- [x] Install `opencv-python-headless` and `imagehash` dependencies
- [x] Create `backend/cleanup_verifier.py` module
- [x] Implement `quality_check()` — brightness, blur (Laplacian), contrast, entropy, resolution
- [x] Implement `compute_phash()` — perceptual hash via `imagehash`
- [x] Implement pHash duplicate detection (against before photo + past submissions)
- [x] Tune quality thresholds on real phone photos (avoid false rejects on honest photos)

##### A.2 — Same-Location Verification (SIFT + RANSAC)
- [x] Implement `match_locations()` — SIFT features with Mask R-CNN garbage mask exclusion
- [x] Implement Lowe's ratio test (0.75) + RANSAC homography
- [x] Implement inlier scoring with decision thresholds (≥40 pass, 15-39 borderline, <15 reject)
- [x] Handle edge case: low-feature scenes (plain walls, fields) → REVIEW not auto-reject

##### A.3 — Mask R-CNN Before/After Comparison
- [x] Implement `remaining_ratio()` — warp before mask via homography, compare areas
- [x] Integrate with existing Mask R-CNN inference in `_bg_verify_complete()`
- [x] Implement remaining ratio thresholds (<0.10 pass, 0.10-0.30 review, >0.30 reject)

##### A.4 — Decision Engine & VLM Enforcement
- [x] Implement `cleanup_decision()` — full cascade logic combining all phase results
- [x] Enforce stricter thresholds when `guide_used = false`
- [x] Ensure VLM result is enforced (already partially done — verify `needs_redo` flow)
- [x] Add `cleanup_retake` status for quality failures (let cleaner retry immediately)

##### A.5 — Database Schema Additions
- [x] Add `cleanup_verification_result` (JSON) column — full pipeline scores
- [x] Add `cleanup_guide_used` (Boolean) column
- [x] Add `cleanup_gps_distance_m` (Float) column
- [x] Add `cleanup_session_id` (String) column
- [x] Add `cleanup_phash` (String) column
- [x] Add auto-migration DDL for new columns

##### A.6 — API Endpoints
- [x] `POST /cleanup/session` — issue capture session token (15-min expiry)
- [x] Update `PUT /work-orders/{id}/complete` — accept session metadata + run full pipeline
- [x] `GET /reports/pending-review` / `STATUS_OPTIONS` — CENRO/Barangay pending cleanup reviews
- [x] `PUT /work-orders/{id}/force-resolve` & `/report/{id}/force-close` — CENRO/Barangay approve/override
- [x] Cleaner fraud tracking signals stored in `cleanup_verification_result`
- [x] Random-sampled or borderline auto-routing to REVIEW

##### A.7 — Testing (Phase A)
- [x] Create `backend/test_cleanup_verification.py`
- [x] Test quality_check: covered lens, dark, blurry, flat color, low-res → REJECT
- [x] Test quality_check: normal phone photos, night photos → PASS (no false rejects)
- [x] Test pHash: same photo flagged, different angle not flagged
- [x] Test match_locations: same spot → high inliers, different street → low inliers
- [x] Test remaining_ratio: garbage present → high ratio, clean → low ratio
- [x] Test cleanup_decision: all-pass, quality-fail, location-fail, garbage-remains, borderline-vlm
- [x] Test full pipeline: honest cleanup → PASS, fake cleanup → REJECT
- [x] All tests pass with `python test_cleanup_verification.py` and `test_cleanup_pipeline.py`

---

#### Phase B: Frontend — Guided Camera Capture Component

##### B.1 — GuidedCameraCapture Component
- [x] Enhance `frontend/components/CleanerGeoCam.tsx` with multi-mode overlays
- [x] Implement live camera via `getUserMedia` (rear-facing, no file picker)
- [x] Add reference photo overlay (ghost mode at 30-50% opacity)
- [x] Add three overlay styles: Ghost, Edge outline, Corner thumbnail
- [x] Add opacity slider (15% to 75%)
- [x] Add guide toggle (ON/OFF) with warning when OFF
- [x] Add real-time GPS distance indicator from report location
- [x] Add large capture button with haptic feedback
- [x] Add full-screen preview after capture with Retake/Submit options
- [x] Modern glassmorphism dark camera UI theme
- [x] Responsive: works on mobile portrait/landscape, tablet, desktop
- [x] Touch targets ≥ 44px for all interactive elements

##### B.2 — Session Token Integration
- [x] Call `POST /cleanup/session` when cleaner opens capture flow
- [x] Pass session_id + expiry to CleanerGeoCam
- [x] Single-use session validation on submit
- [x] On expired session → graceful 400 rejection + restart prompt

##### B.3 — Cleanup Submission Flow (Cleaner Portal)
- [x] Camera flow in `CleanerJobDrawer.tsx` with live overlay & preview
- [x] Send photo + session_id + GPS + guide_used to backend
- [x] Real-time verification status polling in `cleaner/page.tsx`
- [x] Handle `needs_redo` / retake with friendly reason toast
- [x] Handle `pending_review` / supervisor review notification
- [x] Handle `verified` completion notification & toast

##### B.4 — Testing (Phase B)
- [x] Camera opens with rear-facing camera on mobile
- [x] Ghost overlay visible and adjustable
- [x] GPS distance updates in real-time
- [x] Capture produces clear JPEG with metadata
- [x] Preview with Retake/Submit works
- [x] Session expiry handled gracefully
- [x] Camera permission denied → helpful error
- [x] Works on Chrome Android, Safari iOS, Chrome Desktop
- [x] Dark mode renders correctly
- [x] `npm run build` passes
- [x] `npm run lint` passes

---

#### Phase C: Backend — VLM Enforcement & Decision Engine

###### C.1 — Pipeline Integration
- [x] Wire quality gate into `_bg_verify_complete()` as first check
- [x] Wire SIFT location matching after quality passes
- [x] Wire remaining ratio calculation after SIFT
- [x] Apply VLM only for borderline cases (save API quota)
- [x] Store full pipeline result in `cleanup_verification_result` JSON column

##### C.2 — Random Audit Sampling
- [ ] Implement 5-10% random sampling of auto-PASS cleanups
- [ ] Auto-sampled items marked as `cleanup_audit` (separate from `cleanup_verified`)
- [ ] Add to CENRO audit queue
- [ ] Configurable audit rate via `system_config` table

##### C.3 — Per-Cleaner Fraud Signals
- [ ] Track reject_rate, retake_rate, guide_off_rate per cleaner
- [ ] Track review_rate, audit_fail_rate, avg_gps_distance_m
- [ ] Expose via `GET /cleanup/cleaner-signals/{user_id}`
- [ ] Increase audit rate for cleaners with high reject/guide-off rates

##### C.4 — Testing (Phase C)
- [x] Test session token validation (valid, expired, wrong report)
- [x] Test GPS proximity check (within/beyond threshold)
- [x] Test full pipeline integration (honest cleanup → resolved, fake → rejected)
- [ ] Test random audit sampling fires at configured rate
- [x] Test enforcement: rejected cleanup does NOT resolve report
- [x] Test VLM failure fallback → REVIEW (never auto-PASS)

---

#### Phase D: Frontend — CENRO Cleanup Review Queue & Cleaner Signals

##### D.1 — Cleanup Review Queue (CENRO Portal)
- [x] Add Cleanup Verification inspection in CENRO & Barangay drawer (`ReportDetailDrawer.tsx`)
- [x] Display before/after photos with interactive BeforeAfterCompare slider
- [x] Show all phase scores with pass/fail/borderline indicators in `CleanupVerificationCard.tsx`
- [x] Show metadata: GPS distance, guide toggle, SIFT landmark inlier count, volume left
- [x] Actions: Force Approve Resolution, Request Cleaner Retake (with reasons)
- [x] Filters: `pending_review` added to `OversightTab.tsx` status filter
- [x] Badge notification in drawer header

##### D.2 — Before/After Comparison Widget
- [x] Create `BeforeAfterCompare.tsx` — drag-to-reveal slider
- [x] Support side-by-side mode and crossfade overlay mode
- [x] Show Before (Reported Waste) and After (Cleanup Proof) badges
- [x] Mobile touch gestures and mouse pointer capture support
- [x] Responsive across breakpoints (mobile, tablet, desktop)
- [x] Integrated into both Admin Drawer and Public Citizen Track page

##### D.3 — Cleaner Performance Dashboard (Barangay Portal)
- [ ] Show cleanup success rate (progress ring)
- [ ] Show reject/retake rate chart
- [ ] Show guide-OFF rate warning indicator
- [ ] Show audit results history

##### D.4 — Testing (Phase D)
- [x] Review drawer loads with pending cleanup items
- [x] Before/after slider works on desktop and mobile
- [x] Phase scores display with correct color coding
- [x] Approve/Reject/Retake actions work correctly
- [ ] Cleaner signals dashboard shows accurate metrics
- [x] Filters work correctly
- [x] Dark mode renders correctly
- [x] `npm run build` passes
- [x] `npm run lint` passes

---

#### Phase E: Security, Privacy & Edge Cases

##### E.1 — Privacy & RA 10173 Compliance
- [ ] Update Privacy Policy to disclose multi-phase AI cleanup verification
- [ ] Add consent notice in cleaner portal for AI analysis
- [ ] Verify EXIF stripped from cleanup photos before external API calls
- [ ] Verify GPS data never sent to Gemini API

##### E.2 — Rate Limiting & Abuse Protection
- [ ] Rate limit `POST /cleanup/submit` (10/min per user)
- [ ] Rate limit `POST /cleanup/session` (5/min per user)
- [ ] Max retakes per report: 5 (with CENRO alert at 3+)
- [ ] Session tokens single-use (not reusable after submission)

##### E.3 — Edge Case Handling
- [ ] Low-feature scenes (plain walls) → REVIEW, not reject
- [ ] Mask R-CNN unavailable → skip Phase 4, route to REVIEW
- [ ] VLM API down → skip Phase 5, route to REVIEW (never auto-PASS)
- [ ] Night cleanup (dark but visible) → relaxed brightness threshold if entropy OK
- [ ] No GPS on device → allow submission but auto-route to REVIEW
- [ ] No camera API (`getUserMedia` unsupported) → fallback to file picker + auto-REVIEW

##### E.4 — Testing (Phase E)
- [ ] Test session token not reusable
- [ ] Test rate limits on cleanup endpoints
- [ ] Test max retakes enforced
- [ ] Test EXIF stripping verified
- [ ] Test GPS not sent to Gemini
- [ ] Test edge case fallbacks work correctly

---

#### Phase F: Monitoring, Analytics & Polish

##### F.1 — Cleanup Analytics (CENRO Command Center)
- [ ] Add cleanup verification rate metric
- [ ] Add phase rejection breakdown (pie chart)
- [ ] Add average verification time metric
- [ ] Add VLM trigger rate metric
- [ ] Add audit results (pass/fail rate)
- [ ] Add cleaner leaderboard by verification success rate

##### F.2 — Cleanup Status in Tracking Page
- [ ] Show "Cleanup submitted — verifying..." during pipeline
- [ ] Show "Cleanup verified ✅" on pass
- [ ] Show "Cleanup under review 🔍" on review
- [ ] Show rejection reason on cleanup_rejected

##### F.3 — Notifications
- [ ] Notify cleaner on cleanup_rejected with reason + retake prompt
- [ ] Notify barangay admin on cleanup_review items
- [ ] Notify CENRO on audit queue items
- [ ] Notify citizen when report transitions to resolved

##### F.4 — Final Integration Testing
- [ ] E2E: Happy path → Report → Deploy → Guided capture → All pass → Resolved
- [ ] E2E: Covered camera → Phase 2 reject → Retake → Real photo → Pass
- [ ] E2E: Wrong location → Phase 3 reject → GPS warning
- [ ] E2E: Partial cleanup → Phase 4 → REVIEW → CENRO approves
- [ ] E2E: Borderline → VLM confirms → PASS
- [ ] E2E: VLM down → Fallback → REVIEW
- [ ] E2E: Session expired → Must restart capture
- [ ] E2E: Guide OFF → Stricter thresholds → REVIEW
- [ ] `npm run build` passes with zero errors
- [ ] `npm run lint` passes with zero errors
- [ ] Backend test scripts pass

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
- [ ] Update `backend/.env.example` — add: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `FRONTEND_URL`, `GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GOOGLE_GEMINI_API_KEY`
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
| 2026-10-14 | HF Backend Deployed | Synced latest backend (2-layer verification, /reports/pending-review, psycopg) to Hugging Face space |
| 2026-10-16 | 3-Layer VLM Verification planned | Added Gemini Flash VLM as Layer 1 pre-filter (MC-004). Branch: `feat/3-layer-verification-vlm`. API key configured and verified. |
| 2026-10-18 | Cleanup Verification Pipeline planned | MC-005: 6-Phase anti-fraud cleanup proofing. Branch: `feat/cleanup-verification-pipeline`. Existing VLM cleanup verification enhanced with quality gate, SIFT location matching, guided capture, CENRO audit queue. |

---

*Update this file as tasks are completed. Mark `[/]` for in-progress, `[x]` for done.*
