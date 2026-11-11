"""
Video Writer & Multi-Stream Reconstruction Module for ScanSure AI.
Simultaneously encodes:
  - Output A: enhanced_video.mp4
  - Output B: annotated_video.mp4
  - Output C: comparison_video.mp4 (Left: Original, Right: Enhanced + AI Annotated)
Preserves original frame order, exact frame rate, duration, resolution, and audio stream
(when present and supported by MP4 container).
"""
import os
import shutil
import subprocess
from typing import Any, Dict, Optional
from processing.frame_extractor import gray_to_rgb_bytes
from processing.segmentation import draw_rect_alpha, draw_text_5x7


def build_side_by_side_frame(
    orig_gray: bytearray,
    annotated_rgb: bytearray,
    width: int,
    height: int,
    frame_index: int,
    timestamp_sec: float,
) -> bytearray:
    """
    Constructs a synchronized side-by-side comparison RGB24 frame of size (2*width) x height.
    Left: Original ultrasound frame with header label.
    Right: Enhanced & AI-annotated ultrasound frame.
    """
    comp_w = width * 2
    orig_rgb = gray_to_rgb_bytes(orig_gray)

    # Add header overlay to Left (Original) frame to match Right frame's HUD bar
    draw_rect_alpha(orig_rgb, width, height, 0, 0, width, 16, (7, 10, 18), 0.82)
    draw_text_5x7(
        orig_rgb,
        width,
        height,
        6,
        4,
        f"ORIGINAL INPUT  FRM {frame_index:04d}  T+{timestamp_sec:05.2f}S",
        color=(148, 163, 184),
        bg_color=None,
    )

    comp_rgb = bytearray(comp_w * height * 3)
    row_bytes_single = width * 3
    row_bytes_comp = comp_w * 3

    for y in range(height):
        src_off = y * row_bytes_single
        dst_off = y * row_bytes_comp
        comp_rgb[dst_off : dst_off + row_bytes_single] = orig_rgb[
            src_off : src_off + row_bytes_single
        ]
        comp_rgb[dst_off + row_bytes_single : dst_off + row_bytes_comp] = annotated_rgb[
            src_off : src_off + row_bytes_single
        ]
        # Draw 2px vertical clinical slate divider in the middle
        mid_idx = dst_off + row_bytes_single - 3
        comp_rgb[mid_idx : mid_idx + 6] = bytes([30, 41, 59, 6, 182, 212])

    return comp_rgb


class MultiStreamVideoWriter:
    """Manages simultaneous FFmpeg encoding pipes for Enhanced, Annotated, and Comparison MP4s."""

    def __init__(
        self,
        output_dir: str,
        width: int,
        height: int,
        fps_rational: str,
        source_video_path: Optional[str] = None,
        has_audio: bool = False,
    ) -> None:
        self.output_dir = os.path.abspath(output_dir)
        os.makedirs(self.output_dir, exist_ok=True)
        self.width = width
        self.height = height
        self.fps_rational = fps_rational
        self.source_video_path = source_video_path
        self.has_audio = has_audio

        self.enhanced_path = os.path.join(self.output_dir, "enhanced_video.mp4")
        self.annotated_path = os.path.join(self.output_dir, "annotated_video.mp4")
        self.comparison_path = os.path.join(self.output_dir, "comparison_video.mp4")

        self._proc_enh: Optional[subprocess.Popen] = None
        self._proc_ann: Optional[subprocess.Popen] = None
        self._proc_cmp: Optional[subprocess.Popen] = None
        self.frames_written = 0
        self.audio_status = "No audio stream present in input video."

    def open(self) -> None:
        ffmpeg_bin = shutil.which("ffmpeg")
        if not ffmpeg_bin:
            raise RuntimeError("ffmpeg binary is required for video reconstruction.")

        self._proc_enh = self._spawn_encoder(
            ffmpeg_bin, self.width, self.height, self.enhanced_path
        )
        self._proc_ann = self._spawn_encoder(
            ffmpeg_bin, self.width, self.height, self.annotated_path
        )
        self._proc_cmp = self._spawn_encoder(
            ffmpeg_bin, self.width * 2, self.height, self.comparison_path
        )

    def _spawn_encoder(
        self, ffmpeg_bin: str, w: int, h: int, out_path: str
    ) -> subprocess.Popen:
        # Ensure even dimensions for yuv420p H.264 compatibility
        even_w = w if w % 2 == 0 else w - 1
        even_h = h if h % 2 == 0 else h - 1
        cmd = [
            ffmpeg_bin,
            "-y",
            "-v",
            "error",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-s",
            f"{w}x{h}",
            "-r",
            self.fps_rational,
            "-i",
            "-",
        ]
        if even_w != w or even_h != h:
            cmd.extend(["-vf", f"crop={even_w}:{even_h}:0:0"])
        cmd.extend(
            [
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-preset",
                "fast",
                "-crf",
                "18",
                "-movflags",
                "+faststart",
                out_path,
            ]
        )
        return subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)

    def write_triplet(
        self,
        orig_gray: bytearray,
        enhanced_gray: bytearray,
        annotated_rgb: bytearray,
        frame_index: int,
        timestamp_sec: float,
    ) -> None:
        enh_rgb = gray_to_rgb_bytes(enhanced_gray)
        cmp_rgb = build_side_by_side_frame(
            orig_gray, annotated_rgb, self.width, self.height, frame_index, timestamp_sec
        )

        if self._proc_enh and self._proc_enh.stdin:
            self._proc_enh.stdin.write(enh_rgb)
        if self._proc_ann and self._proc_ann.stdin:
            self._proc_ann.stdin.write(annotated_rgb)
        if self._proc_cmp and self._proc_cmp.stdin:
            self._proc_cmp.stdin.write(cmp_rgb)
        self.frames_written += 1

    def close(self) -> Dict[str, Any]:
        for proc in (self._proc_enh, self._proc_ann, self._proc_cmp):
            if proc:
                if proc.stdin:
                    proc.stdin.close()
                if proc.stderr:
                    proc.stderr.close()
                proc.wait()

        if self.has_audio and self.source_video_path:
            self._mux_audio_if_possible()

        return {
            "enhanced_video": self.enhanced_path,
            "annotated_video": self.annotated_path,
            "comparison_video": self.comparison_path,
            "frames_written": self.frames_written,
            "audio_preservation_report": self.audio_status,
        }

    def _mux_audio_if_possible(self) -> None:
        ffmpeg_bin = shutil.which("ffmpeg")
        if not ffmpeg_bin or not self.source_video_path:
            self.audio_status = "Audio stream detected in source, but FFmpeg muxer unavailable."
            return

        retained_count = 0
        for target in (self.enhanced_path, self.annotated_path, self.comparison_path):
            tmp_out = target + ".mux.mp4"
            cmd = [
                ffmpeg_bin,
                "-y",
                "-v",
                "error",
                "-i",
                target,
                "-i",
                self.source_video_path,
                "-map",
                "0:v:0",
                "-map",
                "1:a:0?",
                "-c:v",
                "copy",
                "-c:a",
                "aac",
                "-shortest",
                tmp_out,
            ]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
            if proc.returncode == 0 and os.path.exists(tmp_out) and os.path.getsize(tmp_out) > 0:
                os.replace(tmp_out, target)
                retained_count += 1
            elif os.path.exists(tmp_out):
                os.remove(tmp_out)

        if retained_count == 3:
            self.audio_status = "Original audio stream preserved and muxed into all output videos."
        else:
            self.audio_status = (
                "Input contained an audio stream that could not be losslessly remuxed; "
                "video streams were preserved without audio."
            )
