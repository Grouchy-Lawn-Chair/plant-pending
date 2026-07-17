import { useState } from 'react';

export type WorkspaceId = 'yard' | 'areas' | 'plants' | 'generate' | 'plan';

const WORKSPACES: { id: WorkspaceId; label: string }[] = [
  { id: 'yard', label: 'Yard' },
  { id: 'areas', label: 'Areas' },
  { id: 'plants', label: 'Plants' },
  { id: 'generate', label: 'Generate' },
  { id: 'plan', label: 'Plan' },
];

export function WorkspaceTabs() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>('plants');

  return (
    <nav
      aria-label="Workspaces"
      className="fixed left-1/2 top-2 z-[85] -translate-x-1/2 rounded-2xl border border-slate-700 bg-slate-950/95 p-1 shadow-xl backdrop-blur"
    >
      <div className="flex items-center gap-1">
        {WORKSPACES.map(workspace => {
          const isActive = workspace.id === activeWorkspace;
          return (
            <button
              key={workspace.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => setActiveWorkspace(workspace.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/60'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {workspace.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
