from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import spatial_utils
import csv
import io
import json
import logging
import os
import secrets
import uuid
import bcrypt
from datetime import datetime, timedelta
from sqlalchemy import or_
from sqlalchemy.orm import Session
from database import engine, get_db
import models
from ai_verifier import verifier
import analytics

# Root logger configuration — single source of formatted output
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)

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
    is_active: bool = True

    class Config:
        from_attributes = True


class CreateBarangayUserRequest(BaseModel):
    email: str
    full_name: str
    barangay_assignment: str


class CreateBarangayUserResponse(BaseModel):
    user: UserResponse
    temporary_password: str

class ReportResponse(BaseModel):
    id: int
    lat: float
    lon: float
    barangay: Optional[str] = None
    reporter_id: Optional[int] = None
    image_url: Optional[str] = None
    ai_mask_url: Optional[str] = None
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
# AUTH / RBAC DEPENDENCIES
# ─────────────────────────────────────────────────────────

def get_current_user(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db),
) -> models.User:
    """Resolve the calling user from the X-User-Id header. Raises 401 if missing/invalid/disabled."""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-Id header")
    try:
        user_id = int(x_user_id)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid X-User-Id header")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid or disabled user")
    return user


def require_role(*roles: str):
    """Dependency factory: ensures the current user has one of the given roles."""
    def checker(user: models.User = Depends(get_current_user)) -> models.User:
        if user.role not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Requires role: {', '.join(roles)}"
            )
        return user
    return checker


def write_audit(
    db: Session,
    user_id: int,
    action: str,
    target_id: Optional[int],
    details: dict,
    target_type: str = "report",
):
    """Append an AuditLog row. Caller must commit() the session afterwards."""
    db.add(models.AuditLog(
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=json.dumps(details),
    ))


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

ALLOWED_IMAGE_MIME = ("image/jpeg", "image/png")
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


def validate_image(image: UploadFile, contents: bytes) -> None:
    """Reject uploads that are not JPEG/PNG or exceed the 10 MB cap."""
    if image.content_type not in ALLOWED_IMAGE_MIME:
        raise HTTPException(
            status_code=400,
            detail="Only JPEG or PNG images are allowed.",
        )
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=400,
            detail="Image must be 10 MB or smaller.",
        )


async def save_upload(
    image: UploadFile,
    prefix: str = "report",
    contents: Optional[bytes] = None,
) -> str:
    """Save an uploaded file to disk and return the relative URL path.

    If `contents` is provided, reuse it (avoids double-reading large files).
    Otherwise read from the UploadFile. Always validates MIME + size.
    """
    if contents is None:
        contents = await image.read()
    validate_image(image, contents)

    ext = os.path.splitext(image.filename or "")[1] or ".jpg"
    filename = f"{prefix}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

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
    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Account disabled. Contact CENRO administrator.",
        )

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
async def list_users(
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_role("cenro")),
):
    """List all users (CENRO-only). Kept for backward compatibility — prefer GET /users."""
    return db.query(models.User).all()


# ─────────────────────────────────────────────────────────
# USER MANAGEMENT (CENRO-only)
# ─────────────────────────────────────────────────────────

@app.get("/users", response_model=List[UserResponse])
async def list_users_filtered(
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_role("cenro")),
):
    """List users with optional role and is_active filters (CENRO-only). Newest first."""
    query = db.query(models.User)
    if role:
        query = query.filter(models.User.role == role)
    if is_active is not None:
        query = query.filter(models.User.is_active == is_active)
    return query.order_by(models.User.created_at.desc()).all()


@app.post("/users", response_model=CreateBarangayUserResponse)
async def create_barangay_user(
    req: CreateBarangayUserRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_role("cenro")),
):
    """CENRO creates a new barangay account. Returns the auto-generated password once."""
    if not req.email or not req.full_name or not req.barangay_assignment:
        raise HTTPException(status_code=400, detail="email, full_name, and barangay_assignment are required")

    existing = db.query(models.User).filter(models.User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    temporary_password = secrets.token_urlsafe(9)  # ~12 chars
    new_user = models.User(
        email=req.email,
        password_hash=hash_password(temporary_password),
        full_name=req.full_name,
        role="barangay",
        barangay_assignment=req.barangay_assignment,
        is_active=True,
    )
    db.add(new_user)
    db.flush()  # populate new_user.id before audit row

    write_audit(
        db, admin.id, "create_user", new_user.id,
        {"email": new_user.email, "role": new_user.role, "barangay": new_user.barangay_assignment},
        target_type="user",
    )
    db.commit()
    db.refresh(new_user)

    return CreateBarangayUserResponse(
        user=UserResponse.model_validate(new_user),
        temporary_password=temporary_password,
    )


@app.put("/users/{user_id}/disable")
async def disable_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_role("cenro")),
):
    """Soft-delete a user account by setting is_active=False (CENRO-only)."""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot disable your own account")

    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if not target.is_active:
        raise HTTPException(status_code=400, detail="User is already disabled")

    target.is_active = False
    write_audit(
        db, admin.id, "disable_user", target.id,
        {"email": target.email, "previous_status": "active"},
        target_type="user",
    )
    db.commit()

    return {"success": True, "message": f"User {target.email} disabled."}


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
    # 1. Read image bytes for AI verification (validates MIME + size below)
    image_bytes = await image.read()
    validate_image(image, image_bytes)

    # 2. Run Mask R-CNN verification
    verification_result = verifier.verify_image(image_bytes)

    # 3. Save image to disk (reuse bytes — avoids re-reading 10 MB)
    image_url = await save_upload(image, prefix="report", contents=image_bytes)

    ai_mask_url = None
    # 4. Determine initial status based on AI result
    if not verification_result["verified"]:
        status = models.ReportStatus.REJECTED
    else:
        status = models.ReportStatus.VERIFIED
        # Generate and save the mask image
        mask_bytes = verifier.generate_mask_image()
        if mask_bytes:
            mask_filename = f"mask_{uuid.uuid4().hex[:8]}.jpg"
            mask_filepath = os.path.join(UPLOAD_DIR, mask_filename)
            with open(mask_filepath, "wb") as f:
                f.write(mask_bytes)
            ai_mask_url = f"/uploads/{mask_filename}"
    
    # 5. Spatial assignment
    spatial_result = spatial_utils.get_barangay_from_coords(lat, lon)
    barangay = spatial_result.get("barangay") if "error" not in spatial_result else "Unknown"
    
    # 6. Generate tracking
    tracking_id = generate_tracking_id(db)
    tracking_slug = generate_tracking_slug()
    tracking_url = f"/track/{tracking_slug}"
    
    # 7. Create Report
    new_report = models.Report(
        lat=lat,
        lon=lon,
        barangay=barangay,
        reporter_id=reporter_id,
        image_url=image_url,
        ai_mask_url=ai_mask_url,
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

def _apply_report_filters(
    query,
    status: Optional[str],
    date_from: Optional[datetime],
    date_to: Optional[datetime],
    search: Optional[str],
):
    """Shared filter logic for /reports/recent and /reports/barangay/{name}."""
    if status:
        query = query.filter(models.Report.status == status.lower())
    else:
        query = query.filter(models.Report.status != models.ReportStatus.REJECTED)
    if date_from:
        query = query.filter(models.Report.created_at >= date_from)
    if date_to:
        query = query.filter(models.Report.created_at <= date_to)
    if search:
        like = f"%{search}%"
        query = query.filter(or_(
            models.Report.tracking_id.ilike(like),
            models.Report.notes.ilike(like),
        ))
    return query


@app.get("/reports/recent", response_model=List[ReportResponse])
async def get_recent_reports(
    status: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """Fetch reports for map display. Filters: status, date range, search (tracking_id or notes)."""
    limit = min(max(limit, 1), 200)
    offset = max(offset, 0)
    query = _apply_report_filters(
        db.query(models.Report), status, date_from, date_to, search
    )
    return (
        query.order_by(models.Report.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@app.get("/reports/barangay/{name}", response_model=List[ReportResponse])
async def get_barangay_reports(
    name: str,
    status: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """Get reports for a specific barangay (barangay portal)."""
    limit = min(max(limit, 1), 200)
    offset = max(offset, 0)
    query = db.query(models.Report).filter(models.Report.barangay == name)
    query = _apply_report_filters(query, status, date_from, date_to, search)
    return (
        query.order_by(models.Report.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@app.get("/reports/sla-breaches", response_model=List[ReportResponse])
async def get_sla_breaches(days: int = 3, db: Session = Depends(get_db)):
    """List reports past the SLA threshold (still pending/verified/deployed after N days)."""
    days = max(1, days)
    threshold = datetime.utcnow() - timedelta(days=days)
    return (
        db.query(models.Report)
        .filter(
            models.Report.status.in_([
                models.ReportStatus.PENDING,
                models.ReportStatus.VERIFIED,
                models.ReportStatus.DEPLOYED,
            ]),
            models.Report.created_at < threshold,
        )
        .order_by(models.Report.created_at.asc())
        .all()
    )


@app.get("/reports/export")
async def export_reports(
    barangay: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Export filtered reports as CSV. Barangay users restricted to their assignment."""
    if user.role not in ("cenro", "barangay"):
        raise HTTPException(status_code=403, detail="Requires CENRO or barangay role")

    query = db.query(models.Report, models.User.email).outerjoin(
        models.User, models.Report.reporter_id == models.User.id
    )

    if user.role == "barangay":
        if not user.barangay_assignment:
            raise HTTPException(status_code=400, detail="Barangay user missing assignment")
        query = query.filter(models.Report.barangay == user.barangay_assignment)
    elif barangay:
        query = query.filter(models.Report.barangay == barangay)

    if date_from:
        query = query.filter(models.Report.created_at >= date_from)
    if date_to:
        query = query.filter(models.Report.created_at <= date_to)
    if status:
        query = query.filter(models.Report.status == status.lower())

    rows = query.order_by(models.Report.created_at.desc()).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "tracking_id", "created_at", "barangay", "status", "lat", "lon",
        "ai_confidence", "reporter_email", "deployed_at", "resolved_at", "notes",
    ])
    for report, reporter_email in rows:
        writer.writerow([
            report.tracking_id or "",
            report.created_at.isoformat() if report.created_at else "",
            report.barangay or "",
            report.status,
            report.lat,
            report.lon,
            report.ai_confidence if report.ai_confidence is not None else "",
            reporter_email or "",
            report.deployed_at.isoformat() if report.deployed_at else "",
            report.resolved_at.isoformat() if report.resolved_at else "",
            (report.notes or "").replace("\n", " ").replace("\r", " "),
        ])

    filename = f"ecowatch_reports_{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ─────────────────────────────────────────────────────────
# BARANGAY ACTIONS
# ─────────────────────────────────────────────────────────

@app.put("/report/{report_id}/deploy")
async def deploy_report(
    report_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("barangay")),
):
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
    write_audit(db, user.id, "deploy", report.id, {"tracking_id": report.tracking_id})
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
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("barangay")),
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

    # Read cleanup image bytes for AI verification (validates MIME + size below)
    cleanup_bytes = await cleanup_image.read()
    validate_image(cleanup_image, cleanup_bytes)
    verification = verifier.verify_image(cleanup_bytes)

    # Save cleanup image to disk (reuse bytes)
    cleanup_url = await save_upload(cleanup_image, prefix="cleanup", contents=cleanup_bytes)
    report.cleanup_image_url = cleanup_url

    if verification["verified"]:
        # AI still sees waste → cleanup failed
        report.status = models.ReportStatus.FAILED_CLEANUP
    else:
        # AI sees no waste → cleanup successful
        report.status = models.ReportStatus.RESOLVED
        report.resolved_at = datetime.utcnow()

    write_audit(db, user.id, "resolve", report.id, {
        "tracking_id": report.tracking_id,
        "outcome": report.status,
    })
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
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("cenro")),
):
    """CENRO override: reassign a report to a different barangay."""
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    old_barangay = report.barangay
    report.barangay = new_barangay
    write_audit(db, user.id, "reassign", report.id, {
        "tracking_id": report.tracking_id,
        "from": old_barangay,
        "to": new_barangay,
    })
    db.commit()
    db.refresh(report)

    return {
        "success": True,
        "message": f"Report {report.tracking_id} reassigned from '{old_barangay}' to '{new_barangay}'.",
        "report": ReportResponse.model_validate(report)
    }

@app.put("/report/{report_id}/force-close")
async def force_close_report(
    report_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("cenro")),
):
    """CENRO override: force-close/resolve a report directly."""
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    previous_status = report.status
    report.status = models.ReportStatus.RESOLVED
    report.resolved_at = datetime.utcnow()
    write_audit(db, user.id, "force_close", report.id, {
        "tracking_id": report.tracking_id,
        "previous_status": previous_status,
    })
    db.commit()
    db.refresh(report)

    return {
        "success": True,
        "message": f"Report {report.tracking_id} force-closed by CENRO.",
        "report": ReportResponse.model_validate(report)
    }


# ─────────────────────────────────────────────────────────
# AUDIT LOG (CENRO-only)
# ─────────────────────────────────────────────────────────

@app.get("/audit-log")
async def get_audit_log(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_role("cenro")),
):
    """Newest-first audit trail of override actions."""
    rows = (
        db.query(models.AuditLog, models.User.email)
        .outerjoin(models.User, models.AuditLog.user_id == models.User.id)
        .order_by(models.AuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    entries = []
    for log, user_email in rows:
        try:
            details = json.loads(log.details) if log.details else {}
        except (ValueError, TypeError):
            details = {"raw": log.details}
        entries.append({
            "id": log.id,
            "user_id": log.user_id,
            "user_email": user_email,
            "action": log.action,
            "target_type": log.target_type,
            "target_id": log.target_id,
            "details": details,
            "created_at": log.created_at,
        })

    return {"entries": entries, "limit": limit, "offset": offset}


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
