"""
Smoke test for /reports/{id}/detail and /audit-log?target_id=…

Run while the dev server is up:
    uvicorn main:app --reload
    python test_report_detail.py
"""
import requests
import sys

BASE = "http://127.0.0.1:8000"

if __name__ == "__main__":
    # Session-based auth: log in, reuse cookies.
    session = requests.Session()
    login = session.post(
        f"{BASE}/auth/login",
        json={"email": "cenro@test.com", "password": "password123"},
    )
    if login.status_code != 200:
        print(f"CENRO login failed ({login.status_code}). Did you run seed_test_data.py?")
        sys.exit(1)

    rid = session.get(f"{BASE}/reports/recent?limit=1").json()[0]["id"]

    # Test 1: /reports/{id}/detail returns correct shape
    r = session.get(f"{BASE}/reports/{rid}/detail")
    assert r.status_code == 200, f"detail: {r.status_code} {r.text}"
    body = r.json()
    assert body["report"]["id"] == rid
    assert "cleanup_photos" in body and "work_orders" in body
    assert "reporter" in body, "Payload missing 'reporter' field"
    if body["reporter"] is not None:
        assert "full_name" in body["reporter"] and "email" in body["reporter"]
    print(f"OK /reports/{rid}/detail — {len(body['work_orders'])} WOs, "
          f"{len(body['cleanup_photos'])} cleanup photos, "
          f"reporter={'anonymous' if body['reporter'] is None else body['reporter']['email']}")

    # Test 2: 404 for non-existent report
    r = session.get(f"{BASE}/reports/99999999/detail")
    assert r.status_code == 404, f"404 test: {r.status_code}"
    print("OK /reports/99999999/detail returns 404")

    # Test 3: /audit-log?target_id filters correctly
    r = session.get(f"{BASE}/audit-log?target_id={rid}")
    assert r.status_code == 200, f"audit filter: {r.status_code} {r.text}"
    body = r.json()
    for e in body["entries"]:
        assert e["target_id"] == rid, f"Entry leaked from another report: {e}"
    print(f"OK /audit-log?target_id={rid} — {len(body['entries'])} entries")

    print("\nAll smoke tests passed.")
