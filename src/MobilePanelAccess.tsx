import { useEffect, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

function isMobile() {
  return window.matchMedia('(max-width: 1023px)').matches;
}

function inspector(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.mobile-inspector-sheet');
}

function inspectorIsOpen(node: HTMLElement | null) {
  return Boolean(node && !node.classList.contains('w-12'));
}

export default function MobilePanelAccess() {
  const [mobile, setMobile] = useState(isMobile());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const update = () => setMobile(media.matches);
    media.addEventListener('change', update);

    const sync = () => setOpen(inspectorIsOpen(inspector()));
    const observer = new MutationObserver(sync);
    observer.observe(document.getElementById('root') || document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    });
    sync();

    return () => {
      media.removeEventListener('change', update);
      observer.disconnect();
    };
  }, []);

  if (!mobile) return null;

  const toggle = () => {
    const node = inspector();
    if (!node) return;
    if (inspectorIsOpen(node)) {
      const close = [...node.querySelectorAll<HTMLButtonElement>('button')].find(button =>
        /close|collapse/i.test(`${button.getAttribute('aria-label') || ''} ${button.title || ''}`),
      );
      if (close) close.click();
      else node.querySelector<HTMLButtonElement>('button')?.click();
      return;
    }
    const first = node.querySelector<HTMLButtonElement>('button');
    first?.click();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="mobile-settings-launcher"
      aria-label={open ? 'Close settings panel' : 'Open settings panel'}
      title={open ? 'Close settings' : 'Open settings'}
    >
      {open ? <X size={21} /> : <SlidersHorizontal size={21} />}
      <span>{open ? 'Close' : 'Settings'}</span>
    </button>
  );
}
