import fs from 'node:fs';

const path = 'src/App.tsx';
let source = fs.readFileSync(path, 'utf8');

const importAnchor = "import { DEFAULT_FILTERS } from './types/plant';";
const importLine = "import { buildPresetPlantPalette, findBackyardRecipePreset } from './data/backyardRecipePresets';";
if (!source.includes(importLine)) {
  if (!source.includes(importAnchor)) throw new Error('Could not find App.tsx import anchor.');
  source = source.replace(importAnchor, `${importAnchor}\n${importLine}`);
}

const paletteAnchor = "function buildGeneratorPalette(plants: Plant[], zone: GardenZone, layoutMode: ZoneLayoutMode, random: () => number): Plant[] {\n  const sorted = [...plants].sort((a, b) => computeGeneratorScore(b, zone) - computeGeneratorScore(a, zone));";
const paletteReplacement = "function buildGeneratorPalette(plants: Plant[], zone: GardenZone, layoutMode: ZoneLayoutMode, random: () => number): Plant[] {\n  const presetPalette = buildPresetPlantPalette(plants, zone);\n  if (presetPalette.length > 0) return presetPalette.sort(() => random() - 0.5);\n\n  const sorted = [...plants].sort((a, b) => computeGeneratorScore(b, zone) - computeGeneratorScore(a, zone));";
if (!source.includes('const presetPalette = buildPresetPlantPalette(plants, zone);')) {
  if (!source.includes(paletteAnchor)) throw new Error('Could not find generator palette anchor.');
  source = source.replace(paletteAnchor, paletteReplacement);
}

const availableAnchor = "    const availablePlants = groupPlants.length > 0 ? groupPlants : pickAutoPlants(plants, zone);";
const availableReplacement = "    const preset = groupPlants.length === 0 ? findBackyardRecipePreset(zone) : undefined;\n    const presetPlants = preset ? buildPresetPlantPalette(plants, zone) : [];\n    const availablePlants = groupPlants.length > 0\n      ? groupPlants\n      : presetPlants.length > 0\n        ? presetPlants\n        : pickAutoPlants(plants, zone);";
if (!source.includes('const presetPlants = preset ? buildPresetPlantPalette(plants, zone) : [];')) {
  if (!source.includes(availableAnchor)) throw new Error('Could not find available plants anchor.');
  source = source.replace(availableAnchor, availableReplacement);
}

const logAnchor = "      groupName: group?.name || 'Auto-pick from catalog',\n      groupPlantIds: group?.plantIds || [],\n      autoPicked: !group,";
const logReplacement = "      groupName: group?.name || preset?.label || 'Auto-pick from catalog',\n      groupPlantIds: group?.plantIds || [],\n      presetId: preset?.id || null,\n      presetLabel: preset?.label || null,\n      autoPicked: !group && !preset,";
source = source.replaceAll(logAnchor, logReplacement);

fs.writeFileSync(path, source);
console.log('Integrated backyard recipe presets into src/App.tsx');
