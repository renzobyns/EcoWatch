# Feature Spec: Cleanup Verification Result Transparency

**Project:** EcoWatch SJDM
**Scope:** Cleaner app, Barangay view, CENRO admin dashboard, backend verification pipeline

---

## 1. Problem

After a cleaner captures the "after" photo, the 3-layer verification (including the VLM) runs, but the UI only shows **Rejected** or **Successful**.

Nobody can tell:

- Which layer made the decision (Mask R-CNN or VLM)
- Why the cleanup was rejected
- What the VLM saw (its description)
- How confident Mask R-CNN was

This hurts the cleaner (no idea what to fix), the Barangay (can't trust or review the result), and CENRO (can't audit or override intelligently).

## 2. Goal

After every cleanup capture, show a **Verification Result** that exposes, per layer:

- Status (passed / failed / skipped)
- Who decided the final verdict
- The VLM's plain-language description
- The Mask R-CNN AI confidence

Visible to: **Cleaner**, **assigned Barangay**, and **CENRO**.

---

## 3. Phase 1: Data Layer (do this first)

The backend must persist the result of **every layer**, not just the final verdict. If it isn't stored, it can't be shown to Barangay or CENRO.

### 3.1 Per-submission fields

| Field | Type | Notes |
|---|---|---|
| `final_status` | enum | `approved` / `rejected` / `needs_review` |
| `decided_by` | enum | `layer_1` / `layer_2_maskrcnn` / `layer_3_vlm` / `manual_override` |
| `layers` | JSON | Array of per-layer results (see 3.2) |
| `created_at` | timestamp | |
| `total_latency_ms` | int | Useful for debugging |
| `override_by` | uuid, nullable | CENRO user who overrode |
| `override_remarks` | text, nullable | |

### 3.2 Per-layer result object

```json
{
  "layer": "layer_2_maskrcnn",
  "status": "failed",
  "reason_code": "WASTE_STILL_DETECTED",
  "latency_ms": 640,
  "maskrcnn": {
    "confidence": 0.87,
    "detections_count": 3,
    "detected_classes": ["plastic_bag", "bottle"],
    "annotated_image_url": "https://..."
  }
}
```

```json
{
  "layer": "layer_3_vlm",
  "status": "failed",
  "reason_code": "SCENE_MISMATCH",
  "latency_ms": 1850,
  "vlm": {
    "model_name": "gemini-...",
    "verdict": "reject",
    "description": "The after photo shows a different street corner with no matching landmarks from the original report.",
    "reasoning": "Utility pole and building color in the original are absent in the after photo."
  }
}
```

`status` values: `passed` / `failed` / `skipped`. Use `skipped` when an earlier layer already rejected and later layers did not run.

### 3.3 Reason codes (starter list)

- `WASTE_STILL_DETECTED`
- `SCENE_MISMATCH`
- `CAMERA_COVERED_OR_BLOCKED`
- `IMAGE_TOO_DARK_OR_BLURRY`
- `LOCATION_MISMATCH`
- `LAYERS_DISAGREE` (leads to `needs_review`)

### 3.4 Force structured VLM output

Prompt the VLM to return **JSON only**, with this shape:

```json
{
  "verdict": "approve | reject | uncertain",
  "reason_code": "SCENE_MISMATCH",
  "description": "Plain-language description of what is visible and why.",
  "reasoning": "Short internal reasoning for CENRO."
}
```

Validate the response server-side. If parsing fails, set status to `needs_review` instead of silently approving or rejecting.

---

## 4. Phase 2: Cleaner-side UI (after capture)

Replace the bare Rejected/Successful screen with a **Verification Result screen**.

1. **Header badge:** Approved / Rejected / Needs Review, with color and icon.
2. **"Decided by" line:**
   - "Rejected by: AI Visual Check (VLM)"
   - "Rejected by: Waste Detection (Mask R-CNN)"
3. **Layer-by-layer breakdown** (stepper or cards):
   - Layer 1: passed / failed / skipped
   - Layer 2 (Mask R-CNN): status, **AI Confidence %**, detections count
   - Layer 3 (VLM): status, **VLM description**
4. **Before / after side-by-side**, with the Mask R-CNN annotated image (bounding boxes or masks).
5. **Actionable message** when rejected, for example: "Waste still detected on the left side. Please retake the photo." Include a **Retake** button.

### UX standards (from existing app conventions)

- Loading state while verification runs (skeleton or progress steps)
- Toast on completion
- Status badges consistent with the rest of the app

---

## 5. Phase 3: Barangay and CENRO Views

Same data, more detail, because they review and audit.

- Layer breakdown, VLM description, Mask R-CNN confidence, annotated image
- Timestamp, cleaner name, report ID, location
- **Report list badge:** e.g. "AI: Rejected (VLM)" so status is visible before opening
- **CENRO only:** manual **Approve / Reject** override with required remarks
- Barangay override: optional, decide later

### 5.1 Role-based visibility

| Info | Cleaner | Barangay | CENRO |
|---|---|---|---|
| Final status + decided by | Yes | Yes | Yes |
| VLM description | Yes | Yes | Yes |
| Mask R-CNN confidence | Yes | Yes | Yes |
| Annotated image | Yes | Yes | Yes |
| Raw VLM reasoning, latency, model name | No | No | Yes |
| Manual override | No | Optional | Yes |

Enforce this **server-side** (RLS or API filtering), not just by hiding UI elements.

---

## 6. Conflict Rules (decide now, then document)

When layers disagree, define the outcome explicitly. Suggested default:

| Mask R-CNN | VLM | Result |
|---|---|---|
| Pass | Pass | `approved` |
| Fail | any | `rejected` (decided by Mask R-CNN) |
| Pass | Fail | `needs_review` or `rejected`, pick based on strictness |
| Pass | Uncertain | `needs_review` |

Whatever you choose, write it down and keep it consistent in code and UI copy.

---

## 7. Caveats

1. **Don't expose exactly how fraud is detected.** "Camera appears blocked" is fine. Overly specific explanations become a guide for bypassing the check.
2. **VLM output is not ground truth.** It can hallucinate. That is why `needs_review` and CENRO override exist.
3. **Mask R-CNN "confidence" is a detection score, not "probability it's clean."** Low confidence does not mean the area is clean. Label it clearly, e.g. "Waste detection confidence".
4. **Handle failures gracefully.** If the VLM times out or errors, do not auto-approve. Fall back to `needs_review`.
5. **Mind VLM cost and latency.** Consider running it only when earlier layers pass, and show a progress state while it runs.

---

## 8. Test Cases

- Genuinely clean area, same angle (should approve)
- Waste still visible (Mask R-CNN should reject)
- Camera covered or pointed at the ground (should reject)
- Different angle or different location than the original (VLM should reject)
- Dark or blurry photo
- Old photo uploaded from gallery
- VLM timeout or malformed JSON (should become `needs_review`)
- Mask R-CNN and VLM disagree (should follow conflict rules)
- Role checks: cleaner cannot see CENRO-only fields via API

---

## 9. Open Questions

- [ ] What is the exact order of the 3 layers?
- [ ] Do layers run sequentially (stop at first fail) or in parallel?
- [ ] Can the cleaner retake unlimited times, or is there a cap per report?
- [ ] Can Barangay override, or is that CENRO only?
- [ ] Is the guided-capture overlay (original photo) toggleable per this feature or globally?

---

## 10. Suggested Build Order

1. Update DB schema and backend to store per-layer results
2. Force VLM structured JSON output and validate it
3. Return full result payload from the verification endpoint
4. Build the cleaner Verification Result screen
5. Add Barangay and CENRO views plus list badges
6. Add CENRO override
7. Run the test case matrix
