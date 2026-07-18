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

export default function MobileFlyoutGuard() {
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    let frame = 0;

    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const left = document.querySelector<HTMLElement>('.mobile-left-sheet');
        const right = document.querySelector<HTMLElement>('.mobile-inspector-sheet');

        if (!media.matches) {
          left?.removeAttribute('data-mobile-open');
          right?.removeAttribute('data-mobile-open');
          return;
        }

        const buttons = [...document.querySelectorAll<HTMLButtonElement>('.mobile-tool-rail button')];
        const leftOpen = buttons.some(button => LEFT_TITLES.has(button.title) && active(button));
        const rightOpen = buttons.some(button => RIGHT_TITLES.has(button.title) && active(button));

        left?.setAttribute('data-mobile-open', leftOpen ? 'true' : 'false');
        right?.setAttribute('data-mobile-open', rightOpen ? 'true' : 'false');
      });
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.getElementById('root') || document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    });
    document.addEventListener('click', sync, true);
    media.addEventListener('change', sync);
    sync();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('click', sync, true);
      media.removeEventListener('change', sync);
    };
  }, []);

  return null;
}
`;

const currentGuard = fs.existsSync(guardFile) ? read(guardFile) : { newline: '\n', text: '' };
write(guardFile, guard, currentGuard.newline);

const css = read(cssFile);
let cssText = css.text;
const marker = '/* Safe in-tree mobile flyout repair */';
if (!cssText.includes(marker)) {
  cssText += `\n\n${marker}\n@media (max-width: 1023px) {\n  .app-shell,\n  .app-workspace,\n  .app-canvas {\n    overflow: visible !important;\n    transform: none !important;\n    contain: none !important;\n  }\n\n  .mobile-left-sheet[data-mobile-open="false"],\n  .mobile-inspector-sheet[data-mobile-open="false"] {\n    display: none !important;\n    visibility: hidden !important;\n    pointer-events: none !important;\n  }\n\n  .mobile-left-sheet[data-mobile-open="true"],\n  .mobile-inspector-sheet[data-mobile-open="true"] {\n    display: flex !important;\n    visibility: visible !important;\n    pointer-events: auto !important;\n    position: fixed !important;\n    z-index: 1000 !important;\n    left: 0 !important;\n    right: 0 !important;\n    top: auto !important;\n    bottom: calc(4.25rem + env(safe-area-inset-bottom)) !important;\n    width: 100vw !important;\n    max-width: 100vw !important;\n    height: min(66dvh, 38rem) !important;\n    max-height: min(66dvh, 38rem) !important;\n    min-height: 16rem !important;\n    margin: 0 !important;\n    transform: none !important;\n    overflow: hidden !important;\n    border: 0 !important;\n    border-top: 1px solid #334155 !important;\n    border-radius: 1rem 1rem 0 0 !important;\n    background: #0f1720 !important;\n    box-shadow: 0 -18px 42px rgba(0,0,0,.58) !important;\n  }\n\n  .mobile-left-sheet[data-mobile-open="true"] > *,\n  .mobile-inspector-sheet[data-mobile-open="true"] > *,\n  .mobile-inspector-sheet[data-mobile-open="true"] .inspector-dark {\n    width: 100% !important;\n    min-width: 0 !important;\n    min-height: 0 !important;\n  }\n\n  .mobile-left-sheet[data-mobile-open="true"] > *,\n  .mobile-inspector-sheet[data-mobile-open="true"] .inspector-dark > .flex-1 {\n    overflow-y: auto !important;\n    overscroll-behavior: contain;\n    -webkit-overflow-scrolling: touch;\n  }\n\n  .canvas-control-bar::before,\n  .canvas-control-bar::after,\n  .canvas-setup-toolbar::before,\n  .canvas-setup-toolbar::after {\n    content: none !important;\n    display: none !important;\n  }\n}\n`;
}

write(cssFile, cssText, css.newline);
console.log('Removed the crashing DOM portal and restored safe in-tree mobile flyouts.');
console.log('Panels are fixed to the visible viewport without moving React-owned nodes.');
