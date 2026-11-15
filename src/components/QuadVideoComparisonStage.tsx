import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  CheckCircle2,
  ZoomIn,
  Columns,
  Film,
  Sparkles,
  Image as ImageIcon,
  FileDown,
  MoveHorizontal,
} from 'lucide-react';
import type { JobResultPayload } from '../types/scansure';
import type { ZoomableMediaItem } from './MediaZoomModal';
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
  onOpenFullKeyframes: () => void;
  onExportClientPdf: () => void;
  isGeneratingPdf?: boolean;
  onOpenZoomModal?: (item: ZoomableMediaItem) => void;
}

export type ResultsDedicatedTab =
  | 'enhance_wiper'
  | 'side_by_side'
  | 'side_by_side_video'
  | 'video_comparison'
  | 'top_frames';

export const QuadVideoComparisonStage: React.FC<QuadVideoComparisonStageProps> = ({
  jobResult,
  activeThreshold,
  selectedFrame,
  topFramesCount,
  onChangeTopFramesCount,
  onSelectFrame,
  onOpenDoctorReport,
  onExportClientPdf,
  isGeneratingPdf = false,
  onOpenZoomModal,
}) => {
  const wiperContainerRef = useRef<HTMLDivElement | null>(null);
  const originalRef = useRef<HTMLVideoElement | null>(null);
  const enhancedRef = useRef<HTMLVideoElement | null>(null);
  const annotatedRef = useRef<HTMLVideoElement | null>(null);
  const comparisonRef = useRef<HTMLVideoElement | null>(null);
  const origWipeRef = useRef<HTMLVideoElement | null>(null);
  const rightWipeRef = useRef<HTMLVideoElement | null>(null);

  const [activeSubPage, setActiveSubPage] = useState<ResultsDedicatedTab>('enhance_wiper');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(jobResult.input_video.duration_sec || 3.0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

  // Remini-style interactive canvas wiper state (drag directly on canvas)
  const [wipePercent, setWipePercent] = useState<number>(50);
  const [isDraggingWiper, setIsDraggingWiper] = useState<boolean>(false);
  const [showAiOverlayOnWipe, setShowAiOverlayOnWipe] = useState<boolean>(true);
  const [selectedSideBySideIdx, setSelectedSideBySideIdx] = useState<number>(0);

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
    setSelectedSideBySideIdx(0);
  }, [jobResult.job_id, jobResult.input_video.duration_sec]);

  useEffect(() => {
    if (Number.isFinite(selectedFrame)) {
      const targetTime = Math.min(duration, Math.max(0, selectedFrame / fps));
      seekAllVideos(targetTime);
    }
  }, [selectedFrame]);

  const getAllVideos = (): HTMLVideoElement[] =>
    [
      originalRef.current,
      enhancedRef.current,
      annotatedRef.current,
      comparisonRef.current,
      origWipeRef.current,
      rightWipeRef.current,
    ].filter((v): v is HTMLVideoElement => v !== null);

  const seekAllVideos = (targetSeconds: number) => {
    const clamped = Math.max(0, Math.min(duration, targetSeconds));
    getAllVideos().forEach((video) => {
      video.currentTime = clamped;
    });
    setCurrentTime(clamped);
  };

  const togglePlayPause = async () => {
    const videos = getAllVideos();
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

  const handleChangeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    getAllVideos().forEach((v) => {
      v.playbackRate = rate;
    });
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const primaryTime = e.currentTarget.currentTime;
    setCurrentTime(primaryTime);
    getAllVideos().forEach((v) => {
      if (v !== e.currentTarget && Math.abs(v.currentTime - primaryTime) > 0.08) {
        v.currentTime = primaryTime;
      }
    });
  };

  // Remini-style pointer slide calculation directly on the image/video container
  const updateWipeFromClientX = (clientX: number) => {
    const el = wiperContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const relX = clientX - rect.left;
    const pct = Math.max(2, Math.min(98, Math.round((relX / rect.width) * 100)));
    setWipePercent(pct);
  };

  const handleWiperPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setIsDraggingWiper(true);
    updateWipeFromClientX(e.clientX);
  };

  const handleWiperPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingWiper) return;
    updateWipeFromClientX(e.clientX);
  };

  const handleWiperPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingWiper) {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      setIsDraggingWiper(false);
    }
  };

  const currentFrameEntry =
    filteredTimeline[currentFrameNumber] || filteredTimeline[0];
  const enh = jobResult.enhancement_evaluation;
  const sum = jobResult.detection_summary;

  const origVideoUrl =
    jobResult.input_video.video_url ||
    `/api/samples/video/${encodeURIComponent(jobResult.input_video.filename)}`;
  const enhancedVideoUrl = `${jobResult.exports.videos.enhanced_video.url}?t=${jobResult.job_id}`;
  const annotatedVideoUrl = `${jobResult.exports.videos.annotated_video.url}?t=${jobResult.job_id}`;
  const comparisonVideoUrl = `${jobResult.exports.videos.comparison_video.url}?t=${jobResult.job_id}`;

  const wipeRightUrl = showAiOverlayOnWipe ? annotatedVideoUrl : enhancedVideoUrl;

  const dedicatedPages: {
    id: ResultsDedicatedTab;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'enhance_wiper',
      label: 'Enhance Wiper',
      icon: <MoveHorizontal className="w-3.5 h-3.5" />,
    },
    {
      id: 'side_by_side',
      label: 'Side-by-Side Comparison',
      icon: <Columns className="w-3.5 h-3.5" />,
    },
    {
      id: 'side_by_side_video',
      label: 'Side-by-Side Video Comparison',
      icon: <Film className="w-3.5 h-3.5" />,
    },
    {
      id: 'video_comparison',
      label: 'Video Comparison',
      icon: <Sparkles className="w-3.5 h-3.5" />,
    },
    {
      id: 'top_frames',
      label: `Top Clear Frames (${topKeyframes.length})`,
      icon: <ImageIcon className="w-3.5 h-3.5" />,
    },
  ];

  const activeSideBySideFrame =
    topKeyframes[selectedSideBySideIdx] || topKeyframes[0] || null;

  return (
    <div className="flex flex-col gap-5">
      {/* DEDICATED RESULT PAGES NAVIGATION BAR */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-2 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="Dedicated result pages"
          className="flex flex-wrap items-center gap-1.5"
        >
          {dedicatedPages.map((tab) => {
            const isActive = activeSubPage === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-testid={`results-page-${tab.id}`}
                onClick={() => {
                  setIsPlaying(false);
                  setActiveSubPage(tab.id);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0F172A] text-white dark:bg-sky-500 dark:text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenDoctorReport}
            data-testid="stage-open-report-reader-btn"
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            Doctor Report (PDF &amp; JSON)
          </button>
          <button
            type="button"
            onClick={onExportClientPdf}
            disabled={isGeneratingPdf}
            data-testid="stage-download-pdf-btn"
            className="px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>{isGeneratingPdf ? 'Exporting...' : 'Export PDF'}</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          PAGE 1: ENHANCE WIPER (REMINI-STYLE DIRECT SLIDING ON CANVAS)
      ===================================================================== */}
      {activeSubPage === 'enhance_wiper' && (
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/80">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Enhance Wiper — Slide Directly on Image/Video
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30">
                Before {wipePercent}% / After {100 - wipePercent}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAiOverlayOnWipe((v) => !v)}
                data-testid="toggle-wiper-ai-overlay"
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  showAiOverlayOnWipe
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                }`}
              >
                {showAiOverlayOnWipe ? 'AI Detections: Shown' : 'Clean Enhanced Only'}
              </button>

              {onOpenZoomModal && (
                <button
                  type="button"
                  data-testid="wiper-open-zoom-btn"
                  onClick={() =>
                    onOpenZoomModal({
                      type: 'video',
                      src: wipeRightUrl,
                      title: showAiOverlayOnWipe
                        ? 'AI-Annotated & Enhanced Ultrasound Video'
                        : 'Speckle-Denoised Enhanced Ultrasound Video',
                      subtitle: `${jobResult.input_video.resolution} · ${fps} FPS · Click +/- or scroll to zoom`,
                      badgeText: `PSNR ${enh.mean_psnr_db} dB`,
                      downloadFilename: showAiOverlayOnWipe
                        ? 'annotated_video.mp4'
                        : 'enhanced_video.mp4',
                    })
                  }
                  className="px-3 py-1.5 rounded-lg bg-[#0F172A] dark:bg-sky-500 text-white dark:text-slate-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>Popup &amp; Zoom</span>
                </button>
              )}
            </div>
          </div>

          <div className="p-4 sm:p-6 bg-[#080C14] flex flex-col items-center">
            {/* Remini-style interactive canvas — NO top wipe slider bar */}
            <div
              ref={wiperContainerRef}
              data-testid="remini-wiper-canvas"
              onPointerDown={handleWiperPointerDown}
              onPointerMove={handleWiperPointerMove}
              onPointerUp={handleWiperPointerUp}
              onPointerCancel={handleWiperPointerUp}
              className="relative aspect-[4/3] max-w-[660px] w-full mx-auto bg-black rounded-xl overflow-hidden border border-slate-800 select-none shadow-xl cursor-ew-resize touch-none"
            >
              {/* Right Layer: Enhanced / Annotated After Video */}
              <video
                ref={rightWipeRef}
                src={wipeRightUrl}
                className="w-full h-full object-contain pointer-events-none"
                playsInline
                muted
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={(e) => {
                  if (e.currentTarget.duration && Number.isFinite(e.currentTarget.duration)) {
                    setDuration(e.currentTarget.duration);
                  }
                }}
                onEnded={() => setIsPlaying(false)}
              />

              {/* Left Clipped Layer: Original Before Video */}
              <div
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ clipPath: `inset(0 ${100 - wipePercent}% 0 0)` }}
              >
                <video
                  ref={origWipeRef}
                  src={origVideoUrl}
                  className="w-full h-full object-contain pointer-events-none"
                  playsInline
                  muted
                />
              </div>

              {/* Remini-Style Vertical Divider & Touch Handle */}
              <div
                data-testid="remini-wiper-handle"
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_12px_rgba(20,184,166,0.9)] pointer-events-none"
                style={{ left: `${wipePercent}%` }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white text-slate-950 border-2 border-teal-500 flex items-center justify-center shadow-xl">
                  <MoveHorizontal className="w-5 h-5 text-slate-900" />
                </div>
              </div>

              {/* Before / After Corner Badges */}
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-slate-950/85 border border-slate-700 text-xs font-semibold text-slate-200 pointer-events-none">
                Before (Original)
              </div>
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-teal-950/90 border border-teal-500/50 text-xs font-semibold text-teal-200 pointer-events-none">
                After ({showAiOverlayOnWipe ? 'Enhanced + AI' : 'Enhanced'})
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PAGE 2: SIDE-BY-SIDE COMPARISON (CLICK ANY IMAGE TO POPUP & ZOOM)
      ===================================================================== */}
      {activeSubPage === 'side_by_side' && (
        <div
          data-testid="dedicated-side-by-side-page"
          className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-xs space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Side-by-Side Frame Comparison (Original vs. Enhanced &amp; AI Annotated)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click any image below to open in full popup view with Zoom In and Zoom Out.
              </p>
            </div>

            {topKeyframes.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {topKeyframes.map((kf, idx) => (
                  <button
                    key={kf.frame_number}
                    type="button"
                    onClick={() => setSelectedSideBySideIdx(idx)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
                      selectedSideBySideIdx === idx
                        ? 'bg-[#0F172A] text-white dark:bg-sky-500 dark:text-slate-950 border-slate-900 dark:border-sky-500'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Frame #{kf.frame_number} ({Math.round((kf.max_confidence || 0) * 100)}%)
                  </button>
                ))}
              </div>
            )}
          </div>

          {activeSideBySideFrame && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Synchronized Dual Side-by-Side Composite */}
              <div
                data-testid="side-by-side-zoom-trigger"
                onClick={() =>
                  onOpenZoomModal?.({
                    type: 'image',
                    src: `${activeSideBySideFrame.comparison_url}?t=${jobResult.job_id}`,
                    title: `Side-by-Side Comparison — Frame #${activeSideBySideFrame.frame_number}`,
                    subtitle: `Timestamp ${activeSideBySideFrame.timestamp_sec}s · Peak Confidence ${(
                      (activeSideBySideFrame.max_confidence || 0) * 100
                    ).toFixed(1)}%`,
                    badgeText: 'Original vs. Enhanced',
                    downloadFilename: activeSideBySideFrame.comparison_filename,
                  })
                }
                className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 cursor-pointer"
              >
                <div className="px-3.5 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-200">
                  <span className="font-semibold">
                    Original (Left) vs. Enhanced AI (Right) — Frame #{activeSideBySideFrame.frame_number}
                  </span>
                  <span className="inline-flex items-center gap-1 text-sky-400 font-semibold">
                    <ZoomIn className="w-3.5 h-3.5" />
                    Click to Zoom
                  </span>
                </div>
                <div className="aspect-[8/3] flex items-center justify-center p-2 bg-black">
                  <img
                    src={`${activeSideBySideFrame.comparison_url}?t=${jobResult.job_id}`}
                    alt={`Side-by-side comparison frame ${activeSideBySideFrame.frame_number}`}
                    className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform"
                  />
                </div>
              </div>

              {/* High-Resolution Enhanced Annotated Frame */}
              <div
                data-testid="enhanced-frame-zoom-trigger"
                onClick={() =>
                  onOpenZoomModal?.({
                    type: 'image',
                    src: `${activeSideBySideFrame.url}?t=${jobResult.job_id}`,
                    title: `Enhanced & AI-Annotated Ultrasound — Frame #${activeSideBySideFrame.frame_number}`,
                    subtitle: `${activeSideBySideFrame.label} · Timestamp ${activeSideBySideFrame.timestamp_sec}s`,
                    badgeText: `Score ${((activeSideBySideFrame.max_confidence || 0) * 100).toFixed(1)}%`,
                    downloadFilename: activeSideBySideFrame.filename,
                  })
                }
                className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 cursor-pointer"
              >
                <div className="px-3.5 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-200">
                  <span className="font-semibold">
                    Enhanced &amp; AI-Annotated Detail — Frame #{activeSideBySideFrame.frame_number}
                  </span>
                  <span className="inline-flex items-center gap-1 text-teal-400 font-semibold">
                    <ZoomIn className="w-3.5 h-3.5" />
                    Click to Zoom
                  </span>
                </div>
                <div className="aspect-[4/3] max-h-[280px] mx-auto flex items-center justify-center p-2 bg-black">
                  <img
                    src={`${activeSideBySideFrame.url}?t=${jobResult.job_id}`}
                    alt={`Enhanced frame ${activeSideBySideFrame.frame_number}`}
                    className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          PAGE 3: SIDE-BY-SIDE VIDEO COMPARISON
      ===================================================================== */}
      {activeSubPage === 'side_by_side_video' && (
        <div
          data-testid="dedicated-side-by-side-video-page"
          className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs"
        >
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Synchronized Side-by-Side Video Comparison (Original vs. Enhanced AI)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Frame-locked dual video stream ({jobResult.input_video.resolution} @ {fps} FPS)
              </p>
            </div>

            <div className="flex items-center gap-2">
              {onOpenZoomModal && (
                <button
                  type="button"
                  data-testid="side-by-side-video-zoom-btn"
                  onClick={() =>
                    onOpenZoomModal({
                      type: 'video',
                      src: comparisonVideoUrl,
                      title: 'Side-by-Side Comparison Video (Original vs. Enhanced AI)',
                      subtitle: `${jobResult.input_video.resolution} · ${fps} FPS · Synchronized Frame-by-Frame`,
                      badgeText: 'Output C',
                      downloadFilename: jobResult.exports.videos.comparison_video.filename,
                    })
                  }
                  className="px-3 py-1.5 rounded-lg bg-[#0F172A] dark:bg-sky-500 text-white dark:text-slate-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>Popup &amp; Zoom Video</span>
                </button>
              )}
              <a
                href={`${jobResult.exports.videos.comparison_video.url}?download=1`}
                download={jobResult.exports.videos.comparison_video.filename}
                data-testid="download-comparison-video"
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download MP4</span>
              </a>
            </div>
          </div>

          <div className="p-4 bg-[#080C14]">
            <div className="max-w-4xl mx-auto rounded-xl overflow-hidden border border-slate-800 bg-black">
              <video
                ref={comparisonRef}
                src={comparisonVideoUrl}
                className="w-full aspect-[8/3] object-contain cursor-pointer"
                playsInline
                muted
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                onClick={() =>
                  onOpenZoomModal?.({
                    type: 'video',
                    src: comparisonVideoUrl,
                    title: 'Side-by-Side Comparison Video (Original vs. Enhanced AI)',
                    subtitle: `${jobResult.input_video.resolution} · ${fps} FPS`,
                    badgeText: 'Output C',
                    downloadFilename: jobResult.exports.videos.comparison_video.filename,
                  })
                }
                data-testid="video-comparison"
              />
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PAGE 4: VIDEO COMPARISON (ENHANCED VIDEO & AI-ANNOTATED VIDEO)
      ===================================================================== */}
      {activeSubPage === 'video_comparison' && (
        <div
          data-testid="dedicated-video-comparison-page"
          className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-xs space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Enhanced &amp; AI-Annotated Video Streams
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click any video stream below to open it in the Zoom Popup Inspector.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Output A: Enhanced Video */}
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 flex flex-col">
              <div className="px-3.5 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-200">
                <span className="font-semibold">Enhanced Ultrasound Video (enhanced_video.mp4)</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="zoom-enhanced-video-btn"
                    onClick={() =>
                      onOpenZoomModal?.({
                        type: 'video',
                        src: enhancedVideoUrl,
                        title: 'Enhanced Ultrasound Video (Output A)',
                        subtitle: `PSNR ${enh.mean_psnr_db} dB · SSIM ${enh.mean_ssim}`,
                        badgeText: 'Output A',
                        downloadFilename: jobResult.exports.videos.enhanced_video.filename,
                      })
                    }
                    className="px-2 py-1 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <ZoomIn className="w-3 h-3" />
                    <span>Zoom</span>
                  </button>
                  <a
                    href={`${jobResult.exports.videos.enhanced_video.url}?download=1`}
                    download={jobResult.exports.videos.enhanced_video.filename}
                    data-testid="download-enhanced-video"
                    className="px-2 py-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>MP4</span>
                  </a>
                </div>
              </div>
              <div className="aspect-[4/3] bg-black flex items-center justify-center">
                <video
                  ref={enhancedRef}
                  src={enhancedVideoUrl}
                  className="w-full h-full object-contain cursor-pointer"
                  playsInline
                  muted
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
                  onClick={() =>
                    onOpenZoomModal?.({
                      type: 'video',
                      src: enhancedVideoUrl,
                      title: 'Enhanced Ultrasound Video (Output A)',
                      subtitle: `PSNR ${enh.mean_psnr_db} dB · SSIM ${enh.mean_ssim}`,
                      badgeText: 'Output A',
                      downloadFilename: jobResult.exports.videos.enhanced_video.filename,
                    })
                  }
                  data-testid="video-enhanced"
                />
              </div>
            </div>

            {/* Output B: AI-Annotated Video */}
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 flex flex-col">
              <div className="px-3.5 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-200">
                <span className="font-semibold">
                  AI-Annotated Ultrasound Video (annotated_video.mp4)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="zoom-annotated-video-btn"
                    onClick={() =>
                      onOpenZoomModal?.({
                        type: 'video',
                        src: annotatedVideoUrl,
                        title: 'AI-Annotated Ultrasound Video (Output B)',
                        subtitle: `${activeFindingFrames} frames with regions above threshold`,
                        badgeText: 'Output B',
                        downloadFilename: jobResult.exports.videos.annotated_video.filename,
                      })
                    }
                    className="px-2 py-1 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <ZoomIn className="w-3 h-3" />
                    <span>Zoom</span>
                  </button>
                  <a
                    href={`${jobResult.exports.videos.annotated_video.url}?download=1`}
                    download={jobResult.exports.videos.annotated_video.filename}
                    data-testid="download-annotated-video"
                    className="px-2 py-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>MP4</span>
                  </a>
                </div>
              </div>
              <div className="aspect-[4/3] bg-black flex items-center justify-center">
                <video
                  ref={annotatedRef}
                  src={annotatedVideoUrl}
                  className="w-full h-full object-contain cursor-pointer"
                  playsInline
                  muted
                  onClick={() =>
                    onOpenZoomModal?.({
                      type: 'video',
                      src: annotatedVideoUrl,
                      title: 'AI-Annotated Ultrasound Video (Output B)',
                      subtitle: `${activeFindingFrames} frames with regions above threshold`,
                      badgeText: 'Output B',
                      downloadFilename: jobResult.exports.videos.annotated_video.filename,
                    })
                  }
                  data-testid="video-annotated"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PAGE 5: TOP CLEAR / HIGH-CONFIDENCE FRAMES (CLICK TO POPUP & ZOOM)
      ===================================================================== */}
      {activeSubPage === 'top_frames' && (
        <div
          data-testid="dedicated-top-frames-page"
          className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-xs space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Top {topKeyframes.length} Clear &amp; High-Confidence Ultrasound Frames
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click any enhanced frame to open in popup modal and zoom in/out.
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">
                Frames Count:
              </span>
              {[2, 4, 6, 8, 12].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChangeTopFramesCount(n)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold border transition-colors cursor-pointer ${
                    topFramesCount === n
                      ? 'bg-[#0F172A] text-white dark:bg-sky-500 dark:text-slate-950 border-slate-900 dark:border-sky-500'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  Top {n}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topKeyframes.map((kf, index) => (
              <div
                key={kf.frame_number}
                data-testid={`top-frame-card-${index}`}
                onClick={() =>
                  onOpenZoomModal?.({
                    type: 'image',
                    src: `${kf.url}?t=${jobResult.job_id}`,
                    title: `Top Clear Frame #${kf.frame_number} (${kf.timestamp_sec}s)`,
                    subtitle: kf.label,
                    badgeText: `Confidence ${((kf.max_confidence || 0) * 100).toFixed(1)}%`,
                    downloadFilename: kf.filename,
                  })
                }
                className="group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 hover:border-sky-500 transition-all cursor-pointer flex flex-col shadow-2xs"
              >
                <div className="relative aspect-[4/3] bg-black overflow-hidden">
                  <img
                    src={`${kf.url}?t=${jobResult.job_id}`}
                    alt={kf.label}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-950/85 text-white font-mono text-[11px] font-semibold">
                    Frame #{kf.frame_number} · {kf.timestamp_sec}s
                  </div>
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-teal-500/90 text-slate-950 font-mono text-[11px] font-bold">
                    {((kf.max_confidence || 0) * 100).toFixed(1)}%
                  </div>
                  <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-md bg-slate-950/85 text-sky-300 text-[11px] font-semibold flex items-center gap-1 opacity-90 group-hover:opacity-100">
                    <ZoomIn className="w-3 h-3" />
                    <span>Click to Zoom</span>
                  </div>
                </div>
                <div className="p-3 flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                    {kf.label}
                  </span>
                  <a
                    href={`${kf.url}?download=1`}
                    download={kf.filename}
                    onClick={(e) => e.stopPropagation()}
                    className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-mono text-[11px] shrink-0"
                  >
                    PNG
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SYNCHRONIZED PLAYBACK CONTROLS & TIMELINE BAR (FOR VIDEO VIEWS) */}
      {(activeSubPage === 'enhance_wiper' ||
        activeSubPage === 'side_by_side_video' ||
        activeSubPage === 'video_comparison') && (
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 shadow-xs flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlayPause}
                data-testid="playback-toggle-btn"
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 dark:bg-sky-500 dark:hover:bg-sky-400 text-white dark:text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Pause' : 'Play Video'}</span>
              </button>

              <button
                type="button"
                onClick={handleRestart}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                title="Restart at Frame 0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                {[0.5, 1.0, 1.5].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => handleChangeSpeed(rate)}
                    className={`px-1.5 py-0.5 rounded text-[11px] font-mono cursor-pointer ${
                      playbackRate === rate
                        ? 'bg-slate-900 text-white dark:bg-sky-500/20 dark:text-sky-300 font-semibold'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300">
              <span>
                Frame{' '}
                <strong className="text-slate-900 dark:text-sky-300">
                  {currentFrameNumber + 1}
                </strong>{' '}
                / {totalFrames}
              </span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span>
                {formatTimestampMillis(currentTime)} / {formatTimestampMillis(duration)}
              </span>
              {currentFrameEntry && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <span className="text-teal-700 dark:text-teal-300 font-semibold">
                    {currentFrameEntry.detection_count > 0
                      ? `Confidence: ${(currentFrameEntry.max_confidence * 100).toFixed(1)}%`
                      : 'Clear Frame'}
                  </span>
                </>
              )}
            </div>
          </div>

          <div
            className="h-6 bg-slate-100 dark:bg-slate-950 rounded-md border border-slate-200 dark:border-slate-800 p-1 flex items-end gap-[2px] overflow-hidden"
            role="group"
            aria-label="Frame timeline scrubber"
          >
            {filteredTimeline.map((pt) => {
              const isCurrent = pt.frame_number === currentFrameNumber;
              const heightPct = Math.max(
                20,
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
                  className={`flex-1 rounded-t transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-amber-500 dark:bg-amber-400'
                      : pt.detection_count > 0
                      ? 'bg-teal-600 dark:bg-sky-400/85'
                      : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* CLEAN SUMMARY STRIP */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-5">
          <span className="inline-flex items-center gap-1.5 font-semibold text-teal-700 dark:text-teal-400">
            <CheckCircle2 className="w-4 h-4" />
            Enhancement &amp; AI Analysis Complete
          </span>
          <span className="font-mono text-slate-600 dark:text-slate-300">
            PSNR: <strong>{enh.mean_psnr_db} dB</strong> · SSIM: <strong>{enh.mean_ssim}</strong> · Speckle Reduction: <strong>+{enh.speckle_suppression_gain_pct}%</strong>
          </span>
          <span className="font-mono text-slate-600 dark:text-slate-300">
            Detected Frames: <strong>{activeFindingFrames}/{sum.total_frames_processed}</strong> ({candidateCount} cystic, {uncertainCount} uncertain)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`${jobResult.exports.reports.json.url}?download=1`}
            download={jobResult.exports.reports.json.filename}
            data-testid="download-report-json"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-mono text-[11px]"
          >
            <Download className="w-3 h-3" />
            <span>JSON</span>
          </a>
          <a
            href={`${jobResult.exports.reports.csv.url}?download=1`}
            download={jobResult.exports.reports.csv.filename}
            data-testid="download-report-csv"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-mono text-[11px]"
          >
            <Download className="w-3 h-3" />
            <span>CSV</span>
          </a>
        </div>
      </div>
    </div>
  );
};
