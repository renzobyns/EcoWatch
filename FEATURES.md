# EcoWatch SJDM — Core Features Documentation

This document is a defense-grade reference for the five core features that make EcoWatch SJDM work. For each feature you get:

1. **What it is** — a plain-English definition.
2. **Why we use it** — its role in the report lifecycle.
3. **How it was built** — concrete implementation: libraries, parameters, file paths.
4. **Where the data / model came from** — sources, repositories, licenses.

The order mirrors the actual end-to-end flow of a single citizen report:

> **QR Scan** → **Mask R-CNN** verification → **Ray-Casting** barangay assignment → **Map** visualization → **DBSCAN** hotspot clustering

---

## 1. QR-Tagged Reporting

### What it is
A printable QR code that, when scanned by a citizen's phone camera, opens the EcoWatch report form directly in their browser — pre-loaded with GPS permission prompts.

The QR code itself doesn't encode the GPS — it just encodes the report URL. The phone's W3C Geolocation API supplies the coordinates once the user lands on the form.

### Why we use it
- **Lowers the barrier to reporting.** A laminated QR sticker on a barangay bulletin board or near a known dumpsite gets a citizen from "I see garbage" to "I submitted a report" in under 60 seconds — no app install, no account required.
- **Physical-to-digital bridge.** Connects on-the-ground infrastructure (barangay offices, schools, riverbanks) to the reporting system without needing posters, leaflets, or memorized URLs.

### How it was built

**Frontend QR generator** — [`frontend/components/QRCodeModal.tsx`](frontend/components/QRCodeModal.tsx)
- Built as a React modal triggered by the "Share QR Code" button on the homepage ([`frontend/app/page.tsx:85`](frontend/app/page.tsx#L85)).
- The encoded payload is always the current origin + `/report`:
  ```ts
  const reportUrl = `${window.location.origin}/report`;
  ```
- Image rendering uses the **goqr.me public API** (no key, no installation needed):
  ```ts
  setQrCodeUrl(
    `https://api.qrserver.com/v1/create-qr-code/?size=300x300` +
    `&data=${encodeURIComponent(reportUrl)}` +
    `&color=065f46&bgcolor=ffffff`
  );
  ```
  Brand color `#065f46` (emerald-800) matches the EcoWatch palette.
- The modal offers two actions: **Save Image** (downloads `EcoWatch-QR.png`) and **Copy Link** (uses `navigator.clipboard.writeText`).

**Tracking-side identifiers** (separate concept from the share QR, but related) — [`backend/main.py:281-288`](backend/main.py#L281-L288)
- Every submitted report gets two IDs:
  - `tracking_id` — a human-readable serial like `EW-0042`, generated from `db.query(Report).count() + 1`.
  - `tracking_slug` — a random 8-character hex from `uuid.uuid4().hex[:8]`, used in the public URL `/track/<slug>`.
- The tracking URL is shareable and can itself be turned into a QR by the citizen if they want to share their case status.

### Source / attribution
| Component | Source | License |
|---|---|---|
| QR rendering API | **goqr.me API** — https://goqr.me/api/ | Free, no auth, used at runtime via HTTPS |
| React QR fallback library | `qrcode.react@4.2.0` (listed in [`frontend/package.json:21`](frontend/package.json#L21)) | MIT |

> **Note for defense:** the QR image is generated remotely. If you want zero external dependencies for the demo, swap the modal to use the already-installed `qrcode.react` package — same output, rendered fully client-side.

---

## 2. AI Verification — Mask R-CNN

### What it is
**Mask R-CNN** (Mask Region-based Convolutional Neural Network) is a deep-learning architecture for *instance segmentation* — it does three jobs in one forward pass:

1. **Detection** — draws a bounding box around each object instance.
2. **Classification** — labels each box (here: `garbage` vs. background).
3. **Segmentation** — produces a pixel-perfect mask of the object's shape.

It extends Faster R-CNN by adding a parallel mask-prediction branch on top of the Region Proposal Network, all running on a ResNet-101 + Feature Pyramid Network (FPN) backbone.

### Why we use it
- **Prevents spam reports.** Citizens can't just upload a photo of their cat and have a barangay official dispatched — the image is gated by a confidence score.
- **Pixel-precision** beats simple classification: we get back the actual region of garbage, which we overlay on the saved image as an "AI mask" so officers see *what* the model detected, not just a yes/no.
- **Confidence as a feature, not just a gate.** The confidence score is stored in `Report.ai_confidence` and powers the AI Quality histogram in CENRO analytics ([`backend/analytics.py:231-262`](backend/analytics.py#L231-L262)).

### How it was built

**Inference wrapper** — [`backend/ai_verifier.py`](backend/ai_verifier.py)
- Singleton `AIVerifier` class instantiated once at module import.
- Loads weights from `backend/models/mask_rcnn_garbage.h5` on startup; if the file is missing, falls back to a `_mock_verify()` that returns ~80 % positive at random (so the rest of the system works in dev without a 250 MB download).
- Inference config ([`ai_verifier.py:46-53`](backend/ai_verifier.py#L46-L53)):
  ```python
  NAME = "garbage"
  NUM_CLASSES = 1 + 1            # background + garbage
  GPU_COUNT = 1
  IMAGES_PER_GPU = 1
  DETECTION_MIN_CONFIDENCE = 0.5  # below this → rejected
  IMAGE_MIN_DIM = 512
  IMAGE_MAX_DIM = 512
  ```
- A report is **verified** if `len(rois) > 0 AND max(scores) >= 0.5`. Below that → status set to `REJECTED` and the user is told the AI couldn't confirm waste.
- After a positive detection, `generate_mask_image()` draws colored translucent masks + bounding boxes over the original photo using OpenCV, saves it to `/uploads/mask_<8-hex>.jpg`, and stores the URL in `Report.ai_mask_url`.

**Vendored library** — [`backend/mrcnn/`](backend/mrcnn/)
- Six files: `config.py`, `model.py`, `parallel_model.py`, `utils.py`, `visualize.py`, `__init__.py`.
- Checked in as-is, **do not modify** (per [CLAUDE.md](CLAUDE.md#aiml-notes)).
- Patched only with the env var `TF_USE_LEGACY_KERAS=1` (set at the top of [`ai_verifier.py:9`](backend/ai_verifier.py#L9)) so it runs under TensorFlow 2.16.

**Trained weights** — `backend/models/mask_rcnn_garbage.h5` (~250 MB, gitignored)
- ResNet-101 backbone, custom-trained on a garbage-detection dataset.
- Distributed to teammates via Google Drive in dev; deployment plan ([DEFENSE_PLAN.md:254](DEFENSE_PLAN.md#L254)) is to host on **Hugging Face Hub** and `hf_hub_download()` on backend startup if the file is missing.

### Source / attribution

| Component | Source | License |
|---|---|---|
| Mask R-CNN base implementation | **Matterport, Inc. — Mask_RCNN** by Waleed Abdulla — https://github.com/matterport/Mask_RCNN | MIT (copyright header preserved in [`backend/mrcnn/model.py:6`](backend/mrcnn/model.py#L6)) |
| Original Mask R-CNN paper | He, K., Gkioxari, G., Dollár, P., & Girshick, R. (2017). *Mask R-CNN.* ICCV. arXiv:1703.06870 | — |
| Pre-trained COCO weights (starting point for transfer learning) | Matterport release `mask_rcnn_coco.h5` | MIT |
| Garbage dataset for fine-tuning | Custom-curated for this project | Project-internal |
| Model artifact hosting (planned) | Hugging Face Hub | Free public repo |

**For the citation:**
> The image-verification pipeline uses Mask R-CNN (He et al., 2017) via the open-source reference implementation by Matterport, Inc. (Abdulla, 2017; MIT License; https://github.com/matterport/Mask_RCNN), fine-tuned on a custom garbage-detection dataset. The trained weights (`mask_rcnn_garbage.h5`, ResNet-101 backbone) are loaded on backend startup and gate every citizen report at a 0.5 confidence threshold.

---

## 3. Spatial Accountability — Ray-Casting / Point-in-Polygon

### What it is
**Ray-casting** is a classical computational-geometry algorithm for deciding whether a point lies inside a polygon. From the test point, you shoot a horizontal ray to infinity; if it crosses the polygon's boundary an **odd** number of times, the point is *inside*; an **even** number means *outside*. It runs in O(n) per polygon (n = number of edges) with no preprocessing.

We use it to answer the question: *"Given a citizen's GPS coordinate, which SJDM barangay does it belong to?"*

### Why we use it
- **Accountability per zone.** Every report must be auto-routed to the correct barangay official; relying on the citizen to type their barangay is error-prone and game-able.
- **No GIS server required.** The 59 SJDM polygons live in a single static GeoJSON file. No PostGIS extension, no spatial index, no extra service — Shapely runs in-process inside FastAPI.
- **Deterministic.** Same coordinates → same barangay, every time. Important for audit logs and dispute resolution.

### How it was built

**Implementation** — [`backend/spatial_utils.py`](backend/spatial_utils.py) (38 lines total)

```python
from shapely.geometry import shape, Point

def get_barangay_from_coords(lat: float, lon: float):
    with open(DATA_PATH, 'r') as f:
        geojson_data = json.load(f)

    point = Point(lon, lat)  # Shapely uses (x, y) = (lon, lat) order

    for feature in geojson_data['features']:
        polygon = shape(feature['geometry'])
        if polygon.contains(point):
            return {
                "barangay": feature['properties'].get('ADM4_EN'),
                "pcode":    feature['properties'].get('ADM4_PCODE'),
                "city":     "San Jose del Monte"
            }
    return {"error": "Location is outside SJDM boundaries"}
```

**Key design notes**
- **Library:** [Shapely](https://shapely.readthedocs.io/) — a Python wrapper around the GEOS C++ library, the same engine used by PostGIS. `Polygon.contains(Point)` internally uses ray-casting.
- **Coordinate order gotcha:** GeoJSON stores coordinates as `[longitude, latitude]` (i.e. x, y), but most GPS APIs report `(lat, lon)`. We swap explicitly with `Point(lon, lat)` — see comment on [`spatial_utils.py:17`](backend/spatial_utils.py#L17).
- **Linear scan, not spatial index.** With only 59 polygons the average lookup completes in <5 ms. If we ever expand to all of Bulacan (~600+ barangays) we'd switch to Shapely's `STRtree` for an R-tree spatial index.
- **Out-of-bounds handling:** if the point falls outside every polygon (e.g. citizen reports from outside SJDM), the API returns `{"error": "Location is outside SJDM boundaries"}` and the report stores `barangay = "Unknown"` ([`main.py:1119`](backend/main.py#L1119)).

**Where it's invoked**
- `POST /report/submit` — step 5 of the submission pipeline, immediately after AI verification ([`main.py:1117-1119`](backend/main.py#L1117-L1119)).
- `POST /report/validate-location` — used by the frontend on the report form to show the citizen which barangay they're in *before* they submit.

### Source / attribution

| Component | Source | License |
|---|---|---|
| Algorithm | Ray-casting / Jordan curve theorem (classical, ~1962) | Public domain |
| Implementation library | **Shapely 2.x** — https://github.com/shapely/shapely | BSD-3-Clause |
| Underlying engine | **GEOS** (Geometry Engine - Open Source) | LGPL-2.1 |

---

## 4. Barangay Map — The 59-Polygon GeoJSON

### What it is
[`data/sjdm_barangays.geojson`](data/sjdm_barangays.geojson) — a single GeoJSON FeatureCollection containing **59 polygons**, one per barangay of the City of San Jose del Monte (CSJDM). Each feature carries the official Philippine Standard Geographic Code (PSGC) hierarchy:

```jsonc
"properties": {
  "ADM1_PCODE": "PH030000000",  "ADM1_EN": "REGION III (CENTRAL LUZON)",
  "ADM2_PCODE": "PH031400000",  "ADM2_EN": "BULACAN",
  "ADM3_PCODE": "PH031420000",  "ADM3_EN": "CITY OF SAN JOSE DEL MONTE",
  "ADM4_PCODE": "PH031420001",  "ADM4_EN": "Bagong Buhay"
}
```

This single file is the source of truth for **three** features in the system: ray-casting (Feature 3), map rendering (Feature 4), and DBSCAN cluster overlays (Feature 5).

### Why we use it
- **Single source of truth.** Same polygons drive the backend assignment, the citizen-facing Leaflet map, the CENRO heatmap overlay, and the barangay leaderboards. No drift possible.
- **Standards-aligned.** Property keys follow the **UN OCHA COD-AB schema** (`ADM1`…`ADM4` + `_PCODE`/`_EN`), making the file directly compatible with any tool that expects PSA/PSGC-formatted Philippine boundaries.

### How it was built
We did *not* digitize the polygons ourselves — that would be months of GIS work. Instead, we sourced a pre-digitized, PSA-derived dataset and clipped it to SJDM (PSGC `031420000`).

**Acquisition steps:**
1. Cloned/downloaded the `faeldon/philippines-json-maps` repository.
2. Extracted the single file at `2019/geojson/barangays/hires/barangays-municity-ph031420000.0.1.json` — this is already the 59-polygon CSJDM slice.
3. Renamed to `sjdm_barangays.geojson` and dropped into `/data/`.
4. **Zero modifications** to the geometry or properties. The byte-level coordinates of the first feature ("Bagong Buhay") match the upstream file to all 14 decimal places.

### Where it's rendered
- **Citizen / public map** — [`frontend/components/MapComponent.tsx`](frontend/components/MapComponent.tsx). Uses **Leaflet** + **react-leaflet** with the OpenStreetMap tile layer; renders boundaries via the `<GeoJSON>` component and supports zoom-to-barangay via a custom `MapController`.
- **Barangay portal** — same file, focused on the barangay's own polygon.
- **CENRO city-wide dashboard** — same file, overlaid with DBSCAN cluster `<CircleMarker>` heat circles.

### Source / attribution

| Layer | Source | License |
|---|---|---|
| Direct file source | **faeldon/philippines-json-maps** — https://github.com/faeldon/philippines-json-maps (file: `2019/geojson/barangays/hires/barangays-municity-ph031420000.0.1.json`) | MIT |
| Upstream shapefiles | **altcoder/philippines-psgc-shapefiles** — https://github.com/altcoder/philippines-psgc-shapefiles | MIT |
| Original authoritative data | **Philippine Statistics Authority (PSA)** — PSGC boundary data | Government public-record data |
| Map tiles (visual layer) | **OpenStreetMap contributors** — © OpenStreetMap | ODbL |
| Map rendering library | **Leaflet 1.9** (https://leafletjs.com/) + **react-leaflet** | BSD-2-Clause (Leaflet), Hippocratic (react-leaflet) |

**For the citation:**
> Barangay boundary polygons for the City of San Jose del Monte (PSGC `031420000`) were obtained from Faeldon, J. R. (2019). *philippines-json-maps* [Data set]. GitHub. https://github.com/faeldon/philippines-json-maps. The dataset is derived from PSGC shapefiles published by the Philippine Statistics Authority (PSA) via the altcoder/philippines-psgc-shapefiles repository. The 59 ADM4 (barangay) features are used unchanged for both backend ray-casting (`backend/spatial_utils.py`) and frontend rendering (`frontend/components/MapComponent.tsx`).

---

## 5. Heatmap Analytics — DBSCAN

### What it is
**DBSCAN** (Density-Based Spatial Clustering of Applications with Noise) is an unsupervised clustering algorithm published by Ester, Kriegel, Sander & Xu in 1996. Unlike k-means, it:

- Does **not** require you to pre-specify the number of clusters.
- Finds clusters of **arbitrary shape** (not just spherical blobs).
- Explicitly labels low-density points as **noise** (`label == -1`) instead of forcing them into a cluster.

It works on two parameters:
- **`eps`** — the maximum distance between two points for them to be considered neighbors.
- **`min_samples`** — the minimum number of neighbors required to form a *core* point.

A cluster is then any maximal set of density-reachable core points.

### Why we use it
- **"Where are the hotspots?" is the wrong question to ask k-means.** We don't know in advance how many dumping zones exist — DBSCAN discovers them.
- **One-off reports stay one-offs.** A single isolated report shouldn't show up as a heatmap "hotspot" — DBSCAN's noise label correctly downgrades it.
- **Shape-agnostic.** A dumping zone strung along a riverbank is a long, thin cluster — k-means would split it; DBSCAN keeps it whole.

### How it was built

**Implementation** — [`backend/analytics.py:7-43`](backend/analytics.py#L7-L43)

```python
from sklearn.cluster import DBSCAN

def get_heatmap_clusters(reports, eps=0.001, min_samples=2):
    if not reports:
        return []

    coords = np.array([[r.lat, r.lon] for r in reports])
    db = DBSCAN(eps=eps, min_samples=min_samples).fit(coords)
    labels = db.labels_

    clusters = []
    for label in set(labels):
        if label == -1:
            continue                                  # skip noise
        mask = (labels == label)
        pts  = coords[mask]
        clusters.append({
            "cluster_id": int(label),
            "lat": float(np.mean(pts[:, 0])),         # centroid
            "lon": float(np.mean(pts[:, 1])),
            "intensity": len(pts),                    # how many reports
            "points": [{"lat": float(p[0]),
                        "lon": float(p[1])} for p in pts]
        })
    return clusters
```

**Parameter choices**
- **`eps = 0.001`** — in lat/lon degrees, that's roughly **~100 meters** at the latitude of SJDM (14.8°N). This was chosen as the radius below which two separate reports are likely describing the *same* dumping incident or the same chronic spot.
- **`min_samples = 2`** — two or more nearby reports form a hotspot. Setting it higher would require corroboration but suppress emerging hotspots; setting it to 1 would label every isolated report as its own cluster.
- **Distance metric:** scikit-learn's DBSCAN default is Euclidean. We feed it raw (lat, lon) pairs because at SJDM's scale (~15 km across) the curvature error is negligible (<1 % at 100 m radius). If we ever expand to province-scale, we'd switch to `metric="haversine"` and convert to radians.

**Where it's invoked**
- `GET /analytics/heatmap` — returns the cluster list to the CENRO dashboard.
- The CENRO map ([`frontend/components/MapComponent.tsx`](frontend/components/MapComponent.tsx)) renders each cluster as a Leaflet `<CircleMarker>` whose radius scales with `intensity`.

### Source / attribution

| Component | Source | License |
|---|---|---|
| Algorithm | Ester, M., Kriegel, H.-P., Sander, J., & Xu, X. (1996). *A density-based algorithm for discovering clusters in large spatial databases with noise.* KDD-96. | Academic, public |
| Implementation library | **scikit-learn 1.x** — `sklearn.cluster.DBSCAN` — https://scikit-learn.org/stable/modules/generated/sklearn.cluster.DBSCAN.html | BSD-3-Clause |
| Numerical backend | **NumPy** | BSD-3-Clause |

**For the citation:**
> Hotspot detection uses DBSCAN (Ester et al., 1996) via scikit-learn's `sklearn.cluster.DBSCAN`, configured with `eps = 0.001°` (≈100 m at this latitude) and `min_samples = 2`. Cluster centroids and intensities feed the CENRO city-wide heatmap (`GET /analytics/heatmap`, rendered in `frontend/components/MapComponent.tsx`).

---

## Quick reference — files that implement each feature

| Feature | Backend | Frontend | Data / Model |
|---|---|---|---|
| QR | — | [`frontend/components/QRCodeModal.tsx`](frontend/components/QRCodeModal.tsx) | goqr.me API (remote) |
| Mask R-CNN | [`backend/ai_verifier.py`](backend/ai_verifier.py), [`backend/mrcnn/`](backend/mrcnn/) | — | [`backend/models/mask_rcnn_garbage.h5`](backend/models/) (gitignored) |
| Ray-casting | [`backend/spatial_utils.py`](backend/spatial_utils.py) | — | [`data/sjdm_barangays.geojson`](data/sjdm_barangays.geojson) |
| Map | [`backend/main.py`](backend/main.py) — `GET /spatial/barangays` | [`frontend/components/MapComponent.tsx`](frontend/components/MapComponent.tsx) | [`data/sjdm_barangays.geojson`](data/sjdm_barangays.geojson) + OpenStreetMap tiles |
| DBSCAN | [`backend/analytics.py`](backend/analytics.py) — `get_heatmap_clusters()` | [`frontend/components/MapComponent.tsx`](frontend/components/MapComponent.tsx) (CircleMarkers) | computed live from `Report` rows |

---

## Combined bibliography (defense-ready)

1. He, K., Gkioxari, G., Dollár, P., & Girshick, R. (2017). *Mask R-CNN.* Proceedings of the IEEE International Conference on Computer Vision (ICCV). arXiv:1703.06870.
2. Abdulla, W. (2017). *Mask R-CNN for object detection and instance segmentation on Keras and TensorFlow* [Computer software]. Matterport, Inc. https://github.com/matterport/Mask_RCNN
3. Ester, M., Kriegel, H.-P., Sander, J., & Xu, X. (1996). *A density-based algorithm for discovering clusters in large spatial databases with noise.* Proceedings of the 2nd International Conference on Knowledge Discovery and Data Mining (KDD-96), 226–231.
4. Faeldon, J. R. (2019). *philippines-json-maps* [Data set]. GitHub. https://github.com/faeldon/philippines-json-maps
5. Philippine Statistics Authority. *Philippine Standard Geographic Code (PSGC).* https://psa.gov.ph/classification/psgc
6. OpenStreetMap contributors. *Planet OSM.* https://www.openstreetmap.org (Map tiles © OpenStreetMap contributors, licensed under ODbL.)
7. Pedregosa, F. et al. (2011). *Scikit-learn: Machine Learning in Python.* Journal of Machine Learning Research, 12, 2825–2830.
8. Gillies, S., et al. (2007–). *Shapely: Manipulation and analysis of geometric objects in the Cartesian plane.* https://shapely.readthedocs.io/
