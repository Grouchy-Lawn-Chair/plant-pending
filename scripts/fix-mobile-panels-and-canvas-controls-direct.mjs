import fs from 'node:fs';

const cssFile = 'src/index.css';
const canvasFile = 'src/components/GardenCanvas.tsx';

function read(file) {
  const raw = fs.readFileSync(file, 'utf8');
  return { text: raw.replace(/\r\n/g, '\n'), newline: raw.includes('\r\n') ? '\r\n' : '\n' };
}

function write(file, text, newline) {
  fs.writeFileSync(file, newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
}

// Give the real GardenCanvas toolbar one stable class.
const canvasData = read(canvasFile);
let canvas = canvasData.text;
if (!canvas.includes('canvas-control-bar')) {
  const exact = '<div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-[#111827] text-slate-200 flex-wrap">';
  if (!canvas.includes(exact)) {
    throw new Error('Could not find the real GardenCanvas toolbar. No files written.');
  }
  canvas = canvas.replace(
    exact,
    '<div className="canvas-control-bar flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-[#111827] text-slate-200 flex-wrap">',
  );
}

const cssData = read(cssFile);
let css = cssData.text;

// Remove the exact bad rule from lock-mobile-inspector-panels.mjs.
// PlanDetails' final child is the scrollable panel content, so hiding the final
// child made Yard Setup, Areas, Plant List, and Developer Tools appear empty.
css = css.replace(
  /\n?\s*\.mobile-inspector-sheet\[data-mobile-open="true"\] \.inspector-dark > div:last-child \{[\s\S]*?\}\n?/g,
  '\n',
);

const marker = '/* Canonical mobile inspector content and canvas controls */';
if (!css.includes(marker)) {
  css += `\n\n${marker}\n@media (max-width: 1023px) {\n  /* The inspector content is the last child of .inspector-dark. Never hide it. */\n  .mobile-inspector-sheet .inspector-dark > div:last-child,\n  .mobile-inspector-sheet .inspector-dark > div[class*="overflow-y-auto"] {\n    display: block !important;\n    flex: 1 1 auto !important;\n    min-height: 0 !important;\n    width: 100% !important;\n    overflow-y: auto !important;\n    -webkit-overflow-scrolling: touch;\n  }\n\n  /* Expanded inspector sheet stays above the bottom rail and inside the phone. */\n  .mobile-inspector-sheet.w-\\[23rem\\],\n  .mobile-inspector-sheet[data-mobile-open="true"] {\n    display: block !important;\n    position: fixed !important;\n    z-index: 90 !important;\n    left: 0 !important;\n    right: 0 !important;\n    top: auto !important;\n    bottom: calc(4.25rem + env(safe-area-inset-bottom)) !important;\n    width: 100vw !important;\n    max-width: 100vw !important;\n    height: min(68dvh, 42rem) !important;\n    max-height: calc(100dvh - 9.5rem) !important;\n    overflow: hidden !important;\n    transform: none !important;\n    border-radius: 1rem 1rem 0 0 !important;\n  }\n\n  .mobile-inspector-sheet.w-\\[23rem\\] > .inspector-dark,\n  .mobile-inspector-sheet[data-mobile-open="true"] > .inspector-dark {\n    display: flex !important;\n    flex-direction: column !important;\n    width: 100% !important;\n    height: 100% !important;\n    min-height: 0 !important;\n    padding-right: 0 !important;\n  }\n\n  /* Hide only PlanDetails' desktop vertical icon rail inside an expanded sheet. */\n  .mobile-inspector-sheet.w-\\[23rem\\] .inspector-dark > div.absolute.inset-y-0.right-0,\n  .mobile-inspector-sheet[data-mobile-open="true"] .inspector-dark > div.absolute.inset-y-0.right-0 {\n    display: none !important;\n  }\n\n  /* The canvas controls must remain present. They scroll horizontally on phones. */\n  .canvas-control-bar {\n    display: flex !important;\n    visibility: visible !important;\n    position: relative !important;\n    flex: 0 0 auto !important;\n    width: 100% !important;\n    min-height: 3.35rem !important;\n    flex-wrap: nowrap !important;\n    overflow-x: auto !important;\n    overflow-y: hidden !important;\n    padding: .5rem .75rem !important;\n    gap: .5rem !important;\n    scrollbar-width: thin;\n    -webkit-overflow-scrolling: touch;\n  }\n\n  .canvas-control-bar > * {\n    display: flex !important;\n    flex: 0 0 auto !important;\n  }\n\n  /* Remove old pseudo-arrow overlays that covered controls. */\n  .canvas-control-bar::before,\n  .canvas-control-bar::after {\n    content: none !important;\n    display: none !important;\n  }\n}\n`;
}

write(canvasFile, canvas, canvasData.newline);
write(cssFile, css, cssData.newline);

console.log('Fixed the actual mobile inspector content rule.');
console.log('Restored the real GardenCanvas controls on mobile.');
console.log('No click interceptors, observers, or replacement panels were added.');
