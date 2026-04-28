# Changelog

All notable changes to the EcoWatch SJDM project will be documented in this file.

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
