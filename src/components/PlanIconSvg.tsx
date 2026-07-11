import { useEffect, useState } from 'react';

interface PlanIconSvgProps {
  src: string;
  color: string;
  opacity?: number;
  className?: string;
  title?: string;
  strokeWidth?: number;
  fillMode?: 'solid' | 'outline' | 'fillOnly';
}

const svgCache = new Map<string, string>();

function hasLightPlantFill(svg: string): boolean {
  return /fill\s*[:=]\s*["']?(?:#fff\b|#ffffff\b|white\b|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))/i.test(svg)
    || /\.cls-2\s*\{[^}]*fill\s*:\s*(?:#fff\b|#ffffff\b|white\b|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))/i.test(svg);
}

function addOrAppendAttribute(openingSvgTag: string, name: string, value: string): string {
  const attrPattern = new RegExp(`\\s${name}=["'][^"']*["']`, 'i');
  if (attrPattern.test(openingSvgTag)) {
    return openingSvgTag.replace(attrPattern, (match) => {
      const quote = match.includes('"') ? '"' : "'";
      const current = match.slice(match.indexOf(quote) + 1, match.lastIndexOf(quote));
      return ` ${name}=${quote}${current} ${value}${quote}`;
    });
  }
  return openingSvgTag.replace(/>$/, ` ${name}="${value}">`);
}

function injectRecolorStyle(svg: string, mode: 'lineart' | 'solid' | 'outline' | 'fillOnly'): string {
  const style = `
<style data-plan-icon-recolor="true">
.recolorable-plan-icon {
  color: rgba(17, 24, 39, 0.95);
}
.recolorable-plan-icon svg,
.recolorable-plan-icon {
  overflow: visible;
}
.recolorable-plan-icon :where(path, polygon, rect, circle, ellipse) {
  vector-effect: non-scaling-stroke;
  stroke-linecap: round;
  stroke-linejoin: round;
  paint-order: stroke fill markers;
}
.recolorable-plan-icon[data-recolor-mode="lineart"] :where(.cls-2, .st0, [fill="#fff"], [fill="#FFF"], [fill="#ffffff"], [fill="#FFFFFF"], [fill="white"], [fill="rgb(255,255,255)"]) {
  fill: var(--plant-fill) !important;
  fill-opacity: var(--plant-fill-opacity) !important;
  stroke: rgba(17, 24, 39, 0.92) !important;
  stroke-width: var(--plant-stroke-width) !important;
}
.recolorable-plan-icon[data-recolor-mode="lineart"] :where([style*="fill:#fff"], [style*="fill: #fff"], [style*="fill:#ffffff"], [style*="fill: #ffffff"], [style*="fill:white"], [style*="fill: white"]) {
  fill: var(--plant-fill) !important;
  fill-opacity: var(--plant-fill-opacity) !important;
  stroke: rgba(17, 24, 39, 0.92) !important;
  stroke-width: var(--plant-stroke-width) !important;
}
.recolorable-plan-icon[data-recolor-mode="lineart"] :where(.cls-1, [fill="#000"], [fill="#000000"], [fill="#020202"], [fill="#111"], [fill="#111111"], [fill="#2c2c2c"], [fill="#2C2C2C"], [fill="black"]) {
  fill: rgba(17, 24, 39, 0.98) !important;
  fill-opacity: 1 !important;
  stroke: none !important;
}
.recolorable-plan-icon[data-recolor-mode="lineart"] :where(path:not([fill]):not([style*="fill"]), polygon:not([fill]):not([style*="fill"]), rect:not([fill]):not([style*="fill"]), circle:not([fill]):not([style*="fill"]), ellipse:not([fill]):not([style*="fill"])) {
  fill: var(--plant-fill) !important;
  fill-opacity: var(--plant-fill-opacity) !important;
  stroke: rgba(17, 24, 39, 0.92) !important;
  stroke-width: var(--plant-stroke-width) !important;
}
.recolorable-plan-icon[data-recolor-mode="solid"] :where(path, polygon, rect, circle, ellipse) {
  fill: var(--plant-fill) !important;
  fill-opacity: var(--plant-fill-opacity) !important;
  stroke: rgba(17, 24, 39, 0.96) !important;
  stroke-width: var(--plant-stroke-width) !important;
}

.recolorable-plan-icon[data-recolor-mode="outline"] :where(path, polygon, rect, circle, ellipse) {
  fill: none !important;
  fill-opacity: 0 !important;
  stroke: rgba(17, 24, 39, 0.96) !important;
  stroke-width: var(--plant-stroke-width) !important;
}

.recolorable-plan-icon[data-recolor-mode="fillOnly"] :where(path, polygon, rect, circle, ellipse) {
  fill: var(--plant-fill) !important;
  fill-opacity: var(--plant-fill-opacity) !important;
  stroke: none !important;
}
.recolorable-plan-icon[data-recolor-mode="fillOnly"] :where(line, polyline) {
  fill: none !important;
  stroke: none !important;
}
.recolorable-plan-icon :where(line, polyline) {
  fill: none !important;
  stroke: rgba(17, 24, 39, 0.96) !important;
  stroke-width: var(--plant-stroke-width) !important;
  vector-effect: non-scaling-stroke;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.recolorable-plan-icon :where([fill="none"], [style*="fill:none"], [style*="fill: none"]) {
  fill: none !important;
}
.recolorable-plan-icon :where([stroke="none"], [style*="stroke:none"], [style*="stroke: none"]) {
  stroke: none !important;
}
</style>`;

  return svg.replace(/<svg\b([^>]*)>/i, (match) => {
    let opening = match;
    opening = addOrAppendAttribute(opening, 'class', 'recolorable-plan-icon');
    opening = addOrAppendAttribute(opening, 'data-recolor-mode', mode);
    return `${opening}${style}`;
  });
}

function prepareSvg(svg: string, forcedMode?: 'lineart' | 'solid' | 'outline' | 'fillOnly'): string {
  const mode = forcedMode || (hasLightPlantFill(svg) ? 'lineart' : 'solid');
  const cleaned = svg
    .replace(/<\?xml[^>]*>/gi, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\s(width|height)="[^"]*"/gi, '');

  return injectRecolorStyle(cleaned, mode);
}

export function PlanIconSvg({ src, color, opacity = 0.58, className = '', title, strokeWidth = 1.85, fillMode = 'solid' }: PlanIconSvgProps) {
  const cacheKey = `${src}|${fillMode}`;
  const [svgMarkup, setSvgMarkup] = useState<string | null>(() => svgCache.get(cacheKey) || null);

  useEffect(() => {
    let cancelled = false;
    const cached = svgCache.get(cacheKey);
    if (cached) {
      setSvgMarkup(cached);
      return;
    }

    fetch(src)
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load ${src}`);
        return response.text();
      })
      .then((text) => {
        const forcedMode = fillMode === 'outline' ? 'outline' : fillMode === 'fillOnly' ? 'fillOnly' : undefined;
        const prepared = prepareSvg(text, forcedMode);
        svgCache.set(cacheKey, prepared);
        if (!cancelled) setSvgMarkup(prepared);
      })
      .catch(() => {
        if (!cancelled) setSvgMarkup(null);
      });

    return () => {
      cancelled = true;
    };
  }, [src, cacheKey, fillMode]);

  if (!svgMarkup) {
    return (
      <div
        className={`plan-icon-svg-fallback ${className}`}
        style={{ backgroundColor: color, opacity }}
        title={title}
      />
    );
  }

  return (
    <div
      className={`plan-icon-svg ${className}`}
      title={title}
      style={{
        ['--plant-fill' as string]: color,
        ['--plant-fill-opacity' as string]: String(opacity),
        ['--plant-stroke-width' as string]: `${strokeWidth}px`,
      }}
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
}
