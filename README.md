# EcoWatch SJDM 🌿📍

EcoWatch is a specialized geospatial reporting and environmental monitoring system designed for **San Jose del Monte (SJDM), Bulacan**. It empowers citizens to report illegal waste dumping near waterways and provides CENRO with advanced analytical tools for city-wide resolution.

## 🚀 Key Features

- **QR-Tagged Reporting**: Instant access to reporting forms via physical markers.
- **AI Verification (Mask R-CNN)**: Automatic image instance segmentation to verify reported waste.
- **Spatial Accountability (Ray-Casting)**: Auto-assignment of reports to the correct Barangay official using point-in-polygon logic.
- **Heatmap Analytics (DBSCAN)**: Spatial clustering to identify high-density dumping zones for CENRO.
- **Cleanup Validation**: Required "After" photos with AI verification before case resolution.

## 🛠️ Tech Stack

- **Frontend**: Next.js 16 (React), Tailwind CSS v4, Lucide Icons.
- **Backend**: Python 3.14 (FastAPI), SQLAlchemy, Scikit-learn, Shapely.
- **Database**: PostgreSQL with PostGIS (via Supabase).
- **Hosting**: Vercel (Frontend), Render/Railway (Backend).

## 📂 Project Structure

- `/frontend`: Next.js web application (Citizen Portal & Dashboards).
- `/backend`: FastAPI microservice for AI and Spatial logic.
- `/data`: Geographic datasets, including SJDM Barangay boundaries (GeoJSON).

## 🚦 Getting Started

### Prerequisites
- Node.js (v20 or later)
- Python (v3.12 or later)

### Frontend Setup
1. `cd frontend`
2. `npm install`
3. `npm run dev`

### Backend Setup
1. `cd backend`
2. `python -m venv venv`
3. `.\venv\Scripts\activate` (Windows)
4. `pip install -r requirements.txt`
5. `python seed_test_data.py` (Optional: Seeds the DB with test users/reports)
6. `uvicorn main:app --reload`

## 🔑 Test Accounts
For local testing, the following pre-seeded accounts are available:
- **Citizen**: `citizen@test.com` | `password123`
- **Barangay Admin**: `barangay@test.com` | `password123` (Assigned: Muzon)
- **CENRO Official**: `cenro@test.com` | `password123`

## 📝 License
Capstone Project - 3rd Year 2nd Sem
