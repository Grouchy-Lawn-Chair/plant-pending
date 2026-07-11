import { Plant, PlacedPlant, PlantLabelMode } from '../types/plant';
import { getPlacedPlantColor, getPlacedPlantSymbolUrl, getPlantLineWeight } from '../utils/imageUtils';
import { PlanIconSvg } from './PlanIconSvg';

interface TopDownPlantSymbolProps {
  plant: Plant;
  placed: PlacedPlant;
  size: number;
  placementIndex: number;
  circleOpacity: number;
  labelMode?: PlantLabelMode;
  legendNumber?: number;
  isSelected?: boolean;
  className?: string;
  hideUnderlay?: boolean;
  drifted?: boolean;
}

function labelFontSize(size: number): string {
  if (size >= 90) return '1rem';
  if (size >= 64) return '0.88rem';
  if (size >= 42) return '0.76rem';
  return '0.62rem';
}

function strokeForSize(baseStroke: number, size: number): number {
  if (size <= 13) return 0.18;
  if (size <= 16) return 0.28;
  if (size <= 20) return 0.4;
  if (size <= 28) return Math.min(0.65, baseStroke * 0.42);
  if (size <= 42) return Math.min(0.95, baseStroke * 0.58);
  if (size <= 68) return Math.min(1.35, baseStroke * 0.72);
  return baseStroke;
}

function iconInsetForSize(size: number): string {
  if (size <= 16) return '22%';
  if (size <= 24) return '19%';
  if (size <= 42) return '16%';
  if (size <= 70) return '13%';
  return '11%';
}

function underlayInsetForSize(size: number): string {
  // Keep the color wash tucked inside the icon, but closer to the drawn plant edge.
  if (size <= 16) return '24%';
  if (size <= 24) return '21%';
  if (size <= 42) return '18%';
  if (size <= 70) return '15%';
  return '13%';
}

export function TopDownPlantSymbol({
  plant,
  placed,
  size,
  placementIndex,
  circleOpacity,
  labelMode = 'none',
  legendNumber = 0,
  isSelected = false,
  className = '',
  hideUnderlay = false,
  drifted = false,
}: TopDownPlantSymbolProps) {
  const underlayColor = getPlacedPlantColor(plant, placed, placementIndex);
  const iconUrl = getPlacedPlantSymbolUrl(plant, placed);
  const baseStrokeWidth = getPlantLineWeight(plant);
  // For touching same-plant drifts, let the shared mass do the visual work.
  // Individual icons become mostly fill-only so the cluster reads as one clump.
  const iconStrokeWidth = Math.max(0.16, strokeForSize(baseStrokeWidth, size));
  const labelText = labelMode === 'initials'
    ? plant.abbreviation
    : labelMode === 'numbers' || labelMode === 'callouts'
      ? String(legendNumber)
      : '';
  const showCenterLabel = labelMode === 'initials' || labelMode === 'numbers';
  const iconInset = iconInsetForSize(size);
  const underlayInset = underlayInsetForSize(size);
  const fillOpacity = Math.max(0.34, Math.min(0.82, circleOpacity * 1.32));
  // In a touching drift, fill the actual SVG shape and remove the inner dark strokes.
  // The merged clump is then defined by a shared outer contour overlay.
  const iconOpacity = drifted ? Math.max(0.82, Math.min(0.96, circleOpacity * 1.42)) : 0.98;

  return (
    <div className={`absolute inset-0 overflow-visible pointer-events-none ${className}`}>
      {!hideUnderlay && !drifted && (<>
      <div
        className="absolute rounded-full"
        style={{
          inset: underlayInset,
          background: `radial-gradient(circle at 50% 48%, ${underlayColor}D6 0%, ${underlayColor}BE 42%, ${underlayColor}7C 68%, ${underlayColor}22 90%, ${underlayColor}00 100%)`,
          filter: size <= 18 ? 'none' : 'blur(0.8px)',
          opacity: fillOpacity,
        }}
      />

      <div
        className={`absolute rounded-full ${isSelected ? 'ring-3 ring-blue-400/90 ring-offset-1 ring-offset-white/40' : ''}`}
        style={{
          inset: underlayInset,
          background: `radial-gradient(circle at 50% 50%, ${underlayColor}34 0%, ${underlayColor}20 62%, ${underlayColor}00 100%)`,
        }}
      />
      </>)}

      {hideUnderlay && isSelected && (
        <div
          className="absolute rounded-full ring-3 ring-blue-400/90 ring-offset-1 ring-offset-white/40"
          style={{ inset: underlayInset }}
        />
      )}

      <div
        className="absolute"
        style={{
          inset: iconInset,
          transform: `rotate(${placed.rotationDeg || 0}deg)`,
        }}
      >
        <PlanIconSvg
          src={iconUrl}
          color={drifted ? underlayColor : '#171717'}
          opacity={iconOpacity}
          strokeWidth={iconStrokeWidth}
          fillMode={drifted ? 'fillOnly' : 'outline'}
          className="w-full h-full"
          title={`${plant.commonName || plant.botanicalName} top-down symbol`}
        />
      </div>

      {showCenterLabel && labelText && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-semibold tracking-tight text-gray-900"
            style={{
              fontSize: labelFontSize(size),
              lineHeight: 1,
              textShadow: '0 1px 0 rgba(255,255,255,0.75)',
              WebkitTextStroke: '0.7px rgba(255,255,255,0.92)',
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
