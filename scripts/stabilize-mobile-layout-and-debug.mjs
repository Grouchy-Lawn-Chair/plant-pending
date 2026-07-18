import fs from 'node:fs';

const cssFile = 'src/index.css';
const canvasFile = 'src/components/GardenCanvas.tsx';

function read(path) {
  const raw = fs.readFileSync(path, 'utf8');
  return { newline: raw.includes('\r\n') ? '\r\n' : '\n', text: raw.replace(/\r\n/g, '\n') };
}
function write(path, text, newline) {
  fs.writeFileSync(path, newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
}

const css = read(cssFile);
let cssText = css.text;

const oldMarker = '/* Mobile inspector rail, toolbar affordance, and pinch zoom */';
const oldIndex = cssText.indexOf(oldMarker);
if (oldIndex >= 0) cssText = cssText.slice(0, oldIndex).trimEnd() + '\n';

const newMarker = '/* Stable mobile planner layout */';
if (!cssText.includes(newMarker)) {
  cssText += `

${newMarker}
@media (max-width: 1023px) {
  .app-workspace { position: relative; min-height: 0; }
  .app-canvas { min-width: 0; min-height: 0; }

  .mobile-inspector-sheet.w-12 {
    display: block !important;
    position: fixed !important;
    z-index: 72 !important;
    right: 0 !important;
    top: 50% !important;
    bottom: auto !important;
    width: 3.25rem !important;
    height: auto !important;
    max-height: min(58dvh, 28rem) !important;
    transform: translateY(-50%) !important;
    overflow-y: auto !important;
    border: 1px solid #334155 !important;
    border-right: 0 !important;
    border-radius: 0.9rem 0 0 0.9rem !important;
    background: #0f1720 !important;
    box-shadow: -10px 8px 24px rgba(0,0,0,.3);
  }

  .mobile-inspector-sheet.w-\\[23rem\\] {
    display: flex !important;
    position: fixed !important;
    z-index: 76 !important;
    left: 0 !important;
    right: 0 !important;
    top: auto !important;
    bottom: calc(4.25rem + env(safe-area-inset-bottom)) !important;
    width: 100% !important;
    height: auto !important;
    max-height: min(58dvh, 34rem) !important;
    transform: none !important;
    overflow: hidden !important;
    border: 0 !important;
    border-top: 1px solid #334155 !important;
    border-radius: 1rem 1rem 0 0 !important;
    background: #0f1720 !important;
    box-shadow: 0 -14px 32px rgba(0,0,0,.38);
  }
  .mobile-inspector-sheet.w-\\[23rem\\] > div,
  .mobile-inspector-sheet.w-\\[23rem\\] .inspector-dark {
    width: 100% !important;
    min-height: 0 !important;
    max-height: min(58dvh, 34rem) !important;
    overflow-y: auto !important;
  }

  .canvas-control-bar,
  .canvas-setup-toolbar {
    position: relative;
    flex-wrap: nowrap !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
    padding-left: 1.9rem !important;
    padding-right: 1.9rem !important;
    scrollbar-width: thin;
    scroll-snap-type: x proximity;
  }
  .canvas-control-bar > *,
  .canvas-setup-toolbar > * { flex: 0 0 auto; scroll-snap-align: start; }

  .canvas-control-bar::before,
  .canvas-control-bar::after,
  .canvas-setup-toolbar::before,
  .canvas-setup-toolbar::after {
    position: sticky;
    z-index: 9;
    top: 0;
    display: flex;
    width: 1.25rem;
    min-width: 1.25rem;
    height: 2.25rem;
    align-items: center;
    justify-content: center;
    color: #e2e8f0;
    background: #111827;
    pointer-events: none;
    font-size: 0.9rem;
    font-weight: 900;
  }
  .canvas-control-bar::before,
  .canvas-setup-toolbar::before { content: '‹'; left: 0; margin-left: -1.55rem; }
  .canvas-control-bar::after,
  .canvas-setup-toolbar::after { content: '›'; right: 0; margin-right: -1.55rem; }

  [data-debug-map-canvas="true"] { touch-action: none; }
}
`;
}
write(cssFile, cssText, css.newline);

const canvas = read(canvasFile);
let canvasText = canvas.text;

if (!canvasText.includes('const pinchRef = useRef')) {
  canvasText = canvasText.replace(
    '  const worldRef = useRef<HTMLDivElement>(null);',
    `  const worldRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<{ distance: number; zoom: number; midpointX: number; midpointY: number; scrollLeft: number; scrollTop: number } | null>(null);`,
  );
}

if (!canvasText.includes('const handleViewportTouchStart')) {
  const handlers = `
  const touchDistance = (touches: React.TouchList) => Math.hypot(
    touches[1].clientX - touches[0].clientX,
    touches[1].clientY - touches[0].clientY,
  );

  const touchMidpoint = (touches: React.TouchList) => ({
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  });

  const handleViewportTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2 || !viewportRef.current) return;
    const midpoint = touchMidpoint(event.touches);
    pinchRef.current = {
      distance: Math.max(1, touchDistance(event.touches)),
      zoom,
      midpointX: midpoint.x,
      midpointY: midpoint.y,
      scrollLeft: viewportRef.current.scrollLeft,
      scrollTop: viewportRef.current.scrollTop,
    };
  };

  const handleViewportTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = pinchRef.current;
    const viewport = viewportRef.current;
    if (!start || !viewport || event.touches.length !== 2) return;
    event.preventDefault();
    const midpoint = touchMidpoint(event.touches);
    const ratio = touchDistance(event.touches) / start.distance;
    const nextZoom = Math.max(0.25, Math.min(2.5, Number((start.zoom * ratio).toFixed(3))));
    const rect = viewport.getBoundingClientRect();
    const worldX = (start.midpointX - rect.left + start.scrollLeft) / start.zoom;
    const worldY = (start.midpointY - rect.top + start.scrollTop) / start.zoom;
    onZoomChange(nextZoom);
    requestAnimationFrame(() => {
      viewport.scrollLeft = worldX * nextZoom - (midpoint.x - rect.left);
      viewport.scrollTop = worldY * nextZoom - (midpoint.y - rect.top);
    });
  };

  const handleViewportTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length < 2) pinchRef.current = null;
  };
`;
  const anchor = '  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {';
  if (!canvasText.includes(anchor)) throw new Error('Could not find the image upload handler. No files written.');
  canvasText = canvasText.replace(anchor, `${handlers}\n${anchor}`);
}

if (!canvasText.includes('onTouchStart={handleViewportTouchStart}')) {
  const refIndex = canvasText.indexOf('        ref={viewportRef}');
  if (refIndex < 0) throw new Error('Could not find the canvas viewport. No files written.');
  const lineEnd = canvasText.indexOf('\n', refIndex);
  const insertion = `
        onTouchStart={handleViewportTouchStart}
        onTouchMove={handleViewportTouchMove}
        onTouchEnd={handleViewportTouchEnd}
        onTouchCancel={handleViewportTouchEnd}`;
  canvasText = canvasText.slice(0, lineEnd) + insertion + canvasText.slice(lineEnd);
}

write(canvasFile, canvasText, canvas.newline);
console.log('Stabilized the mobile inspector, toolbar overflow, and pinch zoom without replacing icons.');
console.log('Note: debug screenshots are still not wired into the exported package yet.');
