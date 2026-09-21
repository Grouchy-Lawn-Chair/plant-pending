import { GardenPlan, Plant } from '../types/plant';
import { canvasPointToSceneFeet, hasCalibratedScale } from './sceneCoordinates';
import { normalizeGardenPlan } from './planSchema';

export type PlantVisualArchetype = 'broadleaf_tree' | 'upright_tree' | 'narrow_evergreen' | 'rounded_shrub' | 'flowering_shrub' | 'spreading_groundcover' | 'ornamental_grass' | 'hedge' | 'succulent' | 'flower_mass' | 'turf';

function inferPlantArchetype(plant: Plant): PlantVisualArchetype {
  const text = `${plant.category} ${plant.commonName} ${plant.botanicalName} ${plant.greenAcresBestUses?.join(' ') || ''}`.toLowerCase();
  if (/agave|aloe|echeveria|sedum|succulent|yucca/.test(text)) return 'succulent';
  if (/groundcover|myoporum|creeping|carpet/.test(text)) return 'spreading_groundcover';
  if (/grass|sedge|lomandra|muhlenbergia|pennisetum|phormium/.test(text)) return 'ornamental_grass';
  if (/hedge|screen/.test(text)) return 'hedge';
  if (/conifer|cypress|juniper|podocarpus|yew|evergreen/.test(text)) return 'narrow_evergreen';
  if (/tree/.test(text)) return plant.matureWidthFt && plant.matureHeightFt && plant.matureHeightFt > plant.matureWidthFt * 1.6 ? 'upright_tree' : 'broadleaf_tree';
  if (plant.flowers || /flower|rose|lantana|salvia/.test(text)) return 'flowering_shrub';
  if (/annual|bulb|perennial/.test(text)) return 'flower_mass';
  return 'rounded_shrub';
}

export function buildNormalizedScene(input: GardenPlan, plants: Plant[]) {
  const plan = normalizeGardenPlan(input);
  const pixelsPerFoot = plan.scalePixelsPerFoot;
  const missing3dData: Array<{ objectType: string; objectId: string; field: string }> = [];
  const requireScale = (objectType: string, objectId: string) => {
    if (!hasCalibratedScale(pixelsPerFoot)) missing3dData.push({ objectType, objectId, field: 'scalePixelsPerFoot' });
  };

  const areas = (plan.zones || []).map(area => {
    requireScale('area', area.id);
    if (area.surfaceType === 'structure') missing3dData.push({ objectType: 'area', objectId: area.id, field: 'heightFt' });
    return {
      id: area.id,
      name: area.name,
      surfaceType: area.surfaceType || (area.zoneType === 'exclusion' ? 'exclusion' : 'planting'),
      layerId: area.layerId,
      order: area.order,
      visible: area.visible,
      points: area.points.map(point => ({
        canvas: { x: point.x, y: point.y },
        world: canvasPointToSceneFeet(point, pixelsPerFoot),
      })),
      notes: area.notes || null,
    };
  });

  const siteFeatures = (plan.siteFeatures || []).map(feature => {
    requireScale('siteFeature', feature.id);
    feature.segments.forEach((segment, segmentIndex) => {
      if (segment.heightFt === undefined) missing3dData.push({ objectType: 'siteFeature', objectId: feature.id, field: `segments[${segmentIndex}].heightFt` });
      if (segment.thicknessFt === undefined) missing3dData.push({ objectType: 'siteFeature', objectId: feature.id, field: `segments[${segmentIndex}].thicknessFt` });
    });
    return {
      ...feature,
      points: feature.points.map(point => ({
        canvas: { x: point.x, y: point.y },
        world: canvasPointToSceneFeet(point, pixelsPerFoot, point.groundElevationFt || 0),
        groundElevationFt: point.groundElevationFt ?? null,
      })),
    };
  });

  const scenePlants = plan.placedPlants.filter(item => (item.itemType || 'plant') !== 'rock').map(item => {
    const plant = plants.find(candidate => candidate.id === item.plantId);
    requireScale('plant', item.instanceId);
    if (!plant) missing3dData.push({ objectType: 'plant', objectId: item.instanceId, field: 'plantCatalogRecord' });
    const planned = item.plannedPosition || { x: item.x, y: item.y };
    if (item.displayWidthFt === undefined && plant?.matureWidthFt == null) missing3dData.push({ objectType: 'plant', objectId: item.instanceId, field: 'widthFt' });
    if (plant?.matureHeightFt == null) missing3dData.push({ objectType: 'plant', objectId: item.instanceId, field: 'heightFt' });
    return {
      id: item.instanceId,
      plantId: item.plantId,
      commonName: plant?.commonName || null,
      botanicalName: plant?.botanicalName || null,
      layerId: item.layerId,
      order: item.order,
      plannedPosition: {
        canvas: { x: planned.x, y: planned.y },
        world: canvasPointToSceneFeet(planned, pixelsPerFoot),
      },
      observedPosition: item.observedPosition ? {
        canvas: { x: item.observedPosition.x, y: item.observedPosition.y },
        world: canvasPointToSceneFeet(item.observedPosition, pixelsPerFoot, item.observedPosition.groundElevationFt || 0),
        groundElevationFt: item.observedPosition.groundElevationFt ?? null,
      } : null,
      maintainedWidthFt: item.displayWidthFt ?? null,
      matureWidthFt: plant?.matureWidthFt ?? null,
      matureHeightFt: plant?.matureHeightFt ?? null,
      archetype: item.visualArchetype || (plant ? inferPlantArchetype(plant) : null),
      scanAssociationId: item.scanAssociationId || null,
      rotationDeg: item.rotationDeg ?? 0,
    };
  });

  const rocks = plan.placedPlants.filter(item => item.itemType === 'rock').map(item => {
    requireScale('rock', item.instanceId);
    if (item.rockSizeFt === undefined) missing3dData.push({ objectType: 'rock', objectId: item.instanceId, field: 'sizeFt' });
    return {
      id: item.instanceId,
      layerId: item.layerId,
      order: item.order,
      position: {
        canvas: { x: item.x, y: item.y },
        world: canvasPointToSceneFeet({ x: item.x, y: item.y }, pixelsPerFoot),
      },
      sizeFt: item.rockSizeFt ?? null,
      color: item.rockColor || null,
      asset: item.rockSvg || null,
      rotationDeg: item.rotationDeg ?? 0,
    };
  });

  const lights = (plan.siteLights || []).map(light => {
    requireScale('light', light.id);
    return {
      ...light,
      position: {
        canvas: { x: light.position.x, y: light.position.y },
        world: canvasPointToSceneFeet(light.position, pixelsPerFoot, light.position.groundElevationFt || 0),
        groundElevationFt: light.position.groundElevationFt ?? null,
      },
    };
  });

  return {
    scene: {
      version: 1,
      sourcePlanSchemaVersion: plan.schemaVersion,
      sourcePlanId: plan.id,
      units: 'feet',
      northRotationDeg: plan.northRotationDeg || 0,
      coordinateSystem: {
        canvas: { x: 'right', y: 'down', units: 'pixels' },
        world: { x: 'right', y: 'up', z: 'canvas-down', units: 'feet' },
        pixelsPerFoot: pixelsPerFoot ?? null,
      },
      scanAlignment: plan.scanAlignment ? {
        asset: plan.scanAlignment.asset || null,
        transform: plan.scanAlignment.transform,
        controlPoints: plan.scanAlignment.controlPoints,
        registrationErrorFt: plan.scanAlignment.registrationErrorFt ?? null,
      } : null,
      site: {
        name: plan.name,
        canvasWorldSize: plan.canvasWorldSize || null,
      },
      layers: plan.layers || [],
      areas,
      siteFeatures,
      plants: scenePlants,
      rocks,
      lights,
    },
    plantArchetypes: Object.fromEntries(scenePlants.map(item => [item.id, item.archetype])),
    associations: Object.fromEntries(scenePlants.filter(item => item.scanAssociationId).map(item => [item.id, item.scanAssociationId])),
    missing3dData,
  };
}

export function downloadNormalizedScene(input: GardenPlan, plants: Plant[]): void {
  const output = buildNormalizedScene(input, plants);
  const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${input.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-3d-scene-debug.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
