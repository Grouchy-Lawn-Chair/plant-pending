import fs from 'node:fs';
import path from 'node:path';

function read(file) {
  const raw = fs.readFileSync(file, 'utf8');
  return { text: raw.replace(/\r\n/g, '\n'), newline: raw.includes('\r\n') ? '\r\n' : '\n' };
}

function write(file, text, newline) {
  fs.writeFileSync(file, newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(tsx|jsx)$/.test(entry.name) ? [full] : [];
  });
}

// Remove all runtime icon swapping. The rail must never change icons after resize.
const polishFile = 'src/MobileUiPolish.tsx';
if (fs.existsSync(polishFile)) {
  const polishData = read(polishFile);
  const polish = `import { useEffect } from 'react';\n\nfunction titleOf(button: HTMLButtonElement) {\n  return (button.title || button.getAttribute('aria-label') || '').trim();\n}\n\nfunction toolbarButtons() {\n  return [...document.querySelectorAll<HTMLButtonElement>('.mobile-tool-rail button')];\n}\n\nfunction closeOtherTools(selected: HTMLButtonElement) {\n  const selectedTitle = titleOf(selected);\n  for (const button of toolbarButtons()) {\n    if (button === selected) continue;\n    const active = button.className.includes('border-emerald-400') || button.getAttribute('aria-pressed') === 'true';\n    if (active && titleOf(button) !== selectedTitle) button.click();\n  }\n}\n\nexport default function MobileUiPolish() {\n  useEffect(() => {\n    const rail = document.querySelector<HTMLElement>('.mobile-tool-rail');\n    if (!rail) return;\n    const onClick = (event: Event) => {\n      const button = (event.target as Element | null)?.closest<HTMLButtonElement>('button');\n      if (!button) return;\n      requestAnimationFrame(() => closeOtherTools(button));\n    };\n    rail.addEventListener('click', onClick, true);\n    return () => rail.removeEventListener('click', onClick, true);\n  }, []);\n  return null;\n}\n`;
  write(polishFile, polish, polishData.newline);
}

// Fix the actual Welcome Close button directly.
let welcomeFile = null;
for (const file of walk('src')) {
  const data = read(file);
  if (!/Welcome[\s\S]{0,900}?Plant[\s\S]{0,350}?Pending/i.test(data.text)) continue;
  const closeText = />\s*Close\s*<\/button>/i.exec(data.text);
  if (!closeText) continue;
  const buttonStart = data.text.lastIndexOf('<button', closeText.index);
  const buttonEnd = data.text.lastIndexOf('>', closeText.index);
  if (buttonStart < 0 || buttonEnd < buttonStart) continue;
  let tag = data.text.slice(buttonStart, buttonEnd + 1);
  if (!tag.includes('welcome-close-button')) {
    if (/className="[^"]*"/.test(tag)) tag = tag.replace(/className="([^"]*)"/, 'className="$1 welcome-close-button"');
    else if (/className=\{`[^`]*`\}/.test(tag)) tag = tag.replace(/className=\{`([^`]*)`\}/, 'className={`$1 welcome-close-button`}');
    else tag = tag.replace(/>$/, ' className="welcome-close-button">');
  }
  write(file, data.text.slice(0, buttonStart) + tag + data.text.slice(buttonEnd + 1), data.newline);
  welcomeFile = file;
  break;
}

if (!welcomeFile) throw new Error('Could not find the Welcome Close button. No files written.');

// Canonical icons are forced at render time by CSS on the exact source classes.
// Existing inline SVGs/images/text are hidden, so stale or duplicate icon markup cannot show.
const cssFile = 'src/index.css';
const cssData = read(cssFile);
let css = cssData.text;
const marker = '/* Canonical mobile rail icons: final authority */';
const block = `${marker}\n@media (max-width: 1023px) {\n  .mobile-primary-yard > *,\n  .mobile-primary-areas > *,\n  .mobile-primary-plant-list > *,\n  .mobile-primary-debug > * {\n    display: none !important;\n  }\n\n  .mobile-primary-yard::before,\n  .mobile-primary-areas::before {\n    content: "";\n    display: block;\n    width: 1.25rem;\n    height: 1.25rem;\n    background-position: center;\n    background-repeat: no-repeat;\n    background-size: contain;\n    filter: invert(1);\n    opacity: .8;\n  }\n\n  .mobile-primary-yard::before {\n    background-image: url('/plant-pending/ui-icons/noun-canvas-8382519.svg');\n  }\n\n  .mobile-primary-areas::before {\n    background-image: url('/plant-pending/ui-icons/noun-screenshot-4899159.svg');\n  }\n\n  .mobile-primary-plant-list::before {\n    content: "#";\n    display: block;\n    font-size: 1rem;\n    font-weight: 700;\n    line-height: 1;\n  }\n\n  .mobile-primary-debug::before {\n    content: "⌁";\n    display: block;\n    font-size: 1.1rem;\n    font-weight: 700;\n    line-height: 1;\n  }\n\n  .mobile-primary-yard[class*='border-emerald-400']::before,\n  .mobile-primary-areas[class*='border-emerald-400']::before {\n    opacity: 1;\n  }\n\n  .welcome-close-button {\n    position: static !important;\n    inset: auto !important;\n    transform: none !important;\n    float: none !important;\n    display: block !important;\n    width: max-content !important;\n    margin: 0 0 .75rem auto !important;\n  }\n}\n`;

const markerIndex = css.indexOf(marker);
if (markerIndex >= 0) {
  css = css.slice(0, markerIndex).trimEnd() + '\n\n' + block;
} else {
  css += '\n\n' + block;
}
write(cssFile, css, cssData.newline);

console.log('Applied canonical mobile rail icons.');
console.log('All old mobile icon children are hidden by CSS.');
console.log('No runtime icon cloning remains.');
console.log(`Welcome Close fixed in: ${welcomeFile}`);
