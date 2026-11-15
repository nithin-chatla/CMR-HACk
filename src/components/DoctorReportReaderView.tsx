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
  Film,
  FileSpreadsheet,
  ShieldAlert,
  Image as ImageIcon,
} from 'lucide-react';
import type { JobResultPayload } from '../types/scansure';
import {
  ENHANCEMENT_METHOD_INFO,
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
    'B-Mode 10MHz Linear Array scan · Right Upper Outer Quadrant · Referred for remote radiologist evaluation.'
  );
  const [triagePriority, setTriagePriority] = useState<'routine' | 'priority' | 'urgent'>(
    'priority'
  );
  const [radiologistImpression, setRadiologistImpression] = useState(
    'AI-assisted review identified focal hypoechoic/anechoic candidate region(s) above the validated threshold. Recommend correlation with clinical history and targeted diagnostic evaluation by a qualified radiologist.'
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
  const cfg = jobResult.processing_configuration;
  const modelMeta = jobResult.model_metadata;
  const methodMeta =
    ENHANCEMENT_METHOD_INFO[cfg.enhancement_method] ||
    ENHANCEMENT_METHOD_INFO.speckle_bilateral_clahe;

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
    report_type: 'ScanSure_AI_Radiologist_Review_Report',
    version: '1.4.0-workstation',
    study_identifier: jobResult.job_id,
    generated_at_utc: jobResult.generated_at_utc,
    radiologist_review_disclaimer:
      'AI-assisted finding. Requires qualified radiologist review. Not an autonomous medical diagnosis.',
    clinical_field_metadata: {
      facility_name: facilityName,
      operator_notes: operatorNotes,
      triage_priority: triagePriority,
      radiologist_impression_draft: radiologistImpression,
    },
    video_metadata: inVid,
    processing_settings: cfg,
    model_information: modelMeta,
    enhancement_metrics: enh,
    findings_summary: {
      total_frames_processed: filteredTimeline.length,
      frames_with_findings: activeFindingFrames,
      potential_cystic_regions: candidateCount,
      uncertain_regions: uncertainCount,
      peak_raw_model_score: jobResult.detection_summary.peak_raw_confidence,
      validated_threshold: activeThreshold,
      score_interpretation: modelMeta.calibration.calibration_note,
    },
    selected_annotated_frames: topKeyframes.map((kf, idx) => ({
      rank: idx + 1,
      frame_number: kf.frame_number,
      timestamp_sec: kf.timestamp_sec,
      annotated_png_url: kf.url,
      comparison_png_url: kf.comparison_url,
      raw_model_score:
        kf.max_confidence ?? filteredTimeline[kf.frame_number]?.max_confidence ?? 0,
      detections: filteredTimeline[kf.frame_number]?.detections ?? [],
    })),
    technical_limitations: {
      supported_anatomy: modelMeta.supported_anatomy,
      unsupported_anatomies: modelMeta.unsupported_anatomies,
      temporal_validation_note:
        modelMeta.dataset_provenance.temporal_validation_limitation,
    },
  };

  const handleCopyJson = () => {
    navigator.clipboard?.writeText(JSON.stringify(structuredJsonPayload, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2500);
  };

  const representativeDets = [...jobResult.detections]
    .filter((d) => d.raw_confidence >= activeThreshold)
    .sort((a, b) => b.raw_confidence - a.raw_confidence)
    .slice(0, Math.min(10, topFramesCount));

  return (
    <div className="flex flex-col gap-5 max-w-[1440px] mx-auto">
      {/* SECTION A: COMPLETE EXPORT MATRIX (ALL 7 REQUIRED EXPORTS) */}
      <section
        aria-label="Export Artifacts and Reports"
        className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToResults}
              data-testid="back-to-results-btn"
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Viewer</span>
            </button>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Export &amp; Clinical Report Studio
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Study ID: <span className="font-mono">{jobResult.job_id}</span> ·{' '}
                {inVid.filename}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              role="group"
              aria-label="Report View Format"
              className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
            >
              <button
                type="button"
                onClick={() => setReportFormatTab('visual_pdf')}
                data-testid="report-tab-pdf"
                className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                  reportFormatTab === 'visual_pdf'
                    ? 'bg-[#0F172A] text-white dark:bg-sky-500 dark:text-slate-950'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Document Report</span>
              </button>
              <button
                type="button"
                onClick={() => setReportFormatTab('structured_json')}
                data-testid="report-tab-json"
                className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                  reportFormatTab === 'structured_json'
                    ? 'bg-[#0F172A] text-white dark:bg-sky-500 dark:text-slate-950'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FileCode2 className="w-3.5 h-3.5" />
                <span>JSON Payload</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* 7 Export Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* 1. PDF Report */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-2">
            <div>
              <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-teal-700 dark:text-sky-400" />
                <span>Clinical PDF Report</span>
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Illustrated report with top {topKeyframes.length} annotated frames
              </p>
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={handleDownloadRichPdf}
                disabled={isGeneratingPdf}
                data-testid="report-download-pdf-btn"
                className="flex-1 py-1.5 px-2.5 rounded bg-[#0F172A] hover:bg-slate-800 dark:bg-sky-500 dark:hover:bg-sky-400 text-white dark:text-slate-950 font-semibold flex items-center justify-center gap-1 cursor-pointer"
              >
                {isGeneratingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Illustrated PDF</span>
              </button>
              {jobResult.exports.reports.pdf && (
                <a
                  href={`${jobResult.exports.reports.pdf.url}?download=1`}
                  download={jobResult.exports.reports.pdf.filename}
                  data-testid="download-server-pdf"
                  className="py-1.5 px-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-100"
                >
                  Summary PDF
                </a>
              )}
            </div>
          </div>

          {/* 2. Processed Videos (Enhanced, Annotated, Side-by-Side) */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-2 sm:col-span-2">
            <div>
              <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-teal-700 dark:text-sky-400" />
                <span>Synchronized Ultrasound Video Streams (.MP4)</span>
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Frame-exact ({inVid.frame_count} frames @ {inVid.fps} FPS, {inVid.resolution})
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <a
                href={`${jobResult.exports.videos.enhanced_video.url}?download=1`}
                download={jobResult.exports.videos.enhanced_video.filename}
                className="py-1.5 px-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium flex items-center justify-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <Download className="w-3 h-3" />
                <span>Enhanced MP4</span>
              </a>
              <a
                href={`${jobResult.exports.videos.annotated_video.url}?download=1`}
                download={jobResult.exports.videos.annotated_video.filename}
                className="py-1.5 px-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium flex items-center justify-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <Download className="w-3 h-3" />
                <span>Annotated MP4</span>
              </a>
              <a
                href={`${jobResult.exports.videos.comparison_video.url}?download=1`}
                download={jobResult.exports.videos.comparison_video.filename}
                className="py-1.5 px-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium flex items-center justify-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <Download className="w-3 h-3" />
                <span>Comparison MP4</span>
              </a>
            </div>
          </div>

          {/* 3. Structured Data (JSON & CSV Findings) */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-2">
            <div>
              <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-teal-700 dark:text-sky-400" />
                <span>Structured Telemetry</span>
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Frame-level JSON report &amp; CSV findings log
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <a
                href={`${jobResult.exports.reports.json.url}?download=1`}
                download={jobResult.exports.reports.json.filename}
                className="py-1.5 px-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium flex items-center justify-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <Download className="w-3 h-3" />
                <span>JSON Report</span>
              </a>
              <a
                href={`${jobResult.exports.reports.csv.url}?download=1`}
                download={jobResult.exports.reports.csv.filename}
                className="py-1.5 px-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium flex items-center justify-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <Download className="w-3 h-3" />
                <span>CSV Findings</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION B: ELEGANT DOCUMENT-STYLE CLINICAL REPORT OR JSON VIEW */}
      {reportFormatTab === 'visual_pdf' ? (
        <article
          aria-label="Clinical Ultrasound Report Sheet"
          className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs"
        >
          {/* Document Letterhead */}
          <div className="px-6 py-5 bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-mono text-teal-700 dark:text-sky-400 font-semibold">
                SCANSURE AI · OFFLINE ULTRASOUND ENHANCEMENT &amp; TRIAGE REPORT
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
                B-Mode Breast Ultrasound Video Enhancement &amp; AI-Assisted Review Sheet
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Study Identifier: <span className="font-mono font-semibold">{jobResult.job_id}</span>{' '}
                · Generated: <span className="font-mono">{jobResult.generated_at_utc}</span>
              </p>
            </div>

            <div className="text-right text-xs">
              <span
                className={`inline-block px-3 py-1 rounded-md font-semibold border ${
                  activeFindingFrames > 0
                    ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                    : 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800'
                }`}
              >
                {activeFindingFrames > 0
                  ? 'AI-Assisted Finding: Radiologist Review Required'
                  : 'No Candidate Region Above Validated Threshold'}
              </span>
              <p className="font-mono text-slate-500 dark:text-slate-400 mt-1.5">
                Validated Score Threshold: {activeThreshold.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Mandatory Clinical Disclaimer Banner */}
            <div className="p-3.5 rounded-lg bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Radiologist Review Disclaimer: </span>
                <span>
                  AI-assisted finding. Requires qualified radiologist review. ScanSure AI is a clinical decision-support and video enhancement workstation, not an autonomous diagnostic system.
                </span>
              </div>
            </div>

            {/* 1. Study Metadata, Processing Settings & Model Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                  1. Study &amp; Video Metadata
                </h3>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Source File:</span>
                  <span className="font-mono text-slate-900 dark:text-slate-200 truncate max-w-[180px]">
                    {inVid.filename}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Resolution &amp; FPS:</span>
                  <span className="font-mono text-slate-900 dark:text-slate-200">
                    {inVid.resolution} @ {inVid.fps} FPS
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Duration &amp; Frames:</span>
                  <span className="font-mono text-slate-900 dark:text-slate-200">
                    {inVid.duration_sec}s ({inVid.frame_count} frames)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Stream Sync:</span>
                  <span className="font-mono text-teal-700 dark:text-teal-400 font-semibold">
                    Verified ({inVid.frame_count}/{inVid.frame_count})
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                  2. Enhancement Configuration
                </h3>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Operator:</span>
                  <span className="font-mono text-slate-900 dark:text-slate-200 truncate max-w-[180px]">
                    {methodMeta.shortLabel}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Strength &amp; CLAHE:</span>
                  <span className="font-mono text-slate-900 dark:text-slate-200">
                    {Math.round(cfg.enhancement_strength * 100)}% · Clip {cfg.clahe_clip_limit}x
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Speckle Gain (ENL):</span>
                  <span className="font-mono text-teal-700 dark:text-teal-400 font-semibold">
                    +{enh.speckle_suppression_gain_pct}% ({enh.input_enl_speckle_index}&rarr;
                    {enh.enhanced_enl_speckle_index})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">PSNR / SSIM / EPI:</span>
                  <span className="font-mono text-slate-900 dark:text-slate-200">
                    {enh.mean_psnr_db}dB · {enh.mean_ssim} · {enh.edge_preservation_index}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                  3. Model &amp; Score Interpretation
                </h3>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Model Architecture:</span>
                  <span className="font-mono text-slate-900 dark:text-slate-200">
                    {modelMeta.model_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Supported Anatomy:</span>
                  <span className="font-mono text-slate-900 dark:text-slate-200">
                    {modelMeta.supported_anatomy}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Peak Raw Score:</span>
                  <span className="font-mono text-slate-900 dark:text-slate-200 font-semibold">
                    {jobResult.detection_summary.peak_raw_confidence.toFixed(3)} (Frame #
                    {jobResult.detection_summary.peak_confidence_frame})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Score Type:</span>
                  <span className="font-mono text-amber-700 dark:text-amber-300">
                    Uncalibrated Model Score
                  </span>
                </div>
              </div>
            </div>

            {/* Editable Clinic & Operator Notes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <label
                  htmlFor="doc-facility-input"
                  className="block font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Originating Clinic / Probe Unit
                </label>
                <input
                  id="doc-facility-input"
                  type="text"
                  value={facilityName}
                  onChange={(e) => setFacilityName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label
                  htmlFor="doc-priority-select"
                  className="block font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Radiologist Review Priority
                </label>
                <select
                  id="doc-priority-select"
                  value={triagePriority}
                  onChange={(e) =>
                    setTriagePriority(e.target.value as 'routine' | 'priority' | 'urgent')
                  }
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
                >
                  <option value="routine">Routine Review</option>
                  <option value="priority">Priority Review (Candidate Region)</option>
                  <option value="urgent">Urgent Review (Multifocal / Uncertain)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="doc-notes-input"
                  className="block font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Sonographer / Operator Notes
                </label>
                <input
                  id="doc-notes-input"
                  type="text"
                  value={operatorNotes}
                  onChange={(e) => setOperatorNotes(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* 4. Annotated Image Previews (User-Selectable Count) */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-teal-700 dark:text-sky-400" />
                    <span>
                      4. Selected Annotated Ultrasound Keyframes (Top {topKeyframes.length} by Model Score)
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Side-by-side comparison (Original B-Mode vs. Enhanced + AI Region Overlay).
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                  <span className="text-slate-600 dark:text-slate-300">Frames in Report:</span>
                  {[2, 4, 6, 8, 12].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => onChangeTopFramesCount(count)}
                      className={`px-2 py-0.5 rounded font-mono font-semibold cursor-pointer ${
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
                    : 'No Focal Region Above Threshold';

                  return (
                    <div
                      key={kf.frame_number}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50 dark:bg-slate-900/60 flex flex-col"
                    >
                      <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          Rank #{idx + 1} · Frame #{String(kf.frame_number).padStart(3, '0')} (
                          {kf.timestamp_sec}s)
                        </span>
                        <span className="font-mono text-teal-700 dark:text-sky-400 font-semibold">
                          Raw Score: {conf.toFixed(2)} ({(conf * 100).toFixed(1)}%)
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

                      <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                        <span className="font-mono text-slate-600 dark:text-slate-400">
                          Caliper Estimate: {mmSize}
                        </span>
                        <div className="flex items-center gap-2">
                          <a
                            href={`${kf.url}?download=1`}
                            download={kf.filename}
                            className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium flex items-center gap-1 hover:bg-slate-100"
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

            {/* 5. Frame-Level Findings Table */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                5. Frame-Level AI-Assisted Findings &amp; Model Scores
              </h3>
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
                {representativeDets.length > 0 ? (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                        <th className="py-2.5 px-4">Frame #</th>
                        <th className="py-2.5 px-4">Timestamp</th>
                        <th className="py-2.5 px-4">AI-Assisted Finding Category</th>
                        <th className="py-2.5 px-4 text-right">Caliper Est. (mm)</th>
                        <th className="py-2.5 px-4 text-right">BBox [x, y, w, h]</th>
                        <th className="py-2.5 px-4 text-right">Raw Model Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono tabular-nums">
                      {representativeDets.map((d, idx) => {
                        const [bx, by, bw, bh] = d.bbox_xywh;
                        return (
                          <tr
                            key={`${d.frame_number}-${idx}`}
                            className="hover:bg-slate-50 dark:hover:bg-slate-900/50"
                          >
                            <td className="py-2.5 px-4 text-slate-900 dark:text-slate-200">
                              Frame #{String(d.frame_number).padStart(3, '0')}
                            </td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                              {d.timestamp_sec.toFixed(2)}s
                            </td>
                            <td className="py-2.5 px-4 font-sans">
                              <span
                                className={
                                  d.is_uncertain
                                    ? 'text-amber-700 dark:text-amber-300 font-medium'
                                    : 'text-teal-800 dark:text-sky-300 font-medium'
                                }
                              >
                                {d.is_uncertain
                                  ? 'Potential uncertain hypoechoic region'
                                  : 'Potential cystic / anechoic region'}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right text-slate-800 dark:text-slate-200">
                              {(bw * 0.28).toFixed(1)} × {(bh * 0.28).toFixed(1)} mm
                            </td>
                            <td className="py-2.5 px-4 text-right text-slate-500 dark:text-slate-400">
                              [{bx}, {by}, {bw}, {bh}]
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold text-slate-900 dark:text-slate-100">
                              {d.raw_confidence.toFixed(2)} ({(d.raw_confidence * 100).toFixed(1)}%)
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    No candidate regions exceeded the validated threshold ({activeThreshold.toFixed(2)}).
                  </div>
                )}
              </div>
            </div>

            {/* 6. Technical Limitations & Radiologist Sign-Off */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                  6. Technical Limitations &amp; Scope
                </h4>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  <strong>Anatomical Scope:</strong> Calibrated strictly for {modelMeta.supported_anatomy}. Do not extrapolate to obstetric, cardiac, abdominal, or thyroid scans.
                </p>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  <strong>Score Calibration:</strong> {modelMeta.calibration.calibration_note}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <label
                  htmlFor="radiologist-impression-textarea"
                  className="block font-semibold text-slate-900 dark:text-slate-100"
                >
                  7. Reviewing Radiologist Impression &amp; Notes
                </label>
                <textarea
                  id="radiologist-impression-textarea"
                  rows={3}
                  value={radiologistImpression}
                  onChange={(e) => setRadiologistImpression(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 leading-relaxed"
                />
              </div>
            </div>
          </div>
        </article>
      ) : (
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-xs">
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Structured Machine-Readable JSON Report (detection_report.json)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Includes study metadata, processing configuration, model limitations, and frame-level findings.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyJson}
                className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedJson ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>Copied JSON</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
              <a
                href={`${jobResult.exports.reports.json.url}?download=1`}
                download={`detection_report_${jobResult.job_id}.json`}
                className="px-3.5 py-1.5 text-xs font-semibold bg-[#0F172A] hover:bg-slate-800 dark:bg-sky-500 dark:hover:bg-sky-400 text-white dark:text-slate-950 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download JSON</span>
              </a>
            </div>
          </div>

          <pre className="p-6 text-xs font-mono text-slate-800 dark:text-slate-200 bg-slate-50/50 dark:bg-[#080C14] overflow-x-auto max-h-[600px] leading-relaxed">
            {JSON.stringify(structuredJsonPayload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
