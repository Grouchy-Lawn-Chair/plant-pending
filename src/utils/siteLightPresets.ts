import { SiteLightType } from '../types/plant';

export interface SiteLightPreset {
  label: string;
  marker: string;
  color: string;
  tiltDeg: number;
  beamAngleDeg: number;
  previewRangeFt: number;
  omnidirectional?: boolean;
}

export const SITE_LIGHT_PRESETS: Record<SiteLightType, SiteLightPreset> = {
  downlight: { label: 'Downlight', marker: 'D', color: '#facc15', tiltDeg: -55, beamAngleDeg: 60, previewRangeFt: 10 },
  uplight: { label: 'Uplight / well light', marker: 'U', color: '#38bdf8', tiltDeg: 55, beamAngleDeg: 35, previewRangeFt: 8 },
  pathLight: { label: 'Path light', marker: 'P', color: '#a3e635', tiltDeg: -20, beamAngleDeg: 120, previewRangeFt: 6, omnidirectional: true },
  wallLight: { label: 'Wall light', marker: 'W', color: '#fb923c', tiltDeg: -35, beamAngleDeg: 90, previewRangeFt: 12 },
  spotlight: { label: 'Spotlight', marker: 'S', color: '#e879f9', tiltDeg: 25, beamAngleDeg: 20, previewRangeFt: 15 },
  floodlight: { label: 'Floodlight', marker: 'F', color: '#f97316', tiltDeg: -20, beamAngleDeg: 110, previewRangeFt: 20 },
  other: { label: 'Other light', marker: 'L', color: '#facc15', tiltDeg: 0, beamAngleDeg: 60, previewRangeFt: 10 },
};

export function getSiteLightPreset(type: SiteLightType): SiteLightPreset {
  return SITE_LIGHT_PRESETS[type] || SITE_LIGHT_PRESETS.other;
}
