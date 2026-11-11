import type { DetectionRecord, FrameTimelineEntry, ProcessingSettings } from '../types/scansure';

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
      displayLabel: 'Uncertain — Requires Radiologist Review',
      requiresRadiologistReview: true,
    };
  }
  return {
    status: 'candidate_detected',
    displayLabel: 'Cystic / Anechoic Candidate — Requires Radiologist Review',
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
            ? 'Uncertain — Requires Radiologist Review'
            : 'Cystic / Anechoic Lesion Candidate',
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
