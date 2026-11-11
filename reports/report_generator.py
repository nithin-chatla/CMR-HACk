"""
Detection Report Generator (JSON & CSV) for ScanSure AI.
Generates `detection_report.json` and `detection_report.csv` containing frame-by-frame
findings, raw model confidence scores, validated thresholds, processing metadata,
and medical safety disclaimers.
"""
import csv
import datetime
import json
import os
from typing import Any, Dict, List


MEDICAL_DISCLAIMER = (
    "ScanSure AI is an experimental AI-assisted ultrasound image enhancement and analysis tool. "
    "It does not provide a medical diagnosis. All findings require review by a qualified radiologist."
)


def generate_detection_reports(
    output_dir: str,
    job_id: str,
    input_metadata: Dict[str, Any],
    processing_config: Dict[str, Any],
    model_card: Dict[str, Any],
    frame_records: List[Dict[str, Any]],
    enhancement_summary: Dict[str, Any],
    video_integrity: Dict[str, Any],
    audio_status: str,
    saved_keyframes: List[Dict[str, Any]],
    processing_time_sec: float,
) -> Dict[str, str]:
    """Writes detection_report.json and detection_report.csv to output_dir."""
    os.makedirs(output_dir, exist_ok=True)
    json_path = os.path.join(output_dir, "detection_report.json")
    csv_path = os.path.join(output_dir, "detection_report.csv")

    all_detections: List[Dict[str, Any]] = []
    frames_with_detections = 0
    uncertain_count = 0
    cystic_count = 0
    peak_confidence = 0.0
    peak_frame = 0

    for fr in frame_records:
        dets = fr.get("detections", [])
        if dets:
            frames_with_detections += 1
        for d in dets:
            all_detections.append(d)
            if d.get("is_uncertain"):
                uncertain_count += 1
            else:
                cystic_count += 1
            if d["raw_confidence"] > peak_confidence:
                peak_confidence = d["raw_confidence"]
                peak_frame = d["frame_number"]

    total_frames = len(frame_records)
    summary = {
        "total_frames_processed": total_frames,
        "frames_with_findings": frames_with_detections,
        "frames_without_findings": total_frames - frames_with_detections,
        "total_region_instances": len(all_detections),
        "cystic_candidate_instances": cystic_count,
        "uncertain_review_instances": uncertain_count,
        "peak_raw_confidence": round(peak_confidence, 4),
        "peak_confidence_frame": peak_frame,
        "validated_threshold": processing_config.get("detection_threshold", 0.55),
        "confidence_disclosure": (
            "Reported scores are raw uncalibrated segmentation model scores, NOT calibrated "
            "clinical probabilities. Findings scoring between the validated threshold and "
            "0.72 are flagged as 'Uncertain — Requires Radiologist Review'."
        ),
        "clinical_recommendation": (
            "Uncertain — Requires Radiologist Review."
            if (uncertain_count > 0 or len(all_detections) > 0)
            else "No region detected above validated threshold — Standard Radiologist Review Recommended."
        ),
    }

    report_payload = {
        "application": "ScanSure AI",
        "version": "1.2.0-offline",
        "job_id": job_id,
        "generated_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "medical_disclaimer": MEDICAL_DISCLAIMER,
        "input_video": input_metadata,
        "audio_stream_report": audio_status,
        "processing_configuration": processing_config,
        "processing_duration_sec": round(processing_time_sec, 3),
        "model_metadata": model_card,
        "detection_summary": summary,
        "enhancement_evaluation": enhancement_summary,
        "video_integrity_verification": video_integrity,
        "annotated_keyframes": saved_keyframes,
        "detections": all_detections,
        "frame_by_frame_timeline": frame_records,
    }

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report_payload, f, indent=2)

    # Write CSV report
    fieldnames = [
        "frame_number",
        "timestamp_sec",
        "track_id",
        "category",
        "is_uncertain",
        "raw_confidence",
        "validated_threshold",
        "confidence_type",
        "bbox_x",
        "bbox_y",
        "bbox_w",
        "bbox_h",
        "centroid_x",
        "centroid_y",
        "area_px",
        "solidity",
        "mean_echogenicity",
        "temporal_persistence_frames",
        "model_version",
        "clinical_review_note",
    ]
    with open(csv_path, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for d in all_detections:
            bx, by, bw, bh = d.get("bbox_xywh", [0, 0, 0, 0])
            cx, cy = d.get("centroid_xy", [0.0, 0.0])
            writer.writerow(
                {
                    "frame_number": d["frame_number"],
                    "timestamp_sec": d["timestamp_sec"],
                    "track_id": d.get("track_id", 1),
                    "category": d["category"],
                    "is_uncertain": d["is_uncertain"],
                    "raw_confidence": d["raw_confidence"],
                    "validated_threshold": d["validated_threshold"],
                    "confidence_type": d.get("confidence_type", "raw_uncalibrated_model_score"),
                    "bbox_x": bx,
                    "bbox_y": by,
                    "bbox_w": bw,
                    "bbox_h": bh,
                    "centroid_x": cx,
                    "centroid_y": cy,
                    "area_px": d["area_px"],
                    "solidity": d["solidity"],
                    "mean_echogenicity": d["mean_echogenicity"],
                    "temporal_persistence_frames": d.get("temporal_persistence_frames", 1),
                    "model_version": d["model_version"],
                    "clinical_review_note": (
                        "Uncertain — Requires Radiologist Review"
                        if d["is_uncertain"]
                        else "AI-Assisted Candidate — Requires Radiologist Confirmation"
                    ),
                }
            )

    return {
        "json_report_path": json_path,
        "csv_report_path": csv_path,
    }
