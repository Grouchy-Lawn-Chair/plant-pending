import type { GardenZone, Plant } from '../types/plant';

export type BackyardRecipePreset = {
  id: string;
  label: string;
  zoneNameIncludes: string[];
  preferredPlantTerms: string[][];
};

export const BACKYARD_RECIPE_PRESETS: BackyardRecipePreset[] = [
  {
    id: 'pool-clean-evergreen-screen',
    label: 'Pool, clean evergreen screen',
    zoneNameIncludes: ['pool'],
    preferredPlantTerms: [
      ['lomandra', 'breeze'],
      ['lomandra', 'platinum beauty'],
      ['blue oat grass'],
    ],
  },
  {
    id: 'retaining-wall-foliage',
    label: 'Retaining wall, foliage color without flowers',
    zoneNameIncludes: ['retaining wall'],
    preferredPlantTerms: [
      ['lomandra', 'lime tuff'],
      ['blue oat grass'],
      ['silver carpet'],
      ['carex', 'bronze'],
      ['sedge', 'bronze'],
    ],
  },
  {
    id: 'fire-pit-color-border',
    label: 'Fire pit, compact colorful flower border',
    zoneNameIncludes: ['firepit', 'fire pit'],
    preferredPlantTerms: [
      ['lomandra', 'lime tuff'],
      ['russian sage', 'little spire'],
      ['kangaroo paw'],
      ['yarrow', 'little moonshine'],
      ['society garlic'],
    ],
  },
  {
    id: 'back-fence-narrow-hedge',
    label: 'Back fence, narrow evergreen hedge',
    zoneNameIncludes: ['back fence hedge'],
    preferredPlantTerms: [
      ['euonymus', 'green spire'],
      ['green tower', 'boxwood'],
    ],
  },
  {
    id: 'south-privacy-screen',
    label: 'South privacy screen',
    zoneNameIncludes: ['south facing privacy', 'privacy screen'],
    preferredPlantTerms: [
      ['euonymus', 'green spire'],
      ['lomandra', 'lime tuff'],
      ['cordyline', 'electric pink'],
    ],
  },
  {
    id: 'slope-native-drift',
    label: 'Slope, low-water erosion-control drift',
    zoneNameIncludes: ['slope'],
    preferredPlantTerms: [
      ['buckwheat'],
      ['coyote brush', 'pigeon point'],
      ['myoporum', 'putah creek'],
      ['sage', "bee's bliss"],
      ['california fuchsia'],
    ],
  },
  {
    id: 'vegetable-garden-flowers',
    label: 'Vegetable garden, pollinator flower border',
    zoneNameIncludes: ['flowers around veg', 'vegetable garden flowers'],
    preferredPlantTerms: [
      ['russian sage', 'little spire'],
      ['yarrow', 'little moonshine'],
      ['santa barbara daisy'],
      ['society garlic'],
    ],
  },
  {
    id: 'vegetable-garden-edge',
    label: 'Vegetable garden, compact edge',
    zoneNameIncludes: ['veg garden edge', 'vegetable garden edge'],
    preferredPlantTerms: [
      ['society garlic'],
      ['silver carpet'],
    ],
  },
];

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function findBackyardRecipePreset(zone: GardenZone): BackyardRecipePreset | undefined {
  const zoneText = normalize(`${zone.name || ''} ${zone.notes || ''}`);
  return BACKYARD_RECIPE_PRESETS.find(preset => preset.zoneNameIncludes.some(term => zoneText.includes(normalize(term))));
}

export function buildPresetPlantPalette(plants: Plant[], zone: GardenZone): Plant[] {
  const preset = findBackyardRecipePreset(zone);
  if (!preset) return [];

  const usedIds = new Set<number>();
  const matches: Plant[] = [];

  preset.preferredPlantTerms.forEach(termSet => {
    const terms = termSet.map(normalize);
    const match = plants.find(plant => {
      if (usedIds.has(plant.id)) return false;
      const text = normalize(`${plant.category || ''} ${plant.commonName || ''} ${plant.botanicalName || ''} ${plant.greenAcresProductName || ''}`);
      return terms.every(term => text.includes(term));
    });
    if (match) {
      usedIds.add(match.id);
      matches.push(match);
    }
  });

  return matches;
}
