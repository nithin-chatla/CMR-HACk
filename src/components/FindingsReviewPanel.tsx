import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  FileText,
  Download,
  Crosshair,
  Clock,
  Info,
} from 'lucide-react';
import type { JobResultPayload } from '../types/scansure';
import type { ZoomableMediaItem } from './MediaZoomModal';
import {
  filterTimelineByThreshold,
  selectTopConfidenceKeyframes,
} from '../utils/ultrasoundAnalytics';

interface FindingsReviewPanelProps {
  jobResult: JobResultPayload | null;
  activeThreshold: number;
  selectedFrame: number;
  topFramesCount: number;
  onChangeTopFramesCount: (count: number) => void;
  onSelectFrame: (frameNumber: number) => void;
  onOpenExportStage: () => void;
  onOpenZoomModal?: (item: ZoomableMediaItem) => void;
}

type FindingReviewState = 'pending' | 'reviewed' | 'flagged';

export const FindingsReviewPanel: React.FC<FindingsReviewPanelProps> = ({
  jobResult,
  activeThreshold,
  selectedFrame,
  topFramesCount,
  onChangeTopFramesCount,
  onSelectFrame,
  onOpenExportStage,
  onOpenZoomModal,
}) => {
  const [reviewStates, setReviewStates] = useState<Record<number, FindingReviewState>>({});

  if (!jobResult) {
    return (
      <aside
        aria-label="AI Findings and Review"
        className="w-full lg:w-[330px] xl:w-[360px] shrink-0 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-center items-center text-center min-h-[360px]"
      >
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          No Active Findings Loaded
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Select or upload an ultrasound video to inspect AI-assisted region findings.
        </p>
      </aside>
    );
  }

  const {
    filteredTimeline,
    activeFindingFrames,
    candidateCount,
    uncertainCount,
  } = filterTimelineByThreshold(
    jobResult.frame_by_frame_timeline,
    activeThreshold
  );

  const topKeyframes = selectTopConfidenceKeyframes(
    jobResult.exports.annotated_png_frames || [],
    filteredTimeline,
    topFramesCount
  );

  const findingsKeyframes = topKeyframes.filter((kf) => {
    const tl = filteredTimeline[kf.frame_number];
    return (tl?.detection_count ?? 0) > 0;
  });

  const cycleReviewStatus = (frameNumber: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setReviewStates((prev) => {
      const curr = prev[frameNumber] || 'pending';
      const next: FindingReviewState =
        curr === 'pending' ? 'reviewed' : curr === 'reviewed' ? 'flagged' : 'pending';
      return { ...prev, [frameNumber]: next };
    });
  };

  return (
    <aside
      aria-label="AI Findings and Radiologist Review"
      className="w-full lg:w-[340px] xl:w-[360px] shrink-0 flex flex-col gap-4"
    >
      <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col gap-3.5">
        {/* Panel Title & Count */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              AI Findings &amp; Review
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {activeFindingFrames} of {filteredTimeline.length} frames above threshold (
              {activeThreshold.toFixed(2)})
            </p>
          </div>
          <span
            className={`text-xs font-mono font-semibold px-2 py-1 rounded-md border ${
              activeFindingFrames > 0
                ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60'
                : 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/60'
            }`}
          >
            {activeFindingFrames > 0 ? `${findingsKeyframes.length} Key Findings` : '0 Findings'}
          </span>
        </div>

        {/* Mandatory Radiologist Review Notice */}
        <div className="p-3 rounded-lg bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200/90 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold">
              AI-assisted finding. Requires qualified radiologist review.
            </p>
            <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
              Model scores represent uncalibrated segmentation activations, not calibrated medical probabilities.
            </p>
          </div>
        </div>

        {/* Top High-Score Keyframe Count Selector */}
        <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-900/70 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            Show High-Score Frames:
          </span>
          <div className="flex items-center gap-1">
            {[2, 4, 6, 8, 12].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => onChangeTopFramesCount(count)}
                data-testid={`results-top-frames-btn-${count}`}
                className={`px-2 py-0.5 rounded text-xs font-mono font-semibold transition-colors cursor-pointer ${
                  topFramesCount === count
                    ? 'bg-[#0F172A] text-white dark:bg-sky-500 dark:text-slate-950'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        {/* Findings List or Informative Empty State */}
        {findingsKeyframes.length > 0 ? (
          <div className="space-y-3 max-h-[540px] overflow-y-auto pr-0.5">
            {findingsKeyframes.map((kf, idx) => {
              const tl = filteredTimeline[kf.frame_number];
              const det = tl?.detections?.[0];
              const rawScore = det?.raw_confidence ?? kf.max_confidence ?? 0;
              const isUncertain = det?.is_uncertain ?? rawScore < 0.72;
              const categoryLabel = isUncertain
                ? 'Potential uncertain hypoechoic region'
                : 'Potential cystic / anechoic region';
              const caliperMm = det
                ? `${(det.bbox_xywh[2] * 0.28).toFixed(1)} × ${(
                    det.bbox_xywh[3] * 0.28
                  ).toFixed(1)} mm`
                : 'N/A';
              const isSelected = kf.frame_number === selectedFrame;
              const revState = reviewStates[kf.frame_number] || 'pending';

              return (
                <div
                  key={kf.frame_number}
                  onClick={() => onSelectFrame(kf.frame_number)}
                  data-testid={`finding-card-${idx}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectFrame(kf.frame_number);
                    }
                  }}
                  className={`rounded-lg border p-3 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#0F172A] dark:border-sky-400 bg-slate-50/90 dark:bg-slate-900 ring-1 ring-[#0F172A]/20 dark:ring-sky-400/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {/* Header Row: Finding # + Timestamp + Review Status */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
                        Finding #{idx + 1}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">·</span>
                      <span className="inline-flex items-center gap-1 text-xs font-mono text-slate-600 dark:text-slate-400">
                        <Clock className="w-3 h-3" />
                        Frame #{kf.frame_number} ({kf.timestamp_sec.toFixed(2)}s)
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => cycleReviewStatus(kf.frame_number, e)}
                      title="Click to update radiologist review status"
                      className={`text-[11px] font-medium px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                        revState === 'reviewed'
                          ? 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800'
                          : revState === 'flagged'
                          ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                          : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {revState === 'reviewed'
                        ? '✓ Reviewed'
                        : revState === 'flagged'
                        ? '▲ Flagged'
                        : 'Pending Review'}
                    </button>
                  </div>

                  {/* Thumbnail + Region Telemetry */}
                  <div className="flex gap-3 items-center">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenZoomModal?.({
                          type: 'image',
                          src: `${kf.url}?t=${jobResult.job_id}`,
                          title: `Finding #${idx + 1} — Frame #${kf.frame_number} (${kf.timestamp_sec.toFixed(2)}s)`,
                          subtitle: categoryLabel,
                          badgeText: `${(rawScore * 100).toFixed(1)}%`,
                          downloadFilename: kf.filename,
                        });
                      }}
                      title="Click thumbnail to popup & zoom"
                      className="w-24 h-18 rounded-md overflow-hidden bg-black border border-slate-300 dark:border-slate-700 shrink-0 hover:ring-2 hover:ring-sky-400 transition-all"
                    >
                      <img
                        src={`${kf.url}?t=${jobResult.job_id}`}
                        alt={`Finding ${idx + 1} at frame ${kf.frame_number}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain"
                      />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1 text-xs">
                      <p
                        className={`font-semibold leading-snug ${
                          isUncertain
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-slate-900 dark:text-sky-300'
                        }`}
                      >
                        {categoryLabel}
                      </p>

                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                        <span>Model Score:</span>
                        <span
                          className="font-mono font-semibold text-slate-900 dark:text-slate-100"
                          title="Uncalibrated model activation score (validated threshold)"
                        >
                          {rawScore.toFixed(2)} ({(rawScore * 100).toFixed(1)}%)
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                        <span>Est. Caliper:</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">
                          {caliperMm}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenZoomModal?.({
                          type: 'image',
                          src: `${kf.url}?t=${jobResult.job_id}`,
                          title: `Finding #${idx + 1} — Frame #${kf.frame_number} (${kf.timestamp_sec.toFixed(2)}s)`,
                          subtitle: categoryLabel,
                          badgeText: `${(rawScore * 100).toFixed(1)}%`,
                          downloadFilename: kf.filename,
                        });
                      }}
                      className="inline-flex items-center gap-1 text-teal-700 dark:text-sky-400 font-semibold hover:underline cursor-pointer"
                    >
                      <Crosshair className="w-3 h-3" />
                      <span>Popup &amp; Zoom Image</span>
                    </button>
                    <a
                      href={`${kf.url}?download=1`}
                      download={kf.filename}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium"
                    >
                      <Download className="w-3 h-3" />
                      <span>Save PNG</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            data-testid="empty-findings-state"
            className="p-5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center space-y-2"
          >
            <CheckCircle2 className="w-6 h-6 text-teal-600 dark:text-teal-400 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              No Candidate Regions Above Threshold
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              No focal cystic or hypoechoic regions exceeded the validated detection score threshold (
              {activeThreshold.toFixed(2)}) across all {filteredTimeline.length} frames.
            </p>
            <div className="pt-1 flex items-center justify-center gap-4 text-[11px] font-mono text-slate-500 dark:text-slate-400">
              <span>Cystic: {candidateCount}</span>
              <span>·</span>
              <span>Uncertain: {uncertainCount}</span>
            </div>
          </div>
        )}

        {/* Score Interpretation Note */}
        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span>
            Scores between <strong>{activeThreshold.toFixed(2)}</strong> and{' '}
            <strong>0.72</strong> are labeled as uncertain findings requiring targeted specialist correlation.
          </span>
        </div>

        {/* Proceed to Export & Doctor Report Button */}
        <button
          type="button"
          onClick={onOpenExportStage}
          data-testid="open-export-report-btn"
          className="w-full py-2.5 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <FileText className="w-4 h-4" />
          <span>Open Doctor Report &amp; Export Studio</span>
        </button>
      </section>
    </aside>
  );
};
