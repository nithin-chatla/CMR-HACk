import React, { useState } from 'react';
import { Download } from 'lucide-react';
import type { JobResultPayload } from '../types/scansure';
import {
  classifyConfidenceStatus,
  filterTimelineByThreshold,
} from '../utils/ultrasoundAnalytics';

interface FrameTimelineAndInspectorProps {
  jobResult: JobResultPayload;
  activeThreshold: number;
  selectedFrame: number;
  onSelectFrame: (frameNumber: number) => void;
}

export const FrameTimelineAndInspector: React.FC<FrameTimelineAndInspectorProps> = ({
  jobResult,
  activeThreshold,
  selectedFrame,
  onSelectFrame,
}) => {
  const [showSideBySidePng, setShowSideBySidePng] = useState(true);

  const {
    filteredTimeline,
    activeFindingFrames,
    totalActiveDetections,
    uncertainCount,
    candidateCount,
  } = filterTimelineByThreshold(
    jobResult.frame_by_frame_timeline,
    activeThreshold
  );

  const safeSelectedFrame = Math.min(
    Math.max(0, selectedFrame),
    Math.max(0, filteredTimeline.length - 1)
  );
  const currentEntry = filteredTimeline[safeSelectedFrame] || filteredTimeline[0];
  const keyframes = jobResult.exports.annotated_png_frames || [];

  return (
    <section
      aria-label="Frame-Level Detections and Annotated Keyframes"
      className="bg-[#0B0E17] border border-slate-800 rounded-lg p-5 flex flex-col gap-6"
    >
      {/* Top Summary Strip */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            04. Frame-Level Anomaly Analysis, Confidence & Keyframe Export
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            {jobResult.detection_summary.confidence_disclosure}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs">
          <div>
            <span className="block text-[11px] uppercase tracking-wider font-mono text-slate-400">
              Frames With Findings
            </span>
            <span className="text-xl font-mono font-bold tabular-nums text-slate-100">
              {activeFindingFrames}
            </span>
            <span className="text-xs font-mono text-slate-400 ml-1.5">
              / {filteredTimeline.length}
            </span>
          </div>

          <div>
            <span className="block text-[11px] uppercase tracking-wider font-mono text-slate-400">
              Cystic Candidates
            </span>
            <span className="text-xl font-mono font-bold tabular-nums text-cyan-400">
              {candidateCount}
            </span>
            <span className="text-xs font-mono text-slate-400 ml-1.5">
              instances
            </span>
          </div>

          <div>
            <span className="block text-[11px] uppercase tracking-wider font-mono text-slate-400">
              Uncertain Regions
            </span>
            <span className="text-xl font-mono font-bold tabular-nums text-amber-400">
              {uncertainCount}
            </span>
            <span className="text-xs font-mono text-slate-400 ml-1.5">
              review req.
            </span>
          </div>

          <div>
            <span className="block text-[11px] uppercase tracking-wider font-mono text-slate-400">
              Clinical Status
            </span>
            <span
              className={`text-xs font-mono font-semibold ${
                totalActiveDetections > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {totalActiveDetections > 0
                ? '▲ Uncertain — Requires Radiologist Review'
                : '● No Finding Above Validated Threshold'}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Frame-by-Frame Confidence & Speckle Suppression Chart */}
      <div>
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-medium text-slate-200">
            Temporal Raw Confidence Profile Across Cine Loop (Click any frame bar to inspect)
          </span>
          <span className="font-mono text-slate-400">
            Validated Threshold: {activeThreshold.toFixed(2)} · Uncertain Band: {activeThreshold.toFixed(2)}–0.72
          </span>
        </div>

        <div
          role="list"
          aria-label="Frame Confidence Timeline"
          className="h-24 bg-[#07090E] border border-slate-800 rounded p-2 flex items-end gap-1 overflow-x-auto"
        >
          {filteredTimeline.map((item) => {
            const conf = item.max_confidence;
            const isSelected = item.frame_number === safeSelectedFrame;
            const heightPct = Math.max(8, Math.round(conf * 100));
            const statusObj = classifyConfidenceStatus(conf, activeThreshold, 0.72);

            let barColor = 'bg-slate-700';
            if (statusObj.status === 'candidate_detected') {
              barColor = 'bg-cyan-400';
            } else if (statusObj.status === 'uncertain_review') {
              barColor = 'bg-amber-400';
            }

            return (
              <button
                key={item.frame_number}
                type="button"
                onClick={() => onSelectFrame(item.frame_number)}
                title={`Frame #${item.frame_number} (${item.timestamp_sec}s) — Score: ${conf.toFixed(2)}`}
                aria-label={`Inspect Frame ${item.frame_number}`}
                className={`flex-1 min-w-[10px] h-full flex flex-col justify-end rounded-xs transition-opacity focus-visible:outline-1 focus-visible:outline-cyan-400 ${
                  isSelected ? 'ring-1 ring-white opacity-100' : 'opacity-80 hover:opacity-100'
                }`}
              >
                <div
                  className={`w-full rounded-t-xs ${barColor}`}
                  style={{ height: `${heightPct}%` }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Frame Detailed Table + Annotated PNG Keyframes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 6 cols: Selected Frame Coordinates & Confidence Table */}
        <div className="lg:col-span-6 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Selected Frame #{safeSelectedFrame} Telemetry ({currentEntry?.timestamp_sec}s)
            </h3>
            <span className="text-xs font-mono text-slate-400">
              PSNR {currentEntry?.quality.psnr_db} dB · SSIM {currentEntry?.quality.ssim} · ENL{' '}
              {currentEntry?.quality.enl_enhanced}
            </span>
          </div>

          <div className="bg-[#07090E] border border-slate-800 rounded overflow-hidden">
            {currentEntry && currentEntry.detections.length > 0 ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                    <th className="py-2.5 px-3">Track</th>
                    <th className="py-2.5 px-3">Category & Review Status</th>
                    <th className="py-2.5 px-3 text-right">BBox [x,y,w,h]</th>
                    <th className="py-2.5 px-3 text-right">Area (px)</th>
                    <th className="py-2.5 px-3 text-right">Raw Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                  {currentEntry.detections.map((det, idx) => (
                    <tr key={`${det.track_id}-${idx}`} className="hover:bg-slate-900/60">
                      <td className="py-2.5 px-3 text-slate-300">#{det.track_id}</td>
                      <td className="py-2.5 px-3 font-sans">
                        <span
                          className={
                            det.is_uncertain
                              ? 'text-amber-400 font-medium'
                              : 'text-cyan-400 font-medium'
                          }
                        >
                          {det.category}
                        </span>
                        <span className="block text-[11px] text-slate-400">
                          Persistence: {det.temporal_persistence_frames} frames · Echogenicity:{' '}
                          {det.mean_echogenicity}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-300">
                        [{det.bbox_xywh.join(', ')}]
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-300">{det.area_px}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-100">
                        {det.raw_confidence.toFixed(3)}{' '}
                        <span className="text-[10px] text-slate-400">
                          (Thr {det.validated_threshold.toFixed(2)})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6 text-center text-xs text-slate-400">
                <p className="font-medium text-slate-300 mb-1">
                  No suspicious region detected above validated threshold ({activeThreshold.toFixed(2)}) in Frame #{safeSelectedFrame}.
                </p>
                <p>
                  ScanSure AI suppresses unvalidated low-confidence activations to prevent false-positive clutter.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right 6 cols: Exported Annotated PNG Keyframes */}
        <div className="lg:col-span-6 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Exported Annotated PNG Keyframes ({keyframes.length})
            </h3>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowSideBySidePng(true)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  showSideBySidePng
                    ? 'bg-slate-800 text-cyan-400 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Side-by-Side PNG
              </button>
              <button
                type="button"
                onClick={() => setShowSideBySidePng(false)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  !showSideBySidePng
                    ? 'bg-slate-800 text-cyan-400 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Annotated Single PNG
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {keyframes.map((kf) => {
              const imgUrl =
                showSideBySidePng && kf.comparison_url ? kf.comparison_url : kf.url;
              const dlName =
                showSideBySidePng && kf.comparison_filename
                  ? kf.comparison_filename
                  : kf.filename;
              return (
                <div
                  key={kf.frame_number}
                  className="bg-[#07090E] border border-slate-800 rounded overflow-hidden flex flex-col"
                >
                  <div className="relative bg-black aspect-[16/9] flex items-center justify-center">
                    <img
                      src={`${imgUrl}?t=${jobResult.job_id}`}
                      alt={kf.label}
                      referrerPolicy="no-referrer"
                      onClick={() => onSelectFrame(kf.frame_number)}
                      className="w-full h-full object-contain cursor-pointer"
                    />
                  </div>
                  <div className="p-2.5 flex items-center justify-between gap-2 text-xs border-t border-slate-800">
                    <span className="font-mono text-slate-300 truncate" title={kf.label}>
                      Frame #{kf.frame_number} ({kf.timestamp_sec}s)
                    </span>
                    <a
                      href={`${imgUrl}?download=1`}
                      download={dlName}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded flex items-center gap-1 transition-colors shrink-0"
                    >
                      <Download className="w-3 h-3" />
                      PNG
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
