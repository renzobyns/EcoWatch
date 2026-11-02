"""
EcoWatch — Test Data Seeder
Seeds the local SQLite database with test users and reports.
Run: python seed_test_data.py
"""
import json
import re
import unicodedata
from pathlib import Path

from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
from datetime import datetime, timedelta
import bcrypt
import uuid


GEOJSON_PATH = Path(__file__).parent.parent / "data" / "sjdm_barangays.geojson"


def hash_pw(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def slugify_barangay(name: str) -> str:
    """'Minuyan Proper' -> 'minuyanproper', 'Santo Niño' -> 'santonino'."""
    normalized = unicodedata.normalize("NFKD", name).encode("ASCII", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", normalized.lower())


def get_all_barangays() -> list[str]:
    with open(GEOJSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    return sorted(f["properties"]["ADM4_EN"] for f in data["features"])


def seed():
    # Ensure tables exist
    models.Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    # ─────────────────────────────────────────────
    # CLEAR EXISTING DATA
    # ─────────────────────────────────────────────
    # Bulk Query.delete() bypasses SQLAlchemy's ORM cascade rules, so child
    # tables must be wiped explicitly before their parents. Otherwise orphan
    # photo rows survive and silently re-attach to future reports that happen
    # to reuse the same auto-increment id.
    db.query(models.CleanupPhoto).delete()
    db.query(models.ReportPhoto).delete()
    db.query(models.AuditLog).delete()
    db.query(models.Notification).delete()
    db.query(models.WorkOrder).delete()
    db.query(models.Report).delete()
    db.query(models.User).delete()
    db.commit()
    print("🗑️  Cleared existing data.")

    # ─────────────────────────────────────────────
    # SEED USERS (4 core demo accounts)
    # ─────────────────────────────────────────────
    users = [
        models.User(
            email="citizen@test.com",
            password_hash=hash_pw("password123"),
            full_name="Juan Dela Cruz",
            role="citizen",
            is_verified=True
        ),
        models.User(
            email="barangay@test.com",
            password_hash=hash_pw("password123"),
            full_name="Maria Santos",
            role="barangay",
            barangay_assignment="Muzon Proper",
            phone_number="+63 917 123 4567",
            is_verified=True
        ),
        models.User(
            email="cenro@test.com",
            password_hash=hash_pw("password123"),
            full_name="Carlos Reyes",
            role="cenro",
            is_verified=True
        ),
        models.User(
            email="cleaner@test.com",
            password_hash=hash_pw("password123"),
            full_name="Pedro Cruz",
            role="cleaner",
            barangay_assignment="Muzon Proper",
            phone_number="+63 917 555 0102",
            is_verified=True
        ),
    ]
    
    for user in users:
        db.add(user)
    db.commit()
    
    # Refresh to get IDs
    for user in users:
        db.refresh(user)
    
    citizen = users[0]
    
    print(f"👤 Created {len(users)} core demo users:")
    for u in users:
        print(f"   → {u.email} ({u.role}) — password: password123")

    # ─────────────────────────────────────────────
    # SEED PER-BARANGAY ACCOUNTS (1 barangay admin + 1 cleaner per barangay)
    # Email pattern: <slug>@barangay.com  /  <slug>@cleaners.com
    # Slug = lowercased name with non-alphanumeric stripped
    #   "Minuyan Proper"  -> minuyanproper@barangay.com / minuyanproper@cleaners.com
    #   "Muzon Proper"    -> muzonproper@barangay.com   / muzonproper@cleaners.com
    #   "Muzon East"      -> muzoneast@barangay.com     / muzoneast@cleaners.com
    #   "Muzon West"      -> muzonwest@barangay.com     / muzonwest@cleaners.com
    #   "Muzon South"     -> muzonsouth@barangay.com    / muzonsouth@cleaners.com
    # Lets the demo log in as ANY barangay's admin or cleaner without manual setup.
    # ─────────────────────────────────────────────
    all_barangays = get_all_barangays()
    per_brgy_users = []
    for brgy_name in all_barangays:
        slug = slugify_barangay(brgy_name)
        per_brgy_users.append(models.User(
            email=f"{slug}@barangay.com",
            password_hash=hash_pw("password123"),
            full_name=f"{brgy_name} Admin",
            role="barangay",
            barangay_assignment=brgy_name,
            is_verified=True
        ))
        per_brgy_users.append(models.User(
            email=f"{slug}@cleaners.com",
            password_hash=hash_pw("password123"),
            full_name=f"{brgy_name} Cleaner",
            role="cleaner",
            barangay_assignment=brgy_name,
            is_verified=True
        ))

    # Also register underscore aliases for the 4 Muzon partitions
    # so both muzonproper@barangay.com and muzon_proper@barangay.com work seamlessly.
    muzon_aliases = [
        ("Muzon Proper", "muzon_proper"),
        ("Muzon East", "muzon_east"),
        ("Muzon West", "muzon_west"),
        ("Muzon South", "muzon_south"),
    ]
    for brgy_name, alias_slug in muzon_aliases:
        per_brgy_users.append(models.User(
            email=f"{alias_slug}@barangay.com",
            password_hash=hash_pw("password123"),
            full_name=f"{brgy_name} Admin (Alias)",
            role="barangay",
            barangay_assignment=brgy_name,
            is_verified=True
        ))
        per_brgy_users.append(models.User(
            email=f"{alias_slug}@cleaners.com",
            password_hash=hash_pw("password123"),
            full_name=f"{brgy_name} Cleaner (Alias)",
            role="cleaner",
            barangay_assignment=brgy_name,
            is_verified=True
        ))

    for user in per_brgy_users:
        db.add(user)
    db.commit()

    print(f"\n🏘️  Seeded {len(per_brgy_users)} per-barangay accounts "
          f"({len(all_barangays)} barangays × 2 roles + 4 Muzon aliases, password: password123)")
    print(f"   Examples for 4 Muzon Barangays:")
    for muzon_sample in ["Muzon Proper", "Muzon East", "Muzon West", "Muzon South"]:
        s = slugify_barangay(muzon_sample)
        print(f"   → {s}@barangay.com  /  {s}@cleaners.com  ({muzon_sample} Admin & Cleaner)")

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
        # ── MUZON PROPER: Commercial & market zone reports (assumes cleaner assignments) ──
        make_report(lat=14.8040, lon=121.0341, barangay="Muzon Proper",
                    status=models.ReportStatus.ASSIGNED, notes="Garbage near Muzon commercial area",
                    deployed_at=now - timedelta(hours=3)),
        make_report(lat=14.8042, lon=121.0343, barangay="Muzon Proper",
                    status=models.ReportStatus.IN_PROGRESS, notes="Active cleanup along Main Road",
                    deployed_at=now - timedelta(hours=2)),
        make_report(lat=14.8038, lon=121.0339, barangay="Muzon Proper",
                    status=models.ReportStatus.FAILED_CLEANUP, notes="Needs redo at commercial strip",
                    deployed_at=now - timedelta(hours=6)),
        make_report(lat=14.8045, lon=121.0345, barangay="Muzon Proper",
                    status=models.ReportStatus.VERIFIED, notes="Bags of trash by sidewalk",
                    reporter_id=citizen.id),
        make_report(lat=14.8041, lon=121.0342, barangay="Muzon Proper",
                    status=models.ReportStatus.ASSIGNED, notes="Litter near transport terminal",
                    deployed_at=now - timedelta(hours=4)),
        make_report(lat=14.8043, lon=121.0344, barangay="Muzon Proper",
                    status=models.ReportStatus.IN_PROGRESS, notes="Active debris clearing at market ditch",
                    deployed_at=now - timedelta(hours=1)),
        make_report(lat=14.8039, lon=121.0340, barangay="Muzon Proper",
                    status=models.ReportStatus.FAILED_CLEANUP, notes="Secondary cleanup needed at grocery alley",
                    deployed_at=now - timedelta(hours=5)),

        # ── MUZON WEST: Dense hotspot cluster (SJDM Heights / river zone) ──
        make_report(lat=14.8150, lon=121.0250, barangay="Muzon West",
                    status=models.ReportStatus.VERIFIED, notes="Dump near river",
                    reporter_id=citizen.id),
        make_report(lat=14.8151, lon=121.0251, barangay="Muzon West",
                    status=models.ReportStatus.ASSIGNED, notes="Large pile at bridge",
                    deployed_at=now - timedelta(hours=3)),
        make_report(lat=14.8153, lon=121.0253, barangay="Muzon West",
                    status=models.ReportStatus.IN_PROGRESS, notes="Cleaner actively cleaning roadside",
                    deployed_at=now - timedelta(hours=2)),
        make_report(lat=14.8152, lon=121.0252, barangay="Muzon West",
                    status=models.ReportStatus.RESOLVED, notes="Cleaned up pile",
                    deployed_at=now - timedelta(hours=8),
                    resolved_at=now - timedelta(hours=2)),
        make_report(lat=14.8149, lon=121.0249, barangay="Muzon West",
                    status=models.ReportStatus.PENDING, notes="Possible dump site"),
        make_report(lat=14.81505, lon=121.02505, barangay="Muzon West",
                    status=models.ReportStatus.VERIFIED, notes="Bags of waste near creek",
                    reporter_id=citizen.id),

        # ── MUZON EAST: Benito Nieto cluster ──
        make_report(lat=14.8110, lon=121.0389, barangay="Muzon East",
                    status=models.ReportStatus.VERIFIED, notes="Litter near Benito Nieto school",
                    reporter_id=citizen.id),
        make_report(lat=14.8112, lon=121.0391, barangay="Muzon East",
                    status=models.ReportStatus.ASSIGNED, notes="Trash accumulation along residential street",
                    deployed_at=now - timedelta(hours=4)),

        # ── MUZON SOUTH: Pabahay 2000 cluster ──
        make_report(lat=14.7924, lon=121.0359, barangay="Muzon South",
                    status=models.ReportStatus.VERIFIED, notes="Dump site near Pabahay 2000",
                    reporter_id=citizen.id),
        make_report(lat=14.7926, lon=121.0361, barangay="Muzon South",
                    status=models.ReportStatus.ASSIGNED, notes="Illegal dumping by creek",
                    deployed_at=now - timedelta(hours=2)),
        
        # ── DULONG BAYAN: Secondary hotspot (3 reports) ──
        make_report(lat=14.8197, lon=121.0478, barangay="Dulong Bayan",
                    status=models.ReportStatus.VERIFIED, notes="Tire dump"),
        make_report(lat=14.8198, lon=121.0479, barangay="Dulong Bayan",
                    status=models.ReportStatus.ASSIGNED, notes="Construction debris",
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
        make_report(lat=14.8160, lon=121.0255, barangay="Muzon West",
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

    # ─────────────────────────────────────────────
    # SEED WORK ORDERS (across Muzon & demo accounts)
    # ─────────────────────────────────────────────
    cleaner_accounts = db.query(models.User).filter(models.User.role == "cleaner").all()
    cleaners_by_email = {c.email: c for c in cleaner_accounts}

    cleaner_demo = cleaners_by_email.get("cleaner@test.com")
    cleaner_muzon_proper = cleaners_by_email.get("muzonproper@cleaners.com")
    cleaner_muzon_west = cleaners_by_email.get("muzonwest@cleaners.com")
    cleaner_muzon_east = cleaners_by_email.get("muzoneast@cleaners.com")
    cleaner_muzon_south = cleaners_by_email.get("muzonsouth@cleaners.com")
    cleaner_dulong_bayan = cleaners_by_email.get("dulongbayan@cleaners.com")

    db.commit()
    for report in test_reports:
        db.refresh(report)

    sla_priority_days = {"low": 7, "medium": 3, "high": 1}
    work_orders = []

    def assign_wo(rep, cln, priority, status, started_off=None, completed_off=None):
        if not rep or not cln:
            return
        created_at = now - timedelta(hours=4)
        wo = models.WorkOrder(
            report_id=rep.id,
            assigned_cleaner_id=cln.id,
            priority=priority,
            sla_deadline=created_at + timedelta(days=sla_priority_days[priority]),
            status=status,
            created_at=created_at,
            started_at=(now - timedelta(hours=started_off)) if started_off else None,
            completed_at=(now - timedelta(hours=completed_off)) if completed_off else None,
        )
        db.add(wo)
        work_orders.append(wo)

    # 1. Cleaner test account (cleaner@test.com) -> First 3 Muzon Proper reports
    # (guarantees smoke tests check len(wos) >= 3 passes)
    muzon_proper_deployed = [
        r for r in test_reports
        if r.barangay == "Muzon Proper" and r.status in (
            models.ReportStatus.ASSIGNED, models.ReportStatus.IN_PROGRESS, models.ReportStatus.FAILED_CLEANUP
        )
    ]
    wo_specs = [
        ("high", models.WorkOrderStatus.ASSIGNED, None, None),
        ("medium", models.WorkOrderStatus.IN_PROGRESS, 1, None),
        ("medium", models.WorkOrderStatus.NEEDS_REDO, 6, 2),
    ]
    for rep, (prio, st, st_off, comp_off) in zip(muzon_proper_deployed[:3], wo_specs):
        assign_wo(rep, cleaner_demo, prio, st, st_off, comp_off)

    # 2. Muzon Proper Cleaner (muzonproper@cleaners.com) -> Remaining Muzon Proper reports
    for rep, (prio, st, st_off, comp_off) in zip(muzon_proper_deployed[3:6], wo_specs):
        assign_wo(rep, cleaner_muzon_proper, prio, st, st_off, comp_off)

    # 3. Muzon West Cleaner (muzonwest@cleaners.com)
    muzon_west_deployed = [
        r for r in test_reports
        if r.barangay == "Muzon West" and r.status in (
            models.ReportStatus.ASSIGNED, models.ReportStatus.IN_PROGRESS, models.ReportStatus.FAILED_CLEANUP
        )
    ]
    for rep, (prio, st, st_off, comp_off) in zip(muzon_west_deployed, wo_specs):
        assign_wo(rep, cleaner_muzon_west, prio, st, st_off, comp_off)

    # 4. Muzon East Cleaner (muzoneast@cleaners.com)
    muzon_east_deployed = [
        r for r in test_reports
        if r.barangay == "Muzon East" and r.status in (
            models.ReportStatus.ASSIGNED, models.ReportStatus.IN_PROGRESS, models.ReportStatus.FAILED_CLEANUP
        )
    ]
    for rep in muzon_east_deployed:
        assign_wo(rep, cleaner_muzon_east, "medium", models.WorkOrderStatus.ASSIGNED)

    # 5. Muzon South Cleaner (muzonsouth@cleaners.com)
    muzon_south_deployed = [
        r for r in test_reports
        if r.barangay == "Muzon South" and r.status in (
            models.ReportStatus.ASSIGNED, models.ReportStatus.IN_PROGRESS, models.ReportStatus.FAILED_CLEANUP
        )
    ]
    for rep in muzon_south_deployed:
        assign_wo(rep, cleaner_muzon_south, "high", models.WorkOrderStatus.ASSIGNED)

    # 6. Dulong Bayan Cleaner (dulongbayan@cleaners.com)
    dulong_bayan_deployed = [
        r for r in test_reports
        if r.barangay == "Dulong Bayan" and r.status in (
            models.ReportStatus.ASSIGNED, models.ReportStatus.IN_PROGRESS, models.ReportStatus.FAILED_CLEANUP
        )
    ]
    for rep in dulong_bayan_deployed:
        assign_wo(rep, cleaner_dulong_bayan, "medium", models.WorkOrderStatus.ASSIGNED)

    db.commit()
    for wo in work_orders:
        db.refresh(wo)

    print(f"\n🛠️  Created {len(work_orders)} work orders across all deployed barangays.")
    for wo in work_orders:
        cln_email = getattr(wo.assigned_cleaner, 'email', str(wo.assigned_cleaner_id))
        print(f"   → WO #{wo.id} [{wo.report.barangay if wo.report else '?'}] for {cln_email} — priority={wo.priority} status={wo.status}")

    # ─────────────────────────────────────────────
    # SEED SAMPLE NOTIFICATIONS (for cleaners)
    # ─────────────────────────────────────────────
    sample_notifications = []
    for cleaner_target in [cleaner_demo, cleaner_muzon_proper, cleaner_muzon_west]:
        if not cleaner_target:
            continue
        c_wos = [w for w in work_orders if w.assigned_cleaner_id == cleaner_target.id]
        if c_wos:
            w0 = c_wos[0]
            sample_notifications.append(models.Notification(
                user_id=cleaner_target.id,
                kind="job_assigned",
                title=f"New job assigned: {w0.report.tracking_id if w0.report else f'#{w0.id}'}",
                body=f"Priority: {w0.priority.upper()}. Deadline: {w0.sla_deadline.strftime('%b %d %I:%M %p')}",
                work_order_id=w0.id,
                report_id=w0.report_id,
                is_read=False,
                created_at=now - timedelta(minutes=10),
            ))
        redo_wos = [w for w in c_wos if w.status == models.WorkOrderStatus.NEEDS_REDO]
        if redo_wos:
            wr = redo_wos[0]
            sample_notifications.append(models.Notification(
                user_id=cleaner_target.id,
                kind="needs_redo",
                title=f"Cleanup needs redo: {wr.report.tracking_id if wr.report else f'#{wr.id}'}",
                body="AI still detected waste. Please clean more thoroughly and try again.",
                work_order_id=wr.id,
                report_id=wr.report_id,
                is_read=False,
                created_at=now - timedelta(hours=2),
            ))

    for n in sample_notifications:
        db.add(n)
    db.commit()
    print(f"\n🔔 Seeded {len(sample_notifications)} sample notifications for cleaners.")

    print(f"\n✅ Seed complete! Open ecowatch.db in DB Browser to verify.")
    db.close()


if __name__ == "__main__":
    seed()
