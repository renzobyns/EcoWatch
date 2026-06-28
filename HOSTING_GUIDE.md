# EcoWatch SJDM — Hosting & Database Setup Guide

This guide documents the hosting architecture, command-line steps, errors we encountered, and solutions implemented to link **Vercel** and **Supabase** for your Capstone project.

---

## 1. High-Level Architecture (SQLite vs Supabase)

Your application is designed to support both **offline testing** and **online hosting** concurrently:

* **Local Dev / Offline Mode:** The Python backend uses **SQLite** (saves data in `backend/ecowatch.db`). This runs completely offline on your computer.
* **Production / Online Mode:** The backend connects to **PostgreSQL** on **Supabase** (when the `DATABASE_URL` environment variable is provided).

---

## 2. Vercel Hosting (Frontend)

The frontend website is hosted on Vercel at **[ecowatch-sjdm.vercel.app](https://ecowatch-sjdm.vercel.app)**.

### How it deploys:
Because Vercel is connected directly to your GitHub repository (`renzobyns/EcoWatch`), you do not need to run manual deploy commands. 
* Every time you push a commit to your **`master`** branch on GitHub, Vercel automatically rebuilds and deploys the new website.

### Local CLI Connection:
We linked your local project folder to Vercel using the Vercel CLI:
```bash
# 1. Install CLI
npm install -g vercel

# 2. Log in
vercel login

# 3. Link the project (Run this in the EcoWatch root directory)
vercel link --yes
```
*This created a `.vercel/` folder in your project and a `.env.local` file containing your deployment configurations.*

---

## 3. Supabase Database Setup

### Step 1: Install & Login
We installed the Supabase command-line tool globally and connected it to your account:
```bash
# Install globally
npm install -g supabase

# Log in (opens browser for access token)
supabase login
```

### Step 2: Initialize & Link Project
We initialized the local directory configuration and linked it using the project reference ID (`cndsqjgildhumsquyypd`):
```bash
# Initialize folder configurations (creates supabase/ folder)
supabase init

# Link to your online database (requires your database password)
supabase link --project-ref cndsqjgildhumsquyypd --password YOUR_DATABASE_PASSWORD
```

---

## 4. Troubleshooting: The IPv6 Networking Issue

### The Problem:
When we first tried to seed the database using Supabase's direct connection host (`db.cndsqjgildhumsquyypd.supabase.co`), it failed with:
`OperationalError: could not translate host name... to address`

* **Why it happened:** Supabase's direct connection domains use IPv6. On local networks/Windows setups without active IPv6 routing, the computer cannot resolve or connect to these addresses.

### The Solution:
We switched to the **Supabase Session Pooler** which operates on IPv4. 
* **Host:** `aws-1-ap-southeast-1.pooler.supabase.com`
* **Port:** `5432`
* **Username Format:** `postgres.cndsqjgildhumsquyypd`
* **Database Name:** `postgres`

Combined connection URL:
`postgresql://postgres.cndsqjgildhumsquyypd:YOUR_DATABASE_PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`

---

## 5. Database Seeding & Schema Creation

Because SQLAlchemy automatically generates tables on startup via `models.Base.metadata.create_all(bind=engine)`, we didn't need to run SQL files manually. We just ran your seeding script pointing to the Supabase connection string.

### Windows Command Prompt / PowerShell Seeding Command:
Windows console terminals sometimes crash when attempting to print emojis (like the trash can `🗑️` in the script output). We bypass this by forcing `utf-8` encoding.

Run this command inside the `backend/` folder:
```powershell
$env:PYTHONIOENCODING="utf-8"
$env:DATABASE_URL="postgresql://postgres.cndsqjgildhumsquyypd:YOUR_DATABASE_PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
.\venv_tf\Scripts\python.exe seed_test_data.py
```

*This command automatically created all 8 PostgreSQL tables on Supabase and seeded them with 122 user records, reports, notifications, and work orders.*

---

## 6. Next Steps: Synchronizing the Live Website (Vercel)

To link your new Supabase database to your live frontend, you must update the environment variables on the **Vercel Dashboard**:

1. Go to **Vercel** -> `eco-watch` project -> **Settings** -> **Environment Variables**.
2. Update **`NEXT_PUBLIC_SUPABASE_URL`** to:
   `https://cndsqjgildhumsquyypd.supabase.co`
3. Update **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** to your new publishable key from your Supabase dashboard.

---

## 7. Hugging Face Spaces (Backend Hosting)

Hugging Face Spaces provides a free **16 GB RAM** container to host your Python FastAPI backend, avoiding Railway/Render fees.

### Step 1: Create the Space on Hugging Face
1. Go to [huggingface.co/new-space](https://huggingface.co/new-space).
2. Choose **Docker** as the SDK, and select the **Blank** template.
3. Keep the hardware on the free tier (16 GB CPU basic).

### Step 2: Push your Backend Code
Open your command prompt or PowerShell, navigate to the `backend/` folder, and run these commands:

```bash
# 1. Navigate to the backend folder
cd c:\Users\Renzo Boyonas\OneDrive\Documents\3rd YR 2nd SEM\EcoWatch\backend

# 2. Initialize a separate local Git repository inside backend
git init

# 3. Add your files and commit
git add .
git commit -m "initial Hugging Face deploy"

# 4. Add the Hugging Face Space as a remote
# (Replace USERNAME and SPACE_NAME with your Hugging Face details)
git remote add huggingface https://huggingface.co/spaces/USERNAME/SPACE_NAME

# 5. Push the code (it will ask for your Hugging Face username and password/Token)
git push -f huggingface master:main
```

### Step 3: Add Database Environment Variables on Hugging Face
Once the Space is created, we need to pass your Supabase database keys so it can connect:
1. Go to your Space page -> **Settings** -> **Variables and secrets**.
2. Add a new **Secret** (not a Variable) named **`DATABASE_URL`**.
3. Set the value to your session pooler connection string:
   `postgresql://postgres.cndsqjgildhumsquyypd:1FoTmDvPKvhUkI1Y@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`

### Step 4: Keep it Awake (UptimeRobot)
To prevent Hugging Face from sleeping after 48 hours of inactivity:
1. Go to [uptimerobot.com](https://uptimerobot.com) (free account).
2. Add a new HTTP pinger monitor.
3. Set it to ping your backend docs page every 30 minutes:
   `https://USERNAME-SPACE_NAME.hf.space/docs`

