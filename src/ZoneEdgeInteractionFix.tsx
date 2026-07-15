import { useEffect } from 'react';

function isZoneEdgeHitLine(line: SVGLineElement) {
  if (line.getAttribute('stroke') !== 'transparent') return false;
  const label = line.parentElement?.querySelector('text')?.textContent?.trim().toLowerCase();
  return label === 'click edge' || label === 'front' || label === 'back';
}

function makeZoneEdgesClickable() {
  document.querySelectorAll<SVGLineElement>('line[stroke="transparent"]').forEach(line => {
    if (!isZoneEdgeHitLine(line)) return;
    line.setAttribute('stroke-width', '44');
    line.setAttribute('pointer-events', 'stroke');
  });
}

export default function ZoneEdgeInteractionFix() {
  useEffect(() => {
    makeZoneEdgesClickable();

    const observer = new MutationObserver(makeZoneEdgesClickable);
    observer.observe(document.getElementById('root')!, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
