import React from 'react';
import {
  Activity,
  Cpu,
  ShieldCheck,
  Upload,
  Sliders,
  Sparkles,
  CheckCircle2,
  FileDown,
  RotateCcw,
} from 'lucide-react';
import type { HardwareProfile } from '../types/scansure';

export type WizardStep = 1 | 2 | 3 | 4;

interface TopNavHeaderProps {
  currentStep: WizardStep;
  onSelectStep: (step: WizardStep) => void;
  canNavigateToStep: (step: WizardStep) => boolean;
  hardware: HardwareProfile | null;
  onExportClientPdf: () => void;
  onStartNewScan: () => void;
  isGeneratingPdf?: boolean;
  hasActiveJob: boolean;
}

export const TopNavHeader: React.FC<TopNavHeaderProps> = ({
  currentStep,
  onSelectStep,
  canNavigateToStep,
  hardware,
  onExportClientPdf,
  onStartNewScan,
  isGeneratingPdf = false,
  hasActiveJob,
}) => {
  const steps: {
    id: WizardStep;
    title: string;
    shortTitle: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 1,
      title: '1. Video Upload',
      shortTitle: '1. Upload',
      icon: <Upload className="w-3.5 h-3.5" />,
    },
    {
      id: 2,
      title: '2. Configuration',
      shortTitle: '2. Config',
      icon: <Sliders className="w-3.5 h-3.5" />,
    },
    {
      id: 3,
      title: '3. Live Triage',
      shortTitle: '3. Triage',
      icon: <Sparkles className="w-3.5 h-3.5" />,
    },
    {
      id: 4,
      title: '4. Results',
      shortTitle: '4. Results',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
  ];

  const target = hardware?.target_device_profile;

  return (
    <header className="border-b border-slate-800/90 bg-[#0A0F18]/95 backdrop-blur-md px-3 sm:px-6 py-2.5 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 shrink-0 z-30">
      {/* Zone 1: Brand Identity */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-inner">
          <Activity className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-slate-100 text-sm sm:text-base whitespace-nowrap">
              ScanSure AI
            </span>
            <span className="hidden sm:inline-block text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 whitespace-nowrap">
              Offline Ultrasound
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden md:block whitespace-nowrap">
            Enhancement, Anomaly Detection &amp; Radiologist Triage
          </p>
        </div>
      </div>

      {/* Zone 2: Guided 4-Step Progress Stepper */}
      <nav
        className="flex items-center gap-1 sm:gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800 overflow-x-auto max-w-full"
        aria-label="Clinical workflow steps"
      >
        {steps.map((step, idx) => {
          const isCurrent = currentStep === step.id;
          const isCompleted = currentStep > step.id || (step.id === 4 && hasActiveJob);
          const enabled = canNavigateToStep(step.id);

          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                disabled={!enabled}
                onClick={() => enabled && onSelectStep(step.id)}
                data-testid={`wizard-step-${step.id}`}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
                  isCurrent
                    ? 'bg-cyan-400 text-slate-950 font-semibold shadow-sm cursor-pointer'
                    : isCompleted
                    ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-700/40 hover:bg-emerald-900/40 cursor-pointer'
                    : enabled
                    ? 'text-slate-300 hover:text-white hover:bg-slate-800/70 cursor-pointer'
                    : 'text-slate-600 cursor-not-allowed'
                }`}
              >
                {step.icon}
                <span className="hidden lg:inline">{step.title}</span>
                <span className="lg:hidden">{step.shortTitle}</span>
              </button>
              {idx < steps.length - 1 && (
                <div
                  className={`hidden sm:block w-3 h-[1.5px] rounded-full ${
                    currentStep > step.id ? 'bg-emerald-500/60' : 'bg-slate-800'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {/* Zone 3: Quick Actions & Auto-Detected Device Badge */}
      <div className="flex items-center gap-2 shrink-0">
        {currentStep === 4 && hasActiveJob && (
          <>
            <button
              type="button"
              onClick={onStartNewScan}
              data-testid="header-new-scan-btn"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-all whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Scan</span>
            </button>
            <button
              type="button"
              onClick={onExportClientPdf}
              disabled={isGeneratingPdf}
              data-testid="header-export-pdf-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-60 text-slate-950 font-semibold text-xs transition-all whitespace-nowrap cursor-pointer shadow-sm"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{isGeneratingPdf ? 'Building PDF...' : 'Export PDF'}</span>
            </button>
          </>
        )}

        <div
          className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] font-mono text-slate-300 whitespace-nowrap"
          title={
            target
              ? `Auto-tuned for ${target.device_name}: ${target.processor} + ${target.discrete_gpu}`
              : hardware?.cpu.model
          }
        >
          <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>{target ? `${target.device_name} · RTX 3050` : 'Auto-Tuned'}</span>
        </div>

        <div
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-700/50 text-emerald-300 text-[11px] font-mono whitespace-nowrap"
          title="100% Offline Air-Gapped Execution"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>OFFLINE</span>
        </div>
      </div>
    </header>
  );
};
