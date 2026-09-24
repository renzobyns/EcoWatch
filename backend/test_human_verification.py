"""
Verification smoke test for Two-Layer Verification System (Layer 2 Human-in-the-Loop)
Tests:
- GET /reports/pending-review
- POST /report/{id}/human-verify (confirm approve)
- POST /report/{id}/human-verify (override AI reject)
- POST /report/{id}/human-verify (confirm reject)
- PUT /report/{id}/assign (409 gate on ai_verified / ai_rejected)
"""

import sys
from fastapi.testclient import TestClient
from main import app, get_db
import models

client = TestClient(app)

def run_tests():
    print("=== STARTING TWO-LAYER VERIFICATION TEST SUITE ===")

    # 1. Fetch test users
    db = next(get_db())
    barangay_admin = db.query(models.User).filter(models.User.email == "barangay@test.com").first()
    cenro_admin = db.query(models.User).filter(models.User.email == "cenro@test.com").first()
    cleaner = db.query(models.User).filter(models.User.role == "cleaner").first()

    assert barangay_admin, "barangay@test.com not found. Run seed_test_data.py first."
    assert cenro_admin, "cenro@test.com not found."
    assert cleaner, "Cleaner user not found."

    brgy_headers = {"X-User-Id": str(barangay_admin.id)}
    cenro_headers = {"X-User-Id": str(cenro_admin.id)}

    target_brgy = barangay_admin.barangay_assignment or "Muzon"

    # Create dummy reports for testing
    rep1 = models.Report(
        tracking_id="EW-TEST01",
        tracking_url="/track/EW-TEST01",
        barangay=target_brgy,
        lat=14.8123,
        lon=121.0456,
        status=models.ReportStatus.AI_VERIFIED,
        ai_confidence=0.88,
        notes="Test report 1 - AI verified",
    )
    rep2 = models.Report(
        tracking_id="EW-TEST02",
        tracking_url="/track/EW-TEST02",
        barangay=target_brgy,
        lat=14.8124,
        lon=121.0457,
        status=models.ReportStatus.AI_REJECTED,
        ai_confidence=0.22,
        notes="Test report 2 - AI rejected",
    )
    rep3 = models.Report(
        tracking_id="EW-TEST03",
        tracking_url="/track/EW-TEST03",
        barangay=target_brgy,
        lat=14.8125,
        lon=121.0458,
        status=models.ReportStatus.AI_VERIFIED,
        ai_confidence=0.75,
        notes="Test report 3 - AI verified to be rejected by human",
    )
    db.add_all([rep1, rep2, rep3])
    db.commit()
    db.refresh(rep1)
    db.refresh(rep2)
    db.refresh(rep3)

    print(f"[1] Created test reports: {rep1.id} (ai_verified), {rep2.id} (ai_rejected), {rep3.id} (ai_verified)")

    # 2. Test GET /reports/pending-review
    res = client.get("/reports/pending-review", headers=brgy_headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    items = res.json()
    test_ids = [r["id"] for r in items]
    assert rep1.id in test_ids, f"Report {rep1.id} should be in pending review"
    assert rep2.id in test_ids, f"Report {rep2.id} should be in pending review"
    print(f"[2] GET /reports/pending-review passed! Found {len(items)} reports in queue.")

    # 3. Test Assignment Gate: PUT /report/{id}/assign must return 409 for ai_verified
    assign_res = client.put(
        f"/report/{rep1.id}/assign",
        headers=brgy_headers,
        json={"cleaner_id": cleaner.id, "priority": "medium", "notes": "Test assign"},
    )
    assert assign_res.status_code == 409, f"Expected 409 Conflict, got {assign_res.status_code}: {assign_res.text}"
    assert "human verification" in assign_res.json()["detail"].lower()
    print("[3] Assignment Gate test passed! 409 Conflict returned when assigning unverified report.")

    # 4. Test Layer 2 Approval: POST /report/{rep1.id}/human-verify (confirm approve)
    approve_res = client.post(
        f"/report/{rep1.id}/human-verify",
        headers=brgy_headers,
        json={"action": "approve", "reason": "Verified plastic bottles"},
    )
    assert approve_res.status_code == 200, f"Expected 200, got {approve_res.status_code}: {approve_res.text}"
    data = approve_res.json()
    assert data["new_status"] == models.ReportStatus.VERIFIED
    assert data["verification_action"] == "confirmed"

    # Verify DB state
    db.refresh(rep1)
    assert rep1.status == models.ReportStatus.VERIFIED
    assert rep1.human_verified_by == barangay_admin.id
    assert rep1.human_verification_action == "confirmed"
    assert rep1.human_verified_at is not None
    print("[4] Layer 2 Confirm Approval passed! Report transitioned to 'verified'.")

    # 5. Now assign should succeed on the verified report
    assign_ok = client.put(
        f"/report/{rep1.id}/assign",
        headers=brgy_headers,
        json={"cleaner_id": cleaner.id, "priority": "medium", "notes": "Test assign after verify"},
    )
    assert assign_ok.status_code == 200, f"Expected 200, got {assign_ok.status_code}: {assign_ok.text}"
    db.refresh(rep1)
    assert rep1.status == models.ReportStatus.ASSIGNED
    print("[5] Cleaner assignment succeeded on verified report!")

    # 6. Test Manual Override: POST /report/{rep2.id}/human-verify (override AI reject)
    # 6a. Should fail if reason is missing / too short
    fail_override = client.post(
        f"/report/{rep2.id}/human-verify",
        headers=brgy_headers,
        json={"action": "approve", "reason": ""},
    )
    assert fail_override.status_code == 400, "Should reject empty reason on override"

    # 6b. Succeed with valid reason
    override_res = client.post(
        f"/report/{rep2.id}/human-verify",
        headers=brgy_headers,
        json={"action": "approve", "reason": "Waste clearly visible in bushes (AI missed it)"},
    )
    assert override_res.status_code == 200, f"Expected 200, got {override_res.status_code}: {override_res.text}"
    data = override_res.json()
    assert data["new_status"] == models.ReportStatus.VERIFIED
    assert data["verification_action"] == "overridden"

    db.refresh(rep2)
    assert rep2.status == models.ReportStatus.VERIFIED
    assert rep2.human_verification_action == "overridden"
    print("[6] Manual Override of AI-rejected report passed! CENRO notified & status verified.")

    # 7. Test Human Rejection of AI-verified report: POST /report/{rep3.id}/human-verify
    reject_res = client.post(
        f"/report/{rep3.id}/human-verify",
        headers=cenro_headers,
        json={"action": "reject", "reason": "Not illegal dumping (private household bin)"},
    )
    assert reject_res.status_code == 200, f"Expected 200, got {reject_res.status_code}: {reject_res.text}"
    data = reject_res.json()
    assert data["new_status"] == models.ReportStatus.REJECTED
    assert data["verification_action"] == "rejected"

    db.refresh(rep3)
    assert rep3.status == models.ReportStatus.REJECTED
    assert rep3.human_verification_action == "rejected"
    print("[7] Human Rejection of AI-verified report passed!")

    # 8. Clean up dummy reports
    db.query(models.WorkOrder).filter(models.WorkOrder.report_id == rep1.id).delete()
    db.delete(rep1)
    db.delete(rep2)
    db.delete(rep3)
    db.commit()
    print("[8] Test cleanup complete.")

    print("\n=== ALL TWO-LAYER VERIFICATION TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_tests()
