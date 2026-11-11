"""
Segmentation Post-Processing, Connected Components Extraction, and Clinical HUD
Annotation Renderer for ScanSure AI.
Extracts pixel-level contours, bounding boxes, and morphological descriptors from
the probability map, and renders readable annotations onto RGB24 video frames.
"""
import math
from typing import Any, Dict, List, Tuple

# Compact 5x7 bitmap font for rendering readable clinical HUD labels onto RGB24 frames
FONT_5X7: Dict[str, List[int]] = {
    " ": [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    "0": [0x0E, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0E],
    "1": [0x04, 0x0C, 0x04, 0x04, 0x04, 0x04, 0x0E],
    "2": [0x0E, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1F],
    "3": [0x1F, 0x02, 0x04, 0x06, 0x01, 0x11, 0x0E],
    "4": [0x02, 0x06, 0x0A, 0x12, 0x1F, 0x02, 0x02],
    "5": [0x1F, 0x10, 0x1E, 0x01, 0x01, 0x11, 0x0E],
    "6": [0x06, 0x08, 0x10, 0x1E, 0x11, 0x11, 0x0E],
    "7": [0x1F, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
    "8": [0x0E, 0x11, 0x11, 0x0E, 0x11, 0x11, 0x0E],
    "9": [0x0E, 0x11, 0x11, 0x0F, 0x01, 0x02, 0x0C],
    "A": [0x0E, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
    "B": [0x1E, 0x11, 0x11, 0x1E, 0x11, 0x11, 0x1E],
    "C": [0x0E, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0E],
    "D": [0x1C, 0x12, 0x11, 0x11, 0x11, 0x12, 0x1C],
    "E": [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x1F],
    "F": [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x10],
    "G": [0x0E, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0F],
    "H": [0x11, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
    "I": [0x0E, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0E],
    "J": [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0C],
    "K": [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
    "L": [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1F],
    "M": [0x11, 0x1B, 0x15, 0x15, 0x11, 0x11, 0x11],
    "N": [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
    "O": [0x0E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E],
    "P": [0x1E, 0x11, 0x11, 0x1E, 0x10, 0x10, 0x10],
    "Q": [0x0E, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0D],
    "R": [0x1E, 0x11, 0x11, 0x1E, 0x14, 0x12, 0x11],
    "S": [0x0F, 0x10, 0x10, 0x0E, 0x01, 0x01, 0x1E],
    "T": [0x1F, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
    "U": [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E],
    "V": [0x11, 0x11, 0x11, 0x11, 0x11, 0x0A, 0x04],
    "W": [0x11, 0x11, 0x11, 0x15, 0x15, 0x1B, 0x11],
    "X": [0x11, 0x11, 0x0A, 0x04, 0x0A, 0x11, 0x11],
    "Y": [0x11, 0x11, 0x0A, 0x04, 0x04, 0x04, 0x04],
    "Z": [0x1F, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1F],
    ":": [0x00, 0x04, 0x04, 0x00, 0x04, 0x04, 0x00],
    ".": [0x00, 0x00, 0x00, 0x00, 0x00, 0x06, 0x06],
    "-": [0x00, 0x00, 0x00, 0x1F, 0x00, 0x00, 0x00],
    "/": [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
    "%": [0x19, 0x19, 0x02, 0x04, 0x08, 0x13, 0x13],
    "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
    ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
    "#": [0x0A, 0x1F, 0x0A, 0x0A, 0x1F, 0x0A, 0x00],
    "+": [0x00, 0x04, 0x04, 0x1F, 0x04, 0x04, 0x00],
}


def draw_rect_alpha(
    rgb: bytearray,
    width: int,
    height: int,
    x0: int,
    y0: int,
    x1: int,
    y1: int,
    color: Tuple[int, int, int],
    alpha: float = 0.65,
) -> None:
    """Blends a filled rectangle onto an RGB24 frame buffer."""
    x0 = max(0, min(width, x0))
    x1 = max(0, min(width, x1))
    y0 = max(0, min(height, y0))
    y1 = max(0, min(height, y1))
    r, g, b = color
    inv_a = 1.0 - alpha
    for y in range(y0, y1):
        row_off = y * width * 3
        for x in range(x0, x1):
            idx = row_off + x * 3
            rgb[idx] = int(inv_a * rgb[idx] + alpha * r)
            rgb[idx + 1] = int(inv_a * rgb[idx + 1] + alpha * g)
            rgb[idx + 2] = int(inv_a * rgb[idx + 2] + alpha * b)


def draw_text_5x7(
    rgb: bytearray,
    width: int,
    height: int,
    x: int,
    y: int,
    text: str,
    color: Tuple[int, int, int] = (240, 248, 255),
    bg_color: Tuple[int, int, int] | None = (8, 12, 20),
    bg_alpha: float = 0.78,
) -> None:
    """Draws crisp 5x7 bitmap text onto an RGB24 frame buffer."""
    upper_text = text.upper()
    if bg_color is not None:
        box_w = len(upper_text) * 6 + 6
        box_h = 11
        draw_rect_alpha(rgb, width, height, x - 3, y - 2, x + box_w, y + box_h, bg_color, bg_alpha)

    r, g, b = color
    cursor_x = x
    for ch in upper_text:
        glyph = FONT_5X7.get(ch, FONT_5X7[" "])
        for gy in range(7):
            py = y + gy
            if py < 0 or py >= height:
                continue
            row_bits = glyph[gy]
            row_off = py * width * 3
            for gx in range(5):
                if (row_bits >> (4 - gx)) & 1:
                    px = cursor_x + gx
                    if 0 <= px < width:
                        idx = row_off + px * 3
                        rgb[idx] = r
                        rgb[idx + 1] = g
                        rgb[idx + 2] = b
        cursor_x += 6


def extract_connected_regions(
    prob_map: List[float],
    enhanced_gray: bytearray,
    width: int,
    height: int,
    threshold: float = 0.55,
    uncertain_upper: float = 0.72,
    min_area: int = 80,
    max_area_ratio: float = 0.30,
) -> List[Dict[str, Any]]:
    """
    Extracts connected components above the validated segmentation threshold,
    computes morphological contour coordinates, bounding boxes, and raw confidence scores.
    """
    visited = bytearray(width * height)
    max_area = int(width * height * max_area_ratio)
    regions: List[Dict[str, Any]] = []

    for y in range(16, height - 16):
        row_off = y * width
        for x in range(16, width - 16):
            idx = row_off + x
            if visited[idx] or prob_map[idx] < threshold:
                continue

            # Flood-fill connected component
            queue = [idx]
            visited[idx] = 1
            comp_indices: List[int] = []
            min_x, max_x = x, x
            min_y, max_y = y, y
            prob_sum = 0.0
            prob_max = 0.0
            gray_sum = 0

            head = 0
            while head < len(queue):
                curr = queue[head]
                head += 1
                comp_indices.append(curr)
                cy, cx = divmod(curr, width)
                if cx < min_x:
                    min_x = cx
                if cx > max_x:
                    max_x = cx
                if cy < min_y:
                    min_y = cy
                if cy > max_y:
                    max_y = cy

                p = prob_map[curr]
                prob_sum += p
                if p > prob_max:
                    prob_max = p
                gray_sum += enhanced_gray[curr]

                # 4-connectivity neighbors
                for n_idx in (curr - 1, curr + 1, curr - width, curr + width):
                    if 0 <= n_idx < width * height and not visited[n_idx]:
                        if prob_map[n_idx] >= threshold * 0.90:
                            visited[n_idx] = 1
                            queue.append(n_idx)

            area = len(comp_indices)
            if area < min_area or area > max_area:
                continue

            bw = max_x - min_x + 1
            bh = max_y - min_y + 1
            if bw < 10 or bh < 8:
                continue

            aspect_ratio = bw / float(max(1, bh))
            if aspect_ratio > 3.6 or aspect_ratio < 0.28:
                # Filter out horizontal tissue fascia streaks
                continue

            box_area = bw * bh
            solidity = area / float(max(1, box_area))
            if solidity < 0.38:
                continue

            mean_prob = prob_sum / float(area)
            raw_conf = round(0.55 * prob_max + 0.45 * mean_prob, 4)
            if raw_conf < threshold:
                continue

            # Extract sparse contour coordinates for JSON report & mask rendering
            comp_set = set(comp_indices)
            contour_pts: List[List[int]] = []
            for c_idx in comp_indices:
                cy, cx = divmod(c_idx, width)
                if (
                    (c_idx - 1 not in comp_set)
                    or (c_idx + 1 not in comp_set)
                    or (c_idx - width not in comp_set)
                    or (c_idx + width not in comp_set)
                ):
                    contour_pts.append([cx, cy])

            is_uncertain = raw_conf < uncertain_upper
            if is_uncertain:
                category = "Uncertain — Requires Radiologist Review"
                short_label = "UNCERTAIN - RADIOLOGIST REVIEW"
            else:
                category = "Cystic / Anechoic Lesion Candidate"
                short_label = "CYST / ANECHOIC CANDIDATE"

            regions.append(
                {
                    "category": category,
                    "short_label": short_label,
                    "is_uncertain": is_uncertain,
                    "bbox": [min_x, min_y, bw, bh],
                    "centroid": [round((min_x + max_x) / 2.0, 1), round((min_y + max_y) / 2.0, 1)],
                    "area_px": area,
                    "solidity": round(solidity, 3),
                    "mean_echogenicity": round(gray_sum / float(area), 1),
                    "raw_confidence": raw_conf,
                    "validated_threshold": threshold,
                    "contour_points": contour_pts[:: max(1, len(contour_pts) // 36)],
                    "_mask_indices": comp_indices,
                    "_contour_full": contour_pts,
                }
            )

    # Sort descending by confidence
    regions.sort(key=lambda r: r["raw_confidence"], reverse=True)
    return regions[:4]


def render_annotated_frame(
    enhanced_gray: bytearray,
    width: int,
    height: int,
    frame_index: int,
    timestamp_sec: float,
    detections: List[Dict[str, Any]],
    threshold: float,
) -> bytearray:
    """
    Renders enhanced ultrasound grayscale frame into RGB24 and overlays:
    - Clinical right-margin Depth Scale Ruler (1cm - 4cm ticks)
    - Translucent segmentation mask & dual-pixel anti-aliased contour
    - Electronic caliper markers & corner-ticked bounding box
    - Category label, Raw Model Confidence, and Frame Timestamp HUD
    """
    from processing.frame_extractor import gray_to_rgb_bytes

    rgb = gray_to_rgb_bytes(enhanced_gray)

    # Top clinical telemetry bar
    draw_rect_alpha(rgb, width, height, 0, 0, width, 16, (6, 9, 16), 0.88)
    ts_text = f"FRM {frame_index:04d}  T+{timestamp_sec:05.2f}S"
    draw_text_5x7(rgb, width, height, 6, 4, ts_text, color=(148, 163, 184), bg_color=None)

    if detections:
        status_str = f"AI FINDINGS: {len(detections)} (THR {threshold:.2f})"
        status_col = (6, 182, 212)
    else:
        status_str = f"CLEAN SCAN (THR {threshold:.2f})"
        status_col = (100, 116, 139)
    draw_text_5x7(
        rgb,
        width,
        height,
        max(135, width - len(status_str) * 6 - 6),
        4,
        status_str,
        color=status_col,
        bg_color=None,
    )

    # Clinical Depth Calibration Scale Ruler along right edge (every 10px = 2mm, 50px = 1cm)
    ruler_x = width - 4
    for y in range(22, height - 8, 10):
        is_cm = ((y - 22) % 50) == 0
        tick_len = 6 if is_cm else 3
        col_r = (148, 163, 184) if is_cm else (71, 85, 105)
        for tx in range(ruler_x - tick_len, ruler_x):
            if 0 <= tx < width:
                idx = (y * width + tx) * 3
                rgb[idx], rgb[idx + 1], rgb[idx + 2] = col_r
        if is_cm and (y - 22) > 0:
            cm_num = (y - 22) // 50
            draw_text_5x7(
                rgb,
                width,
                height,
                ruler_x - 24,
                y - 3,
                f"{cm_num}CM",
                color=(100, 116, 139),
                bg_color=None,
            )

    for det in detections:
        is_uncertain = det.get("is_uncertain", False)
        primary_col = (245, 158, 11) if is_uncertain else (6, 182, 212)
        glow_col = (180, 110, 8) if is_uncertain else (8, 125, 155)
        bx, by, bw, bh = det["bbox"]

        # 1. Soft segmentation interior tint (18% opacity so internal acoustic texture stays visible)
        mask_indices = det.get("_mask_indices", [])
        mr, mg, mb = primary_col
        for m_idx in mask_indices:
            p_off = m_idx * 3
            if 0 <= p_off < len(rgb) - 2:
                rgb[p_off] = int(0.82 * rgb[p_off] + 0.18 * mr)
                rgb[p_off + 1] = int(0.82 * rgb[p_off + 1] + 0.18 * mg)
                rgb[p_off + 2] = int(0.82 * rgb[p_off + 2] + 0.18 * mb)

        # 2. Dual-pixel anti-aliased segmentation contour
        gr, gg, gb = glow_col
        for cx, cy in det.get("_contour_full", []):
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < width and 0 <= ny < height:
                    g_off = (ny * width + nx) * 3
                    rgb[g_off] = int(0.45 * rgb[g_off] + 0.55 * gr)
                    rgb[g_off + 1] = int(0.45 * rgb[g_off + 1] + 0.55 * gg)
                    rgb[g_off + 2] = int(0.45 * rgb[g_off + 2] + 0.55 * gb)
        for cx, cy in det.get("_contour_full", []):
            if 0 <= cx < width and 0 <= cy < height:
                c_off = (cy * width + cx) * 3
                rgb[c_off] = mr
                rgb[c_off + 1] = mg
                rgb[c_off + 2] = mb

        # 3. Corner-ticked bounding box (2px thick corners)
        x0 = max(2, bx - 4)
        y0 = max(18, by - 4)
        x1 = min(width - 10, bx + bw + 4)
        y1 = min(height - 4, by + bh + 4)
        corner_len = max(6, min(11, min(bw, bh) // 3))

        for x in range(x0, x1 + 1):
            if (x - x0 <= corner_len) or (x1 - x <= corner_len):
                for ty in (y0, y0 + 1, y1 - 1, y1):
                    if 0 <= ty < height:
                        idx = (ty * width + x) * 3
                        rgb[idx], rgb[idx + 1], rgb[idx + 2] = primary_col
        for y in range(y0, y1 + 1):
            if (y - y0 <= corner_len) or (y1 - y <= corner_len):
                for tx in (x0, x0 + 1, x1 - 1, x1):
                    if 0 <= tx < width:
                        idx = (y * width + tx) * 3
                        rgb[idx], rgb[idx + 1], rgb[idx + 2] = primary_col

        # 4. Label above or below bounding box with physical caliper size (0.2mm/px scale)
        conf_val = det["raw_confidence"]
        mm_w = round(bw * 0.28, 1)
        mm_h = round(bh * 0.28, 1)
        short_lbl = "UNCERTAIN MASS" if is_uncertain else "CYST CANDIDATE"
        label_line_1 = f"{short_lbl}  {mm_w}X{mm_h}MM"
        label_line_2 = f"CONF: {conf_val * 100:.1f}% (RAW {conf_val:.2f})"

        lbl_x = max(4, min(width - max(len(label_line_1), len(label_line_2)) * 6 - 12, x0))
        lbl_y = y0 - 25 if y0 >= 44 else min(height - 27, y1 + 6)

        draw_text_5x7(
            rgb, width, height, lbl_x, lbl_y, label_line_1, color=primary_col, bg_color=(6, 9, 16)
        )
        draw_text_5x7(
            rgb,
            width,
            height,
            lbl_x,
            lbl_y + 11,
            label_line_2,
            color=(241, 245, 249),
            bg_color=(6, 9, 16),
        )

    return rgb
