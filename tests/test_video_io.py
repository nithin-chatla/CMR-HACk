"""Unit tests for Video Input/Output and Frame Extraction (tests/test_video_io.py)."""
import os
import tempfile
import unittest
from processing.frame_extractor import FrameExtractor, generate_clinical_sample_videos
from processing.video_reader import VideoReader, VideoValidationError


class TestVideoIO(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.samples_dir = os.path.abspath("./data/samples")
        cls.samples = generate_clinical_sample_videos(cls.samples_dir)

    def test_sample_videos_generated_and_valid(self) -> None:
        self.assertGreaterEqual(len(self.samples), 3)
        first_video = self.samples[0]["filepath"]
        reader = VideoReader(first_video)
        meta = reader.validate_and_probe()
        self.assertTrue(meta["valid"])
        self.assertEqual(meta["width"], 320)
        self.assertEqual(meta["height"], 240)
        self.assertEqual(meta["frame_count"], 45)
        self.assertAlmostEqual(meta["fps"], 15.0, places=1)

    def test_frame_extractor_yields_exact_frame_count(self) -> None:
        first_video = self.samples[0]["filepath"]
        extractor = FrameExtractor(first_video, 320, 240)
        frames = list(extractor.iter_grayscale_frames())
        self.assertEqual(len(frames), 45)
        self.assertEqual(len(frames[0][1]), 320 * 240)

    def test_invalid_file_raises_validation_error(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".txt") as tmp:
            tmp.write(b"not a video")
            tmp.flush()
            with self.assertRaises(VideoValidationError):
                VideoReader(tmp.name).validate_and_probe()


if __name__ == "__main__":
    unittest.main()
