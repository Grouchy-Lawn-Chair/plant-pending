import fs from 'node:fs';

const guardFile = 'src/MobileFlyoutGuard.tsx';
const cssFile = 'src/index.css';

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

function active(button: HTMLButtonElement) {
  return button.className.includes('border-emerald-400') || button.getAttribute('aria-pressed') === 'true';
}

function toolbarButtons() {
  return [...document.querySelectorAll<HTMLButtonElement>('.mobile-tool-rail button')];
}

export default function MobileFlyoutGuard() {
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    let syncing = false;

    const sync = () => {
      if (!media.matches) {
        document.documentElement.removeAttribute('data-mobile-flyout');
        document.querySelector<HTMLElement>('.mobile-left-sheet')?.removeAttribute('data-mobile-open');
        document.querySelector<HTMLElement>('.mobile-inspector-sheet')?.removeAttribute('data-mobile-open');
        return;
      }

      const buttons = toolbarButtons();
      const activeLeft = buttons.find(button => LEFT_TITLES.has(button.title) && active(button));
      const activeRight = buttons.find(button => RIGHT_TITLES.has(button.title) && active(button));
      const left = document.querySelector<HTMLElement>('.mobile-left-sheet');
      const right = document.querySelector<HTMLElement>('.mobile-inspector-sheet');

      left?.setAttribute('data-mobile-open', activeLeft && left ? 'true' : 'false');
      right?.setAttribute('data-mobile-open', activeRight && right ? 'true' : 'false');
      document.documentElement.setAttribute('data-mobile-flyout', activeRight ? 'right' : activeLeft ? 'left' : 'none');
    };

    const onToolbarClick = (event: MouseEvent) => {
      if (!media.matches || syncing) return;
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('.mobile-tool-rail button');
      if (!button) return;
      const clickedLeft = LEFT_TITLES.has(button.title);
      const clickedRight = RIGHT_TITLES.has(button.title);
      if (!clickedLeft && !clickedRight) return;

      window.setTimeout(() => {
        syncing = true;
        const buttons = toolbarButtons();
        if (clickedLeft) {
          buttons.find(candidate => RIGHT_TITLES.has(candidate.title) && active(candidate))?.click();
        } else {
          buttons.find(candidate => LEFT_TITLES.has(candidate.title) && active(candidate))?.click();
        }
        syncing = false;
        requestAnimationFrame(sync);
        window.setTimeout(sync, 80);
      }, 0);
    };

    const observer = new MutationObserver(() => requestAnimationFrame(sync));
    observer.observe(document.getElementById('root') || document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    });
    document.addEventListener('click', onToolbarClick, true);
    media.addEventListener('change', sync);
    sync();

    return () => {
      observer.disconnect();
      document.removeEventListener('click', onToolbarClick, true);
      media.removeEventListener('change', sync);
      document.documentElement.removeAttribute('data-mobile-flyout');
    };
  }, []);

  return null;
}
`;

const existingGuard = fs.existsSync(guardFile) ? read(guardFile) : { newline: '\n', text: '' };
write(guardFile, guard, existingGuard.newline);

const css = read(cssFile);
let cssText = css.text;
const marker = '/* Force mobile flyouts into the visible viewport */';
if (!cssText.includes(marker)) {
  cssText += `\n\n${marker}\n@media (max-width: 1023px) {\n  .mobile-left-sheet[data-mobile-open="false"],\n  .mobile-inspector-sheet[data-mobile-open="false"] {\n    display: none !important;\n    visibility: hidden !important;\n    pointer-events: none !important;\n  }\n\n  .mobile-left-sheet[data-mobile-open="true"],\n  .mobile-inspector-sheet[data-mobile-open="true"] {\n    display: flex !important;\n    visibility: visible !important;\n    pointer-events: auto !important;\n    position: fixed !important;\n    z-index: 120 !important;\n    inset: auto 0 calc(4.25rem + env(safe-area-inset-bottom)) 0 !important;\n    width: 100dvw !important;\n    max-width: 100dvw !important;\n    height: min(66dvh, 38rem) !important;\n    max-height: min(66dvh, 38rem) !important;\n    min-height: 16rem !important;\n    margin: 0 !important;\n    transform: none !important;\n    overflow: hidden !important;\n    border: 0 !important;\n    border-top: 1px solid #334155 !important;\n    border-radius: 1rem 1rem 0 0 !important;\n    background: #0f1720 !important;\n    box-shadow: 0 -18px 42px rgba(0,0,0,.55) !important;\n  }\n\n  .mobile-inspector-sheet[data-mobile-open="true"] > *,\n  .mobile-inspector-sheet[data-mobile-open="true"] .inspector-dark {\n    width: 100% !important;\n    height: 100% !important;\n    min-width: 0 !important;\n    min-height: 0 !important;\n  }\n\n  .mobile-inspector-sheet[data-mobile-open="true"] .inspector-dark {\n    padding-right: 0 !important;\n  }\n\n  .mobile-inspector-sheet[data-mobile-open="true"] .inspector-dark > .absolute.inset-y-0.right-0 {\n    display: none !important;\n  }\n\n  .mobile-inspector-sheet[data-mobile-open="true"] .inspector-dark > .flex-1,\n  .mobile-left-sheet[data-mobile-open="true"] > * {\n    min-height: 0 !important;\n    overflow-y: auto !important;\n    overscroll-behavior: contain;\n    -webkit-overflow-scrolling: touch;\n  }\n\n  .mobile-tool-rail { z-index: 140 !important; }\n}\n\n@media (min-width: 640px) and (max-width: 1023px) {\n  .mobile-left-sheet[data-mobile-open="true"],\n  .mobile-inspector-sheet[data-mobile-open="true"] {\n    left: 50% !important;\n    right: auto !important;\n    bottom: calc(5rem + env(safe-area-inset-bottom)) !important;\n    width: min(36rem, calc(100dvw - 2rem)) !important;\n    max-width: calc(100dvw - 2rem) !important;\n    transform: translateX(-50%) !important;\n    border: 1px solid #334155 !important;\n    border-radius: 1rem !important;\n  }\n}\n`;
}

write(cssFile, cssText, css.newline);
console.log('Forced mobile flyout panels into the visible viewport using explicit open-state attributes.');
