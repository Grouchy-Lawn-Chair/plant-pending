import { FilterState, GreenAcresFilterGroup, GreenAcresFilterIndex, SortOption } from '../types/plant';

interface FilterPanelProps {
  filters: FilterState;
  sortBy: SortOption;
  categories: string[];
  greenAcresFilterIndex: GreenAcresFilterIndex | null;
  onFiltersChange: (filters: FilterState) => void;
  onSortChange: (sort: SortOption) => void;
}

type BooleanFilterKey = Exclude<keyof FilterState, 'search' | 'category' | 'greenAcresFilters'>;

const PRIORITY_GROUPS = [
  'plantCategories',
  'lightRequirements',
  'waterNeeds',
  'landscapeUses',
  'attributes',
  'flowerColors',
  'foliageColors',
  'heightTags',
  'widthTags',
  'growthHabits',
  'growthRates',
  'bloomSeasons',
  'availableSeasons',
  'usdaZones',
  'priceRanges',
  'nurserySizes',
];

const MAX_VISIBLE_VALUES: Record<string, number> = {
  plantCategories: 80,
  heightTags: 40,
  widthTags: 40,
  usdaZones: 40,
  growthHabits: 40,
  nurserySizes: 30,
};

function sortFilterGroups(groups: GreenAcresFilterGroup[]): GreenAcresFilterGroup[] {
  return [...groups]
    .filter(group => group.values?.length)
    .sort((a, b) => {
      const aIndex = PRIORITY_GROUPS.indexOf(a.key);
      const bIndex = PRIORITY_GROUPS.indexOf(b.key);
      if (aIndex === -1 && bIndex === -1) return a.label.localeCompare(b.label);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
}

export function FilterPanel({
  filters,
  sortBy,
  categories,
  greenAcresFilterIndex,
  onFiltersChange,
  onSortChange,
}: FilterPanelProps) {
  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleFilter = (key: BooleanFilterKey) => {
    onFiltersChange({ ...filters, [key]: !filters[key] });
  };

  const selectedGreenAcresFilters = filters.greenAcresFilters || {};

  const toggleGreenAcresFilter = (groupKey: string, value: string) => {
    const currentValues = selectedGreenAcresFilters[groupKey] || [];
    const nextValues = currentValues.includes(value)
      ? currentValues.filter(item => item !== value)
      : [...currentValues, value];

    const nextGreenAcresFilters = {
      ...selectedGreenAcresFilters,
      [groupKey]: nextValues,
    };

    if (nextValues.length === 0) {
      delete nextGreenAcresFilters[groupKey];
    }

    onFiltersChange({
      ...filters,
      greenAcresFilters: nextGreenAcresFilters,
    });
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
      greenAcresFilters: {},
    });
  };

  const selectedGreenAcresCount = Object.values(selectedGreenAcresFilters).reduce((total, values) => total + values.length, 0);

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'greenAcresOnly' || key === 'greenAcresMissingOnly' || key === 'greenAcresFilters') return false;
    if (key.startsWith('garden')) return false;
    return value === true || (typeof value === 'string' && value !== '');
  }).length + selectedGreenAcresCount;

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

  const greenAcresGroups = sortFilterGroups(greenAcresFilterIndex?.groups || []);

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
            <option value="">All local categories</option>
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

      <details className="rounded-2xl border border-emerald-900/70 bg-slate-900 p-3" open>
        <summary className="cursor-pointer list-none text-sm font-semibold text-white">
          Green Acres real filters
          <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">
            {selectedGreenAcresCount} selected
          </span>
        </summary>

        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          These use Green Acres product tags and the filter/menu data captured from the site.
        </p>

        <div className="mt-3 space-y-3">
          {greenAcresGroups.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
              Green Acres filter index is loading. The shrubs are checking their clipboard.
            </div>
          ) : (
            greenAcresGroups.map(group => {
              const selectedValues = selectedGreenAcresFilters[group.key] || [];
              const visibleLimit = MAX_VISIBLE_VALUES[group.key] || 24;
              const values = group.values.slice(0, visibleLimit);
              return (
                <details
                  key={group.key}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-3"
                  open={['plantCategories', 'lightRequirements', 'waterNeeds', 'landscapeUses'].includes(group.key)}
                >
                  <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
                    {group.label}
                    {selectedValues.length > 0 && (
                      <span className="ml-2 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] text-blue-200">
                        {selectedValues.length}
                      </span>
                    )}
                  </summary>
                  <div className="mt-3 flex max-h-56 flex-wrap gap-2 overflow-y-auto pr-1">
                    {values.map(value => {
                      const isSelected = selectedValues.includes(value.value);
                      return (
                        <button
                          key={`${group.key}-${value.value}`}
                          type="button"
                          onClick={() => toggleGreenAcresFilter(group.key, value.value)}
                          title={value.section ? `${value.section} · ${value.count || 0} plants/items` : `${value.count || 0} plants/items`}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            isSelected
                              ? 'border-blue-400 bg-blue-500/15 text-blue-200'
                              : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          {value.label}
                          {typeof value.count === 'number' && value.count > 0 && (
                            <span className="ml-1 text-[10px] text-slate-500">{value.count}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {group.values.length > values.length && (
                    <div className="mt-2 text-[11px] text-slate-500">
                      Showing top {values.length} of {group.values.length}. Use search too; this group is annoyingly ambitious.
                    </div>
                  )}
                </details>
              );
            })
          )}
        </div>
      </details>

      <details className="rounded-2xl border border-slate-700 bg-slate-900 p-3">
        <summary className="cursor-pointer list-none text-sm font-semibold text-white">
          Older helper filters
        </summary>

        <div className="mt-3 space-y-4">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Water helpers</div>
            <div className="flex flex-wrap gap-2">
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
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Size helpers</div>
            <div className="space-y-2">
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
          </div>
        </div>
      </details>

      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs leading-relaxed text-slate-400">
        Green Acres filters use OR inside one group and AND across groups. Translation: Full Sun + Low Water = both. Red + Purple flower = either.
      </div>
    </div>
  );
}
