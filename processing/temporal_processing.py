"""
Temporal Processing & Stabilization Module for ScanSure AI.
Implements:
1. Motion-Aware Temporal Frame Despeckling (prevents inter-frame brightness flicker
   while avoiding motion ghosting on probe movement or transient structures).
2. Temporal IoU Detection Tracking & Coordinate Stabilization (prevents bounding boxes
   from jumping randomly while preserving genuine transient findings).
"""
from typing import Any, Dict, List, Optional


def compute_bbox_iou(box_a: List[int], box_b: List[int]) -> float:
    """Computes Intersection over Union (IoU) between two [x, y, w, h] boxes."""
    ax1, ay1, aw, ah = box_a
    bx1, by1, bw, bh = box_b
    ax2, ay2 = ax1 + aw, ay1 + ah
    bx2, by2 = bx1 + bw, by1 + bh

    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)

    inter_w = max(0, inter_x2 - inter_x1)
    inter_h = max(0, inter_y2 - inter_y1)
    inter_area = inter_w * inter_h
    if inter_area <= 0:
        return 0.0

    union_area = (aw * ah) + (bw * bh) - inter_area
    return inter_area / float(union_area) if union_area > 0 else 0.0


class MotionAwareTemporalFilter:
    """
    Applies motion-gated temporal exponential moving average (EMA) across consecutive
    enhanced ultrasound frames to suppress temporal speckle boiling without ghosting.
    """

    def __init__(self, alpha: float = 0.28, motion_gate: float = 18.0) -> None:
        self.alpha = max(0.0, min(0.75, float(alpha)))
        self.motion_gate = max(4.0, float(motion_gate))
        self.prev_frame: Optional[bytearray] = None
        self.flicker_scores: List[float] = []

    def process_frame(self, current: bytearray) -> bytearray:
        if self.prev_frame is None or len(self.prev_frame) != len(current) or self.alpha <= 0.01:
            self.prev_frame = bytearray(current)
            self.flicker_scores.append(0.0)
            return bytearray(current)

        out = bytearray(len(current))
        prev = self.prev_frame
        base_alpha = self.alpha
        gate = self.motion_gate
        diff_accum = 0

        for i in range(len(current)):
            c = current[i]
            p = prev[i]
            diff = abs(c - p)
            diff_accum += diff
            if diff >= gate:
                # High motion or transient structure boundary -> trust current frame 100% (no ghosting)
                out[i] = c
            else:
                # Stationary tissue -> blend with previous stabilized frame to suppress speckle flicker
                eff_alpha = base_alpha * (1.0 - (diff / gate))
                val = int(round((1.0 - eff_alpha) * c + eff_alpha * p))
                out[i] = max(0, min(255, val))

        mean_diff = diff_accum / float(max(1, len(current)))
        self.flicker_scores.append(round(mean_diff, 3))
        self.prev_frame = bytearray(out)
        return out

    def get_mean_flicker_index(self) -> float:
        if len(self.flicker_scores) <= 1:
            return 0.0
        valid = self.flicker_scores[1:]
        return round(sum(valid) / float(len(valid)), 3)


class TemporalDetectionTracker:
    """
    Tracks detected ultrasound regions across frames using IoU matching.
    Stabilizes bounding box coordinates and confidence trajectories without
    inventing detections or erasing genuine transient structures.
    """

    def __init__(self, iou_threshold: float = 0.30, box_smooth_weight: float = 0.35) -> None:
        self.iou_threshold = iou_threshold
        self.box_smooth_weight = max(0.0, min(0.65, box_smooth_weight))
        self.active_tracks: List[Dict[str, Any]] = []
        self._next_track_id = 1

    def update(self, frame_index: int, detections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        updated_tracks: List[Dict[str, Any]] = []
        stabilized_detections: List[Dict[str, Any]] = []
        used_prev = set()

        for det in detections:
            bbox = det["bbox"]
            best_iou = 0.0
            best_idx = -1
            for idx, trk in enumerate(self.active_tracks):
                if idx in used_prev:
                    continue
                if frame_index - trk["last_frame"] > 2:
                    continue
                iou = compute_bbox_iou(bbox, trk["bbox"])
                if iou > best_iou:
                    best_iou = iou
                    best_idx = idx

            if best_idx >= 0 and best_iou >= self.iou_threshold:
                used_prev.add(best_idx)
                prev_trk = self.active_tracks[best_idx]
                w_prev = self.box_smooth_weight
                w_curr = 1.0 - w_prev
                pb = prev_trk["bbox"]
                smooth_bbox = [
                    int(round(w_curr * bbox[0] + w_prev * pb[0])),
                    int(round(w_curr * bbox[1] + w_prev * pb[1])),
                    int(round(w_curr * bbox[2] + w_prev * pb[2])),
                    int(round(w_curr * bbox[3] + w_prev * pb[3])),
                ]
                smooth_conf = round(0.75 * det["raw_confidence"] + 0.25 * prev_trk["raw_confidence"], 4)
                track_id = prev_trk["track_id"]
                persistence = prev_trk["persistence"] + 1
            else:
                smooth_bbox = list(bbox)
                smooth_conf = round(det["raw_confidence"], 4)
                track_id = self._next_track_id
                self._next_track_id += 1
                persistence = 1

            enriched = dict(det)
            enriched["bbox"] = smooth_bbox
            enriched["raw_confidence"] = smooth_conf
            enriched["track_id"] = track_id
            enriched["temporal_persistence_frames"] = persistence

            stabilized_detections.append(enriched)
            updated_tracks.append(
                {
                    "track_id": track_id,
                    "bbox": smooth_bbox,
                    "raw_confidence": smooth_conf,
                    "last_frame": frame_index,
                    "persistence": persistence,
                }
            )

        # Retain recent tracks for 1 frame occlusion tolerance
        for idx, trk in enumerate(self.active_tracks):
            if idx not in used_prev and (frame_index - trk["last_frame"]) <= 1:
                updated_tracks.append(trk)

        self.active_tracks = updated_tracks
        return stabilized_detections
