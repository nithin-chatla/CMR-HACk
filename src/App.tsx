/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { TopNavHeader, type ActiveTab } from './components/TopNavHeader';
import { VideoUploadAndConfigPanel } from './components/VideoUploadAndConfigPanel';
import { QuadVideoComparisonStage } from './components/QuadVideoComparisonStage';
import { FrameTimelineAndInspector } from './components/FrameTimelineAndInspector';
import { ValidationAndBenchmarkView } from './components/ValidationAndBenchmarkView';
import { HardwareAndArchitectureView } from './components/HardwareAndArchitectureView';
import type {
  BenchmarkPayload,
  HardwareProfile,
  JobResultPayload,
  ProcessingSettings,
  SampleVideoItem,
  VideoMetadata,
} from './types/scansure';

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
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('workstation');
  const [hardware, setHardware] = useState<HardwareProfile | null>(null);
  const [samples, setSamples] = useState<SampleVideoItem[]>([]);
  const [selectedSampleId, setSelectedSampleId] = useState<string>('breast_cyst_phantom_01');
  const [inputVideoMeta, setInputVideoMeta] = useState<VideoMetadata | null>(null);
  const [settings, setSettings] = useState<ProcessingSettings>(DEFAULT_SETTINGS);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressState, setProgressState] = useState<{
    stage: string;
    progress_pct: number;
    frames_processed: number;
    total_frames: number;
    eta_sec: number;
  } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [jobResult, setJobResult] = useState<JobResultPayload | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<number>(0);

  const [benchmark, setBenchmark] = useState<BenchmarkPayload | null>(null);
  const [isLoadingBenchmark, setIsLoadingBenchmark] = useState<boolean>(false);

  // Load hardware profile, sample ultrasound videos, and initial demo job result
  useEffect(() => {
    fetch('/api/hardware')
      .then((r) => r.json())
      .then((data) => setHardware(data))
      .catch(() => {});

    fetch('/api/samples')
      .then((r) => r.json())
      .then((data) => {
        if (data.samples && data.samples.length > 0) {
          setSamples(data.samples);
          const first = data.samples[0];
          setSelectedSampleId(first.id);
          probeFilepath(first.filepath);
        }
      })
      .catch(() => {});

    // Check pre-generated demo_case01 result and cached benchmark suite
    pollJobUntilComplete('demo_case01', false);
    loadBenchmarkSuite();
  }, []);

  const probeFilepath = async (filepath: string) => {
    try {
      setUploadError(null);
      const res = await fetch('/api/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filepath }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || 'Video validation failed');
        return;
      }
      setInputVideoMeta(data);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to inspect video stream');
    }
  };

  const pollJobUntilComplete = (jobId: string, showSpinner = true) => {
    if (showSpinner) {
      setIsProcessing(true);
    }
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`);
        const data = await res.json();
        if (data.status === 'completed' && data.result) {
          clearInterval(timer);
          setIsProcessing(false);
          setProgressState(null);
          setJobResult(data.result);
          const peakFrame =
            data.result.detection_summary?.peak_confidence_frame || 0;
          setSelectedFrame(peakFrame);
        } else if (data.status === 'failed') {
          clearInterval(timer);
          setIsProcessing(false);
          setUploadError(data.error || 'Video pipeline failed');
        } else if (data.progress) {
          setProgressState(data.progress);
        }
      } catch {
        // retry on next interval
      }
    }, 650);
  };

  const handleSelectSample = (sample: SampleVideoItem) => {
    setSelectedSampleId(sample.id);
    probeFilepath(sample.filepath);
  };

  const handleUploadFile = async (file: File) => {
    setUploadError(null);
    const formData = new FormData();
    formData.append('video', file);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || 'Upload validation failed');
        return;
      }
      setInputVideoMeta(data);
    } catch (err: any) {
      setUploadError(err.message || 'Video upload failed');
    }
  };

  const handleStartProcessing = async () => {
    if (!inputVideoMeta?.filepath) return;
    setUploadError(null);
    setIsProcessing(true);
    setProgressState({
      stage: '01. Video Validation & Stream Probe',
      progress_pct: 5,
      frames_processed: 0,
      total_frames: inputVideoMeta.frame_count || 45,
      eta_sec: 10.0,
    });

    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filepath: inputVideoMeta.filepath,
          ...settings,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.job_id) {
        setIsProcessing(false);
        setUploadError(data.error || 'Failed to start processing job');
        return;
      }
      pollJobUntilComplete(data.job_id, true);
    } catch (err: any) {
      setIsProcessing(false);
      setUploadError(err.message || 'Network error starting local job');
    }
  };

  const loadBenchmarkSuite = async () => {
    setIsLoadingBenchmark(true);
    try {
      const res = await fetch('/api/benchmark');
      const data = await res.json();
      if (res.ok) {
        setBenchmark(data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingBenchmark(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'validation' && !benchmark && !isLoadingBenchmark) {
      loadBenchmarkSuite();
    }
  }, [activeTab]);

  const handleExportReportJson = () => {
    if (!jobResult) return;
    const link = document.createElement('a');
    link.href = `${jobResult.exports.reports.json.url}?download=1`;
    link.download = 'detection_report.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col">
      {/* Top 3-Zone Navigation Header */}
      <TopNavHeader
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onExportReportJson={handleExportReportJson}
        hasCompletedJob={Boolean(jobResult)}
      />

      {/* Top Clinical Telemetry & Offline Hardware Status Ribbon */}
      <div className="bg-[#0B0E17] border-b border-slate-800/80 px-6 py-2 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-slate-300 font-mono">
          <span className="text-emerald-400 font-semibold">● OFFLINE MODE ACTIVE</span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span>Zero Cloud / Zero External API Dependency</span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span>Scope: Breast Ultrasound (B-Mode 5–12 MHz)</span>
        </div>

        {hardware && (
          <div className="flex flex-wrap items-center gap-2 text-slate-400 font-mono tabular-nums">
            <span>
              CPU: {hardware.cpu.logical_cores} Cores ({hardware.os.architecture})
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span>Avail RAM: {hardware.memory.available_gb} GB</span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span>
              Execution: {hardware.gpu.cuda_available ? 'CUDA GPU' : 'CPU FP32 Native'}
            </span>
          </div>
        )}
      </div>

      {/* Mandatory Medical Safety & Non-Diagnostic Disclaimer Banner */}
      <div
        role="region"
        aria-label="Medical Safety Disclaimer"
        className="bg-amber-950/20 border-b border-amber-500/30 px-6 py-2.5 text-xs text-amber-200/90 flex items-center justify-between gap-4"
      >
        <p className="leading-relaxed">
          <strong className="font-semibold text-amber-300">
            Clinical Safety Disclaimer:
          </strong>{' '}
          ScanSure AI is an experimental AI-assisted ultrasound image enhancement and analysis tool. It does not provide a medical diagnosis. All findings require review by a qualified radiologist.
        </p>
        <span className="font-mono text-[11px] text-amber-300/80 whitespace-nowrap shrink-0">
          AI-Assisted Review Tool · Non-Autonomous
        </span>
      </div>

      {/* Main Workspace Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6 flex flex-col gap-6">
        {activeTab === 'workstation' && (
          <>
            <div className="flex flex-col lg:flex-row items-stretch gap-6">
              <VideoUploadAndConfigPanel
                samples={samples}
                selectedSampleId={selectedSampleId}
                inputVideoMeta={inputVideoMeta}
                settings={settings}
                isProcessing={isProcessing}
                progressState={progressState}
                uploadError={uploadError}
                onSelectSample={handleSelectSample}
                onUploadFile={handleUploadFile}
                onChangeSettings={setSettings}
                onResetDefaults={() => setSettings(DEFAULT_SETTINGS)}
                onStartProcessing={handleStartProcessing}
              />

              {jobResult ? (
                <QuadVideoComparisonStage
                  jobResult={jobResult}
                  activeThreshold={settings.detection_threshold}
                  onSelectFrameInInspector={(frameNum) => setSelectedFrame(frameNum)}
                />
              ) : (
                <section className="flex-1 bg-[#0B0E17] border border-slate-800 rounded-lg p-8 flex flex-col items-center justify-center text-center">
                  <p className="text-sm font-semibold text-slate-200 mb-1">
                    Initializing Offline Ultrasound Video Pipeline...
                  </p>
                  <p className="text-xs text-slate-400 max-w-md">
                    Generating initial B-mode breast ultrasound phantom videos and verifying frame-accurate MP4 outputs (`enhanced_video.mp4`, `annotated_video.mp4`, `comparison_video.mp4`).
                  </p>
                </section>
              )}
            </div>

            {jobResult && (
              <FrameTimelineAndInspector
                jobResult={jobResult}
                activeThreshold={settings.detection_threshold}
                selectedFrame={selectedFrame}
                onSelectFrame={setSelectedFrame}
              />
            )}
          </>
        )}

        {activeTab === 'inspector' && jobResult && (
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

        {activeTab === 'hardware' && (
          <HardwareAndArchitectureView hardware={hardware} />
        )}
      </main>
    </div>
  );
}
