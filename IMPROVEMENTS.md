# EcoWatch — Improvement Roadmap

Five real-world hardening improvements identified during defense-prep review. Items below are listed in the order they were discussed, not implementation order. Implementation order is at the bottom.

---

## 1. Multiple photos per report and cleanup

**Status:** planned

**Problem:** one photo can hide or exaggerate the scene. Real reviewers (barangay, CENRO) want multiple angles before judging. Same for cleanup proof — before / during / after.

**Plan:**
- New tables `report_photos` (FK → `reports`) and `cleanup_photos` (FK → `work_orders`), each with `image_url`, `ai_confidence`, `ai_mask_url`, `uploaded_at`.
- Allow **1–5 photos per report**, **1–10 photos per cleanup**.
- AI runs on each photo. Report-level confidence = `max(per-photo confidence)` — one clear angle is enough to verify.
- Legacy `reports.image_url` / `reports.cleanup_image_url` stay temporarily, pointing to the "primary" photo for back-compat.

---

## 2. Async verification queue + per-report batching

**Status:** in progress

**Problem:** [ai_verifier.py:49](backend/ai_verifier.py#L49) sets `IMAGES_PER_GPU = 1` and [main.py:1110](backend/main.py#L1110) calls `verifier.verify_image()` synchronously inside the request handler. On CPU hosting, inference is 3–15 seconds per image. Ten concurrent submissions = the 10th user waits ~30s–2min. Multi-photo per report makes it worse.

**Plan:**
- Submit endpoint returns 202 immediately with `tracking_id` / `tracking_url`. Status saved as `pending`. **No inference inline.**
- Inference runs via FastAPI `BackgroundTasks` + an `asyncio.Lock` + `asyncio.to_thread`. One Mask R-CNN call at a time, off the event loop.
- Per-report batching: all photos of one report processed together in the same task.
- Startup hook re-queues any `pending` reports orphaned by a crash.
- Frontend submit page redirects to `/track/[id]` immediately. Tracking page polls every 3s while `status === 'pending'`.
- Notification fires when verification finishes (reuses existing [models.py:138](backend/models.py#L138) `Notification` table).

**Why not Redis / Celery:** for capstone scale on free-tier hosting, in-process `BackgroundTasks` + lock + DB status gives the same async UX with zero extra infra. The API surface stays compatible if we ever upgrade.

---

## 3. Stale / duplicate photo detection

**Status:** future improvement

**Problem:** same photo resubmitted; same garbage spot re-reported after cleanup; old photo of garbage that's already been removed.

**Plan when picked up:**
- Perceptual hash (pHash) on upload — reject or flag exact / near-duplicate images.
- Spatial proximity check vs recent `RESOLVED` reports (within 30 m, last 14 days) → flag for human review.
- EXIF `DateTimeOriginal` check — flag if >24h old or in the future.
- None of these hard-reject. They downgrade auto-verify to needs-human-review.

---

## 4. Photo trust score (EXIF / authenticity layer)

**Status:** planned (after #2)

**Problem:** advisor question — "what if the picture is edited or AI-generated?" Mask R-CNN is instance segmentation; it can't tell. We need a defensive layer.

**Goal:** keep both camera AND gallery upload (better UX), but score every photo's authenticity so suspect uploads get flagged for human review instead of being silently auto-verified.

### How camera-taken vs downloaded/edited photos differ

Signals available from an uploaded image:

| Signal | Camera-taken photo | Downloaded / screenshot / AI-generated |
|---|---|---|
| EXIF `Make` / `Model` / `LensInfo` | Present (e.g. `Samsung`, `SM-A536E`) | Usually stripped or generic |
| EXIF `DateTimeOriginal` | Present, recent | Often missing, or far in the past / future |
| EXIF `GPSLatitude` / `GPSLongitude` | Present, matches submitted GPS | Missing, or mismatches submitted GPS |
| EXIF `Software` tag | Absent, or names the phone | `"Adobe Photoshop CC"`, `"GIMP"`, `"Picsart"`, `"Midjourney"`, etc. |
| JPEG quantization tables | Match known camera signatures | Re-encoded → differ |
| Embedded thumbnail | Matches main image | Missing or mismatched |
| File-extension vs actual format | Match | Often mismatched (e.g. `.jpg` containing PNG) |

### Big caveat: the WhatsApp problem

Messaging apps (WhatsApp, Messenger, sometimes iMessage) **strip EXIF on send**. A citizen who legitimately took the photo, sent it to themselves on WhatsApp, then uploaded would have stripped EXIF. That's why this can NOT be a hard reject — only a trust signal.

### Trust score buckets

Compute a score on every uploaded photo:

| Score | Meaning | Conditions | Action |
|---|---|---|---|
| **HIGH** | Auto-verify path | Rich EXIF + camera make/model + GPS within 100 m of submitted GPS + timestamp within 24 h | Skip extra review |
| **MEDIUM** | AI runs, result auto-applies | Some EXIF missing OR no GPS in EXIF (e.g. WhatsApp-stripped) | Standard flow |
| **LOW** | AI runs, result needs human review | `Software` tag = editor / AI tool OR GPS mismatch >500 m OR `DateTimeOriginal` >24 h old / in future | Flag in barangay / CENRO portal as "low-trust upload, please review" |

### Files this touches

- `backend/ai_verifier.py` — add `compute_trust_score(image_bytes) -> {score, signals}`.
- `backend/models.py` — add `trust_score` column to `Report` (and `report_photos` when #1 lands).
- `backend/main.py` — call trust scoring during the same background task as Mask R-CNN; persist `trust_score`; if LOW, add `needs_human_review = True` flag.
- Barangay / CENRO portals — surface a "low-trust" badge with the failing signals listed.

### Defense talking point

> "No system catches every edited photo — even forensic tools struggle. We layer EXIF, GPS, software-tag, and timestamp signals to compute a trust score. High-trust photos auto-verify. Low-trust photos still get processed but are flagged for human review. That makes fraud expensive without locking out legitimate users whose photos got EXIF-stripped by messaging apps."

### Dependency

Pick a maintained EXIF library — `Pillow` (already a TensorFlow transitive dep, no new install) exposes EXIF via `Image.getexif()`. No new heavy dependency required.

---

## 5. In-app route preview for cleaners

**Status:** planned

**Problem:** [cleaner page](frontend/app/cleaner/page.tsx) currently only deep-links to Google Maps for navigation. Cleaners switch apps to see where they're going.

**Plan:**
- Show the route line from cleaner's current GPS to the report pin on the existing Leaflet map.
- Display distance + ETA in the card.
- Keep the "Open in Google Maps" button for actual turn-by-turn driving (voice nav, traffic, re-routing — we don't try to rebuild Google Maps).
- Use Leaflet Routing Machine + a free OSRM endpoint or GraphHopper free tier. No extra backend service.

---

## Implementation order

| # | Item | Why this order |
|---|---|---|
| 1 | **#2 Async queue + batching** | Foundation. Changes the request lifecycle for #1 and #4. |
| 2 | **#1 Multiple photos** | Stacks naturally on the async lifecycle — batch processes all photos of one report. |
| 3 | **#4 Trust score** | Runs in the same background task as Mask R-CNN, so #2 must land first. |
| 4 | **#5 Route preview** | Independent frontend work. Can slot in any time after #2. |
| 5 | **#3 Stale / duplicate detection** | Deferred — nice-to-have for post-defense polish. |
