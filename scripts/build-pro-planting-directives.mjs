import fs from 'node:fs';
import path from 'node:path';

const PUBLIC_DIR = path.resolve('public');
const DOCS_DIR = path.resolve('docs');
fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.mkdirSync(DOCS_DIR, { recursive: true });

const generatedAt = new Date().toISOString();
const version = 'v95-landscape-pro-directives';

const directives = {
  generatedAt,
  version,
  intent: 'Turn researched garden-design guidance into app-readable rules for plant selection, plant counts, repetition, drift/grouping, and area-specific layout behavior.',
  corePrinciples: [
    {
      id: 'rightPlantRightPlace',
      rule: 'Match plants to the actual site first: sun, water, slope, drainage, soil, heat, mature size, and maintenance.',
      appUse: 'Filter/rank candidates before layout. Do not use drought-tolerant as a synonym for cactus/succulent.'
    },
    {
      id: 'hydrozones',
      rule: 'Group plants with similar water needs and similar site conditions. Put lowest-water plants in longest sun and driest areas; higher-water plants in partial shade or runoff-collecting areas.',
      appUse: 'Keep generated palettes within a narrow water band and avoid mixing high-water plants into low-water zones.'
    },
    {
      id: 'plantCommunities',
      rule: 'Design planting areas as small communities: repeated matrix plants, structural anchors, seasonal accents, and edge/filler plants.',
      appUse: 'Generate fewer species than plant count. Repeat plants in drifts/clumps instead of selecting 20 unrelated species.'
    },
    {
      id: 'matureSize',
      rule: 'Place plants by mature size, not nursery container size. Use smaller or upright plants in narrow spaces; avoid plants that will outgrow the bed.',
      appUse: 'Use mature width for spacing. In tight strips, prefer plants under the width limit or narrow/upright forms.'
    },
    {
      id: 'layering',
      rule: 'Use low plants at edges/fronts, medium matrix plants through the body, and taller shrubs/anchors to the back or corners.',
      appUse: 'Honor marked front/back edges and use height roles during placement.'
    },
    {
      id: 'rhythmAndUnity',
      rule: 'Repeat plant forms and colors to create unity, rhythm, and a designed look. Avoid confetti-style random mixing.',
      appUse: 'Use limited palettes, repeated drifts, and consistent forms rather than one of everything.'
    },
    {
      id: 'permeableAndSoil',
      rule: 'Favor permeable hardscape, mulch, living soil, rain capture, and organic/non-synthetic materials.',
      appUse: 'Use rocks/paths/swales as optional plan elements and avoid overplanting where hardscape or maintenance access should remain.'
    }
  ],
  plantingAreas: {
    slopePlanting: {
      purpose: 'Stabilize soil, slow winter runoff, tolerate Sacramento heat/clay, and look intentional year-round.',
      shouldFeelLike: 'A repeated dry-slope community, not a succulent collection.',
      speciesPaletteTarget: { min: 4, ideal: 6, max: 9 },
      countStrategy: 'Fewer species repeated in drifts. Count depends on area and plant mature width; avoid forcing 20 plants.',
      composition: [
        { role: 'matrixGroundcoverOrSpreadingShrub', targetPercent: 35, examples: ['dwarf coyote brush', 'prostrate ceanothus', 'creeping manzanita', 'California buckwheat', 'rosemary/germander style groundcovers'] },
        { role: 'deepRootedGrassOrSedge', targetPercent: 25, examples: ['deergrass', 'blue grama', 'fescue', 'rush/sedge where appropriate'] },
        { role: 'lowShrubOrNativeShrub', targetPercent: 25, examples: ['ceanothus', 'manzanita', 'coffeeberry', 'toyons/large shrubs only as anchors'] },
        { role: 'seasonalFlowerAccent', targetPercent: 10, examples: ['California fuchsia', 'penstemon', 'yarrow', 'buckwheat'] },
        { role: 'succulentOrRockAccent', targetPercent: 5, examples: ['sedum/dudleya only as accents'] }
      ],
      placementRules: [
        'Place larger shrubs uphill/back/corners as anchors, not in the middle of every open space.',
        'Mass groundcovers and spreading shrubs in overlapping drifts to knit soil.',
        'Cluster grasses in 3s, 5s, or small drifts, not evenly sprinkled one-by-one.',
        'Leave some maintenance access and rock/mulch negative space; full coverage means mature canopy, not filling every pixel with individual plants.'
      ],
      hardRejects: ['mostly succulents', 'edible crop mode', 'annual bedding mode', 'vine/aggressive takeover plants'],
      sourceBasis: ['CNPS Sacramento Valley native planting guide', 'CNPS hillside layout', 'Sustainable Conservation hydrozones and right-plant/right-place guidance', 'UC Master Gardener Sacramento WEL list']
    },
    poolPlanter: {
      purpose: 'Create a clean, low-mess, heat-reflection-tolerant planting by pool/concrete without litter, heavy bee traffic, or unsafe spines dominating.',
      shouldFeelLike: 'Clean evergreen/everpresent foliage with color and structure, not a cactus/succulent bed.',
      speciesPaletteTarget: { min: 3, ideal: 5, max: 7 },
      countStrategy: 'Use a compact palette repeated rhythmically. In narrow 3-foot beds, fewer properly sized plants are better than many random plants.',
      composition: [
        { role: 'cleanEvergreenShrub', targetPercent: 30, examples: ['pittosporum', 'westringia', 'euonymus', 'teucrium/germander', 'dwarf olive style shrubs'] },
        { role: 'grassOrStrappyFoliage', targetPercent: 30, examples: ['lomandra', 'carex/sedge', 'juncus/rush', 'phormium/flax', 'dianella/flax lily', 'astelia'] },
        { role: 'colorFoliage', targetPercent: 20, examples: ['variegated, silver, blue, bronze, burgundy, purple, gold foliage plants'] },
        { role: 'architecturalAccent', targetPercent: 15, examples: ['agave, yucca, aloe, hesperaloe, cordyline as limited accent'] },
        { role: 'lowFlowerAccent', targetPercent: 5, examples: ['very limited low-litter flowers only when not bee-heavy near water'] }
      ],
      placementRules: [
        'Repeat 1–2 main foliage plants for rhythm; add a few accent plants, not a dozen species.',
        'Keep spiky plants away from walkways and pool traffic edges.',
        'Use front/back edges: lower plants at pool edge, taller plants against wall/fence/back edge.',
        'Favor foliage color over heavy flower drop for pool color.'
      ],
      hardRejects: ['messy fruit/nut/litter plants', 'heavy petal-drop plants', 'bee-heavy plants right at water', 'toxic/high-caution plants where avoidable', 'mostly succulents'],
      sourceBasis: ['Calscape habitat/site matching concept', 'Proven Winners tight-space mature-size guidance', 'UC Master Gardener Sacramento WEL streetscape/pool-adjacent style plants']
    },
    flowerBed: {
      purpose: 'Create intentional color using layered flower/perennial masses with repeat bloom and front/middle/back structure.',
      shouldFeelLike: 'Layered flower/perennial bed with repeated drifts, not a shrub catalog dump.',
      speciesPaletteTarget: { min: 5, ideal: 7, max: 10 },
      composition: [
        { role: 'frontLowColor', targetPercent: 25 },
        { role: 'middleFlowerMatrix', targetPercent: 45 },
        { role: 'backTallFlowerOrShrub', targetPercent: 20 },
        { role: 'textureFoliageSupport', targetPercent: 10 }
      ],
      placementRules: ['Use repeated drifts of 3–7 plants.', 'Layer low/front, medium/middle, tall/back.', 'Avoid one-of-everything randomness.']
    },
    grassDrift: {
      purpose: 'Create movement and texture using repeated grass-like clumps.',
      shouldFeelLike: 'Massing of grasses/strappy plants in clumps, not isolated dots.',
      speciesPaletteTarget: { min: 1, ideal: 3, max: 5 },
      composition: [
        { role: 'mainGrassMatrix', targetPercent: 70 },
        { role: 'secondaryGrassTexture', targetPercent: 20 },
        { role: 'accentGrassOrStrappyColor', targetPercent: 10 }
      ],
      placementRules: ['Use odd-number clumps.', 'Repeat one species per clump.', 'Vary clump size and spacing.']
    },
    hedgeRow: {
      purpose: 'Create a readable clipped or repeated screen/edge.',
      shouldFeelLike: 'One repeated hedge plant, not a mixed shrub border.',
      speciesPaletteTarget: { min: 1, ideal: 1, max: 2 },
      composition: [{ role: 'evergreenClippableShrub', targetPercent: 100 }],
      placementRules: ['Use even spacing along the marked edge/back.', 'Repeat the same plant unless user intentionally chooses a mixed screen.']
    }
  },
  layoutAlgorithms: {
    drift: 'Pick few species, assign each to a drift, place plants as grouped clusters with overlap based on mature size.',
    matrixWithAnchors: 'Fill most of area with 1–3 matrix plants, then add anchors and accents.',
    edgeBanding: 'Use front/back edge roles for height bands.',
    tightSpace: 'For beds 3 feet wide or less, pick upright/narrow or small mature-width plants and reduce plant count.'
  }
};

const jsonPath = path.join(PUBLIC_DIR, 'pro_planting_area_directives.json');
fs.writeFileSync(jsonPath, JSON.stringify(directives, null, 2));

const md = `# v95 Landscape Pro Planting Directives\n\nGenerated: ${generatedAt}\n\nThis file is the app-facing design directive. It translates the research sources into rules the generator can use. The main correction is: planting types are not plant families. A pool planter is not a succulent bed, and a slope is not a sedum bed. Each area has a job, a site fit, a palette structure, and a placement style.\n\n## Core rules\n\n${directives.corePrinciples.map(p => `### ${p.id}\n${p.rule}\n\nApp use: ${p.appUse}`).join('\n\n')}\n\n## Planting areas\n\n${Object.entries(directives.plantingAreas).map(([key, area]) => `### ${key}\nPurpose: ${area.purpose}\n\nShould feel like: ${area.shouldFeelLike}\n\nPalette target: ${area.speciesPaletteTarget.min}-${area.speciesPaletteTarget.max} species, ideal ${area.speciesPaletteTarget.ideal}.\n\nComposition:\n${area.composition.map(item => `- ${item.role}: ${item.targetPercent}%${item.examples ? ` (${item.examples.join('; ')})` : ''}`).join('\n')}\n\nPlacement rules:\n${area.placementRules.map(rule => `- ${rule}`).join('\n')}\n`).join('\n')}\n`;
fs.writeFileSync(path.join(DOCS_DIR, 'landscape-pro-directives-v95.md'), md);

console.log(`[pro-directives] wrote ${jsonPath}`);
console.log('[pro-directives] wrote docs/landscape-pro-directives-v95.md');
