import numpy as np
from sklearn.cluster import DBSCAN

def get_heatmap_clusters(reports, eps=0.001, min_samples=2):
    """
    Applies DBSCAN clustering on report coordinates to identify
    high-density dumping zones (hotspots).
    
    eps=0.001 degrees is roughly ~100 meters.
    """
    if not reports:
        return []
        
    # Extract coordinates
    coords = np.array([[r.lat, r.lon] for r in reports])
    
    # Run DBSCAN
    db = DBSCAN(eps=eps, min_samples=min_samples).fit(coords)
    labels = db.labels_
    
    clusters = []
    # labels -> -1 means noise (unclustered)
    unique_labels = set(labels)
    
    for label in unique_labels:
        if label == -1:
            continue # Skip noise points for the heatmap hotspots
            
        class_member_mask = (labels == label)
        cluster_points = coords[class_member_mask]
        
        # Calculate centroid of the cluster
        centroid_lat = np.mean(cluster_points[:, 0])
        centroid_lon = np.mean(cluster_points[:, 1])
        
        clusters.append({
            "cluster_id": int(label),
            "lat": float(centroid_lat),
            "lon": float(centroid_lon),
            "intensity": len(cluster_points), # number of reports in this hotspot
            "points": [{"lat": float(p[0]), "lon": float(p[1])} for p in cluster_points]
        })
        
    return clusters
