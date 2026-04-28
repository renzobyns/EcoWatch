from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List
import spatial_utils
import json
import os
import uuid
import bcrypt
from datetime import datetime
from sqlalchemy.orm import Session
from database import engine, get_db
import models
from ai_verifier import verifier
import analytics

# Create DB tables
models.Base.metadata.create_all(bind=engine)

# Ensure uploads directory exists
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="EcoWatch SJDM API", version="1.0.0")

# Enable CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded images as static files
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# ─────────────────────────────────────────────────────────
# PYDANTIC MODELS (Request/Response schemas)
# ─────────────────────────────────────────────────────────

class LocationReport(BaseModel):
    lat: float
    lon: float

class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str

class LoginRequest(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    barangay_assignment: Optional[str] = None

    class Config:
        from_attributes = True

class ReportResponse(BaseModel):
    id: int
    lat: float
    lon: float
    barangay: Optional[str] = None
    reporter_id: Optional[int] = None
    image_url: Optional[str] = None
    cleanup_image_url: Optional[str] = None
    ai_confidence: Optional[float] = None
    status: str
    notes: Optional[str] = None
    tracking_id: Optional[str] = None
    tracking_url: Optional[str] = None
    created_at: datetime
    deployed_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────

def generate_tracking_id(db: Session) -> str:
    """Generate a unique tracking ID like EW-0042."""
    count = db.query(models.Report).count()
    return f"EW-{(count + 1):04d}"

def generate_tracking_slug() -> str:
    """Generate a random URL slug for tracking."""
    return uuid.uuid4().hex[:8]

def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its bcrypt hash."""
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))

async def save_upload(image: UploadFile, prefix: str = "report") -> str:
    """Save an uploaded file to disk and return the relative URL path."""
    ext = os.path.splitext(image.filename)[1] or ".jpg"
    filename = f"{prefix}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    contents = await image.read()
    with open(filepath, "wb") as f:
        f.write(contents)
    
    return f"/uploads/{filename}"


# ─────────────────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"message": "Welcome to EcoWatch SJDM API", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}


# ─────────────────────────────────────────────────────────
# AUTH ENDPOINTS (Local — replaces Supabase during dev)
# ─────────────────────────────────────────────────────────

@app.post("/auth/register", response_model=UserResponse)
async def register(req: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new citizen account."""
    # Check if email already exists
    existing = db.query(models.User).filter(models.User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = models.User(
        email=req.email,
        password_hash=hash_password(req.password),
        full_name=req.full_name,
        role="citizen"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return user

@app.post("/auth/login")
async def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Login and get user details + role."""
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    return {
        "success": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "barangay_assignment": user.barangay_assignment
        }
    }

@app.get("/auth/users", response_model=List[UserResponse])
async def list_users(db: Session = Depends(get_db)):
    """List all users (admin/testing only)."""
    return db.query(models.User).all()


# ─────────────────────────────────────────────────────────
# SPATIAL ENDPOINTS
# ─────────────────────────────────────────────────────────

@app.post("/report/validate-location")
async def validate_location(report: LocationReport):
    """Validates if coordinates fall within SJDM and identifies the Barangay."""
    result = spatial_utils.get_barangay_from_coords(report.lat, report.lon)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.get("/spatial/barangays")
async def get_barangays_geojson():
    """Returns the SJDM barangay boundaries for map visualization."""
    try:
        with open(spatial_utils.DATA_PATH, 'r') as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────
# REPORT SUBMISSION
# ─────────────────────────────────────────────────────────

@app.post("/report/submit")
async def submit_report(
    lat: float = Form(...),
    lon: float = Form(...),
    notes: Optional[str] = Form(None),
    reporter_id: Optional[int] = Form(None),
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Full report submission pipeline:
    1. Save uploaded image to disk
    2. Run Mask R-CNN verification
    3. Determine Barangay via Ray-Casting
    4. Generate tracking ID + URL
    5. Save to database
    """
    # 1. Save image
    image_url = await save_upload(image, prefix="report")
    
    # Re-read for AI (save_upload consumed the bytes)
    # For the mock verifier, we just pass empty bytes
    verification_result = verifier.verify_image(b"mock")
    
    # Determine initial status based on AI result
    if not verification_result["verified"]:
        status = models.ReportStatus.REJECTED
    else:
        status = models.ReportStatus.VERIFIED
    
    # 2. Spatial assignment
    spatial_result = spatial_utils.get_barangay_from_coords(lat, lon)
    barangay = spatial_result.get("barangay") if "error" not in spatial_result else "Unknown"
    
    # 3. Generate tracking
    tracking_id = generate_tracking_id(db)
    tracking_slug = generate_tracking_slug()
    tracking_url = f"/track/{tracking_slug}"
    
    # 4. Create Report
    new_report = models.Report(
        lat=lat,
        lon=lon,
        barangay=barangay,
        reporter_id=reporter_id,
        image_url=image_url,
        ai_confidence=verification_result["confidence"],
        status=status,
        notes=notes,
        tracking_id=tracking_id,
        tracking_url=tracking_url
    )
    
    db.add(new_report)
    db.commit()
    db.refresh(new_report)
    
    return {
        "success": True if status != models.ReportStatus.REJECTED else False,
        "message": "Report successfully verified and submitted." if status != models.ReportStatus.REJECTED 
                   else "AI could not verify the presence of illegal waste.",
        "report_id": new_report.id,
        "tracking_id": tracking_id,
        "tracking_url": tracking_url,
        "barangay_assigned": barangay,
        "status": status,
        "ai_details": verification_result
    }


# ─────────────────────────────────────────────────────────
# REPORT TRACKING & VIEWING
# ─────────────────────────────────────────────────────────

@app.get("/report/track/{tracking_slug}")
async def track_report(tracking_slug: str, db: Session = Depends(get_db)):
    """Get report status by tracking slug (public, no auth needed)."""
    report = db.query(models.Report).filter(
        models.Report.tracking_url == f"/track/{tracking_slug}"
    ).first()
    
    if not report:
        # Try by tracking_id (e.g. "EW-0042")
        report = db.query(models.Report).filter(
            models.Report.tracking_id == tracking_slug
        ).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return ReportResponse.model_validate(report)

@app.get("/reports/recent", response_model=List[ReportResponse])
async def get_recent_reports(db: Session = Depends(get_db)):
    """Fetch all non-rejected reports for map display."""
    reports = db.query(models.Report).filter(
        models.Report.status != models.ReportStatus.REJECTED
    ).order_by(models.Report.created_at.desc()).all()
    
    return reports

@app.get("/reports/barangay/{name}", response_model=List[ReportResponse])
async def get_barangay_reports(name: str, db: Session = Depends(get_db)):
    """Get all reports for a specific barangay (for barangay portal)."""
    reports = db.query(models.Report).filter(
        models.Report.barangay == name,
        models.Report.status != models.ReportStatus.REJECTED
    ).order_by(models.Report.created_at.desc()).all()
    
    return reports


# ─────────────────────────────────────────────────────────
# BARANGAY ACTIONS
# ─────────────────────────────────────────────────────────

@app.put("/report/{report_id}/deploy")
async def deploy_report(report_id: int, db: Session = Depends(get_db)):
    """Barangay marks a report as deployed (sweepers dispatched)."""
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    if report.status != models.ReportStatus.VERIFIED:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot deploy. Report status is '{report.status}', must be 'verified'."
        )
    
    report.status = models.ReportStatus.DEPLOYED
    report.deployed_at = datetime.utcnow()
    db.commit()
    db.refresh(report)
    
    return {
        "success": True,
        "message": f"Report {report.tracking_id} deployed successfully.",
        "report": ReportResponse.model_validate(report)
    }

@app.post("/report/{report_id}/resolve")
async def resolve_report(
    report_id: int,
    cleanup_image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Barangay uploads cleanup photo.
    AI re-verifies — if clean, mark resolved; if still dirty, mark failed_cleanup.
    """
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    if report.status != models.ReportStatus.DEPLOYED:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot resolve. Report status is '{report.status}', must be 'deployed'."
        )
    
    # Save cleanup image
    cleanup_url = await save_upload(cleanup_image, prefix="cleanup")
    report.cleanup_image_url = cleanup_url
    
    # AI re-verification on cleanup photo
    verification = verifier.verify_image(b"mock_cleanup")
    
    if verification["verified"]:
        # AI still sees waste → cleanup failed
        report.status = models.ReportStatus.FAILED_CLEANUP
    else:
        # AI sees no waste → cleanup successful
        report.status = models.ReportStatus.RESOLVED
        report.resolved_at = datetime.utcnow()
    
    db.commit()
    db.refresh(report)
    
    return {
        "success": True,
        "message": f"Report {report.tracking_id} — {'Resolved! ✅' if report.status == models.ReportStatus.RESOLVED else 'Cleanup needs retry ⚠️'}",
        "status": report.status,
        "report": ReportResponse.model_validate(report)
    }


# ─────────────────────────────────────────────────────────
# CENRO ADMIN ACTIONS
# ─────────────────────────────────────────────────────────

@app.put("/report/{report_id}/reassign")
async def reassign_report(
    report_id: int,
    new_barangay: str = Form(...),
    db: Session = Depends(get_db)
):
    """CENRO override: reassign a report to a different barangay."""
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    old_barangay = report.barangay
    report.barangay = new_barangay
    db.commit()
    db.refresh(report)
    
    return {
        "success": True,
        "message": f"Report {report.tracking_id} reassigned from '{old_barangay}' to '{new_barangay}'.",
        "report": ReportResponse.model_validate(report)
    }

@app.put("/report/{report_id}/force-close")
async def force_close_report(report_id: int, db: Session = Depends(get_db)):
    """CENRO override: force-close/resolve a report directly."""
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    report.status = models.ReportStatus.RESOLVED
    report.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(report)
    
    return {
        "success": True,
        "message": f"Report {report.tracking_id} force-closed by CENRO.",
        "report": ReportResponse.model_validate(report)
    }


# ─────────────────────────────────────────────────────────
# ANALYTICS
# ─────────────────────────────────────────────────────────

@app.get("/spatial/heatmaps")
async def get_heatmaps(db: Session = Depends(get_db)):
    """Runs DBSCAN clustering on current active reports to find hotspots."""
    reports = db.query(models.Report).filter(
        models.Report.status.in_([
            models.ReportStatus.PENDING, 
            models.ReportStatus.VERIFIED,
            models.ReportStatus.DEPLOYED
        ])
    ).all()
    
    clusters = analytics.get_heatmap_clusters(reports)
    return {
        "total_active_reports": len(reports),
        "hotspots": clusters
    }

@app.get("/analytics/overview")
async def get_analytics_overview(db: Session = Depends(get_db)):
    """City-wide stats for CENRO dashboard."""
    total = db.query(models.Report).count()
    pending = db.query(models.Report).filter(models.Report.status == models.ReportStatus.PENDING).count()
    verified = db.query(models.Report).filter(models.Report.status == models.ReportStatus.VERIFIED).count()
    deployed = db.query(models.Report).filter(models.Report.status == models.ReportStatus.DEPLOYED).count()
    resolved = db.query(models.Report).filter(models.Report.status == models.ReportStatus.RESOLVED).count()
    rejected = db.query(models.Report).filter(models.Report.status == models.ReportStatus.REJECTED).count()
    failed = db.query(models.Report).filter(models.Report.status == models.ReportStatus.FAILED_CLEANUP).count()
    
    return {
        "total": total,
        "active": pending + verified,
        "deployed": deployed,
        "resolved": resolved,
        "rejected": rejected,
        "failed_cleanup": failed,
        "pending": pending,
        "verified": verified
    }

@app.get("/analytics/barangay-ranking")
async def get_barangay_ranking(db: Session = Depends(get_db)):
    """Barangay compliance ranking by resolution rate."""
    reports = db.query(models.Report).filter(
        models.Report.status != models.ReportStatus.REJECTED,
        models.Report.barangay.isnot(None)
    ).all()
    
    # Group by barangay
    barangay_stats = {}
    for report in reports:
        name = report.barangay
        if name not in barangay_stats:
            barangay_stats[name] = {"total": 0, "resolved": 0, "pending": 0, "deployed": 0}
        barangay_stats[name]["total"] += 1
        if report.status == models.ReportStatus.RESOLVED:
            barangay_stats[name]["resolved"] += 1
        elif report.status == models.ReportStatus.DEPLOYED:
            barangay_stats[name]["deployed"] += 1
        else:
            barangay_stats[name]["pending"] += 1
    
    # Calculate resolution rate and sort
    ranking = []
    for name, stats in barangay_stats.items():
        rate = (stats["resolved"] / stats["total"] * 100) if stats["total"] > 0 else 0
        ranking.append({
            "barangay": name,
            "total_reports": stats["total"],
            "resolved": stats["resolved"],
            "deployed": stats["deployed"],
            "pending": stats["pending"],
            "resolution_rate": round(rate, 1)
        })
    
    ranking.sort(key=lambda x: x["resolution_rate"], reverse=True)
    return ranking
