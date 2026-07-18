import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { SlidersHorizontal, X } from 'lucide-react';

function isMobile() {
  return window.matchMedia('(max-width: 1023px)').matches;
}

function inspector(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.mobile-inspector-sheet');
}

function toolbar(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.mobile-tool-rail-inner');
}

function inspectorIsOpen(node: HTMLElement | null) {
  return Boolean(node && !node.classList.contains('w-12'));
}

export default function MobilePanelAccess() {
  const [mobile, setMobile] = useState(isMobile());
  const [open, setOpen] = useState(false);
  const [toolbarNode, setToolbarNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const update = () => setMobile(media.matches);
    media.addEventListener('change', update);

    const sync = () => {
      setOpen(inspectorIsOpen(inspector()));
      setToolbarNode(toolbar());
    };
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

  if (!mobile || !toolbarNode) return null;

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

  return createPortal(
    <button
      type="button"
      onClick={toggle}
      className={`mobile-settings-launcher ${open ? 'is-open' : ''}`}
      aria-label={open ? 'Close settings panel' : 'Open settings panel'}
      title={open ? 'Close settings' : 'Open settings'}
    >
      {open ? <X size={20} /> : <SlidersHorizontal size={20} />}
      <span className="mobile-tool-label">{open ? 'Close' : 'Settings'}</span>
    </button>,
    toolbarNode,
  );
}
