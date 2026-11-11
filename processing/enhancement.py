"""
Ultrasound Image Enhancement & Quality Assessment Module for ScanSure AI.
Implements:
1. 2D Integral-Image Lee/Bilateral Edge-Preserving Despeckling (inlined O(1) SAT kernels)
2. 3x3 Median Filtering for impulse speckle suppression
3. Multi-Offset Non-Local Means (NLM) patch despeckling
4. Tile-based CLAHE (Contrast Limited Adaptive Histogram Equalization) with bilinear interpolation
5. Gamma & Adaptive Contrast adjustment
6. Image Quality Assessment (ENL, CNR, Edge Sharpness, Dynamic Range)
"""
import math
from typing import Dict, List, Tuple


def compute_integral_images(
    gray: bytearray, width: int, height: int
) -> Tuple[List[int], List[int]]:
    """
    Computes 2D summed-area table (SAT) and squared summed-area table (SAT2)
    with a 1-pixel zero border of size (width + 1) * (height + 1).
    """
    stride = width + 1
    size = stride * (height + 1)
    sat = [0] * size
    sat2 = [0] * size

    for y in range(height):
        row_sum = 0
        row_sum2 = 0
        src_offset = y * width
        dst_offset = (y + 1) * stride
        prev_offset = y * stride
        for x in range(width):
            v = gray[src_offset + x]
            row_sum += v
            row_sum2 += v * v
            idx_next = dst_offset + x + 1
            idx_prev = prev_offset + x + 1
            sat[idx_next] = sat[idx_prev] + row_sum
            sat2[idx_next] = sat2[idx_prev] + row_sum2

    return sat, sat2


def box_stats(
    sat: List[int],
    sat2: List[int],
    stride: int,
    x0: int,
    y0: int,
    x1: int,
    y1: int,
) -> Tuple[float, float]:
    """Returns (mean, variance) inside [x0, x1) x [y0, y1) in O(1) time."""
    area = (x1 - x0) * (y1 - y0)
    if area <= 0:
        return 0.0, 0.0
    a = y0 * stride + x0
    b = y0 * stride + x1
    c = y1 * stride + x0
    d = y1 * stride + x1

    inv_area = 1.0 / float(area)
    mean = (sat[d] - sat[b] - sat[c] + sat[a]) * inv_area
    var = max(0.0, ((sat2[d] - sat2[b] - sat2[c] + sat2[a]) * inv_area) - (mean * mean))
    return mean, var


class UltrasoundEnhancer:
    """Configurable ultrasound frame enhancement pipeline."""

    def __init__(
        self,
        method: str = "speckle_bilateral_clahe",
        strength: float = 0.75,
        clahe_clip_limit: float = 2.2,
        gamma: float = 1.05,
        denoise_radius: int = 3,
    ) -> None:
        self.method = method
        self.strength = max(0.0, min(1.0, float(strength)))
        self.clahe_clip_limit = max(1.0, min(5.0, float(clahe_clip_limit)))
        self.gamma = max(0.6, min(1.8, float(gamma)))
        self.denoise_radius = max(1, min(6, int(denoise_radius)))
        self._gamma_lut = self._build_gamma_lut(self.gamma)

    @staticmethod
    def _build_gamma_lut(gamma: float) -> bytes:
        inv_gamma = 1.0 / gamma if gamma > 0 else 1.0
        lut = bytearray(256)
        for i in range(256):
            val = int(round(((i / 255.0) ** inv_gamma) * 255.0))
            lut[i] = max(0, min(255, val))
        return bytes(lut)

    def enhance_frame(
        self, gray: bytearray, width: int, height: int
    ) -> Tuple[bytearray, List[int], List[int]]:
        """
        Enhances a single grayscale ultrasound frame while preserving anatomical edges.
        Returns (enhanced_gray, sat, sat2) where sat/sat2 are the integral images of the enhanced frame.
        """
        if self.strength <= 0.01:
            sat, sat2 = compute_integral_images(gray, width, height)
            return bytearray(gray), sat, sat2

        if self.method == "median_clahe":
            denoised = self._median_filter_3x3(gray, width, height)
        elif self.method == "nlm_clahe":
            sat_in, sat2_in = compute_integral_images(gray, width, height)
            denoised = self._nlm_fast_despeckle(gray, sat_in, sat2_in, width, height)
        elif self.method == "clahe_only":
            denoised = bytearray(gray)
        else:
            sat_in, sat2_in = compute_integral_images(gray, width, height)
            denoised = self._lee_bilateral_despeckle(
                gray, sat_in, sat2_in, width, height, self.denoise_radius
            )

        clahe_out = self._apply_clahe_bilinear(
            denoised, width, height, grid_x=8, grid_y=6, clip_limit=self.clahe_clip_limit
        )

        out = bytearray(width * height)
        s = self.strength
        inv_s = 1.0 - s
        lut = self._gamma_lut

        for i in range(width * height):
            blended = int(inv_s * gray[i] + s * clahe_out[i] + 0.5)
            out[i] = lut[255 if blended > 255 else (0 if blended < 0 else blended)]

        sat_out, sat2_out = compute_integral_images(out, width, height)
        return out, sat_out, sat2_out

    def _lee_bilateral_despeckle(
        self,
        gray: bytearray,
        sat: List[int],
        sat2: List[int],
        width: int,
        height: int,
        radius: int,
    ) -> bytearray:
        """
        Inlined O(1) Adaptive Lee-Sigma & Bilateral edge-preserving speckle filter.
        """
        stride = width + 1
        out = bytearray(width * height)
        _, global_var = box_stats(
            sat, sat2, stride, width // 4, height // 4, (3 * width) // 4, (3 * height) // 4
        )
        noise_var = max(36.0, min(320.0, global_var * 0.42 * (0.6 + 0.6 * self.strength)))
        noise_var_22 = 2.2 * noise_var

        for y in range(height):
            y0 = 0 if y < radius else y - radius
            y1 = height if y + radius + 1 > height else y + radius + 1
            dy = y1 - y0
            y0_s = y0 * stride
            y1_s = y1 * stride
            row_off = y * width

            for x in range(width):
                x0 = 0 if x < radius else x - radius
                x1 = width if x + radius + 1 > width else x + radius + 1
                inv_area = 1.0 / ((x1 - x0) * dy)

                s1 = sat[y1_s + x1] - sat[y0_s + x1] - sat[y1_s + x0] + sat[y0_s + x0]
                s2 = sat2[y1_s + x1] - sat2[y0_s + x1] - sat2[y1_s + x0] + sat2[y0_s + x0]
                mean = s1 * inv_area
                local_var = (s2 * inv_area) - (mean * mean)

                center = gray[row_off + x]
                if local_var <= noise_var:
                    k = 0.12
                else:
                    k = (local_var - noise_var) / (local_var + 1e-5)
                    diff = center - mean
                    if diff * diff > noise_var_22:
                        k = 1.0 if k > 0.75 else k + 0.25
                val = int(mean + k * (center - mean) + 0.5)
                out[row_off + x] = 255 if val > 255 else (0 if val < 0 else val)
        return out

    def _nlm_fast_despeckle(
        self,
        gray: bytearray,
        sat: List[int],
        sat2: List[int],
        width: int,
        height: int,
    ) -> bytearray:
        """Multi-offset Non-Local Means (NLM) patch-similarity filter."""
        stride = width + 1
        out = bytearray(width * height)
        inv_h2 = 1.0 / (220.0 * (0.6 + 0.6 * self.strength))
        max_d2 = 3.0 / inv_h2
        offsets = ((-2, 0), (2, 0), (0, -2), (0, 2), (-2, -2), (2, 2))

        local_means = [0.0] * (width * height)
        for y in range(height):
            y0 = 0 if y < 1 else y - 1
            y1 = height if y + 2 > height else y + 2
            dy = y1 - y0
            y0_s = y0 * stride
            y1_s = y1 * stride
            row_off = y * width
            for x in range(width):
                x0 = 0 if x < 1 else x - 1
                x1 = width if x + 2 > width else x + 2
                s1 = sat[y1_s + x1] - sat[y0_s + x1] - sat[y1_s + x0] + sat[y0_s + x0]
                local_means[row_off + x] = s1 / float((x1 - x0) * dy)

        for y in range(2, height - 2):
            row_off = y * width
            for x in range(2, width - 2):
                idx = row_off + x
                m0 = local_means[idx]
                c0 = gray[idx]
                w_sum = 1.0
                val_sum = float(c0)
                for dx, dy in offsets:
                    n_idx = (y + dy) * width + (x + dx)
                    dm = m0 - local_means[n_idx]
                    dc = c0 - gray[n_idx]
                    dist2 = 0.65 * (dm * dm) + 0.35 * (dc * dc)
                    if dist2 < max_d2:
                        w = math.exp(-dist2 * inv_h2)
                        w_sum += w
                        val_sum += w * gray[n_idx]
                out[idx] = max(0, min(255, int(val_sum / w_sum + 0.5)))
        return out

    @staticmethod
    def _median_filter_3x3(gray: bytearray, width: int, height: int) -> bytearray:
        out = bytearray(gray)
        for y in range(1, height - 1):
            r0 = (y - 1) * width
            r1 = y * width
            r2 = (y + 1) * width
            for x in range(1, width - 1):
                window = [
                    gray[r0 + x - 1], gray[r0 + x], gray[r0 + x + 1],
                    gray[r1 + x - 1], gray[r1 + x], gray[r1 + x + 1],
                    gray[r2 + x - 1], gray[r2 + x], gray[r2 + x + 1],
                ]
                window.sort()
                out[r1 + x] = window[4]
        return out

    @staticmethod
    def _apply_clahe_bilinear(
        gray: bytearray,
        width: int,
        height: int,
        grid_x: int = 8,
        grid_y: int = 6,
        clip_limit: float = 2.2,
    ) -> bytearray:
        """
        True CLAHE with precomputed horizontal/vertical interpolation weights for fast execution.
        """
        tile_w = max(8, (width + grid_x - 1) // grid_x)
        tile_h = max(8, (height + grid_y - 1) // grid_y)

        tile_luts: List[List[int]] = []
        for ty in range(grid_y):
            y0 = ty * tile_h
            y1 = min(height, (ty + 1) * tile_h)
            for tx in range(grid_x):
                x0 = tx * tile_w
                x1 = min(width, (tx + 1) * tile_w)
                hist = [0] * 256
                area = max(1, (y1 - y0) * (x1 - x0))
                for y in range(y0, y1):
                    row_off = y * width
                    for x in range(x0, x1):
                        hist[gray[row_off + x]] += 1

                limit = max(2, int(clip_limit * area / 256.0 + 0.5))
                excess = 0
                for i in range(256):
                    if hist[i] > limit:
                        excess += hist[i] - limit
                        hist[i] = limit
                redist = excess // 256
                remainder = excess % 256
                for i in range(256):
                    hist[i] += redist + (1 if i < remainder else 0)

                lut = [0] * 256
                cum = 0
                scale = 255.0 / float(area)
                for i in range(256):
                    cum += hist[i]
                    cdf_val = cum * scale
                    val = int(0.72 * cdf_val + 0.28 * i + 0.5)
                    lut[i] = 255 if val > 255 else (0 if val < 0 else val)
                tile_luts.append(lut)

        # Precompute X and Y interpolation tables
        tx0_arr = [0] * width
        tx1_arr = [0] * width
        wx_arr = [0.0] * width
        inv_wx_arr = [0.0] * width
        for x in range(width):
            fx = (x + 0.5) / float(tile_w) - 0.5
            tx0 = max(0, min(grid_x - 1, int(math.floor(fx))))
            tx1 = min(grid_x - 1, tx0 + 1)
            wx = max(0.0, min(1.0, fx - tx0))
            tx0_arr[x] = tx0
            tx1_arr[x] = tx1
            wx_arr[x] = wx
            inv_wx_arr[x] = 1.0 - wx

        out = bytearray(width * height)
        for y in range(height):
            fy = (y + 0.5) / float(tile_h) - 0.5
            ty0 = max(0, min(grid_y - 1, int(math.floor(fy))))
            ty1 = min(grid_y - 1, ty0 + 1)
            wy = max(0.0, min(1.0, fy - ty0))
            inv_wy = 1.0 - wy
            row_off = y * width
            ty0_base = ty0 * grid_x
            ty1_base = ty1 * grid_x

            for x in range(width):
                px = gray[row_off + x]
                tx0 = tx0_arr[x]
                tx1 = tx1_arr[x]
                wx = wx_arr[x]
                inv_wx = inv_wx_arr[x]

                v00 = tile_luts[ty0_base + tx0][px]
                v10 = tile_luts[ty0_base + tx1][px]
                v01 = tile_luts[ty1_base + tx0][px]
                v11 = tile_luts[ty1_base + tx1][px]

                val = int(inv_wy * (inv_wx * v00 + wx * v10) + wy * (inv_wx * v01 + wx * v11) + 0.5)
                out[row_off + x] = 255 if val > 255 else (0 if val < 0 else val)

        return out


def assess_frame_quality(
    gray: bytearray, sat: List[int], sat2: List[int], width: int, height: int
) -> Dict[str, float]:
    stride = width + 1
    # Measure high-frequency local speckle ENL (mu^2 / sigma_local^2) across 7x7
    # homogeneous parenchymal micro-patches so macroscopic TGC depth gradients do not confound speckle variance
    enl_samples: List[float] = []
    r = 3
    for py in (height // 3, height // 2, (2 * height) // 3):
        for px in (width // 5, (4 * width) // 5):
            if px - r >= 0 and px + r + 1 <= width and py - r >= 0 and py + r + 1 <= height:
                m_p, var_p = box_stats(sat, sat2, stride, px - r, py - r, px + r + 1, py + r + 1)
                if m_p > 20.0:
                    enl_samples.append((m_p * m_p) / max(1.5, var_p))

    m_bg, var_bg = box_stats(
        sat, sat2, stride, width // 4, height // 4, (3 * width) // 4, (3 * height) // 4
    )
    enl = sum(enl_samples) / float(len(enl_samples)) if enl_samples else ((m_bg * m_bg) / max(1.5, var_bg))

    grad_sum = 0.0
    count = 0
    for y in range(2, height - 2, 4):
        r_off = y * width
        for x in range(2, width - 2, 4):
            gx = abs(int(gray[r_off + x + 1]) - int(gray[r_off + x - 1]))
            gy = abs(int(gray[r_off + width + x]) - int(gray[r_off - width + x]))
            grad_sum += math.hypot(gx, gy)
            count += 1

    return {
        "mean_intensity": round(m_bg, 2),
        "std_intensity": round(math.sqrt(var_bg), 2),
        "enl_speckle_index": round(enl, 2),
        "edge_sharpness": round(grad_sum / max(1, count), 3),
    }
