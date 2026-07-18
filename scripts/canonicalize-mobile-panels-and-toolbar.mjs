import fs from 'node:fs';

function read(file) {
  const raw = fs.readFileSync(file, 'utf8');
  return { text: raw.replace(/\r\n/g, '\n'), newline: raw.includes('\r\n') ? '\r\n' : '\n' };
}

function write(file, text, newline) {
  fs.writeFileSync(file, newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
}

const planFile = 'src/components/PlanDetails.tsx';
const canvasFile = 'src/components/GardenCanvas.tsx';
const cssFile = 'src/index.css';

const planData = read(planFile);
let plan = planData.text;

const rootOld = '<div className="inspector-dark relative h-full flex flex-col bg-slate-950 text-slate-100 pr-12">';
const rootNew = '<div data-mobile-open={Boolean(inspectorSection)} className="mobile-plan-details-root inspector-dark relative h-full flex flex-col bg-slate-950 text-slate-100 pr-12">';
if (plan.includes(rootOld)) plan = plan.replace(rootOld, rootNew);
else if (!plan.includes('mobile-plan-details-root')) throw new Error('PlanDetails root anchor not found. No files written.');

const railOld = '<div className="absolute inset-y-0 right-0 z-20 flex w-12 flex-col items-center gap-2 border-l border-slate-800 bg-slate-950 px-1.5 py-3">';
const railNew = '<div className="desktop-inspector-rail absolute inset-y-0 right-0 z-20 flex w-12 flex-col items-center gap-2 border-l border-slate-800 bg-slate-950 px-1.5 py-3">';
if (plan.includes(railOld)) plan = plan.replace(railOld, railNew);
else if (!plan.includes('desktop-inspector-rail')) throw new Error('PlanDetails desktop rail anchor not found. No files written.');

const contentOld = '<div className={`${inspectorSection ? \'\' : \'hidden\'} flex-1 overflow-y-auto`}>';
const contentNew = '<div className={`${inspectorSection ? \'\' : \'hidden\'} mobile-plan-details-content flex-1 overflow-y-auto`}>';
if (plan.includes(contentOld)) plan = plan.replace(contentOld, contentNew);
else if (!plan.includes('mobile-plan-details-content')) throw new Error('PlanDetails content anchor not found. No files written.');

const canvasData = read(canvasFile);
let canvas = canvasData.text;
const toolbarPattern = /<div className="([^"]*border-b border-slate-800 bg-\[#111827\][^"]*)">/;
if (!canvas.includes('mobile-canvas-toolbar')) {
  if (!toolbarPattern.test(canvas)) throw new Error('GardenCanvas toolbar anchor not found. No files written.');
  canvas = canvas.replace(toolbarPattern, '<div className="mobile-canvas-toolbar $1">');
}

const rootCanvasOld = '<div className="flex flex-col h-full bg-[#10161d]">';
const rootCanvasNew = '<div className="mobile-garden-canvas-root flex flex-col h-full bg-[#10161d]">';
if (canvas.includes(rootCanvasOld)) canvas = canvas.replace(rootCanvasOld, rootCanvasNew);
else if (!canvas.includes('mobile-garden-canvas-root')) throw new Error('GardenCanvas root anchor not found. No files written.');

write(planFile, plan, planData.newline);
write(canvasFile, canvas, canvasData.newline);

const cssData = read(cssFile);
let css = cssData.text;

// Remove every older mobile block that targeted the inspector sheet or canvas toolbar.
css = css
  .replace(/\/\* Locked mobile inspector panel behavior \*\/[\s\S]*?(?=\/\*|$)/g, '')
  .replace(/\/\* Mobile inspector rail, toolbar affordance, and pinch zoom \*\/[\s\S]*?(?=\/\*|$)/g, '')
  .replace(/\/\* Mobile inspector rail, control hints, and touch canvas \*\/[\s\S]*?(?=\/\*|$)/g, '')
  .replace(/\/\* Final direct mobile rail and welcome close fix \*\/[\s\S]*?(?=\/\*|$)/g, '')
  .replace(/\/\* Canonical mobile inspector panels and canvas toolbar \*\/[\s\S]*?(?=\/\*|$)/g, '');

css += `\n\n/* Canonical mobile inspector panels and canvas toolbar */\n@media (max-width: 1023px) {\n  .mobile-plan-details-root {\n    display: none !important;\n  }\n\n  .mobile-plan-details-root[data-mobile-open=\"true\"] {\n    display: flex !important;\n    position: fixed !important;\n    left: 0 !important;\n    right: 0 !important;\n    bottom: calc(4.25rem + env(safe-area-inset-bottom)) !important;\n    width: 100vw !important;\n    height: min(64dvh, 40rem) !important;\n    max-height: calc(100dvh - 8rem) !important;\n    padding-right: 0 !important;\n    overflow: hidden !important;\n    z-index: 90 !important;\n    border-top: 1px solid #334155 !important;\n    border-radius: 1rem 1rem 0 0 !important;\n    box-shadow: 0 -18px 40px rgba(0,0,0,.45) !important;\n  }\n\n  .mobile-plan-details-root[data-mobile-open=\"true\"] .desktop-inspector-rail {\n    display: none !important;\n  }\n\n  .mobile-plan-details-root[data-mobile-open=\"true\"] .mobile-plan-details-content {\n    display: block !important;\n    flex: 1 1 auto !important;\n    min-height: 0 !important;\n    width: 100% !important;\n    overflow-y: auto !important;\n    -webkit-overflow-scrolling: touch;\n  }\n\n  .mobile-garden-canvas-root {\n    min-height: 0 !important;\n  }\n\n  .mobile-canvas-toolbar {\n    display: flex !important;\n    flex: 0 0 auto !important;\n    flex-wrap: nowrap !important;\n    width: 100% !important;\n    min-height: 3.25rem !important;\n    overflow-x: auto !important;\n    overflow-y: hidden !important;\n    padding: .5rem .75rem !important;\n    gap: .5rem !important;\n    scrollbar-width: thin;\n    -webkit-overflow-scrolling: touch;\n  }\n\n  .mobile-canvas-toolbar > * {\n    flex: 0 0 auto !important;\n  }\n\n  .mobile-canvas-toolbar::before,\n  .mobile-canvas-toolbar::after {\n    content: none !important;\n    display: none !important;\n  }\n}\n`;

write(cssFile, css, cssData.newline);

console.log('Canonical mobile inspector and canvas toolbar applied.');
console.log('PlanDetails now owns its mobile open/closed state directly.');
console.log('GardenCanvas toolbar is forced visible and horizontally scrollable on mobile.');
