import fs from 'node:fs';

function replaceOnce(source, oldText, newText, label) {
  if (source.includes(newText)) return source;
  if (!source.includes(oldText)) throw new Error(`${label} anchor not found.`);
  return source.replace(oldText, newText);
}

function updateTypes() {
  const path = 'src/types/plant.ts';
  let source = fs.readFileSync(path, 'utf8');

  source = replaceOnce(
    source,
    "export type ZoneType = 'planting' | 'exclusion';",
    "export type ZoneType = 'planting' | 'exclusion';\nexport type ZoneSurfaceType = 'planting' | 'pool' | 'concrete' | 'pavers' | 'gravel' | 'rockMulch' | 'barkMulch' | 'lawn' | 'firePit' | 'furniture' | 'structure' | 'exclusion';",
    'ZoneSurfaceType',
  );

  source = replaceOnce(
    source,
    '  zoneType?: ZoneType;\n  points:',
    '  zoneType?: ZoneType;\n  surfaceType?: ZoneSurfaceType;\n  points:',
    'GardenZone surfaceType',
  );

  fs.writeFileSync(path, source);
}

function updateApp() {
  const path = 'src/App.tsx';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(
    source,
    "      zoneType: 'planting',\n      sunExposure:",
    "      zoneType: 'planting',\n      surfaceType: 'planting',\n      sunExposure:",
    'new zone surface default',
  );
  fs.writeFileSync(path, source);
}

function updatePlanDetails() {
  const path = 'src/components/PlanDetails.tsx';
  let source = fs.readFileSync(path, 'utf8');

  source = replaceOnce(
    source,
    'ZoneSunExposure, ZoneWaterNeed, ZoneAfternoonSun, ZoneType, PlantingGroup',
    'ZoneSunExposure, ZoneWaterNeed, ZoneAfternoonSun, ZoneType, ZoneSurfaceType, PlantingGroup',
    'PlanDetails import',
  );

  const optionsAnchor = `const ZONE_PLANT_VARIETY_OPTIONS: { value: ZonePlantVariety; label: string; helper: string }[] = [`;
  if (!source.includes('const ZONE_SURFACE_OPTIONS')) {
    const index = source.indexOf(optionsAnchor);
    if (index === -1) throw new Error('Zone option anchor not found.');
    const block = `const ZONE_SURFACE_OPTIONS: { value: ZoneSurfaceType; label: string; helper: string }[] = [
  { value: 'planting', label: 'Planting bed', helper: 'Normal planting zone with generation and site controls.' },
  { value: 'pool', label: 'Pool / water feature', helper: 'Blue water fill with ripple lines. Plants are excluded.' },
  { value: 'concrete', label: 'Concrete', helper: 'Light gray speckled hardscape. Plants are excluded.' },
  { value: 'pavers', label: 'Pavers', helper: 'Repeating block pattern. Plants are excluded.' },
  { value: 'gravel', label: 'Gravel', helper: 'Small pebble texture. Plants are excluded.' },
  { value: 'rockMulch', label: 'Rock mulch', helper: 'Larger stone texture. Plants are excluded.' },
  { value: 'barkMulch', label: 'Bark mulch', helper: 'Brown wood-chip texture. Plants are excluded.' },
  { value: 'lawn', label: 'Lawn', helper: 'Green grass texture. Plants are excluded from auto-generation.' },
  { value: 'firePit', label: 'Fire pit', helper: 'Dark stone and ember pattern. Plants are excluded.' },
  { value: 'furniture', label: 'Chairs / furniture area', helper: 'Seating-area pattern. Plants are excluded.' },
  { value: 'structure', label: 'Building / structure', helper: 'Solid structural footprint. Plants are excluded.' },
  { value: 'exclusion', label: 'Plain no-plant area', helper: 'Generic hatched exclusion zone.' },
];

function getZoneSurface(zone: GardenZone): ZoneSurfaceType {
  return zone.surfaceType || (zone.zoneType === 'exclusion' ? 'exclusion' : 'planting');
}

function getZoneSurfaceLabel(zone: GardenZone): string {
  return ZONE_SURFACE_OPTIONS.find(option => option.value === getZoneSurface(zone))?.label || 'Planting bed';
}

`;
    source = source.slice(0, index) + block + source.slice(index);
  }

  source = source.replace(
    "{zone.zoneType === 'exclusion' ? 'Plant exclusion' : 'Planting zone'}, {zone.points.length} points, {Math.round((zone.opacity ?? 0.28) * 100)}% fill",
    "{getZoneSurfaceLabel(zone)}, {zone.points.length} points, {Math.round((zone.opacity ?? 0.28) * 100)}% fill",
  );

  const oldSelect = `<div>
                    <label className="text-xs text-slate-400 block mb-1">Zone type</label>
                    <select
                      value={editingZone.zoneType || 'planting'}
                      onChange={(e) => onUpdateZone(editingZone.id, { zoneType: e.target.value as ZoneType })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    >
                      <option value="planting">Planting zone</option>
                      <option value="exclusion">Plant exclusion zone</option>
                    </select>
                    <p className="mt-1 text-xs text-slate-400">Use exclusion zones for chairs, paths, equipment, and no-plant pockets.</p>
                  </div>`;

  const newSelect = `<div>
                    <label className="text-xs text-slate-400 block mb-1">Area type</label>
                    <select
                      value={getZoneSurface(editingZone)}
                      onChange={(e) => {
                        const surfaceType = e.target.value as ZoneSurfaceType;
                        const zoneType: ZoneType = surfaceType === 'planting' ? 'planting' : 'exclusion';
                        onUpdateZone(editingZone.id, { surfaceType, zoneType });
                      }}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    >
                      {ZONE_SURFACE_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-400">
                      {ZONE_SURFACE_OPTIONS.find(option => option.value === getZoneSurface(editingZone))?.helper}
                    </p>
                  </div>`;

  source = replaceOnce(source, oldSelect, newSelect, 'Area type selector');

  fs.writeFileSync(path, source);
}

function updateGardenCanvas() {
  const path = 'src/components/GardenCanvas.tsx';
  let source = fs.readFileSync(path, 'utf8');

  const helperAnchor = `function zonePointsToString(points: { x: number; y: number }[]): string {
  return points.map(point => \`${'${point.x},${point.y}'}\`).join(' ');
}
`;

  if (!source.includes('function getZoneSurfaceAppearance(')) {
    const helper = `${helperAnchor}
function getZoneSurfaceAppearance(zone: GardenZone) {
  const surface = zone.surfaceType || (zone.zoneType === 'exclusion' ? 'exclusion' : 'planting');
  const appearances = {
    planting: { fill: zone.color, stroke: zone.color, opacity: zone.opacity ?? 0.28, dash: '6 5', label: zone.name },
    pool: { fill: 'url(#surface-water)', stroke: '#0284c7', opacity: 0.88, dash: '0', label: zone.name || 'Pool / water' },
    concrete: { fill: 'url(#surface-concrete)', stroke: '#64748b', opacity: 0.92, dash: '0', label: zone.name || 'Concrete' },
    pavers: { fill: 'url(#surface-pavers)', stroke: '#78716c', opacity: 0.92, dash: '0', label: zone.name || 'Pavers' },
    gravel: { fill: 'url(#surface-gravel)', stroke: '#78716c', opacity: 0.92, dash: '0', label: zone.name || 'Gravel' },
    rockMulch: { fill: 'url(#surface-rock-mulch)', stroke: '#57534e', opacity: 0.92, dash: '0', label: zone.name || 'Rock mulch' },
    barkMulch: { fill: 'url(#surface-bark)', stroke: '#78350f', opacity: 0.92, dash: '0', label: zone.name || 'Bark mulch' },
    lawn: { fill: 'url(#surface-lawn)', stroke: '#15803d', opacity: 0.9, dash: '0', label: zone.name || 'Lawn' },
    firePit: { fill: 'url(#surface-fire-pit)', stroke: '#292524', opacity: 0.96, dash: '0', label: zone.name || 'Fire pit' },
    furniture: { fill: 'url(#surface-furniture)', stroke: '#475569', opacity: 0.9, dash: '4 3', label: zone.name || 'Furniture' },
    structure: { fill: 'url(#surface-structure)', stroke: '#334155', opacity: 0.96, dash: '0', label: zone.name || 'Structure' },
    exclusion: { fill: 'url(#exclusion-zone-hatch)', stroke: '#991b1b', opacity: 0.32, dash: '7 5', label: 'no plants' },
  } as const;
  return appearances[surface];
}
`;
    source = source.replace(helperAnchor, helper);
  }

  const oldDefs = `<defs>
                <pattern id="exclusion-zone-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="10" stroke="#991b1b" strokeWidth="2" opacity="0.55" />
                </pattern>
              </defs>`;

  const newDefs = `<defs>
                <pattern id="exclusion-zone-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="10" stroke="#991b1b" strokeWidth="2" opacity="0.55" /></pattern>
                <pattern id="surface-water" width="36" height="18" patternUnits="userSpaceOnUse"><rect width="36" height="18" fill="#38bdf8"/><path d="M0 8 Q9 2 18 8 T36 8" fill="none" stroke="#e0f2fe" strokeWidth="2" opacity="0.8"/><path d="M-9 16 Q0 10 9 16 T27 16 T45 16" fill="none" stroke="#0284c7" strokeWidth="1.5" opacity="0.55"/></pattern>
                <pattern id="surface-concrete" width="28" height="28" patternUnits="userSpaceOnUse"><rect width="28" height="28" fill="#d6d3d1"/><circle cx="5" cy="7" r="1" fill="#a8a29e"/><circle cx="19" cy="17" r="1.2" fill="#f5f5f4"/><path d="M0 0H28M0 0V28" stroke="#a8a29e" strokeWidth="0.6" opacity="0.4"/></pattern>
                <pattern id="surface-pavers" width="34" height="22" patternUnits="userSpaceOnUse"><rect width="34" height="22" fill="#d6d3d1"/><path d="M0 0H34V22H0ZM17 0V11M0 11H34M8.5 11V22M25.5 11V22" fill="none" stroke="#78716c" strokeWidth="1.2"/></pattern>
                <pattern id="surface-gravel" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#d6d3d1"/><circle cx="5" cy="6" r="2.2" fill="#a8a29e"/><circle cx="16" cy="5" r="1.7" fill="#78716c"/><circle cx="11" cy="16" r="2.5" fill="#e7e5e4"/><circle cx="21" cy="18" r="1.8" fill="#a8a29e"/></pattern>
                <pattern id="surface-rock-mulch" width="42" height="34" patternUnits="userSpaceOnUse"><rect width="42" height="34" fill="#a8a29e"/><ellipse cx="9" cy="9" rx="6" ry="4" fill="#78716c"/><ellipse cx="29" cy="12" rx="8" ry="5" fill="#d6d3d1"/><ellipse cx="18" cy="27" rx="7" ry="4" fill="#57534e"/><ellipse cx="39" cy="29" rx="6" ry="4" fill="#e7e5e4"/></pattern>
                <pattern id="surface-bark" width="32" height="26" patternUnits="userSpaceOnUse"><rect width="32" height="26" fill="#92400e"/><path d="M3 6l9-3M17 8l11 4M6 19l10-5M20 22l8-4" stroke="#451a03" strokeWidth="3" strokeLinecap="round"/><path d="M7 10l5 2M21 4l6-2M2 24l7-3" stroke="#d97706" strokeWidth="2" strokeLinecap="round"/></pattern>
                <pattern id="surface-lawn" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#65a30d"/><path d="M4 20l2-7 2 7M12 20l3-9 1 9M19 20l-1-6" stroke="#166534" strokeWidth="1.4"/><path d="M1 8l2-5M10 7l1-5M20 9l-2-6" stroke="#bef264" strokeWidth="1"/></pattern>
                <pattern id="surface-fire-pit" width="54" height="54" patternUnits="userSpaceOnUse"><rect width="54" height="54" fill="#292524"/><circle cx="27" cy="27" r="22" fill="none" stroke="#78716c" strokeWidth="8" strokeDasharray="9 4"/><path d="M27 39c-9-7-5-14 0-22 5 8 9 15 0 22Z" fill="#f97316"/><path d="M27 34c-4-4-2-8 0-12 3 4 5 8 0 12Z" fill="#fde047"/></pattern>
                <pattern id="surface-furniture" width="58" height="42" patternUnits="userSpaceOnUse"><rect width="58" height="42" fill="#cbd5e1"/><circle cx="29" cy="21" r="8" fill="#94a3b8" stroke="#475569" strokeWidth="2"/><path d="M9 8h10v8H9zM39 8h10v8H39zM9 26h10v8H9zM39 26h10v8H39z" fill="#e2e8f0" stroke="#475569" strokeWidth="1.5"/></pattern>
                <pattern id="surface-structure" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#64748b"/><path d="M0 24L24 0M-6 18L6 6M18 30L30 18" stroke="#94a3b8" strokeWidth="5" opacity="0.65"/></pattern>
              </defs>`;

  source = replaceOnce(source, oldDefs, newDefs, 'surface SVG patterns');

  source = replaceOnce(
    source,
    `              {visibleZones.map(zone => {
                const isSelectedZone = zone.id === selectedZoneId;
                return (`,
    `              {visibleZones.map(zone => {
                const isSelectedZone = zone.id === selectedZoneId;
                const surface = getZoneSurfaceAppearance(zone);
                return (`,
    'zone appearance setup',
  );

  source = source
    .replace("fill={zone.zoneType === 'exclusion' ? 'url(#exclusion-zone-hatch)' : zone.color}", 'fill={surface.fill}')
    .replace("fillOpacity={zone.zoneType === 'exclusion' ? 0.28 : zone.opacity ?? 0.28}", 'fillOpacity={surface.opacity}')
    .replace("stroke={zone.zoneType === 'exclusion' ? '#991b1b' : zone.color}", 'stroke={surface.stroke}')
    .replace("strokeDasharray={zone.zoneType === 'exclusion' ? '7 5' : isSelectedZone ? '0' : '6 5'}", "strokeDasharray={isSelectedZone ? '0' : surface.dash}");

  source = source.replace('{zone.name}\n                      </text>', '{surface.label}\n                      </text>');

  fs.writeFileSync(path, source);
}

updateTypes();
updateApp();
updatePlanDetails();
updateGardenCanvas();
console.log('Added visual zone types for planting beds, water, concrete, pavers, gravel, mulch, lawn, fire pits, furniture, and structures.');
