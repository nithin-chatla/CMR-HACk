"""Unit tests for Ultrasound AI Anomaly Detection & Segmentation (tests/test_detection.py)."""
import os
import unittest
from models.model_loader import load_ultrasound_model
from processing.anomaly_detection import AnomalyDetector
from processing.enhancement import UltrasoundEnhancer
from processing.frame_extractor import FrameExtractor, generate_clinical_sample_videos


class TestDetection(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.samples_dir = os.path.abspath("./data/samples")
        cls.samples = generate_clinical_sample_videos(cls.samples_dir)
        cls.model, cls.model_card = load_ultrasound_model("cpu")
        cls.enhancer = UltrasoundEnhancer(method="speckle_bilateral_clahe", strength=0.75)

    def test_detects_cyst_in_positive_phantom_case01(self) -> None:
        cyst_sample = next(s for s in self.samples if s["id"] == "breast_cyst_phantom_01")
        extractor = FrameExtractor(cyst_sample["filepath"], 320, 240)
        _, frame0 = next(extractor.iter_grayscale_frames())
        enh, sat, sat2 = self.enhancer.enhance_frame(frame0, 320, 240)

        detector = AnomalyDetector(model=self.model, enabled=True, threshold=0.55)
        dets = detector.detect_frame(0, 0.0, enh, sat, sat2, 320, 240)
        self.assertGreaterEqual(len(dets), 1)
        top = dets[0]
        self.assertGreaterEqual(top["raw_confidence"], 0.55)
        # Center of lesion in case01 is around (158, 122)
        cx, cy = top["centroid"]
        self.assertTrue(125 <= cx <= 190, f"Unexpected centroid X: {cx}")
        self.assertTrue(95 <= cy <= 155, f"Unexpected centroid Y: {cy}")

    def test_no_false_positives_on_normal_control_case03(self) -> None:
        normal_sample = next(s for s in self.samples if s["id"] == "breast_normal_control_03")
        extractor = FrameExtractor(normal_sample["filepath"], 320, 240)
        _, frame0 = next(extractor.iter_grayscale_frames())
        enh, sat, sat2 = self.enhancer.enhance_frame(frame0, 320, 240)

        detector = AnomalyDetector(model=self.model, enabled=True, threshold=0.55)
        dets = detector.detect_frame(0, 0.0, enh, sat, sat2, 320, 240)
        self.assertEqual(len(dets), 0, "Expected zero detections on normal control frame")


if __name__ == "__main__":
    unittest.main()
