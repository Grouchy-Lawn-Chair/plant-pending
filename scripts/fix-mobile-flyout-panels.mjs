import fs from 'node:fs';

const mainFile = 'src/main.tsx';
const cssFile = 'src/index.css';
const guardFile = 'src/MobileFlyoutGuard.tsx';

function read(path) {
  const raw = fs.readFileSync(path, 'utf8');
  return { newline: raw.includes('\r\n') ? '\r\n' : '\n', text: raw.replace(/\r\n/g, '\n') };
}

function write(path, text, newline = '\n') {
  fs.writeFileSync(path, newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
}

const guard = `import { useEffect } from 'react';

const LEFT_TITLES = new Set(['Plant library', 'Filters']);
const RIGHT_TITLES = new Set(['Yard setup', 'Areas', 'Debug']);

function isActive(button: HTMLButtonElement) {
  return button.className.includes('border-emerald-400') || button.getAttribute('aria-pressed') === 'true';
}

export default function MobileFlyoutGuard() {
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    let closingOpposite = false;

    const syncStateClasses = () => {
      const left = document.querySelector<HTMLElement>('.mobile-left-sheet');
      const right = document.querySelector<HTMLElement>('.mobile-inspector-sheet');
      document.documentElement.classList.toggle('mobile-left-open', Boolean(media.matches && left));
      document.documentElement.classList.toggle('mobile-right-open', Boolean(media.matches && right && !right.classList.contains('w-12')));
    };

    const onToolbarClick = (event: MouseEvent) => {
      if (!media.matches || closingOpposite) return;
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('.mobile-tool-rail button');
      if (!button) return;
      const title = button.title;
      const clickedLeft = LEFT_TITLES.has(title);
      const clickedRight = RIGHT_TITLES.has(title);
      if (!clickedLeft && !clickedRight) return;

      window.setTimeout(() => {
        closingOpposite = true;
        const buttons = [...document.querySelectorAll<HTMLButtonElement>('.mobile-tool-rail button')];
        if (clickedLeft) {
          buttons.find(candidate => RIGHT_TITLES.has(candidate.title) && isActive(candidate))?.click();
        } else {
          buttons.find(candidate => LEFT_TITLES.has(candidate.title) && isActive(candidate))?.click();
        }
        closingOpposite = false;
        syncStateClasses();
      }, 0);
    };

    const observer = new MutationObserver(syncStateClasses);
    observer.observe(document.getElementById('root') || document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    });
    document.addEventListener('click', onToolbarClick, true);
    media.addEventListener('change', syncStateClasses);
    syncStateClasses();

    return () => {
      observer.disconnect();
      document.removeEventListener('click', onToolbarClick, true);
      media.removeEventListener('change', syncStateClasses);
      document.documentElement.classList.remove('mobile-left-open', 'mobile-right-open');
    };
  }, []);

  return null;
}
`;
write(guardFile, guard);

const main = read(mainFile);
let mainText = main.text;
if (!mainText.includes("import MobileFlyoutGuard from './MobileFlyoutGuard';")) {
  const importAnchor = mainText.match(/^(import[^\n]+;\n)+/m)?.[0];
  if (!importAnchor) throw new Error('Could not find main.tsx import block. No files written.');
  mainText = mainText.replace(importAnchor, `${importAnchor}import MobileFlyoutGuard from './MobileFlyoutGuard';\n`);
}
if (!mainText.includes('<MobileFlyoutGuard />')) {
  const diagnosticsAnchor = '    <MobileUiDiagnostics />';
  if (mainText.includes(diagnosticsAnchor)) {
    mainText = mainText.replace(diagnosticsAnchor, `${diagnosticsAnchor}\n    <MobileFlyoutGuard />`);
  } else {
    const appAnchor = '    <App />';
    if (!mainText.includes(appAnchor)) throw new Error('Could not find App mount in main.tsx. No files written.');
    mainText = mainText.replace(appAnchor, `${appAnchor}\n    <MobileFlyoutGuard />`);
  }
}

const css = read(cssFile);
let cssText = css.text;
const marker = '/* Definitive mobile flyout panel repair */';
if (!cssText.includes(marker)) {
  cssText += `\n\n${marker}\n@media (max-width: 1023px) {\n  .mobile-inspector-sheet.w-12 {\n    display: none !important;\n  }\n\n  .mobile-inspector-sheet:not(.w-12) {\n    display: block !important;\n    position: fixed !important;\n    z-index: 90 !important;\n    left: 0 !important;\n    right: 0 !important;\n    top: auto !important;\n    bottom: calc(4.25rem + env(safe-area-inset-bottom)) !important;\n    width: 100vw !important;\n    max-width: 100vw !important;\n    height: min(62dvh, 36rem) !important;\n    max-height: min(62dvh, 36rem) !important;\n    min-height: 16rem !important;\n    overflow: hidden !important;\n    transform: none !important;\n    border: 0 !important;\n    border-top: 1px solid #334155 !important;\n    border-radius: 1rem 1rem 0 0 !important;\n    background: #0f1720 !important;\n    box-shadow: 0 -18px 42px rgba(0,0,0,.48) !important;\n  }\n\n  .mobile-inspector-sheet:not(.w-12) > *,\n  .mobile-inspector-sheet:not(.w-12) .inspector-dark {\n    width: 100% !important;\n    height: 100% !important;\n    min-width: 0 !important;\n    min-height: 0 !important;\n  }\n\n  .mobile-inspector-sheet:not(.w-12) .inspector-dark {\n    padding-right: 0 !important;\n  }\n\n  .mobile-inspector-sheet:not(.w-12) .inspector-dark > .absolute.inset-y-0.right-0 {\n    display: none !important;\n  }\n\n  .mobile-inspector-sheet:not(.w-12) .inspector-dark > .flex-1 {\n    overflow-y: auto !important;\n    overscroll-behavior: contain;\n    -webkit-overflow-scrolling: touch;\n  }\n\n  .mobile-left-sheet {\n    display: flex !important;\n    position: fixed !important;\n    z-index: 88 !important;\n    left: 0 !important;\n    right: 0 !important;\n    top: auto !important;\n    bottom: calc(4.25rem + env(safe-area-inset-bottom)) !important;\n    width: 100vw !important;\n    max-width: 100vw !important;\n    height: min(62dvh, 36rem) !important;\n    max-height: min(62dvh, 36rem) !important;\n    min-height: 16rem !important;\n    overflow: hidden !important;\n    border: 0 !important;\n    border-top: 1px solid #334155 !important;\n    border-radius: 1rem 1rem 0 0 !important;\n    box-shadow: 0 -18px 42px rgba(0,0,0,.48) !important;\n  }\n\n  .mobile-left-sheet > * {\n    min-width: 0 !important;\n    min-height: 0 !important;\n  }\n\n  .mobile-tool-rail {\n    z-index: 100 !important;\n  }\n\n  .mobile-tool-rail-inner {\n    justify-content: center !important;\n  }\n\n  html.mobile-left-open .mobile-inspector-sheet,\n  html.mobile-right-open .mobile-left-sheet {\n    pointer-events: none;\n  }\n}\n\n@media (min-width: 640px) and (max-width: 1023px) {\n  .mobile-left-sheet,\n  .mobile-inspector-sheet:not(.w-12) {\n    left: 50% !important;\n    right: auto !important;\n    bottom: calc(5rem + env(safe-area-inset-bottom)) !important;\n    width: min(34rem, calc(100vw - 2rem)) !important;\n    max-width: calc(100vw - 2rem) !important;\n    transform: translateX(-50%) !important;\n    border: 1px solid #334155 !important;\n    border-radius: 1rem !important;\n  }\n}\n`;
}

write(mainFile, mainText, main.newline);
write(cssFile, cssText, css.newline);
console.log('Fixed mobile flyout panels: one sheet at a time, always above the bottom toolbar, and Debug remains reachable at phone width.');
