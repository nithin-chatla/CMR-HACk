import React from 'react';
import { CheckCircle2, Loader2, Activity, Sparkles } from 'lucide-react';

interface PipelineLoaderOverlayProps {
  stage: string;
  progressPct: number;
  framesProcessed: number;
  totalFrames: number;
  etaSec: number;
  videoFilename?: string;
  topFramesCount?: number;
}

const PIPELINE_STEPS = [
  { id: 1, label: 'Validating Ultrasound Video Container & Frame Stream', threshold: 5 },
  { id: 2, label: 'Extracting Raw B-Mode Frames & Speckle Quality Probe', threshold: 20 },
  { id: 3, label: 'Applying Lee-Sigma Despeckling & Bilinear CLAHE Contrast', threshold: 45 },
  { id: 4, label: 'Executing ScanSure-UNet-Lite Anomaly Segmentation', threshold: 70 },
  { id: 5, label: 'Ranking Top High-Confidence Frames & Millimeter Calipers', threshold: 86 },
  { id: 6, label: 'Building Synchronized MP4 Videos & Doctor Reports (PDF/JSON)', threshold: 95 },
];

export const PipelineLoaderOverlay: React.FC<PipelineLoaderOverlayProps> = ({
  stage,
  progressPct,
  framesProcessed,
  totalFrames,
  etaSec,
  videoFilename = 'breast_ultrasound_cyst_case01.mp4',
  topFramesCount = 4,
}) => {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-label="Step 3: Live Enhancement and AI Triage Process"
      className="max-w-3xl w-full mx-auto py-4 sm:py-8"
    >
      <div className="mb-5 text-center">
        <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 rounded-full mb-2">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          Step 3 of 4 · Live Working Process
        </span>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100">
          Enhancing Ultrasound &amp; Detecting Anomalies...
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Processing <span className="font-mono text-slate-200">{videoFilename}</span> and ranking top{' '}
          <strong className="text-cyan-300">{topFramesCount}</strong> high-confidence frames.
        </p>
      </div>

      <div className="bg-[#0E1524] border border-slate-800/90 rounded-2xl p-5 sm:p-7 flex flex-col gap-5 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center shrink-0">
              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-semibold text-slate-100 truncate">
                {stage}
              </h2>
              <p className="text-xs text-cyan-400 font-mono mt-0.5">
                100% Offline Local Execution · Frame-Synchronized Pipeline
              </p>
            </div>
          </div>
          <span
            data-testid="live-progress-pct"
            className="text-2xl sm:text-3xl font-mono font-bold tabular-nums text-cyan-300 shrink-0"
          >
            {Math.round(progressPct)}%
          </span>
        </div>

        {/* Smooth Progress Bar */}
        <div className="w-full h-3 bg-slate-900 border border-slate-800 rounded-full overflow-hidden p-0.5">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-200"
            style={{ width: `${Math.min(100, Math.max(5, progressPct))}%` }}
          />
        </div>

        {/* Step-by-Step Pipeline Checklist */}
        <div className="grid grid-cols-1 gap-2 pt-1">
          {PIPELINE_STEPS.map((s) => {
            const isDone = progressPct > s.threshold + 12;
            const isCurrent = !isDone && progressPct >= s.threshold - 8;
            return (
              <div
                key={s.id}
                className={`flex items-center justify-between gap-3 text-xs sm:text-sm py-2.5 px-3.5 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-cyan-950/40 border-cyan-400/50 text-slate-100 font-semibold shadow-sm'
                    : isDone
                    ? 'bg-emerald-950/20 border-emerald-800/40 text-slate-200'
                    : 'bg-slate-900/40 border-slate-800/60 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
                  ) : (
                    <Activity className="w-4 h-4 text-slate-600 shrink-0" />
                  )}
                  <span className="truncate">{s.label}</span>
                </div>
                <span
                  className={`font-mono text-[11px] px-2 py-0.5 rounded shrink-0 ${
                    isDone
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : isCurrent
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'text-slate-600'
                  }`}
                >
                  {isDone ? 'Done' : isCurrent ? 'Working...' : 'Waiting'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Frame Counter & ETA Footer */}
        <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums text-slate-400">
          <span>
            Frames Processed: <strong className="text-slate-100">{framesProcessed}</strong> /{' '}
            {totalFrames}
          </span>
          <span>Estimated Remaining: {etaSec.toFixed(1)}s</span>
        </div>
      </div>
    </section>
  );
};
