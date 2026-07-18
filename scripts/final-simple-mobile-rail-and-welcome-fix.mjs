import fs from 'node:fs';

const appPath = 'src/App.tsx';
const polishPath = 'src/MobileUiPolish.tsx';
const cssPath = 'src/index.css';

function read(path) {
  return fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
}

function write(path, text) {
  fs.writeFileSync(path, text.replace(/\n/g, '\r\n'));
}

// Remove only the welcome kicker text. Do not touch the rest of the modal.
let app = read(appPath);
app = app
  .replace(/VERSION\s*2\.0/gi, '')
  .replace(/YARD\s*PANIC\s*REDUCER/gi, '');
write(appPath, app);

// Reuse the actual desktop inspector SVGs for the matching mobile buttons.
// Never remove a mobile rail button just because its icon is temporarily missing.
const polish = `import { useEffect } from 'react';

const MATCHES = [
  { mobile: /yard setup/i, desktop: /yard setup|canvas setup/i },
  { mobile: /^areas$/i, desktop: /^areas$|zones/i },
  { mobile: /plant list/i, desktop: /plant list|legend|planting groups/i },
  { mobile: /developer tools|debug/i, desktop: /developer tools|debug/i },
];

function name(button: HTMLButtonElement) {
  return (button.title || button.getAttribute('aria-label') || button.textContent || '').trim();
}

function sync() {
  if (!window.matchMedia('(max-width: 1023px)').matches) return;

  const mobileButtons = [...document.querySelectorAll<HTMLButtonElement>('.mobile-tool-rail button')];
  const desktopButtons = [...document.querySelectorAll<HTMLButtonElement>('.mobile-inspector-sheet button')]
    .filter(button => !button.closest('.mobile-tool-rail'));

  for (const pair of MATCHES) {
    const target = mobileButtons.find(button => pair.mobile.test(name(button)));
    const source = desktopButtons.find(button => pair.desktop.test(name(button)) && button.querySelector('svg'));
    if (!target || !source) continue;

    const sourceSvg = source.querySelector('svg');
    if (!sourceSvg) continue;

    const targetSvg = target.querySelector('svg');
    const clone = sourceSvg.cloneNode(true);
    if (targetSvg) targetSvg.replaceWith(clone);
    else target.prepend(clone);
  }
}

export default function MobileUiPolish() {
  useEffect(() => {
    const observer = new MutationObserver(sync);
    observer.observe(document.getElementById('root') || document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'title', 'aria-label'],
    });
    sync();
    window.addEventListener('resize', sync);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, []);
  return null;
}
`;
write(polishPath, polish);

// Remove the old rule that hid the Plant List button when its SVG had not loaded yet.
let css = read(cssPath);
css = css.replace(/\n?\s*\.mobile-tool-rail button:empty\s*\{[\s\S]*?\}\s*/g, '\n');
write(cssPath, css);

console.log('Kept the Plant List button, restored its desktop icon mapping, and removed the empty-button hiding rule.');
