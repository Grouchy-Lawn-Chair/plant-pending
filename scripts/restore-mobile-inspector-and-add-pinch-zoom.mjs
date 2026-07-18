import fs from 'node:fs';

const canvasFile = 'src/components/GardenCanvas.tsx';
const cssFile = 'src/index.css';

function read(path) {
  const raw = fs.readFileSync(path, 'utf8');
  return { newline: raw.includes('\r\n') ? '\r\n' : '\n', text: raw.replace(/\r\n/g, '\n') };
}

function write(path, text, newline) {
  fs.writeFileSync(path, newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
}

const canvas = read(canvasFile);
let canvasText = canvas.text;

if (!canvasText.includes('const pinchRef = useRef<')) {
  const worldRefPattern = /(\s*const worldRef = useRef<HTMLDivElement>\(null\);)/;
  if (!worldRefPattern.test(canvasText)) throw new Error('worldRef anchor not found. No files written.');
  canvasText = canvasText.replace(worldRefPattern, `$1
  const pinchRef = useRef<{
    distance: number;
    zoom: number;
    midpointX: number;
    midpointY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);`);
}

if (!canvasText.includes('const handleViewportTouchStart')) {
  const handlerAnchor = '  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {';
  if (!canvasText.includes(handlerAnchor)) throw new Error('touch handler insertion point not found. No files written.');
  const handlers = `  const touchDistance = (touches: React.TouchList) => {
    const first = touches[0];
    const second = touches[1];
    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
  };

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
  canvasText = canvasText.replace(handlerAnchor, `${handlers}${handlerAnchor}`);
}

if (!canvasText.includes('canvas-control-bar')) {
  const toolbarPattern = /<div className="([^"]*border-b border-slate-800 bg-\[#111827\][^"]*)">/;
  const match = canvasText.match(toolbarPattern);
  if (!match) throw new Error('canvas toolbar could not be identified. No files written.');
  canvasText = canvasText.replace(toolbarPattern, `<div className="canvas-control-bar $1">`);
}

if (!canvasText.includes('onTouchStart={handleViewportTouchStart}')) {
  const viewportPattern = /<div\s+ref=\{viewportRef\}[\s\S]*?>/;
  const viewportMatch = canvasText.match(viewportPattern);
  if (!viewportMatch) throw new Error('viewport container could not be identified. No files written.');
  let openingTag = viewportMatch[0];
  const touchProps = `
        onTouchStart={handleViewportTouchStart}
        onTouchMove={handleViewportTouchMove}
        onTouchEnd={handleViewportTouchEnd}
        onTouchCancel={handleViewportTouchEnd}`;
  if (openingTag.includes('onMouseLeave={stopViewportPan}')) {
    openingTag = openingTag.replace('onMouseLeave={stopViewportPan}', `onMouseLeave={stopViewportPan}${touchProps}`);
  } else {
    openingTag = openingTag.replace('ref={viewportRef}', `ref={viewportRef}${touchProps}`);
  }
  canvasText = canvasText.replace(viewportMatch[0], openingTag);
}

const css = read(cssFile);
let cssText = css.text;
const marker = '/* Mobile inspector rail, toolbar affordance, and pinch zoom */';
if (!cssText.includes(marker)) {
  cssText += `

${marker}
@media (max-width: 1023px) {
  .mobile-inspector-sheet.w-12 {
    display: block !important;
    position: fixed !important;
    z-index: 72 !important;
    right: 0 !important;
    top: 50% !important;
    bottom: auto !important;
    width: 3.25rem !important;
    height: auto !important;
    max-height: min(64dvh, 30rem) !important;
    transform: translateY(-50%);
    overflow-y: auto;
    border: 1px solid #334155 !important;
    border-right: 0 !important;
    border-radius: 0.9rem 0 0 0.9rem !important;
    background: #0f1720 !important;
    box-shadow: -12px 10px 28px rgba(0,0,0,.34);
  }

  .mobile-inspector-sheet.w-\\[23rem\\] {
    display: block !important;
    position: fixed !important;
    z-index: 74 !important;
    left: 0 !important;
    right: 0 !important;
    top: auto !important;
    bottom: calc(4.25rem + env(safe-area-inset-bottom)) !important;
    width: 100% !important;
    height: min(68dvh, 42rem) !important;
    max-height: min(68dvh, 42rem) !important;
    transform: none !important;
    overflow: hidden;
    border: 0 !important;
    border-top: 1px solid #334155 !important;
    border-radius: 1.15rem 1.15rem 0 0 !important;
    box-shadow: 0 -18px 40px rgba(0,0,0,.42);
  }

  .canvas-control-bar {
    position: relative;
    flex-wrap: nowrap !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
    padding-left: 2.1rem !important;
    padding-right: 2.1rem !important;
    scrollbar-width: thin;
    scroll-snap-type: x proximity;
  }
  .canvas-control-bar > * { flex: 0 0 auto; scroll-snap-align: start; }
  .canvas-control-bar::before,
  .canvas-control-bar::after {
    position: sticky;
    z-index: 8;
    top: 0;
    display: flex;
    width: 1.35rem;
    min-width: 1.35rem;
    height: 2.35rem;
    align-items: center;
    justify-content: center;
    color: #cbd5e1;
    background: #111827;
    pointer-events: none;
    font-size: 0.8rem;
    font-weight: 900;
  }
  .canvas-control-bar::before { content: '‹'; left: 0; margin-left: -1.8rem; }
  .canvas-control-bar::after { content: '›'; right: 0; margin-right: -1.8rem; }
  [data-debug-map-canvas="true"] { touch-action: none; }
}
`;
}

write(canvasFile, canvasText, canvas.newline);
write(cssFile, cssText, css.newline);
console.log('Restored the original mobile inspector rail, added swipe indicators, and enabled two-finger pinch zoom.');
console.log('The installer now adapts to the canvas markup produced by earlier mobile scripts.');
