from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
from datetime import datetime

def seed():
    # Ensure tables exist
    models.Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    # Clear existing reports to have a fresh test
    db.query(models.Report).delete()
    db.commit()

    test_reports = [
        # Cluster A: Muzon (Hotspot)
        {"lat": 14.8150, "lon": 121.0250, "notes": "Muzon Hotspot Point 1"},
        {"lat": 14.8151, "lon": 121.0251, "notes": "Muzon Hotspot Point 2"},
        {"lat": 14.8152, "lon": 121.0252, "notes": "Muzon Hotspot Point 3"},
        {"lat": 14.8149, "lon": 121.0249, "notes": "Muzon Hotspot Point 4"},
        {"lat": 14.81505, "lon": 121.02505, "notes": "Muzon Hotspot Point 5"},

        # Cluster B: Dulong Bayan (Hotspot)
        {"lat": 14.8197, "lon": 121.0478, "notes": "Dulong Bayan Hotspot 1"},
        {"lat": 14.8198, "lon": 121.0479, "notes": "Dulong Bayan Hotspot 2"},
        {"lat": 14.8196, "lon": 121.0477, "notes": "Dulong Bayan Hotspot 3"},

        # Outlier 1: Tungkong Mangga (Noise)
        {"lat": 14.8110, "lon": 121.1380, "notes": "Isolated report in Tungkong Mangga"},

        # Outlier 2: Assumption area (Noise)
        {"lat": 14.8650, "lon": 121.0701, "notes": "Isolated report in Assumption"}
    ]

    for data in test_reports:
        # Note: 'barangay' will be filled during actual API flow, 
        # but for this script we can leave it empty or mock it.
        # The test_analytics script will compute it again to verify Ray Casting.
        report = models.Report(
            lat=data["lat"],
            lon=data["lon"],
            notes=data["notes"],
            status=models.ReportStatus.VERIFIED,
            ai_confidence=0.95,
            created_at=datetime.utcnow()
        )
        db.add(report)

    db.commit()
    print(f"Successfully seeded {len(test_reports)} reports.")
    db.close()

if __name__ == "__main__":
    seed()
