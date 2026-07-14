// Warning detection utilities for plant placement

import { Plant, PlacedPlant, Warning } from '../types/plant';
import { generateId } from './storage';

export const OVERLAP_WARNING_RATIO = 0.92;
export const DEFAULT_PIXELS_PER_FOOT = 20;

export interface OverlapMeasurement {
  distancePx: number;
  thresholdPx: number;
  overlapPx: number;
  overlapPercent: number;
  warning: boolean;
}

export function getPlacedPlantRadiusPx(
  placed: PlacedPlant,
  plant: Plant,
  pixelsPerFoot: number | null,
): number {
  const widthFt = placed.displayWidthFt || plant.matureWidthFt || 3;
  const scale = pixelsPerFoot || DEFAULT_PIXELS_PER_FOOT;
  return Math.max(5, (widthFt / 2) * scale);
}

export function measurePlantOverlap(
  a: { x: number; y: number; radiusPx: number },
  b: { x: number; y: number; radiusPx: number },
): OverlapMeasurement {
  const distancePx = Math.hypot(b.x - a.x, b.y - a.y);
  const thresholdPx = a.radiusPx + b.radiusPx;
  const overlapPx = Math.max(0, thresholdPx - distancePx);
  const overlapPercent = thresholdPx > 0 ? (overlapPx / thresholdPx) * 100 : 0;
  return {
    distancePx,
    thresholdPx,
    overlapPx,
    overlapPercent,
    warning: distancePx < thresholdPx * OVERLAP_WARNING_RATIO,
  };
}

function getPlantById(plants: Plant[], id: number): Plant | undefined {
  return plants.find(p => p.id === id);
}

export function generateWarnings(
  placedPlants: PlacedPlant[],
  allPlants: Plant[],
  pixelsPerFoot: number | null
): Warning[] {
  const warnings: Warning[] = [];

  if (placedPlants.length === 0) return warnings;

  for (let i = 0; i < placedPlants.length; i++) {
    const placedA = placedPlants[i];
    const plantA = getPlantById(allPlants, placedA.plantId);
    if (!plantA) continue;
    const radiusA = getPlacedPlantRadiusPx(placedA, plantA, pixelsPerFoot);
    const widthA = placedA.displayWidthFt || plantA.matureWidthFt || 3;

    for (let j = i + 1; j < placedPlants.length; j++) {
      const placedB = placedPlants[j];
      const plantB = getPlantById(allPlants, placedB.plantId);
      if (!plantB) continue;
      const radiusB = getPlacedPlantRadiusPx(placedB, plantB, pixelsPerFoot);
      const widthB = placedB.displayWidthFt || plantB.matureWidthFt || 3;
      const overlap = measurePlantOverlap(
        { x: placedA.x, y: placedA.y, radiusPx: radiusA },
        { x: placedB.x, y: placedB.y, radiusPx: radiusB },
      );

      if (overlap.warning) {
        warnings.push({
          id: generateId(),
          type: 'overlap',
          message: `${plantA.commonName || plantA.botanicalName} overlaps with ${plantB.commonName || plantB.botanicalName}`,
          plantIds: [placedA.plantId, placedB.plantId],
          severity: 'warning',
        });
      }

      if (pixelsPerFoot) {
        const largerSpacing = Math.max(
          plantA.minimumSpacingFt || widthA,
          plantB.minimumSpacingFt || widthB
        );
        const distFeet = overlap.distancePx / pixelsPerFoot;

        if (distFeet < largerSpacing && overlap.overlapPx <= 0) {
          warnings.push({
            id: generateId(),
            type: 'spacing',
            message: `${plantA.commonName || plantA.botanicalName} and ${plantB.commonName || plantB.botanicalName} are closer than the recommended ${largerSpacing.toFixed(1)} ft spacing`,
            plantIds: [placedA.plantId, placedB.plantId],
            severity: 'info',
          });
        }
      }
    }
  }

  const poolPlants = placedPlants.filter(p => p.zone === 'Pool Area');
  for (const placed of poolPlants) {
    const plant = getPlantById(allPlants, placed.plantId);
    if (!plant) continue;

    if (plant.messinessRating !== null && plant.messinessRating >= 7) {
      warnings.push({
        id: generateId(),
        type: 'poolMessiness',
        message: `${plant.commonName || plant.botanicalName} has high messiness rating (${plant.messinessRating}/10) and may drop debris in the pool area`,
        plantIds: [placed.plantId],
        severity: 'warning',
      });
    }

    if (plant.pollinatorValue === 'High') {
      warnings.push({
        id: generateId(),
        type: 'poolPollinator',
        message: `${plant.commonName || plant.botanicalName} has high pollinator value and may attract bees near the pool area`,
        plantIds: [placed.plantId],
        severity: 'info',
      });
    }
  }

  const zoneGroups: Record<string, PlacedPlant[]> = {};
  for (const placed of placedPlants) {
    if (!placed.zone) continue;
    if (!zoneGroups[placed.zone]) zoneGroups[placed.zone] = [];
    zoneGroups[placed.zone].push(placed);
  }

  for (const [zone, plantsInZone] of Object.entries(zoneGroups)) {
    if (plantsInZone.length < 2) continue;

    const waterwiseRatings = plantsInZone
      .map(p => getPlantById(allPlants, p.plantId))
      .filter(Boolean)
      .map(p => p!.waterwiseRating)
      .filter((r): r is number => r !== null);

    if (waterwiseRatings.length >= 2) {
      const maxRating = Math.max(...waterwiseRatings);
      const minRating = Math.min(...waterwiseRatings);
      if (maxRating - minRating > 3) {
        warnings.push({
          id: generateId(),
          type: 'waterwiseMismatch',
          message: `Plants in ${zone} have very different water needs. Waterwise ratings range from ${minRating} to ${maxRating}`,
          plantIds: plantsInZone.map(p => p.plantId),
          severity: 'warning',
        });
      }
    }
  }

  for (const placed of placedPlants) {
    const plant = getPlantById(allPlants, placed.plantId);
    if (!plant) continue;

    if (plant.estimateConfidence && plant.estimateConfidence.toLowerCase().includes('low')) {
      warnings.push({
        id: generateId(),
        type: 'lowConfidence',
        message: `${plant.commonName || plant.botanicalName} has low estimate confidence. Verify final size before planting.`,
        plantIds: [placed.plantId],
        severity: 'info',
      });
    }

    if (plant.matureWidthFt === null) {
      warnings.push({
        id: generateId(),
        type: 'missingWidth',
        message: `${plant.commonName || plant.botanicalName} has missing mature width. Circle size is estimated.`,
        plantIds: [placed.plantId],
        severity: 'info',
      });
    }
  }

  return warnings;
}
