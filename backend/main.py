from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, Header, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import asyncio
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
from sqlalchemy import or_, text
from sqlalchemy.orm import Session, joinedload
from database import engine, get_db, SessionLocal
import models
from ai_verifier import verifier, verify_images_async, compute_trust_score
import analytics
from notifications import emit_notification

# SLA config keys + defaults (CENRO-editable at runtime via /config/sla)
SLA_CONFIG_KEYS = ("sla_low_days", "sla_medium_days", "sla_high_days", "sla_compliance_target")
SLA_CONFIG_DEFAULTS = {
    "sla_low_days": "7",
    "sla_medium_days": "3",
    "sla_high_days": "1",
    "sla_compliance_target": "95",
}
PRIORITY_KEY_MAP = {"low": "sla_low_days", "medium": "sla_medium_days", "high": "sla_high_days"}

# Root logger configuration — single source of formatted output
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)

# Create DB tables
models.Base.metadata.create_all(bind=engine)

# Idempotent column adds for existing DBs (SQLAlchemy create_all doesn't ALTER).
# Safe to leave permanently: each statement raises on existing column and we swallow.
with engine.connect() as _conn:
    for _ddl in (
        "ALTER TABLE reports ADD COLUMN deployment_notes TEXT",
        "ALTER TABLE users ADD COLUMN phone_number TEXT",
        "ALTER TABLE users ADD COLUMN last_login_at DATETIME",
        "ALTER TABLE reports ADD COLUMN verification_pending BOOLEAN DEFAULT 0 NOT NULL",
        "ALTER TABLE reports ADD COLUMN verification_kind VARCHAR",
        "ALTER TABLE reports ADD COLUMN trust_score VARCHAR",
        "ALTER TABLE reports ADD COLUMN needs_human_review BOOLEAN DEFAULT 0 NOT NULL",
        "ALTER TABLE report_photos ADD COLUMN trust_score VARCHAR",
        "ALTER TABLE report_photos ADD COLUMN trust_signals TEXT",
    ):
        try:
            _conn.execute(text(_ddl))
            _conn.commit()
        except Exception:
            pass  # column already exists


def _seed_sla_config_defaults() -> None:
    """Insert default SLA policy rows if missing. Idempotent — safe on every startup."""
    db = SessionLocal()
    try:
        for key, value in SLA_CONFIG_DEFAULTS.items():
            existing = db.query(models.SystemConfig).filter(models.SystemConfig.key == key).first()
            if not existing:
                db.add(models.SystemConfig(key=key, value=value))
        db.commit()
    finally:
        db.close()


_seed_sla_config_defaults()


def _migrate_single_photos_to_tables() -> None:
    """Backfill legacy single image_url / cleanup_image_url into new photo tables. Idempotent."""
    db = SessionLocal()
    try:
        # Pre-fetch migrated IDs in two queries rather than N+1
        already_report_photo_ids = set(
            row[0] for row in db.query(models.ReportPhoto.report_id).all()
        )
        already_cleanup_photo_ids = set(
            row[0] for row in db.query(models.CleanupPhoto.report_id).all()
        )

        # Evidence photos
        for report in db.query(models.Report).filter(models.Report.image_url.isnot(None)).all():
            if report.id not in already_report_photo_ids:
                db.add(models.ReportPhoto(
                    report_id=report.id,
                    file_path=report.image_url,
                    ai_confidence=report.ai_confidence,
                    ai_verified=(report.ai_confidence >= 0.5)
                        if report.ai_confidence is not None else None,
                    ai_mask_path=report.ai_mask_url,
                ))

        # Cleanup photos
        for report in db.query(models.Report).filter(models.Report.cleanup_image_url.isnot(None)).all():
            if report.id not in already_cleanup_photo_ids:
                wo = (
                    db.query(models.WorkOrder)
                    .filter(models.WorkOrder.report_id == report.id)
                    .order_by(models.WorkOrder.created_at.desc())
                    .first()
                )
                db.add(models.CleanupPhoto(
                    report_id=report.id,
                    work_order_id=wo.id if wo else None,
                    file_path=report.cleanup_image_url,
                ))
        db.commit()
    except Exception:
        logger.exception("Startup migration: photo backfill failed")
        db.rollback()
    finally:
        db.close()


_migrate_single_photos_to_tables()


def _log_orphan_pending_verifications() -> None:
    """Log a warning for any reports left in verification_pending=True after a crash.
    Re-queueing happens via the FastAPI startup hook below, which has access to the
    running event loop."""
    db = SessionLocal()
    try:
        rows = db.query(models.Report).filter(models.Report.verification_pending == True).all()
        if rows:
            ids = [r.id for r in rows]
            logger.warning("Found %d orphan pending verification(s) on startup: %s", len(rows), ids)
    finally:
        db.close()


_log_orphan_pending_verifications()

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
    phone_number: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CreateBarangayUserRequest(BaseModel):
    email: str
    full_name: str
    barangay_assignment: Optional[str] = None
    phone_number: Optional[str] = None
    role: Optional[str] = "barangay"  # citizen | barangay | cleaner | cenro


class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    barangay_assignment: Optional[str] = None


class CreateBarangayUserResponse(BaseModel):
    user: UserResponse
    temporary_password: str


class UpdateSlaConfigRequest(BaseModel):
    low_days: Optional[int] = None
    medium_days: Optional[int] = None
    high_days: Optional[int] = None
    compliance_target: Optional[int] = None


class CreateWorkOrderRequest(BaseModel):
    report_id: int
    assigned_cleaner_id: int
    priority: str = "medium"  # low | medium | high
    notes: Optional[str] = None


class ReassignWorkOrderRequest(BaseModel):
    assigned_cleaner_id: int


class UpdateWorkOrderPriorityRequest(BaseModel):
    priority: str  # low | medium | high


class ForceResolveWorkOrderRequest(BaseModel):
    reason: str  # min 10 chars


class WorkOrderResponse(BaseModel):
    id: int
    report_id: int
    assigned_cleaner_id: int
    assigned_cleaner_name: Optional[str] = None
    assigned_cleaner_email: Optional[str] = None
    priority: str
    sla_deadline: datetime
    status: str
    notes: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    report_tracking_id: Optional[str] = None
    report_barangay: Optional[str] = None
    report_lat: float
    report_lon: float
    report_image_url: Optional[str] = None
    report_status: str
    report_notes: Optional[str] = None
    report_cleanup_image_url: Optional[str] = None
    report_verification_pending: bool = False

    class Config:
        from_attributes = True


class SlaConfigResponse(BaseModel):
    low: int
    medium: int
    high: int
    compliance_target: int = 95


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
    deployment_notes: Optional[str] = None
    tracking_id: Optional[str] = None
    tracking_url: Optional[str] = None
    created_at: datetime
    deployed_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    verification_pending: bool = False
    trust_score: Optional[str] = None
    needs_human_review: bool = False
    failing_signals: List[str] = []
    photos: List[dict] = []

    class Config:
        from_attributes = True


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_new_password: str


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


def get_sla_policy(db: Session) -> dict:
    """Return current SLA policy: priority day counts + compliance target %."""
    rows = db.query(models.SystemConfig).filter(models.SystemConfig.key.in_(SLA_CONFIG_KEYS)).all()
    policy = {k: int(SLA_CONFIG_DEFAULTS[k]) for k in SLA_CONFIG_DEFAULTS}
    for row in rows:
        try:
            policy[row.key] = int(row.value)
        except (TypeError, ValueError):
            pass
    return {
        "low": policy["sla_low_days"],
        "medium": policy["sla_medium_days"],
        "high": policy["sla_high_days"],
        "compliance_target": policy["sla_compliance_target"],
    }


def compute_sla_deadline(db: Session, priority: str, anchor: Optional[datetime] = None) -> datetime:
    """deadline = anchor + sla_days_for_priority. Anchor defaults to now."""
    priority = (priority or "medium").lower()
    if priority not in PRIORITY_KEY_MAP:
        raise HTTPException(status_code=400, detail=f"priority must be one of {list(PRIORITY_KEY_MAP)}")
    policy = get_sla_policy(db)
    return (anchor or datetime.utcnow()) + timedelta(days=policy[priority])


def serialize_work_order(wo: models.WorkOrder) -> dict:
    """Flatten WorkOrder + joined Report/User fields into a dict for API responses."""
    return {
        "id": wo.id,
        "report_id": wo.report_id,
        "assigned_cleaner_id": wo.assigned_cleaner_id,
        "assigned_cleaner_name": wo.assigned_cleaner.full_name if wo.assigned_cleaner else None,
        "assigned_cleaner_email": wo.assigned_cleaner.email if wo.assigned_cleaner else None,
        "priority": wo.priority,
        "sla_deadline": wo.sla_deadline,
        "status": wo.status,
        "notes": wo.notes,
        "created_at": wo.created_at,
        "started_at": wo.started_at,
        "completed_at": wo.completed_at,
        "report_tracking_id": wo.report.tracking_id if wo.report else None,
        "report_barangay": wo.report.barangay if wo.report else None,
        "report_lat": wo.report.lat if wo.report else None,
        "report_lon": wo.report.lon if wo.report else None,
        "report_image_url": wo.report.image_url if wo.report else None,
        "report_status": wo.report.status if wo.report else None,
        "report_notes": wo.report.notes if wo.report else None,
        "report_cleanup_image_url": wo.report.cleanup_image_url if wo.report else None,
        "report_verification_pending": bool(wo.report.verification_pending) if wo.report else False,
    }


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

    user.last_login_at = datetime.utcnow()
    db.commit()

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
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("cenro", "barangay")),
):
    """
    List users with optional filters.
    CENRO sees all users.
    Barangay sees only cleaners in their own assignment.
    Newest first.
    """
    query = db.query(models.User)

    if user.role == "barangay":
        if not user.barangay_assignment:
            raise HTTPException(status_code=400, detail="Barangay user missing assignment")
        query = query.filter(
            models.User.role == "cleaner",
            models.User.barangay_assignment == user.barangay_assignment,
        )
    else:  # cenro
        if role:
            query = query.filter(models.User.role == role)

    if is_active is not None:
        query = query.filter(models.User.is_active == is_active)

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(models.User.full_name.ilike(term), models.User.email.ilike(term))
        )

    return query.order_by(models.User.created_at.desc()).all()


@app.post("/users", response_model=CreateBarangayUserResponse)
async def create_barangay_user(
    req: CreateBarangayUserRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_role("cenro", "barangay")),
):
    """
    Create a new user account.
    CENRO can create barangay or cleaner accounts.
    Barangay can only create cleaner accounts within their own barangay.
    Returns the auto-generated password once.
    """
    if not req.email or not req.full_name:
        raise HTTPException(status_code=400, detail="email and full_name are required")

    existing = db.query(models.User).filter(models.User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Determine role and barangay_assignment based on caller
    if admin.role == "barangay":
        if not admin.barangay_assignment:
            raise HTTPException(status_code=400, detail="Barangay user missing assignment")
        new_role = "cleaner"
        new_barangay = admin.barangay_assignment
    else:  # cenro
        new_role = (req.role or "barangay").lower()
        new_barangay = req.barangay_assignment
        if new_role not in ("citizen", "barangay", "cleaner", "cenro"):
            raise HTTPException(status_code=400, detail="role must be citizen, barangay, cleaner, or cenro")
        if new_role in ("barangay", "cleaner") and not new_barangay:
            raise HTTPException(status_code=400, detail="barangay_assignment required for barangay/cleaner roles")
        if new_role in ("citizen", "cenro"):
            new_barangay = None

    temporary_password = secrets.token_urlsafe(9)  # ~12 chars
    new_user = models.User(
        email=req.email,
        password_hash=hash_password(temporary_password),
        full_name=req.full_name,
        role=new_role,
        barangay_assignment=new_barangay,
        phone_number=req.phone_number,
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
    admin: models.User = Depends(require_role("cenro", "barangay")),
):
    """
    Soft-delete a user account by setting is_active=False.
    CENRO can disable any user.
    Barangay can only disable cleaners in their own barangay.
    """
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot disable your own account")

    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if not target.is_active:
        raise HTTPException(status_code=400, detail="User is already disabled")

    # Barangay can only disable cleaners in their barangay
    if admin.role == "barangay":
        if target.role != "cleaner" or target.barangay_assignment != admin.barangay_assignment:
            raise HTTPException(status_code=403, detail="Can only disable cleaners in your own barangay")

    target.is_active = False
    write_audit(
        db, admin.id, "disable_user", target.id,
        {"email": target.email, "previous_status": "active"},
        target_type="user",
    )
    db.commit()

    return {"success": True, "message": f"User {target.email} disabled."}





@app.put("/users/{user_id}/reactivate")
async def reactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_role("cenro", "barangay")),
):
    """Re-enable a previously disabled user account."""
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.is_active:
        raise HTTPException(status_code=400, detail="User is already active")
    if admin.role == "barangay":
        if target.role != "cleaner" or target.barangay_assignment != admin.barangay_assignment:
            raise HTTPException(status_code=403, detail="Can only reactivate cleaners in your own barangay")
    target.is_active = True
    write_audit(db, admin.id, "reactivate_user", target.id, {"email": target.email}, target_type="user")
    db.commit()
    return {"success": True, "message": f"User {target.email} reactivated."}


@app.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    req: UpdateUserRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_role("cenro", "barangay")),
):
    """Admin edit of a user profile (name, email, phone, barangay)."""
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if admin.role == "barangay":
        if target.role != "cleaner" or target.barangay_assignment != admin.barangay_assignment:
            raise HTTPException(status_code=403, detail="Can only edit cleaners in your own barangay")
    changed = []
    if req.full_name is not None:
        name = req.full_name.strip()
        if len(name) < 2 or len(name) > 100:
            raise HTTPException(status_code=422, detail="full_name must be 2-100 characters")
        target.full_name = name
        changed.append("full_name")
    if req.email is not None:
        email = req.email.strip().lower()
        if not email:
            raise HTTPException(status_code=422, detail="Email cannot be empty")
        conflict = db.query(models.User).filter(models.User.email == email, models.User.id != user_id).first()
        if conflict:
            raise HTTPException(status_code=400, detail="Email already in use")
        target.email = email
        changed.append("email")
    if req.phone_number is not None:
        target.phone_number = req.phone_number.strip() or None
        changed.append("phone_number")
    if req.barangay_assignment is not None and admin.role == "cenro":
        target.barangay_assignment = req.barangay_assignment or None
        changed.append("barangay_assignment")
    write_audit(db, admin.id, "edit_user", target.id, {"fields_changed": changed}, target_type="user")
    db.commit()
    db.refresh(target)
    return target


@app.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_role("cenro", "barangay")),
):
    """Generate a new temporary password for a user and return it once."""
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if admin.role == "barangay":
        if target.role != "cleaner" or target.barangay_assignment != admin.barangay_assignment:
            raise HTTPException(status_code=403, detail="Can only reset passwords for cleaners in your own barangay")
    temporary_password = secrets.token_urlsafe(9)
    target.password_hash = hash_password(temporary_password)
    write_audit(db, admin.id, "reset_password", target.id, {"email": target.email}, target_type="user")
    db.commit()
    return {"success": True, "email": target.email, "temporary_password": temporary_password}


@app.get("/users/export")
async def export_users_csv(
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_role("cenro", "barangay")),
):
    """Export users as CSV. Respects the same scoping as GET /users."""
    query = db.query(models.User)
    if admin.role == "barangay":
        if not admin.barangay_assignment:
            raise HTTPException(status_code=400, detail="Barangay user missing assignment")
        query = query.filter(models.User.role == "cleaner", models.User.barangay_assignment == admin.barangay_assignment)
    else:
        if role:
            query = query.filter(models.User.role == role)
    if is_active is not None:
        query = query.filter(models.User.is_active == is_active)
    users = query.order_by(models.User.created_at.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "email", "full_name", "role", "barangay_assignment", "phone_number", "is_active", "created_at", "last_login_at"])
    for u in users:
        writer.writerow([
            u.id, u.email, u.full_name, u.role,
            u.barangay_assignment or "", u.phone_number or "", u.is_active,
            u.created_at.isoformat() if u.created_at else "",
            u.last_login_at.isoformat() if u.last_login_at else "",
        ])
    output.seek(0)
    filename = f"ecowatch_accounts_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"})


@app.post("/users/import")
async def import_users_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_role("cenro")),
):
    """Bulk-import users from a CSV file. CENRO-only."""
    contents = await file.read()
    text_content = contents.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text_content))
    required_fields = {"email", "full_name", "role"}
    fieldnames = set(f.strip() for f in (reader.fieldnames or []))
    if not required_fields.issubset(fieldnames):
        raise HTTPException(status_code=400, detail=f"CSV must include columns: {', '.join(required_fields)}")
    results = []
    created = 0
    failed = 0
    for i, row in enumerate(reader, start=2):
        row = {k.strip(): (v.strip() if v else "") for k, v in row.items()}
        email = row.get("email", "").lower()
        full_name = row.get("full_name", "")
        role = row.get("role", "").lower()
        barangay = row.get("barangay_assignment", "") or None
        phone = row.get("phone_number", "") or None
        errors = []
        if not email: errors.append("email required")
        if not full_name: errors.append("full_name required")
        if role not in ("citizen", "barangay", "cleaner", "cenro"): errors.append(f"invalid role '{role}'")
        if role in ("barangay", "cleaner") and not barangay: errors.append("barangay_assignment required")
        if errors:
            results.append({"row": i, "email": email, "status": "error", "errors": errors})
            failed += 1
            continue
        existing = db.query(models.User).filter(models.User.email == email).first()
        if existing:
            results.append({"row": i, "email": email, "status": "error", "errors": ["email already registered"]})
            failed += 1
            continue
        temp_pw = secrets.token_urlsafe(9)
        new_user = models.User(
            email=email, password_hash=hash_password(temp_pw), full_name=full_name,
            role=role, barangay_assignment=barangay if role in ("barangay", "cleaner") else None,
            phone_number=phone, is_active=True,
        )
        db.add(new_user)
        db.flush()
        write_audit(db, admin.id, "import_user", new_user.id, {"email": email, "role": role}, target_type="user")
        results.append({"row": i, "email": email, "status": "created", "temporary_password": temp_pw})
        created += 1
    db.commit()
    return {"created": created, "failed": failed, "results": results}

# ─────────────────────────────────────────────────────────
# PROFILE MANAGEMENT (any authenticated user)
# ─────────────────────────────────────────────────────────

@app.get("/users/me")
async def get_my_profile(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the authenticated user's profile info + role-specific activity stats."""
    from datetime import timedelta

    stats: dict = {}
    recent_activity: list = []

    if current_user.role == "cenro":
        now = datetime.utcnow()
        thirty_days_ago = now - timedelta(days=30)
        sixty_days_ago = now - timedelta(days=60)

        total_reports = db.query(models.Report).count()
        recent_count = db.query(models.Report).filter(
            models.Report.created_at >= thirty_days_ago
        ).count()
        prior_count = db.query(models.Report).filter(
            models.Report.created_at >= sixty_days_ago,
            models.Report.created_at < thirty_days_ago,
        ).count()
        growth_pct = round(((recent_count - prior_count) / max(prior_count, 1)) * 100, 1)

        resolved_count = db.query(models.Report).filter(
            models.Report.status == models.ReportStatus.RESOLVED
        ).count()
        resolution_rate = round((resolved_count / max(total_reports, 1)) * 100, 1)

        pending_count = db.query(models.Report).filter(
            models.Report.status.in_([models.ReportStatus.PENDING, models.ReportStatus.VERIFIED])
        ).count()

        system_overrides = db.query(models.AuditLog).filter(
            models.AuditLog.user_id == current_user.id,
            models.AuditLog.action.in_(["reassign", "force_close", "update_sla_config"]),
        ).count()

        completed_wos = db.query(models.WorkOrder).filter(
            models.WorkOrder.status.in_(["completed", "verified"]),
            models.WorkOrder.completed_at.isnot(None),
        ).all()
        on_time = sum(1 for w in completed_wos if w.completed_at <= w.sla_deadline)
        sla_compliance = round((on_time / max(len(completed_wos), 1)) * 100, 1)

        stats = {
            "total_reports": total_reports,
            "growth_pct": growth_pct,
            "resolution_rate": resolution_rate,
            "pending_count": pending_count,
            "system_overrides": system_overrides,
            "sla_compliance": sla_compliance,
        }

        audit_rows = (
            db.query(models.AuditLog)
            .filter(models.AuditLog.user_id == current_user.id)
            .order_by(models.AuditLog.created_at.desc())
            .limit(8)
            .all()
        )
        recent_activity = [
            {
                "id": e.id,
                "action": e.action,
                "target_type": e.target_type,
                "target_id": e.target_id,
                "details": json.loads(e.details) if e.details else {},
                "created_at": e.created_at.isoformat(),
            }
            for e in audit_rows
        ]

    elif current_user.role == "barangay":
        brgy = current_user.barangay_assignment or ""
        brgy_q = db.query(models.Report).filter(models.Report.barangay == brgy)
        total_reports = brgy_q.count()
        resolved_count = brgy_q.filter(
            models.Report.status == models.ReportStatus.RESOLVED
        ).count()
        pending_count = brgy_q.filter(
            models.Report.status.in_([models.ReportStatus.PENDING, models.ReportStatus.VERIFIED])
        ).count()
        deployed_wos = (
            db.query(models.WorkOrder)
            .join(models.Report, models.WorkOrder.report_id == models.Report.id)
            .filter(models.Report.barangay == brgy)
            .count()
        )
        resolution_rate = round((resolved_count / max(total_reports, 1)) * 100, 1)
        stats = {
            "total_reports": total_reports,
            "resolved_count": resolved_count,
            "pending_count": pending_count,
            "deployed_work_orders": deployed_wos,
            "resolution_rate": resolution_rate,
        }
        recent_reports = (
            db.query(models.Report)
            .filter(models.Report.barangay == brgy)
            .order_by(models.Report.created_at.desc())
            .limit(5)
            .all()
        )
        recent_activity = [
            {
                "tracking_id": r.tracking_id,
                "status": r.status,
                "barangay": r.barangay,
                "created_at": r.created_at.isoformat(),
            }
            for r in recent_reports
        ]

    elif current_user.role == "cleaner":
        wos = db.query(models.WorkOrder).filter(
            models.WorkOrder.assigned_cleaner_id == current_user.id
        ).all()
        total_assigned = len(wos)
        in_progress = sum(1 for w in wos if w.status == "in_progress")
        completed = sum(1 for w in wos if w.status in ("completed", "verified"))
        on_time = sum(
            1 for w in wos
            if w.status in ("completed", "verified")
            and w.completed_at is not None
            and w.completed_at <= w.sla_deadline
        )
        sla_compliance = round((on_time / max(completed, 1)) * 100, 1)
        stats = {
            "total_assigned": total_assigned,
            "in_progress": in_progress,
            "completed": completed,
            "sla_compliance": sla_compliance,
        }
        recent_wos = (
            db.query(models.WorkOrder)
            .filter(models.WorkOrder.assigned_cleaner_id == current_user.id)
            .order_by(models.WorkOrder.created_at.desc())
            .limit(5)
            .all()
        )
        recent_activity = [
            {
                "id": w.id,
                "status": w.status,
                "priority": w.priority,
                "sla_deadline": w.sla_deadline.isoformat() if w.sla_deadline else None,
                "report_tracking_id": w.report.tracking_id if w.report else None,
                "created_at": w.created_at.isoformat(),
            }
            for w in recent_wos
        ]

    else:  # citizen
        my_reports = db.query(models.Report).filter(
            models.Report.reporter_id == current_user.id
        ).all()
        total_submitted = len(my_reports)
        pending = sum(1 for r in my_reports if r.status == models.ReportStatus.PENDING)
        verified = sum(1 for r in my_reports if r.status == models.ReportStatus.VERIFIED)
        resolved = sum(1 for r in my_reports if r.status == models.ReportStatus.RESOLVED)
        rejected = sum(1 for r in my_reports if r.status == models.ReportStatus.REJECTED)
        stats = {
            "total_submitted": total_submitted,
            "pending": pending,
            "verified": verified,
            "resolved": resolved,
            "rejected": rejected,
        }
        recent_reports = (
            db.query(models.Report)
            .filter(models.Report.reporter_id == current_user.id)
            .order_by(models.Report.created_at.desc())
            .limit(5)
            .all()
        )
        recent_activity = [
            {
                "tracking_id": r.tracking_id,
                "status": r.status,
                "barangay": r.barangay,
                "created_at": r.created_at.isoformat(),
            }
            for r in recent_reports
        ]

    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "barangay_assignment": current_user.barangay_assignment,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at.isoformat(),
        "stats": stats,
        "recent_activity": recent_activity,
    }


@app.put("/users/me", response_model=UserResponse)
async def update_my_profile(
    req: UpdateProfileRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the authenticated user's own full_name and/or email."""
    if req.full_name is None and req.email is None:
        raise HTTPException(status_code=400, detail="Nothing to update")

    changed = []

    if req.full_name is not None:
        name = req.full_name.strip()
        if len(name) < 2 or len(name) > 100:
            raise HTTPException(status_code=422, detail="full_name must be 2–100 characters")
        current_user.full_name = name
        changed.append("full_name")

    if req.email is not None:
        email = req.email.strip().lower()
        if not email:
            raise HTTPException(status_code=422, detail="Email cannot be empty")
        conflict = db.query(models.User).filter(
            models.User.email == email,
            models.User.id != current_user.id,
        ).first()
        if conflict:
            raise HTTPException(status_code=400, detail="Email already in use by another account")
        current_user.email = email
        changed.append("email")

    write_audit(
        db, current_user.id, "update_profile", current_user.id,
        {"fields_changed": changed},
        target_type="user",
    )
    db.commit()
    db.refresh(current_user)
    return current_user


@app.put("/users/me/password")
async def change_my_password(
    req: ChangePasswordRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change the authenticated user's own password after verifying the current one."""
    if not verify_password(req.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if req.new_password != req.confirm_new_password:
        raise HTTPException(status_code=400, detail="New passwords do not match")
    if len(req.new_password) < 8:
        raise HTTPException(status_code=422, detail="New password must be at least 8 characters")

    current_user.password_hash = hash_password(req.new_password)
    write_audit(
        db, current_user.id, "change_password", current_user.id,
        {},
        target_type="user",
    )
    db.commit()
    return {"success": True, "message": "Password updated successfully"}


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
# ASYNC AI VERIFICATION (background tasks)
# ─────────────────────────────────────────────────────────

def _disk_path_for_upload_url(upload_url: str) -> str:
    """Convert a stored '/uploads/foo.jpg' URL back to its filesystem path."""
    filename = os.path.basename(upload_url)
    return os.path.join(UPLOAD_DIR, filename)


def _save_mask_bytes(mask_bytes: bytes) -> Optional[str]:
    """Persist a generated AI mask image to disk and return its /uploads URL."""
    if not mask_bytes:
        return None
    mask_filename = f"mask_{uuid.uuid4().hex[:8]}.jpg"
    with open(os.path.join(UPLOAD_DIR, mask_filename), "wb") as f:
        f.write(mask_bytes)
    return f"/uploads/{mask_filename}"


def _get_report_failing_signals(photos: list) -> list:
    """Return failing_signals from the lowest-trust ReportPhoto, or [] if none."""
    priority = {"low": 0, "medium": 1, "high": 2}
    worst_photo = None
    worst_priority = 99
    for p in photos:
        score = getattr(p, "trust_score", None)
        if score and priority.get(score, 99) < worst_priority:
            worst_priority = priority[score]
            worst_photo = p
    if worst_photo and getattr(worst_photo, "trust_signals", None):
        try:
            return json.loads(worst_photo.trust_signals).get("failing_signals", [])
        except Exception:
            return []
    return []


async def _bg_verify_submit(report_id: int) -> None:
    """Background task: run Mask R-CNN on all evidence photos for a freshly-submitted report."""
    db = SessionLocal()
    try:
        report = db.query(models.Report).filter(models.Report.id == report_id).first()
        if not report:
            logger.warning("BG submit verify: report %s missing", report_id)
            return

        photo_rows = db.query(models.ReportPhoto).filter(
            models.ReportPhoto.report_id == report_id,
            models.ReportPhoto.ai_verified.is_(None),
        ).all()

        # Build list of (raw_bytes, db_row_or_None) pairs; skip missing files
        pairs: list[tuple[bytes, object]] = []
        if photo_rows:
            for row in photo_rows:
                try:
                    with open(_disk_path_for_upload_url(row.file_path), "rb") as f:
                        pairs.append((f.read(), row))
                except FileNotFoundError:
                    logger.warning("BG submit: missing file %s for report %s", row.file_path, report_id)
        elif report.image_url:
            # Legacy record — no photo table rows; fall back to image_url
            try:
                with open(_disk_path_for_upload_url(report.image_url), "rb") as f:
                    pairs.append((f.read(), None))
            except FileNotFoundError:
                logger.exception("BG submit: legacy image missing for report %s", report_id)

        if not pairs:
            report.status = models.ReportStatus.REJECTED
            report.verification_pending = False
            report.verification_kind = None
            db.commit()
            return

        results = await verify_images_async([b for b, _ in pairs])

        # ANY-wins: if any photo passes the threshold, the report is verified
        any_verified = any(r.get("verified") for r in results)
        best = max(results, key=lambda r: r.get("confidence", 0.0))

        # Update individual photo rows with per-photo AI results (no trust scoring yet)
        photo_bytes_for_trust: list[tuple[bytes, object]] = []
        for (img_bytes, row), result in zip(pairs, results):
            if row is not None:
                row.ai_confidence = result.get("confidence")
                row.ai_verified = bool(result.get("verified", False))
                if result.get("verified") and result.get("mask_bytes"):
                    row.ai_mask_path = _save_mask_bytes(result.get("mask_bytes"))
                photo_bytes_for_trust.append((img_bytes, row))

        # Run ALL trust scoring off the event loop in a single thread to avoid blocking
        def _run_trust_batch():
            results_trust = []
            for b, p in photo_bytes_for_trust:
                trust = compute_trust_score(b, report.lat, report.lon)
                results_trust.append((p, trust))
            return results_trust

        trust_results = await asyncio.to_thread(_run_trust_batch)
        for photo, trust_result in trust_results:
            photo.trust_score = trust_result["score"]
            photo.trust_signals = json.dumps(trust_result)

        # Compute aggregate trust score from the scored photos
        photo_scores = [p.trust_score for p, _ in trust_results if p.trust_score]
        if photo_scores:
            _trust_priority = {"low": 0, "medium": 1, "high": 2}
            worst_score = min(photo_scores, key=lambda s: _trust_priority.get(s, 99))
            report.trust_score = worst_score
            report.needs_human_review = (worst_score == "low")

        # Update report aggregate: use best passing result's mask (or best overall if none pass)
        report.ai_confidence = best.get("confidence")
        if any_verified:
            report.status = models.ReportStatus.VERIFIED
            passing = [
                (result, row)
                for (_, row), result in zip(pairs, results)
                if result.get("verified")
            ]
            best_pass_result = max(passing, key=lambda x: x[0].get("confidence", 0.0))[0]
            if best_pass_result.get("mask_bytes"):
                report.ai_mask_url = _save_mask_bytes(best_pass_result.get("mask_bytes"))
        else:
            report.status = models.ReportStatus.REJECTED

        report.verification_pending = False
        report.verification_kind = None

        if report.reporter_id:
            emit_notification(
                db, report.reporter_id,
                "verified" if report.status == models.ReportStatus.VERIFIED else "rejected",
                f"Report {report.tracking_id} {report.status}",
                "AI verification complete." if report.status == models.ReportStatus.VERIFIED
                else "AI did not detect waste in the photo.",
                report_id=report.id,
            )
        db.commit()
    except Exception:
        logger.exception("BG submit verify failed for report %s", report_id)
        db.rollback()
    finally:
        db.close()


async def _bg_verify_resolve(report_id: int, user_id: int) -> None:
    """Background task: AI re-verifies barangay-uploaded cleanup photos.
    Inverted logic: AI detecting waste = cleanup FAILED."""
    db = SessionLocal()
    try:
        report = db.query(models.Report).filter(models.Report.id == report_id).first()
        if not report:
            return

        cleanup_rows = db.query(models.CleanupPhoto).filter(
            models.CleanupPhoto.report_id == report_id,
            models.CleanupPhoto.work_order_id.is_(None),
            models.CleanupPhoto.ai_verified.is_(None),
        ).all()

        pairs: list[tuple[bytes, object]] = []
        if cleanup_rows:
            for row in cleanup_rows:
                try:
                    with open(_disk_path_for_upload_url(row.file_path), "rb") as f:
                        pairs.append((f.read(), row))
                except FileNotFoundError:
                    logger.warning("BG resolve: missing file %s", row.file_path)
        elif report.cleanup_image_url:
            try:
                with open(_disk_path_for_upload_url(report.cleanup_image_url), "rb") as f:
                    pairs.append((f.read(), None))
            except FileNotFoundError:
                logger.exception("BG resolve: legacy cleanup image missing for report %s", report_id)

        if not pairs:
            report.verification_pending = False
            report.verification_kind = None
            db.commit()
            return

        results = await verify_images_async([b for b, _ in pairs])
        # ANY photo still showing waste = cleanup failed (inverted: waste detected = bad)
        any_waste_detected = any(r.get("verified") for r in results)

        for (_, row), result in zip(pairs, results):
            if row is not None:
                row.ai_confidence = result.get("confidence")
                row.ai_verified = bool(result.get("verified", False))

        if any_waste_detected:
            report.status = models.ReportStatus.FAILED_CLEANUP
        else:
            report.status = models.ReportStatus.RESOLVED
            report.resolved_at = datetime.utcnow()
        report.verification_pending = False
        report.verification_kind = None

        write_audit(db, user_id, "resolve", report.id, {
            "tracking_id": report.tracking_id,
            "outcome": report.status,
        })
        db.commit()
    except Exception:
        logger.exception("BG resolve verify failed for report %s", report_id)
        db.rollback()
    finally:
        db.close()


async def _bg_verify_complete(work_order_id: int, user_id: int) -> None:
    """Background task: AI re-verifies cleaner-uploaded cleanup photos on a WO.
    Inverted logic: AI detecting waste = cleanup FAILED."""
    db = SessionLocal()
    try:
        wo = db.query(models.WorkOrder).filter(models.WorkOrder.id == work_order_id).first()
        if not wo or not wo.report:
            logger.warning("BG complete verify: work order %s missing context", work_order_id)
            return
        report = wo.report

        cleanup_rows = db.query(models.CleanupPhoto).filter(
            models.CleanupPhoto.work_order_id == work_order_id,
            models.CleanupPhoto.ai_verified.is_(None),
        ).all()

        pairs: list[tuple[bytes, object]] = []
        if cleanup_rows:
            for row in cleanup_rows:
                try:
                    with open(_disk_path_for_upload_url(row.file_path), "rb") as f:
                        pairs.append((f.read(), row))
                except FileNotFoundError:
                    logger.warning("BG complete: missing file %s", row.file_path)
        elif report.cleanup_image_url:
            try:
                with open(_disk_path_for_upload_url(report.cleanup_image_url), "rb") as f:
                    pairs.append((f.read(), None))
            except FileNotFoundError:
                logger.exception("BG complete: legacy cleanup image missing for WO %s", work_order_id)

        if not pairs:
            report.verification_pending = False
            report.verification_kind = None
            db.commit()
            return

        results = await verify_images_async([b for b, _ in pairs])
        any_waste_detected = any(r.get("verified") for r in results)

        for (_, row), result in zip(pairs, results):
            if row is not None:
                row.ai_confidence = result.get("confidence")
                row.ai_verified = bool(result.get("verified", False))

        if any_waste_detected:
            wo.status = models.WorkOrderStatus.NEEDS_REDO
            report.status = models.ReportStatus.FAILED_CLEANUP
            emit_notification(
                db, wo.assigned_cleaner_id, "needs_redo",
                f"Cleanup needs redo: {report.tracking_id}",
                "AI still detected waste. Please clean more thoroughly and try again.",
                work_order_id=wo.id, report_id=report.id,
            )
        else:
            wo.status = models.WorkOrderStatus.VERIFIED
            report.status = models.ReportStatus.RESOLVED
            report.resolved_at = datetime.utcnow()
            emit_notification(
                db, wo.assigned_cleaner_id, "verified",
                f"Job verified: {report.tracking_id}",
                "AI confirmed cleanup. Thank you!",
                work_order_id=wo.id, report_id=report.id,
            )
        report.verification_pending = False
        report.verification_kind = None

        write_audit(db, user_id, "complete_work_order", report.id, {
            "work_order_id": wo.id,
            "tracking_id": report.tracking_id,
            "outcome": wo.status,
        })
        db.commit()
    except Exception:
        logger.exception("BG complete verify failed for WO %s", work_order_id)
        db.rollback()
    finally:
        db.close()


@app.on_event("startup")
async def _resume_orphan_verifications() -> None:
    """Re-dispatch background AI tasks for reports that were mid-verification when
    the server stopped. Looks up the kind in `verification_kind` to pick the right BG fn."""
    db = SessionLocal()
    try:
        orphans = db.query(models.Report).filter(
            models.Report.verification_pending == True
        ).all()
        for r in orphans:
            kind = r.verification_kind
            if kind == "submit":
                asyncio.create_task(_bg_verify_submit(r.id))
            elif kind == "resolve":
                # Recovery loses the original triggering user_id; use 0 as a sentinel
                # for system-recovered audits.
                asyncio.create_task(_bg_verify_resolve(r.id, 0))
            elif kind == "complete":
                wo = (
                    db.query(models.WorkOrder)
                    .filter(
                        models.WorkOrder.report_id == r.id,
                        models.WorkOrder.status == models.WorkOrderStatus.IN_PROGRESS,
                    )
                    .order_by(models.WorkOrder.created_at.desc())
                    .first()
                )
                if wo:
                    asyncio.create_task(_bg_verify_complete(wo.id, wo.assigned_cleaner_id or 0))
                else:
                    logger.warning("Orphan report %s has kind=complete but no IN_PROGRESS WO", r.id)
            else:
                logger.warning("Orphan report %s has unknown verification_kind=%s", r.id, kind)
        if orphans:
            logger.info("Re-dispatched %d orphan verification(s) on startup", len(orphans))
    finally:
        db.close()


# ─────────────────────────────────────────────────────────
# REPORT SUBMISSION
# ─────────────────────────────────────────────────────────

@app.post("/report/submit", status_code=202)
async def submit_report(
    background_tasks: BackgroundTasks,
    lat: float = Form(...),
    lon: float = Form(...),
    notes: Optional[str] = Form(None),
    reporter_id: Optional[int] = Form(None),
    images: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    """
    Citizen report submission. Accepts 1–5 evidence photos.
    Returns 202 immediately; Mask R-CNN runs in a background task.
    Frontend polls /report/track/{slug} until `verification_pending` flips to false.
    """
    if not (1 <= len(images) <= 5):
        raise HTTPException(status_code=422, detail="Upload between 1 and 5 photos.")

    # Save each photo; skip bad files but proceed if at least one succeeds
    saved_urls: list[str] = []
    for img in images:
        try:
            img_bytes = await img.read()
            url = await save_upload(img, prefix="report", contents=img_bytes)
            saved_urls.append(url)
        except HTTPException:
            pass  # skip invalid file; continue with the rest

    if not saved_urls:
        raise HTTPException(status_code=422, detail="No photos could be saved. Please try again.")

    spatial_result = spatial_utils.get_barangay_from_coords(lat, lon)
    barangay = spatial_result.get("barangay") if "error" not in spatial_result else "Unknown"

    tracking_id = generate_tracking_id(db)
    tracking_slug = generate_tracking_slug()
    tracking_url = f"/track/{tracking_slug}"

    new_report = models.Report(
        lat=lat,
        lon=lon,
        barangay=barangay,
        reporter_id=reporter_id,
        image_url=saved_urls[0],  # backward compat: first photo
        status=models.ReportStatus.PENDING,
        notes=notes,
        tracking_id=tracking_id,
        tracking_url=tracking_url,
        verification_pending=True,
        verification_kind="submit",
    )
    db.add(new_report)
    db.commit()
    db.refresh(new_report)

    for url in saved_urls:
        db.add(models.ReportPhoto(report_id=new_report.id, file_path=url))
    db.commit()

    background_tasks.add_task(_bg_verify_submit, new_report.id)

    return {
        "success": True,
        "message": "Report received. AI verification is running in the background.",
        "report_id": new_report.id,
        "tracking_id": tracking_id,
        "tracking_url": tracking_url,
        "barangay_assigned": barangay,
        "status": new_report.status,
        "verification_pending": True,
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
        report = db.query(models.Report).filter(
            models.Report.tracking_id == tracking_slug
        ).first()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    response = ReportResponse.model_validate(report)
    photo_rows = db.query(models.ReportPhoto).filter(
        models.ReportPhoto.report_id == report.id
    ).all()
    response.photos = [
        {
            "url": p.file_path,
            "mask_url": p.ai_mask_path,
            "ai_confidence": p.ai_confidence,
            "ai_verified": p.ai_verified,
            "trust_score": getattr(p, "trust_score", None),
            "failing_signals": json.loads(getattr(p, "trust_signals", None) or "{}").get("failing_signals", []),
        }
        for p in photo_rows
    ]
    # Attach report-level trust signals from the lowest-trust photo
    response.failing_signals = _get_report_failing_signals(photo_rows)
    return response

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
        db.query(models.Report).options(joinedload(models.Report.report_photos)),
        status, date_from, date_to, search
    )
    reports = (
        query.order_by(models.Report.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    results = []
    for report in reports:
        r = ReportResponse.model_validate(report)
        r.failing_signals = _get_report_failing_signals(list(report.report_photos))
        results.append(r)
    return results


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
    query = db.query(models.Report).options(joinedload(models.Report.report_photos)).filter(
        models.Report.barangay == name
    )
    query = _apply_report_filters(query, status, date_from, date_to, search)
    reports = (
        query.order_by(models.Report.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    results = []
    for report in reports:
        r = ReportResponse.model_validate(report)
        r.failing_signals = _get_report_failing_signals(list(report.report_photos))
        results.append(r)
    return results


@app.get("/reports/sla-breaches", response_model=List[ReportResponse])
async def get_sla_breaches(db: Session = Depends(get_db)):
    """
    List reports with active work orders past their SLA deadline.
    A work order is "active" if its status is not completed or verified.
    """
    now = datetime.utcnow()
    # Find all reports with at least one active work order past deadline
    breached_reports = (
        db.query(models.Report)
        .options(joinedload(models.Report.report_photos))
        .join(models.WorkOrder, models.Report.id == models.WorkOrder.report_id)
        .filter(
            models.WorkOrder.status.in_([
                models.WorkOrderStatus.ASSIGNED,
                models.WorkOrderStatus.IN_PROGRESS,
                models.WorkOrderStatus.NEEDS_REDO,
            ]),
            models.WorkOrder.sla_deadline < now,
        )
        .distinct()
        .order_by(models.Report.created_at.asc())
        .all()
    )
    results = []
    for report in breached_reports:
        r = ReportResponse.model_validate(report)
        r.failing_signals = _get_report_failing_signals(list(report.report_photos))
        results.append(r)
    return results


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

@app.put("/report/{report_id}/assign")
async def assign_report(
    report_id: int,
    deployment_notes: Optional[str] = Form(None),
    priority: Optional[str] = Form(None),
    assigned_cleaner_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("barangay")),
):
    """
    Barangay marks a report as assigned for cleanup.
    If priority + assigned_cleaner_id provided, create a formal WorkOrder.
    Otherwise, just mark as assigned without work order.
    """
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.barangay != user.barangay_assignment:
        raise HTTPException(status_code=403, detail="Cannot assign a report outside your barangay")

    if report.status != models.ReportStatus.VERIFIED:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot assign. Report status is '{report.status}', must be 'verified'."
        )

    notes_clean = (deployment_notes or "").strip() or None
    report.status = models.ReportStatus.ASSIGNED
    report.deployed_at = datetime.utcnow()
    report.deployment_notes = notes_clean

    # If both priority and cleaner_id provided, create a WorkOrder
    if priority and assigned_cleaner_id:
        cleaner = db.query(models.User).filter(
            models.User.id == assigned_cleaner_id,
            models.User.role == "cleaner",
            models.User.is_active == True,
        ).first()
        if not cleaner:
            raise HTTPException(status_code=404, detail="Cleaner not found or inactive")

        sla_deadline = compute_sla_deadline(db, priority, datetime.utcnow())
        work_order = models.WorkOrder(
            report_id=report_id,
            assigned_cleaner_id=assigned_cleaner_id,
            priority=priority.lower(),
            sla_deadline=sla_deadline,
            status=models.WorkOrderStatus.ASSIGNED,
            notes=notes_clean,
        )
        db.add(work_order)
        db.flush()  # populate work_order.id for the notification FK
        write_audit(db, user.id, "create_work_order", report.id, {
            "tracking_id": report.tracking_id,
            "assigned_cleaner_id": assigned_cleaner_id,
            "priority": priority,
            "sla_deadline": sla_deadline.isoformat(),
        })
        emit_notification(
            db, assigned_cleaner_id, "job_assigned",
            f"New job assigned: {report.tracking_id}",
            f"Priority: {priority.upper()}. Deadline: {sla_deadline.strftime('%b %d %I:%M %p')}",
            work_order_id=work_order.id, report_id=report.id,
        )
    else:
        # Just mark as assigned without work order
        write_audit(db, user.id, "assign", report.id, {
            "tracking_id": report.tracking_id,
            **({"deployment_notes": notes_clean[:500]} if notes_clean else {})
        })

    db.commit()
    db.refresh(report)

    return {
        "success": True,
        "message": f"Report {report.tracking_id} assigned successfully.",
        "report": ReportResponse.model_validate(report)
    }

@app.post("/report/{report_id}/resolve", status_code=202)
async def resolve_report(
    report_id: int,
    background_tasks: BackgroundTasks,
    cleanup_images: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("barangay")),
):
    """
    Barangay uploads cleanup photos (1–5). AI runs in background.
    Returns 202 immediately; frontend polls the report until
    `verification_pending` flips to false to see RESOLVED / FAILED_CLEANUP.
    """
    if not (1 <= len(cleanup_images) <= 5):
        raise HTTPException(status_code=422, detail="Upload between 1 and 5 photos.")

    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.status not in (models.ReportStatus.ASSIGNED, models.ReportStatus.IN_PROGRESS):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot resolve. Report status is '{report.status}', must be 'assigned' or 'in_progress'."
        )

    saved_urls: list[str] = []
    for img in cleanup_images:
        try:
            img_bytes = await img.read()
            url = await save_upload(img, prefix="cleanup", contents=img_bytes)
            saved_urls.append(url)
        except HTTPException as e:
            logger.warning("resolve_report: skipping photo that failed validation: %s", e.detail)

    if not saved_urls:
        raise HTTPException(status_code=422, detail="No photos could be saved. Please try again.")

    report.cleanup_image_url = saved_urls[0]  # backward compat
    report.verification_pending = True
    report.verification_kind = "resolve"
    db.commit()

    for url in saved_urls:
        db.add(models.CleanupPhoto(
            report_id=report.id,
            work_order_id=None,
            file_path=url,
        ))
    db.commit()
    db.refresh(report)

    background_tasks.add_task(_bg_verify_resolve, report.id, user.id)

    return {
        "success": True,
        "message": f"Cleanup photo received for {report.tracking_id}. AI verification running.",
        "status": report.status,
        "verification_pending": True,
        "report": ReportResponse.model_validate(report),
    }


# ─────────────────────────────────────────────────────────
# WORK ORDERS & SLA POLICY
# ─────────────────────────────────────────────────────────

@app.post("/work-orders")
async def create_work_order(
    req: CreateWorkOrderRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("barangay")),
):
    """Barangay creates a work order from a VERIFIED report. Sets Report status to ASSIGNED."""
    report = db.query(models.Report).filter(models.Report.id == req.report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.barangay != user.barangay_assignment:
        raise HTTPException(status_code=403, detail="Cannot create work order for a report outside your barangay")

    if report.status != models.ReportStatus.VERIFIED:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot create work order. Report status is '{report.status}', must be 'verified'."
        )

    # Verify cleaner exists and is active
    cleaner = db.query(models.User).filter(
        models.User.id == req.assigned_cleaner_id,
        models.User.role == "cleaner",
        models.User.is_active == True,
    ).first()
    if not cleaner:
        raise HTTPException(status_code=404, detail="Cleaner not found or inactive")

    # Compute SLA deadline based on priority
    sla_deadline = compute_sla_deadline(db, req.priority, datetime.utcnow())

    # Create work order
    work_order = models.WorkOrder(
        report_id=req.report_id,
        assigned_cleaner_id=req.assigned_cleaner_id,
        priority=req.priority.lower(),
        sla_deadline=sla_deadline,
        status=models.WorkOrderStatus.ASSIGNED,
        notes=req.notes,
    )

    db.add(work_order)
    db.flush()  # populate work_order.id for the notification FK
    report.status = models.ReportStatus.ASSIGNED
    report.deployed_at = datetime.utcnow()

    write_audit(db, user.id, "create_work_order", report.id, {
        "tracking_id": report.tracking_id,
        "assigned_cleaner_id": req.assigned_cleaner_id,
        "priority": req.priority,
        "sla_deadline": sla_deadline.isoformat(),
    })
    emit_notification(
        db, req.assigned_cleaner_id, "job_assigned",
        f"New job assigned: {report.tracking_id}",
        f"Priority: {req.priority.upper()}. Deadline: {sla_deadline.strftime('%b %d %I:%M %p')}",
        work_order_id=work_order.id, report_id=report.id,
    )
    db.commit()
    db.refresh(work_order)

    return {
        "success": True,
        "message": f"Work order created for {report.tracking_id}.",
        "work_order": serialize_work_order(work_order),
    }


@app.get("/work-orders")
async def list_work_orders(
    status: Optional[str] = None,
    barangay: Optional[str] = None,
    cleaner_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("cenro", "barangay")),
):
    """
    List work orders with optional filters.
    Barangay users see only work orders in their assigned barangay.
    """
    query = db.query(models.WorkOrder)

    # Role-based scoping
    if user.role == "barangay":
        if not user.barangay_assignment:
            raise HTTPException(status_code=400, detail="Barangay user missing assignment")
        query = query.join(models.Report).filter(models.Report.barangay == user.barangay_assignment)

    # Filters
    if status:
        query = query.filter(models.WorkOrder.status == status.lower())
    if barangay and user.role == "cenro":  # only CENRO can filter by barangay
        query = query.join(models.Report).filter(models.Report.barangay == barangay)
    if cleaner_id:
        query = query.filter(models.WorkOrder.assigned_cleaner_id == cleaner_id)

    rows = query.order_by(models.WorkOrder.created_at.desc()).all()
    return [serialize_work_order(wo) for wo in rows]


@app.get("/work-orders/cleaner/{cleaner_id}")
async def get_cleaner_work_orders(
    cleaner_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("cleaner", "cenro")),
):
    """
    Cleaner views their own work orders.
    CENRO can view any cleaner's work orders.
    """
    if user.role == "cleaner" and user.id != cleaner_id:
        raise HTTPException(status_code=403, detail="Can only view your own work orders")

    rows = (
        db.query(models.WorkOrder)
        .filter(models.WorkOrder.assigned_cleaner_id == cleaner_id)
        .order_by(models.WorkOrder.created_at.desc())
        .all()
    )
    return [serialize_work_order(wo) for wo in rows]


@app.put("/work-orders/{work_order_id}/start")
async def start_work_order(
    work_order_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("cleaner")),
):
    """Cleaner marks a work order as in_progress."""
    wo = db.query(models.WorkOrder).filter(models.WorkOrder.id == work_order_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    if wo.assigned_cleaner_id != user.id:
        raise HTTPException(status_code=403, detail="Can only start your own work orders")

    if wo.status != models.WorkOrderStatus.ASSIGNED:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot start. Status is '{wo.status}', must be 'assigned'."
        )

    wo.status = models.WorkOrderStatus.IN_PROGRESS
    wo.started_at = datetime.utcnow()
    if wo.report:
        wo.report.status = models.ReportStatus.IN_PROGRESS

    write_audit(db, user.id, "start_work_order", wo.report_id, {
        "work_order_id": wo.id,
        "tracking_id": wo.report.tracking_id if wo.report else None,
    })
    db.commit()
    db.refresh(wo)

    return {
        "success": True,
        "message": "Work order started.",
        "work_order": serialize_work_order(wo),
    }


@app.put("/work-orders/{work_order_id}/complete", status_code=202)
async def complete_work_order(
    work_order_id: int,
    background_tasks: BackgroundTasks,
    cleanup_images: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("cleaner")),
):
    """
    Cleaner uploads cleanup photos (1–5). AI runs in background.
    Returns 202 immediately; WO stays IN_PROGRESS with `report_verification_pending=true`
    until the BG task flips it to VERIFIED or NEEDS_REDO.
    """
    if not (1 <= len(cleanup_images) <= 5):
        raise HTTPException(status_code=422, detail="Upload between 1 and 5 photos.")

    wo = db.query(models.WorkOrder).filter(models.WorkOrder.id == work_order_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    if wo.assigned_cleaner_id != user.id:
        raise HTTPException(status_code=403, detail="Can only complete your own work orders")

    if wo.status not in (models.WorkOrderStatus.IN_PROGRESS, models.WorkOrderStatus.NEEDS_REDO):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot complete. Status is '{wo.status}', must be 'in_progress' or 'needs_redo'."
        )

    report = wo.report
    if not report:
        raise HTTPException(status_code=404, detail="Associated report not found")

    if wo.status == models.WorkOrderStatus.NEEDS_REDO:
        wo.status = models.WorkOrderStatus.IN_PROGRESS
        report.status = models.ReportStatus.IN_PROGRESS

    saved_urls: list[str] = []
    for img in cleanup_images:
        try:
            img_bytes = await img.read()
            url = await save_upload(img, prefix="cleanup", contents=img_bytes)
            saved_urls.append(url)
        except HTTPException as e:
            logger.warning("complete_work_order: skipping photo that failed validation: %s", e.detail)

    if not saved_urls:
        raise HTTPException(status_code=422, detail="No photos could be saved. Please try again.")

    report.cleanup_image_url = saved_urls[0]  # backward compat
    report.verification_pending = True
    report.verification_kind = "complete"
    wo.completed_at = datetime.utcnow()
    db.commit()

    for url in saved_urls:
        db.add(models.CleanupPhoto(
            report_id=report.id,
            work_order_id=wo.id,
            file_path=url,
        ))
    db.commit()
    db.refresh(wo)
    db.refresh(report)

    background_tasks.add_task(_bg_verify_complete, wo.id, user.id)

    return {
        "success": True,
        "message": f"Cleanup photo received for {report.tracking_id}. AI verification running.",
        "verification_pending": True,
        "work_order": serialize_work_order(wo),
    }


@app.put("/work-orders/{work_order_id}/reassign")
async def reassign_work_order(
    work_order_id: int,
    req: ReassignWorkOrderRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("barangay")),
):
    """Barangay reassigns a work order to a different cleaner. Only allowed while status is 'assigned'."""
    wo = db.query(models.WorkOrder).filter(models.WorkOrder.id == work_order_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    if wo.status != models.WorkOrderStatus.ASSIGNED:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reassign. Status is '{wo.status}', must be 'assigned'."
        )

    new_cleaner = db.query(models.User).filter(
        models.User.id == req.assigned_cleaner_id,
        models.User.role == "cleaner",
        models.User.is_active == True,
    ).first()
    if not new_cleaner:
        raise HTTPException(status_code=404, detail="Cleaner not found or inactive")

    old_cleaner_id = wo.assigned_cleaner_id
    wo.assigned_cleaner_id = req.assigned_cleaner_id

    write_audit(db, user.id, "reassign_work_order", wo.report_id, {
        "work_order_id": wo.id,
        "tracking_id": wo.report.tracking_id if wo.report else None,
        "from_cleaner_id": old_cleaner_id,
        "to_cleaner_id": req.assigned_cleaner_id,
    })
    tracking_id = wo.report.tracking_id if wo.report else f"#{wo.id}"
    if old_cleaner_id and old_cleaner_id != req.assigned_cleaner_id:
        emit_notification(
            db, old_cleaner_id, "reassigned",
            f"Job reassigned: {tracking_id}",
            "This job has been moved to another cleaner.",
            work_order_id=wo.id, report_id=wo.report_id,
        )
    emit_notification(
        db, req.assigned_cleaner_id, "job_assigned",
        f"New job assigned: {tracking_id}",
        f"Priority: {wo.priority.upper()}. Deadline: {wo.sla_deadline.strftime('%b %d %I:%M %p')}",
        work_order_id=wo.id, report_id=wo.report_id,
    )
    db.commit()
    db.refresh(wo)

    return {
        "success": True,
        "message": "Work order reassigned.",
        "work_order": serialize_work_order(wo),
    }


@app.put("/work-orders/{work_order_id}/priority")
async def update_work_order_priority(
    work_order_id: int,
    req: UpdateWorkOrderPriorityRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("barangay")),
):
    """Barangay changes the priority of a work order and recomputes the SLA deadline."""
    wo = db.query(models.WorkOrder).filter(models.WorkOrder.id == work_order_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    ALLOWED_STATUSES = {
        models.WorkOrderStatus.ASSIGNED,
        models.WorkOrderStatus.IN_PROGRESS,
        models.WorkOrderStatus.NEEDS_REDO,
    }
    if wo.status not in ALLOWED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot change priority. Status is '{wo.status}'."
        )

    new_priority = req.priority.lower()
    if new_priority not in ("low", "medium", "high"):
        raise HTTPException(status_code=400, detail="priority must be 'low', 'medium', or 'high'")

    old_priority = wo.priority
    wo.priority = new_priority
    wo.sla_deadline = compute_sla_deadline(db, new_priority, anchor=wo.created_at)

    write_audit(db, user.id, "change_priority", wo.report_id, {
        "work_order_id": wo.id,
        "tracking_id": wo.report.tracking_id if wo.report else None,
        "from_priority": old_priority,
        "to_priority": new_priority,
        "new_sla_deadline": wo.sla_deadline.isoformat() if wo.sla_deadline else None,
    })
    tracking_id = wo.report.tracking_id if wo.report else f"#{wo.id}"
    emit_notification(
        db, wo.assigned_cleaner_id, "priority_changed",
        f"Priority changed: {tracking_id}",
        f"Updated from {old_priority.upper()} to {new_priority.upper()}. New deadline: {wo.sla_deadline.strftime('%b %d %I:%M %p')}",
        work_order_id=wo.id, report_id=wo.report_id,
    )
    db.commit()
    db.refresh(wo)

    return {
        "success": True,
        "message": f"Priority changed to {new_priority}. SLA deadline recomputed.",
        "work_order": serialize_work_order(wo),
    }


@app.put("/work-orders/{work_order_id}/force-resolve")
async def force_resolve_work_order(
    work_order_id: int,
    req: ForceResolveWorkOrderRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("barangay")),
):
    """
    Barangay force-closes a needs_redo work order as resolved, bypassing AI re-verification.
    Requires a written reason (min 10 chars).
    """
    wo = db.query(models.WorkOrder).filter(models.WorkOrder.id == work_order_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    if wo.status != models.WorkOrderStatus.NEEDS_REDO:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot force-resolve. Status is '{wo.status}', must be 'needs_redo'."
        )

    reason = req.reason.strip()
    if len(reason) < 10:
        raise HTTPException(status_code=400, detail="reason must be at least 10 characters")

    report = wo.report
    if not report:
        raise HTTPException(status_code=404, detail="Associated report not found")

    wo.status = models.WorkOrderStatus.VERIFIED
    wo.completed_at = wo.completed_at or datetime.utcnow()
    wo.notes = f"{wo.notes or ''}\n[Force-resolved by barangay: {reason}]".strip()

    report.status = models.ReportStatus.RESOLVED
    report.resolved_at = datetime.utcnow()

    write_audit(db, user.id, "force_resolve_work_order", report.id, {
        "work_order_id": wo.id,
        "tracking_id": report.tracking_id,
        "reason": reason,
    })
    emit_notification(
        db, wo.assigned_cleaner_id, "force_resolved",
        f"Job force-resolved: {report.tracking_id}",
        "Your supervisor closed this work order manually.",
        work_order_id=wo.id, report_id=report.id,
    )
    db.commit()
    db.refresh(wo)
    db.refresh(report)

    return {
        "success": True,
        "message": "Work order force-resolved. Report marked as resolved.",
        "work_order": serialize_work_order(wo),
    }


@app.get("/config/sla")
async def get_sla_config(db: Session = Depends(get_db)):
    """Get current SLA policy (public endpoint)."""
    policy = get_sla_policy(db)
    return policy


@app.put("/config/sla")
async def update_sla_config(
    req: UpdateSlaConfigRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("cenro")),
):
    """CENRO updates the SLA policy. Audit-logged."""
    # Collect old values for audit trail
    old_policy = get_sla_policy(db)
    updates = {}

    if req.low_days is not None:
        if req.low_days < 1 or req.low_days > 365:
            raise HTTPException(status_code=400, detail="low_days must be between 1 and 365")
        updates["sla_low_days"] = str(req.low_days)
    if req.medium_days is not None:
        if req.medium_days < 1 or req.medium_days > 365:
            raise HTTPException(status_code=400, detail="medium_days must be between 1 and 365")
        updates["sla_medium_days"] = str(req.medium_days)
    if req.high_days is not None:
        if req.high_days < 1 or req.high_days > 365:
            raise HTTPException(status_code=400, detail="high_days must be between 1 and 365")
        updates["sla_high_days"] = str(req.high_days)
    if req.compliance_target is not None:
        if req.compliance_target < 0 or req.compliance_target > 100:
            raise HTTPException(status_code=400, detail="compliance_target must be between 0 and 100")
        updates["sla_compliance_target"] = str(req.compliance_target)

    if not updates:
        return old_policy  # No changes

    # Update config rows
    for key, value in updates.items():
        row = db.query(models.SystemConfig).filter(models.SystemConfig.key == key).first()
        if row:
            row.value = value
            row.updated_by = user.id
            row.updated_at = datetime.utcnow()
        else:
            # Shouldn't happen due to seeding, but handle it
            db.add(models.SystemConfig(key=key, value=value, updated_by=user.id))

    write_audit(db, user.id, "update_sla_config", None, {
        "old_policy": old_policy,
        "new_policy": {k.replace("sla_", "").replace("_days", ""): int(v) for k, v in updates.items()},
    }, target_type="config")

    db.commit()
    new_policy = get_sla_policy(db)
    return new_policy


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


@app.put("/report/{report_id}/retry")
async def retry_report(
    report_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("barangay")),
):
    """Barangay retries a failed cleanup by reassigning the report."""
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.status != models.ReportStatus.FAILED_CLEANUP:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot retry. Report status is '{report.status}', must be 'failed_cleanup'."
        )

    report.status = models.ReportStatus.ASSIGNED
    write_audit(db, user.id, "retry_report", report.id, {
        "tracking_id": report.tracking_id,
    })
    db.commit()
    db.refresh(report)

    return {"success": True, "message": "Report reassigned for retry."}


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
            models.ReportStatus.ASSIGNED,
            models.ReportStatus.IN_PROGRESS,
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
    assigned = db.query(models.Report).filter(models.Report.status == models.ReportStatus.ASSIGNED).count()
    in_progress = db.query(models.Report).filter(models.Report.status == models.ReportStatus.IN_PROGRESS).count()
    resolved = db.query(models.Report).filter(models.Report.status == models.ReportStatus.RESOLVED).count()
    rejected = db.query(models.Report).filter(models.Report.status == models.ReportStatus.REJECTED).count()
    failed = db.query(models.Report).filter(models.Report.status == models.ReportStatus.FAILED_CLEANUP).count()

    return {
        "total": total,
        "active": pending + verified,
        "assigned": assigned,
        "in_progress": in_progress,
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
            barangay_stats[name] = {"total": 0, "resolved": 0, "pending": 0, "assigned": 0}
        barangay_stats[name]["total"] += 1
        if report.status == models.ReportStatus.RESOLVED:
            barangay_stats[name]["resolved"] += 1
        elif report.status in (models.ReportStatus.ASSIGNED, models.ReportStatus.IN_PROGRESS):
            barangay_stats[name]["assigned"] += 1
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
            "assigned": stats["assigned"],
            "pending": stats["pending"],
            "resolution_rate": round(rate, 1)
        })
    
    ranking.sort(key=lambda x: x["resolution_rate"], reverse=True)
    return ranking


# ─────────────────────────────────────────────────────────
# BARANGAY OVERVIEW (CENRO-only) - powers /cenro Barangay Management tab
# ─────────────────────────────────────────────────────────

def _load_barangay_names() -> list:
    """Load the 59 barangay names from the GeoJSON file."""
    import os as _os
    geojson_path = _os.path.join(_os.path.dirname(__file__), "..", "data", "sjdm_barangays.geojson")
    with open(geojson_path, "r", encoding="utf-8") as f:
        gj = json.load(f)
    return sorted(set(feat["properties"]["ADM4_EN"] for feat in gj["features"]))


def _build_barangay_overview_data(db: Session) -> dict:
    """Build the full barangay overview dataset (shared by GET and CSV export)."""
    import logging as _logging
    _logger = _logging.getLogger(__name__)

    barangay_names = _load_barangay_names()

    # All active barangay admins
    admins = (
        db.query(models.User)
        .filter(models.User.role == "barangay", models.User.is_active == True)
        .all()
    )
    # Index by barangay_assignment for fast lookup
    admin_map: dict = {}
    for u in admins:
        key = u.barangay_assignment
        if key is None:
            continue
        if key in admin_map:
            _logger.warning(
                "Multiple active barangay admins for '%s'; picking most recently logged-in.", key
            )
            existing = admin_map[key]
            # Keep the one with the more recent last_login_at
            existing_login = existing.last_login_at or datetime.min
            new_login = u.last_login_at or datetime.min
            if new_login > existing_login:
                admin_map[key] = u
        else:
            admin_map[key] = u

    # All non-rejected reports with a barangay assigned
    all_reports = (
        db.query(models.Report)
        .filter(models.Report.barangay.isnot(None))
        .all()
    )
    # Group by barangay for O(1) lookup
    reports_by_barangay: dict = {}
    for r in all_reports:
        reports_by_barangay.setdefault(r.barangay, []).append(r)

    # SLA compliance data
    sla_data = _compute_sla_compliance(db)
    sla_by_barangay: dict = {entry["barangay"]: entry for entry in sla_data["by_barangay"]}

    # Read SLA compliance target from SystemConfig
    sla_config = (
        db.query(models.SystemConfig)
        .filter(models.SystemConfig.key == "sla_compliance_target")
        .first()
    )
    try:
        sla_target = float(sla_config.value) if sla_config else 95.0
    except (ValueError, TypeError):
        sla_target = 95.0

    now = datetime.utcnow()
    seven_days_ago = now - timedelta(days=7)
    fourteen_days_ago = now - timedelta(days=14)

    rows = []
    for name in barangay_names:
        admin_user = admin_map.get(name)
        bar_reports = reports_by_barangay.get(name, [])

        # Status counts (all reports including rejected for totalling)
        total = len(bar_reports)
        pending = sum(1 for r in bar_reports if r.status == models.ReportStatus.PENDING)
        verified = sum(1 for r in bar_reports if r.status == models.ReportStatus.VERIFIED)
        deployed = sum(1 for r in bar_reports if r.status in (models.ReportStatus.ASSIGNED, models.ReportStatus.IN_PROGRESS))
        resolved = sum(1 for r in bar_reports if r.status == models.ReportStatus.RESOLVED)
        rejected = sum(1 for r in bar_reports if r.status == models.ReportStatus.REJECTED)
        failed_cleanup = sum(1 for r in bar_reports if r.status == models.ReportStatus.FAILED_CLEANUP)

        # Resolution rate excludes rejected
        non_rejected = total - rejected
        resolution_rate = round((resolved / non_rejected * 100) if non_rejected > 0 else 0.0, 1)

        # Last report timestamp
        last_report_at = None
        if bar_reports:
            latest = max((r.created_at for r in bar_reports if r.created_at), default=None)
            last_report_at = latest.isoformat() if latest else None

        # SLA stats from _compute_sla_compliance
        sla_entry = sla_by_barangay.get(name, {})
        active_breaches = sla_entry.get("active_breaches", 0)
        compliance_rate = sla_entry.get("compliance_rate", 0.0)
        avg_resolution_days = sla_entry.get("avg_resolution_days", 0.0)

        # 7-day resolution rate trend delta
        # "current window" = resolved_at in [7d ago, now)
        # "prior window"   = resolved_at in [14d ago, 7d ago)
        resolved_reports = [r for r in bar_reports if r.status == models.ReportStatus.RESOLVED and r.resolved_at]
        current_resolved = [r for r in resolved_reports if seven_days_ago <= r.resolved_at <= now]
        prior_resolved = [r for r in resolved_reports if fourteen_days_ago <= r.resolved_at < seven_days_ago]

        # Denominator: all non-rejected reports created in each window
        current_window_total = [r for r in bar_reports if r.created_at and seven_days_ago <= r.created_at <= now and r.status != models.ReportStatus.REJECTED]
        prior_window_total = [r for r in bar_reports if r.created_at and fourteen_days_ago <= r.created_at < seven_days_ago and r.status != models.ReportStatus.REJECTED]

        cur_rate = (len(current_resolved) / len(current_window_total) * 100) if current_window_total else 0.0
        prior_rate = (len(prior_resolved) / len(prior_window_total) * 100) if prior_window_total else 0.0
        trend_7d = round(cur_rate - prior_rate, 1) if (current_window_total or prior_window_total) else 0.0

        # Derive status
        if admin_user is None:
            status = "unassigned"
        elif active_breaches > 0:
            status = "breached"
        elif compliance_rate < sla_target:
            status = "at_risk"
        else:
            status = "healthy"

        rows.append({
            "barangay": name,
            "admin": {
                "id": admin_user.id,
                "full_name": admin_user.full_name,
                "email": admin_user.email,
                "phone_number": admin_user.phone_number,
                "last_login_at": admin_user.last_login_at.isoformat() if admin_user.last_login_at else None,
            } if admin_user else None,
            "total_reports": total,
            "pending": pending,
            "verified": verified,
            "active": deployed,
            "resolved": resolved,
            "rejected": rejected,
            "failed_cleanup": failed_cleanup,
            "resolution_rate": resolution_rate,
            "active_breaches": active_breaches,
            "compliance_rate": compliance_rate,
            "avg_resolution_days": avg_resolution_days,
            "last_report_at": last_report_at,
            "trend_7d_resolution_rate_delta": trend_7d,
            "status": status,
        })

    barangays_with_admin = sum(1 for r in rows if r["admin"] is not None)
    total_active_breaches = sum(r["active_breaches"] for r in rows)
    total_non_rejected = sum(r["total_reports"] - r["rejected"] for r in rows)
    total_resolved = sum(r["resolved"] for r in rows)
    city_resolution_rate = round(
        (total_resolved / total_non_rejected * 100) if total_non_rejected > 0 else 0.0, 1
    )

    city_wide = {
        "total_barangays": len(barangay_names),
        "barangays_with_admin": barangays_with_admin,
        "barangays_without_admin": len(barangay_names) - barangays_with_admin,
        "total_active_breaches": total_active_breaches,
        "city_resolution_rate": city_resolution_rate,
    }

    return {"city_wide": city_wide, "barangays": rows}


@app.get("/analytics/barangay-overview")
async def get_barangay_overview(
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_role("cenro")),
):
    """City-wide + per-barangay admin, report, and SLA overview. CENRO-only."""
    return _build_barangay_overview_data(db)


def _csv_safe(value: str) -> str:
    """Prevent CSV injection by prefixing dangerous leading characters with a single quote."""
    s = str(value)
    if s and s[0] in ("=", "+", "-", "@"):
        return "'" + s
    return s


@app.get("/analytics/barangay-overview/export")
async def export_barangay_overview_csv(
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_role("cenro")),
):
    """Export barangay overview as CSV. CENRO-only."""
    data = _build_barangay_overview_data(db)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "barangay", "admin_name", "admin_email",
        "total_reports", "pending", "active", "resolved",
        "resolution_rate", "active_breaches", "compliance_rate",
        "avg_resolution_days", "last_report_at", "status",
    ])
    for row in data["barangays"]:
        admin = row["admin"]
        writer.writerow([
            _csv_safe(row["barangay"]),
            _csv_safe(admin["full_name"]) if admin else "",
            _csv_safe(admin["email"]) if admin else "",
            row["total_reports"],
            row["pending"],
            row["active"],
            row["resolved"],
            row["resolution_rate"],
            row["active_breaches"],
            row["compliance_rate"],
            row["avg_resolution_days"],
            row["last_report_at"] or "",
            row["status"],
        ])
    output.seek(0)
    filename = f"ecowatch_barangay_performance_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ─────────────────────────────────────────────────────────
# SLA MANAGEMENT (CENRO-only) - powers /cenro SLA Management tab
# ─────────────────────────────────────────────────────────

ACTIVE_WO_STATUSES = [
    models.WorkOrderStatus.ASSIGNED,
    models.WorkOrderStatus.IN_PROGRESS,
    models.WorkOrderStatus.NEEDS_REDO,
]

TERMINAL_WO_STATUSES = [
    models.WorkOrderStatus.COMPLETED,
    models.WorkOrderStatus.VERIFIED,
]


def _serialize_breached_wo(wo: models.WorkOrder, now: datetime) -> dict:
    """Serialize a breached work order with computed days/hours overdue."""
    base = serialize_work_order(wo)
    delta = now - wo.sla_deadline
    overdue_seconds = max(int(delta.total_seconds()), 0)
    base["overdue_seconds"] = overdue_seconds
    base["overdue_hours"] = overdue_seconds // 3600
    base["overdue_days"] = overdue_seconds // 86400
    return base


def _serialize_at_risk_wo(wo: models.WorkOrder, now: datetime) -> dict:
    """Serialize an at-risk work order with computed time remaining."""
    base = serialize_work_order(wo)
    delta = wo.sla_deadline - now
    remaining_seconds = max(int(delta.total_seconds()), 0)
    base["remaining_seconds"] = remaining_seconds
    base["remaining_hours"] = remaining_seconds // 3600
    return base


@app.get("/work-orders/breached")
async def get_breached_work_orders(
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_role("cenro")),
):
    """List all active work orders past their SLA deadline. CENRO-only."""
    now = datetime.utcnow()
    rows = (
        db.query(models.WorkOrder)
        .filter(
            models.WorkOrder.status.in_(ACTIVE_WO_STATUSES),
            models.WorkOrder.sla_deadline < now,
        )
        .order_by(models.WorkOrder.sla_deadline.asc())
        .all()
    )
    return [_serialize_breached_wo(wo, now) for wo in rows]


@app.get("/work-orders/at-risk")
async def get_at_risk_work_orders(
    hours: int = 24,
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_role("cenro")),
):
    """List active WOs with deadline within next N hours (default 24). CENRO-only."""
    if hours < 1 or hours > 168:
        raise HTTPException(status_code=400, detail="hours must be between 1 and 168")
    now = datetime.utcnow()
    horizon = now + timedelta(hours=hours)
    rows = (
        db.query(models.WorkOrder)
        .filter(
            models.WorkOrder.status.in_(ACTIVE_WO_STATUSES),
            models.WorkOrder.sla_deadline >= now,
            models.WorkOrder.sla_deadline <= horizon,
        )
        .order_by(models.WorkOrder.sla_deadline.asc())
        .all()
    )
    return [_serialize_at_risk_wo(wo, now) for wo in rows]


def _compute_sla_compliance(db: Session) -> dict:
    """Pure helper - city-wide + per-barangay SLA compliance stats from all WOs."""
    now = datetime.utcnow()

    all_wos = (
        db.query(models.WorkOrder)
        .join(models.Report, models.WorkOrder.report_id == models.Report.id)
        .all()
    )

    total_completed = 0
    on_time_completed = 0
    resolution_seconds_total = 0
    active_breaches = 0
    at_risk_24h = 0

    barangay_stats: dict = {}

    horizon_24h = now + timedelta(hours=24)

    for wo in all_wos:
        bar = (wo.report.barangay if wo.report else None) or "Unassigned"
        if bar not in barangay_stats:
            barangay_stats[bar] = {
                "total_wos": 0,
                "total_completed": 0,
                "on_time": 0,
                "resolution_seconds_total": 0,
                "active_breaches": 0,
            }
        bs = barangay_stats[bar]
        bs["total_wos"] += 1

        if wo.status in TERMINAL_WO_STATUSES and wo.completed_at:
            total_completed += 1
            bs["total_completed"] += 1
            delta = (wo.completed_at - wo.created_at).total_seconds()
            resolution_seconds_total += delta
            bs["resolution_seconds_total"] += delta
            if wo.completed_at <= wo.sla_deadline:
                on_time_completed += 1
                bs["on_time"] += 1
        elif wo.status in ACTIVE_WO_STATUSES:
            if wo.sla_deadline < now:
                active_breaches += 1
                bs["active_breaches"] += 1
            elif wo.sla_deadline <= horizon_24h:
                at_risk_24h += 1

    city_compliance_rate = (on_time_completed / total_completed * 100) if total_completed > 0 else 0.0
    avg_resolution_days = (
        (resolution_seconds_total / total_completed / 86400) if total_completed > 0 else 0.0
    )

    by_barangay = []
    for name, bs in barangay_stats.items():
        rate = (bs["on_time"] / bs["total_completed"] * 100) if bs["total_completed"] > 0 else 0.0
        avg_days = (
            (bs["resolution_seconds_total"] / bs["total_completed"] / 86400)
            if bs["total_completed"] > 0 else 0.0
        )
        by_barangay.append({
            "barangay": name,
            "total_wos": bs["total_wos"],
            "total_completed": bs["total_completed"],
            "on_time": bs["on_time"],
            "compliance_rate": round(rate, 1),
            "avg_resolution_days": round(avg_days, 2),
            "active_breaches": bs["active_breaches"],
        })

    by_barangay.sort(key=lambda b: (b["compliance_rate"], -b["active_breaches"]))

    return {
        "city_wide": {
            "compliance_rate": round(city_compliance_rate, 1),
            "total_completed": total_completed,
            "on_time": on_time_completed,
            "avg_resolution_days": round(avg_resolution_days, 2),
            "active_breaches": active_breaches,
            "at_risk_24h": at_risk_24h,
        },
        "by_barangay": by_barangay,
    }


@app.get("/analytics/sla-compliance")
async def get_sla_compliance(
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_role("cenro")),
):
    """City-wide + per-barangay SLA compliance stats. CENRO-only."""
    return _compute_sla_compliance(db)


@app.get("/config/sla/history")
async def get_sla_policy_history(
    limit: int = 50,
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_role("cenro")),
):
    """Audit history of SLA policy changes. CENRO-only."""
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 200")

    rows = (
        db.query(models.AuditLog, models.User.email, models.User.full_name)
        .outerjoin(models.User, models.AuditLog.user_id == models.User.id)
        .filter(models.AuditLog.action == "update_sla_config")
        .order_by(models.AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )

    entries = []
    for log, user_email, user_full_name in rows:
        try:
            details = json.loads(log.details) if log.details else {}
        except (ValueError, TypeError):
            details = {}
        entries.append({
            "id": log.id,
            "user_id": log.user_id,
            "user_email": user_email,
            "user_full_name": user_full_name,
            "created_at": log.created_at,
            "old_policy": details.get("old_policy"),
            "new_policy": details.get("new_policy"),
        })

    # Latest changer (for "Last modified by X on Y")
    last_modified = None
    if entries:
        last_modified = {
            "user_email": entries[0]["user_email"],
            "user_full_name": entries[0]["user_full_name"],
            "created_at": entries[0]["created_at"],
        }

    return {"entries": entries, "last_modified": last_modified}


@app.get("/analytics/sla-export")
async def export_sla_report(
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_role("cenro")),
):
    """CSV export of full SLA compliance report. CENRO-only."""
    now = datetime.utcnow()
    policy = get_sla_policy(db)
    compliance_data = _compute_sla_compliance(db)

    buffer = io.StringIO()
    writer = csv.writer(buffer)

    writer.writerow(["EcoWatch SJDM - SLA Compliance Report"])
    writer.writerow(["Generated", now.isoformat()])
    writer.writerow([])

    writer.writerow(["SLA Policy"])
    writer.writerow(["Priority", "Days"])
    writer.writerow(["Low", policy["low"]])
    writer.writerow(["Medium", policy["medium"]])
    writer.writerow(["High", policy["high"]])
    writer.writerow(["Compliance Target (%)", policy["compliance_target"]])
    writer.writerow([])

    cw = compliance_data["city_wide"]
    writer.writerow(["City-Wide Metrics"])
    writer.writerow(["Metric", "Value"])
    writer.writerow(["Compliance Rate (%)", cw["compliance_rate"]])
    writer.writerow(["Total Completed WOs", cw["total_completed"]])
    writer.writerow(["On-Time WOs", cw["on_time"]])
    writer.writerow(["Avg Resolution (days)", cw["avg_resolution_days"]])
    writer.writerow(["Active Breaches", cw["active_breaches"]])
    writer.writerow(["At-Risk (next 24h)", cw["at_risk_24h"]])
    writer.writerow([])

    writer.writerow(["Per-Barangay Performance"])
    writer.writerow([
        "Barangay", "Total WOs", "Completed", "On-Time",
        "Compliance Rate (%)", "Avg Resolution (days)", "Active Breaches",
    ])
    for b in compliance_data["by_barangay"]:
        writer.writerow([
            b["barangay"], b["total_wos"], b["total_completed"], b["on_time"],
            b["compliance_rate"], b["avg_resolution_days"], b["active_breaches"],
        ])
    writer.writerow([])

    breached = (
        db.query(models.WorkOrder)
        .filter(
            models.WorkOrder.status.in_(ACTIVE_WO_STATUSES),
            models.WorkOrder.sla_deadline < now,
        )
        .order_by(models.WorkOrder.sla_deadline.asc())
        .all()
    )
    writer.writerow(["Active Breaches"])
    writer.writerow([
        "WO ID", "Tracking ID", "Barangay", "Priority",
        "Cleaner", "Created At", "SLA Deadline", "Hours Overdue", "Status",
    ])
    for wo in breached:
        overdue_h = int(max((now - wo.sla_deadline).total_seconds(), 0) // 3600)
        writer.writerow([
            wo.id,
            wo.report.tracking_id if wo.report else "",
            (wo.report.barangay if wo.report else "") or "",
            wo.priority,
            wo.assigned_cleaner.full_name if wo.assigned_cleaner else "Unassigned",
            wo.created_at.isoformat() if wo.created_at else "",
            wo.sla_deadline.isoformat() if wo.sla_deadline else "",
            overdue_h,
            wo.status,
        ])

    filename = f"ecowatch_sla_report_{now.strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

# ---------------------------------------------------------
# CENRO ANALYTICS TAB - insights aggregation + CSV export
# ---------------------------------------------------------

@app.get("/analytics/insights")
async def get_analytics_insights(
    days: int = 30,
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_role("cenro")),
):
    """Aggregated analytics for the CENRO Analytics tab.

    Returns time-windowed KPIs (vs prior period), per-bucket trend series,
    barangay leaderboard, lifecycle funnel, AI verification quality stats,
    and response-time breakdown by priority. CENRO-only.
    """
    if days < 1 or days > 365:
        raise HTTPException(status_code=400, detail="days must be between 1 and 365")

    horizon_start = datetime.utcnow() - timedelta(days=days * 2 + 1)
    reports = (
        db.query(models.Report)
        .filter(models.Report.created_at >= horizon_start)
        .all()
    )
    work_orders = (
        db.query(models.WorkOrder)
        .filter(models.WorkOrder.created_at >= horizon_start)
        .all()
    )

    return analytics.compute_insights(reports, work_orders, days=days)


@app.get("/analytics/insights-export")
async def export_analytics_insights(
    days: int = 30,
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_role("cenro")),
):
    """CSV export of the Analytics tab snapshot. CENRO-only."""
    if days < 1 or days > 365:
        raise HTTPException(status_code=400, detail="days must be between 1 and 365")

    now = datetime.utcnow()
    horizon_start = now - timedelta(days=days * 2 + 1)
    reports = (
        db.query(models.Report)
        .filter(models.Report.created_at >= horizon_start)
        .all()
    )
    work_orders = (
        db.query(models.WorkOrder)
        .filter(models.WorkOrder.created_at >= horizon_start)
        .all()
    )
    data = analytics.compute_insights(reports, work_orders, days=days, now=now)

    buffer = io.StringIO()
    writer = csv.writer(buffer)

    writer.writerow(["EcoWatch SJDM - Analytics Insights Report"])
    writer.writerow(["Generated", now.isoformat()])
    writer.writerow(["Window (days)", days])
    writer.writerow(["Granularity", data["window"]["granularity"]])
    writer.writerow([])

    cur = data["kpis"]["current"]
    pri = data["kpis"]["prior"]
    delta = data["kpis"]["delta"]
    writer.writerow(["KPI Summary"])
    writer.writerow(["Metric", "Current", "Prior Period", "Delta"])
    writer.writerow(["Reports Submitted", cur["reports"], pri["reports"], delta["reports_pct"]])
    writer.writerow(["Resolution Rate (%)", cur["resolution_rate"], pri["resolution_rate"], delta["resolution_rate_pts"]])
    writer.writerow(["Avg Resolve Days", cur["avg_resolve_days"], pri["avg_resolve_days"], delta["avg_resolve_days_pct"]])
    writer.writerow(["SLA Compliance (%)", cur["sla_compliance"], pri["sla_compliance"], delta["sla_compliance_pts"]])
    writer.writerow([])

    writer.writerow(["Trend Series"])
    writer.writerow(["Date", "Submitted", "Resolved", "Rejected", "Avg AI Confidence"])
    for pt in data["trend"]:
        writer.writerow([pt["date"], pt["submitted"], pt["resolved"], pt["rejected"], pt["avg_confidence"] if pt["avg_confidence"] is not None else ""])
    writer.writerow([])

    writer.writerow(["Barangay Leaderboard"])
    writer.writerow(["Barangay", "Total", "Resolved", "Active", "Pending", "Resolution Rate (%)", "Avg Resolve Days", "Prior Total", "Trend"])
    for row in data["barangay_leaderboard"]:
        writer.writerow([
            row["barangay"], row["total"], row["resolved"], row["active"], row["pending"],
            row["resolution_rate"], row["avg_resolve_days"], row["prior_total"], row["trend"],
        ])
    writer.writerow([])

    writer.writerow(["Lifecycle Funnel"])
    writer.writerow(["Stage", "Count"])
    for stage in data["funnel"]["stages"]:
        writer.writerow([stage["label"], stage["count"]])
    for branch in data["funnel"]["branches"]:
        writer.writerow([f"(off-funnel) {branch['label']}", branch["count"]])
    writer.writerow([])

    aiq = data["ai_quality"]
    writer.writerow(["AI Verification Quality"])
    writer.writerow(["Total Analyzed", aiq["total_analyzed"]])
    writer.writerow(["Mean Confidence", aiq["mean_confidence"] if aiq["mean_confidence"] is not None else ""])
    writer.writerow(["Mean Verified Confidence", aiq["mean_verified_confidence"] if aiq["mean_verified_confidence"] is not None else ""])
    writer.writerow(["Rejected Count", aiq["rejected_count"]])
    writer.writerow(["Verification Rate (%)", aiq["verification_rate"]])
    writer.writerow(["AI Threshold", aiq["ai_threshold"]])
    writer.writerow(["Confidence Bucket", "Count"])
    for bucket in aiq["histogram"]:
        writer.writerow([bucket["bucket"], bucket["count"]])
    writer.writerow([])

    writer.writerow(["Response Time by Priority"])
    writer.writerow(["Priority", "Total WOs", "Avg Created->Deployed (hrs)", "Avg Deployed->Completed (hrs)", "Completed Count"])
    for r in data["response_time_by_priority"]:
        writer.writerow([
            r["priority"], r["total_wos"],
            r["avg_created_to_deployed_hours"] if r["avg_created_to_deployed_hours"] is not None else "",
            r["avg_deployed_to_completed_hours"] if r["avg_deployed_to_completed_hours"] is not None else "",
            r["completed_count"],
        ])

    filename = f"ecowatch_analytics_insights_{now.strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ─────────────────────────────────────────────────────────
# NOTIFICATIONS (Cleaner in-app feed)
# ─────────────────────────────────────────────────────────

@app.get("/notifications/cleaner/{cleaner_id}")
async def list_notifications(
    cleaner_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("cleaner")),
):
    """List a cleaner's notifications, newest first. Caps at 200 rows."""
    if user.id != cleaner_id:
        raise HTTPException(status_code=403, detail="Can only view your own notifications")
    rows = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == cleaner_id)
        .order_by(models.Notification.created_at.desc())
        .limit(max(1, min(limit, 200)))
        .all()
    )
    return [
        {
            "id": n.id,
            "kind": n.kind,
            "title": n.title,
            "body": n.body,
            "work_order_id": n.work_order_id,
            "report_id": n.report_id,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in rows
    ]


@app.get("/notifications/cleaner/{cleaner_id}/unread-count")
async def unread_notification_count(
    cleaner_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("cleaner")),
):
    """Bell-badge counter. Polled every 30s by the cleaner portal."""
    if user.id != cleaner_id:
        raise HTTPException(status_code=403, detail="Can only view your own notifications")
    count = (
        db.query(models.Notification)
        .filter(
            models.Notification.user_id == cleaner_id,
            models.Notification.is_read == False,  # noqa: E712
        )
        .count()
    )
    return {"unread_count": count}


@app.post("/notifications/{notification_id}/mark-read")
async def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("cleaner")),
):
    n = db.query(models.Notification).filter(models.Notification.id == notification_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    if n.user_id != user.id:
        raise HTTPException(status_code=403, detail="Cannot mark someone else's notification")
    n.is_read = True
    db.commit()
    return {"success": True}


@app.post("/notifications/cleaner/{cleaner_id}/mark-all-read")
async def mark_all_notifications_read(
    cleaner_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("cleaner")),
):
    if user.id != cleaner_id:
        raise HTTPException(status_code=403, detail="Can only mark your own notifications")
    db.query(models.Notification).filter(
        models.Notification.user_id == cleaner_id,
        models.Notification.is_read == False,  # noqa: E712
    ).update({"is_read": True})
    db.commit()
    return {"success": True}