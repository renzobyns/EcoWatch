# EcoWatch SJDM — ERD & Data Flow Diagrams

---

## 1. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    USERS {
        int id PK "Auto-increment"
        string email UK "Unique, NOT NULL"
        string password_hash "NOT NULL (bcrypt)"
        string full_name "NOT NULL"
        string role "citizen | barangay | cenro"
        string barangay_assignment "Nullable (barangay role only)"
        datetime created_at "Default: utcnow"
    }

    REPORTS {
        int id PK "Auto-increment"
        float lat "NOT NULL"
        float lon "NOT NULL"
        string barangay "Nullable, Indexed (Ray-Cast computed)"
        int reporter_id FK "Nullable (null if anonymous)"
        string image_url "Nullable (local file path)"
        string cleanup_image_url "Nullable (cleanup photo path)"
        float ai_confidence "Nullable (0.0 to 1.0)"
        string status "Default: pending"
        text notes "Nullable (citizen notes)"
        string tracking_id UK "Unique (e.g. EW-0042)"
        string tracking_url UK "Unique (e.g. /track/abc123)"
        datetime created_at "Default: utcnow"
        datetime deployed_at "Nullable"
        datetime resolved_at "Nullable"
    }

    BARANGAY_BOUNDARIES {
        string ADM4_EN PK "Barangay name"
        string ADM4_PCODE "Philippine Standard Geographic Code"
        geometry polygon "GeoJSON MultiPolygon"
    }

    USERS ||--o{ REPORTS : "submits (optional)"
    BARANGAY_BOUNDARIES ||--o{ REPORTS : "assigned via Ray-Casting"
    USERS }o--|| BARANGAY_BOUNDARIES : "manages (barangay role)"
```

### Relationship Descriptions

| Relationship | Type | Description |
|:-------------|:-----|:------------|
| `USERS → REPORTS` | One-to-Many (optional) | A user can submit many reports. Anonymous reports have `reporter_id = NULL`. |
| `BARANGAY_BOUNDARIES → REPORTS` | One-to-Many | Each report is assigned to one barangay via Ray-Casting algorithm. |
| `USERS → BARANGAY_BOUNDARIES` | Many-to-One (optional) | A barangay admin is assigned to manage one specific barangay via `barangay_assignment`. |

### Entity Summary

| Entity | Storage | Record Count |
|:-------|:--------|:-------------|
| `USERS` | SQLite (`ecowatch.db`) | Grows with signups |
| `REPORTS` | SQLite (`ecowatch.db`) | Grows with submissions |
| `BARANGAY_BOUNDARIES` | GeoJSON file (`data/sjdm_barangays.geojson`) | Fixed — 59 barangays in SJDM |

---

## 2. Data Flow Diagram (DFD)

### Level 0 — Context Diagram

```mermaid
graph LR
    CITIZEN["👤 Citizen<br/>(Anonymous or Logged In)"]
    BARANGAY["🏘️ Barangay Admin"]
    CENRO["🏛️ CENRO Official"]

    SYSTEM["⚙️ EcoWatch<br/>System"]

    CITIZEN -->|"Report (photo + GPS + notes)"| SYSTEM
    CITIZEN -->|"Login / Signup"| SYSTEM
    SYSTEM -->|"Tracking ID + URL"| CITIZEN
    SYSTEM -->|"Report status updates"| CITIZEN
    SYSTEM -->|"Map + pins + heatmap"| CITIZEN

    SYSTEM -->|"Jurisdictional reports"| BARANGAY
    BARANGAY -->|"Deploy action"| SYSTEM
    BARANGAY -->|"Cleanup photo"| SYSTEM

    SYSTEM -->|"City-wide analytics"| CENRO
    SYSTEM -->|"Barangay rankings"| CENRO
    CENRO -->|"Override / reassign"| SYSTEM
    CENRO -->|"Force-close report"| SYSTEM

    style SYSTEM fill:#065f46,stroke:#10b981,color:#ecfdf5,stroke-width:3px
    style CITIZEN fill:#1a2e1a,stroke:#10b981,color:#ecfdf5
    style BARANGAY fill:#1a2a1e,stroke:#f59e0b,color:#ecfdf5
    style CENRO fill:#1a1e2e,stroke:#3b82f6,color:#ecfdf5
```

### Level 1 — System Decomposition

```mermaid
graph TD
    subgraph EXTERNAL["External Entities"]
        CITIZEN["👤 Citizen"]
        BRGAY_ADMIN["🏘️ Barangay Admin"]
        CENRO_ADMIN["🏛️ CENRO Official"]
    end

    subgraph PROCESSES["EcoWatch Processes"]
        P1["1.0<br/>Report<br/>Submission"]
        P2["2.0<br/>AI Image<br/>Verification"]
        P3["3.0<br/>Spatial<br/>Routing"]
        P4["4.0<br/>Report<br/>Management"]
        P5["5.0<br/>Analytics<br/>Engine"]
        P6["6.0<br/>Authentication"]
    end

    subgraph DATASTORES["Data Stores"]
        D1[("D1: Reports<br/>(SQLite)")]
        D2[("D2: Users<br/>(SQLite)")]
        D3[("D3: Barangay<br/>Boundaries<br/>(GeoJSON)")]
        D4[("D4: Uploaded<br/>Images<br/>(Local Files)")]
    end

    %% Citizen flows
    CITIZEN -->|"Photo + GPS + Notes"| P1
    CITIZEN -->|"Email + Password"| P6
    P1 -->|"Tracking ID + URL"| CITIZEN

    %% Report submission pipeline
    P1 -->|"Image bytes"| P2
    P2 -->|"Confidence score + verified/rejected"| P1
    P1 -->|"GPS coordinates"| P3
    P3 -->|"Barangay name"| P1
    P1 -->|"Complete report"| D1
    P1 -->|"Photo file"| D4
    P3 -->|"Read polygons"| D3

    %% Auth
    P6 -->|"Read/Write user"| D2

    %% Barangay flows
    D1 -->|"Jurisdictional reports"| P4
    P4 -->|"Report queue"| BRGAY_ADMIN
    BRGAY_ADMIN -->|"Deploy / Cleanup photo"| P4
    P4 -->|"Status update"| D1
    P4 -->|"Cleanup photo"| P2
    P4 -->|"Cleanup image"| D4

    %% CENRO flows
    D1 -->|"All reports"| P5
    P5 -->|"DBSCAN clusters + rankings"| CENRO_ADMIN
    CENRO_ADMIN -->|"Override / Force-close"| P4

    style P1 fill:#065f46,stroke:#10b981,color:#ecfdf5
    style P2 fill:#065f46,stroke:#10b981,color:#ecfdf5
    style P3 fill:#065f46,stroke:#10b981,color:#ecfdf5
    style P4 fill:#065f46,stroke:#10b981,color:#ecfdf5
    style P5 fill:#065f46,stroke:#10b981,color:#ecfdf5
    style P6 fill:#065f46,stroke:#10b981,color:#ecfdf5
```

### Process Descriptions

| Process | Name | Input | Output | Description |
|:--------|:-----|:------|:-------|:------------|
| 1.0 | Report Submission | Photo, GPS, Notes | Tracking ID, URL | Citizen uploads photo + GPS. System orchestrates AI verification and spatial routing, then saves complete report. |
| 2.0 | AI Image Verification | Image bytes | Confidence score, Verified/Rejected | Mask R-CNN analyzes the photo for illegal waste. Returns confidence score (0.0–1.0). `[MOCK for now]` |
| 3.0 | Spatial Routing | Latitude, Longitude | Barangay name | Ray-Casting (Point-in-Polygon) algorithm checks GPS coords against 59 barangay polygons to determine jurisdiction. |
| 4.0 | Report Management | Status changes, Cleanup photos | Updated report | Barangay deploys sweepers, uploads cleanup photo. CENRO overrides/reassigns. AI re-verifies cleanup photos. |
| 5.0 | Analytics Engine | All reports | DBSCAN clusters, Rankings | Runs DBSCAN clustering on report coordinates to detect hotspots. Calculates barangay resolution rates for compliance ranking. |
| 6.0 | Authentication | Email, Password | User session, Role | Local auth via SQLite `users` table. Returns user role for route-based access control. |

### Data Store Descriptions

| Store | Name | Format | Description |
|:------|:-----|:-------|:------------|
| D1 | Reports | SQLite table | All submitted reports with status, coordinates, AI results, timestamps |
| D2 | Users | SQLite table | User accounts with email, hashed password, role, barangay assignment |
| D3 | Barangay Boundaries | GeoJSON file | 59 barangay polygon geometries for SJDM — used by Ray-Casting |
| D4 | Uploaded Images | Local file system | Report photos and cleanup verification photos stored in `backend/uploads/` |

---

## 3. Report Data Flow (End-to-End)

This shows the complete journey of a single report through the system:

```
CITIZEN                     SYSTEM                          DATA STORES
───────                     ──────                          ───────────

1. Takes photo          ──▶ Receives photo + GPS
   + GPS captured           │
                            ▼
                        2. AI Verification (P2)
                           Mask R-CNN analyzes
                            │
                       ┌────┴────┐
                       ▼         ▼
                   VERIFIED   REJECTED ──▶ Saved to D1
                       │                   status="rejected"
                       ▼                   (DEAD END)
                    3. Spatial Routing (P3)
                       Ray-Cast GPS against
                       D3 (GeoJSON polygons)
                            │
                            ▼
                       Barangay identified
                            │
                            ▼
                    4. Report saved ─────────▶ D1 (Reports table)
                       status="verified"       D4 (Photo file)
                            │
◀── Tracking ID + URL ─────┘

────────── CITIZEN DONE, BARANGAY TAKES OVER ──────────

BARANGAY ADMIN              SYSTEM                          DATA STORES
──────────────              ──────                          ───────────

5. Sees report in      ◀── Fetches from D1 where
   their queue              barangay = their assignment
        │
        ▼
6. Clicks [Deploy]     ──▶ Status → "deployed" ──────────▶ D1 updated
                            deployed_at = now()
        │
        ▼
7. Cleans the site
   Takes "after" photo
        │
        ▼
8. Uploads cleanup     ──▶ AI re-verifies (P2) ──────────▶ D4 (cleanup photo)
   photo                    │
                       ┌────┴────┐
                       ▼         ▼
                   RESOLVED   FAILED_CLEANUP
                       │         │
                       ▼         ▼
                   D1 updated  D1 updated
                   status=     status=
                   "resolved"  "failed_cleanup"
                   resolved_at (retry needed)
                   = now()

────────── CENRO MONITORS EVERYTHING ──────────

CENRO OFFICIAL              SYSTEM                          DATA STORES
──────────────              ──────                          ───────────

9. Views dashboard     ◀── Analytics Engine (P5)
   - City map               DBSCAN on D1 → hotspots
   - Hotspots                Resolution rates → rankings
   - Rankings
   - Charts

10. Override actions:
    - Reassign report  ──▶ D1: barangay = new_value
    - Force-close      ──▶ D1: status = "resolved"
```
