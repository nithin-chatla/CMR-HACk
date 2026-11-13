import React from 'react';
import {
  Activity,
  Cpu,
  ShieldCheck,
  FileText,
  Layers,
  Award,
  MonitorPlay,
  FileDown,
} from 'lucide-react';
import type { HardwareProfile } from '../types/scansure';

export type ActiveWorkspaceTab =
  | 'studio'
  | 'doctor_report'
  | 'keyframes'
  | 'validation'
  | 'hardware';

interface TopNavHeaderProps {
  activeTab: ActiveWorkspaceTab;
  onSelectTab: (tab: ActiveWorkspaceTab) => void;
  hardware: HardwareProfile | null;
  onExportClientPdf: () => void;
  isGeneratingPdf?: boolean;
  hasActiveJob: boolean;
}

export const TopNavHeader: React.FC<TopNavHeaderProps> = ({
  activeTab,
  onSelectTab,
  hardware,
  onExportClientPdf,
  isGeneratingPdf = false,
  hasActiveJob,
}) => {
  const navItems: {
    id: ActiveWorkspaceTab;
    label: string;
    icon: React.ReactNode;
    highlight?: boolean;
  }[] = [
    { id: 'studio', label: 'Imaging Studio', icon: <MonitorPlay className="w-3.5 h-3.5" /> },
    {
      id: 'doctor_report',
      label: 'Doctor Report (PDF/JSON)',
      icon: <FileText className="w-3.5 h-3.5" />,
      highlight: true,
    },
    { id: 'keyframes', label: 'Keyframes', icon: <Layers className="w-3.5 h-3.5" /> },
    {
      id: 'validation',
      label: 'Validation',
      icon: <Award className="w-3.5 h-3.5" />,
    },
    { id: 'hardware', label: 'Workstation', icon: <Cpu className="w-3.5 h-3.5" /> },
  ];

  const target = hardware?.target_device_profile;

  return (
    <header className="h-14 border-b border-slate-800/90 bg-[#0A0F18]/95 backdrop-blur-md px-4 flex items-center justify-between gap-3 shrink-0 z-30">
      {/* Zone 1: Brand Identity */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-inner">
          <Activity className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold tracking-tight text-slate-100 text-sm whitespace-nowrap">
              ScanSure AI
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 whitespace-nowrap">
              PACS Workstation v1.3
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block whitespace-nowrap">
            Offline Ultrasound Enhancement &amp; Anomaly Triage
          </p>
        </div>
      </div>

      {/* Zone 2: Primary View Switcher */}
      <nav
        className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800 overflow-x-auto"
        aria-label="Workspace views"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              data-testid={`nav-tab-${item.id}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-cyan-400 text-slate-950 font-semibold shadow-sm'
                  : item.highlight
                  ? 'text-cyan-300 hover:text-cyan-200 hover:bg-cyan-950/40 border border-transparent'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Quick Doctor Report Export & Air-Gap Status */}
      <div className="flex items-center gap-2 shrink-0">
        {hasActiveJob && (
          <button
            type="button"
            onClick={onExportClientPdf}
            disabled={isGeneratingPdf}
            data-testid="header-export-pdf-btn"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-60 text-slate-950 font-semibold text-xs transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>{isGeneratingPdf ? 'Building PDF...' : 'Export Doctor PDF'}</span>
          </button>
        )}

        <div
          className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900/90 border border-slate-800 text-[11px] font-mono text-slate-300 whitespace-nowrap"
          title={
            target
              ? `Configured for ${target.device_name}: ${target.processor} + ${target.discrete_gpu}`
              : hardware?.cpu.model
          }
        >
          <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>
            {target
              ? `${target.device_name} · RTX 3050 6GB`
              : `${hardware?.memory.total_gb ?? 16}GB RAM`}
          </span>
        </div>

        <div
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-700/50 text-emerald-300 text-[11px] font-mono whitespace-nowrap"
          title="100% Offline Air-Gapped Inference — Zero Cloud Calls"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>AIR-GAPPED</span>
        </div>
      </div>
    </header>
  );
};
