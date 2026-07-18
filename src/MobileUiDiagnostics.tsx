import { useEffect } from 'react';
import type { TestSnapshot } from './types/plant';
import { recordRecipeDebug } from './utils/recipeGenerationDebug';

type UiDebugStore = {
  interactions: Array<Record<string, unknown>>;
  snapshots: TestSnapshot[];
};

function uiDebugStore(): UiDebugStore {
  const debugWindow = window as typeof window & { __plantPendingUiDebug?: UiDebugStore };
  if (!debugWindow.__plantPendingUiDebug) {
    debugWindow.__plantPendingUiDebug = { interactions: [], snapshots: [] };
  }
  return debugWindow.__plantPendingUiDebug;
}

function recordUiInteraction(type: string, target: EventTarget | null) {
  const element = target instanceof Element ? target : null;
  const control = element?.closest('button,a,input,select,textarea,[role="button"],[role="dialog"],details,summary') || element;
  const rect = control instanceof HTMLElement ? control.getBoundingClientRect() : null;
  const entry = {
    timestamp: new Date().toISOString(),
    type,
    tag: control?.tagName?.toLowerCase() || null,
    text: (control?.textContent || '').trim().replace(/s+/g, ' ').slice(0, 160),
    ariaLabel: control?.getAttribute?.('aria-label') || null,
    title: control?.getAttribute?.('title') || null,
    value: control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement ? control.value : null,
    checked: control instanceof HTMLInputElement && (control.type === 'checkbox' || control.type === 'radio') ? control.checked : null,
    rect: rect ? { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) } : null,
  };
  const store = uiDebugStore();
  store.interactions.push(entry);
  if (store.interactions.length > 500) store.interactions.splice(0, store.interactions.length - 500);
}


type RectRecord = {
  selector: string;
  visible: boolean;
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  clippedLeft: number;
  clippedTop: number;
  clippedRight: number;
  clippedBottom: number;
};

type UiLayoutDetails = {
  viewport: {
    width: number;
    height: number;
    visualWidth: number;
    visualHeight: number;
    scale: number;
    orientation: 'portrait' | 'landscape';
    devicePixelRatio: number;
  };
  document: {
    scrollWidth: number;
    scrollHeight: number;
    horizontalOverflow: number;
    verticalOverflow: number;
  };
  panels: {
    open: string[];
    modalTitles: string[];
  };
  regions: RectRecord[];
  overflowElements: Array<{
    tag: string;
    id: string | null;
    className: string;
    text: string;
    left: number;
    top: number;
    right: number;
    bottom: number;
  }>;
  activeElement: {
    tag: string;
    text: string;
    ariaLabel: string | null;
  } | null;
};

const REGION_SELECTORS = [
  '.app-shell',
  '.app-header',
  '.app-workspace',
  '.app-canvas',
  '.mobile-tool-rail',
  '.mobile-left-sheet',
  '.mobile-inspector-sheet',
];

const MAX_UI_SNAPSHOTS = 30;
let snapshotCount = 0;

function visible(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && rect.width > 1 && rect.height > 1;
}

function rectRecord(selector: string): RectRecord {
  const element = document.querySelector(selector);
  if (!visible(element)) {
    return {
      selector,
      visible: false,
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      clippedLeft: 0,
      clippedTop: 0,
      clippedRight: 0,
      clippedBottom: 0,
    };
  }
  const rect = element.getBoundingClientRect();
  return {
    selector,
    visible: true,
    left: Math.round(rect.left),
    top: Math.round(rect.top),
    right: Math.round(rect.right),
    bottom: Math.round(rect.bottom),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    clippedLeft: Math.max(0, Math.round(-rect.left)),
    clippedTop: Math.max(0, Math.round(-rect.top)),
    clippedRight: Math.max(0, Math.round(rect.right - window.innerWidth)),
    clippedBottom: Math.max(0, Math.round(rect.bottom - window.innerHeight)),
  };
}

function modalTitle(element: HTMLElement): string {
  const heading = element.querySelector('h1,h2,h3,[role="heading"]');
  return heading?.textContent?.trim().replace(/\s+/g, ' ').slice(0, 100) || 'Untitled dialog';
}

function collectLayoutDetails(): UiLayoutDetails {
  const visual = window.visualViewport;
  const open: string[] = [];
  if (visible(document.querySelector('.mobile-left-sheet'))) open.push('left-sheet');
  if (visible(document.querySelector('.mobile-inspector-sheet.w-\\[23rem\\]'))) open.push('inspector-sheet');

  const modals = [...document.querySelectorAll<HTMLElement>('div.fixed.inset-0')].filter(visible);
  if (modals.length) open.push(...modals.map(item => `modal:${modalTitle(item)}`));

  const overflowElements = [...document.querySelectorAll<HTMLElement>('body *')]
    .filter(visible)
    .flatMap(element => {
      const rect = element.getBoundingClientRect();
      const outside = rect.left < -2 || rect.top < -2 || rect.right > window.innerWidth + 2 || rect.bottom > window.innerHeight + 2;
      if (!outside) return [];
      return [{
        tag: element.tagName.toLowerCase(),
        id: element.id || null,
        className: typeof element.className === 'string' ? element.className.slice(0, 180) : '',
        text: (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100),
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
      }];
    })
    .slice(0, 40);

  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  return {
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      visualWidth: Math.round(visual?.width || window.innerWidth),
      visualHeight: Math.round(visual?.height || window.innerHeight),
      scale: visual?.scale || 1,
      orientation: window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait',
      devicePixelRatio: window.devicePixelRatio || 1,
    },
    document: {
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      verticalOverflow: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
    },
    panels: {
      open,
      modalTitles: modals.map(modalTitle),
    },
    regions: REGION_SELECTORS.map(rectRecord),
    overflowElements,
    activeElement: active ? {
      tag: active.tagName.toLowerCase(),
      text: (active.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100),
      ariaLabel: active.getAttribute('aria-label'),
    } : null,
  };
}

function cssText(): string {
  const parts: string[] = [];
  for (const sheet of [...document.styleSheets]) {
    try {
      parts.push([...sheet.cssRules].map(rule => rule.cssText).join('\n'));
    } catch {
      // Cross-origin stylesheets cannot be read. The app's own Vite styles are same-origin.
    }
  }
  return parts.join('\n');
}

function sanitizeClone(root: HTMLElement): HTMLElement {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('script,noscript').forEach(node => node.remove());
  clone.querySelectorAll<HTMLElement>('*').forEach(element => {
    element.removeAttribute('contenteditable');
    if (element instanceof HTMLCanvasElement) {
      const originalCanvases = [...root.querySelectorAll('canvas')];
      const cloneCanvases = [...clone.querySelectorAll('canvas')];
      const index = cloneCanvases.indexOf(element);
      const original = originalCanvases[index];
      if (original) {
        try {
          const image = document.createElement('img');
          image.src = original.toDataURL('image/png');
          image.width = original.width;
          image.height = original.height;
          image.style.cssText = original.style.cssText;
          element.replaceWith(image);
        } catch {
          // Keep the empty canvas if the source was tainted by a remote image.
        }
      }
    }
  });
  return clone;
}

async function viewportImageDataUrl(): Promise<string> {
  const root = document.getElementById('root');
  if (!root) return '';
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const clone = sanitizeClone(root);
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.overflow = 'hidden';
  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%"><style>${cssText().replace(/<\/style/gi, '<\\/style')}</style>${serialized}</foreignObject></svg>`;
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  return await new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      try {
        const scale = Math.min(1, 1400 / Math.max(width, height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext('2d');
        if (!context) return resolve(svgUrl);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      } catch {
        resolve(svgUrl);
      }
    };
    image.onerror = () => resolve(svgUrl);
    image.src = svgUrl;
  });
}

function signature(details: UiLayoutDetails): string {
  return JSON.stringify({
    viewport: details.viewport,
    open: details.panels.open,
    regions: details.regions.map(region => [region.selector, region.visible, region.left, region.top, region.width, region.height]),
    overflow: details.document,
  });
}

export default function MobileUiDiagnostics() {
  useEffect(() => {
    let timer = 0;
    let lastSignature = '';
    let disposed = false;

    const capture = async (reason: string) => {
      if (disposed || snapshotCount >= MAX_UI_SNAPSHOTS) return;
      const host = document.querySelector<HTMLElement>('[data-recipe-react-host]') || document.getElementById('root');
      if (!host) return;
      const details = collectLayoutDetails();
      const nextSignature = signature(details);
      if (reason !== 'export-requested' && nextSignature === lastSignature) return;
      lastSignature = nextSignature;
      const imageDataUrl = await viewportImageDataUrl();
      if (disposed) return;
      snapshotCount += 1;
      const snapshot: TestSnapshot = {
        id: `ui-layout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        reason: `ui.layout.${reason}`,
        imageDataUrl,
        width: window.innerWidth,
        height: window.innerHeight,
        details,
      };
      recordRecipeDebug(host, 'ui.layout.snapshot', { reason, snapshotNumber: snapshotCount, ...details }, snapshot);
      const store = uiDebugStore();
      store.snapshots.push(snapshot);
      if (store.snapshots.length > 40) store.snapshots.splice(0, store.snapshots.length - 40);
    };

    const schedule = (reason: string, delay = 420) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void capture(reason), delay);
    };

    const onClick = (event: MouseEvent) => {
      recordUiInteraction('click', event.target);
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest('button,[role="button"]');
      const text = button?.textContent?.trim().replace(/\s+/g, ' ').slice(0, 100) || 'unknown-control';
      const exportRequested = /export.*debug|debug.*package/i.test(text);
      schedule(exportRequested ? 'export-requested' : `after-click:${text}`, exportRequested ? 40 : 500);
    };
    const onInput = (event: Event) => {
      recordUiInteraction(event.type, event.target);
      schedule(`after-${event.type}`, 500);
    };
    const onResize = () => schedule('viewport-changed', 550);
    const onOrientation = () => schedule('orientation-changed', 700);
    const onExportRequested = () => schedule('export-requested', 20);

    const observer = new MutationObserver(() => schedule('layout-changed', 500));
    observer.observe(document.getElementById('root') || document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'open', 'aria-expanded', 'aria-hidden'],
    });

    document.addEventListener('click', onClick, true);
    document.addEventListener('input', onInput, true);
    document.addEventListener('change', onInput, true);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onOrientation);
    window.visualViewport?.addEventListener('resize', onResize);
    window.addEventListener('plant-pending-debug-export', onExportRequested);
    schedule('initial', 900);

    return () => {
      disposed = true;
      observer.disconnect();
      window.clearTimeout(timer);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('change', onInput, true);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onOrientation);
      window.visualViewport?.removeEventListener('resize', onResize);
      window.removeEventListener('plant-pending-debug-export', onExportRequested);
    };
  }, []);

  return null;
}
