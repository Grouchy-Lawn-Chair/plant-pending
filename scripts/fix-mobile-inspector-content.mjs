import fs from 'node:fs';

const cssFile = 'src/index.css';

const raw = fs.readFileSync(cssFile, 'utf8');
const newline = raw.includes('\r\n') ? '\r\n' : '\n';
let css = raw.replace(/\r\n/g, '\n');

const marker = '/* Mobile inspector content visibility repair */';
if (!css.includes(marker)) {
  css += `\n\n${marker}\n@media (max-width: 1023px) {\n  .mobile-inspector-sheet[data-mobile-open="true"] {\n    isolation: isolate !important;\n    color: #e2e8f0 !important;\n  }\n\n  .mobile-inspector-sheet[data-mobile-open="true"] .inspector-dark {\n    display: flex !important;\n    flex-direction: column !important;\n    position: relative !important;\n    inset: auto !important;\n    width: 100% !important;\n    max-width: 100% !important;\n    height: 100% !important;\n    max-height: 100% !important;\n    min-width: 0 !important;\n    min-height: 0 !important;\n    margin: 0 !important;\n    padding: 0 !important;\n    transform: none !important;\n    translate: none !important;\n    opacity: 1 !important;\n    visibility: visible !important;\n    overflow: hidden !important;\n    background: #0f1720 !important;\n  }\n\n  .mobile-inspector-sheet[data-mobile-open="true"] .inspector-dark > .absolute.inset-y-0.right-0,\n  .mobile-inspector-sheet[data-mobile-open="true"] .inspector-dark > [class*="absolute"][class*="right-0"] {\n    display: none !important;\n  }\n\n  .mobile-inspector-sheet[data-mobile-open="true"] .inspector-dark > .flex-1,\n  .mobile-inspector-sheet[data-mobile-open="true"] .inspector-dark > [class*="flex-1"] {\n    display: block !important;\n    position: relative !important;\n    inset: auto !important;\n    flex: 1 1 auto !important;\n    width: 100% !important;\n    max-width: 100% !important;\n    height: auto !important;\n    min-width: 0 !important;\n    min-height: 0 !important;\n    margin: 0 !important;\n    padding: 0 !important;\n    transform: none !important;\n    translate: none !important;\n    opacity: 1 !important;\n    visibility: visible !important;\n    overflow-x: hidden !important;\n    overflow-y: auto !important;\n    overscroll-behavior: contain;\n    -webkit-overflow-scrolling: touch;\n  }\n\n  .mobile-inspector-sheet[data-mobile-open="true"] .inspector-dark > .flex-1 > *,\n  .mobile-inspector-sheet[data-mobile-open="true"] .inspector-dark > [class*="flex-1"] > * {\n    position: relative !important;\n    left: auto !important;\n    right: auto !important;\n    top: auto !important;\n    width: 100% !important;\n    max-width: 100% !important;\n    min-width: 0 !important;\n    margin-left: 0 !important;\n    margin-right: 0 !important;\n    transform: none !important;\n    translate: none !important;\n    opacity: 1 !important;\n    visibility: visible !important;\n  }\n}\n`;
}

fs.writeFileSync(cssFile, newline === '\r\n' ? css.replace(/\n/g, '\r\n') : css);
console.log('Forced Yard Setup, Areas, and Debug inspector content into the visible mobile bottom sheet.');
console.log('The left Plant Library and Filters sheets are unchanged.');
