import React from 'react';
import type { HardwareProfile } from '../types/scansure';

interface HardwareAndArchitectureViewProps {
  hardware: HardwareProfile | null;
}

export const HardwareAndArchitectureView: React.FC<HardwareAndArchitectureViewProps> = ({
  hardware,
}) => {
  const stages = [
    {
      num: '01',
      name: 'VIDEO VALIDATION',
      module: 'processing/video_reader.py',
      desc: 'Probes container format (MP4, AVI, MOV, MKV), dimensions, rational FPS, exact frame count, and audio stream presence via ffprobe.',
    },
    {
      num: '02',
      name: 'FRAME EXTRACTION',
      module: 'processing/frame_extractor.py',
      desc: 'Memory-bounded sequential rawvideo streaming via FFmpeg pipes so multi-hundred-MB cine loops never overload laptop RAM.',
    },
    {
      num: '03',
      name: 'IMAGE QUALITY ASSESSMENT',
      module: 'processing/enhancement.py',
      desc: 'Computes per-frame Equivalent Number of Looks (ENL) speckle index, parenchymal variance, and Sobel edge sharpness.',
    },
    {
      num: '04',
      name: 'ULTRASOUND IMAGE ENHANCEMENT',
      module: 'processing/enhancement.py',
      desc: 'O(1) 2D integral-image Lee-Sigma & Bilateral edge-preserving despeckling + 8x6 contextual tile Bilinear CLAHE + Gamma LUT.',
    },
    {
      num: '05',
      name: 'AI ANOMALY DETECTION',
      module: 'models/segmentation/unet_ultrasound.py',
      desc: 'Multi-scale encoder-decoder receptive field pyramid evaluating core attenuation drop, homogeneity, and posterior acoustic enhancement.',
    },
    {
      num: '06',
      name: 'SEGMENTATION / REGION HIGHLIGHTING',
      module: 'processing/segmentation.py',
      desc: 'Connected-component flood-fill contour extraction, solidity filtering, translucent mask overlay, and 5x7 clinical HUD rendering.',
    },
    {
      num: '07',
      name: 'CONFIDENCE & TEMPORAL VALIDATION',
      module: 'processing/temporal_processing.py',
      desc: 'Motion-gated temporal EMA despeckling + IoU bounding box tracking + threshold gating and Uncertain review classification.',
    },
    {
      num: '08',
      name: 'VIDEO RECONSTRUCTION & EXPORT',
      module: 'processing/video_writer.py',
      desc: 'Simultaneous encoding of enhanced_video.mp4, annotated_video.mp4, comparison_video.mp4, JSON/CSV reports, and PNG keyframes.',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Hardware Inspection Profile */}
      <section
        aria-label="Local Hardware Inspection Profile"
        className="bg-[#0B0E17] border border-slate-800 rounded-lg p-5 flex flex-col gap-4"
      >
        <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              01. Inspected Local Hardware & Execution Environment
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Automatically profiled by hardware/hardware_detector.py to select safe offline batching and CPU/GPU execution parameters.
            </p>
          </div>
          <span className="text-xs font-mono text-emerald-400 font-semibold">
            ● 100% OFFLINE LOCAL EXECUTION
          </span>
        </div>

        {hardware ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 bg-[#07090E] border border-slate-800 rounded flex flex-col gap-1.5">
              <span className="font-mono text-slate-400 uppercase text-[11px]">
                Processor & SIMD Capabilities
              </span>
              <span className="text-sm font-semibold text-slate-100">
                {hardware.cpu.model}
              </span>
              <span className="font-mono text-slate-300">
                Logical Cores: {hardware.cpu.logical_cores} · Arch: {hardware.os.architecture}
              </span>
              <span className="font-mono text-cyan-400">
                SIMD Flags: {hardware.cpu.simd_extensions.join(', ').toUpperCase() || 'STANDARD'}
              </span>
            </div>

            <div className="p-3.5 bg-[#07090E] border border-slate-800 rounded flex flex-col gap-1.5">
              <span className="font-mono text-slate-400 uppercase text-[11px]">
                System Memory & Storage
              </span>
              <span className="text-sm font-semibold text-slate-100 font-mono tabular-nums">
                RAM: {hardware.memory.available_gb} GB Available / {hardware.memory.total_gb} GB Total
              </span>
              <span className="font-mono text-slate-300 tabular-nums">
                Disk Free: {hardware.disk.free_gb} GB / {hardware.disk.total_gb} GB
              </span>
              <span className="font-mono text-slate-400">
                Streaming Frame Buffer: Active (Max 16 frames in RAM)
              </span>
            </div>

            <div className="p-3.5 bg-[#07090E] border border-slate-800 rounded flex flex-col gap-1.5">
              <span className="font-mono text-slate-400 uppercase text-[11px]">
                GPU / CUDA & Media Codecs
              </span>
              <span className="text-sm font-semibold text-slate-100">
                GPU: {hardware.gpu.model}
              </span>
              <span className="font-mono text-slate-300">
                CUDA Available: {hardware.gpu.cuda_available ? 'Yes' : 'No (CPU Fallback Active)'}
              </span>
              <span className="font-mono text-emerald-400 truncate" title={hardware.media_backends.ffmpeg_version}>
                {hardware.media_backends.ffmpeg_version}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400">Inspecting hardware profile...</p>
        )}
      </section>

      {/* 8-Stage Modular Architecture */}
      <section
        aria-label="Modular Video Processing Architecture"
        className="bg-[#0B0E17] border border-slate-800 rounded-lg p-5 flex flex-col gap-4"
      >
        <div className="pb-3 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-100">
            02. Modular 8-Stage Ultrasound Video Processing Pipeline
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Each stage is implemented as an independent, unit-tested Python module under /processing, /models, /evaluation, and /reports.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {stages.map((st) => (
            <div
              key={st.num}
              className="p-3.5 bg-[#07090E] border border-slate-800 rounded flex flex-col justify-between gap-2"
            >
              <div>
                <div className="flex items-center justify-between text-xs font-mono mb-1">
                  <span className="text-cyan-400 font-semibold">STAGE {st.num}</span>
                  <span className="text-slate-400 text-[11px]">{st.module}</span>
                </div>
                <h3 className="text-xs font-semibold text-slate-100 mb-1.5">
                  {st.name}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">{st.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
