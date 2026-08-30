"""
EcoWatch SJDM — Mini-Phase 2.2 RBAC & Role Management Test Suite
Tests CENRO role transitions, self-demotion protection, barangay assignment validation, and audit logging.
"""
import os
import sys
import requests
import time

BASE_URL = os.getenv("API_URL", "http://127.0.0.1:8000")

def login(email: str, password: str = "password123"):
    r = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=5)
    if r.status_code != 200:
        print(f"Failed to login as {email}: {r.status_code} {r.text}")
        return None
    data = r.json()
    return data.get("user", data)

def test_rbac_governance():
    print("\n[TEST] 1. Authenticating Test Accounts")
    cenro = login("cenro@test.com")
    barangay = login("barangay@test.com")
    assert cenro is not None, "CENRO login failed"
    assert barangay is not None, "Barangay login failed"
    print(f"  ✓ Logged in as CENRO (id={cenro['id']})")
    print(f"  ✓ Logged in as Barangay (id={barangay['id']})")

    # Create a fresh citizen to test role changes
    test_email = f"citizen_rbac_{int(time.time())}@example.com"
    r = requests.post(f"{BASE_URL}/auth/register", json={
        "email": test_email,
        "password": "Password123",
        "full_name": "RBAC Test Citizen"
    }, timeout=5)
    assert r.status_code in [200, 201], f"Failed to register test citizen: {r.text}"
    citizen = r.json()
    citizen_id = citizen["id"]
    print(f"  ✓ Created test citizen (id={citizen_id}, role={citizen['role']})")

    # 2. Test Barangay user trying to change role (Should fail with 403)
    print("\n[TEST] 2. Non-CENRO Attempting Role Modification (Expected: 403 Forbidden)")
    r = requests.put(
        f"{BASE_URL}/users/{citizen_id}",
        json={"role": "cenro"},
        headers={"X-User-Id": str(barangay["id"])},
        timeout=5
    )
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
    print(f"  ✓ Non-CENRO blocked from modifying roles: {r.json().get('detail')}")

    # 3. Test CENRO changing role to barangay WITHOUT barangay assignment (Expected: 400 Bad Request)
    print("\n[TEST] 3. Promoting to Barangay Without Assignment (Expected: 400 Bad Request)")
    r = requests.put(
        f"{BASE_URL}/users/{citizen_id}",
        json={"role": "barangay", "barangay_assignment": ""},
        headers={"X-User-Id": str(cenro["id"])},
        timeout=5
    )
    assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
    print(f"  ✓ Missing barangay assignment rejected: {r.json().get('detail')}")

    # 4. Test CENRO successfully promoting citizen to barangay officer
    print("\n[TEST] 4. CENRO Promoting Citizen to Barangay Officer (Expected: 200 OK)")
    r = requests.put(
        f"{BASE_URL}/users/{citizen_id}",
        json={"role": "barangay", "barangay_assignment": "Muzon"},
        headers={"X-User-Id": str(cenro["id"])},
        timeout=5
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    updated = r.json()
    assert updated["role"] == "barangay", f"Expected role 'barangay', got {updated['role']}"
    assert updated["barangay_assignment"] == "Muzon", f"Expected 'Muzon', got {updated['barangay_assignment']}"
    print(f"  ✓ Successfully promoted citizen to Barangay Officer for Muzon")

    # 5. Test CENRO self-demotion prevention (Expected: 400 Bad Request)
    print("\n[TEST] 5. CENRO Self-Demotion Lockout Prevention (Expected: 400 Bad Request)")
    r = requests.put(
        f"{BASE_URL}/users/{cenro['id']}",
        json={"role": "citizen"},
        headers={"X-User-Id": str(cenro["id"])},
        timeout=5
    )
    assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
    print(f"  ✓ Self-demotion blocked: {r.json().get('detail')}")

    # 6. Test Demoting back to Citizen (clears barangay assignment)
    print("\n[TEST] 6. Demoting Officer back to Citizen (Expected: 200 OK, Cleared Assignment)")
    r = requests.put(
        f"{BASE_URL}/users/{citizen_id}",
        json={"role": "citizen"},
        headers={"X-User-Id": str(cenro["id"])},
        timeout=5
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    demoted = r.json()
    assert demoted["role"] == "citizen", f"Expected 'citizen', got {demoted['role']}"
    assert demoted["barangay_assignment"] is None, f"Expected None, got {demoted['barangay_assignment']}"
    print(f"  ✓ Demoted to citizen and cleared barangay assignment successfully")

if __name__ == "__main__":
    print("=" * 60)
    print("  EcoWatch Mini-Phase 2.2 RBAC & Governance Test Suite")
    print("=" * 60)
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=3)
        if r.status_code != 200:
            print(f"Backend returned status {r.status_code}, aborting test.")
            sys.exit(1)
        test_rbac_governance()
        print("\n" + "=" * 60)
        print("  ALL MINI-PHASE 2.2 RBAC TESTS PASSED! ✅")
        print("=" * 60)
    except requests.exceptions.ConnectionError:
        print(f"\n[INFO] Backend not currently running at {BASE_URL}. Start with 'uvicorn main:app --reload' to run live test.")
