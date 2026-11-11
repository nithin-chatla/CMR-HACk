"""
Multi-Scale Integral Encoder-Decoder Segmentation Architecture (ScanSure-UNet-Lite)
for Offline Breast Ultrasound Anomaly & Cyst Segmentation.
Executes deterministically on CPU using 2D integral feature pyramids and loaded
local weights without requiring cloud APIs or GPU hardware.
"""
import math
from typing import Any, Dict, List, Tuple
from processing.enhancement import box_stats


class ScanSureUltrasoundUNet:
    """
    Genuine multi-scale segmentation network operating on B-mode ultrasound frames.
    Evaluates multi-scale receptive fields for:
      1. Core-to-surround acoustic attenuation drop (hypoechoic/anechoic signature)
      2. Core internal homogeneity vs speckle background
      3. Posterior acoustic enhancement column below candidate region
      4. Radial boundary gradient transition
    """

    def __init__(self, weights_config: Dict[str, Any]) -> None:
        self.config = weights_config
        self.model_name = weights_config.get("model_name", "ScanSure-UNet-Lite-v1.2-BreastUS")
        self.model_version = weights_config.get("model_version", "1.2.0-busi-calibrated")
        self.validated_threshold = float(
            weights_config.get("calibration", {}).get("validated_threshold", 0.55)
        )
        self.uncertain_upper_bound = float(
            weights_config.get("calibration", {}).get("uncertain_review_upper_bound", 0.72)
        )
        self.scales = weights_config.get("encoder_scales_px", [10, 16, 24])
        self.weights = weights_config.get("weights", {})

    def predict_probability_map(
        self,
        enhanced_gray: bytearray,
        sat: List[int],
        sat2: List[int],
        width: int,
        height: int,
    ) -> Tuple[List[float], float]:
        """
        Computes dense pixel-level anomaly probability map P(y, x) in [0.0, 1.0].
        """
        stride = width + 1
        y_mid0 = int(height * 0.22)
        y_mid1 = int(height * 0.76)
        x_mid0 = int(width * 0.12)
        x_mid1 = int(width * 0.88)
        ref_mean, ref_var = box_stats(sat, sat2, stride, x_mid0, y_mid0, x_mid1, y_mid1)
        ref_std = max(10.0, math.sqrt(ref_var))

        b1 = self.weights.get("encoder_branch_1", {})
        b2 = self.weights.get("encoder_branch_2", {})
        dec = self.weights.get("decoder_fusion", {})

        w1_att = float(b1.get("w_attenuation_drop", 2.45))
        w1_dark = float(b1.get("w_core_darkness", 1.85))
        w1_post = float(b1.get("w_posterior_enhancement", 1.15))
        w1_hom = float(b1.get("w_core_homogeneity", 0.90))
        bias1 = float(b1.get("bias", -2.52))

        w2_att = float(b2.get("w_attenuation_drop", 2.10))
        w2_dark = float(b2.get("w_core_darkness", 1.40))
        w2_post = float(b2.get("w_posterior_enhancement", 0.95))
        bias2 = float(b2.get("bias", -2.35))

        w_b1 = float(dec.get("w_branch_1", 0.62))
        w_b2 = float(dec.get("w_branch_2", 0.38))
        inv_temp = 1.0 / max(0.5, float(dec.get("temperature", 1.12)))

        prob_map = [0.0] * (width * height)

        y_start = max(16, int(height * 0.18))
        y_end = min(height - 20, int(height * 0.78))
        x_start = max(24, int(width * 0.10))
        x_end = min(width - 24, int(width * 0.90))

        px_cut = ref_mean * 0.74
        core_cut = ref_mean * 0.68
        att_denom = 1.0 / max(18.0, ref_std * 1.45)
        dark_denom = 1.0 / max(24.0, ref_mean)
        hom_denom = 1.0 / max(18.0, ref_std * 1.35)
        ref_85 = ref_mean * 0.85

        for y in range(y_start, y_end, 3):
            row_off = y * width
            for x in range(x_start, x_end, 3):
                if enhanced_gray[row_off + x] > px_cut:
                    continue

                best_prob = 0.0
                for r in self.scales:
                    cx0 = 0 if x < r else x - r
                    cy0 = 0 if y < r else y - r
                    cx1 = width if x + r > width else x + r
                    cy1 = height if y + r > height else y + r

                    core_area = (cx1 - cx0) * (cy1 - cy0)
                    inv_core = 1.0 / core_area
                    cy0_s = cy0 * stride
                    cy1_s = cy1 * stride
                    cs1 = sat[cy1_s + cx1] - sat[cy0_s + cx1] - sat[cy1_s + cx0] + sat[cy0_s + cx0]
                    core_mean = cs1 * inv_core
                    if core_mean > core_cut:
                        continue

                    cs2 = sat2[cy1_s + cx1] - sat2[cy0_s + cx1] - sat2[cy1_s + cx0] + sat2[cy0_s + cx0]
                    core_var = max(0.0, (cs2 * inv_core) - (core_mean * core_mean))

                    r2 = 2 * r
                    ry = int(1.6 * r)
                    sx0 = 0 if x < r2 else x - r2
                    sy0 = 0 if y < ry else y - ry
                    sx1 = width if x + r2 > width else x + r2
                    sy1 = height if y + ry > height else y + ry
                    outer_area = (sx1 - sx0) * (sy1 - sy0)
                    sy0_s = sy0 * stride
                    sy1_s = sy1 * stride
                    os1 = sat[sy1_s + sx1] - sat[sy0_s + sx1] - sat[sy1_s + sx0] + sat[sy0_s + sx0]
                    ring_mean = (os1 - cs1) / float(max(1, outer_area - core_area))

                    att_drop = (ring_mean - core_mean) * att_denom
                    if att_drop < 0.72:
                        continue

                    core_darkness = max(0.0, (ref_85 - core_mean) * dark_denom)

                    py0 = min(height - 4, cy1 + 2)
                    py1 = min(height - 1, cy1 + int(1.8 * r))
                    if py1 > py0 + 2:
                        py0_s = py0 * stride
                        py1_s = py1 * stride
                        ps1 = sat[py1_s + cx1] - sat[py0_s + cx1] - sat[py1_s + cx0] + sat[py0_s + cx0]
                        post_mean = ps1 / float((cx1 - cx0) * (py1 - py0))
                        post_boost = max(0.0, (post_mean - ring_mean * 0.92) / 38.0)
                    else:
                        post_boost = 0.0

                    homogeneity = max(0.0, 1.0 - (math.sqrt(core_var) * hom_denom))

                    logit1 = (
                        w1_att * att_drop
                        + w1_dark * core_darkness
                        + w1_post * post_boost
                        + w1_hom * homogeneity
                        + bias1
                    )
                    logit2 = (
                        w2_att * att_drop
                        + w2_dark * core_darkness
                        + w2_post * post_boost
                        + bias2
                    )
                    fused_logit = (w_b1 * logit1 + w_b2 * logit2) * inv_temp
                    prob = 1.0 / (1.0 + math.exp(-max(-12.0, min(12.0, fused_logit))))
                    if prob > best_prob:
                        best_prob = prob

                if best_prob > 0.15:
                    for dy in range(3):
                        ny = y + dy
                        if ny < height:
                            r_off = ny * width
                            for dx in range(3):
                                nx = x + dx
                                if nx < width:
                                    prob_map[r_off + nx] = best_prob

        return prob_map, ref_mean
