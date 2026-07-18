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

function addClassToOpeningTag(tag, className) {
  if (tag.includes(className)) return tag;
  if (/className\s*=\s*["']/.test(tag)) {
    return tag.replace(/className\s*=\s*(["'])/, `className=$1${className} `);
  }
  return tag.replace(/>$/, ` className="${className}">`);
}

function tagWelcomeContainer(text) {
  if (text.includes('mobile-welcome-modal')) return text;

  const markers = [
    /showWelcome/gi,
    /welcomeOpen/gi,
    /isWelcomeOpen/gi,
    /Welcome\s+to\s+Plant\s+Pending/gi,
    /YARD\s*PANIC\s*REDUCER/gi,
    /VERSION\s*2\.0/gi,
  ];

  for (const pattern of markers) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches.reverse()) {
      const index = match.index ?? -1;
      if (index < 0) continue;
      const from = Math.max(0, index - 2500);
      const to = Math.min(text.length, index + 5000);
      const segment = text.slice(from, to);
      const tags = [...segment.matchAll(/<div\b[^>]*>/g)];
      const modal = tags.find(item => /fixed|absolute|inset-0|z-\d+|rounded-3xl|max-h|max-w/.test(item[0]));
      if (!modal || modal.index == null) continue;
      const absolute = from + modal.index;
      const updated = addClassToOpeningTag(modal[0], 'mobile-welcome-modal');
      return text.slice(0, absolute) + updated + text.slice(absolute + modal[0].length);
    }
  }

  return text;
}

function insertPlantLibraryClose(text) {
  const marker = '/* close mobile plant library after selection */';
  if (text.includes(marker)) return text;

  const eventIndex = text.search(/library\.plantSelected|plantSelected/i);
  if (eventIndex < 0) return text;

  const after = text.indexOf(';', eventIndex);
  if (after < 0) return text;

  const insertion = `\n    ${marker}\n    if (window.matchMedia('(max-width: 767px)').matches) {\n      window.requestAnimationFrame(() => {\n        document.querySelector<HTMLButtonElement>('.mobile-tool-rail button[title="Plant library"], .mobile-tool-rail button[aria-label="Plant library"]')?.click();\n      });\n    }`;

  return text.slice(0, after + 1) + insertion + text.slice(after + 1);
}

const app = read(appFile);
const canvas = read(canvasFile);
const css = read(cssFile);

let appText = app.text;
let canvasText = canvas.text;
let cssText = css.text;

appText = appText
  .replace(/<[^>]*>\s*VERSION\s*2\.0\s*<\/[^>]+>/gi, '')
  .replace(/<[^>]*>\s*YARD\s*PANIC\s*REDUCER\s*<\/[^>]+>/gi, '')
  .replace(/VERSION\s*2\.0/gi, '')
  .replace(/YARD\s*PANIC\s*REDUCER/gi, '')
  .replace(/YARD\s*PANIC/gi, '')
  .replace(/PANIC\s*REDUCER/gi, '');

appText = tagWelcomeContainer(appText);
appText = insertPlantLibraryClose(appText);

if (!canvasText.includes('mobile-canvas-empty-overlay')) {
  const exact = 'absolute inset-0 flex items-center justify-center pointer-events-none';
  if (canvasText.includes(exact)) {
    canvasText = canvasText.replace(exact, `${exact} mobile-canvas-empty-overlay`);
  }
}

if (fs.existsSync(polishFile)) {
  const polish = read(polishFile);
  let polishText = polish.text;

  if (/function copyOriginalIcon\(/.test(polishText)) {
    polishText = polishText.replace(
      /function copyOriginalIcon\([\s\S]*?\n\}/,
      `function copyOriginalIcon(target: HTMLButtonElement | null, source: HTMLButtonElement | null) {\n  if (!target || !source) return;\n  const sourceIcon = source.querySelector('svg') || source.firstElementChild;\n  if (!sourceIcon) return;\n  const targetIcon = target.querySelector('svg') || target.firstElementChild;\n  const clone = sourceIcon.cloneNode(true);\n  if (targetIcon) targetIcon.replaceWith(clone);\n  else target.prepend(clone);\n}`,
    );
  }

  if (/function syncIcons\(\)/.test(polishText)) {
    polishText = polishText.replace(
      /function syncIcons\(\) \{[\s\S]*?\n\}/,
      `function syncIcons() {\n  copyOriginalIcon(findToolbarButton(/yard setup/i), findRightTool(RIGHT_TOOL_MATCHERS.yard));\n  copyOriginalIcon(findToolbarButton(/^areas$/i), findRightTool(RIGHT_TOOL_MATCHERS.areas));\n  copyOriginalIcon(findToolbarButton(/plant list/i), findRightTool(RIGHT_TOOL_MATCHERS.plantList));\n  copyOriginalIcon(findToolbarButton(/debug/i), findRightTool(RIGHT_TOOL_MATCHERS.debug));\n}`,
    );
  }

  write(polishFile, polishText, polish.newline);
}

const marker = '/* Direct mobile fixes: welcome, canvas centering, plant cards */';
if (!cssText.includes(marker)) {
  cssText += `\n\n${marker}\n@media (max-width: 767px) {\n  .mobile-welcome-modal {\n    width: calc(100vw - 1rem) !important;\n    max-width: 25rem !important;\n    max-height: calc(100dvh - 1rem) !important;\n    overflow-y: auto !important;\n    padding: 1rem !important;\n  }\n\n  .mobile-welcome-modal > div,\n  .mobile-welcome-modal section {\n    display: flex !important;\n    flex-direction: column !important;\n    align-items: center !important;\n    grid-template-columns: 1fr !important;\n    gap: .75rem !important;\n    width: 100% !important;\n  }\n\n  .mobile-welcome-modal img {\n    width: min(9rem, 38vw) !important;\n    max-height: 6.5rem !important;\n    object-fit: contain !important;\n    margin: 0 auto !important;\n  }\n\n  .mobile-welcome-modal h1,\n  .mobile-welcome-modal h2,\n  .mobile-welcome-modal p {\n    max-width: 22rem !important;\n    margin-left: auto !important;\n    margin-right: auto !important;\n    text-align: center !important;\n  }\n\n  .mobile-canvas-empty-overlay {\n    position: fixed !important;\n    left: 0 !important;\n    right: 0 !important;\n    top: var(--mobile-header-height, 109px) !important;\n    bottom: var(--mobile-tool-rail-height, 68px) !important;\n    width: 100vw !important;\n    height: auto !important;\n    transform: none !important;\n    z-index: 5 !important;\n  }\n\n  .mobile-canvas-empty-overlay > * {\n    width: min(20rem, calc(100vw - 2rem)) !important;\n    max-width: calc(100vw - 2rem) !important;\n    margin: auto !important;\n    white-space: normal !important;\n    text-align: center !important;\n  }\n}\n`;
}

write(appFile, appText, app.newline);
write(canvasFile, canvasText, canvas.newline);
write(cssFile, cssText, css.newline);

console.log('Applied direct mobile fixes without requiring fragile exact-text anchors.');
