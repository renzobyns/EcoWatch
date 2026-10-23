"""
Unit & Integration Test Suite for Cleanup Verification Engine
File: backend/test_cleanup_verification.py
"""

import io
import math
import unittest
import numpy as np
import cv2
from PIL import Image

import cleanup_verifier as cv


def create_synthetic_scene(seed: int = 42, add_garbage: bool = True) -> np.ndarray:
    """Generate a realistic textured outdoor scene with geometric landmarks and optional trash."""
    np.random.seed(seed)
    h, w = 720, 1280
    img = np.zeros((h, w, 3), dtype=np.uint8)

    # Sky (gradient)
    for y in range(h // 2):
        blue_val = int(220 - y * 0.2)
        img[y, :] = [blue_val, 180, 120]

    # Ground / Road (gray concrete texture)
    img[h // 2:, :] = np.random.randint(90, 120, (h // 2, w, 3), dtype=np.uint8)

    # Road white dashed line
    for x in range(50, w, 150):
        cv2.rectangle(img, (x, h // 2 + 100), (x + 80, h // 2 + 115), (240, 240, 240), -1)

    # Brick wall on the left
    cv2.rectangle(img, (40, 120), (350, h // 2 + 50), (60, 70, 150), -1)
    for by in range(130, h // 2 + 40, 20):
        cv2.line(img, (40, by), (350, by), (180, 180, 180), 2)
    for bx in range(60, 340, 40):
        cv2.line(img, (bx, 120), (bx, h // 2 + 50), (180, 180, 180), 1)

    # Street lamp pole on the right
    cv2.line(img, (1000, 80), (1000, h // 2 + 150), (50, 50, 50), 8)
    cv2.circle(img, (1000, 70), 20, (230, 240, 255), -1)

    # Trees in background
    cv2.circle(img, (600, 260), 90, (40, 110, 40), -1)
    cv2.circle(img, (720, 240), 110, (30, 130, 50), -1)

    # Garbage pile in center-bottom
    if add_garbage:
        # Clustered colorful debris
        for _ in range(80):
            gx = np.random.randint(480, 680)
            gy = np.random.randint(h // 2 + 80, h // 2 + 220)
            color = (int(np.random.randint(30, 250)), int(np.random.randint(30, 250)), int(np.random.randint(30, 250)))
            radius = int(np.random.randint(6, 22))
            cv2.circle(img, (gx, gy), radius, color, -1)

    return img


class TestCleanupVerifier(unittest.TestCase):

    def test_quality_covered_lens(self):
        """A blacked-out or hand-covered camera image must fail with camera_covered_or_black."""
        black_img = np.zeros((720, 1280, 3), dtype=np.uint8)
        res = cv.quality_check(black_img)
        self.assertFalse(res["passed"])
        self.assertIn("camera_covered_or_black", res["reasons"])

    def test_quality_very_dark(self):
        """An extremely dim night photo with no details should fail."""
        dark_img = np.full((720, 1280, 3), 15, dtype=np.uint8)
        res = cv.quality_check(dark_img)
        self.assertFalse(res["passed"])

    def test_quality_blurry(self):
        """Heavily blurred images must fail with photo_too_blurry."""
        scene = create_synthetic_scene(add_garbage=False)
        blurry = cv2.GaussianBlur(scene, (85, 85), 0)
        res = cv.quality_check(blurry)
        self.assertFalse(res["passed"])
        self.assertIn("photo_too_blurry", res["reasons"])

    def test_quality_flat_color(self):
        """Solid flat wall or cloth over camera must fail with flat_or_obstructed."""
        flat_img = np.full((720, 1280, 3), 160, dtype=np.uint8)
        # Add slight uniform noise
        noise = np.random.randint(-2, 3, flat_img.shape, dtype=np.int16)
        flat_img = np.clip(flat_img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
        res = cv.quality_check(flat_img)
        self.assertFalse(res["passed"])
        self.assertIn("flat_or_obstructed", res["reasons"])

    def test_quality_low_resolution(self):
        """Images below 480px shortest edge must fail."""
        small_img = np.random.randint(50, 200, (300, 400, 3), dtype=np.uint8)
        res = cv.quality_check(small_img)
        self.assertFalse(res["passed"])
        self.assertIn("resolution_too_low", res["reasons"])

    def test_quality_clear_scene(self):
        """A normal high-texture scene must pass quality checks."""
        scene = create_synthetic_scene(add_garbage=False)
        res = cv.quality_check(scene)
        self.assertTrue(res["passed"])
        self.assertEqual(len(res["reasons"]), 0)

    def test_phash_duplicates(self):
        """Identical or slightly compressed images must be flagged as duplicates."""
        scene = create_synthetic_scene(add_garbage=True)
        _, enc1 = cv2.imencode(".jpg", scene, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
        _, enc2 = cv2.imencode(".jpg", scene, [int(cv2.IMWRITE_JPEG_QUALITY), 75])

        h1 = cv.compute_phash_from_bytes(enc1.tobytes())
        h2 = cv.compute_phash_from_bytes(enc2.tobytes())

        self.assertIsNotNone(h1)
        self.assertIsNotNone(h2)
        self.assertTrue(cv.is_duplicate_phash(h1, h2, threshold=5))

        # Different scene should NOT be duplicate
        different_scene = create_synthetic_scene(seed=999)
        _, enc_diff = cv2.imencode(".jpg", different_scene)
        h_diff = cv.compute_phash_from_bytes(enc_diff.tobytes())
        self.assertFalse(cv.is_duplicate_phash(h1, h_diff, threshold=5))

    def test_same_location_matching(self):
        """Before and After photos of the same spot (with garbage removed) must match static landmarks."""
        before = create_synthetic_scene(seed=42, add_garbage=True)
        # After photo has garbage removed and slight camera translation/scaling
        after = create_synthetic_scene(seed=42, add_garbage=False)

        # Apply slight perspective shift to simulate cleaner holding phone 1 step back
        h, w = after.shape[:2]
        M = cv2.getRotationMatrix2D((w // 2, h // 2), 0.5, 0.98)
        after_shifted = cv2.warpAffine(after, M, (w, h))

        # Garbage mask covering the trash region
        garbage_mask = np.zeros((h, w), dtype=np.uint8)
        garbage_mask[h // 2 + 70: h // 2 + 230, 470:690] = 255

        res = cv.match_locations(before, after_shifted, before_garbage_mask=garbage_mask)
        self.assertTrue(res["matched"])
        self.assertIn(res["status"], ["same_location", "borderline"])
        self.assertGreater(res["inliers"], 20)

    def test_different_location_rejection(self):
        """Photos of two completely different places must fail location matching."""
        scene_a = create_synthetic_scene(seed=42, add_garbage=True)
        # Create an entirely different scene (e.g. brick wall only, no road/lamp)
        scene_b = np.random.randint(60, 180, (720, 1280, 3), dtype=np.uint8)
        cv2.putText(scene_b, "Completely Different Storefront", (100, 300), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (255, 255, 255), 3)

        res = cv.match_locations(scene_a, scene_b)
        self.assertFalse(res["matched"])
        self.assertEqual(res["status"], "different_location")

    def test_decision_synthesis(self):
        """Verify the decision synthesis handles each branch correctly."""
        good_quality = {"passed": True, "reasons": [], "friendly_message": "OK", "metrics": {}}
        bad_quality = {"passed": False, "reasons": ["camera_covered_or_black"], "friendly_message": "Covered lens"}

        good_loc = {"matched": True, "status": "same_location", "inliers": 55, "message": "Matched"}
        bad_loc = {"matched": False, "status": "different_location", "inliers": 4, "message": "Different"}

        # 1. Bad quality -> RETAKE
        dec1 = cv.synthesize_cleanup_decision(bad_quality, good_loc, False, 0.0)
        self.assertEqual(dec1["verdict"], "RETAKE")

        # 2. Good quality, but different location -> REJECT
        dec2 = cv.synthesize_cleanup_decision(good_quality, bad_loc, False, 0.0)
        self.assertEqual(dec2["verdict"], "REJECT")

        # 3. Waste remaining > 35% -> REJECT
        dec3 = cv.synthesize_cleanup_decision(good_quality, good_loc, True, 0.45)
        self.assertEqual(dec3["verdict"], "REJECT")

        # 4. All clean, strong match -> PASS
        dec4 = cv.synthesize_cleanup_decision(good_quality, good_loc, False, 0.02)
        self.assertEqual(dec4["verdict"], "PASS")

        # 5. GPS too far (>300m) -> REJECT
        dec5 = cv.synthesize_cleanup_decision(good_quality, good_loc, False, 0.02, gps_distance_m=350.0)
        self.assertEqual(dec5["verdict"], "REJECT")

        # 6. SIFT inliers high (48) + Mask R-CNN 0%, but Gemini VLM explicitly flags wall/not cleaned -> MUST REJECT
        vlm_wall_reject = {
            "cleaned": False,
            "confidence": "high",
            "verdict": "reject",
            "reason_code": "SCENE_MISMATCH",
            "description": "The cleanup image shows a close-up of a smooth painted wall rather than the street.",
        }
        dec6 = cv.synthesize_cleanup_decision(good_quality, good_loc, False, 0.0, vlm_result=vlm_wall_reject)
        self.assertEqual(dec6["verdict"], "REJECT")
        self.assertEqual(dec6["decided_by"], "layer_4_vlm")
        self.assertEqual(dec6["reason_code"], "SCENE_MISMATCH")

        # 7. Mask R-CNN disabled (mrcnn_enabled=False) -> Layer 3 bypassed, VLM decides
        vlm_clean_pass = {
            "cleaned": True,
            "confidence": "high",
            "verdict": "approve",
            "reason_code": "ALL_CLEANED",
            "description": "Site verified clean.",
        }
        dec7 = cv.synthesize_cleanup_decision(good_quality, good_loc, False, 0.0, vlm_result=vlm_clean_pass, mrcnn_enabled=False)
        self.assertEqual(dec7["verdict"], "PASS")
        self.assertEqual(dec7["decided_by"], "layer_4_vlm")
        l3 = next(l for l in dec7["layers"] if l["layer"] == "layer_3_mrcnn")
        self.assertEqual(l3["status"], "bypassed")
        self.assertEqual(l3["reason_code"], "BYPASSED")


if __name__ == "__main__":
    unittest.main()
