"""
Integration Test Suite for Cleanup Verification Pipeline (MC-005)
File: backend/test_cleanup_pipeline.py
"""

import io
import time
import unittest
import cv2
import numpy as np
from fastapi.testclient import TestClient

from main import app, get_db, _CLEANUP_SESSIONS, _bg_verify_complete
import models


def make_jpeg_bytes(img_bgr: np.ndarray) -> bytes:
    _, buf = cv2.imencode(".jpg", img_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    return buf.tobytes()


class TestCleanupPipelineIntegration(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        db = next(get_db())
        cls.cleaner = db.query(models.User).filter(models.User.role == "cleaner").first()
        cls.barangay = db.query(models.User).filter(models.User.role == "barangay").first()
        cls.citizen = db.query(models.User).filter(models.User.role == "citizen").first()

        assert cls.cleaner, "Cleaner user required. Run seed_test_data.py first."
        cls.cleaner_headers = {"X-User-Id": str(cls.cleaner.id)}
        cls.citizen_headers = {"X-User-Id": str(cls.citizen.id)}

    def setUp(self):
        import uuid
        db = next(get_db())
        uid = uuid.uuid4().hex[:6]
        # Create a test report & work order for the cleaner
        self.report = models.Report(
            tracking_id=f"EW-{uid}",
            tracking_url=f"/track/{uid}",
            barangay="Muzon",
            lat=14.8150,
            lon=121.0250,
            status=models.ReportStatus.IN_PROGRESS,
            notes="Test dumpsite for cleanup verification",
        )
        db.add(self.report)
        db.commit()
        db.refresh(self.report)

        from datetime import datetime, timezone
        self.wo = models.WorkOrder(
            report_id=self.report.id,
            assigned_cleaner_id=self.cleaner.id,
            priority="medium",
            sla_deadline=datetime.now(timezone.utc),
            status=models.WorkOrderStatus.IN_PROGRESS,
        )
        db.add(self.wo)
        db.commit()
        db.refresh(self.wo)
        self.wo_id = self.wo.id

    def test_session_token_creation_and_auth(self):
        """Cleaners must be able to acquire a 15-minute capture session."""
        resp = self.client.post(
            f"/cleanup/session?work_order_id={self.wo_id}",
            headers=self.cleaner_headers,
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertIn("session_id", data)
        self.assertIn("expires_at", data)
        self.assertEqual(data["report_id"], self.report.id)

        # Citizens should be rejected from creating cleaner capture sessions
        resp_citizen = self.client.post(
            f"/cleanup/session?work_order_id={self.wo_id}",
            headers=self.citizen_headers,
        )
        self.assertEqual(resp_citizen.status_code, 403)

    def test_expired_session_rejected(self):
        """Expired capture sessions must be rejected."""
        # Inject an expired session
        expired_session_id = "test-expired-token-12345"
        _CLEANUP_SESSIONS[expired_session_id] = {
            "work_order_id": self.wo_id,
            "cleaner_id": self.cleaner.id,
            "created_at": time.time() - 1000,
            "expires_at": time.time() - 100,  # Expired in past
        }

        dummy_img = make_jpeg_bytes(np.full((600, 800, 3), 120, dtype=np.uint8))
        resp = self.client.put(
            f"/work-orders/{self.wo_id}/complete",
            headers=self.cleaner_headers,
            files=[("cleanup_images", ("proof.jpg", dummy_img, "image/jpeg"))],
            data={"session_id": expired_session_id},
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("expired", resp.json()["detail"].lower())

    def test_complete_work_order_with_valid_session(self):
        """Valid session allows cleanup submission, triggers async verification."""
        sess_resp = self.client.post(
            f"/cleanup/session?work_order_id={self.wo_id}",
            headers=self.cleaner_headers,
        )
        sess_id = sess_resp.json()["session_id"]

        dummy_img = make_jpeg_bytes(np.random.randint(40, 220, (720, 1280, 3), dtype=np.uint8))
        resp = self.client.put(
            f"/work-orders/{self.wo_id}/complete",
            headers=self.cleaner_headers,
            files=[("cleanup_images", ("proof.jpg", dummy_img, "image/jpeg"))],
            data={
                "session_id": sess_id,
                "cleaner_lat": 14.8151,
                "cleaner_lon": 121.0251,
                "guide_used": True,
            },
        )
        self.assertEqual(resp.status_code, 202)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertIn("Anti-fraud verification running", data["message"])


if __name__ == "__main__":
    unittest.main()
