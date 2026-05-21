# EcoWatch SJDM 🌿📍

EcoWatch is a specialized geospatial reporting and environmental monitoring system designed for **San Jose del Monte (SJDM), Bulacan**. It empowers citizens to report illegal waste dumping near waterways and provides CENRO with advanced analytical tools for city-wide resolution.

## 🚀 Key Features

- **QR-Tagged Reporting**: Instant access to reporting forms via physical markers.
- **AI Verification (Mask R-CNN)**: Real-time instance segmentation using a custom-trained Mask R-CNN model to detect and verify garbage dumpsites in uploaded images.
- **Spatial Accountability (Ray-Casting)**: Auto-assignment of reports to the correct Barangay official using point-in-polygon logic.
- **Heatmap Analytics (DBSCAN)**: Spatial clustering to identify high-density dumping zones for CENRO.
- **Cleanup Validation**: Required "After" photos with AI re-verification before case resolution.

> 📖 **For detailed defense-grade documentation** on each core feature (what it is, how it's built, files involved, sources & citations), see [`FEATURES.md`](FEATURES.md).

## 🛠️ Tech Stack

- **Frontend**: Next.js 16 (React), Tailwind CSS v4, Lucide Icons.
- **Backend**: Python 3.12 (FastAPI), SQLAlchemy, Scikit-learn, Shapely.
- **AI/ML**: TensorFlow 2.16.1, Mask R-CNN (custom-trained on garbage dataset).
- **Database**: SQLite (dev) / PostgreSQL with PostGIS (production).
- **Hosting**: Vercel (Frontend), Render/Railway (Backend).

## 📂 Project Structure

- `/frontend` — Next.js web application (Citizen Portal & Dashboards).
- `/backend` — FastAPI microservice for AI and Spatial logic.
  - `/backend/mrcnn` — Mask R-CNN inference library.
  - `/backend/models` — Trained model weights (`.h5`, gitignored).
  - `/backend/ai_verifier.py` — AI detection module (real Mask R-CNN with mock fallback).
- `/data` — Geographic datasets, including SJDM Barangay boundaries (GeoJSON).

## 🚦 Getting Started

### Prerequisites
- Node.js (v20 or later)
- Python 3.12 (required for TensorFlow compatibility)

### Frontend Setup
1. `cd frontend`
2. `npm install`
3. `npm run dev`

### Backend Setup
1. `cd backend`
2. Create a Python 3.12 virtual environment:
   ```bash
   py -3.12 -m venv venv_tf
   ```
3. Activate the virtual environment:
   ```bash
   .\venv_tf\Scripts\activate   # Windows
   source venv_tf/bin/activate  # macOS/Linux
   ```
4. Install dependencies:
   ```bash
   pip install tensorflow==2.16.1 tf-keras scikit-image h5py opencv-python-headless
   pip install fastapi uvicorn sqlalchemy python-multipart bcrypt scikit-learn shapely
   ```
5. Place the trained model weights at `backend/models/mask_rcnn_garbage.h5`
   - Download from Google Drive: `EcoWatch/models/mask_rcnn_garbage.h5`
   - Without this file, AI detection runs in mock mode (random results).
6. Seed test data (optional):
   ```bash
   python seed_test_data.py
   ```
7. Start the server:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

## 🤖 AI Model Details

| Property | Value |
|---|---|
| Architecture | Mask R-CNN (ResNet-101 backbone) |
| Framework | TensorFlow 2.16.1 + Legacy Keras |
| Training Data | 10 images, 75 polygon annotations |
| Training | 15 epochs, transfer learning from COCO weights |
| Final Loss | 0.54 (training), 0.43 (validation) |
| Classes | Background, Garbage |
| Inference | CPU (no GPU required) |

### Retraining the Model
1. Add more annotated images to Google Drive → `EcoWatch/garbage/`
2. Open the Colab notebook and re-run all cells
3. Download the new `mask_rcnn_garbage.h5` from Drive
4. Replace `backend/models/mask_rcnn_garbage.h5`
5. Restart the backend — no code changes needed

## 🔑 Test Accounts
For local testing, the following pre-seeded accounts are available:
- **Citizen**: `citizen@test.com` | `password123`
- **Barangay Admin**: `barangay@test.com` | `password123` (Assigned: Muzon)
- **CENRO Official**: `cenro@test.com` | `password123`

## 📝 License
Capstone Project - 3rd Year 2nd Sem
