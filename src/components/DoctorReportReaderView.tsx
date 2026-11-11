import React, { useState } from 'react';
import {
  FileText,
  FileCode2,
  Download,
  Printer,
  CheckCircle2,
  Loader2,
  Copy,
  ArrowLeft,
} from 'lucide-react';
import type { JobResultPayload } from '../types/scansure';
import {
  filterTimelineByThreshold,
  selectTopConfidenceKeyframes,
} from '../utils/ultrasoundAnalytics';
import { generateDoctorPdfWithImages } from '../utils/pdfExportClient';

interface DoctorReportReaderViewProps {
  jobResult: JobResultPayload;
  activeThreshold: number;
  topFramesCount: number;
  onChangeTopFramesCount: (count: number) => void;
  onSelectFrameInStudio: (frameNumber: number) => void;
  onBackToResults: () => void;
}

export const DoctorReportReaderView: React.FC<DoctorReportReaderViewProps> = ({
  jobResult,
  activeThreshold,
  topFramesCount,
  onChangeTopFramesCount,
  onSelectFrameInStudio,
  onBackToResults,
}) => {
  const [reportFormatTab, setReportFormatTab] = useState<'visual_pdf' | 'structured_json'>(
    'visual_pdf'
  );
  const [facilityName, setFacilityName] = useState(
    'Rural Primary Health Center — Portable Ultrasound Unit #04'
  );
  const [operatorNotes, setOperatorNotes] = useState(
    'B-Mode 10MHz Linear Array scan · Right Upper Outer Quadrant · Patient referred for remote radiologist evaluation.'
  );
  const [triagePriority, setTriagePriority] = useState<'routine' | 'priority' | 'urgent'>(
    'priority'
  );
  const [radiologistImpression, setRadiologistImpression] = useState(
    'Well-circumscribed hypoechoic/anechoic region identified with posterior acoustic enhancement. Recommend correlation with clinical history and targeted diagnostic follow-up.'
  );
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  const {
    filteredTimeline,
    activeFindingFrames,
    uncertainCount,
    candidateCount,
  } = filterTimelineByThreshold(
    jobResult.frame_by_frame_timeline,
    activeThreshold
  );

  const topKeyframes = selectTopConfidenceKeyframes(
    jobResult.exports.annotated_png_frames || [],
    filteredTimeline,
    topFramesCount
  );

  const enh = jobResult.enhancement_evaluation;
  const inVid = jobResult.input_video;

  const handleDownloadRichPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      await generateDoctorPdfWithImages(jobResult, {
        facilityName,
        operatorNotes,
        triagePriority,
        radiologistImpression,
        activeThreshold,
        topFramesCount,
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const structuredJsonPayload = {
    report_type: 'ScanSure_AI_Radiologist_Diagnostic_Assistance_Report',
    version: '1.3.0-production',
    problem_statement:
      'Develop an offline AI assisted imaging tool that enhances low quality ultrasound videos using denoising and contrast adjustment, then highlights potential cysts or other anomalies using computer vision. The system generates annotated images with confidence scores for remote radiologist review, supporting healthcare workers using affordable ultrasound equipment in resource limited settings.',
    study_id: jobResult.job_id,
    generated_at_utc: jobResult.generated_at_utc,
    workstation_host: 'jio-fiber (13th Gen Intel Core i5-13420H / NVIDIA RTX 3050 6GB)',
    clinical_field_metadata: {
      facility_name: facilityName,
      operator_notes: operatorNotes,
      triage_priority: triagePriority,
      radiologist_impression_draft: radiologistImpression,
    },
    input_video_metadata: inVid,
    enhancement_metrics: enh,
    detection_summary: {
      total_frames: filteredTimeline.length,
      frames_with_findings: activeFindingFrames,
      cystic_candidates: candidateCount,
      uncertain_regions: uncertainCount,
      peak_raw_confidence: jobResult.detection_summary.peak_raw_confidence,
      validated_threshold: activeThreshold,
      selected_top_frames_count: topKeyframes.length,
      clinical_recommendation: jobResult.detection_summary.clinical_recommendation,
    },
    top_high_confidence_annotated_frames: topKeyframes.map((kf, idx) => ({
      rank: idx + 1,
      frame_number: kf.frame_number,
      timestamp_sec: kf.timestamp_sec,
      annotated_png_url: kf.url,
      comparison_png_url: kf.comparison_url,
      peak_confidence: kf.max_confidence ?? filteredTimeline[kf.frame_number]?.max_confidence ?? 0,
      detections: filteredTimeline[kf.frame_number]?.detections ?? [],
    })),
    medical_disclaimer: jobResult.medical_disclaimer,
  };

  const handleCopyJson = () => {
    navigator.clipboard?.writeText(JSON.stringify(structuredJsonPayload, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2500);
  };

  const representativeDets = [...jobResult.detections]
    .filter((d) => d.raw_confidence >= activeThreshold)
    .sort((a, b) => b.raw_confidence - a.raw_confidence)
    .slice(0, Math.min(8, topFramesCount));

  return (
    <div className="flex flex-col gap-5">
      {/* Top Action & Format Bar */}
      <div className="bg-[#0E1524] border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToResults}
            data-testid="back-to-results-btn"
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Wiper &amp; Video</span>
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-100">
              Doctor Clinical Report (PDF &amp; JSON)
            </h1>
            <p className="text-xs text-slate-400">
              Showing Top {topKeyframes.length} High-Confidence Frames · Ready for Remote Radiologist Review
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Format Switcher: PDF Report Sheet vs JSON Payload */}
          <div
            role="group"
            aria-label="Report Format Selector"
            className="flex items-center gap-1 p-1 bg-[#07090E] border border-slate-800 rounded-xl"
          >
            <button
              type="button"
              onClick={() => setReportFormatTab('visual_pdf')}
              data-testid="report-tab-pdf"
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                reportFormatTab === 'visual_pdf'
                  ? 'bg-cyan-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>1. PDF Report Sheet</span>
            </button>
            <button
              type="button"
              onClick={() => setReportFormatTab('structured_json')}
              data-testid="report-tab-json"
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                reportFormatTab === 'structured_json'
                  ? 'bg-cyan-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>2. JSON Report</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadRichPdf}
            disabled={isGeneratingPdf}
            data-testid="report-download-pdf-btn"
            className="px-4 py-2 text-xs font-bold bg-cyan-400 hover:bg-cyan-300 text-slate-950 rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            {isGeneratingPdf ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Download PDF (.pdf)</span>
          </button>

          <a
            href={`${jobResult.exports.reports.json.url}?download=1`}
            download={`ScanSure_AI_Report_${jobResult.job_id}.json`}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Download JSON (.json)</span>
          </a>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {reportFormatTab === 'visual_pdf' ? (
        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {/* Document Header */}
          <div className="bg-[#07090E] px-5 sm:px-6 py-4 border-b border-slate-800 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
                <span>SCANSURE AI DIAGNOSTIC ASSISTANCE SHEET</span>
                <span>·</span>
                <span>OFFLINE RURAL ULTRASOUND TRIAGE</span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100">
                B-Mode Breast Ultrasound Enhancement &amp; Anomaly Segmentation Report
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Study ID: <span className="font-mono text-slate-200">{jobResult.job_id}</span> · Source:{' '}
                <span className="font-mono text-slate-200">{inVid.filename}</span>
              </p>
            </div>

            <div className="text-right font-mono text-xs">
              <span
                className={`inline-block font-semibold ${
                  activeFindingFrames > 0 ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {activeFindingFrames > 0
                  ? '▲ REQUIRES RADIOLOGIST REVIEW'
                  : '● NO ANOMALY ABOVE THRESHOLD'}
              </span>
              <p className="text-slate-400 mt-1">
                Validated Threshold: {activeThreshold.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="p-5 sm:p-6 flex flex-col gap-6">
            {/* Editable Field Clinic & Doctor Impression Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#07090E] border border-slate-800 rounded-xl p-4">
              <div>
                <label
                  htmlFor="doc-facility-input"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Originating Rural Clinic / Probe Unit
                </label>
                <input
                  id="doc-facility-input"
                  type="text"
                  value={facilityName}
                  onChange={(e) => setFacilityName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-[#0B0E17] border border-slate-700 rounded-lg text-slate-100"
                />
              </div>

              <div>
                <label
                  htmlFor="doc-priority-select"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Remote Radiologist Review Priority
                </label>
                <select
                  id="doc-priority-select"
                  value={triagePriority}
                  onChange={(e) =>
                    setTriagePriority(e.target.value as 'routine' | 'priority' | 'urgent')
                  }
                  className="w-full px-3 py-1.5 text-xs bg-[#0B0E17] border border-slate-700 rounded-lg text-slate-100"
                >
                  <option value="routine">Routine Triage (Standard Review)</option>
                  <option value="priority">Priority Triage (Focal Cystic Candidate)</option>
                  <option value="urgent">Urgent Triage (Multifocal / Uncertain Mass)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="doc-notes-input"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Healthcare Worker Examination Notes
                </label>
                <input
                  id="doc-notes-input"
                  type="text"
                  value={operatorNotes}
                  onChange={(e) => setOperatorNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-[#0B0E17] border border-slate-700 rounded-lg text-slate-100"
                />
              </div>
            </div>

            {/* Section 1: 4-Column Clinical KPI Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="p-4 bg-[#07090E] border border-slate-800 rounded-xl">
                <span className="text-[11px] font-mono uppercase text-slate-400">
                  Speckle Noise Suppression
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-mono font-bold tabular-nums text-emerald-400">
                    +{enh.speckle_suppression_gain_pct}%
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    ENL {enh.input_enl_speckle_index} &rarr; {enh.enhanced_enl_speckle_index}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-[#07090E] border border-slate-800 rounded-xl">
                <span className="text-[11px] font-mono uppercase text-slate-400">
                  Boundary Preservation
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-mono font-bold tabular-nums text-cyan-400">
                    {enh.edge_preservation_index}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    EPI · SSIM {enh.mean_ssim}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-[#07090E] border border-slate-800 rounded-xl">
                <span className="text-[11px] font-mono uppercase text-slate-400">
                  Highlighted Frame Incidence
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-mono font-bold tabular-nums text-slate-100">
                    {activeFindingFrames}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    / {filteredTimeline.length} frames
                  </span>
                </div>
              </div>

              <div className="p-4 bg-[#07090E] border border-slate-800 rounded-xl">
                <span className="text-[11px] font-mono uppercase text-slate-400">
                  Peak Model Confidence
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-mono font-bold tabular-nums text-cyan-400">
                    {(jobResult.detection_summary.peak_raw_confidence * 100).toFixed(1)}%
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Raw {jobResult.detection_summary.peak_raw_confidence.toFixed(3)}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 2: User-Selected Top High-Confidence Keyframes */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Top {topKeyframes.length} High-Confidence Ultrasound Frames
                  </h3>
                  <p className="text-xs text-slate-400">
                    Side-by-side comparison (Original vs. Enhanced + AI Caliper) ranked by highest confidence score.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-[#07090E] px-3 py-1.5 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-300">Frames in Report:</span>
                  {[2, 4, 6, 8, 12].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => onChangeTopFramesCount(count)}
                      className={`px-2 py-0.5 rounded text-xs font-mono font-semibold cursor-pointer ${
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topKeyframes.map((kf, idx) => {
                  const frameInfo = filteredTimeline[kf.frame_number];
                  const conf = kf.max_confidence ?? frameInfo?.max_confidence ?? 0;
                  const dets = frameInfo?.detections ?? [];
                  const firstDet = dets[0];
                  const mmSize = firstDet
                    ? `${(firstDet.bbox_xywh[2] * 0.28).toFixed(1)} × ${(
                        firstDet.bbox_xywh[3] * 0.28
                      ).toFixed(1)} mm`
                    : 'No Focal Region';

                  return (
                    <div
                      key={kf.frame_number}
                      className="bg-[#07090E] border border-slate-800 rounded-xl overflow-hidden flex flex-col"
                    >
                      <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs">
                        <span className="font-mono font-semibold text-slate-200">
                          Rank #{idx + 1} · Frame #{String(kf.frame_number).padStart(3, '0')} (
                          {kf.timestamp_sec}s)
                        </span>
                        <span className="font-mono text-cyan-400 font-bold">
                          Confidence: {(conf * 100).toFixed(1)}%
                        </span>
                      </div>

                      <div className="bg-black aspect-[16/9] flex items-center justify-center">
                        <img
                          src={`${kf.comparison_url || kf.url}?t=${jobResult.job_id}`}
                          alt={kf.label}
                          referrerPolicy="no-referrer"
                          onClick={() => onSelectFrameInStudio(kf.frame_number)}
                          className="w-full h-full object-contain cursor-pointer"
                        />
                      </div>

                      <div className="px-4 py-2.5 bg-[#0B0E17] border-t border-slate-800 flex items-center justify-between text-xs">
                        <div className="font-mono text-slate-300">
                          <span>Caliper Est.: {mmSize}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={`${kf.url}?download=1`}
                            download={kf.filename}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded font-medium flex items-center gap-1 transition-colors"
                          >
                            <Download className="w-3 h-3" />
                            <span>Annotated PNG</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Quantitative Region Measurements Table */}
            <div>
              <h3 className="text-sm font-bold text-slate-100 mb-2.5">
                Quantitative Region Coordinates &amp; Confidence Log
              </h3>
              <div className="bg-[#07090E] border border-slate-800 rounded-xl overflow-x-auto">
                {representativeDets.length > 0 ? (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-mono">
                        <th className="py-2.5 px-4">Frame #</th>
                        <th className="py-2.5 px-4">Timestamp</th>
                        <th className="py-2.5 px-4">AI Classification</th>
                        <th className="py-2.5 px-4 text-right">Caliper Size (mm)</th>
                        <th className="py-2.5 px-4 text-right">BBox [x, y, w, h]</th>
                        <th className="py-2.5 px-4 text-right">Confidence Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                      {representativeDets.map((d, idx) => {
                        const [bx, by, bw, bh] = d.bbox_xywh;
                        return (
                          <tr key={`${d.frame_number}-${idx}`} className="hover:bg-slate-900/50">
                            <td className="py-2.5 px-4 text-slate-200">
                              Frame #{String(d.frame_number).padStart(3, '0')}
                            </td>
                            <td className="py-2.5 px-4 text-slate-300">
                              {d.timestamp_sec.toFixed(2)}s
                            </td>
                            <td className="py-2.5 px-4 font-sans">
                              <span
                                className={
                                  d.is_uncertain
                                    ? 'text-amber-400 font-medium'
                                    : 'text-cyan-400 font-medium'
                                }
                              >
                                {d.category}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right text-slate-200">
                              {(bw * 0.28).toFixed(1)} × {(bh * 0.28).toFixed(1)} mm
                            </td>
                            <td className="py-2.5 px-4 text-right text-slate-400">
                              [{bx}, {by}, {bw}, {bh}]
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold text-slate-100">
                              {(d.raw_confidence * 100).toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No suspicious regions detected above the validated threshold ({activeThreshold.toFixed(2)}).
                  </div>
                )}
              </div>
            </div>

            {/* Section 4: Reviewing Radiologist Impression & Sign-Off */}
            <div className="bg-[#07090E] border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="radiologist-impression-textarea"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-200"
                >
                  Reviewing Radiologist Clinical Impression (Included in PDF Export)
                </label>
                <span className="text-xs font-mono text-amber-400">
                  Requires Qualified Radiologist Verification
                </span>
              </div>
              <textarea
                id="radiologist-impression-textarea"
                rows={2}
                value={radiologistImpression}
                onChange={(e) => setRadiologistImpression(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#0B0E17] border border-slate-700 rounded-lg text-slate-100 leading-relaxed"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#0E1524] border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-xl">
          <div className="px-6 py-4 bg-[#07090E] border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-100">
                Structured Machine-Readable JSON Report (detection_report.json)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Includes top {topKeyframes.length} high-confidence frames, caliper coordinates, and enhancement metrics.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleCopyJson}
                className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedJson ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied JSON</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
              <a
                href={`${jobResult.exports.reports.json.url}?download=1`}
                download={`detection_report_${jobResult.job_id}.json`}
                className="px-3.5 py-1.5 text-xs font-bold bg-cyan-400 hover:bg-cyan-300 text-slate-950 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save detection_report.json</span>
              </a>
            </div>
          </div>

          <pre className="p-6 text-xs font-mono text-slate-200 bg-[#07090E] overflow-x-auto max-h-[600px] leading-relaxed">
            {JSON.stringify(structuredJsonPayload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
