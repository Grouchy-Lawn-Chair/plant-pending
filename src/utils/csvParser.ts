// CSV Parser utility to load and parse plants.csv

import { Plant, GARDEN_NUMBER_MAP } from '../types/plant';

const publicAssetUrl = (path: string) => {
  if (!path) return import.meta.env.BASE_URL;
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  const base = import.meta.env.BASE_URL;
  const baseNoSlash = base.replace(/\/$/, '');
  let cleanPath = path.trim();

  if (cleanPath.startsWith(base)) {
    cleanPath = cleanPath.slice(base.length);
  } else if (baseNoSlash && cleanPath.startsWith(`${baseNoSlash}/`)) {
    cleanPath = cleanPath.slice(baseNoSlash.length + 1);
  }

  return `${base}${cleanPath.replace(/^\/+/, '')}`;
};

const GREEN_ACRES_ONLY_CATALOG = true;

type GreenAcresDesignScoreRecord = {
  plantId: number;
  flags?: string[];
  bestUses?: string[];
  scores?: {
    poolSafeScore?: number;
    messinessScore?: number;
    evergreenScore?: number;
    waterwiseScore?: number;
    slopeScore?: number;
    privacyScore?: number;
    colorInterestScore?: number;
    petSafeScore?: number;
    layoutReliabilityScore?: number;
  };
};

type GreenAcresResearchClassificationRecord = {
  plantId: number;
  roles?: Record<string, {
    score?: number;
    level?: string;
    confidence?: string;
    reasons?: string[];
  }>;
  behaviors?: Record<string, string>;
  sourceTags?: string[];
  sourceMatches?: {
    welGardenNumbers?: number[];
    welGardenNames?: string[];
    arboretumAllStarTerms?: string[];
  };
  notes?: string[];
};

// Parse full CSV text, including quoted commas and quoted line breaks.
// Some image credits/source fields can contain commas or newlines, so splitting
// the file by "\n" first will corrupt rows.
function parseCSVRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(current.trim());
      current = '';
      if (row.some(value => value.trim() !== '')) rows.push(row);
      row = [];
    } else {
      current += char;
    }
  }

  row.push(current.trim());
  if (row.some(value => value.trim() !== '')) rows.push(row);
  return rows;
}

// Parse a boolean value from CSV
function parseBoolean(value: string): boolean {
  const lower = value.toLowerCase();
  return lower === 'true' || lower === 'yes' || lower === '1' || lower === 'x';
}

// Parse a number from CSV, return null if empty or invalid
function parseNumber(value: string): number | null {
  if (!value || value.trim() === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

// Parse a string value, return null if empty
function parseStringOrNull(value: string): string | null {
  if (!value || value.trim() === '') return null;
  return value.trim();
}

function decodeHtmlEntities(value: string): string {
  if (!value) return value;
  return value
    .replace(/&#8482;/g, '™')
    .replace(/&#174;/g, '®')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeGreenAcresPriceText(value: string): string | null {
  const raw = parseStringOrNull(value);
  if (!raw) return null;
  const decoded = decodeHtmlEntities(raw);

  // Some Green Acres prices were stored as Shopify cents and then displayed as dollars,
  // like $950.00 instead of $9.50. Only correct integer-dollar values that look like
  // cents-based prices so normal prices such as $12.99 stay untouched.
  return decoded.replace(/\$(\d{3,5})\.00\b/g, (_match, digits) => {
    const cents = Number.parseInt(digits, 10);
    if (!Number.isFinite(cents) || cents < 500) return `$${digits}.00`;
    return `$${(cents / 100).toFixed(2)}`;
  });
}

// Parse garden numbers from Source_Garden_Numbers column
// Handles formats like: 7, "3,5,7", 3/5/7, 3;5;7
function parseGardenNumbers(value: string): number[] {
  if (!value || value.trim() === '') return [];

  const cleaned = value.replace(/['"]/g, '');
  const separators = [',', '/', ';'];
  let parts = [cleaned];

  for (const sep of separators) {
    parts = parts.flatMap(p => p.split(sep));
  }

  return parts
    .map(p => parseInt(p.trim(), 10))
    .filter(n => !isNaN(n) && n >= 1 && n <= 7);
}

// Create garden names array from garden numbers
function getGardenNames(gardenNumbers: number[]): string[] {
  return gardenNumbers.map(n => GARDEN_NUMBER_MAP[n.toString()]).filter(Boolean);
}

// Create plant abbreviation from common name or botanical name
function createAbbreviation(commonName: string, botanicalName: string): string {
  const name = commonName || botanicalName || '';
  if (!name) return '??';

  const words = name.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return '??';

  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }

  return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// Normalize pollinator value
function normalizePollinatorValue(value: string): 'High' | 'Medium' | 'Low' | '' {
  const lower = value.toLowerCase();
  if (lower === 'high') return 'High';
  if (lower === 'medium') return 'Medium';
  if (lower === 'low') return 'Low';
  return '';
}

// Check if garden number includes a specific number
function gardenNumberIncludes(gardenNumbers: number[], num: number): boolean {
  return gardenNumbers.includes(num);
}

// Parse the full CSV and return normalized Plant objects
export async function loadPlantsFromCSV(onProgress?: (progress: number, stage: string) => void): Promise<{ plants: Plant[]; error: string | null }> {
  try {
    // Load the local Green Acres catalog first, then fall back to older CSVs.
    onProgress?.(25, 'Opening plant catalog...');
    let response = await fetch(publicAssetUrl('green_acres_catalog.csv'), { cache: 'no-store' });
    if (!response.ok) {
      response = await fetch(publicAssetUrl('plants_with_green_acres.csv'), { cache: 'no-store' });
    }
    if (!response.ok) {
      response = await fetch(publicAssetUrl('plants_with_images.csv'), { cache: 'no-store' });
    }
    if (!response.ok) {
      response = await fetch(publicAssetUrl('plants.csv'), { cache: 'no-store' });
    }
    if (!response.ok) {
      return { plants: [], error: 'Could not load green_acres_catalog.csv, plants_with_green_acres.csv, plants_with_images.csv, or plants.csv. Make sure at least one file exists in the public folder.' };
    }

    onProgress?.(45, 'Reading catalog file...');
    const text = await response.text();
    onProgress?.(60, 'Parsing plant rows...');
    const rows = parseCSVRows(text);

    if (rows.length === 0) {
      return { plants: [], error: 'The plant CSV file is empty.' };
    }

    // Parse header
    const headers = rows[0];
    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      headerMap[h.toLowerCase()] = i;
    });

    // Required columns
    const requiredColumns = ['plant_id', 'category', 'botanical_name'];
    for (const col of requiredColumns) {
      if (!(col in headerMap)) {
        return { plants: [], error: `Missing required column: ${col}` };
      }
    }

    const designScoresByPlantId = new Map<number, GreenAcresDesignScoreRecord>();
    try {
      const scoreResponse = await fetch(publicAssetUrl('green_acres_design_scores.json'), { cache: 'no-store' });
      if (scoreResponse.ok) {
        const scoreRows = await scoreResponse.json() as GreenAcresDesignScoreRecord[];
        scoreRows.forEach(row => {
          if (typeof row.plantId === 'number') designScoresByPlantId.set(row.plantId, row);
        });
      }
    } catch {
      // Design scores are an optional enrichment file. The app can still run from the CSV alone.
    }

    const researchByPlantId = new Map<number, GreenAcresResearchClassificationRecord>();
    try {
      const researchResponse = await fetch(publicAssetUrl('green_acres_research_classification.json'), { cache: 'no-store' });
      if (researchResponse.ok) {
        const researchPayload = await researchResponse.json() as { records?: GreenAcresResearchClassificationRecord[] } | GreenAcresResearchClassificationRecord[];
        const researchRows = Array.isArray(researchPayload) ? researchPayload : (researchPayload.records || []);
        researchRows.forEach(row => {
          if (typeof row.plantId === 'number') researchByPlantId.set(row.plantId, row);
        });
      }
    } catch {
      // Research classification is optional. The app can still run from design scores alone.
    }

    const plants: Plant[] = [];

    onProgress?.(72, 'Building plant database...');

    // Parse each data row
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      if (values.length < headers.length) continue;

      const getValue = (col: string): string => {
        const idx = headerMap[col.toLowerCase()];
        return idx !== undefined ? values[idx] || '' : '';
      };

      const gardenNumbers = parseGardenNumbers(getValue('Source_Garden_Numbers'));
      const gardenNames = getGardenNames(gardenNumbers);

      const gardenWelcome = parseBoolean(getValue('Garden_Welcome')) || gardenNumberIncludes(gardenNumbers, 1);
      const gardenShade = parseBoolean(getValue('Garden_Shade')) || gardenNumberIncludes(gardenNumbers, 2);
      const gardenPerennial = parseBoolean(getValue('Garden_Perennial')) || gardenNumberIncludes(gardenNumbers, 3);
      const gardenPopularPlant = parseBoolean(getValue('Garden_Popular_Plant')) || gardenNumberIncludes(gardenNumbers, 4);
      const gardenNativePlant = parseBoolean(getValue('Garden_Native_Plant')) || gardenNumberIncludes(gardenNumbers, 5);
      const gardenWildlifeHabitat = parseBoolean(getValue('Garden_Wildlife_Habitat')) || gardenNumberIncludes(gardenNumbers, 6);
      const gardenStreetscape = parseBoolean(getValue('Garden_Streetscape')) || gardenNumberIncludes(gardenNumbers, 7);

      const commonName = decodeHtmlEntities(getValue('Common_Name'));
      const botanicalName = decodeHtmlEntities(getValue('Botanical_Name'));
      const flowers = parseBoolean(getValue('Flowers'));

      // Parse plan symbol fields (optional columns)
      const planSymbolFile = parseStringOrNull(getValue('Plan_Symbol_File'));
      const planSymbolType = parseStringOrNull(getValue('Plan_Symbol_Type'));
      const planSymbolColor = parseStringOrNull(getValue('Plan_Symbol_Color'));
      const planSymbolAccentColor = parseStringOrNull(getValue('Plan_Symbol_Accent_Color'));

      // Parse image fields (optional columns)
      const thumbnailLocalPath = parseStringOrNull(getValue('Thumbnail_Local_Path'));
      const thumbnailUrl = parseStringOrNull(getValue('Thumbnail_URL'));
      const thumbnailSource = parseStringOrNull(getValue('Thumbnail_Source'));
      const thumbnailLicense = parseStringOrNull(getValue('Thumbnail_License'));
      const thumbnailCredit = parseStringOrNull(getValue('Thumbnail_Credit'));
      const thumbnailPageUrl = parseStringOrNull(getValue('Thumbnail_Page_URL'));
      const imageMatchConfidence = parseStringOrNull(getValue('Image_Match_Confidence'));

      const parsedId = parseInt(getValue('Plant_ID'), 10);
      if (isNaN(parsedId)) continue;

      const greenAcresMatchRaw = getValue('Green_Acres_Match');
      const designScoreRecord = designScoresByPlantId.get(parsedId);
      const researchRecord = researchByPlantId.get(parsedId);
      const plant: Plant = {
        id: parsedId,
        category: getValue('Category'),
        botanicalName,
        commonName,
        abbreviation: createAbbreviation(commonName, botanicalName),
        sourceGardenNumbers: getValue('Source_Garden_Numbers'),
        gardenNames,
        gardenWelcome,
        gardenShade,
        gardenPerennial,
        gardenPopularPlant,
        gardenNativePlant,
        gardenWildlifeHabitat,
        gardenStreetscape,
        californiaNative: parseBoolean(getValue('PDF_Source_Native_Inferred')),
        flowers,
        pollinatorValue: normalizePollinatorValue(getValue('Pollinator_Value')),
        matureHeightFt: parseNumber(getValue('Mature_Height_ft_est')),
        matureWidthFt: parseNumber(getValue('Mature_Width_ft_est')),
        fullMatureSize: decodeHtmlEntities(getValue('Full_Mature_Size_est')),
        minimumSpacingFt: parseNumber(getValue('Minimum_Spacing_ft_est')),
        messinessRating: parseNumber(getValue('Messiness_1_clean_10_messy')),
        maintenanceEaseRating: parseNumber(getValue('Maintenance_Ease_1_hard_10_easy')),
        waterwiseRating: parseNumber(getValue('Waterwise_1_low_10_high')),
        placementNotes: decodeHtmlEntities(getValue('App_Placement_Notes')),
        estimateConfidence: getValue('Estimate_Confidence'),
        sourceUrl: getValue('Source_URL'),
        // Plan symbol fields
        planSymbolFile,
        planSymbolType,
        planSymbolColor,
        planSymbolAccentColor,
        // Image fields
        thumbnailUrl,
        thumbnailLocalPath,
        thumbnailSource,
        thumbnailLicense,
        thumbnailCredit,
        thumbnailPageUrl,
        imageMatchConfidence,
        greenAcresMatch: parseBoolean(greenAcresMatchRaw),
        greenAcresProductName: parseStringOrNull(decodeHtmlEntities(getValue('Green_Acres_Product_Name'))),
        greenAcresBotanicalName: parseStringOrNull(decodeHtmlEntities(getValue('Green_Acres_Botanical_Name'))),
        greenAcresUrl: parseStringOrNull(getValue('Green_Acres_URL')),
        greenAcresPriceText: normalizeGreenAcresPriceText(getValue('Green_Acres_Price_Text')),
        greenAcresImageUrl: parseStringOrNull(getValue('Green_Acres_Image_URL')),
        greenAcresMatchConfidence: parseStringOrNull(getValue('Green_Acres_Match_Confidence')),
        greenAcresLastChecked: parseStringOrNull(getValue('Green_Acres_Last_Checked')),
        greenAcresNotes: parseStringOrNull(decodeHtmlEntities(getValue('Green_Acres_Notes'))),
        greenAcresDesignScores: designScoreRecord?.scores,
        greenAcresBestUses: designScoreRecord?.bestUses || [],
        greenAcresScoreFlags: designScoreRecord?.flags || [],
        greenAcresResearch: researchRecord ? {
          roles: researchRecord.roles,
          behaviors: researchRecord.behaviors,
          sourceTags: researchRecord.sourceTags || [],
          sourceMatches: researchRecord.sourceMatches,
          notes: researchRecord.notes || [],
        } : undefined,
      };

      if (GREEN_ACRES_ONLY_CATALOG && !plant.greenAcresMatch) continue;

      plants.push(plant);
    }

    onProgress?.(88, `Loaded ${plants.length} plants...`);
    return { plants, error: null };
  } catch (err) {
    return { plants: [], error: `Error loading plants: ${err instanceof Error ? err.message : 'Unknown error'}` };
  }
}
