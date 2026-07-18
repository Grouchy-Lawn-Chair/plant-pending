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

// 1. Remove the green welcome kicker directly from App.tsx.
let app = read(appPath);
const beforeApp = app;
app = app
  .replace(/<([A-Za-z][\w.]*)\b[^>]*>[\s\S]{0,300}?VERSION\s*2\.0[\s\S]{0,300}?YARD\s*PANIC\s*REDUCER[\s\S]{0,100}?<\/\1>/gi, '')
  .replace(/<([A-Za-z][\w.]*)\b[^>]*>[\s\S]{0,200}?YARD\s*PANIC\s*REDUCER[\s\S]{0,100}?<\/\1>/gi, '')
  .replace(/VERSION\s*2\.0/gi, '')
  .replace(/YARD\s*PANIC\s*REDUCER/gi, '');
if (app !== beforeApp) write(appPath, app);

// 2. Use the real desktop inspector SVGs for the matching mobile buttons.
//    No replacement icon set. No extra launcher button.
const polish = `import { useEffect } from 'react';

const MATCHES = [
  { mobile: /yard setup/i, desktop: /yard setup|canvas setup/i },
  { mobile: /^areas$/i, desktop: /^areas$|zones/i },
  { mobile: /plant list/i, desktop: /plant list|legend/i },
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
    const targetSvg = target.querySelector('svg');
    if (!sourceSvg) continue;

    const clone = sourceSvg.cloneNode(true);
    if (targetSvg) targetSvg.replaceWith(clone);
    else target.prepend(clone);
  }

  // Remove only truly empty mobile rail buttons.
  for (const button of mobileButtons) {
    const hasIcon = Boolean(button.querySelector('svg, img'));
    const hasName = Boolean(name(button));
    if (!hasIcon && !hasName) button.remove();
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

// 3. Mobile welcome layout and empty rail cleanup.
let css = read(cssPath);
const marker = '/* Simple final mobile welcome and rail cleanup */';
if (!css.includes(marker)) {
  css += `\n\n${marker}\n@media (max-width: 767px) {\n  .mobile-tool-rail button:empty {\n    display: none !important;\n  }\n\n  [role="dialog"] {\n    max-width: calc(100vw - 1rem) !important;\n  }\n\n  [role="dialog"] img {\n    display: block !important;\n    margin-left: auto !important;\n    margin-right: auto !important;\n  }\n}\n`;
  write(cssPath, css);
}

console.log('Applied simple mobile fix: removed welcome kicker, reused desktop rail icons, and removed empty mobile rail buttons.');
