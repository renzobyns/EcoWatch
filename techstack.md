# EcoWatch — Tech Stack & Deployment Plan

> **Defense date:** May 26, 2026
> **Goal:** Production-ready deployment that survives a live demo, on a student budget.

---

## TL;DR

| Layer | Service | Cost | Why |
|---|---|---|---|
| Frontend | **Vercel Hobby** | Free | Made by Next.js team; zero-config |
| Backend | **Hugging Face Spaces** | Free | Docker space running CPU container |
| Database | **Supabase** (Free) | $0 | PostGIS included; critical for geospatial queries |
| File Storage | **Supabase Storage** | Bundled | One vendor; S3-compatible |
| ML Model Hosting | **Hugging Face Hub** | Free | Designed for model weights; pulled on startup |
| Auth | **FastAPI bcrypt (existing)** | Free | Already built with role-based logic | 
| Domain | **Vercel domain** | Free | Custom deployment subdomain |

**Total monthly cost:** $0 (runs completely on free tiers).

---

## Layer-by-Layer Justification

### 🎨 Frontend — Vercel Hobby (Free)

- **Stack:** Next.js 16, Tailwind CSS v4, Lucide Icons
- **Why Vercel:**
  - Built by the Next.js team — zero config, best DX for our framework
  - Auto preview deployments per git push (great for showing iterations to teammates)
  - Edge CDN included; global low-latency
  - 100GB bandwidth/month — way more than a capstone needs
- **Alternatives considered:** Netlify (slower for Next.js), Cloudflare Pages (newer SSR support, less polished)

### ⚙️ Backend — Hugging Face Spaces (Docker Space) (Free)

- **Stack:** Python 3.12, FastAPI, SQLAlchemy, TensorFlow 2.16.1, Mask R-CNN
- **Why Hugging Face Spaces:**
  - Provides a free container-based environment with CPU/GPU options.
  - Programmatic model download bypasses Git LFS file limits.
- **Alternatives considered:**
  - *Railway Hobby ($5/mo):* Originally planned for standard container hosting, but migrated to Hugging Face Spaces to save hosting costs.
  - *Heroku:* Too expensive ($5-7/mo and very slow container builds).
  - *Render:* Free tier sleeps and restarts take 50+ seconds — unusable for a live demo.
  - *AWS ECS:* Too complex for a 10-day sprint setup.

### 🗄️ Database — Supabase (Free now, Pro for defense)

- **Stack:** PostgreSQL 15 + **PostGIS** extension
- **Why Supabase:**
  - **PostGIS enabled by default** — critical for our `ST_Contains` ray-casting (auto-assign reports to barangay) and DBSCAN clustering for hotspot heatmaps
  - 500MB DB + 1GB storage on free tier — sufficient for capstone scale
  - Built-in dashboard, SQL editor, auto-generated REST API
  - Daily backups on Pro
- **The pause issue:** Free tier pauses after 7 days inactive. Mitigated by upgrading to Pro the week of defense.
- **Migration plan:** Move from local SQLite → Supabase Postgres. SQLAlchemy already abstracts this; only connection string changes.

### 📦 File Storage — Supabase Storage (Bundled)

- **Use case:** Citizen report photos, "after" cleanup photos, AI-generated mask overlays
- **Why Supabase Storage:**
  - Same dashboard/auth as the DB — one less vendor
  - S3-compatible API
  - 1GB free; 100GB on Pro plan
  - Public/private bucket policies via SQL
- **Why not AWS S3:** Extra IAM setup, separate billing, egress fees. No real benefit at our scale.

### 🤖 ML Model Hosting — Hugging Face Hub (Free)

- **Asset:** `mask_rcnn_garbage.h5` (~250MB, custom-trained, ResNet-101 backbone)
- **Why Hugging Face:**
  - Designed for ML model artifacts
  - Free public repos (the model isn't secret IP)
  - Version control for models — if we retrain, we tag a new version
  - Simple Python integration: `huggingface_hub.hf_hub_download()`
- **Deploy flow:**
  1. On backend startup, check if model exists in persistent volume
  2. If not, download from Hugging Face Hub
  3. Load into TensorFlow once; reuse across requests
- **Why not Git LFS:** Costs $5/mo for 50GB; HF is free and purpose-built.
- **Why not Google Drive + gdown:** Rate-limited, brittle, not professional.

### 🔐 Authentication — Keep Existing FastAPI bcrypt

- **Why not Supabase Auth:**
  - We already built role-based auth (citizen / barangay / CENRO)
  - Rewriting = 2–3 days of work + regression risk this close to defense
  - Our auth is simple and works
- **Pre-seeded test accounts** stay as documented in [README.md](README.md):
  - `citizen@test.com` / `password123`
  - `barangay@test.com` / `password123`
  - `cenro@test.com` / `password123`

---

## Deployment Timeline (15 days to defense)

### Week 1 — May 11–17 (Setup)
- [ ] Create Vercel project; connect to GitHub repo
- [ ] Create Hugging Face Space; deploy backend from `/backend`
- [ ] Provision Supabase project; enable PostGIS extension
- [ ] Migrate SQLite schema → Supabase Postgres (run Alembic or manual SQL)
- [ ] Upload `mask_rcnn_garbage.h5` to Hugging Face Hub
- [ ] Update backend to download model from HF on startup
- [ ] Configure CORS between Vercel ↔ HF Spaces

### Week 2 — May 18–24 (Polish + Test)
- [ ] Buy domain (e.g., `ecowatchsjdm.com`)
- [ ] Point domain to Vercel; configure DNS
- [ ] **May 20: Upgrade Supabase to Pro** ($25, eliminates pause risk)
- [ ] Seed production database with test data + SJDM barangay GeoJSON
- [ ] Full end-to-end test: report submission → AI verification → barangay auto-assignment → cleanup validation
- [ ] Load-test the Mask R-CNN endpoint (warm-up before defense)

### Defense Week — May 25–26
- [ ] **May 25 evening:** Smoke test all flows; restart Space to ensure fresh state
- [ ] **May 26 morning:** Final ping to Supabase; confirm HF Space is awake; check Vercel deployment is latest
- [ ] Backup plan: have a local laptop running the stack as fallback

### Post-Defense — May 27 onward
- [ ] Downgrade Supabase back to Free (saves $25/mo)
- [ ] Keep HF Space running
- [ ] Archive a Docker Compose snapshot for future portfolio demos

---

## Cost Summary

| Period | Monthly | One-Time |
|---|---|---|
| Setup (May 11–19) | $0 | $10 (domain, optional) |
| Defense window (May 20–26) | $25 (Supabase Pro) | — |
| Post-defense | $0 | — |

**Worst case for full capstone:** ~**$35 total**. Cheaper than a textbook.

---

## Architecture Diagram

```
                 ┌─────────────────────────┐
                 │   Vercel (Frontend)     │
                 │   Next.js 16 + Tailwind │
                 └────────────┬────────────┘
                              │ HTTPS / API calls
                              ▼
                 ┌─────────────────────────┐
                 │ Hugging Face (Backend)  │
                 │   FastAPI + TF/Mask     │
                 │   R-CNN + Shapely       │
                 └──────┬────────────┬─────┘
                        │            │
       PostGIS queries  │            │  File upload/read
                        ▼            ▼
        ┌───────────────────┐   ┌──────────────────┐
        │   Supabase DB     │   │ Supabase Storage │
        │   Postgres+PostGIS│   │  Images, masks   │
        └───────────────────┘   └──────────────────┘

                              ▲
                              │ Download on startup
                 ┌────────────┴────────────┐
                 │  Hugging Face Hub       │
                 │  mask_rcnn_garbage.h5   │
                 └─────────────────────────┘
```

---

## Future Optimizations (Post-Capstone)

- **Split ML inference to Hugging Face Spaces** — frees Railway memory, gets free GPU
- **Cloudflare R2** for storage if traffic scales (no egress fees)
- **PostHog or Plausible** for analytics
- **Sentry** for error tracking (free tier)
- **Migrate auth to Supabase Auth** if adding social login becomes a requirement

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Supabase pauses during demo | Medium (Free tier) | **Upgrade to Pro May 20** |
| Railway cold start delays first request | Low (Hobby tier doesn't sleep) | Pre-warm endpoint before demo |
| Mask R-CNN model fails to load | Low | Mock-fallback already in `ai_verifier.py` |
| Internet during defense fails | Low | Local fallback laptop running full stack |
| Domain DNS not propagated in time | Medium | Set DNS by **May 22** at latest (48hr buffer) |
