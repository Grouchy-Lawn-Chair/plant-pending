import fs from 'node:fs';

const componentFile = 'src/MobileContentRefinements.tsx';
const mainFile = 'src/main.tsx';
const cssFile = 'src/index.css';

function read(path) {
  const raw = fs.readFileSync(path, 'utf8');
  return { newline: raw.includes('\r\n') ? '\r\n' : '\n', text: raw.replace(/\r\n/g, '\n') };
}

function write(path, text, newline = '\n') {
  fs.writeFileSync(path, newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
}

const component = `import { useEffect } from 'react';

const MOBILE_QUERY = '(max-width: 767px)';

function visible(node: HTMLElement) {
  const style = getComputedStyle(node);
  const rect = node.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
}

function markWelcome() {
  const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"], .fixed, .absolute')];
  const dialog = dialogs.find(node => {
    const text = (node.textContent || '').toLowerCase();
    return text.includes('welcome to plant pending') && text.includes('close');
  });
  if (!dialog) return;
  dialog.classList.add('mobile-welcome-dialog');

  const textNodes = [...dialog.querySelectorAll<HTMLElement>('p,span,div')];
  for (const node of textNodes) {
    const text = (node.textContent || '').trim().toLowerCase();
    if (text === 'version 2.0 yard panic reducer') node.classList.add('mobile-remove-version-kicker');
  }

  const images = [...dialog.querySelectorAll<HTMLImageElement>('img')];
  const logo = images.find(image => /logo|plant pending/i.test(image.alt || image.src));
  logo?.classList.add('mobile-welcome-logo');
}

function markPlantCards() {
  const sheet = document.querySelector<HTMLElement>('.mobile-left-sheet[data-mobile-open="true"]');
  if (!sheet) return;
  const cards = [...sheet.querySelectorAll<HTMLElement>('article,li,button,div')]
    .filter(node => {
      const text = (node.textContent || '').trim();
      const image = node.querySelector('img');
      return image && text.length > 4 && text.length < 300 && /more details|\$|water|sun|shrubs|trees|perennials/i.test(text);
    });
  for (const card of cards) {
    if (card.parentElement && cards.includes(card.parentElement as HTMLElement)) continue;
    card.classList.add('mobile-plant-card');
  }
}

function closePlantSheetAfterSelection(event: Event) {
  if (!matchMedia(MOBILE_QUERY).matches) return;
  const target = event.target as Element | null;
  const card = target?.closest<HTMLElement>('.mobile-plant-card');
  if (!card) return;
  if (target?.closest('a,button')?.textContent?.toLowerCase().includes('more details')) return;

  window.setTimeout(() => {
    const plantButton = [...document.querySelectorAll<HTMLButtonElement>('.mobile-tool-rail button')]
      .find(button => /plant library/i.test(button.title || button.getAttribute('aria-label') || ''));
    const sheet = document.querySelector<HTMLElement>('.mobile-left-sheet');
    if (sheet?.getAttribute('data-mobile-open') === 'true') plantButton?.click();
  }, 60);
}

export default function MobileContentRefinements() {
  useEffect(() => {
    const media = matchMedia(MOBILE_QUERY);
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!media.matches) return;
        markWelcome();
        markPlantCards();
      });
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.getElementById('root') || document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] });
    document.addEventListener('click', closePlantSheetAfterSelection, true);
    media.addEventListener('change', sync);
    sync();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('click', closePlantSheetAfterSelection, true);
      media.removeEventListener('change', sync);
    };
  }, []);

  return null;
}
`;

write(componentFile, component);

const main = read(mainFile);
let mainText = main.text;
if (!mainText.includes("./MobileContentRefinements")) {
  const importAnchor = [...mainText.matchAll(/^import .*;$/gm)].pop();
  if (!importAnchor) throw new Error('Could not locate imports in src/main.tsx. No files written.');
  const at = importAnchor.index + importAnchor[0].length;
  mainText = mainText.slice(0, at) + "\nimport MobileContentRefinements from './MobileContentRefinements';" + mainText.slice(at);
}
if (!mainText.includes('<MobileContentRefinements />')) {
  const polish = mainText.match(/^(\s*)<MobileViewportFixes\s*\/>\s*$/m) || mainText.match(/^(\s*)<MobileUiPolish\s*\/>\s*$/m);
  if (polish) mainText = mainText.replace(polish[0], `${polish[0]}\n${polish[1]}<MobileContentRefinements />`);
  else if (mainText.includes('</React.StrictMode>')) mainText = mainText.replace('</React.StrictMode>', '    <MobileContentRefinements />\n  </React.StrictMode>');
  else if (mainText.includes('</StrictMode>')) mainText = mainText.replace('</StrictMode>', '    <MobileContentRefinements />\n  </StrictMode>');
  else throw new Error('Could not locate a safe mount point in src/main.tsx. No files written.');
}
write(mainFile, mainText, main.newline);

const css = read(cssFile);
let cssText = css.text;
const marker = '/* Mobile plant-card and welcome-dialog refinement */';
if (!cssText.includes(marker)) {
  cssText += `\n\n${marker}\n@media (max-width: 767px) {\n  .mobile-welcome-dialog {\n    width: calc(100vw - 1rem) !important;\n    max-width: 26rem !important;\n    max-height: calc(100dvh - 1rem) !important;\n    padding: 1rem !important;\n    overflow-y: auto !important;\n  }\n\n  .mobile-welcome-dialog .mobile-remove-version-kicker {\n    display: none !important;\n  }\n\n  .mobile-welcome-dialog > div,\n  .mobile-welcome-dialog section {\n    grid-template-columns: 1fr !important;\n    flex-direction: column !important;\n    align-items: center !important;\n    gap: .75rem !important;\n  }\n\n  .mobile-welcome-dialog .mobile-welcome-logo {\n    width: min(11rem, 48vw) !important;\n    height: auto !important;\n    margin: 0 auto !important;\n  }\n\n  .mobile-welcome-dialog h1,\n  .mobile-welcome-dialog h2,\n  .mobile-welcome-dialog p {\n    text-align: center !important;\n    max-width: 22rem !important;\n    margin-left: auto !important;\n    margin-right: auto !important;\n  }\n\n  .mobile-left-sheet[data-mobile-open="true"] .mobile-plant-card {\n    display: grid !important;\n    grid-template-columns: 7rem minmax(0, 1fr) !important;\n    grid-template-rows: auto 1fr auto !important;\n    gap: .5rem .75rem !important;\n    width: calc(100% - 1rem) !important;\n    margin: .5rem !important;\n    padding: .65rem !important;\n    border-radius: 1rem !important;\n    min-height: 8.5rem !important;\n    overflow: hidden !important;\n  }\n\n  .mobile-left-sheet[data-mobile-open="true"] .mobile-plant-card img {\n    grid-column: 1 !important;\n    grid-row: 1 / span 3 !important;\n    width: 7rem !important;\n    height: 7rem !important;\n    object-fit: cover !important;\n    border-radius: .8rem !important;\n    margin: 0 !important;\n  }\n\n  .mobile-left-sheet[data-mobile-open="true"] .mobile-plant-card h1,\n  .mobile-left-sheet[data-mobile-open="true"] .mobile-plant-card h2,\n  .mobile-left-sheet[data-mobile-open="true"] .mobile-plant-card h3,\n  .mobile-left-sheet[data-mobile-open="true"] .mobile-plant-card h4 {\n    font-size: 1rem !important;\n    line-height: 1.2 !important;\n    margin: 0 !important;\n  }\n\n  .mobile-left-sheet[data-mobile-open="true"] .mobile-plant-card button,\n  .mobile-left-sheet[data-mobile-open="true"] .mobile-plant-card a {\n    min-height: 2.25rem !important;\n  }\n}\n`;
}
write(cssFile, cssText, css.newline);

console.log('Mobile plant cards are compact, plant selection closes the library, and the welcome dialog now uses the mobile screen efficiently.');
