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
from sqlalchemy import or_, text
from sqlalchemy.orm import Session
from database import engine, get_db, SessionLocal
import models
from ai_verifier import verifier
import analytics

# SLA config keys + defaults (CENRO-editable at runtime via /config/sla)
SLA_CONFIG_KEYS = ("sla_low_days", "sla_medium_days", "sla_high_days")
SLA_CONFIG_DEFAULTS = {"sla_low_days": "7", "sla_medium_days": "3", "sla_high_days": "1"}
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
    barangay_assignment: Optional[str] = None  # required for barangay/cleaner roles; ignored for CENRO admins
    role: Optional[str] = "barangay"  # "barangay" | "cleaner" | "cenro"


class CreateBarangayUserResponse(BaseModel):
    user: UserResponse
    temporary_password: str


class UpdateSlaConfigRequest(BaseModel):
    low_days: Optional[int] = None
    medium_days: Optional[int] = None
    high_days: Optional[int] = None


class CreateWorkOrderRequest(BaseModel):
    report_id: int
    assigned_cleaner_id: int
    priority: str = "medium"  # low | medium | high
    notes: Optional[str] = None


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

    class Config:
        from_attributes = True


class SlaConfigResponse(BaseModel):
    low: int
    medium: int
    high: int


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
    """Return current SLA policy as {low, medium, high} integer day counts."""
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
        # Barangay can only see cleaners in their barangay
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
        # Barangay can only create cleaners in their own barangay
        if not admin.barangay_assignment:
            raise HTTPException(status_code=400, detail="Barangay user missing assignment")
        new_role = "cleaner"
        new_barangay = admin.barangay_assignment
    else:  # cenro
        # CENRO specifies role and barangay_assignment
        new_role = (req.role or "barangay").lower()
        new_barangay = req.barangay_assignment
        if new_role not in ("barangay", "cleaner"):
            raise HTTPException(status_code=400, detail="role must be 'barangay' or 'cleaner'")
        if new_role in ("barangay", "cleaner") and not new_barangay:
            raise HTTPException(status_code=400, detail="barangay_assignment required for barangay/cleaner roles")

    temporary_password = secrets.token_urlsafe(9)  # ~12 chars
    new_user = models.User(
        email=req.email,
        password_hash=hash_password(temporary_password),
        full_name=req.full_name,
        role=new_role,
        barangay_assignment=new_barangay,
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
async def get_sla_breaches(db: Session = Depends(get_db)):
    """
    List reports with active work orders past their SLA deadline.
    A work order is "active" if its status is not completed or verified.
    """
    now = datetime.utcnow()
    # Find all reports with at least one active work order past deadline
    breached_reports = (
        db.query(models.Report)
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
    return breached_reports


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
    deployment_notes: Optional[str] = Form(None),
    priority: Optional[str] = Form(None),
    assigned_cleaner_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("barangay")),
):
    """
    Barangay marks a report as deployed.
    If priority + assigned_cleaner_id provided, create a formal WorkOrder.
    Otherwise, legacy behavior: just mark as deployed without work order.
    """
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.barangay != user.barangay_assignment:
        raise HTTPException(status_code=403, detail="Cannot deploy a report outside your barangay")

    if report.status != models.ReportStatus.VERIFIED:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot deploy. Report status is '{report.status}', must be 'verified'."
        )

    notes_clean = (deployment_notes or "").strip() or None
    report.status = models.ReportStatus.DEPLOYED
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
        write_audit(db, user.id, "create_work_order", report.id, {
            "tracking_id": report.tracking_id,
            "assigned_cleaner_id": assigned_cleaner_id,
            "priority": priority,
            "sla_deadline": sla_deadline.isoformat(),
        })
    else:
        # Legacy: just mark as deployed without work order
        write_audit(db, user.id, "deploy", report.id, {
            "tracking_id": report.tracking_id,
            **({"deployment_notes": notes_clean[:500]} if notes_clean else {})
        })

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
# WORK ORDERS & SLA POLICY
# ─────────────────────────────────────────────────────────

@app.post("/work-orders")
async def create_work_order(
    req: CreateWorkOrderRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("barangay")),
):
    """Barangay creates a work order from a VERIFIED report. Sets Report status to DEPLOYED."""
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
    report.status = models.ReportStatus.DEPLOYED
    report.deployed_at = datetime.utcnow()

    write_audit(db, user.id, "create_work_order", report.id, {
        "tracking_id": report.tracking_id,
        "assigned_cleaner_id": req.assigned_cleaner_id,
        "priority": req.priority,
        "sla_deadline": sla_deadline.isoformat(),
    })
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


@app.put("/work-orders/{work_order_id}/complete")
async def complete_work_order(
    work_order_id: int,
    cleanup_image: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("cleaner")),
):
    """
    Cleaner uploads cleanup photo.
    AI re-verifies — if clean, mark completed/verified; if still dirty, mark needs_redo.
    """
    wo = db.query(models.WorkOrder).filter(models.WorkOrder.id == work_order_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    if wo.assigned_cleaner_id != user.id:
        raise HTTPException(status_code=403, detail="Can only complete your own work orders")

    if wo.status != models.WorkOrderStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot complete. Status is '{wo.status}', must be 'in_progress'."
        )

    report = wo.report
    if not report:
        raise HTTPException(status_code=404, detail="Associated report not found")

    # Read and validate cleanup image
    cleanup_bytes = await cleanup_image.read()
    validate_image(cleanup_image, cleanup_bytes)
    verification = verifier.verify_image(cleanup_bytes)

    # Save cleanup image to disk
    cleanup_url = await save_upload(cleanup_image, prefix="cleanup", contents=cleanup_bytes)
    report.cleanup_image_url = cleanup_url

    # Update work order and report based on verification
    wo.completed_at = datetime.utcnow()

    if verification["verified"]:
        # AI still sees waste → cleanup failed, mark for redo
        wo.status = models.WorkOrderStatus.NEEDS_REDO
        report.status = models.ReportStatus.FAILED_CLEANUP
    else:
        # AI sees no waste → cleanup successful
        wo.status = models.WorkOrderStatus.VERIFIED
        report.status = models.ReportStatus.RESOLVED
        report.resolved_at = datetime.utcnow()

    write_audit(db, user.id, "complete_work_order", report.id, {
        "work_order_id": wo.id,
        "tracking_id": report.tracking_id,
        "outcome": wo.status,
    })
    db.commit()
    db.refresh(wo)
    db.refresh(report)

    return {
        "success": True,
        "message": f"Work order completed. Report is {report.status}.",
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
        updates["sla_low_days"] = str(req.low_days)
    if req.medium_days is not None:
        updates["sla_medium_days"] = str(req.medium_days)
    if req.high_days is not None:
        updates["sla_high_days"] = str(req.high_days)

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
