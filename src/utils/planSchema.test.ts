import { describe, expect, it } from 'vitest';
import { normalizeGardenPlan } from './planSchema';
import { canvasPointToSceneFeet } from './sceneCoordinates';

describe('plan schema migration', () => {
  it('upgrades a legacy plan without changing its existing IDs or coordinates', () => {
    const migrated = normalizeGardenPlan({
      id: 'legacy-plan',
      name: 'Legacy yard',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      backgroundImage: null,
      backgroundOpacity: 0.5,
      backgroundLocked: false,
      scalePixelsPerFoot: 20,
      placedPlants: [{
        instanceId: 'plant-007',
        plantId: 7,
        x: 200,
        y: 300,
        zone: '',
        notes: '',
        displayMode: 'symbol',
        customColor: null,
      }],
      zones: [{ id: 'house', name: 'House', color: '#000000', opacity: 1, visible: true, zoneType: 'exclusion', surfaceType: 'structure', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] }],
      notes: '',
    });

    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.placedPlants[0].instanceId).toBe('plant-007');
    expect(migrated.placedPlants[0].plannedPosition).toEqual({ x: 200, y: 300 });
    expect(migrated.zones?.[0].layerId).toBe('structures');
    expect(migrated.siteFeatures).toEqual([]);
    expect(migrated.siteLights).toEqual([]);
    expect(migrated.layers).toHaveLength(7);
  });

  it('migrates legacy segment heights and applies retaining-wall material without inventing height or thickness', () => {
    const migrated = normalizeGardenPlan({
      placedPlants: [],
      siteFeatures: [{
        id: 'wall-1',
        schemaVersion: 1,
        name: 'Wall',
        kind: 'retainingWall',
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        segments: [],
        layerId: '',
        order: 0,
        visible: true,
        notes: '',
      }],
    });

    expect(migrated.siteFeatures?.[0].segments).toHaveLength(1);
    expect(migrated.siteFeatures?.[0].segments[0].heightFt).toBeUndefined();
    expect(migrated.siteFeatures?.[0].segments[0].thicknessFt).toBeUndefined();
    expect(migrated.siteFeatures?.[0].segments[0].material).toBe('Concrete');
  });

  it('uses the taller legacy endpoint and standard fence construction defaults', () => {
    const migrated = normalizeGardenPlan({
      siteFeatures: [{
        id: 'fence-1', schemaVersion: 1, name: 'Fence', kind: 'standardFence',
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        segments: [{ heightStartFt: 4, heightEndFt: 6, thicknessFt: 2, material: 'Old value' }],
        layerId: 'fences', order: 0, visible: true, notes: '',
      }],
    });

    expect(migrated.siteFeatures?.[0].segments[0]).toMatchObject({
      heightFt: 6,
      thicknessFt: 0.5 / 12,
      material: 'Wood picket',
    });
  });
});

describe('scene coordinates', () => {
  it('uses X/Z for the ground plane and Y for elevation', () => {
    expect(canvasPointToSceneFeet({ x: 40, y: 60 }, 20, 3)).toEqual({ x: 2, y: 3, z: 3 });
  });

  it('returns null instead of assuming an uncalibrated scale', () => {
    expect(canvasPointToSceneFeet({ x: 40, y: 60 }, null)).toBeNull();
  });
});
