"""
Video Reader & Input Validation Module for ScanSure AI.
Validates video container formats (MP4, AVI, MOV, MKV), decodes stream metadata
via ffprobe, counts exact decoded frames, and checks audio stream presence.
"""
import json
import os
import shutil
import subprocess
from typing import Any, Dict

SUPPORTED_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}


class VideoValidationError(Exception):
    """Raised when an input ultrasound video fails validation."""


class VideoReader:
    """Inspects and validates input ultrasound video files."""

    def __init__(self, video_path: str) -> None:
        self.video_path = os.path.abspath(video_path)
        self.metadata: Dict[str, Any] = {}

    def validate_and_probe(self) -> Dict[str, Any]:
        if not os.path.exists(self.video_path):
            raise VideoValidationError(f"Video file does not exist: {self.video_path}")

        file_size = os.path.getsize(self.video_path)
        if file_size == 0:
            raise VideoValidationError(f"Video file is empty (0 bytes): {self.video_path}")

        _, ext = os.path.splitext(self.video_path)
        if ext.lower() not in SUPPORTED_EXTENSIONS:
            raise VideoValidationError(
                f"Unsupported video format '{ext}'. Supported formats: MP4, AVI, MOV, MKV."
            )

        ffprobe_bin = shutil.which("ffprobe")
        if not ffprobe_bin:
            raise VideoValidationError("ffprobe binary is required for video stream validation.")

        cmd = [
            ffprobe_bin,
            "-v",
            "error",
            "-count_frames",
            "-show_format",
            "-show_streams",
            "-of",
            "json",
            self.video_path,
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if proc.returncode != 0 or not proc.stdout.strip():
            raise VideoValidationError(
                f"Failed to decode video container '{os.path.basename(self.video_path)}': {proc.stderr.strip()}"
            )

        try:
            probe_data = json.loads(proc.stdout)
        except json.JSONDecodeError as exc:
            raise VideoValidationError(f"Invalid ffprobe output: {exc}") from exc

        streams = probe_data.get("streams", [])
        video_stream = None
        audio_stream = None
        for s in streams:
            if s.get("codec_type") == "video" and video_stream is None:
                video_stream = s
            elif s.get("codec_type") == "audio" and audio_stream is None:
                audio_stream = s

        if video_stream is None:
            raise VideoValidationError("No decodable video stream found in file.")

        width = int(video_stream.get("width", 0))
        height = int(video_stream.get("height", 0))
        if width <= 0 or height <= 0:
            raise VideoValidationError(f"Invalid video dimensions: {width}x{height}")

        fps_rational = video_stream.get("avg_frame_rate") or video_stream.get("r_frame_rate") or "24/1"
        fps_float = self._parse_rational_fps(fps_rational)

        frame_count_str = (
            video_stream.get("nb_read_frames")
            or video_stream.get("nb_frames")
            or "0"
        )
        try:
            frame_count = int(frame_count_str)
        except ValueError:
            frame_count = 0

        format_info = probe_data.get("format", {})
        duration_str = video_stream.get("duration") or format_info.get("duration") or "0.0"
        try:
            duration_sec = float(duration_str)
        except ValueError:
            duration_sec = frame_count / fps_float if fps_float > 0 else 0.0

        if frame_count <= 0 and duration_sec > 0 and fps_float > 0:
            frame_count = max(1, int(round(duration_sec * fps_float)))
        if duration_sec <= 0 and frame_count > 0 and fps_float > 0:
            duration_sec = round(frame_count / fps_float, 4)

        self.metadata = {
            "filename": os.path.basename(self.video_path),
            "filepath": self.video_path,
            "extension": ext.lower(),
            "file_size_bytes": file_size,
            "file_size_mb": round(file_size / (1024 * 1024), 3),
            "width": width,
            "height": height,
            "resolution": f"{width}x{height}",
            "fps": round(fps_float, 4),
            "fps_rational": fps_rational if fps_float > 0 else "24/1",
            "frame_count": frame_count,
            "duration_sec": round(duration_sec, 4),
            "video_codec": video_stream.get("codec_name", "unknown"),
            "pixel_format": video_stream.get("pix_fmt", "unknown"),
            "has_audio": audio_stream is not None,
            "audio_codec": audio_stream.get("codec_name") if audio_stream else None,
            "valid": True,
        }
        return self.metadata

    @staticmethod
    def _parse_rational_fps(rate_str: str) -> float:
        if "/" in rate_str:
            parts = rate_str.split("/")
            try:
                num = float(parts[0])
                den = float(parts[1])
                if den > 0 and num > 0:
                    return num / den
            except ValueError:
                pass
        try:
            val = float(rate_str)
            return val if val > 0 else 24.0
        except ValueError:
            return 24.0
