import React, { useRef } from 'react';
import {
  Upload,
  Sliders,
  Film,
  Sparkles,
  CheckCircle,
  Loader2,
  Eye,
  Layers,
} from 'lucide-react';
import type {
  ProcessingSettings,
  SampleVideoItem,
  VideoMetadata,
} from '../types/scansure';

interface VideoUploadAndConfigPanelProps {
  samples: SampleVideoItem[];
  activeVideoMeta: VideoMetadata | null;
  settings: ProcessingSettings;
  topFramesCount: number;
  onChangeTopFramesCount: (count: number) => void;
  isProcessing: boolean;
  isUploading: boolean;
  uploadError: string | null;
  onSelectSample: (sample: SampleVideoItem) => void;
  onUploadFile: (file: File) => void;
  onUpdateSettings: (partial: Partial<ProcessingSettings>) => void;
  onRunPipeline: () => void;
}

export const VideoUploadAndConfigPanel: React.FC<VideoUploadAndConfigPanelProps> = ({
  samples,
  activeVideoMeta,
  settings,
  topFramesCount,
  onChangeTopFramesCount,
  isProcessing,
  isUploading,
  uploadError,
  onSelectSample,
  onUploadFile,
  onUpdateSettings,
  onRunPipeline,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
    }
  };

  return (
    <aside className="w-full lg:w-80 xl:w-[340px] shrink-0 flex flex-col gap-3">
      {/* 1. Clinical Study Selector Card */}
      <div className="bg-[#0E1524] border border-slate-800/90 rounded-xl p-3.5 shadow-lg">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-cyan-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              1. Ultrasound Study Input
            </h2>
          </div>
          <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-800/50 px-1.5 py-0.5 rounded">
            MP4 · AVI · MOV
          </span>
        </div>

        {/* Custom Video Upload Dropzone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          data-testid="video-upload-dropzone"
          className="border border-dashed border-slate-700/80 hover:border-cyan-500/60 bg-slate-900/60 rounded-lg p-3 text-center transition-all cursor-pointer"
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
            <div className="flex items-center justify-center gap-2 py-1 text-cyan-300 text-xs">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Validating Ultrasound Container...</span>
            </div>
          ) : (
            <>
              <Upload className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
              <p className="text-xs font-medium text-slate-200">
                Upload Handheld Ultrasound Video
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Click to browse local .mp4 / .avi / .mov file
              </p>
            </>
          )}
        </div>

        {uploadError && (
          <p className="mt-2 text-[11px] text-rose-400 bg-rose-950/40 border border-rose-800/50 rounded px-2.5 py-1.5">
            {uploadError}
          </p>
        )}

        {/* Built-in Offline Reference Ultrasound Videos */}
        <div className="mt-3 pt-2.5 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-medium text-slate-400">
              Built-in Rural Clinic Reference Studies:
            </p>
            <span className="text-[10px] font-mono text-slate-500">Instant Load</span>
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
                  className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-950/40 border-cyan-500/60 shadow-sm'
                      : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-100 leading-snug">
                      {sample.title}
                    </span>
                    {isSelected ? (
                      <CheckCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>
                      {sample.width}&times;{sample.height} · {sample.num_frames}f @ {sample.fps}fps
                    </span>
                    <span
                      className={
                        sample.expected_lesion_count === 0
                          ? 'text-emerald-400'
                          : 'text-amber-300'
                      }
                    >
                      {sample.expected_lesion_count === 0
                        ? 'Normal Control'
                        : `${sample.expected_lesion_count} Focal Region(s)`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Enhancement, AI Triage & Top High-Confidence Frames Card */}
      <div className="bg-[#0E1524] border border-slate-800/90 rounded-xl p-3.5 shadow-lg flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                2. Enhancement &amp; AI Triage
              </h2>
            </div>
            <span className="text-[10px] font-mono text-emerald-400">Physics-Locked</span>
          </div>

          <div className="space-y-3">
            {/* Denoise Operator */}
            <div>
              <label
                htmlFor="enhancement-method-select"
                className="block text-[11px] font-medium text-slate-300 mb-1"
              >
                Speckle Suppression Operator
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
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="speckle_bilateral_clahe">
                  Lee-Sigma + Bilateral + CLAHE (Recommended)
                </option>
                <option value="nlm_clahe">Non-Local Means (NLM) + CLAHE</option>
                <option value="median_clahe">3x3 Impulse Median + CLAHE</option>
                <option value="clahe_only">Adaptive CLAHE Contrast Only</option>
              </select>
            </div>

            {/* Denoise Strength */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-300">Speckle Suppression Strength</span>
                <span className="font-mono text-cyan-300 tabular-nums">
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

            {/* CLAHE Clip Limit */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-300">CLAHE Local Contrast Gain</span>
                <span className="font-mono text-cyan-300 tabular-nums">
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
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-300">Validated Detection Threshold</span>
                <span className="font-mono text-amber-300 tabular-nums">
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

            {/* High-Confidence Frames Count Selector */}
            <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-cyan-200">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Top High-Confidence Frames</span>
                </span>
                <span className="font-mono text-[11px] font-bold text-cyan-300">
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
                    className={`py-1 rounded text-[11px] font-mono font-semibold border transition-colors cursor-pointer ${
                      topFramesCount === count
                        ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            {/* Execution Target */}
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-[11px] text-slate-300">Compute Target</span>
              <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800">
                {(['auto', 'gpu', 'cpu'] as const).map((dev) => (
                  <button
                    key={dev}
                    type="button"
                    onClick={() => onUpdateSettings({ device: dev })}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase cursor-pointer ${
                      settings.device === dev
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {dev}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Execute Pipeline Action Button */}
        <button
          type="button"
          disabled={isProcessing || !activeVideoMeta}
          onClick={onRunPipeline}
          data-testid="run-pipeline-btn"
          className="mt-4 w-full py-2.5 px-4 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Running 8-Stage Pipeline...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Run Enhancement &amp; AI Triage</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
