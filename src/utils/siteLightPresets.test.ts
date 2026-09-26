import { describe, expect, it } from 'vitest';
import { getSiteLightPreset, SITE_LIGHT_PRESETS } from './siteLightPresets';

describe('site light presets', () => {
  it('gives uplights, spotlights, and floodlights distinct visual geometry', () => {
    expect(SITE_LIGHT_PRESETS.uplight.label).toBe('Uplight / well light');
    expect(SITE_LIGHT_PRESETS.uplight.beamAngleDeg).not.toBe(SITE_LIGHT_PRESETS.spotlight.beamAngleDeg);
    expect(SITE_LIGHT_PRESETS.spotlight.beamAngleDeg).toBeLessThan(SITE_LIGHT_PRESETS.floodlight.beamAngleDeg);
    expect(SITE_LIGHT_PRESETS.spotlight.previewRangeFt).toBeLessThan(SITE_LIGHT_PRESETS.floodlight.previewRangeFt);
  });

  it('uses an omnidirectional footprint only for path lights', () => {
    expect(getSiteLightPreset('pathLight').omnidirectional).toBe(true);
    expect(getSiteLightPreset('downlight').omnidirectional).not.toBe(true);
  });
});
