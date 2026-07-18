import fs from 'node:fs';

const componentFile = 'src/MobileFinalAlignment.tsx';
const mainFile = 'src/main.tsx';

function read(path) {
  const raw = fs.readFileSync(path, 'utf8');
  return { newline: raw.includes('\r\n') ? '\r\n' : '\n', text: raw.replace(/\r\n/g, '\n') };
}

function write(path, text, newline = '\n') {
  fs.writeFileSync(path, newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
}

const component = `import { useEffect } from 'react';

const MOBILE_QUERY = '(max-width: 1023px)';

function labelOf(button: HTMLButtonElement) {
  return (button.title || button.getAttribute('aria-label') || '').trim().toLowerCase();
}

function sourceButtons() {
  return [...document.querySelectorAll<HTMLButtonElement>('.mobile-inspector-sheet button')];
}

function targetButtons() {
  return [...document.querySelectorAll<HTMLButtonElement>('.mobile-tool-rail button')];
}

function findSource(pattern: RegExp) {
  return sourceButtons().find(button => pattern.test(labelOf(button))) || null;
}

function findTarget(pattern: RegExp) {
  return targetButtons().find(button => pattern.test(labelOf(button))) || null;
}

function copyIcon(target: HTMLButtonElement | null, source: HTMLButtonElement | null) {
  if (!target || !source) return;
  const sourceVisual = source.querySelector('svg') || source.querySelector('[data-icon]') || source.firstElementChild;
  if (!sourceVisual) return;
  const current = target.querySelector('svg') || target.querySelector('[data-icon]') || target.firstElementChild;
  const clone = sourceVisual.cloneNode(true);
  if (current && current !== target.querySelector('.mobile-tool-label')) current.replaceWith(clone);
  else target.prepend(clone);
}

function syncRailIcons() {
  copyIcon(findTarget(/yard setup/), findSource(/yard setup|canvas setup|canvas/));
  copyIcon(findTarget(/^areas$/), findSource(/areas|zones/));
  copyIcon(findTarget(/plant list/), findSource(/plant list|planting groups|legend|groups/));
  copyIcon(findTarget(/debug|developer/), findSource(/developer tools|debug/));
}

function canvasScroller() {
  const root = document.querySelector<HTMLElement>('.app-canvas') || document.querySelector<HTMLElement>('[data-canvas-root]');
  if (!root) return null;
  const nodes = [root, ...root.querySelectorAll<HTMLElement>('div')];
  return nodes
    .filter(node => node.scrollWidth > node.clientWidth + 8 || node.scrollHeight > node.clientHeight + 8)
    .sort((a, b) => (b.scrollWidth - b.clientWidth + b.scrollHeight - b.clientHeight) - (a.scrollWidth - a.clientWidth + a.scrollHeight - a.clientHeight))[0] || root;
}

function welcomeCard() {
  return document.querySelector<HTMLElement>('.mobile-canvas-welcome-card, .canvas-empty-state, .garden-canvas-empty-state, [data-empty-canvas-state]');
}

function centerWelcome() {
  const scroller = canvasScroller();
  const card = welcomeCard();
  if (!scroller || !card) return;
  const scrollerRect = scroller.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  scroller.scrollLeft += cardRect.left + cardRect.width / 2 - (scrollerRect.left + scrollerRect.width / 2);
  scroller.scrollTop += cardRect.top + cardRect.height / 2 - (scrollerRect.top + scrollerRect.height / 2);
}

export default function MobileFinalAlignment() {
  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    if (!media.matches) return;

    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        syncRailIcons();
        centerWelcome();
      });
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.getElementById('root') || document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    const timers = [100, 350, 800, 1500].map(delay => window.setTimeout(sync, delay));
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    window.addEventListener('pageshow', sync);
    window.visualViewport?.addEventListener('resize', sync);
    window.visualViewport?.addEventListener('scroll', sync);
    sync();

    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(window.clearTimeout);
      observer.disconnect();
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
      window.removeEventListener('pageshow', sync);
      window.visualViewport?.removeEventListener('resize', sync);
      window.visualViewport?.removeEventListener('scroll', sync);
    };
  }, []);

  return null;
}
`;

write(componentFile, component);

const main = read(mainFile);
let mainText = main.text;
if (!mainText.includes("./MobileFinalAlignment")) {
  const importAnchor = [...mainText.matchAll(/^import .*;$/gm)].pop();
  if (!importAnchor) throw new Error('Could not locate imports in src/main.tsx. No files written.');
  const at = importAnchor.index + importAnchor[0].length;
  mainText = mainText.slice(0, at) + "\nimport MobileFinalAlignment from './MobileFinalAlignment';" + mainText.slice(at);
}
if (!mainText.includes('<MobileFinalAlignment />')) {
  const existing = mainText.match(/^(\s*)<MobileViewportFixes\s*\/>\s*$/m) || mainText.match(/^(\s*)<MobileUiPolish\s*\/>\s*$/m);
  if (existing) {
    mainText = mainText.replace(existing[0], `${existing[0]}\n${existing[1]}<MobileFinalAlignment />`);
  } else if (mainText.includes('</React.StrictMode>')) {
    mainText = mainText.replace('</React.StrictMode>', '    <MobileFinalAlignment />\n  </React.StrictMode>');
  } else if (mainText.includes('</StrictMode>')) {
    mainText = mainText.replace('</StrictMode>', '    <MobileFinalAlignment />\n  </StrictMode>');
  } else {
    throw new Error('Could not locate a safe mount point in src/main.tsx. No files written.');
  }
}
write(mainFile, mainText, main.newline);

console.log('iPhone welcome centering now re-runs after visual viewport changes, and mobile rail icons are copied from the original desktop inspector controls.');
