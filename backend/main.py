from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import spatial_utils
import json
from sqlalchemy.orm import Session
from database import engine, get_db
import models
from ai_verifier import verifier
import analytics

# Create DB tables
models.Base.metadata.create_all(bind=engine)


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

@app.post("/report/submit")
async def submit_report(
    lat: float = Form(...),
    lon: float = Form(...),
    notes: Optional[str] = Form(None),
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    1. Read the uploaded image.
    2. Run Mask R-CNN verification.
    3. Determine the Barangay via ray-casting.
    4. Save to the database.
    """
    image_bytes = await image.read()
    
    # 1. AI Verification
    verification_result = verifier.verify_image(image_bytes)
    
    if not verification_result["verified"]:
        return {
            "success": False,
            "message": "AI could not verify the presence of illegal waste.",
            "details": verification_result
        }
        
    # 2. Spatial assignment
    spatial_result = spatial_utils.get_barangay_from_coords(lat, lon)
    barangay = spatial_result.get("barangay") if "error" not in spatial_result else "Unknown"
    
    # 3. Create Report in DB
    new_report = models.Report(
        lat=lat,
        lon=lon,
        barangay=barangay,
        ai_confidence=verification_result["confidence"],
        status=models.ReportStatus.VERIFIED,
        notes=notes,
        # Typically we would upload the image_bytes to Supabase Storage/S3 here
        # and store the URL. For now we just mark a placeholder.
        image_url=f"placeholder/{image.filename}"
    )
    
    db.add(new_report)
    db.commit()
    db.refresh(new_report)
    
    return {
        "success": True,
        "message": "Report successfully verified and submitted.",
        "report_id": new_report.id,
        "barangay_assigned": barangay,
        "ai_details": verification_result
    }

@app.get("/reports/recent")
async def get_recent_reports(db: Session = Depends(get_db)):
    """
    Fetch all verified/pending reports to display on maps.
    """
    reports = db.query(models.Report).filter(
        models.Report.status != models.ReportStatus.REJECTED
    ).all()
    
    return reports

@app.get("/spatial/heatmaps")
async def get_heatmaps(db: Session = Depends(get_db)):
    """
    Runs DBSCAN clustering on current active reports to find hotspots.
    """
    # Get active/unresolved reports
    reports = db.query(models.Report).filter(
        models.Report.status.in_([models.ReportStatus.PENDING, models.ReportStatus.VERIFIED])
    ).all()
    
    clusters = analytics.get_heatmap_clusters(reports)
    return {
        "total_active_reports": len(reports),
        "hotspots": clusters
    }


