import React, { useState } from 'react';
import { Download, FileCheck2 } from 'lucide-react';
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
  const [showSideBySidePng, setShowSideBySidePng] = useState(false);
  const [clinicSiteNote, setClinicSiteNote] = useState(
    'Rural Primary Health Center · Portable Linear Probe (7.5–10 MHz) · Async Store-and-Forward Triage'
  );
  const [triagePriority, setTriagePriority] = useState<'routine' | 'priority' | 'urgent'>('priority');
  const [packetExportedToast, setPacketExportedToast] = useState(false);

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

  const handleExportRadiologistPacket = () => {
    const packet = {
      packet_type: 'ScanSure_AI_Remote_Radiologist_Review_Packet',
      problem_statement:
        'Develop an offline AI assisted imaging tool that enhances low quality ultrasound videos using denoising and contrast adjustment, then highlights potential cysts or other anomalies using computer vision. The system generates annotated images with confidence scores for remote radiologist review, supporting healthcare workers using affordable ultrasound equipment in resource limited settings.',
      generated_at_utc: new Date().toISOString(),
      rural_clinic_metadata: {
        field_notes: clinicSiteNote,
        triage_priority: triagePriority,
        workstation_host: 'jio-fiber (Intel Core i5-13420H / RTX 3050 6GB)',
      },
      input_video: jobResult.input_video,
      enhancement_metrics: jobResult.enhancement_evaluation,
      detection_summary: {
        ...jobResult.detection_summary,
        active_validated_threshold: activeThreshold,
        active_finding_frames: activeFindingFrames,
        active_cystic_candidates: candidateCount,
        active_uncertain_regions: uncertainCount,
      },
      annotated_images_with_confidence_scores: keyframes.map((kf) => {
        const frameInfo = filteredTimeline[kf.frame_number];
        return {
          frame_number: kf.frame_number,
          timestamp_sec: kf.timestamp_sec,
          annotated_image_filename: kf.filename,
          comparison_image_filename: kf.comparison_filename,
          peak_confidence_score: frameInfo?.max_confidence ?? 0,
          validated_threshold: activeThreshold,
          findings: frameInfo?.detections ?? [],
        };
      }),
      medical_disclaimer: jobResult.medical_disclaimer,
    };

    const blob = new Blob([JSON.stringify(packet, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `remote_radiologist_review_packet_${jobResult.job_id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setPacketExportedToast(true);
    setTimeout(() => setPacketExportedToast(false), 3500);
  };

  return (
    <section
      aria-label="Annotated Images with Confidence Scores for Remote Radiologist Review"
      className="bg-[#0B0E17] border border-slate-800 rounded-lg p-5 flex flex-col gap-6"
    >
      {/* Top Summary Strip */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            04. Annotated Images with Confidence Scores for Remote Radiologist Review
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Generates lightweight, high-contrast annotated PNG keyframes with raw model confidence scores so healthcare workers in resource-limited settings can transmit findings to remote radiologists.
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
              Radiologist Triage Status
            </span>
            <span
              className={`text-xs font-mono font-semibold ${
                totalActiveDetections > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {totalActiveDetections > 0
                ? '▲ Requires Remote Radiologist Review'
                : '● No Finding Above Validated Threshold'}
            </span>
          </div>
        </div>
      </div>

      {/* Annotated Images Gallery with Confidence Scores (Primary Deliverable for Remote Review) */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 font-mono">
              Generated Annotated PNG Images with Confidence Scores ({keyframes.length} Keyframes)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any annotated image to inspect its full contour and acoustic coordinates in the frame table below.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setShowSideBySidePng(false)}
              className={`px-3 py-1 rounded transition-colors whitespace-nowrap ${
                !showSideBySidePng
                  ? 'bg-cyan-400 text-slate-950 font-semibold'
                  : 'bg-slate-800 text-slate-300 hover:text-slate-100'
              }`}
            >
              Annotated Frame PNG
            </button>
            <button
              type="button"
              onClick={() => setShowSideBySidePng(true)}
              className={`px-3 py-1 rounded transition-colors whitespace-nowrap ${
                showSideBySidePng
                  ? 'bg-cyan-400 text-slate-950 font-semibold'
                  : 'bg-slate-800 text-slate-300 hover:text-slate-100'
              }`}
            >
              Side-by-Side Comparison PNG
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {keyframes.map((kf) => {
            const imgUrl =
              showSideBySidePng && kf.comparison_url ? kf.comparison_url : kf.url;
            const dlName =
              showSideBySidePng && kf.comparison_filename
                ? kf.comparison_filename
                : kf.filename;
            const kfTimelineEntry = filteredTimeline[kf.frame_number];
            const kfConf = kfTimelineEntry?.max_confidence ?? 0;
            const kfDetCount = kfTimelineEntry?.detection_count ?? 0;
            const isSelected = kf.frame_number === safeSelectedFrame;

            return (
              <div
                key={kf.frame_number}
                className={`bg-[#07090E] border rounded-md overflow-hidden flex flex-col transition-colors ${
                  isSelected ? 'border-cyan-400' : 'border-slate-800'
                }`}
              >
                <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-200 font-semibold">
                    Frame #{String(kf.frame_number).padStart(3, '0')} ({kf.timestamp_sec}s)
                  </span>
                  {kfDetCount > 0 ? (
                    <span className="text-cyan-400 font-semibold">
                      Score: {kfConf.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-slate-400">Baseline</span>
                  )}
                </div>

                <div className="relative bg-black aspect-[4/3] flex items-center justify-center">
                  <img
                    src={`${imgUrl}?t=${jobResult.job_id}`}
                    alt={kf.label}
                    referrerPolicy="no-referrer"
                    onClick={() => onSelectFrame(kf.frame_number)}
                    className="w-full h-full object-contain cursor-pointer"
                  />
                </div>

                <div className="p-2.5 flex items-center justify-between gap-2 text-xs border-t border-slate-800 bg-[#0B0E17]">
                  <span className="text-[11px] text-slate-300 truncate">
                    {kfDetCount > 0
                      ? `${kfDetCount} Region(s) · Thr ${activeThreshold.toFixed(2)}`
                      : 'No Anomaly Above Thr'}
                  </span>
                  <a
                    href={`${imgUrl}?download=1`}
                    download={dlName}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-medium rounded flex items-center gap-1 transition-colors shrink-0 whitespace-nowrap"
                  >
                    <Download className="w-3 h-3" />
                    Save PNG
                  </a>
                </div>
              </div>
            );
          })}
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
          className="h-20 bg-[#07090E] border border-slate-800 rounded p-2 flex items-end gap-1 overflow-x-auto"
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

      {/* Bottom Split: Selected Frame Coordinates Table + Remote Radiologist Triage Packet */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2 border-t border-slate-800">
        {/* Left 7 cols: Selected Frame Coordinates & Confidence Table */}
        <div className="lg:col-span-7 flex flex-col gap-3">
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
                    <th className="py-2.5 px-3 text-right">Confidence Score</th>
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

        {/* Right 5 cols: Rural Healthcare Worker -> Remote Radiologist Review Packet Builder */}
        <div className="lg:col-span-5 bg-[#07090E] border border-slate-800 rounded p-4 flex flex-col justify-between gap-3">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Remote Radiologist Review Packet (Rural Healthcare)
              </h3>
              <span className="text-[11px] font-mono text-emerald-400">
                Offline Store &amp; Forward
              </span>
            </div>

            <div>
              <label
                htmlFor="rural-clinic-note-input"
                className="block text-xs text-slate-400 mb-1"
              >
                Healthcare Worker Field Note (Probe / Quadrant / Symptoms)
              </label>
              <input
                id="rural-clinic-note-input"
                type="text"
                value={clinicSiteNote}
                onChange={(e) => setClinicSiteNote(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-[#0B0E17] border border-slate-700 rounded text-slate-100"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="triage-priority-select"
                className="text-xs text-slate-400 whitespace-nowrap"
              >
                Radiologist Review Priority
              </label>
              <select
                id="triage-priority-select"
                value={triagePriority}
                onChange={(e) =>
                  setTriagePriority(e.target.value as 'routine' | 'priority' | 'urgent')
                }
                className="px-2.5 py-1 text-xs bg-[#0B0E17] border border-slate-700 rounded text-slate-100"
              >
                <option value="routine">Routine Review (No Focal Anomaly)</option>
                <option value="priority">Priority Review (Cystic Candidate Highlighted)</option>
                <option value="urgent">Urgent Radiologist Review (Uncertain / Multifocal)</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
            {packetExportedToast ? (
              <span className="text-xs text-emerald-400 font-medium">
                ● Radiologist Review Packet exported!
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">
                Bundles {keyframes.length} annotated images + confidence scores
              </span>
            )}
            <button
              type="button"
              onClick={handleExportRadiologistPacket}
              className="px-3.5 py-1.5 text-xs font-semibold bg-cyan-400 hover:bg-cyan-300 text-slate-950 rounded flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              Export Radiologist Review Packet
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
