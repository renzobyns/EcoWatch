"""
Safe reports reset utility for EcoWatch SJDM.

Wipes all reports, work orders, photos, and associated notifications/audit logs
WITHOUT touching user accounts, roles, barangay profiles, or system config.

Works on both dev (SQLite) and prod (PostgreSQL via Supabase).

Usage:
    python reset_reports.py              # Interactive confirmation prompt
    python reset_reports.py --dry-run    # Preview count of records to be deleted
    python reset_reports.py --force      # Execute immediately without prompt
"""

import sys
import argparse
from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models


def get_counts(db: Session) -> dict:
    return {
        "cleanup_photos": db.query(models.CleanupPhoto).count(),
        "report_photos": db.query(models.ReportPhoto).count(),
        "notifications": db.query(models.Notification).filter(models.Notification.report_id.isnot(None)).count(),
        "audit_logs": db.query(models.AuditLog).filter(models.AuditLog.target_type.in_(["report", "work_order"])).count(),
        "work_orders": db.query(models.WorkOrder).count(),
        "reports": db.query(models.Report).count(),
        "users (PRESERVED)": db.query(models.User).count(),
        "system_config (PRESERVED)": db.query(models.SystemConfig).count(),
    }


def reset_reports(dry_run: bool = False, force: bool = False) -> None:
    db: Session = SessionLocal()
    try:
        counts = get_counts(db)
        print("\n" + "=" * 60)
        print(" EcoWatch SJDM — Safe Report Reset Utility")
        print("=" * 60)
        print("\nCurrent database state:")
        for table, count in counts.items():
            prefix = "  [SAFE] " if "PRESERVED" in table else "  [WIPE] "
            print(f"{prefix}{table:<28}: {count}")

        if counts["reports"] == 0:
            print("\nDatabase is already clean. No reports to reset.")
            return

        if dry_run:
            print("\n[DRY RUN] No records were modified.")
            return

        if not force:
            confirm = input("\nType 'RESET' to confirm wiping all reports & work orders: ").strip()
            if confirm != "RESET":
                print("Aborted. No records were modified.")
                return

        print("\nWiping report records in correct foreign-key order...")

        # 1. Notifications linked to reports or work orders
        deleted_notifs = db.query(models.Notification).filter(
            (models.Notification.report_id.isnot(None)) | (models.Notification.work_order_id.isnot(None))
        ).delete(synchronize_session=False)

        # 2. Cleanup photos
        deleted_cleanup_photos = db.query(models.CleanupPhoto).delete(synchronize_session=False)

        # 3. Report photos
        deleted_report_photos = db.query(models.ReportPhoto).delete(synchronize_session=False)

        # 4. Audit logs for reports
        deleted_audit = db.query(models.AuditLog).filter(
            models.AuditLog.target_type.in_(["report", "work_order"])
        ).delete(synchronize_session=False)

        # 5. Work orders
        deleted_wo = db.query(models.WorkOrder).delete(synchronize_session=False)

        # 6. Nullify duplicate_of_id self-references on Report
        db.query(models.Report).update({models.Report.duplicate_of_id: None}, synchronize_session=False)

        # 7. Delete all reports
        deleted_reports = db.query(models.Report).delete(synchronize_session=False)

        db.commit()

        print("\n" + "=" * 60)
        print(" RESET COMPLETE")
        print("=" * 60)
        print(f"  Reports deleted       : {deleted_reports}")
        print(f"  Work orders deleted   : {deleted_wo}")
        print(f"  Report photos deleted : {deleted_report_photos}")
        print(f"  Cleanup photos deleted: {deleted_cleanup_photos}")
        print(f"  Notifications cleaned : {deleted_notifs}")
        print(f"  Audit logs cleaned    : {deleted_audit}")
        print(f"  User accounts kept    : {counts['users (PRESERVED)']}")
        print(f"  System configs kept   : {counts['system_config (PRESERVED)']}")
        print("=" * 60)
        print("Ready for live submission testing.\n")

    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] Transaction failed and was rolled back: {e}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Safely reset EcoWatch reports without deleting users.")
    parser.add_argument("--dry-run", action="store_true", help="Preview counts without deleting.")
    parser.add_argument("--force", action="store_true", help="Execute without asking for interactive confirmation.")
    args = parser.parse_args()

    reset_reports(dry_run=args.dry_run, force=args.force)
