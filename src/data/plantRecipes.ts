export type RecipeLayer = 'front' | 'middle' | 'back' | 'accent';
export type MatchStatus = 'exact' | 'close' | 'substitute';
export type RiskLevel = 'low' | 'watch';

export interface PlantRecipeItem {
  sourceName: string;
  coveragePercent: number;
  layer: RecipeLayer;
  matureWidthInches?: number;
  greenAcresPlantId: string;
  greenAcresName: string;
  matchStatus: MatchStatus;
  matchScore: number;
  riskLevel: RiskLevel;
  riskNotes: string;
  notes: string;
}

export interface PlantRecipe {
  id: string;
  name: string;
  sourcePdf: string;
  sourcePage: number;
  status: 'reviewed';
  plants: PlantRecipeItem[];
}

const p = (
  sourceName: string,
  coveragePercent: number,
  layer: RecipeLayer,
  matureWidthInches: number,
  greenAcresPlantId: number,
  greenAcresName: string,
  matchStatus: MatchStatus,
  matchScore: number,
  riskNotes: string,
  notes: string,
): PlantRecipeItem => ({
  sourceName,
  coveragePercent,
  layer,
  matureWidthInches,
  greenAcresPlantId: String(greenAcresPlantId),
  greenAcresName,
  matchStatus,
  matchScore,
  riskLevel: 'low',
  riskNotes,
  notes,
});

const gardenia = (
  id: string,
  name: string,
  plants: PlantRecipeItem[],
): PlantRecipe => ({
  id,
  name,
  sourcePdf: 'Gardenia.net supplied recipe set',
  sourcePage: 0,
  status: 'reviewed',
  plants,
});

/**
 * SINGLE SOURCE OF TRUTH FOR ALL APP RECIPES.
 *
 * Every recipe used by the app must be defined here. recipeCatalog.ts is only
 * an adapter for the physics UI. The old public recipe-grid-lab is a standalone
 * development fixture and is not an application recipe source.
 */
export const plantRecipes: PlantRecipe[] = [
  {
    id: 'elegant-privacy-hedge-border',
    name: 'Elegant Privacy Hedge Border',
    sourcePdf: 'Monrovia_FallGuide_2023-Final (1)(1).pdf',
    sourcePage: 4,
    status: 'reviewed',
    plants: [
      p('Bloodstone Thrift', 30, 'front', 12, 277, 'Blue Fescue', 'substitute', 72, 'Clumping ornamental grass; no meaningful invasive or running-spread concern.', 'Compact blue-green mound preserves the low front-edge rhythm.'),
      p('Early Evolution Hydrangea', 30, 'middle', 24, 781, "Coast Rosemary 'Blue Gem'", 'substitute', 68, 'Evergreen shrub; not a running or suckering spreader.', 'Rounded flowering shrub preserves the repeated middle matrix and performs better in Orangevale heat.'),
      p('Eau de Parfum Blush Rose', 25, 'accent', 48, 729, "Bottlebrush 'Little John'", 'substitute', 64, 'Compact woody shrub; no aggressive underground spread.', 'Compact flowering accent with a similar mature mass; avoids thorn management from roses.'),
      p('UpStanding Emerald Arborvitae', 15, 'back', 96, 444, "Lomandra 'Lime Tuff'", 'substitute', 52, 'Sterile clumping selection; does not run by rhizomes.', 'Safer non-spreading structural substitute. Lower than arborvitae, so the engine should treat it as a repeated back layer rather than a true tall screen.'),
    ],
  },
  {
    id: 'modern-meadow',
    name: 'Modern Meadow',
    sourcePdf: 'LandscapeProjectGuide2025_Single(1).pdf',
    sourcePage: 2,
    status: 'reviewed',
    plants: [
      p('Northwind Switch Grass', 14, 'back', 36, 811, 'Deer Grass', 'substitute', 86, 'California native clumping grass; not a running grass.', 'Large upright airy grass closely preserves the structural back layer.'),
      p('Butterfly Weed', 14, 'middle', 24, 574, "Yarrow 'Little Moonshine'", 'substitute', 72, 'Clumping perennial; may slowly widen but is not an aggressive runner.', 'Warm flower mass and similar meadow role with dependable heat performance.'),
      p('Narrowleaf Milkweed', 10, 'middle', 12, 860, 'Fruity Germander', 'substitute', 62, 'Compact woody perennial; no rhizomatous spread.', 'Low purple flowering mass without milkweed self-seeding or wandering roots.'),
      p('Dark Matter Meadow Sage', 16, 'front', 20, 860, 'Fruity Germander', 'substitute', 80, 'Compact mound; no aggressive spread.', 'Closest safe compact purple flowering front-layer substitute.'),
      p('Heavy Metal Blue Switch Grass', 14, 'middle', 36, 399, 'Northern Lights Tufted Hair Grass', 'substitute', 82, 'Clumping ornamental grass; no running habit.', 'Blue-green fine grass keeps the meadow matrix without switch-grass reseeding concerns.'),
      p('Apex White Meadow Sage', 10, 'front', 14, 343, 'Silver Carpet', 'substitute', 58, 'Low mat-forming groundcover; spreads only gradually and is not invasive.', 'Pale silver front-edge mass substitutes for the white flowering accent.'),
      p('Sunseekers Golden Sun Coneflower', 11, 'middle', 16, 312, "Coreopsis 'Nana'", 'substitute', 88, 'Compact clumping perennial; no invasive concern.', 'Very close warm yellow daisy role and scale.'),
      p('Sunseekers White Perfection Coneflower', 11, 'middle', 16, 506, "Sedum 'Autumn Fire'", 'substitute', 60, 'Clumping upright perennial; not a spreader.', 'Pale upright flower mass and similar middle-layer weight.'),
    ],
  },
  {
    id: 'hummingbird-oasis',
    name: 'Hummingbird Oasis',
    sourcePdf: 'LandscapeProjectGuide2025_Single(1).pdf',
    sourcePage: 8,
    status: 'reviewed',
    plants: [
      p('Chateau de Chambord Rose of Sharon', 22, 'back', 48, 781, "Coast Rosemary 'Blue Gem'", 'substitute', 70, 'Evergreen woody shrub; no suckering or running habit.', 'Large flowering backdrop with better drought and heat performance.'),
      p('Chapel Hill Yellow Lantana', 17, 'middle', 36, 312, "Coreopsis 'Nana'", 'substitute', 64, 'Compact clumping perennial; no invasive concern.', 'Yellow flowering mass without lantana seedling or frost-recovery issues.'),
      p('Pink Pearl Agastache', 14, 'middle', 16, 860, 'Fruity Germander', 'substitute', 76, 'Compact mound; no aggressive reseeding or rhizomes.', 'Purple-pink flowering mound with similar pollinator role.'),
      p('Colorburst Rose Cape Fuchsia', 18, 'front', 24, 374, 'Firehouse Verbena', 'substitute', 78, 'Controlled spreading groundcover; not listed as invasive, but keep within the intended bed.', 'Low saturated flower mass keeps the front layer lively.'),
      p('Harlequin Pink Beardtongue', 14, 'front', 16, 860, 'Fruity Germander', 'substitute', 72, 'Compact woody perennial; no aggressive spread.', 'Small purple flowering mound with similar front-layer scale.'),
      p('Colorburst Yellow Cape Fuchsia', 15, 'front', 24, 312, "Coreopsis 'Nana'", 'substitute', 82, 'Clumping perennial; no meaningful invasive concern.', 'Low yellow flower mass with similar footprint.'),
    ],
  },
  {
    id: 'fire-pit',
    name: 'Fire Pit',
    sourcePdf: "Ultimate Spring Planning Guide '23(1).pdf",
    sourcePage: 4,
    status: 'reviewed',
    plants: [
      p('Little Darling Lilac', 12, 'accent', 48, 781, "Coast Rosemary 'Blue Gem'", 'substitute', 68, 'Evergreen shrub; no suckering habit.', 'Flowering accent with similar mature volume and stronger local heat tolerance.'),
      p('Evolution Colorific Coneflower', 14, 'middle', 18, 312, "Coreopsis 'Nana'", 'substitute', 84, 'Compact clumping perennial; no invasive concern.', 'Warm daisy-shaped flowers and similar middle-layer scale.'),
      p('Scallywag Holly', 14, 'back', 36, 729, "Bottlebrush 'Little John'", 'substitute', 70, 'Compact shrub; no rhizomatous spread.', 'Dense evergreen anchor with a similar rounded structural role.'),
      p('Evolution Emerald Ice Sedum', 12, 'front', 15, 506, "Sedum 'Autumn Fire'", 'close', 90, 'Clumping upright sedum; no invasive concern.', 'Same genus and nearly identical succulent mound behavior.'),
      p('Red Creeping Thyme', 14, 'front', 18, 343, 'Silver Carpet', 'substitute', 74, 'Slow mat-forming groundcover; not invasive.', 'Low front-edge carpet without thyme reseeding or bee-heavy bloom.'),
      p('Dark Matter Meadow Sage', 14, 'middle', 12, 860, 'Fruity Germander', 'substitute', 80, 'Compact mound; no aggressive spread.', 'Safe purple flowering substitute with similar scale.'),
      p('Dark Knight Bluebeard', 10, 'middle', 24, 781, "Coast Rosemary 'Blue Gem'", 'substitute', 84, 'Evergreen shrub; no suckering habit.', 'Blue flowering shrub with similar drought-tolerant role.'),
      p('Elijah Blue Fescue', 10, 'front', 12, 277, 'Blue Fescue', 'exact', 98, 'Clumping grass; no running spread.', 'Near-exact species and form match.'),
    ],
  },
  {
    id: 'fenceline-flow',
    name: 'Fenceline Flow',
    sourcePdf: 'Monrovia_FallGuide_2023-Final (1)(1).pdf',
    sourcePage: 2,
    status: 'reviewed',
    plants: [
      p('T-Rex Hosta', 28, 'middle', 72, 444, "Lomandra 'Lime Tuff'", 'substitute', 62, 'Sterile clumping selection; no rhizomatous spread.', 'Large foliage mound that handles Orangevale heat better than hosta.'),
      p('Ryusen Weeping Japanese Maple', 20, 'accent', 72, 792, "Cordyline 'Electric Pink'", 'substitute', 55, 'Clumping woody foliage plant; no invasive concern.', 'Strong colorful foliage accent without maple heat-scorch risk; lower than the source tree.'),
      p('Ice Dance Japanese Sedge', 27, 'front', 24, 399, 'Northern Lights Tufted Hair Grass', 'substitute', 82, 'Clumping grass; no running habit.', 'Fine variegated grass effect without sedge creep.'),
      p('Northern Exposure Sienna Heuchera', 25, 'front', 21, 343, 'Silver Carpet', 'substitute', 64, 'Low mat-forming groundcover; gradual spread only.', 'Cool-toned foliage edge with stronger dry-heat performance.'),
    ],
  },
  {
    id: 'delightful-drought-tolerant',
    name: 'Delightful and Drought-Tolerant',
    sourcePdf: 'Monrovia_WeekendProjectGuide2024-V4(1).pdf',
    sourcePage: 6,
    status: 'reviewed',
    plants: [
      p('Summertime Blues Chaste Tree', 18, 'back', 60, 781, "Coast Rosemary 'Blue Gem'", 'substitute', 68, 'Evergreen shrub; no invasive seedlings or suckering habit.', 'Blue flowering structural shrub without chaste-tree volunteer seedlings.'),
      p('Blonde Ambition Blue Grama Grass', 30, 'middle', 36, 399, 'Northern Lights Tufted Hair Grass', 'substitute', 84, 'Clumping ornamental grass; no running spread.', 'Fine pale grass matrix with similar movement and footprint.'),
      p('Sombrero Granada Gold Coneflower', 24, 'middle', 24, 312, "Coreopsis 'Nana'", 'substitute', 88, 'Compact clumping perennial; no invasive concern.', 'Warm yellow daisy mass with similar drought-tolerant role.'),
      p('Rozanne Cranesbill', 28, 'front', 24, 860, 'Fruity Germander', 'substitute', 66, 'Compact mound; no aggressive ground-running habit.', 'Low purple flowering front layer without sprawling cranesbill behavior.'),
    ],
  },

  gardenia('gardenia-provencal-courtyard', 'A Contemporary Provencal Courtyard', [
    p('Deer Grass', 55, 'back', 48, 811, 'Deer Grass', 'exact', 98, 'Clumping California native grass; no running spread.', 'Direct Green Acres match.'),
    p('Fruity Germander', 45, 'front', 24, 860, 'Fruity Germander', 'exact', 98, 'Compact woody perennial; no invasive concern.', 'Direct Green Acres match.'),
  ]),
  gardenia('gardenia-soft-autumn-colors', 'Soft Autumn Colors', [
    p("Sedum 'Autumn Fire'", 35, 'front', 18, 506, "Sedum 'Autumn Fire'", 'exact', 98, 'Clumping sedum; no invasive concern.', 'Direct Green Acres match.'),
    p("Coast Rosemary 'Blue Gem'", 35, 'back', 36, 781, "Coast Rosemary 'Blue Gem'", 'exact', 98, 'Evergreen shrub; no running spread.', 'Direct Green Acres match.'),
    p('Silver Carpet', 30, 'front', 24, 343, 'Silver Carpet', 'exact', 98, 'Mat-forming groundcover; gradual spread only.', 'Direct Green Acres match.'),
  ]),
  gardenia('gardenia-brilliant-summer-border', 'Brilliant Summer Border', [
    p("Bottlebrush 'Little John'", 30, 'back', 36, 729, "Bottlebrush 'Little John'", 'exact', 98, 'Compact woody shrub; no aggressive spread.', 'Direct Green Acres match.'),
    p('Bright Lights Horizon Sunset African Daisy', 45, 'middle', 24, 285, 'Bright Lights Horizon Sunset African Daisy', 'exact', 98, 'Clumping perennial; no invasive concern.', 'Direct Green Acres match.'),
    p("Cordyline 'Electric Pink'", 25, 'accent', 60, 792, "Cordyline 'Electric Pink'", 'exact', 98, 'Clumping foliage plant; no invasive concern.', 'Direct Green Acres match.'),
  ]),
  gardenia('gardenia-successful-marriage', 'A Successful Marriage', [
    p('Northern Lights Tufted Hair Grass', 45, 'middle', 12, 399, 'Northern Lights Tufted Hair Grass', 'exact', 98, 'Clumping grass; no running habit.', 'Direct Green Acres match.'),
    p('Fruity Germander', 30, 'front', 24, 860, 'Fruity Germander', 'exact', 98, 'Compact woody perennial; no invasive concern.', 'Direct Green Acres match.'),
    p('Blue Fescue', 25, 'front', 10, 277, 'Blue Fescue', 'exact', 98, 'Clumping grass; no running spread.', 'Direct Green Acres match.'),
  ]),
  gardenia('gardenia-mediterranean-border', 'A Pretty Mediterranean Border Idea', [
    p('Fruity Germander', 16, 'front', 24, 860, 'Fruity Germander', 'exact', 98, 'Compact woody perennial; no invasive concern.', 'Direct Green Acres match.'),
    p("Lily of the Nile 'Storm Cloud'", 14, 'back', 60, 937, "Lily of the Nile 'Storm Cloud'", 'exact', 98, 'Clumping rhizomatous perennial; monitor bed edges.', 'Direct Green Acres match.'),
    p('Blue Fescue', 14, 'front', 10, 277, 'Blue Fescue', 'exact', 98, 'Clumping grass; no running spread.', 'Direct Green Acres match.'),
    p('Bright Lights Horizon Sunset African Daisy', 14, 'front', 24, 285, 'Bright Lights Horizon Sunset African Daisy', 'exact', 98, 'Clumping perennial; no invasive concern.', 'Direct Green Acres match.'),
    p("Bottlebrush 'Little John'", 14, 'accent', 36, 729, "Bottlebrush 'Little John'", 'exact', 98, 'Compact woody shrub; no aggressive spread.', 'Direct Green Acres match.'),
    p("Coast Rosemary 'Blue Gem'", 14, 'back', 36, 781, "Coast Rosemary 'Blue Gem'", 'exact', 98, 'Evergreen shrub; no running spread.', 'Direct Green Acres match.'),
    p("Coreopsis 'Nana'", 14, 'middle', 24, 312, "Coreopsis 'Nana'", 'exact', 98, 'Clumping perennial; no invasive concern.', 'Direct Green Acres match.'),
  ]),
  gardenia('gardenia-backyard-retreat', 'Backyard Retreat with Achillea, Festuca and Grasses', [
    p("Yarrow 'Little Moonshine'", 35, 'middle', 24, 574, "Yarrow 'Little Moonshine'", 'exact', 98, 'Clumping perennial; may slowly widen.', 'Direct Green Acres match.'),
    p('Blue Fescue', 30, 'front', 10, 277, 'Blue Fescue', 'exact', 98, 'Clumping grass; no running spread.', 'Direct Green Acres match.'),
    p('Northern Lights Tufted Hair Grass', 35, 'back', 12, 399, 'Northern Lights Tufted Hair Grass', 'exact', 98, 'Clumping grass; no running habit.', 'Direct Green Acres match.'),
  ]),
  gardenia('gardenia-desert-pollinator', 'Native Desert Pollinator Garden', [
    p("Lomandra 'Lime Tuff'", 20, 'accent', 30, 444, "Lomandra 'Lime Tuff'", 'exact', 98, 'Sterile clumping selection; no running spread.', 'Direct Green Acres match.'),
    p("Bottlebrush 'Little John'", 25, 'back', 36, 729, "Bottlebrush 'Little John'", 'exact', 98, 'Compact woody shrub; no aggressive spread.', 'Direct Green Acres match.'),
    p('Northern Lights Tufted Hair Grass', 30, 'middle', 12, 399, 'Northern Lights Tufted Hair Grass', 'exact', 98, 'Clumping grass; no running habit.', 'Direct Green Acres match.'),
    p("Coreopsis 'Nana'", 25, 'front', 24, 312, "Coreopsis 'Nana'", 'exact', 98, 'Clumping perennial; no invasive concern.', 'Direct Green Acres match.'),
  ]),
  gardenia('gardenia-butterfly-friendly', 'Butterfly-Friendly Garden Design', [
    p("Coreopsis 'Nana'", 25, 'front', 24, 312, "Coreopsis 'Nana'", 'exact', 98, 'Clumping perennial; no invasive concern.', 'Direct Green Acres match.'),
    p("Coast Rosemary 'Blue Gem'", 20, 'back', 36, 781, "Coast Rosemary 'Blue Gem'", 'exact', 98, 'Evergreen shrub; no running spread.', 'Direct Green Acres match.'),
    p("Feather Reed Grass 'Karl Foerster'", 15, 'back', 36, 370, "Feather Reed Grass 'Karl Foerster'", 'exact', 98, 'Clumping ornamental grass; no running habit.', 'Direct Green Acres match.'),
    p("Sedum 'Autumn Fire'", 20, 'middle', 18, 506, "Sedum 'Autumn Fire'", 'exact', 98, 'Clumping sedum; no invasive concern.', 'Direct Green Acres match.'),
    p('Blue Fescue', 20, 'front', 10, 277, 'Blue Fescue', 'exact', 98, 'Clumping grass; no running spread.', 'Direct Green Acres match.'),
  ]),
  gardenia('gardenia-grasses-sage', 'A Fabulous Planting Idea with Grasses and Sage', [
    p('Northern Lights Tufted Hair Grass', 60, 'middle', 12, 399, 'Northern Lights Tufted Hair Grass', 'exact', 98, 'Clumping grass; no running habit.', 'Direct Green Acres match.'),
    p("Coast Rosemary 'Blue Gem'", 40, 'back', 36, 781, "Coast Rosemary 'Blue Gem'", 'exact', 98, 'Evergreen shrub; no running spread.', 'Direct Green Acres match.'),
  ]),
  gardenia('gardenia-summer-fall-border', 'Summer-to-Fall Perennial Border', [
    p("Bottlebrush 'Little John'", 20, 'accent', 36, 729, "Bottlebrush 'Little John'", 'exact', 98, 'Compact woody shrub; no aggressive spread.', 'Direct Green Acres match.'),
    p("Coast Rosemary 'Blue Gem'", 20, 'back', 36, 781, "Coast Rosemary 'Blue Gem'", 'exact', 98, 'Evergreen shrub; no running spread.', 'Direct Green Acres match.'),
    p('Bright Lights Horizon Sunset African Daisy', 20, 'middle', 24, 285, 'Bright Lights Horizon Sunset African Daisy', 'exact', 98, 'Clumping perennial; no invasive concern.', 'Direct Green Acres match.'),
    p('Blue Fescue', 20, 'front', 10, 277, 'Blue Fescue', 'exact', 98, 'Clumping grass; no running spread.', 'Direct Green Acres match.'),
    p('Firehouse Verbena', 20, 'front', 22, 374, 'Firehouse Verbena', 'exact', 98, 'Controlled spreading groundcover; keep within intended bed.', 'Direct Green Acres match.'),
  ]),
];

export const getPlantRecipe = (id: string): PlantRecipe | undefined =>
  plantRecipes.find((recipe) => recipe.id === id);
