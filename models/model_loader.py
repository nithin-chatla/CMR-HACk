"""
Model Loader & Registry for ScanSure AI.
Loads verified local model weights and calibration metadata from disk without
any network or cloud calls.
"""
import json
import os
from typing import Any, Dict, Optional, Tuple
from models.segmentation.unet_ultrasound import ScanSureUltrasoundUNet

DEFAULT_WEIGHTS_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "weights",
    "scansure_unet_breast_v1.json",
)


class ModelLoader:
    """Loads and validates local ultrasound segmentation model weights."""

    def __init__(self, weights_path: Optional[str] = None, device: str = "cpu") -> None:
        self.weights_path = os.path.abspath(weights_path or DEFAULT_WEIGHTS_PATH)
        self.device = device
        self.weights_metadata: Dict[str, Any] = {}
        self.model: Optional[ScanSureUltrasoundUNet] = None

    def load(self) -> ScanSureUltrasoundUNet:
        if not os.path.exists(self.weights_path):
            raise FileNotFoundError(
                f"Local model weights file missing: {self.weights_path}"
            )
        with open(self.weights_path, "r", encoding="utf-8") as f:
            self.weights_metadata = json.load(f)

        self.model = ScanSureUltrasoundUNet(self.weights_metadata)
        return self.model

    def get_model_card(self) -> Dict[str, Any]:
        if not self.weights_metadata:
            self.load()
        return {
            "model_name": self.weights_metadata.get("model_name"),
            "model_version": self.weights_metadata.get("model_version"),
            "architecture": self.weights_metadata.get("architecture"),
            "supported_anatomy": self.weights_metadata.get("supported_anatomy"),
            "unsupported_anatomies": self.weights_metadata.get("unsupported_anatomies", []),
            "dataset_provenance": self.weights_metadata.get("dataset_provenance", {}),
            "calibration": self.weights_metadata.get("calibration", {}),
            "execution_device": self.device,
            "weights_filepath": self.weights_path,
        }


def load_ultrasound_model(device: str = "cpu") -> Tuple[ScanSureUltrasoundUNet, Dict[str, Any]]:
    loader = ModelLoader(device=device)
    model = loader.load()
    return model, loader.get_model_card()
