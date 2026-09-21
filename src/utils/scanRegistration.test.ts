import { describe, expect, it } from 'vitest';
import { ScanControlPointPair } from '../types/plant';
import { solveTopDownRegistration } from './scanRegistration';

const pair = (id: string, sx: number, sz: number, px: number, pz: number): ScanControlPointPair => ({
  id, label: id, scanPoint: { x: sx, y: 0, z: sz }, planPointFt: { x: px, y: 0, z: pz },
});

describe('solveTopDownRegistration', () => {
  it('requires two distinct point pairs', () => {
    expect(solveTopDownRegistration([])).toBeNull();
    expect(solveTopDownRegistration([pair('a', 0, 0, 2, 3)])).toBeNull();
  });

  it('recovers a no-skew scale, rotation, and translation', () => {
    const result = solveTopDownRegistration([
      pair('a', 0, 0, 10, -4),
      pair('b', 2, 0, 10, -10),
      pair('c', 0, 1, 13, -4),
    ]);
    expect(result).not.toBeNull();
    expect(result!.transform.uniformScale).toBeCloseTo(3, 8);
    expect(result!.transform.rotationDeg.y).toBeCloseTo(90, 8);
    expect(result!.transform.translationFt.x).toBeCloseTo(10, 8);
    expect(result!.transform.translationFt.z).toBeCloseTo(-4, 8);
    expect(result!.rmsErrorFt).toBeCloseTo(0, 8);
  });
});
