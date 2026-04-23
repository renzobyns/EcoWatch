import spatial_utils
import analytics
import models
from database import SessionLocal
import json

def run_test():
    db = SessionLocal()
    reports = db.query(models.Report).all()
    
    print("--- 1. Testing Ray-Casting (Point in Polygon) ---")
    results = []
    for r in reports:
        assignment = spatial_utils.get_barangay_from_coords(r.lat, r.lon)
        barangay = assignment.get("barangay", "OUTSIDE SJDM")
        print(f"Report at ({r.lat}, {r.lon}) -> Assigned to: {barangay}")
        results.append(barangay)
        
        # Update the DB so we have realistic data for the heatmap
        if "barangay" in assignment:
            r.barangay = assignment["barangay"]
    
    db.commit()

    print("\n--- 2. Testing DBSCAN (Clustering / Hotspots) ---")
    # eps=0.001 (~100m), min_samples=2
    clusters = analytics.get_heatmap_clusters(reports, eps=0.001, min_samples=2)
    
    print(f"Found {len(clusters)} Hotspots.")
    for c in clusters:
        print(f"Cluster ID {c['cluster_id']}: {c['intensity']} reports centered at ({c['lat']:.4f}, {c['lon']:.4f})")

    # Validation logic
    hotspot_count = len(clusters)
    if hotspot_count == 2:
        print("\n✅ SUCCESS: DBSCAN correctly identified 2 clusters and filtered out outliers.")
    else:
        print(f"\n❌ FAILED: Expected 2 clusters, but found {hotspot_count}.")

    db.close()

if __name__ == "__main__":
    try:
        run_test()
    except Exception as e:
        print(f"Error during test: {e}")
