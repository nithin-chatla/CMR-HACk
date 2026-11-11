"""
AI Anomaly Detection & Confidence Validation Module for ScanSure AI.
Coordinates frame-level U-Net probability map inference, connected-component
segmentation, temporal IoU tracking, and honest confidence reporting.
"""
from typing import Any, Dict, List
from models.segmentation.unet_ultrasound import ScanSureUltrasoundUNet
from processing.segmentation import extract_connected_regions
from processing.temporal_processing import TemporalDetectionTracker


class AnomalyDetector:
    """
    Executes ultrasound anomaly detection and enforces strict clinical safety
    disclosures and threshold validation.
    """

    def __init__(
        self,
        model: ScanSureUltrasoundUNet,
        enabled: bool = True,
        threshold: float = 0.55,
        temporal_smoothing: bool = True,
    ) -> None:
        self.model = model
        self.enabled = enabled
        self.threshold = max(0.30, min(0.95, float(threshold)))
        self.uncertain_upper = max(self.threshold + 0.08, self.model.uncertain_upper_bound)
        self.temporal_smoothing = temporal_smoothing
        self.tracker = TemporalDetectionTracker()

    def detect_frame(
        self,
        frame_index: int,
        timestamp_sec: float,
        enhanced_gray: bytearray,
        sat: List[int],
        sat2: List[int],
        width: int,
        height: int,
    ) -> List[Dict[str, Any]]:
        if not self.enabled:
            return []

        prob_map, _ = self.model.predict_probability_map(
            enhanced_gray, sat, sat2, width, height
        )

        raw_regions = extract_connected_regions(
            prob_map=prob_map,
            enhanced_gray=enhanced_gray,
            width=width,
            height=height,
            threshold=self.threshold,
            uncertain_upper=self.uncertain_upper,
        )

        if self.temporal_smoothing:
            tracked_regions = self.tracker.update(frame_index, raw_regions)
        else:
            tracked_regions = raw_regions

        # Attach frame number, timestamp, and model provenance to each detection
        final_detections: List[Dict[str, Any]] = []
        for idx, reg in enumerate(tracked_regions):
            det = dict(reg)
            det["detection_index"] = idx + 1
            det["frame_number"] = frame_index
            det["timestamp_sec"] = round(timestamp_sec, 4)
            det["model_version"] = self.model.model_version
            det["confidence_type"] = "raw_uncalibrated_model_score"
            det["requires_radiologist_review"] = True
            final_detections.append(det)

        return final_detections

    @staticmethod
    def serialize_for_report(det: Dict[str, Any]) -> Dict[str, Any]:
        """Strips internal rendering buffers (_mask_indices, _contour_full) for JSON/CSV export."""
        return {
            "frame_number": det["frame_number"],
            "timestamp_sec": det["timestamp_sec"],
            "track_id": det.get("track_id", 1),
            "category": det["category"],
            "is_uncertain": det["is_uncertain"],
            "bbox_xywh": det["bbox"],
            "centroid_xy": det["centroid"],
            "area_px": det["area_px"],
            "solidity": det["solidity"],
            "mean_echogenicity": det["mean_echogenicity"],
            "raw_confidence": det["raw_confidence"],
            "validated_threshold": det["validated_threshold"],
            "confidence_type": det["confidence_type"],
            "temporal_persistence_frames": det.get("temporal_persistence_frames", 1),
            "model_version": det["model_version"],
            "contour_polygon": det.get("contour_points", []),
        }
