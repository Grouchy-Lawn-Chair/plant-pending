import fs from 'node:fs';
import path from 'node:path';

function read(file) {
  const raw = fs.readFileSync(file, 'utf8');
  return { text: raw.replace(/\r\n/g, '\n'), newline: raw.includes('\r\n') ? '\r\n' : '\n' };
}

function write(file, text, newline) {
  fs.writeFileSync(file, newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
}

function buttonBoundsByMarker(text, marker) {
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) return null;
  const start = text.lastIndexOf('<button', markerIndex);
  if (start < 0) return null;
  const openEnd = text.indexOf('>', start);
  const closeStart = text.indexOf('</button>', openEnd);
  if (openEnd < 0 || closeStart < 0) return null;
  return { start, openEnd: openEnd + 1, closeStart, end: closeStart + 9 };
}

function replaceButtonContent(text, marker, content) {
  const bounds = buttonBoundsByMarker(text, marker);
  if (!bounds) throw new Error(`Could not find ${marker} in src/App.tsx. No files written.`);
  return text.slice(0, bounds.openEnd) + `\n${content}\n            ` + text.slice(bounds.closeStart);
}

const appFile = 'src/App.tsx';
const appData = read(appFile);
let app = appData.text;

// Use the exact same icon definitions as the desktop inspector rail.
app = replaceButtonContent(
  app,
  'mobile-primary-yard',
  `              <img\n                src={\`${'${import.meta.env.BASE_URL}'}ui-icons/noun-canvas-8382519.svg\`}\n                alt=""\n                aria-hidden="true"\n                className={\`h-5 w-5 ${'${rightInspectorSection === \'canvas\' ? \'invert brightness-0 sepia saturate-[8] hue-rotate-[105deg]\' : \'invert opacity-80\'}'}\`}\n              />`,
);

app = replaceButtonContent(
  app,
  'mobile-primary-areas',
  `              <img\n                src={\`${'${import.meta.env.BASE_URL}'}ui-icons/noun-screenshot-4899159.svg\`}\n                alt=""\n                aria-hidden="true"\n                className={\`h-5 w-5 ${'${rightInspectorSection === \'zones\' ? \'invert brightness-0 sepia saturate-[8] hue-rotate-[105deg]\' : \'invert opacity-80\'}'}\`}\n              />`,
);

app = replaceButtonContent(app, 'mobile-primary-debug', `              <span aria-hidden="true">⌁</span>`);

// Plant List belongs in the source rail, not injected later at runtime.
if (!app.includes('mobile-primary-plant-list')) {
  const debugBounds = buttonBoundsByMarker(app, 'mobile-primary-debug');
  if (!debugBounds) throw new Error('Could not find mobile Debug button for Plant List insertion. No files written.');
  const plantListButton = `            <button\n              type="button"\n              title="Plant list"\n              aria-label="Plant list"\n              onClick={() => setRightInspectorSection(section => section === 'legend' ? null : 'legend')}\n              className={\`mobile-primary-plant-list flex h-11 w-11 items-center justify-center rounded-xl border text-lg font-bold ${'${rightInspectorSection === \'legend\' ? \'border-emerald-400 bg-emerald-500/15 text-emerald-200\' : \'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800\'}'}\`}\n            >\n              <span aria-hidden="true">#</span>\n            </button>\n`;
  app = app.slice(0, debugBounds.start) + plantListButton + app.slice(debugBounds.start);
}

write(appFile, app, appData.newline);

// Keep only behavior in MobileUiPolish. No icon cloning and no runtime button creation.
const polishFile = 'src/MobileUiPolish.tsx';
if (fs.existsSync(polishFile)) {
  const polishData = read(polishFile);
  const polish = `import { useEffect } from 'react';\n\nfunction titleOf(button: HTMLButtonElement) {\n  return (button.title || button.getAttribute('aria-label') || '').trim();\n}\n\nfunction toolbarButtons() {\n  return [...document.querySelectorAll<HTMLButtonElement>('.mobile-tool-rail button')];\n}\n\nfunction closeOtherTools(selected: HTMLButtonElement) {\n  const selectedTitle = titleOf(selected);\n  for (const button of toolbarButtons()) {\n    if (button === selected) continue;\n    const active = button.className.includes('border-emerald-400') || button.getAttribute('aria-pressed') === 'true';\n    if (active && titleOf(button) !== selectedTitle) button.click();\n  }\n}\n\nexport default function MobileUiPolish() {\n  useEffect(() => {\n    const rail = document.querySelector<HTMLElement>('.mobile-tool-rail');\n    if (!rail) return;\n    const onClick = (event: Event) => {\n      const button = (event.target as Element | null)?.closest<HTMLButtonElement>('button');\n      if (!button) return;\n      requestAnimationFrame(() => closeOtherTools(button));\n    };\n    rail.addEventListener('click', onClick, true);\n    return () => rail.removeEventListener('click', onClick, true);\n  }, []);\n  return null;\n}\n`;
  write(polishFile, polish, polishData.newline);
}

// Fix the real Welcome Close button by giving it its own normal-flow row.
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(tsx|jsx)$/.test(entry.name) ? [full] : [];
  });
}

let welcomeFile = null;
for (const file of walk('src')) {
  const data = read(file);
  if (!/Welcome[\s\S]{0,600}?Plant[\s\S]{0,250}?Pending/i.test(data.text)) continue;
  const closeText = />\s*Close\s*<\/button>/i.exec(data.text);
  if (!closeText) continue;
  const buttonStart = data.text.lastIndexOf('<button', closeText.index);
  const buttonEnd = data.text.indexOf('>', buttonStart);
  if (buttonStart < 0 || buttonEnd < 0) continue;
  let tag = data.text.slice(buttonStart, buttonEnd + 1);
  if (!tag.includes('welcome-close-button')) {
    if (/className="[^"]*"/.test(tag)) tag = tag.replace(/className="([^"]*)"/, 'className="$1 welcome-close-button"');
    else if (/className=\{`[^`]*`\}/.test(tag)) tag = tag.replace(/className=\{`([^`]*)`\}/, 'className={`$1 welcome-close-button`}');
    else tag = tag.replace(/>$/, ' className="welcome-close-button">');
  }
  const updated = data.text.slice(0, buttonStart) + tag + data.text.slice(buttonEnd + 1);
  write(file, updated, data.newline);
  welcomeFile = file;
  break;
}

if (!welcomeFile) throw new Error('Could not find the Welcome Close button. App changes were written; inspect Welcome component before rerunning.');

const cssFile = 'src/index.css';
const cssData = read(cssFile);
let css = cssData.text;
const marker = '/* Final direct mobile rail and welcome close fix */';
if (!css.includes(marker)) {
  css += `\n\n${marker}\n@media (max-width: 767px) {\n  .mobile-primary-yard img,\n  .mobile-primary-areas img {\n    display: block;\n    width: 1.25rem;\n    height: 1.25rem;\n  }\n\n  .welcome-close-button {\n    position: static !important;\n    inset: auto !important;\n    display: block !important;\n    width: max-content !important;\n    margin: 0 0 .75rem auto !important;\n    transform: none !important;\n    float: none !important;\n  }\n}\n`;
  write(cssFile, css, cssData.newline);
}

console.log('Applied direct mobile rail fix.');
console.log('Icons now match desktop from first render.');
console.log('Plant List is a real source button, not runtime-injected.');
console.log(`Welcome Close fixed in: ${welcomeFile}`);
