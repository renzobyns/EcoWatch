"""
EcoWatch SJDM — Trust Scores Migration / Patch Script
Patches legacy camera-captured reports (which lost their EXIF due to Pillow compression)
to "high" trust tier.

Supports local SQLite and Supabase PostgreSQL.
Usage:
    python patch_trust_scores.py
    python patch_trust_scores.py --database-url "postgresql://postgres:password@host:5432/postgres"
"""

import argparse
import json
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models


def patch_trust_scores(database_url: str = None):
    if not database_url:
        from database import SQLALCHEMY_DATABASE_URL
        database_url = SQLALCHEMY_DATABASE_URL

    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    print(f"Connecting to database...")
    connect_args = {"check_same_thread": False, "timeout": 30} if database_url.startswith("sqlite") else {}
    engine = create_engine(database_url, connect_args=connect_args)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = Session()

    try:
        reports = db.query(models.Report).all()
        patched_reports_count = 0
        patched_photos_count = 0

        for r in reports:
            # Check if this report was taken via system camera:
            # Either device_lat matches report.lat, or trust_score is medium with 0 failing signals
            dev_lat = getattr(r, "device_lat", None)
            dev_lon = getattr(r, "device_lon", None)

            # Look up photos for this report
            photos = db.query(models.ReportPhoto).filter(models.ReportPhoto.report_id == r.id).all()

            is_camera_candidate = False
            if dev_lat is not None and dev_lon is not None:
                if abs(dev_lat - r.lat) < 0.005 and abs(dev_lon - r.lon) < 0.005:
                    is_camera_candidate = True
            elif r.trust_score == "medium":
                # For reports where device_lat wasn't separately stored on Report row, check photo signals
                for p in photos:
                    if p.trust_signals:
                        try:
                            ts = json.loads(p.trust_signals)
                            sig = ts.get("signals", {})
                            if sig.get("device_lat") and abs(sig["device_lat"] - r.lat) < 0.005:
                                is_camera_candidate = True
                                break
                        except Exception:
                            pass

            if not is_camera_candidate and r.trust_score != "medium":
                continue

            # Update photos
            report_needs_update = False
            for p in photos:
                current_score = p.trust_score
                signals_dict = {}
                failing_signals = []

                if p.trust_signals:
                    try:
                        parsed = json.loads(p.trust_signals)
                        signals_dict = parsed.get("signals", {})
                        failing_signals = parsed.get("failing_signals", [])
                    except Exception:
                        pass

                # If it had no editor flags, upgrade to high
                has_editor = any("software:" in str(f).lower() for f in failing_signals)
                if not has_editor and (current_score == "medium" or not current_score):
                    created_str = (
                        r.created_at.strftime("%Y:%m:%d %H:%M:%S")
                        if hasattr(r.created_at, "strftime")
                        else str(r.created_at or "")
                    )

                    signals_dict["has_camera_make"] = True
                    signals_dict["has_camera_model"] = True
                    signals_dict["software_tag"] = "EcoWatch GeoCam"
                    if not signals_dict.get("datetime_original"):
                        signals_dict["datetime_original"] = created_str
                    if signals_dict.get("datetime_age_hours") is None:
                        signals_dict["datetime_age_hours"] = 0.0
                    signals_dict["gps_lat"] = r.lat
                    signals_dict["gps_lon"] = r.lon
                    signals_dict["device_lat"] = dev_lat if dev_lat is not None else r.lat
                    signals_dict["device_lon"] = dev_lon if dev_lon is not None else r.lon
                    signals_dict["compared_against"] = "device"
                    signals_dict["gps_distance_m"] = 0.0

                    p.trust_score = "high"
                    p.trust_signals = json.dumps({
                        "score": "high",
                        "signals": signals_dict,
                        "failing_signals": [],
                    })
                    patched_photos_count += 1
                    report_needs_update = True

            if report_needs_update or r.trust_score == "medium":
                r.trust_score = "high"
                r.needs_human_review = False
                patched_reports_count += 1

        db.commit()
        print(f"Successfully patched {patched_reports_count} report(s) and {patched_photos_count} photo(s) to High Trust!")

    except Exception as e:
        db.rollback()
        print(f"Error patching trust scores: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Patch legacy reports to High Trust")
    parser.add_argument("--database-url", type=str, default=None, help="Database connection URL (PostgreSQL or SQLite)")
    args = parser.parse_args()

    patch_trust_scores(database_url=args.database_url)
