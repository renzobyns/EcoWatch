import os
import sys
from sqlalchemy import create_engine, text

db_url = "postgresql://postgres.cndsqjgildhumsquyypd:1FoTmDvPKvhUkI1Y@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"

print("Connecting to Supabase PostgreSQL database...")
try:
    engine = create_engine(db_url)
    with engine.begin() as conn:
        print("Connected! Fetching reports and photos with full Supabase URLs...")
        
        # 1. Update report table image_url
        result_rep = conn.execute(text("SELECT id, image_url, ai_mask_url, cleanup_image_url FROM reports"))
        for row in result_rep:
            rep_id = row[0]
            updates = {}
            for col_idx, col_name in enumerate(["image_url", "ai_mask_url", "cleanup_image_url"], start=1):
                val = row[col_idx]
                if val and val.startswith("http"):
                    filename = val.split("/")[-1]
                    updates[col_name] = f"/uploads/{filename}"
            
            if updates:
                set_clause = ", ".join([f"{col} = :{col}" for col in updates.keys()])
                stmt = text(f"UPDATE reports SET {set_clause} WHERE id = :id")
                conn.execute(stmt, {**updates, "id": rep_id})
                print(f"Updated report ID {rep_id} fields: {list(updates.keys())}")
        
        # 2. Update report_photos table file_path and ai_mask_path
        result_photo = conn.execute(text("SELECT id, file_path, ai_mask_path FROM report_photos"))
        for row in result_photo:
            photo_id = row[0]
            updates = {}
            for col_idx, col_name in enumerate(["file_path", "ai_mask_path"], start=1):
                val = row[col_idx]
                if val and val.startswith("http"):
                    filename = val.split("/")[-1]
                    updates[col_name] = f"/uploads/{filename}"
            
            if updates:
                set_clause = ", ".join([f"{col} = :{col}" for col in updates.keys()])
                stmt = text(f"UPDATE report_photos SET {set_clause} WHERE id = :id")
                conn.execute(stmt, {**updates, "id": photo_id})
                print(f"Updated report_photo ID {photo_id} fields: {list(updates.keys())}")
                
        print("\nDatabase paths successfully cleaned up!")
except Exception as e:
    print(f"Error executing cleanup: {str(e)}")
    sys.exit(1)
