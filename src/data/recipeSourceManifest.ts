export type RecipeSourceType = 'monrovia' | 'gardenia';

export interface RecipeSourceRecord {
  id: string;
  name: string;
  source: string;
  sourcePage: number;
  sourceType: RecipeSourceType;
  pattern: string;
}

const M = (id: string, name: string, source: string, sourcePage: number, pattern: string): RecipeSourceRecord => ({ id, name, source, sourcePage, sourceType: 'monrovia', pattern });
const G = (id: string, name: string, pattern: string): RecipeSourceRecord => ({ id, name, source: 'Gardenia supplied URL set', sourcePage: 0, sourceType: 'gardenia', pattern });

/** Complete expected source set: 30 Monrovia plans + 11 Gardenia entries. */
export const recipeSourceManifest: RecipeSourceRecord[] = [
  M('monrovia-2023-fire-pit', 'Fire Pit', 'Ultimate Spring Planning Guide 2023', 4, 'ring'),
  M('monrovia-2023-water-feature-pool', 'Water Feature or Pool', 'Ultimate Spring Planning Guide 2023', 6, 'layered-ring'),
  M('monrovia-2023-dining-room', 'Dining Room', 'Ultimate Spring Planning Guide 2023', 8, 'formal-symmetry'),
  M('monrovia-2023-patio-living-room', 'Patio Living Room', 'Ultimate Spring Planning Guide 2023', 10, 'asymmetric-room'),
  M('monrovia-2023-personal-retreat', 'Personal Retreat', 'Ultimate Spring Planning Guide 2023', 12, 'enclosed-retreat'),
  M('monrovia-2023-shady-corner', 'Shady Corner', 'Ultimate Spring Planning Guide 2023', 15, 'corner-layer'),
  M('monrovia-2023-retaining-wall', 'Retaining Wall', 'Ultimate Spring Planning Guide 2023', 16, 'cascade-wall'),
  M('monrovia-2023-pathway-border', 'Pathway Border', 'Ultimate Spring Planning Guide 2023', 17, 'linear-border'),
  M('monrovia-2023-driveway-border', 'Driveway Border', 'Ultimate Spring Planning Guide 2023', 18, 'linear-border'),
  M('monrovia-2023-welcoming-entry', 'Welcoming Entry', 'Ultimate Spring Planning Guide 2023', 19, 'entry-symmetry'),
  M('monrovia-2023-fenceline-flow', 'Fenceline Flow', 'Monrovia Fall Guide 2023', 2, 'fenceline-flow'),
  M('elegant-privacy-hedge-border', 'Elegant Privacy Hedge Border', 'Monrovia Fall Guide 2023', 4, 'hedge-border'),
  M('monrovia-2023-entryway-eden', 'An Entryway Eden', 'Monrovia Fall Guide 2023', 6, 'foundation-border'),
  M('monrovia-2024-lush-container', 'Lush, Easy-Care Container', 'Monrovia Weekend Project Guide 2024', 2, 'container'),
  M('monrovia-2024-romantic-cottage-corner', 'Romantic Cottage Corner', 'Monrovia Weekend Project Guide 2024', 4, 'corner-room'),
  M('delightful-drought-tolerant', 'Delightful and Drought-Tolerant', 'Monrovia Weekend Project Guide 2024', 6, 'entry-border'),
  M('monrovia-2024-hummingbird-container', 'Hummingbird Container Plan', 'Backyard Habitat Guide 2024', 4, 'container'),
  M('monrovia-2024-hummingbird-weekend', 'Hummingbird Weekend Project Plan', 'Backyard Habitat Guide 2024', 5, 'small-border'),
  M('monrovia-2024-hummingbird-landscape', 'Hummingbird Garden Landscape Plan', 'Backyard Habitat Guide 2024', 6, 'layered-border'),
  M('monrovia-2024-birding-container', 'Birding Container Plan', 'Backyard Habitat Guide 2024', 9, 'container'),
  M('monrovia-2024-birding-weekend', 'Birding Weekend Project Plan', 'Backyard Habitat Guide 2024', 10, 'small-border'),
  M('monrovia-2024-birding-landscape', 'Birding Garden Landscape Plan', 'Backyard Habitat Guide 2024', 11, 'layered-border'),
  M('monrovia-2024-bees-butterflies-container', 'Bees and Butterflies Container Plan', 'Backyard Habitat Guide 2024', 14, 'container'),
  M('monrovia-2024-bees-butterflies-weekend', 'Bees and Butterflies Weekend Project Plan', 'Backyard Habitat Guide 2024', 15, 'small-border'),
  M('monrovia-2024-bees-butterflies-landscape', 'Bees and Butterflies Landscape Plan', 'Backyard Habitat Guide 2024', 16, 'layered-border'),
  M('modern-meadow', 'Modern Meadow', 'Best Landscape Plans 2025', 2, 'meadow'),
  M('monrovia-2025-romancing-edible', 'Romancing the Edible Garden', 'Best Landscape Plans 2025', 4, 'potager'),
  M('monrovia-2025-bold-color-white', 'Bold Color and Calm White', 'Best Landscape Plans 2025', 6, 'layered-shade'),
  M('hummingbird-oasis', 'Hummingbird Oasis', 'Best Landscape Plans 2025', 8, 'layered-border'),
  M('monrovia-2025-green-drenching', 'Green Drenching', 'Best Landscape Plans 2025', 10, 'green-room'),
  G('gardenia-provencal-courtyard', 'A Contemporary Provencal Courtyard', 'formal-courtyard'),
  G('gardenia-soft-autumn-colors', 'Soft Autumn Colors', 'seasonal-border'),
  G('gardenia-brilliant-summer-border', 'Brilliant Summer Border', 'bold-tropical-border'),
  G('gardenia-successful-marriage', 'A Successful Marriage', 'minimal-drift'),
  G('gardenia-mediterranean-border', 'A Pretty Mediterranean Border Idea', 'mediterranean-drift'),
  G('gardenia-backyard-retreat', 'A Lovely Backyard Retreat with Achillea, Festuca and Grasses', 'meadow-retreat'),
  G('gardenia-desert-pollinator', 'Native Desert Pollinator Garden', 'desert-scatter'),
  G('gardenia-butterfly-friendly', 'Butterfly-Friendly Garden Design', 'pollinator-border'),
  G('gardenia-grasses-sage', 'A Fabulous Planting Idea with Grasses and Sage', 'two-plant-drift'),
  G('gardenia-salvia-caradonna', 'Salvia Caradonna Plant Profile', 'single-plant-mass'),
  G('gardenia-summer-fall-border', 'Summer-to-Fall Perennial Border', 'seasonal-layered-border'),
];

export const EXPECTED_MONROVIA_RECIPE_COUNT = 30;
export const EXPECTED_GARDENIA_RECIPE_COUNT = 11;
export const EXPECTED_RECIPE_COUNT = 41;
