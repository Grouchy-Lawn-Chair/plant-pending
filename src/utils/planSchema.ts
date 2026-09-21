import {
  CURRENT_PLAN_SCHEMA_VERSION,
  GardenPlan,
  GardenZone,
  LinearSiteFeature,
  PlanLayer,
  PlacedPlant,
  SiteLight,
} from '../types/plant';

export const DEFAULT_PLAN_LAYERS: PlanLayer[] = [
  { id: 'background', name: 'Background / reference', kind: 'background', visible: true, locked: false, order: 0 },
  { id: 'areas', name: 'Ground surfaces / Areas', kind: 'areas', visible: true, locked: false, order: 10 },
  { id: 'structures', name: 'House / structures', kind: 'structures', visible: true, locked: false, order: 20 },
  { id: 'retaining-walls', name: 'Retaining walls', kind: 'retainingWalls', visible: true, locked: false, order: 30 },
  { id: 'fences', name: 'Fences / boundaries', kind: 'fences', visible: true, locked: false, order: 40 },
  { id: 'plants', name: 'Plants / rocks', kind: 'plants', visible: true, locked: false, order: 50 },
  { id: 'lights', name: 'Lights / annotations', kind: 'lights', visible: true, locked: false, order: 60 },
];

export const DEFAULT_SCAN_ALIGNMENT = {
  visible: true,
  opacity: 0.65,
  planOpacity: 0.8,
  transform: {
    translationFt: { x: 0, y: 0, z: 0 },
    rotationDeg: { x: 0, y: 0, z: 0 },
    uniformScale: 1,
  },
  controlPoints: [],
} as const;

function cloneDefaultLayers(): PlanLayer[] {
  return DEFAULT_PLAN_LAYERS.map(layer => ({ ...layer }));
}

export function defaultLayerIdForZone(zone: GardenZone): string {
  return zone.surfaceType === 'structure' ? 'structures' : 'areas';
}

export function defaultLayerIdForFeature(feature: Pick<LinearSiteFeature, 'kind'>): string {
  return feature.kind === 'retainingWall' ? 'retaining-walls' : 'fences';
}

function normalizeLayers(layers?: PlanLayer[]): PlanLayer[] {
  const supplied = Array.isArray(layers) ? layers : [];
  const suppliedById = new Map(supplied.map(layer => [layer.id, layer]));
  const defaults = cloneDefaultLayers().map(defaultLayer => ({
    ...defaultLayer,
    ...suppliedById.get(defaultLayer.id),
  }));
  const custom = supplied.filter(layer => !DEFAULT_PLAN_LAYERS.some(defaultLayer => defaultLayer.id === layer.id));
  return [...defaults, ...custom].sort((a, b) => a.order - b.order);
}

function normalizePlacedItem(item: PlacedPlant, index: number): PlacedPlant {
  return {
    ...item,
    layerId: item.layerId || 'plants',
    order: item.order ?? index,
    plannedPosition: item.plannedPosition || { x: item.x, y: item.y },
  };
}

function normalizeZone(zone: GardenZone, index: number): GardenZone {
  return {
    ...zone,
    layerId: zone.layerId || defaultLayerIdForZone(zone),
    order: zone.order ?? index,
  };
}

function normalizeFeature(feature: LinearSiteFeature, index: number): LinearSiteFeature {
  const expectedSegmentCount = Math.max(0, feature.points.length - 1);
  const fixedFenceThicknessFt = 0.5 / 12;
  const material = feature.kind === 'standardFence'
    ? 'Wood picket'
    : feature.kind === 'gardenFence'
      ? 'Wire mesh'
      : feature.kind === 'retainingWall'
        ? 'Concrete'
        : undefined;
  return {
    ...feature,
    schemaVersion: 1,
    points: Array.isArray(feature.points) ? feature.points : [],
    segments: Array.from({ length: expectedSegmentCount }, (_, segmentIndex) => {
      const legacySegment = feature.segments?.[segmentIndex] || {};
      const legacyHeights = [legacySegment.heightStartFt, legacySegment.heightEndFt]
        .filter((height): height is number => Number.isFinite(height));
      return {
        heightFt: legacySegment.heightFt ?? (legacyHeights.length > 0 ? Math.max(...legacyHeights) : undefined),
        thicknessFt: feature.kind === 'standardFence' || feature.kind === 'gardenFence'
          ? fixedFenceThicknessFt
          : legacySegment.thicknessFt,
        material: material || legacySegment.material,
        notes: legacySegment.notes,
      };
    }),
    layerId: feature.layerId || defaultLayerIdForFeature(feature),
    order: feature.order ?? index,
    visible: feature.visible !== false,
    notes: feature.notes || '',
  };
}

function normalizeLight(light: SiteLight, index: number): SiteLight {
  return {
    ...light,
    schemaVersion: 1,
    position: light.position || { x: 0, y: 0 },
    azimuthDeg: Number.isFinite(light.azimuthDeg) ? light.azimuthDeg : 0,
    tiltDeg: Number.isFinite(light.tiltDeg) ? light.tiltDeg : -45,
    beamAngleDeg: Number.isFinite(light.beamAngleDeg) ? light.beamAngleDeg : 60,
    mountingHeightFt: Number.isFinite(light.mountingHeightFt) ? light.mountingHeightFt : 0,
    status: light.status || 'existing',
    enabled: light.enabled !== false,
    layerId: light.layerId || 'lights',
    order: light.order ?? index,
    visible: light.visible !== false,
    notes: light.notes || '',
  };
}

export function normalizeGardenPlan(input: Partial<GardenPlan>): GardenPlan {
  const now = new Date().toISOString();
  const zones = Array.isArray(input.zones) ? input.zones.map(normalizeZone) : [];
  const placedPlants = Array.isArray(input.placedPlants) ? input.placedPlants.map(normalizePlacedItem) : [];
  const siteFeatures = Array.isArray(input.siteFeatures) ? input.siteFeatures.map(normalizeFeature) : [];
  const siteLights = Array.isArray(input.siteLights) ? input.siteLights.map(normalizeLight) : [];

  return {
    id: input.id || '',
    name: input.name || 'Untitled Plan',
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
    backgroundImage: input.backgroundImage ?? null,
    backgroundOpacity: input.backgroundOpacity ?? 0.5,
    backgroundLocked: input.backgroundLocked ?? false,
    restoreBackgroundOnLaunch: input.restoreBackgroundOnLaunch ?? false,
    scalePixelsPerFoot: input.scalePixelsPerFoot ?? null,
    placedPlants,
    zones,
    plantingGroups: Array.isArray(input.plantingGroups) ? input.plantingGroups : [],
    zoneShapesVisible: input.zoneShapesVisible ?? true,
    notes: input.notes || '',
    canvasWorldSize: input.canvasWorldSize || { width: 900, height: 650 },
    plantCircleOpacity: input.plantCircleOpacity ?? 0.58,
    plantLabelMode: input.plantLabelMode || 'numbers',
    plantClumpingEnabled: input.plantClumpingEnabled ?? true,
    plantClumpStrength: input.plantClumpStrength || 'normal',
    zoom: input.zoom ?? 1,
    shrubScore: input.shrubScore,
    schemaVersion: CURRENT_PLAN_SCHEMA_VERSION,
    northRotationDeg: input.northRotationDeg ?? 0,
    layers: normalizeLayers(input.layers),
    siteFeatures,
    siteLights,
    scanAlignment: {
      ...DEFAULT_SCAN_ALIGNMENT,
      ...input.scanAlignment,
      transform: {
        ...DEFAULT_SCAN_ALIGNMENT.transform,
        ...input.scanAlignment?.transform,
        translationFt: { ...DEFAULT_SCAN_ALIGNMENT.transform.translationFt, ...input.scanAlignment?.transform.translationFt },
        rotationDeg: { ...DEFAULT_SCAN_ALIGNMENT.transform.rotationDeg, ...input.scanAlignment?.transform.rotationDeg },
      },
      controlPoints: Array.isArray(input.scanAlignment?.controlPoints) ? input.scanAlignment.controlPoints : [],
    },
  };
}
