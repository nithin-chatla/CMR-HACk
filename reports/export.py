"""
Export Manifest Builder for ScanSure AI.
Organizes all generated video files, JSON/CSV reports, and annotated PNG frames
for local download and archival.
"""
import os
from typing import Any, Dict, List


def package_export_manifest(
    job_id: str,
    output_dir: str,
    video_outputs: Dict[str, Any],
    report_paths: Dict[str, str],
    keyframes: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Builds relative and absolute URLs/paths for all generated job artifacts."""
    base_url = f"/api/outputs/{job_id}"
    return {
        "job_id": job_id,
        "output_directory": os.path.abspath(output_dir),
        "videos": {
            "enhanced_video": {
                "filename": "enhanced_video.mp4",
                "url": f"{base_url}/enhanced_video.mp4",
                "path": video_outputs["enhanced_video"],
            },
            "annotated_video": {
                "filename": "annotated_video.mp4",
                "url": f"{base_url}/annotated_video.mp4",
                "path": video_outputs["annotated_video"],
            },
            "comparison_video": {
                "filename": "comparison_video.mp4",
                "url": f"{base_url}/comparison_video.mp4",
                "path": video_outputs["comparison_video"],
            },
        },
        "reports": {
            "json": {
                "filename": "detection_report.json",
                "url": f"{base_url}/detection_report.json",
                "path": report_paths["json_report_path"],
            },
            "csv": {
                "filename": "detection_report.csv",
                "url": f"{base_url}/detection_report.csv",
                "path": report_paths["csv_report_path"],
            },
        },
        "annotated_png_frames": [
            {
                "frame_number": kf["frame_number"],
                "timestamp_sec": kf["timestamp_sec"],
                "label": kf["label"],
                "filename": kf["filename"],
                "url": f"{base_url}/frames/{kf['filename']}",
                "comparison_filename": kf.get("comparison_filename", ""),
                "comparison_url": (
                    f"{base_url}/frames/{kf['comparison_filename']}"
                    if kf.get("comparison_filename")
                    else ""
                ),
            }
            for kf in keyframes
        ],
    }
