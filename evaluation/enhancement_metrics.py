"""
Ultrasound Enhancement Evaluation Module for ScanSure AI.
Computes:
  - PSNR (Peak Signal-to-Noise Ratio in dB)
  - SSIM (Structural Similarity Index in [0, 1])
  - ENL (Equivalent Number of Looks speckle suppression ratio)
  - EPI (Edge Preservation Index along anatomical gradients)
Includes explicit clinical note that higher PSNR/SSIM between noisy input and
enhanced output reflects structural fidelity rather than autonomous clinical utility.
"""
import math
from typing import Dict, List


def compute_psnr_and_ssim(
    orig: bytearray, enhanced: bytearray, width: int, height: int
) -> Dict[str, float]:
    """Computes PSNR, global SSIM, and Edge Preservation Index (EPI) between two frames."""
    n = len(orig)
    if n == 0 or len(enhanced) != n:
        return {"psnr_db": 0.0, "ssim": 0.0, "epi": 0.0}

    mse_sum = 0.0
    sum_x = 0.0
    sum_y = 0.0
    for i in range(n):
        x = orig[i]
        y = enhanced[i]
        d = x - y
        mse_sum += d * d
        sum_x += x
        sum_y += y

    mse = mse_sum / float(n)
    psnr = 48.0 if mse <= 1e-5 else 10.0 * math.log10((255.0 * 255.0) / mse)

    mu_x = sum_x / float(n)
    mu_y = sum_y / float(n)

    var_x = 0.0
    var_y = 0.0
    cov_xy = 0.0
    for i in range(0, n, 2):
        dx = orig[i] - mu_x
        dy = enhanced[i] - mu_y
        var_x += dx * dx
        var_y += dy * dy
        cov_xy += dx * dy

    m_cnt = max(1, n // 2)
    var_x /= float(m_cnt)
    var_y /= float(m_cnt)
    cov_xy /= float(m_cnt)

    c1 = (0.01 * 255.0) ** 2
    c2 = (0.03 * 255.0) ** 2
    ssim_num = (2.0 * mu_x * mu_y + c1) * (2.0 * cov_xy + c2)
    ssim_den = (mu_x * mu_x + mu_y * mu_y + c1) * (var_x + var_y + c2)
    ssim = ssim_num / ssim_den if ssim_den > 0 else 1.0

    # Edge Preservation Index (EPI): ratio of high-gradient edge correlation
    grad_num = 0.0
    grad_den_x = 0.0
    grad_den_y = 0.0
    for y in range(2, height - 2, 3):
        r = y * width
        for x in range(2, width - 2, 3):
            gx_o = int(orig[r + x + 1]) - int(orig[r + x - 1])
            gy_o = int(orig[r + width + x]) - int(orig[r - width + x])
            gx_e = int(enhanced[r + x + 1]) - int(enhanced[r + x - 1])
            gy_e = int(enhanced[r + width + x]) - int(enhanced[r - width + x])
            mag_o = math.hypot(gx_o, gy_o)
            mag_e = math.hypot(gx_e, gy_e)
            grad_num += mag_o * mag_e
            grad_den_x += mag_o * mag_o
            grad_den_y += mag_e * mag_e

    epi_den = math.sqrt(grad_den_x * grad_den_y)
    epi = grad_num / epi_den if epi_den > 0 else 1.0

    return {
        "psnr_db": round(psnr, 2),
        "ssim": round(max(0.0, min(1.0, ssim)), 4),
        "epi": round(max(0.0, min(1.0, epi)), 4),
    }


def compute_enhancement_metrics(
    per_frame_metrics: List[Dict[str, float]],
    mean_flicker_index: float,
) -> Dict[str, float | str]:
    """Aggregates video-wide image quality & enhancement metrics."""
    if not per_frame_metrics:
        return {}

    n = float(len(per_frame_metrics))
    avg_psnr = sum(m.get("psnr_db", 0.0) for m in per_frame_metrics) / n
    avg_ssim = sum(m.get("ssim", 0.0) for m in per_frame_metrics) / n
    avg_epi = sum(m.get("epi", 0.0) for m in per_frame_metrics) / n
    avg_enl_in = sum(m.get("enl_input", 0.0) for m in per_frame_metrics) / n
    avg_enl_out = sum(m.get("enl_enhanced", 0.0) for m in per_frame_metrics) / n
    enl_gain_pct = ((avg_enl_out - avg_enl_in) / max(0.1, avg_enl_in)) * 100.0

    return {
        "mean_psnr_db": round(avg_psnr, 2),
        "mean_ssim": round(avg_ssim, 4),
        "edge_preservation_index": round(avg_epi, 4),
        "input_enl_speckle_index": round(avg_enl_in, 2),
        "enhanced_enl_speckle_index": round(avg_enl_out, 2),
        "speckle_suppression_gain_pct": round(enl_gain_pct, 1),
        "temporal_flicker_mad": round(mean_flicker_index, 3),
        "clinical_interpretation_note": (
            "PSNR and SSIM measure structural fidelity relative to the raw B-mode acquisition, "
            "while ENL (Equivalent Number of Looks) and EPI (Edge Preservation Index) quantify "
            "speckle reduction and anatomical boundary retention. Higher quantitative metrics "
            "alone do not establish diagnostic efficacy and require radiologist review."
        ),
    }
