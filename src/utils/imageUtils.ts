// Image utilities for plant thumbnails and plan-view symbols

import { Plant, PlacedPlant } from '../types/plant';

// Image cache to prevent re-loading
const loadedImages = new Set<string>();
const failedImages = new Set<string>();

const publicAssetUrl = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

// Get the image URL for a plant.
// Green Acres hotlinked product images are preferred for catalog-matched plants.
// Existing local/remote thumbnails remain as fallbacks.
export function getPlantImageUrl(plant: Plant): string | null {
  if (plant.greenAcresMatch && plant.greenAcresImageUrl) {
    return plant.greenAcresImageUrl;
  }
  if (plant.thumbnailLocalPath) {
    return plant.thumbnailLocalPath.startsWith('/') ? publicAssetUrl(plant.thumbnailLocalPath) : plant.thumbnailLocalPath;
  }
  if (plant.thumbnailUrl) {
    return plant.thumbnailUrl;
  }
  return null;
}

// Check if a plant has an image available
export function hasPlantImage(plant: Plant): boolean {
  return !!((plant.greenAcresMatch && plant.greenAcresImageUrl) || plant.thumbnailLocalPath || plant.thumbnailUrl);
}

export function getPlantImageSourceLabel(plant: Plant): string | null {
  if (plant.greenAcresMatch && plant.greenAcresImageUrl) return 'Green Acres';
  if (plant.thumbnailSource) return plant.thumbnailSource;
  return null;
}

export function getPlantImageSourceUrl(plant: Plant): string | null {
  if (plant.greenAcresMatch && plant.greenAcresImageUrl) return plant.greenAcresUrl;
  return plant.thumbnailPageUrl;
}

export type PlantIconFamily =
  | 'deciduousTree'
  | 'evergreenTree'
  | 'grass'
  | 'perennial'
  | 'shrubBush'
  | 'smallFloweringPlant'
  | 'succulent';

const ICON_FAMILY_FILES: Record<PlantIconFamily, string[]> = {
  deciduousTree: [
    'Deciduous-Tree-1.svg',
    'Deciduous-Tree-2.svg',
    'Deciduous-Tree-3.svg',
    'Deciduous-Tree-4.svg',
    'Deciduous-Tree-5.svg',
    'Deciduous-Tree-6.svg',
  ],
  evergreenTree: [
    'Evergreen-Tree-1.svg',
    'Evergreen-Tree-2.svg',
  ],
  grass: [
    'Grass-1.svg',
    'Grass-2.svg',
  ],
  perennial: [
    'Perennials-1.svg',
    'Perennials-2.svg',
    'Perennials-3.svg',
    'Perennials-4.svg',
    'Perennials-5.svg',
  ],
  shrubBush: [
    'Shrub-Bush-1.svg',
    'Shrub-Bush-2.svg',
    'Shrub-Bush-3.svg',
    'Shrub-Bush-4.svg',
    'Shrub-Bush-5.svg',
    'Shrub-Bush-6.svg',
  ],
  smallFloweringPlant: [
    'Small-Flowering-Plant-1.svg',
    'Small-Flowering-Plant-2.svg',
    'Small-Flowering-Plant-3.svg',
    'Small-Flowering-Plant-4.svg',
  ],
  succulent: [
    'Succulent-1.svg',
    'Succulent-2.svg',
  ],
};

const CLUMP_SILHOUETTE_FAMILIES = new Set<PlantIconFamily>([
  'perennial',
  'shrubBush',
  'smallFloweringPlant',
]);

export const TOP_DOWN_PLANT_PALETTE = [
  // Extended plan palette. The order is intentionally high-contrast so new
  // plant types do not land on several greens/purples in a row.
  '#D54E27', // red orange
  '#A3DECF', // mint
  '#A073C2', // purple
  '#DDE985', // chartreuse
  '#59A5CB', // blue
  '#E8B85C', // gold
  '#B26175', // rose
  '#6CA47F', // green
  '#88778F', // smoky mauve
  '#F6DA7B', // yellow
  '#79C7A5', // aqua green
  '#D76F4C', // warm coral
  '#8B6FAF', // violet
  '#94B797', // sage
  '#C98A5F', // clay
  '#7FAEBC', // soft teal blue
  '#DFA3A3', // blush
  '#B8C96F', // olive lime
  '#6E8F73', // deep sage
  '#94AA75', // muted green
];

const ROCK_SYMBOL_PALETTE = [
  '#B7AA9D',
  '#9F958B',
  '#C8B9A8',
  '#A8907B',
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hexToRgbValue(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return null;
  const parsed = Number.parseInt(clean, 16);
  if (Number.isNaN(parsed)) return null;
  return { r: (parsed >> 16) & 255, g: (parsed >> 8) & 255, b: parsed & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(value => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = ((h % 360) + 360) % 360 / 360;
  s = clamp(s, 0, 100) / 100;
  l = clamp(l, 0, 100) / 100;
  if (s === 0) {
    const value = l * 255;
    return { r: value, g: value, b: value };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hue2rgb(p, q, h + 1 / 3) * 255,
    g: hue2rgb(p, q, h) * 255,
    b: hue2rgb(p, q, h - 1 / 3) * 255,
  };
}

function hashString(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function hashPlant(plant: Plant): number {
  return hashString(`${plant.id}-${plant.commonName}-${plant.botanicalName}-${plant.category}`);
}

function normalizedPlantText(plant: Plant): string {
  return `${plant.category || ''} ${plant.commonName || ''} ${plant.botanicalName || ''} ${plant.planSymbolType || ''}`.toLowerCase();
}

function includesAny(text: string, words: string[]): boolean {
  return words.some(word => text.includes(word));
}

export function getPlantIconFamily(plant: Plant): PlantIconFamily {
  const text = normalizedPlantText(plant);
  const category = (plant.category || '').toUpperCase();
  const widthFt = plant.matureWidthFt || 0;
  const heightFt = plant.matureHeightFt || 0;

  const evergreenWords = [
    'evergreen', 'conifer', 'cedar', 'cypress', 'juniper', 'pine', 'spruce', 'fir', 'thuja', 'podocarpus', 'arborvitae', 'sequoia', 'redwood', 'yew', 'holly',
  ];
  const treeWords = ['tree', 'oak', 'maple', 'elm', 'birch', 'crape myrtle', 'lagerstroemia', 'apple', 'pear', 'plum', 'cherry'];
  const grassWords = ['grass', 'carex', 'lomandra', 'festuca', 'pennisetum', 'stipa', 'miscanthus', 'juncus', 'hakonechloa', 'nassella'];
  const succulentWords = ['succulent', 'agave', 'aloe', 'aeonium', 'echeveria', 'sedum', 'sempervivum', 'dudleya', 'yucca', 'cactus', 'opuntia', 'kalanchoe'];
  const shrubWords = ['shrub', 'bush', 'boxwood', 'westringia', 'lavender', 'salvia', 'ceanothus', 'pittosporum', 'photinia', 'hebe', 'myrtus', 'viburnum', 'hydrangea', 'camellia'];
  const flowerWords = ['flower', 'bulb', 'daisy', 'iris', 'agastache', 'phlox', 'verbena', 'coreopsis', 'yarrow', 'tulip', 'lily', 'rose', 'marigold'];

  if (includesAny(text, succulentWords) || category.includes('SUCCULENT') || category.includes('CACT')) {
    return 'succulent';
  }

  if (includesAny(text, grassWords) || category.includes('GRASS') || category.includes('SEDGE')) {
    return 'grass';
  }

  if (category.includes('TREE') || includesAny(text, treeWords) || heightFt >= 12) {
    if (includesAny(text, evergreenWords)) return 'evergreenTree';
    return 'deciduousTree';
  }

  if (category.includes('SHRUB') || includesAny(text, shrubWords) || (heightFt >= 2.5 && widthFt >= 2.5)) {
    return 'shrubBush';
  }

  if (
    category.includes('ANNUAL')
    || category.includes('BULB')
    || includesAny(text, flowerWords)
    || (plant.flowers && heightFt <= 2.5 && widthFt <= 2.5)
  ) {
    return 'smallFloweringPlant';
  }

  if (category.includes('PERENNIAL') || category.includes('GROUNDCOVER')) {
    return 'perennial';
  }

  if (plant.flowers && widthFt <= 3.5 && heightFt <= 3) {
    return 'smallFloweringPlant';
  }

  return 'perennial';
}

export function getPlantLineWeight(plant: Plant): number {
  const family = getPlantIconFamily(plant);
  switch (family) {
    case 'deciduousTree':
    case 'evergreenTree':
      return 2.3;
    case 'shrubBush':
      return 1.9;
    case 'succulent':
      return 1.7;
    case 'perennial':
      return 1.4;
    case 'smallFloweringPlant':
    case 'grass':
    default:
      return 1.2;
  }
}

function getStableIconIndex(plant: Plant, family: PlantIconFamily, listLength: number): number {
  return hashString(`${plant.id}-${plant.commonName}-${plant.botanicalName}-${family}`) % listLength;
}

export function getPlantSymbolUrl(plant: Plant): string | null {
  const family = getPlantIconFamily(plant);
  return publicAssetUrl(`top_down_plant_icons/${ICON_FAMILY_FILES[family][0]}`);
}

export function getPlacedPlantSymbolUrl(plant: Plant, _placed: Pick<PlacedPlant, 'instanceId' | 'plantId'>): string {
  const family = getPlantIconFamily(plant);
  const files = ICON_FAMILY_FILES[family];
  const index = getStableIconIndex(plant, family, files.length);
  return publicAssetUrl(`top_down_plant_icons/${files[index]}`);
}

export function getPlacedPlantSilhouetteUrl(plant: Plant, placed: Pick<PlacedPlant, 'instanceId' | 'plantId'>): string | null {
  const family = getPlantIconFamily(plant);
  if (!CLUMP_SILHOUETTE_FAMILIES.has(family)) return null;

  const iconUrl = getPlacedPlantSymbolUrl(plant, placed);
  const iconFile = iconUrl.split('/').pop() || '';
  const silhouetteFile = iconFile.replace(/\.svg$/i, '-s.svg');
  return publicAssetUrl(`top_down_plant_icons/${silhouetteFile}`);
}

function palettePlantColor(plant: Plant): string {
  const text = normalizedPlantText(plant);

  if (text.includes('rock') || text.includes('boulder')) {
    const hash = hashPlant(plant);
    return ROCK_SYMBOL_PALETTE[hash % ROCK_SYMBOL_PALETTE.length];
  }

  const hash = hashPlant(plant);
  const spreadIndex = ((plant.id - 1) * 7) % TOP_DOWN_PLANT_PALETTE.length;
  const base = TOP_DOWN_PLANT_PALETTE[spreadIndex];

  const rgb = hexToRgbValue(base);
  if (!rgb) return base;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  const hueShift = ((Math.floor(hash / 97) % 5) - 2) * 1.8;
  const satShift = ((Math.floor(hash / 389) % 5) - 2) * 1.6;
  const lightShift = ((Math.floor(hash / 997) % 5) - 2) * 1.4;

  const varied = hslToRgb(
    hsl.h + hueShift,
    clamp(hsl.s + satShift, 30, 78),
    clamp(hsl.l + lightShift, 42, 72),
  );
  return rgbToHex(varied.r, varied.g, varied.b);
}

export function getPlacedPlantColor(
  _plant: Plant,
  placed: Pick<PlacedPlant, 'instanceId' | 'plantId' | 'customColor'>,
  placementIndex: number,
): string {
  if (placed.customColor) return placed.customColor;

  // Color is assigned by the plant's first-use order in the plan, not by plant
  // ID. That makes the colors march through the palette in a predictable,
  // high-contrast order as new plant types are added. Repeats of the same plant
  // get the same placementIndex from the legend number, so they stay consistent.
  const palette = TOP_DOWN_PLANT_PALETTE;
  const safeIndex = Number.isFinite(placementIndex) && placementIndex >= 0 ? Math.floor(placementIndex) : 0;
  return palette[safeIndex % palette.length];
}

// Get the default plan symbol tint color for a plant in non-placement contexts.
export function getPlantSymbolColor(plant: Plant): string {
  return palettePlantColor(plant);
}

// Get the category color for a plant
export function getPlantCategoryColor(plant: Plant): string {
  return palettePlantColor(plant);
}

// Check if a plant has a plan-view symbol available
export function hasPlantSymbol(_plant: Plant): boolean {
  return true;
}

// Check if an image has been loaded successfully
export function isImageLoaded(url: string): boolean {
  return loadedImages.has(url);
}

// Check if an image has failed to load
export function isImageFailed(url: string): boolean {
  return failedImages.has(url);
}

// Mark an image as loaded
export function markImageLoaded(url: string): void {
  loadedImages.add(url);
  failedImages.delete(url);
}

// Mark an image as failed
export function markImageFailed(url: string): void {
  failedImages.add(url);
  loadedImages.delete(url);
}

// Preload an image and return a promise
export function preloadImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (loadedImages.has(url)) {
      resolve(true);
      return;
    }
    if (failedImages.has(url)) {
      resolve(false);
      return;
    }

    const img = new Image();
    img.onload = () => {
      markImageLoaded(url);
      resolve(true);
    };
    img.onerror = () => {
      markImageFailed(url);
      resolve(false);
    };
    img.src = url;
  });
}

// Get image credit info for display
export function getImageCreditInfo(plant: Plant): { credit: string | null; license: string | null; source: string | null; pageUrl: string | null } {
  if (plant.greenAcresMatch && plant.greenAcresImageUrl) {
    return {
      credit: 'Green Acres Nursery & Supply',
      license: null,
      source: 'Green Acres',
      pageUrl: plant.greenAcresUrl,
    };
  }

  return {
    credit: plant.thumbnailCredit,
    license: plant.thumbnailLicense,
    source: plant.thumbnailSource,
    pageUrl: plant.thumbnailPageUrl,
  };
}

// Format image credit for display
export function formatImageCredit(plant: Plant): string | null {
  if (plant.greenAcresMatch && plant.greenAcresImageUrl) {
    return 'Green Acres Nursery & Supply';
  }

  const parts = [plant.thumbnailCredit, plant.thumbnailLicense, plant.thumbnailSource].filter(Boolean);
  return parts.length > 0 ? parts.join(' • ') : null;
}
