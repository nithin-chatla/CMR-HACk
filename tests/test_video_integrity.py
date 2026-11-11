"""Unit tests for End-to-End Video Reconstruction & Integrity Verification (tests/test_video_integrity.py)."""
import os
import shutil
import tempfile
import unittest
from app import run_ultrasound_pipeline
from processing.frame_extractor import generate_clinical_sample_videos


class TestVideoIntegrity(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.samples_dir = os.path.abspath("./data/samples")
        cls.samples = generate_clinical_sample_videos(cls.samples_dir)
        cls.temp_out = tempfile.mkdtemp(prefix="scansure_test_")

    @classmethod
    def tearDownClass(cls) -> None:
        if os.path.exists(cls.temp_out):
            shutil.rmtree(cls.temp_out, ignore_errors=True)

    def test_full_pipeline_preserves_frame_count_fps_and_creates_all_artifacts(self) -> None:
        sample_video = self.samples[0]["filepath"]
        result = run_ultrasound_pipeline(
            video_path=sample_video,
            output_dir=self.temp_out,
            job_id="unit_test_job",
            enhancement_method="speckle_bilateral_clahe",
            enhancement_strength=0.75,
            ai_detection_enabled=True,
            detection_threshold=0.55,
        )

        integrity = result["video_integrity_verification"]
        self.assertTrue(integrity["integrity_verified"])
        self.assertTrue(integrity["frame_count_exact_match"])
        self.assertTrue(integrity["fps_exact_match"])
        self.assertTrue(integrity["resolution_exact_match"])
        self.assertTrue(integrity["synchronized_comparison_verified"])

        # Verify all required files exist on disk
        for fname in (
            "enhanced_video.mp4",
            "annotated_video.mp4",
            "comparison_video.mp4",
            "detection_report.json",
            "detection_report.csv",
        ):
            fpath = os.path.join(self.temp_out, fname)
            self.assertTrue(os.path.exists(fpath), f"Missing required artifact: {fname}")
            self.assertGreater(os.path.getsize(fpath), 0, f"Empty artifact: {fname}")


if __name__ == "__main__":
    unittest.main()
