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

function addAttributeToNearestOpeningTag(text, needle, attribute, maxBack = 4000) {
  const needleIndex = text.indexOf(needle);
  if (needleIndex < 0) throw new Error(`Could not find ${needle}. No files written.`);
  const start = Math.max(0, needleIndex - maxBack);
  const segment = text.slice(start, needleIndex);
  const matches = [...segment.matchAll(/<(div|section|article)\b[^>]*>/g)];
  if (!matches.length) throw new Error(`Could not find a container before ${needle}. No files written.`);
  const match = matches[matches.length - 1];
  const absolute = start + match.index;
  const tag = match[0];
  if (tag.includes(attribute)) return text;
  const updated = tag.replace(/>$/, ` ${attribute}>`);
  return text.slice(0, absolute) + updated + text.slice(absolute + tag.length);
}

function findHandlerBounds(text, marker) {
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Could not find ${marker}. No files written.`);
  const starts = [...text.slice(0, markerIndex).matchAll(/(?:const\s+\w+\s*=\s*(?:useCallback\s*\()?|\w+\s*=\s*)?\([^)]*\)\s*=>\s*\{/g)];
  if (!starts.length) throw new Error(`Could not find the handler containing ${marker}. No files written.`);
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
  throw new Error(`Could not find the end of the handler containing ${marker}. No files written.`);
}

const app = read(appFile);
let appText = app.text;

appText = appText
  .replace(/VERSION\s*2\.0/gi, '')
  .replace(/YARD\s*PANIC\s*REDUCER/gi, '')
  .replace(/YARD\s*PANIC/gi, '')
  .replace(/PANIC\s*REDUCER/gi, '');

if (!appText.includes('data-mobile-welcome="true"')) {
  appText = addAttributeToNearestOpeningTag(appText, 'Welcome to Plant Pending', 'data-mobile-welcome="true"');
}

const closeMarker = '/* close mobile plant library after selection */';
if (!appText.includes(closeMarker)) {
  const bounds = findHandlerBounds(appText, 'library.plantSelected');
  const insertion = `\n    ${closeMarker}\n    if (window.matchMedia('(max-width: 767px)').matches) {\n      window.requestAnimationFrame(() => {\n        document.querySelector<HTMLButtonElement>('.mobile-tool-rail button[title="Plant library"]')?.click();\n      });\n    }\n  `;
  appText = appText.slice(0, bounds.end) + insertion + appText.slice(bounds.end);
}

write(appFile, appText, app.newline);

const canvas = read(canvasFile);
let canvasText = canvas.text;
if (!canvasText.includes('mobile-canvas-empty-overlay')) {
  const exact = 'absolute inset-0 flex items-center justify-center pointer-events-none';
  if (!canvasText.includes(exact)) throw new Error('Could not find the canvas welcome overlay class. No files written.');
  canvasText = canvasText.replace(exact, `${exact} mobile-canvas-empty-overlay`);
}
write(canvasFile, canvasText, canvas.newline);

if (!fs.existsSync(polishFile)) throw new Error('src/MobileUiPolish.tsx is missing. Run the earlier mobile polish installer first. No files written.');
const polish = read(polishFile);
let polishText = polish.text;

polishText = polishText.replace(
  /function copyOriginalIcon\([\s\S]*?\n\}/,
  `function copyOriginalIcon(target: HTMLButtonElement | null, source: HTMLButtonElement | null) {\n  if (!target || !source) return;\n  const sourceIcon = source.querySelector('svg') || source.firstElementChild;\n  if (!sourceIcon) return;\n  const targetIcon = target.querySelector('svg') || target.firstElementChild;\n  const clone = sourceIcon.cloneNode(true);\n  if (targetIcon) targetIcon.replaceWith(clone);\n  else target.prepend(clone);\n}`,
);

polishText = polishText.replace(
  /function syncIcons\(\) \{[\s\S]*?\n\}/,
  `function syncIcons() {\n  copyOriginalIcon(findToolbarButton(/yard setup/i), findRightTool(RIGHT_TOOL_MATCHERS.yard));\n  copyOriginalIcon(findToolbarButton(/^areas$/i), findRightTool(RIGHT_TOOL_MATCHERS.areas));\n  copyOriginalIcon(findToolbarButton(/plant list/i), findRightTool(RIGHT_TOOL_MATCHERS.plantList));\n  copyOriginalIcon(findToolbarButton(/debug/i), findRightTool(RIGHT_TOOL_MATCHERS.debug));\n}`,
);

write(polishFile, polishText, polish.newline);

const css = read(cssFile);
let cssText = css.text;
const marker = '/* Direct mobile fixes: welcome, canvas centering, plant cards */';
if (!cssText.includes(marker)) {
  cssText += `\n\n${marker}\n@media (max-width: 767px) {\n  [data-mobile-welcome="true"] {\n    width: calc(100vw - 1rem) !important;\n    max-width: 25rem !important;\n    max-height: calc(100dvh - 1rem) !important;\n    overflow-y: auto !important;\n    padding: 1rem !important;\n  }\n\n  [data-mobile-welcome="true"] > div,\n  [data-mobile-welcome="true"] section {\n    display: flex !important;\n    flex-direction: column !important;\n    align-items: center !important;\n    grid-template-columns: 1fr !important;\n    gap: .75rem !important;\n    width: 100% !important;\n  }\n\n  [data-mobile-welcome="true"] img {\n    width: min(9rem, 38vw) !important;\n    max-height: 6.5rem !important;\n    object-fit: contain !important;\n    margin: 0 auto !important;\n  }\n\n  [data-mobile-welcome="true"] h1,\n  [data-mobile-welcome="true"] h2,\n  [data-mobile-welcome="true"] p {\n    max-width: 22rem !important;\n    margin-left: auto !important;\n    margin-right: auto !important;\n    text-align: center !important;\n  }\n\n  .mobile-canvas-empty-overlay {\n    position: fixed !important;\n    left: 0 !important;\n    right: 0 !important;\n    top: var(--mobile-header-height, 109px) !important;\n    bottom: var(--mobile-tool-rail-height, 68px) !important;\n    width: 100vw !important;\n    height: auto !important;\n    transform: none !important;\n    z-index: 5 !important;\n  }\n\n  .mobile-canvas-empty-overlay > * {\n    width: min(20rem, calc(100vw - 2rem)) !important;\n    max-width: calc(100vw - 2rem) !important;\n    margin: auto !important;\n    white-space: normal !important;\n    text-align: center !important;\n  }\n}\n`;
}
write(cssFile, cssText, css.newline);

console.log('Applied direct source fixes: mobile welcome layout and text, plant-library close after selection, centered canvas welcome, and desktop-matching mobile icons.');
