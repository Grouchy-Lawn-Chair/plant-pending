import fs from 'node:fs';

const componentFile = 'src/MobileRefinementRepair.tsx';
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

function labelOf(button: HTMLButtonElement) {
  return (button.title || button.getAttribute('aria-label') || button.textContent || '').trim();
}

function visible(node: HTMLElement) {
  const style = getComputedStyle(node);
  const rect = node.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
}

function findWelcomeDialog() {
  const candidates = [...document.querySelectorAll<HTMLElement>('[role="dialog"], [aria-modal="true"], .fixed, .absolute')]
    .filter(node => {
      const text = (node.textContent || '').toLowerCase();
      return text.includes('welcome to plant pending') && text.includes('close');
    });
  return candidates.sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0] || null;
}

function refineWelcome() {
  const dialog = findWelcomeDialog();
  if (!dialog) return;
  dialog.classList.add('mobile-welcome-repaired');

  for (const node of [...dialog.querySelectorAll<HTMLElement>('p,span,div')]) {
    const ownText = [...node.childNodes]
      .filter(child => child.nodeType === Node.TEXT_NODE)
      .map(child => child.textContent || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    if (ownText.includes('version 2.0') || ownText.includes('yard panic reducer')) {
      node.classList.add('mobile-hide-version-kicker');
    }
  }

  const logo = [...dialog.querySelectorAll<HTMLImageElement>('img')]
    .find(image => /plant pending|logo/i.test((image.alt || '') + ' ' + image.src));
  if (logo) {
    logo.classList.add('mobile-welcome-logo-repaired');
    logo.parentElement?.classList.add('mobile-welcome-logo-wrap');
  }

  const contentContainers = [...dialog.querySelectorAll<HTMLElement>('div,section')]
    .filter(node => {
      const text = (node.textContent || '').toLowerCase();
      return text.includes('welcome to plant pending') && node.querySelector('img');
    })
    .sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length);
  contentContainers[0]?.classList.add('mobile-welcome-content-repaired');
}

function plantSheet() {
  return document.querySelector<HTMLElement>('.mobile-left-sheet[data-mobile-open="true"]');
}

function markPlantCards() {
  const sheet = plantSheet();
  if (!sheet) return;
  for (const image of [...sheet.querySelectorAll<HTMLImageElement>('img')]) {
    let node: HTMLElement | null = image.parentElement;
    let best: HTMLElement | null = null;
    while (node && node !== sheet) {
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (/more details/i.test(text) && text.length < 500) best = node;
      node = node.parentElement;
    }
    best?.classList.add('mobile-plant-card-repaired');
  }
}

function closePlantLibrary() {
  const button = [...document.querySelectorAll<HTMLButtonElement>('.mobile-tool-rail button')]
    .find(item => /plant library/i.test(labelOf(item)));
  const sheet = document.querySelector<HTMLElement>('.mobile-left-sheet');
  if (sheet?.getAttribute('data-mobile-open') === 'true') button?.click();
}

function onPlantSelection(event: Event) {
  if (!matchMedia(MOBILE_QUERY).matches) return;
  const target = event.target as Element | null;
  const card = target?.closest<HTMLElement>('.mobile-plant-card-repaired');
  if (!card) return;
  const action = target?.closest<HTMLElement>('button,a');
  if (action && /more details|details|filter|sort/i.test(action.textContent || labelOf(action as HTMLButtonElement))) return;
  window.setTimeout(closePlantLibrary, 100);
}

const ICON_MAP = [
  { mobile: /yard setup/i, desktop: /yard setup|canvas setup/i },
  { mobile: /^areas$/i, desktop: /^areas$|zones/i },
  { mobile: /plant list/i, desktop: /plant list|planting groups|legend/i },
  { mobile: /debug/i, desktop: /developer tools|debug/i },
];

function syncRailIcons() {
  const toolbar = [...document.querySelectorAll<HTMLButtonElement>('.mobile-tool-rail button')];
  const inspector = document.querySelector<HTMLElement>('.mobile-inspector-sheet');
  if (!inspector) return;
  const sources = [...inspector.querySelectorAll<HTMLButtonElement>('button')]
    .filter(button => !button.closest('.mobile-tool-rail') && labelOf(button));

  for (const map of ICON_MAP) {
    const target = toolbar.find(button => map.mobile.test(labelOf(button)));
    const source = sources.find(button => map.desktop.test(labelOf(button)) && button.querySelector('svg'));
    if (!target || !source) continue;
    const sourceSvg = source.querySelector('svg');
    if (!sourceSvg) continue;
    const targetSvg = target.querySelector('svg');
    const clone = sourceSvg.cloneNode(true);
    if (targetSvg) targetSvg.replaceWith(clone);
    else target.prepend(clone);
    target.dataset.desktopIconSynced = 'true';
  }
}

export default function MobileRefinementRepair() {
  useEffect(() => {
    const media = matchMedia(MOBILE_QUERY);
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!media.matches) return;
        refineWelcome();
        markPlantCards();
        syncRailIcons();
      });
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.getElementById('root') || document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'aria-hidden'],
    });
    document.addEventListener('click', onPlantSelection, true);
    media.addEventListener('change', sync);
    window.addEventListener('resize', sync);
    sync();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('click', onPlantSelection, true);
      media.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);
  return null;
}
`;

write(componentFile, component);

const main = read(mainFile);
let mainText = main.text;
if (!mainText.includes("./MobileRefinementRepair")) {
  const importAnchor = [...mainText.matchAll(/^import .*;$/gm)].pop();
  if (!importAnchor) throw new Error('Could not locate imports in src/main.tsx. No files written.');
  const at = importAnchor.index + importAnchor[0].length;
  mainText = mainText.slice(0, at) + "\nimport MobileRefinementRepair from './MobileRefinementRepair';" + mainText.slice(at);
}
if (!mainText.includes('<MobileRefinementRepair />')) {
  const anchor = mainText.match(/^(\s*)<MobileContentRefinements\s*\/>\s*$/m)
    || mainText.match(/^(\s*)<MobileViewportFixes\s*\/>\s*$/m)
    || mainText.match(/^(\s*)<MobileUiPolish\s*\/>\s*$/m);
  if (anchor) mainText = mainText.replace(anchor[0], `${anchor[0]}\n${anchor[1]}<MobileRefinementRepair />`);
  else if (mainText.includes('</React.StrictMode>')) mainText = mainText.replace('</React.StrictMode>', '    <MobileRefinementRepair />\n  </React.StrictMode>');
  else if (mainText.includes('</StrictMode>')) mainText = mainText.replace('</StrictMode>', '    <MobileRefinementRepair />\n  </StrictMode>');
  else throw new Error('Could not locate a safe mount point in src/main.tsx. No files written.');
}
write(mainFile, mainText, main.newline);

const css = read(cssFile);
let cssText = css.text;
const marker = '/* Robust mobile welcome, plant-card, and icon repair */';
if (!cssText.includes(marker)) {
  cssText += `\n\n${marker}\n@media (max-width: 767px) {\n  .mobile-welcome-repaired {\n    width: calc(100vw - 1rem) !important;\n    max-width: 25rem !important;\n    max-height: calc(100dvh - 1rem) !important;\n    padding: 1rem !important;\n    overflow-y: auto !important;\n  }\n\n  .mobile-welcome-repaired .mobile-hide-version-kicker {\n    display: none !important;\n  }\n\n  .mobile-welcome-repaired .mobile-welcome-content-repaired {\n    display: flex !important;\n    flex-direction: column !important;\n    align-items: center !important;\n    justify-content: flex-start !important;\n    grid-template-columns: 1fr !important;\n    gap: .75rem !important;\n    width: 100% !important;\n  }\n\n  .mobile-welcome-repaired .mobile-welcome-logo-wrap {\n    width: 100% !important;\n    display: flex !important;\n    justify-content: center !important;\n    align-items: center !important;\n    min-width: 0 !important;\n    padding: 0 !important;\n    margin: 0 !important;\n  }\n\n  .mobile-welcome-repaired .mobile-welcome-logo-repaired {\n    width: min(9rem, 38vw) !important;\n    max-height: 6.5rem !important;\n    object-fit: contain !important;\n    margin: 0 auto !important;\n  }\n\n  .mobile-welcome-repaired h1,\n  .mobile-welcome-repaired h2,\n  .mobile-welcome-repaired p {\n    max-width: 22rem !important;\n    margin-left: auto !important;\n    margin-right: auto !important;\n    text-align: center !important;\n  }\n\n  .mobile-left-sheet[data-mobile-open="true"] .mobile-plant-card-repaired {\n    display: grid !important;\n    grid-template-columns: 6.5rem minmax(0, 1fr) !important;\n    gap: .5rem .75rem !important;\n    width: calc(100% - 1rem) !important;\n    min-height: 7.75rem !important;\n    margin: .5rem !important;\n    padding: .65rem !important;\n    overflow: hidden !important;\n    border-radius: 1rem !important;\n  }\n\n  .mobile-left-sheet[data-mobile-open="true"] .mobile-plant-card-repaired img {\n    width: 6.5rem !important;\n    height: 6.5rem !important;\n    object-fit: cover !important;\n    border-radius: .75rem !important;\n    margin: 0 !important;\n  }\n}\n`;
}
write(cssFile, cssText, css.newline);

console.log('Applied robust mobile repairs: welcome layout and version text, compact plant cards, auto-close after plant selection, and desktop-matching rail icons.');
