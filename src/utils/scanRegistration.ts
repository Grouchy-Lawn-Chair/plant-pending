import { ScanControlPointPair, ScanTransform } from '../types/plant';

export interface ScanRegistrationResult {
  transform: ScanTransform;
  controlPoints: ScanControlPointPair[];
  rmsErrorFt: number;
}

// Fits scan X/Z to plan X/Z with one uniform scale, one Y-axis rotation,
// and translation. Deliberately excludes skew and non-uniform scaling.
export function solveTopDownRegistration(pairs: ScanControlPointPair[]): ScanRegistrationResult | null {
  if (pairs.length < 2) return null;
  const count = pairs.length;
  const scanCenter = pairs.reduce((sum, pair) => ({ x: sum.x + pair.scanPoint.x, z: sum.z + pair.scanPoint.z }), { x: 0, z: 0 });
  const planCenter = pairs.reduce((sum, pair) => ({ x: sum.x + pair.planPointFt.x, z: sum.z + pair.planPointFt.z }), { x: 0, z: 0 });
  scanCenter.x /= count; scanCenter.z /= count;
  planCenter.x /= count; planCenter.z /= count;

  let dot = 0;
  let cross = 0;
  let scanVariance = 0;
  for (const pair of pairs) {
    const sx = pair.scanPoint.x - scanCenter.x;
    const sz = pair.scanPoint.z - scanCenter.z;
    const px = pair.planPointFt.x - planCenter.x;
    const pz = pair.planPointFt.z - planCenter.z;
    dot += sx * px + sz * pz;
    cross += sz * px - sx * pz;
    scanVariance += sx * sx + sz * sz;
  }
  if (scanVariance < 1e-9) return null;

  const angle = Math.atan2(cross, dot);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const uniformScale = Math.hypot(dot, cross) / scanVariance;
  const translationX = planCenter.x - uniformScale * (cosine * scanCenter.x + sine * scanCenter.z);
  const translationZ = planCenter.z - uniformScale * (-sine * scanCenter.x + cosine * scanCenter.z);
  const transformed = pairs.map(pair => {
    const x = translationX + uniformScale * (cosine * pair.scanPoint.x + sine * pair.scanPoint.z);
    const z = translationZ + uniformScale * (-sine * pair.scanPoint.x + cosine * pair.scanPoint.z);
    const residualFt = Math.hypot(x - pair.planPointFt.x, z - pair.planPointFt.z);
    return { ...pair, residualFt };
  });
  const rmsErrorFt = Math.sqrt(transformed.reduce((sum, pair) => sum + (pair.residualFt || 0) ** 2, 0) / count);

  return {
    transform: {
      translationFt: { x: translationX, y: 0, z: translationZ },
      rotationDeg: { x: 0, y: angle * 180 / Math.PI, z: 0 },
      uniformScale,
    },
    controlPoints: transformed,
    rmsErrorFt,
  };
}
