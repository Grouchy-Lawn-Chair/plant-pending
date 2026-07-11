#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const normalizedPath = path.join(root, 'public', 'green_acres_normalized.json');
const scoresJsonPath = path.join(root, 'public', 'green_acres_design_scores.json');
const scoresReportPath = path.join(root, 'public', 'green_acres_design_scores_report.csv');
const scoresSummaryPath = path.join(root, 'public', 'green_acres_design_score_summary.json');

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function writeCSV(filePath, headers, records) {
  const out = [headers.map(csvEscape).join(',')];
  for (const record of records) out.push(headers.map(h => csvEscape(record[h] ?? '')).join(','));
  fs.writeFileSync(filePath, out.join('\n') + '\n', 'utf8');
}

function clamp(value, min = 0, max = 10) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function score(value) {
  return Math.round(clamp(value) * 10) / 10;
}

function asList(value) {
  if (Array.isArray(value)) return value.map(v => String(v || '').trim()).filter(Boolean);
  if (!value) return [];
  return String(value).split(/[;,]/).map(v => v.trim()).filter(Boolean);
}

function lowerList(...values) {
  return values.flatMap(asList).map(v => v.toLowerCase());
}

function hasAny(list, terms) {
  return terms.some(term => list.some(item => item.includes(term.toLowerCase())));
}

function hasPhrase(value, terms) {
  const text = Array.isArray(value) ? value.join(' | ').toLowerCase() : String(value || '').toLowerCase();
  return terms.some(term => text.includes(term.toLowerCase()));
}

function hasWholeWord(value, terms) {
  const text = Array.isArray(value) ? value.join(' | ').toLowerCase() : String(value || '').toLowerCase();
  return terms.some(term => new RegExp(`(^|[^a-z])${term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(text));
}

function addReason(reasons, label, amount, detail) {
  if (!amount) return;
  const sign = amount > 0 ? '+' : '';
  reasons.push(`${label} ${sign}${amount}: ${detail}`);
}

function categoryHints(plant) {
  return lowerList(plant.category, plant.categoriesFromTags, plant.productName, plant.commonName, plant.botanicalName, plant.landscapeUses, plant.growthHabits);
}

function heightMax(plant) {
  return Number(plant.height?.maxFt ?? plant.height?.minFt ?? 0) || 0;
}

function widthMax(plant) {
  return Number(plant.width?.maxFt ?? plant.width?.minFt ?? 0) || 0;
}

function isEvergreen(plant, attrs, cats) {
  if (hasAny(attrs, ['evergreen', 'year-round interest'])) return true;
  if (hasAny(attrs, ['deciduous'])) return false;
  if (hasAny(cats, ['annual'])) return false;
  if (hasAny(cats, ['conifer', 'palm', 'succulent', 'agave', 'yucca', 'cactus', 'grass', 'lomandra', 'pittosporum', 'westringia', 'lavender', 'rosemary', 'dianella', 'phormium'])) return true;
  return null;
}

function isWaterwise(plant, attrs, water) {
  if (hasAny(attrs, ['waterwise', 'drought tolerant', 'low water'])) return true;
  if (hasAny(water, ['low', 'very low'])) return true;
  if (hasAny(water, ['high', 'regular', 'moist'])) return false;
  return null;
}

function estimateScores(plant) {
  const attrs = lowerList(plant.attributes);
  const uses = lowerList(plant.landscapeUses);
  const habits = lowerList(plant.growthHabits);
  const rates = lowerList(plant.growthRates);
  const flowers = lowerList(plant.flowerColors, plant.bloomSeasons);
  const foliage = lowerList(plant.foliageColors);
  const water = lowerList(plant.waterNeeds);
  const light = lowerList(plant.lightRequirements);
  const cats = categoryHints(plant);
  const h = heightMax(plant);
  const w = widthMax(plant);
  const reasons = {};
  const add = (scoreName, amount, detail) => {
    if (!reasons[scoreName]) reasons[scoreName] = [];
    addReason(reasons[scoreName], scoreName, amount, detail);
  };

  const evergreen = isEvergreen(plant, attrs, cats);
  const waterwise = isWaterwise(plant, attrs, water);
  const categoryText = String(plant.category || '').toLowerCase();
  const tagCategoryText = asList(plant.categoriesFromTags).join(' | ').toLowerCase();
  const nameText = [plant.productName, plant.commonName].join(' | ').toLowerCase();
  const annual = categoryText === 'annuals' || hasWholeWord(nameText, ['annual']) || hasPhrase(tagCategoryText, ['warm season annual', 'cool season annual']);
  const edible = hasAny(cats, ['edible', 'herb', 'fruit', 'vegetable', 'citrus', 'berry']) || hasAny(attrs, ['edible']);
  const succulentLike = hasAny(cats, ['succulent', 'agave', 'yucca', 'cactus', 'aloe', 'sedum', 'echeveria', 'sempervivum']);
  const grassLike = hasAny(cats, ['grass', 'grasses', 'lomandra', 'carex', 'dianella', 'phormium', 'juncus']);
  const treeLike = hasAny(cats, ['tree', 'trees', 'conifer', 'palm']) || h >= 12;
  const shrubLike = hasAny(cats, ['shrub', 'shrubs']) || hasAny(habits, ['bushy', 'mounding', 'upright']) || (h >= 2 && h <= 12);
  const groundcoverLike = hasAny(uses, ['groundcover']) || hasAny(habits, ['trailing', 'spreading', 'prostrate', 'creeping']);
  const containerGood = hasAny(uses, ['container']);
  const showyOrHeavyBloom = hasAny(attrs, ['showy flowers', 'long bloom season', 'flowers for cutting']) || flowers.length >= 3;
  const beeAttractor = hasAny(attrs, ['attracts bees']);
  const butterflyBirdAttractor = hasAny(attrs, ['attracts butterflies', 'attracts hummingbirds', 'attracts birds']);
  const fragrant = hasAny(attrs, ['fragrant']);
  const thorny = hasAny(attrs, ['thorn', 'spine']) || hasWholeWord([plant.productName, plant.commonName, plant.botanicalName, plant.category, plant.categoriesFromTags], ['rose', 'barberry', 'pyracantha', 'bougainvillea', 'cactus']);
  const messyFruit = hasAny(cats, ['fruit', 'berry', 'citrus', 'olive']) || hasAny(attrs, ['fruit', 'berries']);
  const petFriendly = hasAny(attrs, ['pet friendly']);
  const deerResistant = hasAny(attrs, ['deer resistant']);
  const fullSun = hasAny(light, ['full sun']);
  const shade = hasAny(light, ['shade']);

  let evergreenScore = 4.5;
  if (evergreen === true) { evergreenScore += 4.5; add('evergreenScore', 4.5, 'Green Acres tags suggest evergreen or year-round structure'); }
  if (evergreen === false) { evergreenScore -= 3.5; add('evergreenScore', -3.5, 'annual or deciduous-like category'); }
  if (succulentLike || grassLike) { evergreenScore += 1.2; add('evergreenScore', 1.2, 'architectural foliage category often holds structure'); }
  if (annual) { evergreenScore -= 3; add('evergreenScore', -3, 'annual category'); }

  let waterwiseScore = 4.5;
  if (waterwise === true) { waterwiseScore += 4; add('waterwiseScore', 4, 'low water or waterwise tag'); }
  if (waterwise === false) { waterwiseScore -= 2.5; add('waterwiseScore', -2.5, 'higher water need'); }
  if (succulentLike) { waterwiseScore += 1.5; add('waterwiseScore', 1.5, 'succulent/agave/cactus type'); }
  if (fullSun && waterwise === true) { waterwiseScore += 0.7; add('waterwiseScore', 0.7, 'full sun plus low-water fit'); }

  let messinessScore = 3;
  if (evergreen === true) { messinessScore -= 0.8; add('messinessScore', -0.8, 'evergreen structure usually means less seasonal drop'); }
  if (showyOrHeavyBloom) { messinessScore += 2.5; add('messinessScore', 2.5, 'showy or long bloom'); }
  if (beeAttractor || butterflyBirdAttractor) { messinessScore += 1.2; add('messinessScore', 1.2, 'wildlife/pollinator attraction often means flowers or seed activity'); }
  if (messyFruit) { messinessScore += 3; add('messinessScore', 3, 'fruit/berry/edible category'); }
  if (annual) { messinessScore += 1.5; add('messinessScore', 1.5, 'annuals are more seasonal'); }
  if (succulentLike || grassLike) { messinessScore -= 1.2; add('messinessScore', -1.2, 'clean architectural foliage type'); }
  if (fragrant) { messinessScore += 0.3; add('messinessScore', 0.3, 'fragrant plants often bloom'); }

  let poolSafeScore = 5;
  if (evergreen === true) { poolSafeScore += 1.7; add('poolSafeScore', 1.7, 'evergreen/year-round structure'); }
  if (waterwise === true) { poolSafeScore += 1.4; add('poolSafeScore', 1.4, 'low water/waterwise'); }
  if (containerGood) { poolSafeScore += 0.8; add('poolSafeScore', 0.8, 'container use suggests controlled growth'); }
  if (succulentLike || grassLike) { poolSafeScore += 1.1; add('poolSafeScore', 1.1, 'clean foliage/architectural category'); }
  if (showyOrHeavyBloom) { poolSafeScore -= 1.8; add('poolSafeScore', -1.8, 'showy/long bloom may drop flowers near pool'); }
  if (beeAttractor) { poolSafeScore -= 1.4; add('poolSafeScore', -1.4, 'bee attraction near pool may be undesirable'); }
  if (messyFruit || edible) { poolSafeScore -= 2.8; add('poolSafeScore', -2.8, 'fruit/edible plants can be messy near pool'); }
  if (thorny) { poolSafeScore -= 2.2; add('poolSafeScore', -2.2, 'thorns/spines can be unfriendly near pool edges'); }
  if (h > 8) { poolSafeScore -= 1.3; add('poolSafeScore', -1.3, 'large mature height may overpower narrow pool beds'); }
  if (w > 8) { poolSafeScore -= 0.8; add('poolSafeScore', -0.8, 'wide mature spread may crowd pool hardscape'); }
  poolSafeScore -= Math.max(0, messinessScore - 4) * 0.35;

  let slopeScore = 4;
  if (groundcoverLike) { slopeScore += 3; add('slopeScore', 3, 'groundcover/trailing/spreading habit'); }
  if (waterwise === true) { slopeScore += 1.8; add('slopeScore', 1.8, 'low water/waterwise'); }
  if (hasAny(uses, ['bank', 'slope', 'erosion'])) { slopeScore += 2.5; add('slopeScore', 2.5, 'slope/bank/erosion use'); }
  if (shrubLike && h <= 6) { slopeScore += 1; add('slopeScore', 1, 'medium shrub scale works on slopes'); }
  if (treeLike) { slopeScore -= 1.8; add('slopeScore', -1.8, 'tree-scale plant is less useful as slope filler'); }
  if (annual) { slopeScore -= 2; add('slopeScore', -2, 'annuals are weak long-term slope structure'); }

  let privacyScore = 2;
  if (evergreen === true) { privacyScore += 2.3; add('privacyScore', 2.3, 'evergreen screening value'); }
  if (h >= 4 && h <= 12) { privacyScore += 2.4; add('privacyScore', 2.4, 'useful mature height for privacy'); }
  if (h > 12) { privacyScore += 1.2; add('privacyScore', 1.2, 'tall plant can screen but may be tree-scale'); }
  if (w >= 3) { privacyScore += 1.2; add('privacyScore', 1.2, 'usable mature width'); }
  if (hasAny(habits, ['upright', 'columnar', 'dense', 'bushy'])) { privacyScore += 1.3; add('privacyScore', 1.3, 'upright/dense habit'); }
  if (groundcoverLike || h < 3) { privacyScore -= 2; add('privacyScore', -2, 'low/trailing plant is not a privacy screen'); }
  if (annual) { privacyScore -= 2; add('privacyScore', -2, 'annuals are not reliable privacy structure'); }

  let colorInterestScore = 2.5;
  if (flowers.length) { colorInterestScore += Math.min(3, flowers.length * 0.8); add('colorInterestScore', Math.min(3, flowers.length * 0.8), 'flower color/bloom data'); }
  if (hasAny(foliage, ['purple', 'red', 'orange', 'yellow', 'gold', 'silver', 'blue', 'gray', 'grey', 'variegated', 'bronze', 'burgundy'])) {
    colorInterestScore += 3.2; add('colorInterestScore', 3.2, 'non-green or variegated foliage');
  } else if (hasAny(foliage, ['green'])) {
    colorInterestScore += 0.4; add('colorInterestScore', 0.4, 'foliage color known');
  }
  if (showyOrHeavyBloom) { colorInterestScore += 1.2; add('colorInterestScore', 1.2, 'showy/long bloom'); }
  if (evergreen === true) { colorInterestScore += 0.7; add('colorInterestScore', 0.7, 'year-round visual interest'); }

  let petSafeScore = 4;
  if (petFriendly) { petSafeScore += 4.5; add('petSafeScore', 4.5, 'Green Acres Pet Friendly attribute'); }
  if (thorny) { petSafeScore -= 2.2; add('petSafeScore', -2.2, 'thorns/spines can be a pet hazard'); }
  if (hasAny(cats, ['toxic', 'oleander', 'sago palm', 'euphorbia', 'foxglove', 'lily'])) { petSafeScore -= 4; add('petSafeScore', -4, 'known caution category/name'); }
  if (!petFriendly) { add('petSafeScore', 0, 'no Pet Friendly tag found'); }

  let layoutReliabilityScore = 4;
  if (plant.height?.maxFt) { layoutReliabilityScore += 1.2; add('layoutReliabilityScore', 1.2, 'mature height available'); }
  if (plant.width?.maxFt) { layoutReliabilityScore += 1.2; add('layoutReliabilityScore', 1.2, 'mature width available'); }
  if (plant.lightRequirements?.length) { layoutReliabilityScore += 0.9; add('layoutReliabilityScore', 0.9, 'light data available'); }
  if (plant.waterNeeds?.length) { layoutReliabilityScore += 0.9; add('layoutReliabilityScore', 0.9, 'water data available'); }
  if (plant.attributes?.length) { layoutReliabilityScore += 0.6; add('layoutReliabilityScore', 0.6, 'attributes available'); }
  if (plant.landscapeUses?.length) { layoutReliabilityScore += 0.6; add('layoutReliabilityScore', 0.6, 'landscape uses available'); }
  if (plant.dataQualityWarnings?.length) { layoutReliabilityScore -= Math.min(2.5, plant.dataQualityWarnings.length * 0.4); add('layoutReliabilityScore', -Math.min(2.5, plant.dataQualityWarnings.length * 0.4), 'data quality warnings present'); }

  const flags = [];
  if (evergreen === true) flags.push('evergreen_likely');
  if (evergreen === false) flags.push('evergreen_unlikely');
  if (waterwise === true) flags.push('waterwise_likely');
  if (petFriendly) flags.push('pet_friendly_tag');
  if (showyOrHeavyBloom) flags.push('flowering_or_showy');
  if (beeAttractor) flags.push('attracts_bees');
  if (butterflyBirdAttractor) flags.push('wildlife_attractor');
  if (groundcoverLike) flags.push('groundcover_or_trailing');
  if (succulentLike) flags.push('succulent_like');
  if (grassLike) flags.push('grass_or_strappy');
  if (thorny) flags.push('thorn_spine_caution');
  if (annual) flags.push('annual_or_seasonal');
  if (edible) flags.push('edible_or_fruit');
  if (shade) flags.push('shade_tolerant');
  if (fullSun) flags.push('full_sun');

  const finalScores = {
    poolSafeScore: score(poolSafeScore),
    messinessScore: score(messinessScore),
    evergreenScore: score(evergreenScore),
    waterwiseScore: score(waterwiseScore),
    slopeScore: score(slopeScore),
    privacyScore: score(privacyScore),
    colorInterestScore: score(colorInterestScore),
    petSafeScore: score(petSafeScore),
    layoutReliabilityScore: score(layoutReliabilityScore),
  };

  const bestUses = [];
  if (finalScores.poolSafeScore >= 7) bestUses.push('pool_candidate');
  if (finalScores.slopeScore >= 7) bestUses.push('slope_candidate');
  if (finalScores.privacyScore >= 7) bestUses.push('privacy_candidate');
  if (finalScores.colorInterestScore >= 7) bestUses.push('color_accent');
  if (finalScores.waterwiseScore >= 7) bestUses.push('waterwise_candidate');
  if (finalScores.layoutReliabilityScore < 5) bestUses.push('needs_manual_review');

  return {
    plantId: plant.plantId,
    stablePlantKey: plant.stablePlantKey,
    productName: plant.productName,
    commonName: plant.commonName,
    botanicalName: plant.botanicalName,
    category: plant.category,
    handle: plant.handle,
    url: plant.url,
    heightMaxFt: h || null,
    widthMaxFt: w || null,
    flags,
    bestUses,
    scores: finalScores,
    scoreReasons: reasons,
    source: {
      derivedFrom: 'Green Acres normalized product tags and page fields',
      generatedAt: new Date().toISOString(),
      caveat: 'Scores are heuristic design signals for layout generation. They are not botanical guarantees.'
    }
  };
}

if (!fs.existsSync(normalizedPath)) {
  console.error(`Missing ${normalizedPath}. Run npm run normalize-green-acres first.`);
  process.exit(1);
}

const plants = JSON.parse(fs.readFileSync(normalizedPath, 'utf8'));
const scored = plants.map(estimateScores);
fs.writeFileSync(scoresJsonPath, JSON.stringify(scored, null, 2) + '\n', 'utf8');

const report = scored.map(item => ({
  Plant_ID: item.plantId,
  Product_Name: item.productName,
  Botanical_Name: item.botanicalName,
  Category: item.category,
  Pool_Safe_Score: item.scores.poolSafeScore,
  Messiness_Score: item.scores.messinessScore,
  Evergreen_Score: item.scores.evergreenScore,
  Waterwise_Score: item.scores.waterwiseScore,
  Slope_Score: item.scores.slopeScore,
  Privacy_Score: item.scores.privacyScore,
  Color_Interest_Score: item.scores.colorInterestScore,
  Pet_Safe_Score: item.scores.petSafeScore,
  Layout_Reliability_Score: item.scores.layoutReliabilityScore,
  Best_Uses: item.bestUses.join('; '),
  Flags: item.flags.join('; '),
  Height_Max_Ft: item.heightMaxFt ?? '',
  Width_Max_Ft: item.widthMaxFt ?? '',
  URL: item.url,
}));

writeCSV(scoresReportPath, [
  'Plant_ID','Product_Name','Botanical_Name','Category','Pool_Safe_Score','Messiness_Score','Evergreen_Score','Waterwise_Score','Slope_Score','Privacy_Score','Color_Interest_Score','Pet_Safe_Score','Layout_Reliability_Score','Best_Uses','Flags','Height_Max_Ft','Width_Max_Ft','URL'
], report);

function countWhere(fn) {
  return scored.filter(fn).length;
}

const topBy = key => [...scored]
  .sort((a, b) => b.scores[key] - a.scores[key] || b.scores.layoutReliabilityScore - a.scores.layoutReliabilityScore)
  .slice(0, 25)
  .map(item => ({ plantId: item.plantId, productName: item.productName, botanicalName: item.botanicalName, score: item.scores[key], flags: item.flags.slice(0, 6) }));

const summary = {
  generatedAt: new Date().toISOString(),
  source: 'public/green_acres_normalized.json',
  scoredPlants: scored.length,
  counts: {
    poolCandidates: countWhere(p => p.scores.poolSafeScore >= 7),
    lowMessPoolCandidates: countWhere(p => p.scores.poolSafeScore >= 7 && p.scores.messinessScore <= 4),
    slopeCandidates: countWhere(p => p.scores.slopeScore >= 7),
    privacyCandidates: countWhere(p => p.scores.privacyScore >= 7),
    colorAccentCandidates: countWhere(p => p.scores.colorInterestScore >= 7),
    waterwiseCandidates: countWhere(p => p.scores.waterwiseScore >= 7),
    needsManualReview: countWhere(p => p.scores.layoutReliabilityScore < 5),
    attractsBees: countWhere(p => p.flags.includes('attracts_bees')),
    petFriendlyTagged: countWhere(p => p.flags.includes('pet_friendly_tag')),
  },
  topExamples: {
    poolSafeScore: topBy('poolSafeScore'),
    slopeScore: topBy('slopeScore'),
    privacyScore: topBy('privacyScore'),
    colorInterestScore: topBy('colorInterestScore'),
    layoutReliabilityScore: topBy('layoutReliabilityScore'),
  },
  outputs: [
    'public/green_acres_design_scores.json',
    'public/green_acres_design_scores_report.csv',
    'public/green_acres_design_score_summary.json'
  ]
};

fs.writeFileSync(scoresSummaryPath, JSON.stringify(summary, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(summary, null, 2));
