#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { PLANT_ICON_BY_FILE } from './plant-icon-taxonomy.mjs';

const catalogPath = process.argv[2] || path.join(process.cwd(), 'public', 'green_acres_catalog.csv');
const reportPath = path.join(path.dirname(catalogPath), 'plan_icon_assignment_report.csv');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (q && text[i + 1] === '"') { cur += '"'; i++; }
      else q = !q;
    } else if (ch === ',' && !q) {
      row.push(cur); cur = '';
    } else if ((ch === '\n' || ch === '\r') && !q) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      if (row.some(v => String(v).trim() !== '')) rows.push(row);
      row = []; cur = '';
    } else {
      cur += ch;
    }
  }
  row.push(cur);
  if (row.some(v => String(v).trim() !== '')) rows.push(row);
  return rows;
}

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(headers, records) {
  return [headers.map(csvEscape).join(','), ...records.map(row => headers.map(h => csvEscape(row[h] ?? '')).join(','))].join('\n');
}

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/&#\d+;/g, ' ')
    .replace(/[™®©]/g, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(text, words) {
  return words.some(word => text.includes(word));
}

function rxAny(text, regexes) {
  return regexes.some(rx => rx.test(text));
}

function numberValue(value) {
  const n = Number.parseFloat(String(value || ''));
  return Number.isFinite(n) ? n : null;
}

function hashText(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function choose(pool, row, salt = '') {
  if (!Array.isArray(pool) || pool.length === 0) return '20.svg';
  const key = [row.Common_Name, row.Botanical_Name, row.Green_Acres_Botanical_Name, row.Category, salt].join('|');
  return `${pool[hashText(key) % pool.length]}.svg`;
}

function fileMeta(file) {
  return PLANT_ICON_BY_FILE[file] || { slug: file.replace(/\.svg$/, ''), label: file };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hexToRgb(hex) {
  const clean = String(hex || '').replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h, s, l) {
  h = (((h % 360) + 360) % 360) / 360;
  s = clamp(s, 0, 100) / 100;
  l = clamp(l, 0, 100) / 100;
  if (s === 0) {
    const value = l * 255;
    return { r: value, g: value, b: value };
  }
  const hue2rgb = (p, q, t) => {
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

function isTrue(value) {
  return ['true', 'yes', '1', 'x'].includes(String(value || '').trim().toLowerCase());
}

function baseColorForRow(row) {
  const name = norm(`${row.Common_Name || ''} ${row.Botanical_Name || ''} ${row.Green_Acres_Product_Name || ''}`);
  const category = norm(row.Category).toUpperCase();
  const flowers = isTrue(row.Flowers);

  if (category.includes('TREE')) {
    if (/palm/.test(name)) return '#7FA66A';
    if (/(conifer|cypress|cedar|spruce|juniper|arborvitae|redwood|sequoia|pine)/.test(name)) return '#668E63';
    if (/(redbud|crape myrtle|lagerstroemia|flowering cherry|flowering plum|flowering pear|crabapple|dogwood|magnolia)/.test(name)) return '#8FA866';
    return '#77A66B';
  }

  if (/(california poppy|eschscholzia|orange|kumquat|marigold)/.test(name)) return '#F2A23A';
  if (/(sunflower|coreopsis|moonbeam|carolina jessamine|palo verde|yellow|gold|golden|freesia)/.test(name)) return '#DDBA45';
  if (/(red hot poker|heatwave|blaze|dynamite|red buckwheat|red |fuchsia|little john|bottlebrush)/.test(name)) return '#D95F5F';
  if (/(rose|pink|gaura|santa barbara daisy|muhly|redbud|purple smoke|royal purple|lenten rose)/.test(name)) return '#D98AB1';
  if (/(lavender|sage|salvia|amistad|plumbago|blue|penstemon|russian sage|iris)/.test(name)) return '#8A8FC7';
  if (/(white|snow|silver dust|dusty miller)/.test(name)) return '#BFC7B2';
  if (/(blue spruce|blue fescue|blue oat|platinum|silver|glauca|yucca|agave|echeveria|sedum)/.test(name)) return '#8FAFAE';
  if (/(nandina|firepower|gulf stream|heavenly bamboo)/.test(name)) return '#B96F59';
  if (/(manzanita|grevillea|olive|sweet bay|osmanthus|euonymus|juniper|star jasmine)/.test(name)) return '#6F9B69';
  if (/(sedge|carex|lomandra|grass|flax|phormium|muhlenbergia|calamagrostis|fescue)/.test(name)) return '#9CA866';
  if (/(dymondia|silver carpet|lantana|verbena|groundcover)/.test(name)) return '#8FBF83';
  if (/palm/.test(name)) return '#7FA66A';
  if (/fern/.test(name)) return '#6FA878';
  if (/(maple|oak|pistache|crape myrtle|redbud|pear|willow|guava|apple|peach|nectarine|apricot|plum|cherry|fig|persimmon|jujube|almond)/.test(name)) return '#77A66B';

  if (flowers) return '#C992B8';
  if (category.includes('GRASS')) return '#9CA866';
  if (category.includes('TREE')) return '#6F9B69';
  if (category.includes('GROUNDCOVER')) return '#8FBF83';
  if (category.includes('VINE')) return '#6FA878';
  return '#6F9B69';
}

function colorForRow(row) {
  const base = baseColorForRow(row);
  const rgb = hexToRgb(base);
  if (!rgb) return base;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const key = [row.Common_Name, row.Botanical_Name, row.Green_Acres_Botanical_Name, row.Category].join('|');
  const hash = hashText(key);
  const hueShift = (hash % 29) - 14;
  const satShift = (Math.floor(hash / 31) % 17) - 8;
  const lightShift = (Math.floor(hash / 997) % 15) - 7;
  const varied = hslToRgb(hsl.h + hueShift, hsl.s + satShift, hsl.l + lightShift);
  return rgbToHex(varied.r, varied.g, varied.b);
}

// Icons are intentionally reused across multiple pools. The goal is visual variety with a close-enough plant-form read.
const POOLS = {
  boulder: [6],
  boulderGroup: [13],

  // Category-safe pools. Icons can be reused, but each pool stays within a believable plant form.
  vine: [8, 12, 36, 37, 38, 40, 43, 78, 85, 86, 97, 98],
  espalier: [12, 36, 38, 43, 78, 82, 86, 97, 98],

  groundcoverFlowing: [8, 17, 24, 36, 37, 40, 61, 62, 66, 75, 77, 78, 79, 85, 86, 91, 92, 98, 106, 110, 111],
  groundcoverDense: [5, 7, 9, 11, 20, 21, 24, 29, 30, 51, 54, 55, 57, 60, 66, 67, 68, 73, 75, 87, 88, 89, 93, 96, 105, 106, 107, 109, 110, 111],

  herbSmall: [2, 3, 14, 19, 28, 31, 35, 36, 39, 40, 43, 58, 59, 63, 78, 81, 82, 84, 95, 102],
  vegetable: [2, 14, 19, 28, 31, 38, 46, 61, 62, 63, 77, 81, 84, 96, 97],

  grassArching: [18, 25, 26, 33, 37, 42, 48, 50, 64, 65, 69, 71, 72, 74, 83, 99, 100, 108],
  grassUpright: [18, 25, 26, 33, 42, 48, 50, 64, 65, 69, 71, 74, 83, 99, 100, 108],
  strappy: [15, 18, 25, 27, 32, 33, 34, 39, 41, 42, 44, 45, 46, 50, 52, 64, 69, 70, 71, 72, 74, 76, 79, 80, 83, 94, 99, 100, 101, 103, 108],

  succulentRosette: [15, 27, 32, 34, 39, 41, 44, 45, 50, 52, 63, 70, 72, 74, 79, 80, 83, 94, 95, 99, 100, 101, 103, 108],
  cactus: [18, 25, 33, 42, 50, 64, 65, 69, 71, 74, 83, 99, 100, 108],
  boldFoliage: [14, 19, 27, 33, 38, 39, 46, 61, 62, 77, 79, 81, 84, 99, 100],
  fern: [12, 26, 37, 43, 47, 71, 77, 86],

  flowerPerennial: [1, 3, 14, 15, 16, 31, 35, 39, 44, 45, 49, 53, 58, 59, 63, 64, 70, 76, 80, 82, 84, 95, 101, 102],
  flowerSpike: [18, 25, 30, 33, 39, 41, 45, 48, 49, 50, 64, 65, 69, 71, 72, 74, 76, 83, 95, 101, 103, 108],
  flowerAiry: [3, 12, 36, 37, 40, 43, 48, 49, 78, 82, 85, 86, 102],

  shrubFlowering: [1, 16, 31, 35, 49, 58, 59, 63, 70, 76, 84, 95, 96, 101, 102],
  shrubAiry: [3, 12, 26, 36, 37, 40, 43, 48, 78, 82, 85, 86, 102],
  shrubTextured: [4, 5, 7, 11, 21, 24, 29, 30, 51, 52, 54, 55, 56, 57, 68, 87, 88, 89, 90, 91, 93, 105, 106, 107, 110, 111],
  shrubCompact: [2, 5, 7, 9, 11, 17, 20, 21, 24, 29, 30, 35, 51, 54, 55, 57, 60, 67, 68, 73, 75, 87, 88, 93, 96, 105, 106, 107, 109, 110, 111],
  shrubFormal: [5, 9, 10, 17, 20, 24, 29, 51, 54, 55, 60, 67, 68, 73, 93, 105, 107, 109],
  shrubColumnar: [4, 7, 10, 11, 20, 21, 29, 54, 55, 56, 67, 68, 73, 87, 93, 105, 107, 109],
  shrubSpreading: [8, 9, 11, 17, 21, 23, 30, 54, 60, 66, 75, 77, 87, 88, 91, 92, 98, 106, 110, 111],
  shrubGeneral: [3, 5, 7, 9, 11, 12, 17, 20, 21, 24, 29, 30, 35, 51, 54, 55, 57, 60, 67, 68, 73, 75, 87, 88, 93, 96, 105, 106, 107, 109, 110, 111],

  // Tree pools are deliberately tree/canopy-safe. No conifer, vine, or groundcover-looking symbols here.
  treeDeciduous: [5, 7, 10, 11, 20, 21, 22, 23, 29, 54, 55, 56, 57, 60, 67, 68, 73, 87, 88, 93, 105, 107, 109, 110, 111],
  treeFlowering: [1, 7, 10, 16, 20, 21, 22, 23, 29, 54, 58, 59, 63, 67, 70, 73, 84, 87, 88, 93, 96, 101, 102, 105, 107],
  treeColumnar: [4, 7, 10, 11, 20, 21, 29, 54, 55, 56, 67, 68, 73, 87, 93, 105, 107, 109],
  treePalm: [46],
  treeConifer: [47, 52, 89, 90, 94, 103],
  treeFruit: [7, 10, 20, 21, 22, 23, 29, 54, 55, 56, 57, 60, 67, 68, 73, 87, 88, 93, 105, 107, 109, 110, 111],
  treeGeneral: [7, 10, 20, 21, 22, 23, 29, 54, 55, 56, 57, 60, 67, 68, 73, 87, 88, 93, 105, 107, 109, 110, 111],
};

function iconForRow(row) {
  const common = norm(row.Common_Name);
  const botanical = norm(row.Botanical_Name || row.Green_Acres_Botanical_Name);
  const category = norm(row.Category);
  const form = norm(row.Plant_Form_Est || row.Green_Acres_Growth_Habit);
  const tags = norm(row.Green_Acres_Tags);
  const sourceCats = norm(row.Green_Acres_Source_Categories);
  const landscapeUses = norm(row.Green_Acres_Landscape_Uses);
  const attrs = norm(row.Green_Acres_Attributes);
  const foliage = norm(row.Green_Acres_Foliage_Color);
  const flowers = norm(row.Green_Acres_Flower_Color || row.Flower_Color_Est);
  const notes = norm(row.App_Placement_Notes || row.Knowledge_Notes || row.Green_Acres_Notes);
  const all = [common, botanical, category, form, tags, sourceCats, landscapeUses, attrs, foliage, flowers, notes].join(' ');
  const nameOnly = [common, botanical, category].join(' ');
  const matureHeight = numberValue(row.Mature_Height_ft_est);
  const matureWidth = numberValue(row.Mature_Width_ft_est);
  const ratio = matureHeight && matureWidth ? matureWidth / matureHeight : null;
  const woodyCategory = category.includes('tree') || category.includes('shrub') || category.includes('rose');
  const isTree = category.includes('tree') || sourceCats.includes('tree') || tags.includes('type tree');
  const isShrub = category.includes('shrub') || sourceCats.includes('shrub') || category.includes('rose') || tags.includes('type shrub');
  const isAnnualOrPerennial = category.includes('annual') || category.includes('perennial') || sourceCats.includes('annual') || sourceCats.includes('perennial');
  const isHerb = category.includes('herb') || sourceCats.includes('herb');
  const isVegetable = category.includes('vegetable') || sourceCats.includes('vegetable');
  const isEdible = isHerb || isVegetable || category.includes('fruit') || sourceCats.includes('edible');

  // Rocks. Only use name/category fields so place names like Rocklin do not match.
  if (includesAny(nameOnly, ['boulder group', 'rock cluster', 'boulder cluster'])) return choose(POOLS.boulderGroup, row, 'boulder-group');
  if (rxAny(nameOnly, [/\bboulder\b/, /\brock garden\b/, /\brock\b/])) return choose(POOLS.boulder, row, 'boulder');

  // Vines and espalier need to happen early so they do not become shrubs or groundcovers.
  if (includesAny(all, ['espalier', 'trained flat', 'trained form'])) return choose(POOLS.espalier, row, 'espalier');
  if (category.includes('vines') || rxAny(all, [/\bvine\b/, /\bvines\b/, /\bvining\b/, /\bclimbing\b/, /\bclimber\b/, /\btrellis\b/, /\bstake vine\b/, /\bjasmine\b/, /\bclematis\b/, /\bwisteria\b/, /\bhardenbergia\b/, /\bpassion flower\b/, /\bpassion vine\b/, /\btrumpet vine\b/, /\bgrape\b/, /\bgrapevine\b/, /\bhoneysuckle\b/, /\blonicera\b/, /\bstar jasmine\b/, /\blilac vine\b/])) return choose(POOLS.vine, row, 'vine');

  // Palms, conifers, and columnar trees.
  if (includesAny(all, ['palm', 'cycas', 'sago'])) return choose(POOLS.treePalm, row, 'palm');
  if (woodyCategory && (includesAny(all, ['conifer', 'cypress', 'cedar', 'spruce', 'juniper', 'arborvitae', 'redwood', 'sequoia', 'cryptomeria', 'thuja']) || rxAny(all, [/\bpine\b/]))) return choose(POOLS.treeConifer, row, 'conifer');
  if (isTree && (includesAny(common, ['columnar', 'fastigiate']) || includesAny(botanical, ['fastigiata', 'fastigiatum']) || (includesAny(form, ['narrow', 'pyramidal']) && ratio !== null && ratio <= 0.55) || (ratio !== null && ratio <= 0.42 && matureHeight && matureHeight >= 8))) return choose(POOLS.treeColumnar, row, 'columnar-tree');

  // Bamboo and cane-like plants.
  if (includesAny(all, ['bamboo', 'phyllostachys', 'bambusa', 'cane plant'])) return choose([42, 48, 83, 86], row, 'bamboo');

  // Grass-like and strappy plants.
  if (includesAny(all, ['muhly', 'fountain grass', 'pennisetum', 'deer grass', 'muhlenbergia', 'stipa', 'nassella']) || (includesAny(all, ['grass']) && includesAny(all, ['arching', 'fountain', 'weeping', 'soft']))) return choose(POOLS.grassArching, row, 'arching-grass');
  if (includesAny(all, ['juncus', 'carex', 'sedge', 'sweet flag', 'acorus', 'fiber optic grass', 'rush']) || includesAny(common, ['chive', 'onion', 'garlic']) || (includesAny(all, ['grass']) && includesAny(all, ['upright', 'vertical', 'clumping']))) return choose(POOLS.grassUpright, row, 'upright-grass');
  if (includesAny(all, ['lomandra', 'dianella', 'flax lily', 'lily of the nile', 'agapanthus', 'phormium', 'new zealand flax', 'iris', 'dietes', 'daylily', 'hemerocallis'])) return choose(POOLS.strappy, row, 'strappy');
  if (includesAny(all, ['yucca', 'cordyline', 'dracaena', 'sword leaf', 'sword-like', 'spiky foliage'])) return choose(POOLS.strappy, row, 'spiky');

  // Succulents and bold foliage.
  if (includesAny(all, ['cactus', 'opuntia', 'prickly pear', 'cereus', 'echinocactus'])) return choose(POOLS.cactus, row, 'cactus');
  if (includesAny(all, ['agave', 'aloe', 'echeveria', 'aeonium', 'sempervivum', 'hens & chicks', 'rosette', 'sedum', 'stonecrop', 'senecio', 'blue chalk', 'crassula', 'kalanchoe', 'succulent', 'graptosedum', 'haworthia', 'panda plant', 'string of pearls', 'elephant bush'])) return choose(POOLS.succulentRosette, row, 'succulent');
  if (includesAny(all, ['fern', 'asparagus fern', 'maidenhair', 'wood fern', 'sword fern'])) return choose(POOLS.fern, row, 'fern');
  if (includesAny(all, ['canna', 'banana', 'elephant ear', 'colocasia', 'alocasia', 'tropical leaf', 'large leaf', 'broadleaf rosette'])) return choose(POOLS.boldFoliage, row, 'broadleaf');
  if (includesAny(all, ['bold foliage', 'tropical hibiscus', 'coleus', 'purple heart', 'caladium']) || includesAny(common, ['tomato', 'pepper', 'eggplant', 'okra'])) return choose(POOLS.boldFoliage, row, 'bold-foliage');

  // Flower forms.
  const flowerSpikeName = [common, botanical, category].join(' ');
  if (includesAny(flowerSpikeName, ['lavandula', ' lavender', 'salvia', ' sage', 'kangaroo paw', 'anigozanthos', 'delphinium', 'foxglove', 'digitalis', 'catmint', 'nepeta', 'penstemon', 'snapdragon', 'stock', 'lupine', 'liatris', 'veronica']) || includesAny(tags, ['flower spike'])) return choose(POOLS.flowerSpike, row, 'flower-spike');
  if (!isShrub && includesAny(all, ['gaura', 'whirling butterflies', 'baby\'s breath', 'gypsophila', 'verbena', 'euphorbia breathless', 'bacopa', 'scaevola', 'bidens'])) return choose(POOLS.flowerAiry, row, 'airy-flower');

  // Edible plants get more variety than one herb/veg icon, but not all herbs are grassy.
  if (isHerb && includesAny(common, ['basil', 'mint', 'oregano', 'parsley', 'cilantro', 'coriander', 'catnip', 'stevia', 'rue'])) return choose(POOLS.herbSmall, row, 'herb');
  if (isVegetable || (isEdible && includesAny(common, ['bean', 'pea', 'cucumber', 'squash', 'pumpkin', 'watermelon', 'melon', 'tomatillo', 'tomato', 'pepper', 'eggplant', 'okra', 'spinach', 'kale', 'collard', 'lettuce', 'chard', 'artichoke']))) {
    if (includesAny(common, ['bean', 'pea', 'cucumber', 'squash', 'pumpkin', 'watermelon', 'melon'])) return choose(POOLS.vine, row, 'edible-vine');
    return choose(POOLS.vegetable, row, 'vegetable');
  }

  // Groundcovers and spreaders. Flowing comes before dense if trailing/vining clues exist.
  if (includesAny(all, ['dichondra', 'moneywort', 'silver falls', 'trailing', 'creeping', 'spilling', 'flowing', 'creeper', 'cascade']) || (isEdible && includesAny(common, ['bean', 'pea', 'cucumber', 'squash', 'pumpkin', 'watermelon', 'melon']))) return choose(POOLS.groundcoverFlowing, row, 'flowing-groundcover');
  if (includesAny(all, ['groundcover', 'ground cover', 'myoporum', 'carpet', 'ajuga', 'dead nettle', 'lamium', 'thyme', 'dense groundcover', 'low mat', 'prostrate']) || category.includes('groundcover')) return choose(POOLS.groundcoverDense, row, 'dense-groundcover');

  // Special shrub structures.
  if (isShrub && (includesAny(all, ['green spire', 'sky box', 'sky pencil', 'purple pillar', 'white pillar', 'north pole', 'screening', 'privacy', 'pillar', 'columnar shrub']) || includesAny(form, ['columnar', 'narrow', 'pyramidal']) || (ratio !== null && ratio <= 0.62 && matureHeight && matureHeight >= 4))) return choose(POOLS.shrubColumnar, row, 'columnar-shrub');
  if (isShrub && (includesAny(all, ['boxwood', 'buxus', 'topiary', 'clipped', 'formal', 'privet']) || (includesAny(all, ['holly', 'ilex']) && includesAny(form, ['compact', 'rounded', 'dense'])))) return choose(POOLS.shrubFormal, row, 'formal-shrub');

  // Shrub forms.
  if (isShrub) {
    if (includesAny(all, ['barberry', 'berberis', 'mahonia', 'thorn', 'spine', 'spiny', 'jagged', 'serrated'])) return choose(POOLS.shrubTextured, row, 'textured-shrub');
    if (includesAny(all, ['spirea', 'compact nandina']) || (includesAny(form, ['compact']) && includesAny(all, ['serrated', 'textured']))) return choose(POOLS.shrubCompact, row, 'compact-shrub');
    if (includesAny(form, ['airy', 'open', 'loose']) || includesAny(all, ['butterfly bush', 'buddleia', 'buddleja', 'broom'])) return choose(POOLS.shrubAiry, row, 'airy-shrub');
    if (includesAny(all, ['nandina', 'smoke tree', 'cotinus', 'abelia']) || includesAny(form, ['branching', 'vase', 'upright spreading', 'weeping'])) return choose(POOLS.shrubAiry, row, 'branching-shrub');
    if (includesAny(form, ['spreading', 'trailing', 'prostrate']) || (ratio !== null && ratio >= 1.8)) return choose(POOLS.shrubSpreading, row, 'spreading-shrub');
    if (category.includes('rose') || includesAny(all, ['rose', 'hydrangea', 'azalea', 'camellia', 'flowering quince', 'hibiscus', 'lilac', 'bottlebrush', 'tecoma', 'loropetalum', 'fringe flower'])) return choose(POOLS.shrubFlowering, row, 'flowering-shrub');
    if (includesAny(all, ['pittosporum', 'westringia', 'myrtle', 'xylosma', 'myrtus', 'coprosma']) || includesAny(form, ['smooth', 'dense', 'evergreen'])) return choose(POOLS.shrubCompact, row, 'smooth-shrub');
    if (includesAny(form, ['rounded', 'mounding', 'compact']) || (ratio !== null && ratio > 0.75 && ratio < 1.35)) return choose(POOLS.shrubCompact, row, 'round-shrub');
    return choose(POOLS.shrubGeneral, row, 'shrub');
  }

  // Tree forms.
  if (isTree) {
    if (includesAny(all, ['maple', 'acer', 'redbud', 'dogwood', 'cherry', 'plum', 'magnolia', 'birch'])) return choose(POOLS.treeDeciduous, row, 'deciduous-tree');
    if (includesAny(all, ['flowering pear', 'flowering cherry', 'crabapple', 'crape myrtle', 'lagerstroemia'])) return choose(POOLS.treeFlowering, row, 'flowering-tree');
    if (includesAny(all, ['olive', 'loquat', 'standard trunk', 'multi-trunk', 'fruit tree', 'apple', 'pear', 'peach', 'nectarine', 'apricot', 'fig', 'persimmon', 'jujube', 'almond'])) return choose(POOLS.treeFruit, row, 'fruit-or-standard-tree');
    if (includesAny(all, ['oak', 'elm', 'plane tree', 'willow', 'camphor', 'pistache', 'ginkgo'])) return choose(POOLS.treeGeneral, row, 'shade-tree');
    return choose(POOLS.treeGeneral, row, 'tree');
  }

  // General flowering annuals/perennials.
  if (row.Flowers === 'TRUE' || row.Flowers === 'true' || includesAny(all, ['flower', 'bloom', 'daisy', 'coreopsis', 'coneflower', 'echinacea', 'geranium', 'begonia', 'petunia', 'zinnia', 'marigold', 'vinca', 'impatiens', 'pansy', 'viola'])) return choose(POOLS.flowerPerennial, row, 'flowering-perennial');
  if (isAnnualOrPerennial) return choose(POOLS.flowerPerennial, row, 'perennial');

  // Safest generic plant fallback.
  return choose(POOLS.shrubGeneral, row, 'fallback');
}

if (!fs.existsSync(catalogPath)) {
  console.error(`Could not find ${catalogPath}`);
  process.exit(1);
}

const csv = fs.readFileSync(catalogPath, 'utf8');
const parsed = parseCsv(csv.replace(/^\uFEFF/, ''));
const headers = [...parsed[0]];
for (const required of ['Plan_Symbol_File', 'Plan_Symbol_Type', 'Plan_Symbol_Color', 'Plan_Symbol_Accent_Color']) {
  if (!headers.includes(required)) headers.push(required);
}
const rows = parsed.slice(1).map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])));
let changed = 0;
let typeChanged = 0;
let colorChanged = 0;
const iconCounts = new Map();
const report = [];
for (const row of rows) {
  const next = iconForRow(row);
  const meta = fileMeta(next);
  iconCounts.set(next, (iconCounts.get(next) || 0) + 1);
  if (row.Plan_Symbol_File !== next) {
    row.Plan_Symbol_File = next;
    changed += 1;
  }
  const nextType = meta.slug;
  if (row.Plan_Symbol_Type !== nextType) {
    row.Plan_Symbol_Type = nextType;
    typeChanged += 1;
  }
  const nextColor = colorForRow(row);
  if (row.Plan_Symbol_Color !== nextColor) {
    row.Plan_Symbol_Color = nextColor;
    colorChanged += 1;
  }
  if (row.Plan_Symbol_Accent_Color) row.Plan_Symbol_Accent_Color = '';
  report.push({
    Common_Name: row.Common_Name || '',
    Botanical_Name: row.Botanical_Name || row.Green_Acres_Botanical_Name || '',
    Category: row.Category || '',
    Plan_Symbol_File: next,
    Plan_Symbol_Type: nextType,
    Icon_Label: meta.label || '',
    Plan_Symbol_Color: row.Plan_Symbol_Color || '',
  });
}

fs.writeFileSync(catalogPath, writeCsv(headers, rows));
fs.writeFileSync(reportPath, writeCsv(['Common_Name', 'Botanical_Name', 'Category', 'Plan_Symbol_File', 'Plan_Symbol_Type', 'Icon_Label', 'Plan_Symbol_Color'], report));
console.log(`Updated ${changed} plan icon files in ${catalogPath}`);
console.log(`Updated ${typeChanged} plan icon type values using the 1-111 icon-pool taxonomy`);
console.log(`Updated ${colorChanged} plan icon colors with deterministic plant/cultivar variation`);
console.log(`Wrote ${reportPath}`);
console.log('Icon counts:');
for (const [icon, count] of [...iconCounts.entries()].sort((a, b) => Number(a[0].split('.')[0]) - Number(b[0].split('.')[0]))) {
  const meta = fileMeta(icon);
  console.log(`  ${icon.padStart(7)}: ${String(count).padStart(4)}  ${meta.label}`);
}
