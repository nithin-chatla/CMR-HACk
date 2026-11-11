"""UI Results View Formatter for ScanSure AI."""
from typing import Any, Dict


def summarize_job_for_ui(report_data: Dict[str, Any], export_manifest: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "job_id": report_data.get("job_id"),
        "generated_at_utc": report_data.get("generated_at_utc"),
        "medical_disclaimer": report_data.get("medical_disclaimer"),
        "input_video": report_data.get("input_video"),
        "audio_stream_report": report_data.get("audio_stream_report"),
        "processing_configuration": report_data.get("processing_configuration"),
        "processing_duration_sec": report_data.get("processing_duration_sec"),
        "model_metadata": report_data.get("model_metadata"),
        "detection_summary": report_data.get("detection_summary"),
        "enhancement_evaluation": report_data.get("enhancement_evaluation"),
        "video_integrity_verification": report_data.get("video_integrity_verification"),
        "exports": export_manifest,
        "detections": report_data.get("detections", []),
        "frame_by_frame_timeline": report_data.get("frame_by_frame_timeline", []),
    }
