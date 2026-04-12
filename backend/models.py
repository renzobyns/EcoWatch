from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, Text
from datetime import datetime
from database import Base
import enum

class ReportStatus(str, enum.Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    RESOLVED = "resolved"
    REJECTED = "rejected"

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    barangay = Column(String, index=True, nullable=True) # Computed by spatial logic
    
    # User info (optional for now, could be linked to an auth user)
    reporter_id = Column(String, nullable=True) 
    
    # Image evidence 
    image_url = Column(String, nullable=True)
    ai_confidence = Column(Float, nullable=True) # e.g. 0.95 confident it's waste
    
    status = Column(String, default=ReportStatus.PENDING)
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
