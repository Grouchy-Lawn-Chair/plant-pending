import { useEffect } from 'react';

function isZoneEdgeHitLine(line: SVGLineElement) {
  if (line.getAttribute('stroke') !== 'transparent') return false;
  const label = line.parentElement?.querySelector('text')?.textContent?.trim().toLowerCase();
  return label === 'click edge' || label === 'front' || label === 'back';
}

function isZoneEdgeTarget(target: EventTarget | null): target is SVGLineElement {
  return target instanceof SVGLineElement && isZoneEdgeHitLine(target);
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

    const stopEdgeClick = (event: MouseEvent) => {
      if (!isZoneEdgeTarget(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    document.addEventListener('click', stopEdgeClick, true);
    document.addEventListener('dblclick', stopEdgeClick, true);

    return () => {
      observer.disconnect();
      document.removeEventListener('click', stopEdgeClick, true);
      document.removeEventListener('dblclick', stopEdgeClick, true);
    };
  }, []);

  return null;
}
