from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
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


class User(Base):
    """Local auth user — replaces Supabase during development."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, nullable=False, default="citizen")  # citizen | barangay | cenro
    barangay_assignment = Column(String, nullable=True)  # Only for barangay role
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    reports = relationship("Report", back_populates="reporter")


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
    cleanup_image_url = Column(String, nullable=True)  # Path to cleanup verification photo
    ai_confidence = Column(Float, nullable=True)  # Mask R-CNN score (0.0 to 1.0)

    # Status & metadata
    status = Column(String, default=ReportStatus.PENDING)
    notes = Column(Text, nullable=True)

    # Tracking (for anonymous access)
    tracking_id = Column(String, unique=True, nullable=True)  # e.g. "EW-0042"
    tracking_url = Column(String, unique=True, nullable=True)  # e.g. "/track/abc123"

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    deployed_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
