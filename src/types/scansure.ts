export interface HardwareProfile {
  os: {
    system: string;
    release: string;
    architecture: string;
    python_version: string;
  };
  cpu: {
    model: string;
    logical_cores: number;
    simd_extensions: string[];
  };
  memory: {
    total_gb: number;
    available_gb: number;
    total_mb: number;
    available_mb: number;
  };
  disk: {
    total_gb: number;
    used_gb: number;
    free_gb: number;
  };
  gpu: {
    gpu_present: boolean;
    cuda_available: boolean;
    model: string;
    vram: string;
    driver: string;
    integrated_gpu?: string;
  };
  target_device_profile?: {
    device_name: string;
    device_id: string;
    product_id: string;
    processor: string;
    installed_ram_gb: number;
    usable_ram_gb: number;
    discrete_gpu: string;
    integrated_gpu: string;
    storage_used_gb: number;
    storage_total_gb: number;
    storage_free_gb: number;
    system_type: string;
    pen_and_touch: string;
  };
  media_backends: {
    ffmpeg_available: boolean;
    ffprobe_available: boolean;
    ffmpeg_version: string;
  };
  recommended_config: {
    processing_device: string;
    frame_batch_size: number;
    streaming_mode: boolean;
    vram_budget_mb?: number;
    cpu_worker_threads?: number;
    model_variant: string;
    offline_ready: boolean;
  };
}

export interface SampleVideoItem {
  id: string;
  filename: string;
  filepath: string;
  title: string;
  description: string;
  anatomy: string;
  width: number;
  height: number;
  fps: number;
  num_frames: number;
  expected_lesion_count: number;
  file_size_mb?: number;
  duration_sec?: number;
  video_url: string;
}

export interface VideoMetadata {
  filename: string;
  filepath: string;
  extension: string;
  file_size_bytes: number;
  file_size_mb: number;
  width: number;
  height: number;
  resolution: string;
  fps: number;
  fps_rational: string;
  frame_count: number;
  duration_sec: number;
  video_codec: string;
  pixel_format: string;
  has_audio: boolean;
  audio_codec: string | null;
  valid: boolean;
  video_url?: string;
}

export interface ProcessingSettings {
  enhancement_method: 'speckle_bilateral_clahe' | 'median_clahe' | 'nlm_clahe' | 'clahe_only';
  enhancement_strength: number;
  clahe_clip_limit: number;
  gamma: number;
  temporal_alpha: number;
  ai_detection_enabled: boolean;
  detection_threshold: number;
  temporal_smoothing: boolean;
  output_resolution: 'original' | '320x240' | '480x360' | '640x480';
  device: 'auto' | 'cpu' | 'gpu';
}

export interface DetectionRecord {
  frame_number: number;
  timestamp_sec: number;
  track_id: number;
  category: string;
  is_uncertain: boolean;
  bbox_xywh: [number, number, number, number];
  centroid_xy: [number, number];
  area_px: number;
  solidity: number;
  mean_echogenicity: number;
  raw_confidence: number;
  validated_threshold: number;
  confidence_type: string;
  temporal_persistence_frames: number;
  model_version: string;
  contour_polygon: [number, number][];
}

export interface FrameTimelineEntry {
  frame_number: number;
  timestamp_sec: number;
  quality: {
    psnr_db: number;
    ssim: number;
    enl_input: number;
    enl_enhanced: number;
  };
  detection_count: number;
  max_confidence: number;
  detections: DetectionRecord[];
}

export interface AnnotatedKeyframe {
  frame_number: number;
  timestamp_sec: number;
  label: string;
  filename: string;
  url: string;
  comparison_filename: string;
  comparison_url: string;
}

export interface JobResultPayload {
  job_id: string;
  status: string;
  generated_at_utc: string;
  medical_disclaimer: string;
  input_video: VideoMetadata;
  audio_stream_report: string;
  processing_configuration: ProcessingSettings & {
    requested_device: string;
    executed_device: string;
  };
  processing_duration_sec: number;
  model_metadata: {
    model_name: string;
    model_version: string;
    architecture: string;
    supported_anatomy: string;
    unsupported_anatomies: string[];
    dataset_provenance: {
      reference_distribution: string;
      modality: string;
      classes: string[];
      temporal_validation_limitation: string;
    };
    calibration: {
      is_calibrated_probability: boolean;
      score_type: string;
      validated_threshold: number;
      uncertain_review_upper_bound: number;
      calibration_note: string;
    };
    execution_device: string;
  };
  detection_summary: {
    total_frames_processed: number;
    frames_with_findings: number;
    frames_without_findings: number;
    total_region_instances: number;
    cystic_candidate_instances: number;
    uncertain_review_instances: number;
    peak_raw_confidence: number;
    peak_confidence_frame: number;
    validated_threshold: number;
    confidence_disclosure: string;
    clinical_recommendation: string;
  };
  enhancement_evaluation: {
    mean_psnr_db: number;
    mean_ssim: number;
    edge_preservation_index: number;
    input_enl_speckle_index: number;
    enhanced_enl_speckle_index: number;
    speckle_suppression_gain_pct: number;
    temporal_flicker_mad: number;
    clinical_interpretation_note: string;
  };
  video_integrity_verification: {
    integrity_verified: boolean;
    frame_count_exact_match: boolean;
    fps_exact_match: boolean;
    resolution_exact_match: boolean;
    synchronized_comparison_verified: boolean;
    input_summary: {
      frame_count: number;
      fps: number;
      duration_sec: number;
      resolution: string;
    };
    outputs: {
      enhanced_video: {
        filename: string;
        frame_count: number;
        fps: number;
        duration_sec: number;
        resolution: string;
        file_size_mb: number;
      };
      annotated_video: {
        filename: string;
        frame_count: number;
        fps: number;
        duration_sec: number;
        resolution: string;
        file_size_mb: number;
      };
      comparison_video: {
        filename: string;
        frame_count: number;
        fps: number;
        duration_sec: number;
        resolution: string;
        file_size_mb: number;
      };
    };
    discrepancy_notes: string[];
  };
  exports: {
    job_id: string;
    output_directory: string;
    videos: {
      enhanced_video: { filename: string; url: string; path: string };
      annotated_video: { filename: string; url: string; path: string };
      comparison_video: { filename: string; url: string; path: string };
    };
    reports: {
      json: { filename: string; url: string; path: string };
      csv: { filename: string; url: string; path: string };
    };
    annotated_png_frames: AnnotatedKeyframe[];
  };
  detections: DetectionRecord[];
  frame_by_frame_timeline: FrameTimelineEntry[];
}

export interface BenchmarkMetrics {
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  true_negative_frames: number;
  false_positive_frames: number;
  precision: number;
  recall: number;
  f1_score: number;
  sensitivity: number;
  specificity: number;
  false_positive_rate: number;
  mean_iou: number;
  mean_dice_coefficient: number;
}

export interface BenchmarkPayload {
  evaluation_protocol: string;
  model_card: JobResultPayload['model_metadata'];
  overall_metrics: BenchmarkMetrics;
  subgroup_breakdown: {
    subgroup_id: string;
    title: string;
    anatomy: string;
    evaluated_frames: number;
    metrics: BenchmarkMetrics;
  }[];
}
