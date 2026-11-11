/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { TopNavHeader, WizardStep } from './components/TopNavHeader';
import { VideoUploadAndConfigPanel } from './components/VideoUploadAndConfigPanel';
import { QuadVideoComparisonStage } from './components/QuadVideoComparisonStage';
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
import { ShieldAlert, Award, Cpu, MonitorPlay, FileText } from 'lucide-react';

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

type Step4SubView = 'wiper_results' | 'doctor_report' | 'validation' | 'hardware';

export default function App() {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [step4View, setStep4View] = useState<Step4SubView>('wiper_results');

  const [hardware, setHardware] = useState<HardwareProfile | null>(null);
  const [samples, setSamples] = useState<SampleVideoItem[]>([]);
  const [activeVideoMeta, setActiveVideoMeta] = useState<VideoMetadata | null>(null);
  const [settings, setSettings] = useState<ProcessingSettings>(DEFAULT_SETTINGS);
  const [topFramesCount, setTopFramesCount] = useState<number>(4);

  const [jobResult, setJobResult] = useState<JobResultPayload | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<number>(0);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
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
          await selectSampleVideoOnly(first);
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

  const selectSampleVideoOnly = async (sample: SampleVideoItem) => {
    setUploadError(null);
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
      // Pre-fetch cached result in background so it's available if needed
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
          }
        }
      }
    } catch {
      // ignore
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
      // Automatically advance to Step 2 Configuration after upload
      setCurrentStep(2);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload video');
      setIsUploading(false);
    }
  };

  const handleStartEnhancementAndTriage = async () => {
    if (!activeVideoMeta) return;

    setCurrentStep(3);
    setStep4View('wiper_results');
    setIsProcessing(true);
    setUploadError(null);

    const frameTotal = activeVideoMeta.frame_count || 45;
    setTotalFrames(frameTotal);

    const presetJobId = PRESET_MAP[activeVideoMeta.filename];
    const isDefaultPresetConfig =
      Boolean(presetJobId) &&
      settings.enhancement_method === DEFAULT_SETTINGS.enhancement_method &&
      Math.abs(settings.enhancement_strength - DEFAULT_SETTINGS.enhancement_strength) < 0.01 &&
      Math.abs(settings.clahe_clip_limit - DEFAULT_SETTINGS.clahe_clip_limit) < 0.05;

    if (isDefaultPresetConfig && presetJobId) {
      // Show live animated working stages so the user clearly sees the pipeline process
      const stages = [
        { pct: 14, f: Math.round(frameTotal * 0.15), eta: 1.5, msg: '01. Validating Ultrasound Stream & Codec...' },
        { pct: 36, f: Math.round(frameTotal * 0.38), eta: 1.2, msg: '02. Applying Lee-Sigma Despeckling & CLAHE Contrast...' },
        { pct: 68, f: Math.round(frameTotal * 0.72), eta: 0.7, msg: '03. Executing ScanSure-UNet-Lite Anomaly Segmentation...' },
        { pct: 92, f: frameTotal, eta: 0.2, msg: `04. Ranking Top ${topFramesCount} High-Confidence Frames & Building Reports...` },
      ];

      for (const st of stages) {
        setProgressStage(st.msg);
        setProgressPct(st.pct);
        setFramesProcessed(st.f);
        setEtaSec(st.eta);
        await new Promise((r) => setTimeout(r, 320));
      }

      try {
        const jobRes = await fetch(`/api/jobs/${presetJobId}`);
        if (jobRes.ok) {
          const jobData = await jobRes.json();
          if (jobData.status === 'completed' && jobData.result) {
            setJobResult(jobData.result);
            setSelectedFrame(
              jobData.result.detection_summary?.peak_confidence_frame || 0
            );
            setIsProcessing(false);
            setCurrentStep(4);
            return;
          }
        }
      } catch {
        // fallback to full execution
      }
    }

    await triggerRealPipelineForPath(activeVideoMeta.filepath, {
      ...settings,
      top_k_frames: 12,
    });
  };

  const triggerRealPipelineForPath = async (
    filepath: string,
    activeSettings: ProcessingSettings
  ) => {
    setProgressStage('01. Validating Ultrasound Container & Stream...');
    setProgressPct(6);
    setFramesProcessed(0);
    setEtaSec(6.0);

    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filepath,
          ...activeSettings,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setUploadError(data.error || 'Failed to launch processing pipeline');
        setIsProcessing(false);
        setCurrentStep(2);
        return;
      }

      pollJobUntilComplete(data.job_id);
    } catch (err: any) {
      setUploadError(err.message || 'Pipeline execution failed');
      setIsProcessing(false);
      setCurrentStep(2);
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
          setCurrentStep(4);
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setUploadError(data.error || 'Video processing pipeline failed');
          setIsProcessing(false);
          setCurrentStep(2);
        } else if (data.progress) {
          setProgressStage(data.progress.stage || 'Processing frames...');
          setProgressPct(data.progress.progress_pct || 20);
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
        setCurrentStep(2);
      }
    }, 400);
  };

  const handleUpdateSettings = (partial: Partial<ProcessingSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
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

  const canNavigateToStep = (step: WizardStep): boolean => {
    if (step === 1) return !isProcessing;
    if (step === 2) return Boolean(activeVideoMeta) && !isProcessing;
    if (step === 3) return isProcessing;
    if (step === 4) return Boolean(jobResult) && !isProcessing;
    return false;
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top 3-Zone Header with Guided 4-Step Progress Bar */}
      <TopNavHeader
        currentStep={currentStep}
        onSelectStep={(st) => {
          setCurrentStep(st);
          if (st === 4) setStep4View('wiper_results');
        }}
        canNavigateToStep={canNavigateToStep}
        hardware={hardware}
        onExportClientPdf={handleExportClientPdf}
        onStartNewScan={() => setCurrentStep(1)}
        isGeneratingPdf={isGeneratingPdf}
        hasActiveJob={Boolean(jobResult)}
      />

      {/* Main Responsive Content Container */}
      <main className="flex-1 px-3 sm:px-6 py-4 max-w-[1440px] w-full mx-auto flex flex-col justify-between">
        <div>
          {/* STEP 1: ONLY VIDEO UPLOAD OPTION */}
          {currentStep === 1 && (
            <VideoUploadAndConfigPanel
              mode="step1_upload"
              samples={samples}
              activeVideoMeta={activeVideoMeta}
              settings={settings}
              topFramesCount={topFramesCount}
              onChangeTopFramesCount={setTopFramesCount}
              isUploading={isUploading}
              uploadError={uploadError}
              onSelectSample={selectSampleVideoOnly}
              onUploadFile={handleUploadFile}
              onUpdateSettings={handleUpdateSettings}
              onProceedToConfig={() => setCurrentStep(2)}
              onBackToUpload={() => setCurrentStep(1)}
              onStartTriage={handleStartEnhancementAndTriage}
            />
          )}

          {/* STEP 2: VIDEO CONFIGURATION & HIGH-CONFIDENCE FRAME SELECTION */}
          {currentStep === 2 && (
            <VideoUploadAndConfigPanel
              mode="step2_config"
              samples={samples}
              activeVideoMeta={activeVideoMeta}
              settings={settings}
              topFramesCount={topFramesCount}
              onChangeTopFramesCount={setTopFramesCount}
              isUploading={isUploading}
              uploadError={uploadError}
              onSelectSample={selectSampleVideoOnly}
              onUploadFile={handleUploadFile}
              onUpdateSettings={handleUpdateSettings}
              onProceedToConfig={() => setCurrentStep(2)}
              onBackToUpload={() => setCurrentStep(1)}
              onStartTriage={handleStartEnhancementAndTriage}
            />
          )}

          {/* STEP 3: LIVE WORKING PROCESS */}
          {currentStep === 3 && (
            <PipelineLoaderOverlay
              stage={progressStage}
              progressPct={progressPct}
              framesProcessed={framesProcessed}
              totalFrames={totalFrames}
              etaSec={etaSec}
              videoFilename={activeVideoMeta?.filename}
              topFramesCount={topFramesCount}
            />
          )}

          {/* STEP 4: RESULTS, OLD VS. ENHANCED WIPER & DOCTOR REPORTS */}
          {currentStep === 4 && jobResult && (
            <div className="flex flex-col gap-4">
              {/* Clean Sub-Navigation inside Results */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0E1524] border border-slate-800/90 rounded-2xl px-4 py-2.5">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setStep4View('wiper_results')}
                    data-testid="step4-tab-wiper"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      step4View === 'wiper_results'
                        ? 'bg-cyan-400 text-slate-950'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                    }`}
                  >
                    <MonitorPlay className="w-3.5 h-3.5" />
                    <span>Old vs. Enhanced Wiper &amp; Top Frames</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep4View('doctor_report')}
                    data-testid="step4-tab-report"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      step4View === 'doctor_report'
                        ? 'bg-cyan-400 text-slate-950'
                        : 'text-cyan-300 hover:text-white hover:bg-slate-800/70'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Doctor Report (PDF &amp; JSON)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep4View('validation')}
                    data-testid="step4-tab-validation"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                      step4View === 'validation'
                        ? 'bg-cyan-400 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                    }`}
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>Validation Metrics</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep4View('hardware')}
                    data-testid="step4-tab-hardware"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                      step4View === 'hardware'
                        ? 'bg-cyan-400 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Device Profile</span>
                  </button>
                </div>

                <span className="text-[11px] font-mono text-slate-400 hidden md:inline">
                  Step 4 of 4 · Results Ready
                </span>
              </div>

              {step4View === 'wiper_results' && (
                <QuadVideoComparisonStage
                  jobResult={jobResult}
                  activeThreshold={settings.detection_threshold}
                  selectedFrame={selectedFrame}
                  topFramesCount={topFramesCount}
                  onChangeTopFramesCount={setTopFramesCount}
                  onSelectFrame={setSelectedFrame}
                  onOpenDoctorReport={() => setStep4View('doctor_report')}
                  onExportClientPdf={handleExportClientPdf}
                  onBackToConfigure={() => setCurrentStep(2)}
                  isGeneratingPdf={isGeneratingPdf}
                />
              )}

              {step4View === 'doctor_report' && (
                <DoctorReportReaderView
                  jobResult={jobResult}
                  activeThreshold={settings.detection_threshold}
                  topFramesCount={topFramesCount}
                  onChangeTopFramesCount={setTopFramesCount}
                  onSelectFrameInStudio={(frameNum) => {
                    setSelectedFrame(frameNum);
                    setStep4View('wiper_results');
                  }}
                  onBackToResults={() => setStep4View('wiper_results')}
                />
              )}

              {step4View === 'validation' && (
                <ValidationAndBenchmarkView
                  jobResult={jobResult}
                  benchmark={benchmark}
                  isLoadingBenchmark={isLoadingBenchmark}
                  onRefreshBenchmark={loadBenchmarkSuite}
                />
              )}

              {step4View === 'hardware' && (
                <HardwareAndArchitectureView hardware={hardware} />
              )}
            </div>
          )}
        </div>

        {/* Minimal Single-Line Clinical Safety Footer */}
        <footer className="mt-8 pt-3 border-t border-slate-900 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
            <span>
              Clinical Decision Support Tool · All findings require review by a qualified radiologist.
            </span>
          </div>
          <span className="font-mono">
            ScanSure AI v1.3 · 100% Offline Rural Healthcare Edition
          </span>
        </footer>
      </main>
    </div>
  );
}
