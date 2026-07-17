import { HELP_SECTIONS } from '../data/helpContent';

type HelpCenterProps = {
  open: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onClose: () => void;
};

export function HelpCenter({ open, search, onSearchChange, onClose }: HelpCenterProps) {
  if (!open) return null;

  const query = search.trim().toLowerCase();
  const visibleSections = HELP_SECTIONS.filter(section => {
    if (!query) return true;
    return section.title.toLowerCase().includes(query) || section.body.toLowerCase().includes(query);
  });

  return (
    <div className="fixed inset-y-0 right-0 z-[91] flex w-full max-w-[30rem] flex-col border-l border-slate-700 bg-slate-950 text-slate-100 shadow-2xl">
      <div className="border-b border-slate-800 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-emerald-300">Version 2.0 help center</div>
            <h2 className="mt-1 text-xl font-black">How to make the yard less suspicious</h2>
            <p className="mt-1 text-xs text-slate-400">Areas, recipes, spacing, saving, printing, and the controls that keep the shrubs employed.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">
            Close
          </button>
        </div>
        <input
          type="text"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search help..."
          className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="space-y-3">
          {visibleSections.map(section => (
            <details key={section.title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4" open={!query}>
              <summary className="cursor-pointer text-sm font-bold text-white">{section.title}</summary>
              <p className="mt-2 text-sm leading-6 text-slate-400">{section.body}</p>
            </details>
          ))}
          {visibleSections.length === 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">
              No help topics match that search. Even the help has boundaries.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
