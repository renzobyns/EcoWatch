# EcoWatch SJDM — System AI Instructions

> **Purpose**: This document is the single source of truth for any AI or developer working on EcoWatch. Read this ENTIRE document before writing any code. Every decision, pattern, and convention is documented here.

---

## 1. Project Identity

- **Project Name**: EcoWatch SJDM
- **Full Title**: EcoWatch — Intelligent Geolocation-Based Environmental Monitoring System
- **Location**: City of San Jose del Monte (SJDM), Bulacan, Philippines
- **Description**: A geospatial reporting and monitoring system that automates the detection, verification, and jurisdictional routing of illegal solid waste dumping near waterways using AI image analysis and spatial algorithms.
- **Target Users**:
  - **Citizens (Netizens)**: Report illegal dumping via QR code scan or direct website visit.
  - **Barangay Administrators**: Manage reports assigned to their jurisdiction, deploy sweepers, upload cleanup verification.
  - **CENRO Officials**: City Environment and Natural Resources Office — monitor city-wide analytics, heatmaps, and barangay compliance.
- **Problem Solved**: Eliminates manual delays and inaccurate location reporting in the illegal dumping complaint pipeline by automating verification (Mask R-CNN), spatial routing (Ray-Casting), and hotspot detection (DBSCAN).

---

## 2. Tech Stack

### Frontend
| Technology | Version | Purpose |
|:-----------|:--------|:--------|
| Next.js | 16.x | React framework with App Router |
| React | 19.x | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | v4 | Utility-first styling |
| Leaflet + React-Leaflet | 1.9.x / 5.x | Interactive maps |
| Lucide React | latest | Icon library |
| qrcode.react | 4.x | QR code generation |
| exifr | 7.x | Image EXIF metadata parsing |
| @google/generative-ai | latest | Gemini AI chat integration |
| @supabase/supabase-js | 2.x | Auth + Profiles database |

### Backend (Python Microservice)
| Technology | Version | Purpose |
|:-----------|:--------|:--------|
| Python | 3.12+ | Backend language |
| FastAPI | latest | REST API framework |
| Uvicorn | latest | ASGI server |
| SQLAlchemy | latest | ORM for local database |
| Shapely | latest | Ray-Casting / Point-in-Polygon spatial logic |
| GeoPandas | latest | GeoJSON data handling |
| Scikit-learn | latest | DBSCAN clustering algorithm |
| python-multipart | latest | File upload handling |

### Database
| Layer | Technology | Purpose |
|:------|:-----------|:--------|
| Local Backend DB | **SQLite** (`ecowatch.db`) | Stores reports, spatial assignments, status tracking |
| Auth & Profiles | **Supabase (PostgreSQL)** | User authentication, role management, profile data |
| Spatial Data | **GeoJSON file** (`data/sjdm_barangays.geojson`) | Barangay boundary polygons for Ray-Casting |

### AI / Machine Learning
| Component | Technology | Status |
|:----------|:-----------|:-------|
| Image Verification | **Mask R-CNN** (Instance Segmentation) | `[MOCK]` — Simulated with random confidence scores. Real TensorFlow/Keras model planned for production. |
| Spatial Clustering | **DBSCAN** (Scikit-learn) | `[ACTIVE]` — Fully functional density-based spatial clustering. |
| Spatial Routing | **Ray-Casting** (Shapely) | `[ACTIVE]` — Fully functional point-in-polygon barangay assignment. |
| AI Chat Assistant | **Google Gemini** (gemini-2.0-flash) | `[ACTIVE]` — EcoWatch Guide chatbot with fallback mock mode. |

### Hosting (Planned)
| Component | Platform |
|:----------|:---------|
| Frontend | Vercel |
| Backend | Render or Railway |

> **IMPORTANT**: Do NOT install Shadcn UI, Material UI, or any other component library. This project uses a **custom design system** (see Section 10). Do NOT attempt to migrate the database to PostgreSQL/PostGIS — the current SQLite + Shapely approach is intentional.

---

## 3. Folder Structure

```
EcoWatch/
├── frontend/                          # Next.js 16 Application
│   ├── app/                           # App Router (pages & API routes)
│   │   ├── api/
│   │   │   └── chat/
│   │   │       └── route.ts           # Gemini AI chat endpoint
│   │   ├── auth/
│   │   │   └── callback/
│   │   │       └── route.ts           # Supabase OAuth callback
│   │   ├── barangay/
│   │   │   └── page.tsx               # Barangay management portal
│   │   ├── cenro/
│   │   │   └── page.tsx               # CENRO command center dashboard
│   │   ├── login/
│   │   │   └── page.tsx               # Login page
│   │   ├── signup/
│   │   │   └── page.tsx               # Registration page
│   │   ├── profile/
│   │   │   └── page.tsx               # User profile page
│   │   ├── report/
│   │   │   └── page.tsx               # Citizen report submission
│   │   ├── welcome/
│   │   │   └── page.tsx               # Post-signup welcome
│   │   ├── globals.css                # Design system tokens & base styles
│   │   ├── layout.tsx                 # Root layout (Navbar + FloatingChat)
│   │   └── page.tsx                   # Landing page (public interactive map)
│   ├── components/
│   │   ├── FloatingChat.tsx           # AI chatbot widget (bottom-right)
│   │   ├── MapComponent.tsx           # Leaflet map wrapper (reusable)
│   │   └── Navbar.tsx                 # Global navigation bar
│   ├── lib/
│   │   └── supabase.ts               # Supabase client singleton
│   ├── public/
│   │   └── logo.png                   # EcoWatch logo
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── postcss.config.mjs
│   └── .env.local                     # Environment variables
│
├── backend/                           # Python FastAPI Microservice
│   ├── main.py                        # FastAPI app, all route handlers
│   ├── models.py                      # SQLAlchemy ORM models (Report, etc.)
│   ├── database.py                    # DB engine, session factory
│   ├── spatial_utils.py               # Ray-Casting point-in-polygon logic
│   ├── analytics.py                   # DBSCAN clustering for heatmaps
│   ├── ai_verifier.py                 # Mask R-CNN mock/simulator
│   ├── requirements.txt               # Python dependencies
│   ├── seed_test_data.py              # Test data seeder script
│   ├── test_analytics.py              # DBSCAN unit tests
│   └── venv/                          # Python virtual environment
│
├── data/
│   └── sjdm_barangays.geojson         # SJDM barangay boundary polygons
│
├── database/                          # (Reserved for migration scripts)
├── ecowatch.db                        # SQLite database file
├── instructions.md                    # THIS FILE — AI system blueprint
├── README.md                          # Project overview & setup guide
├── CHANGELOG.md                       # Version history
└── .gitignore
```

### Naming Conventions
| Context | Convention | Example |
|:--------|:-----------|:--------|
| TypeScript/JavaScript variables | `camelCase` | `reportStatus`, `fetchData` |
| React components | `PascalCase` | `MapComponent.tsx`, `FloatingChat.tsx` |
| Python files & variables | `snake_case` | `spatial_utils.py`, `get_barangay_from_coords` |
| CSS classes | `kebab-case` or descriptive | `.eco-gradient`, `.text-gradient` |
| API routes (backend) | `snake_case` with `/` paths | `/report/submit`, `/spatial/heatmaps` |
| Git branches | `type/description` | `feat/landing-page`, `fix/map-rendering` |

---

## 4. Database Schema

### 4.1 Local SQLite — `ecowatch.db` (Backend)

#### `reports` Table
| Column | Type | Constraints | Description |
|:-------|:-----|:------------|:------------|
| `id` | Integer | PK, Auto-increment | Unique report identifier |
| `lat` | Float | NOT NULL | Latitude of the reported location |
| `lon` | Float | NOT NULL | Longitude of the reported location |
| `barangay` | String | Nullable, Indexed | Barangay name (computed by Ray-Casting) |
| `reporter_id` | String | Nullable | Supabase user ID (null if anonymous) |
| `image_url` | String | Nullable | Path to uploaded image on local file system |
| `cleanup_image_url` | String | Nullable | Path to cleanup verification photo |
| `ai_confidence` | Float | Nullable | Mask R-CNN confidence score (0.0 to 1.0) |
| `status` | String | Default: `pending` | Report lifecycle status (see Section 5) |
| `notes` | Text | Nullable | Optional citizen notes about the report |
| `tracking_id` | String | Unique | Public tracking ID (e.g., `EW-0042`) for anonymous access |
| `tracking_url` | String | Unique | Full URL path for anonymous tracking (e.g., `/track/abc123`) |
| `created_at` | DateTime | Default: `utcnow` | When the report was submitted |
| `deployed_at` | DateTime | Nullable | When sweepers were dispatched |
| `resolved_at` | DateTime | Nullable | When cleanup was verified complete |

#### Report Status Enum
```python
class ReportStatus(str, Enum):
    PENDING = "pending"           # Just submitted, queued for AI
    VERIFIED = "verified"         # AI confirmed waste — ready for barangay
    REJECTED = "rejected"         # AI found no waste — dead end
    DEPLOYED = "deployed"         # Barangay dispatched sweepers
    RESOLVED = "resolved"         # Cleanup photo verified clean
    FAILED_CLEANUP = "failed_cleanup"  # Cleanup photo still shows waste
```

### 4.2 Supabase PostgreSQL (Auth & Profiles)

#### `profiles` Table (Supabase)
| Column | Type | Constraints | Description |
|:-------|:-----|:------------|:------------|
| `id` | UUID | PK, FK → `auth.users.id` | Supabase auth user ID |
| `full_name` | String | NOT NULL | Display name |
| `role` | String | NOT NULL | One of: `citizen`, `barangay`, `cenro` |
| `barangay_assignment` | String | Nullable | Which barangay this admin manages (only for `barangay` role) |
| `created_at` | DateTime | Default: `now()` | Account creation time |

> **Note for AI**: The `profiles` table is managed via Supabase Dashboard / SQL Editor, NOT through SQLAlchemy. The frontend queries it directly via `@supabase/supabase-js`.

---

## 5. System Flow & Report Lifecycle

### 5.1 Citizen Reporting Flow

Citizens can enter through **two paths**:

```
Path A: Physical QR Code                Path B: Direct Website Visit
─────────────────────────               ───────────────────────────
Citizen scans QR marker          OR     Citizen opens ecowatch.sjdm.com
       │                                        │
       ▼                                        ▼
  Web app opens at /report              Landing page (interactive map)
       │                                        │
       │                                  Clicks [Report a Violation]
       │                                        │
       ▼                                        ▼
  ┌─────────────────────────────────────────────────┐
  │            REPORT SUBMISSION FLOW                │
  │                                                  │
  │  1. Camera activates → citizen takes photo       │
  │  2. W3C Geolocation API captures GPS coords      │
  │  3. Photo + coords sent to backend               │
  │  4. Mask R-CNN verifies waste presence            │
  │  5. Ray-Casting assigns to correct barangay       │
  │  6. Report saved with status + tracking ID        │
  │  7. Citizen receives:                             │
  │     • Report ID (e.g., EW-0042)                   │
  │     • Tracking URL (/track/abc123)                │
  │     • Both are shareable                          │
  └─────────────────────────────────────────────────┘
```

> **Anonymous reporting is allowed.** Citizens do NOT need to log in to submit a report. If they are logged in, the `reporter_id` is saved. If anonymous, `reporter_id` is null but they still receive a tracking ID + URL.

### 5.2 Report Lifecycle (Status Flow)

```
  ┌────────────────── BEFORE ──────────────────┐
  │                                            │
  │  Citizen submits → AI instantly analyzes    │
  │       │                                    │
  │       ▼                                    │
  │   PENDING                                  │
  │       │                                    │
  │       ▼  (Mask R-CNN runs)                 │
  │  ┌────┴─────┐                              │
  │  ▼          ▼                              │
  │ VERIFIED  REJECTED                         │
  │  │        (dead end)                       │
  └──┼─────────────────────────────────────────┘
     │
  ┌──┼──── DURING ─────────────────────────────┐
  │  ▼                                         │
  │  Barangay clicks [Deploy]                   │
  │       │                                    │
  │       ▼                                    │
  │   DEPLOYED                                 │
  │   (sweepers sent)                          │
  └───┼────────────────────────────────────────┘
      │
  ┌───┼── AFTER ───────────────────────────────┐
  │   ▼                                        │
  │   Barangay uploads cleanup photo            │
  │        │                                   │
  │   AI re-verifies                           │
  │   ┌────┴─────┐                             │
  │   ▼          ▼                             │
  │ RESOLVED  FAILED_CLEANUP                   │
  │   ✅      (needs retry)                    │
  └────────────────────────────────────────────┘
```

### 5.3 Role-Based Login Routing

```
User logs in via /login
       │
       ▼
  Supabase Auth validates credentials
       │
       ▼
  Fetch role from profiles table
       │
       ├── role = "citizen"   → Stay on landing page (/) with username shown
       ├── role = "barangay"  → Redirect to /barangay
       └── role = "cenro"     → Redirect to /cenro
```

---

## 6. Role Hierarchy & Permissions

| Permission | Citizen | Barangay | CENRO |
|:-----------|:--------|:---------|:------|
| View landing page interactive map | ✅ | ✅ | ✅ |
| View all report pins on public map | ✅ | ✅ | ✅ |
| View heatmap overlay | ✅ | ✅ | ✅ |
| Submit a new report | ✅ (with or without login) | ✅ | ✅ |
| Track own report via tracking URL | ✅ | — | — |
| View reports in own barangay only | — | ✅ | — |
| Change report status to `deployed` | — | ✅ | ✅ |
| Upload cleanup photo | — | ✅ | — |
| View ALL reports across ALL barangays | — | — | ✅ |
| View DBSCAN hotspot clusters | — | — | ✅ |
| View barangay compliance rankings | — | — | ✅ |
| View analytics charts & trends | — | — | ✅ |
| Override / reassign report to different barangay | — | — | ✅ |
| Force-close / resolve a report directly | — | — | ✅ |
| Access `/barangay` portal | ❌ | ✅ | ✅ |
| Access `/cenro` dashboard | ❌ | ❌ | ✅ |

---

## 7. Page-by-Page Specification

### 7.1 Landing Page — `/` (PUBLIC)

**Inspiration**: Windy.com (interaction style) + NOAH (map-first hazard view)

**Layout**: Full-screen interactive map as the primary element.

| Element | Description |
|:--------|:------------|
| **Full-screen Leaflet map** | Covers the viewport. Shows SJDM barangay polygon boundaries (clickable), color-coded report pins (🔴 Pending, 🟡 Deployed, 🟢 Resolved), and DBSCAN heatmap density overlay. Zoom/pan enabled. |
| **Barangay click-to-zoom** | Clicking any barangay polygon on the map smoothly zooms into that area and filters to show only its reports. A "← Back to City View" button appears to zoom out. |
| **Pin popup** | Clicking a report pin shows a popup bubble with: photo thumbnail, status badge, barangay name, timestamp, and a link to the full tracking page (`/track/:id`). |
| **Collapsible side panel** | Slides in from the left or right. Contains a scrollable real-time feed of recent reports with status indicators. |
| **Top navigation bar** | EcoWatch logo, Report button, QR Code button, Login button. If logged in, show username + avatar. **No Barangay or CENRO links in public nav** — those are accessed via login routing only. |
| **Action buttons** | "Report" (opens /report), "QR Code" (generates a printable/saveable QR code linking to /report for physical display in barangays). |
| **Floating AI Chat** | Bottom-right chat bubble (EcoWatch Guide powered by Gemini). |

**Key Behaviors**:
- Map loads immediately with ALL public report pins and heatmap visible
- No login required to view the map
- Clicking a barangay polygon zooms into that jurisdiction
- Clicking a pin shows report details popup (photo, status, timestamp, barangay)
- Popup includes a "View Full Report →" link to `/track/:id`
- Logged-in citizens see their username in the navbar

### 7.2 Barangay Portal — `/barangay` (AUTHENTICATED, role: `barangay`)

**Layout**: Split-screen — task queue (left 60%) + jurisdictional map (right 40%).

| Element | Description |
|:--------|:------------|
| **Header** | Barangay name (from profile), jurisdiction badge, pending/deployed counters |
| **Tab bar** | `Pending Verification` / `Deployed` / `Resolved Cases` |
| **Task queue (left)** | Scrollable list of report cards. Each card shows: report photo thumbnail, title, timestamp, citizen info (or "Anonymous"), status badge, action button (Deploy / Upload Cleanup). |
| **Map (right)** | Leaflet map zoomed + locked to the barangay's polygon boundary. Shows only reports within their jurisdiction. Color-coded pins: 🔴 = Pending, 🟡 = Deployed, 🟢 = Resolved. |
| **Deploy action** | Simple status change to `deployed` (detailed sweeper assignment planned for later). |
| **Cleanup upload** | Button to upload "after" photo → AI re-verifies → marks `resolved` or `failed_cleanup`. |

### 7.3 CENRO Dashboard — `/cenro` (AUTHENTICATED, role: `cenro`)

**Layout**: Command center — to be built in TWO layout variants for comparison:

#### Variant A: Single-Page Command Center
| Element | Description |
|:--------|:------------|
| **Stats bar (top)** | Total reports, Active (pending+verified), Deployed, Resolved — at-a-glance KPI cards |
| **Map (left 70%)** | Full city-wide Leaflet map with all barangay polygons, all report pins, DBSCAN heatmap density overlay. Interactive zoom/pan. |
| **Barangay click-to-zoom** | Same as landing page — clicking any barangay polygon zooms in and filters its reports. "← Back to City View" to zoom out. |
| **Panels (right 30%)** | Stacked panels: DBSCAN Hotspots list, Barangay Compliance Ranking (sorted by resolution rate), Recent Activity live feed |
| **Charts (bottom)** | Reports Over Time (line chart), Status Breakdown (pie/donut chart) |
| **Admin actions** | Override/reassign a report to a different barangay. Force-close/resolve a report directly. Full searchable report table. |

#### Variant B: Tab-Based Dashboard
| Tab | Content |
|:----|:--------|
| **Overview** | Stats bar + summary cards + recent activity |
| **Map & Heatmaps** | Full-screen map with density overlays + barangay click-to-zoom |
| **Barangay Performance** | Ranking table, per-barangay stats, compliance scores |
| **All Reports** | Searchable, filterable table of every report + admin actions (override, reassign, force-close) |

> Both variants will be built. The user will decide which to keep after review.

### 7.4 Report Page — `/report` (PUBLIC)

**Layout**: Minimalist mobile-first camera upload interface.

| Element | Description |
|:--------|:------------|
| **GPS prompt** | W3C Geolocation API triggers immediately on page load |
| **Camera upload** | Large upload area — tap to open camera or select from gallery |
| **Notes field** | Optional text input for additional context |
| **Submit button** | Sends photo + GPS + notes to backend |
| **Result screen** | Shows AI verification result, assigned barangay, tracking ID, tracking URL, share button |

### 7.5 Login Page — `/login` (PUBLIC)

Standard email/password form via Supabase Auth. Post-login routing based on role (see Section 5.3).

### 7.6 Signup Page — `/signup` (PUBLIC)

Registration form. New users default to `citizen` role. Barangay and CENRO accounts are created by administrators.

### 7.7 Report Tracker — `/track/:id` (PUBLIC)

Shareable status page for any report. Accessible via tracking ID or URL slug.

| Element | Description |
|:--------|:------------|
| **Report ID** | Prominently displayed (e.g., `EW-0042`) |
| **Status timeline** | Visual progress bar: `Pending → Verified → Deployed → Resolved` with the current step highlighted |
| **Report photo** | Original submitted photo |
| **Location mini-map** | Small Leaflet map showing the pin location |
| **Barangay assigned** | Which barangay is responsible |
| **Timestamps** | When submitted, when deployed, when resolved |
| **Share button** | Copy tracking URL to clipboard |

---

## 8. API Endpoints (Backend → FastAPI)

### Existing Endpoints
| Method | Path | Auth | Description |
|:-------|:-----|:-----|:------------|
| `GET` | `/` | Public | Health check / welcome message |
| `GET` | `/health` | Public | Server health status |
| `POST` | `/report/validate-location` | Public | Validates if GPS coords are within SJDM, returns barangay name |
| `GET` | `/spatial/barangays` | Public | Returns full GeoJSON of SJDM barangay boundaries for map rendering |
| `POST` | `/report/submit` | Public | Full report submission: image upload → AI verify → Ray-Cast → save to DB |
| `GET` | `/reports/recent` | Public | Fetch all non-rejected reports for map display |
| `GET` | `/spatial/heatmaps` | Public | Runs DBSCAN on active reports, returns hotspot clusters |

### Planned Endpoints
| Method | Path | Auth | Description |
|:-------|:-----|:-----|:------------|
| `GET` | `/report/track/{tracking_id}` | Public | Get report status by tracking ID or URL slug |
| `PUT` | `/report/{id}/deploy` | Barangay | Change report status to `deployed` |
| `POST` | `/report/{id}/resolve` | Barangay | Upload cleanup photo, AI re-verifies, mark resolved or failed |
| `GET` | `/reports/barangay/{name}` | Barangay | Get all reports for a specific barangay |
| `GET` | `/analytics/overview` | CENRO | City-wide stats: totals, trends, per-barangay breakdown |
| `GET` | `/analytics/barangay-ranking` | CENRO | Barangay compliance ranking by resolution rate |
| `PUT` | `/report/{id}/reassign` | CENRO | Override: reassign a report to a different barangay |
| `PUT` | `/report/{id}/force-close` | CENRO | Override: force-close/resolve a report directly |

---

## 9. Error Handling Philosophy

### The 3-Layer Rule
Every interactive feature MUST implement three layers of error handling:

#### Layer 1: LOAD GUARD — Component fails to render
```
IF component/feature does not load:
  → Show a skeleton loader or error boundary
  → Provide a "Retry" button
  → NEVER show a blank screen

Examples:
  - Map doesn't load → "Map unavailable. Tap to retry."
  - Login form doesn't render → "Something went wrong. Refresh the page."
  - Chat widget fails → Hide gracefully, no crash
```

#### Layer 2: ACTION GUARD — User action fails
```
IF a user clicks/submits and the action fails:
  → Catch the error in a try/catch block
  → Show a user-friendly toast or inline error message
  → Log the real error to console for debugging
  → NEVER leave the user wondering what happened

Examples:
  - Button clicked, API returns 500 → "Something went wrong. Try again."
  - Image upload fails → "Upload failed. Check your connection."
  - Report submit fails → "Could not submit report. Your data is saved locally."
```

#### Layer 3: DATA GUARD — Expected data is missing or malformed
```
IF expected data is empty or missing:
  → Show an "empty state" UI (illustration + message)
  → NEVER show undefined/null values in the UI

Examples:
  - No reports yet → "No reports in this area yet. Be the first to report!"
  - No hotspots detected → "No major hotspots currently. System is monitoring."
  - Barangay has no assigned reports → "All clear in your jurisdiction! 🎉"
```

### API Error Responses
All backend endpoints must return consistent error format:
```json
{
  "success": false,
  "message": "Human-readable error description",
  "error_code": "SPECIFIC_ERROR_TYPE",
  "details": "Technical details for debugging (optional)"
}
```

### Offline Strategy (Future Enhancement)
When a citizen reports from an area with no internet:
1. Catch the fetch failure
2. Save GPS coordinates + image to device local storage
3. Show "Offline Save" toast notification
4. Auto-push data when connection is re-established

---

## 10. Design System

### Color Palette
```css
:root {
  --background: #0a0f0a;           /* Near-black green (page background) */
  --foreground: #ecfdf5;           /* Mint white (text) */
  --color-primary: #10b981;        /* Emerald 500 (primary actions) */
  --color-primary-dark: #065f46;   /* Emerald 900 (hover states) */
  --color-secondary: #34d399;      /* Emerald 300 (accents) */
  --color-accent: #fbbf24;         /* Amber 400 (warnings, highlights) */
  --color-danger: #ef4444;         /* Red 500 (errors, destructive) */
}
```

### Theme
- **Aesthetic**: Dark mode "Eco-Government" — professional, clean, modern
- **Background**: Near-black with subtle green tint (`#0a0f0a`)
- **Text**: Light mint white on dark backgrounds
- **Font**: `'Inter', system-ui, sans-serif` — clean and readable

### Component Patterns
| Class | Effect | Usage |
|:------|:-------|:------|
| `.glass` | Frosted glass card — semi-transparent with backdrop blur and subtle border | Cards, panels, modals |
| `.eco-gradient` | Emerald gradient background (`#10b981 → #059669 → #047857`) | Primary buttons, CTAs |
| `.text-gradient` | Emerald gradient text with transparent fill | Headings, brand text |

### Component Rules
| Rule | Description |
|:-----|:------------|
| **No component libraries** | Do NOT use Shadcn, Material UI, Chakra, or any external component library. Build all components with Tailwind + custom CSS. |
| **Glass cards everywhere** | Use `.glass` class for all card/panel containers. |
| **Gradient buttons** | Primary actions use `.eco-gradient`. Secondary actions use `.glass` with border. |
| **No blank screens** | Every loading state uses skeleton loaders. Every error state shows a message. Every empty state shows an illustration. |
| **Animations** | Use subtle `transition-all`, `hover:scale-105`, `animate-pulse` for loading. No heavy animations. |
| **Responsive** | Mobile-first. All layouts must work on 375px width minimum. |

---

## 11. Testing Plan

### AI Automated Testing
After implementing any feature, the AI must:
1. Run the development servers (frontend + backend) to verify no build errors.
2. Open the browser to visually verify the feature renders correctly.
3. Test the happy path (expected user flow works).
4. Test at least one error case (what happens when it breaks).
5. Document results.

### Manual Testing Checklist (For Human QA)
After each feature is built, generate a markdown checklist specific to that feature. Example format:

```markdown
## Manual Testing — [Feature Name]
- [ ] Open [page] on desktop (1920px) — verify layout
- [ ] Open [page] on mobile (375px) — verify responsive
- [ ] Test [happy path action] — verify expected result
- [ ] Test [error case] — verify error message appears
- [ ] Test with slow network (Chrome DevTools throttle) — verify loading states
- [ ] Test with no network — verify offline/error handling
```

### Per-Module Test Focus
| Module | What to Test |
|:-------|:-------------|
| Landing Page | Map loads with pins, heatmap renders, pins are clickable, side panel shows reports |
| Report Submission | Photo upload works, GPS capture works, AI verification response displays, tracking ID generated |
| Barangay Portal | Only own-jurisdiction reports shown, deploy action works, cleanup upload + AI re-verify works |
| CENRO Dashboard | All reports visible, DBSCAN clusters display, charts render, barangay ranking is accurate |
| Auth | Login routes to correct page per role, signup creates citizen, protected routes redirect |

---

## 12. Feature Blueprint Template

When adding any new feature, document it using this format:

```markdown
## Feature: [Name]
- **Trigger**: [What the user does — e.g., "Clicks Deploy button on a report card"]
- **Expected**: [What should happen — e.g., "Status changes to deployed, pin color changes to yellow, toast confirms"]
- **Error Case**: [Fallback — e.g., "If API fails, show error toast, status stays unchanged"]
- **Files Modified**: [List — e.g., "frontend/app/barangay/page.tsx, backend/main.py"]
- **Dependencies**: [What this needs — e.g., "Requires /report/{id}/deploy endpoint"]
```

---

## 13. Git & Branch Strategy

### Branch Naming
| Prefix | Purpose | Example |
|:-------|:--------|:--------|
| `feat/` | New feature | `feat/landing-interactive-map` |
| `fix/` | Bug fix | `fix/map-pin-rendering` |
| `chore/` | Maintenance, deps, config | `chore/update-dependencies` |
| `docs/` | Documentation only | `docs/update-instructions` |
| `testing/` | Experimental / testing branches | `testing/dbscan-tuning` |

### Commit Messages
- Must be descriptive and reference the specific feature/fix.
- Format: `type: short description` (e.g., `feat: add interactive landing page map`)

### Merge Policy
- Merges to `master`/`main` only after the feature passes both AI automated checks and the manual testing checklist.

---

## 14. Build Priority Order

| Priority | Module | Status |
|:---------|:-------|:-------|
| 🥇 1st | **Landing Page** — Full-screen interactive map with pins, heatmap, report feed | To Build |
| 🥈 2nd | **Barangay Portal** — Jurisdictional task management | To Build |
| 🥉 3rd | **CENRO Dashboard** — City-wide command center (both layout variants) | To Build |
| 4th | **Report Submission** — Mobile camera + GPS upload flow | Partially Built |
| 5th | **Auth Flow** — Login routing per role | Partially Built |
| 6th | **Citizen Features** — Profile, report tracking | Deferred |

---

## 15. Environment Setup

### Prerequisites
- Node.js v20 or later
- Python v3.12 or later
- Git

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### Backend Setup
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate    # Windows
pip install -r requirements.txt
uvicorn main:app --reload
# → http://127.0.0.1:8000
```

### Environment Variables (`frontend/.env.local`)
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>

# Backend API
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000

# Gemini AI
GOOGLE_GEMINI_API_KEY=<your-gemini-api-key>
```

### Image Storage (Testing)
Uploaded report images are saved to the **local backend file system** under `backend/uploads/`. This is for testing/prototype only. Production will use cloud storage (Supabase Storage or S3).
