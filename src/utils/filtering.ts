// Plant filtering and sorting utilities

import { Plant, FilterState, SortOption } from '../types/plant';

// Filter plants based on the current filter state
export function filterPlants(plants: Plant[], filters: FilterState): Plant[] {
  return plants.filter(plant => {
    // Search filter
    // Normalize spaces/punctuation so "Green Spire", "GreenSpire", and older
    // mashed catalog names like "Euonymusgreenspire" can still match.
    if (filters.search) {
      const normalizeSearch = (value: string | null | undefined) =>
        (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      const searchNorm = normalizeSearch(filters.search);
      const searchableText = [
        plant.commonName,
        plant.botanicalName,
        plant.greenAcresProductName,
        plant.greenAcresBotanicalName,
        plant.greenAcresUrl,
        plant.sourceUrl,
      ].filter(Boolean).join(' ');

      const matchesSearch = normalizeSearch(searchableText).includes(searchNorm);
      if (!matchesSearch) return false;
    }

    // Category filter
    if (filters.category && plant.category !== filters.category) {
      return false;
    }

    // Garden type filters
    if (filters.gardenWelcome && !plant.gardenWelcome) return false;
    if (filters.gardenShade && !plant.gardenShade) return false;
    if (filters.gardenPerennial && !plant.gardenPerennial) return false;
    if (filters.gardenPopularPlant && !plant.gardenPopularPlant) return false;
    if (filters.gardenNativePlant && !plant.gardenNativePlant) return false;
    if (filters.gardenWildlifeHabitat && !plant.gardenWildlifeHabitat) return false;
    if (filters.gardenStreetscape && !plant.gardenStreetscape) return false;

    // California native filter
    if (filters.californiaNativeOnly) {
      const nativeScore = plant.greenAcresResearch?.roles?.nativeGarden?.score || 0;
      if (!plant.californiaNative && !plant.gardenNativePlant && nativeScore < 40) return false;
    }

    // Flowering filter
    if (filters.floweringOnly && !plant.flowers) return false;

    // Good pollinator filter (High or Medium)
    if (filters.goodPollinatorOnly && plant.pollinatorValue !== 'High' && plant.pollinatorValue !== 'Medium') {
      return false;
    }

    // Hide high messiness (rating 8, 9, 10)
    if (filters.hideHighMessiness && plant.messinessRating !== null && plant.messinessRating >= 8) {
      return false;
    }

    // Easy maintenance only (rating 8, 9, 10)
    if (filters.easyMaintenance && (plant.maintenanceEaseRating === null || plant.maintenanceEaseRating < 8)) {
      return false;
    }

    // High waterwise only (rating 8, 9, 10)
    if (filters.highWaterwise && (plant.waterwiseRating === null || plant.waterwiseRating < 8)) {
      return false;
    }


    // Water need filters, based on Green Acres waterwise score groups
    const waterLevel = plant.waterwiseRating === null || plant.waterwiseRating === undefined
      ? 'unknown'
      : plant.waterwiseRating >= 8
        ? 'low'
        : plant.waterwiseRating >= 5
          ? 'medium'
          : 'high';
    if (filters.waterLowOnly && waterLevel !== 'low') return false;
    if (filters.waterMediumOnly && waterLevel !== 'medium') return false;
    if (filters.waterHighOnly && waterLevel !== 'high') return false;

    // Hide large trees (height over 30 feet)
    if (filters.hideLargeTrees && plant.matureHeightFt !== null && plant.matureHeightFt > 30) {
      return false;
    }

    // Low growing only (height under 3 feet)
    if (filters.lowGrowingOnly && plant.matureHeightFt !== null && plant.matureHeightFt >= 3) {
      return false;
    }

    // Under 4 feet tall
    if (filters.under4FeetTall && plant.matureHeightFt !== null && plant.matureHeightFt >= 4) {
      return false;
    }

    // Under 6 feet wide
    if (filters.under6FeetWide && plant.matureWidthFt !== null && plant.matureWidthFt >= 6) {
      return false;
    }

    // Green Acres catalog filters
    if (filters.greenAcresOnly && !plant.greenAcresMatch) return false;
    if (filters.greenAcresMissingOnly && plant.greenAcresMatch) return false;

    return true;
  });
}

// Sort plants based on the sort option
export function sortPlants(plants: Plant[], sortBy: SortOption): Plant[] {
  const sorted = [...plants];

  switch (sortBy) {
    case 'commonName':
      return sorted.sort((a, b) =>
        (a.commonName || a.botanicalName).localeCompare(b.commonName || b.botanicalName)
      );

    case 'commonNameDesc':
      return sorted.sort((a, b) =>
        (b.commonName || b.botanicalName).localeCompare(a.commonName || a.botanicalName)
      );

    case 'botanicalName':
      return sorted.sort((a, b) => a.botanicalName.localeCompare(b.botanicalName));

    case 'botanicalNameDesc':
      return sorted.sort((a, b) => b.botanicalName.localeCompare(a.botanicalName));

    case 'heightLow':
      return sorted.sort((a, b) => {
        const hA = a.matureHeightFt ?? 999;
        const hB = b.matureHeightFt ?? 999;
        return hA - hB;
      });

    case 'heightHigh':
      return sorted.sort((a, b) => {
        const hA = a.matureHeightFt ?? 0;
        const hB = b.matureHeightFt ?? 0;
        return hB - hA;
      });

    case 'widthLow':
      return sorted.sort((a, b) => {
        const wA = a.matureWidthFt ?? 999;
        const wB = b.matureWidthFt ?? 999;
        return wA - wB;
      });

    case 'widthHigh':
      return sorted.sort((a, b) => {
        const wA = a.matureWidthFt ?? 0;
        const wB = b.matureWidthFt ?? 0;
        return wB - wA;
      });

    case 'waterwiseHigh':
      return sorted.sort((a, b) => {
        const wA = a.waterwiseRating ?? 0;
        const wB = b.waterwiseRating ?? 0;
        return wB - wA;
      });

    case 'maintenanceHigh':
      return sorted.sort((a, b) => {
        const mA = a.maintenanceEaseRating ?? 0;
        const mB = b.maintenanceEaseRating ?? 0;
        return mB - mA;
      });

    case 'messinessLow':
      return sorted.sort((a, b) => {
        const mA = a.messinessRating ?? 0;
        const mB = b.messinessRating ?? 0;
        return mA - mB;
      });

    case 'pollinatorHigh':
      const pollinatorOrder = { 'High': 3, 'Medium': 2, 'Low': 1, '': 0 };
      return sorted.sort((a, b) =>
        pollinatorOrder[b.pollinatorValue] - pollinatorOrder[a.pollinatorValue]
      );

    default:
      return sorted;
  }
}

// Get unique categories from plants
export function getCategories(plants: Plant[]): string[] {
  const categories = new Set(plants.map(p => p.category).filter(Boolean));
  return Array.from(categories).sort();
}
