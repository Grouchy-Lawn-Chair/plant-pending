import fs from 'node:fs';

function read(file) {
  const raw = fs.readFileSync(file, 'utf8');
  return { text: raw.replace(/\r\n/g, '\n'), newline: raw.includes('\r\n') ? '\r\n' : '\n' };
}

function write(file, text, newline) {
  fs.writeFileSync(file, newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
}

function addStaticClassToTag(tag, className) {
  if (tag.includes(className)) return tag;
  if (/className="[^"]*"/.test(tag)) {
    return tag.replace(/className="([^"]*)"/, `className="$1 ${className}"`);
  }
  if (/className=\{`[^`]*`\}/.test(tag)) {
    return tag.replace(/className=\{`([^`]*)`\}/, `className={\`$1 ${className}\`}`);
  }
  return tag.replace(/>$/, ` className="${className}">`);
}

function addAttribute(tag, attribute) {
  if (tag.includes(attribute.split('=')[0])) return tag;
  return tag.replace(/>$/, ` ${attribute}>`);
}

const planFile = 'src/components/PlanDetails.tsx';
const canvasFile = 'src/components/GardenCanvas.tsx';
const cssFile = 'src/index.css';

const planData = read(planFile);
let plan = planData.text;

// Find the actual PlanDetails root by its stable inspector-dark class, regardless
// of classes added by earlier mobile scripts.
const rootMatch = plan.match(/<div\b[^>]*className=(?:"[^"]*inspector-dark[^"]*"|\{`[^`]*inspector-dark[^`]*`\})[^>]*>/);
if (!rootMatch) throw new Error('PlanDetails root with inspector-dark class not found. No files written.');
let rootTag = addStaticClassToTag(rootMatch[0], 'mobile-plan-details-root');
rootTag = addAttribute(rootTag, 'data-mobile-open={Boolean(inspectorSection)}');
plan = plan.replace(rootMatch[0], rootTag);

// Find the actual desktop icon rail using the stable absolute/right/w-12 classes.
const railMatch = plan.match(/<div\b[^>]*className=(?:"[^"]*absolute[^\"]*right-0[^\"]*w-12[^\"]*"|\{`[^`]*absolute[^`]*right-0[^`]*w-12[^`]*`\})[^>]*>/);
if (!railMatch) throw new Error('PlanDetails desktop icon rail not found. No files written.');
plan = plan.replace(railMatch[0], addStaticClassToTag(railMatch[0], 'desktop-inspector-rail'));

// Find the scrollable content container by its stable flex-1/overflow-y-auto classes.
const contentMatch = plan.match(/<div\b[^>]*className=\{`[^`]*flex-1[^`]*overflow-y-auto[^`]*`\}[^>]*>/)
  || plan.match(/<div\b[^>]*className="[^"]*flex-1[^"]*overflow-y-auto[^"]*"[^>]*>/);
if (!contentMatch) throw new Error('PlanDetails scrollable content not found. No files written.');
plan = plan.replace(contentMatch[0], addStaticClassToTag(contentMatch[0], 'mobile-plan-details-content'));

const canvasData = read(canvasFile);
let canvas = canvasData.text;

// The first GardenCanvas child is the toolbar. Match its stable border/background
// classes even when earlier scripts already added canvas-control-bar.
const toolbarMatch = canvas.match(/<div\b[^>]*className="[^"]*border-b border-slate-800 bg-\[#111827\][^"]*"[^>]*>/);
if (!toolbarMatch) throw new Error('GardenCanvas toolbar not found. No files written.');
canvas = canvas.replace(toolbarMatch[0], addStaticClassToTag(toolbarMatch[0], 'mobile-canvas-toolbar'));

const canvasRootMatch = canvas.match(/<div\b[^>]*className="[^"]*flex flex-col h-full bg-\[#10161d\][^"]*"[^>]*>/);
if (!canvasRootMatch) throw new Error('GardenCanvas root not found. No files written.');
canvas = canvas.replace(canvasRootMatch[0], addStaticClassToTag(canvasRootMatch[0], 'mobile-garden-canvas-root'));

const cssData = read(cssFile);
let css = cssData.text;

// Remove older competing mobile rules. This only removes blocks created by this
// mobile work, not unrelated application CSS.
css = css
  .replace(/\/\* Locked mobile inspector panel behavior \*\/[\s\S]*?(?=\/\*|$)/g, '')
  .replace(/\/\* Mobile inspector rail, toolbar affordance, and pinch zoom \*\/[\s\S]*?(?=\/\*|$)/g, '')
  .replace(/\/\* Mobile inspector rail, control hints, and touch canvas \*\/[\s\S]*?(?=\/\*|$)/g, '')
  .replace(/\/\* Final direct mobile rail and welcome close fix \*\/[\s\S]*?(?=\/\*|$)/g, '')
  .replace(/\/\* Canonical mobile inspector panels and canvas toolbar \*\/[\s\S]*?(?=\/\*|$)/g, '');

css += `\n\n/* Canonical mobile inspector panels and canvas toolbar */\n@media (max-width: 1023px) {\n  .mobile-inspector-sheet {\n    display: block !important;\n  }\n\n  .mobile-plan-details-root {\n    display: none !important;\n  }\n\n  .mobile-plan-details-root[data-mobile-open="true"] {\n    display: flex !important;\n    position: fixed !important;\n    left: 0 !important;\n    right: 0 !important;\n    bottom: calc(4.25rem + env(safe-area-inset-bottom)) !important;\n    width: 100vw !important;\n    height: min(64dvh, 40rem) !important;\n    max-height: calc(100dvh - 8rem) !important;\n    padding-right: 0 !important;\n    overflow: hidden !important;\n    z-index: 90 !important;\n    border-top: 1px solid #334155 !important;\n    border-radius: 1rem 1rem 0 0 !important;\n    box-shadow: 0 -18px 40px rgba(0,0,0,.45) !important;\n  }\n\n  .mobile-plan-details-root[data-mobile-open="true"] .desktop-inspector-rail {\n    display: none !important;\n  }\n\n  .mobile-plan-details-root[data-mobile-open="true"] .mobile-plan-details-content {\n    display: block !important;\n    flex: 1 1 auto !important;\n    min-height: 0 !important;\n    width: 100% !important;\n    overflow-y: auto !important;\n    -webkit-overflow-scrolling: touch;\n  }\n\n  .mobile-garden-canvas-root {\n    min-height: 0 !important;\n  }\n\n  .mobile-canvas-toolbar {\n    display: flex !important;\n    flex: 0 0 auto !important;\n    flex-wrap: nowrap !important;\n    width: 100% !important;\n    min-height: 3.25rem !important;\n    overflow-x: auto !important;\n    overflow-y: hidden !important;\n    padding: .5rem .75rem !important;\n    gap: .5rem !important;\n    scrollbar-width: thin;\n    -webkit-overflow-scrolling: touch;\n  }\n\n  .mobile-canvas-toolbar > * {\n    flex: 0 0 auto !important;\n  }\n\n  .mobile-canvas-toolbar::before,\n  .mobile-canvas-toolbar::after {\n    content: none !important;\n    display: none !important;\n  }\n}\n`;

// All validation passed. Write only now.
write(planFile, plan, planData.newline);
write(canvasFile, canvas, canvasData.newline);
write(cssFile, css, cssData.newline);

console.log('Canonical mobile inspector and canvas toolbar applied.');
console.log('Matched the transformed local PlanDetails and GardenCanvas markup.');
