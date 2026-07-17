import fs from 'node:fs';

const files = [
  'src/components/PlanDetails.tsx',
  'src/RecipeAppIntegration.tsx',
];

const replacementsByFile = {
  'src/components/PlanDetails.tsx': [
    ["{ id: 'quick' as const, label: 'Quick layout' },", "{ id: 'quick' as const, label: 'Basic generation' },"],
    ["{ id: 'recipe' as const, label: 'Recipe layout' },", "{ id: 'recipe' as const, label: 'Advanced generation' },"],
    ['Recipe layout is available only for planting areas. Change the area type in Site first.', 'Advanced generation is available only for planting areas. Change the area type in Site first.'],
    ['Quick layout is available only for planting areas. Change the area type in Site first.', 'Basic generation is available only for planting areas. Change the area type in Site first.'],
    ['>Advanced generation</summary>', '>More options</summary>'],
    ['Generate planting layout', 'Generate plants'],
    ['Generate layout', 'Generate plants'],
  ],
  'src/RecipeAppIntegration.tsx': [
    ['Plant mix only. Quick layout ignores recipe placement rules.', 'Plant mix only. Basic generation ignores advanced placement rules.'],
    ['Using ${selectedRecipe.name} as the plant mix. Quick layout will arrange these plants with its normal rules.', 'Using ${selectedRecipe.name} as the plant mix. Basic generation will arrange these plants with its normal rules.'],
    ["Use a recipe's plants without its placement pattern.", "Use a recipe's plant mix with the simpler generator."],
    ['Recipe layout', 'Advanced generation'],
    ['Build the layout from a recipe pattern, then adjust the details below.', 'Control the plant mix, layers, spacing, grouping, and placement pattern.'],
    ['New seed + generate', 'Generate another version'],
    ['Replace existing plants in this zone', 'Replace existing plants in this area'],
  ],
};

let changedFiles = 0;

for (const file of files) {
  if (!fs.existsSync(file)) throw new Error(`${file} was not found.`);
  const raw = fs.readFileSync(file, 'utf8');
  const newline = raw.includes('\r\n') ? '\r\n' : '\n';
  let text = raw.replace(/\r\n/g, '\n');
  const original = text;

  for (const [before, after] of replacementsByFile[file]) {
    text = text.split(before).join(after);
  }

  if (text !== original) {
    fs.writeFileSync(file, newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
    changedFiles += 1;
    console.log(`Updated ${file}`);
  } else {
    console.log(`No generation-label changes needed in ${file}`);
  }
}

console.log(`Renamed the generator tabs to Basic generation and Advanced generation in ${changedFiles} file(s).`);
console.log('The Basic generation accordion is now called More options.');
