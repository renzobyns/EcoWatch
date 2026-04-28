from fastapi.testclient import TestClient
from main import app
import json

client = TestClient(app)

print("\n--- Testing Default Accounts ---")

users_to_test = [
    {"email": "citizen@test.com", "password": "password123", "expected_role": "citizen"},
    {"email": "barangay@test.com", "password": "password123", "expected_role": "barangay"},
    {"email": "cenro@test.com", "password": "password123", "expected_role": "cenro"}
]

for user in users_to_test:
    print(f"\nLogging in as {user['email']}...")
    response = client.post("/auth/login", json={"email": user["email"], "password": user["password"]})
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Success! Welcome {data['user']['full_name']}")
        print(f"   Role: {data['user']['role']}")
        if data['user']['barangay_assignment']:
            print(f"   Barangay Assignment: {data['user']['barangay_assignment']}")
        
        if data['user']['role'] == user['expected_role']:
            print("   ✅ Role matches expected!")
        else:
            print("   ❌ Role mismatch!")
    else:
        print(f"❌ Login failed: {response.text}")

print("\n--- Testing Reports Endpoint ---")
response = client.get("/reports/recent")
if response.status_code == 200:
    reports = response.json()
    print(f"✅ Fetching recent reports: Found {len(reports)} reports.")
    print("   Sample report data:")
    if len(reports) > 0:
        sample = reports[0]
        print(f"   - Tracking ID: {sample.get('tracking_id')}")
        print(f"   - Status: {sample.get('status')}")
        print(f"   - Barangay: {sample.get('barangay')}")
else:
    print("❌ Failed to fetch reports.")
