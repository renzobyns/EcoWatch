import logging
import os
import sys
import numpy as np
import cv2
import io

# Set legacy Keras before any TF import
os.environ["TF_USE_LEGACY_KERAS"] = "1"

# Add backend directory to path so mrcnn can be found
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Model weights path
MODEL_PATH = os.path.join(BACKEND_DIR, "models", "mask_rcnn_garbage.h5")

logger = logging.getLogger(__name__)


class AIVerifier:
    """
    Mask R-CNN-based garbage detection verifier.
    Loads the trained model on startup and runs inference on uploaded images
    to detect illegal waste dumping.
    """
    def __init__(self):
        self.model = None
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

            # Run detection
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
