import fs from 'node:fs';

const appFile = 'src/App.tsx';
const canvasFile = 'src/components/GardenCanvas.tsx';
const polishFile = 'src/MobileUiPolish.tsx';
const cssFile = 'src/index.css';

function read(path) {
  const raw = fs.readFileSync(path, 'utf8');
  return { newline: raw.includes('\r\n') ? '\r\n' : '\n', text: raw.replace(/\r\n/g, '\n') };
}

function write(path, text, newline) {
  fs.writeFileSync(path, newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
}

function addAttributeToNearestOpeningTag(text, needlePattern, attribute, maxBack = 5000) {
  const match = text.match(needlePattern);
  if (!match || match.index == null) return null;
  const start = Math.max(0, match.index - maxBack);
  const segment = text.slice(start, match.index);
  const tags = [...segment.matchAll(/<(div|section|article)\b[^>]*>/g)];
  if (!tags.length) return null;
  const tagMatch = tags[tags.length - 1];
  const absolute = start + tagMatch.index;
  const tag = tagMatch[0];
  if (tag.includes(attribute)) return text;
  const updated = tag.replace(/>$/, ` ${attribute}>`);
  return text.slice(0, absolute) + updated + text.slice(absolute + tag.length);
}

function findHandlerBounds(text, markerPattern) {
  const marker = text.match(markerPattern);
  if (!marker || marker.index == null) return null;
  const starts = [...text.slice(0, marker.index).matchAll(/(?:const\s+\w+\s*=\s*(?:useCallback\s*\()?|\w+\s*=\s*)?\([^)]*\)\s*=>\s*\{/g)];
  if (!starts.length) return null;
  const start = starts[starts.length - 1].index + starts[starts.length - 1][0].length - 1;
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return { start, end: i };
    }
  }
  return null;
}

const app = read(appFile);
const canvas = read(canvasFile);
const polish = read(polishFile);
const css = read(cssFile);

let appText = app.text;
let canvasText = canvas.text;
let polishText = polish.text;
let cssText = css.text;

if (!appText.includes('data-mobile-welcome="true"')) {
  const tagged =
    addAttributeToNearestOpeningTag(appText, /Welcome\s+to\s+Plant\s+Pending/i, 'data-mobile-welcome="true"') ||
    addAttributeToNearestOpeningTag(appText, /VERSION\s*2\.0/i, 'data-mobile-welcome="true"') ||
    addAttributeToNearestOpeningTag(appText, /YARD\s*PANIC\s*REDUCER/i, 'data-mobile-welcome="true"');
  if (!tagged) throw new Error('Could not locate the welcome modal container. No files written.');
  appText = tagged;
}

appText = appText
  .replace(/<[^>]*>\s*VERSION\s*2\.0\s*<\/[^>]+>/gi, '')
  .replace(/<[^>]*>\s*YARD\s*PANIC\s*REDUCER\s*<\/[^>]+>/gi, '')
  .replace(/VERSION\s*2\.0/gi, '')
  .replace(/YARD\s*PANIC\s*REDUCER/gi, '')
  .replace(/YARD\s*PANIC/gi, '')
  .replace(/PANIC\s*REDUCER/gi, '');

const closeMarker = '/* close mobile plant library after selection */';
if (!appText.includes(closeMarker)) {
  const bounds = findHandlerBounds(appText, /library\.plantSelected|plantSelected/i);
  if (!bounds) throw new Error('Could not locate the plant selection handler. No files written.');
  const insertion = `\n    ${closeMarker}\n    if (window.matchMedia('(max-width: 767px)').matches) {\n      window.requestAnimationFrame(() => {\n        document.querySelector<HTMLButtonElement>('.mobile-tool-rail button[title="Plant library"], .mobile-tool-rail button[aria-label="Plant library"]')?.click();\n      });\n    }\n  `;
  appText = appText.slice(0, bounds.end) + insertion + appText.slice(bounds.end);
}

if (!canvasText.includes('mobile-canvas-empty-overlay')) {
  const exact = 'absolute inset-0 flex items-center justify-center pointer-events-none';
  if (!canvasText.includes(exact)) throw new Error('Could not find the canvas welcome overlay class. No files written.');
  canvasText = canvasText.replace(exact, `${exact} mobile-canvas-empty-overlay`);
}

if (!fs.existsSync(polishFile)) throw new Error('src/MobileUiPolish.tsx is missing. No files written.');

polishText = polishText.replace(
  /function copyOriginalIcon\([\s\S]*?\n\}/,
  `function copyOriginalIcon(target: HTMLButtonElement | null, source: HTMLButtonElement | null) {\n  if (!target || !source) return;\n  const sourceIcon = source.querySelector('svg') || source.firstElementChild;\n  if (!sourceIcon) return;\n  const targetIcon = target.querySelector('svg') || target.firstElementChild;\n  const clone = sourceIcon.cloneNode(true);\n  if (targetIcon) targetIcon.replaceWith(clone);\n  else target.prepend(clone);\n}`,
);

polishText = polishText.replace(
  /function syncIcons\(\) \{[\s\S]*?\n\}/,
  `function syncIcons() {\n  copyOriginalIcon(findToolbarButton(/yard setup/i), findRightTool(RIGHT_TOOL_MATCHERS.yard));\n  copyOriginalIcon(findToolbarButton(/^areas$/i), findRightTool(RIGHT_TOOL_MATCHERS.areas));\n  copyOriginalIcon(findToolbarButton(/plant list/i), findRightTool(RIGHT_TOOL_MATCHERS.plantList));\n  copyOriginalIcon(findToolbarButton(/debug/i), findRightTool(RIGHT_TOOL_MATCHERS.debug));\n}`,
);

const marker = '/* Direct mobile fixes: welcome, canvas centering, plant cards */';
if (!cssText.includes(marker)) {
  cssText += `\n\n${marker}\n@media (max-width: 767px) {\n  [data-mobile-welcome="true"] {\n    width: calc(100vw - 1rem) !important;\n    max-width: 25rem !important;\n    max-height: calc(100dvh - 1rem) !important;\n    overflow-y: auto !important;\n    padding: 1rem !important;\n  }\n\n  [data-mobile-welcome="true"] > div,\n  [data-mobile-welcome="true"] section {\n    display: flex !important;\n    flex-direction: column !important;\n    align-items: center !important;\n    grid-template-columns: 1fr !important;\n    gap: .75rem !important;\n    width: 100% !important;\n  }\n\n  [data-mobile-welcome="true"] img {\n    width: min(9rem, 38vw) !important;\n    max-height: 6.5rem !important;\n    object-fit: contain !important;\n    margin: 0 auto !important;\n  }\n\n  [data-mobile-welcome="true"] h1,\n  [data-mobile-welcome="true"] h2,\n  [data-mobile-welcome="true"] p {\n    max-width: 22rem !important;\n    margin-left: auto !important;\n    margin-right: auto !important;\n    text-align: center !important;\n  }\n\n  .mobile-canvas-empty-overlay {\n    position: fixed !important;\n    left: 0 !important;\n    right: 0 !important;\n    top: var(--mobile-header-height, 109px) !important;\n    bottom: var(--mobile-tool-rail-height, 68px) !important;\n    width: 100vw !important;\n    height: auto !important;\n    transform: none !important;\n    z-index: 5 !important;\n  }\n\n  .mobile-canvas-empty-overlay > * {\n    width: min(20rem, calc(100vw - 2rem)) !important;\n    max-width: calc(100vw - 2rem) !important;\n    margin: auto !important;\n    white-space: normal !important;\n    text-align: center !important;\n  }\n}\n`;
}

write(appFile, appText, app.newline);
write(canvasFile, canvasText, canvas.newline);
write(polishFile, polishText, polish.newline);
write(cssFile, cssText, css.newline);

console.log('Applied direct source fixes: mobile welcome layout and text, plant-library close after selection, centered canvas welcome, and desktop-matching mobile icons.');
