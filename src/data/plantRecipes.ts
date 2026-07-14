export type RecipeLayer = 'front' | 'middle' | 'back' | 'accent';
export type MatchStatus = 'unmatched' | 'exact' | 'close' | 'substitute' | 'needs-review';

export interface PlantRecipeItem {
  sourceName: string;
  coveragePercent: number;
  layer: RecipeLayer;
  matureWidthInches?: number;
  greenAcresPlantId?: string;
  greenAcresName?: string;
  matchStatus: MatchStatus;
  notes?: string;
}

export interface PlantRecipe {
  id: string;
  name: string;
  sourcePdf: string;
  sourcePage: number;
  status: 'draft' | 'reviewed';
  plants: PlantRecipeItem[];
}

/**
 * First-pass catalog extracted from the uploaded Monrovia guides.
 * Coverage percentages are visual estimates intended to drive the physics generator,
 * not reproduce the source drawings exactly.
 */
export const plantRecipes: PlantRecipe[] = [
  {
    id: 'elegant-privacy-hedge-border',
    name: 'Elegant Privacy Hedge Border',
    sourcePdf: 'Monrovia_FallGuide_2023-Final (1)(1).pdf',
    sourcePage: 4,
    status: 'reviewed',
    plants: [
      { sourceName: 'Bloodstone Thrift', coveragePercent: 30, layer: 'front', matureWidthInches: 12, matchStatus: 'unmatched' },
      { sourceName: 'Early Evolution Hydrangea', coveragePercent: 30, layer: 'middle', matureWidthInches: 24, matchStatus: 'unmatched' },
      { sourceName: 'Eau de Parfum Blush Rose', coveragePercent: 25, layer: 'accent', matureWidthInches: 48, matchStatus: 'unmatched' },
      { sourceName: 'UpStanding Emerald Arborvitae', coveragePercent: 15, layer: 'back', matureWidthInches: 96, matchStatus: 'unmatched' },
    ],
  },
  {
    id: 'modern-meadow',
    name: 'Modern Meadow',
    sourcePdf: 'LandscapeProjectGuide2025_Single(1).pdf',
    sourcePage: 2,
    status: 'draft',
    plants: [
      { sourceName: 'Northwind Switch Grass', coveragePercent: 14, layer: 'back', matureWidthInches: 36, matchStatus: 'unmatched' },
      { sourceName: 'Butterfly Weed', coveragePercent: 14, layer: 'middle', matureWidthInches: 24, matchStatus: 'unmatched' },
      { sourceName: 'Narrowleaf Milkweed', coveragePercent: 10, layer: 'middle', matureWidthInches: 12, matchStatus: 'unmatched' },
      { sourceName: 'Dark Matter Meadow Sage', coveragePercent: 16, layer: 'front', matureWidthInches: 20, matchStatus: 'unmatched' },
      { sourceName: 'Heavy Metal Blue Switch Grass', coveragePercent: 14, layer: 'middle', matureWidthInches: 36, matchStatus: 'unmatched' },
      { sourceName: 'Apex White Meadow Sage', coveragePercent: 10, layer: 'front', matureWidthInches: 14, matchStatus: 'unmatched' },
      { sourceName: 'Sunseekers Golden Sun Coneflower', coveragePercent: 11, layer: 'middle', matureWidthInches: 16, matchStatus: 'unmatched' },
      { sourceName: 'Sunseekers White Perfection Coneflower', coveragePercent: 11, layer: 'middle', matureWidthInches: 16, matchStatus: 'unmatched' },
    ],
  },
  {
    id: 'hummingbird-oasis',
    name: 'Hummingbird Oasis',
    sourcePdf: 'LandscapeProjectGuide2025_Single(1).pdf',
    sourcePage: 8,
    status: 'draft',
    plants: [
      { sourceName: 'Chateau de Chambord Rose of Sharon', coveragePercent: 22, layer: 'back', matureWidthInches: 48, matchStatus: 'unmatched' },
      { sourceName: 'Chapel Hill Yellow Lantana', coveragePercent: 17, layer: 'middle', matureWidthInches: 36, matchStatus: 'unmatched' },
      { sourceName: 'Pink Pearl Agastache', coveragePercent: 14, layer: 'middle', matureWidthInches: 16, matchStatus: 'unmatched' },
      { sourceName: 'Colorburst Rose Cape Fuchsia', coveragePercent: 18, layer: 'front', matureWidthInches: 24, matchStatus: 'unmatched' },
      { sourceName: 'Harlequin Pink Beardtongue', coveragePercent: 14, layer: 'front', matureWidthInches: 16, matchStatus: 'unmatched' },
      { sourceName: 'Colorburst Yellow Cape Fuchsia', coveragePercent: 15, layer: 'front', matureWidthInches: 24, matchStatus: 'unmatched' },
    ],
  },
  {
    id: 'fire-pit',
    name: 'Fire Pit',
    sourcePdf: "Ultimate Spring Planning Guide '23(1).pdf",
    sourcePage: 4,
    status: 'draft',
    plants: [
      { sourceName: 'Little Darling Lilac', coveragePercent: 12, layer: 'accent', matureWidthInches: 48, matchStatus: 'unmatched' },
      { sourceName: 'Evolution Colorific Coneflower', coveragePercent: 14, layer: 'middle', matureWidthInches: 18, matchStatus: 'unmatched' },
      { sourceName: 'Scallywag Holly', coveragePercent: 14, layer: 'back', matureWidthInches: 36, matchStatus: 'unmatched' },
      { sourceName: 'Evolution Emerald Ice Sedum', coveragePercent: 12, layer: 'front', matureWidthInches: 15, matchStatus: 'unmatched' },
      { sourceName: 'Red Creeping Thyme', coveragePercent: 14, layer: 'front', matureWidthInches: 18, matchStatus: 'unmatched' },
      { sourceName: 'Dark Matter Meadow Sage', coveragePercent: 14, layer: 'middle', matureWidthInches: 12, matchStatus: 'unmatched' },
      { sourceName: 'Dark Knight Bluebeard', coveragePercent: 10, layer: 'middle', matureWidthInches: 24, matchStatus: 'unmatched' },
      { sourceName: 'Elijah Blue Fescue', coveragePercent: 10, layer: 'front', matureWidthInches: 12, matchStatus: 'unmatched' },
    ],
  },
  {
    id: 'fenceline-flow',
    name: 'Fenceline Flow',
    sourcePdf: 'Monrovia_FallGuide_2023-Final (1)(1).pdf',
    sourcePage: 2,
    status: 'draft',
    plants: [
      { sourceName: 'T-Rex Hosta', coveragePercent: 28, layer: 'middle', matureWidthInches: 72, matchStatus: 'unmatched' },
      { sourceName: 'Ryusen Weeping Japanese Maple', coveragePercent: 20, layer: 'accent', matureWidthInches: 72, matchStatus: 'unmatched' },
      { sourceName: 'Ice Dance Japanese Sedge', coveragePercent: 27, layer: 'front', matureWidthInches: 24, matchStatus: 'unmatched' },
      { sourceName: 'Northern Exposure Sienna Heuchera', coveragePercent: 25, layer: 'front', matureWidthInches: 21, matchStatus: 'unmatched' },
    ],
  },
  {
    id: 'delightful-drought-tolerant',
    name: 'Delightful and Drought-Tolerant',
    sourcePdf: 'Monrovia_WeekendProjectGuide2024-V4(1).pdf',
    sourcePage: 6,
    status: 'draft',
    plants: [
      { sourceName: 'Summertime Blues Chaste Tree', coveragePercent: 18, layer: 'back', matureWidthInches: 60, matchStatus: 'unmatched' },
      { sourceName: 'Blonde Ambition Blue Grama Grass', coveragePercent: 30, layer: 'middle', matureWidthInches: 36, matchStatus: 'unmatched' },
      { sourceName: 'Sombrero Granada Gold Coneflower', coveragePercent: 24, layer: 'middle', matureWidthInches: 24, matchStatus: 'unmatched' },
      { sourceName: 'Rozanne Cranesbill', coveragePercent: 28, layer: 'front', matureWidthInches: 24, matchStatus: 'unmatched' },
    ],
  },
];

export const getPlantRecipe = (id: string): PlantRecipe | undefined =>
  plantRecipes.find((recipe) => recipe.id === id);
