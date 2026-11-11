import React, { useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Download,
} from 'lucide-react';
import type { JobResultPayload } from '../types/scansure';
import { formatTimestampMillis } from '../utils/ultrasoundAnalytics';

interface QuadVideoComparisonStageProps {
  jobResult: JobResultPayload;
  activeThreshold: number;
  onSelectFrameInInspector: (frameNumber: number) => void;
}

type ViewportMode = 'quad' | 'comparison' | 'annotated' | 'enhanced' | 'original';

export const QuadVideoComparisonStage: React.FC<QuadVideoComparisonStageProps> = ({
  jobResult,
  activeThreshold,
  onSelectFrameInInspector,
}) => {
  const [viewMode, setViewMode] = useState<ViewportMode>('quad');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

  const origVideoRef = useRef<HTMLVideoElement | null>(null);
  const enhVideoRef = useRef<HTMLVideoElement | null>(null);
  const annVideoRef = useRef<HTMLVideoElement | null>(null);
  const cmpVideoRef = useRef<HTMLVideoElement | null>(null);

  const fps = jobResult.input_video.fps || 15;
  const totalFrames = jobResult.input_video.frame_count || 45;
  const durationSec = jobResult.input_video.duration_sec || 3.0;
  const currentFrame = Math.min(
    totalFrames - 1,
    Math.max(0, Math.floor(currentTime * fps))
  );

  const getAllVideos = (): HTMLVideoElement[] => {
    return [
      origVideoRef.current,
      enhVideoRef.current,
      annVideoRef.current,
      cmpVideoRef.current,
    ].filter((v): v is HTMLVideoElement => v !== null);
  };

  const syncTimeAcrossVideos = (targetTime: number) => {
    const clamped = Math.max(0, Math.min(durationSec, targetTime));
    getAllVideos().forEach((v) => {
      if (Math.abs(v.currentTime - clamped) > 0.02) {
        v.currentTime = clamped;
      }
    });
    setCurrentTime(clamped);
  };

  const handleTogglePlay = () => {
    const videos = getAllVideos();
    if (videos.length === 0) return;

    if (isPlaying) {
      videos.forEach((v) => v.pause());
      setIsPlaying(false);
    } else {
      videos.forEach((v) => {
        v.playbackRate = playbackRate;
        v.play().catch(() => {});
      });
      setIsPlaying(true);
    }
  };

  const handleStepFrame = (deltaFrames: number) => {
    getAllVideos().forEach((v) => v.pause());
    setIsPlaying(false);
    const nextFrame = Math.max(
      0,
      Math.min(totalFrames - 1, currentFrame + deltaFrames)
    );
    const nextTime = (nextFrame + 0.1) / fps;
    syncTimeAcrossVideos(nextTime);
    onSelectFrameInInspector(nextFrame);
  };

  const handleChangeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    getAllVideos().forEach((v) => {
      v.playbackRate = rate;
    });
  };

  const frameData =
    jobResult.frame_by_frame_timeline[currentFrame] ||
    jobResult.frame_by_frame_timeline[0];

  const activeFrameDetections = (frameData?.detections || []).filter(
    (d) => d.raw_confidence >= activeThreshold
  );

  const origUrl = jobResult.input_video.video_url || '/api/samples/video/breast_ultrasound_cyst_case01.mp4';
  const enhUrl = `${jobResult.exports.videos.enhanced_video.url}?t=${jobResult.job_id}`;
  const annUrl = `${jobResult.exports.videos.annotated_video.url}?t=${jobResult.job_id}`;
  const cmpUrl = `${jobResult.exports.videos.comparison_video.url}?t=${jobResult.job_id}`;

  return (
    <section
      aria-label="Synchronized Ultrasound Video Inspection Stage"
      className="flex-1 bg-[#0B0E17] border border-slate-800 rounded-lg p-5 flex flex-col gap-5"
    >
      {/* Top Toolbar: View Switcher & Synchronized Playback Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            03. Synchronized Video Outputs & Clinical Comparison
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {jobResult.input_video.filename} · {jobResult.input_video.resolution} ·{' '}
            {jobResult.input_video.frame_count} Frames Synchronized
          </p>
        </div>

        {/* Interactive Segmented Viewport Mode Control */}
        <div
          role="group"
          aria-label="Video Display Mode"
          className="flex items-center gap-1 p-1 bg-[#07090E] border border-slate-800 rounded-md"
        >
          {(
            [
              { id: 'quad', label: 'Quad Matrix' },
              { id: 'comparison', label: 'Side-by-Side MP4' },
              { id: 'annotated', label: 'AI-Annotated MP4' },
              { id: 'enhanced', label: 'Enhanced MP4' },
              { id: 'original', label: 'Original MP4' },
            ] as { id: ViewportMode; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setViewMode(tab.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                viewMode === tab.id
                  ? 'bg-slate-800 text-cyan-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Video Canvas Stage */}
      <div
        className={`grid gap-3.5 ${
          viewMode === 'quad' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
        }`}
      >
        {/* 1. Original Ultrasound Video */}
        {(viewMode === 'quad' || viewMode === 'original') && (
          <div className="bg-[#07090E] border border-slate-800 rounded-md overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-slate-200 whitespace-nowrap">
                Original Input Ultrasound
              </span>
              <span className="font-mono text-[11px] text-slate-400 whitespace-nowrap truncate">
                Source · ENL {jobResult.enhancement_evaluation.input_enl_speckle_index}
              </span>
            </div>
            <div className="relative bg-black flex items-center justify-center h-48 md:h-52">
              <video
                ref={origVideoRef}
                src={origUrl}
                muted
                playsInline
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onEnded={() => setIsPlaying(false)}
                className="w-full h-full object-contain cursor-crosshair"
              />
            </div>
          </div>
        )}

        {/* 2. Output A: Enhanced Ultrasound Video */}
        {(viewMode === 'quad' || viewMode === 'enhanced') && (
          <div className="bg-[#07090E] border border-slate-800 rounded-md overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-slate-200 whitespace-nowrap">
                Output A: Enhanced (enhanced_video.mp4)
              </span>
              <span className="font-mono text-[11px] text-cyan-400 whitespace-nowrap truncate">
                ENL {jobResult.enhancement_evaluation.enhanced_enl_speckle_index} (+
                {jobResult.enhancement_evaluation.speckle_suppression_gain_pct}% Despeckle)
              </span>
            </div>
            <div className="relative bg-black flex items-center justify-center h-48 md:h-52">
              <video
                ref={enhVideoRef}
                src={enhUrl}
                muted
                playsInline
                onTimeUpdate={(e) => {
                  if (viewMode === 'enhanced') setCurrentTime(e.currentTarget.currentTime);
                }}
                onEnded={() => setIsPlaying(false)}
                className="w-full h-full object-contain cursor-crosshair"
              />
            </div>
          </div>
        )}

        {/* 3. Output B: AI-Annotated Ultrasound Video */}
        {(viewMode === 'quad' || viewMode === 'annotated') && (
          <div className="bg-[#07090E] border border-slate-800 rounded-md overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-slate-200 whitespace-nowrap">
                Output B: AI-Annotated (annotated_video.mp4)
              </span>
              <span className="font-mono text-[11px] text-slate-300 whitespace-nowrap truncate">
                UNet-Lite · Thr {activeThreshold.toFixed(2)}
              </span>
            </div>
            <div className="relative bg-black flex items-center justify-center h-48 md:h-52">
              <video
                ref={annVideoRef}
                src={annUrl}
                muted
                playsInline
                onTimeUpdate={(e) => {
                  if (viewMode === 'annotated') setCurrentTime(e.currentTarget.currentTime);
                }}
                onEnded={() => setIsPlaying(false)}
                className="w-full h-full object-contain cursor-crosshair"
              />
            </div>
          </div>
        )}

        {/* 4. Output C: Side-by-Side Synchronized Comparison Video */}
        {(viewMode === 'quad' || viewMode === 'comparison') && (
          <div className="bg-[#07090E] border border-slate-800 rounded-md overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-slate-200 whitespace-nowrap">
                Output C: Side-by-Side (comparison_video.mp4)
              </span>
              <span className="font-mono text-[11px] text-slate-400 whitespace-nowrap truncate">
                Left: Original · Right: AI Annotated
              </span>
            </div>
            <div className="relative bg-black flex items-center justify-center h-48 md:h-52">
              <video
                ref={cmpVideoRef}
                src={cmpUrl}
                muted
                playsInline
                onTimeUpdate={(e) => {
                  if (viewMode === 'comparison') setCurrentTime(e.currentTarget.currentTime);
                }}
                onEnded={() => setIsPlaying(false)}
                className="w-full h-full object-contain cursor-crosshair"
              />
            </div>
          </div>
        )}
      </div>

      {/* Synchronized Transport Scrubber & Frame Telemetry Bar */}
      <div className="bg-[#07090E] border border-slate-800 rounded-md p-3.5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleStepFrame(-1)}
              aria-label="Previous Frame"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleTogglePlay}
              className="px-3.5 py-1.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs rounded transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  Pause Sync
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Play Synchronized
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleStepFrame(1)}
              aria-label="Next Frame"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-1 ml-2 text-xs font-mono">
              {[0.5, 1.0].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => handleChangeSpeed(rate)}
                  className={`px-2 py-1 rounded border transition-colors ${
                    playbackRate === rate
                      ? 'border-cyan-400 text-cyan-400 bg-cyan-950/30'
                      : 'border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {rate.toFixed(1)}x
                </button>
              ))}
            </div>
          </div>

          {/* Live Frame Telemetry Readout */}
          <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-300">
            <span>
              Frame #{String(currentFrame).padStart(3, '0')} / {totalFrames - 1}
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span>T+{formatTimestampMillis(currentTime)}s</span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            {activeFrameDetections.length > 0 ? (
              <span
                className={
                  activeFrameDetections.some((d) => d.is_uncertain)
                    ? 'text-amber-400 font-semibold'
                    : 'text-cyan-400 font-semibold'
                }
              >
                ● {activeFrameDetections.length} Region(s) · Raw Score{' '}
                {activeFrameDetections[0].raw_confidence.toFixed(2)}
              </span>
            ) : (
              <span className="text-slate-400">
                ○ No Detection Above Threshold ({activeThreshold.toFixed(2)})
              </span>
            )}
          </div>
        </div>

        {/* Interactive Frame Scrubber Slider */}
        <div className="flex items-center gap-3">
          <label htmlFor="sync-frame-scrubber" className="sr-only">
            Scrub Video Frame
          </label>
          <input
            id="sync-frame-scrubber"
            type="range"
            min={0}
            max={Math.max(1, totalFrames - 1)}
            value={currentFrame}
            onChange={(e) => {
              const targetF = parseInt(e.target.value, 10);
              getAllVideos().forEach((v) => v.pause());
              setIsPlaying(false);
              syncTimeAcrossVideos((targetF + 0.05) / fps);
              onSelectFrameInInspector(targetF);
            }}
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>
      </div>

      {/* Section F: Export & Save Artifacts Bar */}
      <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-400">
          <span className="font-semibold text-slate-200">Export Generated Outputs:</span>{' '}
          All videos verified at {jobResult.input_video.frame_count} frames ({jobResult.input_video.fps} FPS)
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`${jobResult.exports.videos.enhanced_video.url}?download=1`}
            download="enhanced_video.mp4"
            className="px-3 py-1.5 text-xs font-medium text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            Save enhanced_video.mp4
          </a>
          <a
            href={`${jobResult.exports.videos.annotated_video.url}?download=1`}
            download="annotated_video.mp4"
            className="px-3 py-1.5 text-xs font-medium text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            Save annotated_video.mp4
          </a>
          <a
            href={`${jobResult.exports.videos.comparison_video.url}?download=1`}
            download="comparison_video.mp4"
            className="px-3 py-1.5 text-xs font-medium text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            Save comparison_video.mp4
          </a>
          <a
            href={`${jobResult.exports.reports.csv.url}?download=1`}
            download="detection_report.csv"
            className="px-3 py-1.5 text-xs font-medium text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            Export CSV Report
          </a>
          <a
            href={`${jobResult.exports.reports.json.url}?download=1`}
            download="detection_report.json"
            className="px-3 py-1.5 text-xs font-medium text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            Export JSON Report
          </a>
        </div>
      </div>
    </section>
  );
};
