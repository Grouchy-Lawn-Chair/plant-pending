import { GardenZone, LinearSiteFeature, PlanLayer, SiteFeatureSegment, SiteLight } from '../types/plant';
import { canvasDistanceToFeet, normalizeDegrees } from '../utils/sceneCoordinates';
import { getSiteLightPreset, SITE_LIGHT_PRESETS } from '../utils/siteLightPresets';

interface SiteFeatureInspectorProps {
  selectedFeature: LinearSiteFeature | null;
  selectedLight: SiteLight | null;
  zones: GardenZone[];
  siteFeatures: LinearSiteFeature[];
  siteLights: SiteLight[];
  layers: PlanLayer[];
  pixelsPerFoot: number | null;
  northRotationDeg: number;
  showLayers: boolean;
  onClose: () => void;
  onUpdateFeature: (featureId: string, updates: Partial<LinearSiteFeature>) => void;
  onUpdateZone: (zoneId: string, updates: Partial<GardenZone>) => void;
  onSelectZone: (zoneId: string | null) => void;
  onSelectFeature: (featureId: string | null) => void;
  onSelectLight: (lightId: string | null) => void;
  onDeleteFeature: (featureId: string) => void;
  onUpdateLight: (lightId: string, updates: Partial<SiteLight>) => void;
  onDeleteLight: (lightId: string) => void;
  onUpdateLayer: (layerId: string, updates: Partial<PlanLayer>) => void;
  onReorderLayer: (layerId: string, direction: -1 | 1) => void;
  onNorthRotationChange: (degrees: number) => void;
}

const inputClass = 'w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white';
const labelClass = 'block text-[11px] font-medium text-slate-400 mb-1';

function optionalNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function featureKindLabel(feature: LinearSiteFeature): string {
  const labels: Record<LinearSiteFeature['kind'], string> = {
    standardFence: 'Standard fence',
    gardenFence: 'Garden fence',
    retainingWall: 'Retaining wall',
    edging: 'Edging',
    boundary: 'Other boundary',
  };
  return labels[feature.kind];
}

export function SiteFeatureInspector({
  selectedFeature,
  selectedLight,
  zones,
  siteFeatures,
  siteLights,
  layers,
  pixelsPerFoot,
  northRotationDeg,
  showLayers,
  onClose,
  onUpdateFeature,
  onUpdateZone,
  onSelectZone,
  onSelectFeature,
  onSelectLight,
  onDeleteFeature,
  onUpdateLight,
  onDeleteLight,
  onUpdateLayer,
  onReorderLayer,
  onNorthRotationChange,
}: SiteFeatureInspectorProps) {
  if (!selectedFeature && !selectedLight && !showLayers) return null;

  const updateSegment = (feature: LinearSiteFeature, segmentIndex: number, updates: Partial<SiteFeatureSegment>) => {
    onUpdateFeature(feature.id, {
      segments: feature.segments.map((segment, index) => index === segmentIndex ? { ...segment, ...updates } : segment),
    });
  };

  const reorderWithinLayer = <T extends { id: string; layerId?: string; order?: number }>(
    items: T[],
    item: T,
    direction: -1 | 1,
    update: (id: string, updates: { order: number }) => void,
  ) => {
    const siblings = items
      .filter(candidate => candidate.layerId === item.layerId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const index = siblings.findIndex(candidate => candidate.id === item.id);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= siblings.length) return;
    update(item.id, { order: siblings[swapIndex].order ?? swapIndex });
    update(siblings[swapIndex].id, { order: item.order ?? index });
  };

  const layerItems = (layer: PlanLayer) => [
    ...zones.filter(zone => (zone.layerId || (zone.surfaceType === 'structure' ? 'structures' : 'areas')) === layer.id).map(zone => ({
      id: zone.id,
      name: zone.name,
      detail: zone.surfaceType || 'Area',
      visible: zone.visible !== false,
      order: zone.order ?? 0,
      onToggle: () => onUpdateZone(zone.id, { visible: zone.visible === false }),
      onSelect: () => { onSelectZone(zone.id); onSelectFeature(null); onSelectLight(null); onClose(); },
      onMove: (direction: -1 | 1) => reorderWithinLayer(zones.map(item => ({ ...item, layerId: item.layerId || (item.surfaceType === 'structure' ? 'structures' : 'areas') })), { ...zone, layerId: zone.layerId || (zone.surfaceType === 'structure' ? 'structures' : 'areas') }, direction, onUpdateZone),
    })),
    ...siteFeatures.filter(feature => feature.layerId === layer.id).map(feature => ({
      id: feature.id,
      name: feature.name,
      detail: featureKindLabel(feature),
      visible: feature.visible !== false,
      order: feature.order,
      onToggle: () => onUpdateFeature(feature.id, { visible: feature.visible === false }),
      onSelect: () => { onSelectFeature(feature.id); onSelectZone(null); onSelectLight(null); onClose(); },
      onMove: (direction: -1 | 1) => reorderWithinLayer(siteFeatures, feature, direction, onUpdateFeature),
    })),
    ...siteLights.filter(light => light.layerId === layer.id).map(light => ({
      id: light.id,
      name: light.name,
      detail: light.lightType,
      visible: light.visible !== false,
      order: light.order,
      onToggle: () => onUpdateLight(light.id, { visible: light.visible === false }),
      onSelect: () => { onSelectLight(light.id); onSelectZone(null); onSelectFeature(null); onClose(); },
      onMove: (direction: -1 | 1) => reorderWithinLayer(siteLights, light, direction, onUpdateLight),
    })),
  ].sort((a, b) => b.order - a.order);

  return (
    <aside className="absolute right-3 top-3 z-[45] max-h-[calc(100%-1.5rem)] w-[min(23rem,calc(100%-1.5rem))] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/95 p-3 text-slate-100 shadow-2xl backdrop-blur">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
            {showLayers ? 'Plan layers' : selectedLight ? 'Directional light' : 'Site feature'}
          </div>
          {!showLayers && <div className="mt-0.5 text-sm font-bold">{selectedLight?.name || selectedFeature?.name}</div>}
        </div>
        <button type="button" onClick={onClose} className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800">Close</button>
      </div>

      {showLayers && (
        <div className="space-y-3">
          <label>
            <span className={labelClass}>North rotation</span>
            <div className="flex items-center gap-2">
              <input type="range" min="0" max="359" value={northRotationDeg} onChange={event => onNorthRotationChange(Number(event.target.value))} className="min-w-0 flex-1" />
              <input type="number" min="0" max="359" value={northRotationDeg} onChange={event => onNorthRotationChange(normalizeDegrees(Number(event.target.value) || 0))} className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm" />
            </div>
          </label>
          <div className="space-y-1.5">
            {[...layers].sort((a, b) => b.order - a.order).map(layer => {
              const items = layerItems(layer);
              return (
                <div key={layer.id} className="rounded-lg border border-slate-700 bg-slate-950/70">
                  <div className="flex items-center gap-2 p-2">
                    <button type="button" onClick={() => onUpdateLayer(layer.id, { visible: !layer.visible })} className={`w-14 rounded px-1.5 py-1 text-[10px] ${layer.visible ? 'bg-emerald-600' : 'bg-slate-700'}`}>{layer.visible ? 'Visible' : 'Hidden'}</button>
                    <button type="button" onClick={() => onUpdateLayer(layer.id, { locked: !layer.locked })} className={`w-12 rounded px-1.5 py-1 text-[10px] ${layer.locked ? 'bg-amber-600' : 'bg-slate-700'}`}>{layer.locked ? 'Locked' : 'Open'}</button>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold">{layer.name}</span>
                    <button type="button" onClick={() => onReorderLayer(layer.id, 1)} className="rounded border border-slate-700 px-1.5 py-1 text-xs" title="Move category visually forward">↑</button>
                    <button type="button" onClick={() => onReorderLayer(layer.id, -1)} className="rounded border border-slate-700 px-1.5 py-1 text-xs" title="Move category visually backward">↓</button>
                  </div>
                  {items.length > 0 && <div className="space-y-1 border-t border-slate-800 p-1.5">
                    {items.map(item => <div key={item.id} className="flex items-center gap-1.5 rounded bg-slate-900 px-1.5 py-1.5">
                      <button type="button" onClick={item.onToggle} className={`w-5 text-xs ${item.visible ? 'text-emerald-400' : 'text-slate-600'}`} title={item.visible ? 'Hide this item' : 'Show this item'}>{item.visible ? '●' : '○'}</button>
                      <button type="button" onClick={item.onSelect} className="min-w-0 flex-1 truncate text-left text-xs text-slate-200" title={`${item.name} · ${item.detail}`}><span className="font-medium">{item.name}</span><span className="ml-1 text-[10px] text-slate-500">{item.detail}</span></button>
                      <button type="button" onClick={() => item.onMove(1)} className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px]" title="Move item forward">↑</button>
                      <button type="button" onClick={() => item.onMove(-1)} className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px]" title="Move item backward">↓</button>
                    </div>)}
                  </div>}
                </div>
              );
            })}
          </div>
          <p className="text-[11px] leading-relaxed text-slate-400">Category arrows move whole groups. Item arrows stack individual Areas and features within their category. This affects only 2D appearance and selection, never physical elevation.</p>
        </div>
      )}

      {!showLayers && selectedFeature && (
        <div className="space-y-3">
          <div className="rounded-lg bg-slate-950/70 p-2 text-xs text-slate-300">{featureKindLabel(selectedFeature)} · {selectedFeature.segments.length} segment{selectedFeature.segments.length === 1 ? '' : 's'}</div>
          <label><span className={labelClass}>Name</span><input value={selectedFeature.name} onChange={event => onUpdateFeature(selectedFeature.id, { name: event.target.value })} className={inputClass} /></label>
          <label><span className={labelClass}>Layer</span><select value={selectedFeature.layerId} onChange={event => onUpdateFeature(selectedFeature.id, { layerId: event.target.value })} className={inputClass}>{layers.map(layer => <option key={layer.id} value={layer.id}>{layer.name}</option>)}</select></label>
          <div className="space-y-2">
            {selectedFeature.segments.map((segment, index) => {
              const start = selectedFeature.points[index];
              const end = selectedFeature.points[index + 1];
              const lengthFt = start && end ? canvasDistanceToFeet(Math.hypot(end.x - start.x, end.y - start.y), pixelsPerFoot) : null;
              return (
                <details key={index} open={index === 0} className="rounded-lg border border-slate-700 bg-slate-950/60">
                  <summary className="cursor-pointer px-2 py-2 text-xs font-semibold">Segment {index + 1}{lengthFt !== null ? ` · ${lengthFt.toFixed(1)} ft` : ' · set scale for length'}</summary>
                  <div className="grid grid-cols-2 gap-2 border-t border-slate-700 p-2">
                    <label><span className={labelClass}>Height (ft)</span><input type="number" min="0" step="0.25" value={segment.heightFt ?? ''} onChange={event => updateSegment(selectedFeature, index, { heightFt: optionalNumber(event.target.value) })} className={inputClass} /></label>
                    {selectedFeature.kind === 'retainingWall' ? (
                      <label><span className={labelClass}>Thickness (in)</span><input type="number" min="0" step="0.5" value={segment.thicknessFt === undefined ? '' : Number((segment.thicknessFt * 12).toFixed(3))} onChange={event => { const inches = optionalNumber(event.target.value); updateSegment(selectedFeature, index, { thicknessFt: inches === undefined ? undefined : inches / 12 }); }} className={inputClass} /></label>
                    ) : (
                      <div><span className={labelClass}>Thickness</span><div className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-300">½ in (standard)</div></div>
                    )}
                    <div className="col-span-2"><span className={labelClass}>Material</span><div className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-300">{segment.material}</div></div>
                  </div>
                </details>
              );
            })}
          </div>
          <label><span className={labelClass}>Notes</span><textarea value={selectedFeature.notes} onChange={event => onUpdateFeature(selectedFeature.id, { notes: event.target.value })} className={`${inputClass} min-h-16`} /></label>
          <div className="flex gap-2">
            <button type="button" onClick={() => onUpdateFeature(selectedFeature.id, { order: selectedFeature.order + 1 })} className="flex-1 rounded border border-slate-700 px-2 py-1.5 text-xs">Bring forward</button>
            <button type="button" onClick={() => onUpdateFeature(selectedFeature.id, { order: selectedFeature.order - 1 })} className="flex-1 rounded border border-slate-700 px-2 py-1.5 text-xs">Send backward</button>
          </div>
          <button type="button" onClick={() => onDeleteFeature(selectedFeature.id)} className="w-full rounded border border-red-500/40 bg-red-500/15 px-3 py-2 text-xs text-red-200">Delete feature</button>
        </div>
      )}

      {!showLayers && selectedLight && (
        <div className="space-y-3">
          <label><span className={labelClass}>Name</span><input value={selectedLight.name} onChange={event => onUpdateLight(selectedLight.id, { name: event.target.value })} className={inputClass} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label><span className={labelClass}>Type</span><select value={selectedLight.lightType} onChange={event => { const lightType = event.target.value as SiteLight['lightType']; const preset = getSiteLightPreset(lightType); onUpdateLight(selectedLight.id, { lightType, tiltDeg: preset.tiltDeg, beamAngleDeg: preset.beamAngleDeg }); }} className={inputClass}>{(Object.entries(SITE_LIGHT_PRESETS) as Array<[SiteLight['lightType'], (typeof SITE_LIGHT_PRESETS)[SiteLight['lightType']]]>).map(([value, preset]) => <option key={value} value={value}>{preset.label}</option>)}</select></label>
            <label><span className={labelClass}>Existing / proposed</span><select value={selectedLight.status} onChange={event => onUpdateLight(selectedLight.id, { status: event.target.value as SiteLight['status'] })} className={inputClass}><option value="existing">Existing</option><option value="proposed">Proposed</option></select></label>
          </div>
          <label><span className={labelClass}>Azimuth / rotation: {Math.round(selectedLight.azimuthDeg)}°</span><input type="range" min="0" max="359" value={selectedLight.azimuthDeg} onChange={event => onUpdateLight(selectedLight.id, { azimuthDeg: Number(event.target.value) })} className="w-full" /></label>
          <div className="grid grid-cols-3 gap-2"><button type="button" onClick={() => onUpdateLight(selectedLight.id, { azimuthDeg: normalizeDegrees(selectedLight.azimuthDeg - 5) })} className="rounded border border-slate-700 p-1.5 text-xs">−5°</button><input type="number" value={selectedLight.azimuthDeg} onChange={event => onUpdateLight(selectedLight.id, { azimuthDeg: normalizeDegrees(Number(event.target.value) || 0) })} className={inputClass} /><button type="button" onClick={() => onUpdateLight(selectedLight.id, { azimuthDeg: normalizeDegrees(selectedLight.azimuthDeg + 5) })} className="rounded border border-slate-700 p-1.5 text-xs">+5°</button></div>
          <label><span className={labelClass}>Tilt: {selectedLight.tiltDeg}°</span><input type="range" min="-90" max="90" value={selectedLight.tiltDeg} onChange={event => onUpdateLight(selectedLight.id, { tiltDeg: Number(event.target.value) })} className="w-full" /></label>
          <div className="grid grid-cols-3 gap-2"><button type="button" onClick={() => onUpdateLight(selectedLight.id, { tiltDeg: -45 })} className="rounded border border-slate-700 p-1.5 text-xs">Down</button><button type="button" onClick={() => onUpdateLight(selectedLight.id, { tiltDeg: 0 })} className="rounded border border-slate-700 p-1.5 text-xs">Level</button><button type="button" onClick={() => onUpdateLight(selectedLight.id, { tiltDeg: 45 })} className="rounded border border-slate-700 p-1.5 text-xs">Up</button></div>
          {getSiteLightPreset(selectedLight.lightType).omnidirectional ? (
            <div className="rounded border border-lime-700/60 bg-lime-950/30 px-3 py-2 text-xs text-lime-200">Path lights use an omnidirectional map footprint.</div>
          ) : (
            <>
              <label><span className={labelClass}>Beam angle: {selectedLight.beamAngleDeg}°</span><input type="range" min="5" max="160" value={selectedLight.beamAngleDeg} onChange={event => onUpdateLight(selectedLight.id, { beamAngleDeg: Number(event.target.value) })} className="w-full" /></label>
              <div className="grid grid-cols-3 gap-2"><button type="button" onClick={() => onUpdateLight(selectedLight.id, { beamAngleDeg: 20 })} className="rounded border border-slate-700 p-1.5 text-xs">Narrow</button><button type="button" onClick={() => onUpdateLight(selectedLight.id, { beamAngleDeg: 60 })} className="rounded border border-slate-700 p-1.5 text-xs">Medium</button><button type="button" onClick={() => onUpdateLight(selectedLight.id, { beamAngleDeg: 110 })} className="rounded border border-slate-700 p-1.5 text-xs">Wide</button></div>
            </>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label><span className={labelClass}>Mounting height (ft)</span><input type="number" step="0.25" value={selectedLight.mountingHeightFt ?? ''} onChange={event => onUpdateLight(selectedLight.id, { mountingHeightFt: optionalNumber(event.target.value) })} className={inputClass} /></label>
            <label><span className={labelClass}>Range (ft)</span><input type="number" step="0.5" value={selectedLight.rangeFt ?? ''} onChange={event => onUpdateLight(selectedLight.id, { rangeFt: optionalNumber(event.target.value) })} className={inputClass} /></label>
            <label><span className={labelClass}>Lumens</span><input type="number" value={selectedLight.lumens ?? ''} onChange={event => onUpdateLight(selectedLight.id, { lumens: optionalNumber(event.target.value) })} className={inputClass} /></label>
            <label><span className={labelClass}>Watts</span><input type="number" step="0.1" value={selectedLight.watts ?? ''} onChange={event => onUpdateLight(selectedLight.id, { watts: optionalNumber(event.target.value) })} className={inputClass} /></label>
            <label><span className={labelClass}>Color temperature (K)</span><input type="number" step="100" value={selectedLight.colorTemperatureK ?? ''} onChange={event => onUpdateLight(selectedLight.id, { colorTemperatureK: optionalNumber(event.target.value) })} className={inputClass} /></label>
            <label className="flex items-end gap-2 pb-2 text-xs"><input type="checkbox" checked={selectedLight.rgbwCapable || false} onChange={event => onUpdateLight(selectedLight.id, { rgbwCapable: event.target.checked })} /> RGB/RGBW capable</label>
          </div>
          <label><span className={labelClass}>Layer</span><select value={selectedLight.layerId} onChange={event => onUpdateLight(selectedLight.id, { layerId: event.target.value })} className={inputClass}>{layers.map(layer => <option key={layer.id} value={layer.id}>{layer.name}</option>)}</select></label>
          <label><span className={labelClass}>Notes</span><textarea value={selectedLight.notes} onChange={event => onUpdateLight(selectedLight.id, { notes: event.target.value })} className={`${inputClass} min-h-16`} /></label>
          <button type="button" onClick={() => onDeleteLight(selectedLight.id)} className="w-full rounded border border-red-500/40 bg-red-500/15 px-3 py-2 text-xs text-red-200">Delete light</button>
        </div>
      )}
    </aside>
  );
}
