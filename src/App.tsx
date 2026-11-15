/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { TopNavHeader, WizardStep } from './components/TopNavHeader';
import { QuadVideoComparisonStage } from './components/QuadVideoComparisonStage';
import { FindingsReviewPanel } from './components/FindingsReviewPanel';
import { DoctorReportReaderView } from './components/DoctorReportReaderView';
import { MediaZoomModal, ZoomableMediaItem } from './components/MediaZoomModal';
import { generateDoctorPdfWithImages } from './utils/pdfExportClient';
import {
  recommendAutoEnhancementSettings,
  safeFetchJson,
} from './utils/ultrasoundAnalytics';
import type {
  HardwareProfile,
  JobResultPayload,
  ProcessingSettings,
  VideoMetadata,
} from './types/scansure';
import {
  Upload,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sliders,
  Sparkles,
  Loader2,
  Clock,
  Film,
  ShieldCheck,
  AlertCircle,
  Cpu,
} from 'lucide-react';

const DEFAULT_SETTINGS: ProcessingSettings = recommendAutoEnhancementSettings(null, 6);

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [wizardStep, setWizardStep] = useState<WizardStep>('upload');
  const [, setHardware] = useState<HardwareProfile | null>(null);
  const [activeVideoMeta, setActiveVideoMeta] = useState<VideoMetadata | null>(null);
  const [settings, setSettings] = useState<ProcessingSettings>(DEFAULT_SETTINGS);
  const [topFramesCount, setTopFramesCount] = useState<number>(6);

  const [jobResult, setJobResult] = useState<JobResultPayload | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<number>(0);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [progressStage, setProgressStage] = useState<string>('Initializing pipeline...');
  const [progressPct, setProgressPct] = useState<number>(0);
  const [framesProcessed, setFramesProcessed] = useState<number>(0);
  const [totalFrames, setTotalFrames] = useState<number>(45);
  const [etaSeconds, setEtaSeconds] = useState<number>(4);

  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [zoomModalItem, setZoomModalItem] = useState<ZoomableMediaItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    safeFetchJson<HardwareProfile>('/api/hardware').then((res) => {
      if (res.ok && res.data) {
        setHardware(res.data);
      }
    });

    // Support ?autostart=1 for automated jump-in verification while keeping `/` strictly on Step 1
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      safeFetchJson<{ status: string; result?: JobResultPayload }>('/api/jobs/demo_case01').then(
        (res) => {
          if (res.ok && res.data?.result) {
            setJobResult(res.data.result);
            setActiveVideoMeta(res.data.result.input_video);
            setWizardStep('results');
          }
        }
      );
    }
  }, []);

  const handleUploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('video', file);
      const res = await safeFetchJson<VideoMetadata>('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok || !res.data) {
        setUploadError(
          res.userMessage ||
            'Unable to read the uploaded video. Please select a valid MP4, AVI, MOV, or MKV file.'
        );
        setIsUploading(false);
        return;
      }
      const meta = res.data;
      setActiveVideoMeta(meta);
      setTotalFrames(meta.frame_count || 45);
      // Automatically configure the combined 3-stage hybrid denoising based on video quality
      const autoSettings = recommendAutoEnhancementSettings(meta, topFramesCount);
      setSettings(autoSettings);
      setIsUploading(false);
    } catch {
      setUploadError(
        'Unable to upload the selected ultrasound video. Please verify the file format (.mp4, .avi, .mov, .mkv) and try again.'
      );
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      handleUploadFile(f);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) {
      handleUploadFile(f);
    }
  };

  const handleAnalyseAndEnhance = async () => {
    if (!activeVideoMeta) return;
    setWizardStep('processing');
    setIsProcessing(true);
    setProgressStage('Validating Ultrasound Video Stream...');
    setProgressPct(6);
    setFramesProcessed(0);
    const frameTotal = activeVideoMeta.frame_count || 45;
    setTotalFrames(frameTotal);
    const startTs = Date.now();
    setEtaSeconds(Math.max(2, Math.round(frameTotal * 0.09)));
    setUploadError(null);

    const payloadSettings: ProcessingSettings = {
      ...settings,
      enhancement_method: 'auto_combined_hybrid',
      top_k_frames: topFramesCount,
    };

    const res = await safeFetchJson<{ job_id: string; status: string }>('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filepath: activeVideoMeta.filepath,
        ...payloadSettings,
      }),
    });

    if (!res.ok || !res.data?.job_id) {
      setUploadError(
        res.userMessage || 'Unable to start video enhancement. Please verify settings and retry.'
      );
      setIsProcessing(false);
      setWizardStep('settings');
      return;
    }

    pollJobUntilComplete(res.data.job_id, startTs);
  };

  const pollJobUntilComplete = (jobId: string, startTs: number) => {
    const interval = setInterval(async () => {
      const res = await safeFetchJson<{
        status: string;
        error?: string;
        result?: JobResultPayload;
        progress?: {
          stage?: string;
          progress_pct?: number;
          frames_processed?: number;
          total_frames?: number;
        };
      }>(`/api/jobs/${jobId}`);

      if (!res.ok) {
        clearInterval(interval);
        setUploadError(
          res.userMessage || 'Video processing encountered an unexpected error.'
        );
        setIsProcessing(false);
        setWizardStep('settings');
        return;
      }

      const data = res.data;
      if (data?.status === 'completed' && data.result) {
        clearInterval(interval);
        setProgressPct(100);
        setEtaSeconds(0);
        setJobResult(data.result);
        setSelectedFrame(
          data.result.detection_summary?.peak_confidence_frame || 0
        );
        setIsProcessing(false);
        setWizardStep('results');
      } else if (data?.status === 'failed') {
        clearInterval(interval);
        setUploadError(data.error || 'Video processing pipeline failed.');
        setIsProcessing(false);
        setWizardStep('settings');
      } else if (data?.progress) {
        const pct = Math.max(8, Math.min(99, data.progress.progress_pct || 18));
        setProgressStage(data.progress.stage || 'Enhancing & Analysing Frames...');
        setProgressPct(pct);
        if (typeof data.progress.frames_processed === 'number') {
          setFramesProcessed(data.progress.frames_processed);
        }
        if (typeof data.progress.total_frames === 'number') {
          setTotalFrames(data.progress.total_frames);
        }
        const elapsedSec = Math.max(0.4, (Date.now() - startTs) / 1000);
        const remainingRatio = Math.max(0.02, (100 - pct) / Math.max(10, pct));
        const computedEta = Math.max(
          1,
          Math.min(60, Math.ceil(elapsedSec * remainingRatio))
        );
        setEtaSeconds(computedEta);
      }
    }, 350);
  };

  const handleStartNewUpload = () => {
    setActiveVideoMeta(null);
    setJobResult(null);
    setUploadError(null);
    setWizardStep('upload');
  };

  const handleExportClientPdf = async () => {
    if (!jobResult) return;
    setIsGeneratingPdf(true);
    try {
      await generateDoctorPdfWithImages(jobResult, {
        facilityName: 'ScanSure AI Ultrasound Imaging Workstation',
        operatorNotes:
          'Combined 3-Stage Hybrid Despeckling & AI Anomaly Review · Prepared for Radiologist Evaluation.',
        triagePriority:
          jobResult.detection_summary.frames_with_findings > 0 ? 'priority' : 'routine',
        radiologistImpression:
          jobResult.detection_summary.frames_with_findings > 0
            ? 'AI-assisted review identified focal hypoechoic/anechoic candidate region(s) above the validated threshold. Recommend correlation with clinical history and targeted diagnostic follow-up by a qualified radiologist.'
            : 'Homogeneous parenchymal echotexture without focal cystic or solid mass above the validated threshold.',
        activeThreshold: settings.detection_threshold,
        topFramesCount,
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* Top Navigation & Sequential Stepper */}
      <TopNavHeader
        currentStep={wizardStep}
        onNavigateStep={setWizardStep}
        hasUploadedVideo={Boolean(activeVideoMeta)}
        hasActiveJob={Boolean(jobResult)}
        isProcessing={isProcessing}
        progressPct={progressPct}
        activeStudyName={activeVideoMeta?.filename}
        onExportClientPdf={handleExportClientPdf}
        isGeneratingPdf={isGeneratingPdf}
        onStartNewUpload={handleStartNewUpload}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
      />

      {/* Main Content Container */}
      <main className="flex-1 p-4 lg:p-6 max-w-[1680px] w-full mx-auto flex flex-col">
        {/* =====================================================================
            STEP 1: SINGLE CLEAN UPLOAD VIDEO PAGE + UPLOADED VIDEO DETAILS
        ===================================================================== */}
        {wizardStep === 'upload' && (
          <div
            data-testid="step-upload-page"
            className="max-w-3xl w-full mx-auto my-auto py-4 space-y-6"
          >
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="text-center max-w-lg mx-auto mb-6">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 dark:bg-sky-500/15 border border-slate-800 dark:border-sky-400/30 text-white dark:text-sky-400 flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Upload Ultrasound Video
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Select an ultrasound video file from your device to inspect its stream specifications and proceed to enhancement.
                </p>
              </div>

              {/* Upload Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                data-testid="upload-dropzone"
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-teal-600 dark:hover:border-sky-400 rounded-xl p-8 text-center bg-slate-50/70 dark:bg-slate-900/50 hover:bg-slate-100/70 dark:hover:bg-slate-900 transition-all cursor-pointer"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp4,.avi,.mov,.mkv,video/*"
                  onChange={handleFileInputChange}
                  data-testid="video-file-input"
                  className="hidden"
                />
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <Loader2 className="w-8 h-8 text-teal-600 dark:text-sky-400 animate-spin" />
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Reading &amp; Verifying Video Stream...
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <span className="px-4 py-2 rounded-lg bg-[#0F172A] dark:bg-sky-500 text-white dark:text-slate-950 text-xs font-semibold shadow-xs">
                      Choose Ultrasound Video File
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      or drag and drop video here · Supported formats: MP4, AVI, MOV, MKV
                    </span>
                  </div>
                )}
              </div>

              {uploadError && (
                <div
                  role="alert"
                  className="mt-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* VERIFIED UPLOADED VIDEO DETAILS ON THE SAME PAGE */}
              {activeVideoMeta && (
                <div
                  data-testid="uploaded-video-details"
                  className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 space-y-5 animate-fadeIn"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0" />
                      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        Uploaded Video Details Verified
                      </h2>
                    </div>
                    <span className="px-2.5 py-1 rounded-md bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 font-mono text-xs font-semibold">
                      {activeVideoMeta.filename}
                    </span>
                  </div>

                  {/* Preview + Key Video Specifications Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    <div className="md:col-span-5 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black aspect-[4/3] flex items-center justify-center">
                      {activeVideoMeta.video_url ? (
                        <video
                          src={activeVideoMeta.video_url}
                          controls
                          muted
                          playsInline
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Film className="w-8 h-8 text-slate-600" />
                      )}
                    </div>

                    <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                          Duration
                        </span>
                        <span
                          data-testid="detail-duration"
                          className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100"
                        >
                          {activeVideoMeta.duration_sec} sec
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                          Format &amp; Codec
                        </span>
                        <span
                          data-testid="detail-format"
                          className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 uppercase"
                        >
                          {activeVideoMeta.extension.replace('.', '')} · {activeVideoMeta.video_codec}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                          Resolution
                        </span>
                        <span
                          data-testid="detail-resolution"
                          className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100"
                        >
                          {activeVideoMeta.resolution}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                          Frame Rate
                        </span>
                        <span
                          data-testid="detail-fps"
                          className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100"
                        >
                          {activeVideoMeta.fps} FPS
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                          Total Frames
                        </span>
                        <span
                          data-testid="detail-frames"
                          className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100"
                        >
                          {activeVideoMeta.frame_count} frames
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                          File Size
                        </span>
                        <span
                          data-testid="detail-filesize"
                          className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100"
                        >
                          {activeVideoMeta.file_size_mb} MB
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Next Page Button */}
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      data-testid="go-to-settings-btn"
                      onClick={() => setWizardStep('settings')}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#0F172A] hover:bg-slate-800 dark:bg-sky-500 dark:hover:bg-sky-400 text-white dark:text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                    >
                      <span>Continue to Enhancement &amp; AI Settings</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =====================================================================
            STEP 2: ENHANCEMENT & AI SETTINGS PAGE (AUTO-COMBINED DENOISING)
        ===================================================================== */}
        {wizardStep === 'settings' && activeVideoMeta && (
          <div
            data-testid="step-settings-page"
            className="max-w-3xl w-full mx-auto my-auto py-4 space-y-6"
          >
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-sky-500/15 text-white dark:text-sky-400 flex items-center justify-center">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                      Enhancement &amp; AI Settings
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Video: {activeVideoMeta.filename} ({activeVideoMeta.resolution} · {activeVideoMeta.fps} FPS · {activeVideoMeta.duration_sec}s)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setWizardStep('upload')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Video Details</span>
                </button>
              </div>

              {/* 1. Automatic Combined Multi-Stage Denoising Banner (No manual dropdown) */}
              <div
                data-testid="auto-denoising-badge"
                className="p-4 rounded-xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/80 flex items-start gap-3"
              >
                <ShieldCheck className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
                      Auto-Selected Combined Hybrid Denoising
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-teal-600 text-white">
                      All 3 Engines Combined
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    Automatically calibrated for {activeVideoMeta.resolution} @ {activeVideoMeta.fps} FPS: combines{' '}
                    <strong>Adaptive Lee-Sigma Bilateral</strong> +{' '}
                    <strong>Aberdeen LFIT Anisotropic Diffusion</strong> +{' '}
                    <strong>Non-Local Means (NLM)</strong> + <strong>Bilinear CLAHE</strong>.
                  </p>
                </div>
              </div>

              {/* 2. Select How Many Top Clear Frames Needed */}
              <div className="space-y-2.5">
                <label className="block text-sm font-bold text-slate-900 dark:text-slate-100">
                  How Many Top Clear Frames Needed?
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select the number of clearest, highest-confidence enhanced frames to extract for side-by-side comparison and the doctor report.
                </p>
                <div className="grid grid-cols-5 gap-2.5 pt-1">
                  {[2, 4, 6, 8, 12].map((count) => {
                    const selected = topFramesCount === count;
                    return (
                      <button
                        key={count}
                        type="button"
                        data-testid={`top-frames-option-${count}`}
                        onClick={() => {
                          setTopFramesCount(count);
                          setSettings((s) => ({ ...s, top_k_frames: count }));
                        }}
                        className={`py-2.5 px-3 rounded-xl font-mono text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                          selected
                            ? 'bg-[#0F172A] text-white dark:bg-sky-500 dark:text-slate-950 border-slate-900 dark:border-sky-400 shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        Top {count} Frames
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Fine-Tune Enhancement & AI Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      Speckle Denoising Strength
                    </span>
                    <span className="font-mono font-bold text-teal-700 dark:text-teal-400">
                      {Math.round(settings.enhancement_strength * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={1.0}
                    step={0.05}
                    value={settings.enhancement_strength}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        enhancement_strength: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-teal-600 cursor-pointer"
                  />
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      CLAHE Contrast Recovery
                    </span>
                    <span className="font-mono font-bold text-teal-700 dark:text-teal-400">
                      {settings.clahe_clip_limit.toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1.2}
                    max={4.0}
                    step={0.1}
                    value={settings.clahe_clip_limit}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        clahe_clip_limit: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-teal-600 cursor-pointer"
                  />
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      AI Confidence Threshold
                    </span>
                    <span className="font-mono font-bold text-sky-700 dark:text-sky-400">
                      {Math.round(settings.detection_threshold * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.35}
                    max={0.85}
                    step={0.01}
                    value={settings.detection_threshold}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        detection_threshold: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      Output Video Resolution
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {activeVideoMeta.resolution}
                    </span>
                  </div>
                  <select
                    value={settings.output_resolution}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        output_resolution: e.target.value as ProcessingSettings['output_resolution'],
                      }))
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-100"
                  >
                    <option value="original">
                      Preserve Original ({activeVideoMeta.resolution})
                    </option>
                    <option value="640x480">640 × 480 (Standard Clinical)</option>
                    <option value="480x360">480 × 360 (Balanced)</option>
                    <option value="320x240">320 × 240 (Fast Rural Telehealth)</option>
                  </select>
                </div>
              </div>

              {/* Primary CTA Button: Analyse and Enhance */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end">
                <button
                  type="button"
                  data-testid="analyse-and-enhance-btn"
                  onClick={handleAnalyseAndEnhance}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-md transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Analyse and Enhance</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            STEP 3: LIVE WORK PROGRESS PAGE WITH PERCENTAGE & ESTIMATED TIME
        ===================================================================== */}
        {wizardStep === 'processing' && (
          <div
            data-testid="live-processing-page"
            className="max-w-2xl w-full mx-auto my-auto py-8"
          >
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-teal-500/15 border border-teal-500/30 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto">
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>

              <div className="space-y-1">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Analysing &amp; Enhancing Ultrasound Video...
                </h1>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {progressStage}
                </p>
              </div>

              {/* Big Live Percentage & Estimated Time Remaining */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Live Progress
                  </span>
                  <span
                    data-testid="live-progress-pct"
                    className="font-mono font-bold text-xl text-teal-600 dark:text-teal-400"
                  >
                    {Math.round(progressPct)}%
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Estimated Time
                  </span>
                  <span
                    data-testid="live-progress-eta"
                    className="font-mono font-bold text-xl text-slate-900 dark:text-slate-100 inline-flex items-center gap-1"
                  >
                    <Clock className="w-4 h-4 text-sky-500" />
                    ~{etaSeconds}s
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Frames Processed
                  </span>
                  <span className="font-mono font-bold text-xl text-slate-900 dark:text-slate-100">
                    {framesProcessed || Math.round((progressPct / 100) * totalFrames)}/{totalFrames}
                  </span>
                </div>
              </div>

              {/* Smooth Progress Bar */}
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-teal-600 to-sky-500 transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(6, Math.min(100, progressPct))}%` }}
                />
              </div>

              {/* Active Stage Steps */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left text-xs pt-2">
                {[
                  { label: '1. Video Stream & Frame Verification', threshold: 5 },
                  { label: '2. Combined 3-Stage Hybrid Speckle Denoising', threshold: 25 },
                  { label: '3. AI Cyst & Anomaly Segmentation', threshold: 55 },
                  { label: '4. Synchronized Video & Report Generation', threshold: 80 },
                ].map((s) => {
                  const done = progressPct >= s.threshold + 18;
                  const active = !done && progressPct >= s.threshold;
                  return (
                    <div
                      key={s.label}
                      className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                        done
                          ? 'bg-teal-50/60 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300'
                          : active
                          ? 'bg-sky-50/60 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 font-semibold'
                          : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-400'
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                      ) : active ? (
                        <Loader2 className="w-4 h-4 text-sky-500 animate-spin shrink-0" />
                      ) : (
                        <Cpu className="w-4 h-4 opacity-50 shrink-0" />
                      )}
                      <span className="truncate">{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            STEP 4: DEDICATED RESULTS PAGES & RADIOLOGIST REVIEW
        ===================================================================== */}
        {wizardStep === 'results' && jobResult && (
          <div
            data-testid="step-results-page"
            className="flex flex-col lg:flex-row gap-5 items-start"
          >
            <div className="flex-1 min-w-0 w-full">
              <QuadVideoComparisonStage
                jobResult={jobResult}
                activeThreshold={settings.detection_threshold}
                selectedFrame={selectedFrame}
                topFramesCount={topFramesCount}
                onChangeTopFramesCount={setTopFramesCount}
                onSelectFrame={setSelectedFrame}
                onOpenDoctorReport={() => setWizardStep('report')}
                onOpenFullKeyframes={() => setWizardStep('report')}
                onExportClientPdf={handleExportClientPdf}
                isGeneratingPdf={isGeneratingPdf}
                onOpenZoomModal={(item) => setZoomModalItem(item)}
              />
            </div>

            <FindingsReviewPanel
              jobResult={jobResult}
              activeThreshold={settings.detection_threshold}
              selectedFrame={selectedFrame}
              topFramesCount={topFramesCount}
              onChangeTopFramesCount={setTopFramesCount}
              onSelectFrame={setSelectedFrame}
              onOpenExportStage={() => setWizardStep('report')}
              onOpenZoomModal={(item) => setZoomModalItem(item)}
            />
          </div>
        )}

        {/* =====================================================================
            STEP 5: DOCTOR REPORT & EXPORT READER VIEW
        ===================================================================== */}
        {wizardStep === 'report' && jobResult && (
          <DoctorReportReaderView
            jobResult={jobResult}
            activeThreshold={settings.detection_threshold}
            topFramesCount={topFramesCount}
            onChangeTopFramesCount={setTopFramesCount}
            onSelectFrameInStudio={(frameNum) => {
              setSelectedFrame(frameNum);
              setWizardStep('results');
            }}
            onBackToResults={() => setWizardStep('results')}
          />
        )}
      </main>

      {/* Interactive Popup Lightbox Modal with Zoom In / Zoom Out */}
      <MediaZoomModal
        item={zoomModalItem}
        onClose={() => setZoomModalItem(null)}
        isDark={theme === 'dark'}
      />
    </div>
  );
}
