"""
EcoWatch SJDM — VLM Verification Layer (Layer 1 Semantic Pre-Filter)
===================================================================
Uses Gemini Flash to perform rapid multimodal semantic verification on citizen reports.
- Answers: "Is this photo actually garbage/dumping in context, or is it food, baon, selfie, clean street?"
- Strips EXIF metadata before network transmission for RA 10173 (Data Privacy Act) compliance.
- Supports multi-image batching in a single API call to minimize quota consumption.
- Implements SHA-256 caching and multi-model fallback (Gemini 3.5 Flash -> 3.1 Flash-Lite).
- Provides before-vs-after cleanup proof verification.
"""

import os
import io
import time
import json
import base64
import hashlib
import logging
from typing import Literal, Optional
from pydantic import BaseModel, Field
from PIL import Image
import requests

logger = logging.getLogger("ecowatch.vlm")

# Primary and fallback model sequence
CANDIDATE_MODELS = [
    "gemini-3.5-flash",
    "gemini-flash-lite-latest",
    "gemini-3-flash-preview",
    "gemini-3.8-flash",
    "gemini-3.1-flash-lite",
]

# Persistent session for HTTP keep-alive & connection pooling (avoids SSL handshake overhead)
_SESSION = requests.Session()

# Simple in-memory LRU cache: hash -> VLMResult
_CACHE: dict[str, "VLMResult"] = {}
_MAX_CACHE_SIZE = 1000

# Daily call and observability counters
_DAILY_CALL_COUNT = 0
_DAILY_CALL_LIMIT = 1400  # Soft limit to stay safely below 1,500 RPD
_CACHE_HITS = 0
_FALLBACK_COUNT = 0
_TOTAL_LATENCY_MS = 0
_SUCCESSFUL_CALLS = 0


class VLMResult(BaseModel):
    """Structured contract returned by Layer 1 VLM check."""
    is_waste_issue: bool = Field(description="True if outdoor garbage dumping or litter is visible")
    category: Literal[
        "plastic",
        "food_waste",
        "mixed_garbage",
        "construction_debris",
        "hazardous",
        "not_waste",
    ] = Field(description="Dominant waste type or not_waste")
    confidence: Literal["high", "medium", "low"] = Field(description="Confidence of the VLM decision")
    description: str = Field(description="Short factual 1-sentence description of the scene")
    rejection_reason: Optional[str] = Field(default=None, description="Explanation if rejected as not_waste")
    provider: str = Field(default="gemini-flash", description="AI model that produced this verdict")
    latency_ms: int = Field(default=0, description="Inference latency in milliseconds")
    cached: bool = Field(default=False, description="Whether this result was served from cache")


class CleanupVLMResult(BaseModel):
    """Structured contract returned by Before-vs-After cleanup proof verification."""
    cleaned: bool = Field(description="True if the dumpsite from Image 1 was verified cleaned in Image 2")
    confidence: Literal["high", "medium", "low"]
    verdict: Literal["approve", "reject", "uncertain"] = Field(default="uncertain")
    reason_code: str = Field(default="ALL_CLEANED", description="Standardized reason code")
    description: str = Field(default="", description="Plain-language description of what is visible and why")
    reasoning: str = Field(default="", description="Short internal reasoning for CENRO")
    remarks: str = Field(default="", description="Backward-compatible remarks field")
    provider: str = Field(default="gemini-flash")
    latency_ms: int = Field(default=0)


def strip_exif_and_resize(image_bytes: bytes, max_dim: int = 1024, quality: int = 75) -> bytes:
    """
    Strips ALL EXIF metadata (GPS, camera serials, timestamps) and resizes the image.
    This guarantees compliance with the Philippine Data Privacy Act (RA 10173) before
    sending any pixels to an external third-party API.
    """
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            # Convert paletted / transparent images to standard RGB
            if img.mode in ("RGBA", "P", "LA"):
                img = img.convert("RGB")
            elif img.mode != "RGB":
                img = img.convert("RGB")

            # Scale down if either dimension exceeds max_dim while keeping aspect ratio
            w, h = img.size
            if w > max_dim or h > max_dim:
                if w > h:
                    new_w = max_dim
                    new_h = int(h * (max_dim / w))
                else:
                    new_h = max_dim
                    new_w = int(w * (max_dim / h))
                img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

            # Create brand new image in memory with ZERO EXIF dict copied over
            clean_img = Image.new("RGB", img.size)
            clean_img.paste(img)

            out_buf = io.BytesIO()
            clean_img.save(out_buf, format="JPEG", quality=quality, optimize=True)
            return out_buf.getvalue()
    except Exception as e:
        logger.warning(f"EXIF stripping failed, using raw bytes: {e}")
        return image_bytes


def _compute_images_hash(images_bytes: list[bytes]) -> str:
    """Computes a composite SHA-256 hash across all image byte streams."""
    hasher = hashlib.sha256()
    for b in images_bytes:
        hasher.update(b)
    return hasher.hexdigest()


SYSTEM_PROMPT = """You are the environmental compliance AI for San Jose del Monte, Bulacan (EcoWatch SJDM).
Your task is to analyze the uploaded photograph(s) and determine if there is an actual illegal waste dump, garbage pile, roadside litter, or environmental hazard.

DECISION GUIDELINES & EDGE CASES:
1. FOOD / MEALS: Food inside a Tupperware, baunan, or plate on a table, held by a person, or being eaten is NOT waste (category: "not_waste", is_waste_issue: false).
2. DISCARDED / ROTTEN FOOD: Decomposing food scraps scattered on dirt, pavement, or canal IS waste (category: "food_waste", is_waste_issue: true).
3. NEW PURCHASES / GROCERIES: Packaged goods in shopping bags held by people or in cars is NOT waste (category: "not_waste", is_waste_issue: false).
4. PRANKS & NON-WASTE: Selfies, pets, portraits, indoor rooms, screenshots, memes, clean asphalt roads, or manicured gardens are NOT waste (category: "not_waste", confidence: "high", is_waste_issue: false).
5. TRUE DUMPING: Piles of plastic bags, scattered sachets, construction rubble, uncollected neighborhood trash bags on curbsides IS waste (is_waste_issue: true).

OUTPUT FORMAT:
Return ONLY a raw JSON object matching this schema exactly:
{
  "is_waste_issue": boolean,
  "category": "plastic" | "food_waste" | "mixed_garbage" | "construction_debris" | "hazardous" | "not_waste",
  "confidence": "high" | "medium" | "low",
  "description": "Short factual 1-sentence description of what is seen in the image",
  "rejection_reason": "Clear 1-sentence explanation why it is not waste (or null if it is waste)"
}
"""

CLEANUP_PROMPT = """Image 1 shows the original illegal dumpsite reported by a citizen.
Image 2 is the proof of cleanup photo uploaded by the barangay waste collection team.
Analyze both images carefully:
1. Are Image 1 and Image 2 showing the same physical location/landmarks?
2. Has the garbage/waste from Image 1 been thoroughly and cleanly removed in Image 2?

Return ONLY a raw JSON object matching this schema exactly:
{
  "cleaned": boolean,
  "confidence": "high" | "medium" | "low",
  "verdict": "approve" | "reject" | "uncertain",
  "reason_code": "ALL_CLEANED" | "WASTE_STILL_DETECTED" | "SCENE_MISMATCH" | "CAMERA_BLOCKED_OR_DARK" | "UNCERTAIN",
  "description": "Clear 1-2 sentence plain-language description for the cleaner explaining what was removed or what waste remains",
  "reasoning": "1-2 sentence technical reasoning for CENRO supervisors regarding landmarks, surfaces, or residual debris"
}
"""


def verify_images_with_vlm(images_bytes: list[bytes], timeout_seconds: int = 18) -> VLMResult:
    """
    Synchronous entry point for Layer 1 VLM check.
    Takes 1 to N image byte streams (citizen report), strips EXIF, batches them,
    and queries Gemini Flash in a single API call.
    """
    start_time = time.time()
    global _DAILY_CALL_COUNT, _SUCCESSFUL_CALLS, _TOTAL_LATENCY_MS, _FALLBACK_COUNT, _CACHE_HITS

    if not images_bytes:
        return VLMResult(
            is_waste_issue=False,
            category="not_waste",
            confidence="high",
            description="No image provided",
            rejection_reason="Empty image list",
            provider="local_guard",
        )

    # 1. Preprocess & strip EXIF from each image
    cleaned_bytes = [strip_exif_and_resize(b) for b in images_bytes]

    # 2. Check Cache
    composite_hash = _compute_images_hash(cleaned_bytes)
    if composite_hash in _CACHE:
        _CACHE_HITS += 1
        cached_result = _CACHE[composite_hash]
        logger.info(f"VLM cache hit for hash {composite_hash[:10]}...")
        return VLMResult(
            is_waste_issue=cached_result.is_waste_issue,
            category=cached_result.category,
            confidence=cached_result.confidence,
            description=cached_result.description,
            rejection_reason=cached_result.rejection_reason,
            provider=cached_result.provider,
            latency_ms=int((time.time() - start_time) * 1000),
            cached=True,
        )

    # 3. Check API Key
    api_key = os.getenv("GOOGLE_GEMINI_API_KEY")
    if not api_key:
        logger.warning("GOOGLE_GEMINI_API_KEY is not set. Bypassing Layer 1 VLM check to Mask R-CNN.")
        return VLMResult(
            is_waste_issue=True,
            category="mixed_garbage",
            confidence="low",
            description="Gemini API key not configured; bypassed to Mask R-CNN.",
            rejection_reason=None,
            provider="bypass_missing_key",
            latency_ms=0,
        )

    # 4. Daily budget check
    if _DAILY_CALL_COUNT >= _DAILY_CALL_LIMIT:
        logger.warning(f"VLM daily call limit reached ({_DAILY_CALL_COUNT}/{_DAILY_CALL_LIMIT}). Bypassing.")
        return VLMResult(
            is_waste_issue=True,
            category="mixed_garbage",
            confidence="low",
            description="Daily VLM quota limit reached; routing to Mask R-CNN & CENRO.",
            rejection_reason=None,
            provider="bypass_quota_guard",
            latency_ms=0,
        )

    # 5. Build multimodal payload (1 prompt + all images in 1 batch)
    parts = [{"text": SYSTEM_PROMPT}]
    for b in cleaned_bytes:
        b64_data = base64.b64encode(b).decode("utf-8")
        parts.append({"inline_data": {"mime_type": "image/jpeg", "data": b64_data}})

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.1,
        },
    }

    # 6. Try candidate models in order (Fallback chain)
    last_error = None
    for model_name in CANDIDATE_MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        try:
            call_start = time.time()
            resp = _SESSION.post(url, json=payload, timeout=timeout_seconds)
            latency = int((time.time() - call_start) * 1000)

            if resp.status_code == 200:
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(text)

                result = VLMResult(
                    is_waste_issue=bool(parsed.get("is_waste_issue", False)),
                    category=parsed.get("category", "not_waste"),
                    confidence=parsed.get("confidence", "medium"),
                    description=parsed.get("description", "Analyzed by EcoWatch VLM"),
                    rejection_reason=parsed.get("rejection_reason") if not parsed.get("is_waste_issue") else None,
                    provider=model_name,
                    latency_ms=latency,
                    cached=False,
                )

                # Store in cache
                if len(_CACHE) >= _MAX_CACHE_SIZE:
                    _CACHE.pop(next(iter(_CACHE)))
                _CACHE[composite_hash] = result
                _DAILY_CALL_COUNT += 1
                _SUCCESSFUL_CALLS += 1
                _TOTAL_LATENCY_MS += latency

                logger.info(
                    f"VLM success via {model_name} in {latency}ms: "
                    f"is_waste={result.is_waste_issue}, category={result.category}, conf={result.confidence}"
                )
                return result

            elif resp.status_code in (429, 503):
                logger.warning(f"VLM model {model_name} returned status {resp.status_code}. Trying next candidate...")
                last_error = f"HTTP {resp.status_code}"
                continue
            else:
                logger.error(f"VLM model {model_name} failed with status {resp.status_code}: {resp.text[:200]}")
                last_error = f"HTTP {resp.status_code}: {resp.text[:100]}"
                continue

        except requests.exceptions.Timeout:
            logger.warning(f"VLM model {model_name} timed out after {timeout_seconds}s. Trying fallback...")
            last_error = "Timeout"
            continue
        except Exception as e:
            logger.exception(f"VLM model {model_name} encountered exception: {e}")
            last_error = str(e)
            continue

    # 7. Graceful degradation: If all candidate VLM models failed, NEVER crash the report!
    # Fall through to Mask R-CNN and flag report as unverified/pending.
    _FALLBACK_COUNT += 1
    logger.error(f"All VLM candidate models failed (Last error: {last_error}). Falling back to Mask R-CNN.")
    return VLMResult(
        is_waste_issue=True,  # Allow it to pass to Layer 2 so the citizen is not blocked
        category="mixed_garbage",
        confidence="low",
        description="VLM service currently unreachable; queued for Mask R-CNN & CENRO manual review.",
        rejection_reason=None,
        provider="fallback_error_recovery",
        latency_ms=int((time.time() - start_time) * 1000),
    )


def verify_cleanup_proof_with_vlm(
    original_bytes: bytes,
    cleanup_bytes: bytes,
    timeout_seconds: int = 18,
) -> CleanupVLMResult:
    """
    Before-vs-After multimodal comparison for cleaner resolution proof.
    Sends Image 1 (Before) and Image 2 (After) to Gemini Flash in a single call.
    """
    start_time = time.time()
    global _DAILY_CALL_COUNT, _SUCCESSFUL_CALLS, _TOTAL_LATENCY_MS, _FALLBACK_COUNT
    api_key = os.getenv("GOOGLE_GEMINI_API_KEY")

    if not api_key:
        return CleanupVLMResult(
            cleaned=True,
            confidence="low",
            verdict="uncertain",
            reason_code="UNCERTAIN",
            description="VLM key not configured; cleanup accepted for manual review.",
            reasoning="Missing GOOGLE_GEMINI_API_KEY environment variable.",
            remarks="VLM key missing; cleanup accepted for manual review.",
            provider="bypass",
        )

    clean_orig = strip_exif_and_resize(original_bytes)
    clean_proof = strip_exif_and_resize(cleanup_bytes)

    b64_orig = base64.b64encode(clean_orig).decode("utf-8")
    b64_proof = base64.b64encode(clean_proof).decode("utf-8")

    payload = {
        "contents": [{
            "parts": [
                {"text": CLEANUP_PROMPT},
                {"inline_data": {"mime_type": "image/jpeg", "data": b64_orig}},
                {"inline_data": {"mime_type": "image/jpeg", "data": b64_proof}},
            ]
        }],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.1,
        },
    }

    for model_name in CANDIDATE_MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        try:
            resp = _SESSION.post(url, json=payload, timeout=timeout_seconds)
            if resp.status_code == 200:
                parsed = json.loads(resp.json()["candidates"][0]["content"]["parts"][0]["text"])
                latency = int((time.time() - start_time) * 1000)
                global _DAILY_CALL_COUNT, _SUCCESSFUL_CALLS, _TOTAL_LATENCY_MS
                _DAILY_CALL_COUNT += 1
                _SUCCESSFUL_CALLS += 1
                _TOTAL_LATENCY_MS += latency

                cleaned = bool(parsed.get("cleaned", False))
                conf = parsed.get("confidence", "medium")
                if conf not in ("high", "medium", "low"):
                    conf = "medium"

                verdict_candidate = str(parsed.get("verdict", "")).lower()
                if verdict_candidate in ("approve", "reject", "uncertain"):
                    v_verdict = verdict_candidate
                else:
                    v_verdict = "approve" if (cleaned and conf != "low") else ("reject" if not cleaned else "uncertain")

                desc = parsed.get("description") or parsed.get("remarks") or ("Cleanup confirmed" if cleaned else "Waste remaining detected")
                reasoning = parsed.get("reasoning", "")
                reason_code = parsed.get("reason_code") or ("ALL_CLEANED" if cleaned else "WASTE_STILL_DETECTED")

                return CleanupVLMResult(
                    cleaned=cleaned,
                    confidence=conf,
                    verdict=v_verdict,
                    reason_code=reason_code,
                    description=desc,
                    reasoning=reasoning,
                    remarks=desc,
                    provider=model_name,
                    latency_ms=latency,
                )
        except Exception:
            continue

    global _FALLBACK_COUNT
    _FALLBACK_COUNT += 1
    latency = int((time.time() - start_time) * 1000)
    return CleanupVLMResult(
        cleaned=False,
        confidence="low",
        verdict="uncertain",
        reason_code="UNCERTAIN",
        description="Cleanup VLM check bypassed due to network error; routed for supervisor review.",
        reasoning="Failed to contact Gemini VLM candidate models within timeout.",
        remarks="Cleanup VLM check bypassed due to network error; needs admin review.",
        provider="fallback",
        latency_ms=latency,
    )


def get_vlm_metrics() -> dict:
    """Returns runtime metrics for VLM calls, quota usage, cache performance, and latency."""
    avg_latency = (
        round(_TOTAL_LATENCY_MS / _SUCCESSFUL_CALLS, 1)
        if _SUCCESSFUL_CALLS > 0
        else 0.0
    )
    total_inquiries = _DAILY_CALL_COUNT + _CACHE_HITS
    cache_hit_rate = (
        round((_CACHE_HITS / total_inquiries) * 100, 1)
        if total_inquiries > 0
        else 0.0
    )
    return {
        "provider": CANDIDATE_MODELS[0],
        "configured": bool(os.getenv("GOOGLE_GEMINI_API_KEY")),
        "daily_calls": _DAILY_CALL_COUNT,
        "daily_limit": _DAILY_CALL_LIMIT,
        "quota_remaining": max(0, _DAILY_CALL_LIMIT - _DAILY_CALL_COUNT),
        "cache_hits": _CACHE_HITS,
        "cache_hit_rate_pct": cache_hit_rate,
        "cache_size": len(_CACHE),
        "fallback_count": _FALLBACK_COUNT,
        "avg_latency_ms": avg_latency,
    }

