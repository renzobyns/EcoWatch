# EcoWatch SJDM — Hosting & Database Setup Guide

This guide documents the final production cloud architecture, configuration keys, performance optimizations, and uptime configurations for your Capstone project.

---

## 1. High-Level Architecture & Links

The application is deployed in a fully-integrated serverless and micro-container environment:

* **Frontend Website (Vercel):** [ecowatch-sjdm.vercel.app](https://ecowatch-sjdm.vercel.app)
* **Backend API (Hugging Face Space):** [renzobyns-ecowatch-backend.hf.space](https://renzobyns-ecowatch-backend.hf.space)
* **Database (Supabase PostgreSQL):** Cloud database instance connected via IPv4 session pooler.
* **Storage (Supabase Storage):** Permanent cloud storage bucket (`report-photos`) for upload images and AI mask images.
* **AI Model Repository (Hugging Face Model Hub):** [renzobyns/ecowatch-mrcnn](https://huggingface.co/renzobyns/ecowatch-mrcnn) (stores the 257 MB `mask_rcnn_garbage.h5` weights file).

---

## 2. Vercel Hosting (Frontend)

The frontend is built with React and Next.js and is connected directly to your GitHub repository `renzobyns/EcoWatch`.

### Automatic Redeployment:
Every time you push a commit to the **`master`** branch, Vercel automatically detects the push and redeploys the live site.

### Environment Variables Configured on Vercel:
* `NEXT_PUBLIC_SUPABASE_URL` = `https://cndsqjgildhumsquyypd.supabase.co`
* `NEXT_PUBLIC_SUPABASE_ANON_KEY` = *[Your Supabase publishable key]*
* `NEXT_PUBLIC_API_URL` = `https://renzobyns-ecowatch-backend.hf.space`

---

## 3. Hugging Face Space (Backend Container)

The FastAPI python backend is deployed to a Docker Space on Hugging Face at `renzobyns/ecowatch-backend`.

### Programmatic Model Download:
To bypass Hugging Face's Git LFS push limits (which reject files >10 MB), the container is configured to pull the 257 MB `mask_rcnn_garbage.h5` model file programmatically on boot from your Model Hub repository using `huggingface_hub` via `download_model.py`.

### Environment Secrets Configured in Hugging Face Space:
These are set up under **Settings** -> **Variables and secrets** on the Hugging Face page:
1. `DATABASE_URL` = `postgresql://postgres.cndsqjgildhumsquyypd:1FoTmDvPKvhUkI1Y@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres` (IPv4 session pooler)
2. `NEXT_PUBLIC_SUPABASE_URL` = `https://cndsqjgildhumsquyypd.supabase.co`
3. `NEXT_PUBLIC_SUPABASE_ANON_KEY` = *[Your Supabase anon key]*
4. `HF_MODEL_REPO` = `renzobyns/ecowatch-mrcnn`

---

## 4. Performance Optimizations Implemented

To resolve lags and make the system run smoothly on free hosting hardware, we added two major optimizations to the backend:

### A. Pillow Image Compression on Upload
* **The Problem:** Modern phone cameras take raw photos that are **5 MB to 10 MB** in size. Uploading, processing, and rendering these files in the browser caused submissions to take over 30 seconds and images to load slowly like vertical "blinds".
* **The Optimization:** When a citizen uploads an image, the backend uses the `Pillow` library to:
  1. Check if the image size exceeds 1200px. If so, it scales it down while maintaining the aspect ratio.
  2. Compress the image to JPEG format with **75% quality**.
* **The Result:** Image file size drops from **~6 MB down to ~150 KB** (a 97% reduction) with zero visible loss of quality. Submission times and image rendering are now **instant (under 1 second)**!

### B. Bcrypt Hash Rounds (Environment-Aware)
* **The Problem:** Bcrypt hashing defaults to 12 rounds. While highly secure, it is CPU-heavy. On a shared free CPU tier on Hugging Face, it took up to **7 seconds** just to verify a password during login.
* **The Optimization:** We made the salt rounds dynamic based on the environment:
  * **Local Dev (your laptop):** Uses **12 rounds** (maximum security, fast CPU handles it easily).
  * **Production (Hugging Face):** Uses **10 rounds** (OWASP industry standard baseline — fully secure, login takes ~1.5 seconds instead of 7).
* **The Result:** Logins are fast on the hosted site while maintaining full cybersecurity compliance!

---

## 5. Uptime Setup (UptimeRobot)

Hugging Face Docker Spaces automatically enter "Sleep" mode after 48 hours of inactivity to save hardware resources. To keep the server awake 24/7 (running like Railway/Render), we configured a pinger:

1. **Service:** [UptimeRobot.com](https://uptimerobot.com) (Free Account)
2. **Monitor Type:** `Keyword` *(NOT HTTP — the free HTTP monitor uses HEAD requests which Hugging Face blocks with 405 errors)*
3. **Friendly Name:** `EcoWatch Backend`
4. **URL:** `https://renzobyns-ecowatch-backend.hf.space/`
5. **Keyword:** `running`
6. **Alert When:** `Start incident when keyword does not exist`
7. **Interval:** `Every 5 minutes`

UptimeRobot sends a full GET request every 5 minutes and checks for the keyword `running` in the JSON response. This keeps the Hugging Face container active 24/7 and eliminates cold starts. We use the Keyword monitor type instead of HTTP because UptimeRobot's free HTTP monitor sends HEAD requests, which Hugging Face's proxy rejects with 405 errors.

---

## 6. How to Deploy Future Changes (Cheat Sheet)

If you modify the python backend files locally on your computer in the future, deploy the changes to Hugging Face with these terminal commands:

```powershell
# 1. Open terminal and navigate to backend/
cd "c:\Users\Renzo Boyonas\OneDrive\Documents\3rd YR 2nd SEM\EcoWatch\backend"

# 2. Stage and commit changes
git add .
git commit -m "Describe your code updates here"

# 3. Force push to the Hugging Face main branch
git push -f huggingface main
```
*Note: The container will rebuild in about 30 seconds. Do not push large binary files (.h5, virtual environments, or .db database files).*

---

## 7. Troubleshooting Journey — Errors Encountered & Solutions

This section documents every major issue we encountered during the hosting and deployment process, and how each one was resolved. This serves as both a reference guide and evidence of the iterative problem-solving approach taken during development.

---

### 7.1 — Mixed Content Block (HTTPS vs HTTP)

* **When:** After deploying the frontend to Vercel (HTTPS).
* **The Error:** Clicking "Log In" on the live site returned a generic "Server error". The browser console showed: `Mixed Content: The page was loaded over HTTPS, but requested an insecure resource 'http://127.0.0.1:8000/auth/login'. This request has been blocked.`
* **Why:** The frontend was hosted on Vercel (HTTPS), but the `NEXT_PUBLIC_API_URL` environment variable was still pointing to the local development server (`http://127.0.0.1:8000`). Modern browsers strictly block HTTP requests from HTTPS pages for security reasons.
* **The Fix:** Deployed the Python backend to Hugging Face Spaces, which provides a free HTTPS endpoint (`https://renzobyns-ecowatch-backend.hf.space`). Updated the Vercel environment variable `NEXT_PUBLIC_API_URL` to point to this secure URL.

---

### 7.2 — IPv6 Database Connection Failure

* **When:** First attempt to seed the Supabase PostgreSQL database from the local machine.
* **The Error:** `OperationalError: could not translate host name "db.cndsqjgildhumsquyypd.supabase.co" to address`
* **Why:** Supabase's direct database connection host uses IPv6 DNS. The local Windows machine and network did not have active IPv6 routing, so Python's `psycopg2` could not resolve the hostname.
* **The Fix:** Switched from the direct connection to the **Supabase Session Pooler**, which operates on IPv4:
  * Host: `aws-1-ap-southeast-1.pooler.supabase.com`
  * Username: `postgres.cndsqjgildhumsquyypd`
  * Port: `5432`

---

### 7.3 — Git LFS Rejection (Model File Too Large)

* **When:** Attempting to push the backend code (including the 257 MB `mask_rcnn_garbage.h5` AI model) to the Hugging Face Space Git repository.
* **The Error:** `remote: error: File mask_rcnn_garbage.h5 is 257 MB; this exceeds the file size limit of 10 MB.`
* **Why:** Hugging Face Space repositories reject files larger than 10 MB via standard Git push (Git LFS is required but adds complexity).
* **The Fix:** Separated the model storage from the code:
  1. Uploaded the `.h5` file to a dedicated **Hugging Face Model Hub** repository (`renzobyns/ecowatch-mrcnn`) using the `huggingface_hub` Python API.
  2. Created `download_model.py` in the backend to programmatically download the model on container boot using `hf_hub_download()`.
  3. Added `models/` and `*.h5` to `.gitignore` to prevent future accidental pushes.

---

### 7.4 — PowerShell Emoji Crash During Seeding

* **When:** Running `seed_test_data.py` from PowerShell to seed the Supabase database.
* **The Error:** The terminal crashed or froze when the script printed emoji characters (e.g., 🗑️) in its output messages.
* **Why:** Windows PowerShell's default encoding cannot render certain Unicode emoji characters, causing the output buffer to crash.
* **The Fix:** Set the Python I/O encoding to UTF-8 before running the script:
  ```powershell
  $env:PYTHONIOENCODING="utf-8"
  ```

---

### 7.5 — Map Overlay Not Loading ("Backend unavailable")

* **When:** After the first successful Hugging Face deployment. The live site showed the warning: `Backend unavailable — map overlay disabled.`
* **The Error:** The frontend called `GET /spatial/barangays` which returned a `500 Internal Server Error` because the GeoJSON boundary file was missing.
* **Why:** The `spatial_utils.py` file referenced the GeoJSON data at `../data/sjdm_barangays.geojson` (one directory above the backend folder). Since only the `backend/` folder was pushed to Hugging Face, the `data/` folder at the project root did not exist on the container.
* **The Fix:**
  1. Copied `data/sjdm_barangays.geojson` into `backend/data/sjdm_barangays.geojson`.
  2. Updated `spatial_utils.py` to reference `data/sjdm_barangays.geojson` (same directory level) instead of `../data/sjdm_barangays.geojson`.

---

### 7.6 — Broken Image URLs (Double URL Concatenation)

* **When:** After submitting the first report on the live site. Images failed to load on the report tracking page and the AI mask toggle showed a blank box.
* **The Error:** The browser tried to load image URLs like: `https://renzobyns-ecowatch-backend.hf.spacehttps://cndsqjgildhumsquyypd.supabase.co/storage/v1/object/public/report-photos/report_abc123.jpg` — a broken double-URL.
* **Why:** The backend's `save_upload()` function was returning full Supabase Storage URLs (starting with `https://...`), but the frontend code prepended `API_URL` to all image paths (expecting relative paths like `/uploads/filename.jpg`). This caused double concatenation.
* **The Fix (3-part):**
  1. Modified `save_upload()` and `_save_mask_bytes()` to always return **relative paths** (`/uploads/filename.jpg`) regardless of where the file was stored.
  2. Replaced the static `app.mount("/uploads", ...)` with a dynamic `@app.get("/uploads/{filename}")` endpoint that checks locally first, and if not found, **redirects (302)** to the Supabase Storage public URL.
  3. Ran a database cleanup script to convert any existing full Supabase URLs already stored in the `reports` and `report_photos` tables back to relative paths.

---

### 7.7 — Slow Image Loading ("Blinds/Curtain" Effect)

* **When:** After fixing the image URLs. Images loaded but extremely slowly — appearing progressively from top to bottom like window blinds, taking 30+ seconds.
* **The Error:** Not a code error — a performance issue. Raw phone camera images were 5–10 MB each.
* **Why:** The backend was storing the original uncompressed photo. Downloading a 10 MB image from Supabase Storage on every page view was extremely slow.
* **The Fix:** Added **Pillow image compression** in `save_upload()`:
  * Resizes images larger than 1200px (maintaining aspect ratio).
  * Compresses to JPEG at 75% quality.
  * Result: file sizes dropped from ~6 MB to ~150 KB (97% reduction) with no visible quality loss.

---

### 7.8 — 7-Second Login Delay

* **When:** After deploying to Hugging Face. Logging in took 7 seconds of spinner before responding.
* **The Error:** Not a code error — a performance issue caused by bcrypt's CPU-intensive hashing on shared hardware.
* **Why:** Bcrypt's default 12 rounds of hashing ($2^{12}$ = 4,096 iterations) is designed for dedicated server CPUs. On Hugging Face's free shared CPU tier, each hash verification took ~7 seconds.
* **The Fix:** Made bcrypt rounds **environment-aware**:
  * Local development: 12 rounds (laptop CPU is fast).
  * Production (Hugging Face): 10 rounds (OWASP standard baseline — still fully secure, but login takes ~1.5 seconds instead of 7).

---

### 7.9 — UptimeRobot Showing "Down" (405 Error)

* **When:** 2 days after configuring UptimeRobot. The dashboard showed the monitor as "Down" with a `405` HTTP status code, even though the actual website was working fine.
* **The Error:** UptimeRobot reported: `HTTP | Down 2 day, 3 hr | 405`
* **Why:** UptimeRobot's free HTTP monitor type sends **HEAD requests** (not GET). Hugging Face's reverse proxy does not support HEAD requests and returns `405 Method Not Allowed`. The HEAD method option was locked behind UptimeRobot's paid plan.
* **The Fix:** Deleted the HTTP monitor and created a new **Keyword monitor** instead:
  * Keyword monitors always use **GET requests** (they must download the response body to search for the keyword).
  * Set to check for the keyword `running` in the response from `https://renzobyns-ecowatch-backend.hf.space/`.
  * Immediately turned green and has been reporting 100% uptime since.
