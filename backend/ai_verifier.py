import asyncio
import logging
import os
import sys
import numpy as np
import cv2
import io
from math import radians, cos, sin, asin, sqrt
from datetime import datetime, timezone

# Set legacy Keras before any TF import
os.environ["TF_USE_LEGACY_KERAS"] = "1"

# Add backend directory to path so mrcnn can be found
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Model weights path
MODEL_PATH = os.path.join(BACKEND_DIR, "models", "mask_rcnn_garbage.h5")

# Trust score constants
_KNOWN_EDITOR_KEYWORDS = [
    "photoshop", "lightroom", "gimp", "picsart", "snapseed",
    "facetune", "meitu", "midjourney", "stable diffusion",
    "dall-e", "canva", "pixlr"
]
_GPS_LOW_TRUST_METERS = 500

logger = logging.getLogger(__name__)


class AIVerifier:
    """
    Mask R-CNN-based garbage detection verifier.
    Loads the trained model on startup and runs inference on uploaded images
    to detect illegal waste dumping.
    """
    def __init__(self):
        self.model = None
        self.graph = None
        self.session = None
        self.is_loaded = False

        if os.path.exists(MODEL_PATH):
            try:
                self._load_model()
            except Exception:
                logger.exception("Failed to load Mask R-CNN model. Falling back to mock mode.")
        else:
            logger.warning("Model not found at: %s", MODEL_PATH)
            logger.warning("Running in mock mode. Download mask_rcnn_garbage.h5 from Google Drive.")

    def _load_model(self):
        """Load the Mask R-CNN model with trained weights."""
        import tensorflow as tf
        import mrcnn.config
        import mrcnn.model

        class InferenceConfig(mrcnn.config.Config):
            NAME = "garbage"
            NUM_CLASSES = 1 + 1  # background + garbage
            GPU_COUNT = 1
            IMAGES_PER_GPU = 1
            DETECTION_MIN_CONFIDENCE = 0.5
            IMAGE_MIN_DIM = 512
            IMAGE_MAX_DIM = 512

        self.config = InferenceConfig()
        self.model = mrcnn.model.MaskRCNN(
            mode="inference",
            config=self.config,
            model_dir=os.path.join(BACKEND_DIR, "logs")
        )
        self.model.load_weights(MODEL_PATH, by_name=True)
        # tf_keras (TF1-style) binds both the default graph AND the Keras session
        # to the thread the model was built on. Capture both so inference can
        # re-enter the right context from a worker thread (asyncio.to_thread).
        # Without the session, detect() runs against an uninitialized graph and
        # returns padded-buffer garbage (35 boxes at conf 1.0, all-zero masks).
        self.graph = tf.compat.v1.get_default_graph()
        try:
            import tf_keras
            self.session = tf_keras.backend.get_session()
        except Exception:
            self.session = tf.compat.v1.keras.backend.get_session()
        self.is_loaded = True
        logger.info("Mask R-CNN model loaded successfully!")

    def verify_image(self, image_bytes: bytes) -> dict:
        """
        Run Mask R-CNN detection on an uploaded image.
        
        Returns:
            dict with keys: verified, confidence, instances_found, message,
            and optionally masks/boxes for visualization.
        """
        # If model isn't loaded, fall back to mock
        if not self.is_loaded or self.model is None:
            return self._mock_verify()

        try:
            # Decode image bytes to numpy array
            nparr = np.frombuffer(image_bytes, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if image is None:
                return {
                    "verified": False,
                    "confidence": 0.0,
                    "instances_found": 0,
                    "message": "Could not decode the uploaded image."
                }

            # Convert BGR to RGB (Mask R-CNN expects RGB)
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

            # Run detection inside the model's captured graph AND session so
            # worker-thread calls (asyncio.to_thread) don't hit "Tensor is not an
            # element of this graph" and don't return padded-buffer garbage.
            if self.graph is not None and self.session is not None:
                with self.graph.as_default(), self.session.as_default():
                    results = self.model.detect([image_rgb], verbose=0)
            else:
                results = self.model.detect([image_rgb], verbose=0)
            r = results[0]

            num_detections = len(r['rois'])
            scores = r['scores'].tolist() if num_detections > 0 else []
            avg_confidence = float(np.mean(scores)) if scores else 0.0
            max_confidence = float(np.max(scores)) if scores else 0.0

            is_waste = num_detections > 0 and max_confidence >= 0.5

            # Store results for mask generation
            self._last_results = r
            self._last_image = image_rgb

            return {
                "verified": is_waste,
                "confidence": round(max_confidence, 2),
                "avg_confidence": round(avg_confidence, 2),
                "instances_found": num_detections,
                "message": f"Detected {num_detections} garbage region(s)." if is_waste
                           else "No significant waste detected in the image.",
                "scores": [round(s, 3) for s in scores],
                "boxes": r['rois'].tolist() if num_detections > 0 else []
            }

        except Exception as e:
            logger.exception("Detection error")
            return {
                "verified": False,
                "confidence": 0.0,
                "instances_found": 0,
                "message": f"Detection error: {str(e)}"
            }

    def generate_mask_image(self) -> bytes:
        """
        Generates an image with the AI masks and bounding boxes overlaid.
        Returns the image as jpeg bytes.
        """
        if not hasattr(self, '_last_results') or not hasattr(self, '_last_image'):
            return None

        r = self._last_results
        image = self._last_image.copy()

        # Generate colors for masks
        import colorsys
        import random
        
        N = r['rois'].shape[0]
        colors = []
        for i in range(N):
            h, s, l = random.random(), 0.5 + random.random() / 2.0, 0.4 + random.random() / 5.0
            colors.append(tuple([int(255 * x) for x in colorsys.hls_to_rgb(h, l, s)]))

        # Apply masks first (using uint32 to avoid overflow during blend)
        masked_image = image.astype(np.uint32).copy()
        for i in range(N):
            color = colors[i]
            mask = r['masks'][:, :, i]
            for c in range(3):
                masked_image[:, :, c] = np.where(mask == 1,
                                                 masked_image[:, :, c] * 0.5 + color[c] * 0.5,
                                                 masked_image[:, :, c])

        # Cast back to uint8 before drawing OpenCV primitives
        masked_image = masked_image.astype(np.uint8)
        
        # Apply bounding boxes
        for i in range(N):
            color = colors[i]
            y1, x1, y2, x2 = r['rois'][i]
            cv2.rectangle(masked_image, (x1, y1), (x2, y2), color, 2)
        # Convert RGB back to BGR for cv2.imencode
        masked_image_bgr = cv2.cvtColor(masked_image, cv2.COLOR_RGB2BGR)
        _, buffer = cv2.imencode('.jpg', masked_image_bgr)
        
        # Clear the cached results
        delattr(self, '_last_results')
        delattr(self, '_last_image')
        
        return buffer.tobytes()

    def verify_images(self, images_bytes: list) -> list:
        """
        Run Mask R-CNN on multiple images for a single report.

        v1: loops verify_image() — safe on CPU, no extra memory pressure.
        v2 (future): true batch forward pass with IMAGES_PER_GPU > 1.
        Also returns the mask bytes per image (since generate_mask_image
        is stateful on the verifier and would otherwise be clobbered).
        """
        out = []
        for img_bytes in images_bytes:
            result = self.verify_image(img_bytes)
            mask_bytes = None
            if result.get("verified") and self.is_loaded:
                mask_bytes = self.generate_mask_image()
            result["mask_bytes"] = mask_bytes
            out.append(result)
        return out

    def _mock_verify(self):
        """Fallback mock verification when model is not available."""
        import random
        import time

        time.sleep(0.5)
        is_waste = random.random() > 0.2
        confidence = round(random.uniform(0.70, 0.99), 2) if is_waste else round(random.uniform(0.10, 0.45), 2)

        return {
            "verified": is_waste,
            "confidence": confidence,
            "instances_found": random.randint(1, 5) if is_waste else 0,
            "message": ("Illegal waste detected (mock mode)." if is_waste
                        else "No significant waste detected (mock mode).")
        }


# Singleton instance
verifier = AIVerifier()

# Global inference lock: Mask R-CNN holds graph state across detect() calls,
# so we must serialize calls even though FastAPI is async. Inference itself
# runs in a thread executor so it does not block the event loop.
INFERENCE_LOCK = asyncio.Lock()


async def verify_images_async(images_bytes: list) -> list:
    """
    Async-safe entry point used by background tasks.
    Acquires the global inference lock, then runs the (CPU/GPU-bound)
    Mask R-CNN call in a worker thread so other endpoints stay responsive.
    """
    async with INFERENCE_LOCK:
        return await asyncio.to_thread(verifier.verify_images, images_bytes)


def compute_trust_score(image_bytes: bytes, submitted_lat: float, submitted_lon: float) -> dict:
    """
    Compute a trust score for an uploaded image by analyzing EXIF metadata.

    Returns a dict with:
    - score: "high" | "medium" | "low"
    - signals: dict of extracted EXIF signals
    - failing_signals: list of reasons for lower trust

    Never raises; wraps all exceptions and returns score="medium" on failure.
    """

    def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance in meters between two lat/lon coordinates."""
        lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        a = sin(dlat / 2)**2 + cos(lat1) * cos(lat2) * sin(dlon / 2)**2
        c = 2 * asin(sqrt(a))
        r = 6371000  # Radius of Earth in meters
        return c * r

    try:
        from PIL import Image
        import io as pil_io

        # Load image with PIL
        img = Image.open(pil_io.BytesIO(image_bytes))

        # Initialize signals dict
        signals = {
            "has_camera_make": False,
            "has_camera_model": False,
            "datetime_original": None,
            "datetime_age_hours": None,
            "gps_lat": None,
            "gps_lon": None,
            "gps_distance_m": None,
            "software_tag": None,
        }

        failing_signals = []

        # Try to read EXIF
        try:
            exif = img.getexif()

            # Camera Make (0x010F)
            if 0x010F in exif:
                signals["has_camera_make"] = True

            # Camera Model (0x0110)
            if 0x0110 in exif:
                signals["has_camera_model"] = True

            # Software tag (0x0131)
            if 0x0131 in exif:
                software = str(exif[0x0131]).lower()
                signals["software_tag"] = exif[0x0131]

                # Check against known editors/AI tools
                if any(editor in software for editor in _KNOWN_EDITOR_KEYWORDS):
                    failing_signals.append(f"Software: {exif[0x0131]}")

            # DateTimeOriginal (0x9003) in Exif IFD (0x8769)
            try:
                exif_ifd = exif.get_ifd(0x8769)
                if 0x9003 in exif_ifd:
                    dt_str = str(exif_ifd[0x9003])
                    signals["datetime_original"] = dt_str

                    # Parse to compute age
                    # Format is typically "YYYY:MM:DD HH:MM:SS"
                    try:
                        dt_original = datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S")
                        dt_original = dt_original.replace(tzinfo=timezone.utc)
                        now = datetime.now(timezone.utc)
                        age_hours = (now - dt_original).total_seconds() / 3600
                        signals["datetime_age_hours"] = age_hours

                        # NOTE: DateTimeOriginal is local time with no timezone offset,
                        # so age-based LOW trust would false-positive for Philippine evening
                        # photos (UTC+8). Age is kept as a debug signal only.
                    except ValueError:
                        pass  # Could not parse date
            except Exception:
                pass  # No Exif IFD or DateTimeOriginal

            # GPSInfo IFD (0x8825)
            try:
                gps_ifd = exif.get_ifd(0x8825)
                if gps_ifd:
                    # GPS Latitude (0x0002) and Longitude (0x0004)
                    # These are tuples of (degrees, minutes, seconds)
                    if 0x0002 in gps_ifd:
                        lat_tuple = gps_ifd[0x0002]
                        # Convert DMS to decimal
                        gps_lat = lat_tuple[0] + lat_tuple[1] / 60 + lat_tuple[2] / 3600
                        # Check latitude ref (0x0001) for N/S
                        if 0x0001 in gps_ifd and str(gps_ifd[0x0001]).upper() == "S":
                            gps_lat = -gps_lat
                        signals["gps_lat"] = gps_lat

                    if 0x0004 in gps_ifd:
                        lon_tuple = gps_ifd[0x0004]
                        # Convert DMS to decimal
                        gps_lon = lon_tuple[0] + lon_tuple[1] / 60 + lon_tuple[2] / 3600
                        # Check longitude ref (0x0003) for E/W
                        if 0x0003 in gps_ifd and str(gps_ifd[0x0003]).upper() == "W":
                            gps_lon = -gps_lon
                        signals["gps_lon"] = gps_lon

                    # Compute distance if both EXIF GPS and submitted coords present
                    if (signals["gps_lat"] is not None and
                        signals["gps_lon"] is not None and
                        submitted_lat is not None and
                        submitted_lon is not None):
                        distance = haversine_distance(
                            signals["gps_lat"], signals["gps_lon"],
                            submitted_lat, submitted_lon
                        )
                        signals["gps_distance_m"] = distance

                        if distance > _GPS_LOW_TRUST_METERS:
                            failing_signals.append(f"GPS mismatch >{_GPS_LOW_TRUST_METERS}m ({distance:.0f}m)")
            except Exception:
                pass  # No GPS IFD

        except Exception:
            failing_signals.append("EXIF unreadable")

        # Compute trust score
        score = "high"

        # LOW if any failing signals detected
        if failing_signals:
            score = "low"
        # MEDIUM if not LOW and any of these:
        elif (not (signals["has_camera_make"] or signals["has_camera_model"]) or
              signals["datetime_original"] is None or
              signals["gps_lat"] is None):
            score = "medium"

        return {
            "score": score,
            "signals": signals,
            "failing_signals": failing_signals,
        }

    except Exception:
        logger.exception("compute_trust_score failed")
        return {
            "score": "medium",
            "signals": {},
            "failing_signals": ["EXIF unreadable"],
        }
