import os
import logging
from huggingface_hub import hf_hub_download

logger = logging.getLogger(__name__)

def download_mask_rcnn_model() -> str:
    """
    Downloads the trained Mask R-CNN model file from Hugging Face Hub if missing.
    Saves it to backend/models/mask_rcnn_garbage.h5.
    """
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    model_dir = os.path.join(backend_dir, "models")
    model_path = os.path.join(model_dir, "mask_rcnn_garbage.h5")
    
    # If the model file already exists locally, do nothing
    if os.path.exists(model_path) and os.path.getsize(model_path) > 100 * 1024 * 1024:
        logger.info(f"Model file already exists at {model_path}")
        return model_path

    os.makedirs(model_dir, exist_ok=True)
    
    # Get repo name from environment (defaults to 'renzobyns/ecowatch-mrcnn')
    repo_id = os.getenv("HF_MODEL_REPO", "renzobyns/ecowatch-mrcnn")
    filename = "mask_rcnn_garbage.h5"
    
    logger.info(f"Downloading model '{filename}' from Hugging Face repo '{repo_id}'...")
    try:
        # Download and copy to the target location
        downloaded_path = hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            local_dir=model_dir,
            local_dir_use_symlinks=False
        )
        logger.info(f"Successfully downloaded model to {downloaded_path}")
        return downloaded_path
    except Exception as e:
        logger.error(f"Failed to download model from Hugging Face: {str(e)}")
        # Check if the fallback _v2 file exists locally to rename
        fallback_path = os.path.join(model_dir, "mask_rcnn_garbage_v2.h5")
        if os.path.exists(fallback_path):
            import shutil
            logger.info("Found local mask_rcnn_garbage_v2.h5 fallback. Copying to target...")
            shutil.copy2(fallback_path, model_path)
            return model_path
        return None

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    download_mask_rcnn_model()
