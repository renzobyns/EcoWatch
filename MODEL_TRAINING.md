# EcoWatch — Mask R-CNN Training Notebook Documentation

This document explains the **Google Colab notebook** used to train the garbage-detection model that powers EcoWatch's AI verification. The notebook produces the file `mask_rcnn_garbage.h5`, which the backend loads in [backend/ai_verifier.py](backend/ai_verifier.py).

> **Note:** The notebook itself is not checked into this repo — it lives in Google Colab. This document is the canonical reference for what each cell does and why.

---

## Table of contents

1. [Big picture](#big-picture)
2. [Prerequisites](#prerequisites)
3. [Step 0 — Preparing the dataset (before Colab)](#step-0--preparing-the-dataset-before-colab)
4. [Expected folder structure in Google Drive](#expected-folder-structure-in-google-drive)
5. [Cell-by-cell walkthrough](#cell-by-cell-walkthrough)
   - [Cell 1 — Install Keras compatibility layer + verify TensorFlow](#cell-1--install-keras-compatibility-layer--verify-tensorflow)
   - [Cell 2 — Clone the Mask R-CNN library](#cell-2--clone-the-mask-r-cnn-library)
   - [Cell 3 — Install Python dependencies](#cell-3--install-python-dependencies)
   - [Cell 4 — Download pre-trained COCO weights](#cell-4--download-pre-trained-coco-weights)
   - [Cell 5 — Verify Mask R-CNN import](#cell-5--verify-mask-r-cnn-import)
   - [Cell 6 — Mount Google Drive](#cell-6--mount-google-drive)
   - [Cell 7 — Copy dataset to Colab local storage](#cell-7--copy-dataset-to-colab-local-storage)
   - [Cell 8 — Define training config and dataset class](#cell-8--define-training-config-and-dataset-class)
   - [Cell 9 — Load data, configure model, run training](#cell-9--load-data-configure-model-run-training)
   - [Cell 10 — Save the trained weights to Google Drive](#cell-10--save-the-trained-weights-to-google-drive)
   - [Cell 11 — Run inference and visualize detections](#cell-11--run-inference-and-visualize-detections)
6. [How it connects to the EcoWatch backend](#how-it-connects-to-the-ecowatch-backend)
7. [Troubleshooting](#troubleshooting)
8. [Re-training with new data](#re-training-with-new-data)
9. [Adding more photos — cold start vs. continued training](#adding-more-photos--cold-start-vs-continued-training)
10. [Defense talking points](#defense-talking-points)

---

## Big picture

```
Pre-trained COCO weights (general object detection, 80 classes)
            │
            ▼
   Transfer learning ─── keep backbone, retrain head layers
            │
            ▼
   Garbage-only weights (mask_rcnn_garbage.h5)
            │
            ▼
   EcoWatch backend (ai_verifier.py) ─── used at inference time
```

The notebook fine-tunes a pre-trained **Mask R-CNN** model on your own garbage dataset. We use **transfer learning** — we don't train from scratch (which would need millions of images), we start from a model that already knows how to detect 80 common objects (COCO dataset) and retrain only the final layers to recognize garbage.

**Why Mask R-CNN?** Unlike simple classifiers ("is this a garbage image?"), Mask R-CNN does **instance segmentation** — it draws exact pixel outlines around each garbage pile and outputs a confidence score per region. This gives the EcoWatch barangay/CENRO portals a visual overlay showing exactly where the AI detected waste.

---

## Prerequisites

| Requirement | Why |
|---|---|
| Google account | Required for Colab and Drive |
| Colab runtime: **GPU** (T4 or better) | Training on CPU takes 10–20× longer (hours instead of minutes) |
| Labeled dataset in COCO format | Images + a JSON file with polygon annotations |
| ~3 GB free space on Google Drive | For the dataset + trained model |

**To set GPU in Colab:** `Runtime` → `Change runtime type` → `Hardware accelerator: T4 GPU` → `Save`.

---

## Step 0 — Preparing the dataset (before Colab)

Before you touch Google Colab, you need to produce **two things**:

1. A **folder of garbage images** (.jpg / .png)
2. A **COCO-format `annotations.json` file** that tells the model where the garbage is in each image (pixel-perfect polygons around each pile)

Without these two artifacts, the notebook has nothing to train on. This step is done **on your local computer, in a web browser** — no code, no Colab, no GPU needed yet.

---

### Why polygons (not bounding boxes)?

Mask R-CNN is an **instance segmentation** model, not a simple object detector. It learns the exact pixel boundary of every object. To train it, your labels also need to be pixel boundaries — drawn as **polygons** that trace around each garbage pile's actual shape.

A rectangular bounding box would tell the model "there's garbage somewhere in this rectangle," which loses the pixel-level outline. The barangay/CENRO portal overlays only look good because the model learned actual shapes.

---

### Tool: Makesense.ai

We use **[Makesense.ai](https://www.makesense.ai/)** — a free, browser-based annotation tool. No account needed, no install, no upload to a server (everything happens locally in your browser).

**Why Makesense.ai:**
- Free and open source
- Supports polygon annotations
- Exports directly to COCO JSON format
- Runs entirely in your browser — your images never leave your computer

Alternatives: LabelMe (desktop), Roboflow (cloud, free tier), VGG Image Annotator (browser).

---

### Step-by-step annotation workflow

#### 1. Gather your images

Collect garbage / illegal dumping photos and put them in a single folder on your computer (e.g., `Desktop/garbage_dataset/`).

**Dataset size guidance:**
| Image count | Expected quality |
|---|---|
| < 30 images | Model will likely overfit — only useful for testing the pipeline |
| 50–100 images | Reasonable starting point for a capstone demo |
| 200+ images | Solid model, generalizes better |
| 1,000+ images | Production-quality |

Variety matters more than raw count — different lighting (day/night), different angles, different garbage types (bags, scattered, piled), different backgrounds (street, canal, vacant lot).

#### 2. Open Makesense.ai

1. Go to **https://www.makesense.ai/**
2. Click **Get Started**
3. Drag and drop **your entire image folder** into the upload zone
4. Choose **Object Detection** as the project type
5. Click **Create labels list**
6. Add a single label: `garbage`
7. Click **Start project**

#### 3. Annotate each image with polygons

For every image in your dataset:

1. Select the **Polygon tool** from the left toolbar (looks like a multi-sided shape)
2. **Click around the outline of each garbage pile** — every click adds a polygon corner. Trace as tightly as possible around the edges of the garbage.
3. **Double-click (or close the loop)** to finish the polygon
4. Select the label `garbage` from the dropdown
5. **If the image has multiple separate garbage piles**, draw a separate polygon for each — each becomes its own "instance"
6. Click **Next** to move to the next image

**Annotation tips for quality data:**
- Trace the **actual garbage edges**, not a loose rectangle around it
- For overlapping piles, **draw separate polygons** if they're visually distinct piles
- Skip ambiguous photos — bad labels are worse than no labels
- 8–15 corners per polygon is usually enough; you don't need 50 corners to outline a trash bag

#### 4. Export as COCO JSON

When all images are annotated:

1. Go to **Actions** → **Export Annotations**
2. Choose **Single file in COCO JSON format**
3. Click **Export** — your browser downloads `labels_my-project-name.json`
4. **Rename the file to `annotations.json`**

#### 5. Verify what you have locally

You should now have these two artifacts on your computer:

```
garbage_dataset/         ← folder of all your annotated images
  ├── img001.jpg
  ├── img002.jpg
  └── ...

annotations.json         ← COCO-format polygons exported from Makesense.ai
```

#### 6. Upload to Google Drive

Place both into Drive matching the layout the notebook expects:

```
MyDrive/
└── EcoWatch/
    └── garbage/
        ├── dataset/             ← the image folder, renamed to "dataset"
        │   ├── img001.jpg
        │   └── ...
        └── annotations.json
```

> **Important:** The image folder must be named exactly `dataset` (not `garbage_dataset` or `images`) — that's the name the notebook expects in Cell 7 and Cell 9.

#### 7. Quick sanity check before opening Colab

Open `annotations.json` in any text editor and confirm it has these three top-level keys:

```json
{
  "images": [ ... ],         ← list of image entries with filename, width, height
  "annotations": [ ... ],    ← list of polygon annotations
  "categories": [ ... ]      ← should contain {"id": 1, "name": "garbage"}
}
```

If `annotations` is empty, you exported before drawing any polygons. Go back to Makesense.ai and re-export.

---

### How the polygons end up training the model

Here's the chain from your mouse clicks to a trained model — this is useful to understand for defense Q&A:

```
You click around a garbage pile in Makesense.ai
   │
   ▼
Makesense stores it as polygon corners: [x1, y1, x2, y2, x3, y3, ...]
   │
   ▼
Exported into COCO JSON's "segmentation" field per annotation
   │
   ▼
Cell 8's GarbageDataset.load_mask() reads each polygon
   │
   ▼
skimage.draw.polygon() fills in every pixel inside the polygon
   │
   ▼
Result: a binary pixel mask (1 = garbage, 0 = not garbage)
   │
   ▼
Mask R-CNN trains its "mask head" to predict the same pixel pattern
```

So the model literally learns the pixel-precise shape from your hand-traced polygons. This is why polygon quality matters — **sloppy polygons train a sloppy model.**

---

## Expected folder structure in Google Drive

Before running the notebook, your Google Drive must look like this:

```
MyDrive/
└── EcoWatch/
    └── garbage/
        ├── dataset/
        │   ├── img001.jpg
        │   ├── img002.jpg
        │   └── ...                    (all training images)
        └── annotations.json           (COCO-format polygon labels)
```

### COCO annotations JSON — what it looks like

```json
{
  "images": [
    {
      "id": 1,
      "file_name": "img001.jpg",
      "width": 1920,
      "height": 1080
    }
  ],
  "annotations": [
    {
      "id": 1,
      "image_id": 1,
      "category_id": 1,
      "segmentation": [[120, 50, 200, 50, 200, 130, 120, 130]],
      "bbox": [120, 50, 80, 80],
      "area": 6400,
      "iscrowd": 0
    }
  ],
  "categories": [
    {"id": 1, "name": "garbage"}
  ]
}
```

Each `segmentation` entry is a flat list `[x1, y1, x2, y2, ...]` of polygon corner coordinates that outline a garbage region. You can produce these labels using **VGG Image Annotator (VIA)**, **LabelMe**, or **Roboflow** and exporting as COCO format.

---

## Cell-by-cell walkthrough

### Cell 1 — Install Keras compatibility layer + verify TensorFlow

```python
!pip install tf-keras
import os
os.environ["TF_USE_LEGACY_KERAS"] = "1"
import tensorflow as tf
print(f"TF: {tf.__version__}")
print(f"GPU: {tf.config.list_physical_devices('GPU')}")
print("✅ TensorFlow ready with Legacy Keras!")
```

**Purpose:** Sets up a working TensorFlow environment that's compatible with the Mask R-CNN library.

**The Keras 2 vs Keras 3 problem:**
The original Matterport Mask R-CNN was written for **Keras 2** (the old standalone Keras). Modern TensorFlow (2.16+) ships **Keras 3** by default, which broke many APIs. This cell fixes the incompatibility before anything else runs.

| Line | What it does |
|---|---|
| `!pip install tf-keras` | Installs the `tf-keras` package — a backport of Keras 2 that runs inside modern TF. The `!` prefix in Colab means it's a shell command, not Python. |
| `os.environ["TF_USE_LEGACY_KERAS"] = "1"` | Tells TensorFlow to route all `tf.keras.*` calls to the Keras 2 engine instead of Keras 3. **Must be set before TF is imported** — otherwise the wrong Keras is already loaded into memory. |
| `import tensorflow as tf` | Imports TensorFlow now that the env var is set. |
| `tf.__version__` | Prints the TF version — expect something like `2.16.x` or `2.17.x`. |
| `tf.config.list_physical_devices('GPU')` | Lists detected GPUs. **If this returns `[]`, you're on CPU — stop and change the runtime to GPU.** Otherwise expect `[PhysicalDevice(name='/physical_device:GPU:0', device_type='GPU')]`. |

> **Why same env var also appears in [backend/ai_verifier.py:12](backend/ai_verifier.py#L12):** the backend needs the same Keras 2 setting at runtime to load the trained `.h5` file correctly.

---

### Cell 2 — Clone the Mask R-CNN library

```python
import os
os.environ["TF_USE_LEGACY_KERAS"] = "1"

!git clone https://github.com/z-mahmud22/Mask-RCNN_TF2.14.0.git maskrcnn
os.chdir('maskrcnn')
!pwd
```

**Purpose:** Downloads the Mask R-CNN source code into the Colab session.

**Why a community fork:** The official Matterport repo (`matterport/Mask_RCNN`) was written for TensorFlow 1.x and has not been updated since 2019. The fork `z-mahmud22/Mask-RCNN_TF2.14.0` has been patched to run on TensorFlow 2.14+, which is what Colab provides.

| Line | What it does |
|---|---|
| `os.environ[...]` | Repeated as a safety measure — Colab cells can be re-run in any order, so each cell that touches TF re-sets the legacy flag first. |
| `!git clone <url> maskrcnn` | Downloads the repo into a folder named `maskrcnn/` inside Colab's `/content/` directory. |
| `os.chdir('maskrcnn')` | Changes Python's current working directory into the cloned repo. All subsequent relative paths now resolve to `/content/maskrcnn/`. |
| `!pwd` | Prints the current directory — confirms you're inside `/content/maskrcnn`. |

> **Note on the working directory:** After `os.chdir`, anytime a later cell writes `mask_rcnn_coco.h5` or `logs/`, those paths land inside `/content/maskrcnn/`.

---

### Cell 3 — Install Python dependencies

```python
!pip install scikit-image h5py imgaug pycocotools
!python setup.py install
```

**Purpose:** Installs all the libraries Mask R-CNN depends on, then installs `mrcnn` itself as an importable Python package.

| Package | What it's used for |
|---|---|
| `scikit-image` | Image processing — used by `skimage.draw.polygon()` in Cell 8 to convert polygon annotations into pixel masks for training. |
| `h5py` | HDF5 file format reader/writer — every `.h5` weights file (both COCO and your trained garbage model) is in this format. |
| `imgaug` | Image augmentation — randomly flips, rotates, and adjusts brightness during training. Helps the model generalize when the dataset is small. |
| `pycocotools` | Microsoft COCO API — handles COCO's polygon-segmentation JSON format. Even though we read JSON manually, `pycocotools` is a transitive dependency. |
| `!python setup.py install` | Runs the setup script inside the cloned `maskrcnn/` folder. This registers `mrcnn` as an installed Python package so `import mrcnn.config` works from any cell. |

> **Common warning during install:** You may see `error: ... numpy ... requirement conflicts`. These are usually safe — Colab pre-installs newer versions than the setup script requests.

---

### Cell 4 — Download pre-trained COCO weights

```python
!wget https://github.com/matterport/Mask_RCNN/releases/download/v2.0/mask_rcnn_coco.h5
!ls -lh mask_rcnn_coco.h5
```

**Purpose:** Downloads the model that was already trained on Microsoft's COCO dataset (80 common object classes — people, cars, animals, household items, etc.).

**Why we need this — transfer learning explained:**
Training a neural network from scratch on a small custom dataset would produce a terrible model. Instead, we start from a model that already learned general visual features (edges, textures, shapes, object boundaries) from 200,000+ COCO images. We then **retrain only the final layers** to specialize in garbage detection. The lower layers (the "backbone") keep their general-purpose visual knowledge.

| Line | What it does |
|---|---|
| `!wget <url>` | Downloads the ~246 MB `mask_rcnn_coco.h5` file. This is the result of weeks of training on a GPU cluster — we use it for free as our starting point. |
| `!ls -lh mask_rcnn_coco.h5` | Lists the file with human-readable size. Should show approximately **246M**. If it's much smaller, the download failed or was rate-limited. |

---

### Cell 5 — Verify Mask R-CNN import

```python
import os
os.environ["TF_USE_LEGACY_KERAS"] = "1"

import mrcnn.config
import mrcnn.model
print("✅ Mask R-CNN imported!")
```

**Purpose:** A sanity check. After installing in Cell 3, this confirms `mrcnn` is importable. If Cell 3 silently failed (e.g., a missing dependency), this cell fails immediately instead of deep inside training.

| Line | What it does |
|---|---|
| `import mrcnn.config` | Loads the `Config` base class — the blueprint we'll subclass in Cell 8 to define our garbage-specific training settings. |
| `import mrcnn.model` | Loads the `MaskRCNN` class — the actual neural network model we'll instantiate in Cell 9. |

If this cell raises `ModuleNotFoundError: No module named 'mrcnn'`, go back to Cell 3 — `setup.py install` didn't finish cleanly.

---

### Cell 6 — Mount Google Drive

```python
from google.colab import drive
drive.mount('/content/drive')
!mkdir -p "/content/drive/MyDrive/EcoWatch/models"
print("✅ Drive mounted!")
```

**Purpose:** Connects your Google Drive to the Colab session so the notebook can read your dataset from Drive and save the trained model back to Drive.

**Why this is critical:** Colab's local storage at `/content/` is **completely wiped** when the session ends (after 12 hours of inactivity, or when you close the tab). If you train a model and don't save it to Drive, it's gone forever. Drive persists.

| Line | What it does |
|---|---|
| `drive.mount('/content/drive')` | Opens an authentication prompt. Click the link, log in to Google, copy the auth code back. After approval, your entire Drive is accessible at `/content/drive/MyDrive/`. |
| `mkdir -p ".../EcoWatch/models"` | Creates the folder where the trained model will be saved in Cell 10. The `-p` flag means "create parent folders if needed, don't error if it already exists." |

---

### Cell 7 — Copy dataset to Colab local storage

```python
import os
os.environ["TF_USE_LEGACY_KERAS"] = "1"

!cp -r "/content/drive/MyDrive/EcoWatch/garbage" "/content/maskrcnn/garbage"

!ls /content/maskrcnn/garbage/
!ls /content/maskrcnn/garbage/dataset/ | head -5
print(f"✅ Dataset copied! Images: {len(os.listdir('/content/maskrcnn/garbage/dataset/'))}")
```

**Purpose:** Copies the training dataset from Google Drive to Colab's local SSD.

**Why copy instead of reading directly from Drive:** Training reads every image many times across multiple epochs. Google Drive access has latency (~100 ms per file read). Local SSD reads in microseconds. For a dataset of even 100 images × 15 epochs × 10 steps, you save many minutes.

| Line | What it does |
|---|---|
| `!cp -r "..." "..."` | Recursively copies the entire `garbage/` folder (images + annotations) from Drive to local Colab storage at `/content/maskrcnn/garbage/`. |
| `!ls .../garbage/` | Lists the contents — should show `dataset/` folder and `annotations.json`. |
| `!ls .../dataset/ \| head -5` | Shows the first 5 image filenames as a spot check. |
| `len(os.listdir(...))` | Counts total images in the dataset folder — confirms all files transferred. Compare to the count you expect. |

---

### Cell 8 — Define training config and dataset class

```python
class GarbageConfig(mrcnn.config.Config):
    NAME = "garbage"
    NUM_CLASSES = 1 + 1
    GPU_COUNT = 1
    IMAGES_PER_GPU = 1
    STEPS_PER_EPOCH = 10
    DETECTION_MIN_CONFIDENCE = 0.7
    LEARNING_RATE = 0.001
    IMAGE_MIN_DIM = 512
    IMAGE_MAX_DIM = 512

class GarbageDataset(mrcnn.utils.Dataset):
    def load_dataset(self, dataset_dir, annotations_file): ...
    def load_mask(self, image_id): ...
    def image_reference(self, image_id): ...
```

**Purpose:** Defines the two core building blocks of training — how the model should be configured, and how to read your specific dataset. **Nothing runs yet**; these are just class definitions ready to be used in Cell 9.

---

#### `GarbageConfig` — Model hyperparameters

Each setting controls a different aspect of the model architecture or training behavior.

| Setting | Value | What it means |
|---|---|---|
| `NAME = "garbage"` | `"garbage"` | Internal identifier. Used for naming log folders (`logs/garbage20241201T1234/`) and saved weight files (`mask_rcnn_garbage_0015.h5`). |
| `NUM_CLASSES = 1 + 1` | `2` | Background (always class 0) + garbage (class 1). The `1 + 1` formula makes it explicit: 1 real class + 1 background class. |
| `GPU_COUNT = 1` | `1` | Colab provides exactly 1 GPU. |
| `IMAGES_PER_GPU = 1` | `1` | Batch size per GPU. Higher batch sizes train faster but use more GPU memory. 1 is safe for Colab's ~15 GB T4 GPU at 512×512 image size. |
| `STEPS_PER_EPOCH = 10` | `10` | How many training batches per epoch. With 10 steps × 1 image/step = 10 images per epoch. **For a proper run, set this to `len(dataset) / IMAGES_PER_GPU`** — the current value is a quick-test setting. |
| `DETECTION_MIN_CONFIDENCE = 0.7` | `0.7` | During training-time validation, only count detections above 70% confidence. Higher = stricter validation. |
| `LEARNING_RATE = 0.001` | `0.001` | How much to adjust weights at each step. Standard starting value for fine-tuning. Too high = the model "forgets" what COCO taught it. Too low = it never learns garbage. |
| `IMAGE_MIN_DIM` / `IMAGE_MAX_DIM` | `512` / `512` | All images are resized to fit within 512×512 pixels before going into the network. Smaller = faster training but loses detail. |

> **Inference uses the same config** — see `InferenceConfig` in [backend/ai_verifier.py:57-64](backend/ai_verifier.py#L57). The only difference is `DETECTION_MIN_CONFIDENCE = 0.5` for inference (more lenient at runtime).

---

#### `GarbageDataset` — How to read your data

Mask R-CNN doesn't know about your specific dataset format. You teach it by subclassing `mrcnn.utils.Dataset` and implementing three methods.

**`load_dataset(dataset_dir, annotations_file)`**
- Opens the `annotations.json` COCO file
- Calls `self.add_class("garbage", 1, "garbage")` — registers garbage as class ID 1
- Builds an internal lookup dictionary: `image_id → list of annotations` (since one image can contain multiple garbage instances)
- Iterates over the `images` array in the JSON and calls `self.add_image()` for every image that **actually exists on disk** (skips any images referenced in the JSON but missing from the folder — this prevents crashes from missing files)

**`load_mask(image_id)`** — the most important method
- Called by Mask R-CNN once per image during training
- Creates a blank pixel mask `[height, width, num_instances]` — a 3D array where each "layer" represents one garbage instance in that image
- For each annotation's polygon coordinates, calls `skimage.draw.polygon()` to fill in the pixels inside that polygon
- Returns `(masks, class_ids)` — the pixel masks plus an array of class IDs (all `1` since every instance is garbage)

**`image_reference(image_id)`**
- Returns the file path for an image
- Used only in debug output and error messages

---

### Cell 9 — Load data, configure model, run training

```python
DATASET_DIR = "/content/maskrcnn/garbage/dataset"
ANNOTATIONS = "/content/maskrcnn/garbage/annotations.json"

dataset_train = GarbageDataset()
dataset_train.load_dataset(DATASET_DIR, ANNOTATIONS)
dataset_train.prepare()

dataset_val = GarbageDataset()
dataset_val.load_dataset(DATASET_DIR, ANNOTATIONS)
dataset_val.prepare()

config = GarbageConfig()
config.display()

model = mrcnn.model.MaskRCNN(mode="training", config=config, model_dir="./logs")

model.load_weights("mask_rcnn_coco.h5", by_name=True,
                   exclude=["mrcnn_class_logits", "mrcnn_bbox_fc", "mrcnn_bbox", "mrcnn_mask"])

model.train(dataset_train, dataset_val,
            learning_rate=config.LEARNING_RATE,
            epochs=15,
            layers='heads',
            augmentation=None)
```

**Purpose:** The actual training run. Loads the dataset, loads COCO pre-trained weights, freezes the backbone, and runs 15 epochs of fine-tuning on the head layers.

---

#### Section-by-section

**Dataset loading:**
| Line | What it does |
|---|---|
| `dataset_train.load_dataset(...)` | Reads the annotations JSON, registers all images and their masks. |
| `dataset_train.prepare()` | Builds internal indexes (class-to-id maps, image source lookups) — must be called after `load_dataset`. |
| `dataset_val = ...` | Uses the **same dataset for validation** since the training set is small. In production you'd split 80/20 (e.g., randomly assign each image to train or val before loading). |

**Model setup:**
| Line | What it does |
|---|---|
| `config.display()` | Prints a full table of all config values (including inherited defaults like RPN anchor sizes, image dimensions, etc.). Useful for confirming settings before a long training run. |
| `MaskRCNN(mode="training", ...)` | Creates the model in training mode (includes loss computation and gradient layers that aren't used at inference). Checkpoints and TensorBoard logs go to `./logs/`. |

**Loading COCO weights (transfer learning):**
```python
model.load_weights("mask_rcnn_coco.h5", by_name=True,
                   exclude=["mrcnn_class_logits", "mrcnn_bbox_fc", "mrcnn_bbox", "mrcnn_mask"])
```
- `by_name=True` — match layers by name, not position. Required because we changed `NUM_CLASSES` from 81 (COCO) to 2 (garbage), which changes some layer shapes.
- `exclude=[...]` — these 4 layers are the **final classification/bbox/mask heads**. They were trained for 80 COCO classes and their shapes don't match our 2 classes. They're excluded so they get randomly initialized and learn from scratch.
- **Every other layer (the ResNet101 backbone, FPN, RPN) keeps its COCO weights.** This is the heart of transfer learning.

**Training:**
```python
model.train(dataset_train, dataset_val,
            learning_rate=config.LEARNING_RATE,
            epochs=15,
            layers='heads',
            augmentation=None)
```
| Argument | What it does |
|---|---|
| `epochs=15` | Run 15 full passes through the dataset. |
| `layers='heads'` | **Only train the head layers — the backbone stays frozen.** This is much faster (fewer parameters to update) and prevents overfitting on a small dataset. Options: `'heads'`, `'3+'` (stage 3 and up), `'all'`. |
| `augmentation=None` | No image augmentation. Set to an `imgaug` augmenter object to enable random flips, rotations, etc. for better generalization. |

**Total gradient updates:** 15 epochs × 10 steps/epoch = **150 weight updates**. On a Colab T4 GPU, this typically takes **5–10 minutes**.

After every epoch, a checkpoint is saved to `logs/garbage<timestamp>/mask_rcnn_garbage_<epoch>.h5`.

---

### Cell 10 — Save the trained weights to Google Drive

```python
import glob

model_path = sorted(glob.glob("logs/garbage*/mask_rcnn_garbage_*.h5"))[-1]
print(f"Best model: {model_path}")

!cp "{model_path}" "/content/drive/MyDrive/EcoWatch/models/mask_rcnn_garbage.h5"
print("✅ Model saved to Google Drive: EcoWatch/models/mask_rcnn_garbage.h5")
```

**Purpose:** Mask R-CNN saves a checkpoint after every epoch. This cell finds the **latest** one (the one trained for the most epochs) and copies it to Drive with the exact filename the EcoWatch backend expects.

| Line | What it does |
|---|---|
| `glob.glob("logs/garbage*/mask_rcnn_garbage_*.h5")` | Finds all checkpoint files. Pattern matches paths like `logs/garbage20241201T1234/mask_rcnn_garbage_0015.h5`. |
| `sorted(...)[-1]` | Takes the last file alphabetically. Since filenames end in zero-padded epoch numbers (`_0001`, `_0015`), the last one alphabetically is also the last epoch trained. |
| `!cp "{model_path}" "..."` | Copies to Drive as `mask_rcnn_garbage.h5` — **this exact filename** is what [backend/ai_verifier.py:20](backend/ai_verifier.py#L20) reads on startup. |

> **Picking the best model:** This cell picks the **last** checkpoint, but the last isn't always the best (it may have overfit). For a serious run, look at validation loss curves in TensorBoard and pick the epoch with the lowest val loss.

---

### Cell 11 — Run inference and visualize detections

```python
class InferenceConfig(mrcnn.config.Config):
    NAME = "garbage"
    NUM_CLASSES = 1 + 1
    GPU_COUNT = 1
    IMAGES_PER_GPU = 1
    DETECTION_MIN_CONFIDENCE = 0.5
    IMAGE_MIN_DIM = 512
    IMAGE_MAX_DIM = 512

model = mrcnn.model.MaskRCNN(mode="inference", config=InferenceConfig(), model_dir="./logs")
model.load_weights("/content/drive/MyDrive/EcoWatch/models/mask_rcnn_garbage.h5", by_name=True)

image_dir = "/content/maskrcnn/garbage/dataset"
all_images = [f for f in os.listdir(image_dir) if f.lower().endswith(('.jpg', '.png', '.jpeg'))]
test_images = random.sample(all_images, min(4, len(all_images)))

CLASS_NAMES = ['BG', 'garbage']

for i, img_name in enumerate(test_images):
    image = cv2.imread(os.path.join(image_dir, img_name))
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    results = model.detect([image], verbose=0)
    r = results[0]
    mrcnn.visualize.display_instances(
        image=image, boxes=r['rois'], masks=r['masks'],
        class_ids=r['class_ids'], class_names=CLASS_NAMES,
        scores=r['scores'], title=f"{img_name}\n({len(r['rois'])} detections)"
    )
```

**Purpose:** Visually tests the saved model. Loads the freshly trained weights, runs detection on 4 random images from your dataset, and draws the detected garbage regions with colored masks and confidence scores. **This is how you confirm the model actually learned something** before deploying it to the backend.

---

#### Section-by-section

**`InferenceConfig` — a sibling of `GarbageConfig`:**
The same architecture, but tuned for inference:
- `DETECTION_MIN_CONFIDENCE = 0.5` — more lenient than training's 0.7. We want to see borderline detections during testing.
- This config is mirrored exactly in [backend/ai_verifier.py:57](backend/ai_verifier.py#L57) — they must stay in sync, otherwise the saved weights won't load correctly.

**Model loading:**
- `mode="inference"` — loads the model without the training-only layers (loss computation, gradient computation). Smaller memory footprint, faster forward pass.
- `model.load_weights(...)` — loads the trained garbage weights from Drive (the file we just saved in Cell 10).

**Picking test images:**
```python
test_images = random.sample(all_images, min(4, len(all_images)))
```
Picks 4 random images (or fewer if the dataset has less than 4) so each notebook run shows different examples.

**Running detection:**
```python
results = model.detect([image], verbose=0)
r = results[0]
```
- `model.detect()` is the full inference pipeline: resize → backbone features → region proposals → classification → mask generation.
- Returns a list (one per input image). For each image, the result dict has:
  - `rois` — bounding box coordinates `[y1, x1, y2, x2]` for each detection
  - `masks` — per-pixel boolean masks `[height, width, num_instances]`
  - `class_ids` — array of class IDs (all `1` for garbage)
  - `scores` — confidence scores `[0.0–1.0]` per detection

**Visualization:**
```python
mrcnn.visualize.display_instances(image, boxes, masks, class_ids, class_names, scores)
```
Draws colored polygon masks over each detected region, labels each with class name + confidence percentage. **Note:** the `fig, axes = plt.subplots(2, 2)` line in the original code doesn't actually work as a grid because `display_instances` creates its own figure internally. Each detection draws as a separate plot.

**Final text summary loop:**
```python
for i, img_name in enumerate(test_images):
    ...
    r = model.detect([image], verbose=0)[0]
    print(f"  {img_name}: {len(r['rois'])} garbage regions detected ...")
```
Runs detection again on the same 4 images and prints a text summary: filename, number of regions detected, and the confidence scores. Useful when matplotlib output isn't visible (e.g., when running headless).

---

## How it connects to the EcoWatch backend

```
Cell 4   →  downloads mask_rcnn_coco.h5         (starting point, COCO weights)
Cell 8   →  defines GarbageConfig                (must match InferenceConfig in backend)
Cell 9   →  trains the model                     (~5–10 min on GPU)
Cell 10  →  saves mask_rcnn_garbage.h5 to Drive  (THE artifact the backend needs)
Cell 11  →  confirms it works visually           (sanity check)
```

**Deployment to backend:**
1. Download `mask_rcnn_garbage.h5` from Google Drive
2. Place it at `backend/models/mask_rcnn_garbage.h5` in your local EcoWatch repo
3. Restart the uvicorn backend
4. [backend/ai_verifier.py:43-46](backend/ai_verifier.py#L43-L46) detects the file and loads it on startup
5. Without the file, the verifier falls back to **mock mode** ([ai_verifier.py:207](backend/ai_verifier.py#L207)) which returns 80% positive randomly — useful for dev but not for real verification

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `tf.config.list_physical_devices('GPU')` returns `[]` | Colab runtime is CPU | Runtime → Change runtime type → T4 GPU |
| `ModuleNotFoundError: No module named 'mrcnn'` in Cell 5 | `setup.py install` failed in Cell 3 | Re-run Cell 3, watch for errors |
| `FileNotFoundError: mask_rcnn_coco.h5` in Cell 9 | Cell 4 download failed or you're not in `/content/maskrcnn/` | Re-run Cells 2 and 4 |
| Training loss = NaN | Learning rate too high, or corrupt annotations | Drop `LEARNING_RATE` to 0.0005; check annotations.json with `json.loads()` |
| Training loss stuck high (>3 after epoch 5) | Dataset too small, or labels are wrong | Add more labeled images; verify polygons cover actual garbage |
| Cell 11 detects nothing in any image | Model didn't learn, or `DETECTION_MIN_CONFIDENCE` too high | Drop confidence to 0.3 to see weak detections; if still nothing, retrain with more epochs/data |
| `OOM` (out of memory) error during training | Image size or batch size too large | Drop `IMAGE_MAX_DIM` to 384, keep `IMAGES_PER_GPU = 1` |
| Backend loads model but every detection has 0 confidence | `InferenceConfig` in `ai_verifier.py` doesn't match training `GarbageConfig` | Make sure `NUM_CLASSES`, `IMAGE_MIN_DIM`, `IMAGE_MAX_DIM` are identical |

---

## Re-training with new data

When you add more labeled images to your dataset:

1. **Update the Drive folder** — add new images to `MyDrive/EcoWatch/garbage/dataset/` and update `annotations.json` to include them.
2. **Re-run the notebook** from Cell 6 onward (you can skip Cells 1–5 if the runtime is still alive — but if Colab restarted, run them all).
3. **Consider increasing `STEPS_PER_EPOCH`** to match the new dataset size (rough rule: `len(dataset) / IMAGES_PER_GPU`).
4. **Optionally unfreeze more layers** for longer training: change `layers='heads'` to `layers='3+'` or `layers='all'`. This trains deeper layers and improves accuracy at the cost of much longer training time.
5. **Always verify with Cell 11** before deploying — visually check that detections are sensible on held-out images.

---

## Adding more photos — cold start vs. continued training

This section answers the question: **if I train a new model with additional photos, will the new model inherit what the previous model already learned, or does it start from zero?**

The answer depends entirely on **which file you load as the starting weights in Cell 9.**

---

### What the current code does (cold start every time)

Cell 9 currently loads `mask_rcnn_coco.h5`:

```python
model.load_weights("mask_rcnn_coco.h5", by_name=True,
                   exclude=["mrcnn_class_logits", "mrcnn_bbox_fc", "mrcnn_bbox", "mrcnn_mask"])
```

Every time you run the notebook, the model **starts fresh from the generic COCO brain** — it has never seen garbage before. It does not read your previous `mask_rcnn_garbage.h5` at all. That file just sits in Drive as an output.

**Result:** if your original dataset had photos 1, 2, 3 and you add photos 4, 5, 6, the new model only benefits from what it sees in training. If you only train on 4, 5, 6, it knows nothing about 1, 2, 3. If you train on all 6, it learns all 6 — but from a cold COCO start, not building on the previous garbage training.

```
Run 1:  COCO weights → train on photos 1, 2, 3 → garbage model v1
Run 2:  COCO weights → train on photos 4, 5, 6 → garbage model v2  ← v1 was thrown away
```

---

### How to make the new model inherit the old model's learning

Two changes are needed together. **Both are required** — doing only one doesn't give the full benefit.

#### Change 1 — Load the previous garbage model instead of COCO in Cell 9

Replace this:

```python
# OLD — always cold-starts from COCO, ignores your previous garbage model
model.load_weights("mask_rcnn_coco.h5", by_name=True,
                   exclude=["mrcnn_class_logits", "mrcnn_bbox_fc", "mrcnn_bbox", "mrcnn_mask"])
```

With this:

```python
# NEW — starts from your existing garbage model, already knows photos 1, 2, 3
model.load_weights("/content/drive/MyDrive/EcoWatch/models/mask_rcnn_garbage.h5",
                   by_name=True)
# No exclude list — all layers including the head are already trained for garbage
```

**Why remove the exclude list:** The `exclude` list existed because the COCO head layers were shaped for 80 classes and needed to be reset for 2 (garbage). Your `mask_rcnn_garbage.h5` already has 2-class heads — they're ready to continue training, not reset.

#### Change 2 — Include the old photos in the dataset alongside the new ones

Even after Change 1, if you only feed the model photos 4, 5, 6 during training, the model **slowly overwrites what it learned about photos 1, 2, 3** to better fit the new images. This is called **catastrophic forgetting** — a known limitation of neural networks.

The fix: put all photos (old + new) into `dataset/` and make sure `annotations.json` covers all of them.

```
Before:  dataset/ → img004.jpg, img005.jpg, img006.jpg  (new only)
After:   dataset/ → img001.jpg, img002.jpg, img003.jpg,  ← keep old ones
                    img004.jpg, img005.jpg, img006.jpg   ← add new ones
```

---

### What each combination actually produces

| Cell 9 weights | Dataset used | Result |
|---|---|---|
| `mask_rcnn_coco.h5` | Photos 4, 5, 6 only | Knows 4, 5, 6. Cold start — previous training wasted. |
| `mask_rcnn_coco.h5` | Photos 1–6 combined | Knows all 6. Cold start but trained on everything. |
| `mask_rcnn_garbage.h5` | Photos 4, 5, 6 only | Starts knowing 1–3, but **gradually forgets** them as it trains on 4–6. |
| `mask_rcnn_garbage.h5` | Photos 1–6 combined ⭐ | Keeps knowledge of 1–3 AND adds 4–6. True accumulation. |

The last row is what you want when building up the model over multiple sessions.

---

### The full flow when correctly done

```
Session 1:
  COCO weights
      │
      ▼ train on photos 1, 2, 3
  mask_rcnn_garbage.h5  (brain knows photos 1, 2, 3 on top of COCO backbone)

Session 2:
  mask_rcnn_garbage.h5  ← load this instead of COCO
      │
      ▼ train on photos 1, 2, 3, 4, 5, 6  ← must include old photos too
  mask_rcnn_garbage.h5  (brain now knows 1, 2, 3, 4, 5, 6)

Session 3:
  mask_rcnn_garbage.h5  ← same pattern
      │
      ▼ train on photos 1–6 + new photos 7, 8, 9
  mask_rcnn_garbage.h5  (brain knows everything cumulatively)
```

Each session genuinely builds on the last. The model's knowledge compounds — not resets.

---

### Why the current code doesn't do this by default

When the notebook was first written, there was no previous garbage model to load from — so it had to start from COCO. That's still the correct starting point for the very first training run. For every run after the first, the Cell 9 code should be updated to load the previous output file instead.

---

## Defense talking points

If asked about the AI model during your defense, key points to emphasize:

- **Transfer learning, not from-scratch training.** We use COCO pre-trained weights as a foundation and fine-tune only the head layers. This is industry-standard practice and lets us train an effective model with relatively few labeled images.
- **Instance segmentation, not classification.** The model doesn't just say "yes/no garbage" — it draws pixel-precise outlines around each garbage pile, with a per-region confidence score. That's why the barangay and CENRO portals can show visual AI overlays.
- **Confidence threshold = 0.5 at inference.** Reports below this threshold are auto-rejected. Above it, they're auto-verified but still subject to the **trust score layer** ([ai_verifier.py:244](backend/ai_verifier.py#L244)) and human review for low-trust uploads.
- **Mock mode fallback.** If the trained model file is missing, the backend falls back to a random 80% positive mock. This is intentional — it keeps the rest of the system testable during development without forcing every contributor to download the 246 MB model file.
- **The model is a component, not the project.** Your contribution is the full EcoWatch pipeline: report submission, GPS barangay routing, async verification queue, trust scoring, work order dispatch, SLA monitoring, multi-portal access. The model is one piece of one stage.
