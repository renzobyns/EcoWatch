# 🔑 EcoWatch — API Keys & Services Watchlist

> **Purpose**: Track every third-party service, its free tier limits, and billing risk.
> Check this file regularly so you never get surprise charges.
>
> **Last updated**: 2026-10-09

---

## 📋 Quick Summary

| Service | Free Tier Limit | Billing Risk | Dashboard |
|---------|----------------|--------------|-----------|
| **CARTO Basemaps** | 5M tiles/month | ⚠️ Medium — overage triggers contact | [dashboard.basemaps.carto.com/keys](https://dashboard.basemaps.carto.com/keys) |
| **Supabase** | 500 MB DB, 1 GB storage, 2 GB bandwidth | ⚠️ Medium — can pause project if exceeded | [supabase.com/dashboard](https://supabase.com/dashboard) |
| **Vercel** | 100 GB bandwidth, 100 hrs build/month | 🟢 Low — hobby plan has no billing | [vercel.com/dashboard](https://vercel.com/dashboard) |
| **Google Gemini API** | Depends on tier (free tier available) | ⚠️ Medium — pay-per-use if on paid plan | [aistudio.google.com](https://aistudio.google.com) |
| **Google OAuth** | Free (no limit) | 🟢 None | [console.cloud.google.com](https://console.cloud.google.com) |
| **Hugging Face** | Free for public repos & inference | 🟢 Low | [huggingface.co/settings](https://huggingface.co/settings) |
| **Resend (Email)** | 100 emails/day, 3,000/month | 🟢 Low — hard cap, won't charge | [resend.com/dashboard](https://resend.com/dashboard) |

---

## 🗺️ CARTO Basemaps

**What it does**: Provides the dark/light map tiles on every map page (Leaflet).

| Detail | Value |
|--------|-------|
| **Plan** | Free (non-commercial) |
| **Limit** | 5,000,000 tile requests / calendar month |
| **What happens if exceeded** | CARTO contacts you — no auto-charge |
| **Keys** | 2 active (see below) |
| **Dashboard** | [dashboard.basemaps.carto.com/keys](https://dashboard.basemaps.carto.com/keys) |
| **Attribution required** | Yes — © OpenStreetMap + © CARTO must stay visible |

### Your CARTO Keys

| Key Name | Restriction | Used Where | Stored In |
|----------|-------------|------------|-----------|
| Key 1 (Production) | `ecowatch-sjdm.vercel.app` only | Live Vercel site | Vercel env var: `NEXT_PUBLIC_CARTO_API_KEY` |
| Local Development | Unrestricted | localhost dev server | `frontend/.env.local`: `NEXT_PUBLIC_CARTO_API_KEY` |

### ⚠️ Watch out for
- If map usage spikes (e.g., many users zooming/panning), tile requests add up fast. Each map tile at each zoom level = 1 request.
- Monitor usage monthly at the dashboard.

---

## 🗄️ Supabase (Database & Auth)

**What it does**: PostgreSQL database for production. Stores all reports, users, work orders.

| Detail | Value |
|--------|-------|
| **Plan** | Free |
| **DB size limit** | 500 MB |
| **Storage limit** | 1 GB (for uploaded report images) |
| **Bandwidth** | 2 GB / month |
| **Pausing** | Free projects auto-pause after 1 week of inactivity |
| **Dashboard** | [supabase.com/dashboard](https://supabase.com/dashboard) |

### Your Supabase Keys

| Key | Env Var | Stored In |
|-----|---------|-----------|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` + Vercel |
| Anon Key (public) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` + Vercel |
| Database URL (server) | `DATABASE_URL` | Backend `.env` (commented out currently) |

### ⚠️ Watch out for
- **500 MB DB limit** — uploaded images should NOT be stored in the DB; use Supabase Storage or external hosting.
- **Auto-pause** — if you don't visit the project in 7 days, the database pauses and API calls fail until you manually unpause.
- **No auto-billing** — free tier won't charge you; it just stops working if you exceed limits.

---

## ▲ Vercel (Frontend Hosting)

**What it does**: Hosts and deploys the Next.js frontend from your GitHub repo.

| Detail | Value |
|--------|-------|
| **Plan** | Hobby (free) |
| **Bandwidth** | 100 GB / month |
| **Build minutes** | 100 hours / month |
| **Serverless functions** | 100 GB-hours / month |
| **Dashboard** | [vercel.com/dashboard](https://vercel.com/dashboard) |

### Your Vercel Env Vars

| Key | Environment |
|-----|-------------|
| `NEXT_PUBLIC_CARTO_API_KEY` | Production |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Production + Preview |
| `NEXT_PUBLIC_API_URL` | Production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production |
| `NEXT_PUBLIC_SUPABASE_URL` | Production |

### ⚠️ Watch out for
- **Hobby plan has NO billing** — it hard-caps, never charges.
- Hobby plan is limited to 1 user (your account). If teammates need access, consider upgrading.

---

## 🤖 Google Gemini API

**What it does**: AI-powered features (e.g., report analysis, chatbot).

| Detail | Value |
|--------|-------|
| **Plan** | Free tier (rate-limited) |
| **Env var** | `GOOGLE_GEMINI_API_KEY` |
| **Stored in** | `frontend/.env.local` |
| **Dashboard** | [aistudio.google.com](https://aistudio.google.com) |

### ⚠️ Watch out for
- The key currently uses `GOOGLE_GEMINI_API_KEY` (no `NEXT_PUBLIC_` prefix) — this means it should be **server-side only**. Do NOT expose it to the browser.
- Free tier has rate limits (requests per minute / per day). If exceeded, API returns 429 errors — no charges.
- If you switch to a paid Google Cloud billing account, usage IS billed. **Stay on the free AI Studio plan.**

---

## 🔑 Google OAuth (Client ID)

**What it does**: "Sign in with Google" button for user authentication.

| Detail | Value |
|--------|-------|
| **Cost** | Completely free, no limits |
| **Env var** | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (frontend) + `GOOGLE_CLIENT_ID` (backend) |
| **Dashboard** | [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials) |

### ⚠️ Watch out for
- No billing risk at all.
- Make sure authorized redirect URIs include both `localhost:3000` and `ecowatch-sjdm.vercel.app`.

---

## 🤗 Hugging Face

**What it does**: Hosts the Mask R-CNN model weights (`renzobyns/ecowatch-mrcnn`). Backend downloads the `.h5` file on startup.

| Detail | Value |
|--------|-------|
| **Plan** | Free |
| **Env var** | `HF_MODEL_REPO=renzobyns/ecowatch-mrcnn` |
| **Stored in** | `backend/.env` |
| **Dashboard** | [huggingface.co/settings](https://huggingface.co/settings) |

### ⚠️ Watch out for
- Public repos and model downloads are **completely free**.
- If the repo is set to **private**, you'd need an `HF_TOKEN` — currently not needed since the repo is public.
- No billing risk.

---

## 📧 Resend (Transactional Email)

**What it does**: Sends email notifications (e.g., report status updates).

| Detail | Value |
|--------|-------|
| **Plan** | Free |
| **Limit** | 100 emails/day, 3,000 emails/month |
| **Env var** | `RESEND_API_KEY` |
| **Stored in** | `backend/.env` |
| **From address** | `onboarding@resend.dev` (Resend test domain) |
| **Dashboard** | [resend.com/dashboard](https://resend.com/dashboard) |

### ⚠️ Watch out for
- Free tier has a **hard cap** — won't charge, just stops sending.
- Currently using Resend's test domain (`onboarding@resend.dev`). For production, you'd verify your own domain.
- No billing risk.

---

## 🔒 Where Keys Are Stored — Quick Reference

### Local Development (`frontend/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
GOOGLE_GEMINI_API_KEY=...
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...
NEXT_PUBLIC_CARTO_API_KEY=...          ← localhost unrestricted key
```

### Local Development (`backend/.env`)
```
DATABASE_URL=...                       ← commented out (uses SQLite locally)
HF_MODEL_REPO=renzobyns/ecowatch-mrcnn
RESEND_API_KEY=...
GOOGLE_CLIENT_ID=...
```

### Production (Vercel Environment Variables)
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=...
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...
NEXT_PUBLIC_CARTO_API_KEY=...          ← production restricted key
```

---

## 📅 Monthly Check Routine

Do this on the **1st of every month** (takes 2 minutes):

1. ✅ [CARTO Dashboard](https://dashboard.basemaps.carto.com/keys) — check tile usage (< 5M?)
2. ✅ [Supabase Dashboard](https://supabase.com/dashboard) — check DB size (< 500 MB?) and bandwidth
3. ✅ [Vercel Dashboard](https://vercel.com/dashboard) — check bandwidth (< 100 GB?)
4. ✅ [Resend Dashboard](https://resend.com/dashboard) — check email usage (< 3,000/month?)
5. ✅ [Google AI Studio](https://aistudio.google.com) — check API usage & rate limits

> **Bottom line**: On the free tier for all services, you will **never be auto-charged**. The worst case is the service stops working temporarily until the next billing cycle resets.
