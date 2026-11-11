"""
Video Reconstruction Integrity & Synchronization Validator for ScanSure AI.
Verifies that enhanced_video.mp4, annotated_video.mp4, and comparison_video.mp4
match the decoded input video's exact frame count, FPS, duration, and resolution.
"""
from typing import Any, Dict
from processing.video_reader import VideoReader


def verify_video_integrity(
    input_meta: Dict[str, Any],
    enhanced_path: str,
    annotated_path: str,
    comparison_path: str,
) -> Dict[str, Any]:
    """
    Probes all three generated output videos using ffprobe and verifies exact frame count,
    FPS, duration, and expected resolution against the input ultrasound video.
    """
    enh_meta = VideoReader(enhanced_path).validate_and_probe()
    ann_meta = VideoReader(annotated_path).validate_and_probe()
    cmp_meta = VideoReader(comparison_path).validate_and_probe()

    in_frames = input_meta["frame_count"]
    in_fps = input_meta["fps"]
    in_w = input_meta["width"]
    in_h = input_meta["height"]

    frame_count_match = (
        enh_meta["frame_count"] == in_frames
        and ann_meta["frame_count"] == in_frames
        and cmp_meta["frame_count"] == in_frames
    )
    fps_match = (
        abs(enh_meta["fps"] - in_fps) < 0.05
        and abs(ann_meta["fps"] - in_fps) < 0.05
        and abs(cmp_meta["fps"] - in_fps) < 0.05
    )
    resolution_match = (
        enh_meta["width"] == in_w
        and enh_meta["height"] == in_h
        and ann_meta["width"] == in_w
        and ann_meta["height"] == in_h
        and cmp_meta["width"] == in_w * 2
        and cmp_meta["height"] == in_h
    )

    all_passed = frame_count_match and fps_match and resolution_match

    discrepancies = []
    if not frame_count_match:
        discrepancies.append(
            f"Frame count mismatch: input={in_frames}, enhanced={enh_meta['frame_count']}, "
            f"annotated={ann_meta['frame_count']}, comparison={cmp_meta['frame_count']}"
        )
    if not fps_match:
        discrepancies.append(
            f"FPS difference reported by codec: input={in_fps}, enhanced={enh_meta['fps']}"
        )
    if not resolution_match:
        discrepancies.append(
            f"Resolution difference: input={in_w}x{in_h}, enhanced={enh_meta['resolution']}, "
            f"comparison={cmp_meta['resolution']}"
        )

    return {
        "integrity_verified": all_passed,
        "frame_count_exact_match": frame_count_match,
        "fps_exact_match": fps_match,
        "resolution_exact_match": resolution_match,
        "synchronized_comparison_verified": cmp_meta["frame_count"] == in_frames,
        "input_summary": {
            "frame_count": in_frames,
            "fps": in_fps,
            "duration_sec": input_meta["duration_sec"],
            "resolution": input_meta["resolution"],
        },
        "outputs": {
            "enhanced_video": {
                "filename": enh_meta["filename"],
                "frame_count": enh_meta["frame_count"],
                "fps": enh_meta["fps"],
                "duration_sec": enh_meta["duration_sec"],
                "resolution": enh_meta["resolution"],
                "file_size_mb": enh_meta["file_size_mb"],
            },
            "annotated_video": {
                "filename": ann_meta["filename"],
                "frame_count": ann_meta["frame_count"],
                "fps": ann_meta["fps"],
                "duration_sec": ann_meta["duration_sec"],
                "resolution": ann_meta["resolution"],
                "file_size_mb": ann_meta["file_size_mb"],
            },
            "comparison_video": {
                "filename": cmp_meta["filename"],
                "frame_count": cmp_meta["frame_count"],
                "fps": cmp_meta["fps"],
                "duration_sec": cmp_meta["duration_sec"],
                "resolution": cmp_meta["resolution"],
                "file_size_mb": cmp_meta["file_size_mb"],
            },
        },
        "discrepancy_notes": discrepancies,
    }
