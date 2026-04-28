"""
EcoWatch — Test Data Seeder
Seeds the local SQLite database with test users and reports.
Run: python seed_test_data.py
"""
from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
from datetime import datetime, timedelta
import bcrypt
import uuid


def hash_pw(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def seed():
    # Ensure tables exist
    models.Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    # ─────────────────────────────────────────────
    # CLEAR EXISTING DATA
    # ─────────────────────────────────────────────
    db.query(models.Report).delete()
    db.query(models.User).delete()
    db.commit()
    print("🗑️  Cleared existing data.")
    
    # ─────────────────────────────────────────────
    # SEED USERS (1 citizen, 1 barangay, 1 cenro)
    # ─────────────────────────────────────────────
    users = [
        models.User(
            email="citizen@test.com",
            password_hash=hash_pw("password123"),
            full_name="Juan Dela Cruz",
            role="citizen"
        ),
        models.User(
            email="barangay@test.com",
            password_hash=hash_pw("password123"),
            full_name="Maria Santos",
            role="barangay",
            barangay_assignment="Muzon"
        ),
        models.User(
            email="cenro@test.com",
            password_hash=hash_pw("password123"),
            full_name="Carlos Reyes",
            role="cenro"
        ),
    ]
    
    for user in users:
        db.add(user)
    db.commit()
    
    # Refresh to get IDs
    for user in users:
        db.refresh(user)
    
    citizen = users[0]
    
    print(f"👤 Created {len(users)} test users:")
    for u in users:
        print(f"   → {u.email} ({u.role}) — password: password123")
    
    # ─────────────────────────────────────────────
    # SEED REPORTS (various statuses, barangays)
    # ─────────────────────────────────────────────
    now = datetime.utcnow()
    report_counter = 0
    
    def make_report(**kwargs) -> models.Report:
        nonlocal report_counter
        report_counter += 1
        slug = uuid.uuid4().hex[:8]
        defaults = {
            "tracking_id": f"EW-{report_counter:04d}",
            "tracking_url": f"/track/{slug}",
            "ai_confidence": 0.92,
            "created_at": now - timedelta(hours=report_counter * 2),
        }
        defaults.update(kwargs)
        return models.Report(**defaults)
    
    test_reports = [
        # ── MUZON: Hotspot cluster (5 reports, mixed statuses) ──
        make_report(lat=14.8150, lon=121.0250, barangay="Muzon",
                    status=models.ReportStatus.VERIFIED, notes="Dump near river",
                    reporter_id=citizen.id),
        make_report(lat=14.8151, lon=121.0251, barangay="Muzon",
                    status=models.ReportStatus.DEPLOYED, notes="Large pile at bridge",
                    deployed_at=now - timedelta(hours=3)),
        make_report(lat=14.8152, lon=121.0252, barangay="Muzon",
                    status=models.ReportStatus.RESOLVED, notes="Cleaned up pile",
                    deployed_at=now - timedelta(hours=8),
                    resolved_at=now - timedelta(hours=2)),
        make_report(lat=14.8149, lon=121.0249, barangay="Muzon",
                    status=models.ReportStatus.PENDING, notes="Possible dump site"),
        make_report(lat=14.81505, lon=121.02505, barangay="Muzon",
                    status=models.ReportStatus.VERIFIED, notes="Bags of waste near creek",
                    reporter_id=citizen.id),
        
        # ── DULONG BAYAN: Secondary hotspot (3 reports) ──
        make_report(lat=14.8197, lon=121.0478, barangay="Dulong Bayan",
                    status=models.ReportStatus.VERIFIED, notes="Tire dump"),
        make_report(lat=14.8198, lon=121.0479, barangay="Dulong Bayan",
                    status=models.ReportStatus.DEPLOYED, notes="Construction debris",
                    deployed_at=now - timedelta(hours=5)),
        make_report(lat=14.8196, lon=121.0477, barangay="Dulong Bayan",
                    status=models.ReportStatus.PENDING, notes="Waste in drainage"),
        
        # ── SAPANG PALAY: Some reports ──
        make_report(lat=14.8380, lon=121.0490, barangay="Sapang Palay",
                    status=models.ReportStatus.RESOLVED, notes="Resolved dump site",
                    deployed_at=now - timedelta(hours=24),
                    resolved_at=now - timedelta(hours=12)),
        make_report(lat=14.8385, lon=121.0495, barangay="Sapang Palay",
                    status=models.ReportStatus.VERIFIED, notes="New dump spotted"),
        
        # ── TUNGKONG MANGGA: Outlier ──
        make_report(lat=14.8110, lon=121.1380, barangay="Tungkong Mangga",
                    status=models.ReportStatus.PENDING, notes="Isolated incident"),
        
        # ── REJECTED REPORT (should not appear on maps) ──
        make_report(lat=14.8650, lon=121.0701, barangay="Assumption",
                    status=models.ReportStatus.REJECTED, notes="False alarm",
                    ai_confidence=0.15),
        
        # ── ANONYMOUS REPORTS (no reporter_id) ──
        make_report(lat=14.8200, lon=121.0460, barangay="Dulong Bayan",
                    status=models.ReportStatus.VERIFIED, notes="Anonymous tip — waste in vacant lot"),
        make_report(lat=14.8160, lon=121.0255, barangay="Muzon",
                    status=models.ReportStatus.FAILED_CLEANUP, notes="Cleanup attempt failed",
                    deployed_at=now - timedelta(hours=6)),
    ]
    
    for report in test_reports:
        db.add(report)
    
    db.commit()
    
    print(f"\n📋 Created {len(test_reports)} test reports:")
    
    # Count by status
    status_counts = {}
    for r in test_reports:
        s = r.status
        status_counts[s] = status_counts.get(s, 0) + 1
    
    for status, count in status_counts.items():
        print(f"   → {status}: {count}")
    
    # Count by barangay
    brgy_counts = {}
    for r in test_reports:
        b = r.barangay
        brgy_counts[b] = brgy_counts.get(b, 0) + 1
    
    print(f"\n🏘️  Reports by barangay:")
    for brgy, count in brgy_counts.items():
        print(f"   → {brgy}: {count}")
    
    print(f"\n✅ Seed complete! Open ecowatch.db in DB Browser to verify.")
    db.close()


if __name__ == "__main__":
    seed()
