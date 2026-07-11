// Warning detection utilities for plant placement

import { Plant, PlacedPlant, Warning } from '../types/plant';
import { generateId } from './storage';

// Calculate distance between two points
function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

// Check if two circles overlap
function circlesOverlap(
  x1: number, y1: number, r1: number,
  x2: number, y2: number, r2: number
): boolean {
  const dist = distance(x1, y1, x2, y2);
  return dist < (r1 + r2);
}

// Get plant by ID from the plant list
function getPlantById(plants: Plant[], id: number): Plant | undefined {
  return plants.find(p => p.id === id);
}

// Generate all warnings for the current plan
export function generateWarnings(
  placedPlants: PlacedPlant[],
  allPlants: Plant[],
  pixelsPerFoot: number | null
): Warning[] {
  const warnings: Warning[] = [];

  if (placedPlants.length === 0) return warnings;

  // Check each pair of plants for overlap and spacing
  for (let i = 0; i < placedPlants.length; i++) {
    const placedA = placedPlants[i];
    const plantA = getPlantById(allPlants, placedA.plantId);

    if (!plantA) continue;

    // Get plant A's radius in pixels
    const widthA = placedA.displayWidthFt || plantA.matureWidthFt || 3;
    const radiusA = pixelsPerFoot ? (widthA / 2) * pixelsPerFoot : 30;

    // Check against all other plants
    for (let j = i + 1; j < placedPlants.length; j++) {
      const placedB = placedPlants[j];
      const plantB = getPlantById(allPlants, placedB.plantId);

      if (!plantB) continue;

      // Get plant B's radius in pixels
      const widthB = placedB.displayWidthFt || plantB.matureWidthFt || 3;
      const radiusB = pixelsPerFoot ? (widthB / 2) * pixelsPerFoot : 30;

      // Check for overlap
      if (circlesOverlap(placedA.x, placedA.y, radiusA, placedB.x, placedB.y, radiusB)) {
        warnings.push({
          id: generateId(),
          type: 'overlap',
          message: `${plantA.commonName || plantA.botanicalName} overlaps with ${plantB.commonName || plantB.botanicalName}`,
          plantIds: [placedA.plantId, placedB.plantId],
          severity: 'warning',
        });
      }

      // Check minimum spacing if scale is set
      if (pixelsPerFoot) {
        const largerSpacing = Math.max(
          plantA.minimumSpacingFt || widthA,
          plantB.minimumSpacingFt || widthB
        );
        const distPixels = distance(placedA.x, placedA.y, placedB.x, placedB.y);
        const distFeet = distPixels / pixelsPerFoot;

        if (distFeet < largerSpacing && !circlesOverlap(placedA.x, placedA.y, radiusA, placedB.x, placedB.y, radiusB)) {
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

  // Check for pool area issues
  const poolPlants = placedPlants.filter(p => p.zone === 'Pool Area');
  for (const placed of poolPlants) {
    const plant = getPlantById(allPlants, placed.plantId);
    if (!plant) continue;

    // High messiness warning
    if (plant.messinessRating !== null && plant.messinessRating >= 7) {
      warnings.push({
        id: generateId(),
        type: 'poolMessiness',
        message: `${plant.commonName || plant.botanicalName} has high messiness rating (${plant.messinessRating}/10) and may drop debris in the pool area`,
        plantIds: [placed.plantId],
        severity: 'warning',
      });
    }

    // High pollinator warning
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

  // Check for waterwise mixing in same zone
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

  // Check for low confidence estimates
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
