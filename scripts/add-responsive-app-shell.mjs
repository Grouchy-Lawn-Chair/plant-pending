import fs from 'node:fs';

const appFile = 'src/App.tsx';
const cssFile = 'src/index.css';

function read(path) {
  const raw = fs.readFileSync(path, 'utf8');
  return { raw, newline: raw.includes('\r\n') ? '\r\n' : '\n', text: raw.replace(/\r\n/g, '\n') };
}
function write(path, text, newline) {
  fs.writeFileSync(path, newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
}
function replaceOnce(text, before, after, label) {
  if (text.includes(after)) return text;
  if (!text.includes(before)) throw new Error(`${label} anchor not found. No files written.`);
  return text.replace(before, after);
}

const app = read(appFile);
let appText = app.text;

appText = replaceOnce(appText,
  '<div className="h-screen flex flex-col bg-[#0f141b] text-slate-100">',
  '<div className="app-shell h-screen flex flex-col bg-[#0f141b] text-slate-100">',
  'app shell');
appText = replaceOnce(appText,
  '<header className="border-b border-slate-800 bg-[#161c24] px-4 py-3">',
  '<header className="app-header border-b border-slate-800 bg-[#161c24] px-4 py-3">',
  'app header');
appText = replaceOnce(appText,
  '<div className="flex items-center justify-between gap-4">',
  '<div className="app-header-row flex items-center justify-between gap-4">',
  'header row');
appText = replaceOnce(appText,
  '<div className="flex-1 flex overflow-hidden">',
  '<div className="app-workspace flex-1 flex overflow-hidden">',
  'workspace');
appText = replaceOnce(appText,
  '<aside className="w-16 shrink-0 border-r border-slate-800 bg-[#11161d] px-2 py-3">',
  '<aside className="mobile-tool-rail w-16 shrink-0 border-r border-slate-800 bg-[#11161d] px-2 py-3">',
  'tool rail');
appText = replaceOnce(appText,
  '<div className="flex h-full flex-col items-center gap-2">',
  '<div className="mobile-tool-rail-inner flex h-full flex-col items-center gap-2">',
  'tool rail inner');
appText = replaceOnce(appText,
  '<aside className={`shrink-0 border-r border-slate-800 bg-[#171d25] ${leftPanelMode === \'filters\' ? \'w-[22rem]\' : \'w-[25rem]\'} flex flex-col`}>',
  '<aside className={`mobile-left-sheet shrink-0 border-r border-slate-800 bg-[#171d25] ${leftPanelMode === \'filters\' ? \'w-[22rem]\' : \'w-[25rem]\'} flex flex-col`}>',
  'left panel');
appText = replaceOnce(appText,
  '<main className="flex-1 min-w-0 bg-[#10161d]">',
  '<main className="app-canvas flex-1 min-w-0 bg-[#10161d]">',
  'canvas');
appText = replaceOnce(appText,
  '<aside className={`${rightInspectorSection ? \'w-[23rem]\' : \'w-12\'} shrink-0 border-l border-slate-800 bg-[#0f1720] transition-[width] duration-200`}>',
  '<aside className={`mobile-inspector-sheet ${rightInspectorSection ? \'w-[23rem]\' : \'w-12\'} shrink-0 border-l border-slate-800 bg-[#0f1720] transition-[width] duration-200`}>',
  'right inspector');

const css = read(cssFile);
let cssText = css.text;
const marker = '/* Responsive phone and tablet shell */';
if (!cssText.includes(marker)) {
  cssText += `

${marker}
html, body, #root { width: 100%; min-width: 0; height: 100%; overflow: hidden; }
body { overscroll-behavior: none; touch-action: manipulation; }
.app-shell { min-height: 100dvh; height: 100dvh; }

@media (max-width: 1023px) {
  .app-header { padding: 0.5rem 0.75rem !important; }
  .app-header-row { gap: 0.5rem !important; flex-wrap: wrap; }
  .app-header-row > div:first-child { flex: 1 1 auto; min-width: 10rem; }
  .app-header-row > div:first-child > div:first-child { width: 2.75rem !important; height: 2.75rem !important; border-radius: 0.75rem !important; }
  .app-header-row h1 { font-size: 0.95rem !important; line-height: 1.15rem !important; }
  .app-header-row p { display: none; }
  .app-header-row > button,
  .app-header-row > div > button { min-height: 44px; }
  .app-header-row > button:nth-of-type(1) { display: none; }
  .app-header-row [aria-label*="Shrub Score"] { display: none; }
  .app-header-row [title^="Estimated total"] { font-size: 0.75rem; padding: 0.55rem 0.65rem; }

  .app-workspace { position: relative; padding-bottom: calc(4.25rem + env(safe-area-inset-bottom)); }
  .app-canvas { width: 100%; height: 100%; }

  .mobile-tool-rail {
    position: fixed !important;
    z-index: 65;
    left: 0;
    right: 0;
    bottom: 0;
    width: auto !important;
    height: calc(4.25rem + env(safe-area-inset-bottom));
    padding: 0.55rem 0.75rem calc(0.55rem + env(safe-area-inset-bottom)) !important;
    border-right: 0 !important;
    border-top: 1px solid #1e293b;
    box-shadow: 0 -12px 30px rgba(0,0,0,.28);
  }
  .mobile-tool-rail-inner { flex-direction: row !important; justify-content: space-around; gap: 0.65rem !important; }
  .mobile-tool-rail button { width: 3rem !important; height: 3rem !important; min-width: 48px; min-height: 48px; }

  .mobile-left-sheet {
    position: fixed !important;
    z-index: 60;
    left: 0;
    right: 0;
    bottom: calc(4.25rem + env(safe-area-inset-bottom));
    width: 100% !important;
    max-height: min(72dvh, 44rem);
    border-right: 0 !important;
    border-top: 1px solid #334155;
    border-radius: 1.25rem 1.25rem 0 0;
    box-shadow: 0 -24px 50px rgba(0,0,0,.48);
  }

  .mobile-inspector-sheet {
    position: fixed !important;
    z-index: 64;
    right: 0;
    bottom: calc(4.25rem + env(safe-area-inset-bottom));
    border-left: 1px solid #334155;
    box-shadow: -16px -8px 40px rgba(0,0,0,.38);
  }
  .mobile-inspector-sheet.w-\\[23rem\\] {
    left: 0;
    width: 100% !important;
    height: min(76dvh, 48rem);
    border-left: 0;
    border-top: 1px solid #334155;
    border-radius: 1.25rem 1.25rem 0 0;
  }
  .mobile-inspector-sheet.w-12 {
    width: 3.5rem !important;
    height: auto;
    max-height: calc(100dvh - 10rem);
    border-radius: 1rem 0 0 1rem;
  }

  div[class~="fixed"][class~="inset-0"] { padding: 0.75rem !important; align-items: flex-end !important; }
  div[class~="fixed"][class~="inset-0"] > div { max-height: 92dvh !important; border-radius: 1.25rem !important; }
  button, [role="button"], input, select, textarea { font-size: 16px; }
}

@media (min-width: 640px) and (max-width: 1023px) {
  .mobile-left-sheet { left: 0.75rem; right: auto; bottom: 0.75rem; width: min(26rem, 46vw) !important; max-height: calc(100dvh - 6rem); border: 1px solid #334155 !important; border-radius: 1.25rem; }
  .mobile-inspector-sheet.w-\\[23rem\\] { left: auto; right: 0.75rem; bottom: 0.75rem; width: min(27rem, 48vw) !important; height: calc(100dvh - 6rem); border: 1px solid #334155; border-radius: 1.25rem; }
  .mobile-tool-rail { left: 50%; right: auto; bottom: 0.75rem; width: auto !important; height: auto; transform: translateX(-50%); border: 1px solid #334155 !important; border-radius: 1rem; padding: 0.45rem !important; }
}
`;
}

write(appFile, appText, app.newline);
write(cssFile, cssText, css.newline);
console.log('Added the first responsive shell for phone and tablet without changing planner behavior.');
console.log('Desktop remains unchanged at 1024px and wider.');
