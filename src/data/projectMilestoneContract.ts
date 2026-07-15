export const PROJECT_MILESTONE_CONTRACT_VERSION = '1.0.0';

/**
 * Plant Pending's single authoritative implementation contract.
 *
 * This file is the source of truth for recipe matching and milestone preservation.
 * Documentation and tests may reference these rules, but must not restate a competing copy.
 */
export const projectMilestoneContract = {
  authority: {
    greenAcresDataset: 'The clean Green Acres plant dataset is the production truth for plant identity, category, mature size, light, water, and other plant facts.',
    sourceRecipe: 'The supplied source plan is the truth for design intent, plant roles, composition, and placement relationships.',
    oneSourceRule: 'Rules live here once. Other files import or reference this contract rather than maintaining duplicate versions.',
  },

  recipeMatching: {
    searchOrder: [
      'exact cultivar',
      'same species or close cultivar',
      'same genus with comparable function',
      'same functional plant category',
      'documented functional substitute',
    ],
    requiredComparisons: [
      'design role',
      'plant category',
      'sun and shade range',
      'mature height',
      'mature width',
      'growth form',
      'evergreen or seasonal behavior',
      'foliage texture',
      'important foliage or flower color',
      'water need',
      'Orangevale climate suitability',
      'invasive and unacceptable-plant filter',
    ],
    hardRejects: [
      'shade plant replaced by a full-sun plant',
      'hedge or screen replaced by grass, groundcover, or unrelated mound',
      'tree replaced by shrub',
      'evergreen screen replaced by seasonal perennial',
      'broadleaf focal foliage replaced by fine grass when foliage is central to the design',
      'low front plant replaced by a tall back plant',
      'wet-site plant replaced by dry-site plant',
      'invasive or otherwise unacceptable plant retained when an acceptable option exists',
    ],
    preserveRoles: 'Every source plant role must resolve to one approved final Green Acres plant unless an explicitly reviewed decision combines roles.',
    noShortcutPool: 'Every source plant must be searched against the full clean Green Acres dataset. Reusing a familiar small plant pool is prohibited.',
    productionDataRule: 'Runtime recipe data contains only the approved final Green Acres plants. Source plants, rejected candidates, and substitution reasoning remain in audit data only.',
  },

  milestonePreservation: {
    rule: 'When a feature reaches an approved milestone, capture its behavior as shared production code, a named configuration, and automated tests before extending or integrating it.',
    requiredArtifacts: [
      'one shared implementation used by every production entry point',
      'one authoritative configuration or contract',
      'automated tests for the approved behavior',
      'a short milestone note describing what must not regress',
    ],
    prohibited: [
      'rewriting a proven feature as a simplified parallel implementation',
      'copying milestone logic into a second engine or catalog',
      'deleting a working lab or reference implementation before parity is proven',
      'calling integration complete before the milestone tests pass',
    ],
  },

  physicsMilestone: {
    name: 'Recipe Grid Lab 12.7 behavior',
    mustPreserve: [
      'multiple selectable front edges',
      'multiple selectable back edges',
      'front-fill placement following selected front edges',
      'back-attract placement distributed along selected back edges and offset inward',
      'scatter and stack placement modes',
      'random and grouped drop order',
      'physics size percentage',
      'spacing pad',
      'open-space fill levels',
      'per-plant percentage and count',
      'centers kept inside the zone',
      'seed changes create visibly different layouts without losing recipe structure',
    ],
  },
} as const;

export type ProjectMilestoneContract = typeof projectMilestoneContract;
