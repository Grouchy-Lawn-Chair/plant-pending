import { SiteLightBeamPattern, SiteLightType } from '../types/plant';

export interface SiteLightPreset {
  label: string;
  marker: string;
  color: string;
  tiltDeg: number;
  beamAngleDeg: number;
  previewRangeFt: number;
  defaultPattern: SiteLightBeamPattern;
  defaultWatts?: number;
  rgbwCapable?: boolean;
}

export const SITE_LIGHT_PRESETS: Record<SiteLightType, SiteLightPreset> = {
  downlight: { label: 'Downlight', marker: 'D', color: '#facc15', tiltDeg: -55, beamAngleDeg: 60, previewRangeFt: 10, defaultPattern: 'directional' },
  uplight: { label: 'Uplight / well light', marker: 'U', color: '#38bdf8', tiltDeg: 55, beamAngleDeg: 45, previewRangeFt: 8, defaultPattern: 'omni360' },
  pathLight: { label: 'Path light', marker: 'P', color: '#a3e635', tiltDeg: -20, beamAngleDeg: 120, previewRangeFt: 6, defaultPattern: 'omni360' },
  wallLight: { label: 'Wall light', marker: 'W', color: '#fb923c', tiltDeg: -35, beamAngleDeg: 90, previewRangeFt: 12, defaultPattern: 'directional' },
  spotlight: { label: 'Spotlight', marker: 'S', color: '#e879f9', tiltDeg: 25, beamAngleDeg: 20, previewRangeFt: 15, defaultPattern: 'directional' },
  likeLightUcs2904: { label: 'Like Light UCS2904 RGBW In-ground Spotlight', marker: 'S', color: '#c084fc', tiltDeg: 45, beamAngleDeg: 24, previewRangeFt: 15, defaultPattern: 'directional', defaultWatts: 8, rgbwCapable: true },
  floodlight: { label: 'Floodlight', marker: 'F', color: '#f97316', tiltDeg: -20, beamAngleDeg: 110, previewRangeFt: 20, defaultPattern: 'directional' },
  other: { label: 'Other light', marker: 'L', color: '#facc15', tiltDeg: 0, beamAngleDeg: 60, previewRangeFt: 10, defaultPattern: 'directional' },
};

export function getSiteLightPreset(type: SiteLightType): SiteLightPreset {
  return SITE_LIGHT_PRESETS[type] || SITE_LIGHT_PRESETS.other;
}

export const WELL_LIGHT_PATTERNS: Array<{ value: SiteLightBeamPattern; label: string }> = [
  { value: 'omni360', label: 'Open 360°' },
  { value: 'louver1', label: '1-way louver' },
  { value: 'louver2', label: '2-way opposing louvers' },
  { value: 'louver3', label: '3-way louvers' },
  { value: 'louver4', label: '4-way louvers' },
];

export function beamDirectionsForPattern(pattern: SiteLightBeamPattern): number[] {
  if (pattern === 'louver2') return [0, 180];
  if (pattern === 'louver3') return [0, 120, 240];
  if (pattern === 'louver4') return [0, 90, 180, 270];
  return [0];
}
