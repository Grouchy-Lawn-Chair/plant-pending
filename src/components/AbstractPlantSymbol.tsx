import { useMemo } from 'react';

interface AbstractPlantSymbolProps {
  seed: string;
  category?: string | null;
  color: string;
  opacity?: number;
  className?: string;
  title?: string;
}

type BlobFamily = 'groundcover' | 'shrub' | 'tree' | 'vine' | 'grass' | 'flower' | 'succulent' | 'conifer' | 'default';

type Point = { x: number; y: number };

type AccentMark =
  | { kind: 'dot'; cx: number; cy: number; rx: number; ry: number; opacity: number }
  | { kind: 'droplet'; cx: number; cy: number; angle: number; size: number; opacity: number }
  | { kind: 'dash'; d: string; width: number; opacity: number };

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  return function random() {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '').trim();
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(clean)) return null;
  const full = clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean;
  const parsed = Number.parseInt(full, 16);
  return { r: (parsed >> 16) & 255, g: (parsed >> 8) & 255, b: parsed & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

function mix(hexA: string, hexB: string, weight: number): string {
  const a = hexToRgb(hexA) || { r: 107, g: 114, b: 128 };
  const b = hexToRgb(hexB) || { r: 255, g: 255, b: 255 };
  return rgbToHex(
    a.r + (b.r - a.r) * weight,
    a.g + (b.g - a.g) * weight,
    a.b + (b.b - a.b) * weight,
  );
}

function rgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex) || { r: 107, g: 114, b: 128 };
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function pointsToSmoothPath(points: Point[]): string {
  if (points.length < 2) return '';
  const start = midpoint(points[points.length - 1], points[0]);
  let d = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const mid = midpoint(current, next);
    d += ` Q ${current.x.toFixed(2)} ${current.y.toFixed(2)} ${mid.x.toFixed(2)} ${mid.y.toFixed(2)}`;
  }
  d += ' Z';
  return d;
}

function normalizeCategory(category?: string | null): string {
  return (category || '').toUpperCase();
}

function getBlobFamily(category?: string | null): BlobFamily {
  const normalized = normalizeCategory(category);
  if (normalized.includes('GROUND')) return 'groundcover';
  if (normalized.includes('VINE')) return 'vine';
  if (normalized.includes('GRASS')) return 'grass';
  if (normalized.includes('TREE')) return 'tree';
  if (normalized.includes('BULB') || normalized.includes('ANNUAL') || normalized.includes('PERENNIAL')) return 'flower';
  if (normalized.includes('SUCC')) return 'succulent';
  if (normalized.includes('CONIFER') || normalized.includes('EVERGREEN')) return 'conifer';
  if (normalized.includes('SHRUB')) return 'shrub';
  return 'default';
}

function familyConfig(family: BlobFamily) {
  switch (family) {
    case 'groundcover':
      return { radiusX: 35, radiusY: 24, irregularity: 0.34, points: 12, stretchX: 1.18, stretchY: 0.86 };
    case 'tree':
      return { radiusX: 33, radiusY: 32, irregularity: 0.28, points: 13, stretchX: 1.03, stretchY: 1.0 };
    case 'vine':
      return { radiusX: 38, radiusY: 21, irregularity: 0.31, points: 11, stretchX: 1.26, stretchY: 0.84 };
    case 'grass':
      return { radiusX: 26, radiusY: 33, irregularity: 0.23, points: 10, stretchX: 0.9, stretchY: 1.1 };
    case 'flower':
      return { radiusX: 31, radiusY: 29, irregularity: 0.31, points: 12, stretchX: 1.04, stretchY: 0.98 };
    case 'succulent':
      return { radiusX: 29, radiusY: 28, irregularity: 0.22, points: 9, stretchX: 1.02, stretchY: 1.02 };
    case 'conifer':
      return { radiusX: 29, radiusY: 34, irregularity: 0.25, points: 12, stretchX: 0.96, stretchY: 1.1 };
    case 'shrub':
      return { radiusX: 31, radiusY: 29, irregularity: 0.31, points: 12, stretchX: 1.06, stretchY: 0.98 };
    default:
      return { radiusX: 31, radiusY: 28, irregularity: 0.3, points: 11, stretchX: 1.06, stretchY: 0.98 };
  }
}

function makeDropletPath(cx: number, cy: number, angle: number, size: number): string {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const px = Math.cos(angle + Math.PI / 2);
  const py = Math.sin(angle + Math.PI / 2);
  const tip = { x: cx + ux * size * 1.15, y: cy + uy * size * 1.15 };
  const back = { x: cx - ux * size * 0.7, y: cy - uy * size * 0.7 };
  const c1 = { x: cx + px * size * 0.75, y: cy + py * size * 0.75 };
  const c2 = { x: cx - px * size * 0.75, y: cy - py * size * 0.75 };
  return `M ${back.x.toFixed(2)} ${back.y.toFixed(2)} Q ${c1.x.toFixed(2)} ${c1.y.toFixed(2)} ${tip.x.toFixed(2)} ${tip.y.toFixed(2)} Q ${c2.x.toFixed(2)} ${c2.y.toFixed(2)} ${back.x.toFixed(2)} ${back.y.toFixed(2)} Z`;
}

function generateBlob(seed: string, family: BlobFamily) {
  const rand = mulberry32(hashString(seed));
  const config = familyConfig(family);
  const center = { x: 50 + (rand() - 0.5) * 2.6, y: 50 + (rand() - 0.5) * 2.6 };
  const rotation = rand() * Math.PI * 2;
  const points: Point[] = [];
  const wobbleA = 2 + Math.floor(rand() * 3);
  const wobbleB = 3 + Math.floor(rand() * 4);

  for (let index = 0; index < config.points; index += 1) {
    const t = (index / config.points) * Math.PI * 2 + rotation;
    const waveA = Math.sin(t * wobbleA + rand() * 1.2) * config.irregularity * 0.45;
    const waveB = Math.cos(t * wobbleB + rand() * 1.6) * config.irregularity * 0.3;
    const noise = (rand() - 0.5) * config.irregularity * 1.6;
    const radiusFactor = clamp(1 + waveA + waveB + noise, 0.7, 1.4);
    const x = center.x + Math.cos(t) * config.radiusX * config.stretchX * radiusFactor;
    const y = center.y + Math.sin(t) * config.radiusY * config.stretchY * radiusFactor;
    points.push({ x, y });
  }

  const innerPoints = points.map((point, index) => {
    const shrink = 0.68 + rand() * 0.11 + (index % 2) * 0.03;
    return {
      x: 50 + (point.x - 50) * shrink + (rand() - 0.5) * 4.2,
      y: 50 + (point.y - 50) * shrink + (rand() - 0.5) * 4.2,
    };
  });

  const outlinePoints = points.map((point) => ({
    x: 50 + (point.x - 50) * (1.045 + rand() * 0.04) + (rand() - 0.5) * 2.6,
    y: 50 + (point.y - 50) * (1.045 + rand() * 0.04) + (rand() - 0.5) * 2.6,
  }));

  // Accents: small/few, distributed around the blob, close to the contour.
  const accents: AccentMark[] = [];
  const clusterCount = 3 + Math.floor(rand() * 2); // 3-4 clusters around blob
  const usedIndices = new Set<number>();
  for (let cluster = 0; cluster < clusterCount; cluster += 1) {
    let idx = Math.floor((cluster / clusterCount) * points.length + rand() * 2) % points.length;
    while (usedIndices.has(idx)) idx = (idx + 1) % points.length;
    usedIndices.add(idx);

    const anchor = points[idx];
    const dx = anchor.x - center.x;
    const dy = anchor.y - center.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    const tx = -ny;
    const ty = nx;
    const markCount = 2 + Math.floor(rand() * 3); // 2-4 marks per cluster
    for (let mark = 0; mark < markCount; mark += 1) {
      const tangential = (mark - (markCount - 1) / 2) * (3.4 + rand() * 1.2);
      const radial = 3.2 + rand() * 4.8;
      const cx = anchor.x + nx * radial + tx * tangential + (rand() - 0.5) * 1.2;
      const cy = anchor.y + ny * radial + ty * tangential + (rand() - 0.5) * 1.2;
      const mode = rand();
      if (mode < 0.42) {
        accents.push({ kind: 'dot', cx, cy, rx: 1.2 + rand() * 1.2, ry: 1.0 + rand() * 1.1, opacity: 0.58 + rand() * 0.18 });
      } else if (mode < 0.74) {
        const angle = Math.atan2(ny, nx) + (rand() - 0.5) * 1.1;
        accents.push({ kind: 'droplet', cx, cy, angle, size: 1.8 + rand() * 1.6, opacity: 0.56 + rand() * 0.18 });
      } else {
        const angle = Math.atan2(ny, nx) + (rand() - 0.5) * 0.9;
        const lengthDash = 3.6 + rand() * 2.8;
        const x1 = cx - Math.cos(angle) * lengthDash * 0.5;
        const y1 = cy - Math.sin(angle) * lengthDash * 0.5;
        const x2 = cx + Math.cos(angle) * lengthDash * 0.5;
        const y2 = cy + Math.sin(angle) * lengthDash * 0.5;
        const curve = (rand() - 0.5) * 1.4;
        const mx = (x1 + x2) / 2 + tx * curve;
        const my = (y1 + y2) / 2 + ty * curve;
        accents.push({ kind: 'dash', d: `M ${x1.toFixed(2)} ${y1.toFixed(2)} Q ${mx.toFixed(2)} ${my.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`, width: 1.15 + rand() * 0.7, opacity: 0.56 + rand() * 0.18 });
      }
    }
  }

  return {
    fillPath: pointsToSmoothPath(points),
    innerPath: pointsToSmoothPath(innerPoints),
    outlinePath: pointsToSmoothPath(outlinePoints),
    outlineOffsetX: (rand() - 0.5) * 2.4,
    outlineOffsetY: (rand() - 0.5) * 2.4,
    accents,
  };
}

export function AbstractPlantSymbol({ seed, category, color, opacity = 0.68, className = '', title }: AbstractPlantSymbolProps) {
  const family = getBlobFamily(category);
  const blob = useMemo(() => generateBlob(`${seed}|${family}`, family), [seed, family]);
  const baseFill = rgba(color, clamp(opacity + 0.16, 0.46, 0.95));
  const innerFill = rgba(mix(color, '#ffffff', 0.38), clamp(opacity * 0.38, 0.2, 0.42));
  const darkStroke = mix(color, '#203040', 0.34);
  const lightStroke = rgba(mix(color, '#ffffff', 0.6), 0.96);
  const accentColor = mix(color, '#22324d', 0.2);

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      overflow="visible"
    >
      {title ? <title>{title}</title> : null}
      <path d={blob.fillPath} fill={baseFill} />
      <path d={blob.innerPath} fill={innerFill} />
      <g transform={`translate(${blob.outlineOffsetX.toFixed(2)} ${blob.outlineOffsetY.toFixed(2)})`}>
        <path d={blob.outlinePath} fill="none" stroke={lightStroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <path d={blob.fillPath} fill="none" stroke={rgba(darkStroke, 0.68)} strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
      {blob.accents.map((accent, index) => {
        if (accent.kind === 'dot') {
          return (
            <ellipse
              key={index}
              cx={accent.cx}
              cy={accent.cy}
              rx={accent.rx}
              ry={accent.ry}
              fill={rgba(accentColor, accent.opacity)}
            />
          );
        }
        if (accent.kind === 'droplet') {
          return (
            <path
              key={index}
              d={makeDropletPath(accent.cx, accent.cy, accent.angle, accent.size)}
              fill={rgba(accentColor, accent.opacity)}
            />
          );
        }
        return (
          <path
            key={index}
            d={accent.d}
            fill="none"
            stroke={rgba(accentColor, accent.opacity)}
            strokeWidth={accent.width}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}
