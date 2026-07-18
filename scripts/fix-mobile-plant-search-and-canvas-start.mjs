import fs from 'node:fs';

const componentFile = 'src/MobileViewportFixes.tsx';
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

const MOBILE_QUERY = '(max-width: 1023px)';

function visible(node: HTMLElement) {
  const style = window.getComputedStyle(node);
  const rect = node.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
}

function labelPlantSearch() {
  const sheet = document.querySelector<HTMLElement>('.mobile-left-sheet');
  if (!sheet) return;

  const inputs = [...sheet.querySelectorAll<HTMLInputElement>('input')];
  const search = inputs.find(input => {
    const text = [input.type, input.placeholder, input.getAttribute('aria-label') || ''].join(' ').toLowerCase();
    return /search|find plant|plant name/.test(text);
  });
  if (!search) return;

  search.classList.add('mobile-plant-search-input');
  let wrapper: HTMLElement | null = search.parentElement;
  while (wrapper && wrapper !== sheet) {
    const rect = wrapper.getBoundingClientRect();
    if (rect.width >= search.getBoundingClientRect().width && rect.height <= 140) break;
    wrapper = wrapper.parentElement;
  }
  (wrapper || search.parentElement)?.classList.add('mobile-plant-search-wrap');
}

function findCanvasScroller() {
  const root = document.querySelector<HTMLElement>('.app-canvas') || document.querySelector<HTMLElement>('[data-canvas-root]');
  if (!root) return null;
  const candidates = [root, ...root.querySelectorAll<HTMLElement>('div')];
  return candidates
    .filter(node => node.scrollWidth > node.clientWidth + 8 || node.scrollHeight > node.clientHeight + 8)
    .sort((a, b) => (b.scrollWidth - b.clientWidth + b.scrollHeight - b.clientHeight) - (a.scrollWidth - a.clientWidth + a.scrollHeight - a.clientHeight))[0] || root;
}

function findFitButton() {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('button')];
  return buttons.find(button => {
    if (!visible(button)) return false;
    const text = [button.textContent || '', button.title, button.getAttribute('aria-label') || ''].join(' ').trim().toLowerCase();
    return text === 'fit' || /fit (canvas|yard|view|screen)/.test(text);
  }) || null;
}

function markWelcomeCard() {
  const canvas = document.querySelector<HTMLElement>('.app-canvas') || document.querySelector<HTMLElement>('[data-canvas-root]');
  if (!canvas) return;
  const candidates = [...canvas.querySelectorAll<HTMLElement>('div,section,article')];
  const card = candidates
    .filter(node => /upload background/i.test(node.textContent || '') && /plant|area|yard|start/i.test(node.textContent || ''))
    .sort((a, b) => (a.textContent?.length || 0) - (b.textContent?.length || 0))[0];
  card?.classList.add('mobile-canvas-welcome-card');
}

function centerCanvas() {
  const scroller = findCanvasScroller();
  if (!scroller) return;
  scroller.scrollLeft = Math.max(0, (scroller.scrollWidth - scroller.clientWidth) / 2);
  scroller.scrollTop = Math.max(0, (scroller.scrollHeight - scroller.clientHeight) / 2);
}

export default function MobileViewportFixes() {
  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    let frame = 0;
    let initialFitDone = false;

    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!media.matches) return;
        labelPlantSearch();
        markWelcomeCard();

        if (!initialFitDone) {
          initialFitDone = true;
          window.setTimeout(() => {
            const fit = findFitButton();
            fit?.click();
            window.setTimeout(centerCanvas, 80);
          }, 180);
        }
      });
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.getElementById('root') || document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    media.addEventListener('change', sync);
    window.addEventListener('resize', sync);
    sync();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
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
if (!mainText.includes("./MobileViewportFixes")) {
  const importAnchor = [...mainText.matchAll(/^import .*;$/gm)].pop();
  if (!importAnchor) throw new Error('Could not locate imports in src/main.tsx. No files written.');
  const at = importAnchor.index + importAnchor[0].length;
  mainText = mainText.slice(0, at) + "\nimport MobileViewportFixes from './MobileViewportFixes';" + mainText.slice(at);
}
if (!mainText.includes('<MobileViewportFixes />')) {
  const app = mainText.match(/<App\s*\/>/);
  if (!app) throw new Error('Could not locate App mount in src/main.tsx. No files written.');
  mainText = mainText.replace(app[0], '<MobileViewportFixes />\n    ' + app[0]);
}
write(mainFile, mainText, main.newline);

const css = read(cssFile);
let cssText = css.text;
const marker = '/* Mobile plant search and initial canvas framing */';
if (!cssText.includes(marker)) {
  cssText += `\n\n${marker}\n@media (max-width: 1023px) {\n  .mobile-left-sheet[data-mobile-open="true"] {\n    display: flex !important;\n    flex-direction: column !important;\n  }\n\n  .mobile-left-sheet[data-mobile-open="true"] .mobile-plant-search-wrap {\n    display: block !important;\n    position: sticky !important;\n    top: 0 !important;\n    z-index: 30 !important;\n    width: 100% !important;\n    padding: .75rem 1rem !important;\n    margin: 0 !important;\n    background: #0f1720 !important;\n    border-bottom: 1px solid #263652 !important;\n  }\n\n  .mobile-left-sheet[data-mobile-open="true"] .mobile-plant-search-input {\n    display: block !important;\n    visibility: visible !important;\n    opacity: 1 !important;\n    position: relative !important;\n    inset: auto !important;\n    width: 100% !important;\n    min-height: 2.75rem !important;\n    margin: 0 !important;\n    transform: none !important;\n  }\n\n  .mobile-canvas-welcome-card {\n    position: absolute !important;\n    left: 50% !important;\n    top: 50% !important;\n    width: min(20rem, calc(100vw - 2rem)) !important;\n    max-width: calc(100vw - 2rem) !important;\n    max-height: calc(100dvh - 15rem) !important;\n    overflow: auto !important;\n    transform: translate(-50%, -50%) !important;\n    margin: 0 !important;\n    padding: 1rem !important;\n    text-align: center !important;\n    white-space: normal !important;\n    box-sizing: border-box !important;\n  }\n\n  .mobile-canvas-welcome-card * {\n    max-width: 100% !important;\n    white-space: normal !important;\n  }\n}\n`;
}
write(cssFile, cssText, css.newline);

console.log('Mobile plant search is pinned and visible, and the initial canvas view now fits and centers the welcome card.');
