from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base
import enum


class ReportStatus(str, enum.Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"
    DEPLOYED = "deployed"
    RESOLVED = "resolved"
    FAILED_CLEANUP = "failed_cleanup"


class WorkOrderStatus(str, enum.Enum):
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    VERIFIED = "verified"
    NEEDS_REDO = "needs_redo"


class User(Base):
    """Local auth user — replaces Supabase during development."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, nullable=False, default="citizen")  # citizen | barangay | cleaner | cenro
    barangay_assignment = Column(String, nullable=True)  # Only for barangay/cleaner role
    phone_number = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login_at = Column(DateTime, nullable=True)

    # Relationships
    reports = relationship("Report", back_populates="reporter")
    work_orders_assigned = relationship(
        "WorkOrder",
        back_populates="assigned_cleaner",
        foreign_keys="[WorkOrder.assigned_cleaner_id]",
    )


class Report(Base):
    """Environmental report — the core data entity."""
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    barangay = Column(String, index=True, nullable=True)  # Computed by Ray-Casting

    # Reporter (nullable for anonymous reports)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reporter = relationship("User", back_populates="reports")

    # Image evidence
    image_url = Column(String, nullable=True)  # Path to uploaded photo
    ai_mask_url = Column(String, nullable=True)  # Path to AI detection overlay image
    cleanup_image_url = Column(String, nullable=True)  # Path to cleanup verification photo
    ai_confidence = Column(Float, nullable=True)  # Mask R-CNN score (0.0 to 1.0)

    # Status & metadata
    status = Column(String, default=ReportStatus.PENDING)
    notes = Column(Text, nullable=True)
    deployment_notes = Column(Text, nullable=True)  # Set when barangay dispatches a team

    # Async AI verification: True while a background task is running Mask R-CNN
    # for either the initial photo or a cleanup photo. Drives the frontend
    # "AI verifying…" spinner and is the source of truth for startup recovery.
    verification_pending = Column(Boolean, nullable=False, default=False, index=True)
    verification_kind = Column(String, nullable=True)  # submit | resolve | complete

    # Tracking (for anonymous access)
    tracking_id = Column(String, unique=True, nullable=True)  # e.g. "EW-0042"
    tracking_url = Column(String, unique=True, nullable=True)  # e.g. "/track/abc123"

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    deployed_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    # Work orders (one Report can have multiple work orders if a cleanup fails and is re-dispatched)
    work_orders = relationship("WorkOrder", back_populates="report", cascade="all, delete-orphan")
    report_photos = relationship("ReportPhoto", back_populates="report", cascade="all, delete-orphan")
    cleanup_photos = relationship("CleanupPhoto", back_populates="report", cascade="all, delete-orphan")


class WorkOrder(Base):
    """Cleanup execution unit. Created when a barangay dispatches a cleaner to a verified Report.

    One Report can have multiple WorkOrders when a FAILED_CLEANUP triggers a redo.
    """
    __tablename__ = "work_orders"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False, index=True)
    assigned_cleaner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    priority = Column(String, nullable=False, default="medium")  # low | medium | high
    sla_deadline = Column(DateTime, nullable=False)
    status = Column(String, nullable=False, default=WorkOrderStatus.ASSIGNED, index=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    report = relationship("Report", back_populates="work_orders")
    assigned_cleaner = relationship(
        "User",
        back_populates="work_orders_assigned",
        foreign_keys=[assigned_cleaner_id],
    )


class SystemConfig(Base):
    """Key-value table for CENRO-editable runtime configuration (SLA policy, future toggles)."""
    __tablename__ = "system_config"

    key = Column(String, primary_key=True)
    value = Column(String, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)


class AuditLog(Base):
    """Append-only audit trail for override actions (deploy / resolve / reassign / force-close)."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String, nullable=False, index=True)
    target_type = Column(String, nullable=False, default="report")
    target_id = Column(Integer, nullable=True, index=True)
    details = Column(Text, nullable=True)  # JSON-encoded dict
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class Notification(Base):
    """In-app notification feed for cleaners. One row per event affecting a cleaner's work order."""
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    kind = Column(String, nullable=False)  # job_assigned | priority_changed | reassigned | needs_redo | verified | force_resolved
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    work_order_id = Column(Integer, ForeignKey("work_orders.id"), nullable=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=True, index=True)
    is_read = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class ReportPhoto(Base):
    """One row per evidence photo uploaded by a citizen for a report."""
    __tablename__ = "report_photos"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False, index=True)
    file_path = Column(String, nullable=False)
    ai_confidence = Column(Float, nullable=True)
    ai_verified = Column(Boolean, nullable=True)
    ai_mask_path = Column(String, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    report = relationship("Report", back_populates="report_photos")


class CleanupPhoto(Base):
    """One row per cleanup proof photo. work_order_id is null for direct barangay resolves."""
    __tablename__ = "cleanup_photos"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False, index=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id"), nullable=True, index=True)
    file_path = Column(String, nullable=False)
    ai_confidence = Column(Float, nullable=True)
    ai_verified = Column(Boolean, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    report = relationship("Report", back_populates="cleanup_photos")
