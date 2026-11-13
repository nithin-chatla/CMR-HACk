/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { TopNavHeader, ActiveWorkspaceTab } from './components/TopNavHeader';
import { VideoUploadAndConfigPanel } from './components/VideoUploadAndConfigPanel';
import { QuadVideoComparisonStage } from './components/QuadVideoComparisonStage';
import { FrameTimelineAndInspector } from './components/FrameTimelineAndInspector';
import { ValidationAndBenchmarkView } from './components/ValidationAndBenchmarkView';
import { HardwareAndArchitectureView } from './components/HardwareAndArchitectureView';
import { PipelineLoaderOverlay } from './components/PipelineLoaderOverlay';
import { DoctorReportReaderView } from './components/DoctorReportReaderView';
import { generateDoctorPdfWithImages } from './utils/pdfExportClient';
import type {
  BenchmarkPayload,
  HardwareProfile,
  JobResultPayload,
  ProcessingSettings,
  SampleVideoItem,
  VideoMetadata,
} from './types/scansure';
import { ShieldAlert, Sparkles, Loader2 } from 'lucide-react';

const DEFAULT_SETTINGS: ProcessingSettings = {
  enhancement_method: 'speckle_bilateral_clahe',
  enhancement_strength: 0.75,
  clahe_clip_limit: 2.2,
  gamma: 1.05,
  temporal_alpha: 0.28,
  ai_detection_enabled: true,
  detection_threshold: 0.55,
  temporal_smoothing: true,
  output_resolution: 'original',
  device: 'auto',
  top_k_frames: 4,
};

const PRESET_MAP: Record<string, string> = {
  'breast_ultrasound_cyst_case01.mp4': 'demo_case01',
  'breast_ultrasound_multifocal_case02.mp4': 'demo_case02',
  'breast_ultrasound_normal_control03.mp4': 'demo_case03',
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveWorkspaceTab>('studio');
  const [hardware, setHardware] = useState<HardwareProfile | null>(null);
  const [samples, setSamples] = useState<SampleVideoItem[]>([]);
  const [activeVideoMeta, setActiveVideoMeta] = useState<VideoMetadata | null>(null);
  const [settings, setSettings] = useState<ProcessingSettings>(DEFAULT_SETTINGS);
  const [topFramesCount, setTopFramesCount] = useState<number>(4);

  const [jobResult, setJobResult] = useState<JobResultPayload | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<number>(0);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSwitchingPreset, setIsSwitchingPreset] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [progressStage, setProgressStage] = useState<string>('Initializing...');
  const [progressPct, setProgressPct] = useState<number>(0);
  const [framesProcessed, setFramesProcessed] = useState<number>(0);
  const [totalFrames, setTotalFrames] = useState<number>(45);
  const [etaSec, setEtaSec] = useState<number>(0);

  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [benchmark, setBenchmark] = useState<BenchmarkPayload | null>(null);
  const [isLoadingBenchmark, setIsLoadingBenchmark] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/hardware')
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setHardware(data);
      })
      .catch(() => {});

    fetch('/api/samples')
      .then((r) => r.json())
      .then(async (data) => {
        if (data.samples && data.samples.length > 0) {
          setSamples(data.samples);
          const first = data.samples[0] as SampleVideoItem;
          await loadSampleVideoAndCachedJob(first);
        }
      })
      .catch(() => {});

    loadBenchmarkSuite();
  }, []);

  const loadBenchmarkSuite = () => {
    setIsLoadingBenchmark(true);
    fetch('/api/benchmark')
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setBenchmark(data);
      })
      .catch(() => {})
      .finally(() => setIsLoadingBenchmark(false));
  };

  const loadSampleVideoAndCachedJob = async (sample: SampleVideoItem) => {
    setUploadError(null);
    setIsSwitchingPreset(true);
    try {
      const probeRes = await fetch('/api/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filepath: sample.filepath }),
      });
      if (probeRes.ok) {
        const meta = await probeRes.json();
        setActiveVideoMeta(meta);
      }

      const presetJobId = PRESET_MAP[sample.filename];
      if (presetJobId) {
        const jobRes = await fetch(`/api/jobs/${presetJobId}`);
        if (jobRes.ok) {
          const jobData = await jobRes.json();
          if (jobData.status === 'completed' && jobData.result) {
            setJobResult(jobData.result);
            setSelectedFrame(
              jobData.result.detection_summary?.peak_confidence_frame || 0
            );
            setIsSwitchingPreset(false);
            return;
          }
        }
      }
      await triggerPipelineForPath(sample.filepath, DEFAULT_SETTINGS);
    } catch {
      // ignore
    } finally {
      setIsSwitchingPreset(false);
    }
  };

  const handleUploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('video', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setUploadError(data.error || 'Video validation failed');
        setIsUploading(false);
        return;
      }
      setActiveVideoMeta(data);
      setIsUploading(false);
      await triggerPipelineForPath(data.filepath, { ...settings, top_k_frames: 12 });
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload video');
      setIsUploading(false);
    }
  };

  const triggerPipelineForPath = async (
    filepath: string,
    activeSettings: ProcessingSettings
  ) => {
    setIsProcessing(true);
    setProgressStage('01. Validating Ultrasound Container & Stream...');
    setProgressPct(4);
    setFramesProcessed(0);
    setEtaSec(8.0);
    setUploadError(null);

    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filepath,
          ...activeSettings,
          top_k_frames: 12,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setUploadError(data.error || 'Failed to launch processing pipeline');
        setIsProcessing(false);
        return;
      }

      const jobId = data.job_id;
      pollJobUntilComplete(jobId);
    } catch (err: any) {
      setUploadError(err.message || 'Pipeline execution failed');
      setIsProcessing(false);
    }
  };

  const pollJobUntilComplete = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        const data = await res.json();
        if (data.status === 'completed' && data.result) {
          clearInterval(interval);
          setJobResult(data.result);
          setSelectedFrame(
            data.result.detection_summary?.peak_confidence_frame || 0
          );
          setIsProcessing(false);
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setUploadError(data.error || 'Video processing pipeline failed');
          setIsProcessing(false);
        } else if (data.progress) {
          setProgressStage(data.progress.stage || 'Processing frames...');
          setProgressPct(data.progress.progress_pct || 15);
          if (typeof data.progress.frames_processed === 'number') {
            setFramesProcessed(data.progress.frames_processed);
          }
          if (typeof data.progress.total_frames === 'number') {
            setTotalFrames(data.progress.total_frames);
          }
          if (typeof data.progress.eta_sec === 'number') {
            setEtaSec(data.progress.eta_sec);
          }
        }
      } catch {
        clearInterval(interval);
        setIsProcessing(false);
      }
    }, 450);
  };

  const handleUpdateSettings = (partial: Partial<ProcessingSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const handleRunPipeline = () => {
    if (!activeVideoMeta) return;
    triggerPipelineForPath(activeVideoMeta.filepath, settings);
  };

  const handleExportClientPdf = async () => {
    if (!jobResult) return;
    setIsGeneratingPdf(true);
    try {
      await generateDoctorPdfWithImages(jobResult, {
        facilityName: 'Rural Primary Health Center — Portable Ultrasound Unit #04',
        operatorNotes:
          'B-Mode 10MHz Linear Array scan · Right Upper Outer Quadrant · Referred for remote radiologist evaluation.',
        triagePriority:
          jobResult.detection_summary.frames_with_findings > 0 ? 'priority' : 'routine',
        radiologistImpression:
          jobResult.detection_summary.frames_with_findings > 0
            ? 'Well-circumscribed hypoechoic/anechoic region identified with posterior acoustic enhancement. Recommend correlation with clinical history and targeted diagnostic follow-up.'
            : 'Homogeneous parenchymal echotexture without focal cystic or solid mass above the validated threshold.',
        activeThreshold: settings.detection_threshold,
        topFramesCount,
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top 3-Zone Navigation Bar */}
      <TopNavHeader
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        hardware={hardware}
        onExportClientPdf={handleExportClientPdf}
        isGeneratingPdf={isGeneratingPdf}
        hasActiveJob={Boolean(jobResult)}
      />

      {/* Sleek Single-Line Clinical Status & Safety Bar */}
      <div className="bg-slate-950/90 border-b border-slate-800/80 px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-2 text-slate-300">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="font-medium text-cyan-300 whitespace-nowrap">
            Rural Triage Pipeline:
          </span>
          <span className="text-slate-400 truncate max-w-2xl">
            Speckle Denoising &amp; CLAHE Contrast Enhancement &rarr; Multi-Scale Anomaly Segmentation &rarr; Confidence-Scored Radiologist PDF &amp; JSON Handoff
          </span>
        </div>
        <div className="flex items-center gap-2 text-amber-300/90 font-mono text-[10px] whitespace-nowrap">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>CLINICAL DECISION SUPPORT · FOR QUALIFIED RADIOLOGIST REVIEW</span>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-3 lg:p-4 max-w-[1840px] w-full mx-auto">
        {activeTab === 'studio' && (
          <div className="flex flex-col lg:flex-row gap-3.5 items-stretch">
            {/* Left Dock: Video Input, Enhancement Controls & Top High-Confidence Frames Selector */}
            <VideoUploadAndConfigPanel
              samples={samples}
              activeVideoMeta={activeVideoMeta}
              settings={settings}
              topFramesCount={topFramesCount}
              onChangeTopFramesCount={setTopFramesCount}
              isProcessing={isProcessing}
              isUploading={isUploading}
              uploadError={uploadError}
              onSelectSample={loadSampleVideoAndCachedJob}
              onUploadFile={handleUploadFile}
              onUpdateSettings={handleUpdateSettings}
              onRunPipeline={handleRunPipeline}
            />

            {/* Right Main Viewport: Live Loader OR Quad & Wiper Comparison Stage */}
            <div className="flex-1 min-w-0 flex flex-col gap-3.5 relative">
              {isSwitchingPreset && (
                <div className="absolute inset-0 z-20 bg-slate-950/75 backdrop-blur-xs rounded-xl flex items-center justify-center">
                  <div className="px-4 py-2.5 rounded-xl bg-slate-900 border border-cyan-500/40 flex items-center gap-2.5 shadow-xl">
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                    <span className="text-xs font-medium text-slate-200">
                      Loading Ultrasound Study &amp; Radiologist Telemetry...
                    </span>
                  </div>
                </div>
              )}

              {isProcessing ? (
                <PipelineLoaderOverlay
                  stage={progressStage}
                  progressPct={progressPct}
                  framesProcessed={framesProcessed}
                  totalFrames={activeVideoMeta?.frame_count || totalFrames}
                  etaSec={etaSec}
                  videoFilename={activeVideoMeta?.filename}
                  topFramesCount={topFramesCount}
                />
              ) : jobResult ? (
                <QuadVideoComparisonStage
                  jobResult={jobResult}
                  activeThreshold={settings.detection_threshold}
                  selectedFrame={selectedFrame}
                  topFramesCount={topFramesCount}
                  onChangeTopFramesCount={setTopFramesCount}
                  onSelectFrame={setSelectedFrame}
                  onOpenDoctorReport={() => setActiveTab('doctor_report')}
                  onOpenFullKeyframes={() => setActiveTab('keyframes')}
                  onExportClientPdf={handleExportClientPdf}
                  isGeneratingPdf={isGeneratingPdf}
                />
              ) : (
                <div className="flex-1 bg-[#0B0E17] border border-slate-800 rounded-xl p-12 flex flex-col items-center justify-center text-center min-h-[480px]">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
                  <h2 className="text-sm font-semibold text-slate-200">
                    Loading ScanSure AI Ultrasound Study...
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 max-w-md">
                    Preparing synchronized enhanced video, AI anomaly segmentation overlays, and
                    radiologist PDF/JSON reports.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'doctor_report' && jobResult && (
          <DoctorReportReaderView
            jobResult={jobResult}
            activeThreshold={settings.detection_threshold}
            topFramesCount={topFramesCount}
            onChangeTopFramesCount={setTopFramesCount}
            onSelectFrameInStudio={(frameNum) => {
              setSelectedFrame(frameNum);
              setActiveTab('studio');
            }}
            onBackToResults={() => setActiveTab('studio')}
          />
        )}

        {activeTab === 'keyframes' && jobResult && (
          <FrameTimelineAndInspector
            jobResult={jobResult}
            activeThreshold={settings.detection_threshold}
            selectedFrame={selectedFrame}
            onSelectFrame={setSelectedFrame}
          />
        )}

        {activeTab === 'validation' && (
          <ValidationAndBenchmarkView
            jobResult={jobResult}
            benchmark={benchmark}
            isLoadingBenchmark={isLoadingBenchmark}
            onRefreshBenchmark={loadBenchmarkSuite}
          />
        )}

        {activeTab === 'hardware' && <HardwareAndArchitectureView hardware={hardware} />}
      </main>
    </div>
  );
}
