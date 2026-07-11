import { FilterState, SortOption } from '../types/plant';

interface FilterPanelProps {
  filters: FilterState;
  sortBy: SortOption;
  categories: string[];
  onFiltersChange: (filters: FilterState) => void;
  onSortChange: (sort: SortOption) => void;
}

type BooleanFilterKey = Exclude<keyof FilterState, 'search' | 'category'>;

export function FilterPanel({
  filters,
  sortBy,
  categories,
  onFiltersChange,
  onSortChange,
}: FilterPanelProps) {
  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleFilter = (key: BooleanFilterKey) => {
    onFiltersChange({ ...filters, [key]: !filters[key] });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      search: '',
      category: '',
      gardenWelcome: false,
      gardenShade: false,
      gardenPerennial: false,
      gardenPopularPlant: false,
      gardenNativePlant: false,
      gardenWildlifeHabitat: false,
      gardenStreetscape: false,
      californiaNativeOnly: false,
      floweringOnly: false,
      goodPollinatorOnly: false,
      hideHighMessiness: false,
      easyMaintenance: false,
      highWaterwise: false,
      waterLowOnly: false,
      waterMediumOnly: false,
      waterHighOnly: false,
      hideLargeTrees: false,
      lowGrowingOnly: false,
      under4FeetTall: false,
      under6FeetWide: false,
      greenAcresOnly: false,
      greenAcresMissingOnly: false,
    });
  };

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'greenAcresOnly' || key === 'greenAcresMissingOnly') return false;
    if (key.startsWith('garden')) return false;
    return value === true || (typeof value === 'string' && value !== '');
  }).length;

  const quickFilters: { key: BooleanFilterKey; label: string }[] = [
    { key: 'floweringOnly', label: 'Flowering' },
    { key: 'goodPollinatorOnly', label: 'Pollinators' },
    { key: 'hideHighMessiness', label: 'Hide messy' },
    { key: 'highWaterwise', label: 'Waterwise' },
    { key: 'easyMaintenance', label: 'Easy care' },
  ];

  const waterFilters: { key: BooleanFilterKey; label: string }[] = [
    { key: 'waterLowOnly', label: 'Low water' },
    { key: 'waterMediumOnly', label: 'Medium water' },
    { key: 'waterHighOnly', label: 'High water' },
  ];

  const sizeFilters: { key: BooleanFilterKey; label: string }[] = [
    { key: 'lowGrowingOnly', label: 'Low-growing only (<3 ft)' },
    { key: 'under4FeetTall', label: 'Under 4 feet tall' },
    { key: 'under6FeetWide', label: 'Under 6 feet wide' },
    { key: 'hideLargeTrees', label: 'Hide large trees (>30 ft)' },
  ];

  return (
    <div className="space-y-4 text-slate-200">
      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Plant library</div>
            <div className="text-sm font-semibold text-white">Filter and sort</div>
          </div>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="rounded-lg border border-slate-600 px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-800"
            >
              Clear {activeFilterCount}
            </button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <select
            value={filters.category}
            onChange={(e) => updateFilter('category', e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">All categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="commonName">Common name A–Z</option>
            <option value="commonNameDesc">Common name Z–A</option>
            <option value="botanicalName">Botanical A–Z</option>
            <option value="heightLow">Height: low to high</option>
            <option value="heightHigh">Height: high to low</option>
            <option value="widthLow">Width: low to high</option>
            <option value="widthHigh">Width: high to low</option>
            <option value="waterwiseHigh">Waterwise: high first</option>
            <option value="maintenanceHigh">Maintenance: easy first</option>
            <option value="messinessLow">Messiness: low first</option>
            <option value="pollinatorHigh">Pollinator: high first</option>
          </select>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {quickFilters.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleFilter(key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                filters[key]
                  ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200'
                  : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>


      <details className="rounded-2xl border border-slate-700 bg-slate-900 p-3" open>
        <summary className="cursor-pointer list-none text-sm font-semibold text-white">
          Water filters
        </summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {waterFilters.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleFilter(key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                filters[key]
                  ? 'border-sky-400 bg-sky-500/15 text-sky-200'
                  : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </details>

      <details className="rounded-2xl border border-slate-700 bg-slate-900 p-3">
        <summary className="cursor-pointer list-none text-sm font-semibold text-white">
          Size filters
        </summary>
        <div className="mt-3 space-y-2">
          {sizeFilters.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-slate-300 hover:bg-slate-800">
              <input
                type="checkbox"
                checked={Boolean(filters[key])}
                onChange={() => toggleFilter(key)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </details>

      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs leading-relaxed text-slate-400">
        Filters stack together. If results hit zero, clear filters and add one filter at a time.
      </div>
    </div>
  );
}
