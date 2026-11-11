import React, { useRef, useState } from 'react';
import {
  Upload,
  Sliders,
  Film,
  Sparkles,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Layers,
  Cpu,
  ShieldCheck,
} from 'lucide-react';
import type {
  ProcessingSettings,
  SampleVideoItem,
  VideoMetadata,
} from '../types/scansure';

interface VideoUploadAndConfigPanelProps {
  mode: 'step1_upload' | 'step2_config';
  samples: SampleVideoItem[];
  activeVideoMeta: VideoMetadata | null;
  settings: ProcessingSettings;
  topFramesCount: number;
  onChangeTopFramesCount: (count: number) => void;
  isUploading: boolean;
  uploadError: string | null;
  onSelectSample: (sample: SampleVideoItem) => void;
  onUploadFile: (file: File) => void;
  onUpdateSettings: (partial: Partial<ProcessingSettings>) => void;
  onProceedToConfig: () => void;
  onBackToUpload: () => void;
  onStartTriage: () => void;
}

export const VideoUploadAndConfigPanel: React.FC<VideoUploadAndConfigPanelProps> = ({
  mode,
  samples,
  activeVideoMeta,
  settings,
  topFramesCount,
  onChangeTopFramesCount,
  isUploading,
  uploadError,
  onSelectSample,
  onUploadFile,
  onUpdateSettings,
  onProceedToConfig,
  onBackToUpload,
  onStartTriage,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onUploadFile(file);
    }
  };

  const applyPreset = (preset: 'balanced' | 'high_contrast' | 'edge_preserving') => {
    if (preset === 'balanced') {
      onUpdateSettings({
        enhancement_method: 'speckle_bilateral_clahe',
        enhancement_strength: 0.75,
        clahe_clip_limit: 2.2,
        detection_threshold: 0.55,
      });
    } else if (preset === 'high_contrast') {
      onUpdateSettings({
        enhancement_method: 'nlm_clahe',
        enhancement_strength: 0.85,
        clahe_clip_limit: 3.0,
        detection_threshold: 0.52,
      });
    } else {
      onUpdateSettings({
        enhancement_method: 'median_clahe',
        enhancement_strength: 0.65,
        clahe_clip_limit: 1.8,
        detection_threshold: 0.58,
      });
    }
  };

  if (mode === 'step1_upload') {
    return (
      <section
        aria-label="Step 1: Ultrasound Video Upload"
        className="max-w-5xl w-full mx-auto py-2 sm:py-4"
      >
        {/* Step Title Banner */}
        <div className="mb-5 text-center sm:text-left flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-1 rounded-full mb-2">
              <Film className="w-3.5 h-3.5" />
              Step 1 of 4 · Video Input
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
              Select or Upload an Ultrasound Video
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Upload a raw B-mode ultrasound clip from your device or choose a reference clinical study below.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Left 7 Cols: Upload Dropzone + Reference Sample Cards */}
          <div className="lg:col-span-7 bg-[#0E1524] border border-slate-800/90 rounded-2xl p-4 sm:p-6 flex flex-col justify-between gap-5 shadow-xl">
            {/* Drag & Drop Upload Box */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                  Upload Your Ultrasound Video
                </span>
                <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-800/50 px-2 py-0.5 rounded">
                  MP4 · AVI · MOV · MKV
                </span>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                data-testid="video-upload-dropzone"
                className={`border-2 border-dashed rounded-xl p-5 sm:p-7 text-center transition-all cursor-pointer ${
                  dragActive
                    ? 'border-cyan-400 bg-cyan-500/10'
                    : 'border-slate-700/80 hover:border-cyan-400/60 bg-slate-900/60 hover:bg-slate-900/90'
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
                  <div className="flex flex-col items-center justify-center gap-2 py-2 text-cyan-300">
                    <Loader2 className="w-7 h-7 animate-spin" />
                    <span className="text-sm font-medium">
                      Validating Ultrasound Video Stream...
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="w-11 h-11 rounded-full bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center mx-auto mb-2.5 text-cyan-300">
                      <Upload className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-semibold text-slate-100">
                      Click to browse or drag &amp; drop ultrasound video
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Processes 100% offline on your device · Frame rate &amp; resolution preserved
                    </p>
                  </>
                )}
              </div>

              {uploadError && (
                <p className="mt-2.5 text-xs text-rose-300 bg-rose-950/50 border border-rose-800/60 rounded-lg px-3 py-2">
                  {uploadError}
                </p>
              )}
            </div>

            {/* Built-in Reference Studies */}
            <div className="pt-4 border-t border-slate-800/80">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Or Try a Built-In Rural Clinic Study
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Click any scan to preview
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {samples.map((sample) => {
                  const isSelected = activeVideoMeta?.filename === sample.filename;
                  return (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => onSelectSample(sample)}
                      data-testid={`sample-card-${sample.id}`}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-950/40 border-cyan-400/70 shadow-md'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
                            {sample.title}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-400">
                          <span>
                            {sample.width}&times;{sample.height}px
                          </span>
                          <span>·</span>
                          <span>
                            {sample.num_frames} frames ({sample.fps} FPS)
                          </span>
                          <span>·</span>
                          <span
                            className={
                              sample.expected_lesion_count === 0
                                ? 'text-emerald-400 font-semibold'
                                : 'text-amber-300 font-semibold'
                            }
                          >
                            {sample.expected_lesion_count === 0
                              ? 'Normal Control'
                              : `${sample.expected_lesion_count} Suspicious Region(s)`}
                          </span>
                        </div>
                      </div>

                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-cyan-400 text-slate-950'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right 5 Cols: Selected Raw Video Preview & Continue CTA */}
          <div className="lg:col-span-5 bg-[#0E1524] border border-slate-800/90 rounded-2xl p-4 sm:p-6 flex flex-col justify-between gap-4 shadow-xl">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                  Selected Raw Input Preview
                </span>
                <span className="text-[11px] font-mono text-amber-300 bg-amber-950/50 border border-amber-800/50 px-2 py-0.5 rounded">
                  Unenhanced Original
                </span>
              </div>

              {activeVideoMeta ? (
                <>
                  <div className="rounded-xl overflow-hidden border border-slate-800 bg-black aspect-[4/3] flex items-center justify-center relative">
                    {activeVideoMeta.video_url ? (
                      <video
                        key={activeVideoMeta.video_url}
                        src={activeVideoMeta.video_url}
                        controls
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-contain"
                        data-testid="step1-preview-video"
                      />
                    ) : (
                      <Film className="w-10 h-10 text-slate-600" />
                    )}
                  </div>

                  {/* Clean 4-pill Metadata Grid */}
                  <div className="mt-3.5 grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                      <span className="block text-[10px] font-mono uppercase text-slate-400">
                        File Name
                      </span>
                      <span className="font-mono text-slate-100 truncate block mt-0.5">
                        {activeVideoMeta.filename}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                      <span className="block text-[10px] font-mono uppercase text-slate-400">
                        Resolution &amp; Rate
                      </span>
                      <span className="font-mono text-slate-100 block mt-0.5">
                        {activeVideoMeta.resolution} @ {activeVideoMeta.fps} FPS
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                      <span className="block text-[10px] font-mono uppercase text-slate-400">
                        Total Frames
                      </span>
                      <span className="font-mono text-cyan-300 font-semibold block mt-0.5">
                        {activeVideoMeta.frame_count} Frames ({activeVideoMeta.duration_sec}s)
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                      <span className="block text-[10px] font-mono uppercase text-slate-400">
                        Container Status
                      </span>
                      <span className="font-mono text-emerald-400 font-semibold block mt-0.5">
                        ● Validated Ready
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="aspect-[4/3] rounded-xl border border-slate-800 bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
                  <Loader2 className="w-6 h-6 text-cyan-400 animate-spin mb-2" />
                  <span className="text-xs text-slate-400">Loading preview stream...</span>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={!activeVideoMeta || isUploading}
              onClick={onProceedToConfig}
              data-testid="step1-next-btn"
              className="w-full py-3.5 px-5 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <span>Next: Configure Video &amp; High-Confidence Frames</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    );
  }

  /* STEP 2: VIDEO CONFIGURATION & HIGH-CONFIDENCE FRAME SELECTION */
  return (
    <section
      aria-label="Step 2: Video Configuration and High-Confidence Frame Selection"
      className="max-w-5xl w-full mx-auto py-2 sm:py-4"
    >
      {/* Step 2 Header */}
      <div className="mb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-1 rounded-full mb-2">
            <Sliders className="w-3.5 h-3.5" />
            Step 2 of 4 · Enhancement &amp; Frame Selection
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
            Configure Denoising, Contrast &amp; High-Confidence Frames
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Choose a clinical preset or customize how many high-confidence frames to extract for the doctor report.
          </p>
        </div>

        <button
          type="button"
          onClick={onBackToUpload}
          data-testid="step2-back-btn"
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Change Video</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left 7 Cols: Presets + Denoising & Contrast Sliders */}
        <div className="lg:col-span-7 bg-[#0E1524] border border-slate-800/90 rounded-2xl p-4 sm:p-6 flex flex-col justify-between gap-5 shadow-xl">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2.5">
              Quick Clinical Enhancement Presets
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-5">
              <button
                type="button"
                onClick={() => applyPreset('balanced')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  settings.enhancement_method === 'speckle_bilateral_clahe'
                    ? 'bg-cyan-950/50 border-cyan-400 text-cyan-100 shadow-sm'
                    : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span className="block text-xs font-bold">Balanced Rural Scan</span>
                <span className="block text-[11px] text-slate-400 mt-0.5">
                  Lee-Sigma + 2.2x CLAHE
                </span>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('high_contrast')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  settings.enhancement_method === 'nlm_clahe'
                    ? 'bg-cyan-950/50 border-cyan-400 text-cyan-100 shadow-sm'
                    : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span className="block text-xs font-bold">Deep High-Contrast</span>
                <span className="block text-[11px] text-slate-400 mt-0.5">
                  NLM Patch + 3.0x CLAHE
                </span>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('edge_preserving')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  settings.enhancement_method === 'median_clahe'
                    ? 'bg-cyan-950/50 border-cyan-400 text-cyan-100 shadow-sm'
                    : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span className="block text-xs font-bold">Gentle Boundary</span>
                <span className="block text-[11px] text-slate-400 mt-0.5">
                  Median + 1.8x CLAHE
                </span>
              </button>
            </div>

            <div className="space-y-4 pt-3 border-t border-slate-800/80">
              {/* Filter Operator */}
              <div>
                <label
                  htmlFor="step2-method-select"
                  className="block text-xs font-medium text-slate-200 mb-1.5"
                >
                  Speckle Noise Suppression Method
                </label>
                <select
                  id="step2-method-select"
                  value={settings.enhancement_method}
                  onChange={(e) =>
                    onUpdateSettings({
                      enhancement_method: e.target
                        .value as ProcessingSettings['enhancement_method'],
                    })
                  }
                  data-testid="select-denoise-method"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-cyan-400"
                >
                  <option value="speckle_bilateral_clahe">
                    Lee-Sigma + Bilateral Edge-Preserving + CLAHE (Recommended)
                  </option>
                  <option value="nlm_clahe">Non-Local Means (NLM) Patch + CLAHE</option>
                  <option value="median_clahe">3x3 Impulse Median + CLAHE</option>
                  <option value="clahe_only">Adaptive CLAHE Contrast Only</option>
                </select>
              </div>

              {/* Denoising Strength */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium">
                    Speckle Denoising Strength
                  </span>
                  <span className="font-mono font-bold text-cyan-300">
                    {Math.round(settings.enhancement_strength * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={1.0}
                  step={0.05}
                  value={settings.enhancement_strength}
                  onChange={(e) =>
                    onUpdateSettings({ enhancement_strength: parseFloat(e.target.value) })
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Contrast Gain */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium">
                    CLAHE Local Contrast Enhancement
                  </span>
                  <span className="font-mono font-bold text-cyan-300">
                    {settings.clahe_clip_limit.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={1.0}
                  max={4.0}
                  step={0.1}
                  value={settings.clahe_clip_limit}
                  onChange={(e) =>
                    onUpdateSettings({ clahe_clip_limit: parseFloat(e.target.value) })
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* AI Confidence Threshold */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium">
                    Minimum AI Confidence Threshold
                  </span>
                  <span className="font-mono font-bold text-amber-300">
                    {Math.round(settings.detection_threshold * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.35}
                  max={0.85}
                  step={0.01}
                  value={settings.detection_threshold}
                  onChange={(e) =>
                    onUpdateSettings({ detection_threshold: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: User-Selectable High-Confidence Frame Count + Launch Triage */}
        <div className="lg:col-span-5 bg-[#0E1524] border border-slate-800/90 rounded-2xl p-4 sm:p-6 flex flex-col justify-between gap-5 shadow-xl">
          <div className="space-y-4">
            {/* High-Confidence Frame Count Selector Card */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-950/40 via-slate-900/90 to-slate-900/90 border border-cyan-500/40">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-200">
                    High-Confidence Frames to Extract
                  </h2>
                </div>
                <span
                  data-testid="selected-top-frames-badge"
                  className="px-2.5 py-0.5 rounded-full bg-cyan-400 text-slate-950 font-mono font-bold text-xs"
                >
                  Top {topFramesCount} {topFramesCount === 1 ? 'Frame' : 'Frames'}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed mb-3">
                Select how many annotated frames with the <strong>highest AI confidence scores</strong> you want extracted for visual inspection and the Doctor PDF/JSON report:
              </p>

              {/* Quick Count Buttons */}
              <div className="grid grid-cols-5 gap-1.5 mb-3">
                {[2, 4, 6, 8, 12].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => {
                      onChangeTopFramesCount(count);
                      onUpdateSettings({ top_k_frames: count });
                    }}
                    data-testid={`top-frames-btn-${count}`}
                    className={`py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all cursor-pointer ${
                      topFramesCount === count
                        ? 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-sm'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>

              {/* Fine Slider 1 to 12 */}
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-slate-400">1</span>
                <input
                  type="range"
                  min={1}
                  max={12}
                  step={1}
                  value={topFramesCount}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    onChangeTopFramesCount(val);
                    onUpdateSettings({ top_k_frames: val });
                  }}
                  data-testid="top-frames-slider"
                  className="flex-1 accent-cyan-400 cursor-pointer"
                />
                <span className="text-[11px] font-mono text-slate-400">12</span>
              </div>
            </div>

            {/* Auto-Adjusted Device & Execution Target */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span>Hardware Compute Mode</span>
                </div>
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  {(['auto', 'gpu', 'cpu'] as const).map((dev) => (
                    <button
                      key={dev}
                      type="button"
                      onClick={() => onUpdateSettings({ device: dev })}
                      className={`px-2.5 py-1 rounded text-[11px] font-mono uppercase cursor-pointer ${
                        settings.device === dev
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {dev}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-emerald-300 font-mono">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Auto-calibrated for jio-fiber (i5-13420H + RTX 3050 6GB) · 100% Offline
                </span>
              </div>
            </div>
          </div>

          {/* Primary Launch Button */}
          <button
            type="button"
            onClick={onStartTriage}
            data-testid="step2-start-triage-btn"
            className="w-full py-3.5 px-5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Start Enhancement &amp; AI Triage</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
