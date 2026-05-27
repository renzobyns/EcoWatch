# EcoWatch SJDM — Frontend

Next.js 16 / React 19 / TypeScript / Tailwind CSS v4 frontend for the EcoWatch environmental reporting system.

See the [root README](../README.md) for the full project overview, architecture, and cold-start guide.

## Quick Start

```powershell
# 1. Create frontend/.env.local (required)
# NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
# GOOGLE_GEMINI_API_KEY=...
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...

npm install
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

The backend must be running on port 8000 before the frontend will work. See [backend setup](../README.md#3-backend-setup).

## Routes

| Path | Role | Description |
|---|---|---|
| `/` | Public | Landing page + citizen entry |
| `/report` | Public | Citizen report submission form |
| `/track/[slug]` | Public | Report tracking page |
| `/login` `/signup` | Public | Auth screens |
| `/barangay` | barangay | Barangay admin portal |
| `/cenro` | cenro | CENRO city-wide dashboard |
| `/cleaner` | cleaner | Cleanup team portal |

## Key Components

| Component | Description |
|---|---|
| `components/MapComponent.tsx` | Leaflet map with barangay polygons, pins, heatmap overlay |
| `components/NotificationDropdown.tsx` | Role-agnostic notification bell + dropdown |
| `components/PortalTopbar.tsx` | Shared top bar across all portals |
| `components/TrustBadge.tsx` | Per-report trust score badge |
| `components/QRCodeModal.tsx` | QR code generator modal |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Backend base URL (e.g. `http://127.0.0.1:8000`) |
| `GOOGLE_GEMINI_API_KEY` | Yes | Gemini API key for AI features |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
