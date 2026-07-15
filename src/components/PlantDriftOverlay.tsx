import { Plant, PlantLabelMode } from '../types/plant';
import { PlantDriftCluster } from '../utils/driftUtils';

interface PlantDriftOverlayProps {
  cluster: PlantDriftCluster;
  plant: Plant;
  circleOpacity: number;
  labelMode: PlantLabelMode;
  legendNumber: number;
  placementIndex: number;
  isSelected?: boolean;
}

function labelFontSize(cluster: PlantDriftCluster): string {
  const maxRadius = Math.max(...cluster.members.map(member => member.radius));
  if (maxRadius >= 44) return '1rem';
  if (maxRadius >= 30) return '0.9rem';
  if (maxRadius >= 22) return '0.8rem';
  return '0.7rem';
}

function averagePoint(cluster: PlantDriftCluster) {
  const total = cluster.members.length || 1;
  return cluster.members.reduce(
    (acc, member) => ({ x: acc.x + member.x / total, y: acc.y + member.y / total }),
    { x: 0, y: 0 },
  );
}

function iconScaleForRadius(radius: number): number {
  const size = Math.max(radius * 2, 10);
  if (size <= 16) return 0.56;
  if (size <= 24) return 0.62;
  if (size <= 42) return 0.68;
  if (size <= 70) return 0.74;
  return 0.78;
}

function clumpDiameter(radius: number): number {
  return Math.max(12, radius * 2 * iconScaleForRadius(radius));
}

function outerDiameter(radius: number, strokeWidth: number): number {
  return clumpDiameter(radius) + strokeWidth * 2.2;
}

function stampLeft(centerX: number, boundsLeft: number, size: number): number {
  return centerX - boundsLeft - size / 2;
}

function stampTop(centerY: number, boundsTop: number, size: number): number {
  return centerY - boundsTop - size / 2;
}

export function PlantDriftOverlay({
  cluster,
  circleOpacity,
  labelMode,
  legendNumber,
  isSelected = false,
}: PlantDriftOverlayProps) {
  const { bounds, members, color, key } = cluster;
  const clusterCenter = averagePoint(cluster);
  const labelText = labelMode === 'initials'
    ? ''
    : labelMode === 'numbers'
      ? String(legendNumber)
      : '';
  const fillOpacity = Math.max(0.32, Math.min(0.58, circleOpacity * 0.72));
  const strokeWidth = Math.max(1.8, Math.min(3.6, Math.max(...members.map(member => member.radius)) * 0.07));
  const outlineFilterId = `clump-outline-${key.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const fillFilterId = `clump-fill-${key.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  return (
    <div
      className={`absolute z-10 pointer-events-none overflow-visible ${isSelected ? 'z-20' : ''}`}
      style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }}
    >
      <svg width={bounds.width} height={bounds.height} className="absolute inset-0 overflow-visible">
        <defs>
          <filter id={outlineFilterId} x="-25%" y="-25%" width="150%" height="150%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.1" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -8"
              result="goo"
            />
            <feMorphology in="goo" operator="dilate" radius={strokeWidth} result="outer" />
            <feComposite in="outer" in2="goo" operator="out" result="ring" />
            <feFlood floodColor="#111827" floodOpacity="0.98" result="outlineColor" />
            <feComposite in="outlineColor" in2="ring" operator="in" result="outline" />
          </filter>
          <filter id={fillFilterId} x="-25%" y="-25%" width="150%" height="150%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.1" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -8"
              result="goo"
            />
            <feFlood floodColor={color} floodOpacity={fillOpacity} result="flood" />
            <feComposite in="flood" in2="goo" operator="in" result="filled" />
          </filter>
        </defs>

        <g filter={`url(#${outlineFilterId})`}>
          {members.map((member) => {
            const size = outerDiameter(member.radius, strokeWidth);
            return (
              <image
                key={`stroke-${member.instanceId}`}
                href={member.silhouetteUrl}
                x={stampLeft(member.x, bounds.left, size)}
                y={stampTop(member.y, bounds.top, size)}
                width={size}
                height={size}
                preserveAspectRatio="xMidYMid meet"
              />
            );
          })}
        </g>

        <g filter={`url(#${fillFilterId})`}>
          {members.map((member) => {
            const size = clumpDiameter(member.radius);
            return (
              <image
                key={`fill-${member.instanceId}`}
                href={member.silhouetteUrl}
                x={stampLeft(member.x, bounds.left, size)}
                y={stampTop(member.y, bounds.top, size)}
                width={size}
                height={size}
                preserveAspectRatio="xMidYMid meet"
              />
            );
          })}
        </g>
      </svg>

      {isSelected && (
        <div className="absolute inset-0 rounded-[18px] ring-4 ring-blue-400/70 ring-offset-2 ring-offset-white/40" />
      )}

      {labelText && labelMode !== 'callouts' && (
        <div
          className="absolute flex items-center justify-center"
          style={{
            left: clusterCenter.x - bounds.left,
            top: clusterCenter.y - bounds.top,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <span
            className="font-semibold tracking-tight text-gray-900"
            style={{
              fontSize: labelFontSize(cluster),
              lineHeight: 1,
              textShadow: '0 1px 0 rgba(255,255,255,0.9)',
              WebkitTextStroke: '0.8px rgba(255,255,255,0.96)',
              paintOrder: 'stroke fill',
            }}
          >
            {labelText}
          </span>
        </div>
      )}
    </div>
  );
}
