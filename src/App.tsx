// Garden Planner App - Main Application Component
// This is the entry point for the entire app

import { useState, useEffect, useCallback, useRef, useMemo, type ChangeEvent } from 'react';
import { Plant, PlacedPlant, FilterState, SortOption, GardenPlan, PlantLabelMode, PlantClumpStrength, DisplayMode, GardenZone, PlantingGroup, ZoneLayoutMode, ZonePlantVariety, TestLogEntry, TestSnapshot, ShrubScoreState, GreenAcresFilterIndex } from './types/plant';
import { loadPlantsFromCSV } from './utils/csvParser';
import { generateWarnings } from './utils/warnings';
import { filterPlants, sortPlants, getCategories } from './utils/filtering';
import {
  generateId,
  loadSavedPlans,
  savePlan,
  deletePlan,
  saveCurrentPlan,
  loadCurrentPlan,
  clearCurrentPlan,
  exportPlanAsJSON,
  importPlanFromJSON,
} from './utils/storage';
import { PlantCard } from './components/PlantCard';
import { FilterPanel } from './components/FilterPanel';
import { GardenCanvas } from './components/GardenCanvas';
import { PlanDetails } from './components/PlanDetails';
import { PrintView } from './components/PrintView';
import { WelcomeGuide } from './components/WelcomeGuide';
import { HelpCenter } from './components/HelpCenter';
import { DEFAULT_FILTERS } from './types/plant';



const WELCOME_SETTING_KEY = 'plant-pending-show-welcome-guide';

const SCORE_TITLES = [
  { score: 10000, title: 'Supreme Yard Authority' },
  { score: 7500, title: 'Botanical Bureaucrat' },
  { score: 5000, title: 'Senior Shrub Strategist' },
  { score: 3500, title: 'Hedge Adjacent' },
  { score: 2000, title: 'Accidental Designer' },
  { score: 1000, title: 'Certified Plant Mover' },
  { score: 500, title: 'Shrub Apprentice' },
  { score: 250, title: 'Weekend Landscaper' },
  { score: 100, title: 'Plant Curious' },
  { score: 0, title: 'Dirt Owner' },
];

function getScoreTitle(score: number): string {
  return SCORE_TITLES.find(item => score >= item.score)?.title || 'Dirt Owner';
}

function pickMessage(messages: string[], key: string): string {
  if (messages.length === 0) return 'Points have occurred.';
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return messages[hash % messages.length];
}

const IDLE_MESSAGES = [
  'Probably needs a shrub.',
  'Your garden remains pending.',
  'The yard is waiting.',
  'Ready when the dirt is.',
  'Everything is currently where you left it.',
  'The rocks are doing great.',
  'No immediate botanical emergencies detected.',
  'Your plants remain safely theoretical.',
  'The yard has not gotten any larger.',
  'Select something and make a decision.',
];

const PLANT_MESSAGES = [
  'A plant has entered the situation.',
  'That lives there now.',
  'Plant placed. Confidence pending.',
  'The empty space has been defeated.',
  'A decision has technically been made.',
  'The dirt has a new responsibility.',
  'That seems reasonable from this distance.',
  'It looked smaller in the plant list.',
  'The yard has been informed.',
  'Good enough for a first draft.',
];

const SHRUB_MESSAGES = [
  'There it is. The shrub.',
  'It probably needed that shrub.',
  'Shrub acquired.',
  'Finally, some structure.',
  'Strong shrub energy.',
  'The yard feels more supervised now.',
];

const ROCK_MESSAGES = [
  'The rock is already thriving.',
  'Mature size achieved.',
  'Zero irrigation required.',
  'The rock asks for nothing.',
  'Good rock.',
  'A very stable design decision.',
];

const FILTER_MESSAGES = [
  'Fewer plants. Better odds.',
  'The botanical wall has been narrowed.',
  'Your standards have consequences.',
  'The plants are being judged.',
  'Fewer choices, same uncertainty.',
];

const SAVE_MESSAGES = [
  'Saved. The plants remain theoretical.',
  'Your decisions are secure.',
  'The rocks will remain exactly where they are.',
  'Everything is remembered.',
];


type Point = { x: number; y: number };

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 1) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function polygonArea(points: Point[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
  }
  return Math.abs(area / 2);
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
  const projected = { x: a.x + t * dx, y: a.y + t * dy };
  return Math.hypot(point.x - projected.x, point.y - projected.y);
}

function distanceToPolygonEdge(point: Point, polygon: Point[]): number {
  if (polygon.length < 2) return Infinity;
  let min = Infinity;
  for (let i = 0; i < polygon.length; i += 1) {
    min = Math.min(min, distanceToSegment(point, polygon[i], polygon[(i + 1) % polygon.length]));
  }
  return min;
}

function polygonBounds(points: Point[]) {
  return {
    minX: Math.min(...points.map(point => point.x)),
    maxX: Math.max(...points.map(point => point.x)),
    minY: Math.min(...points.map(point => point.y)),
    maxY: Math.max(...points.map(point => point.y)),
  };
}

function polygonCentroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  return points.reduce((acc, point) => ({ x: acc.x + point.x / points.length, y: acc.y + point.y / points.length }), { x: 0, y: 0 });
}

function edgeLength(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function pointAlongEdge(a: Point, b: Point, distance: number): Point {
  const length = edgeLength(a, b) || 1;
  const t = Math.max(0, Math.min(1, distance / length));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function polygonPerimeter(points: Point[]): number {
  if (points.length < 2) return 0;
  return points.reduce((sum, point, index) => sum + edgeLength(point, points[(index + 1) % points.length]), 0);
}

function plantSearchText(plant: Plant): string {
  return `${plant.category || ''} ${plant.commonName || ''} ${plant.botanicalName || ''} ${plant.greenAcresProductName || ''}`.toLowerCase();
}

function zoneSearchText(zone: GardenZone): string {
  return `${zone.name || ''} ${zone.notes || ''} ${zone.plantingType || ''} ${(zone.plantingStyles || []).join(' ')}`.toLowerCase();
}

function getPlantScore(plant: Plant, key: keyof NonNullable<Plant['greenAcresDesignScores']>, fallback = 0): number {
  const value = plant.greenAcresDesignScores?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}


function getResearchRoleScore(plant: Plant, role: string, fallback = 0): number {
  const value = plant.greenAcresResearch?.roles?.[role]?.score;
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getResearchBehavior(plant: Plant, key: string): string {
  return plant.greenAcresResearch?.behaviors?.[key] || '';
}

function hasResearchSourceTag(plant: Plant, tag: string): boolean {
  return (plant.greenAcresResearch?.sourceTags || []).includes(tag);
}

function hasWelGarden(plant: Plant, gardenNumber: number): boolean {
  return (plant.greenAcresResearch?.sourceMatches?.welGardenNumbers || []).includes(gardenNumber);
}

function getPlantHeightRole(plant: Plant): 'low' | 'medium' | 'tall' {
  const height = plant.matureHeightFt || 0;
  if (height <= 1.5) return 'low';
  if (height >= 4) return 'tall';
  return 'medium';
}


function isGrassLikePlant(plant: Plant): boolean {
  const text = plantSearchText(plant);
  return text.includes('grass') || text.includes('sedge') || text.includes('lomandra') || text.includes('rush');
}

function isGroundcoverLikePlant(plant: Plant): boolean {
  const text = plantSearchText(plant);
  const height = plant.matureHeightFt || 0;
  const width = plant.matureWidthFt || plant.minimumSpacingFt || 0;
  return text.includes('ground') || text.includes('carpet') || text.includes('creeping') || text.includes('trailing') || text.includes('stonecrop') || text.includes('sedum') || (height <= 1.2 && width >= 1.2);
}

function isArchitecturalPlant(plant: Plant): boolean {
  const text = plantSearchText(plant);
  const flags = new Set(plant.greenAcresScoreFlags || []);
  return flags.has('architectural') || text.includes('agave') || text.includes('aloe') || text.includes('yucca') || text.includes('mangave');
}

function isToxicOrCautionPlant(plant: Plant): boolean {
  const text = plantSearchText(plant);
  const flags = new Set(plant.greenAcresScoreFlags || []);
  return (
    flags.has('thorn_spine_caution') ||
    text.includes('oleander') ||
    text.includes('euphorbia') ||
    text.includes('foxglove') ||
    text.includes('datura') ||
    text.includes('castor bean') ||
    text.includes('lily of the valley') ||
    text.includes('heavenly bamboo') ||
    text.includes('nandina')
  );
}

function hasFloweringSignal(plant: Plant): boolean {
  const text = plantSearchText(plant);
  const flags = new Set(plant.greenAcresScoreFlags || []);
  const floweringName = [
    'flower', 'lavender', 'salvia', 'sage', 'yarrow', 'verbena', 'lantana', 'dianthus',
    'penstemon', 'gaura', 'nepeta', 'catmint', 'kangaroo paw', 'coneflower', 'echinacea',
    'coreopsis', 'daylily', 'iris', 'geranium', 'calibrachoa', 'petunia', 'angelonia',
    'alyssum', 'cosmos', 'zinnia', 'marigold', 'aster', 'daisy', 'rose', 'society garlic',
    'dipladenia', 'bougainvillea', 'gazania', 'african daisy', 'sea thrift', 'armeria'
  ].some(term => text.includes(term));
  return plant.flowers || plant.pollinatorValue === 'High' || plant.pollinatorValue === 'Medium' || flags.has('flowering_or_showy') || floweringName;
}

function isSucculentLikePlant(plant: Plant): boolean {
  const text = plantSearchText(plant);
  const category = (plant.category || '').toLowerCase();
  return category.includes('succulent') || [
    'succulent', 'agave', 'aloe', 'yucca', 'mangave', 'crassula', 'echeveria', 'haworthia',
    'sempervivum', 'senecio', 'stonecrop', 'sedum', 'grapto', 'cactus', 'kalanchoe', 'panda plant'
  ].some(term => text.includes(term));
}


type ProCommunityRole =
  | 'matrixGroundcoverOrSpreadingShrub'
  | 'deepRootedGrassOrSedge'
  | 'lowShrubOrNativeShrub'
  | 'seasonalFlowerAccent'
  | 'succulentOrRockAccent'
  | 'cleanEvergreenShrub'
  | 'grassOrStrappyFoliage'
  | 'colorFoliage'
  | 'architecturalAccent'
  | 'lowFlowerAccent'
  | 'flowerLowFront'
  | 'flowerMiddleMass'
  | 'flowerTallBack'
  | 'flowerFoliageSupport'
  | 'hedgeMain'
  | 'hedgeAccent'
  | 'grassMatrixClump'
  | 'grassAccentClump'
  | 'rockGroundcoverMat'
  | 'rockArchitecturalAccent'
  | 'rockColorAccent'
  | 'rockBoulderAnchor'
  | 'general';

const SLOPE_ROLE_TARGETS: Partial<Record<ProCommunityRole, number>> = {
  matrixGroundcoverOrSpreadingShrub: 0.35,
  deepRootedGrassOrSedge: 0.25,
  lowShrubOrNativeShrub: 0.25,
  seasonalFlowerAccent: 0.10,
  succulentOrRockAccent: 0.05,
  cleanEvergreenShrub: 0,
  grassOrStrappyFoliage: 0,
  colorFoliage: 0,
  architecturalAccent: 0,
  lowFlowerAccent: 0,
  general: 0,
};

const POOL_ROLE_TARGETS: Partial<Record<ProCommunityRole, number>> = {
  cleanEvergreenShrub: 0.30,
  grassOrStrappyFoliage: 0.30,
  colorFoliage: 0.20,
  architecturalAccent: 0.15,
  lowFlowerAccent: 0.05,
  matrixGroundcoverOrSpreadingShrub: 0,
  deepRootedGrassOrSedge: 0,
  lowShrubOrNativeShrub: 0,
  seasonalFlowerAccent: 0,
  succulentOrRockAccent: 0,
  general: 0,
};

const FLOWER_BED_ROLE_TARGETS: Partial<Record<ProCommunityRole, number>> = {
  flowerLowFront: 0.30,
  flowerMiddleMass: 0.45,
  flowerTallBack: 0.15,
  flowerFoliageSupport: 0.10,
};

const GRASS_DRIFT_ROLE_TARGETS: Partial<Record<ProCommunityRole, number>> = {
  grassMatrixClump: 0.82,
  grassAccentClump: 0.18,
};

const ROCK_GARDEN_ROLE_TARGETS: Partial<Record<ProCommunityRole, number>> = {
  rockBoulderAnchor: 0.25,
  rockGroundcoverMat: 0.35,
  rockArchitecturalAccent: 0.25,
  rockColorAccent: 0.15,
};

const HEDGE_ROLE_TARGETS: Partial<Record<ProCommunityRole, number>> = {
  hedgeMain: 0.92,
  hedgeAccent: 0.08,
};




type PlantVarietySettings = {
  paletteScale: number;
  targetScale: number;
  driftScale: number;
};

const PLANT_VARIETY_SETTINGS: Record<ZonePlantVariety, PlantVarietySettings> = {
  low: { paletteScale: 0.55, targetScale: 0.88, driftScale: 0.85 },
  medium: { paletteScale: 1, targetScale: 1, driftScale: 1 },
  high: { paletteScale: 1.55, targetScale: 1.22, driftScale: 1.15 },
};

function getZonePlantVariety(zone: GardenZone): ZonePlantVariety {
  return zone.plantVariety || 'medium';
}

function getPlantVarietySettings(zone: GardenZone): PlantVarietySettings {
  return PLANT_VARIETY_SETTINGS[getZonePlantVariety(zone)] || PLANT_VARIETY_SETTINGS.medium;
}

function getDensityVisualMultiplier(density: number): number {
  if (density >= 98) return 2.15;
  if (density >= 95) return 1.95;
  if (density >= 85) return 1.62;
  if (density >= 70) return 1.34;
  if (density >= 50) return 1.14;
  return 1;
}

type PlantingRecipe = {
  paletteSize: number;
  minPlants: number;
  maxPlants: number;
  averagePlantsPerDrift: number;
  minDrifts: number;
  maxDrifts: number;
  rockMin?: number;
  rockMax?: number;
};

const PLANTING_RECIPES: Record<string, PlantingRecipe> = {
  poolPlanter: { paletteSize: 7, minPlants: 6, maxPlants: 42, averagePlantsPerDrift: 4, minDrifts: 4, maxDrifts: 14 },
  slopePlanting: { paletteSize: 8, minPlants: 9, maxPlants: 56, averagePlantsPerDrift: 5, minDrifts: 5, maxDrifts: 18 },
  flowerBed: { paletteSize: 9, minPlants: 12, maxPlants: 96, averagePlantsPerDrift: 6, minDrifts: 4, maxDrifts: 20 },
  grassDrift: { paletteSize: 3, minPlants: 8, maxPlants: 84, averagePlantsPerDrift: 5, minDrifts: 5, maxDrifts: 24 },
  hedgeRow: { paletteSize: 1, minPlants: 1, maxPlants: 48, averagePlantsPerDrift: 1, minDrifts: 1, maxDrifts: 1 },
  rockGarden: { paletteSize: 5, minPlants: 5, maxPlants: 32, averagePlantsPerDrift: 3, minDrifts: 3, maxDrifts: 10, rockMin: 2, rockMax: 5 },
};

function getPlantingRecipe(plantingType?: string): PlantingRecipe | undefined {
  return plantingType ? PLANTING_RECIPES[plantingType] : undefined;
}

function clampByRecipe(baseTargetCount: number, zone: GardenZone, usableZoneAreaPx: number, pixelsPerFoot: number): number {
  const recipe = getPlantingRecipe(zone.plantingType);
  if (!recipe) return baseTargetCount;
  if (zone.plantingType === 'hedgeRow') return baseTargetCount;
  const variety = getPlantVarietySettings(zone);
  const areaSqFt = usableZoneAreaPx / Math.max(1, pixelsPerFoot * pixelsPerFoot);
  // Large zones can use extra plants, especially at high density. Variety also nudges the total count.
  const sizeBonus = Math.max(0, Math.min(32, Math.floor((areaSqFt - 120) / 38)));
  const densityBonus = (zone.density || 50) >= 95 ? 1.45 : (zone.density || 50) >= 85 ? 1.22 : 1;
  const recipeMax = Math.round((recipe.maxPlants + (zone.plantingType === 'flowerBed' ? sizeBonus * 2 : sizeBonus)) * densityBonus);
  const maxPlants = Math.max(recipe.minPlants, Math.round(recipeMax * variety.targetScale));
  const minPlants = Math.min(Math.max(1, Math.round(recipe.minPlants * Math.min(1.15, variety.targetScale))), maxPlants);
  return Math.max(minPlants, Math.min(maxPlants, baseTargetCount));
}

function getRoleTargetsForType(plantingType?: string): Partial<Record<ProCommunityRole, number>> {
  if (plantingType === 'poolPlanter') return POOL_ROLE_TARGETS;
  if (plantingType === 'slopePlanting') return SLOPE_ROLE_TARGETS;
  if (plantingType === 'flowerBed') return FLOWER_BED_ROLE_TARGETS;
  if (plantingType === 'grassDrift') return GRASS_DRIFT_ROLE_TARGETS;
  if (plantingType === 'rockGarden') return ROCK_GARDEN_ROLE_TARGETS;
  if (plantingType === 'hedgeRow') return HEDGE_ROLE_TARGETS;
  return {};
}

function hasCommunityTargets(plantingType?: string): boolean {
  return Object.keys(getRoleTargetsForType(plantingType)).length > 0;
}

function isNativeOrLocalSignal(plant: Plant): boolean {
  const flags = new Set(plant.greenAcresScoreFlags || []);
  return plant.californiaNative || flags.has('california_native') || hasWelGarden(plant, 5) || hasWelGarden(plant, 6) || hasResearchSourceTag(plant, 'wel') || hasResearchSourceTag(plant, 'arboretum_all_star');
}

function isCleanEvergreenShrubPlant(plant: Plant): boolean {
  const text = plantSearchText(plant);
  const category = (plant.category || '').toUpperCase();
  const evergreenPresence = getResearchBehavior(plant, 'evergreenPresence');
  const height = plant.matureHeightFt || 0;
  const width = plant.matureWidthFt || plant.minimumSpacingFt || 0;
  if (!category.includes('SHRUB') && !category.includes('TROPICAL')) return false;
  if (height > 7 || width > 8) return false;
  if (isToxicOrCautionPlant(plant) || isSucculentLikePlant(plant)) return false;
  if (evergreenPresence === 'high' || getPlantScore(plant, 'evergreenScore', 0) >= 6) return true;
  return ['pittosporum', 'westringia', 'euonymus', 'teucrium', 'germander', 'myrtle', 'olive', 'coprosma', 'abelia', 'boxwood', 'buxus', 'hebe', 'dodonaea', 'distylium'].some(term => text.includes(term));
}

function getPoolCommunityRole(plant: Plant): ProCommunityRole {
  if (isSucculentLikePlant(plant) || isArchitecturalPlant(plant)) return 'architecturalAccent';
  if (isGrassLikePlant(plant) || ['lomandra', 'phormium', 'dianella', 'flax', 'rush', 'juncus', 'carex', 'sedge', 'astelia'].some(term => plantSearchText(plant).includes(term))) return 'grassOrStrappyFoliage';
  if (hasColorFoliageSignal(plant)) return 'colorFoliage';
  if (isCleanEvergreenShrubPlant(plant) || isCleanPoolFoliagePlant(plant)) return 'cleanEvergreenShrub';
  if (hasFloweringSignal(plant)) return 'lowFlowerAccent';
  return 'general';
}

function getSlopeCommunityRole(plant: Plant): ProCommunityRole {
  if (isSucculentLikePlant(plant)) return 'succulentOrRockAccent';
  if (isGrassLikePlant(plant)) return 'deepRootedGrassOrSedge';
  if (isGroundcoverLikePlant(plant) || plantSearchText(plant).includes('prostrate') || plantSearchText(plant).includes('carpet')) return 'matrixGroundcoverOrSpreadingShrub';
  if (isSlopeShrubPlant(plant) || isNativeOrLocalSignal(plant)) return 'lowShrubOrNativeShrub';
  if (hasFloweringSignal(plant)) return 'seasonalFlowerAccent';
  return 'general';
}

function getFlowerBedCommunityRole(plant: Plant): ProCommunityRole {
  if (!isFlowerBedCandidate(plant) && isFlowerBedSupportPlant(plant)) return 'flowerFoliageSupport';
  const heightRole = getPlantHeightRole(plant);
  if (heightRole === 'low') return 'flowerLowFront';
  if (heightRole === 'tall') return 'flowerTallBack';
  return 'flowerMiddleMass';
}

function getGrassDriftCommunityRole(plant: Plant): ProCommunityRole {
  const text = plantSearchText(plant);
  const height = plant.matureHeightFt || 0;
  if (hasColorFoliageSignal(plant) || text.includes('red') || text.includes('blue') || text.includes('gold') || text.includes('bronze') || height >= 3.5) return 'grassAccentClump';
  return 'grassMatrixClump';
}

function getRockGardenCommunityRole(plant: Plant): ProCommunityRole {
  if (isGroundcoverLikePlant(plant) && !isArchitecturalPlant(plant)) return 'rockGroundcoverMat';
  if (isArchitecturalPlant(plant) || isSucculentLikePlant(plant)) return 'rockArchitecturalAccent';
  if (hasColorFoliageSignal(plant) || hasFloweringSignal(plant) || isGrassLikePlant(plant)) return 'rockColorAccent';
  return 'rockGroundcoverMat';
}

function getHedgeCommunityRole(plant: Plant): ProCommunityRole {
  return isHedgeCandidate(plant) ? 'hedgeMain' : 'hedgeAccent';
}

function getCommunityRole(plant: Plant, plantingType?: string): ProCommunityRole {
  if (plantingType === 'poolPlanter') return getPoolCommunityRole(plant);
  if (plantingType === 'slopePlanting') return getSlopeCommunityRole(plant);
  if (plantingType === 'flowerBed') return getFlowerBedCommunityRole(plant);
  if (plantingType === 'grassDrift') return getGrassDriftCommunityRole(plant);
  if (plantingType === 'rockGarden') return getRockGardenCommunityRole(plant);
  if (plantingType === 'hedgeRow') return getHedgeCommunityRole(plant);
  return 'general';
}

function getRoleTarget(plantingType: string | undefined, role: ProCommunityRole): number {
  return getRoleTargetsForType(plantingType)[role] || 0;
}

function countGeneratedRoles(generated: PlacedPlant[], plants: Plant[], plantingType?: string) {
  const counts: Record<string, number> = {};
  generated.forEach(item => {
    if (item.itemType === 'rock') {
      counts.rockBoulderAnchor = (counts.rockBoulderAnchor || 0) + 1;
      return;
    }
    const plant = plants.find(candidate => candidate.id === item.plantId);
    const role = plant ? getCommunityRole(plant, plantingType) : 'general';
    counts[role] = (counts[role] || 0) + 1;
  });
  return counts;
}

function pickCommunityPlantForCount(items: Plant[], plantingType: string | undefined, generated: PlacedPlant[], plants: Plant[], random: () => number, scorer: (plant: Plant) => number) {
  if (!hasCommunityTargets(plantingType)) return weightedSeededChoice(items, random, scorer);
  const counts = countGeneratedRoles(generated, plants, plantingType);
  const total = Math.max(1, generated.length);
  const weighted = [...items].sort((a, b) => {
    const roleA = getCommunityRole(a, plantingType);
    const roleB = getCommunityRole(b, plantingType);
    const deficitA = Math.max(-0.35, (getRoleTarget(plantingType, roleA) || 0.02) - ((counts[roleA] || 0) / total));
    const deficitB = Math.max(-0.35, (getRoleTarget(plantingType, roleB) || 0.02) - ((counts[roleB] || 0) / total));
    return (scorer(b) + deficitB * 90) - (scorer(a) + deficitA * 90);
  });
  const top = weighted.slice(0, Math.max(1, Math.min(7, weighted.length)));
  return weightedSeededChoice(top, random, plant => scorer(plant) + Math.max(0, getRoleTarget(plantingType, getCommunityRole(plant, plantingType))) * 50);
}

function isFlowerBedCandidate(plant: Plant): boolean {
  const text = plantSearchText(plant);
  const category = (plant.category || '').toUpperCase();
  const height = plant.matureHeightFt || 0;
  const width = plant.matureWidthFt || plant.minimumSpacingFt || 0;
  const trueFlowerCategory = category.includes('PERENNIAL') || category.includes('ANNUAL') || category.includes('ROSES');
  const compactFloweringShrub = category.includes('SHRUB') && height <= 3.5 && width <= 4 && [
    'abelia', 'daphne', 'lavender', 'lantana', 'westringia', 'breath of heaven'
  ].some(term => text.includes(term));
  if (!hasFloweringSignal(plant)) return false;
  if (!trueFlowerCategory && !compactFloweringShrub) return false;
  if (isSucculentLikePlant(plant) || isArchitecturalPlant(plant)) return false;
  if (isGrassLikePlant(plant)) return false;
  if (isToxicOrCautionPlant(plant)) return false;
  if (text.includes('rockrose') || text.includes('cistus') || text.includes('ceanothus') || text.includes('grevillea')) return false;
  if (height > 6 || width > 5.5) return false;
  return true;
}

function isFlowerBedSupportPlant(plant: Plant): boolean {
  const text = plantSearchText(plant);
  const height = plant.matureHeightFt || 0;
  const width = plant.matureWidthFt || plant.minimumSpacingFt || 0;
  if (isFlowerBedCandidate(plant)) return true;
  if (!hasFloweringSignal(plant)) return false;
  if (isSucculentLikePlant(plant) || isArchitecturalPlant(plant) || isGrassLikePlant(plant) || isToxicOrCautionPlant(plant)) return false;
  // Support plants are small accent shrubs or soft foliage. They should not dominate a flower bed.
  if (text.includes('rockrose') || text.includes('cistus') || text.includes('oleander')) return false;
  return height <= 3.5 && width <= 4;
}

function hasColorFoliageSignal(plant: Plant): boolean {
  const text = plantSearchText(plant);
  const flags = new Set(plant.greenAcresScoreFlags || []);
  return (
    getPlantScore(plant, 'colorInterestScore', 0) >= 6 ||
    flags.has('color_interest') ||
    [
      'variegated', 'gold', 'golden', 'silver', 'blue', 'red', 'purple', 'bronze', 'black',
      'lime', 'platinum', 'kaleidoscope', 'merlot', 'burgundy', 'orange', 'copper'
    ].some(term => text.includes(term))
  );
}

function isCleanPoolFoliagePlant(plant: Plant): boolean {
  const text = plantSearchText(plant);
  const category = (plant.category || '').toUpperCase();
  const flags = new Set(plant.greenAcresScoreFlags || []);
  const height = plant.matureHeightFt || 0;
  const width = plant.matureWidthFt || plant.minimumSpacingFt || 0;
  const messiness = getPlantScore(plant, 'messinessScore', plant.messinessRating || 5);
  const researchedPoolScore = getResearchRoleScore(plant, 'poolPlanter', 0);
  const messinessBehavior = getResearchBehavior(plant, 'messiness');
  if (isToxicOrCautionPlant(plant)) return false;
  if (messiness > 6.8 || messinessBehavior === 'high') return false;
  if (flags.has('attracts_bees') && researchedPoolScore < 70) return false;
  if (height > 7 || width > 8) return false;
  if (text.includes('rose') || text.includes('oleander')) return false;

  const cleanFoliageName = [
    'abelia', 'pittosporum', 'westringia', 'euonymus', 'myrtle', 'coprosma', 'flax',
    'phormium', 'dianella', 'lomandra', 'sedge', 'grass', 'rush', 'carex', 'mondo',
    'cordyline', 'astelia', 'dodonaea', 'hebe', 'buxus', 'boxwood', 'olive', 'podocarpus',
    'distylium', 'leucadendron', 'leucospermum', 'teucrium', 'germander', 'santolina'
  ].some(term => text.includes(term));

  const usefulCategory = category.includes('SHRUB') || category.includes('PERENNIAL') || category.includes('GRASS');
  return usefulCategory && (researchedPoolScore >= 60 || cleanFoliageName || isGrassLikePlant(plant) || hasColorFoliageSignal(plant));
}

function isPoolPlanterCandidate(plant: Plant): boolean {
  const text = plantSearchText(plant);
  const flags = new Set(plant.greenAcresScoreFlags || []);
  const height = plant.matureHeightFt || 0;
  const width = plant.matureWidthFt || plant.minimumSpacingFt || 0;
  const messiness = getPlantScore(plant, 'messinessScore', plant.messinessRating || 5);
  const researchedPoolScore = getResearchRoleScore(plant, 'poolPlanter', 0);
  const messinessBehavior = getResearchBehavior(plant, 'messiness');
  if (isToxicOrCautionPlant(plant)) return false;
  if (messiness > 6.8 || messinessBehavior === 'high') return false;
  if ((flags.has('attracts_bees') || text.includes('lavender') || text.includes('rose')) && researchedPoolScore < 70) return false;
  if (height > 7 || width > 8) return false;
  return researchedPoolScore >= 50 || isCleanPoolFoliagePlant(plant) || isGrassLikePlant(plant) || isArchitecturalPlant(plant);
}

function isGrassDriftCandidate(plant: Plant): boolean {
  const height = plant.matureHeightFt || 0;
  const width = plant.matureWidthFt || plant.minimumSpacingFt || 0;
  if (!isGrassLikePlant(plant)) return false;
  if (isSucculentLikePlant(plant) || isToxicOrCautionPlant(plant)) return false;
  if (height > 5.5 || width > 6.5) return false;
  return true;
}

function isSlopeShrubPlant(plant: Plant): boolean {
  const text = plantSearchText(plant);
  const category = (plant.category || '').toUpperCase();
  const height = plant.matureHeightFt || 0;
  const width = plant.matureWidthFt || plant.minimumSpacingFt || 0;
  if (!category.includes('SHRUB')) return false;
  if (height > 6 || width > 8) return false;
  return [
    'juniper', 'manzanita', 'ceanothus', 'wild lilac', 'grevillea', 'rosemary', 'westringia',
    'cotoneaster', 'coyote brush', 'lantana', 'germander', 'euonymus', 'myoporum',
    'ground morning glory', 'prostrate', 'trailing', 'carpet'
  ].some(term => text.includes(term)) || getPlantScore(plant, 'slopeScore', 0) >= 6;
}

function isNonSucculentSlopePlant(plant: Plant): boolean {
  return isSlopePlantingCandidate(plant) && !isSucculentLikePlant(plant);
}

function isSlopePlantingCandidate(plant: Plant): boolean {
  const height = plant.matureHeightFt || 0;
  const width = plant.matureWidthFt || plant.minimumSpacingFt || 0;
  const researchedSlopeScore = getResearchRoleScore(plant, 'slopePlanting', 0);
  if (height > 7.5 || width > 10) return false;
  if (isToxicOrCautionPlant(plant)) return false;
  return researchedSlopeScore >= 50 || isGroundcoverLikePlant(plant) || isGrassLikePlant(plant) || isSlopeShrubPlant(plant) || getPlantScore(plant, 'slopeScore', 0) >= 6;
}

function isRockGardenCandidate(plant: Plant): boolean {
  const height = plant.matureHeightFt || 0;
  const width = plant.matureWidthFt || plant.minimumSpacingFt || 0;
  if (height > 5 || width > 6.5) return false;
  if (isToxicOrCautionPlant(plant)) return false;
  return isArchitecturalPlant(plant) || isSucculentLikePlant(plant) || isGroundcoverLikePlant(plant) || isGrassLikePlant(plant);
}

function isHedgeCandidate(plant: Plant): boolean {
  const text = plantSearchText(plant);
  const height = plant.matureHeightFt || 0;
  const width = plant.matureWidthFt || plant.minimumSpacingFt || 0;
  const flags = new Set(plant.greenAcresScoreFlags || []);
  const hedgeName = text.includes('euonymus') || text.includes('pittosporum') || text.includes('privet') || text.includes('boxwood') || text.includes('myrtle') || text.includes('laurel') || text.includes('westringia') || text.includes('rosemary') || text.includes('nandina') || text.includes('heavenly bamboo');
  const shrubLike = plant.category?.toLowerCase().includes('shrub') || hedgeName || flags.has('evergreen');
  if (!shrubLike) return false;
  if (isGrassLikePlant(plant) || isGroundcoverLikePlant(plant) || isArchitecturalPlant(plant)) return false;
  if (height < 1.8 || height > 12) return false;
  if (width < 1.2 || width > 10) return false;
  return true;
}

function getGeneratedDisplayWidthFt(plant: Plant, zone: GardenZone): number | undefined {
  if ((zone.plantingType || 'mixedBorder') !== 'hedgeRow') return undefined;
  const matureWidth = plant.matureWidthFt || plant.minimumSpacingFt || 3;
  // Hedges are usually maintained narrower than their full mature spread. Keep the live plan symbol readable.
  return Math.max(1.35, Math.min(2.25, matureWidth * 0.45));
}

function getDesignWidthFt(plant: Plant, zone: GardenZone): number {
  return getGeneratedDisplayWidthFt(plant, zone) || plant.matureWidthFt || plant.minimumSpacingFt || 3;
}

function zoneHasMarkedEdges(zone: GardenZone): boolean {
  return !!((zone.edgeRoles?.front?.length || 0) + (zone.edgeRoles?.back?.length || 0));
}

function getZoneEdgeDistances(point: Point, zone: GardenZone): { front: number; back: number } {
  const distanceToRole = (edgeIndexes?: number[]) => {
    if (!edgeIndexes || edgeIndexes.length === 0 || zone.points.length < 2) return Infinity;
    return edgeIndexes.reduce((min, edgeIndex) => {
      const normalized = ((edgeIndex % zone.points.length) + zone.points.length) % zone.points.length;
      const a = zone.points[normalized];
      const b = zone.points[(normalized + 1) % zone.points.length];
      return Math.min(min, distanceToSegment(point, a, b));
    }, Infinity);
  };
  return {
    front: distanceToRole(zone.edgeRoles?.front),
    back: distanceToRole(zone.edgeRoles?.back),
  };
}

function getPlantingTypeMultiplier(zone: GardenZone): number {
  // Density now means intended visual coverage.
  // Planting type changes pattern/plant mix, but the slider should feel consistent.
  // Sparse design types intentionally top out below a packed bed.
  switch (zone.plantingType || 'mixedBorder') {
    case 'poolPlanter':
      return 0.9;
    case 'rockGarden':
      return 0.78;
    default:
      return 1;
  }
}

function getVisualCoverageCalibration(zone: GardenZone, layoutMode?: ZoneLayoutMode): number {
  // The drawn plant symbol is not a solid disk: SVG strokes, transparency, labels,
  // clumping, and natural gaps make mathematical 100% look lighter on the screen.
  // This factor converts plant circle area into perceived/visual coverage area.
  const type = zone.plantingType || 'mixedBorder';
  if (type === 'hedgeRow') return 1;
  if (layoutMode === 'groundcoverFill') return 0.58;
  if (type === 'flowerBed') return 0.46;
  if (type === 'grassDrift') return 0.44;
  if (type === 'slopePlanting') return 0.66;
  if (type === 'mixedBorder') return 0.66;
  if (type === 'poolPlanter') return 0.78;
  if (type === 'rockGarden') return 0.82;
  return 0.68;
}

function getZoneIntents(zone: GardenZone) {
  const styles = zone.plantingStyles || [];
  const type = zone.plantingType || 'mixedBorder';
  const text = zoneSearchText(zone);
  return {
    plantingType: type,
    wantsModern: styles.includes('modernClean') || type === 'poolPlanter' || text.includes('modern'),
    wantsGroundcover: styles.includes('groundCover') || type === 'slopePlanting' || type === 'rockGarden' || zone.layoutMode === 'groundcoverFill' || text.includes('groundcover'),
    wantsPrivacy: styles.includes('privacyScreen') || type === 'hedgeRow' || text.includes('privacy'),
    wantsPollinator: styles.includes('pollinator') || text.includes('pollinator'),
    wantsPoolSafe: styles.includes('poolSafe') || type === 'poolPlanter' || text.includes('pool'),
    wantsRockGarden: styles.includes('rockGarden') || type === 'rockGarden' || text.includes('rock') || text.includes('boulder'),
    wantsSlope: type === 'slopePlanting' || text.includes('slope') || text.includes('hill') || text.includes('bank'),
  };
}

function computeGeneratorScore(plant: Plant, zone: GardenZone): number {
  const intents = getZoneIntents(zone);
  const text = plantSearchText(plant);
  const flags = new Set(plant.greenAcresScoreFlags || []);
  const bestUses = new Set(plant.greenAcresBestUses || []);
  const height = plant.matureHeightFt || 0;
  const width = plant.matureWidthFt || plant.minimumSpacingFt || 0;

  let score = 0;
  score += getPlantScore(plant, 'layoutReliabilityScore', plant.estimateConfidence === 'High' ? 7 : 4) * 2.2;
  score += getPlantScore(plant, 'waterwiseScore', plant.waterwiseRating || 4) * 1.2;
  score += Math.max(0, 10 - getPlantScore(plant, 'messinessScore', plant.messinessRating || 5)) * 1.3;
  score += getPlantScore(plant, 'evergreenScore', flags.has('evergreen') ? 8 : 3) * 0.8;
  score += (plant.maintenanceEaseRating || 5) * 0.8;
  score += plant.greenAcresMatch ? 7 : 0;

  if (intents.wantsPoolSafe) score += getPlantScore(plant, 'poolSafeScore', 4) * 2.4;
  if (intents.wantsSlope || intents.wantsGroundcover) score += getPlantScore(plant, 'slopeScore', 4) * 1.7;
  if (intents.wantsPrivacy) score += getPlantScore(plant, 'privacyScore', height >= 5 ? 6 : 1) * 2.2;
  if (intents.wantsModern || intents.wantsRockGarden) {
    if (bestUses.has('rock_garden') || flags.has('architectural') || text.includes('agave') || text.includes('aloe') || text.includes('lomandra') || text.includes('sedge') || text.includes('grass')) score += 9;
    score += getPlantScore(plant, 'colorInterestScore', 4) * 0.7;
  }
  if (intents.wantsPollinator) score += plant.flowers || plant.pollinatorValue === 'High' ? 12 : 0;

  if (zone.waterNeed === 'low') score += getPlantScore(plant, 'waterwiseScore', plant.waterwiseRating || 4) * 1.5;
  if (zone.waterNeed === 'medium' && (plant.waterwiseRating || 0) >= 5) score += 5;
  if (zone.waterNeed === 'high' && getPlantScore(plant, 'waterwiseScore', plant.waterwiseRating || 4) >= 8) score -= 6;

  if (zone.sunExposure === 'fullSun' || zone.afternoonSun === 'yes') {
    if (flags.has('full_sun') || text.includes('sun')) score += 5;
    if (flags.has('shade') && !flags.has('full_sun')) score -= 5;
  }
  if (zone.sunExposure === 'fullShade' || zone.sunExposure === 'partShade') {
    if (flags.has('shade') || plant.gardenShade) score += 8;
    if (text.includes('cactus') || text.includes('agave') || text.includes('aloe')) score -= 4;
  }

  if (flags.has('annual_or_seasonal')) score -= intents.wantsPollinator ? 2 : 16;
  if (flags.has('attracts_bees') && intents.wantsPoolSafe) score -= 18;
  if (getPlantScore(plant, 'messinessScore', plant.messinessRating || 5) >= 6.5 && intents.wantsPoolSafe) score -= 18;
  if (isToxicOrCautionPlant(plant) && intents.wantsPoolSafe) score -= 45;
  const type = zone.plantingType || 'mixedBorder';
  const isGrassLike = isGrassLikePlant(plant);
  const isGroundcoverLike = isGroundcoverLikePlant(plant);
  const isArchitectural = isArchitecturalPlant(plant);

  if (type === 'flowerBed') {
    const flowerBedCandidate = isFlowerBedCandidate(plant);
    const flowerBedSupport = isFlowerBedSupportPlant(plant);
    if (flowerBedCandidate) score += 78;
    else if (flowerBedSupport) score += 12;
    else score -= 85;
    if (height > 6 || width > 5.5) score -= 32;
    if (plant.flowers || plant.pollinatorValue === 'High' || plant.pollinatorValue === 'Medium') score += 22;
    if (getPlantScore(plant, 'colorInterestScore', 4) >= 6) score += 16;
    if (isArchitectural || isSucculentLikePlant(plant)) score -= 72;
    if (isGrassLike && !flowerBedCandidate) score -= 36;
    if (isToxicOrCautionPlant(plant)) score -= 55;
    if (text.includes('rockrose') || text.includes('cistus') || text.includes('oleander')) score -= 70;
    if (height <= 0.8 && width >= 1.5 && flowerBedCandidate) score += 8;
  }
  if (type === 'hedgeRow') {
    score += getPlantScore(plant, 'privacyScore', height >= 4 ? 7 : 2) * 2.8;
    if (isHedgeCandidate(plant)) score += 34;
    if (text.includes('euonymus') || text.includes('pittosporum') || text.includes('privet') || text.includes('boxwood') || text.includes('westringia') || text.includes('myrtle')) score += 12;
    if (height >= 2.5 && height <= 8 && width >= 1.5 && width <= 8) score += 12;
    if (height < 2) score -= 24;
    if (width > 10 || height > 14) score -= 24;
    if (isGroundcoverLike || isGrassLike || isArchitectural) score -= 30;
  }
  if (type === 'grassDrift') {
    if (isGrassDriftCandidate(plant)) score += 65;
    else score -= 55;
    if (isArchitectural && !isGrassLike) score -= 24;
    if (height > 5 || width > 6) score -= 18;
    if (plant.flowers && !isGrassLike) score -= 28;
  }
  if (type === 'slopePlanting') {
    const researchedSlopeScore = getResearchRoleScore(plant, 'slopePlanting', 0);
    score += getPlantScore(plant, 'slopeScore', 4) * 1.4;
    score += researchedSlopeScore * 1.25;
    if (isSlopePlantingCandidate(plant)) score += 28;
    else score -= 45;
    if (hasWelGarden(plant, 5) || hasWelGarden(plant, 6) || hasWelGarden(plant, 7)) score += 26;
    if (hasResearchSourceTag(plant, 'uc-davis-arboretum-all-star')) score += 16;
    if (isNonSucculentSlopePlant(plant)) score += 52;
    if (isGroundcoverLike && !isSucculentLikePlant(plant)) score += 34;
    if (isSlopeShrubPlant(plant)) score += 38;
    if (isGrassLike) score += 24;
    // Succulents can be slope accents, but they should not dominate a slope planting.
    if (isSucculentLikePlant(plant)) score -= researchedSlopeScore >= 75 ? 22 : 76;
    if (height > 7.5 || width > 10) score -= 28;
  }
  if (type === 'poolPlanter') {
    const researchedPoolScore = getResearchRoleScore(plant, 'poolPlanter', 0);
    const poolAccentOnly = getResearchBehavior(plant, 'poolAccentOnly') === 'yes';
    const messinessBehavior = getResearchBehavior(plant, 'messiness');
    score += getPlantScore(plant, 'poolSafeScore', 4) * 1.8;
    score += researchedPoolScore * 1.35;
    if (isPoolPlanterCandidate(plant)) score += 34;
    else score -= 60;
    if (hasWelGarden(plant, 7)) score += 24;
    if (hasResearchSourceTag(plant, 'uc-davis-arboretum-all-star')) score += 10;
    if (isCleanPoolFoliagePlant(plant) && !isSucculentLikePlant(plant)) score += 62;
    if (isGrassLike) score += 38;
    if (hasColorFoliageSignal(plant)) score += 30;
    if (isArchitectural) score += 8;
    // Succulents/agaves/yuccas are allowed by pools, but as accents only.
    if (isSucculentLikePlant(plant)) score -= researchedPoolScore >= 80 ? 18 : 46;
    if (poolAccentOnly) score -= 16;
    if ((plant.flowers || flags.has('attracts_bees')) && researchedPoolScore < 72) score -= 38;
    if (messinessBehavior === 'high') score -= 70;
    if (height > 7 || width > 8) score -= 24;
  }
  if (type === 'rockGarden') {
    if (isRockGardenCandidate(plant)) score += 36;
    else score -= 18;
    if (isArchitectural || isGroundcoverLike) score += 18;
    if (height > 5 || width > 6.5) score -= 18;
  }

  if (height >= 18 || width >= 14) score -= 18;
  if (width <= 0) score -= 30;

  return score;
}

function weightedSeededChoice<T>(items: T[], random: () => number, weightForItem: (item: T) => number): T {
  if (items.length === 1) return items[0];
  const weights = items.map(item => Math.max(0.5, weightForItem(item)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let target = random() * total;
  for (let i = 0; i < items.length; i += 1) {
    target -= weights[i];
    if (target <= 0) return items[i];
  }
  return items[items.length - 1];
}

function buildGeneratorPalette(plants: Plant[], zone: GardenZone, layoutMode: ZoneLayoutMode, random: () => number): Plant[] {
  const sorted = [...plants].sort((a, b) => computeGeneratorScore(b, zone) - computeGeneratorScore(a, zone));
  const type = zone.plantingType || 'mixedBorder';
  const recipe = getPlantingRecipe(type);
  const variety = getPlantVarietySettings(zone);
  const baseDesiredCount = recipe?.paletteSize ?? (layoutMode === 'groundcoverFill' ? 5
    : layoutMode === 'cornerAnchors' ? 6
    : 8);
  const desiredCount = Math.max(1, Math.round(baseDesiredCount * variety.paletteScale));
  const palette: Plant[] = [];
  const addPlant = (plant?: Plant) => {
    if (!plant || palette.some(item => item.id === plant.id)) return;
    palette.push(plant);
  };

  const isGrassLike = (plant: Plant) => {
    const text = plantSearchText(plant);
    return text.includes('grass') || text.includes('sedge') || text.includes('lomandra') || text.includes('rush');
  };
  const isGroundcoverLike = (plant: Plant) => {
    const text = plantSearchText(plant);
    const height = plant.matureHeightFt || 0;
    const width = plant.matureWidthFt || plant.minimumSpacingFt || 0;
    return text.includes('ground') || text.includes('carpet') || text.includes('creeping') || text.includes('trailing') || text.includes('stonecrop') || text.includes('sedum') || (height <= 1.2 && width >= 1.2);
  };
  const isArchitectural = (plant: Plant) => {
    const text = plantSearchText(plant);
    const flags = new Set(plant.greenAcresScoreFlags || []);
    return flags.has('architectural') || text.includes('agave') || text.includes('aloe') || text.includes('yucca') || text.includes('mangave');
  };

  const low = sorted.filter(plant => getPlantHeightRole(plant) === 'low');
  const mid = sorted.filter(plant => getPlantHeightRole(plant) === 'medium');
  const tall = sorted.filter(plant => getPlantHeightRole(plant) === 'tall' && (plant.matureHeightFt || 0) < 14);

  if (type === 'hedgeRow') {
    // Hedge rows should behave like a clipped row, not a mixed planting bed.
    // Pick one strong hedge candidate and repeat it so the result reads as a hedge.
    const hedgeCandidates = sorted.filter(isHedgeCandidate);
    addPlant(hedgeCandidates[0] || mid.find(plant => (plant.matureHeightFt || 0) >= 2.5) || sorted[0]);
  } else if (type === 'grassDrift') {
    const grasses = sorted.filter(isGrassDriftCandidate);
    grasses.slice(0, desiredCount).forEach(addPlant);
    if (palette.length < 3) sorted.filter(isGrassLike).slice(0, desiredCount).forEach(addPlant);
  } else if (type === 'slopePlanting') {
    const slopeCandidates = sorted.filter(isSlopePlantingCandidate);
    const nonSucculentSlope = slopeCandidates.filter(plant => !isSucculentLikePlant(plant));
    const sourcedSlope = nonSucculentSlope.filter(plant => getResearchRoleScore(plant, 'slopePlanting', 0) >= 65 || hasWelGarden(plant, 5) || hasWelGarden(plant, 6) || hasWelGarden(plant, 7));
    sourcedSlope.filter(isSlopeShrubPlant).slice(0, 5).forEach(addPlant);
    sourcedSlope.filter(isGroundcoverLike).slice(0, 5).forEach(addPlant);
    sourcedSlope.filter(isGrassLike).slice(0, 4).forEach(addPlant);
    nonSucculentSlope.filter(isSlopeShrubPlant).slice(0, 5).forEach(addPlant);
    nonSucculentSlope.filter(isGroundcoverLike).slice(0, 5).forEach(addPlant);
    nonSucculentSlope.filter(isGrassLike).slice(0, 4).forEach(addPlant);
    nonSucculentSlope.slice(0, desiredCount).forEach(addPlant);
    // One succulent/stonecrop accent is okay, but never let it own the slope palette.
    slopeCandidates.filter(plant => isSucculentLikePlant(plant) && getResearchRoleScore(plant, 'slopePlanting', 0) >= 60).slice(0, 1).forEach(addPlant);
  } else if (type === 'poolPlanter') {
    const poolCandidates = sorted.filter(isPoolPlanterCandidate);
    const nonSucculentPool = poolCandidates.filter(plant => !isSucculentLikePlant(plant));
    const corePool = nonSucculentPool.filter(plant => getResearchRoleScore(plant, 'poolPlanter', 0) >= 65 && getResearchBehavior(plant, 'poolAccentOnly') !== 'yes');
    corePool.filter(isGrassLike).slice(0, 5).forEach(addPlant);
    corePool.filter(hasColorFoliageSignal).slice(0, 5).forEach(addPlant);
    corePool.filter(isCleanPoolFoliagePlant).slice(0, 7).forEach(addPlant);
    nonSucculentPool.filter(isGrassLike).slice(0, 5).forEach(addPlant);
    nonSucculentPool.filter(hasColorFoliageSignal).slice(0, 5).forEach(addPlant);
    nonSucculentPool.filter(isCleanPoolFoliagePlant).slice(0, 7).forEach(addPlant);
    nonSucculentPool.slice(0, desiredCount).forEach(addPlant);
    // Succulents/agaves/yuccas are accents only.
    poolCandidates.filter(plant => (isSucculentLikePlant(plant) || isArchitectural(plant)) && getResearchRoleScore(plant, 'poolPlanter', 0) >= 60).slice(0, 2).forEach(addPlant);
  } else if (type === 'rockGarden') {
    const rockCandidates = sorted.filter(isRockGardenCandidate);
    rockCandidates.filter(plant => isArchitectural(plant) || isSucculentLikePlant(plant)).slice(0, 4).forEach(addPlant);
    rockCandidates.filter(isGroundcoverLike).slice(0, 3).forEach(addPlant);
    rockCandidates.slice(0, desiredCount).forEach(addPlant);
  } else if (type === 'flowerBed') {
    const flowerCandidates = sorted.filter(isFlowerBedCandidate);
    const flowerLow = flowerCandidates.filter(plant => getPlantHeightRole(plant) === 'low');
    const flowerMid = flowerCandidates.filter(plant => getPlantHeightRole(plant) === 'medium');
    const flowerTall = flowerCandidates.filter(plant => getPlantHeightRole(plant) === 'tall' && (plant.matureHeightFt || 0) <= 6);
    flowerLow.slice(0, 5).forEach(addPlant);
    flowerMid.slice(0, 6).forEach(addPlant);
    flowerTall.slice(0, 2).forEach(addPlant);
    flowerCandidates.slice(0, 12).forEach(addPlant);
    if (palette.length < 6) sorted.filter(isFlowerBedSupportPlant).slice(0, 4).forEach(addPlant);
  } else if (layoutMode === 'groundcoverFill') {
    low.slice(0, 3).forEach(addPlant);
    mid.slice(0, 2).forEach(addPlant);
  } else {
    mid.slice(0, 3).forEach(addPlant);
    low.slice(0, 3).forEach(addPlant);
    tall.slice(0, 2).forEach(addPlant);
  }

  if (type === 'flowerBed') {
    const flowerAndSupport = sorted.filter(plant => isFlowerBedCandidate(plant) || isFlowerBedSupportPlant(plant));
    flowerAndSupport.forEach(addPlant);
  } else if (type === 'grassDrift') {
    sorted.filter(isGrassDriftCandidate).forEach(addPlant);
  } else if (type === 'poolPlanter') {
    sorted.filter(plant => isPoolPlanterCandidate(plant) && !isSucculentLikePlant(plant)).forEach(addPlant);
    sorted.filter(plant => isPoolPlanterCandidate(plant) && isSucculentLikePlant(plant)).slice(0, 2).forEach(addPlant);
  } else if (type === 'slopePlanting') {
    sorted.filter(plant => isSlopePlantingCandidate(plant) && !isSucculentLikePlant(plant)).forEach(addPlant);
    sorted.filter(plant => isSlopePlantingCandidate(plant) && isSucculentLikePlant(plant)).slice(0, 1).forEach(addPlant);
  } else if (type === 'rockGarden') {
    sorted.filter(isRockGardenCandidate).forEach(addPlant);
  } else {
    sorted.forEach(addPlant);
  }
  const finalPalette = palette.slice(0, Math.max(1, Math.min(desiredCount, palette.length)));
  return finalPalette.sort(() => random() - 0.5);
}

function pickAutoPlants(plants: Plant[], zone: GardenZone): Plant[] {
  const categoryUpper = (plant: Plant) => (plant.category || '').toUpperCase();
  const hasAny = (plant: Plant, terms: string[]) => terms.some(term => plantSearchText(plant).includes(term));

  let candidates = plants.filter(plant => {
    const text = plantSearchText(plant);
    const category = categoryUpper(plant);
    const flags = new Set(plant.greenAcresScoreFlags || []);
    if (plant.id <= 0) return false;
    if (!plant.matureWidthFt || plant.matureWidthFt <= 0) return false;
    if (category.includes('HERBS AND VEGETABLES')) return false;
    if (hasAny(plant, ['tomato', 'pepper', 'cucumber', 'bean', 'squash', 'melon', 'lettuce', 'kale', 'chard', 'collard', 'broccoli', 'cabbage', 'herb', 'vegetable'])) return false;
    if ((text.includes('annual') || flags.has('annual_or_seasonal')) && !zone.plantingStyles?.includes('pollinator')) return false;
    if ((plant.matureHeightFt || 0) > 25 || (plant.matureWidthFt || 0) > 18) return false;
    return true;
  });

  const intents = getZoneIntents(zone);

  const plantingType = zone.plantingType || 'mixedBorder';

  if (plantingType === 'flowerBed') {
    const flowerCandidates = candidates.filter(isFlowerBedCandidate);
    if (flowerCandidates.length >= 4) candidates = flowerCandidates;
    else {
      const flowerSupportCandidates = candidates.filter(isFlowerBedSupportPlant);
      if (flowerSupportCandidates.length >= 4) candidates = flowerSupportCandidates;
    }
  } else if (plantingType === 'hedgeRow') {
    const hedgeCandidates = candidates.filter(isHedgeCandidate);
    if (hedgeCandidates.length >= 2) candidates = hedgeCandidates;
  } else if (plantingType === 'grassDrift') {
    const grassCandidates = candidates.filter(isGrassDriftCandidate);
    if (grassCandidates.length >= 2) candidates = grassCandidates;
  } else if (plantingType === 'poolPlanter') {
    const poolCandidates = candidates.filter(isPoolPlanterCandidate);
    const nonSucculentPoolCandidates = poolCandidates.filter(plant => !isSucculentLikePlant(plant));
    if (nonSucculentPoolCandidates.length >= 6) candidates = nonSucculentPoolCandidates;
    else if (poolCandidates.length >= 4) candidates = poolCandidates;
  } else if (plantingType === 'slopePlanting') {
    const slopeCandidates = candidates.filter(isSlopePlantingCandidate);
    const nonSucculentSlopeCandidates = slopeCandidates.filter(plant => !isSucculentLikePlant(plant));
    if (nonSucculentSlopeCandidates.length >= 6) candidates = nonSucculentSlopeCandidates;
    else if (slopeCandidates.length >= 4) candidates = slopeCandidates;
  } else if (plantingType === 'rockGarden') {
    const rockCandidates = candidates.filter(isRockGardenCandidate);
    if (rockCandidates.length >= 4) candidates = rockCandidates;
  }

  if (zone.waterNeed === 'low') {
    const lowWaterCandidates = candidates.filter(plant => getPlantScore(plant, 'waterwiseScore', plant.waterwiseRating || 0) >= 6.5);
    if (lowWaterCandidates.length >= 6) candidates = lowWaterCandidates;
  } else if (zone.waterNeed === 'medium') {
    const mediumWaterCandidates = candidates.filter(plant => getPlantScore(plant, 'waterwiseScore', plant.waterwiseRating || 0) >= 4.5);
    if (mediumWaterCandidates.length >= 6) candidates = mediumWaterCandidates;
  }

  if (intents.wantsGroundcover || intents.wantsSlope) {
    const groundcoverCandidates = candidates.filter(plant => {
      const category = categoryUpper(plant);
      const text = plantSearchText(plant);
      const bestUses = new Set(plant.greenAcresBestUses || []);
      const broadSlopePlant = intents.wantsSlope && (isSlopeShrubPlant(plant) || isGrassLikePlant(plant));
      const groundcoverPlant = category.includes('GROUND') || bestUses.has('slope') || bestUses.has('groundcover') || text.includes('groundcover') || ((plant.matureHeightFt || 99) <= 2.5 && (plant.matureWidthFt || 0) <= 6);
      return broadSlopePlant || groundcoverPlant;
    });
    const preferredGroundcoverCandidates = intents.wantsSlope
      ? groundcoverCandidates.filter(plant => !isSucculentLikePlant(plant))
      : groundcoverCandidates;
    if (preferredGroundcoverCandidates.length >= 4) candidates = preferredGroundcoverCandidates;
    else if (groundcoverCandidates.length >= 4) candidates = groundcoverCandidates;
  }

  if (intents.wantsModern || intents.wantsRockGarden) {
    const modernCandidates = candidates.filter(plant => {
      const category = categoryUpper(plant);
      const text = plantSearchText(plant);
      const bestUses = new Set(plant.greenAcresBestUses || []);
      return (
        bestUses.has('rock_garden') ||
        category.includes('SHRUB') ||
        category.includes('GRASS') ||
        category.includes('SUCCULENT') ||
        category.includes('GROUND') ||
        text.includes('agave') ||
        text.includes('aloe') ||
        text.includes('lomandra') ||
        text.includes('dianella') ||
        text.includes('westringia') ||
        text.includes('lavender') ||
        text.includes('sedge') ||
        text.includes('grass')
      );
    });
    if (modernCandidates.length >= 6) candidates = modernCandidates;
  }

  if (intents.wantsPollinator) {
    const pollinatorCandidates = candidates.filter(plant => plant.flowers || plant.pollinatorValue === 'High' || plant.pollinatorValue === 'Medium');
    if (pollinatorCandidates.length >= 4) candidates = pollinatorCandidates;
  }

  if (intents.wantsPrivacy) {
    const privacyCandidates = candidates.filter(plant => getPlantScore(plant, 'privacyScore', (plant.matureHeightFt || 0) >= 5 ? 5 : 0) >= 5 && (plant.matureWidthFt || 99) <= 9);
    if (privacyCandidates.length >= 4) candidates = privacyCandidates;
  }

  if (intents.wantsPoolSafe) {
    const poolCandidates = candidates.filter(plant => {
      const researchedPoolScore = getResearchRoleScore(plant, 'poolPlanter', 0);
      const messinessBehavior = getResearchBehavior(plant, 'messiness');
      return (researchedPoolScore >= 50 || getPlantScore(plant, 'poolSafeScore', 4) >= 5.5)
        && messinessBehavior !== 'high'
        && getPlantScore(plant, 'messinessScore', plant.messinessRating || 5) <= 6.8;
    });
    if (poolCandidates.length >= 6) candidates = poolCandidates;
  }

  if (zone.sunExposure === 'fullShade' || zone.sunExposure === 'partShade') {
    const shadeCandidates = candidates.filter(plant => plant.gardenShade || (plant.greenAcresScoreFlags || []).includes('shade'));
    if (shadeCandidates.length >= 4) candidates = shadeCandidates;
  }

  const greenAcresCandidates = candidates.filter(plant => plant.greenAcresMatch);
  if (greenAcresCandidates.length >= 6) candidates = greenAcresCandidates;

  return candidates
    .sort((a, b) => computeGeneratorScore(b, zone) - computeGeneratorScore(a, zone))
    .slice(0, 100);
}

function App() {
  // Plant database state
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(8);
  const [loadingStage, setLoadingStage] = useState('Starting app...');
  const [error, setError] = useState<string | null>(null);

  // Filter and sort state
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState(DEFAULT_FILTERS.search || '');
  const [visiblePlantLimit, setVisiblePlantLimit] = useState(120);
  const [sortBy, setSortBy] = useState<SortOption>('commonName');
  const [greenAcresFilterIndex, setGreenAcresFilterIndex] = useState<GreenAcresFilterIndex | null>(null);
  const [leftPanelMode, setLeftPanelMode] = useState<'library' | 'filters' | 'closed'>('library');
  const [rightInspectorSection, setRightInspectorSection] = useState<'item' | 'canvas' | 'zones' | 'groups' | 'legend' | 'debug' | null>('zones');
  const categories = useMemo(() => getCategories(plants), [plants]);
  // Selection state
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);
  const copiedPlacedPlantsRef = useRef<PlacedPlant[]>([]);
  const pasteGenerationRef = useRef(0);
  const [placingRock, setPlacingRock] = useState(false);
  const nextRockIndexRef = useRef(0);
  const appLoadLoggedRef = useRef(false);
  const plantLoadLoggedRef = useRef(false);
  const currentPlanLoadLoggedRef = useRef(false);
  const lastLogSignatureRef = useRef<{ signature: string; timestamp: number } | null>(null);
  const moveLogThrottleRef = useRef<Record<string, { timestamp: number; x: number; y: number }>>({});
  const moveScoreCooldownRef = useRef<Record<string, number>>({});

  // Canvas state
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [backgroundOpacity, setBackgroundOpacity] = useState(0.5);
  const [backgroundLocked, setBackgroundLocked] = useState(false);
  const [restoreBackgroundOnLaunch, setRestoreBackgroundOnLaunch] = useState(false);
  const [pixelsPerFoot, setPixelsPerFoot] = useState<number | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 650 });
  const [canvasWorldSize, setCanvasWorldSize] = useState({ width: 900, height: 650 });
  const [zoom, setZoom] = useState(1);
  const [plantCircleOpacity, setPlantCircleOpacity] = useState(0.58);
  const [plantLabelMode, setPlantLabelMode] = useState<PlantLabelMode>('numbers');
  const [globalDisplayMode, setGlobalDisplayMode] = useState<DisplayMode>('symbol');
  const [plantClumpingEnabled, setPlantClumpingEnabled] = useState(true);
  const [plantClumpStrength, setPlantClumpStrength] = useState<PlantClumpStrength>('normal');

  // Placed plants and planning zones state
  const [placedPlants, setPlacedPlants] = useState<PlacedPlant[]>([]);
  const [zones, setZones] = useState<GardenZone[]>([]);
  const [plantingGroups, setPlantingGroups] = useState<PlantingGroup[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [zoneShapesVisible, setZoneShapesVisible] = useState(true);

  // Plan state
  const [planName, setPlanName] = useState('My Garden Plan');
  const [notes, setNotes] = useState('');
  const [savedPlans, setSavedPlans] = useState<GardenPlan[]>([]);
  const [testLog, setTestLog] = useState<TestLogEntry[]>([]);
  const [debugSnapshots, setDebugSnapshots] = useState<TestSnapshot[]>([]);
  const [shrubScore, setShrubScore] = useState(0);
  const [scoreEventKeys, setScoreEventKeys] = useState<string[]>([]);
  const [scoreMilestones, setScoreMilestones] = useState<string[]>([]);
  const [commentaryMessage, setCommentaryMessage] = useState(IDLE_MESSAGES[0]);
  const [pointGain, setPointGain] = useState<{ id: string; points: number } | null>(null);
  const awardedScoreKeysRef = useRef<Set<string>>(new Set());

  // Print view state
  const [showPrintView, setShowPrintView] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showOpenPlanModal, setShowOpenPlanModal] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showAttribution, setShowAttribution] = useState(false);
  const [showWelcomeGuide, setShowWelcomeGuide] = useState(false);
  const [showWelcomeOnStartup, setShowWelcomeOnStartup] = useState(true);
  const [showHelpCenter, setShowHelpCenter] = useState(false);
  const [helpSearch, setHelpSearch] = useState('');
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const appFileInputRef = useRef<HTMLInputElement>(null);

  // Warnings state - computed from placed plants
  const warnings = generateWarnings(placedPlants, plants, pixelsPerFoot);
  const shrubScoreState: ShrubScoreState = { score: shrubScore, eventKeys: scoreEventKeys, milestones: scoreMilestones };
  const sortedSavedPlans = useMemo(() => {
    return [...savedPlans].sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [savedPlans]);

  const addTestLog = useCallback((action: string, details: Record<string, unknown> = {}) => {
    const signature = `${action}|${JSON.stringify(details)}`;
    const now = Date.now();
    if (lastLogSignatureRef.current && lastLogSignatureRef.current.signature === signature && now - lastLogSignatureRef.current.timestamp < 350) {
      return;
    }
    lastLogSignatureRef.current = { signature, timestamp: now };

    setTestLog(prev => [
      ...prev.slice(-499),
      {
        id: generateId(),
        timestamp: new Date().toISOString(),
        action,
        details,
      },
    ]);
  }, []);

  const clearTestLog = useCallback(() => {
    setTestLog([]);
    setDebugSnapshots([]);
  }, []);


  const awardScore = useCallback((key: string, points: number, message: string) => {
    if (!key || points <= 0 || awardedScoreKeysRef.current.has(key)) return;
    awardedScoreKeysRef.current.add(key);
    setScoreEventKeys(prev => prev.includes(key) ? prev : [...prev, key]);
    setShrubScore(prev => {
      const next = prev + points;
      const nextTitle = getScoreTitle(next);
      if (nextTitle !== getScoreTitle(prev) && !scoreMilestones.includes(nextTitle)) {
        setScoreMilestones(current => current.includes(nextTitle) ? current : [...current, nextTitle]);
        setCommentaryMessage(`${nextTitle}. The dirt has acknowledged your progress.`);
      } else {
        setCommentaryMessage(message);
      }
      return next;
    });
    setPointGain({ id: generateId(), points });
    window.setTimeout(() => setPointGain(current => current?.id ? null : current), 1200);
    addTestLog('score.awarded', { key, points, message });
  }, [addTestLog, scoreMilestones]);

  const getDebugStateSummary = useCallback(() => ({
    selectedPlantId: selectedPlant?.id || null,
    selectedPlantName: selectedPlant?.commonName || selectedPlant?.botanicalName || null,
    selectedInstanceId,
    selectedInstanceIds,
    selectedZoneId,
    placingRock,
    placedPlants: placedPlants.length,
    zones: zones.length,
    plantingGroups: plantingGroups.length,
    scalePixelsPerFoot: pixelsPerFoot,
    zoom,
    plantCircleOpacity,
    plantLabelMode,
    plantClumpingEnabled,
    plantClumpStrength,
    backgroundImageLoaded: !!backgroundImage,
    backgroundOpacity,
    backgroundLocked,
    canvasSize,
    canvasWorldSize,
  }), [
    selectedPlant,
    selectedInstanceId,
    selectedInstanceIds,
    selectedZoneId,
    placingRock,
    placedPlants.length,
    zones.length,
    plantingGroups.length,
    pixelsPerFoot,
    zoom,
    plantCircleOpacity,
    plantLabelMode,
    plantClumpingEnabled,
    plantClumpStrength,
    backgroundImage,
    backgroundOpacity,
    backgroundLocked,
    canvasSize,
    canvasWorldSize,
  ]);

  const captureMapSnapshot = useCallback(async (
    reason: string,
    details: Record<string, unknown> = {},
    snapshotPlants: PlacedPlant[] = placedPlants,
    snapshotZones: GardenZone[] = zones
  ) => {
    const startedAt = performance.now();

    try {
      await new Promise(resolve => requestAnimationFrame(resolve));

      const focusZoneId = typeof details.zoneId === 'string' ? details.zoneId : selectedZoneId;
      const focusZone = snapshotZones.find(zone => zone.id === focusZoneId);
      const focusPlants = focusZone
        ? snapshotPlants.filter(item => item.zone === focusZone.id)
        : snapshotPlants;

      const allPoints = [
        ...(focusZone?.points || []),
        ...focusPlants.map(item => ({ x: item.x, y: item.y })),
      ];

      const fallbackBounds = { minX: 0, minY: 0, maxX: canvasWorldSize.width, maxY: canvasWorldSize.height };
      const bounds = allPoints.length > 0
        ? {
            minX: Math.min(...allPoints.map(point => point.x)),
            minY: Math.min(...allPoints.map(point => point.y)),
            maxX: Math.max(...allPoints.map(point => point.x)),
            maxY: Math.max(...allPoints.map(point => point.y)),
          }
        : fallbackBounds;

      const padding = 80;
      const crop = {
        minX: Math.max(0, bounds.minX - padding),
        minY: Math.max(0, bounds.minY - padding),
        maxX: Math.min(canvasWorldSize.width, bounds.maxX + padding),
        maxY: Math.min(canvasWorldSize.height, bounds.maxY + padding),
      };

      const cropWidth = Math.max(200, crop.maxX - crop.minX);
      const cropHeight = Math.max(160, crop.maxY - crop.minY);
      const maxSnapshotSide = 760;
      const scale = Math.min(1.15, maxSnapshotSide / Math.max(cropWidth, cropHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(220, Math.round(cropWidth * scale));
      canvas.height = Math.max(180, Math.round(cropHeight * scale));

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Could not create snapshot canvas context.');
      }

      const toCanvasX = (x: number) => (x - crop.minX) * scale;
      const toCanvasY = (y: number) => (y - crop.minY) * scale;

      context.fillStyle = '#f3f4f6';
      context.fillRect(0, 0, canvas.width, canvas.height);

      // Lightweight debug grid. This is intentionally not a full DOM screenshot.
      context.strokeStyle = '#e5e7eb';
      context.lineWidth = 1;
      const gridStep = Math.max(25, (pixelsPerFoot || 20) * scale);
      for (let x = ((Math.floor(crop.minX / gridStep) * gridStep) - crop.minX) * scale; x < canvas.width; x += gridStep) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, canvas.height);
        context.stroke();
      }
      for (let y = ((Math.floor(crop.minY / gridStep) * gridStep) - crop.minY) * scale; y < canvas.height; y += gridStep) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(canvas.width, y);
        context.stroke();
      }

      // Draw zones first.
      snapshotZones
        .filter(zone => zone.visible !== false && zone.zoneType !== 'exclusion')
        .forEach(zone => {
          if (zone.points.length < 3) return;
          context.beginPath();
          zone.points.forEach((point, index) => {
            const x = toCanvasX(point.x);
            const y = toCanvasY(point.y);
            if (index === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
          });
          context.closePath();
          context.fillStyle = zone.id === focusZoneId ? 'rgba(34, 197, 94, 0.22)' : 'rgba(148, 163, 184, 0.14)';
          context.strokeStyle = zone.id === focusZoneId ? '#16a34a' : '#64748b';
          context.lineWidth = zone.id === focusZoneId ? 3 : 1.5;
          context.fill();
          context.stroke();
        });

      snapshotZones
        .filter(zone => zone.visible !== false && zone.zoneType === 'exclusion')
        .forEach(zone => {
          if (zone.points.length < 3) return;
          context.beginPath();
          zone.points.forEach((point, index) => {
            const x = toCanvasX(point.x);
            const y = toCanvasY(point.y);
            if (index === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
          });
          context.closePath();
          context.fillStyle = 'rgba(239, 68, 68, 0.18)';
          context.strokeStyle = '#dc2626';
          context.lineWidth = 2;
          context.fill();
          context.stroke();
        });

      const plantColor = (plantId: number, itemType?: string) => {
        if (itemType === 'rock') return '#737373';
        const plant = plants.find(candidate => candidate.id === plantId);
        const text = `${plant?.category || ''} ${plant?.commonName || ''} ${plant?.botanicalName || ''}`.toLowerCase();
        if (text.includes('grass') || text.includes('sedge') || text.includes('lomandra')) return '#84cc16';
        if (text.includes('agave') || text.includes('aloe') || text.includes('echeveria') || text.includes('sedum') || text.includes('stonecrop') || text.includes('crassula')) return '#22c55e';
        if (text.includes('lavender') || text.includes('flower')) return '#a855f7';
        if (text.includes('shrub')) return '#15803d';
        return '#0ea5e9';
      };

      // Draw plant mature-width circles from plan data.
      snapshotPlants
        .filter(item => !focusZone || item.zone === focusZone.id)
        .forEach((item, index) => {
          const plant = plants.find(candidate => candidate.id === item.plantId);
          const widthFt = item.itemType === 'rock' ? item.rockSizeFt || 2 : item.displayWidthFt || plant?.matureWidthFt || plant?.minimumSpacingFt || 2;
          const radius = Math.max(5, (widthFt * (pixelsPerFoot || 20) * scale) / 2);
          const x = toCanvasX(item.x);
          const y = toCanvasY(item.y);

          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fillStyle = plantColor(item.plantId, item.itemType);
          context.globalAlpha = item.itemType === 'rock' ? 0.65 : 0.45;
          context.fill();
          context.globalAlpha = 1;
          context.strokeStyle = item.itemType === 'rock' ? '#44403c' : '#14532d';
          context.lineWidth = 1.5;
          context.stroke();

          context.fillStyle = '#111827';
          context.strokeStyle = 'rgba(255,255,255,0.85)';
          context.lineWidth = 3;
          context.font = `${Math.max(10, Math.min(16, 11 * scale + 4))}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          const label = item.itemType === 'rock' ? 'R' : String(index + 1);
          context.strokeText(label, x, y);
          context.fillText(label, x, y);
        });

      context.fillStyle = 'rgba(255,255,255,0.88)';
      context.fillRect(8, 8, Math.min(canvas.width - 16, 430), 54);
      context.fillStyle = '#111827';
      context.font = '12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      context.textAlign = 'left';
      context.textBaseline = 'top';
      context.fillText(`${reason} • ${focusZone?.name || 'Plan'} • ${focusPlants.length} plants`, 16, 15);
      context.fillStyle = '#4b5563';
      context.fillText(`Fast debug render, not UI screenshot • scale ${scale.toFixed(2)} • crop ${Math.round(cropWidth)}×${Math.round(cropHeight)}`, 16, 34);

      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.58);
      const durationMs = Math.round(performance.now() - startedAt);
      const snapshot: TestSnapshot = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        reason,
        imageDataUrl,
        width: canvas.width,
        height: canvas.height,
        details: {
          ...details,
          snapshotType: 'fast-debug-render',
          durationMs,
          crop,
          plantCount: focusPlants.length,
        },
      };
      setDebugSnapshots(prev => [...prev.slice(-2), snapshot]);
      addTestLog('snapshot.captured', {
        snapshotId: snapshot.id,
        reason,
        width: snapshot.width,
        height: snapshot.height,
        durationMs,
        snapshotType: 'fast-debug-render',
        details: snapshot.details,
      });
    } catch (error) {
      addTestLog('snapshot.failed', {
        reason,
        error: error instanceof Error ? error.message : String(error),
        details,
      });
    }
  }, [addTestLog, canvasWorldSize, pixelsPerFoot, placedPlants, plants, selectedZoneId, zones]);

  // Start app-level test log from load and capture browser-level errors.
  useEffect(() => {
    if (!appLoadLoggedRef.current) {
      appLoadLoggedRef.current = true;
      addTestLog('app.loaded', {
        url: window.location.href,
        userAgent: navigator.userAgent,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      });
    }

    const handleError = (event: ErrorEvent) => {
      addTestLog('window.error', {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      addTestLog('window.unhandledRejection', {
        reason: String(event.reason),
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [addTestLog]);

  // Load plants from CSV on mount
  useEffect(() => {
    const loadPlants = async () => {
      setLoading(true);
      setLoadingStage('Loading Green Acres catalog...');
      setLoadingProgress(20);
      const result = await loadPlantsFromCSV((progress, stage) => {
        setLoadingProgress(progress);
        setLoadingStage(stage);
      });
      if (result.error) {
        setError(result.error);
        if (!plantLoadLoggedRef.current) {
          plantLoadLoggedRef.current = true;
          addTestLog('plants.loadError', { error: result.error });
        }
      } else {
        setLoadingStage('Preparing plant library...');
        setLoadingProgress(92);
        setPlants(result.plants);
        if (!plantLoadLoggedRef.current) {
          plantLoadLoggedRef.current = true;
          addTestLog('plants.loaded', { count: result.plants.length });
        }
      }
      requestAnimationFrame(() => {
        setLoadingProgress(100);
        setLoading(false);
      });
    };
    loadPlants();
  }, [addTestLog]);

  // Load real Green Acres filter index on mount
  useEffect(() => {
    const loadGreenAcresFilterIndex = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}green_acres_filter_index.json`);
        if (!response.ok) throw new Error(`Filter index failed to load: ${response.status}`);
        const index = await response.json() as GreenAcresFilterIndex;
        setGreenAcresFilterIndex(index);
        addTestLog('filters.greenAcresIndexLoaded', {
          groups: index.groups?.length || 0,
          values: (index.groups || []).reduce((total, group) => total + (group.values?.length || 0), 0),
        });
      } catch (error) {
        console.warn('Could not load Green Acres filter index', error);
        addTestLog('filters.greenAcresIndexLoadFailed', { message: error instanceof Error ? error.message : String(error) });
      }
    };
    loadGreenAcresFilterIndex();
  }, [addTestLog]);

  // Load saved plans on mount
  useEffect(() => {
    setSavedPlans(loadSavedPlans());
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(WELCOME_SETTING_KEY);
    const shouldShow = stored !== 'false';
    setShowWelcomeOnStartup(shouldShow);
    if (shouldShow) setShowWelcomeGuide(true);
  }, []);

  // Load current plan state from localStorage on mount
  useEffect(() => {
    const saved = loadCurrentPlan();
    if (saved) {
      if (!currentPlanLoadLoggedRef.current) {
        currentPlanLoadLoggedRef.current = true;
        addTestLog('currentPlan.loaded', { placedPlants: saved.placedPlants?.length || 0, zones: saved.zones?.length || 0, plantingGroups: saved.plantingGroups?.length || 0 });
      }
      if (saved.placedPlants) setPlacedPlants(saved.placedPlants);
      if (saved.zones) setZones(saved.zones);
      if (saved.plantingGroups) setPlantingGroups(saved.plantingGroups);
      if (saved.zoneShapesVisible !== undefined) setZoneShapesVisible(saved.zoneShapesVisible);
      const shouldRestoreBackground = saved.restoreBackgroundOnLaunch === true
        || (saved.name === 'Example Plan' && typeof saved.backgroundImage === 'string' && saved.backgroundImage.startsWith('data:image/'));
      setRestoreBackgroundOnLaunch(shouldRestoreBackground);
      if (shouldRestoreBackground && saved.backgroundImage) {
        setBackgroundImage(saved.backgroundImage);
      }
      if (saved.backgroundOpacity !== undefined) setBackgroundOpacity(saved.backgroundOpacity);
      if (saved.backgroundLocked !== undefined) setBackgroundLocked(saved.backgroundLocked);
      if (saved.scalePixelsPerFoot !== undefined) setPixelsPerFoot(saved.scalePixelsPerFoot);
      if (saved.canvasWorldSize) {
        setCanvasWorldSize(saved.canvasWorldSize);
        setCanvasSize(saved.canvasWorldSize);
      }
      if (saved.plantCircleOpacity !== undefined) setPlantCircleOpacity(saved.plantCircleOpacity);
      if (saved.plantLabelMode) setPlantLabelMode(saved.plantLabelMode === 'initials' ? 'numbers' : saved.plantLabelMode);
      if (saved.plantClumpingEnabled !== undefined) setPlantClumpingEnabled(saved.plantClumpingEnabled);
      if (saved.plantClumpStrength) setPlantClumpStrength(saved.plantClumpStrength);
      if (saved.zoom !== undefined) setZoom(saved.zoom);
      if (saved.notes) setNotes(saved.notes);
      if (saved.name) setPlanName(saved.name);
      if (saved.shrubScore) {
        setShrubScore(saved.shrubScore.score || 0);
        setScoreEventKeys(saved.shrubScore.eventKeys || []);
        setScoreMilestones(saved.shrubScore.milestones || []);
        awardedScoreKeysRef.current = new Set(saved.shrubScore.eventKeys || []);
      }
    }
  }, []);

  // Save current plan state to localStorage whenever it changes
  useEffect(() => {
    saveCurrentPlan({
      placedPlants,
      backgroundImage,
      backgroundOpacity,
      backgroundLocked,
      restoreBackgroundOnLaunch,
      scalePixelsPerFoot: pixelsPerFoot,
      notes,
      name: planName,
      canvasWorldSize,
      plantCircleOpacity,
      plantLabelMode,
      plantClumpingEnabled,
      plantClumpStrength,
      zoom,
      zones,
      plantingGroups,
      zoneShapesVisible,
      shrubScore: shrubScoreState,
    });
  }, [placedPlants, backgroundImage, backgroundOpacity, backgroundLocked, restoreBackgroundOnLaunch, pixelsPerFoot, notes, planName, canvasWorldSize, plantCircleOpacity, plantLabelMode, plantClumpingEnabled, plantClumpStrength, zoom, zones, plantingGroups, zoneShapesVisible, shrubScore, scoreEventKeys, scoreMilestones]);

  // Filtered and sorted plants for the library
  const filteredPlants = useMemo(() => sortPlants(filterPlants(plants, filters), sortBy), [plants, filters, sortBy]);
  const visiblePlants = useMemo(() => filteredPlants.slice(0, visiblePlantLimit), [filteredPlants, visiblePlantLimit]);
  const hasMoreVisiblePlants = visiblePlantLimit < filteredPlants.length;

  const handleSelectPlantFromLibrary = useCallback((plant: Plant) => {
    const nextPlant = selectedPlant?.id === plant.id ? null : plant;
    setPlacingRock(false);
    setSelectedPlant(nextPlant);
    setSelectedInstanceId(null);
    setSelectedInstanceIds([]);
    addTestLog('library.plantSelected', {
      plantId: plant.id,
      plantName: plant.commonName || plant.botanicalName,
      selected: !!nextPlant,
      state: getDebugStateSummary(),
    });
  }, [selectedPlant, addTestLog, getDebugStateSummary]);

  const handleSelectPlacedPlant = useCallback((instanceId: string | null) => {
    if (selectedInstanceId === instanceId && selectedInstanceIds.length <= 1) return;
    setSelectedInstanceId(instanceId);
    setSelectedInstanceIds(instanceId ? [instanceId] : []);
    if (instanceId) setRightInspectorSection('item');
    const placed = placedPlants.find(item => item.instanceId === instanceId);
    addTestLog('selection.placedPlant', {
      instanceId,
      selectedCount: instanceId ? 1 : 0,
      plantId: placed?.plantId || null,
      itemType: placed?.itemType || 'plant',
      zone: placed?.zone || '',
      x: placed?.x,
      y: placed?.y,
      state: getDebugStateSummary(),
    });
  }, [selectedInstanceId, selectedInstanceIds.length, placedPlants, addTestLog, getDebugStateSummary]);

  const handleSelectMultiplePlacedPlants = useCallback((instanceIds: string[]) => {
    setSelectedInstanceIds(instanceIds);
    setSelectedInstanceId(instanceIds[0] || null);
    if (instanceIds.length > 0) setRightInspectorSection('item');
    setSelectedPlant(null);
    setPlacingRock(false);
    addTestLog('selection.marquee', {
      selectedCount: instanceIds.length,
      instanceIds: instanceIds.slice(0, 40),
    });
  }, [addTestLog]);


  const handleSelectZone = useCallback((zoneId: string | null) => {
    if (zoneId) setSelectedInstanceIds([]);
    if (selectedZoneId === zoneId) return;
    setSelectedZoneId(zoneId);
    if (zoneId) setRightInspectorSection('zones');
    const zone = zones.find(item => item.id === zoneId);
    addTestLog('selection.zone', {
      zoneId,
      zoneName: zone?.name || null,
      zoneType: zone?.zoneType || null,
      points: zone?.points.length || 0,
      state: getDebugStateSummary(),
    });
  }, [selectedZoneId, zones, addTestLog, getDebugStateSummary]);

  const handleFiltersChange = useCallback((nextFilters: FilterState) => {
    setFilters(nextFilters);
    setSearchInput(nextFilters.search || '');
    const activeFilters = Object.entries(nextFilters).filter(([key, value]) => key !== 'search' && key !== 'greenAcresOnly' && (value === true || (typeof value === 'string' && value !== ''))).length;
    if (activeFilters > 0) awardScore(`filters:${JSON.stringify(nextFilters)}`, 5, pickMessage(FILTER_MESSAGES, JSON.stringify(nextFilters)));
    addTestLog('library.filtersChanged', { filters: nextFilters });
  }, [addTestLog, awardScore]);

  useEffect(() => {
    if (searchInput === filters.search) return;
    const timeout = window.setTimeout(() => {
      handleFiltersChange({ ...filters, search: searchInput });
      setVisiblePlantLimit(120);
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [searchInput, filters, handleFiltersChange]);

  useEffect(() => {
    setVisiblePlantLimit(120);
  }, [filters.category, filters.floweringOnly, filters.goodPollinatorOnly, filters.hideHighMessiness, filters.easyMaintenance, filters.highWaterwise, filters.waterLowOnly, filters.waterMediumOnly, filters.waterHighOnly, filters.hideLargeTrees, filters.lowGrowingOnly, filters.under4FeetTall, filters.under6FeetWide, sortBy]);

  const handleSortChange = useCallback((nextSort: SortOption) => {
    setSortBy(nextSort);
    addTestLog('library.sortChanged', { sortBy: nextSort });
  }, [addTestLog]);

  const handleBackgroundImageChange = useCallback((image: string | null) => {
    setBackgroundImage(image);
    setRestoreBackgroundOnLaunch(false);
    addTestLog('background.imageChanged', { hasImage: !!image });
  }, [addTestLog]);

  const handleBackgroundOpacityChange = useCallback((opacity: number) => {
    setBackgroundOpacity(opacity);
    addTestLog('background.opacityChanged', { opacity });
  }, [addTestLog]);

  const handleBackgroundLockedChange = useCallback((locked: boolean) => {
    setBackgroundLocked(locked);
    addTestLog('background.lockedChanged', { locked });
  }, [addTestLog]);

  const handleSetScale = useCallback((nextPixelsPerFoot: number) => {
    setPixelsPerFoot(nextPixelsPerFoot);
    addTestLog('scale.set', { pixelsPerFoot: nextPixelsPerFoot });
  }, [addTestLog]);

  const handleCanvasSizeChange = useCallback((size: { width: number; height: number }) => {
    setCanvasSize(size);
    addTestLog('canvas.sizeChanged', { size });
  }, [addTestLog]);

  const handleCanvasWorldSizeChange = useCallback((size: { width: number; height: number }) => {
    setCanvasWorldSize(size);
    setCanvasSize(size);
    addTestLog('canvas.worldSizeChanged', { size });
  }, [addTestLog]);

  const handleZoomChange = useCallback((nextZoom: number) => {
    setZoom(nextZoom);
    addTestLog('canvas.zoomChanged', { zoom: nextZoom });
  }, [addTestLog]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const key = event.key.toLowerCase();
      const wantsZoom = event.ctrlKey || event.metaKey;
      if (!wantsZoom) return;

      if (key === '+' || key === '=') {
        event.preventDefault();
        setZoom(current => Math.min(3, Math.round((current + 0.1) * 100) / 100));
      } else if (key === '-' || key === '_') {
        event.preventDefault();
        setZoom(current => Math.max(0.2, Math.round((current - 0.1) * 100) / 100));
      } else if (key === '0') {
        event.preventDefault();
        setZoom(1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handlePlantCircleOpacityChange = useCallback((opacity: number) => {
    setPlantCircleOpacity(opacity);
    addTestLog('display.plantOpacityChanged', { opacity });
  }, [addTestLog]);

  const handlePlantLabelModeChange = useCallback((mode: PlantLabelMode) => {
    setPlantLabelMode(mode === 'initials' ? 'numbers' : mode);
    addTestLog('display.labelModeChanged', { mode });
  }, [addTestLog]);

  const handleGlobalDisplayModeChange = useCallback((mode: DisplayMode) => {
    const nextMode: DisplayMode = mode === 'imageLabel' ? 'image' : mode === 'symbolLabel' ? 'symbol' : mode;
    setGlobalDisplayMode(nextMode);
    setPlacedPlants(prev => prev.map(placed => (
      placed.itemType === 'rock' ? placed : { ...placed, displayMode: nextMode }
    )));
    addTestLog('display.globalDisplayModeChanged', { mode: nextMode });
  }, [addTestLog]);

  const handlePlantClumpingEnabledChange = useCallback((enabled: boolean) => {
    setPlantClumpingEnabled(enabled);
    addTestLog('display.plantClumpingChanged', { enabled, strength: plantClumpStrength });
  }, [addTestLog, plantClumpStrength]);

  const handlePlantClumpStrengthChange = useCallback((strength: PlantClumpStrength) => {
    setPlantClumpStrength(strength);
    addTestLog('display.plantClumpStrengthChanged', { enabled: plantClumpingEnabled, strength });
  }, [addTestLog, plantClumpingEnabled]);

  const handleZoneShapesVisibleChange = useCallback((visible: boolean) => {
    setZoneShapesVisible(visible);
    addTestLog('zones.visibilityChanged', { visible });
  }, [addTestLog]);

  const handleCancelPlantPlacement = useCallback(() => {
    addTestLog('placement.cancelled', {
      selectedPlantId: selectedPlant?.id || null,
      placingRock,
      state: getDebugStateSummary(),
    });
    setSelectedPlant(null);
    setPlacingRock(false);
  }, [selectedPlant, placingRock, addTestLog, getDebugStateSummary]);

  const getNextRockRotation = useCallback(() => {
    // Rocks can stay fully random because they are decorative objects, not plant catalog items.
    return Math.round(Math.random() * 360);
  }, []);

  const getPlantPlacementRotation = useCallback((plantId: number, existingCount: number) => {
    // Keep the same exact plant on the same icon and color, but rotate repeated placements
    // so the plan does not look copy/pasted. Deterministic keeps saved/exported plans stable.
    const rotationSteps = [0, 18, -18, 36, -36, 72, -72, 108, -108, 144, -144, 180];
    const base = ((plantId * 37) % 360);
    const offset = rotationSteps[existingCount % rotationSteps.length];
    return ((base + offset) % 360 + 360) % 360;
  }, []);

  const getRandomRockColor = useCallback(() => {
    const shade = 92 + Math.floor(Math.random() * 90);
    const tint = Math.floor(Math.random() * 12) - 6;
    const r = Math.max(70, Math.min(185, shade + tint));
    const g = Math.max(70, Math.min(185, shade + Math.floor(tint / 2)));
    const b = Math.max(70, Math.min(185, shade - tint));
    return `rgb(${r}, ${g}, ${b})`;
  }, []);

  const handlePlaceRock = useCallback((x: number, y: number) => {
    const rockNumber = (nextRockIndexRef.current % 6) + 1;
    nextRockIndexRef.current += 1;

    const newRock: PlacedPlant = {
      instanceId: generateId(),
      itemType: 'rock',
      plantId: 0,
      x,
      y,
      zone: '',
      notes: '',
      displayMode: 'symbol',
      customColor: null,
      rotationDeg: getNextRockRotation(),
      rockSvg: `rocks-icons/rock${rockNumber}.svg`,
      rockSizeFt: 2,
      rockColor: getRandomRockColor(),
    };
    setPlacedPlants(prev => [...prev, newRock]);
    awardScore(`rock:${newRock.instanceId}`, 3, pickMessage(ROCK_MESSAGES, newRock.instanceId));
    addTestLog('rock.placed', { instanceId: newRock.instanceId, x, y, rockSvg: newRock.rockSvg, rockSizeFt: newRock.rockSizeFt });
  }, [getNextRockRotation, getRandomRockColor, addTestLog, awardScore]);

  // Plant placement handlers
  const handlePlacePlant = useCallback((plantId: number, x: number, y: number) => {
    const instanceId = generateId();
    const plant = plants.find(p => p.id === plantId);
    const plantCountBefore = placedPlants.filter(item => (item.itemType || 'plant') === 'plant').length;
    setPlacedPlants(prev => {
      const existingCount = prev.filter(p => (p.itemType || 'plant') === 'plant' && p.plantId === plantId).length;
      const newPlaced: PlacedPlant = {
        instanceId,
        itemType: 'plant',
        plantId,
        x,
        y,
        zone: '',
        notes: '',
        displayMode: plant ? globalDisplayMode : 'color',
        customColor: null,
        rotationDeg: getPlantPlacementRotation(plantId, existingCount),
      };
      addTestLog('plant.placed', { instanceId, plantId, x, y, displayMode: newPlaced.displayMode });
      return [...prev, newPlaced];
    });
    if (plantCountBefore === 0) awardScore('first-plant', 25, 'A suspicious amount of progress.');
    if ((plant?.category || '').toLowerCase().includes('shrub')) {
      awardScore(`shrub:${instanceId}`, 7, pickMessage(SHRUB_MESSAGES, instanceId));
    } else {
      awardScore(`plant:${instanceId}`, 5, pickMessage(PLANT_MESSAGES, instanceId));
    }
  }, [plants, placedPlants, getPlantPlacementRotation, addTestLog, awardScore]);

  const handleMovePlacedPlant = useCallback((instanceId: string, x: number, y: number) => {
    const before = placedPlants.find(item => item.instanceId === instanceId);
    setPlacedPlants(prev =>
      prev.map(p => (p.instanceId === instanceId ? { ...p, x, y } : p))
    );

    const previousMoveLog = moveLogThrottleRef.current[instanceId];
    const now = Date.now();
    const movedEnough = !previousMoveLog || Math.hypot(x - previousMoveLog.x, y - previousMoveLog.y) > 24;
    const waitedEnough = !previousMoveLog || now - previousMoveLog.timestamp > 700;
    if (movedEnough || waitedEnough) {
      moveLogThrottleRef.current[instanceId] = { timestamp: now, x, y };
      addTestLog('plant.moved', {
        instanceId,
        plantId: before?.plantId || null,
        itemType: before?.itemType || 'plant',
        from: before ? { x: before.x, y: before.y } : null,
        to: { x, y },
        zone: before?.zone || '',
      });
      const lastMoveScore = moveScoreCooldownRef.current[instanceId] || 0;
      if (now - lastMoveScore > 30000) {
        moveScoreCooldownRef.current[instanceId] = now;
        awardScore(`move:${instanceId}:${Math.floor(now / 30000)}`, 1, 'The plant has been relocated.');
      }
    }
  }, [placedPlants, addTestLog, awardScore]);

  const handleUpdatePlacedPlant = useCallback((instanceId: string, updates: Partial<PlacedPlant>) => {
    const before = placedPlants.find(item => item.instanceId === instanceId);

    setPlacedPlants(prev => {
      const selected = prev.find(item => item.instanceId === instanceId);
      if (!selected) return prev;

      if (updates.customColor !== undefined && selected.itemType !== 'rock') {
        return prev.map(item => {
          if (item.instanceId === instanceId) {
            return { ...item, ...updates };
          }

          if (item.itemType !== 'rock' && item.plantId === selected.plantId) {
            return {
              ...item,
              customColor: updates.customColor ?? null,
            };
          }

          return item;
        });
      }

      return prev.map(item =>
        item.instanceId === instanceId
          ? { ...item, ...updates }
          : item
      );
    });

    if (updates.displayWidthFt !== undefined || updates.rockSizeFt !== undefined) awardScore(`resize:${instanceId}:${updates.displayWidthFt ?? updates.rockSizeFt}`, 10, 'Mature size acknowledged.');
    if (updates.customColor !== undefined) awardScore(`color:${instanceId}:${updates.customColor}`, 2, 'The botanical mood has shifted.');
    addTestLog('plant.updated', {
      instanceId,
      plantId: before?.plantId || null,
      itemType: before?.itemType || 'plant',
      updates,
      before,
    });
  }, [placedPlants, addTestLog, awardScore]);

  const handleAddZone = useCallback((zone: Omit<GardenZone, 'id' | 'name' | 'color' | 'opacity' | 'visible'>) => {
    const palette = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#14b8a6', '#eab308', '#ef4444', '#84cc16'];
    const color = palette[zones.length % palette.length];
    const newZone: GardenZone = {
      id: generateId(),
      name: `Zone ${zones.length + 1}`,
      color,
      opacity: 0.10,
      visible: true,
      zoneType: 'planting',
      sunExposure: 'unknown',
      sunNotes: '',
      waterNeed: 'noPreference',
      afternoonSun: 'unknown',
      plantingStyles: [],
      density: 50,
      plantingSeed: Math.floor(Math.random() * 99999),
      layoutMode: 'fill',
      plantingType: 'mixedBorder',
      plantVariety: 'medium',
      edgeRoles: { front: [], back: [] },
      plantingGroupId: '',
      plantingGroupName: '',
      notes: '',
      ...zone,
    };
    setZones(prev => [...prev, newZone]);
    setSelectedZoneId(newZone.id);
    setSelectedInstanceId(null);
    awardScore(`zone:${newZone.id}`, 30, 'You are now responsible for this dirt.');
    addTestLog('zone.added', { zoneId: newZone.id, name: newZone.name, points: newZone.points.length });
  }, [zones.length, addTestLog, awardScore]);

  const handleUpdateZone = useCallback((zoneId: string, updates: Partial<GardenZone>) => {
    const before = zones.find(zone => zone.id === zoneId);
    setZones(prev => prev.map(zone => zone.id === zoneId ? { ...zone, ...updates } : zone));
    if (updates.name && updates.name !== before?.name) awardScore(`zone-rename:${zoneId}:${updates.name}`, 10, 'The dirt has a name now.');
    if (updates.edgeRoles && JSON.stringify(updates.edgeRoles) !== JSON.stringify(before?.edgeRoles || { front: [], back: [] })) {
      const frontCount = updates.edgeRoles.front?.length || 0;
      const backCount = updates.edgeRoles.back?.length || 0;
      awardScore(`zone-edges:${zoneId}:${frontCount}:${backCount}`, 10, 'Front and back edges: because plants apparently need seating assignments.');
    }
    if (updates.plantingType && updates.plantingType !== before?.plantingType) {
      awardScore(`zone-planting-type:${zoneId}:${updates.plantingType}`, 5, 'The dirt has received a job title.');
    }
    addTestLog('zone.updated', { zoneId, updates });
  }, [addTestLog, awardScore, zones]);

  const handleDeleteZone = useCallback((zoneId: string) => {
    setZones(prev => prev.filter(zone => zone.id !== zoneId));
    setPlacedPlants(prev => prev.map(item => item.zone === zoneId ? { ...item, zone: '' } : item));
    setSelectedZoneId(prev => prev === zoneId ? null : prev);
    addTestLog('zone.deleted', { zoneId });
  }, [addTestLog]);

  const handleDuplicateZone = useCallback((zoneId: string) => {
    const original = zones.find(zone => zone.id === zoneId);
    if (!original) return;
    const copy: GardenZone = {
      ...original,
      id: generateId(),
      name: `${original.name} copy`,
      points: original.points.map(point => ({ x: point.x + 28, y: point.y + 28 })),
    };
    setZones(prev => [...prev, copy]);
    setSelectedZoneId(copy.id);
    addTestLog('zone.duplicated', { originalId: zoneId, copyId: copy.id, points: copy.points.length });
  }, [zones, addTestLog]);

  const handleDeletePlacedPlant = useCallback((instanceId: string) => {
    const before = placedPlants.find(item => item.instanceId === instanceId);
    setPlacedPlants(prev => prev.filter(p => p.instanceId !== instanceId));
    if (selectedInstanceId === instanceId) {
      setSelectedInstanceId(null);
    }
    setSelectedInstanceIds(prev => prev.filter(id => id !== instanceId));
    addTestLog('plant.deleted', {
      instanceId,
      plantId: before?.plantId || null,
      itemType: before?.itemType || 'plant',
      zone: before?.zone || '',
    });
  }, [selectedInstanceId, placedPlants, addTestLog]);

  const handleClearPlacedPlants = useCallback(() => {
    const plantCount = placedPlants.filter(item => (item.itemType || 'plant') === 'plant').length;
    if (plantCount === 0) return;
    setPlacedPlants(prev => prev.filter(item => item.itemType === 'rock'));
    setSelectedInstanceId(null);
    setSelectedInstanceIds([]);
    addTestLog('plants.cleared', { removedPlants: plantCount, keptRocks: placedPlants.length - plantCount });
  }, [placedPlants, addTestLog]);

  const handleDuplicatePlacedPlant = useCallback((instanceId: string) => {
    const original = placedPlants.find(p => p.instanceId === instanceId);
    if (!original) return;

    setPlacedPlants(prev => {
      const isRock = original.itemType === 'rock';
      const existingCount = prev.filter(p => (p.itemType || 'plant') === 'plant' && p.plantId === original.plantId).length;
      const newPlaced: PlacedPlant = {
        ...original,
        instanceId: generateId(),
        x: original.x + 30,
        y: original.y + 30,
        rotationDeg: isRock ? getNextRockRotation() : getPlantPlacementRotation(original.plantId, existingCount),
        rockColor: isRock ? getRandomRockColor() : original.rockColor,
      };
      awardScore(`duplicate:${newPlaced.instanceId}`, 3, 'Repetition is design.');
      addTestLog('plant.duplicated', {
        originalInstanceId: instanceId,
        newInstanceId: newPlaced.instanceId,
        plantId: newPlaced.plantId,
        itemType: newPlaced.itemType || 'plant',
        from: { x: original.x, y: original.y },
        to: { x: newPlaced.x, y: newPlaced.y },
      });
      return [...prev, newPlaced];
    });
  }, [placedPlants, getNextRockRotation, getPlantPlacementRotation, getRandomRockColor, addTestLog, awardScore]);
  const handleCopySelectedPlacedPlants = useCallback(() => {
    const ids = selectedInstanceIds.length > 0
      ? selectedInstanceIds
      : selectedInstanceId
        ? [selectedInstanceId]
        : [];
    if (ids.length === 0) return false;

    const selected = ids
      .map(id => placedPlants.find(item => item.instanceId === id))
      .filter((item): item is PlacedPlant => Boolean(item));
    if (selected.length === 0) return false;

    copiedPlacedPlantsRef.current = selected.map(item => ({ ...item }));
    pasteGenerationRef.current = 0;
    setCommentaryMessage(selected.length === 1 ? 'Copy, paste, shrub.' : 'Many duplicates are now possible.');
    addTestLog('selection.copied', { count: selected.length, instanceIds: ids });
    return true;
  }, [selectedInstanceIds, selectedInstanceId, placedPlants, addTestLog]);

  const handlePasteCopiedPlacedPlants = useCallback(() => {
    const copied = copiedPlacedPlantsRef.current;
    if (copied.length === 0) return false;

    pasteGenerationRef.current += 1;
    const pixelsPerDesignFoot = pixelsPerFoot || 20;
    const largestDiameterPx = copied.reduce((largest, item) => {
      if (item.itemType === 'rock') return Math.max(largest, (item.rockSizeFt || 2) * pixelsPerDesignFoot);
      const plant = plants.find(candidate => candidate.id === item.plantId);
      const widthFt = item.displayWidthFt || plant?.matureWidthFt || plant?.minimumSpacingFt || 2;
      return Math.max(largest, widthFt * pixelsPerDesignFoot);
    }, 0);
    const offset = Math.max(36, largestDiameterPx + 16) * pasteGenerationRef.current;
    const clones = copied.map(item => ({
      ...item,
      instanceId: generateId(),
      x: item.x + offset,
      y: item.y + offset,
    }));
    const newIds = clones.map(item => item.instanceId);

    setPlacedPlants(prev => [...prev, ...clones]);
    setSelectedInstanceIds(newIds);
    setSelectedInstanceId(newIds[0] || null);
    if (newIds.length > 0) setRightInspectorSection('item');
    setCommentaryMessage(newIds.length === 1 ? 'Repetition is design.' : 'Several plants have entered the situation.');
    addTestLog('selection.pasted', { count: newIds.length, newInstanceIds: newIds, offset });
    return true;
  }, [pixelsPerFoot, plants, addTestLog]);

  useEffect(() => {
    const onClipboardKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return;
      if (!(event.ctrlKey || event.metaKey)) return;

      const key = event.key.toLowerCase();
      if (key === 'c') {
        if (handleCopySelectedPlacedPlants()) event.preventDefault();
      } else if (key === 'v') {
        if (handlePasteCopiedPlacedPlants()) event.preventDefault();
      }
    };

    window.addEventListener('keydown', onClipboardKeyDown);
    return () => window.removeEventListener('keydown', onClipboardKeyDown);
  }, [handleCopySelectedPlacedPlants, handlePasteCopiedPlacedPlants]);



  const handleCreatePlantingGroup = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newGroup: PlantingGroup = {
      id: generateId(),
      name: trimmed,
      notes: '',
      plantIds: [],
    };
    setPlantingGroups(prev => [...prev, newGroup]);
    addTestLog('plantingGroup.created', { groupId: newGroup.id, name: newGroup.name });
  }, [addTestLog]);

  const handleUpdatePlantingGroup = useCallback((groupId: string, updates: Partial<PlantingGroup>) => {
    setPlantingGroups(prev => prev.map(group => group.id === groupId ? { ...group, ...updates } : group));
    addTestLog('plantingGroup.updated', { groupId, updates });
  }, [addTestLog]);

  const handleDeletePlantingGroup = useCallback((groupId: string) => {
    setPlantingGroups(prev => prev.filter(group => group.id !== groupId));
    setZones(prev => prev.map(zone => zone.plantingGroupId === groupId ? { ...zone, plantingGroupId: '', plantingGroupName: '' } : zone));
    addTestLog('plantingGroup.deleted', { groupId });
  }, [addTestLog]);

  const handleAddPlantToGroup = useCallback((groupId: string, plantId: number) => {
    setPlantingGroups(prev => prev.map(group => {
      if (group.id !== groupId || group.plantIds.includes(plantId)) return group;
      return { ...group, plantIds: [...group.plantIds, plantId] };
    }));
    addTestLog('plantingGroup.plantAdded', { groupId, plantId });
  }, [addTestLog]);

  const handleRemovePlantFromGroup = useCallback((groupId: string, plantId: number) => {
    setPlantingGroups(prev => prev.map(group => group.id === groupId ? { ...group, plantIds: group.plantIds.filter(id => id !== plantId) } : group));
    addTestLog('plantingGroup.plantRemoved', { groupId, plantId });
  }, [addTestLog]);

  const handleGenerateZoneLayout = useCallback((zoneId: string) => {
    const zone = zones.find(item => item.id === zoneId);
    if (!zone || zone.zoneType === 'exclusion' || zone.points.length < 3) {
      addTestLog('generator.failed', { zoneId, reason: 'invalid_zone' });
      alert('Select a planting zone with at least 3 points first.');
      return;
    }

    const group = plantingGroups.find(item => item.id === zone.plantingGroupId);
    const groupPlants = group
      ? group.plantIds.map(plantId => plants.find(plant => plant.id === plantId)).filter((plant): plant is Plant => !!plant)
      : [];

    const availablePlants = groupPlants.length > 0 ? groupPlants : pickAutoPlants(plants, zone);

    if (availablePlants.length === 0) {
      addTestLog('generator.failed', { zoneId: zone.id, zoneName: zone.name, reason: 'no_available_plants', hasGroup: !!group });
      alert('No plants were available for this zone. Assign a planting group or loosen the zone filters.');
      return;
    }

    const summarizePlantsForLog = (items: Plant[]) => items.slice(0, 40).map(plant => ({
      id: plant.id,
      name: plant.commonName || plant.botanicalName,
      category: plant.category,
      matureHeightFt: plant.matureHeightFt,
      matureWidthFt: plant.matureWidthFt,
      waterwiseRating: plant.waterwiseRating,
      greenAcresMatch: plant.greenAcresMatch,
      researchRoles: plant.greenAcresResearch?.roles ? {
        poolPlanter: plant.greenAcresResearch.roles.poolPlanter?.score,
        slopePlanting: plant.greenAcresResearch.roles.slopePlanting?.score,
        flowerBed: plant.greenAcresResearch.roles.flowerBed?.score,
        hedgeRow: plant.greenAcresResearch.roles.hedgeRow?.score,
        grassDrift: plant.greenAcresResearch.roles.grassDrift?.score,
        rockGarden: plant.greenAcresResearch.roles.rockGarden?.score,
      } : undefined,
      researchBehaviors: plant.greenAcresResearch?.behaviors ? {
        messiness: plant.greenAcresResearch.behaviors.messiness,
        evergreenPresence: plant.greenAcresResearch.behaviors.evergreenPresence,
        beeDraw: plant.greenAcresResearch.behaviors.beeDraw,
        poolAccentOnly: plant.greenAcresResearch.behaviors.poolAccentOnly,
        slopeAccentOnly: plant.greenAcresResearch.behaviors.slopeAccentOnly,
      } : undefined,
      researchSources: plant.greenAcresResearch?.sourceTags,
      communityRole: getCommunityRole(plant, zone.plantingType),
    }));

    const seed = zone.plantingSeed ?? Math.floor(Math.random() * 99999);
    const layoutMode: ZoneLayoutMode = zone.layoutMode || 'fill';
    const density = Math.max(5, Math.min(100, zone.density ?? 50));
    const random = seededRandom(seed + zone.id.length * 997);
    const bounds = polygonBounds(zone.points);
    const zoneAreaPx = polygonArea(zone.points);
    const centroid = polygonCentroid(zone.points);
    const defaultPixelsPerFoot = pixelsPerFoot || 20;
    const generatorPalette = groupPlants.length > 0 ? availablePlants : buildGeneratorPalette(availablePlants, zone, layoutMode, random);
    const chooseGeneratorPlant = (items: Plant[] = generatorPalette) => weightedSeededChoice(items, random, plant => computeGeneratorScore(plant, zone));

    // Default behavior: regenerate this zone from scratch. This avoids old generated plants blocking new layouts.
    const retainedPlantPoints = placedPlants
      .filter(item => (item.itemType || 'plant') === 'plant' && item.zone !== zone.id)
      .map(item => ({ x: item.x, y: item.y, plantId: item.plantId }));

    const plantArea = (plant: Plant) => {
      const widthFt = Math.max(0.75, getDesignWidthFt(plant, zone));
      const diameter = widthFt * defaultPixelsPerFoot;
      return Math.PI * Math.pow(diameter / 2, 2);
    };

    const averagePlantAreaPx = generatorPalette.reduce((sum, plant) => sum + plantArea(plant), 0) / generatorPalette.length;
    const densityFactor = density / 100;
    const plantingTypeFactor = getPlantingTypeMultiplier(zone);
    const hasFrontBackEdges = zoneHasMarkedEdges(zone);
    const perimeter = polygonPerimeter(zone.points);
    const exclusionZones = zones.filter(item => item.zoneType === 'exclusion' && item.points.length >= 3);
    const exclusionAreaPx = exclusionZones.reduce((sum, exclusion) => {
      const exclusionCentroid = polygonCentroid(exclusion.points);
      return pointInPolygon(exclusionCentroid, zone.points) ? sum + polygonArea(exclusion.points) : sum;
    }, 0);
    const usableZoneAreaPx = Math.max(zoneAreaPx * 0.12, zoneAreaPx - exclusionAreaPx);
    const targetCoverageAreaPx = usableZoneAreaPx * densityFactor * plantingTypeFactor * getDensityVisualMultiplier(density);
    const visualCoverageCalibration = getVisualCoverageCalibration(zone, layoutMode);
    const effectivePlantAreaPx = Math.max(120, averagePlantAreaPx * visualCoverageCalibration);
    const recipe = getPlantingRecipe(zone.plantingType);
    const plantVariety = getZonePlantVariety(zone);
    const varietySettings = getPlantVarietySettings(zone);
    const maxGeneratedPlants = Math.round((recipe?.maxPlants ?? 160) * varietySettings.targetScale);
    const rawBaseTargetCount = Math.max(1, Math.min(maxGeneratedPlants, Math.round((targetCoverageAreaPx / effectivePlantAreaPx) * varietySettings.targetScale)));
    const baseTargetCount = clampByRecipe(rawBaseTargetCount, zone, usableZoneAreaPx, defaultPixelsPerFoot);
    const generated: PlacedPlant[] = [];
    const rejectionCounts: Record<string, number> = {};
    let intendedTargetCount = baseTargetCount;
    let latestCandidatePoints: Point[] = [];

    const reject = (reason: string) => {
      rejectionCounts[reason] = (rejectionCounts[reason] || 0) + 1;
      return true;
    };

    const getPointLayer = (point: Point): 'front' | 'middle' | 'back' | 'none' => {
      if (!hasFrontBackEdges) return 'none';
      const distances = getZoneEdgeDistances(point, zone);
      if (!Number.isFinite(distances.front) && !Number.isFinite(distances.back)) return 'none';
      if (!Number.isFinite(distances.back)) return distances.front < Math.max(52, defaultPixelsPerFoot * 4) ? 'front' : 'middle';
      if (!Number.isFinite(distances.front)) return distances.back < Math.max(60, defaultPixelsPerFoot * 5) ? 'back' : 'middle';
      const total = Math.max(1, distances.front + distances.back);
      const frontRatio = distances.front / total;
      const backRatio = distances.back / total;
      if (frontRatio <= 0.38) return 'front';
      if (backRatio <= 0.38) return 'back';
      return 'middle';
    };

    const frontBackAllowsPlant = (plant: Plant, point: Point) => {
      if (!hasFrontBackEdges || zone.plantingType === 'hedgeRow') return true;
      const role = getPlantHeightRole(plant);
      const layer = getPointLayer(point);
      const type = zone.plantingType || 'mixedBorder';
      if (type === 'flowerBed') {
        if (layer === 'front' && role !== 'low') return !reject('non_low_in_flower_front');
        if (layer === 'middle' && role === 'tall') return !reject('tall_in_flower_middle');
        if (layer === 'back' && role === 'low') return !reject('low_near_back');
        return true;
      }
      if ((type === 'mixedBorder' || type === 'poolPlanter') && layer === 'front' && role === 'tall') return !reject('tall_near_front');
      if ((type === 'mixedBorder' || type === 'poolPlanter') && layer === 'back' && role === 'low') return !reject('low_near_back');
      return true;
    };

    const scorePointForPlant = (plant: Plant, point: Point) => {
      if (!hasFrontBackEdges || zone.plantingType === 'hedgeRow') return 1;
      const role = getPlantHeightRole(plant);
      const layer = getPointLayer(point);
      let score = 1;
      if (layer === 'front') {
        if (role === 'low') score += 5;
        if (role === 'medium') score += 1.4;
        if (role === 'tall') score *= 0.08;
      }
      if (layer === 'middle') {
        if (role === 'medium') score += 3.2;
        if (role === 'low') score += 0.7;
        if (role === 'tall') score += 0.9;
      }
      if (layer === 'back') {
        if (role === 'tall') score += 6;
        if (role === 'medium') score += 2.3;
        if (role === 'low') score *= 0.1;
      }
      return score;
    };

    const plantsForPointLayer = (point: Point, items: Plant[] = generatorPalette) => {
      if (!hasFrontBackEdges || zone.plantingType === 'hedgeRow') return items;
      const layer = getPointLayer(point);
      const type = zone.plantingType || 'mixedBorder';
      if (!(type === 'flowerBed' || type === 'mixedBorder' || type === 'poolPlanter')) return items;
      const filtered = items.filter(plant => {
        const role = getPlantHeightRole(plant);
        if (type === 'flowerBed' && layer === 'front') return role === 'low';
        if (type === 'flowerBed' && layer === 'middle') return role !== 'tall';
        if (type === 'flowerBed' && layer === 'back') return role !== 'low';
        if (layer === 'front') return role !== 'tall';
        if (layer === 'back') return role !== 'low';
        return true;
      });
      return filtered.length > 0 ? filtered : items;
    };

    const chooseGeneratorPlantForPoint = (point: Point, items: Plant[] = generatorPalette) => {
      const layeredItems = plantsForPointLayer(point, items);
      return weightedSeededChoice(layeredItems, random, plant => computeGeneratorScore(plant, zone) * scorePointForPlant(plant, point));
    };

    const isBlocked = (point: Point, radiusPx: number, options: { edgeOnly?: boolean; allowNearEdge?: boolean; spacingFactor?: number } = {}) => {
      if (!pointInPolygon(point, zone.points)) return reject('outside_zone');
      if (exclusionZones.some(exclusion => pointInPolygon(point, exclusion.points))) return reject('inside_exclusion');

      const edgeDistance = distanceToPolygonEdge(point, zone.points);
      if (options.edgeOnly && edgeDistance > Math.max(14, radiusPx * 1.35)) return reject('too_far_from_edge');
      if (!options.edgeOnly && !options.allowNearEdge && edgeDistance < Math.max(2, radiusPx * 0.12)) return reject('too_close_to_edge');

      const allPoints = [
        ...retainedPlantPoints,
        ...generated.map(item => ({ x: item.x, y: item.y, plantId: item.plantId })),
      ];

      const blockedBySpacing = allPoints.some(other => {
        const otherPlant = plants.find(plant => plant.id === other.plantId);
        const otherRadius = ((otherPlant ? getDesignWidthFt(otherPlant, zone) : 3) * defaultPixelsPerFoot) / 2;
        const minDistance = Math.max(10, (radiusPx + otherRadius) * (options.spacingFactor ?? 0.88));
        return Math.hypot(point.x - other.x, point.y - other.y) < minDistance;
      });
      if (blockedBySpacing) return reject('too_close_to_plant');
      return false;
    };

    const makePlacedPlant = (plant: Plant, point: Point, existingCountOffset = 0): PlacedPlant => {
      const existingCount = placedPlants.filter(item => (item.itemType || 'plant') === 'plant' && item.plantId === plant.id && item.zone !== zone.id).length + existingCountOffset;
      const displayWidthFt = getGeneratedDisplayWidthFt(plant, zone);
      return {
        instanceId: generateId(),
        itemType: 'plant',
        plantId: plant.id,
        x: point.x,
        y: point.y,
        zone: zone.id,
        notes: `Generated from ${zone.name}, seed ${seed}`,
        displayMode: globalDisplayMode,
        customColor: null,
        rotationDeg: getPlantPlacementRotation(plant.id, existingCount),
        ...(displayWidthFt ? { displayWidthFt } : {}),
      };
    };

    const makePlacedRock = (point: Point, rockIndex: number): PlacedPlant => {
      const rockNumber = (rockIndex % 6) + 1;
      const shade = 92 + Math.floor(random() * 90);
      const tint = Math.floor(random() * 12) - 6;
      const r = Math.max(70, Math.min(185, shade + tint));
      const g = Math.max(70, Math.min(185, shade + Math.floor(tint / 2)));
      const b = Math.max(70, Math.min(185, shade - tint));
      const sizeRoll = random();
      const rockSizeFt = sizeRoll > 0.82 ? 4 : sizeRoll > 0.45 ? 3 : 2;
      return {
        instanceId: generateId(),
        itemType: 'rock',
        plantId: 0,
        x: point.x,
        y: point.y,
        zone: zone.id,
        notes: `Generated rock anchor from ${zone.name}, seed ${seed}`,
        displayMode: 'symbol',
        customColor: null,
        rotationDeg: Math.round(random() * 360),
        rockSvg: `rocks-icons/rock${rockNumber}.svg`,
        rockSizeFt,
        rockColor: `rgb(${r}, ${g}, ${b})`,
      };
    };

    const addRockCandidate = (point: Point, rockIndex: number) => {
      const probe = makePlacedRock(point, rockIndex);
      const radiusPx = ((probe.rockSizeFt || 2) * defaultPixelsPerFoot) / 2;
      if (isBlocked(point, radiusPx, { allowNearEdge: true, spacingFactor: 0.72 })) return false;
      generated.push(probe);
      return true;
    };

    const addCandidate = (plant: Plant, point: Point, options: { edgeOnly?: boolean; allowNearEdge?: boolean; spacingFactor?: number } = {}) => {
      if (!group && generatorPalette.length > 1 && zone.plantingType !== 'hedgeRow') {
        const samePlantCount = generated.filter(item => item.itemType !== 'rock' && item.plantId === plant.id).length;
        const repeatLimit = zone.plantingType === 'flowerBed'
          ? Math.max(2, Math.ceil((intendedTargetCount || baseTargetCount) * 0.34))
          : zone.plantingType === 'grassDrift'
            ? Math.max(8, Math.ceil((intendedTargetCount || baseTargetCount) * 0.55))
            : zone.plantingType === 'slopePlanting'
              ? Math.max(6, Math.ceil((intendedTargetCount || baseTargetCount) * 0.42))
              : Math.max(1, Math.ceil((intendedTargetCount || baseTargetCount) * 0.34));
        if (samePlantCount >= repeatLimit) return !reject('too_many_repeats');
      }
      if (!frontBackAllowsPlant(plant, point)) return false;
      const radiusPx = (getDesignWidthFt(plant, zone) * defaultPixelsPerFoot) / 2;
      if (isBlocked(point, radiusPx, options)) return false;
      generated.push(makePlacedPlant(plant, point, generated.length));
      return true;
    };

    addTestLog('generator.started', {
      zoneId: zone.id,
      zoneName: zone.name,
      groupId: group?.id || null,
      groupName: group?.name || 'Auto-pick from catalog',
      groupPlantIds: group?.plantIds || [],
      autoPicked: !group,
      availablePlantIds: availablePlants.map(plant => plant.id).slice(0, 50),
      availablePlants: summarizePlantsForLog(availablePlants),
      generatorPaletteIds: generatorPalette.map(plant => plant.id),
      generatorPalette: summarizePlantsForLog(generatorPalette).map(item => ({
        ...item,
        generatorScore: computeGeneratorScore(generatorPalette.find(plant => plant.id === item.id)!, zone),
      })),
      zoneSettings: {
        sunExposure: zone.sunExposure,
        afternoonSun: zone.afternoonSun,
        waterNeed: zone.waterNeed,
        density: zone.density,
        plantVariety: zone.plantVariety || 'medium',
        layoutMode: zone.layoutMode,
        plantingType: zone.plantingType || 'mixedBorder',
        includeRocks: zone.includeRocks === true || zone.plantingType === 'rockGarden',
        edgeRoles: zone.edgeRoles || { front: [], back: [] },
        plantingSeed: zone.plantingSeed,
        plantingStyles: zone.plantingStyles,
      },
      existingPlantsInZone: placedPlants.filter(item => item.zone === zone.id).length,
      existingGeneratedInZone: placedPlants.filter(item => item.zone === zone.id && typeof item.notes === 'string' && item.notes.startsWith('Generated from ')).length,
      exclusionZoneCount: exclusionZones.length,
    });

    if (zone.plantingType === 'hedgeRow') {
      const hedgePlant = generatorPalette[0];
      const hedgeWidthPx = getDesignWidthFt(hedgePlant, zone) * defaultPixelsPerFoot;
      const roleEdges = zone.edgeRoles?.back?.length ? zone.edgeRoles.back : [];
      const longestEdgeIndex = zone.points.reduce((best, point, index) => {
        const currentLength = edgeLength(point, zone.points[(index + 1) % zone.points.length]);
        const bestLength = edgeLength(zone.points[best], zone.points[(best + 1) % zone.points.length]);
        return currentLength > bestLength ? index : best;
      }, 0);
      const edgeIndexes = roleEdges.length ? roleEdges : [longestEdgeIndex];
      const totalHedgeLength = edgeIndexes.reduce((sum, edgeIndex) => {
        const normalized = ((edgeIndex % zone.points.length) + zone.points.length) % zone.points.length;
        return sum + edgeLength(zone.points[normalized], zone.points[(normalized + 1) % zone.points.length]);
      }, 0);
      const hedgeCap = 48;
      // Hedge density means percent of the selected back edge visually covered by clipped hedge circles.
      // Plants are still distributed evenly across the full edge so 50% reads as an even row with gaps.
      const targetCoveredLength = totalHedgeLength * densityFactor;
      const hedgeTarget = Math.max(1, Math.min(hedgeCap, Math.round(targetCoveredLength / Math.max(hedgeWidthPx, 1))));
      intendedTargetCount = hedgeTarget;

      let allocated = 0;
      edgeIndexes.forEach((rawEdgeIndex, edgeListIndex) => {
        const edgeIndex = ((rawEdgeIndex % zone.points.length) + zone.points.length) % zone.points.length;
        const a = zone.points[edgeIndex];
        const b = zone.points[(edgeIndex + 1) % zone.points.length];
        const length = edgeLength(a, b);
        const remainingEdges = edgeIndexes.length - edgeListIndex - 1;
        const proportional = Math.round((length / Math.max(totalHedgeLength, 1)) * hedgeTarget);
        const countOnEdge = Math.max(remainingEdges > 0 ? 1 : 0, Math.min(hedgeTarget - allocated, proportional));
        allocated += countOnEdge;
        for (let i = 0; i < countOnEdge; i += 1) {
          const d = ((i + 0.5) / countOnEdge) * length;
          const basePoint = pointAlongEdge(a, b, d);
          const towardCenter = Math.atan2(centroid.y - basePoint.y, centroid.x - basePoint.x);
          const inward = Math.max(8, hedgeWidthPx * 0.45);
          addCandidate(hedgePlant, {
            x: basePoint.x + Math.cos(towardCenter) * inward,
            y: basePoint.y + Math.sin(towardCenter) * inward,
          }, { edgeOnly: true, allowNearEdge: true, spacingFactor: 0.32 });
        }
      });
    } else if (layoutMode === 'edge') {
      const avgWidthPx = Math.max(14, Math.sqrt(averagePlantAreaPx / Math.PI) * 2);
      const spacingPx = Math.max(22, avgWidthPx * (1.75 - densityFactor * 0.45));
      const edgeCap = zone.plantingType === 'poolPlanter' ? 16 : 28;
      const edgeTarget = Math.max(1, Math.min(edgeCap, Math.ceil(perimeter / spacingPx)));
      intendedTargetCount = edgeTarget;
      let remainingDistance = 0;
      for (let edgeIndex = 0; edgeIndex < zone.points.length; edgeIndex += 1) {
        const a = zone.points[edgeIndex];
        const b = zone.points[(edgeIndex + 1) % zone.points.length];
        const length = edgeLength(a, b);
        let d = remainingDistance;
        while (d <= length) {
          const basePoint = pointAlongEdge(a, b, d);
          const plant = chooseGeneratorPlantForPoint(basePoint);
          const towardCenter = Math.atan2(centroid.y - basePoint.y, centroid.x - basePoint.x);
          const jitter = (random() - 0.5) * spacingPx * 0.32;
          const inward = Math.max(8, (getDesignWidthFt(plant, zone) * defaultPixelsPerFoot) * 0.28);
          const along = Math.atan2(b.y - a.y, b.x - a.x);
          const point = {
            x: basePoint.x + Math.cos(towardCenter) * inward + Math.cos(along) * jitter,
            y: basePoint.y + Math.sin(towardCenter) * inward + Math.sin(along) * jitter,
          };
          addCandidate(plant, point, { edgeOnly: true, allowNearEdge: true, spacingFactor: 0.78 });
          d += spacingPx;
        }
        remainingDistance = d - length;
      }
      // If density is very high and spacing blocked a few, add a second offset pass.
      for (let attempt = 0; generated.length < edgeTarget && attempt < edgeTarget * 4; attempt += 1) {
        const edgeIndex = Math.floor(random() * zone.points.length);
        const a = zone.points[edgeIndex];
        const b = zone.points[(edgeIndex + 1) % zone.points.length];
        const basePoint = pointAlongEdge(a, b, random() * edgeLength(a, b));
        const plant = chooseGeneratorPlantForPoint(basePoint);
        const towardCenter = Math.atan2(centroid.y - basePoint.y, centroid.x - basePoint.x);
        const inward = Math.max(8, (getDesignWidthFt(plant, zone) * defaultPixelsPerFoot) * (0.22 + random() * 0.35));
        addCandidate(plant, { x: basePoint.x + Math.cos(towardCenter) * inward, y: basePoint.y + Math.sin(towardCenter) * inward }, { edgeOnly: true, allowNearEdge: true, spacingFactor: 0.72 });
      }
    } else if (layoutMode === 'cornerAnchors') {
      const anchorCount = Math.min(zone.points.length, Math.max(2, Math.round(zone.points.length * (0.45 + densityFactor * 0.55))));
      const supportPerCorner = density >= 80 ? 2 : density >= 45 ? 1 : 0;
      intendedTargetCount = anchorCount * (1 + supportPerCorner);
      const corners = [...zone.points]
        .map((point, index) => ({ point, index, sort: random() }))
        .sort((a, b) => a.sort - b.sort)
        .slice(0, anchorCount);

      corners.forEach(({ point: corner }, index) => {
        const plant = generatorPalette[index % generatorPalette.length];
        const towardCenter = Math.atan2(centroid.y - corner.y, centroid.x - corner.x);
        const radiusPx = (getDesignWidthFt(plant, zone) * defaultPixelsPerFoot) / 2;
        const anchorPoint = {
          x: corner.x + Math.cos(towardCenter) * Math.max(14, radiusPx * 0.78),
          y: corner.y + Math.sin(towardCenter) * Math.max(14, radiusPx * 0.78),
        };
        addCandidate(plant, anchorPoint, { allowNearEdge: true, spacingFactor: 0.82 });

        for (let support = 0; support < supportPerCorner; support += 1) {
          const supportPlant = chooseGeneratorPlant();
          const spreadAngle = towardCenter + (support === 0 ? 0.65 : -0.65) + (random() - 0.5) * 0.35;
          const distance = Math.max(18, radiusPx * (1.05 + random() * 0.45));
          addCandidate(supportPlant, {
            x: anchorPoint.x + Math.cos(spreadAngle) * distance,
            y: anchorPoint.y + Math.sin(spreadAngle) * distance,
          }, { allowNearEdge: true, spacingFactor: 0.72 });
        }
      });
    } else {
      const fillPlants = layoutMode === 'groundcoverFill'
        ? [...generatorPalette]
            .filter(plant => {
              const text = `${plant.category || ''} ${plant.commonName || ''} ${plant.botanicalName || ''}`.toLowerCase();
              return (
                text.includes('ground') ||
                text.includes('carpet') ||
                text.includes('myoporum') ||
                text.includes('juniper') ||
                text.includes('thyme') ||
                text.includes('sedum') ||
                text.includes('grevillea') ||
                text.includes('dwarf') ||
                ((plant.matureHeightFt || 99) <= 1.5 && (plant.matureWidthFt || 0) >= 1.2)
              );
            })
            .sort((a, b) => {
              const aScore = (a.matureWidthFt || 0) * 2 - (a.matureHeightFt || 0) + ((a.commonName || '').toLowerCase().includes('carpet') ? 4 : 0);
              const bScore = (b.matureWidthFt || 0) * 2 - (b.matureHeightFt || 0) + ((b.commonName || '').toLowerCase().includes('carpet') ? 4 : 0);
              return bScore - aScore;
            })
            .slice(0, Math.max(1, Math.min(5, generatorPalette.length)))
        : generatorPalette;

      const usableFillPlants = fillPlants.length > 0 ? fillPlants : generatorPalette.slice(0, Math.min(5, generatorPalette.length));
      const sortedWidthsFt = usableFillPlants
        .map(plant => getDesignWidthFt(plant, zone))
        .filter(width => width > 0)
        .sort((a, b) => a - b);
      const spacingBasisFt = Math.max(1.25, sortedWidthsFt[Math.floor(sortedWidthsFt.length / 2)] || 3);
      const fillSpacingMultiplier = layoutMode === 'groundcoverFill'
        ? (1.36 - densityFactor * 0.34)
        : zone.plantingType === 'flowerBed'
          ? (0.95 - densityFactor * 0.38)
          : zone.plantingType === 'grassDrift'
            ? (1.0 - densityFactor * 0.36)
            : (1.08 - densityFactor * 0.42);
      const spacingPx = Math.max(
        zone.plantingType === 'flowerBed' ? 9 : zone.plantingType === 'grassDrift' ? 12 : 16,
        spacingBasisFt * defaultPixelsPerFoot * fillSpacingMultiplier
      );
      const rowHeight = spacingPx * 0.82;
      const fillCap = zone.plantingType === 'poolPlanter' ? 48 : zone.plantingType === 'slopePlanting' ? 84 : zone.plantingType === 'rockGarden' ? 36 : zone.plantingType === 'flowerBed' ? 180 : zone.plantingType === 'grassDrift' ? 160 : 140;
      const targetCount = Math.min(fillCap, baseTargetCount);
      intendedTargetCount = targetCount;

      const candidates: Point[] = [];
      let row = 0;
      for (let y = bounds.minY; y <= bounds.maxY; y += rowHeight) {
        const offset = row % 2 === 0 ? 0 : spacingPx / 2;
        for (let x = bounds.minX + offset; x <= bounds.maxX; x += spacingPx) {
          const point = {
            x: x + (random() - 0.5) * spacingPx * (layoutMode === 'groundcoverFill' ? 0.18 : 0.28),
            y: y + (random() - 0.5) * rowHeight * (layoutMode === 'groundcoverFill' ? 0.18 : 0.28),
          };
          if (pointInPolygon(point, zone.points)) candidates.push(point);
        }
        row += 1;
      }
      candidates.sort(() => random() - 0.5);
      latestCandidatePoints = candidates;

      if (zone.plantingType === 'flowerBed' && hasFrontBackEdges) {
        const lowPlants = usableFillPlants.filter(plant => getPlantHeightRole(plant) === 'low');
        const mediumPlants = usableFillPlants.filter(plant => getPlantHeightRole(plant) === 'medium');
        const tallPlants = usableFillPlants.filter(plant => getPlantHeightRole(plant) === 'tall');
        const frontPoints = candidates.filter(point => getPointLayer(point) === 'front');
        const middlePoints = candidates.filter(point => getPointLayer(point) === 'middle');
        const backPoints = candidates.filter(point => getPointLayer(point) === 'back');
        const frontTarget = Math.round(targetCount * 0.34);
        const middleTarget = Math.round(targetCount * 0.36);
        const plan = [
          { layer: 'front', points: frontPoints, plants: lowPlants.length ? lowPlants : usableFillPlants, count: frontTarget, spacingFactor: density >= 90 ? 0.40 : 0.52 },
          { layer: 'middle', points: middlePoints, plants: mediumPlants.length ? mediumPlants : usableFillPlants, count: frontTarget + middleTarget, spacingFactor: density >= 90 ? 0.44 : 0.56 },
          { layer: 'back', points: backPoints, plants: (tallPlants.length ? tallPlants : mediumPlants.length ? mediumPlants : usableFillPlants), count: targetCount, spacingFactor: density >= 90 ? 0.50 : 0.62 },
        ];
        for (const phase of plan) {
          const shuffled = [...phase.points].sort(() => random() - 0.5);
          for (const point of shuffled) {
            if (generated.length >= phase.count || generated.length >= targetCount) break;
            const plant = chooseGeneratorPlantForPoint(point, phase.plants);
            addCandidate(plant, point, { allowNearEdge: true, spacingFactor: phase.spacingFactor });
          }
        }
      } else if (hasCommunityTargets(zone.plantingType) && zone.plantingType !== 'grassDrift') {
        // v96 pro layout: all planting types use plant-community roles, fewer species, repetition, and drifts.
        const plantingType = zone.plantingType;
        const roleOf = (plant: Plant) => getCommunityRole(plant, plantingType);
        const plantsByRole = usableFillPlants.reduce<Record<string, Plant[]>>((acc, plant) => {
          const role = roleOf(plant);
          acc[role] ||= [];
          acc[role].push(plant);
          return acc;
        }, {});
        const mainRoles = Object.entries(getRoleTargetsForType(plantingType))
          .filter(([, target]) => (target || 0) > 0)
          .sort(([, a], [, b]) => (b || 0) - (a || 0))
          .map(([role]) => role);
        const roleTargetCounts = mainRoles.map(role => ({
          role,
          count: Math.max(role.includes('Accent') || role.includes('Flower') ? 0 : 1, Math.round(targetCount * getRoleTarget(plantingType, role as ProCommunityRole))),
          plants: (plantsByRole[role] || []).slice(0, role.includes('Accent') ? 2 : 5),
        })).filter(item => item.plants.length > 0 && item.count > 0);

        // If a role is missing from the catalog/filter result, redistribute naturally through weighted role-balancing.
        const communityPlants = roleTargetCounts.flatMap(item => item.plants).length >= 3
          ? roleTargetCounts.flatMap(item => item.plants)
          : usableFillPlants;
        const roleRecipe = getPlantingRecipe(plantingType);
        const averagePlantsPerDrift = Math.max(2, Math.round((roleRecipe?.averagePlantsPerDrift ?? (density >= 80 ? 6 : density >= 55 ? 5 : 4)) * varietySettings.driftScale));
        const minimumDrifts = roleRecipe?.minDrifts ?? 4;
        const maximumDrifts = Math.round((roleRecipe?.maxDrifts ?? 16) * (density >= 90 ? 1.25 : 1));
        const driftCount = Math.max(
          minimumDrifts,
          Math.min(maximumDrifts, Math.ceil(targetCount / averagePlantsPerDrift))
        );
        const shuffledCenters = [...candidates].sort(() => random() - 0.5).slice(0, driftCount);
        let driftIndex = 0;
        let safety = 0;
        while (generated.length < targetCount && safety < targetCount * 16) {
          const center = shuffledCenters[driftIndex % Math.max(1, shuffledCenters.length)] || {
            x: bounds.minX + random() * (bounds.maxX - bounds.minX),
            y: bounds.minY + random() * (bounds.maxY - bounds.minY),
          };
          const centerPlants = plantsForPointLayer(center, communityPlants);
          const driftPlant = pickCommunityPlantForCount(
            centerPlants.length ? centerPlants : communityPlants,
            plantingType,
            generated,
            plants,
            random,
            plant => computeGeneratorScore(plant, zone) * scorePointForPlant(plant, center)
          );
          const role = roleOf(driftPlant);
          const isAccentRole = role === 'architecturalAccent' || role === 'succulentOrRockAccent' || role === 'lowFlowerAccent' || role === 'seasonalFlowerAccent';
          const plantsThisDrift = isAccentRole
            ? 1
            : Math.max(2, Math.min(plantingType === 'poolPlanter' ? 5 : plantingType === 'rockGarden' ? 3 : 8, Math.round(averagePlantsPerDrift + (random() - 0.5) * 3)));
          const driftWidth = getDesignWidthFt(driftPlant, zone) * defaultPixelsPerFoot;
          for (let i = 0; i < plantsThisDrift && generated.length < targetCount; i += 1) {
            const angle = random() * Math.PI * 2;
            const distance = Math.sqrt(random()) * Math.max(12, driftWidth * (isAccentRole ? 0.70 : plantingType === 'poolPlanter' ? 1.18 : plantingType === 'rockGarden' ? 0.92 : 1.42));
            const point = {
              x: center.x + Math.cos(angle) * distance,
              y: center.y + Math.sin(angle) * distance,
            };
            addCandidate(driftPlant, point, {
              allowNearEdge: true,
              spacingFactor: isAccentRole ? 0.82 : plantingType === 'poolPlanter' ? (density >= 90 ? 0.66 : 0.72) : plantingType === 'rockGarden' ? 0.72 : (density >= 90 ? 0.68 : 0.76),
            });
          }
          driftIndex += 1;
          safety += 1;
        }
      } else if (zone.plantingType === 'grassDrift') {
        // Grass drifts should read as repeated clumps, not evenly sprinkled confetti.
        // Pick a handful of clump centers, repeat one grass per clump, and place plants tightly around it.
        const clumpablePlants = usableFillPlants.filter(isGrassDriftCandidate);
        const driftPlants = clumpablePlants.length ? clumpablePlants : usableFillPlants;
        const grassRecipe = getPlantingRecipe('grassDrift');
        const averagePlantsPerClump = Math.max(2, Math.round((grassRecipe?.averagePlantsPerDrift ?? (density >= 90 ? 6 : density >= 60 ? 5 : 4)) * varietySettings.driftScale));
        const clumpCount = Math.max(grassRecipe?.minDrifts ?? 4, Math.min(Math.round((grassRecipe?.maxDrifts ?? 16) * (density >= 90 ? 1.25 : 1)), Math.ceil(targetCount / averagePlantsPerClump)));
        const shuffledCenters = [...candidates].sort(() => random() - 0.5).slice(0, clumpCount);
        let safety = 0;
        while (generated.length < targetCount && safety < targetCount * 12) {
          const center = shuffledCenters[safety % Math.max(1, shuffledCenters.length)] || {
            x: bounds.minX + random() * (bounds.maxX - bounds.minX),
            y: bounds.minY + random() * (bounds.maxY - bounds.minY),
          };
          const clumpPlant = chooseGeneratorPlantForPoint(center, driftPlants);
          const clumpWidth = getDesignWidthFt(clumpPlant, zone) * defaultPixelsPerFoot;
          const plantsThisClump = Math.max(2, Math.min(density >= 90 ? 6 : 7, Math.round(averagePlantsPerClump + (random() - 0.5) * 2)));
          for (let i = 0; i < plantsThisClump && generated.length < targetCount; i += 1) {
            const angle = random() * Math.PI * 2;
            const distance = Math.sqrt(random()) * Math.max(12, clumpWidth * (density >= 90 ? 1.35 : 1.10));
            const point = {
              x: center.x + Math.cos(angle) * distance,
              y: center.y + Math.sin(angle) * distance,
            };
            addCandidate(clumpPlant, point, { allowNearEdge: true, spacingFactor: density >= 90 ? 0.62 : 0.72 });
          }
          safety += 1;
        }
      } else {
        for (const point of candidates) {
          if (generated.length >= targetCount) break;
          const plant = chooseGeneratorPlantForPoint(point, usableFillPlants);
          addCandidate(plant, point, {
          allowNearEdge: layoutMode === 'groundcoverFill' || zone.plantingType === 'flowerBed',
          spacingFactor: layoutMode === 'groundcoverFill' ? 0.72 : zone.plantingType === 'flowerBed' ? (density >= 90 ? 0.5 : 0.62) : 0.92,
        });
        }
      }

      // Last-chance light random fill so obvious holes are less common.
      for (let attempt = 0; generated.length < targetCount && attempt < targetCount * 60; attempt += 1) {
        const point = {
          x: bounds.minX + random() * (bounds.maxX - bounds.minX),
          y: bounds.minY + random() * (bounds.maxY - bounds.minY),
        };
        const plant = chooseGeneratorPlantForPoint(point, usableFillPlants);
        addCandidate(plant, point, {
          allowNearEdge: layoutMode === 'groundcoverFill' || zone.plantingType === 'flowerBed',
          spacingFactor: layoutMode === 'groundcoverFill' ? 0.58 : zone.plantingType === 'flowerBed' ? (density >= 90 ? 0.38 : 0.52) : density >= 90 ? 0.74 : 0.84,
        });
      }
    }


    if (zone.plantingType === 'rockGarden' || zone.includeRocks === true) {
      const rockRecipe = getPlantingRecipe('rockGarden');
      const existingRockCount = placedPlants.filter(item => item.itemType === 'rock').length;
      const defaultRockMin = zone.plantingType === 'rockGarden' ? (rockRecipe?.rockMin ?? 2) : 1;
      const defaultRockMax = zone.plantingType === 'rockGarden' ? (rockRecipe?.rockMax ?? 5) : (density >= 85 ? 4 : 3);
      const rockTarget = Math.max(defaultRockMin, Math.min(defaultRockMax, Math.round((zone.plantingType === 'rockGarden' ? 2 : 1) + densityFactor * (zone.plantingType === 'rockGarden' ? 2 : 1.5) + Math.sqrt(usableZoneAreaPx) / Math.max(zone.plantingType === 'rockGarden' ? 260 : 520, defaultPixelsPerFoot * 32))));
      const rockCandidates = [...latestCandidatePoints]
        .sort((a, b) => distanceToPolygonEdge(b, zone.points) - distanceToPolygonEdge(a, zone.points));
      for (let i = 0; i < rockCandidates.length && generated.filter(item => item.itemType === 'rock').length < rockTarget; i += Math.max(1, Math.floor(rockCandidates.length / (rockTarget * 4)))) {
        addRockCandidate(rockCandidates[i], existingRockCount + generated.filter(item => item.itemType === 'rock').length);
      }
      for (let attempt = 0; generated.filter(item => item.itemType === 'rock').length < rockTarget && attempt < rockTarget * 80; attempt += 1) {
        const point = {
          x: bounds.minX + random() * (bounds.maxX - bounds.minX),
          y: bounds.minY + random() * (bounds.maxY - bounds.minY),
        };
        addRockCandidate(point, existingRockCount + generated.filter(item => item.itemType === 'rock').length);
      }
      intendedTargetCount += generated.filter(item => item.itemType === 'rock').length;
    }

    if (generated.length === 0) {
      addTestLog('generator.failed', {
        zoneId: zone.id,
        zoneName: zone.name,
        layoutMode,
        density,
        plantVariety,
        seed,
        targetCount: intendedTargetCount,
        availablePlantIds: availablePlants.map(plant => plant.id),
        zoneAreaPx,
        averagePlantAreaPx,
        effectivePlantAreaPx,
        visualCoverageCalibration,
        usableZoneAreaPx,
        targetCoverageAreaPx,
        rejectionCounts,
        reason: 'no_valid_positions',
      });
      alert('No valid plant positions were found. Try a lower density, smaller plants, or a larger zone.');
      return;
    }

    const replacedInZone = placedPlants.filter(item => item.zone === zone.id).length;
    setPlacedPlants(prev => [
      ...prev.filter(item => item.zone !== zone.id),
      ...generated,
    ]);
    const generatedPlantsSummary = generated.map(item => {
      if (item.itemType === 'rock') {
        return { id: item.plantId, name: `Rock ${item.rockSizeFt || 2}'`, communityRole: 'rockBoulderAnchor', itemType: 'rock' };
      }
      const plant = plants.find(candidate => candidate.id === item.plantId);
      return { id: item.plantId, name: plant?.commonName || plant?.botanicalName || `Plant ${item.plantId}`, communityRole: plant ? getCommunityRole(plant, zone.plantingType) : 'general', itemType: 'plant' };
    });

    const generatedPlantCount = generated.filter(item => item.itemType !== 'rock').length;
    const generatedRockCount = generated.filter(item => item.itemType === 'rock').length;
    const generationPoints = Math.min(75, Math.max(15, 15 + Math.floor(generatedPlantCount / 3) + generatedRockCount));
    awardScore(`generate:${zone.id}:${seed}:${generated.length}`, generationPoints, `+${generationPoints}. A planting layout has entered the situation.`);

    addTestLog('generator.completed', {
      zoneId: zone.id,
      zoneName: zone.name,
      groupId: group?.id || null,
      groupName: group?.name || 'Auto-pick from catalog',
      autoPicked: !group,
      layoutMode,
      density,
      plantVariety,
      recipe: zone.plantingType || 'mixedBorder',
      seed,
      targetCount: intendedTargetCount,
      generatedCount: generated.length,
      generatedPlantCount,
      generatedRockCount,
      replacedInZone,
      generatedPlantIds: generated.map(item => item.plantId),
      generatedPlants: generatedPlantsSummary,
      zoneAreaPx,
      usableZoneAreaPx,
      targetCoverageAreaPx,
      averagePlantAreaPx,
      effectivePlantAreaPx,
      visualCoverageCalibration,
      rejectionCounts,
      communityRoleCounts: countGeneratedRoles(generated, plants, zone.plantingType),
    });

    const snapshotPlants = [
      ...placedPlants.filter(item => item.zone !== zone.id),
      ...generated,
    ];
    setTimeout(() => {
      void captureMapSnapshot('generator.completed', {
        zoneId: zone.id,
        zoneName: zone.name,
        layoutMode,
        density,
        plantVariety,
        seed,
        generatedCount: generated.length,
        replacedInZone,
        generatedPlants: generatedPlantsSummary,
      }, snapshotPlants, zones);
    }, 80);

    const firstGeneratedPlant = generated.find(item => item.itemType !== 'rock') || generated[0];
    setSelectedInstanceId(firstGeneratedPlant.instanceId);
    setSelectedInstanceIds([firstGeneratedPlant.instanceId]);
    setSelectedPlant(null);
  }, [zones, plantingGroups, plants, pixelsPerFoot, placedPlants, getPlantPlacementRotation, addTestLog, captureMapSnapshot, awardScore]);

  // Plan management handlers
  const handleNotesChange = useCallback((nextNotes: string) => {
    setNotes(nextNotes);
    addTestLog('plan.notesChanged', { length: nextNotes.length });
  }, [addTestLog]);

  const handleSavePlan = useCallback((name: string) => {
    const trimmedName = name.trim() || 'Untitled Plan';
    const existingPlan = loadSavedPlans().find(plan => plan.name.toLowerCase() === trimmedName.toLowerCase());
    const now = new Date().toISOString();
    const plan: GardenPlan = {
      id: existingPlan?.id || generateId(),
      name: trimmedName,
      createdAt: existingPlan?.createdAt || now,
      updatedAt: now,
      backgroundImage,
      backgroundOpacity,
      backgroundLocked,
      restoreBackgroundOnLaunch,
      scalePixelsPerFoot: pixelsPerFoot,
      placedPlants,
      zones,
      plantingGroups,
      zoneShapesVisible,
      notes,
      canvasWorldSize,
      plantCircleOpacity,
      plantLabelMode,
      plantClumpingEnabled,
      plantClumpStrength,
      zoom,
      shrubScore: shrubScoreState,
    };
    savePlan(plan);
    setSavedPlans(loadSavedPlans());
    setPlanName(trimmedName);
    awardScore(`save:${placedPlants.length}:${zones.length}:${trimmedName}`, 10, pickMessage(SAVE_MESSAGES, trimmedName));
    addTestLog('plan.saved', { name: trimmedName, updatedExisting: !!existingPlan, placedPlants: placedPlants.length, zones: zones.length, plantingGroups: plantingGroups.length });
  }, [backgroundImage, backgroundOpacity, backgroundLocked, restoreBackgroundOnLaunch, pixelsPerFoot, placedPlants, zones, plantingGroups, zoneShapesVisible, notes, canvasWorldSize, plantCircleOpacity, plantLabelMode, plantClumpingEnabled, plantClumpStrength, zoom, shrubScoreState, addTestLog, awardScore]);

  const handleLoadPlan = useCallback((plan: GardenPlan) => {
    setPlanName(plan.name);
    setBackgroundImage(plan.backgroundImage);
    setRestoreBackgroundOnLaunch(plan.restoreBackgroundOnLaunch ?? false);
    setBackgroundOpacity(plan.backgroundOpacity);
    setBackgroundLocked(plan.backgroundLocked);
    setPixelsPerFoot(plan.scalePixelsPerFoot);
    setPlacedPlants(plan.placedPlants);
    setZones(plan.zones || []);
    setPlantingGroups(plan.plantingGroups || []);
    setZoneShapesVisible(plan.zoneShapesVisible ?? true);
    setNotes(plan.notes);
    if (plan.canvasWorldSize) {
      setCanvasWorldSize(plan.canvasWorldSize);
      setCanvasSize(plan.canvasWorldSize);
    }
    if (plan.plantCircleOpacity !== undefined) setPlantCircleOpacity(plan.plantCircleOpacity);
    if (plan.plantLabelMode) setPlantLabelMode(plan.plantLabelMode === 'initials' ? 'numbers' : plan.plantLabelMode);
    if (plan.zoom !== undefined) setZoom(plan.zoom);
    if (plan.shrubScore) {
      setShrubScore(plan.shrubScore.score || 0);
      setScoreEventKeys(plan.shrubScore.eventKeys || []);
      setScoreMilestones(plan.shrubScore.milestones || []);
      awardedScoreKeysRef.current = new Set(plan.shrubScore.eventKeys || []);
    } else {
      setShrubScore(0);
      setScoreEventKeys([]);
      setScoreMilestones([]);
      awardedScoreKeysRef.current = new Set();
    }
    setSelectedInstanceId(null);
    setSelectedInstanceIds([]);
    setSelectedPlant(null);
    setSelectedZoneId(null);
    addTestLog('plan.loaded', { name: plan.name, placedPlants: plan.placedPlants?.length || 0, zones: plan.zones?.length || 0, plantingGroups: plan.plantingGroups?.length || 0 });
  }, [addTestLog]);

  const handleLoadExamplePlan = useCallback(async () => {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}examples/example-plan.json`);
      if (!response.ok) throw new Error(`Example plan failed to load: ${response.status}`);
      const examplePlan = await response.json() as GardenPlan;
      handleLoadPlan({
        ...examplePlan,
        id: examplePlan.id || generateId(),
        name: examplePlan.name || 'Example Plan',
        createdAt: examplePlan.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        restoreBackgroundOnLaunch: true,
      });
      awardScore('load-example-plan', 25, 'Example plan loaded. The shrubs have prepared a brief orientation.');
      addTestLog('plan.exampleLoaded', { name: examplePlan.name || 'Example Plan' });
    } catch (error) {
      console.error(error);
      alert('Could not load the example plan. The example shrub has wandered off.');
      addTestLog('plan.exampleLoadFailed', { message: error instanceof Error ? error.message : String(error) });
    }
  }, [handleLoadPlan, awardScore, addTestLog]);

  const handleDeleteSavedPlan = useCallback((planId: string) => {
    deletePlan(planId);
    setSavedPlans(loadSavedPlans());
  }, []);

  const handleNewPlan = useCallback(() => {
    if (placedPlants.length > 0 && !confirm('Clear the current plan and start fresh?')) {
      return;
    }
    setPlacedPlants([]);
    setZones([]);
    setPlantingGroups([]);
    setSelectedZoneId(null);
    setZoneShapesVisible(true);
    setBackgroundImage(null);
    setBackgroundOpacity(0.5);
    setBackgroundLocked(false);
    setRestoreBackgroundOnLaunch(false);
    setPixelsPerFoot(null);
    setCanvasWorldSize({ width: 900, height: 650 });
    setCanvasSize({ width: 900, height: 650 });
    setZoom(1);
    setPlantCircleOpacity(0.58);
    setPlantLabelMode('numbers');
    setNotes('');
    setPlanName('My Garden Plan');
    setShrubScore(0);
    setScoreEventKeys([]);
    setScoreMilestones([]);
    awardedScoreKeysRef.current = new Set();
    setCommentaryMessage(IDLE_MESSAGES[0]);
    setSelectedInstanceId(null);
    setSelectedInstanceIds([]);
    setSelectedPlant(null);
    clearCurrentPlan();
    addTestLog('plan.new', {});
  }, [placedPlants.length, addTestLog]);

  const handleExportPlan = useCallback(() => {
    const plan: GardenPlan = {
      id: generateId(),
      name: planName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      backgroundImage,
      backgroundOpacity,
      backgroundLocked,
      restoreBackgroundOnLaunch,
      scalePixelsPerFoot: pixelsPerFoot,
      placedPlants,
      zones,
      plantingGroups,
      zoneShapesVisible,
      notes,
      canvasWorldSize,
      plantCircleOpacity,
      plantLabelMode,
      plantClumpingEnabled,
      plantClumpStrength,
      zoom,
      shrubScore: shrubScoreState,
    };
    exportPlanAsJSON(plan);
    awardScore(`export:${planName}:${placedPlants.length}:${zones.length}`, 50, 'The nursery has been warned.');
    addTestLog('plan.exported', { name: planName, placedPlants: placedPlants.length, zones: zones.length, plantingGroups: plantingGroups.length });
  }, [planName, backgroundImage, backgroundOpacity, backgroundLocked, restoreBackgroundOnLaunch, pixelsPerFoot, placedPlants, zones, plantingGroups, zoneShapesVisible, notes, canvasWorldSize, plantCircleOpacity, plantLabelMode, plantClumpingEnabled, plantClumpStrength, zoom, shrubScoreState, addTestLog, awardScore]);

  const handleImportPlan = useCallback((plan: GardenPlan) => {
    handleLoadPlan(plan);
    savePlan(plan);
    setSavedPlans(loadSavedPlans());
  }, [handleLoadPlan]);


  useEffect(() => {
    if (!showFileMenu) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(event.target as Node)) {
        setShowFileMenu(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [showFileMenu]);
  // Render loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f141b] flex items-center justify-center p-6 text-slate-100">
        <div className="w-full max-w-sm text-center">
          <img src={`${import.meta.env.BASE_URL}brand/logo-DarkBG.svg`} alt="Plant Pending" className="mx-auto mb-5 h-24 max-w-full object-contain" />
          <p className="text-sm text-slate-400">Probably needs a shrub.</p>
          <p className="mt-5 text-sm text-slate-300">{loadingStage}</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-emerald-500 transition-all duration-200" style={{ width: `${loadingProgress}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">{Math.round(loadingProgress)}%</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Plants</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">
            Make sure plants_with_images.csv or plants.csv is in the public folder.
          </p>
        </div>
      </div>
    );
  }

  const handleAppFileImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const plan = await importPlanFromJSON(file);
      handleImportPlan(plan);
      setShowOpenPlanModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to import plan');
    }
    if (appFileInputRef.current) appFileInputRef.current.value = '';
    setShowFileMenu(false);
  };


  const parsePriceRange = (priceText?: string | null): { min: number; max: number } | null => {
    if (!priceText) return null;
    const numbers = Array.from(priceText.matchAll(/\$?([0-9]+(?:\.[0-9]{1,2})?)/g))
      .map(match => Number(match[1]))
      .filter(value => Number.isFinite(value));
    if (numbers.length === 0) return null;
    return { min: Math.min(...numbers), max: Math.max(...numbers) };
  };

  const planPriceRange = placedPlants.reduce((total, item) => {
    if ((item.itemType || 'plant') === 'rock') return total;
    const plant = plants.find(candidate => candidate.id === item.plantId);
    const range = parsePriceRange(plant?.greenAcresPriceText);
    if (!range) return total;
    return { min: total.min + range.min, max: total.max + range.max, known: total.known + 1 };
  }, { min: 0, max: 0, known: 0 });

  const totalPriceText = planPriceRange.known === 0
    ? '$0'
    : planPriceRange.min === planPriceRange.max
      ? `$${planPriceRange.min.toFixed(2)}`
      : `$${planPriceRange.min.toFixed(2)}–$${planPriceRange.max.toFixed(2)}`;

  const scoreTitle = getScoreTitle(shrubScore);

  return (
    <div className="h-screen flex flex-col bg-[#0f141b] text-slate-100">
      <header className="border-b border-slate-800 bg-[#161c24] px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-[65px] w-[65px] items-center justify-center overflow-hidden rounded-2xl ring-1 ring-emerald-500/20">
              <img src={`${import.meta.env.BASE_URL}brand/app-icon.svg`} alt="Plant Pending app icon" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-white">Plant Pending <span className="text-sm font-normal text-slate-400">v 2.0</span></h1>
              <p className="text-xs text-slate-400">Probably needs a shrub</p>
            </div>
          </div>

          <div ref={fileMenuRef} className="relative mr-auto">
            <button
              type="button"
              onClick={() => setShowFileMenu(value => !value)}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
            >
              File ▾
            </button>
            {showFileMenu && (
              <div className="absolute left-0 top-11 z-[70] w-64 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 py-2 text-sm shadow-2xl">
                <button
                  type="button"
                  onClick={() => {
                    const name = prompt('Save plan as:', planName || 'My Garden Plan');
                    if (name) handleSavePlan(name);
                    setShowFileMenu(false);
                  }}
                  className="block w-full px-4 py-2 text-left text-slate-100 hover:bg-slate-800"
                >
                  Save plan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowOpenPlanModal(true);
                    setShowFileMenu(false);
                  }}
                  className="block w-full px-4 py-2 text-left text-slate-100 hover:bg-slate-800"
                >
                  Open / load plan...
                </button>
                {sortedSavedPlans.length > 0 && (
                  <div className="border-t border-slate-800 py-1">
                    <div className="px-4 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">Load recent</div>
                    {sortedSavedPlans.slice(0, 5).map(plan => (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => {
                          handleLoadPlan(plan);
                          setShowFileMenu(false);
                        }}
                        className="block w-full truncate px-4 py-2 text-left text-slate-200 hover:bg-slate-800"
                      >
                        {plan.name}
                      </button>
                    ))}
                  </div>
                )}
                <div className="border-t border-slate-800 py-1">
                  <button
                    type="button"
                    onClick={() => { handleExportPlan(); setShowFileMenu(false); }}
                    className="block w-full px-4 py-2 text-left text-slate-100 hover:bg-slate-800"
                  >
                    Export JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => appFileInputRef.current?.click()}
                    className="block w-full px-4 py-2 text-left text-slate-100 hover:bg-slate-800"
                  >
                    Import JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleNewPlan(); setShowFileMenu(false); }}
                    className="block w-full px-4 py-2 text-left text-slate-100 hover:bg-slate-800"
                  >
                    New plan
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowPrintView(true); setShowFileMenu(false); }}
                    className="block w-full px-4 py-2 text-left text-slate-100 hover:bg-slate-800"
                  >
                    Print
                  </button>
                </div>
              </div>
            )}
            <input ref={appFileInputRef} type="file" accept=".json" className="hidden" onChange={handleAppFileImport} />
          </div>

          {showOpenPlanModal && (
            <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-6" onMouseDown={(event) => {
              if (event.target === event.currentTarget) setShowOpenPlanModal(false);
            }}>
              <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 text-slate-100 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Saved plans</div>
                    <h2 className="mt-1 text-lg font-semibold">Open browser plan</h2>
                    <p className="mt-1 text-xs text-slate-400">Plans saved in this browser on this computer. To bring in a file, import a plan JSON.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOpenPlanModal(false)}
                    className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                  >
                    Close
                  </button>
                </div>

                <div className="border-b border-slate-800 p-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => appFileInputRef.current?.click()}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
                    >
                      Import plan JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleLoadExamplePlan();
                        setShowOpenPlanModal(false);
                      }}
                      className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                    >
                      Load example plan
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Importing JSON also saves that plan into this browser.</p>
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-4">
                  {sortedSavedPlans.length === 0 ? (
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
                      <div className="font-semibold text-white">No browser-saved plans yet.</div>
                      <p className="mt-1 text-slate-400">Saved plans are stored separately for localhost and GitHub Pages. Import a JSON file to bring a plan into this browser.</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => appFileInputRef.current?.click()}
                          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
                        >
                          Import plan JSON
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleLoadExamplePlan();
                            setShowOpenPlanModal(false);
                          }}
                          className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                        >
                          Load example plan
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sortedSavedPlans.map(plan => (
                        <div key={plan.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
                          <button
                            type="button"
                            onClick={() => {
                              handleLoadPlan(plan);
                              setShowOpenPlanModal(false);
                            }}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="truncate text-sm font-semibold text-white">{plan.name}</div>
                            <div className="mt-1 text-xs text-slate-400">
                              {(plan.placedPlants?.length || 0)} plants · {(plan.zones?.length || 0)} zones · updated {new Date(plan.updatedAt || plan.createdAt).toLocaleString()}
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Delete saved plan "${plan.name}"?`)) handleDeleteSavedPlan(plan.id);
                            }}
                            className="rounded-lg border border-red-900/60 px-3 py-2 text-xs text-red-200 hover:bg-red-950/50"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowAbout(true)}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
          >
            About
          </button>

          <button
            type="button"
            onClick={() => { setShowHelpCenter(true); setShowWelcomeGuide(true); }}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
            title="Open the welcome guide and help center"
          >
            ? Help
          </button>

          <div title="Estimated total for plants currently placed on the plan. Uses Green Acres catalog prices when available." className="rounded-xl border border-emerald-800/70 bg-emerald-950/40 px-3 py-2 text-sm font-semibold text-emerald-100">
            Total: {totalPriceText}
          </div>

          <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-5" aria-label="Plant Pending commentary and Shrub Score">
            <div className="hidden min-w-0 max-w-3xl items-center gap-2 text-sm text-slate-200 xl:flex">
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
              <span className="truncate">{commentaryMessage}</span>
            </div>
            <div className="relative flex shrink-0 flex-col items-end leading-tight" aria-label={`Shrub Score ${shrubScore}, ${scoreTitle}`}>
              {pointGain && (
                <span key={pointGain.id} className="absolute -left-12 -top-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-200">
                  +{pointGain.points}
                </span>
              )}
              <span className="text-sm font-black text-emerald-200">Shrub Score: {shrubScore.toLocaleString()}</span>
              <span className="text-[11px] text-slate-400">{scoreTitle}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-16 shrink-0 border-r border-slate-800 bg-[#11161d] px-2 py-3">
          <div className="flex h-full flex-col items-center gap-2">
            <button
              type="button"
              title="Plant library"
              onClick={() => setLeftPanelMode(mode => mode === 'library' ? 'closed' : 'library')}
              className={`flex h-11 w-11 items-center justify-center rounded-xl border text-lg ${leftPanelMode === 'library' ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'}`}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19v-6" />
                <path d="M8.5 11.5C7 10.6 6 9 6 7c2.3 0 4.2 1 5.3 2.7" />
                <path d="M15.5 9.5C17 8.7 18 7.1 18 5c-2.3 0-4.2 1-5.3 2.7" />
                <path d="M5 19h14" />
              </svg>
            </button>
            <button
              type="button"
              title="Filters"
              onClick={() => setLeftPanelMode(mode => mode === 'filters' ? 'closed' : 'filters')}
              className={`flex h-11 w-11 items-center justify-center rounded-xl border text-lg ${leftPanelMode === 'filters' ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'}`}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16" />
                <path d="M7 12h10" />
                <path d="M10 18h4" />
              </svg>
            </button>
            <button
              type="button"
              title="Rock tool"
              onClick={() => {
                const nextPlacingRock = !placingRock;
                setPlacingRock(nextPlacingRock);
                setSelectedPlant(null);
                setSelectedInstanceId(null);
                setSelectedInstanceIds([]);
                addTestLog('rockTool.toggled', { placingRock: nextPlacingRock, state: getDebugStateSummary() });
              }}
              className={`flex h-11 w-11 items-center justify-center rounded-xl border text-lg ${placingRock ? 'border-stone-400 bg-stone-500/15 text-stone-100' : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'}`}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 18 4 13l3-5 6-2 5 3 2 5-3 4H7Z" />
              </svg>
            </button>
            <button
              type="button"
              title="Clear selection"
              onClick={() => {
                setSelectedPlant(null);
                setSelectedInstanceId(null);
                setSelectedInstanceIds([]);
                setSelectedZoneId(null);
                setPlacingRock(false);
              }}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 6 12 12" />
                <path d="M18 6 6 18" />
              </svg>
            </button>
          </div>
        </aside>

        {leftPanelMode !== 'closed' && (
          <aside className={`shrink-0 border-r border-slate-800 bg-[#171d25] ${leftPanelMode === 'filters' ? 'w-[22rem]' : 'w-[25rem]'} flex flex-col`}>
            <div className="border-b border-slate-800 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{leftPanelMode === 'filters' ? 'Library controls' : 'Plant library'}</div>
                  <h2 className="mt-1 text-base font-semibold text-white">{leftPanelMode === 'filters' ? 'Filters and sorting' : 'Browse plants'}</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {filteredPlants.length} of {plants.length} plants shown
                  </p>
                </div>
              </div>
              {leftPanelMode === 'library' && selectedPlant && (
                <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                  Active placement: {selectedPlant.commonName || selectedPlant.botanicalName}. Click the plan to place.
                </div>
              )}
            </div>

            {leftPanelMode === 'filters' ? (
              <div className="flex-1 overflow-y-auto p-4">
                <FilterPanel
                  filters={filters}
                  sortBy={sortBy}
                  categories={categories}
                  greenAcresFilterIndex={greenAcresFilterIndex}
                  onFiltersChange={handleFiltersChange}
                  onSortChange={handleSortChange}
                />
              </div>
            ) : (
              <>
                <div className="border-b border-slate-800 px-4 py-3 space-y-3">
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search plants..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setLeftPanelMode('filters')}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
                  >
                    Open filters and sorting
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  <div className="space-y-3">
                    {filteredPlants.length === 0 ? (
                      <p className="rounded-2xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-400">
                        No plants match your filters.
                      </p>
                    ) : (
                      visiblePlants.map(plant => (
                        <PlantCard
                          key={plant.id}
                          plant={plant}
                          isSelected={selectedPlant?.id === plant.id}
                          onClick={() => handleSelectPlantFromLibrary(plant)}
                        />
                      ))
                    )}
                    {hasMoreVisiblePlants && (
                      <button
                        type="button"
                        onClick={() => setVisiblePlantLimit(limit => limit + 120)}
                        className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800"
                      >
                        Show 120 more plants ({filteredPlants.length - visiblePlantLimit} remaining)
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </aside>
        )}

        <main className="flex-1 min-w-0 bg-[#10161d]">
          <div className="flex h-full flex-col">
            <div className="flex-1 min-h-0">
              <GardenCanvas
            plants={plants}
            placedPlants={placedPlants}
            zones={zones}
            selectedZoneId={selectedZoneId}
            zoneShapesVisible={zoneShapesVisible}
            selectedPlant={selectedPlant}
            placingRock={placingRock}
            selectedInstanceId={selectedInstanceId}
            selectedInstanceIds={selectedInstanceIds}
            backgroundImage={backgroundImage}
            backgroundOpacity={backgroundOpacity}
            backgroundLocked={backgroundLocked}
            pixelsPerFoot={pixelsPerFoot}
            canvasWorldSize={canvasWorldSize}
            zoom={zoom}
            plantCircleOpacity={plantCircleOpacity}
            plantLabelMode={plantLabelMode}
            globalDisplayMode={globalDisplayMode}
            plantClumpingEnabled={plantClumpingEnabled}
            plantClumpStrength={plantClumpStrength}
            onPlacePlant={handlePlacePlant}
            onPlaceRock={handlePlaceRock}
            onCancelPlantPlacement={handleCancelPlantPlacement}
            onSelectPlacedPlant={handleSelectPlacedPlant}
            onSelectMultiplePlacedPlants={handleSelectMultiplePlacedPlants}
            onMovePlacedPlant={handleMovePlacedPlant}
            onDeletePlacedPlant={handleDeletePlacedPlant}
            onClearPlacedPlants={handleClearPlacedPlants}
            onAddZone={handleAddZone}
            onUpdateZone={handleUpdateZone}
            onSelectZone={handleSelectZone}
            onZoneShapesVisibleChange={handleZoneShapesVisibleChange}
            onBackgroundImageChange={handleBackgroundImageChange}
            onBackgroundOpacityChange={handleBackgroundOpacityChange}
            onBackgroundLockedChange={handleBackgroundLockedChange}
            onSetScale={handleSetScale}
            onCanvasSizeChange={handleCanvasSizeChange}
            onCanvasWorldSizeChange={handleCanvasWorldSizeChange}
            onZoomChange={handleZoomChange}
            onPlantCircleOpacityChange={handlePlantCircleOpacityChange}
            onPlantLabelModeChange={handlePlantLabelModeChange}
            onGlobalDisplayModeChange={handleGlobalDisplayModeChange}
            onPlantClumpingEnabledChange={handlePlantClumpingEnabledChange}
            onPlantClumpStrengthChange={handlePlantClumpStrengthChange}
            onLoadExamplePlan={handleLoadExamplePlan}
              />
            </div>
          </div>
        </main>

        <aside className={`${rightInspectorSection ? 'w-[23rem]' : 'w-12'} shrink-0 border-l border-slate-800 bg-[#0f1720] transition-[width] duration-200`}>
          <div className="h-full">
            <PlanDetails
            plants={plants}
            placedPlants={placedPlants}
            zones={zones}
            plantingGroups={plantingGroups}
            warnings={warnings}
            selectedZoneId={selectedZoneId}
            zoneShapesVisible={zoneShapesVisible}
            selectedInstanceId={selectedInstanceId}
            selectedInstanceIds={selectedInstanceIds}
              savedPlans={savedPlans}
            currentPlanName={planName}
            notes={notes}
            canvasWorldSize={canvasWorldSize}
            zoom={zoom}
            plantCircleOpacity={plantCircleOpacity}
            plantLabelMode={plantLabelMode}
            globalDisplayMode={globalDisplayMode}
            plantClumpingEnabled={plantClumpingEnabled}
            plantClumpStrength={plantClumpStrength}
            inspectorSection={rightInspectorSection}
            onInspectorSectionChange={setRightInspectorSection}
            testLog={testLog}
            debugSnapshots={debugSnapshots}
            onClearTestLog={clearTestLog}
            onSelectPlacedPlant={handleSelectPlacedPlant}
            onUpdatePlacedPlant={handleUpdatePlacedPlant}
            onDeletePlacedPlant={handleDeletePlacedPlant}
            onClearPlacedPlants={handleClearPlacedPlants}
            onDuplicatePlacedPlant={handleDuplicatePlacedPlant}
            onSelectZone={handleSelectZone}
            onUpdateZone={handleUpdateZone}
            onDeleteZone={handleDeleteZone}
            onDuplicateZone={handleDuplicateZone}
            onZoneShapesVisibleChange={handleZoneShapesVisibleChange}
            onCreatePlantingGroup={handleCreatePlantingGroup}
            onUpdatePlantingGroup={handleUpdatePlantingGroup}
            onDeletePlantingGroup={handleDeletePlantingGroup}
            onAddPlantToGroup={handleAddPlantToGroup}
            onRemovePlantFromGroup={handleRemovePlantFromGroup}
            onGenerateZoneLayout={handleGenerateZoneLayout}
            onSavePlan={handleSavePlan}
            onLoadPlan={handleLoadPlan}
            onDeleteSavedPlan={handleDeleteSavedPlan}
            onNewPlan={handleNewPlan}
            onExportPlan={handleExportPlan}
            onImportPlan={handleImportPlan}
            onPrint={() => setShowPrintView(true)}
            onNotesChange={handleNotesChange}
            onZoomChange={handleZoomChange}
            onPlantCircleOpacityChange={handlePlantCircleOpacityChange}
            onPlantLabelModeChange={handlePlantLabelModeChange}
            onGlobalDisplayModeChange={handleGlobalDisplayModeChange}
            onPlantClumpingEnabledChange={handlePlantClumpingEnabledChange}
            onPlantClumpStrengthChange={handlePlantClumpStrengthChange}
              />
          </div>
        </aside>
      </div>

      <WelcomeGuide
        open={showWelcomeGuide}
        showOnStartup={showWelcomeOnStartup}
        onShowOnStartupChange={(checked) => {
          setShowWelcomeOnStartup(checked);
          localStorage.setItem(WELCOME_SETTING_KEY, checked ? 'true' : 'false');
        }}
        onClose={() => setShowWelcomeGuide(false)}
        onOpenHelp={() => {
          setShowWelcomeGuide(false);
          setShowHelpCenter(true);
        }}
      />

      <HelpCenter
        open={showHelpCenter}
        search={helpSearch}
        onSearchChange={setHelpSearch}
        onClose={() => setShowHelpCenter(false)}
      />

      {/* About modal */}
      {showAbout && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-6" onClick={() => setShowAbout(false)}>
          <div className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-700 bg-slate-950 p-6 text-slate-100 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <img src={`${import.meta.env.BASE_URL}brand/logo-DarkBG.svg`} alt="Plant Pending" className="h-20 max-w-[260px] object-contain" />
              <button type="button" onClick={() => setShowAbout(false)} className="rounded-xl border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">Close</button>
            </div>
            <div className="mt-5 space-y-4 text-sm leading-6 text-slate-300">
              <p className="text-lg font-semibold text-white">Probably needs a shrub.</p>
              <p>Plant Pending is a serious landscape planning tool with the emotional stability of a rock and the quiet suspicion that your yard is about to become a hedge.</p>
              <p>Use it to draw planting zones, place plants, compare mature sizes, move the same shrub around until it has seen the whole yard, and pretend the nursery total is still theoretical.</p>
              <p>It respects rocks. It distrusts the word <span className="italic">dwarf</span>. It knows every tiny plant is secretly applying for a much larger position.</p>
              <div className="rounded-2xl border border-emerald-900/60 bg-emerald-950/30 p-4 text-emerald-100">
                The app remains helpful first, funny second, and mildly concerned about future pruning.
              </div>
              <button
                type="button"
                onClick={() => setShowAttribution(true)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
              >
                View icon and data attribution
              </button>
              <p className="text-xs text-slate-500">Plant Pending v 1.0 · The plants remain safely theoretical.</p>
            </div>
          </div>
        </div>
      )}


      {/* Attribution modal */}
      {showAttribution && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-6" onClick={() => setShowAttribution(false)}>
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-700 bg-slate-950 p-6 text-slate-100 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-300">Plant Pending</div>
                <h2 className="mt-1 text-2xl font-black text-white">Attribution</h2>
                <p className="mt-2 text-sm text-slate-400">Credit where credit is due. Also where the rocks demanded legal representation.</p>
              </div>
              <button type="button" onClick={() => setShowAttribution(false)} className="rounded-xl border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">Close</button>
            </div>
            <div className="mt-5 space-y-4 text-sm leading-6 text-slate-300">
              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <h3 className="font-semibold text-white">Plant and rock planning icons</h3>
                <p className="mt-1">Top-down plant symbols and rock SVGs are bundled project assets used by Plant Pending for plan visualization.</p>
              </section>
              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <h3 className="font-semibold text-white">App interface icons</h3>
                <div className="mt-2 space-y-3">
                  <p>
                    <span className="font-semibold text-slate-100">Canvas icon:</span>{' '}
                    canvas by Dwi ridwanto from{' '}
                    <a className="text-emerald-300 underline underline-offset-2 hover:text-emerald-200" href="https://thenounproject.com/browse/icons/term/canvas/" target="_blank" rel="noreferrer" title="canvas Icons">Noun Project</a>{' '}
                    (CC BY 3.0).
                  </p>
                  <p>
                    <span className="font-semibold text-slate-100">Zones icon:</span>{' '}
                    Screenshot by Rolas Design from{' '}
                    <a className="text-emerald-300 underline underline-offset-2 hover:text-emerald-200" href="https://thenounproject.com/browse/icons/term/screenshot/" target="_blank" rel="noreferrer" title="Screenshot Icons">Noun Project</a>{' '}
                    (CC BY 3.0).
                  </p>
                </div>
              </section>
              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <h3 className="font-semibold text-white">Plant catalog and photos</h3>
                <p className="mt-1">Plant data and catalog links are based on Green Acres Nursery &amp; Supply catalog fields where available. Product photos may be hotlinked from Green Acres catalog image URLs when the source provides them.</p>
              </section>
              <p className="text-xs text-slate-500">If you add a new icon pack or image source, add the license text here before publishing. Future you will forget. Future you is unreliable.</p>
            </div>
          </div>
        </div>
      )}

      {showPrintView && (
        <PrintView
          plants={plants}
          placedPlants={placedPlants}
          zones={zones}
          planName={planName}
          notes={notes}
          backgroundImage={backgroundImage}
          backgroundOpacity={backgroundOpacity}
          pixelsPerFoot={pixelsPerFoot}
          canvasSize={canvasSize}
          plantCircleOpacity={plantCircleOpacity}
          plantLabelMode={plantLabelMode}
          plantClumpingEnabled={plantClumpingEnabled}
          plantClumpStrength={plantClumpStrength}
          onClose={() => setShowPrintView(false)}
        />
      )}
    </div>
  );
}

export default App;

