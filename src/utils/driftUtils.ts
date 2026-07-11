import { Plant, PlacedPlant, PlantClumpStrength } from '../types/plant';
import { getPlacedPlantColor, getPlacedPlantSilhouetteUrl } from './imageUtils';

export interface DriftMember {
  instanceId: string;
  plantId: number;
  x: number;
  y: number;
  radius: number;
  color: string;
  silhouetteUrl: string;
}

export interface PlantDriftCluster {
  key: string;
  plantId: number;
  color: string;
  members: DriftMember[];
  bounds: { left: number; top: number; width: number; height: number };
}

function symbolScale(radius: number): number {
  const size = Math.max(radius * 2, 10);
  if (size <= 16) return 0.56;
  if (size <= 24) return 0.62;
  if (size <= 42) return 0.68;
  if (size <= 70) return 0.74;
  return 0.78;
}

function visibleRadius(radius: number): number {
  // Use the clump silhouette footprint, which is a little more generous than the
  // old icon-inset footprint. The previous threshold missed visually touching
  // pairs, especially compact 2 ft plants such as Caladium.
  return Math.max(8, radius * Math.max(0.78, symbolScale(radius)));
}

export function buildPlantDriftClusters(
  placedPlants: PlacedPlant[],
  plants: Plant[],
  getPlantRadius: (plant: Plant) => number,
  options: { enabled?: boolean; strength?: PlantClumpStrength } = {},
): PlantDriftCluster[] {
  if (options.enabled === false) return [];
  const strength = options.strength || 'normal';
  const strengthMultiplier = strength === 'tight' ? 0.9 : strength === 'loose' ? 1.08 : 0.98;
  const plantById = new Map(plants.map((p) => [p.id, p]));
  const membersByPlant = new Map<number, DriftMember[]>();

  const plantPlacementOrder = new Map<number, number>();
  let nextPlacementOrder = 0;
  for (const placed of placedPlants) {
    if (placed.itemType === 'rock') continue;
    if (!plantPlacementOrder.has(placed.plantId)) {
      plantPlacementOrder.set(placed.plantId, nextPlacementOrder);
      nextPlacementOrder += 1;
    }
  }

  for (const placed of placedPlants) {
    if (placed.itemType === 'rock') continue;
    const plant = plantById.get(placed.plantId);
    if (!plant) continue;

    const silhouetteUrl = getPlacedPlantSilhouetteUrl(plant, placed);
    if (!silhouetteUrl) continue;

    const radius = getPlantRadius(plant);
    const placementIndex = plantPlacementOrder.get(placed.plantId) ?? 0;
    const color = getPlacedPlantColor(plant, placed, placementIndex);
    const member: DriftMember = {
      instanceId: placed.instanceId,
      plantId: placed.plantId,
      x: placed.x,
      y: placed.y,
      radius,
      color,
      silhouetteUrl,
    };
    const arr = membersByPlant.get(placed.plantId) || [];
    arr.push(member);
    membersByPlant.set(placed.plantId, arr);
  }

  const clusters: PlantDriftCluster[] = [];
  for (const [plantId, members] of membersByPlant.entries()) {
    if (members.length < 2) continue;
    const visited = new Set<string>();
    for (const start of members) {
      if (visited.has(start.instanceId)) continue;
      const stack = [start];
      const clusterMembers: DriftMember[] = [];
      visited.add(start.instanceId);
      while (stack.length) {
        const current = stack.pop()!;
        clusterMembers.push(current);
        for (const candidate of members) {
          if (visited.has(candidate.instanceId)) continue;
          const dx = current.x - candidate.x;
          const dy = current.y - candidate.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          // Slightly stricter than before so the clump form starts only once the
          // visible plant bodies actually touch.
          const touchDistance = (visibleRadius(current.radius) + visibleRadius(candidate.radius)) * strengthMultiplier;
          if (distance <= touchDistance) {
            visited.add(candidate.instanceId);
            stack.push(candidate);
          }
        }
      }
      if (clusterMembers.length < 2) continue;
      const pad = Math.max(10, Math.max(...clusterMembers.map((m) => visibleRadius(m.radius) + 8)));
      const left = Math.min(...clusterMembers.map((m) => m.x - visibleRadius(m.radius))) - pad;
      const top = Math.min(...clusterMembers.map((m) => m.y - visibleRadius(m.radius))) - pad;
      const right = Math.max(...clusterMembers.map((m) => m.x + visibleRadius(m.radius))) + pad;
      const bottom = Math.max(...clusterMembers.map((m) => m.y + visibleRadius(m.radius))) + pad;
      clusters.push({
        key: `${plantId}-${clusterMembers.map((m) => m.instanceId).sort().join('-')}`,
        plantId,
        color: clusterMembers[0].color,
        members: clusterMembers,
        bounds: { left, top, width: right - left, height: bottom - top },
      });
    }
  }

  return clusters;
}
