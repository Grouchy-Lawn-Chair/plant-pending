import fs from 'node:fs';

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
const PANEL_TITLES = new Set([...LEFT_TITLES, ...RIGHT_TITLES]);

function active(button: HTMLButtonElement) {
  return button.className.includes('border-emerald-400') ||
    button.className.includes('is-open') ||
    button.getAttribute('aria-pressed') === 'true';
}

function mobileButtons() {
  return [...document.querySelectorAll<HTMLButtonElement>('.mobile-tool-rail button')];
}

function findInspectorButton(patterns: RegExp[]) {
  const sheet = document.querySelector<HTMLElement>('.mobile-inspector-sheet');
  if (!sheet) return null;
  const buttons = [...sheet.querySelectorAll<HTMLButtonElement>('button')];
  return buttons.find(button => {
    const label = [button.title, button.getAttribute('aria-label'), button.textContent]
      .filter(Boolean)
      .join(' ');
    return patterns.some(pattern => pattern.test(label));
  }) || null;
}

function copyIcon(targetTitle: string, patterns: RegExp[]) {
  const target = mobileButtons().find(button => button.title === targetTitle);
  const source = findInspectorButton(patterns);
  if (!target || !source) return;

  const sourceIcon = source.querySelector<HTMLElement>('svg, img');
  const targetIcon = target.querySelector<HTMLElement>('svg, img');
  if (!sourceIcon || !targetIcon) return;

  if (targetIcon.outerHTML !== sourceIcon.outerHTML) {
    targetIcon.replaceWith(sourceIcon.cloneNode(true));
  }
}

export default function MobileFlyoutGuard() {
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    let frame = 0;
    let switching = false;

    const syncIcons = () => {
      if (!media.matches) return;
      copyIcon('Yard setup', [/canvas/i, /yard setup/i, /yard/i]);
      copyIcon('Areas', [/zones?/i, /areas?/i]);
      copyIcon('Debug', [/developer tools/i, /debug/i]);
    };

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

        const buttons = mobileButtons();
        const leftOpen = buttons.some(button => LEFT_TITLES.has(button.title) && active(button));
        const rightOpen = buttons.some(button => RIGHT_TITLES.has(button.title) && active(button));

        left?.setAttribute('data-mobile-open', leftOpen ? 'true' : 'false');
        right?.setAttribute('data-mobile-open', rightOpen ? 'true' : 'false');
        syncIcons();
      });
    };

    const onToolbarClick = (event: MouseEvent) => {
      if (!media.matches || switching) return;
      const clicked = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('.mobile-tool-rail button');
      if (!clicked || !PANEL_TITLES.has(clicked.title)) return;
      const clickedTitle = clicked.title;

      window.setTimeout(() => {
        switching = true;
        for (const button of mobileButtons()) {
          if (button.title !== clickedTitle && PANEL_TITLES.has(button.title) && active(button)) {
            button.click();
          }
        }
        switching = false;
        sync();
        window.setTimeout(sync, 80);
      }, 0);
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.getElementById('root') || document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'aria-pressed', 'title'],
    });
    document.addEventListener('click', onToolbarClick, true);
    media.addEventListener('change', sync);
    sync();
    window.setTimeout(syncIcons, 250);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('click', onToolbarClick, true);
      media.removeEventListener('change', sync);
    };
  }, []);

  return null;
}
`;

const current = fs.existsSync(guardFile) ? read(guardFile) : { newline: '\n', text: '' };
write(guardFile, guard, current.newline);

console.log('Mobile menus now close when another panel button is selected.');
console.log('Yard Setup, Areas, and Debug now reuse the matching original right-rail icons.');