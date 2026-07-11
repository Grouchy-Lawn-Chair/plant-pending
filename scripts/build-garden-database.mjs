#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const localSources = args.has('--local-sources') || args.has('--rebuild-source-subset');
const debug = args.has('--debug');

const steps = [
  {
    name: 'Normalize Green Acres catalog',
    command: ['node', 'scripts/normalize-green-acres-source.mjs'],
  },
  ...(localSources
    ? [
        {
          name: 'Rebuild Green Acres-only source subset from local raw source databases',
          command: ['node', 'scripts/build-green-acres-source-subset.mjs'],
        },
      ]
    : []),
  {
    name: 'Apply source-backed enrichment',
    command: ['node', 'scripts/source-backed-green-acres-enrichment.mjs'],
  },
  {
    name: 'Score Green Acres plants for design use',
    command: ['node', 'scripts/score-green-acres-design.mjs'],
  },
  {
    name: 'Classify plants by research roles and behaviors',
    command: ['node', 'scripts/classify-green-acres-research.mjs'],
  },
  {
    name: 'Build pro planting-area directives',
    command: ['node', 'scripts/build-pro-planting-directives.mjs'],
  },
];

console.log('\nGarden Planner database build');
console.log(localSources ? 'Mode: local raw sources + compact app database' : 'Mode: compact app database only');
console.log('');

for (const [index, step] of steps.entries()) {
  console.log(`\n[${index + 1}/${steps.length}] ${step.name}`);
  console.log(`> ${step.command.join(' ')}`);
  const result = spawnSync(step.command[0], step.command.slice(1), {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });

  if (result.status !== 0) {
    console.error(`\nDatabase build failed during: ${step.name}`);
    process.exit(result.status ?? 1);
  }
}

const expectedOutputs = [
  'public/green_acres_normalized.json',
  'public/green_acres_design_scores.json',
  'public/green_acres_research_classification.json',
  'public/pro_planting_area_directives.json',
  'public/planting_plan_recipes.json',
];

const missing = expectedOutputs.filter((file) => !existsSync(path.join(process.cwd(), file)));
if (missing.length) {
  console.warn('\nDatabase build completed, but these expected output files were not found:');
  for (const file of missing) console.warn(`- ${file}`);
} else {
  console.log('\nDatabase build complete.');
  console.log('Main app data files are ready.');
}

if (debug) {
  console.log('\nDebug output files to inspect/upload if needed:');
  console.log('- public/green_acres_source_backed_summary.json');
  console.log('- public/green_acres_research_classification_summary.json');
  console.log('- public/green_acres_design_score_summary.json');
  console.log('- public/green_acres_source_backed_still_missing_report.csv');
}
