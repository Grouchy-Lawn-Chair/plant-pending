import fs from 'node:fs';
import path from 'node:path';

const PUBLIC_DIR = path.resolve('public');
const NORMALIZED_PATH = path.join(PUBLIC_DIR, 'green_acres_normalized.json');
const SCORES_PATH = path.join(PUBLIC_DIR, 'green_acres_design_scores.json');
const OUT_JSON = path.join(PUBLIC_DIR, 'green_acres_research_classification.json');
const OUT_REPORT = path.join(PUBLIC_DIR, 'green_acres_research_classification_report.csv');
const OUT_POOL = path.join(PUBLIC_DIR, 'green_acres_pool_candidates.csv');
const OUT_SLOPE = path.join(PUBLIC_DIR, 'green_acres_slope_candidates.csv');
const OUT_SUMMARY = path.join(PUBLIC_DIR, 'green_acres_research_classification_summary.json');

const sourceVersion = 'v94-uc-guided-classification';
const now = new Date().toISOString();

function readJson(file, fallback = []) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function cleanText(value = '') {
  return String(value)
    .replace(/\u0083\?\?/g, "'")
    .replace(/\?\?/g, "'")
    .replace(/\?/g, '™')
    .replace(/&#174;/g, '®')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function norm(value = '') {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[®™'’`´.,()|/\-–—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(text, terms) {
  return terms.some(term => text.includes(term));
}

function scoreAdd(target, role, amount, reason) {
  target.roles[role].score += amount;
  target.roles[role].reasons.push(reason);
}

function behavior(target, key, value, reason) {
  target.behaviors[key] = value;
  target.behaviorReasons[key] ||= [];
  target.behaviorReasons[key].push(reason);
}

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

const ROLE_KEYS = ['poolPlanter', 'slopePlanting', 'flowerBed', 'hedgeRow', 'grassDrift', 'rockGarden', 'streetscape', 'nativeGarden', 'wildlifeGarden', 'shadeGarden', 'mixedBorder'];
const GARDEN_NAMES = {
  1: 'Welcome garden',
  2: 'Shade garden',
  3: 'Perennial garden',
  4: 'Popular Plant garden',
  5: 'Native Plant garden',
  6: 'Wildlife Habitat garden',
  7: 'Streetscape garden',
};

// Source-backed plant-name signals from UC Master Gardeners Sacramento County WEL list
// and UC Davis Arboretum All-Star references. These are deliberately used as source
// signals, not as exclusive plant lists.
const WEL_SOURCE_TERMS = [
  // trees / large structure
  ['acca sellowiana', [2]], ['arbutus unedo compacta', [3]], ['cercis occidentalis', [6]], ['chilopsis linearis', [5]], ['heteromeles arbutifolia', [5]], ['lagerstroemia indica catawba', [1]], ['lagerstroemia indica dynamite', [4]], ['quercus douglasii', [3]], ['vitex agnus castus', [6]],
  // shrubs / perennials
  ['achillea millefolium', [5,6]], ['acacia cognata cousin itt', [1]], ['agapanthus elaine', [4]], ['arctostaphylos emerald carpet', [5]], ['arctostaphylos howard mcminn', [5]], ['arctostaphylos carmel sur', [5,7]], ['arctostaphylos dr hurd', [5,6]], ['arctostaphylos point reyes', [5]], ['artemisia powis castle', [3]], ['asclepias', [5,6]], ['asparagus densiflorus myers', [1,2]], ['astelia chathamica silver shadow', [7]], ['aster wonder of staffa', [3]], ['baccharis pigeon point', [5]], ['berberis aquifolium', [2,5]], ['beschorneria flamingo glow', [7]], ['bulbine frutescens', [3,4,6,7]], ['caesalpinia gilliesii', [1]], ['callistemon little john', [1]], ['caryopteris dark knight', [3]], ['caryopteris summer sorbet', [3]], ['caryopteris worcester gold', [3]], ['ceanothus concha', [5]], ['ceanothus ray hartman', [5]], ['ceanothus anchor bay', [5]], ['ceanothus emily brown', [5]], ['ceanothus popcorn', [5]], ['ceanothus valley violet', [5,6]], ['ceanothus yankee point', [3]], ['centaurea cineraria', [6]], ['centranthus ruber', [1,3,7]], ['ceratostigma plumbaginoides', [4]], ['cordyline electric pink', [4]], ['correa pulchella', [2]], ['cotoneaster dammeri lowfast', [1]], ['crassula', [1,2]], ['diplacus', [6,7]], ['dicliptera', [3]], ['dymondia margaretae', [3]], ['epilobium canum', [1,4,5,6,7]], ['erigeron glaucus', [5,6]], ['erigeron karvinskianus', [3]], ['eriogonum fasciculatum', [5]], ['eriogonum giganteum', [6]], ['eriogonum grande rubescens', [6]], ['eriogonum umbellatum', [5]], ['eriophyllum lanatum', [5]], ['escallonia lido dwarf', [4]], ['euonymus alatus compactus', [1,3]], ['euonymus fortunei emerald gaiety', [3]], ['fragaria vesca', [6]], ['frangula eve case', [5]], ['garrya elliptica evie', [5]], ['gaura lindheimeri', [4]], ['grevillea coastal gem', [3]], ['grindelia', [6]], ['helianthemum wisley primrose', [3,4]], ['hesperaloe funifera', [1,6]], ['hesperaloe parviflora', [1]], ['heuchera maxima', [2,5]], ['heuchera old la rochette', [5]], ['hibiscus syriacus purple pillar', [6]], ['iris douglasiana', [5]], ['isomeris', [6]], ['juniperus horizontalis', [1]], ['juniperus green mound', [1]], ['kniphofia', [3]], ['lantana gold rush', [1]], ['lantana montevidensis', [1,4]], ['lavandula hidcote', [4,6]], ['lavandula munstead', [1]], ['lavandula stoechas', [6]], ['lavandula primavera', [6]], ['leonotis leonurus', [6]], ['lepechinia hastata', [3,7]], ['limonium californicum', [1]], ['loropetalum ruby', [4]], ['lupinus silver bush', [6]], ['monardella marian sampson', [6]], ['nandina firepower', [4]], ['nandina gulf stream', [4]], ['neomarica caerulea', [3,6]], ['nepeta walker low', [3]], ['oenanthe javanica flamingo', [3,4]], ['olea europaea little ollie', [1]], ['osmanthus fragrans', [3]], ['osteospermum', [4]], ['pelargonium x hortorum', [2]], ['penstemon', [6,7]], ['perovskia atriplicifolia', [4]], ['philadelphus lewisii', [5]], ['pittosporum cream de mint', [1]], ['pittosporum wheeler dwarf', [4]], ['plumbago auriculata imperial blue', [4]], ['punica granatum nana', [4]], ['rhamnus eve case', [5]], ['ribes aureum', [5,7]], ['ribes sanguineum', [5]], ['ribes viburnifolium', [5]], ['rudbeckia goldsturm', [1,3]], ['salvia amante', [3]], ['salvia amistad', [3]], ['salvia bees bliss', [5,6]], ['salvia pacific blue', [6,7]], ['salvia clevelandii', [5]], ['salvia greggii hot lips', [7]], ['salvia greggii lipstick', [3,7]], ['salvia leucantha santa barbara', [7]], ['salvia lyrata', [3]], ['salvia rosmarinus mozart', [3,4]], ['salvia rosmarinus prostratus', [1]], ['salvia spathacea', [5]], ['santolina chamaecyparissus lemon queen', [3]], ['saponnaria max frei', [7]], ['scrophularia californica', [6]], ['sedum', [1]], ['solidago little lemon', [6]], ['solidago cascade creek', [5,6,7]], ['sphaeralcea munroana', [6]], ['stachys byzantina', [4,6]], ['symphoricarpos san bruno mountain', [5]], ['tagetes lemmonii compactum', [3,7]], ['tanacetum parthenium', [1]], ['tetraneuris acaulis', [5]], ['teucrium chamaedrys', [4,6,7]], ['teucrium fruticans azureum', [1,4]], ['thymus pink chintz', [4]], ['tulbaghia violacea', [4]], ['verbena', [4]], ['veronica blue charm', [3]], ['veronica blue reflection', [4]], ['yucca bright star', [2,6]],
  // grasses and grass-like plants
  ['bouteloua curtipendula', [7]], ['bouteloua gracilis', [5,7]], ['bouteloua blonde ambition', [7]], ['calamagrostis avalanche', [3]], ['calamagrostis karl foerster', [3]], ['calamagrostis foliosa', [5,6]], ['carex divulsa', [3]], ['carex testacea prairie fire', [7]], ['eragrostis elliottii', [3]], ['festuca idahoensis siskiyou blue', [3,5]], ['festuca ovina glauca', [4]], ['helictotrichon sempervirens', [3]], ['juncus patens carmans grey', [5]], ['koeleria macrantha', [6]], ['leymus condensatus canyon prince', [7]], ['lomandra roma 13', [7]], ['melinis pink crystals', [3,7]], ['miscanthus little kitten', [3,7]], ['miscanthus morning light', [3,7]], ['muhlenbergia capillaris', [6,7]], ['muhlenbergia dubia', [6]], ['muhlenbergia rigens', [5,6]], ['phormium lancer', [1]], ['phormium pink stripe', [2]], ['poa costiniana', [7]],
];

const ARBORETUM_ALL_STAR_TERMS = [
  'achillea millefolium', 'arctostaphylos howard mcminn', 'arctostaphylos emerald carpet', 'bouteloua gracilis', 'cecrop? no', 'ceanothus concha', 'ceanothus ray hartman', 'chilopsis linearis', 'epilobium canum', 'hesperaloe parviflora', 'lagerstroemia indica', 'lavandula stoechas', 'muhlenbergia rigens', 'penstemon heterophyllus', 'rhamnus californica', 'salvia clevelandii', 'salvia greggii', 'solidago cascade creek', 'zephyranthes candida', 'ceanothus yankee point', 'ceanothus anchor bay', 'quercus douglasii', 'aristolochia californica', 'salvia spathacea', 'carex divulsa'
];

const ROLE_TERM_SIGNALS = {
  cleanFoliage: ['lomandra', 'sedge', 'carex', 'juncus', 'rush', 'phormium', 'flax', 'dianella', 'flax lily', 'astelia', 'westringia', 'pittosporum', 'euonymus', 'coprosma', 'cordyline', 'abelia', 'buxus', 'boxwood', 'myrtle', 'olive', 'podocarpus', 'dodonaea', 'hebe', 'distylium'],
  colorFoliage: ['variegated', 'kaleidoscope', 'gold', 'golden', 'silver', 'blue', 'red', 'purple', 'bronze', 'black', 'lime', 'platinum', 'merlot', 'burgundy', 'orange', 'copper', 'pink stripe', 'electric pink', 'all gold'],
  grasses: ['grass', 'sedge', 'carex', 'lomandra', 'juncus', 'rush', 'muhly', 'muhlenbergia', 'festuca', 'fescue', 'calamagrostis', 'miscanthus', 'bouteloua', 'deergrass', 'deer grass', 'mondo'],
  slopeShrubs: ['juniper', 'manzanita', 'arctostaphylos', 'ceanothus', 'wild lilac', 'coyote brush', 'baccharis', 'grevillea', 'rosemary', 'salvia rosmarinus', 'westringia', 'cotoneaster', 'germander', 'teucrium', 'lantana', 'epilobium', 'california fuchsia', 'buckwheat', 'eriogonum', 'coffeeberry', 'frangula', 'rhamnus', 'santolina', 'euonymus', 'myoporum', 'ground morning glory', 'convolvulus', 'prostrate', 'trailing', 'carpet'],
  groundcover: ['groundcover', 'ground cover', 'carpet', 'creeping', 'trailing', 'prostrate', 'lowfast', 'dwarf coyote brush', 'point reyes', 'yankee point', 'blue star creeper', 'thyme', 'dichondra', 'dymondia', 'mazus'],
  succulents: ['succulent', 'agave', 'aloe', 'yucca', 'mangave', 'crassula', 'echeveria', 'haworthia', 'sempervivum', 'senecio', 'stonecrop', 'sedum', 'grapto', 'cactus', 'kalanchoe', 'panda plant', 'aeonium'],
  beeHeavy: ['lavender', 'salvia', 'sage', 'rose', 'yarrow', 'verbena', 'lantana', 'penstemon', 'ceanothus', 'grevillea', 'milkweed', 'buckwheat', 'echinacea', 'rudbeckia', 'gaillardia', 'coreopsis', 'catmint', 'nepeta'],
  toxicCaution: ['oleander', 'euphorbia', 'spurge', 'foxglove', 'datura', 'castor bean', 'lily of the valley', 'nandina', 'heavenly bamboo'],
  fruitNutMess: ['almond', 'apple', 'pear', 'peach', 'plum', 'cherry', 'apricot', 'pistache', 'pistachio', 'pomegranate', 'guava', 'olive', 'fig', 'citrus', 'orange', 'lemon', 'lime', 'grape', 'berry'],
  hedge: ['pittosporum', 'boxwood', 'buxus', 'euonymus', 'myrtle', 'westringia', 'ligustrum', 'privet', 'podocarpus', 'dwarf olive', 'little ollie', 'abelia', 'nandina', 'heavenly bamboo'],
  aggressiveOrVine: ['ivy', 'hedera', 'bamboo', 'phyllostachys', 'vine', 'honeysuckle', 'jasmine', 'wisteria', 'trumpet vine', 'vinca major', 'periwinkle'],
  edibleFood: ['tomato', 'pepper', 'cucumber', 'squash', 'melon', 'eggplant', 'zucchini', 'pumpkin', 'lettuce', 'kale', 'chard', 'broccoli', 'cabbage', 'bean', 'pea', 'strawberry', 'raspberry', 'blueberry', 'blackberry', 'grape', 'citrus', 'orange', 'lemon', 'lime', 'mandarin', 'apple', 'pear', 'peach', 'plum', 'nectarine', 'apricot', 'almond', 'pistachio', 'avocado', 'fig']
};

const sourcePlants = readJson(NORMALIZED_PATH, []);
const designScores = readJson(SCORES_PATH, []);
const scoresById = new Map(designScores.map(row => [row.plantId, row]));

function sourceText(plant) {
  return norm([
    plant.productName, plant.commonName, plant.botanicalName, plant.category, plant.handle,
    ...(plant.attributes || []), ...(plant.landscapeUses || []), ...(plant.growthHabits || []),
    ...(plant.flowerColors || []), ...(plant.foliageColors || []), ...(plant.waterNeeds || []), ...(plant.lightRequirements || [])
  ].filter(Boolean).join(' '));
}

function hasWELMatch(text) {
  const matches = [];
  for (const [term, gardens] of WEL_SOURCE_TERMS) {
    const nTerm = norm(term);
    if (nTerm && text.includes(nTerm)) matches.push({ term, gardens });
  }
  return matches;
}

function hasAllStarMatch(text) {
  return ARBORETUM_ALL_STAR_TERMS.filter(term => {
    const nTerm = norm(term);
    return nTerm && text.includes(nTerm);
  });
}

function classifyPlant(plant) {
  const id = plant.plantId;
  const scoreRecord = scoresById.get(id) || {};
  const scores = scoreRecord.scores || {};
  const flags = new Set(scoreRecord.flags || []);
  const bestUses = new Set(scoreRecord.bestUses || []);
  const text = sourceText(plant);
  const height = Number(plant.height?.maxFt ?? plant.heightMaxFt ?? 0) || 0;
  const width = Number(plant.width?.maxFt ?? plant.widthMaxFt ?? 0) || 0;
  const waterNeeds = (plant.waterNeeds || []).map(norm);
  const attributes = (plant.attributes || []).map(norm);
  const landscapeUses = (plant.landscapeUses || []).map(norm);
  const growthHabits = (plant.growthHabits || []).map(norm);
  const flowerColors = (plant.flowerColors || []).map(norm);
  const foliageColors = (plant.foliageColors || []).map(norm);
  const welMatches = hasWELMatch(text);
  const allStarMatches = hasAllStarMatch(text);
  const welGardens = [...new Set(welMatches.flatMap(match => match.gardens))].sort((a, b) => a - b);
  const isSucculent = includesAny(text, ROLE_TERM_SIGNALS.succulents);
  const isGrass = includesAny(text, ROLE_TERM_SIGNALS.grasses) || flags.has('grass_like');
  const isGroundcover = includesAny(text, ROLE_TERM_SIGNALS.groundcover) || landscapeUses.includes('groundcover') || growthHabits.includes('spreading') || growthHabits.includes('trailing') || bestUses.has('groundcover') || (height > 0 && height <= 1.2 && width >= 1.5);
  const isCleanFoliage = includesAny(text, ROLE_TERM_SIGNALS.cleanFoliage) || isGrass || attributes.includes('evergreen') || flags.has('evergreen');
  const hasColorFoliage = includesAny(text, ROLE_TERM_SIGNALS.colorFoliage) || foliageColors.some(color => color !== 'green');
  const isBeeHeavy = includesAny(text, ROLE_TERM_SIGNALS.beeHeavy) || attributes.includes('attracts bees') || flags.has('attracts_bees');
  const isToxicCaution = includesAny(text, ROLE_TERM_SIGNALS.toxicCaution) || flags.has('thorn_spine_caution');
  const fruitNutMess = includesAny(text, ROLE_TERM_SIGNALS.fruitNutMess);
  const categoryText = norm(plant.category || '');
  const isEdibleFood = categoryText.includes('herbs and vegetables') || categoryText.includes('fruit') || includesAny(text, ROLE_TERM_SIGNALS.edibleFood);
  const isAnnualOrSeasonal = flags.has('annual_or_seasonal') || categoryText.includes('annual');
  const isAggressiveOrVine = includesAny(text, ROLE_TERM_SIGNALS.aggressiveOrVine);
  const isHedge = includesAny(text, ROLE_TERM_SIGNALS.hedge) || landscapeUses.includes('hedge') || bestUses.has('privacy');
  const isSlopeShrub = includesAny(text, ROLE_TERM_SIGNALS.slopeShrubs) || bestUses.has('slope');
  const flowering = flowerColors.length > 0 || flags.has('flowering_or_showy');
  const waterwiseScore = Number(scores.waterwiseScore ?? 0) || (waterNeeds.includes('low') ? 8 : waterNeeds.includes('moderate') ? 6 : 4);
  const messinessScore = Number(scores.messinessScore ?? 5) || 5;
  const evergreenScore = Number(scores.evergreenScore ?? 0) || (attributes.includes('evergreen') || flags.has('evergreen') ? 8 : 3);
  const poolSafeScore = Number(scores.poolSafeScore ?? 0) || 4;
  const slopeScore = Number(scores.slopeScore ?? 0) || 4;
  const colorInterestScore = Number(scores.colorInterestScore ?? 0) || (hasColorFoliage || flowering ? 7 : 3);

  const record = {
    plantId: id,
    stablePlantKey: plant.stablePlantKey,
    productName: cleanText(plant.productName),
    commonName: cleanText(plant.commonName),
    botanicalName: cleanText(plant.botanicalName),
    category: plant.category,
    roles: Object.fromEntries(ROLE_KEYS.map(role => [role, { score: 20, level: 'poor', confidence: 'low', reasons: [] }])),
    behaviors: {},
    behaviorReasons: {},
    sourceMatches: {
      greenAcres: true,
      wel: welMatches.map(match => ({ term: match.term, gardens: match.gardens, gardenNames: match.gardens.map(n => GARDEN_NAMES[n]) })),
      welGardenNumbers: welGardens,
      welGardenNames: welGardens.map(n => GARDEN_NAMES[n]),
      arboretumAllStarTerms: allStarMatches,
    },
    sourceTags: [],
    notes: [],
  };

  // Baseline source-backed signals.
  if (welMatches.length) {
    record.sourceTags.push('uc-sacramento-wel');
    scoreAdd(record, 'mixedBorder', 18, 'UC Master Gardener Sacramento WEL list match');
    scoreAdd(record, 'streetscape', welGardens.includes(7) ? 30 : 8, `WEL gardens: ${welGardens.map(n => GARDEN_NAMES[n]).join(', ')}`);
    if (welGardens.includes(5)) scoreAdd(record, 'nativeGarden', 32, 'WEL Native Plant garden match');
    if (welGardens.includes(6)) scoreAdd(record, 'wildlifeGarden', 30, 'WEL Wildlife Habitat garden match');
    if (welGardens.includes(3)) scoreAdd(record, 'flowerBed', 14, 'WEL Perennial garden match');
    if (welGardens.includes(2)) scoreAdd(record, 'shadeGarden', 28, 'WEL Shade garden match');
    if (welGardens.includes(7)) scoreAdd(record, 'poolPlanter', 20, 'WEL Streetscape garden match; good source signal for clean concrete-edge planting');
    if (welGardens.some(n => [5, 6, 7].includes(n))) scoreAdd(record, 'slopePlanting', 22, 'WEL native/wildlife/streetscape match; useful low-water slope source signal');
  }
  if (allStarMatches.length) {
    record.sourceTags.push('uc-davis-arboretum-all-star');
    scoreAdd(record, 'mixedBorder', 20, 'UC Davis Arboretum All-Star source signal');
    scoreAdd(record, 'streetscape', 12, 'All-Star reliability supports public-facing planting');
    scoreAdd(record, 'slopePlanting', 12, 'All-Star reliability supports low-water slope planting');
  }

  // Behaviors.
  const messLevel = messinessScore >= 7 || fruitNutMess ? 'high' : messinessScore >= 5.5 || isBeeHeavy ? 'medium' : 'low';
  behavior(record, 'messiness', messLevel, fruitNutMess ? 'fruit/nut/berry litter signal' : `design messiness score ${messinessScore.toFixed(1)}`);
  behavior(record, 'evergreenPresence', evergreenScore >= 7 ? 'evergreen/everpresent' : evergreenScore >= 4.5 ? 'semi-evergreen/uncertain' : 'seasonal/deciduous', `evergreen score ${evergreenScore.toFixed(1)}`);
  behavior(record, 'flowerDropRisk', flowering ? (isBeeHeavy ? 'medium-high' : 'medium') : 'low', flowering ? 'flowering/showy source signal' : 'no strong flowering source signal');
  behavior(record, 'beeDraw', isBeeHeavy ? 'medium-high' : flowering ? 'medium' : 'low', isBeeHeavy ? 'bee/pollinator-attracting source/name signal' : 'not a strong bee draw signal');
  behavior(record, 'petKidCaution', isToxicCaution ? 'caution' : 'normal', isToxicCaution ? 'toxic/thorn/spine caution signal' : 'no strong caution signal');
  behavior(record, 'edibleFoodCrop', isEdibleFood ? 'yes' : 'no', isEdibleFood ? 'edible crop / fruit / vegetable signal; excluded from automatic landscape roles' : 'ornamental landscape plant signal');
  behavior(record, 'annualOrSeasonal', isAnnualOrSeasonal ? 'yes' : 'no', isAnnualOrSeasonal ? 'annual/seasonal signal; weak for long-term pool/slope structure' : 'not an annual/seasonal signal');
  behavior(record, 'aggressiveOrVine', isAggressiveOrVine ? 'yes' : 'no', isAggressiveOrVine ? 'ivy/bamboo/vine/aggressive spread signal; avoid auto pool/slope roles' : 'no aggressive vine signal');
  behavior(record, 'poolAccentOnly', isSucculent || isBeeHeavy || flowering ? 'yes' : 'no', isSucculent ? 'succulent/architectural plants should be accents, not full pool palette' : isBeeHeavy || flowering ? 'flowering/bee-heavy plants should be pool accents only' : 'clean foliage can be repeated by pool');
  behavior(record, 'slopeAccentOnly', isSucculent && !isGroundcover ? 'yes' : 'no', isSucculent ? 'succulents can be slope accents but should not dominate' : 'not a succulent-dominant slope issue');
  behavior(record, 'colorType', hasColorFoliage ? 'foliage color' : flowering ? 'flower color' : 'mostly green/texture', hasColorFoliage ? 'foliage color/name source signal' : flowering ? 'flower color source signal' : 'no color accent signal');

  // Pool role.
  if (waterwiseScore >= 6) scoreAdd(record, 'poolPlanter', 8, 'waterwise enough for Sacramento-area pool planter');
  if (messLevel === 'low') scoreAdd(record, 'poolPlanter', 28, 'low-mess behavior');
  if (messLevel === 'medium') scoreAdd(record, 'poolPlanter', -10, 'medium mess/flowering caution near pool');
  if (messLevel === 'high') scoreAdd(record, 'poolPlanter', -55, 'high litter risk near pool');
  if (evergreenScore >= 7) scoreAdd(record, 'poolPlanter', 20, 'evergreen/everpresent foliage');
  if (isCleanFoliage) scoreAdd(record, 'poolPlanter', 36, 'clean foliage / grass-like / evergreen structure');
  if (hasColorFoliage) scoreAdd(record, 'poolPlanter', 24, 'color comes from foliage, not just flower drop');
  if (isGrass) scoreAdd(record, 'poolPlanter', 20, 'grass/strappy texture works near pools');
  if (isSucculent) scoreAdd(record, 'poolPlanter', 10, 'architectural accent, not dominant pool palette');
  if (isBeeHeavy) scoreAdd(record, 'poolPlanter', -28, 'bee-heavy flowering plant near pool');
  if (isToxicCaution) scoreAdd(record, 'poolPlanter', -60, 'toxic/thorn/spine caution near pool traffic');
  if (height > 6 || width > 8) scoreAdd(record, 'poolPlanter', -30, 'too large for typical narrow pool planter');
  if (poolSafeScore >= 6) scoreAdd(record, 'poolPlanter', 16, 'existing pool-safe design score');

  // Slope role.
  if (waterwiseScore >= 6) scoreAdd(record, 'slopePlanting', 12, 'waterwise enough for dry slope');
  if (isGroundcover) scoreAdd(record, 'slopePlanting', 32, 'groundcover/trailing/spreading behavior');
  if (isSlopeShrub) scoreAdd(record, 'slopePlanting', 36, 'slope-appropriate shrub/erosion-control plant type');
  if (isGrass) scoreAdd(record, 'slopePlanting', 20, 'grasses/sedges help mixed slope plantings');
  if (width >= Math.max(2.5, height * 1.4)) scoreAdd(record, 'slopePlanting', 12, 'wider-than-tall form helps cover slope');
  if (isSucculent) scoreAdd(record, 'slopePlanting', -20, 'succulent allowed only as slope accent, not main matrix');
  if (height > 7 || width > 10) scoreAdd(record, 'slopePlanting', -22, 'too large for generator slope matrix');
  if (slopeScore >= 6) scoreAdd(record, 'slopePlanting', 12, 'existing slope design score');
  if (isEdibleFood) scoreAdd(record, 'slopePlanting', -120, 'edible crop / fruit / vegetable excluded from slope landscape generator');
  if (isAnnualOrSeasonal) scoreAdd(record, 'slopePlanting', -70, 'annual/seasonal plant excluded from long-term slope structure');
  if (isAggressiveOrVine) scoreAdd(record, 'slopePlanting', -65, 'ivy/bamboo/vine/aggressive spread signal excluded from slope auto-palette');

  // Other roles.
  if (flowering && !isSucculent && !isToxicCaution && height <= 5.5 && width <= 5.5) scoreAdd(record, 'flowerBed', 42, 'flowering perennial/shrub scale fits flower bed');
  if (isGrass && height <= 5.5 && width <= 6.5) scoreAdd(record, 'grassDrift', 70, 'grass-like plant suitable for drift');
  if (isHedge && height >= 2 && width >= 1.2 && height <= 12) scoreAdd(record, 'hedgeRow', 64, 'hedge/prunable shrub signal');
  if ((isSucculent || isGrass || isGroundcover) && height <= 4.5 && width <= 6.5) scoreAdd(record, 'rockGarden', 48, 'rock-garden accent/groundcover/architectural signal');
  if (plant.attributes?.some(a => norm(a).includes('native')) || flags.has('california_native')) scoreAdd(record, 'nativeGarden', 28, 'native source signal');
  if (flowering || isBeeHeavy || welGardens.includes(6)) scoreAdd(record, 'wildlifeGarden', 20, 'flower/pollinator/wildlife habitat signal');
  if (flags.has('shade') || welGardens.includes(2)) scoreAdd(record, 'shadeGarden', 26, 'shade source signal');

  // Cap roles that should only act as accents so reports and generator do not treat them as matrix plants.
  if (isEdibleFood) {
    record.roles.poolPlanter.score = Math.min(record.roles.poolPlanter.score, 25);
    record.roles.slopePlanting.score = Math.min(record.roles.slopePlanting.score, 25);
    record.roles.grassDrift.score = Math.min(record.roles.grassDrift.score, 25);
    record.roles.hedgeRow.score = Math.min(record.roles.hedgeRow.score, 25);
  }
  if (isAnnualOrSeasonal || isAggressiveOrVine) {
    record.roles.poolPlanter.score = Math.min(record.roles.poolPlanter.score, 30);
    record.roles.slopePlanting.score = Math.min(record.roles.slopePlanting.score, 35);
  }
  if (record.behaviors.poolAccentOnly === 'yes') record.roles.poolPlanter.score = Math.min(record.roles.poolPlanter.score, 62);
  if (record.behaviors.slopeAccentOnly === 'yes') record.roles.slopePlanting.score = Math.min(record.roles.slopePlanting.score, 60);

  // Normalize role levels and confidence.
  for (const role of ROLE_KEYS) {
    const roleRecord = record.roles[role];
    roleRecord.score = Math.round(clamp(roleRecord.score));
    roleRecord.level = roleRecord.score >= 80 ? 'excellent' : roleRecord.score >= 65 ? 'good' : roleRecord.score >= 50 ? 'usable' : roleRecord.score >= 35 ? 'accent' : 'poor';
    const sourceHits = (welMatches.length ? 1 : 0) + (allStarMatches.length ? 1 : 0) + (scoreRecord ? 1 : 0);
    roleRecord.confidence = sourceHits >= 2 ? 'high' : sourceHits === 1 ? 'medium' : 'rule-based';
    if (roleRecord.reasons.length > 8) roleRecord.reasons = roleRecord.reasons.slice(0, 8);
  }

  record.notes = [
    isSucculent ? 'Succulent/architectural plants are treated as accents for pool and slope unless supported by other role signals.' : null,
    isBeeHeavy ? 'Bee/pollinator draw is useful for habitat/flower beds but down-ranked near pools.' : null,
    welMatches.length ? 'Matched local Sacramento County UC Master Gardener WEL source.' : null,
    allStarMatches.length ? 'Matched UC Davis Arboretum All-Star source term.' : null,
  ].filter(Boolean);

  return record;
}

const classifications = sourcePlants.map(classifyPlant);
fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: now, sourceVersion, plantCount: classifications.length, records: classifications }, null, 2));

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(file, rows) {
  fs.writeFileSync(file, rows.map(row => row.map(csvEscape).join(',')).join('\n') + '\n');
}

const baseHeader = ['plantId', 'commonName', 'botanicalName', 'category', 'poolScore', 'poolLevel', 'slopeScore', 'slopeLevel', 'flowerBedScore', 'hedgeScore', 'grassScore', 'messiness', 'evergreenPresence', 'beeDraw', 'petKidCaution', 'colorType', 'welGardens', 'allStar', 'notes'];
const reportRows = [baseHeader];
for (const rec of classifications) {
  reportRows.push([
    rec.plantId, rec.commonName, rec.botanicalName, rec.category,
    rec.roles.poolPlanter.score, rec.roles.poolPlanter.level,
    rec.roles.slopePlanting.score, rec.roles.slopePlanting.level,
    rec.roles.flowerBed.score, rec.roles.hedgeRow.score, rec.roles.grassDrift.score,
    rec.behaviors.messiness, rec.behaviors.evergreenPresence, rec.behaviors.beeDraw, rec.behaviors.petKidCaution, rec.behaviors.colorType,
    rec.sourceMatches.welGardenNames.join('; '), rec.sourceMatches.arboretumAllStarTerms.join('; '), rec.notes.join(' | ')
  ]);
}
writeCsv(OUT_REPORT, reportRows);

function writeCandidateCsv(file, role) {
  const rows = [[...baseHeader, 'roleReasons']];
  classifications
    .filter(rec => rec.roles[role].score >= 50)
    .sort((a, b) => b.roles[role].score - a.roles[role].score)
    .forEach(rec => rows.push([
      rec.plantId, rec.commonName, rec.botanicalName, rec.category,
      rec.roles.poolPlanter.score, rec.roles.poolPlanter.level,
      rec.roles.slopePlanting.score, rec.roles.slopePlanting.level,
      rec.roles.flowerBed.score, rec.roles.hedgeRow.score, rec.roles.grassDrift.score,
      rec.behaviors.messiness, rec.behaviors.evergreenPresence, rec.behaviors.beeDraw, rec.behaviors.petKidCaution, rec.behaviors.colorType,
      rec.sourceMatches.welGardenNames.join('; '), rec.sourceMatches.arboretumAllStarTerms.join('; '), rec.notes.join(' | '),
      rec.roles[role].reasons.join(' | ')
    ]));
  writeCsv(file, rows);
}
writeCandidateCsv(OUT_POOL, 'poolPlanter');
writeCandidateCsv(OUT_SLOPE, 'slopePlanting');

const summary = {
  generatedAt: now,
  sourceVersion,
  plantCount: classifications.length,
  counts: {
    welMatched: classifications.filter(r => r.sourceMatches.wel.length).length,
    arboretumAllStarMatched: classifications.filter(r => r.sourceMatches.arboretumAllStarTerms.length).length,
    poolGoodOrExcellent: classifications.filter(r => r.roles.poolPlanter.score >= 65).length,
    poolUsableOrBetter: classifications.filter(r => r.roles.poolPlanter.score >= 50).length,
    slopeGoodOrExcellent: classifications.filter(r => r.roles.slopePlanting.score >= 65).length,
    slopeUsableOrBetter: classifications.filter(r => r.roles.slopePlanting.score >= 50).length,
    poolAccentOnly: classifications.filter(r => r.behaviors.poolAccentOnly === 'yes').length,
    slopeAccentOnly: classifications.filter(r => r.behaviors.slopeAccentOnly === 'yes').length,
  },
  sourceNotes: [
    'UC Master Gardeners Sacramento County WEL source uses garden numbers: 1 Welcome, 2 Shade, 3 Perennial, 4 Popular Plant, 5 Native Plant, 6 Wildlife Habitat, 7 Streetscape.',
    'UC Davis Arboretum All-Star terms are used as reliability/climate-ready source signals.',
    'This is a researched/rule-based classifier. It improves generator categories but does not replace final horticultural review.'
  ]
};
fs.writeFileSync(OUT_SUMMARY, JSON.stringify(summary, null, 2));
console.log(`[research-classification] wrote ${OUT_JSON}`);
console.log(`[research-classification] WEL matches: ${summary.counts.welMatched}`);
console.log(`[research-classification] pool usable+: ${summary.counts.poolUsableOrBetter}; slope usable+: ${summary.counts.slopeUsableOrBetter}`);
