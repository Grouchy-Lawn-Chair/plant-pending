import { describe, expect, it } from 'vitest';
import { beamDirectionsForPattern, getSiteLightPreset, SITE_LIGHT_PRESETS } from './siteLightPresets';

describe('site light presets', () => {
  it('gives uplights, spotlights, and floodlights distinct visual geometry', () => {
    expect(SITE_LIGHT_PRESETS.uplight.label).toBe('Uplight / well light');
    expect(SITE_LIGHT_PRESETS.uplight.beamAngleDeg).not.toBe(SITE_LIGHT_PRESETS.spotlight.beamAngleDeg);
    expect(SITE_LIGHT_PRESETS.spotlight.beamAngleDeg).toBeLessThan(SITE_LIGHT_PRESETS.floodlight.beamAngleDeg);
    expect(SITE_LIGHT_PRESETS.spotlight.previewRangeFt).toBeLessThan(SITE_LIGHT_PRESETS.floodlight.previewRangeFt);
  });

  it('uses omnidirectional footprints for open well lights and path lights', () => {
    expect(getSiteLightPreset('uplight').defaultPattern).toBe('omni360');
    expect(getSiteLightPreset('pathLight').defaultPattern).toBe('omni360');
    expect(getSiteLightPreset('downlight').defaultPattern).toBe('directional');
  });

  it('maps well-light louvers to the expected number of openings', () => {
    expect(beamDirectionsForPattern('louver1')).toEqual([0]);
    expect(beamDirectionsForPattern('louver2')).toEqual([0, 180]);
    expect(beamDirectionsForPattern('louver3')).toEqual([0, 120, 240]);
    expect(beamDirectionsForPattern('louver4')).toEqual([0, 90, 180, 270]);
  });
});
