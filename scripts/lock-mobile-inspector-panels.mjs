import fs from 'node:fs';

function read(file) {
  const raw = fs.readFileSync(file, 'utf8');
  return { text: raw.replace(/\r\n/g, '\n'), newline: raw.includes('\r\n') ? '\r\n' : '\n' };
}

function write(file, text, newline) {
  fs.writeFileSync(file, newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
}

// The bottom rail buttons already update rightInspectorSection directly in App.tsx.
// MobileUiPolish added a second delegated click handler that clicked other rail
// buttons after every selection. That could immediately change or clear the newly
// selected section, leaving the inspector sheet open but with every section hidden.
const mainFile = 'src/main.tsx';
const mainData = read(mainFile);
let main = mainData.text
  .replace(/^import MobileUiPolish from ['"]\.\/MobileUiPolish['"];\s*\n?/m, '')
  .replace(/^\s*<MobileUiPolish\s*\/>\s*\n?/m, '');
write(mainFile, main, mainData.newline);

const polishFile = 'src/MobileUiPolish.tsx';
if (fs.existsSync(polishFile)) {
  const polishData = read(polishFile);
  write(
    polishFile,
    `// Intentionally empty. Mobile toolbar buttons are controlled directly by App.tsx.\nexport default function MobileUiPolish() {\n  return null;\n}\n`,
    polishData.newline,
  );
}

const cssFile = 'src/index.css';
const cssData = read(cssFile);
let css = cssData.text;
const marker = '/* Locked mobile inspector panel behavior */';
if (!css.includes(marker)) {
  css += `\n\n${marker}\n@media (max-width: 1023px) {\n  .mobile-inspector-sheet[data-mobile-open="true"] {\n    display: block !important;\n    position: fixed !important;\n    left: 0 !important;\n    right: 0 !important;\n    bottom: 68px !important;\n    width: 100vw !important;\n    max-width: none !important;\n    height: min(62dvh, 38rem) !important;\n    max-height: calc(100dvh - 11rem) !important;\n    overflow: hidden !important;\n    z-index: 70 !important;\n  }\n\n  .mobile-inspector-sheet[data-mobile-open="true"] > * {\n    display: flex !important;\n    width: 100% !important;\n    height: 100% !important;\n    min-height: 0 !important;\n  }\n\n  .mobile-inspector-sheet[data-mobile-open="true"] .inspector-dark {\n    padding-right: 0 !important;\n  }\n\n  .mobile-inspector-sheet[data-mobile-open="true"] .inspector-dark > div:last-child {\n    display: none !important;\n  }\n\n  .mobile-inspector-sheet[data-mobile-open="true"] .inspector-dark > div[class*="overflow-y-auto"] {\n    display: block !important;\n    flex: 1 1 auto !important;\n    min-height: 0 !important;\n    overflow-y: auto !important;\n    -webkit-overflow-scrolling: touch;\n  }\n}\n`;
  write(cssFile, css, cssData.newline);
}

console.log('Removed the duplicate mobile rail click interceptor.');
console.log('Mobile inspector panels now use App.tsx state only.');
console.log('Locked open inspector sheets to the visible mobile viewport.');
