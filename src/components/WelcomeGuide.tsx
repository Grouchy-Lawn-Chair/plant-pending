import { WELCOME_STEPS } from '../data/helpContent';

type WelcomeGuideProps = {
  open: boolean;
  showOnStartup: boolean;
  onShowOnStartupChange: (value: boolean) => void;
  onClose: () => void;
  onOpenHelp: () => void;
};

export function WelcomeGuide({
  open,
  showOnStartup,
  onShowOnStartupChange,
  onClose,
  onOpenHelp,
}: WelcomeGuideProps) {
  if (!open) return null;

  return (
    <div
      className="welcome-guide-backdrop fixed inset-0 z-[92] flex items-center justify-center bg-black/60 p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="welcome-guide-dialog flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 text-slate-100 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="welcome-guide-title">
        <div className="welcome-guide-header flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-5">
          <div className="welcome-guide-heading flex items-center gap-4">
            <img src={`${import.meta.env.BASE_URL}brand/logo-DarkBG.svg`} alt="Plant Pending" className="h-16 w-auto" />
            <div>
              <h2 id="welcome-guide-title" className="mt-1 text-2xl font-black text-white">Welcome to Plant Pending</h2>
              <p className="mt-1 text-sm text-slate-400">Plan the dirt, test the shrubs, and let the Recipe Engine do some of the arguing.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="welcome-guide-close shrink-0 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">
            Close
          </button>
        </div>

        <div className="grid gap-3 overflow-y-auto px-6 py-5 text-sm text-slate-300">
          {WELCOME_STEPS.map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="font-bold text-white">{title}</div>
              <div className="mt-1 text-slate-400">{body}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-6 py-4">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={showOnStartup}
              onChange={(event) => onShowOnStartupChange(event.target.checked)}
            />
            Show this when the app opens
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={onOpenHelp} className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800">
              View full guide
            </button>
            <button type="button" onClick={onClose} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              Start planning
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
