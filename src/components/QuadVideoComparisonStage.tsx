import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  CheckCircle2,
  Sparkles,
  FileDown,
  FileText,
  SplitSquareHorizontal,
  Activity,
  Layers,
  Sliders,
} from 'lucide-react';
import type { JobResultPayload } from '../types/scansure';
import {
  filterTimelineByThreshold,
  formatTimestampMillis,
  selectTopConfidenceKeyframes,
} from '../utils/ultrasoundAnalytics';

interface QuadVideoComparisonStageProps {
  jobResult: JobResultPayload;
  activeThreshold: number;
  selectedFrame: number;
  topFramesCount: number;
  onChangeTopFramesCount: (count: number) => void;
  onSelectFrame: (frameNumber: number) => void;
  onOpenDoctorReport: () => void;
  onExportClientPdf: () => void;
  onBackToConfigure: () => void;
  isGeneratingPdf?: boolean;
}

type StageViewMode = 'split_wipe' | 'comparison' | 'annotated' | 'enhanced';

export const QuadVideoComparisonStage: React.FC<QuadVideoComparisonStageProps> = ({
  jobResult,
  activeThreshold,
  selectedFrame,
  topFramesCount,
  onChangeTopFramesCount,
  onSelectFrame,
  onOpenDoctorReport,
  onExportClientPdf,
  onBackToConfigure,
  isGeneratingPdf = false,
}) => {
  const origWipeRef = useRef<HTMLVideoElement | null>(null);
  const rightWipeRef = useRef<HTMLVideoElement | null>(null);
  const singleStreamRef = useRef<HTMLVideoElement | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(jobResult.input_video.duration_sec || 3.0);
  const [viewMode, setViewMode] = useState<StageViewMode>('split_wipe');
  const [wipePercent, setWipePercent] = useState<number>(50);
  const [showAiOverlayOnWipe, setShowAiOverlayOnWipe] = useState<boolean>(true);

  const fps = jobResult.input_video.fps || 15;
  const totalFrames = jobResult.input_video.frame_count || 45;
  const currentFrameNumber = Math.min(
    totalFrames - 1,
    Math.max(0, Math.floor(currentTime * fps))
  );

  const {
    filteredTimeline,
    activeFindingFrames,
    candidateCount,
    uncertainCount,
  } = filterTimelineByThreshold(jobResult.frame_by_frame_timeline, activeThreshold);

  const topKeyframes = selectTopConfidenceKeyframes(
    jobResult.exports.annotated_png_frames || [],
    filteredTimeline,
    topFramesCount
  );

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(jobResult.input_video.duration_sec || 3.0);
  }, [jobResult.job_id, jobResult.input_video.duration_sec]);

  useEffect(() => {
    if (Number.isFinite(selectedFrame)) {
      const targetTime = Math.min(duration, Math.max(0, selectedFrame / fps));
      seekAllVideos(targetTime);
    }
  }, [selectedFrame]);

  const getAllVideoElements = (): HTMLVideoElement[] =>
    [origWipeRef.current, rightWipeRef.current, singleStreamRef.current].filter(
      (v): v is HTMLVideoElement => v !== null
    );

  const seekAllVideos = (targetSeconds: number) => {
    const clamped = Math.max(0, Math.min(duration, targetSeconds));
    getAllVideoElements().forEach((video) => {
      video.currentTime = clamped;
    });
    setCurrentTime(clamped);
  };

  const togglePlayPause = async () => {
    const videos = getAllVideoElements();
    if (videos.length === 0) return;

    if (isPlaying) {
      videos.forEach((v) => v.pause());
      setIsPlaying(false);
    } else {
      try {
        await Promise.all(videos.map((v) => v.play()));
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    }
  };

  const handleRestart = () => {
    seekAllVideos(0);
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const primaryTime = e.currentTarget.currentTime;
    setCurrentTime(primaryTime);
    getAllVideoElements().forEach((v) => {
      if (v !== e.currentTarget && Math.abs(v.currentTime - primaryTime) > 0.08) {
        v.currentTime = primaryTime;
      }
    });
  };

  const enh = jobResult.enhancement_evaluation;
  const sum = jobResult.detection_summary;
  const origVideoUrl =
    jobResult.input_video.video_url ||
    `/api/samples/video/${encodeURIComponent(jobResult.input_video.filename)}`;
  const wipeRightUrl = showAiOverlayOnWipe
    ? `${jobResult.exports.videos.annotated_video.url}?t=${jobResult.job_id}`
    : `${jobResult.exports.videos.enhanced_video.url}?t=${jobResult.job_id}`;

  return (
    <div className="flex flex-col gap-5">
      {/* Top 4 Clean Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#0E1524] border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>AI Triage Result</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2">
            <span
              className={`text-sm font-bold font-mono ${
                activeFindingFrames > 0 ? 'text-amber-300' : 'text-emerald-300'
              }`}
            >
              {activeFindingFrames > 0
                ? '▲ RADIOLOGIST REVIEW NEEDED'
                : '● NORMAL PARENCHYMA'}
            </span>
          </div>
          <div className="mt-1 text-xs font-mono text-slate-400">
            {candidateCount} Cystic · {uncertainCount} Uncertain
          </div>
        </div>

        <div className="bg-[#0E1524] border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Peak Confidence Score</span>
            <span className="font-mono text-[11px] text-cyan-400">
              THR &ge; {Math.round(activeThreshold * 100)}%
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-100">
              {(sum.peak_raw_confidence * 100).toFixed(1)}%
            </span>
            <span className="text-xs font-mono text-slate-400">
              (Frame #{sum.peak_confidence_frame})
            </span>
          </div>
          <div className="mt-1 text-xs font-mono text-slate-400">
            {activeFindingFrames} of {totalFrames} frames above threshold
          </div>
        </div>

        <div className="bg-[#0E1524] border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Enhancement Quality Gain</span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-emerald-300">
              +{enh.speckle_suppression_gain_pct}%
            </span>
            <span className="text-xs font-mono text-slate-400">Speckle Reduced</span>
          </div>
          <div className="mt-1 text-xs font-mono text-slate-400">
            PSNR {enh.mean_psnr_db} dB · Edge EPI {enh.edge_preservation_index}
          </div>
        </div>

        {/* Direct Doctor Report Action Card */}
        <div className="bg-gradient-to-br from-cyan-950/60 via-[#0E1524] to-[#0E1524] border border-cyan-500/40 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
              Doctor Reports (PDF &amp; JSON)
            </span>
            <FileText className="w-4 h-4 text-cyan-300" />
          </div>
          <div className="my-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onExportClientPdf}
              disabled={isGeneratingPdf}
              data-testid="stage-download-pdf-btn"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{isGeneratingPdf ? 'Building...' : 'Export PDF'}</span>
            </button>
            <button
              type="button"
              onClick={onOpenDoctorReport}
              data-testid="stage-open-report-reader-btn"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-200 border border-slate-700 font-semibold text-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Read Report</span>
            </button>
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            Includes Top {topKeyframes.length} High-Confidence Frames
          </div>
        </div>
      </div>

      {/* Main Comparison Wiper & Video Studio Card */}
      <div className="bg-[#0B101B] border border-slate-800/90 rounded-2xl overflow-hidden shadow-xl">
        {/* Card Header Bar */}
        <div className="px-4 sm:px-6 py-3 border-b border-slate-800/90 bg-slate-900/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 whitespace-nowrap">
              {jobResult.input_video.resolution} · {fps} FPS
            </span>
            <h2 className="text-sm sm:text-base font-semibold text-slate-100 truncate">
              {jobResult.input_video.filename}
            </h2>
            {jobResult.video_integrity_verification.integrity_verified && (
              <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-800/50 px-2 py-0.5 rounded whitespace-nowrap">
                <CheckCircle2 className="w-3 h-3" />
                {totalFrames}/{totalFrames} Frames Locked
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Selector */}
            <div className="flex items-center gap-1 bg-slate-950/90 p-1 rounded-xl border border-slate-800 overflow-x-auto">
              {(
                [
                  { id: 'split_wipe', label: 'Wipe Compare (Old vs. Enhanced)' },
                  { id: 'comparison', label: 'Side-by-Side MP4' },
                  { id: 'annotated', label: 'AI-Annotated MP4' },
                  { id: 'enhanced', label: 'Enhanced Clean MP4' },
                ] as { id: StageViewMode; label: string }[]
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setViewMode(mode.id);
                  }}
                  data-testid={`view-mode-${mode.id}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    viewMode === mode.id
                      ? 'bg-cyan-400 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onBackToConfigure}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Adjust Settings</span>
            </button>
          </div>
        </div>

        {/* Viewport Stage */}
        <div className="p-4 sm:p-6 bg-[#060911]">
          {viewMode === 'split_wipe' ? (
            <div className="max-w-4xl mx-auto flex flex-col gap-3">
              {/* Top Wipe Split Slider Bar (Controls the Wiper Position) */}
              <div className="rounded-xl bg-slate-900/95 border border-cyan-500/40 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-2">
                  <SplitSquareHorizontal className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold text-slate-100">
                    Top Wipe Split Slider (Old Original vs. Enhanced)
                  </span>
                </div>

                {/* Top Wipe Split Slider Control */}
                <div className="flex flex-1 max-w-md items-center gap-3">
                  <span className="text-[11px] font-mono text-amber-300 whitespace-nowrap">
                    Old: {wipePercent}%
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={wipePercent}
                    onChange={(e) => setWipePercent(Number(e.target.value))}
                    aria-label="Top wipe split slider"
                    data-testid="top-wipe-split-slider"
                    className="flex-1 h-2 bg-slate-800 rounded-lg accent-cyan-400 cursor-pointer"
                  />
                  <span className="text-[11px] font-mono text-cyan-300 whitespace-nowrap">
                    Enhanced: {100 - wipePercent}%
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowAiOverlayOnWipe((v) => !v)}
                    data-testid="toggle-wipe-ai-overlay-btn"
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-colors cursor-pointer whitespace-nowrap ${
                      showAiOverlayOnWipe
                        ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/50'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {showAiOverlayOnWipe ? 'AI Calipers: ON' : 'AI Calipers: OFF'}
                  </button>
                </div>
              </div>

              {/* Before / After Comparison Wiper Canvas (Controlled Only by Top Wipe Split Slider) */}
              <div className="relative aspect-[4/3] max-w-[580px] w-full mx-auto bg-black rounded-xl overflow-hidden border border-slate-800 select-none shadow-2xl">
                {/* Base Layer (Right Side): Enhanced or AI-Annotated Ultrasound Video */}
                <video
                  ref={rightWipeRef}
                  src={wipeRightUrl}
                  className="w-full h-full object-cover pointer-events-none"
                  playsInline
                  muted
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={(e) => {
                    if (e.currentTarget.duration && Number.isFinite(e.currentTarget.duration)) {
                      setDuration(e.currentTarget.duration);
                    }
                  }}
                  onEnded={() => setIsPlaying(false)}
                  data-testid="wipe-enhanced-video"
                />

                {/* Clipped Top Layer (Left Side): Old / Original Raw Ultrasound Video */}
                <div
                  className="absolute inset-0 overflow-hidden pointer-events-none"
                  style={{ clipPath: `inset(0 ${100 - wipePercent}% 0 0)` }}
                >
                  <video
                    ref={origWipeRef}
                    src={origVideoUrl}
                    className="w-full h-full object-cover pointer-events-none"
                    playsInline
                    muted
                    data-testid="wipe-original-video"
                  />
                </div>

                {/* Vertical Wiper Line (Synchronized with Top Wipe Split Slider) */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.95)] pointer-events-none"
                  style={{ left: `${wipePercent}%` }}
                >
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center text-xs font-bold shadow-lg">
                    &harr;
                  </div>
                </div>

                {/* Corner Labels */}
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-slate-950/90 border border-amber-500/40 text-[11px] font-mono text-amber-300 pointer-events-none">
                  LEFT: OLD / ORIGINAL SCAN
                </div>
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-slate-950/90 border border-cyan-500/40 text-[11px] font-mono text-cyan-300 pointer-events-none">
                  {showAiOverlayOnWipe
                    ? 'RIGHT: ENHANCED + AI CALIPERS'
                    : 'RIGHT: ENHANCED CLEAN B-MODE'}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-black">
                <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">
                    {viewMode === 'comparison' &&
                      'Synchronized Side-by-Side Comparison Video (comparison_video.mp4)'}
                    {viewMode === 'annotated' &&
                      'AI-Annotated Ultrasound Video with Depth Ruler (annotated_video.mp4)'}
                    {viewMode === 'enhanced' &&
                      'Speckle-Denoised & Contrast-Enhanced Clean Video (enhanced_video.mp4)'}
                  </span>
                </div>
                <div className="aspect-video max-h-[460px] w-full bg-black flex items-center justify-center">
                  <video
                    ref={singleStreamRef}
                    src={
                      viewMode === 'annotated'
                        ? `${jobResult.exports.videos.annotated_video.url}?t=${jobResult.job_id}`
                        : viewMode === 'enhanced'
                        ? `${jobResult.exports.videos.enhanced_video.url}?t=${jobResult.job_id}`
                        : `${jobResult.exports.videos.comparison_video.url}?t=${jobResult.job_id}`
                    }
                    className="w-full h-full object-contain"
                    playsInline
                    muted
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={() => setIsPlaying(false)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Synchronized Playback Transport & Frame Confidence Scrubber */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-900/90 border-t border-slate-800/90 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlayPause}
                data-testid="playback-toggle-btn"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Pause Video' : 'Play Synchronized'}</span>
              </button>
              <button
                type="button"
                onClick={handleRestart}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                title="Restart at Frame 0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
              <span className="text-slate-300">
                Frame <strong className="text-cyan-300">{currentFrameNumber + 1}</strong> /{' '}
                {totalFrames}
              </span>
              <span className="text-slate-400">
                {formatTimestampMillis(currentTime)} / {formatTimestampMillis(duration)}
              </span>
            </div>
          </div>

          {/* Interactive Frame Confidence Bar Scrubber */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Click any frame bar below to jump to that ultrasound frame:</span>
              <span className="font-mono text-cyan-300">
                Peak Confidence: {(sum.peak_raw_confidence * 100).toFixed(1)}% (Frame #
                {sum.peak_confidence_frame})
              </span>
            </div>
            <div
              className="h-8 bg-slate-950 rounded-lg border border-slate-800 p-1 flex items-end gap-[2px] overflow-hidden"
              role="group"
              aria-label="Frame confidence timeline"
            >
              {filteredTimeline.map((pt) => {
                const isCurrent = pt.frame_number === currentFrameNumber;
                const heightPct = Math.max(
                  15,
                  Math.min(100, Math.round(pt.max_confidence * 100))
                );
                return (
                  <button
                    key={pt.frame_number}
                    type="button"
                    onClick={() => {
                      onSelectFrame(pt.frame_number);
                      seekAllVideos(pt.timestamp_sec);
                    }}
                    title={`Frame #${pt.frame_number} (${pt.timestamp_sec}s) — Confidence: ${(
                      pt.max_confidence * 100
                    ).toFixed(1)}%`}
                    className={`flex-1 rounded-t transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-amber-400 ring-1 ring-amber-300'
                        : pt.detection_count > 0
                        ? 'bg-cyan-400/80 hover:bg-cyan-300'
                        : 'bg-slate-700/70 hover:bg-slate-600'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Direct Export Bar */}
        <div className="px-4 sm:px-6 py-3 bg-[#080C14] border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-300">
            Save Processed Videos &amp; Doctor Reports:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onExportClientPdf}
              disabled={isGeneratingPdf}
              data-testid="download-illustrated-pdf-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>
                {isGeneratingPdf ? 'Generating PDF...' : 'Download Doctor PDF (.pdf)'}
              </span>
            </button>
            <a
              href={`${jobResult.exports.reports.json.url}?download=1`}
              download={jobResult.exports.reports.json.filename}
              data-testid="download-report-json"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900/70 text-amber-200 border border-amber-700/50 text-xs font-mono transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>detection_report.json</span>
            </a>
            <a
              href={`${jobResult.exports.videos.annotated_video.url}?download=1`}
              download={jobResult.exports.videos.annotated_video.filename}
              data-testid="download-annotated-video"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>annotated_video.mp4</span>
            </a>
            <a
              href={`${jobResult.exports.videos.enhanced_video.url}?download=1`}
              download={jobResult.exports.videos.enhanced_video.filename}
              data-testid="download-enhanced-video"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>enhanced_video.mp4</span>
            </a>
            <a
              href={`${jobResult.exports.videos.comparison_video.url}?download=1`}
              download={jobResult.exports.videos.comparison_video.filename}
              data-testid="download-comparison-video"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>comparison_video.mp4</span>
            </a>
          </div>
        </div>
      </div>

      {/* User-Selected High-Confidence Annotated Frames Section */}
      <div className="bg-[#0E1524] border border-slate-800/90 rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-cyan-400 shrink-0" />
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-100">
                Top {topKeyframes.length} High-Confidence Annotated Frames
              </h3>
              <p className="text-xs text-slate-400">
                Automatically ranked by highest AI confidence score. Click any frame to inspect or change how many frames to display.
              </p>
            </div>
          </div>

          {/* Live Selector for How Many High-Confidence Frames to Show */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-950/90 px-3 py-1.5 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-300 font-medium">
              Frames to Display:
            </span>
            {[2, 4, 6, 8, 12].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => onChangeTopFramesCount(count)}
                data-testid={`results-top-frames-btn-${count}`}
                className={`px-2 py-0.5 rounded text-xs font-mono font-semibold transition-colors cursor-pointer ${
                  topFramesCount === count
                    ? 'bg-cyan-400 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {topKeyframes.map((kf, rankIdx) => {
            const tl = filteredTimeline[kf.frame_number];
            const score = kf.max_confidence ?? tl?.max_confidence ?? 0;
            const firstDet = tl?.detections?.[0];
            const caliperStr = firstDet
              ? `${(firstDet.bbox_xywh[2] * 0.28).toFixed(1)} × ${(
                  firstDet.bbox_xywh[3] * 0.28
                ).toFixed(1)} mm`
              : 'Baseline Scan';
            const isSel = kf.frame_number === selectedFrame;

            return (
              <div
                key={kf.frame_number}
                onClick={() => {
                  onSelectFrame(kf.frame_number);
                  seekAllVideos(kf.timestamp_sec);
                }}
                data-testid={`high-conf-frame-card-${rankIdx}`}
                className={`rounded-xl overflow-hidden border bg-[#07090E] cursor-pointer transition-all flex flex-col justify-between ${
                  isSel
                    ? 'border-cyan-400 ring-1 ring-cyan-400/50 shadow-lg'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-200 font-semibold">
                    #{rankIdx + 1} · Frame {kf.frame_number} ({kf.timestamp_sec}s)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                    {(score * 100).toFixed(1)}%
                  </span>
                </div>

                <div className="aspect-[4/3] bg-black flex items-center justify-center">
                  <img
                    src={`${kf.url}?t=${jobResult.job_id}`}
                    alt={kf.label}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="px-3 py-2 bg-[#0B0E17] border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-mono text-[11px] text-slate-300 truncate">
                    {caliperStr}
                  </span>
                  <a
                    href={`${kf.url}?download=1`}
                    download={kf.filename}
                    onClick={(e) => e.stopPropagation()}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-medium flex items-center gap-1 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    <span>PNG</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
