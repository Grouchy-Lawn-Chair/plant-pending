// Plant types for the Garden Planner app

// Display mode for placed plant circles
export type DisplayMode = 'symbol' | 'symbolLabel' | 'image' | 'color' | 'imageLabel';
export type PlantLabelMode = 'initials' | 'none' | 'numbers' | 'callouts';
export type PlantClumpStrength = 'tight' | 'normal' | 'loose';
export type ZoneSunExposure = 'unknown' | 'fullSun' | 'partSun' | 'partShade' | 'fullShade' | 'partialSun';
export type ZoneWaterNeed = 'noPreference' | 'low' | 'medium' | 'high' | 'unknown';
export type ZoneAfternoonSun = 'unknown' | 'yes' | 'no';
export type ZonePlantingStyle = 'modernClean' | 'naturalistic' | 'privacyScreen' | 'poolSafe' | 'pollinator' | 'groundCover' | 'rockGarden' | 'cornerAnchors' | 'edgePlanting';
export type ZoneLayoutMode = 'fill' | 'edge' | 'cornerAnchors' | 'groundcoverFill';
export type ZonePlantingType = 'mixedBorder' | 'flowerBed' | 'hedgeRow' | 'grassDrift' | 'slopePlanting' | 'poolPlanter' | 'rockGarden';
export type ZonePlantVariety = 'low' | 'medium' | 'high';
export type ZoneType = 'planting' | 'exclusion';
export type ZoneSurfaceType = 'planting' | 'pool' | 'concrete' | 'pavers' | 'gravel' | 'rockMulch' | 'barkMulch' | 'lawn' | 'firePit' | 'furniture' | 'structure' | 'exclusion';

export interface PlantingGroup {
  id: string;
  name: string;
  notes: string;
  plantIds: number[];
}

export interface TestLogEntry {
  id: string;
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

export interface TestSnapshot {
  id: string;
  timestamp: string;
  reason: string;
  imageDataUrl: string;
  width: number;
  height: number;
  details: Record<string, unknown>;
}


// The normalized Plant object used throughout the app
export interface Plant {
  id: number;
  category: string;
  botanicalName: string;
  commonName: string;
  abbreviation: string;
  sourceGardenNumbers: string;
  gardenNames: string[];
  gardenWelcome: boolean;
  gardenShade: boolean;
  gardenPerennial: boolean;
  gardenPopularPlant: boolean;
  gardenNativePlant: boolean;
  gardenWildlifeHabitat: boolean;
  gardenStreetscape: boolean;
  californiaNative: boolean;
  flowers: boolean;
  pollinatorValue: 'High' | 'Medium' | 'Low' | '';
  matureHeightFt: number | null;
  matureWidthFt: number | null;
  fullMatureSize: string;
  minimumSpacingFt: number | null;
  messinessRating: number | null;
  maintenanceEaseRating: number | null;
  waterwiseRating: number | null;
  placementNotes: string;
  estimateConfidence: string;
  sourceUrl: string;
  // Plan symbol fields (optional)
  planSymbolFile: string | null;
  planSymbolType: string | null;
  planSymbolColor: string | null;
  planSymbolAccentColor: string | null;
  // Image fields (optional)
  thumbnailUrl: string | null;
  thumbnailLocalPath: string | null;
  thumbnailSource: string | null;
  thumbnailLicense: string | null;
  thumbnailCredit: string | null;
  thumbnailPageUrl: string | null;
  imageMatchConfidence: string | null;
  // Green Acres catalog match fields (planning aid, not live inventory)
  greenAcresMatch: boolean;
  greenAcresProductName: string | null;
  greenAcresBotanicalName: string | null;
  greenAcresUrl: string | null;
  greenAcresPriceText: string | null;
  greenAcresImageUrl: string | null;
  greenAcresMatchConfidence: string | null;
  greenAcresLastChecked: string | null;
  greenAcresNotes: string | null;
  greenAcresRawTags?: string[];
  greenAcresFilterData?: Record<string, string[]>;
  greenAcresProductHandle?: string | null;
  greenAcresSourceCategories?: string[];
  greenAcresPriceMinCents?: number | null;
  greenAcresPriceMaxCents?: number | null;
  // Green Acres v82/v83 design-score fields, loaded from green_acres_design_scores.json when available.
  greenAcresDesignScores?: {
    poolSafeScore?: number;
    messinessScore?: number;
    evergreenScore?: number;
    waterwiseScore?: number;
    slopeScore?: number;
    privacyScore?: number;
    colorInterestScore?: number;
    petSafeScore?: number;
    layoutReliabilityScore?: number;
  };
  greenAcresBestUses?: string[];
  greenAcresScoreFlags?: string[];
  greenAcresResearch?: {
    roles?: Record<string, {
      score?: number;
      level?: string;
      confidence?: string;
      reasons?: string[];
    }>;
    behaviors?: Record<string, string>;
    sourceTags?: string[];
    sourceMatches?: {
      welGardenNumbers?: number[];
      welGardenNames?: string[];
      arboretumAllStarTerms?: string[];
    };
    notes?: string[];
  };
}


// A drawable planning zone on the canvas. Points are stored in canvas/world pixels.
export interface GardenZone {
  id: string;
  name: string;
  color: string;
  opacity: number;
  visible: boolean;
  zoneType?: ZoneType;
  surfaceType?: ZoneSurfaceType;
  points: { x: number; y: number }[];
  sunExposure?: ZoneSunExposure;
  sunNotes?: string;
  waterNeed?: ZoneWaterNeed;
  afternoonSun?: ZoneAfternoonSun;
  // New multi-select planting style list. plantingStyle is kept for old saved plans.
  plantingStyles?: ZonePlantingStyle[];
  plantingStyle?: ZonePlantingStyle | 'unspecified';
  density?: number;
  plantingSeed?: number;
  layoutMode?: ZoneLayoutMode;
  plantingType?: ZonePlantingType;
  plantVariety?: ZonePlantVariety;
  includeRocks?: boolean;
  edgeRoles?: {
    front?: number[];
    back?: number[];
  };
  plantingGroupId?: string;
  plantingGroupName?: string;
  notes?: string;
}

// A placed plant instance on the canvas
export interface PlacedPlant {
  instanceId: string;
  plantId: number;
  x: number;
  y: number;
  zone: string;
  notes: string;
  // Visual options
  displayMode: DisplayMode;
  customColor: string | null;
  // Optional object type. Missing means plant, to keep old saved plans compatible.
  itemType?: 'plant' | 'rock';
  // Visual rotation in degrees for plan symbols, adds natural variation when placing multiples
  rotationDeg?: number;
  // Optional generated-display width. Used for trimmed hedge rows where mature spread is larger than maintained hedge width.
  displayWidthFt?: number;
  // Rock-only visual fields
  rockSvg?: string;
  rockSizeFt?: number;
  rockColor?: string;
}


export interface ShrubScoreState {
  score: number;
  eventKeys: string[];
  milestones: string[];
}

// Garden plan saved to localStorage
export interface GardenPlan {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  backgroundImage: string | null;
  backgroundOpacity: number;
  backgroundLocked: boolean;
  restoreBackgroundOnLaunch?: boolean;
  scalePixelsPerFoot: number | null;
  placedPlants: PlacedPlant[];
  zones?: GardenZone[];
  plantingGroups?: PlantingGroup[];
  zoneShapesVisible?: boolean;
  notes: string;
  canvasWorldSize?: { width: number; height: number };
  plantCircleOpacity?: number;
  plantLabelMode?: PlantLabelMode;
  plantClumpingEnabled?: boolean;
  plantClumpStrength?: PlantClumpStrength;
  zoom?: number;
  shrubScore?: ShrubScoreState;
}

// Filter state for the plant library

export interface GreenAcresFilterValue {
  label: string;
  value: string;
  count?: number;
  section?: string;
  matchMode?: 'filterData' | 'collectionSlug' | 'priceRange';
}

export interface GreenAcresFilterGroup {
  key: string;
  label: string;
  kind?: 'category' | 'tag' | 'shopping' | 'price';
  values: GreenAcresFilterValue[];
}

export interface GreenAcresFilterIndex {
  generatedAt?: string;
  source?: Record<string, unknown>;
  matching?: Record<string, unknown>;
  groups: GreenAcresFilterGroup[];
}

export interface FilterState {
  search: string;
  category: string;
  // Garden type filters
  gardenWelcome: boolean;
  gardenShade: boolean;
  gardenPerennial: boolean;
  gardenPopularPlant: boolean;
  gardenNativePlant: boolean;
  gardenWildlifeHabitat: boolean;
  gardenStreetscape: boolean;
  // Special filters
  californiaNativeOnly: boolean;
  floweringOnly: boolean;
  goodPollinatorOnly: boolean;
  hideHighMessiness: boolean;
  easyMaintenance: boolean;
  highWaterwise: boolean;
  waterLowOnly: boolean;
  waterMediumOnly: boolean;
  waterHighOnly: boolean;
  hideLargeTrees: boolean;
  lowGrowingOnly: boolean;
  under4FeetTall: boolean;
  under6FeetWide: boolean;
  greenAcresOnly: boolean;
  greenAcresMissingOnly: boolean;
  greenAcresFilters: Record<string, string[]>;
}

// Sort options for the plant library
export type SortOption =
  | 'commonName'
  | 'commonNameDesc'
  | 'botanicalName'
  | 'botanicalNameDesc'
  | 'heightLow'
  | 'heightHigh'
  | 'widthLow'
  | 'widthHigh'
  | 'waterwiseHigh'
  | 'maintenanceHigh'
  | 'messinessLow'
  | 'pollinatorHigh';

// Warning types for placement issues
export interface Warning {
  id: string;
  type: 'overlap' | 'spacing' | 'poolMessiness' | 'poolPollinator' | 'waterwiseMismatch' | 'lowConfidence' | 'missingWidth';
  message: string;
  plantIds: number[];
  severity: 'warning' | 'error' | 'info';
}

// Zone options for labeling plants
export type ZoneLabel =
  | 'Pool Area'
  | 'Slope'
  | 'Streetscape'
  | 'Front Yard'
  | 'Back Yard'
  | 'Shade Area'
  | 'Wildlife Area'
  | 'Other';

// Garden name mapping
export const GARDEN_NUMBER_MAP: Record<string, string> = {
  '1': 'Welcome garden',
  '2': 'Shade garden',
  '3': 'Perennial garden',
  '4': 'Popular Plant garden',
  '5': 'Native Plant garden',
  '6': 'Wildlife Habitat garden',
  '7': 'Streetscape garden',
};

// Category colors for plant circles - expanded for all categories
export const CATEGORY_COLORS: Record<string, string> = {
  'TREES': '#2d5a27',
  'SHRUBS AND PERENNIALS': '#4a7c59',
  'ORNAMENTAL GRASSES AND GRASS-LIKE PLANTS': '#6b8e23',
  'VINES': '#20b2aa',
  'ANNUALS': '#ff8c00',
  'BULBS': '#da70d6',
  'GROUNDCOVER': '#90ee90',
  'PERENNIALS': '#9370db',
  'GRASSES': '#556b2f',
  // Fallback categories
  'TREE': '#2d5a27',
  'SHRUB': '#4a7c59',
  'GRASS': '#6b8e23',
  'VINE': '#20b2aa',
  'ANNUAL': '#ff8c00',
  'BULB': '#da70d6',
};

// Default display mode based on whether plant has a plan symbol or image
export const getDefaultDisplayMode = (_plant: Plant): DisplayMode => {
  return 'symbol';
};

// Default filter state
export const DEFAULT_FILTERS: FilterState = {
  search: '',
  category: '',
  gardenWelcome: false,
  gardenShade: false,
  gardenPerennial: false,
  gardenPopularPlant: false,
  gardenNativePlant: false,
  gardenWildlifeHabitat: false,
  gardenStreetscape: false,
  californiaNativeOnly: false,
  floweringOnly: false,
  goodPollinatorOnly: false,
  hideHighMessiness: false,
  easyMaintenance: false,
  highWaterwise: false,
  waterLowOnly: false,
  waterMediumOnly: false,
  waterHighOnly: false,
  hideLargeTrees: false,
  lowGrowingOnly: false,
  under4FeetTall: false,
  under6FeetWide: false,
  greenAcresOnly: false,
  greenAcresMissingOnly: false,
  greenAcresFilters: {},
};
