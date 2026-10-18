"""
EcoWatch SJDM — Cleanup Verification Engine (Anti-Fraud Proofing)
Module: backend/cleanup_verifier.py

Implements the 6-phase defense-in-depth pipeline for verifying cleanup proof photos:
1. Phase 1: Guided camera metadata validation (GPS proximity, session token, guide toggle state)
2. Phase 2: Quality & anti-cover gate (brightness, dark ratio, blur variance, contrast, entropy, pHash dedup)
3. Phase 3: Classical Computer Vision same-location matching (SIFT + Lowe's ratio test + RANSAC homography)
4. Phase 4: Waste area comparison & remaining ratio (Mask R-CNN warped mask evaluation)
5. Phase 5: VLM judge integration (second opinion for borderline/ambiguous cases)
6. Phase 6: Human review escalation & audit tracking
"""

from __future__ import annotations

import io
import logging
import math
import time
from typing import Any, Dict, List, Optional, Tuple, Union

import cv2
import imagehash
import numpy as np
from PIL import Image

logger = logging.getLogger("ecowatch.cleanup_verifier")

# ── Quality Gate Thresholds ──
MIN_RESOLUTION_PX = 480         # Shortest edge must be at least this
MIN_MEAN_BRIGHTNESS = 35.0      # Below this is too dark / covered lens
MAX_DARK_PIXEL_RATIO = 0.65     # Ratio of pixels < 25 brightness
MIN_BLUR_SCORE = 45.0           # Variance of Laplacian (lower = blurrier)
MIN_CONTRAST = 18.0             # Gray std dev (lower = flat solid color / covered)
MIN_ENTROPY = 4.6               # Information entropy (lower = uniform / zero detail)
PHASH_DUPLICATE_DIST = 5        # Hamming distance <= 5 means essentially identical image


def bytes_to_bgr(image_bytes: bytes) -> Optional[np.ndarray]:
    """Decode raw image bytes into an OpenCV BGR numpy array."""
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        logger.warning("Failed to decode image bytes to BGR: %s", e)
        return None


def compute_phash_from_bytes(image_bytes: bytes) -> Optional[str]:
    """Calculate perceptual hash (pHash) string of an image."""
    try:
        with Image.open(io.BytesIO(image_bytes)) as pil_img:
            h = imagehash.phash(pil_img)
            return str(h)
    except Exception as e:
        logger.warning("Failed to compute pHash: %s", e)
        return None


def is_duplicate_phash(hash1: Optional[str], hash2: Optional[str], threshold: int = PHASH_DUPLICATE_DIST) -> bool:
    """Return True if two pHash strings have Hamming distance <= threshold."""
    if not hash1 or not hash2:
        return False
    try:
        h1 = imagehash.hex_to_hash(hash1)
        h2 = imagehash.hex_to_hash(hash2)
        diff = h1 - h2
        return diff <= threshold
    except Exception:
        return False


def quality_check(img_bgr: np.ndarray) -> Dict[str, Any]:
    """
    Phase 2: Quality & Anti-Cover Check.
    Detects covered lenses, completely black/dark shots, motion blur, and flat color surfaces.
    """
    if img_bgr is None or img_bgr.size == 0:
        return {
            "passed": False,
            "reasons": ["image_empty_or_unreadable"],
            "friendly_message": "The uploaded photo is empty or could not be decoded. Please retake the photo.",
            "metrics": {},
        }

    h, w = img_bgr.shape[:2]
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    mean_brightness = float(gray.mean())
    dark_ratio = float((gray < 25).mean())
    blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    contrast = float(gray.std())

    hist = cv2.calcHist([gray], [0], None, [256], [0, 256]).ravel()
    hist_sum = hist.sum()
    if hist_sum > 0:
        p = hist / hist_sum
        p = p[p > 0]
        entropy = float(-(p * np.log2(p)).sum())
    else:
        entropy = 0.0

    reasons: List[str] = []
    user_hints: List[str] = []

    if min(h, w) < MIN_RESOLUTION_PX:
        reasons.append("resolution_too_low")
        user_hints.append("Photo resolution is too low.")

    if dark_ratio > MAX_DARK_PIXEL_RATIO:
        reasons.append("camera_covered_or_black")
        user_hints.append("Photo is mostly black. Ensure the camera lens is not covered.")
    elif mean_brightness < MIN_MEAN_BRIGHTNESS:
        reasons.append("photo_too_dark")
        user_hints.append("Photo is too dark. Please take photo with flashlight or in daylight.")

    if blur_score < MIN_BLUR_SCORE:
        reasons.append("photo_too_blurry")
        user_hints.append("Photo is too blurry. Hold the phone steady when taking the photo.")

    if contrast < MIN_CONTRAST or entropy < MIN_ENTROPY:
        reasons.append("flat_or_obstructed")
        user_hints.append("Image lacks visual detail or camera is obstructed. Please step back to capture the area.")

    passed = len(reasons) == 0
    friendly_msg = " ".join(user_hints) if user_hints else "Photo quality is clear and acceptable."

    return {
        "passed": passed,
        "reasons": reasons,
        "friendly_message": friendly_msg,
        "metrics": {
            "resolution": f"{w}x{h}",
            "mean_brightness": round(mean_brightness, 2),
            "dark_pixel_ratio": round(dark_ratio, 3),
            "blur_score": round(blur_score, 2),
            "contrast": round(contrast, 2),
            "entropy": round(entropy, 2),
        },
    }


def match_locations(
    before_bgr: np.ndarray,
    after_bgr: np.ndarray,
    before_garbage_mask: Optional[np.ndarray] = None,
    max_dim: int = 1024,
) -> Dict[str, Any]:
    """
    Phase 3: Same-Location Verification using Classical Computer Vision (SIFT + RANSAC).
    
    1. Scales images for consistent feature detection.
    2. Masks out the garbage area in the before image so we match only static background landmarks
       (walls, roads, fences, trees, curbs, buildings).
    3. Detects SIFT keypoints and computes descriptors.
    4. Matches via Lowe's ratio test (0.75).
    5. Filters geometric outliers using RANSAC homography.
    """
    empty_result = {
        "matched": False,
        "status": "insufficient_features",
        "good_matches": 0,
        "inliers": 0,
        "inlier_ratio": 0.0,
        "H": None,
        "message": "Could not identify enough static background landmarks to verify same location.",
    }

    if before_bgr is None or after_bgr is None or before_bgr.size == 0 or after_bgr.size == 0:
        return empty_result

    # Resize helper
    def resize_max(img: np.ndarray, m: int) -> Tuple[np.ndarray, float]:
        ih, iw = img.shape[:2]
        if max(ih, iw) <= m:
            return img, 1.0
        scale = m / max(ih, iw)
        nw, nh = int(iw * scale), int(ih * scale)
        return cv2.resize(img, (nw, nh), interpolation=cv2.INTER_AREA), scale

    b_scaled, b_scale = resize_max(before_bgr, max_dim)
    a_scaled, a_scale = resize_max(after_bgr, max_dim)

    g1 = cv2.cvtColor(b_scaled, cv2.COLOR_BGR2GRAY)
    g2 = cv2.cvtColor(a_scaled, cv2.COLOR_BGR2GRAY)

    # Prepare mask for before image (ignore garbage pixels)
    mask1 = None
    if before_garbage_mask is not None:
        try:
            # Resize mask to match scaled before image
            bm_resized = cv2.resize(
                before_garbage_mask.astype(np.uint8),
                (b_scaled.shape[1], b_scaled.shape[0]),
                interpolation=cv2.INTER_NEAREST,
            )
            # 255 on non-garbage, 0 on garbage
            mask1 = (bm_resized == 0).astype(np.uint8) * 255
            # Ensure at least 30% of the image remains for background matching
            if mask1.mean() < 50:
                mask1 = None  # Revert if garbage covered almost the entire frame
        except Exception as e:
            logger.warning("Failed to prepare before garbage mask: %s", e)
            mask1 = None

    # Detect SIFT keypoints
    sift = cv2.SIFT_create(nfeatures=2500)
    k1, d1 = sift.detectAndCompute(g1, mask1)
    k2, d2 = sift.detectAndCompute(g2, None)

    # Fallback to ORB if SIFT yields few descriptors
    if d1 is None or d2 is None or len(k1) < 12 or len(k2) < 12:
        try:
            orb = cv2.ORB_create(nfeatures=2000)
            k1, d1 = orb.detectAndCompute(g1, mask1)
            k2, d2 = orb.detectAndCompute(g2, None)
            matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
        except Exception:
            return empty_result
    else:
        matcher = cv2.BFMatcher(cv2.NORM_L2, crossCheck=False)

    if d1 is None or d2 is None or len(k1) < 10 or len(k2) < 10:
        return empty_result

    try:
        raw_matches = matcher.knnMatch(d1, d2, k=2)
    except Exception as e:
        logger.warning("Feature matching failed: %s", e)
        return empty_result

    good = []
    for pair in raw_matches:
        if len(pair) == 2:
            m, n = pair
            if m.distance < 0.75 * n.distance:
                good.append(m)

    if len(good) < 8:
        return {
            "matched": False,
            "status": "different_location",
            "good_matches": len(good),
            "inliers": 0,
            "inlier_ratio": 0.0,
            "H": None,
            "message": f"Only {len(good)} landmark matches found. Photos likely taken in different locations.",
        }

    src_pts = np.float32([k1[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
    dst_pts = np.float32([k2[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)

    H, inl_mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)
    inliers = int(inl_mask.sum()) if inl_mask is not None else 0
    inlier_ratio = float(inliers / len(good)) if len(good) > 0 else 0.0

    # Decision tiers based on geometric inliers
    if inliers >= 35:
        status = "same_location"
        matched = True
        msg = f"Strong landmark match ({inliers} geometric inliers). Confirmed same location."
    elif inliers >= 15:
        status = "borderline"
        matched = True
        msg = f"Moderate landmark match ({inliers} inliers). Angle, lighting, or framing difference detected."
    else:
        status = "different_location"
        matched = False
        msg = f"Low geometric consistency ({inliers} inliers). Photos do not appear to be from the same spot."

    h_serializable = H.tolist() if H is not None else None

    return {
        "matched": matched,
        "status": status,
        "good_matches": len(good),
        "inliers": inliers,
        "inlier_ratio": round(inlier_ratio, 3),
        "H": h_serializable,
        "message": msg,
    }


def calculate_remaining_ratio(
    before_mask: Optional[np.ndarray],
    after_mask: Optional[np.ndarray],
    H: Optional[List[List[float]]] = None,
    after_shape: Optional[Tuple[int, int]] = None,
) -> Dict[str, Any]:
    """
    Phase 4: Mask R-CNN Garbage Remaining Ratio.
    Warps the before garbage mask into the after coordinate frame using Homography H.
    """
    if before_mask is None or after_mask is None or after_shape is None:
        return {
            "remaining_ratio": 0.0,
            "before_area_px": 0,
            "after_area_px": 0,
            "status": "no_masks_available",
        }

    h_target, w_target = after_shape[:2]
    try:
        if H is not None:
            H_mat = np.array(H, dtype=np.float32)
            before_in_after = cv2.warpPerspective(
                before_mask.astype(np.uint8),
                H_mat,
                (w_target, h_target),
                flags=cv2.INTER_NEAREST,
            )
        else:
            before_in_after = cv2.resize(
                before_mask.astype(np.uint8),
                (w_target, h_target),
                interpolation=cv2.INTER_NEAREST,
            )

        before_area = int((before_in_after > 0).sum())
        after_area = int((after_mask > 0).sum())

        if before_area == 0:
            ratio = 1.0 if after_area > 0 else 0.0
        else:
            ratio = float(after_area / before_area)

        return {
            "remaining_ratio": round(min(ratio, 2.0), 3),
            "before_area_px": before_area,
            "after_area_px": after_area,
            "status": "clean" if ratio < 0.10 else ("partial" if ratio <= 0.30 else "waste_remains"),
        }
    except Exception as e:
        logger.warning("Remaining ratio calculation failed: %s", e)
        return {
            "remaining_ratio": 0.0,
            "before_area_px": 0,
            "after_area_px": 0,
            "status": "calculation_error",
        }


def synthesize_cleanup_decision(
    quality_result: Dict[str, Any],
    location_result: Dict[str, Any],
    mrcnn_waste_detected: bool,
    remaining_ratio: float,
    vlm_result: Optional[Dict[str, Any]] = None,
    guide_used: bool = True,
    gps_distance_m: Optional[float] = None,
    gps_threshold_m: float = 120.0,
) -> Dict[str, Any]:
    """
    Master Decision Engine: Combines Phase 1 through Phase 5 signals into a final verdict.
    
    Possible verdicts:
    - PASS: Auto-verified, clean.
    - RETAKE: Image quality failed (lens covered, blurry, dark), cleaner must retake immediately.
    - REJECT: Proven fraud (different location, original photo resubmitted, significant waste remains).
    - REVIEW: Borderline case, low confidence, or guide turned off -> CENRO review queue.
    """
    # ── 1. Quality & Anti-Cover Gate (Hard Filter) ──
    if not quality_result.get("passed", False):
        return {
            "verdict": "RETAKE",
            "phase": "phase_2_quality",
            "reason": quality_result.get("friendly_message", "Photo quality is unacceptable. Please retake."),
            "details": quality_result,
            "requires_retake": True,
        }

    # ── 2. GPS Proximity Check (if available) ──
    if gps_distance_m is not None and gps_distance_m > gps_threshold_m:
        # If cleaner is >120m away from report location, flag
        if gps_distance_m > 300.0:
            return {
                "verdict": "REJECT",
                "phase": "phase_1_gps",
                "reason": f"Photo was taken {round(gps_distance_m)}m away from the dumpsite location. Please take photo on site.",
                "details": {"gps_distance_m": gps_distance_m, "threshold_m": gps_threshold_m},
                "requires_retake": True,
            }
        else:
            # Borderline GPS distance -> send to review unless guide and features are perfect
            if not guide_used:
                return {
                    "verdict": "REVIEW",
                    "phase": "phase_1_gps",
                    "reason": f"Photo GPS is {round(gps_distance_m)}m from site with guide overlay disabled. Routed to supervisor.",
                    "details": {"gps_distance_m": gps_distance_m},
                    "requires_retake": False,
                }

    # ── 3. Same-Location Verification (Classical CV) ──
    loc_status = location_result.get("status", "insufficient_features")
    inliers = location_result.get("inliers", 0)

    # If guide was turned OFF, apply stricter inlier requirement
    min_inliers_required = 30 if guide_used else 45

    if loc_status == "different_location" or inliers < 12:
        # Check if VLM gives a very high confidence pass as a second opinion
        vlm_cleaned = vlm_result.get("cleaned", False) if vlm_result else False
        vlm_same = vlm_result.get("same_location", False) if vlm_result else False
        vlm_conf = vlm_result.get("confidence", "low") if vlm_result else "low"

        if vlm_cleaned and vlm_same and vlm_conf == "high":
            # Scene might have completely changed (paved road or painted wall)
            return {
                "verdict": "REVIEW",
                "phase": "phase_3_location_override",
                "reason": "Feature matching found few landmarks, but AI VLM identified potential match. Queued for CENRO review.",
                "details": {"inliers": inliers, "vlm": vlm_result},
                "requires_retake": False,
            }
        else:
            return {
                "verdict": "REJECT" if guide_used else "REVIEW",
                "phase": "phase_3_location",
                "reason": location_result.get("message", "Photos do not appear to show the same location."),
                "details": location_result,
                "requires_retake": guide_used,
            }

    # ── 4. Waste Remaining Evaluation (Mask R-CNN + Remaining Ratio) ──
    if remaining_ratio > 0.35:
        return {
            "verdict": "REJECT",
            "phase": "phase_4_garbage_remaining",
            "reason": f"AI detected significant waste still remaining in the area ({int(remaining_ratio * 100)}% of original volume). Please clean thoroughly.",
            "details": {"remaining_ratio": remaining_ratio, "mrcnn_waste_detected": mrcnn_waste_detected},
            "requires_retake": True,
        }

    # ── 5. VLM Second Opinion for Borderline Cases ──
    is_borderline = (
        loc_status == "borderline"
        or (15 <= inliers < min_inliers_required)
        or (0.10 <= remaining_ratio <= 0.35)
        or (not guide_used)
    )

    if is_borderline and vlm_result:
        vlm_cleaned = bool(vlm_result.get("cleaned", False))
        vlm_conf = vlm_result.get("confidence", "low")
        vlm_remarks = vlm_result.get("remarks", "")

        if not vlm_cleaned:
            return {
                "verdict": "REJECT",
                "phase": "phase_5_vlm",
                "reason": f"AI verification noted: {vlm_remarks}",
                "details": vlm_result,
                "requires_retake": True,
            }
        elif vlm_conf == "low":
            return {
                "verdict": "REVIEW",
                "phase": "phase_5_vlm",
                "reason": f"AI verification gave low-confidence resolution: {vlm_remarks}. Routed for human sign-off.",
                "details": vlm_result,
                "requires_retake": False,
            }

    # If Mask R-CNN detected residual waste and VLM didn't confidently confirm clean
    if mrcnn_waste_detected and remaining_ratio >= 0.10:
        return {
            "verdict": "REVIEW",
            "phase": "phase_4_mrcnn",
            "reason": "Mask R-CNN detected potential scattered debris. Queued for CENRO review.",
            "details": {"remaining_ratio": remaining_ratio},
            "requires_retake": False,
        }

    # ── 6. All Checks Passed ──
    return {
        "verdict": "PASS",
        "phase": "all_passed",
        "reason": "All anti-fraud checks passed. Location verified, waste fully removed, clear photo.",
        "details": {
            "inliers": inliers,
            "remaining_ratio": remaining_ratio,
            "quality": quality_result.get("metrics"),
            "guide_used": guide_used,
        },
        "requires_retake": False,
    }
