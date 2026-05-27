# Changelog

All notable changes to the EcoWatch SJDM project will be documented in this file.

## [Phase 7: Defense Sprint] - 2026-05-16 → 2026-05-26

> The 10-day sprint that turned the working happy path into a defense-ready, role-aware product. See [`DEFENSE_PLAN.md`](DEFENSE_PLAN.md) for the day-by-day plan.

### Added
- **Role-Based Access Control (RBAC)**: `require_role()` FastAPI dependency reading `X-User-Id` header on every privileged endpoint (deploy / resolve / reassign / force-close / user mgmt).
  - *Reason*: Anyone with the URL could hit admin endpoints — first thing a security-minded panelist would probe.
- **AuditLog model + auto-write**: Every override action records `user_id`, `action`, `target_type`, `target_id`, `details`, `created_at`.
  - *Reason*: Without an audit trail, "force-close" is indefensible for any compliance-aware reviewer.
- **WorkOrder + Cleaner role**: Full cleanup-team lifecycle (assign → start → complete → resolve) with SLA deadlines and priorities.
  - *Reason*: Barangays need to dispatch real teams, not just flip a status.
- **Notifications**: Per-user inbox (`Notification` table), unread bell in `PortalTopbar`, role-agnostic `NotificationDropdown` shared across all portals, polling hook with generic event payload.
  - *Reason*: Real LGU workflows need push to the assignee, not silent status changes.
- **SystemConfig**: CENRO-configurable SLA thresholds (Low/Medium/High days) persisted to DB.
- **Filtering + CSV exports**: `status`, `search`, `date_from`, `limit`, `offset` query params on all report endpoints; CSV exports for barangay queue, CENRO analytics, SLA reports, user management.
- **SLA breach surfacing**: `GET /reports/sla-breaches?days=N` endpoint + Command Center widget + per-row SLA badge (green ≤2d, yellow 3–4d, red ≥5d).
- **User management UI**: CENRO can create / disable / reactivate barangay and cleaner accounts, with CSV import/export.
- **Trust score layer**: EXIF / GPS / software-tag signals scored per upload; LOW-trust uploads flagged for human review without hard-rejecting (handles WhatsApp EXIF-stripping case).
- **Image validation**: 10 MB cap + JPEG/PNG MIME enforcement at the upload helper.
- **Mask R-CNN model live**: Custom-trained `mask_rcnn_garbage.h5` (ResNet-101 backbone, 15 epochs, 0.43 val loss) replaces the mock for production; mock retained as dev fallback.
- **Offline mode**: `OFFLINE_MODE` env flag swaps CartoDB CDN to local `backend/tiles/` — full demo without internet for OLFU Wi-Fi failure scenario.
- **Cleaner UTC timestamp + SLA pill fix**: Job drawer timestamps render in local time; SLA pill consistent with barangay portal.

### Fixed
- **Duplicate "Graceville"** entry removed from CENRO `BARANGAYS` array.
- **Silent `catch(e) {}`** in `Navbar.tsx` localStorage parse — now logs and clears corrupt state.
- **`print()` → `logging`** in `ai_verifier.py` for production-grade observability.

### Documentation
- Added [`FEATURES.md`](FEATURES.md), [`MODEL_TRAINING.md`](MODEL_TRAINING.md), [`DEFENSE_PLAN.md`](DEFENSE_PLAN.md), [`TESTING_CHECKLIST.md`](TESTING_CHECKLIST.md), [`REDESIGN_SPEC.md`](REDESIGN_SPEC.md), [`IMPROVEMENTS.md`](IMPROVEMENTS.md).
- Updated [`README.md`](README.md) with Cold Start TL;DR (prerequisites + real clone URL + venv setup).
- Rewrote [`frontend/README.md`](frontend/README.md) with EcoWatch-specific content.

## [Phase 6: Final Polish & Optimization] - 2026-04-29

### Added
- **Dynamic Loading States**: Implemented high-aesthetic pulsating logo skeleton screens for all portal transitions.
  - *Reason*: To improve UX by providing visual feedback during data fetching and auth checks.
- **Empty State Illustrations**: Added descriptive "No reports found" messages for all table views.
  - *Reason*: To prevent UI confusion when no data is available in specific filters.
- **Unified Branding**: Enforced Emerald/Primary color palette across all dashboards and navbar links.
  - *Reason*: To maintain professional "Eco-Government" brand consistency.

### Fixed
- **Chart Layouts**: Adjusted Pie and Line chart radius and margins to prevent clipping on small screens.
- **Scrollbar Clipping**: Implemented `scrollbar-hide` utility to clean up the dashboard layout while maintaining functionality.

## [Phase 5: CENRO Dashboard] - 2026-04-28

### Added
- **Command Center Dashboard**: Dense analytical hub with city-wide KPIs and Recharts visualization.
  - *Reason*: For strategic oversight of city-wide environmental status.
- **DBSCAN Hotspot Intelligence**: Dynamic list of high-density report clusters calculated in the backend.
  - *Reason*: To allow CENRO to prioritize resources for major dumping zones.
- **Barangay Performance Leaderboard**: Ranking system based on resolution rates and active caseload.
  - *Reason*: To hold barangay officials accountable for their jurisdiction.
- **Administrative Overrides**: Ability for CENRO to reassign reports or force-close tickets bypassing AI.
  - *Reason*: To handle edge cases or incorrect jurisdictional assignments.

## [Phase 4: Barangay Portal] - 2026-04-20

### Added
- **Jurisdictional Management**: Secure portal for barangay officials showing only reports in their area.
  - *Reason*: To decentralize task management and empower local officials.
- **Cleanup Verification Workflow**: Photo upload system with AI re-verification for resolving reports.
  - *Reason*: To ensure waste is actually removed before a ticket is closed.
- **Split-Screen Layout**: 60/40 design combining a detailed report queue with a jurisdictional map.
  - *Reason*: For efficient task management and spatial orientation for field teams.

## [Phase 3: Database & Authentication] - 2026-03-08

### Added
- **Supabase Integration**: Connected to cloud PostgreSQL database (ecowatch-sjdm) with PostGIS support.
  - *Reason*: To store reports, user accounts, and enable Role-Based Access Control (RBAC).
- **Database Schema**: Created `profiles` and `reports` tables with RLS policies and auto-profile trigger.
  - *Reason*: To enforce security — citizens can't edit reports, only Barangay/CENRO admins can.
- **Login Page** (`/login`): Email + password authentication with role-based redirect.
  - *Reason*: Citizen → Home, Barangay → Barangay Portal, CENRO → Dashboard.
- **Signup Page** (`/signup`): Public registration form with password confirmation.
  - *Reason*: All public sign-ups default to the `citizen` role for safety.
- **Supabase Client Utility** (`lib/supabase.ts`): Browser-side connection helper.
  - *Reason*: Centralized database access for all frontend components.

### Modified
- **Navbar**: "Log In" button now links to `/login` (was a dead button).
  - *Previous*: Static `<button>` with no action.
  - *Changes*: Replaced with `<Link href="/login">` on both desktop and mobile.
  - *Reason*: To allow users to actually navigate to the authentication pages.

## [Phase 2: Spatial Intelligence] - 2026-03-08

### Added
- **Ray-Casting Algorithm**: Implemented `spatial_utils.py` using Shapely for precise point-in-polygon calculations.
  - *Reason*: To eliminate manual reporting errors and auto-assign tasks to the correct Barangay.
- **Interactive CSJDM Map**: Integrated a high-aesthetic Leaflet map with San Jose del Monte barangay boundaries.
  - *Reason*: To allow citizens and CENRO to visually interact with the city's geography.
- **Location Validation API**: Created `/report/validate-location` endpoint in FastAPI and `/spatial/barangays` to serve GeoJSON data.
  - *Reason*: To allow the frontend to verify coordinates and visualize boundaries in real-time.

## [Phase 1: Foundation] - 2026-03-08

### Added
- **Project Structure**: Initialized `frontend`, `backend`, `data`, and `logs` directories.
  - *Reason*: To separate concerns according to the modern tech stack (Next.js/FastAPI).
- **Eco-Dark Theme**: Implemented a premium dark theme and global CSS variables.
  - *Reason*: To provide a professional, high-aesthetic UI for the capstone.
- **Navbar & Root Layout**: Created a responsive navigation bar and standardized the application shell.
  - *Previous*: Default "Create Next App" boilerplate.
  - *Changes*: Custom branding (EcoWatch SJDM), glassmorphism styling, and mobile-first responsiveness.
  - *Reason*: To establish navigation and consistent branding across all portals.
- **Landing Page**: Designed a high-aesthetic hero section with feature overview cards.
  - *Previous*: Default Next.js starter page.
  - *Changes*: Custom copy, gradients, and Lucide icons.
  - *Reason*: To explain the project's purpose (AI + Geospatial) to stakeholders.
- **SJDM GeoJSON Data**: Integrated official high-resolution barangay boundaries for San Jose del Monte.
  - *Reason*: To power the Ray-Casting algorithm for automatic report tagging.
- **FastAPI Core**: Set up the backend microservice with all mapping and AI libraries.
  - *Reason*: To prepare for complex spatial logic and Mask R-CNN processing.

### Modified
- **.gitignore**: Expanded to include professional Node.js and Python exclusions.
  - *Reason*: To keep the GitHub repository clean and secure.
- **README.md**: Updated with a complete project overview and setup instructions.
  - *Reason*: To provide clear documentation for collaborators and graders.
