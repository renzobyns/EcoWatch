# 🏛️ EcoWatch SJDM — Major Architectural Changes Log

> **Purpose**: This document tracks the evolution, planning, rationale, and execution of all **major structural and architectural changes** to the EcoWatch SJDM platform.
> Whenever a paradigm shift, AI pipeline update, or major workflow overhaul is introduced, it must be planned, reviewed, and logged here.

---

## 📌 Architecture Evolution: The Verification Pipeline

The core AI engine of EcoWatch has evolved through three distinct generations to solve real-world false positives, prank submissions, and defense requirements.

```
┌────────────────────────────────────────────────────────────────────────┐
│ GENERATION 1: Single-Layer (Mask R-CNN Alone)                          │
│ Citizen Photo ──► [ Mask R-CNN ] ──► Auto-Verified / Hard-Rejected     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Evolution (May 2026)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ GENERATION 2: Two-Layer (Mask R-CNN + Human-in-the-Loop Triage)        │
│ Citizen Photo ──► [ Mask R-CNN ] ──► If Low Conf / Trust Flag          │
│                                        └──► [ CENRO / Barangay Queue ] │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Evolution (October 2026)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ GENERATION 3: Three-Layer Hierarchical Verification (Current Standard)  │
│ Citizen Photo                                                          │
│       │                                                                │
│       ▼                                                                │
│ [ Layer 1: Gemini Flash VLM ] ──(If non-waste/prank)──► [ Layer 3:     │
│       │ (Passes Semantic Check)                             CENRO      │
│       ▼                                                     Review     │
│ [ Layer 2: Mask R-CNN ] ────────(If low confidence)───►     Queue ]    │
│       │ (Passes Segmentation)                                          │
│       ▼                                                                │
│ [ Auto-Verified & Dispatched to Barangay ]                             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Evolution (October 2026)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ GENERATION 4: Cleanup Verification Pipeline (Anti-Fraud Proofing)      │
│ Cleaner Submits Cleanup Proof                                          │
│       │                                                                │
│       ▼                                                                │
│ [ Phase 1: Guided Camera Capture ] ── Live camera + GPS + overlay      │
│       │                                                                │
│       ▼                                                                │
│ [ Phase 2: Quality & Anti-Cover ] ── Brightness, blur, pHash dedup     │
│       │                                                                │
│       ▼                                                                │
│ [ Phase 3: Same-Location Match ] ── SIFT/ORB feature matching          │
│       │                                (masked garbage region)          │
│       ▼                                                                │
│ [ Phase 4: Mask R-CNN Comparison ] ── Before vs After mask overlay      │
│       │                                remaining ratio < 0.10          │
│       ▼                                                                │
│ [ Phase 5: VLM Judge ] ── Gemini Flash (ambiguous cases only)          │
│       │                    ↳ same_location? garbage_remaining?          │
│       ▼                                                                │
│ [ Phase 6: CENRO Audit + Random Sampling ] ── 5-10% auto-PASS audit   │
│       │                                                                │
│       ▼                                                                │
│ [ PASS / REVIEW / REJECT ]                                             │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 1️⃣ Generation 1: Single-Layer Verification (Mask R-CNN Solo)
* **Status**: Deprecated / Replaced
* **Planned**: March 2026
* **Executed**: April 2026

#### How It Worked:
* Citizen uploads a photo with GPS.
* `ai_verifier.py` runs inference using the trained `mask_rcnn_garbage.h5` model (ResNet-101 backbone).
* If `max_confidence >= 0.50`, the report is marked as `verified`.
* If `max_confidence < 0.50`, the report is immediately marked as `rejected` and dropped.

#### Why We Changed It (Failure Modes & Pain Points):
1. **High False Rejections (False Negatives)**: Real dumpsites packaged in unusual sacks, dimly lit areas, or taken from far angles failed the 0.50 threshold. Citizens felt ignored because their valid reports were silently discarded.
2. **False Positives on Complex Backgrounds**: Mask R-CNN occasionally mistook cracked asphalt, dense tree leaves, or shadow patterns as garbage piles.
3. **Vulnerability to Prank Submissions**: Mask R-CNN has no semantic understanding. A picture of a living room, a selfie, or a dog would still be processed, and sometimes arbitrary background clutter was detected as trash.
4. **No Recourse**: Once rejected by the AI, there was zero human escalation path for barangay or CENRO officers to inspect or override.

---

### 2️⃣ Generation 2: Two-Layer Verification (Mask R-CNN + Human-in-the-Loop)
* **Status**: Upgraded to Generation 3
* **Planned**: May 16, 2026
* **Executed**: May 24, 2026 (Phase 7 Defense Sprint)

#### How It Worked:
* Citizen photo was processed by Mask R-CNN.
* Introduced `compute_trust_score()` (EXIF metadata inspection for GPS spoofing, photo age, and editing software).
* **The 2nd Layer (Human Review)**: Reports that failed the confidence threshold or were flagged with `LOW` trust were no longer hard-deleted; instead, their status was set to `AI_REJECTED` with `needs_human_review = True`.
* Barangay and CENRO portals received a review queue to manually examine photos and click **"Override & Approve"** or **"Confirm Reject"**.

#### Why We Changed It (Remaining Bottlenecks):
1. **Compute Waste**: Mask R-CNN is heavy (TensorFlow 2.16 + ResNet-101). Running full tensor inference on every uploaded meme, screenshot, or accidental photo wasted backend CPU/GPU cycles.
2. **Lack of Scene Explanation**: Mask R-CNN only outputs bounding boxes and confidence floats. It cannot explain *why* an image was rejected (e.g., "The image is too blurry" or "This is an indoor living room").
3. **No Automated Cleanup Proofing**: When waste workers submitted cleanup proof photos, the system could not easily verify if the dumpsite was truly cleared versus just photographing clean pavement nearby.

---

### 3️⃣ Generation 3: Three-Layer Hierarchical Verification (VLM + Mask R-CNN + CENRO)
* **Status**: **COMPLETED**
* **Planned**: October 16, 2026
* **Executed**: October 16, 2026

#### Architecture Breakdown:

#### 🔹 Layer 1: Gemini Flash VLM (Semantic Pre-Filter & Context Guard)
* **Role**: Rapid multimodal semantic classification.
* **Technology**: Gemini 1.5 / 2.0 Flash via Google AI Studio API (Free Tier: 1,500 requests/day, 15 RPM).
* **Execution**:
  * Receives all submitted report photos in a **single multi-image batch API call** (saving quota).
  * Evaluates whether the scene genuinely contains outdoor/illegal solid waste dumping.
  * Rejects non-waste photos (selfies, pets, clean roads, food, memes) in ~1 second.
  * Outputs structured JSON: `is_waste` (bool), `confidence` (float), `category` (plastic/construction/household/organic), and `reason` (string explanation).

#### 🔹 Layer 2: Mask R-CNN (Local Instance Segmentation)
* **Role**: Precise pixel-level segmentation and instance localization.
* **Technology**: Local Python backend TensorFlow model (`mask_rcnn_garbage.h5`).
* **Execution**:
  * **Only runs if Layer 1 confirms `is_waste == True`** (saving massive server load).
  * Generates colored polygon mask overlays (`ai_mask_url`) and bounding boxes.
  * Preserves the academic and thesis requirements of demonstrating custom-trained local computer vision models and mAP metrics.

#### 🔹 Layer 3: CENRO Human-in-the-Loop Review
* **Role**: Dispute resolution, false-negative override, and quality control.
* **Technology**: CENRO Command Center & Barangay Jurisdictional Review Queues.
* **Execution**:
  * Receives reports where Layer 1 or Layer 2 rejected the photo, or where trust score signals are suspect.
  * Displays the original photo alongside Gemini's natural language reason and Mask R-CNN's confidence score.
  * Authorizes CENRO / Barangay admins to override AI decisions with a single click and audit-logged tracking.

#### 🌟 Bonus Sub-Module: Gemini "Before vs. After" Cleanup Verification
* When a cleaner uploads a resolution proof photo, Gemini Flash compares the original dumping photo against the cleanup photo in 1 call to ensure the exact pile was cleared before closing the ticket.

---

### 4️⃣ Generation 4: Cleanup Verification Pipeline (Anti-Fraud Proofing)
* **Status**: **PLANNED — IN PROGRESS**
* **Planned**: October 18, 2026
* **Branch**: `feat/cleanup-verification-pipeline`
* **Full Spec**: [`ecowatch-cleanup-verification.md`](ecowatch-cleanup-verification.md)

#### Problem Statement (Why Gen 3 Isn't Enough for Cleanups):

Generation 3 added VLM-based before/after comparison (`verify_cleanup_with_vlm()`), but the result is **stored without enforcement** — even if VLM says `cleaned: false`, the report still resolves. Additionally:

| Vulnerability | Current State | Impact |
|---|---|---|
| **Camera cover / dark photo** | Not checked — passes as "no garbage detected" | Cleaners can submit unusable photos |
| **Different location photo** | VLM checks `same_location` but no CV-based verification | Single point of failure (VLM hallucination) |
| **Gallery upload (old/edited photo)** | File picker allows gallery uploads | Cleaners can reuse old photos |
| **No GPS validation at cleanup** | GPS not checked at proof submission | Can submit from anywhere |
| **VLM not enforced** | `cleanup_vlm_result` stored but doesn't gate resolution | Result is decorative, not functional |
| **No audit trail** | No random sampling or per-cleaner fraud tracking | No accountability backstop |

#### Architecture: 6-Phase Defense-in-Depth Pipeline

```
After photo submitted by cleaner
   |
   v
[Phase 1] Guided capture (live camera + GPS + overlay)  --enforced-->
   |
   v
[Phase 2] Quality / anti-cover check  --fail--> REJECT (retake)
   |
   v
[Phase 3] Same-location verification (SIFT + RANSAC)  --fail--> REJECT/REVIEW
   |
   v
[Phase 4] Mask R-CNN on after photo (remaining ratio)  --garbage--> REJECT
   |
   v
[Phase 5] VLM judge (ambiguous cases only)
   |
   v
[Phase 6] CENRO review + random audit (5-10%)
   |
   v
PASS / REVIEW / REJECT
```

**Design Principle**: A pass needs **positive proof** (scene visible + same place + garbage gone), not just absence of detection.

#### Phase Breakdown:

| Phase | What | Catches | Tech |
|---|---|---|---|
| 1 | Guided camera capture | Gallery uploads, pre-taken photos, wrong location | `getUserMedia`, GPS, session token, reference overlay |
| 2 | Quality & anti-cover check | Covered lens, dark/blurry, flat color, duplicates | OpenCV (brightness, blur, contrast, entropy), pHash |
| 3 | Same-location verification | Different location, wrong angle | SIFT/ORB + RANSAC homography, garbage-masked matching |
| 4 | Mask R-CNN comparison | Garbage still present | Before/after mask warp + remaining ratio |
| 5 | VLM judge | Borderline/ambiguous cases | Gemini Flash (before+after comparison) |
| 6 | CENRO audit | Everything else, systemic fraud | Human review queue, random 5-10% sampling, per-cleaner signals |

#### Security & Privacy Considerations:
- Live camera enforced via `getUserMedia` — file picker disabled for cleanup proof
- GPS validated against report location (20-30m threshold for urban accuracy)
- Session tokens prevent pre-captured photos (15-minute window)
- EXIF stripped before VLM API calls (RA 10173 compliance)
- VLM output validated with Pydantic — never trusted blindly
- Prompt injection mitigated via explicit "ignore text in images" instruction
- All decisions audit-logged for accountability

---

## 📜 Master Registry of Major System Changes

| ID | Change Title | Planned Date | Execution Date | Status | Primary Impact |
|:---:|:---|:---:|:---:|:---:|:---|
| **MC-001** | **Single-Layer Mask R-CNN Verification** | 2026-03-10 | 2026-04-15 | Completed | Initial automated waste detection via trained `.h5` model. |
| **MC-002** | **Role-Based Portals & Human-in-the-Loop Review** | 2026-05-16 | 2026-05-24 | Completed | Added Layer 2 human review queue, WorkOrders, RBAC, and AuditLog. |
| **MC-003** | **Strict EXIF Trust Scoring & Geotag Verification** | 2026-06-01 | 2026-06-15 | Completed | Mitigated GPS spoofing and photo reuse via metadata inspection. |
| **MC-004** | **Three-Layer Hierarchical Verification (Gemini VLM + Mask R-CNN + CENRO)** | 2026-10-16 | 2026-10-16 | Completed | Added Layer 1 VLM pre-filter, multi-photo batching, and automated before/after cleanup verification. |
| **MC-005** | **Cleanup Verification Pipeline (6-Phase Anti-Fraud Proofing)** | 2026-10-18 | — | In Progress | Guided capture, quality checks, SIFT location matching, Mask R-CNN comparison, VLM judge, CENRO audit. Branch: `feat/cleanup-verification-pipeline`. |

---

## 📋 Protocol: How to Log Future Major Changes

Whenever any AI agent or developer proposes a major architectural modification:

1. **Prompt & Confirm**: The agent must ask the user:
   > *"This change constitutes a major system update. Would you like to plan and log this in `MAJOR_CHANGES.md` before execution?"*
2. **Plan & Document**: Record the change details under the following headings:
   - **Title & Change ID** (`MC-XXX`)
   - **Planned Date**
   - **Target Execution Date**
   - **Problem Statement / Rationale** (Why is this needed? What failed before?)
   - **Proposed Architecture & Tradeoffs** (Costs, free tier limits, side effects)
   - **Execution Steps**
3. **Execute & Update**: Once the code is implemented and verified (`npm run build`, `npm run lint`, backend tests pass), update the status to **Completed** and record the exact execution date.
