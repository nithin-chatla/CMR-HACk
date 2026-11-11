import React from 'react';

export type ActiveTab = 'workstation' | 'inspector' | 'validation' | 'hardware';

interface TopNavHeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onExportReportJson: () => void;
  hasCompletedJob: boolean;
}

export const TopNavHeader: React.FC<TopNavHeaderProps> = ({
  activeTab,
  onSelectTab,
  onExportReportJson,
  hasCompletedJob,
}) => {
  const navItems: { id: ActiveTab; label: string }[] = [
    { id: 'workstation', label: 'Workstation' },
    { id: 'inspector', label: 'Frame Inspector' },
    { id: 'validation', label: 'Validation & Benchmarks' },
    { id: 'hardware', label: 'Hardware & Architecture' },
  ];

  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-[#07090E] border-b border-slate-800">
      <a
        href="#workstation"
        onClick={(e) => {
          e.preventDefault();
          onSelectTab('workstation');
        }}
        className="text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-cyan-400"
      >
        ScanSure AI
      </a>

      <nav
        aria-label="Primary Workspace Navigation"
        className="flex items-center gap-6 text-sm font-medium text-slate-400 overflow-x-auto"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                isActive
                  ? 'text-cyan-400 border-cyan-400 font-semibold'
                  : 'text-slate-400 border-transparent hover:text-slate-100'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onExportReportJson}
          disabled={!hasCompletedJob}
          className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 rounded-md hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-cyan-300"
        >
          Download JSON Report
        </button>
      </div>
    </header>
  );
};
