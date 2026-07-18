import fs from 'node:fs';

const componentFile = 'src/MobileUiPolish.tsx';
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
const RIGHT_TOOL_MATCHERS = {
  yard: /yard setup|canvas setup|canvas/i,
  areas: /areas|zones/i,
  plantList: /plant list|planting groups|groups|legend/i,
  debug: /developer tools|debug/i,
};

function titleOf(button: HTMLButtonElement) {
  return (button.title || button.getAttribute('aria-label') || '').trim();
}

function rightRailButtons() {
  return [...document.querySelectorAll<HTMLButtonElement>('.mobile-inspector-sheet button')]
    .filter(button => titleOf(button));
}

function findRightTool(pattern: RegExp) {
  return rightRailButtons().find(button => pattern.test(titleOf(button))) || null;
}

function copyOriginalIcon(target: HTMLButtonElement | null, source: HTMLButtonElement | null) {
  if (!target || !source) return;
  const sourceSvg = source.querySelector('svg');
  if (!sourceSvg) return;
  const targetSvg = target.querySelector('svg');
  const clone = sourceSvg.cloneNode(true);
  if (targetSvg) targetSvg.replaceWith(clone);
  else target.prepend(clone);
}

function toolbarButtons() {
  return [...document.querySelectorAll<HTMLButtonElement>('.mobile-tool-rail button')];
}

function findToolbarButton(pattern: RegExp) {
  return toolbarButtons().find(button => pattern.test(titleOf(button))) || null;
}

function closeOpenSheets(exceptTitle = '') {
  const buttons = toolbarButtons();
  for (const button of buttons) {
    const title = titleOf(button);
    const active = button.className.includes('border-emerald-400') || button.getAttribute('aria-pressed') === 'true';
    if (active && title !== exceptTitle) button.click();
  }
}

function ensurePlantListButton() {
  const rail = document.querySelector<HTMLElement>('.mobile-tool-rail-inner');
  if (!rail || rail.querySelector('[data-mobile-plant-list="true"]')) return;

  const original = findRightTool(RIGHT_TOOL_MATCHERS.plantList);
  if (!original) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.title = 'Plant list';
  button.setAttribute('aria-label', 'Plant list');
  button.dataset.mobilePlantList = 'true';
  button.className = 'mobile-plant-list-launcher';
  const svg = original.querySelector('svg');
  if (svg) button.append(svg.cloneNode(true));
  button.addEventListener('click', () => {
    closeOpenSheets('Plant list');
    original.click();
  });

  const rock = findToolbarButton(/rock tool/i);
  rail.insertBefore(button, rock || null);
}

function syncIcons() {
  copyOriginalIcon(findToolbarButton(/yard setup/i), findRightTool(RIGHT_TOOL_MATCHERS.yard));
  copyOriginalIcon(findToolbarButton(/areas/i), findRightTool(RIGHT_TOOL_MATCHERS.areas));
  copyOriginalIcon(findToolbarButton(/debug/i), findRightTool(RIGHT_TOOL_MATCHERS.debug));
}

function installExclusiveToolbarSwitching() {
  const rail = document.querySelector<HTMLElement>('.mobile-tool-rail');
  if (!rail || rail.dataset.exclusiveSwitching === 'true') return;
  rail.dataset.exclusiveSwitching = 'true';
  rail.addEventListener('click', event => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('button');
    if (!button) return;
    const nextTitle = titleOf(button);
    requestAnimationFrame(() => closeOpenSheets(nextTitle));
  }, true);
}

function findCanvasScroller() {
  const root = document.querySelector<HTMLElement>('.app-canvas') || document.querySelector<HTMLElement>('[data-canvas-root]');
  if (!root) return null;
  const candidates = [root, ...root.querySelectorAll<HTMLElement>('div')];
  return candidates
    .filter(node => node.scrollWidth > node.clientWidth + 8 || node.scrollHeight > node.clientHeight + 8)
    .sort((a, b) => (b.scrollWidth - b.clientWidth + b.scrollHeight - b.clientHeight) - (a.scrollWidth - a.clientWidth + a.scrollHeight - a.clientHeight))[0] || root;
}

function installTouchPan() {
  const scroller = findCanvasScroller();
  if (!scroller || scroller.dataset.touchPanInstalled === 'true') return;
  scroller.dataset.touchPanInstalled = 'true';
  scroller.classList.add('mobile-touch-pan-surface');

  let lastX = 0;
  let lastY = 0;
  let panning = false;

  scroller.addEventListener('touchstart', event => {
    if (event.touches.length !== 1) {
      panning = false;
      return;
    }
    panning = true;
    lastX = event.touches[0].clientX;
    lastY = event.touches[0].clientY;
  }, { passive: true });

  scroller.addEventListener('touchmove', event => {
    if (!panning || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const dx = touch.clientX - lastX;
    const dy = touch.clientY - lastY;
    lastX = touch.clientX;
    lastY = touch.clientY;
    scroller.scrollLeft -= dx;
    scroller.scrollTop -= dy;
    event.preventDefault();
  }, { passive: false });

  const stop = () => { panning = false; };
  scroller.addEventListener('touchend', stop, { passive: true });
  scroller.addEventListener('touchcancel', stop, { passive: true });
}

export default function MobileUiPolish() {
  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!media.matches) return;
        installExclusiveToolbarSwitching();
        syncIcons();
        ensurePlantListButton();
        installTouchPan();
      });
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.getElementById('root') || document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
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
if (!mainText.includes("./MobileUiPolish")) {
  const importAnchor = [...mainText.matchAll(/^import .*;$/gm)].pop();
  if (!importAnchor) throw new Error('Could not locate imports in src/main.tsx. No files written.');
  const at = importAnchor.index + importAnchor[0].length;
  mainText = mainText.slice(0, at) + "\nimport MobileUiPolish from './MobileUiPolish';" + mainText.slice(at);
}
if (!mainText.includes('<MobileUiPolish />')) {
  const rootRender = mainText.match(/(<React\.StrictMode>|<StrictMode>)/);
  if (rootRender) {
    const at = rootRender.index + rootRender[0].length;
    mainText = mainText.slice(0, at) + '\n    <MobileUiPolish />' + mainText.slice(at);
  } else {
    const app = mainText.match(/<App\s*\/>/);
    if (!app) throw new Error('Could not locate App mount in src/main.tsx. No files written.');
    mainText = mainText.replace(app[0], '<>\n    <MobileUiPolish />\n    ' + app[0] + '\n  </>');
  }
}
write(mainFile, mainText, main.newline);

const css = read(cssFile);
let cssText = css.text;
const marker = '/* Mobile control polish: original icons, compact sheets, welcome card, touch pan */';
if (!cssText.includes(marker)) {
  cssText += `\n\n${marker}\n@media (max-width: 1023px) {\n  .mobile-plant-list-launcher {\n    width: 3rem;\n    height: 3rem;\n    flex: 0 0 3rem;\n    display: inline-flex;\n    align-items: center;\n    justify-content: center;\n    border: 1px solid #263652;\n    border-radius: .8rem;\n    background: #101a2b;\n    color: #a9b7ca;\n  }\n\n  .mobile-plant-list-launcher:active {\n    transform: translateY(1px);\n  }\n\n  .mobile-left-sheet[data-mobile-open="true"],\n  .mobile-inspector-sheet[data-mobile-open="true"] {\n    height: auto !important;\n    min-height: 0 !important;\n    max-height: min(66dvh, 38rem) !important;\n  }\n\n  .mobile-inspector-sheet[data-mobile-open="true"] .inspector-dark,\n  .mobile-inspector-sheet[data-mobile-open="true"] .flex-1 {\n    min-height: 0 !important;\n    height: auto !important;\n  }\n\n  .canvas-empty-state,\n  .garden-canvas-empty-state,\n  [data-empty-canvas-state] {\n    position: absolute !important;\n    left: 50% !important;\n    top: 50% !important;\n    width: min(86vw, 22rem) !important;\n    max-width: calc(100vw - 2rem) !important;\n    transform: translate(-50%, -50%) !important;\n    margin: 0 !important;\n    padding: 1rem !important;\n    text-align: center !important;\n    white-space: normal !important;\n  }\n\n  .canvas-empty-state *,\n  .garden-canvas-empty-state *,\n  [data-empty-canvas-state] * {\n    max-width: 100% !important;\n    white-space: normal !important;\n  }\n\n  .mobile-touch-pan-surface {\n    touch-action: none !important;\n    overscroll-behavior: contain !important;\n    -webkit-overflow-scrolling: touch;\n  }\n}\n`;
}
write(cssFile, cssText, css.newline);

console.log('Mobile controls polished: original right-rail icons synced, Plant list added, panels made compact, welcome card centered, and one-finger canvas pan enabled.');
