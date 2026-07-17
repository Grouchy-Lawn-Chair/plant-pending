import fs from 'node:fs';

const file = 'src/data/helpContent.ts';
const raw = fs.readFileSync(file, 'utf8');
const newline = raw.includes('\r\n') ? '\r\n' : '\n';
let text = raw.replace(/\r\n/g, '\n');

const start = text.indexOf('export const WELCOME_STEPS: Array<[string, string]> = [');
const endMarker = '\n];';
const end = text.indexOf(endMarker, start);

if (start < 0 || end < 0) {
  throw new Error('WELCOME_STEPS block not found. No changes written.');
}

const replacement = `export const WELCOME_STEPS: Array<[string, string]> = [
  ['1. Give it a yard', 'Add a yard image or start blank, then set the scale. Otherwise your three-foot shrub may become a botanical aircraft carrier.'],
  ['2. Draw where plants are allowed to exist', 'Outline beds, slopes, pool planters, hedges, and no-plant areas. Add sun, water, and front or back edges so the app understands which direction is “tall stuff goes over there.”'],
  ['3. Add plants, then make them organize themselves', 'Place plants by hand, build a plant set, or choose a recipe. Use Basic generation for a quick arrangement, or Advanced generation when you need to supervise every shrub like a tiny landscape dictator.'],
  ['4. Tweak it. Save it. Produce evidence.', 'Move plants, adjust maintained widths, try another version, then save, export, or print the plan before the yard changes its mind.'],
];`;

text = `${text.slice(0, start)}${replacement}${text.slice(end + endMarker.length)}`;

const output = newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text;
fs.writeFileSync(file, output);
console.log('Consolidated the welcome screen from seven steps into four logical chunks with shorter, playful copy.');
