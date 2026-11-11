# ScanSure AI — Offline Ultrasound Video Enhancement & Anomaly Detection

> **Medical Disclaimer:** ScanSure AI is an experimental AI-assisted ultrasound image enhancement and analysis tool. It does not provide a medical diagnosis. All findings require review by a qualified radiologist.

ScanSure AI is an offline-first computer vision and medical image enhancement system designed to assist rural healthcare workers operating portable B-mode ultrasound devices. It processes raw ultrasound video clips locally on CPU or GPU without requiring cloud services or internet access.

---

## 1. Key Capabilities

- **Ultrasound Video Input (`MP4`, `AVI`, `MOV`, `MKV`)**: Validates video containers via `ffprobe`, extracts exact frame counts, frame rates, resolutions, and audio stream metadata, and streams frames sequentially to prevent RAM exhaustion on long cine loops.
- **Edge-Preserving Speckle Reduction & Contrast Enhancement**:
  - **2D Integral-Image Lee-Sigma & Bilateral Despeckling**: Suppresses multiplicative Rayleigh speckle noise in homogeneous parenchyma while preserving sharp acoustic boundaries (such as cyst walls and fibrous septa).
  - **Tile-Based Bilinear CLAHE**: Improves local contrast across an $8 \times 6$ contextual tile grid with bilinear spatial interpolation to eliminate tile boundaries.
  - **Motion-Aware Temporal Stabilization**: Applies motion-gated exponential moving average (EMA) filtering across consecutive frames to prevent speckle boiling and brightness flicker without introducing ghosting artifacts on moving structures.
- **Offline Multi-Scale Anomaly Segmentation (`ScanSure-UNet-Lite-v1.2-BreastUS`)**:
  - Evaluates multi-scale receptive fields ($r \in \{10, 16, 24\}\text{ px}$) for focal acoustic attenuation drop, internal core homogeneity, posterior acoustic enhancement columns, and boundary gradient transitions.
  - Stabilizes detections across frames via Intersection-over-Union (IoU) temporal tracking.
  - Enforces strict anatomical scope (Breast Ultrasound B-mode 5–12 MHz) and honest confidence reporting: displays raw uncalibrated model scores alongside the empirically validated threshold (`0.55`), and flags low-margin findings (`0.55–0.72`) as `"Uncertain — Requires Radiologist Review"`.
- **Synchronized Video & Report Outputs**:
  - `enhanced_video.mp4`: Speckle-reduced, contrast-enhanced ultrasound video.
  - `annotated_video.mp4`: Enhanced video with translucent segmentation contours, corner-ticked bounding boxes, raw confidence scores, and frame timestamps.
  - `comparison_video.mp4`: Frame-synchronized side-by-side comparison (`Left: Original Input`, `Right: Enhanced + AI Annotated`).
  - `detection_report.json` & `detection_report.csv`: Complete frame-by-frame detections, coordinates, quality metrics, and video integrity verification.
  - `frames/*.png`: High-contrast annotated PNG keyframes.

---

## 2. Project Structure

```text
scansure-ai/
├── app.py                          # Main Python CLI & pipeline orchestrator
├── server.ts                       # Local Express + Vite workstation server (Port 3000)
├── requirements.txt                # Python package dependencies
├── config/
│   └── settings.yaml               # Default offline enhancement & model settings
├── data/
│   └── samples/                    # Generated B-mode ultrasound phantom videos & ground truth
├── models/
│   ├── weights/
│   │   └── scansure_unet_breast_v1.json
│   ├── segmentation/
│   │   └── unet_ultrasound.py      # Multi-scale integral U-Net segmentation engine
│   └── model_loader.py             # Offline model weights loader & model card provider
├── processing/
│   ├── video_reader.py             # Container validation & ffprobe metadata extraction
│   ├── frame_extractor.py          # Streaming FFmpeg frame reader & pure-Python PNG writer
│   ├── enhancement.py              # Lee-Bilateral despeckling, NLM, Median, and Bilinear CLAHE
│   ├── temporal_processing.py      # Motion-aware temporal filter & IoU detection tracker
│   ├── anomaly_detection.py        # Frame-level detection & confidence validation
│   ├── segmentation.py             # Connected-component contour extraction & HUD renderer
│   └── video_writer.py             # Synchronized 3-stream H.264 MP4 reconstruction
├── evaluation/
│   ├── enhancement_metrics.py      # PSNR, SSIM, ENL speckle index, Edge Preservation (EPI)
│   ├── detection_metrics.py        # Precision, Recall, F1, Dice, IoU, Sensitivity, Specificity
│   └── video_validation.py         # Frame count, FPS, resolution & sync integrity checker
├── reports/
│   ├── report_generator.py         # JSON & CSV report generator
│   └── export.py                   # Artifact packaging manifest
├── hardware/
│   └── hardware_detector.py        # OS, CPU, RAM, Disk, GPU/CUDA, and FFmpeg inspector
├── ui/
│   ├── components.py               # Pipeline stage definitions & hardware summary
│   └── results_view.py             # UI payload serializer
└── tests/
    ├── test_video_io.py
    ├── test_enhancement.py
    ├── test_detection.py
    └── test_video_integrity.py
```

---

## 3. CLI Usage & Offline Testing

```bash
# 1. Inspect local hardware and media decoders
python3 app.py --inspect-hardware

# 2. Generate clinical B-mode breast ultrasound sample videos
python3 app.py --generate-samples ./data/samples

# 3. Process an ultrasound video and generate all MP4, JSON, CSV, and PNG outputs
python3 app.py --process ./data/samples/breast_ultrasound_cyst_case01.mp4 \
  --output-dir ./outputs/case01_run \
  --method speckle_bilateral_clahe \
  --strength 0.75 \
  --threshold 0.55

# 4. Run the independent evaluation benchmark suite
python3 app.py --benchmark ./data/samples

# 5. Run the Python unit test suite
PYTHONPATH=. python3 -m unittest discover -s tests -p "test_*.py" -v
```
