import requests

BASE_URL = "http://127.0.0.1:8000"

test_cases = [
    {"name": "Dulong Bayan (Inside)", "lat": 14.8197, "lon": 121.0478},
    {"name": "Bagong Buhay (Inside)", "lat": 14.8550, "lon": 121.0590},
    {"name": "Manila City (Outside)", "lat": 14.5995, "lon": 120.9842}
]

print("--- EcoWatch SJDM Spatial Engine Test ---")
for case in test_cases:
    print(f"Testing {case['name']}...")
    try:
        response = requests.post(
            f"{BASE_URL}/report/validate-location",
            json={"lat": case["lat"], "lon": case["lon"]}
        )
        if response.status_code == 200:
            print(f"  Result: ✅ Success - {response.json()['barangay']}")
        else:
            print(f"  Result: ❌ Rejected - {response.json()['detail']}")
    except Exception as e:
        print(f"  Error: Could not connect to API ({e})")
print("-----------------------------------------")
