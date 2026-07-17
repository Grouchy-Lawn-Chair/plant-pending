import fs from 'node:fs';

const files = [
  'src/App.tsx',
  'src/RecipeAppIntegration.tsx',
  'src/RecipeGenerationEnhancements.tsx',
  'src/RecipeSelectionPersistence.tsx',
  'src/RecipeUiCorrections.tsx',
  'src/components/GardenCanvas.tsx',
  'src/components/HelpCenter.tsx',
  'src/components/PlanDetails.tsx',
  'src/components/PrintView.tsx',
  'src/components/WelcomeGuide.tsx',
  'src/data/helpContent.ts',
];

const replacements = [
  // Main toolbar and canvas language.
  ['Draw zone', 'Draw area'],
  ['Cancel zone', 'Cancel area'],
  ['Zones on', 'Areas on'],
  ['Zones off', 'Areas off'],
  ['Show or hide zone shapes', 'Show or hide area shapes'],
  ['Rocks and zones will stay.', 'Rocks and areas will stay.'],
  ['keeping rocks, zones, background, and scale', 'keeping rocks, areas, background, and scale'],
  ['Backspace removes the last zone point.', 'Backspace removes the last area point.'],

  // Inspector, modal, buttons, labels, and empty states.
  ['ZONE SETTINGS', 'AREA SETTINGS'],
  ['Zone settings', 'Area settings'],
  ['zone settings', 'area settings'],
  ['Zone Settings', 'Area Settings'],
  ['Style & zone', 'Style & area'],
  ['Assign selected to zone', 'Assign selected to area'],
  ['Assign to zone', 'Assign to area'],
  ['No zone assigned', 'No area assigned'],
  ['Select zone', 'Select area'],
  ['Duplicate zone', 'Duplicate area'],
  ['Delete zone', 'Delete area'],
  ['Show this zone', 'Show this area'],
  ['Hide this zone', 'Hide this area'],
  ['Toggle all zone shapes on the plan', 'Show or hide all area shapes on the plan'],
  ['Draw zones from the canvas toolbar, then manage them here.', 'Draw planting beds, surfaces, and no-plant areas, then manage them here.'],
  ['No zones yet. Use Draw zone on the canvas.', 'No areas yet. Use Draw area on the canvas.'],
  ['Current zone', 'Current area'],
  ['Selected zone', 'Selected area'],
  ['this zone', 'this area'],
  ['This zone', 'This area'],

  // User-facing navigation labels.
  ["label: 'Zones'", "label: 'Areas'"],
  ['>Zones<', '>Areas<'],
  ['>Zone<', '>Area<'],
  ['Planting Groups', 'Plant Sets'],
  ['Planting Group', 'Plant Set'],
  ['planting groups', 'plant sets'],
  ['planting group', 'plant set'],
  ['Reusable plant lists for zones and future auto-planting.', 'Reusable plant lists for planting areas and layout generation.'],
  ['New group name', 'New plant set name'],
  ['Group name', 'Plant set name'],
  ['Plant Legend', 'Plant List'],
  ['Test Log', 'Developer Tools'],
  ['Canvas', 'Yard setup'],
  ['Plan display and drafting controls.', 'Background, scale, display, and drafting controls.'],

  // Help, onboarding, print, and guidance.
  ['Zones, recipes, physics, spacing, saving, printing, and the controls that keep the shrubs employed.', 'Areas, recipes, spacing, saving, printing, and the controls that keep the shrubs employed.'],
  ['Draw planting zones', 'Draw planting areas'],
  ['Describe the zone', 'Describe the area'],
  ['planting zones', 'planting areas'],
  ['planting zone', 'planting area'],
  ['exclusion zones', 'no-plant areas'],
  ['Exclusion zones', 'No-plant areas'],
  ['zone purpose', 'area purpose'],
  ['Zone purpose', 'Area purpose'],
  ['zone boundaries', 'area boundaries'],
  ['zone measurements', 'area measurements'],
  ['zone visibility', 'area visibility'],
  ['zone shapes', 'area shapes'],
  ['zone sheets', 'area sheets'],
  ['Zone sheets', 'Area sheets'],
  ['individual zone sheets', 'individual area sheets'],
  ['Generating a zone', 'Generating an area'],
  ['generated arrangement while keeping the same recipe and settings. Use different seeds to explore genuinely different layouts without rebuilding the zone.', 'generated arrangement while keeping the same recipe and settings. Use different seeds to explore genuinely different layouts without rebuilding the area.'],
  ['Fullness is a target for how much of the zone should be occupied.', 'Fullness is a target for how much of the area should be occupied.'],
  ['Select a zone, choose its', 'Select an area, choose its'],
  ['assigned to that zone', 'assigned to that area'],
  ['the zone ran out of valid non-overlapping space', 'the area ran out of valid non-overlapping space'],
  ['Hide zone shapes', 'Hide area shapes'],
  ['without deleting the zones', 'without deleting the areas'],

  // Recipe and generation messages.
  ['selected planting zone', 'selected planting area'],
  ['The selected planting zone', 'The selected planting area'],
  ['No current zone', 'No current area'],
  ['No zone selected', 'No area selected'],
  ['zone could not be found', 'area could not be found'],
  ['zone was not found', 'area was not found'],
  ['existing plants in this zone', 'existing plants in this area'],
  ['Replace existing plants in this zone', 'Replace existing plants in this area'],
  ['Generate zone', 'Generate area'],
  ['Generate this zone', 'Generate this area'],

  // Default visible names for newly created user areas.
  ['`Zone ${zones.length + 1}`', '`Area ${zones.length + 1}`'],
  ["'Exclusion Zone'", "'No-plant Area'"],
];

let totalChanges = 0;
const changedFiles = [];

for (const path of files) {
  if (!fs.existsSync(path)) continue;
  const original = fs.readFileSync(path, 'utf8');
  const newline = original.includes('\r\n') ? '\r\n' : '\n';
  let source = original.replace(/\r\n/g, '\n');
  let fileChanges = 0;

  for (const [before, after] of replacements) {
    if (!source.includes(before)) continue;
    const count = source.split(before).length - 1;
    source = source.split(before).join(after);
    fileChanges += count;
  }

  if (fileChanges > 0) {
    fs.writeFileSync(path, newline === '\r\n' ? source.replace(/\n/g, '\r\n') : source);
    totalChanges += fileChanges;
    changedFiles.push(`${path} (${fileChanges})`);
  }
}

if (totalChanges === 0) {
  console.log('Area terminology is already consistent across the user interface.');
} else {
  console.log(`Standardized area terminology with ${totalChanges} UI text updates:`);
  changedFiles.forEach(file => console.log(`- ${file}`));
}
