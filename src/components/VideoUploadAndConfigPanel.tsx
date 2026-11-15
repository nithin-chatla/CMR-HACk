import React, { useRef, useState } from 'react';
import {
  Upload,
  Sliders,
  Film,
  CheckCircle2,
  Loader2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Play,
  Layers,
} from 'lucide-react';
import type {
  ProcessingSettings,
  SampleVideoItem,
  VideoMetadata,
} from '../types/scansure';
import { ENHANCEMENT_METHOD_INFO } from '../utils/ultrasoundAnalytics';

interface VideoUploadAndConfigPanelProps {
  samples: SampleVideoItem[];
  activeVideoMeta: VideoMetadata | null;
  settings: ProcessingSettings;
  topFramesCount: number;
  onChangeTopFramesCount: (count: number) => void;
  isProcessing: boolean;
  progressStage?: string;
  progressPct?: number;
  framesProcessed?: number;
  totalFrames?: number;
  isUploading: boolean;
  uploadError: string | null;
  uploadErrorDetails?: string | null;
  activeLeftSection?: 'study' | 'enhance' | 'both';
  onSelectSample: (sample: SampleVideoItem) => void;
  onUploadFile: (file: File) => void;
  onUpdateSettings: (partial: Partial<ProcessingSettings>) => void;
  onResetSettings: () => void;
  onRunPipeline: () => void;
}

export const VideoUploadAndConfigPanel: React.FC<VideoUploadAndConfigPanelProps> = ({
  samples,
  activeVideoMeta,
  settings,
  topFramesCount,
  onChangeTopFramesCount,
  isProcessing,
  progressStage = 'Processing frames...',
  progressPct = 0,
  framesProcessed = 0,
  totalFrames = 45,
  isUploading,
  uploadError,
  uploadErrorDetails,
  onSelectSample,
  onUploadFile,
  onUpdateSettings,
  onResetSettings,
  onRunPipeline,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showErrorDiag, setShowErrorDiag] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onUploadFile(file);
    }
  };

  const activeMethodInfo =
    ENHANCEMENT_METHOD_INFO[settings.enhancement_method] ||
    ENHANCEMENT_METHOD_INFO.speckle_bilateral_clahe;

  return (
    <aside
      aria-label="Study Input and Enhancement Configuration"
      className="w-full lg:w-[320px] xl:w-[340px] shrink-0 flex flex-col gap-4"
    >
      {/* PANEL 1: STUDY AND INPUT */}
      <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-[#0F172A] dark:text-sky-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              1. Study &amp; Input
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            MP4 · AVI · MOV · MKV
          </span>
        </div>

        {/* Drag and Drop Upload Area */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          data-testid="video-upload-dropzone"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`border border-dashed rounded-lg p-3.5 text-center transition-colors cursor-pointer ${
            isDragging
              ? 'border-teal-600 bg-teal-50/60 dark:border-sky-400 dark:bg-sky-950/30'
              : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/80 dark:bg-slate-900/60'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp4,.avi,.mov,.mkv,video/*"
            onChange={handleFileChange}
            className="hidden"
            data-testid="video-file-input"
          />
          {isUploading ? (
            <div className="flex items-center justify-center gap-2 py-1 text-teal-700 dark:text-sky-300 text-sm font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Validating video container...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <Upload className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Upload Ultrasound Video
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Drag and drop or click to browse local file
              </span>
            </div>
          )}
        </div>

        {/* User-Friendly Error Alert with Collapsible Diagnostic Details */}
        {uploadError && (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-800 dark:text-red-200"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium leading-snug">{uploadError}</p>
                {uploadErrorDetails && (
                  <div className="mt-1.5">
                    <button
                      type="button"
                      onClick={() => setShowErrorDiag((v) => !v)}
                      className="text-[11px] font-medium underline text-red-700 dark:text-red-300 cursor-pointer"
                    >
                      {showErrorDiag ? 'Hide technical diagnostic' : 'Show technical diagnostic'}
                    </button>
                    {showErrorDiag && (
                      <pre className="mt-1.5 p-2 rounded bg-white/80 dark:bg-slate-950 text-[11px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap">
                        {uploadErrorDetails}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Compact Active Study Summary */}
        {activeVideoMeta ? (
          <div
            data-testid="active-study-summary"
            className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs"
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <span
                className="font-semibold text-slate-900 dark:text-slate-100 truncate"
                title={activeVideoMeta.filename}
              >
                {activeVideoMeta.filename}
              </span>
              <span className="inline-flex items-center gap-1 text-teal-700 dark:text-teal-400 font-medium shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Valid</span>
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-y-1.5 gap-x-3 text-slate-600 dark:text-slate-400">
              <div className="flex justify-between">
                <span>Resolution:</span>
                <span className="font-mono tabular-nums text-slate-900 dark:text-slate-200">
                  {activeVideoMeta.resolution}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Frame Rate:</span>
                <span className="font-mono tabular-nums text-slate-900 dark:text-slate-200">
                  {activeVideoMeta.fps} FPS
                </span>
              </div>
              <div className="flex justify-between">
                <span>Duration:</span>
                <span className="font-mono tabular-nums text-slate-900 dark:text-slate-200">
                  {activeVideoMeta.duration_sec}s ({activeVideoMeta.frame_count}f)
                </span>
              </div>
              <div className="flex justify-between">
                <span>File Size:</span>
                <span className="font-mono tabular-nums text-slate-900 dark:text-slate-200">
                  {activeVideoMeta.file_size_mb} MB
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 text-center">
            No ultrasound study loaded. Upload a video file or select a reference study below.
          </div>
        )}

        {/* Reference / Sample Studies */}
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Reference Studies
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">Offline Library</span>
          </div>
          <div className="space-y-1.5">
            {samples.map((sample) => {
              const isSelected = activeVideoMeta?.filename === sample.filename;
              return (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => onSelectSample(sample)}
                  data-testid={`sample-card-${sample.id}`}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-sky-500/15 dark:text-slate-100 dark:border-sky-500/60'
                      : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium truncate">{sample.title}</span>
                    <span
                      className={`text-[11px] font-mono shrink-0 ${
                        isSelected
                          ? 'text-teal-300 dark:text-sky-300'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {sample.num_frames}f · {sample.fps}fps
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* PANEL 2: ENHANCEMENT & AI ANALYSIS CONTROLS */}
      <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#0F172A] dark:text-sky-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              2. Enhancement &amp; AI Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onResetSettings}
            title="Reset settings to default clinical calibration"
            data-testid="reset-settings-btn"
            className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>

        {/* Group A: Image Enhancement */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-1">
            Image Enhancement
          </div>

          <div>
            <label
              htmlFor="enhancement-method-select"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Denoising &amp; Contrast Method
            </label>
            <select
              id="enhancement-method-select"
              value={settings.enhancement_method}
              onChange={(e) =>
                onUpdateSettings({
                  enhancement_method: e.target
                    .value as ProcessingSettings['enhancement_method'],
                })
              }
              data-testid="select-denoise-method"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-sky-500"
            >
              <option value="speckle_bilateral_clahe">
                Lee-Sigma + Bilateral + CLAHE (Default)
              </option>
              <option value="aberdeen_fuzzy_adf_clahe">
                Aberdeen LFIT Fuzzy + Anisotropic Diffusion + CLAHE
              </option>
              <option value="nlm_clahe">Non-Local Means (NLM) + CLAHE</option>
              <option value="median_clahe">3×3 Impulse Median + CLAHE</option>
              <option value="clahe_only">Adaptive CLAHE Contrast Only</option>
            </select>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {activeMethodInfo.description}
            </p>
          </div>

          {/* Denoising Strength */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <label
                htmlFor="denoise-strength-slider"
                className="font-medium text-slate-700 dark:text-slate-300"
              >
                Denoising Strength
              </label>
              <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-sky-300">
                {Math.round(settings.enhancement_strength * 100)}%
              </span>
            </div>
            <input
              id="denoise-strength-slider"
              type="range"
              min={0.2}
              max={1.0}
              step={0.05}
              value={settings.enhancement_strength}
              onChange={(e) =>
                onUpdateSettings({ enhancement_strength: parseFloat(e.target.value) })
              }
              className="w-full accent-[#0F172A] dark:accent-sky-400 cursor-pointer"
            />
          </div>

          {/* Contrast Enhancement (CLAHE) */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <label
                htmlFor="clahe-gain-slider"
                className="font-medium text-slate-700 dark:text-slate-300"
              >
                Contrast Enhancement (CLAHE)
              </label>
              <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-sky-300">
                {settings.clahe_clip_limit.toFixed(1)}x
              </span>
            </div>
            <input
              id="clahe-gain-slider"
              type="range"
              min={1.0}
              max={4.0}
              step={0.1}
              value={settings.clahe_clip_limit}
              onChange={(e) =>
                onUpdateSettings({ clahe_clip_limit: parseFloat(e.target.value) })
              }
              className="w-full accent-[#0F172A] dark:accent-sky-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Group B: AI Analysis */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              AI Anomaly Analysis
            </span>
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.ai_detection_enabled}
                onChange={(e) =>
                  onUpdateSettings({ ai_detection_enabled: e.target.checked })
                }
                className="rounded border-slate-300 text-slate-900 dark:text-sky-500"
              />
              <span>Enabled</span>
            </label>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <label
                htmlFor="detection-threshold-slider"
                className="font-medium text-slate-700 dark:text-slate-300"
              >
                Detection Score Threshold
              </label>
              <span className="font-mono tabular-nums font-semibold text-teal-700 dark:text-amber-300">
                {settings.detection_threshold.toFixed(2)} ({Math.round(settings.detection_threshold * 100)}%)
              </span>
            </div>
            <input
              id="detection-threshold-slider"
              type="range"
              min={0.35}
              max={0.85}
              step={0.01}
              disabled={!settings.ai_detection_enabled}
              value={settings.detection_threshold}
              onChange={(e) =>
                onUpdateSettings({ detection_threshold: parseFloat(e.target.value) })
              }
              className="w-full accent-teal-600 dark:accent-amber-400 cursor-pointer disabled:opacity-40"
            />
          </div>

          {/* High-Confidence Keyframe Count */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                <Layers className="w-3.5 h-3.5 text-teal-600 dark:text-sky-400" />
                <span>High-Score Keyframes</span>
              </span>
              <span className="font-mono text-xs font-semibold text-slate-900 dark:text-sky-300">
                Top {topFramesCount}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {[2, 4, 6, 8, 12].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => {
                    onChangeTopFramesCount(count);
                    onUpdateSettings({ top_k_frames: count });
                  }}
                  data-testid={`sidebar-top-frames-${count}`}
                  className={`py-1.5 rounded-md text-xs font-mono font-semibold border transition-colors cursor-pointer ${
                    topFramesCount === count
                      ? 'bg-[#0F172A] text-white border-[#0F172A] dark:bg-sky-500 dark:text-slate-950 dark:border-sky-400'
                      : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Expandable Advanced Technical Settings */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-2.5">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
            data-testid="toggle-advanced-settings-btn"
            className="w-full flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 py-1 cursor-pointer"
          >
            <span>Advanced Technical Settings</span>
            {showAdvanced ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-600 dark:text-slate-400">Gamma Adjustment</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-200">
                    {settings.gamma.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.7}
                  max={1.5}
                  step={0.05}
                  value={settings.gamma}
                  onChange={(e) =>
                    onUpdateSettings({ gamma: parseFloat(e.target.value) })
                  }
                  className="w-full accent-[#0F172A] dark:accent-sky-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-600 dark:text-slate-400">
                    Temporal Stabilization (EMA)
                  </span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-200">
                    {settings.temporal_alpha.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={0.5}
                  step={0.02}
                  value={settings.temporal_alpha}
                  onChange={(e) =>
                    onUpdateSettings({ temporal_alpha: parseFloat(e.target.value) })
                  }
                  className="w-full accent-[#0F172A] dark:accent-sky-400 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">Processing Device</span>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-0.5 rounded-md border border-slate-200 dark:border-slate-800">
                  {(['auto', 'gpu', 'cpu'] as const).map((dev) => (
                    <button
                      key={dev}
                      type="button"
                      onClick={() => onUpdateSettings({ device: dev })}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase cursor-pointer ${
                        settings.device === dev
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-sky-300 font-semibold shadow-2xs'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {dev}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Model Architecture:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    ScanSure-UNet-Lite v1.2
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Supported Anatomy:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    B-Mode Breast Ultrasound
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Non-Blocking Processing Progress Indicator */}
        {isProcessing && (
          <div
            role="status"
            aria-live="polite"
            className="p-3 rounded-lg bg-teal-50/90 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/80 text-xs space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-teal-900 dark:text-teal-200 truncate">
                {progressStage}
              </span>
              <span className="font-mono font-bold tabular-nums text-teal-800 dark:text-teal-300">
                {Math.round(progressPct)}%
              </span>
            </div>
            <div className="w-full h-2 bg-teal-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-600 dark:bg-teal-400 transition-all duration-200"
                style={{ width: `${Math.min(100, Math.max(5, progressPct))}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-teal-700 dark:text-teal-300/80">
              <span>
                Frames: {framesProcessed} / {totalFrames}
              </span>
              <span>Non-blocking local worker</span>
            </div>
          </div>
        )}

        {/* Apply Settings Button */}
        <button
          type="button"
          disabled={isProcessing || !activeVideoMeta}
          onClick={onRunPipeline}
          data-testid="run-pipeline-btn"
          className="w-full py-2.5 px-4 rounded-lg bg-[#0F172A] hover:bg-slate-800 dark:bg-sky-500 dark:hover:bg-sky-400 disabled:opacity-50 text-white dark:text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processing Study ({Math.round(progressPct)}%)...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>Apply Enhancement &amp; AI Analysis</span>
            </>
          )}
        </button>
      </section>
    </aside>
  );
};
