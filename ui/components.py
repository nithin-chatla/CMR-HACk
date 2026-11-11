"""UI Components & Pipeline Stage Metadata for ScanSure AI."""
from typing import Any, Dict, List


def get_pipeline_stages() -> List[Dict[str, str]]:
    return [
        {"id": "validation", "title": "01. Video Validation & Stream Probe"},
        {"id": "extraction", "title": "02. Sequential Frame Extraction"},
        {"id": "quality", "title": "03. Ultrasound Image Quality Assessment"},
        {"id": "enhancement", "title": "04. Speckle Denoising & Bilinear CLAHE"},
        {"id": "detection", "title": "05. U-Net Multi-Scale Anomaly Detection"},
        {"id": "segmentation", "title": "06. Region Contour & HUD Highlighting"},
        {"id": "confidence", "title": "07. Temporal Tracking & Confidence Validation"},
        {"id": "reconstruction", "title": "08. Multi-Stream MP4 Reconstruction & Integrity Check"},
    ]


def format_hardware_banner(hw: Dict[str, Any]) -> str:
    cpu = hw.get("cpu", {}).get("model", "CPU")
    cores = hw.get("cpu", {}).get("logical_cores", 1)
    ram = hw.get("memory", {}).get("available_gb", 0)
    gpu = hw.get("gpu", {}).get("model", "None")
    return f"Device: {cpu} ({cores} cores) | Avail RAM: {ram} GB | GPU: {gpu} | Offline Mode: Active"
