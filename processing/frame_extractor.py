"""
Frame Extraction, Pure-Python PNG Encoder, and Realistic B-Mode Ultrasound
Sample Generator for ScanSure AI.
Streams video frames sequentially without loading entire large videos into RAM.
"""
import json
import math
import os
import random
import shutil
import struct
import subprocess
import zlib
from typing import Any, Dict, Iterator, List, Optional, Tuple


def encode_rgb_png(rgb_bytes: bytes, width: int, height: int) -> bytes:
    """Zero-dependency pure-Python RGB24 to PNG encoder using zlib and struct."""
    row_bytes = width * 3
    raw_rows = bytearray()
    for y in range(height):
        raw_rows.append(0)  # Filter type 0 (None)
        start = y * row_bytes
        raw_rows.extend(rgb_bytes[start : start + row_bytes])

    def make_chunk(chunk_type: bytes, data: bytes) -> bytes:
        chunk = struct.pack("!I", len(data)) + chunk_type + data
        crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
        return chunk + struct.pack("!I", crc)

    ihdr = struct.pack("!IIBBBBB", width, height, 8, 2, 0, 0, 0)
    compressed = zlib.compress(bytes(raw_rows), level=6)
    return (
        b"\x89PNG\r\n\x1a\n"
        + make_chunk(b"IHDR", ihdr)
        + make_chunk(b"IDAT", compressed)
        + make_chunk(b"IEND", b"")
    )


def save_rgb_png(filepath: str, rgb_bytes: bytes, width: int, height: int) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
    png_data = encode_rgb_png(rgb_bytes, width, height)
    with open(filepath, "wb") as f:
        f.write(png_data)


def gray_to_rgb_bytes(gray_frame: bytearray) -> bytearray:
    """Converts a W*H grayscale buffer into a W*H*3 RGB24 buffer."""
    n = len(gray_frame)
    rgb = bytearray(n * 3)
    rgb[0::3] = gray_frame
    rgb[1::3] = gray_frame
    rgb[2::3] = gray_frame
    return rgb


class FrameExtractor:
    """Memory-aware streaming frame extractor using FFmpeg rawvideo pipes."""

    def __init__(self, video_path: str, width: int, height: int) -> None:
        self.video_path = os.path.abspath(video_path)
        self.width = width
        self.height = height
        self.frame_size_gray = width * height

    def iter_grayscale_frames(
        self, target_width: Optional[int] = None, target_height: Optional[int] = None
    ) -> Iterator[Tuple[int, bytearray]]:
        """Yields (frame_index, grayscale_bytearray) one frame at a time."""
        ffmpeg_bin = shutil.which("ffmpeg")
        if not ffmpeg_bin:
            raise RuntimeError("ffmpeg binary not found in PATH.")

        out_w = target_width or self.width
        out_h = target_height or self.height
        frame_bytes = out_w * out_h

        cmd = [ffmpeg_bin, "-v", "error", "-i", self.video_path]
        if out_w != self.width or out_h != self.height:
            cmd.extend(["-vf", f"scale={out_w}:{out_h}:flags=bicubic"])
        cmd.extend(["-f", "rawvideo", "-pix_fmt", "gray", "-"])

        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        idx = 0
        try:
            assert proc.stdout is not None
            while True:
                buf = proc.stdout.read(frame_bytes)
                if not buf or len(buf) < frame_bytes:
                    break
                yield idx, bytearray(buf)
                idx += 1
        finally:
            if proc.stdout:
                proc.stdout.close()
            if proc.stderr:
                proc.stderr.close()
            proc.wait()


def generate_clinical_sample_videos(samples_dir: str) -> List[Dict[str, Any]]:
    """
    Generates realistic B-mode breast ultrasound phantom videos with known ground-truth
    anatomy, Rayleigh speckle noise, acoustic attenuation, subcutaneous layers, and
    cystic/solid anomalies if they do not already exist in samples_dir.
    """
    os.makedirs(samples_dir, exist_ok=True)
    ffmpeg_bin = shutil.which("ffmpeg")
    if not ffmpeg_bin:
        return []

    sample_specs = [
        {
            "id": "breast_cyst_phantom_01",
            "filename": "breast_ultrasound_cyst_case01.mp4",
            "title": "Case 01: Well-Circumscribed Anechoic Breast Cyst (B-Mode 10MHz)",
            "description": "High-speckle rural portable linear-probe scan showing a solitary hypoechoic/anechoic cystic lesion with posterior acoustic enhancement.",
            "anatomy": "Breast Ultrasound (Right Upper Outer Quadrant)",
            "width": 320,
            "height": 240,
            "fps": 15,
            "num_frames": 45,
            "lesions": [
                {
                    "category": "Cystic / Anechoic Lesion Candidate",
                    "cx": 158,
                    "cy": 122,
                    "rx": 28,
                    "ry": 21,
                    "echogenicity": 0.14,  # Anechoic dark interior
                    "posterior_boost": 36.0,
                    "wall_sharpness": 1.0,
                }
            ],
            "speckle_sigma": 0.34,
        },
        {
            "id": "breast_multifocal_case02",
            "filename": "breast_ultrasound_multifocal_case02.mp4",
            "title": "Case 02: Multifocal Cyst & Complex Hypoechoic Mass (B-Mode 8MHz)",
            "description": "Low-contrast portable scan containing a primary cystic lesion and a secondary smaller low-margin hypoechoic nodule requiring radiologist review.",
            "anatomy": "Breast Ultrasound (Left Retroareolar Region)",
            "width": 320,
            "height": 240,
            "fps": 15,
            "num_frames": 45,
            "lesions": [
                {
                    "category": "Cystic / Anechoic Lesion Candidate",
                    "cx": 116,
                    "cy": 118,
                    "rx": 25,
                    "ry": 19,
                    "echogenicity": 0.16,
                    "posterior_boost": 32.0,
                    "wall_sharpness": 0.95,
                },
                {
                    "category": "Uncertain Hypoechoic Mass",
                    "cx": 218,
                    "cy": 136,
                    "rx": 18,
                    "ry": 15,
                    "echogenicity": 0.31,
                    "posterior_boost": 10.0,
                    "wall_sharpness": 0.65,
                },
            ],
            "speckle_sigma": 0.38,
        },
        {
            "id": "breast_normal_control_03",
            "filename": "breast_ultrasound_normal_control03.mp4",
            "title": "Case 03: Normal Fibroglandular Parenchyma Control (No Anomaly)",
            "description": "Negative control scan showing normal skin line, subcutaneous fat lobules, Cooper's ligaments, and pectoralis fascia without focal lesions.",
            "anatomy": "Breast Ultrasound (Normal Control)",
            "width": 320,
            "height": 240,
            "fps": 15,
            "num_frames": 45,
            "lesions": [],
            "speckle_sigma": 0.32,
        },
    ]

    manifest_path = os.path.join(samples_dir, "samples_manifest.json")
    generated_info: List[Dict[str, Any]] = []

    for spec in sample_specs:
        video_path = os.path.join(samples_dir, spec["filename"])
        gt_path = os.path.join(samples_dir, f"{spec['id']}_ground_truth.json")
        if not os.path.exists(video_path) or not os.path.exists(gt_path):
            _synthesize_ultrasound_video(ffmpeg_bin, video_path, gt_path, spec)
        generated_info.append(
            {
                "id": spec["id"],
                "filename": spec["filename"],
                "filepath": video_path,
                "ground_truth_path": gt_path,
                "title": spec["title"],
                "description": spec["description"],
                "anatomy": spec["anatomy"],
                "width": spec["width"],
                "height": spec["height"],
                "fps": spec["fps"],
                "num_frames": spec["num_frames"],
                "expected_lesion_count": len(spec["lesions"]),
            }
        )

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(generated_info, f, indent=2)

    return generated_info


def _synthesize_ultrasound_video(
    ffmpeg_bin: str, video_path: str, gt_path: str, spec: Dict[str, Any]
) -> None:
    """Synthesizes a physically grounded B-mode ultrasound video and ground-truth masks."""
    w = spec["width"]
    h = spec["height"]
    fps = spec["fps"]
    num_frames = spec["num_frames"]
    lesions = spec["lesions"]
    speckle_sigma = spec["speckle_sigma"]

    rng = random.Random(42 + len(spec["id"]))

    # Precompute base tissue layers (skin line, subcutaneous zone, fibroglandular zone, deep fascia)
    base_tissue = [0.0] * (w * h)
    for y in range(h):
        depth_norm = y / float(h)
        # Depth attenuation & Time-Gain Compensation profile
        if y < 14:
            # Transducer near-field reverberation & dermis bright band
            layer_val = 155.0 * math.exp(-((y - 6) ** 2) / 18.0) + 75.0
        elif y < 48:
            # Subcutaneous adipose layer (moderately hypoechoic with echogenic septa)
            layer_val = 92.0 + 14.0 * math.sin(y * 0.35)
        elif y < 185:
            # Fibroglandular parenchyma (moderately echogenic)
            layer_val = 126.0 + 18.0 * math.cos(y * 0.22) - 22.0 * (depth_norm - 0.2)
        else:
            # Retromammary space & pectoralis fascia
            fascia_peak = 38.0 * math.exp(-((y - 192) ** 2) / 14.0)
            layer_val = 84.0 + fascia_peak - 35.0 * (depth_norm - 0.75)

        for x in range(w):
            # Lateral beam falloff near edges of ultrasound cone/linear array
            edge_dist = min(x, w - 1 - x)
            lateral_gain = 1.0 if edge_dist > 24 else (0.35 + 0.65 * (edge_dist / 24.0))
            striation = 9.0 * math.sin(x * 0.08 + y * 0.25) + 6.0 * math.cos(x * 0.19 - y * 0.14)
            base_tissue[y * w + x] = max(12.0, min(235.0, (layer_val + striation) * lateral_gain))

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
        str(fps),
        "-i",
        "-",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-preset",
        "fast",
        "-crf",
        "17",
        video_path,
    ]

    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    gt_frames: List[Dict[str, Any]] = []

    try:
        assert proc.stdin is not None
        for t in range(num_frames):
            # Subtle respiratory & probe hand-motion drift (2-4 px sinusoidal trajectory)
            dx = 3.5 * math.sin(2.0 * math.pi * t / float(num_frames))
            dy = 2.0 * math.cos(2.0 * math.pi * t / float(num_frames))

            frame_rgb = bytearray(w * h * 3)
            frame_gt_boxes = []

            # Precompute shifted lesion geometry for frame t
            active_lesions = []
            for idx_l, les in enumerate(lesions):
                cx = les["cx"] + dx
                cy = les["cy"] + dy
                rx = les["rx"]
                ry = les["ry"]
                active_lesions.append((idx_l, cx, cy, rx, ry, les))
                frame_gt_boxes.append(
                    {
                        "lesion_id": idx_l + 1,
                        "category": les["category"],
                        "bbox": [
                            int(round(cx - rx)),
                            int(round(cy - ry)),
                            int(round(2 * rx)),
                            int(round(2 * ry)),
                        ],
                        "center": [round(cx, 2), round(cy, 2)],
                        "radii": [rx, ry],
                    }
                )

            gt_frames.append(
                {
                    "frame_index": t,
                    "timestamp_sec": round(t / float(fps), 4),
                    "ground_truth_regions": frame_gt_boxes,
                }
            )

            for y in range(h):
                row_offset = y * w
                for x in range(w):
                    val = base_tissue[row_offset + x]

                    # Apply lesion acoustic physics
                    for _, cx, cy, rx, ry, les in active_lesions:
                        norm_d2 = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
                        if norm_d2 <= 1.0:
                            # Inside cystic/hypoechoic lesion: strong acoustic attenuation (dark core)
                            edge_blend = norm_d2 ** (1.8 + les["wall_sharpness"] * 1.5)
                            target_in = val * les["echogenicity"]
                            val = target_in * (1.0 - edge_blend) + val * edge_blend
                        elif 1.0 < norm_d2 <= 1.28:
                            # Specular reflection along anterior/posterior capsule wall
                            wall_factor = math.exp(-((norm_d2 - 1.08) ** 2) / 0.012)
                            val += 24.0 * les["wall_sharpness"] * wall_factor

                        # Posterior acoustic enhancement column below cyst
                        if y > cy + ry * 0.75 and abs(x - cx) < rx * 0.88:
                            dist_below = y - (cy + ry * 0.75)
                            if 0 < dist_below < 68:
                                lat_weight = math.cos((x - cx) / (rx * 0.9) * (math.pi / 2.0))
                                decay = math.exp(-dist_below / 38.0)
                                val += les["posterior_boost"] * lat_weight * decay

                    # Multiplicative + additive ultrasound speckle noise
                    u1 = rng.random() - 0.5
                    u2 = rng.random() - 0.5
                    speckle = 1.0 + speckle_sigma * (u1 + u2)
                    noisy_val = val * speckle + rng.uniform(-7.0, 7.0)
                    px = max(0, min(255, int(noisy_val)))

                    rgb_idx = (row_offset + x) * 3
                    frame_rgb[rgb_idx] = px
                    frame_rgb[rgb_idx + 1] = px
                    frame_rgb[rgb_idx + 2] = px

            proc.stdin.write(frame_rgb)
    finally:
        if proc.stdin:
            proc.stdin.close()
        if proc.stderr:
            proc.stderr.close()
        proc.wait()

    with open(gt_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "sample_id": spec["id"],
                "filename": spec["filename"],
                "anatomy": spec["anatomy"],
                "width": w,
                "height": h,
                "fps": fps,
                "num_frames": num_frames,
                "frames": gt_frames,
            },
            f,
            indent=2,
        )
