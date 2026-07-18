import fs from 'node:fs';
import path from 'node:path';

const SRC = 'src';

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(tsx|jsx)$/.test(entry.name) ? [full] : [];
  });
}

function read(file) {
  const raw = fs.readFileSync(file, 'utf8');
  return { text: raw.replace(/\r\n/g, '\n'), newline: raw.includes('\r\n') ? '\r\n' : '\n' };
}

function write(file, text, newline) {
  fs.writeFileSync(file, newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
}

function addImport(text, importLine) {
  if (text.includes(importLine)) return text;
  const imports = [...text.matchAll(/^import .*;$/gm)];
  if (!imports.length) return `${importLine}\n${text}`;
  const last = imports[imports.length - 1];
  const at = last.index + last[0].length;
  return `${text.slice(0, at)}\n${importLine}${text.slice(at)}`;
}

function openingTagBefore(text, index, tagName = 'button') {
  const start = text.lastIndexOf(`<${tagName}`, index);
  if (start < 0) return null;
  const end = text.indexOf('>', start);
  if (end < 0 || end > index) return null;
  return { start, end: end + 1, tag: text.slice(start, end + 1) };
}

function addClassToTag(tag, className) {
  if (tag.includes(className)) return tag;
  if (/className="[^"]*"/.test(tag)) {
    return tag.replace(/className="([^"]*)"/, `className="$1 ${className}"`);
  }
  if (/className=\{`[^`]*`\}/.test(tag)) {
    return tag.replace(/className=\{`([^`]*)`\}/, `className={\`$1 ${className}\`}`);
  }
  return tag.replace(/>$/, ` className="${className}">`);
}

function findButtonByLabel(text, patterns) {
  for (const pattern of patterns) {
    const regex = new RegExp(`(?:title|aria-label)\\s*=\\s*["']([^"']*${pattern}[^"']*)["']`, 'i');
    const match = regex.exec(text);
    if (!match) continue;
    const open = openingTagBefore(text, match.index, 'button');
    if (!open) continue;
    const close = text.indexOf('</button>', open.end);
    if (close < 0) continue;
    return { ...open, close: close + 9, block: text.slice(open.start, close + 9) };
  }
  return null;
}

function extractSvg(block) {
  const start = block.indexOf('<svg');
  if (start < 0) return null;
  const end = block.indexOf('</svg>', start);
  if (end < 0) return null;
  return block.slice(start, end + 6);
}

function replaceFirstSvg(block, replacement) {
  const start = block.indexOf('<svg');
  if (start < 0) return null;
  const end = block.indexOf('</svg>', start);
  if (end < 0) return null;
  return block.slice(0, start) + replacement + block.slice(end + 6);
}

const files = walk(SRC);
const sources = files.map(file => ({ file, ...read(file) }));

const maps = [
  { key: 'YardSetupIcon', mobile: ['Yard setup'], desktop: ['Yard setup', 'Canvas setup'] },
  { key: 'AreasIcon', mobile: ['Areas'], desktop: ['Areas', 'Zones'] },
  { key: 'PlantListIcon', mobile: ['Plant list'], desktop: ['Plant list', 'Legend'] },
  { key: 'DeveloperToolsIcon', mobile: ['Debug'], desktop: ['Developer tools', 'Debug'] },
];

let mobileSource = sources.find(source => source.text.includes('mobile-tool-rail'));
if (!mobileSource) {
  mobileSource = sources.find(source => maps.filter(map => findButtonByLabel(source.text, map.mobile)).length >= 3);
}
if (!mobileSource) throw new Error('Could not locate the mobile bottom rail source. No files written.');

const iconSvgs = {};
for (const map of maps) {
  let found = null;
  for (const source of sources) {
    if (source.file === mobileSource.file) continue;
    const button = findButtonByLabel(source.text, map.desktop);
    if (!button) continue;
    const svg = extractSvg(button.block);
    if (svg) {
      found = svg;
      break;
    }
  }
  if (!found) throw new Error(`Could not locate the desktop ${map.key} SVG. No files written.`);
  iconSvgs[map.key] = found;
}

const sharedFile = path.join(SRC, 'components', 'InspectorRailIcons.tsx');
fs.mkdirSync(path.dirname(sharedFile), { recursive: true });
const shared = `import type { SVGProps } from 'react';\n\n${maps.map(map => {
  const svg = iconSvgs[map.key]
    .replace('<svg', '<svg {...props}')
    .replace(/className="[^"]*"/, 'className={props.className ?? "w-5 h-5"}');
  return `export function ${map.key}(props: SVGProps<SVGSVGElement>) {\n  return (\n    ${svg}\n  );\n}`;
}).join('\n\n')}\n`;
write(sharedFile, shared, '\n');

let mobileText = mobileSource.text;
const relativeImport = mobileSource.file.startsWith(path.join(SRC, 'components'))
  ? "import { YardSetupIcon, AreasIcon, PlantListIcon, DeveloperToolsIcon } from './InspectorRailIcons';"
  : "import { YardSetupIcon, AreasIcon, PlantListIcon, DeveloperToolsIcon } from './components/InspectorRailIcons';";
mobileText = addImport(mobileText, relativeImport);

for (const map of maps) {
  const button = findButtonByLabel(mobileText, map.mobile);
  if (!button) throw new Error(`Could not locate mobile ${map.key} button. No files written.`);
  const replacement = `<${map.key} className="w-5 h-5" aria-hidden="true" />`;
  const updatedBlock = replaceFirstSvg(button.block, replacement);
  if (!updatedBlock) throw new Error(`Mobile ${map.key} button has no replaceable SVG. No files written.`);
  mobileText = mobileText.slice(0, button.start) + updatedBlock + mobileText.slice(button.close);
}

write(mobileSource.file, mobileText, mobileSource.newline);

// Remove the old runtime SVG cloning component entirely. It caused the wrong icons
// to appear at first load and correct themselves only after a viewport resize.
const polishFile = path.join(SRC, 'MobileUiPolish.tsx');
if (fs.existsSync(polishFile)) {
  const polishData = read(polishFile);
  const cleaned = `export default function MobileUiPolish() {\n  return null;\n}\n`;
  write(polishFile, cleaned, polishData.newline);
}

// Fix the actual welcome Close button directly.
let welcomeSource = null;
for (const source of sources) {
  if (!/Welcome[\s\S]{0,500}?Plant[\s\S]{0,250}?Pending/i.test(source.text)) continue;
  if (!/>\s*Close\s*</i.test(source.text)) continue;
  welcomeSource = source;
  break;
}
if (!welcomeSource) throw new Error('Could not locate the welcome component with its Close button. No files written.');

let welcomeText = welcomeSource.text;
const closeMatch = />\s*Close\s*</i.exec(welcomeText);
const closeTag = openingTagBefore(welcomeText, closeMatch.index, 'button');
if (!closeTag) throw new Error('Could not locate the welcome Close button opening tag. No files written.');
const newCloseTag = addClassToTag(closeTag.tag, 'welcome-close-button');
welcomeText = welcomeText.slice(0, closeTag.start) + newCloseTag + welcomeText.slice(closeTag.end);

// Mark the closest wrapper containing both the heading and close button.
const headingIndex = welcomeText.search(/Welcome[\s\S]{0,250}?Plant[\s\S]{0,150}?Pending/i);
const wrapperSearchStart = Math.min(headingIndex, closeTag.start);
const wrapperCandidates = [...welcomeText.slice(0, wrapperSearchStart).matchAll(/<(div|section)\b[^>]*>/g)];
if (wrapperCandidates.length) {
  const wrapper = wrapperCandidates[wrapperCandidates.length - 1];
  const absolute = wrapper.index;
  const changed = addClassToTag(wrapper[0], 'welcome-mobile-header-layout');
  welcomeText = welcomeText.slice(0, absolute) + changed + welcomeText.slice(absolute + wrapper[0].length);
}
write(welcomeSource.file, welcomeText, welcomeSource.newline);

const cssFile = path.join(SRC, 'index.css');
const cssData = read(cssFile);
let css = cssData.text;
const marker = '/* Shared inspector icons and welcome close layout */';
if (!css.includes(marker)) {
  css += `\n\n${marker}\n@media (max-width: 767px) {\n  .welcome-mobile-header-layout {\n    position: relative !important;\n    display: grid !important;\n    grid-template-columns: 1fr auto !important;\n    align-items: start !important;\n    column-gap: .75rem !important;\n    row-gap: .75rem !important;\n    padding-top: 0 !important;\n  }\n\n  .welcome-close-button {\n    position: static !important;\n    inset: auto !important;\n    grid-column: 2 !important;\n    grid-row: 1 !important;\n    justify-self: end !important;\n    align-self: start !important;\n    margin: 0 !important;\n    z-index: 2 !important;\n  }\n\n  .welcome-mobile-header-layout > :not(.welcome-close-button) {\n    min-width: 0 !important;\n  }\n}\n`;
  write(cssFile, css, cssData.newline);
}

console.log('Applied permanent source fix.');
console.log(`Mobile rail: ${mobileSource.file}`);
console.log(`Shared icons: ${sharedFile}`);
console.log(`Welcome component: ${welcomeSource.file}`);
console.log('Removed runtime SVG cloning from MobileUiPolish.tsx.');
