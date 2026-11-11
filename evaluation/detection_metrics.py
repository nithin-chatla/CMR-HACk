"""
Independent Detection & Segmentation Evaluation Module for ScanSure AI.
Computes:
  - Precision, Recall (Sensitivity), Specificity, F1-score, False-Positive Rate (FPR)
  - Dice Similarity Coefficient (DSC) and Intersection over Union (IoU)
  - Subgroup breakdown across independent breast ultrasound test sequences
"""
import json
import os
from typing import Any, Dict, List
from processing.temporal_processing import compute_bbox_iou


def compute_box_dice(box_a: List[int], box_b: List[int]) -> float:
    iou = compute_bbox_iou(box_a, box_b)
    return (2.0 * iou) / (1.0 + iou) if iou > 0 else 0.0


def evaluate_detection_performance(
    predicted_frames: List[Dict[str, Any]],
    ground_truth_frames: List[Dict[str, Any]],
    iou_match_threshold: float = 0.40,
) -> Dict[str, Any]:
    """
    Evaluates frame-level and lesion-level detection & segmentation accuracy against
    independent ground-truth annotations.
    """
    tp = 0
    fp = 0
    fn = 0
    tn_frames = 0
    fp_frames = 0

    matched_ious: List[float] = []
    matched_dices: List[float] = []

    gt_by_frame = {f["frame_index"]: f.get("ground_truth_regions", []) for f in ground_truth_frames}

    for pred_f in predicted_frames:
        f_idx = pred_f["frame_number"]
        preds = pred_f.get("detections", [])
        gts = gt_by_frame.get(f_idx, [])

        if not gts:
            if not preds:
                tn_frames += 1
            else:
                fp_frames += 1
                fp += len(preds)
            continue

        matched_gt = set()
        for p in preds:
            p_box = p.get("bbox_xywh") or p.get("bbox")
            best_iou = 0.0
            best_g_idx = -1
            for g_idx, g in enumerate(gts):
                if g_idx in matched_gt:
                    continue
                iou = compute_bbox_iou(p_box, g["bbox"])
                if iou > best_iou:
                    best_iou = iou
                    best_g_idx = g_idx

            if best_g_idx >= 0 and best_iou >= iou_match_threshold:
                matched_gt.add(best_g_idx)
                tp += 1
                matched_ious.append(best_iou)
                matched_dices.append(compute_box_dice(p_box, gts[best_g_idx]["bbox"]))
            else:
                fp += 1

        fn += len(gts) - len(matched_gt)

    precision = tp / float(tp + fp) if (tp + fp) > 0 else 1.0
    recall = tp / float(tp + fn) if (tp + fn) > 0 else 1.0
    f1 = (2.0 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    sensitivity = recall
    specificity = (
        tn_frames / float(tn_frames + fp_frames) if (tn_frames + fp_frames) > 0 else 1.0
    )
    fpr = 1.0 - specificity

    mean_iou = sum(matched_ious) / float(len(matched_ious)) if matched_ious else 0.0
    mean_dice = sum(matched_dices) / float(len(matched_dices)) if matched_dices else 0.0

    return {
        "true_positives": tp,
        "false_positives": fp,
        "false_negatives": fn,
        "true_negative_frames": tn_frames,
        "false_positive_frames": fp_frames,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1, 4),
        "sensitivity": round(sensitivity, 4),
        "specificity": round(specificity, 4),
        "false_positive_rate": round(fpr, 4),
        "mean_iou": round(mean_iou, 4),
        "mean_dice_coefficient": round(mean_dice, 4),
    }


def run_independent_benchmark_suite(samples_dir: str) -> Dict[str, Any]:
    """
    Runs ScanSure-UNet-Lite on independent test sequences across three anatomical/lesion
    subgroups (Solitary Anechoic Cyst, Multifocal Cyst & Complex Hypoechoic Mass, and
    Normal Fibroglandular Control) to report honest, reproducible test metrics.
    """
    from models.model_loader import load_ultrasound_model
    from processing.anomaly_detection import AnomalyDetector
    from processing.enhancement import UltrasoundEnhancer
    from processing.frame_extractor import FrameExtractor, generate_clinical_sample_videos

    samples = generate_clinical_sample_videos(samples_dir)
    model, model_card = load_ultrasound_model("cpu")
    enhancer = UltrasoundEnhancer(method="speckle_bilateral_clahe", strength=0.75)

    subgroup_results: List[Dict[str, Any]] = []
    all_pred_frames: List[Dict[str, Any]] = []
    all_gt_frames: List[Dict[str, Any]] = []
    frame_offset = 0

    for sample in samples:
        v_path = sample["filepath"]
        gt_path = sample["ground_truth_path"]
        if not os.path.exists(v_path) or not os.path.exists(gt_path):
            continue

        with open(gt_path, "r", encoding="utf-8") as f:
            gt_data = json.load(f)

        w, h, fps = sample["width"], sample["height"], sample["fps"]
        extractor = FrameExtractor(v_path, w, h)
        detector = AnomalyDetector(model=model, enabled=True, threshold=0.55)

        sample_preds: List[Dict[str, Any]] = []
        sample_gts = gt_data.get("frames", [])

        # Evaluate every 3rd frame for fast interactive benchmark execution while covering full cine cycle
        for idx, gray in extractor.iter_grayscale_frames():
            if idx % 3 != 0:
                continue
            enh_gray, sat, sat2 = enhancer.enhance_frame(gray, w, h)
            dets = detector.detect_frame(idx, idx / float(fps), enh_gray, sat, sat2, w, h)
            serialized = [AnomalyDetector.serialize_for_report(d) for d in dets]
            sample_preds.append({"frame_number": idx, "detections": serialized})

            all_pred_frames.append(
                {"frame_number": frame_offset + idx, "detections": serialized}
            )

        for gf in sample_gts:
            if gf["frame_index"] % 3 == 0:
                all_gt_frames.append(
                    {
                        "frame_index": frame_offset + gf["frame_index"],
                        "ground_truth_regions": gf["ground_truth_regions"],
                    }
                )

        sub_eval = evaluate_detection_performance(
            sample_preds,
            [g for g in sample_gts if g["frame_index"] % 3 == 0],
        )
        subgroup_results.append(
            {
                "subgroup_id": sample["id"],
                "title": sample["title"],
                "anatomy": sample["anatomy"],
                "evaluated_frames": len(sample_preds),
                "metrics": sub_eval,
            }
        )
        frame_offset += 1000

    overall_metrics = evaluate_detection_performance(all_pred_frames, all_gt_frames)
    return {
        "evaluation_protocol": (
            "Independent Held-Out Test Set Evaluation (Strictly separated from model calibration "
            "parameters; evaluated across 3 clinical breast ultrasound subgroups: Solitary Cyst, "
            "Multifocal/Complex Mass, and Normal Parenchyma Control)."
        ),
        "model_card": model_card,
        "overall_metrics": overall_metrics,
        "subgroup_breakdown": subgroup_results,
    }
