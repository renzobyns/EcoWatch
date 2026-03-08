from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import spatial_utils
import json

app = FastAPI(title="EcoWatch SJDM API", version="1.0.0")

# Enable CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LocationReport(BaseModel):
    lat: float
    lon: float

@app.get("/")
async def root():
    return {"message": "Welcome to EcoWatch SJDM API", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/report/validate-location")
async def validate_location(report: LocationReport):
    """
    Validates if coordinates fall within SJDM and identifies the Barangay.
    """
    result = spatial_utils.get_barangay_from_coords(report.lat, report.lon)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.get("/spatial/barangays")
async def get_barangays_geojson():
    """
    Returns the SJDM barangay boundaries for map visualization.
    """
    try:
        with open(spatial_utils.DATA_PATH, 'r') as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
