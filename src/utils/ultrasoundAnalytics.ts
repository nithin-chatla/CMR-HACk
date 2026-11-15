import type {
  AnnotatedKeyframe,
  DetectionRecord,
  FrameTimelineEntry,
  ProcessingSettings,
  VideoMetadata,
} from '../types/scansure';

export interface SafeApiResult<T> {
  ok: boolean;
  data?: T;
  userMessage?: string;
  technicalDetails?: string;
}

export const ENHANCEMENT_METHOD_INFO: Record<
  ProcessingSettings['enhancement_method'],
  {
    shortLabel: string;
    fullName: string;
    description: string;
    citation?: string;
  }
> = {
  auto_combined_hybrid: {
    shortLabel: 'Auto-Selected Combined Hybrid (Lee-Sigma + Aberdeen LFIT + NLM + CLAHE)',
    fullName:
      'Combined 3-Stage Hybrid Despeckling (Lee-Sigma Bilateral + Aberdeen LFIT Anisotropic Diffusion + Non-Local Means + Bilinear CLAHE)',
    description:
      'Automatically combines all three speckle denoising engines (Adaptive Lee-Sigma MMSE, Aberdeen LFIT Anisotropic Diffusion, and Multi-Offset Non-Local Means) with Bilinear CLAHE contrast recovery.',
    citation:
      'Jabbar et al. (2021) University of Aberdeen LFIT + Lee (1980) MMSE + Buades et al. (2005) NLM.',
  },
  speckle_bilateral_clahe: {
    shortLabel: 'Lee-Sigma + Bilateral + CLAHE',
    fullName: 'Adaptive Lee-Sigma MMSE + Spatial-Range Bilateral + Bilinear CLAHE',
    description:
      'Suppresses multiplicative Rayleigh speckle noise using local O(1) integral-image variance estimation while locking cyst boundaries.',
  },
  aberdeen_fuzzy_adf_clahe: {
    shortLabel: 'Aberdeen LFIT Fuzzy + Anisotropic Diffusion + CLAHE',
    fullName:
      'Local Fuzzy Inference Technique (LFIT) + Perona-Malik Anisotropic Diffusion + CLAHE',
    description:
      'Implements gradient-guided anisotropic speckle diffusion paired with local fuzzy membership contrast enhancement to sharpen fascial and cystic margins without amplifying homogeneous tissue noise.',
    citation:
      'Jabbar, S. I., Day, C. R., Aladi, A. Q., & Chadwick, E. K. (2021). Automated Ultrasound Video Enhancement. University of Aberdeen / IEEE ICICT.',
  },
  nlm_clahe: {
    shortLabel: 'Non-Local Means (NLM) + CLAHE',
    fullName: 'Multi-Offset Patch Non-Local Means Despeckling + Bilinear CLAHE',
    description:
      'Weights self-similar 3×3 parenchymal neighborhoods across 6 spatial offsets for smooth tissue homogenization.',
  },
  median_clahe: {
    shortLabel: '3×3 Impulse Median + CLAHE',
    fullName: '3×3 Non-Linear Rank-Order Median Filter + Bilinear CLAHE',
    description:
      'Rejects high-amplitude impulse artifacts and acoustic reverberation spikes before local contrast recovery.',
  },
  clahe_only: {
    shortLabel: 'Adaptive CLAHE Contrast Only',
    fullName: '8×6 Contextual Tile Bilinear CLAHE (No Spatial Smoothing)',
    description:
      'Applies local contrast-limited histogram equalization without spatial speckle smoothing.',
  },
};

export function recommendAutoEnhancementSettings(
  meta?: VideoMetadata | null,
  currentTopKFrames: number = 6
): ProcessingSettings {
  const pixelCount = meta ? meta.width * meta.height : 320 * 240;
  const isLowRes = pixelCount <= 360 * 280;
  const isHighFps = meta ? meta.fps >= 20 : false;

  return {
    enhancement_method: 'auto_combined_hybrid',
    enhancement_strength: isLowRes ? 0.75 : 0.68,
    clahe_clip_limit: isLowRes ? 2.3 : 2.1,
    gamma: 1.04,
    temporal_alpha: isHighFps ? 0.25 : 0.30,
    ai_detection_enabled: true,
    detection_threshold: 0.55,
    temporal_smoothing: true,
    output_resolution: 'original',
    device: 'auto',
    top_k_frames: currentTopKFrames,
  };
}

export function parseApiResponseJson<T = any>(
  rawText: string,
  httpStatus: number,
  contentType: string | null = 'application/json'
): SafeApiResult<T> {
  const trimmed = (rawText || '').trim();
  const isHtmlPayload =
    trimmed.toLowerCase().startsWith('<!doctype') ||
    trimmed.toLowerCase().startsWith('<html') ||
    (contentType !== null && contentType.toLowerCase().includes('text/html'));

  if (isHtmlPayload) {
    return {
      ok: false,
      userMessage:
        'Unable to load the selected study or reach the local processing service. Please verify the file and try again.',
      technicalDetails: `HTTP ${httpStatus} returned HTML content (${contentType || 'text/html'}) instead of JSON: ${trimmed.slice(0, 140)}`,
    };
  }

  if (!trimmed) {
    return {
      ok: false,
      userMessage:
        'The local processing service returned an empty response. Please verify the study file and try again.',
      technicalDetails: `HTTP ${httpStatus} empty response body.`,
    };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (httpStatus < 200 || httpStatus >= 300 || (parsed && parsed.error)) {
      return {
        ok: false,
        userMessage:
          parsed?.error ||
          'Unable to complete the requested operation. Please verify the ultrasound file and settings.',
        technicalDetails: `HTTP ${httpStatus}: ${JSON.stringify(parsed)}`,
      };
    }
    return {
      ok: true,
      data: parsed as T,
    };
  } catch (err: any) {
    return {
      ok: false,
      userMessage:
        'Received an unreadable response from the local imaging engine. Please retry the operation.',
      technicalDetails: `JSON parse failure on HTTP ${httpStatus}: ${err?.message || 'SyntaxError'} | Payload prefix: ${trimmed.slice(0, 120)}`,
    };
  }
}

export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<SafeApiResult<T>> {
  try {
    const res = await fetch(url, options);
    const rawText = await res.text();
    const contentType = res.headers.get('content-type');
    return parseApiResponseJson<T>(rawText, res.status, contentType);
  } catch (err: any) {
    return {
      ok: false,
      userMessage:
        'Unable to connect to the local ScanSure AI workstation backend. Ensure the local server is running.',
      technicalDetails: `Network/Fetch exception for ${url}: ${err?.message || String(err)}`,
    };
  }
}

export function classifyConfidenceStatus(
  rawScore: number,
  validatedThreshold: number,
  uncertainUpperBound: number = 0.72
): {
  status: 'below_threshold' | 'uncertain_review' | 'candidate_detected';
  displayLabel: string;
  requiresRadiologistReview: boolean;
} {
  if (rawScore < validatedThreshold) {
    return {
      status: 'below_threshold',
      displayLabel: 'Below Validated Threshold — No Finding Displayed',
      requiresRadiologistReview: false,
    };
  }
  if (rawScore < uncertainUpperBound) {
    return {
      status: 'uncertain_review',
      displayLabel: 'Potential uncertain hypoechoic region — Requires radiologist review',
      requiresRadiologistReview: true,
    };
  }
  return {
    status: 'candidate_detected',
    displayLabel: 'Potential cystic / anechoic region — Requires radiologist review',
    requiresRadiologistReview: true,
  };
}

export function filterTimelineByThreshold(
  timeline: FrameTimelineEntry[],
  activeThreshold: number
): {
  filteredTimeline: FrameTimelineEntry[];
  activeFindingFrames: number;
  totalActiveDetections: number;
  uncertainCount: number;
  candidateCount: number;
} {
  let activeFindingFrames = 0;
  let totalActiveDetections = 0;
  let uncertainCount = 0;
  let candidateCount = 0;

  const uncertainUpper = Math.max(activeThreshold + 0.08, 0.72);

  const filteredTimeline = timeline.map((entry) => {
    const validDets: DetectionRecord[] = entry.detections
      .filter((d) => d.raw_confidence >= activeThreshold)
      .map((d) => {
        const isUncertain = d.raw_confidence < uncertainUpper;
        if (isUncertain) {
          uncertainCount += 1;
        } else {
          candidateCount += 1;
        }
        return {
          ...d,
          is_uncertain: isUncertain,
          validated_threshold: activeThreshold,
          category: isUncertain
            ? 'Potential uncertain hypoechoic region'
            : 'Potential cystic / anechoic region',
        };
      });

    if (validDets.length > 0) {
      activeFindingFrames += 1;
      totalActiveDetections += validDets.length;
    }

    const maxConf = validDets.reduce((acc, item) => Math.max(acc, item.raw_confidence), 0);

    return {
      ...entry,
      detection_count: validDets.length,
      max_confidence: maxConf,
      detections: validDets,
    };
  });

  return {
    filteredTimeline,
    activeFindingFrames,
    totalActiveDetections,
    uncertainCount,
    candidateCount,
  };
}

export function selectTopConfidenceKeyframes(
  keyframes: AnnotatedKeyframe[],
  timeline: FrameTimelineEntry[],
  requestedCount: number
): AnnotatedKeyframe[] {
  const safeCount = Math.max(1, Math.min(12, Math.floor(requestedCount || 4)));
  const enriched = keyframes.map((kf) => {
    const tlEntry = timeline[kf.frame_number];
    const conf =
      typeof kf.max_confidence === 'number'
        ? kf.max_confidence
        : tlEntry?.max_confidence ?? 0;
    const detCount =
      typeof kf.detection_count === 'number'
        ? kf.detection_count
        : tlEntry?.detection_count ?? 0;
    return {
      ...kf,
      max_confidence: conf,
      detection_count: detCount,
    };
  });

  enriched.sort((a, b) => {
    const diff = (b.max_confidence ?? 0) - (a.max_confidence ?? 0);
    if (Math.abs(diff) > 1e-5) return diff;
    return a.frame_number - b.frame_number;
  });

  return enriched.slice(0, safeCount);
}

export function validateProcessingSettings(settings: ProcessingSettings): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (settings.enhancement_strength < 0 || settings.enhancement_strength > 1) {
    errors.push('Enhancement strength must be between 0.0 and 1.0.');
  }
  if (settings.clahe_clip_limit < 1.0 || settings.clahe_clip_limit > 5.0) {
    errors.push('CLAHE clip limit must be between 1.0 and 5.0.');
  }
  if (settings.detection_threshold < 0.3 || settings.detection_threshold > 0.95) {
    errors.push('Detection threshold must be between 0.30 and 0.95.');
  }
  if (settings.gamma < 0.6 || settings.gamma > 1.8) {
    errors.push('Gamma must be between 0.60 and 1.80.');
  }
  if (
    settings.top_k_frames !== undefined &&
    (settings.top_k_frames < 1 || settings.top_k_frames > 12)
  ) {
    errors.push('Top high-confidence frames count must be between 1 and 12.');
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function formatTimestampMillis(seconds: number): string {
  const safeSec = Math.max(0, seconds);
  const mins = Math.floor(safeSec / 60);
  const remSec = safeSec - mins * 60;
  const minsStr = String(mins).padStart(2, '0');
  const secStr = remSec.toFixed(2).padStart(5, '0');
  return `${minsStr}:${secStr}`;
}
