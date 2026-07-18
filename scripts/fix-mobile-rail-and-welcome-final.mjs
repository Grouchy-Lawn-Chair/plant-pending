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

  // Search for the end of the opening tag after the marker. Searching from the
  // button start incorrectly stops at the > character in an arrow function (=>).
  const openEndIndex = text.indexOf('>', markerIndex + marker.length);
  if (openEndIndex < 0) return null;

  const closeStart = text.indexOf('</button>', openEndIndex + 1);
  if (closeStart < 0) return null;

  return {
    start,
    openEnd: openEndIndex + 1,
    closeStart,
    end: closeStart + '</button>'.length,
  };
}

function replaceButtonContent(text, marker, content) {
  const bounds = buttonBoundsByMarker(text, marker);
  if (!bounds) throw new Error(`Could not find ${marker} in src/App.tsx. No files written.`);
  return text.slice(0, bounds.openEnd) + `\n${content}\n            ` + text.slice(bounds.closeStart);
}

function addClassToOpeningTag(tag, className) {
  if (tag.includes(className)) return tag;
  if (/className="[^"]*"/.test(tag)) {
    return tag.replace(/className="([^"]*)"/, `className="$1 ${className}"`);
  }
  if (/className=\{`[^`]*`\}/.test(tag)) {
    return tag.replace(/className=\{`([^`]*)`\}/, `className={\`$1 ${className}\`}`);
  }
  return tag.replace(/>$/, ` className="${className}">`);
}

const appFile = 'src/App.tsx';
const appData = read(appFile);
let app = appData.text;

app = replaceButtonContent(
  app,
  'mobile-primary-yard',
  `              <img
                src={\`${'${import.meta.env.BASE_URL}'}ui-icons/noun-canvas-8382519.svg\`}
                alt=""
                aria-hidden="true"
                className={\`h-5 w-5 ${'${rightInspectorSection === \'canvas\' ? \'invert brightness-0 sepia saturate-[8] hue-rotate-[105deg]\' : \'invert opacity-80\'}'}\`}
              />`,
);

app = replaceButtonContent(
  app,
  'mobile-primary-areas',
  `              <img
                src={\`${'${import.meta.env.BASE_URL}'}ui-icons/noun-screenshot-4899159.svg\`}
                alt=""
                aria-hidden="true"
                className={\`h-5 w-5 ${'${rightInspectorSection === \'zones\' ? \'invert brightness-0 sepia saturate-[8] hue-rotate-[105deg]\' : \'invert opacity-80\'}'}\`}
              />`,
);

app = replaceButtonContent(
  app,
  'mobile-primary-debug',
  '              <span aria-hidden="true">⌁</span>',
);

if (!app.includes('mobile-primary-plant-list')) {
  const debugBounds = buttonBoundsByMarker(app, 'mobile-primary-debug');
  if (!debugBounds) throw new Error('Could not find mobile Debug button for Plant List insertion. No files written.');

  const plantListButton = `            <button
              type="button"
              title="Plant list"
              aria-label="Plant list"
              onClick={() => setRightInspectorSection(section => section === 'legend' ? null : 'legend')}
              className={\`mobile-primary-plant-list flex h-11 w-11 items-center justify-center rounded-xl border text-lg font-bold ${'${rightInspectorSection === \'legend\' ? \'border-emerald-400 bg-emerald-500/15 text-emerald-200\' : \'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800\'}'}\`}
            >
              <span aria-hidden="true">#</span>
            </button>
`;
  app = app.slice(0, debugBounds.start) + plantListButton + app.slice(debugBounds.start);
}

const polishFile = 'src/MobileUiPolish.tsx';
let polishWrite = null;
if (fs.existsSync(polishFile)) {
  const polishData = read(polishFile);
  const polish = `import { useEffect } from 'react';

function titleOf(button: HTMLButtonElement) {
  return (button.title || button.getAttribute('aria-label') || '').trim();
}

function toolbarButtons() {
  return [...document.querySelectorAll<HTMLButtonElement>('.mobile-tool-rail button')];
}

function closeOtherTools(selected: HTMLButtonElement) {
  const selectedTitle = titleOf(selected);
  for (const button of toolbarButtons()) {
    if (button === selected) continue;
    const active = button.className.includes('border-emerald-400') || button.getAttribute('aria-pressed') === 'true';
    if (active && titleOf(button) !== selectedTitle) button.click();
  }
}

export default function MobileUiPolish() {
  useEffect(() => {
    const rail = document.querySelector<HTMLElement>('.mobile-tool-rail');
    if (!rail) return;
    const onClick = (event: Event) => {
      const button = (event.target as Element | null)?.closest<HTMLButtonElement>('button');
      if (!button) return;
      requestAnimationFrame(() => closeOtherTools(button));
    };
    rail.addEventListener('click', onClick, true);
    return () => rail.removeEventListener('click', onClick, true);
  }, []);
  return null;
}
`;
  polishWrite = { data: polishData, text: polish };
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(tsx|jsx)$/.test(entry.name) ? [full] : [];
  });
}

let welcomeWrite = null;
for (const file of walk('src')) {
  const data = read(file);
  if (!/Welcome[\s\S]{0,800}?Plant[\s\S]{0,300}?Pending/i.test(data.text)) continue;

  const closeText = />\s*Close\s*<\/button>/i.exec(data.text);
  if (!closeText) continue;

  const buttonStart = data.text.lastIndexOf('<button', closeText.index);
  if (buttonStart < 0) continue;

  // The Close button does not contain arrow functions, so finding its closing
  // angle bracket from the visible Close text is unambiguous.
  const buttonEnd = data.text.lastIndexOf('>', closeText.index);
  if (buttonEnd < buttonStart) continue;

  const tag = data.text.slice(buttonStart, buttonEnd + 1);
  const updatedTag = addClassToOpeningTag(tag, 'welcome-close-button');
  const updated = data.text.slice(0, buttonStart) + updatedTag + data.text.slice(buttonEnd + 1);
  welcomeWrite = { file, data, text: updated };
  break;
}

if (!welcomeWrite) {
  throw new Error('Could not find the Welcome Close button. No files written.');
}

const cssFile = 'src/index.css';
const cssData = read(cssFile);
let css = cssData.text;
const marker = '/* Final direct mobile rail and welcome close fix */';
if (!css.includes(marker)) {
  css += `\n\n${marker}\n@media (max-width: 767px) {
  .mobile-primary-yard img,
  .mobile-primary-areas img {
    display: block;
    width: 1.25rem;
    height: 1.25rem;
  }

  .welcome-close-button {
    position: static !important;
    inset: auto !important;
    display: block !important;
    width: max-content !important;
    margin: 0 0 .75rem auto !important;
    transform: none !important;
    float: none !important;
  }
}
`;
}

// Write only after every required source target has been verified.
write(appFile, app, appData.newline);
if (polishWrite) write(polishFile, polishWrite.text, polishWrite.data.newline);
write(welcomeWrite.file, welcomeWrite.text, welcomeWrite.data.newline);
write(cssFile, css, cssData.newline);

console.log('Applied direct mobile rail fix.');
console.log('Icons now match desktop from first render.');
console.log('Plant List is a real source button, not runtime-injected.');
console.log(`Welcome Close fixed in: ${welcomeWrite.file}`);
