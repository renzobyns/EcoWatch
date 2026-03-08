import json
from shapely.geometry import shape, Point
import os

# Path to the SJDM GeoJSON data
DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "sjdm_barangays.geojson")

def get_barangay_from_coords(lat: float, lon: float):
    """
    Ray-Casting (Point-in-Polygon) implementation to find which Barangay 
    a given coordinate belongs to.
    """
    try:
        with open(DATA_PATH, 'r') as f:
            geojson_data = json.load(f)
        
        point = Point(lon, lat)  # Shapely uses (x, y) which is (lon, lat)
        
        for feature in geojson_data['features']:
            polygon = shape(feature['geometry'])
            if polygon.contains(point):
                return {
                    "barangay": feature['properties'].get('ADM4_EN'),
                    "pcode": feature['properties'].get('ADM4_PCODE'),
                    "city": "San Jose del Monte"
                }
                
        return {"error": "Location is outside SJDM boundaries"}
    except Exception as e:
        return {"error": f"Spatial calculation error: {str(e)}"}

# Test if the file exists and can be loaded
if __name__ == "__main__":
    # Example coordinates for SJDM (adjust as needed for testing)
    test_lat, test_lon = 14.8197, 121.0478  # Sample near Dulong Bayan
    result = get_barangay_from_coords(test_lat, test_lon)
    print(f"Test Result: {result}")
