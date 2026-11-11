import React, { useRef, useState } from 'react';
import { Upload, Play, RotateCcw } from 'lucide-react';
import type {
  ProcessingSettings,
  SampleVideoItem,
  VideoMetadata,
} from '../types/scansure';

interface VideoUploadAndConfigPanelProps {
  samples: SampleVideoItem[];
  selectedSampleId: string;
  inputVideoMeta: VideoMetadata | null;
  settings: ProcessingSettings;
  isProcessing: boolean;
  progressState: {
    stage: string;
    progress_pct: number;
    frames_processed: number;
    total_frames: number;
    eta_sec: number;
  } | null;
  uploadError: string | null;
  onSelectSample: (sample: SampleVideoItem) => void;
  onUploadFile: (file: File) => void;
  onChangeSettings: (next: ProcessingSettings) => void;
  onResetDefaults: () => void;
  onStartProcessing: () => void;
}

export const VideoUploadAndConfigPanel: React.FC<VideoUploadAndConfigPanelProps> = ({
  samples,
  selectedSampleId,
  inputVideoMeta,
  settings,
  isProcessing,
  progressState,
  uploadError,
  onSelectSample,
  onUploadFile,
  onChangeSettings,
  onResetDefaults,
  onStartProcessing,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onUploadFile(file);
    }
  };

  return (
    <aside
      aria-label="Ultrasound Input and Processing Controls"
      className="w-full lg:w-[360px] shrink-0 bg-[#0B0E17] border border-slate-800 rounded-lg p-5 flex flex-col gap-6"
    >
      {/* Section B: Upload & Clinical Sample Selection */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <h2 className="text-sm font-semibold text-slate-100 whitespace-nowrap">
            01. Ultrasound Video Input
          </h2>
          <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap shrink-0">
            MP4 · AVI · MOV · MKV
          </span>
        </div>

        {/* Drag and drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border border-dashed rounded-md p-3.5 transition-colors ${
            isDragging
              ? 'border-cyan-400 bg-cyan-950/20'
              : 'border-slate-700 bg-[#07090E]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            id="ultrasound-video-upload"
            accept=".mp4,.avi,.mov,.mkv,video/mp4,video/x-msvideo,video/quicktime,video/x-matroska"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUploadFile(file);
            }}
          />
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-slate-300 leading-relaxed">
              <p className="font-medium text-slate-200">
                Drag and drop ultrasound video
              </p>
              <p className="text-slate-400">
                Original input file is never modified
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 text-xs font-medium text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              Browse Video
            </button>
          </div>
        </div>

        {uploadError && (
          <p role="alert" className="mt-2 text-xs text-rose-400 font-medium">
            ✖ {uploadError}
          </p>
        )}

        {/* Clinical Phantom Preset Selector */}
        <div className="mt-3">
          <label
            htmlFor="clinical-sample-select"
            className="block text-xs text-slate-400 mb-1"
          >
            Or load local B-mode breast ultrasound phantom cine loop:
          </label>
          <select
            id="clinical-sample-select"
            value={selectedSampleId}
            onChange={(e) => {
              const found = samples.find((s) => s.id === e.target.value);
              if (found) onSelectSample(found);
            }}
            className="w-full px-3 py-2 text-xs bg-[#07090E] border border-slate-700 rounded text-slate-100 focus-visible:outline-2 focus-visible:outline-cyan-400"
          >
            {samples.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>

        {/* Input Video Metadata Telemetry Table */}
        {inputVideoMeta && (
          <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs">
            <div className="flex items-center justify-between py-1 text-slate-300">
              <span className="text-slate-400">Filename</span>
              <span className="font-mono text-slate-100 truncate max-w-[200px]" title={inputVideoMeta.filename}>
                {inputVideoMeta.filename}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 text-slate-300">
              <span className="text-slate-400">Resolution · Codec</span>
              <span className="font-mono tabular-nums text-slate-100">
                {inputVideoMeta.resolution} · {inputVideoMeta.video_codec.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 text-slate-300">
              <span className="text-slate-400">Frame Rate · Count</span>
              <span className="font-mono tabular-nums text-slate-100">
                {inputVideoMeta.fps} FPS · {inputVideoMeta.frame_count} frames
              </span>
            </div>
            <div className="flex items-center justify-between py-1 text-slate-300">
              <span className="text-slate-400">Duration · Size</span>
              <span className="font-mono tabular-nums text-slate-100">
                {inputVideoMeta.duration_sec}s · {inputVideoMeta.file_size_mb} MB
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Section C: Processing Settings */}
      <div className="pt-4 border-t border-slate-800 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100">
            02. Processing Parameters
          </h2>
          <button
            type="button"
            onClick={onResetDefaults}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>

        {/* Denoising Method */}
        <div>
          <label
            htmlFor="denoising-method-select"
            className="block text-xs text-slate-300 mb-1"
          >
            Denoising & Contrast Pipeline
          </label>
          <select
            id="denoising-method-select"
            value={settings.enhancement_method}
            onChange={(e) =>
              onChangeSettings({
                ...settings,
                enhancement_method: e.target.value as ProcessingSettings['enhancement_method'],
              })
            }
            className="w-full px-3 py-2 text-xs bg-[#07090E] border border-slate-700 rounded text-slate-100"
          >
            <option value="speckle_bilateral_clahe">
              Lee-Bilateral Despeckle + Bilinear CLAHE (Recommended)
            </option>
            <option value="nlm_clahe">
              Non-Local Means (NLM) Patch Despeckle + CLAHE
            </option>
            <option value="median_clahe">
              3x3 Impulse Median Filter + CLAHE
            </option>
            <option value="clahe_only">
              Bilinear CLAHE Contrast Only (No Spatial Smoothing)
            </option>
          </select>
        </div>

        {/* Enhancement Strength */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <label htmlFor="enhancement-strength-slider" className="text-slate-300">
              Enhancement Strength
            </label>
            <span className="font-mono tabular-nums text-cyan-400">
              {Math.round(settings.enhancement_strength * 100)}%
            </span>
          </div>
          <input
            id="enhancement-strength-slider"
            type="range"
            min="0.10"
            max="1.00"
            step="0.05"
            value={settings.enhancement_strength}
            onChange={(e) =>
              onChangeSettings({
                ...settings,
                enhancement_strength: parseFloat(e.target.value),
              })
            }
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>

        {/* Contrast Adjustment (CLAHE Clip Limit & Gamma) */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <label htmlFor="clahe-clip-slider" className="text-slate-300">
                CLAHE Clip
              </label>
              <span className="font-mono tabular-nums text-slate-200">
                {settings.clahe_clip_limit.toFixed(1)}
              </span>
            </div>
            <input
              id="clahe-clip-slider"
              type="range"
              min="1.2"
              max="4.0"
              step="0.2"
              value={settings.clahe_clip_limit}
              onChange={(e) =>
                onChangeSettings({
                  ...settings,
                  clahe_clip_limit: parseFloat(e.target.value),
                })
              }
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <label htmlFor="gamma-slider" className="text-slate-300">
                Acoustic Gamma
              </label>
              <span className="font-mono tabular-nums text-slate-200">
                {settings.gamma.toFixed(2)}
              </span>
            </div>
            <input
              id="gamma-slider"
              type="range"
              min="0.75"
              max="1.45"
              step="0.05"
              value={settings.gamma}
              onChange={(e) =>
                onChangeSettings({
                  ...settings,
                  gamma: parseFloat(e.target.value),
                })
              }
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>
        </div>

        {/* AI Anomaly Detection Toggle & Threshold */}
        <div className="pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="ai-detection-checkbox"
              className="text-xs font-medium text-slate-200 cursor-pointer"
            >
              AI Anomaly Segmentation (U-Net Lite)
            </label>
            <input
              id="ai-detection-checkbox"
              type="checkbox"
              checked={settings.ai_detection_enabled}
              onChange={(e) =>
                onChangeSettings({
                  ...settings,
                  ai_detection_enabled: e.target.checked,
                })
              }
              className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between text-xs mb-1">
            <label htmlFor="detection-threshold-slider" className="text-slate-300">
              Validated Detection Threshold
            </label>
            <span className="font-mono tabular-nums text-cyan-400">
              {settings.detection_threshold.toFixed(2)}
            </span>
          </div>
          <input
            id="detection-threshold-slider"
            type="range"
            min="0.35"
            max="0.85"
            step="0.05"
            disabled={!settings.ai_detection_enabled}
            value={settings.detection_threshold}
            onChange={(e) =>
              onChangeSettings({
                ...settings,
                detection_threshold: parseFloat(e.target.value),
              })
            }
            className="w-full accent-cyan-400 cursor-pointer disabled:opacity-40"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Regions scoring below {settings.detection_threshold.toFixed(2)} are suppressed. Scores below 0.72 are flagged as Uncertain.
          </p>
        </div>

        {/* Output Resolution & Processing Device */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label
              htmlFor="output-resolution-select"
              className="block text-xs text-slate-300 mb-1"
            >
              Output Resolution
            </label>
            <select
              id="output-resolution-select"
              value={settings.output_resolution}
              onChange={(e) =>
                onChangeSettings({
                  ...settings,
                  output_resolution: e.target.value as ProcessingSettings['output_resolution'],
                })
              }
              className="w-full px-2.5 py-1.5 text-xs bg-[#07090E] border border-slate-700 rounded text-slate-100"
            >
              <option value="original">Original ({inputVideoMeta?.resolution || '320x240'})</option>
              <option value="320x240">320x240 (Standard)</option>
              <option value="480x360">480x360 (Medium)</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="processing-device-select"
              className="block text-xs text-slate-300 mb-1"
            >
              Execution Device
            </label>
            <select
              id="processing-device-select"
              value={settings.device}
              onChange={(e) =>
                onChangeSettings({
                  ...settings,
                  device: e.target.value as ProcessingSettings['device'],
                })
              }
              className="w-full px-2.5 py-1.5 text-xs bg-[#07090E] border border-slate-700 rounded text-slate-100"
            >
              <option value="auto">Auto (Hardware Detect)</option>
              <option value="cpu">CPU (FP32 Deterministic)</option>
              <option value="gpu">GPU (CUDA if Present)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Section D: Start Processing & Live Progress */}
      <div className="pt-3 border-t border-slate-800">
        <button
          type="button"
          onClick={onStartProcessing}
          disabled={isProcessing || !inputVideoMeta}
          className="w-full py-2.5 px-4 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <Play className="w-4 h-4 fill-current" />
          {isProcessing ? 'Running Offline Video Pipeline...' : 'Start Processing'}
        </button>

        {isProcessing && progressState && (
          <div className="mt-3 p-3 bg-[#07090E] border border-slate-800 rounded text-xs">
            <div className="flex items-center justify-between text-slate-200 mb-1">
              <span className="truncate pr-2 font-medium">{progressState.stage}</span>
              <span className="font-mono tabular-nums text-cyan-400">
                {progressState.progress_pct.toFixed(0)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-cyan-400 transition-transform duration-150 origin-left"
                style={{ transform: `scaleX(${Math.min(1, progressState.progress_pct / 100)})` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-400">
              <span>
                Frames: {progressState.frames_processed} / {progressState.total_frames}
              </span>
              <span>ETA: {progressState.eta_sec.toFixed(1)}s</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
