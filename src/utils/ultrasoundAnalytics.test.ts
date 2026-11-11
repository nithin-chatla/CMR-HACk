import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyConfidenceStatus,
  filterTimelineByThreshold,
  selectTopConfidenceKeyframes,
  validateProcessingSettings,
  formatTimestampMillis,
} from './ultrasoundAnalytics';
import type { AnnotatedKeyframe, FrameTimelineEntry, ProcessingSettings } from '../types/scansure';

test('classifyConfidenceStatus enforces validated threshold and uncertain review boundaries', () => {
  const below = classifyConfidenceStatus(0.42, 0.55, 0.72);
  assert.equal(below.status, 'below_threshold');
  assert.equal(below.requiresRadiologistReview, false);

  const uncertain = classifyConfidenceStatus(0.64, 0.55, 0.72);
  assert.equal(uncertain.status, 'uncertain_review');
  assert.equal(uncertain.displayLabel, 'Uncertain — Requires Radiologist Review');
  assert.equal(uncertain.requiresRadiologistReview, true);

  const candidate = classifyConfidenceStatus(0.84, 0.55, 0.72);
  assert.equal(candidate.status, 'candidate_detected');
  assert.equal(candidate.requiresRadiologistReview, true);
});

test('filterTimelineByThreshold suppresses detections below threshold and recalculates counts', () => {
  const sampleTimeline: FrameTimelineEntry[] = [
    {
      frame_number: 0,
      timestamp_sec: 0.0,
      quality: { psnr_db: 28.4, ssim: 0.89, enl_input: 14.2, enl_enhanced: 32.1 },
      detection_count: 2,
      max_confidence: 0.81,
      detections: [
        {
          frame_number: 0,
          timestamp_sec: 0.0,
          track_id: 1,
          category: 'Cystic / Anechoic Lesion Candidate',
          is_uncertain: false,
          bbox_xywh: [120, 100, 48, 36],
          centroid_xy: [144, 118],
          area_px: 1350,
          solidity: 0.78,
          mean_echogenicity: 22.4,
          raw_confidence: 0.81,
          validated_threshold: 0.55,
          confidence_type: 'raw_uncalibrated_model_score',
          temporal_persistence_frames: 1,
          model_version: '1.2.0-busi-calibrated',
          contour_polygon: [[120, 100], [168, 100]],
        },
        {
          frame_number: 0,
          timestamp_sec: 0.0,
          track_id: 2,
          category: 'Uncertain — Requires Radiologist Review',
          is_uncertain: true,
          bbox_xywh: [200, 130, 30, 26],
          centroid_xy: [215, 143],
          area_px: 610,
          solidity: 0.71,
          mean_echogenicity: 38.0,
          raw_confidence: 0.61,
          validated_threshold: 0.55,
          confidence_type: 'raw_uncalibrated_model_score',
          temporal_persistence_frames: 1,
          model_version: '1.2.0-busi-calibrated',
          contour_polygon: [[200, 130], [230, 130]],
        },
      ],
    },
  ];

  const strictResult = filterTimelineByThreshold(sampleTimeline, 0.70);
  assert.equal(strictResult.totalActiveDetections, 1);
  assert.equal(strictResult.activeFindingFrames, 1);
  assert.equal(strictResult.filteredTimeline[0].detections.length, 1);
  assert.equal(strictResult.filteredTimeline[0].detections[0].raw_confidence, 0.81);
});

test('selectTopConfidenceKeyframes ranks keyframes by highest confidence score and slices to user count', () => {
  const kfs: AnnotatedKeyframe[] = [
    {
      frame_number: 0,
      timestamp_sec: 0,
      label: 'Frame 0',
      filename: 'f0.png',
      url: '/f0.png',
      comparison_filename: 'c0.png',
      comparison_url: '/c0.png',
      max_confidence: 0.75,
    },
    {
      frame_number: 5,
      timestamp_sec: 0.33,
      label: 'Frame 5',
      filename: 'f5.png',
      url: '/f5.png',
      comparison_filename: 'c5.png',
      comparison_url: '/c5.png',
      max_confidence: 0.94,
    },
    {
      frame_number: 12,
      timestamp_sec: 0.8,
      label: 'Frame 12',
      filename: 'f12.png',
      url: '/f12.png',
      comparison_filename: 'c12.png',
      comparison_url: '/c12.png',
      max_confidence: 0.89,
    },
  ];

  const top2 = selectTopConfidenceKeyframes(kfs, [], 2);
  assert.equal(top2.length, 2);
  assert.equal(top2[0].frame_number, 5);
  assert.equal(top2[1].frame_number, 12);
});

test('validateProcessingSettings catches out-of-range parameters', () => {
  const validConfig: ProcessingSettings = {
    enhancement_method: 'speckle_bilateral_clahe',
    enhancement_strength: 0.75,
    clahe_clip_limit: 2.2,
    gamma: 1.05,
    temporal_alpha: 0.28,
    ai_detection_enabled: true,
    detection_threshold: 0.55,
    temporal_smoothing: true,
    output_resolution: 'original',
    device: 'auto',
    top_k_frames: 6,
  };
  assert.equal(validateProcessingSettings(validConfig).valid, true);

  const invalidConfig: ProcessingSettings = {
    ...validConfig,
    detection_threshold: 0.15,
    enhancement_strength: 1.5,
  };
  const check = validateProcessingSettings(invalidConfig);
  assert.equal(check.valid, false);
  assert.equal(check.errors.length, 2);
});

test('formatTimestampMillis formats frame timestamps accurately', () => {
  assert.equal(formatTimestampMillis(0), '00:00.00');
  assert.equal(formatTimestampMillis(2.4), '00:02.40');
  assert.equal(formatTimestampMillis(65.125), '01:05.13');
});
