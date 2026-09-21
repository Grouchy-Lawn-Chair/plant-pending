import { describe, expect, it } from 'vitest';
import { GardenPlan, Plant } from '../types/plant';
import { buildNormalizedScene } from './sceneExport';

const plant = {
  id: 7,
  commonName: 'Test Tree',
  botanicalName: 'Arbor testii',
  category: 'TREE',
  matureWidthFt: 8,
  matureHeightFt: 14,
  flowers: false,
} as Plant;

function plan(scalePixelsPerFoot: number | null = 10): GardenPlan {
  return {
    id: 'plan-1', name: 'Export fixture', createdAt: '2026-01-01', updatedAt: '2026-01-01',
    backgroundImage: null, backgroundOpacity: 0.5, backgroundLocked: false,
    scalePixelsPerFoot, notes: '',
    zones: [{ id: 'area-1', name: 'Patio', color: '#aaa', opacity: 1, visible: true, surfaceType: 'concrete', points: [{ x: 10, y: 20 }, { x: 30, y: 20 }, { x: 30, y: 40 }], layerId: 'areas', order: 2 }],
    placedPlants: [
      { instanceId: 'plant-1', plantId: 7, x: 50, y: 60, zone: '', notes: '', displayMode: 'symbol', customColor: null, plannedPosition: { x: 50, y: 60 }, observedPosition: { x: 52, y: 61, groundElevationFt: 1.5 }, scanAssociationId: 'scan-tree-9', layerId: 'plants', order: 3 },
      { instanceId: 'rock-1', plantId: 0, x: 70, y: 80, zone: '', notes: '', displayMode: 'symbol', customColor: null, itemType: 'rock', rockSizeFt: 2, layerId: 'plants', order: 4 },
    ],
    siteFeatures: [{ id: 'wall-1', schemaVersion: 1, name: 'Wall', kind: 'retainingWall', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], segments: [{ heightFt: 4, thicknessFt: 0.75, material: 'Concrete' }], layerId: 'retaining-walls', order: 1, visible: true, notes: '' }],
    siteLights: [{ id: 'light-1', schemaVersion: 1, name: 'Downlight', lightType: 'downlight', position: { x: 20, y: 30, groundElevationFt: 1 }, mountingHeightFt: 6, azimuthDeg: 90, tiltDeg: -45, beamAngleDeg: 60, status: 'existing', enabled: true, layerId: 'lights', order: 1, visible: true, notes: '' }],
  };
}

describe('normalized 3D scene export', () => {
  it('preserves IDs, source coordinates, physical fields, and deterministic feet conversion', () => {
    const output = buildNormalizedScene(plan(), [plant]);
    expect(output.scene.units).toBe('feet');
    expect(output.scene.areas[0]).toMatchObject({ id: 'area-1', layerId: 'areas', order: 2 });
    expect(output.scene.areas[0].points[0]).toEqual({ canvas: { x: 10, y: 20 }, world: { x: 1, y: 0, z: 2 } });
    expect(output.scene.siteFeatures[0].segments[0]).toMatchObject({ heightFt: 4, thicknessFt: 0.75, material: 'Concrete' });
    expect(output.scene.plants[0].plannedPosition.world).toEqual({ x: 5, y: 0, z: 6 });
    expect(output.scene.plants[0].observedPosition?.world).toEqual({ x: 5.2, y: 1.5, z: 6.1 });
    expect(output.scene.rocks[0].position.world).toEqual({ x: 7, y: 0, z: 8 });
    expect(output.scene.lights[0]).toMatchObject({ id: 'light-1', mountingHeightFt: 6, azimuthDeg: 90, tiltDeg: -45, beamAngleDeg: 60 });
    expect(output.associations).toEqual({ 'plant-1': 'scan-tree-9' });
    expect(output.missing3dData).toEqual([]);
  });

  it('retains canvas geometry and reports missing scale instead of inventing one', () => {
    const output = buildNormalizedScene(plan(null), [plant]);
    expect(output.scene.areas[0].points[0]).toEqual({ canvas: { x: 10, y: 20 }, world: null });
    expect(output.scene.plants[0].plannedPosition.world).toBeNull();
    expect(output.missing3dData.some(item => item.field === 'scalePixelsPerFoot')).toBe(true);
  });
});
