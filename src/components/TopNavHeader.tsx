import React from 'react';
import {
  Activity,
  FileDown,
  Sun,
  Moon,
  Upload,
  Sliders,
  Loader2,
  Sparkles,
  FileText,
  RotateCcw,
} from 'lucide-react';

export type WizardStep = 'upload' | 'settings' | 'processing' | 'results' | 'report';

interface TopNavHeaderProps {
  currentStep: WizardStep;
  onNavigateStep: (step: WizardStep) => void;
  hasUploadedVideo: boolean;
  hasActiveJob: boolean;
  isProcessing: boolean;
  progressPct?: number;
  activeStudyName?: string;
  onExportClientPdf: () => void;
  isGeneratingPdf?: boolean;
  onStartNewUpload: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const TopNavHeader: React.FC<TopNavHeaderProps> = ({
  currentStep,
  onNavigateStep,
  hasUploadedVideo,
  hasActiveJob,
  isProcessing,
  progressPct = 0,
  activeStudyName,
  onExportClientPdf,
  isGeneratingPdf = false,
  onStartNewUpload,
  theme,
  onToggleTheme,
}) => {
  const steps: {
    id: WizardStep;
    num: string;
    label: string;
    enabled: boolean;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'upload',
      num: '1',
      label: 'Upload Video',
      enabled: !isProcessing,
      icon: <Upload className="w-3.5 h-3.5" />,
    },
    {
      id: 'settings',
      num: '2',
      label: 'Enhancement Settings',
      enabled: hasUploadedVideo && !isProcessing,
      icon: <Sliders className="w-3.5 h-3.5" />,
    },
    {
      id: 'processing',
      num: '3',
      label: 'Live Progress',
      enabled: isProcessing,
      icon: <Loader2 className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />,
    },
    {
      id: 'results',
      num: '4',
      label: 'Results',
      enabled: hasActiveJob && !isProcessing,
      icon: <Sparkles className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D131F] px-4 lg:px-6 flex items-center justify-between gap-3 shrink-0 z-30 transition-colors">
      {/* Brand Identity */}
      <div className="flex items-center gap-2.5 shrink-0 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-[#0F172A] dark:bg-sky-500/15 border border-slate-800 dark:border-sky-400/30 flex items-center justify-center text-white dark:text-sky-300 shrink-0">
          <Activity className="w-4 h-4" />
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold tracking-tight text-slate-900 dark:text-slate-100 text-base whitespace-nowrap">
            ScanSure AI
          </span>
          {activeStudyName && (
            <>
              <span className="hidden xl:inline-block text-slate-300 dark:text-slate-700">|</span>
              <span className="hidden xl:inline-block text-xs font-mono text-slate-500 dark:text-slate-400 truncate max-w-[160px]">
                {activeStudyName}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Stepper Indicator */}
      <nav
        className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 shrink-0"
        aria-label="Workflow steps"
      >
        {steps.map((step) => {
          const isCurrent =
            currentStep === step.id ||
            (currentStep === 'report' && step.id === 'results');
          return (
            <button
              key={step.id}
              type="button"
              disabled={!step.enabled}
              onClick={() => step.enabled && onNavigateStep(step.id)}
              data-testid={`wizard-step-${step.id}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                isCurrent
                  ? 'bg-[#0F172A] text-white dark:bg-sky-500 dark:text-slate-950 font-semibold shadow-xs'
                  : step.enabled
                  ? 'text-slate-700 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-800 cursor-pointer'
                  : 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
              }`}
            >
              <span className="font-mono text-[11px] opacity-75">{step.num}.</span>
              {step.icon}
              <span>{step.label}</span>
            </button>
          );
        })}

        {hasActiveJob && !isProcessing && (
          <button
            type="button"
            onClick={() => onNavigateStep('report')}
            data-testid="wizard-step-report"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentStep === 'report'
                ? 'bg-[#0F172A] text-white dark:bg-sky-500 dark:text-slate-950 font-semibold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Doctor Report</span>
          </button>
        )}
      </nav>

      {/* Right Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {isProcessing && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 text-xs font-mono font-semibold">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600 dark:text-teal-400" />
            <span>{Math.round(progressPct)}%</span>
          </div>
        )}

        {hasUploadedVideo && !isProcessing && currentStep !== 'upload' && (
          <button
            type="button"
            onClick={onStartNewUpload}
            data-testid="header-new-upload-btn"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">New Video</span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleTheme}
          data-testid="theme-toggle-btn"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors cursor-pointer"
        >
          {theme === 'light' ? (
            <>
              <Moon className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Dark</span>
            </>
          ) : (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Light</span>
            </>
          )}
        </button>

        {hasActiveJob && !isProcessing && (
          <button
            type="button"
            onClick={onExportClientPdf}
            disabled={isGeneratingPdf}
            data-testid="header-export-pdf-btn"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 dark:bg-sky-500 dark:hover:bg-sky-400 disabled:opacity-60 text-white dark:text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>{isGeneratingPdf ? 'Exporting...' : 'Export PDF'}</span>
          </button>
        )}
      </div>
    </header>
  );
};
