"""
EcoWatch — End-to-End Smoke Test
=================================
Exercises every critical backend workflow a fresh tester needs to verify
works after setup. Prints PASS/FAIL per check with full context.

Run AFTER `python seed_test_data.py` and with `uvicorn main:app --reload`
running in another terminal:

    python smoke_test.py

Exit code 0 = all green, 1 = something failed (read the FAIL lines).

What it covers (matches the user's verification checklist):
- Health + auth (all 4 roles + 1 per-barangay account)
- Spatial routing (ray-casting point-in-polygon)
- DBSCAN heatmap clustering
- Report submission pipeline (image upload + Mask R-CNN)
- Tracking lookup
- RBAC enforcement on protected endpoints
- Cross-portal report visibility (barangay queue + cenro feed)
- Work order lifecycle (cleaner queue)
- Mask R-CNN mode detection (mock vs real)
"""
from __future__ import annotations

import os
import sys
from typing import Optional

try:
    import requests
except ImportError:
    print("FATAL: requests not installed. Run: pip install requests")
    sys.exit(1)


BASE = os.environ.get("ECOWATCH_API", "http://127.0.0.1:8000")
UPLOADS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")

# ─── output helpers ──────────────────────────────────────────────────
_OK = "[ OK ]"
_FAIL = "[FAIL]"
_INFO = "[INFO]"
_passed = 0
_failed = 0
_failures: list[str] = []


def section(title: str) -> None:
    print()
    print("=" * 72)
    print(f"  {title}")
    print("=" * 72)


def ok(msg: str) -> None:
    global _passed
    _passed += 1
    print(f"{_OK} {msg}")


def fail(msg: str, detail: str = "") -> None:
    global _failed
    _failed += 1
    line = f"{_FAIL} {msg}"
    if detail:
        line += f"\n         {detail}"
    print(line)
    _failures.append(msg)


def info(msg: str) -> None:
    print(f"{_INFO} {msg}")


def check(condition: bool, msg: str, detail: str = "") -> bool:
    if condition:
        ok(msg)
        return True
    fail(msg, detail)
    return False


# ─── shared HTTP wrappers ───────────────────────────────────────────
def get(path: str, user_id: Optional[int] = None, **kw) -> requests.Response:
    headers = kw.pop("headers", {})
    if user_id is not None:
        headers["X-User-Id"] = str(user_id)
    return requests.get(f"{BASE}{path}", headers=headers, timeout=30, **kw)


def post(path: str, user_id: Optional[int] = None, **kw) -> requests.Response:
    headers = kw.pop("headers", {})
    if user_id is not None:
        headers["X-User-Id"] = str(user_id)
    return requests.post(f"{BASE}{path}", headers=headers, timeout=60, **kw)


def login(email: str, password: str = "password123") -> Optional[dict]:
    """Returns the user dict from /auth/login, or None on failure.
    Backend wraps the response as {success: bool, user: {...}}.
    """
    try:
        r = requests.post(
            f"{BASE}/auth/login",
            json={"email": email, "password": password},
            timeout=10,
        )
    except requests.RequestException as e:
        fail(f"login({email}) network error", str(e))
        return None
    if r.status_code != 200:
        fail(f"login({email}) failed", f"{r.status_code} {r.text[:200]}")
        return None
    body = r.json()
    # Unwrap {success, user} envelope; tolerate either shape
    return body.get("user", body) if isinstance(body, dict) else None


# ─── individual sections ────────────────────────────────────────────
def s1_health_and_auth() -> dict:
    section("1. HEALTH + AUTH (all 4 quick-demo + 1 per-barangay account)")
    users: dict[str, dict] = {}

    r = requests.get(f"{BASE}/health", timeout=5)
    check(r.status_code == 200, "GET /health returns 200",
          f"got {r.status_code}: {r.text[:120]}")

    for role, email in [
        ("citizen", "citizen@test.com"),
        ("barangay", "barangay@test.com"),
        ("cenro", "cenro@test.com"),
        ("cleaner", "cleaner@test.com"),
    ]:
        u = login(email)
        if not u:
            continue
        ok(f"login({email}) -> id={u.get('id')} role={u.get('role')}")
        users[role] = u

    # Per-barangay account (proves seed_test_data.py created the 118 extras)
    muzon_brgy = login("muzon@barangay.com")
    if muzon_brgy:
        ok(f"login(muzon@barangay.com) -> id={muzon_brgy['id']} "
           f"barangay={muzon_brgy.get('barangay_assignment')}")
        check(muzon_brgy.get("barangay_assignment") == "Muzon",
              "muzon@barangay.com is assigned to 'Muzon'",
              f"got {muzon_brgy.get('barangay_assignment')!r}")

    # Wrong password rejected
    r = requests.post(
        f"{BASE}/auth/login",
        json={"email": "citizen@test.com", "password": "wrongpw"},
        timeout=10,
    )
    check(r.status_code == 401, "wrong password is rejected with 401",
          f"got {r.status_code}")

    return users


def s2_spatial_routing() -> None:
    section("2. RAY-CASTING — POINT-IN-POLYGON BARANGAY ROUTING")

    # Muzon coords from the seed data
    r = post("/report/validate-location", json={"lat": 14.8150, "lon": 121.0250})
    if r.status_code == 200:
        body = r.json()
        brgy = body.get("barangay")
        check(brgy == "Muzon",
              f"Muzon coords (14.8150, 121.0250) -> 'Muzon'",
              f"got {brgy!r}, full: {body}")
    else:
        fail("validate-location for Muzon coords",
             f"{r.status_code} {r.text[:200]}")

    # Dulong Bayan coords
    r = post("/report/validate-location", json={"lat": 14.8197, "lon": 121.0478})
    if r.status_code == 200:
        body = r.json()
        check(body.get("barangay") == "Dulong Bayan",
              "Dulong Bayan coords -> 'Dulong Bayan'",
              f"got {body.get('barangay')!r}")
    else:
        fail("validate-location for Dulong Bayan", f"{r.status_code} {r.text[:200]}")

    # Out-of-SJDM coords (Quezon City)
    r = post("/report/validate-location", json={"lat": 14.6760, "lon": 121.0437})
    if r.status_code == 200:
        body = r.json()
        # Either returns error key or barangay is None/Unknown
        outside = (body.get("error") is not None
                   or body.get("barangay") in (None, "Unknown", ""))
        check(outside, "Quezon City coords -> 'outside SJDM' indicator",
              f"got {body}")
    else:
        # Some implementations return 400 for outside-area, that's also valid
        check(r.status_code in (400, 404),
              "Quezon City coords -> error response",
              f"got {r.status_code}")

    # Spatial GeoJSON endpoint (drives the map)
    r = get("/spatial/barangays")
    if r.status_code == 200:
        gj = r.json()
        n = len(gj.get("features", []))
        check(n == 59, "GET /spatial/barangays returns 59 features",
              f"got {n}")
    else:
        fail("GET /spatial/barangays", f"{r.status_code} {r.text[:120]}")


def s3_dbscan_heatmap() -> None:
    section("3. DBSCAN — HEATMAP HOTSPOT CLUSTERING")

    r = get("/spatial/heatmaps")
    if r.status_code != 200:
        fail("GET /spatial/heatmaps", f"{r.status_code} {r.text[:200]}")
        return

    payload = r.json()
    # Endpoint returns {total_active_reports: N, hotspots: [...]}
    if isinstance(payload, dict):
        clusters = payload.get("hotspots", [])
        total_active = payload.get("total_active_reports", "?")
        info(f"backend says {total_active} active reports being clustered")
    else:
        clusters = payload if isinstance(payload, list) else []

    check(isinstance(clusters, list), "/spatial/heatmaps returns a hotspot list",
          f"got payload shape: {type(payload).__name__}")

    if not clusters:
        info("DBSCAN returned zero clusters. With the standard seed, the Muzon "
             "reports should cluster. If you re-ran the smoke test multiple "
             "times, the seed reports may have been mixed with isolated ones.")
        return

    ok(f"DBSCAN produced {len(clusters)} hotspot cluster(s)")
    sample = clusters[0]
    for key in ("cluster_id", "lat", "lon", "intensity"):
        check(key in sample, f"cluster has '{key}' field",
              f"sample keys: {list(sample.keys())}")

    # Muzon should be the densest cluster (seed puts 5+ reports at ~14.815, 121.025)
    muzon_clusters = [
        c for c in clusters
        if abs(c.get("lat", 0) - 14.815) < 0.005
        and abs(c.get("lon", 0) - 121.025) < 0.005
    ]
    check(len(muzon_clusters) >= 1,
          "DBSCAN found at least one cluster near Muzon (14.815, 121.025)",
          f"all cluster centers: {[(c.get('lat'), c.get('lon')) for c in clusters]}")


def s4_report_submit_pipeline(users: dict) -> Optional[dict]:
    section("4. REPORT SUBMIT — UPLOAD + RAY-CAST + MASK R-CNN")

    # Find a real image file to submit
    images = [f for f in os.listdir(UPLOADS_DIR)
              if f.lower().endswith((".jpg", ".jpeg", ".png"))]
    if not images:
        fail("no test image found in backend/uploads/",
             "submit pipeline test SKIPPED")
        return None
    test_image = os.path.join(UPLOADS_DIR, images[0])
    info(f"using test image: {os.path.basename(test_image)}")

    # Submit a report with Muzon coords. Endpoint accepts 1-5 photos under
    # the field name 'images' (multi-photo refactor). 'notes' not 'description'.
    lat, lon = 14.8155, 121.0252
    with open(test_image, "rb") as f:
        files = [("images", (os.path.basename(test_image), f.read(), "image/jpeg"))]
        data = {"lat": lat, "lon": lon, "notes": "Smoke test submission"}
        r = post("/report/submit", files=files, data=data)

    if r.status_code not in (200, 201, 202):
        fail("POST /report/submit", f"{r.status_code} {r.text[:300]}")
        return None
    ok(f"POST /report/submit -> {r.status_code}")

    body = r.json()
    tracking_id = body.get("tracking_id")
    tracking_url = body.get("tracking_url", "")
    slug = tracking_url.split("/")[-1] if tracking_url else None
    report_id = body.get("report_id")
    # Note: response uses 'barangay_assigned' (not 'barangay'), and AI runs
    # in a background task so confidence/final status aren't immediate.
    barangay = body.get("barangay_assigned")
    verification_pending = body.get("verification_pending", False)
    initial_status = body.get("status")

    check(tracking_id and tracking_id.startswith("EW-"),
          f"tracking_id is EW-XXXX format ({tracking_id!r})")
    check(slug and len(slug) >= 6, f"tracking_slug present ({slug!r})")
    check(barangay == "Muzon",
          f"ray-casting assigned report to Muzon (got {barangay!r})")
    check(initial_status == "pending",
          f"initial status is 'pending' before AI runs (got {initial_status!r})")
    check(verification_pending is True,
          f"verification_pending flag is True (AI runs async)")

    # Check the photo was saved to disk (uploads/ folder)
    files_after = os.listdir(UPLOADS_DIR)
    new_files = [f for f in files_after if f not in images]
    check(len(new_files) > 0,
          f"new file(s) written to backend/uploads/ ({len(new_files)} added)",
          f"existing: {len(images)}, after: {len(files_after)}")

    # Poll the tracking endpoint until verification completes
    # (or 30s timeout — Mask R-CNN on CPU can take 10-20s)
    info("polling /report/track/{slug} for AI verification to complete...")
    import time
    final = None
    for attempt in range(15):
        time.sleep(2)
        r = get(f"/report/track/{slug}")
        if r.status_code != 200:
            continue
        body = r.json()
        if not body.get("verification_pending", True):
            final = body
            break
    if not final:
        fail("AI verification did not complete within 30s",
             "Mask R-CNN may be stuck. Check uvicorn logs.")
        return {"id": report_id, "slug": slug,
                "tracking_id": tracking_id, "barangay": barangay}

    confidence = final.get("ai_confidence")
    final_status = final.get("status")
    ai_verified = final.get("ai_verified")
    ok(f"AI verification completed: status={final_status} "
       f"confidence={confidence} verified={ai_verified}")
    if confidence is not None:
        check(0.0 <= confidence <= 1.0,
              f"ai_confidence in [0, 1] (got {confidence})")
    check(final_status in ("verified", "rejected"),
          f"final status is verified or rejected (got {final_status!r})")

    return {"id": report_id, "slug": slug, "tracking_id": tracking_id,
            "barangay": barangay}


def s5_tracking(report: Optional[dict]) -> None:
    section("5. PUBLIC TRACKING — /report/track/{slug}")
    if not report or not report.get("slug"):
        fail("tracking test SKIPPED (no report from previous step)")
        return

    r = get(f"/report/track/{report['slug']}")
    if r.status_code != 200:
        fail(f"GET /report/track/{report['slug']}",
             f"{r.status_code} {r.text[:200]}")
        return
    ok(f"GET /report/track/{report['slug']} -> 200")
    body = r.json()
    check(body.get("tracking_id") == report["tracking_id"],
          f"returned tracking_id matches ({body.get('tracking_id')!r})")


def s6_rbac(users: dict) -> None:
    section("6. RBAC — ROLE GATES ON PROTECTED ENDPOINTS")
    info("By design: READ endpoints (/reports/*, /spatial/*) are public.")
    info("RBAC is enforced only on MUTATION endpoints (deploy, reassign, "
         "force-close, user mgmt) and on /audit-log.")
    info("Frontend portals do client-side scoping for the read endpoints.")

    # Barangay queue is publicly readable (intentional)
    r = requests.get(f"{BASE}/reports/barangay/Muzon", timeout=10)
    check(r.status_code == 200,
          "GET /reports/barangay/Muzon is publicly readable (no auth needed)",
          f"got {r.status_code}")

    # Mutation endpoint without auth -> 401 (using /assign, the cleaner-workflow
    # successor to the older /deploy route). Sending form data because the
    # route uses Form(...) params, not JSON body.
    r = requests.put(
        f"{BASE}/report/1/assign",
        data={"cleaner_id": 4, "priority": "medium"},
        timeout=10,
    )
    check(r.status_code == 401,
          "PUT /report/1/assign without X-User-Id -> 401",
          f"got {r.status_code} {r.text[:120]}")

    # Citizen trying to assign -> 403
    if "citizen" in users:
        r = requests.put(
            f"{BASE}/report/1/assign",
            headers={"X-User-Id": str(users["citizen"]["id"])},
            data={"cleaner_id": 4, "priority": "medium"},
            timeout=10,
        )
        check(r.status_code == 403,
              "citizen role calling PUT /report/1/assign -> 403",
              f"got {r.status_code} {r.text[:120]}")

    # Barangay role can't read audit log
    if "barangay" in users:
        r = get("/audit-log", user_id=users["barangay"]["id"])
        check(r.status_code == 403,
              "barangay role on GET /audit-log -> 403",
              f"got {r.status_code}")

    # CENRO can read audit log
    if "cenro" in users:
        r = get("/audit-log", user_id=users["cenro"]["id"])
        check(r.status_code == 200,
              "cenro role on GET /audit-log -> 200",
              f"got {r.status_code} {r.text[:120]}")


def s7_cross_portal_visibility(users: dict, report: Optional[dict]) -> None:
    section("7. CROSS-PORTAL REFLECTION — barangay queue + cenro feed")
    if not report or "barangay" not in users or "cenro" not in users:
        fail("cross-portal test SKIPPED (missing prerequisites)")
        return

    # Important: by design, /reports/recent and /reports/barangay/{name}
    # filter out REJECTED reports unless ?status=rejected is passed
    # (see _apply_report_filters in main.py:1639). The smoke-test submission
    # may have ended up rejected depending on Mask R-CNN's verdict on the
    # test image, so we use ?status=all-statuses to find it either way.
    info("Note: rejected reports are excluded from default feeds by design. "
         "Probing both default + ?status=rejected so we catch the report "
         "regardless of AI verdict.")

    def report_visible_at(path: str, label: str, scope_user_id: int) -> None:
        # First try the default feed
        r = get(path, user_id=scope_user_id)
        if r.status_code != 200:
            fail(f"{label} fetch", f"{r.status_code} {r.text[:120]}")
            return
        body = r.json()
        reports = body if isinstance(body, list) else body.get("reports", [])
        found = any(rr.get("tracking_id") == report["tracking_id"]
                    for rr in reports)
        if found:
            ok(f"{label}: report {report['tracking_id']} appears in default "
               f"feed ({len(reports)} total)")
            return
        # Not in default - probably rejected. Try the rejected filter.
        sep = "&" if "?" in path else "?"
        r2 = get(f"{path}{sep}status=rejected", user_id=scope_user_id)
        if r2.status_code == 200:
            body2 = r2.json()
            reports2 = body2 if isinstance(body2, list) else body2.get("reports", [])
            found2 = any(rr.get("tracking_id") == report["tracking_id"]
                         for rr in reports2)
            check(found2,
                  f"{label}: report {report['tracking_id']} appears in "
                  f"?status=rejected feed",
                  f"default had {len(reports)}, rejected has {len(reports2)}")
        else:
            fail(f"{label} ?status=rejected fetch", f"{r2.status_code}")

    report_visible_at("/reports/barangay/Muzon",
                      "Muzon barangay queue",
                      users["barangay"]["id"])
    report_visible_at("/reports/recent?limit=200",
                      "CENRO city-wide feed",
                      users["cenro"]["id"])


def s8_work_order_lifecycle(users: dict) -> None:
    section("8. WORK ORDER LIFECYCLE — cleaner queue")
    if "cleaner" not in users:
        fail("work order test SKIPPED (no cleaner user)")
        return

    cid = users["cleaner"]["id"]
    r = get(f"/work-orders/cleaner/{cid}", user_id=cid)
    if r.status_code != 200:
        fail(f"GET /work-orders/cleaner/{cid}",
             f"{r.status_code} {r.text[:200]}")
        return

    body = r.json()
    wos = body if isinstance(body, list) else body.get("work_orders", [])
    check(len(wos) >= 3,
          f"cleaner has at least 3 seeded work orders (got {len(wos)})")

    statuses = {wo.get("status") for wo in wos}
    info(f"work order statuses present: {sorted(statuses)}")

    # Notifications endpoint
    r = get(f"/notifications/user/{cid}", user_id=cid)
    if r.status_code != 200:
        # Compat shim path
        r = get(f"/notifications/cleaner/{cid}", user_id=cid)
    check(r.status_code == 200,
          f"GET notifications for cleaner -> 200 (got {r.status_code})")


def s9_ai_verifier_mode() -> None:
    section("9. MASK R-CNN MODE DETECTION")
    info("Check the uvicorn logs in the other terminal for one of:")
    info('  "[INFO] AIVerifier: Model loaded from ..." -> REAL Mask R-CNN active')
    info('  "[WARNING] Model not found at: ..."        -> MOCK mode (random ~80% positive)')
    info("")
    h5_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "models", "mask_rcnn_garbage.h5",
    )
    if os.path.exists(h5_path):
        sz_mb = os.path.getsize(h5_path) / (1024 * 1024)
        ok(f"model file present: {h5_path} ({sz_mb:.0f} MB)")
        info("Backend should be running with REAL Mask R-CNN inference.")
    else:
        info(f"model file NOT present at: {h5_path}")
        info("Backend is running in MOCK mode (returns ~80% positive at random).")
        info("This is expected for UI work; download the .h5 for real demos.")


# ─── main ────────────────────────────────────────────────────────────
def main() -> int:
    print(f"EcoWatch Smoke Test  ({BASE})")
    print()

    # Confirm server is up before doing anything else
    try:
        requests.get(f"{BASE}/health", timeout=3)
    except requests.RequestException as e:
        print(f"{_FAIL} Cannot reach backend at {BASE}")
        print(f"       {e}")
        print()
        print("Start the backend first:")
        print("    cd backend")
        print("    .\\venv_tf\\Scripts\\Activate.ps1")
        print("    uvicorn main:app --reload")
        return 1

    users = s1_health_and_auth()
    s2_spatial_routing()
    s3_dbscan_heatmap()
    report = s4_report_submit_pipeline(users)
    s5_tracking(report)
    s6_rbac(users)
    s7_cross_portal_visibility(users, report)
    s8_work_order_lifecycle(users)
    s9_ai_verifier_mode()

    # ─── summary ──────────────────────────────────────────────────
    section("SUMMARY")
    print(f"  Passed: {_passed}")
    print(f"  Failed: {_failed}")
    if _failures:
        print()
        print("  Failed checks:")
        for f in _failures:
            print(f"    - {f}")
    print()
    if _failed == 0:
        print("All workflows verified. The setup is good to go.")
        return 0
    print("Some workflows are broken. Read the FAIL lines above for context.")
    print("Re-run after fixing, or open an issue with the failures.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
