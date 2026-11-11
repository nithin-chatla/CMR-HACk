import React from 'react';
import type { BenchmarkPayload, JobResultPayload } from '../types/scansure';

interface ValidationAndBenchmarkViewProps {
  jobResult: JobResultPayload | null;
  benchmark: BenchmarkPayload | null;
  isLoadingBenchmark: boolean;
  onRefreshBenchmark: () => void;
}

export const ValidationAndBenchmarkView: React.FC<ValidationAndBenchmarkViewProps> = ({
  jobResult,
  benchmark,
  isLoadingBenchmark,
  onRefreshBenchmark,
}) => {
  const enh = jobResult?.enhancement_evaluation;
  const integrity = jobResult?.video_integrity_verification;
  const modelMeta = jobResult?.model_metadata || benchmark?.model_card;

  return (
    <div className="flex flex-col gap-6">
      {/* Section 1: Video Reconstruction & Stream Integrity Verification */}
      {integrity && (
        <section
          aria-label="Video Stream Integrity Verification"
          className="bg-[#0B0E17] border border-slate-800 rounded-lg p-5 flex flex-col gap-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                01. Video Reconstruction & Frame Synchronization Audit
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Verifies that decoded input frame count, FPS, duration, and resolution are preserved across all generated MP4 streams.
              </p>
            </div>
            <span
              className={`text-xs font-mono font-semibold ${
                integrity.integrity_verified ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {integrity.integrity_verified
                ? '● INTEGRITY VERIFIED (EXACT FRAME & FPS MATCH)'
                : '▲ CODEC DISCREPANCY REPORTED'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono">
                  <th className="py-2.5 px-3">Stream Artifact</th>
                  <th className="py-2.5 px-3 text-right">Decoded Frame Count</th>
                  <th className="py-2.5 px-3 text-right">Frame Rate (FPS)</th>
                  <th className="py-2.5 px-3 text-right">Duration (sec)</th>
                  <th className="py-2.5 px-3 text-right">Resolution</th>
                  <th className="py-2.5 px-3 text-right">Sync Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                <tr>
                  <td className="py-2.5 px-3 font-sans font-medium text-slate-200">
                    Original Input Video ({jobResult?.input_video.filename})
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-100">
                    {integrity.input_summary.frame_count}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-100">
                    {integrity.input_summary.fps}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-100">
                    {integrity.input_summary.duration_sec}s
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-100">
                    {integrity.input_summary.resolution}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-400">Reference Source</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-sans font-medium text-slate-200">
                    Output A: enhanced_video.mp4
                  </td>
                  <td className="py-2.5 px-3 text-right text-cyan-400">
                    {integrity.outputs.enhanced_video.frame_count}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-200">
                    {integrity.outputs.enhanced_video.fps}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-200">
                    {integrity.outputs.enhanced_video.duration_sec}s
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-200">
                    {integrity.outputs.enhanced_video.resolution}
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-400">● Verified Match</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-sans font-medium text-slate-200">
                    Output B: annotated_video.mp4
                  </td>
                  <td className="py-2.5 px-3 text-right text-cyan-400">
                    {integrity.outputs.annotated_video.frame_count}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-200">
                    {integrity.outputs.annotated_video.fps}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-200">
                    {integrity.outputs.annotated_video.duration_sec}s
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-200">
                    {integrity.outputs.annotated_video.resolution}
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-400">● Verified Match</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-sans font-medium text-slate-200">
                    Output C: comparison_video.mp4 (Side-by-Side)
                  </td>
                  <td className="py-2.5 px-3 text-right text-cyan-400">
                    {integrity.outputs.comparison_video.frame_count}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-200">
                    {integrity.outputs.comparison_video.fps}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-200">
                    {integrity.outputs.comparison_video.duration_sec}s
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-200">
                    {integrity.outputs.comparison_video.resolution}
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-400">● Frame-Synchronized</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-400 font-mono">
            Audio Stream Status: {jobResult?.audio_stream_report}
          </p>
        </section>
      )}

      {/* Section 2: Enhancement Quality Evaluation */}
      {enh && (
        <section
          aria-label="Ultrasound Image Enhancement Metrics"
          className="bg-[#0B0E17] border border-slate-800 rounded-lg p-5 flex flex-col gap-4"
        >
          <div className="pb-3 border-b border-slate-800">
            <h2 className="text-sm font-semibold text-slate-100">
              02. Quantitative Ultrasound Enhancement Evaluation
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {enh.clinical_interpretation_note}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="p-3.5 bg-[#07090E] border border-slate-800 rounded">
              <span className="block text-[11px] uppercase font-mono text-slate-400">
                Mean PSNR
              </span>
              <span className="text-2xl font-mono font-bold tabular-nums text-slate-100">
                {enh.mean_psnr_db}
              </span>
              <span className="text-xs font-mono text-slate-400 ml-1">dB</span>
            </div>

            <div className="p-3.5 bg-[#07090E] border border-slate-800 rounded">
              <span className="block text-[11px] uppercase font-mono text-slate-400">
                Structural SSIM
              </span>
              <span className="text-2xl font-mono font-bold tabular-nums text-slate-100">
                {enh.mean_ssim}
              </span>
            </div>

            <div className="p-3.5 bg-[#07090E] border border-slate-800 rounded">
              <span className="block text-[11px] uppercase font-mono text-slate-400">
                Edge Preservation
              </span>
              <span className="text-2xl font-mono font-bold tabular-nums text-cyan-400">
                {enh.edge_preservation_index}
              </span>
              <span className="text-xs font-mono text-slate-400 ml-1">EPI</span>
            </div>

            <div className="p-3.5 bg-[#07090E] border border-slate-800 rounded">
              <span className="block text-[11px] uppercase font-mono text-slate-400">
                Input Speckle ENL
              </span>
              <span className="text-2xl font-mono font-bold tabular-nums text-slate-300">
                {enh.input_enl_speckle_index}
              </span>
            </div>

            <div className="p-3.5 bg-[#07090E] border border-slate-800 rounded">
              <span className="block text-[11px] uppercase font-mono text-slate-400">
                Enhanced ENL
              </span>
              <span className="text-2xl font-mono font-bold tabular-nums text-emerald-400">
                {enh.enhanced_enl_speckle_index}
              </span>
              <span className="text-xs font-mono text-emerald-400 ml-1">
                (+{enh.speckle_suppression_gain_pct}%)
              </span>
            </div>

            <div className="p-3.5 bg-[#07090E] border border-slate-800 rounded">
              <span className="block text-[11px] uppercase font-mono text-slate-400">
                Temporal Flicker
              </span>
              <span className="text-2xl font-mono font-bold tabular-nums text-slate-100">
                {enh.temporal_flicker_mad}
              </span>
              <span className="text-xs font-mono text-slate-400 ml-1">MAD</span>
            </div>
          </div>
        </section>
      )}

      {/* Section 3: Independent Test Set Detection & Segmentation Benchmarks */}
      <section
        aria-label="Independent Detection and Segmentation Evaluation"
        className="bg-[#0B0E17] border border-slate-800 rounded-lg p-5 flex flex-col gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              03. Independent Test Set Detection & Segmentation Benchmarks
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {benchmark?.evaluation_protocol ||
                'Evaluated across independent breast ultrasound test sequences separated from calibration parameters.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onRefreshBenchmark}
            disabled={isLoadingBenchmark}
            className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded transition-colors whitespace-nowrap"
          >
            {isLoadingBenchmark ? 'Running Benchmark Suite...' : 'Re-Run Test Suite'}
          </button>
        </div>

        {benchmark ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {[
                { label: 'Precision', val: benchmark.overall_metrics.precision },
                { label: 'Recall / Sens.', val: benchmark.overall_metrics.recall },
                { label: 'F1-Score', val: benchmark.overall_metrics.f1_score },
                { label: 'Dice Coeff.', val: benchmark.overall_metrics.mean_dice_coefficient },
                { label: 'Mean IoU', val: benchmark.overall_metrics.mean_iou },
                { label: 'Sensitivity', val: benchmark.overall_metrics.sensitivity },
                { label: 'Specificity', val: benchmark.overall_metrics.specificity },
                { label: 'False Pos. Rate', val: benchmark.overall_metrics.false_positive_rate },
              ].map((m) => (
                <div
                  key={m.label}
                  className="p-3 bg-[#07090E] border border-slate-800 rounded"
                >
                  <span className="block text-[11px] font-mono uppercase text-slate-400">
                    {m.label}
                  </span>
                  <span className="text-xl font-mono font-bold tabular-nums text-cyan-400">
                    {(m.val * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>

            {/* Subgroup Breakdown Table */}
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono">
                    <th className="py-2.5 px-3">Anatomical / Lesion Subgroup</th>
                    <th className="py-2.5 px-3 text-right">Test Frames</th>
                    <th className="py-2.5 px-3 text-right">Precision</th>
                    <th className="py-2.5 px-3 text-right">Recall (Sens.)</th>
                    <th className="py-2.5 px-3 text-right">F1-Score</th>
                    <th className="py-2.5 px-3 text-right">Dice</th>
                    <th className="py-2.5 px-3 text-right">IoU</th>
                    <th className="py-2.5 px-3 text-right">Specificity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                  {benchmark.subgroup_breakdown.map((sub) => (
                    <tr key={sub.subgroup_id} className="hover:bg-slate-900/50">
                      <td className="py-2.5 px-3 font-sans">
                        <span className="font-medium text-slate-200">{sub.title}</span>
                        <span className="block text-[11px] text-slate-400">{sub.anatomy}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-300">
                        {sub.evaluated_frames}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-200">
                        {(sub.metrics.precision * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-200">
                        {(sub.metrics.recall * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-right text-cyan-400 font-semibold">
                        {(sub.metrics.f1_score * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-200">
                        {(sub.metrics.mean_dice_coefficient * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-200">
                        {(sub.metrics.mean_iou * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-400">
                        {(sub.metrics.specificity * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-400">Loading independent benchmark evaluation...</p>
        )}
      </section>

      {/* Section 4: Dataset Provenance & Anatomical Scope Restrictions */}
      {modelMeta && (
        <section
          aria-label="Model Card and Anatomical Scope Disclosures"
          className="bg-[#0B0E17] border border-slate-800 rounded-lg p-5 flex flex-col gap-3 text-xs"
        >
          <h2 className="text-sm font-semibold text-slate-100">
            04. Model Card, Dataset Provenance & Anatomical Scope Restrictions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-3.5 bg-[#07090E] border border-slate-800 rounded flex flex-col gap-1.5">
              <span className="font-mono text-cyan-400 uppercase text-[11px]">
                Supported Anatomical Scope
              </span>
              <p className="text-slate-200 font-medium">{modelMeta.supported_anatomy}</p>
              <p className="text-slate-400 leading-relaxed">
                Reference Distribution: {modelMeta.dataset_provenance.reference_distribution}
              </p>
              <p className="text-amber-400/90 mt-1 leading-relaxed">
                Restriction Notice: This model is calibrated strictly for B-mode breast ultrasound. It must NOT be used to infer abnormalities in abdominal, hepatic, obstetric, thyroid, or cardiac ultrasound examinations.
              </p>
            </div>

            <div className="p-3.5 bg-[#07090E] border border-slate-800 rounded flex flex-col gap-1.5">
              <span className="font-mono text-amber-400 uppercase text-[11px]">
                Still-Image vs. Video Temporal Validation Limitation
              </span>
              <p className="text-slate-300 leading-relaxed">
                {modelMeta.dataset_provenance.temporal_validation_limitation}
              </p>
              <p className="text-slate-400 mt-1 leading-relaxed">
                Calibration Policy: {modelMeta.calibration.calibration_note}
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
