import fs from 'node:fs';

const files = {
  app: 'src/App.tsx',
  canvas: 'src/components/GardenCanvas.tsx',
  css: 'src/index.css',
  main: 'src/main.tsx',
};

function read(path) {
  const raw = fs.readFileSync(path, 'utf8');
  return { newline: raw.includes('\r\n') ? '\r\n' : '\n', text: raw.replace(/\r\n/g, '\n') };
}
function write(path, text, newline) {
  fs.writeFileSync(path, newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
}
function requireReplace(text, before, after, label) {
  if (text.includes(after)) return text;
  if (!text.includes(before)) throw new Error(`${label} anchor not found`);
  return text.replace(before, after);
}

const app = read(files.app);
let appText = app.text;

// Remove the clear-selection X from every viewport.
appText = appText.replace(/\n\s*<button\n\s*type="button"\n\s*title="Clear selection"[\s\S]*?<\/button>/, '');

// Add Yard, Areas and Debug directly to the same primary rail as Plants.
const filtersButtonEnd = `            </button>\n            <button\n              type="button"\n              title="Rock tool"`;
const primaryButtons = `            </button>\n            <button\n              type="button"\n              title="Yard setup"\n              onClick={() => setRightInspectorSection(section => section === 'canvas' ? null : 'canvas')}\n              className={\`mobile-primary-yard flex h-11 w-11 items-center justify-center rounded-xl border text-lg \${rightInspectorSection === 'canvas' ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'}\`}\n            >\n              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">\n                <path d="M4 19V8l8-4 8 4v11" />\n                <path d="M8 19v-6h8v6" />\n              </svg>\n            </button>\n            <button\n              type="button"\n              title="Areas"\n              onClick={() => setRightInspectorSection(section => section === 'zones' ? null : 'zones')}\n              className={\`mobile-primary-areas flex h-11 w-11 items-center justify-center rounded-xl border text-lg \${rightInspectorSection === 'zones' ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'}\`}\n            >\n              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">\n                <path d="m4 7 5-3 5 3 6-3v13l-6 3-5-3-5 3V7Z" />\n                <path d="M9 4v13M14 7v13" />\n              </svg>\n            </button>\n            <button\n              type="button"\n              title="Debug"\n              onClick={() => setRightInspectorSection(section => section === 'debug' ? null : 'debug')}\n              className={\`mobile-primary-debug flex h-11 w-11 items-center justify-center rounded-xl border text-lg \${rightInspectorSection === 'debug' ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'}\`}\n            >\n              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">\n                <path d="M9 9h6v6H9z" />\n                <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />\n              </svg>\n            </button>\n            <button\n              type="button"\n              title="Rock tool"`;
appText = requireReplace(appText, filtersButtonEnd, primaryButtons, 'primary mobile toolbar buttons');

// Closing Welcome should always reveal the canvas on mobile and desktop.
appText = requireReplace(
  appText,
  `        onClose={() => setShowWelcomeGuide(false)}`,
  `        onClose={() => {\n          setShowWelcomeGuide(false);\n          setLeftPanelMode('closed');\n          setRightInspectorSection(null);\n          setShowFileMenu(false);\n        }}`,
  'welcome close behavior',
);

const canvas = read(files.canvas);
let canvasText = canvas.text;
canvasText = requireReplace(
  canvasText,
  `<div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-[#111827] text-slate-200 flex-wrap">`,
  `<div className="canvas-setup-toolbar flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-[#111827] text-slate-200 flex-wrap">`,
  'canvas setup toolbar class',
);
canvasText = requireReplace(
  canvasText,
  `className={\`relative flex-1 bg-[#d9dde3] overflow-auto p-6 \${panDrag ? 'cursor-grabbing' : isSpacePanning ? 'cursor-grab' : isDrawingZone || selectedPlant || placingRock ? 'cursor-crosshair' : 'cursor-default'}\`}`,
  `className={\`garden-canvas-viewport relative flex-1 bg-[#d9dde3] overflow-auto p-6 \${panDrag ? 'cursor-grabbing' : isSpacePanning ? 'cursor-grab' : isDrawingZone || selectedPlant || placingRock ? 'cursor-crosshair' : 'cursor-default'}\`}`,
  'canvas viewport class',
);

const css = read(files.css);
let cssText = css.text;
const marker = '/* Mobile primary toolbar simplification */';
if (!cssText.includes(marker)) cssText += `

${marker}
@media (max-width: 1023px) {
  .mobile-settings-launcher { display: none !important; }
  .mobile-tool-rail { overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
  .mobile-tool-rail::-webkit-scrollbar { display: none; }
  .mobile-tool-rail-inner { width: max-content; min-width: 100%; justify-content: center !important; }
  .mobile-tool-rail button { flex: 0 0 auto; }

  .canvas-setup-toolbar {
    flex-wrap: nowrap !important;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 0.45rem 0.55rem !important;
    gap: 0.4rem !important;
    scrollbar-width: none;
  }
  .canvas-setup-toolbar::-webkit-scrollbar { display: none; }
  .canvas-setup-toolbar > * { flex: 0 0 auto; }
  .canvas-setup-toolbar button,
  .canvas-setup-toolbar label { min-height: 40px; white-space: nowrap; }
  .garden-canvas-viewport { padding: 0.5rem !important; }

  .garden-canvas-viewport [class*="text-center"] {
    max-width: min(88vw, 30rem);
    padding: 0.75rem;
  }
  .garden-canvas-viewport [class*="text-center"] p,
  .garden-canvas-viewport [class*="text-center"] span {
    white-space: normal !important;
    overflow-wrap: anywhere;
  }
}

@media (max-width: 1023px) and (orientation: landscape) and (max-height: 500px) {
  .canvas-setup-toolbar { min-height: 44px; }
  .canvas-setup-toolbar button,
  .canvas-setup-toolbar label { min-height: 36px; padding-top: 0.35rem !important; padding-bottom: 0.35rem !important; }
  .garden-canvas-viewport { padding: 0.25rem !important; }
}
`;

const main = read(files.main);
let mainText = main.text
  .replace("import MobilePanelAccess from './MobilePanelAccess';\n", '')
  .replace('    <MobilePanelAccess />\n', '');

write(files.app, appText, app.newline);
write(files.canvas, canvasText, canvas.newline);
write(files.css, cssText, css.newline);
write(files.main, mainText, main.newline);
console.log('Simplified the primary mobile toolbar, removed Clear Selection, and made Welcome close to a clean canvas.');
