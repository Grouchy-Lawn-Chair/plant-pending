export type PlacementBand = 'front' | 'middle' | 'back' | 'accent';
export type PlacementPattern = 'edge' | 'drift' | 'clump' | 'row' | 'anchor' | 'scatter';

export interface PlacementRule {
  band: PlacementBand;
  pattern: PlacementPattern;
  frontAttraction: number;
  backAttraction: number;
  centerAttraction: number;
  clumpStrength: number;
  edgeParallelism: number;
  notes: string;
}

/**
 * KISS placement grammar used by every recipe.
 * Strengths are normalized from 0 to 1 and describe intent, not physics constants.
 * The engine converts these values into forces later.
 */
export const placementRules: Record<PlacementBand, PlacementRule> = {
  front: {
    band: 'front',
    pattern: 'edge',
    frontAttraction: 1,
    backAttraction: 0,
    centerAttraction: 0.2,
    clumpStrength: 0.65,
    edgeParallelism: 0.8,
    notes: 'Short plants settle near selected front edges in loose, overlapping ribbons or low clumps.',
  },
  middle: {
    band: 'middle',
    pattern: 'drift',
    frontAttraction: 0.35,
    backAttraction: 0.35,
    centerAttraction: 0.7,
    clumpStrength: 0.8,
    edgeParallelism: 0.2,
    notes: 'Medium plants form the main matrix between front and back, usually in repeated drifts or clumps.',
  },
  back: {
    band: 'back',
    pattern: 'row',
    frontAttraction: 0,
    backAttraction: 1,
    centerAttraction: 0.15,
    clumpStrength: 0.45,
    edgeParallelism: 0.95,
    notes: 'Tall structural plants settle near selected back edges. Hedge species form rows; other tall plants form spaced anchors.',
  },
  accent: {
    band: 'accent',
    pattern: 'anchor',
    frontAttraction: 0.15,
    backAttraction: 0.35,
    centerAttraction: 0.55,
    clumpStrength: 0.25,
    edgeParallelism: 0,
    notes: 'Large or visually dominant plants act as a few anchors, not an even fill. Keep them apart and avoid blocking the front layer.',
  },
};

export interface RecipePlacementOverride {
  pattern?: PlacementPattern;
  frontAttraction?: number;
  backAttraction?: number;
  centerAttraction?: number;
  clumpStrength?: number;
  edgeParallelism?: number;
}

/**
 * Simple interpretation rules derived from the supplied Monrovia plan drawings.
 * These are deliberately small in number so recipe data stays understandable.
 */
export const placementInterpretation = {
  heightBands: {
    frontMaxRelativeHeight: 0.4,
    backMinRelativeHeight: 0.72,
  },
  hedge: {
    pattern: 'row' as const,
    backAttraction: 1,
    edgeParallelism: 1,
    clumpStrength: 0.15,
  },
  groundcover: {
    pattern: 'edge' as const,
    frontAttraction: 1,
    clumpStrength: 0.75,
    edgeParallelism: 0.75,
  },
  massingShrub: {
    pattern: 'clump' as const,
    centerAttraction: 0.65,
    clumpStrength: 0.9,
  },
  specimen: {
    pattern: 'anchor' as const,
    centerAttraction: 0.6,
    clumpStrength: 0.1,
  },
  meadow: {
    pattern: 'drift' as const,
    centerAttraction: 0.6,
    clumpStrength: 0.7,
  },
  containerSpiller: {
    pattern: 'edge' as const,
    frontAttraction: 0.7,
    centerAttraction: 0,
    clumpStrength: 0.5,
  },
};

export const clampPlacementStrength = (value: number): number => Math.max(0, Math.min(1, value));
