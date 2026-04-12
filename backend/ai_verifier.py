import random
import time

class AIVerifier:
    def __init__(self):
        # In a real scenario, we would load Mask R-CNN or YOLO weights here.
        # e.g. self.model = torchvision.models.detection.maskrcnn_resnet50_fpn(pretrained=True)
        self.is_loaded = True
        print("Mask R-CNN / AI Model initialized.")

    def verify_image(self, image_bytes: bytes) -> dict:
        """
        Simulates running an instance segmentation model on an uploaded image 
        to detect illegal waste dumping.
        """
        # Simulate processing time
        time.sleep(1.5)
        
        # Simulate a 80% chance of correctly finding waste in the photo
        # for testing purposes.
        is_waste = random.random() > 0.2
        confidence = round(random.uniform(0.70, 0.99), 2) if is_waste else round(random.uniform(0.10, 0.45), 2)
        
        return {
            "verified": is_waste,
            "confidence": confidence,
            "instances_found": random.randint(1, 5) if is_waste else 0,
            "message": "Illegal waste detected." if is_waste else "No significant waste detected in the image."
        }

# Singleton instance
verifier = AIVerifier()
