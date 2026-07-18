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

function findButtonByLabel(text, labels) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:title|aria-label)\\s*=\\s*["']${escaped}["']`, 'i');
    const match = regex.exec(text);
    if (!match) continue;
    const open = openingTagBefore(text, match.index, 'button');
    if (!open) continue;
    const closeStart = text.indexOf('</button>', open.end);
    if (closeStart < 0) continue;
    return {
      ...open,
      closeStart,
      closeEnd: closeStart + 9,
      block: text.slice(open.start, closeStart + 9),
    };
  }
  return null;
}

function replaceButtonContents(text, button, contents) {
  return text.slice(0, button.end) + `\n${contents}\n` + text.slice(button.closeStart);
}

const files = walk(SRC);
const sources = files.map(file => ({ file, ...read(file) }));

let mobileSource = sources.find(source => source.text.includes('mobile-tool-rail'));
if (!mobileSource) {
  mobileSource = sources.find(source =>
    ['Plant library', 'Filters', 'Yard setup', 'Areas', 'Debug']
      .filter(label => findButtonByLabel(source.text, [label])).length >= 4,
  );
}
if (!mobileSource) throw new Error('Could not locate the mobile bottom rail source. No files written.');

let mobileText = mobileSource.text;
const iconContents = [
  {
    labels: ['Yard setup'],
    contents: `              <img\n                src={\`${'${import.meta.env.BASE_URL}'}ui-icons/noun-canvas-8382519.svg\`}\n                alt=""\n                aria-hidden="true"\n                className="h-5 w-5 invert opacity-80"\n              />`,
  },
  {
    labels: ['Areas'],
    contents: `              <img\n                src={\`${'${import.meta.env.BASE_URL}'}ui-icons/noun-screenshot-4899159.svg\`}\n                alt=""\n                aria-hidden="true"\n                className="h-5 w-5 invert opacity-80"\n              />`,
  },
  { labels: ['Plant list'], contents: `              <span aria-hidden="true">#</span>` },
  { labels: ['Debug', 'Developer tools'], contents: `              <span aria-hidden="true">⌁</span>` },
];

for (const item of iconContents) {
  const button = findButtonByLabel(mobileText, item.labels);
  if (!button) throw new Error(`Could not locate mobile ${item.labels[0]} button. No files written.`);
  mobileText = replaceButtonContents(mobileText, button, item.contents);
}
write(mobileSource.file, mobileText, mobileSource.newline);

// Remove the old runtime icon swapping. The mobile rail now renders the exact
// same icon assets/text as the desktop inspector on its first render.
const polishFile = path.join(SRC, 'MobileUiPolish.tsx');
if (fs.existsSync(polishFile)) {
  const polishData = read(polishFile);
  write(polishFile, `export default function MobileUiPolish() {\n  return null;\n}\n`, polishData.newline);
}

// Find and mark the real welcome Close button.
let welcomeSource = null;
for (const source of sources) {
  if (!/Welcome[\s\S]{0,700}?Plant[\s\S]{0,300}?Pending/i.test(source.text)) continue;
  if (!/>\s*Close\s*</i.test(source.text)) continue;
  welcomeSource = source;
  break;
}
if (!welcomeSource) throw new Error('Could not locate the welcome component with its Close button. No files written.');

let welcomeText = welcomeSource.text;
const closeMatch = />\s*Close\s*</i.exec(welcomeText);
const closeTag = openingTagBefore(welcomeText, closeMatch.index, 'button');
if (!closeTag) throw new Error('Could not locate the welcome Close button opening tag. No files written.');
const changedClose = addClassToTag(closeTag.tag, 'welcome-close-button');
welcomeText = welcomeText.slice(0, closeTag.start) + changedClose + welcomeText.slice(closeTag.end);
write(welcomeSource.file, welcomeText, welcomeSource.newline);

const cssFile = path.join(SRC, 'index.css');
const cssData = read(cssFile);
let css = cssData.text;
const marker = '/* Exact inspector icons and welcome close spacing */';
if (!css.includes(marker)) {
  css += `\n\n${marker}\n@media (max-width: 767px) {\n  [role="dialog"]:has(.welcome-close-button) {\n    position: relative !important;\n    padding-top: 4.25rem !important;\n  }\n\n  .welcome-close-button {\n    position: absolute !important;\n    top: 1rem !important;\n    right: 1rem !important;\n    left: auto !important;\n    bottom: auto !important;\n    margin: 0 !important;\n    z-index: 5 !important;\n  }\n}\n`;
  write(cssFile, css, cssData.newline);
}

console.log('Applied direct mobile rail and welcome close fix.');
console.log(`Mobile rail: ${mobileSource.file}`);
console.log(`Welcome component: ${welcomeSource.file}`);
console.log('Mobile rail now uses the exact desktop Yard setup, Areas, Plant list, and Developer tools icons on first render.');
