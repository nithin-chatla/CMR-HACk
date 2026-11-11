"""
ScanSure AI — Main Pipeline Orchestrator & CLI Application Entrypoint.
Offline Ultrasound Video Enhancement & Anomaly Detection for Rural Healthcare.
"""
import argparse
import json
import os
import sys
import time
from typing import Any, Callable, Dict, List, Optional

from evaluation.detection_metrics import run_independent_benchmark_suite
from evaluation.enhancement_metrics import compute_enhancement_metrics, compute_psnr_and_ssim
from evaluation.video_validation import verify_video_integrity
from hardware.hardware_detector import inspect_system_hardware
from models.model_loader import load_ultrasound_model
from processing.anomaly_detection import AnomalyDetector
from processing.enhancement import UltrasoundEnhancer, assess_frame_quality, compute_integral_images
from processing.frame_extractor import FrameExtractor, generate_clinical_sample_videos, save_rgb_png
from processing.segmentation import render_annotated_frame
from processing.temporal_processing import MotionAwareTemporalFilter
from processing.video_reader import VideoReader
from processing.video_writer import MultiStreamVideoWriter, build_side_by_side_frame
from reports.export import package_export_manifest
from reports.report_generator import generate_detection_reports
from ui.results_view import summarize_job_for_ui


def run_ultrasound_pipeline(
    video_path: str,
    output_dir: str,
    job_id: str = "job_default",
    enhancement_method: str = "speckle_bilateral_clahe",
    enhancement_strength: float = 0.75,
    clahe_clip_limit: float = 2.2,
    gamma: float = 1.05,
    temporal_alpha: float = 0.28,
    ai_detection_enabled: bool = True,
    detection_threshold: float = 0.55,
    temporal_smoothing: bool = True,
    output_resolution: str = "original",
    device: str = "auto",
    progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> Dict[str, Any]:
    """
    Executes the full 8-stage ScanSure AI offline ultrasound video pipeline:
    1. Video Validation
    2. Frame Extraction
    3. Image Quality Assessment
    4. Ultrasound Image Enhancement
    5. AI Anomaly Detection
    6. Segmentation / Region Highlighting
    7. Confidence and Quality Validation
    8. Video Reconstruction (enhanced_video.mp4, annotated_video.mp4, comparison_video.mp4)
       + Supporting Files (detection_report.json, detection_report.csv, annotated PNG keyframes)
    """
    t0 = time.time()
    os.makedirs(output_dir, exist_ok=True)
    frames_out_dir = os.path.join(output_dir, "frames")
    os.makedirs(frames_out_dir, exist_ok=True)

    def emit_progress(stage: str, pct: float, frame_idx: int, total_f: int) -> None:
        elapsed = max(0.01, time.time() - t0)
        eta = ((elapsed / max(1, frame_idx)) * (total_f - frame_idx)) if frame_idx > 0 else 0.0
        state = {
            "job_id": job_id,
            "status": "processing",
            "stage": stage,
            "progress_pct": round(pct, 1),
            "frames_processed": frame_idx,
            "total_frames": total_f,
            "elapsed_sec": round(elapsed, 2),
            "eta_sec": round(max(0.0, eta), 2),
        }
        status_path = os.path.join(output_dir, "progress.json")
        try:
            with open(status_path, "w", encoding="utf-8") as sf:
                json.dump(state, sf)
        except OSError:
            pass
        if progress_callback:
            progress_callback(state)

    # Stage 1: Video Validation
    reader = VideoReader(video_path)
    input_meta = reader.validate_and_probe()
    total_frames = max(1, input_meta["frame_count"])
    emit_progress("01. Video Validation & Stream Probe", 5.0, 0, total_frames)

    # Determine output resolution
    target_w = input_meta["width"]
    target_h = input_meta["height"]
    if output_resolution and output_resolution != "original" and "x" in output_resolution:
        try:
            parts = output_resolution.lower().split("x")
            target_w = int(parts[0])
            target_h = int(parts[1])
        except ValueError:
            target_w = input_meta["width"]
            target_h = input_meta["height"]

    # Resolve hardware device
    hw = inspect_system_hardware()
    resolved_device = (
        hw["recommended_config"]["processing_device"]
        if device == "auto"
        else device.lower()
    )
    if resolved_device == "gpu" and not hw["gpu"]["cuda_available"]:
        resolved_device = "cpu"

    # Load model & initialize pipeline stages
    model, model_card = load_ultrasound_model(device=resolved_device)
    enhancer = UltrasoundEnhancer(
        method=enhancement_method,
        strength=enhancement_strength,
        clahe_clip_limit=clahe_clip_limit,
        gamma=gamma,
    )
    temporal_filter = MotionAwareTemporalFilter(alpha=temporal_alpha)
    detector = AnomalyDetector(
        model=model,
        enabled=ai_detection_enabled,
        threshold=detection_threshold,
        temporal_smoothing=temporal_smoothing,
    )

    extractor = FrameExtractor(video_path, input_meta["width"], input_meta["height"])
    writer = MultiStreamVideoWriter(
        output_dir=output_dir,
        width=target_w,
        height=target_h,
        fps_rational=input_meta["fps_rational"],
        source_video_path=video_path,
        has_audio=input_meta["has_audio"],
    )
    writer.open()

    frame_records: List[Dict[str, Any]] = []
    per_frame_quality: List[Dict[str, float]] = []
    saved_keyframes: List[Dict[str, Any]] = []

    fps_val = input_meta["fps"] if input_meta["fps"] > 0 else 15.0
    keyframe_candidates: List[Dict[str, Any]] = []

    # Process video frame by frame
    for idx, orig_gray in extractor.iter_grayscale_frames(target_w, target_h):
        ts_sec = round(idx / float(fps_val), 4)

        # Stage 3: Input Quality Assessment
        sat_in, sat2_in = compute_integral_images(orig_gray, target_w, target_h)
        q_in = assess_frame_quality(orig_gray, sat_in, sat2_in, target_w, target_h)

        # Stage 4: Ultrasound Image Enhancement + Motion-Aware Temporal Stabilization
        enh_raw, _, _ = enhancer.enhance_frame(orig_gray, target_w, target_h)
        enh_gray = temporal_filter.process_frame(enh_raw)
        sat_enh, sat2_enh = compute_integral_images(enh_gray, target_w, target_h)
        q_enh = assess_frame_quality(enh_gray, sat_enh, sat2_enh, target_w, target_h)

        pair_metrics = compute_psnr_and_ssim(orig_gray, enh_gray, target_w, target_h)
        pair_metrics["enl_input"] = q_in["enl_speckle_index"]
        pair_metrics["enl_enhanced"] = q_enh["enl_speckle_index"]
        per_frame_quality.append(pair_metrics)

        # Stage 5 & 6: AI Anomaly Detection & Segmentation Highlighting
        detections = detector.detect_frame(
            frame_index=idx,
            timestamp_sec=ts_sec,
            enhanced_gray=enh_gray,
            sat=sat_enh,
            sat2=sat2_enh,
            width=target_w,
            height=target_h,
        )

        annotated_rgb = render_annotated_frame(
            enhanced_gray=enh_gray,
            width=target_w,
            height=target_h,
            frame_index=idx,
            timestamp_sec=ts_sec,
            detections=detections,
            threshold=detector.threshold,
        )

        # Stage 8: Stream frames to enhanced_video.mp4, annotated_video.mp4, comparison_video.mp4
        writer.write_triplet(
            orig_gray=orig_gray,
            enhanced_gray=enh_gray,
            annotated_rgb=annotated_rgb,
            frame_index=idx,
            timestamp_sec=ts_sec,
        )

        serialized_dets = [AnomalyDetector.serialize_for_report(d) for d in detections]
        max_conf = max((d["raw_confidence"] for d in serialized_dets), default=0.0)

        frame_records.append(
            {
                "frame_number": idx,
                "timestamp_sec": ts_sec,
                "quality": {
                    "psnr_db": pair_metrics["psnr_db"],
                    "ssim": pair_metrics["ssim"],
                    "enl_input": q_in["enl_speckle_index"],
                    "enl_enhanced": q_enh["enl_speckle_index"],
                },
                "detection_count": len(serialized_dets),
                "max_confidence": max_conf,
                "detections": serialized_dets,
            }
        )

        # Retain up to 4 representative keyframes (first frame, midpoint, peak finding frames)
        if idx in (0, total_frames // 3, (2 * total_frames) // 3, total_frames - 1) or (
            serialized_dets and len(keyframe_candidates) < 6 and idx % 7 == 0
        ):
            comp_rgb = build_side_by_side_frame(
                orig_gray, annotated_rgb, target_w, target_h, idx, ts_sec
            )
            keyframe_candidates.append(
                {
                    "frame_number": idx,
                    "timestamp_sec": ts_sec,
                    "max_confidence": max_conf,
                    "detection_count": len(serialized_dets),
                    "annotated_rgb": bytes(annotated_rgb),
                    "comparison_rgb": bytes(comp_rgb),
                }
            )

        if idx % 3 == 0 or idx == total_frames - 1:
            pct = 10.0 + 78.0 * ((idx + 1) / float(total_frames))
            stage_lbl = (
                "04. Speckle Denoising & CLAHE"
                if idx < total_frames // 2
                else "05. U-Net Anomaly Segmentation & Tracking"
            )
            emit_progress(stage_lbl, pct, idx + 1, total_frames)

    emit_progress(
        "08. Multi-Stream MP4 Reconstruction & Integrity Check",
        92.0,
        len(frame_records),
        total_frames,
    )
    video_outputs = writer.close()

    # Select top 4 keyframes to export as PNGs
    keyframe_candidates.sort(
        key=lambda k: (1 if k["frame_number"] == 0 else 0, k["max_confidence"]),
        reverse=True,
    )
    selected_kf = sorted(keyframe_candidates[:4], key=lambda k: k["frame_number"])
    for kf in selected_kf:
        f_num = kf["frame_number"]
        ann_fname = f"frame_{f_num:04d}_annotated.png"
        cmp_fname = f"frame_{f_num:04d}_comparison.png"
        ann_fpath = os.path.join(frames_out_dir, ann_fname)
        cmp_fpath = os.path.join(frames_out_dir, cmp_fname)
        save_rgb_png(ann_fpath, kf["annotated_rgb"], target_w, target_h)
        save_rgb_png(cmp_fpath, kf["comparison_rgb"], target_w * 2, target_h)
        lbl = (
            f"Frame #{f_num} ({kf['timestamp_sec']:.2f}s) — Peak Score {kf['max_confidence']:.2f}"
            if kf["detection_count"] > 0
            else f"Frame #{f_num} ({kf['timestamp_sec']:.2f}s) — Baseline Enhanced"
        )
        saved_keyframes.append(
            {
                "frame_number": f_num,
                "timestamp_sec": kf["timestamp_sec"],
                "label": lbl,
                "filename": ann_fname,
                "comparison_filename": cmp_fname,
                "detection_count": kf["detection_count"],
                "max_confidence": kf["max_confidence"],
            }
        )

    # Verify video integrity
    expected_in_meta = dict(input_meta)
    expected_in_meta["width"] = target_w
    expected_in_meta["height"] = target_h
    expected_in_meta["resolution"] = f"{target_w}x{target_h}"
    expected_in_meta["frame_count"] = len(frame_records)

    video_integrity = verify_video_integrity(
        input_meta=expected_in_meta,
        enhanced_path=video_outputs["enhanced_video"],
        annotated_path=video_outputs["annotated_video"],
        comparison_path=video_outputs["comparison_video"],
    )

    enhancement_summary = compute_enhancement_metrics(
        per_frame_quality, temporal_filter.get_mean_flicker_index()
    )

    processing_config = {
        "enhancement_method": enhancement_method,
        "enhancement_strength": enhancement_strength,
        "clahe_clip_limit": clahe_clip_limit,
        "gamma": gamma,
        "temporal_alpha": temporal_alpha,
        "ai_detection_enabled": ai_detection_enabled,
        "detection_threshold": detection_threshold,
        "temporal_smoothing": temporal_smoothing,
        "output_resolution": f"{target_w}x{target_h}",
        "requested_device": device,
        "executed_device": resolved_device,
    }

    total_elapsed = time.time() - t0
    report_paths = generate_detection_reports(
        output_dir=output_dir,
        job_id=job_id,
        input_metadata=input_meta,
        processing_config=processing_config,
        model_card=model_card,
        frame_records=frame_records,
        enhancement_summary=enhancement_summary,
        video_integrity=video_integrity,
        audio_status=video_outputs["audio_preservation_report"],
        saved_keyframes=saved_keyframes,
        processing_time_sec=total_elapsed,
    )

    export_manifest = package_export_manifest(
        job_id=job_id,
        output_dir=output_dir,
        video_outputs=video_outputs,
        report_paths=report_paths,
        keyframes=saved_keyframes,
    )

    with open(report_paths["json_report_path"], "r", encoding="utf-8") as rf:
        full_report = json.load(rf)

    emit_progress("Completed", 100.0, len(frame_records), total_frames)
    final_state = summarize_job_for_ui(full_report, export_manifest)
    final_state["status"] = "completed"

    status_path = os.path.join(output_dir, "progress.json")
    with open(status_path, "w", encoding="utf-8") as sf:
        json.dump(
            {
                "job_id": job_id,
                "status": "completed",
                "stage": "Completed",
                "progress_pct": 100.0,
                "frames_processed": len(frame_records),
                "total_frames": total_frames,
                "elapsed_sec": round(total_elapsed, 2),
                "eta_sec": 0.0,
            },
            sf,
        )

    return final_state


def main() -> None:
    parser = argparse.ArgumentParser(
        description="ScanSure AI — Offline Ultrasound Video Enhancement & Anomaly Detection CLI"
    )
    parser.add_argument("--inspect-hardware", action="store_true", help="Output system hardware profile JSON")
    parser.add_argument("--generate-samples", type=str, help="Generate sample B-mode ultrasound videos in directory")
    parser.add_argument("--probe", type=str, help="Validate and probe an input ultrasound video file")
    parser.add_argument("--benchmark", type=str, help="Run independent evaluation benchmark on samples directory")
    parser.add_argument("--process", type=str, help="Path to input ultrasound video to process")
    parser.add_argument("--output-dir", type=str, default="./outputs/default_job", help="Directory for generated outputs")
    parser.add_argument("--job-id", type=str, default="job_cli", help="Job identifier")
    parser.add_argument("--method", type=str, default="speckle_bilateral_clahe", help="Enhancement method")
    parser.add_argument("--strength", type=float, default=0.75, help="Enhancement strength (0.0 - 1.0)")
    parser.add_argument("--clahe-clip", type=float, default=2.2, help="CLAHE clip limit")
    parser.add_argument("--gamma", type=float, default=1.05, help="Gamma correction")
    parser.add_argument("--temporal-alpha", type=float, default=0.28, help="Temporal stabilization weight")
    parser.add_argument("--ai-enabled", type=str, default="true", help="Enable AI detection (true/false)")
    parser.add_argument("--threshold", type=float, default=0.55, help="Validated detection threshold")
    parser.add_argument("--temporal-smoothing", type=str, default="true", help="Enable temporal detection tracking")
    parser.add_argument("--resolution", type=str, default="original", help="Output resolution (original or WxH)")
    parser.add_argument("--device", type=str, default="auto", help="Processing device (auto/cpu/gpu)")

    args = parser.parse_args()

    if args.inspect_hardware:
        print(json.dumps(inspect_system_hardware(), indent=2))
        return

    if args.generate_samples:
        samples = generate_clinical_sample_videos(args.generate_samples)
        print(json.dumps(samples, indent=2))
        return

    if args.probe:
        reader = VideoReader(args.probe)
        print(json.dumps(reader.validate_and_probe(), indent=2))
        return

    if args.benchmark:
        bench = run_independent_benchmark_suite(args.benchmark)
        print(json.dumps(bench, indent=2))
        return

    if args.process:
        res = run_ultrasound_pipeline(
            video_path=args.process,
            output_dir=args.output_dir,
            job_id=args.job_id,
            enhancement_method=args.method,
            enhancement_strength=args.strength,
            clahe_clip_limit=args.clahe_clip,
            gamma=args.gamma,
            temporal_alpha=args.temporal_alpha,
            ai_detection_enabled=(args.ai_enabled.lower() == "true"),
            detection_threshold=args.threshold,
            temporal_smoothing=(args.temporal_smoothing.lower() == "true"),
            output_resolution=args.resolution,
            device=args.device,
        )
        print(json.dumps(res, indent=2))
        return

    parser.print_help()
    sys.exit(0)


if __name__ == "__main__":
    main()
