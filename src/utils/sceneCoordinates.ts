import { PlanPoint } from '../types/plant';

export interface ScenePointFeet {
  x: number;
  y: number;
  z: number;
}

export function hasCalibratedScale(pixelsPerFoot: number | null | undefined): pixelsPerFoot is number {
  return typeof pixelsPerFoot === 'number' && Number.isFinite(pixelsPerFoot) && pixelsPerFoot > 0;
}

export function canvasPointToSceneFeet(
  point: PlanPoint,
  pixelsPerFoot: number | null | undefined,
  elevationFt = 0,
): ScenePointFeet | null {
  if (!hasCalibratedScale(pixelsPerFoot)) return null;
  return {
    x: point.x / pixelsPerFoot,
    y: elevationFt,
    z: point.y / pixelsPerFoot,
  };
}

export function sceneFeetToCanvasPoint(
  point: ScenePointFeet,
  pixelsPerFoot: number | null | undefined,
): PlanPoint | null {
  if (!hasCalibratedScale(pixelsPerFoot)) return null;
  return {
    x: point.x * pixelsPerFoot,
    y: point.z * pixelsPerFoot,
  };
}

export function canvasDistanceToFeet(distancePx: number, pixelsPerFoot: number | null | undefined): number | null {
  if (!hasCalibratedScale(pixelsPerFoot)) return null;
  return distancePx / pixelsPerFoot;
}

export function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}
