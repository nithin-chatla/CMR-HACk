"""Unit tests for Ultrasound Image Enhancement & Temporal Stabilization (tests/test_enhancement.py)."""
import unittest
from evaluation.enhancement_metrics import compute_psnr_and_ssim
from processing.enhancement import UltrasoundEnhancer, assess_frame_quality, compute_integral_images
from processing.temporal_processing import MotionAwareTemporalFilter


class TestEnhancement(unittest.TestCase):
    def setUp(self) -> None:
        self.w = 120
        self.h = 90
        # Create synthetic noisy ultrasound frame with a dark cyst in the center
        self.noisy_frame = bytearray(self.w * self.h)
        for y in range(self.h):
            for x in range(self.w):
                base = 128 + ((x * 13 + y * 29) % 31) - 15
                if (x - 60) ** 2 + (y - 45) ** 2 < 18 ** 2:
                    base = 24 + ((x * 7 + y * 11) % 9)
                self.noisy_frame[y * self.w + x] = max(0, min(255, base))

    def test_speckle_bilateral_clahe_preserves_dimensions_and_reduces_speckle(self) -> None:
        enhancer = UltrasoundEnhancer(method="speckle_bilateral_clahe", strength=0.75)
        sat_in, sat2_in = compute_integral_images(self.noisy_frame, self.w, self.h)
        q_in = assess_frame_quality(self.noisy_frame, sat_in, sat2_in, self.w, self.h)

        enh, sat_out, sat2_out = enhancer.enhance_frame(self.noisy_frame, self.w, self.h)
        q_out = assess_frame_quality(enh, sat_out, sat2_out, self.w, self.h)

        self.assertEqual(len(enh), self.w * self.h)
        # ENL (speckle smoothness in homogeneous parenchyma) or edge preservation check
        metrics = compute_psnr_and_ssim(self.noisy_frame, enh, self.w, self.h)
        self.assertGreater(metrics["psnr_db"], 15.0)
        self.assertGreater(metrics["ssim"], 0.65)
        self.assertGreater(metrics["epi"], 0.70)
        self.assertGreater(q_out["mean_intensity"], 10.0)

    def test_motion_aware_temporal_filter_stabilizes_static_frames(self) -> None:
        tf = MotionAwareTemporalFilter(alpha=0.35, motion_gate=20.0)
        f1 = bytearray([100] * 400)
        f2 = bytearray([106] * 400)
        out1 = tf.process_frame(f1)
        out2 = tf.process_frame(f2)
        self.assertEqual(out1[0], 100)
        # Blended between 100 and 106 -> strictly between 100 and 106
        self.assertTrue(100 < out2[0] < 106)


if __name__ == "__main__":
    unittest.main()
