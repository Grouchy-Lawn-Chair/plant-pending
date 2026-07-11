// GardenCanvas component - the main canvas for placing and dragging plants

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Plant, PlacedPlant, DisplayMode, PlantLabelMode, PlantClumpStrength, GardenZone } from '../types/plant';
import { getPlantImageUrl, getPlantCategoryColor, getPlacedPlantColor, isImageLoaded, isImageFailed, markImageLoaded, markImageFailed } from '../utils/imageUtils';
import { PlanIconSvg } from './PlanIconSvg';
import { TopDownPlantSymbol } from './TopDownPlantSymbol';
import { buildGroupedCallouts } from '../utils/calloutUtils';
import { buildPlantDriftClusters } from '../utils/driftUtils';
import { PlantDriftOverlay } from './PlantDriftOverlay';

interface GardenCanvasProps {
  plants: Plant[];
  placedPlants: PlacedPlant[];
  zones: GardenZone[];
  selectedZoneId: string | null;
  zoneShapesVisible: boolean;
  selectedPlant: Plant | null;
  placingRock: boolean;
  selectedInstanceId: string | null;
  selectedInstanceIds: string[];
  backgroundImage: string | null;
  backgroundOpacity: number;
  backgroundLocked: boolean;
  pixelsPerFoot: number | null;
  canvasWorldSize: { width: number; height: number };
  zoom: number;
  plantCircleOpacity: number;
  plantLabelMode: PlantLabelMode;
  globalDisplayMode: DisplayMode;
  plantClumpingEnabled: boolean;
  plantClumpStrength: PlantClumpStrength;
  onPlacePlant: (plantId: number, x: number, y: number) => void;
  onPlaceRock: (x: number, y: number) => void;
  onCancelPlantPlacement: () => void;
  onSelectPlacedPlant: (instanceId: string | null) => void;
  onSelectMultiplePlacedPlants: (instanceIds: string[]) => void;
  onMovePlacedPlant: (instanceId: string, x: number, y: number) => void;
  onDeletePlacedPlant: (instanceId: string) => void;
  onClearPlacedPlants: () => void;
  onAddZone: (zone: Omit<GardenZone, 'id' | 'name' | 'color' | 'opacity' | 'visible'>) => void;
  onUpdateZone: (zoneId: string, updates: Partial<GardenZone>) => void;
  onSelectZone: (zoneId: string | null) => void;
  onZoneShapesVisibleChange: (visible: boolean) => void;
  onBackgroundImageChange: (image: string | null) => void;
  onBackgroundOpacityChange: (opacity: number) => void;
  onBackgroundLockedChange: (locked: boolean) => void;
  onSetScale: (pixelsPerFoot: number) => void;
  onCanvasSizeChange?: (size: { width: number; height: number }) => void;
  onCanvasWorldSizeChange: (size: { width: number; height: number }) => void;
  onZoomChange: (zoom: number) => void;
  onPlantCircleOpacityChange: (opacity: number) => void;
  onPlantLabelModeChange: (mode: PlantLabelMode) => void;
  onGlobalDisplayModeChange: (mode: DisplayMode) => void;
  onPlantClumpingEnabledChange: (enabled: boolean) => void;
  onPlantClumpStrengthChange: (strength: PlantClumpStrength) => void;
  onLoadExamplePlan?: () => void;
}

interface PlantCircleProps {
  plant: Plant;
  placed: PlacedPlant;
  radius: number;
  isSelected: boolean;
  circleOpacity: number;
  labelMode: PlantLabelMode;
  legendNumber: number;
  placementIndex: number;
  onMouseDown: (e: React.MouseEvent) => void;
  drifted?: boolean;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 3 && clean.length !== 6) return null;
  const full = clean.length === 3 ? clean.split('').map(ch => ch + ch).join('') : clean;
  const parsed = Number.parseInt(full, 16);
  if (Number.isNaN(parsed)) return null;
  return { r: (parsed >> 16) & 255, g: (parsed >> 8) & 255, b: parsed & 255 };
}

function colorWithOpacity(color: string, opacity: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

function zonePointsToString(points: { x: number; y: number }[]): string {
  return points.map(point => `${point.x},${point.y}`).join(' ');
}

function getZoneEdgeRole(zone: GardenZone, edgeIndex: number): 'front' | 'back' | '' {
  if (zone.edgeRoles?.front?.includes(edgeIndex)) return 'front';
  if (zone.edgeRoles?.back?.includes(edgeIndex)) return 'back';
  return '';
}

function nextZoneEdgeRole(role: 'front' | 'back' | ''): 'front' | 'back' | '' {
  if (role === '') return 'front';
  if (role === 'front') return 'back';
  return '';
}

function buildUpdatedEdgeRoles(zone: GardenZone, edgeIndex: number, role: 'front' | 'back' | '') {
  const currentFront = zone.edgeRoles?.front || [];
  const currentBack = zone.edgeRoles?.back || [];
  return {
    front: role === 'front' ? Array.from(new Set([...currentFront, edgeIndex])).sort((a, b) => a - b) : currentFront.filter(index => index !== edgeIndex),
    back: role === 'back' ? Array.from(new Set([...currentBack, edgeIndex])).sort((a, b) => a - b) : currentBack.filter(index => index !== edgeIndex),
  };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

function isPointInPolygon(point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi || 1) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}


function fallbackRotation(instanceId: string, plantId: number): number {
  const text = `${instanceId}-${plantId}`;
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}


interface RockIconProps {
  placed: PlacedPlant;
  sizePx: number;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  drifted?: boolean;
}

function RockIcon({ placed, sizePx, isSelected, onMouseDown }: RockIconProps) {
  const rockUrl = placed.rockSvg || '/rocks-icons/rock1.svg';
  const rockColor = placed.rockColor || '#8f8f8f';
  const rotationDeg = placed.rotationDeg ?? fallbackRotation(placed.instanceId, placed.plantId);

  return (
    <div
      onMouseDown={onMouseDown}
      className={`absolute cursor-move select-none ${isSelected ? 'z-20' : 'z-10'}`}
      style={{
        left: placed.x,
        top: placed.y,
        transform: 'translate(-50%, -50%)',
        width: sizePx,
        height: sizePx,
      }}
      title={`Rock ${placed.rockSizeFt || 2}'`}
    >
      <div
        className={`absolute inset-0 pointer-events-none ${isSelected ? 'ring-4 ring-blue-400 ring-offset-2 rounded-lg' : ''}`}
        style={{ transform: `rotate(${rotationDeg}deg)` }}
      >
        <PlanIconSvg
          src={rockUrl}
          color={rockColor}
          opacity={0.9}
          className="rock-plan-icon w-full h-full"
          title={`Rock ${placed.rockSizeFt || 2}'`}
        />
      </div>
      {isSelected && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap">
          Rock {placed.rockSizeFt || 2}'
        </div>
      )}
    </div>
  );
}

function PlantCircle({ plant, placed, radius, isSelected, circleOpacity, labelMode, legendNumber, placementIndex, onMouseDown, drifted = false }: PlantCircleProps) {
  const displayMode: DisplayMode = placed.displayMode || 'color';
  const imageUrl = getPlantImageUrl(plant);
  const categoryColor = getPlantCategoryColor(plant);
  const placedColor = getPlacedPlantColor(plant, placed, placementIndex) || categoryColor;

  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoadedState] = useState(false);

  const alreadyFailed = imageUrl ? isImageFailed(imageUrl) : false;
  const alreadyLoaded = imageUrl ? isImageLoaded(imageUrl) : false;

  const showImageFallback = !imageUrl || alreadyFailed || imageError;
  const showImage = imageUrl && !showImageFallback && (alreadyLoaded || imageLoaded);

  useEffect(() => {
    if (imageUrl && !alreadyFailed && !alreadyLoaded) {
      const img = new Image();
      img.onload = () => {
        markImageLoaded(imageUrl);
        setImageLoadedState(true);
      };
      img.onerror = () => {
        markImageFailed(imageUrl);
        setImageError(true);
      };
      img.src = imageUrl;
    }
  }, [imageUrl, alreadyFailed, alreadyLoaded]);

  const showSymbolMode = displayMode === 'symbol' || displayMode === 'symbolLabel';
  const showImageMode = (displayMode === 'image' || displayMode === 'imageLabel') && showImage;
  const showColorMode = displayMode === 'color' || (!showSymbolMode && !showImageMode);
  const symbolSize = Math.max(radius * 2, 10);

  return (
    <div
      onMouseDown={onMouseDown}
      className={`absolute cursor-move select-none ${isSelected ? 'z-20' : 'z-10'}`}
      style={{
        left: placed.x,
        top: placed.y,
        transform: 'translate(-50%, -50%)',
        width: symbolSize,
        height: symbolSize,
      }}
    >
      {showSymbolMode && (
        <div
          className="absolute inset-0 pointer-events-none"
          title={`${plant.commonName || plant.botanicalName}
${plant.matureWidthFt || '?'}' wide
Zone: ${placed.zone || 'none'}`}
        >
          <TopDownPlantSymbol
            plant={plant}
            placed={placed}
            size={symbolSize}
            placementIndex={placementIndex}
            circleOpacity={circleOpacity}
            labelMode={labelMode}
            legendNumber={legendNumber}
            isSelected={isSelected}
            drifted={drifted}
          />
        </div>
      )}

      {!showSymbolMode && (
        <div
          className={`absolute inset-0 rounded-full ${isSelected ? 'ring-4 ring-blue-400 ring-offset-2' : ''}`}
          style={{
            backgroundColor: showImageMode ? `rgba(255,255,255,${Math.max(0.05, circleOpacity)})` : colorWithOpacity(placedColor, circleOpacity),
            border: '1px solid rgba(0,0,0,0.2)',
          }}
          title={`${plant.commonName || plant.botanicalName}
${plant.matureWidthFt || '?'}' wide
Zone: ${placed.zone || 'none'}`}
        />
      )}

      {showImageMode && (
        <img
          src={imageUrl!}
          alt={plant.commonName || plant.botanicalName}
          className="absolute inset-[8%] w-[84%] h-[84%] object-cover rounded-full pointer-events-none"
          onError={() => {
            markImageFailed(imageUrl!);
            setImageError(true);
          }}
        />
      )}

      {showColorMode && labelMode === 'none' && (
        <div className="absolute inset-[18%] rounded-full bg-white/25 pointer-events-none" />
      )}

      {isSelected && (
        <div
          className="absolute pointer-events-none rounded-full border-[3px] border-blue-500 shadow-[0_0_0_2px_rgba(255,255,255,0.9)]"
          style={{ inset: -6 }}
        />
      )}

    </div>
  );
}

export function GardenCanvas({
  plants,
  placedPlants,
  zones,
  selectedZoneId,
  zoneShapesVisible,
  selectedPlant,
  placingRock,
  selectedInstanceId,
  selectedInstanceIds,
  backgroundImage,
  backgroundOpacity,
  backgroundLocked,
  pixelsPerFoot,
  canvasWorldSize,
  zoom,
  plantCircleOpacity,
  plantLabelMode,
  plantClumpingEnabled,
  plantClumpStrength,
  onPlacePlant,
  onPlaceRock,
  onCancelPlantPlacement,
  onSelectPlacedPlant,
  onSelectMultiplePlacedPlants,
  onMovePlacedPlant,
  onDeletePlacedPlant,
  onClearPlacedPlants,
  onAddZone,
  onUpdateZone,
  onSelectZone,
  onZoneShapesVisibleChange,
  onBackgroundImageChange,
  onBackgroundOpacityChange,
  onBackgroundLockedChange,
  onSetScale,
  onCanvasSizeChange,
  onCanvasWorldSizeChange,
  onZoomChange,
  onLoadExamplePlan,
}: GardenCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const [isSettingScale, setIsSettingScale] = useState(false);
  const [scalePoint1, setScalePoint1] = useState<{ x: number; y: number } | null>(null);
  const [scalePoint2, setScalePoint2] = useState<{ x: number; y: number } | null>(null);
  const [showScaleModal, setShowScaleModal] = useState(false);
  const [scaleLinePixels, setScaleLinePixels] = useState(0);
  const [draggingPlant, setDraggingPlant] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [groupDragStart, setGroupDragStart] = useState<{ instanceId: string; original: { instanceId: string; x: number; y: number }[]; startPoint: { x: number; y: number } } | null>(null);
  const [marqueeSelection, setMarqueeSelection] = useState<{ start: { x: number; y: number }; current: { x: number; y: number } } | null>(null);
  const marqueeJustFinishedRef = useRef(false);
  const [isSpacePanning, setIsSpacePanning] = useState(false);
  const [panDrag, setPanDrag] = useState<{ startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);
  const [isDrawingZone, setIsDrawingZone] = useState(false);
  const [zoneDraftPoints, setZoneDraftPoints] = useState<{ x: number; y: number }[]>([]);
  const [zonePreviewPoint, setZonePreviewPoint] = useState<{ x: number; y: number } | null>(null);
  const [draggingZonePoint, setDraggingZonePoint] = useState<{ zoneId: string; pointIndex: number } | null>(null);
  const [draggingZone, setDraggingZone] = useState<{ zoneId: string; startPoint: { x: number; y: number }; originalPoints: { x: number; y: number }[] } | null>(null);

  useEffect(() => {
    onCanvasSizeChange?.(canvasWorldSize);
  }, [canvasWorldSize, onCanvasSizeChange]);

  const getPlantById = (id: number): Plant | undefined => plants.find(p => p.id === id);

  const getPlantRadius = (plant: Plant): number => {
    const widthFt = plant.matureWidthFt || 3;
    const defaultPixelsPerFoot = 20;
    const ppx = pixelsPerFoot || defaultPixelsPerFoot;
    return Math.max((widthFt / 2) * ppx, 5);
  };

  const getRockSizePx = (placed: PlacedPlant): number => {
    const sizeFt = placed.rockSizeFt || 2;
    const defaultPixelsPerFoot = 20;
    const ppx = pixelsPerFoot || defaultPixelsPerFoot;
    // Respect the calibrated feet-to-pixels scale for rocks.
    // The old 24px minimum made 1', 2', and sometimes 3' rocks render the same size.
    return Math.max(sizeFt * ppx, 8);
  };

  const getWorldPoint = (clientX: number, clientY: number) => {
    if (!worldRef.current) return null;
    const rect = worldRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / zoom,
      y: (clientY - rect.top) / zoom,
    };
  };

  const getPlacedItemRadius = (placed: PlacedPlant): number => {
    if (placed.itemType === 'rock') return getRockSizePx(placed) / 2;
    const plant = getPlantById(placed.plantId);
    if (!plant) return 0;
    const widthFt = placed.displayWidthFt || plant.matureWidthFt || 3;
    const defaultPixelsPerFoot = 20;
    const ppx = pixelsPerFoot || defaultPixelsPerFoot;
    return Math.max((widthFt / 2) * ppx, 5);
  };

  const getMarqueeRect = (selection: { start: { x: number; y: number }; current: { x: number; y: number } }) => ({
    left: Math.min(selection.start.x, selection.current.x),
    top: Math.min(selection.start.y, selection.current.y),
    width: Math.abs(selection.current.x - selection.start.x),
    height: Math.abs(selection.current.y - selection.start.y),
  });

  const legendNumbers = new Map<number, number>();
  const placementOrder = new Map<string, number>();
  let placementCounter = 0;
  placedPlants.forEach((placed) => {
    if (placed.itemType === 'rock') return;
    placementOrder.set(placed.instanceId, placementCounter);
    placementCounter += 1;
    if (!legendNumbers.has(placed.plantId)) {
      legendNumbers.set(placed.plantId, legendNumbers.size + 1);
    }
  });

  const plantDriftClusters = useMemo(() => buildPlantDriftClusters(placedPlants, plants, getPlantRadius, { enabled: plantClumpingEnabled, strength: plantClumpStrength }), [placedPlants, plants, pixelsPerFoot, plantClumpingEnabled, plantClumpStrength]);
  const driftedInstanceIds = useMemo(
    () => new Set(plantDriftClusters.flatMap((cluster) => cluster.members.map((member) => member.instanceId))),
    [plantDriftClusters],
  );

  const groupedCallouts = useMemo(() => {
    if (plantLabelMode !== 'callouts') return [];

    const calloutItems = placedPlants
      .filter((placed) => placed.itemType !== 'rock')
      .map((placed) => {
        const plant = getPlantById(placed.plantId);
        if (!plant) return null;
        const legendNumber = legendNumbers.get(placed.plantId) || 0;
        return {
          instanceId: placed.instanceId,
          plantId: placed.plantId,
          x: placed.x,
          y: placed.y,
          radius: getPlacedItemRadius(placed),
          labelBase: `${legendNumber} ${plant.commonName || plant.botanicalName}`,
        };
      })
      .filter(Boolean) as Array<{ instanceId: string; plantId: number; x: number; y: number; radius: number; labelBase: string }>;

    return buildGroupedCallouts(calloutItems, canvasWorldSize.width, canvasWorldSize.height);
  }, [placedPlants, plantLabelMode, plants, pixelsPerFoot, canvasWorldSize.width, canvasWorldSize.height]);

  const handleViewportMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSpacePanning || e.button !== 0 || !viewportRef.current) return;
    e.preventDefault();
    setPanDrag({
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: viewportRef.current.scrollLeft,
      scrollTop: viewportRef.current.scrollTop,
    });
  };

  const handleViewportMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!panDrag || !viewportRef.current) return;
    e.preventDefault();
    viewportRef.current.scrollLeft = panDrag.scrollLeft - (e.clientX - panDrag.startX);
    viewportRef.current.scrollTop = panDrag.scrollTop - (e.clientY - panDrag.startY);
  };

  const stopViewportPan = () => {
    setPanDrag(null);
  };

  const finishZoneDraft = useCallback(() => {
    if (zoneDraftPoints.length < 3) return;
    onAddZone({ points: zoneDraftPoints });
    setZoneDraftPoints([]);
    setZonePreviewPoint(null);
    setIsDrawingZone(false);
  }, [zoneDraftPoints, onAddZone]);

  const cancelZoneDraft = useCallback(() => {
    setZoneDraftPoints([]);
    setZonePreviewPoint(null);
    setIsDrawingZone(false);
  }, []);

  const insertZonePoint = useCallback((zoneId: string, afterIndex: number, point: { x: number; y: number }) => {
    const zone = zones.find(item => item.id === zoneId);
    if (!zone) return;
    const nextPoints = [...zone.points];
    nextPoints.splice(afterIndex + 1, 0, point);
    onUpdateZone(zoneId, { points: nextPoints });
  }, [zones, onUpdateZone]);

  const removeZonePoint = useCallback((zoneId: string, pointIndex: number) => {
    const zone = zones.find(item => item.id === zoneId);
    if (!zone || zone.points.length <= 3) return;
    onUpdateZone(zoneId, { points: zone.points.filter((_, index) => index !== pointIndex) });
  }, [zones, onUpdateZone]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (marqueeJustFinishedRef.current) {
      marqueeJustFinishedRef.current = false;
      return;
    }
    if (isSpacePanning || panDrag) return;
    const point = getWorldPoint(e.clientX, e.clientY);
    if (!point) return;
    const x = point.x;
    const y = point.y;

    if (isDrawingZone) {
      const firstPoint = zoneDraftPoints[0];
      if (firstPoint && zoneDraftPoints.length >= 3 && distance(point, firstPoint) <= 14 / zoom) {
        finishZoneDraft();
        return;
      }
      setZoneDraftPoints(prev => [...prev, { x, y }]);
      return;
    }

    if (isSettingScale) {
      if (!scalePoint1) {
        setScalePoint1({ x, y });
      } else if (!scalePoint2) {
        setScalePoint2({ x, y });
        const dist = Math.sqrt(Math.pow(x - scalePoint1.x, 2) + Math.pow(y - scalePoint1.y, 2));
        setScaleLinePixels(dist);
        setShowScaleModal(true);
      }
      return;
    }

    for (const placed of [...placedPlants].reverse()) {
      const radius = getPlacedItemRadius(placed);
      if (!radius) continue;
      const dist = Math.sqrt(Math.pow(x - placed.x, 2) + Math.pow(y - placed.y, 2));
      if (dist <= radius) {
        onSelectPlacedPlant(placed.instanceId);
        onSelectZone(null);
        return;
      }
    }

    if (placingRock) {
      onPlaceRock(x, y);
      return;
    }

    if (selectedPlant) {
      onPlacePlant(selectedPlant.id, x, y);
      return;
    }

    if (zoneShapesVisible) {
      const clickedZone = [...zones].reverse().find(zone => zone.visible !== false && isPointInPolygon(point, zone.points));
      if (clickedZone) {
        onSelectZone(clickedZone.id);
        onSelectPlacedPlant(null);
        return;
      }
    }

    onSelectPlacedPlant(null);
    onSelectZone(null);
  };

  const handleMouseDown = (e: React.MouseEvent, instanceId: string) => {
    if (isSpacePanning) return;
    if (e.shiftKey) return;
    e.stopPropagation();
    const point = getWorldPoint(e.clientX, e.clientY);
    if (!point) return;
    const placed = placedPlants.find(p => p.instanceId === instanceId);
    if (!placed) return;

    setDraggingPlant(instanceId);
    setDragOffset({ x: point.x - placed.x, y: point.y - placed.y });
    if (selectedInstanceIds.includes(instanceId) && selectedInstanceIds.length > 1) {
      const originals = placedPlants
        .filter(item => selectedInstanceIds.includes(item.instanceId))
        .map(item => ({ instanceId: item.instanceId, x: item.x, y: item.y }));
      setGroupDragStart({ instanceId, original: originals, startPoint: point });
    } else {
      setGroupDragStart(null);
      onSelectPlacedPlant(instanceId);
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const point = getWorldPoint(e.clientX, e.clientY);
    if (!point) return;

    if (draggingZonePoint) {
      const x = Math.max(0, Math.min(point.x, canvasWorldSize.width));
      const y = Math.max(0, Math.min(point.y, canvasWorldSize.height));
      const zone = zones.find(item => item.id === draggingZonePoint.zoneId);
      if (!zone) return;
      const nextPoints = zone.points.map((zonePoint, index) => index === draggingZonePoint.pointIndex ? { x, y } : zonePoint);
      onUpdateZone(draggingZonePoint.zoneId, { points: nextPoints });
      return;
    }

    if (draggingZone) {
      const dx = point.x - draggingZone.startPoint.x;
      const dy = point.y - draggingZone.startPoint.y;
      const movedPoints = draggingZone.originalPoints.map(zonePoint => ({
        x: zonePoint.x + dx,
        y: zonePoint.y + dy,
      }));
      const minX = Math.min(...movedPoints.map(zonePoint => zonePoint.x));
      const maxX = Math.max(...movedPoints.map(zonePoint => zonePoint.x));
      const minY = Math.min(...movedPoints.map(zonePoint => zonePoint.y));
      const maxY = Math.max(...movedPoints.map(zonePoint => zonePoint.y));
      const clampDx = minX < 0 ? -minX : maxX > canvasWorldSize.width ? canvasWorldSize.width - maxX : 0;
      const clampDy = minY < 0 ? -minY : maxY > canvasWorldSize.height ? canvasWorldSize.height - maxY : 0;
      onUpdateZone(draggingZone.zoneId, {
        points: movedPoints.map(zonePoint => ({
          x: zonePoint.x + clampDx,
          y: zonePoint.y + clampDy,
        })),
      });
      return;
    }

    if (!draggingPlant) return;

    if (groupDragStart && selectedInstanceIds.includes(draggingPlant)) {
      const dx = point.x - groupDragStart.startPoint.x;
      const dy = point.y - groupDragStart.startPoint.y;
      for (const item of groupDragStart.original) {
        onMovePlacedPlant(
          item.instanceId,
          Math.max(0, Math.min(item.x + dx, canvasWorldSize.width)),
          Math.max(0, Math.min(item.y + dy, canvasWorldSize.height)),
        );
      }
      return;
    }

    const x = point.x - dragOffset.x;
    const y = point.y - dragOffset.y;
    const clampedX = Math.max(0, Math.min(x, canvasWorldSize.width));
    const clampedY = Math.max(0, Math.min(y, canvasWorldSize.height));
    onMovePlacedPlant(draggingPlant, clampedX, clampedY);
  }, [draggingPlant, draggingZonePoint, draggingZone, dragOffset, groupDragStart, selectedInstanceIds, canvasWorldSize, onMovePlacedPlant, onUpdateZone, zones, zoom]);

  const handleMouseUp = useCallback(() => {
    if (marqueeSelection) {
      const rect = getMarqueeRect(marqueeSelection);
      const picked = rect.width >= 6 && rect.height >= 6
        ? placedPlants
            .filter(item => item.x >= rect.left && item.x <= rect.left + rect.width && item.y >= rect.top && item.y <= rect.top + rect.height)
            .map(item => item.instanceId)
        : [];
      onSelectMultiplePlacedPlants(picked);
      setMarqueeSelection(null);
      marqueeJustFinishedRef.current = true;
    }
    setDraggingPlant(null);
    setGroupDragStart(null);
    setDraggingZonePoint(null);
    setDraggingZone(null);
  }, [marqueeSelection, placedPlants, onSelectMultiplePlacedPlants]);

  useEffect(() => {
    if (draggingPlant || draggingZonePoint || draggingZone || marqueeSelection) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingPlant, draggingZonePoint, draggingZone, marqueeSelection, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    const isTypingInForm = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName?.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingInForm(e.target)) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (isDrawingZone) {
          cancelZoneDraft();
        }
        onCancelPlantPlacement();
        onSelectPlacedPlant(null);
        onSelectZone(null);
        setDraggingPlant(null);
        setGroupDragStart(null);
        setMarqueeSelection(null);
        setDraggingZonePoint(null);
        setDraggingZone(null);
        setIsSpacePanning(false);
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePanning(true);
        return;
      }

      if (isDrawingZone && (e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault();
        setZoneDraftPoints(prev => prev.slice(0, -1));
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedInstanceIds.length > 0 || selectedInstanceId)) {
        e.preventDefault();
        const idsToDelete = selectedInstanceIds.length > 0 ? selectedInstanceIds : selectedInstanceId ? [selectedInstanceId] : [];
        idsToDelete.forEach(id => onDeletePlacedPlant(id));
        onSelectMultiplePlacedPlants([]);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePanning(false);
        setPanDrag(null);
      }
    };

    const handleWindowBlur = () => {
      setIsSpacePanning(false);
      setPanDrag(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [selectedInstanceId, selectedInstanceIds, onDeletePlacedPlant, onCancelPlantPlacement, onSelectPlacedPlant, onSelectMultiplePlacedPlants, onSelectZone, isDrawingZone, cancelZoneDraft]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const maxWidth = 1600;
        const maxHeight = 1100;
        const scale = Math.min(maxWidth / img.naturalWidth, maxHeight / img.naturalHeight, 1);
        onCanvasWorldSizeChange({
          width: Math.round(img.naturalWidth * scale),
          height: Math.round(img.naturalHeight * scale),
        });
      };
      img.src = dataUrl;
      onBackgroundImageChange(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleScaleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const feet = parseFloat((form.elements.namedItem('feet') as HTMLInputElement).value);
    if (feet > 0 && scaleLinePixels > 0) {
      const ppx = scaleLinePixels / feet;
      onSetScale(ppx);
    }
    setShowScaleModal(false);
    setIsSettingScale(false);
    setScalePoint1(null);
    setScalePoint2(null);
  };

  const cancelScaleSetting = () => {
    setIsSettingScale(false);
    setScalePoint1(null);
    setScalePoint2(null);
    setShowScaleModal(false);
  };

  const fitToScreen = () => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const nextZoom = Math.min(rect.width / canvasWorldSize.width, rect.height / canvasWorldSize.height, 1);
    onZoomChange(Math.max(0.25, Math.min(2.5, Number(nextZoom.toFixed(2)))));
  };

  const handleWorldMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Shift-drag is always marquee selection, even if a plant is selected in the
    // library or the drag starts on top of an existing plant symbol.
    if (e.button !== 0 || !e.shiftKey || isSpacePanning || isDrawingZone || isSettingScale) return;
    const point = getWorldPoint(e.clientX, e.clientY);
    if (!point) return;
    e.preventDefault();
    e.stopPropagation();
    onSelectZone(null);
    onCancelPlantPlacement();
    setDraggingPlant(null);
    setGroupDragStart(null);
    setMarqueeSelection({ start: point, current: point });
  };

  const handleWorldMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const point = getWorldPoint(e.clientX, e.clientY);
    if (!point) return;
    if (marqueeSelection) {
      setMarqueeSelection(prev => prev ? { ...prev, current: point } : prev);
      return;
    }
    if (isDrawingZone) setZonePreviewPoint(point);
  };

  const visibleZones = zones.filter(zone => zone.visible !== false);
  const selectedZone = zones.find(zone => zone.id === selectedZoneId);
  const canFinishZone = isDrawingZone && zoneDraftPoints.length >= 3;

  return (
    <div className="flex flex-col h-full bg-[#10161d]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-[#111827] text-slate-200 flex-wrap">
        <label className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded cursor-pointer hover:bg-slate-800 text-slate-200">
          <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>{backgroundImage ? 'Change image' : 'Upload background'}</span>
          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </label>

        {backgroundImage && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Image:</span>
            <input
              type="range"
              min="0"
              max="100"
              value={backgroundOpacity * 100}
              onChange={(e) => onBackgroundOpacityChange(parseInt(e.target.value) / 100)}
              className="w-20"
            />
          </div>
        )}

        {backgroundImage && (
          <button
            onClick={() => onBackgroundLockedChange(!backgroundLocked)}
            className={`flex items-center gap-1 px-2 py-1 text-sm rounded border ${backgroundLocked ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800'}`}
            title={backgroundLocked ? 'Background locked' : 'Background unlocked'}
          >
            <span>{backgroundLocked ? 'Locked' : 'Unlock'}</span>
          </button>
        )}

        <button
          onClick={() => {
            if (isSettingScale) {
              cancelScaleSetting();
            } else {
              setIsSettingScale(true);
              setScalePoint1(null);
              setScalePoint2(null);
            }
          }}
          className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded border ${isSettingScale ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800'}`}
        >
          <span>{isSettingScale ? 'Cancel scale' : 'Set scale'}</span>
        </button>

        {pixelsPerFoot && (
          <div className="text-xs text-emerald-200 bg-emerald-500/15 border border-emerald-500/20 px-2 py-1 rounded">
            {pixelsPerFoot.toFixed(1)} px/ft
          </div>
        )}

        <div className="flex items-center gap-2 border-l border-slate-700 pl-3">
          <button
            type="button"
            onClick={() => {
              if (isDrawingZone) {
                cancelZoneDraft();
              } else {
                onCancelPlantPlacement();
                onSelectPlacedPlant(null);
                setIsSettingScale(false);
                setZoneDraftPoints([]);
                setZonePreviewPoint(null);
                setIsDrawingZone(true);
              }
            }}
            className={`px-3 py-1.5 text-sm rounded border ${isDrawingZone ? 'bg-purple-600 text-white border-purple-500' : 'bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800'}`}
          >
            {isDrawingZone ? 'Cancel zone' : 'Draw zone'}
          </button>
          <button
            type="button"
            onClick={() => onZoneShapesVisibleChange(!zoneShapesVisible)}
            className={`px-2 py-1.5 text-xs rounded border ${zoneShapesVisible ? 'bg-slate-900 text-slate-200 border-slate-700' : 'bg-slate-800 text-slate-500 border-slate-700'}`}
            title="Show or hide zone shapes"
          >
            Zones {zoneShapesVisible ? 'on' : 'off'}
          </button>
        </div>

        <div className="flex items-center gap-2 border-l border-slate-700 pl-3">
          <button onClick={() => onZoomChange(Math.max(0.25, Number((zoom - 0.1).toFixed(2))))} className="px-2 py-1 text-sm bg-slate-900 text-slate-200 border border-slate-700 rounded hover:bg-slate-800">-</button>
          <span className="text-xs text-gray-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => onZoomChange(Math.min(2.5, Number((zoom + 0.1).toFixed(2))))} className="px-2 py-1 text-sm bg-slate-900 text-slate-200 border border-slate-700 rounded hover:bg-slate-800">+</button>
          <button onClick={fitToScreen} className="px-2 py-1 text-xs bg-slate-900 text-slate-200 border border-slate-700 rounded hover:bg-slate-800">Fit</button>
        </div>

        <button
          type="button"
          onClick={() => {
            const plantCount = placedPlants.filter(item => (item.itemType || 'plant') === 'plant').length;
            if (plantCount > 0 && confirm(`Clear ${plantCount} plants from the plan? Rocks and zones will stay.`)) {
              onClearPlacedPlants();
            }
          }}
          disabled={placedPlants.filter(item => (item.itemType || 'plant') === 'plant').length === 0}
          className="px-3 py-1.5 text-sm bg-red-500/15 text-red-200 rounded hover:bg-red-500/25 disabled:opacity-50 border border-red-500/30"
          title="Remove all plants, keeping rocks, zones, background, and scale"
        >
          Clear plants
        </button>

        {!pixelsPerFoot && !isSettingScale && placedPlants.length > 0 && (
          <div className="text-xs text-amber-200 bg-amber-500/15 border border-amber-500/20 px-2 py-1 rounded">
            Scale not set, using default size
          </div>
        )}
      </div>

      <div
        ref={viewportRef}
        onMouseDown={handleViewportMouseDown}
        onMouseMove={handleViewportMouseMove}
        onMouseUp={stopViewportPan}
        onMouseLeave={stopViewportPan}
        className={`relative flex-1 bg-[#d9dde3] overflow-auto p-6 ${panDrag ? 'cursor-grabbing' : isSpacePanning ? 'cursor-grab' : isDrawingZone || selectedPlant || placingRock ? 'cursor-crosshair' : 'cursor-default'}`}
      >
        <div
          ref={worldRef}
          data-debug-map-canvas="true"
          onClick={handleCanvasClick}
          onMouseDownCapture={handleWorldMouseDown}
          onMouseMove={handleWorldMouseMove}
          className="relative bg-gray-100 shadow-lg border overflow-hidden"
          style={{
            width: canvasWorldSize.width,
            height: canvasWorldSize.height,
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
            backgroundSize: '100% 100%',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            marginRight: canvasWorldSize.width * (zoom - 1),
            marginBottom: canvasWorldSize.height * (zoom - 1),
          }}
        >
          {backgroundImage && backgroundOpacity < 1 && (
            <div className="absolute inset-0 bg-gray-100 pointer-events-none" style={{ opacity: 1 - backgroundOpacity }} />
          )}

          {isSettingScale && scalePoint1 && (
            <div className="absolute w-3 h-3 bg-red-500 rounded-full -translate-x-1/2 -translate-y-1/2 z-30" style={{ left: scalePoint1.x, top: scalePoint1.y }} />
          )}
          {isSettingScale && scalePoint2 && (
            <div className="absolute w-3 h-3 bg-red-500 rounded-full -translate-x-1/2 -translate-y-1/2 z-30" style={{ left: scalePoint2.x, top: scalePoint2.y }} />
          )}
          {isSettingScale && scalePoint1 && scalePoint2 && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
              <line x1={scalePoint1.x} y1={scalePoint1.y} x2={scalePoint2.x} y2={scalePoint2.y} stroke="red" strokeWidth="2" strokeDasharray="5,5" />
            </svg>
          )}

          {zoneShapesVisible && visibleZones.length > 0 && (
            <svg className="absolute inset-0 w-full h-full z-[5]" style={{ pointerEvents: isDrawingZone ? 'none' : 'auto' }}>
              {visibleZones.map(zone => {
                const isSelectedZone = zone.id === selectedZoneId;
                return (
                  <g key={zone.id}>
                    <polygon
                      points={zonePointsToString(zone.points)}
                      fill={zone.color}
                      fillOpacity={zone.zoneType === 'exclusion' ? Math.max(0.16, zone.opacity ?? 0.28) : zone.opacity ?? 0.28}
                      stroke={zone.color}
                      strokeWidth={isSelectedZone ? 4 : 2}
                      strokeDasharray={zone.zoneType === 'exclusion' ? '3 4' : isSelectedZone ? '0' : '6 5'}
                      className={isSelectedZone ? "cursor-move" : "cursor-pointer"}
                      onMouseDown={(event) => {
                        if (isDrawingZone || event.button !== 0) return;
                        event.stopPropagation();
                        const point = getWorldPoint(event.clientX, event.clientY);
                        if (!point) return;
                        onSelectPlacedPlant(null);
                        onSelectZone(zone.id);
                        setDraggingPlant(null);
                        setDraggingZonePoint(null);
                        setDraggingZone({
                          zoneId: zone.id,
                          startPoint: point,
                          originalPoints: zone.points.map(zonePoint => ({ ...zonePoint })),
                        });
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectPlacedPlant(null);
                        onSelectZone(zone.id);
                      }}
                    />
                    {isSelectedZone && zone.zoneType !== 'exclusion' && zone.points.map((point, edgeIndex) => {
                      const nextPoint = zone.points[(edgeIndex + 1) % zone.points.length];
                      const role = getZoneEdgeRole(zone, edgeIndex);
                      const stroke = role === 'front' ? '#2563eb' : role === 'back' ? '#dc2626' : '#f59e0b';
                      const label = role === 'front' ? 'front' : role === 'back' ? 'back' : 'click edge';
                      const midX = (point.x + nextPoint.x) / 2;
                      const midY = (point.y + nextPoint.y) / 2;
                      return (
                        <g key={`edge-role-${zone.id}-${edgeIndex}`}>
                          <line
                            x1={point.x}
                            y1={point.y}
                            x2={nextPoint.x}
                            y2={nextPoint.y}
                            stroke="transparent"
                            strokeWidth={26}
                            strokeLinecap="round"
                            className="cursor-pointer"
                            onMouseDown={(event) => {
                              if (isDrawingZone || event.button !== 0) return;
                              event.stopPropagation();
                              const nextRole = nextZoneEdgeRole(role);
                              onUpdateZone(zone.id, { edgeRoles: buildUpdatedEdgeRoles(zone, edgeIndex, nextRole) });
                              onSelectZone(zone.id);
                            }}
                          />
                          <line
                            x1={point.x}
                            y1={point.y}
                            x2={nextPoint.x}
                            y2={nextPoint.y}
                            stroke={stroke}
                            strokeWidth={role ? 7 : 5}
                            strokeLinecap="round"
                            opacity={role ? 0.9 : 0.55}
                            className="pointer-events-none"
                          />
                          <text
                            x={midX}
                            y={midY - 6}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="pointer-events-none select-none text-[9px] font-bold"
                            fill={stroke}
                            paintOrder="stroke"
                            stroke="white"
                            strokeWidth="3"
                          >
                            {label}
                          </text>
                        </g>
                      );
                    })}
                    {zone.zoneType === 'exclusion' && (
                      <text
                        x={zone.points.reduce((sum, point) => sum + point.x, 0) / zone.points.length}
                        y={(zone.points.reduce((sum, point) => sum + point.y, 0) / zone.points.length) + 16}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="pointer-events-none select-none text-[10px] font-semibold"
                        fill="#991b1b"
                        paintOrder="stroke"
                        stroke="white"
                        strokeWidth="3"
                      >
                        no plants
                      </text>
                    )}
                    {zone.points.length > 0 && (
                      <text
                        x={zone.points.reduce((sum, point) => sum + point.x, 0) / zone.points.length}
                        y={zone.points.reduce((sum, point) => sum + point.y, 0) / zone.points.length}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="pointer-events-none select-none text-xs font-semibold"
                        fill="#111827"
                        paintOrder="stroke"
                        stroke="white"
                        strokeWidth="4"
                      >
                        {zone.name}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          )}

          {zoneShapesVisible && selectedZone && selectedZone.visible !== false && (
            <div className="absolute inset-0 z-[26] pointer-events-none">
              {selectedZone.points.map((point, index) => {
                const nextPoint = selectedZone.points[(index + 1) % selectedZone.points.length];
                const midPoint = { x: (point.x + nextPoint.x) / 2, y: (point.y + nextPoint.y) / 2 };
                return (
                  <button
                    key={`${selectedZone.id}-mid-${index}`}
                    type="button"
                    className="absolute w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow pointer-events-auto cursor-copy -translate-x-1/2 -translate-y-1/2"
                    style={{ left: midPoint.x, top: midPoint.y }}
                    title="Click to add a zone point here"
                    onClick={(event) => {
                      event.stopPropagation();
                      insertZonePoint(selectedZone.id, index, midPoint);
                    }}
                  />
                );
              })}
              {selectedZone.points.map((point, index) => (
                <button
                  key={`${selectedZone.id}-${index}`}
                  type="button"
                  className="absolute w-4 h-4 rounded-full bg-white border-2 border-blue-600 shadow pointer-events-auto cursor-move -translate-x-1/2 -translate-y-1/2"
                  style={{ left: point.x, top: point.y }}
                  title="Drag to edit. Shift-click to remove this point."
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    onSelectZone(selectedZone.id);
                    if (event.shiftKey) {
                      removeZonePoint(selectedZone.id, index);
                      return;
                    }
                    setDraggingZonePoint({ zoneId: selectedZone.id, pointIndex: index });
                  }}
                />
              ))}
            </div>
          )}

          {isDrawingZone && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-[28]">
              {zoneDraftPoints.length > 0 && (
                <polyline
                  points={zonePointsToString(zonePreviewPoint ? [...zoneDraftPoints, zonePreviewPoint] : zoneDraftPoints)}
                  fill="none"
                  stroke="#7c3aed"
                  strokeWidth="3"
                  strokeDasharray="6 5"
                />
              )}
              {canFinishZone && zoneDraftPoints.length > 0 && zonePreviewPoint && (
                <line x1={zonePreviewPoint.x} y1={zonePreviewPoint.y} x2={zoneDraftPoints[0].x} y2={zoneDraftPoints[0].y} stroke="#22c55e" strokeWidth="2" strokeDasharray="3 5" />
              )}
              {zoneDraftPoints.map((point, index) => (
                <circle
                  key={index}
                  cx={point.x}
                  cy={point.y}
                  r={index === 0 && canFinishZone ? 8 : 5}
                  fill={index === 0 && canFinishZone ? '#22c55e' : '#7c3aed'}
                  stroke="white"
                  strokeWidth="2"
                />
              ))}
            </svg>
          )}


          {plantDriftClusters.map((cluster) => {
            const plant = getPlantById(cluster.plantId);
            if (!plant) return null;
            const clusterHasSelection = cluster.members.some((member) => selectedInstanceId === member.instanceId || selectedInstanceIds.includes(member.instanceId));
            return (
              <PlantDriftOverlay
                key={`drift-${cluster.key}`}
                cluster={cluster}
                plant={plant}
                circleOpacity={plantCircleOpacity}
                labelMode={plantLabelMode}
                legendNumber={legendNumbers.get(cluster.plantId) || 0}
                placementIndex={Math.max(0, (legendNumbers.get(cluster.plantId) || 1) - 1)}
                isSelected={clusterHasSelection}
              />
            );
          })}

          {placedPlants.map((placed) => {
            const isSelected = selectedInstanceId === placed.instanceId || selectedInstanceIds.includes(placed.instanceId);

            if (placed.itemType === 'rock') {
              return (
                <RockIcon
                  key={placed.instanceId}
                  placed={placed}
                  sizePx={getRockSizePx(placed)}
                  isSelected={isSelected}
                  onMouseDown={(e) => handleMouseDown(e, placed.instanceId)}
                />
              );
            }

            const plant = getPlantById(placed.plantId);
            if (!plant) return null;
            const radius = getPlacedItemRadius(placed);
            const isDrifted = driftedInstanceIds.has(placed.instanceId);

            if (isDrifted) {
              const symbolSize = Math.max(radius * 2, 10);
              return (
                <div
                  key={placed.instanceId}
                  onMouseDown={(e) => handleMouseDown(e, placed.instanceId)}
                  className={`absolute cursor-move select-none ${isSelected ? 'z-20' : 'z-10'}`}
                  style={{
                    left: placed.x,
                    top: placed.y,
                    transform: 'translate(-50%, -50%)',
                    width: symbolSize,
                    height: symbolSize,
                    background: 'transparent',
                  }}
                  title={`${plant.commonName || plant.botanicalName}\n${placed.displayWidthFt || plant.matureWidthFt || '?'}' display width${placed.displayWidthFt ? ` (mature ${plant.matureWidthFt || '?'}')` : ''}\nZone: ${placed.zone || 'none'}`}
                >
                  {isSelected && (
                    <div
                      className="absolute pointer-events-none rounded-full border-[3px] border-blue-500 shadow-[0_0_0_2px_rgba(255,255,255,0.9)]"
                      style={{ inset: -6 }}
                    />
                  )}
                </div>
              );
            }

            return (
              <PlantCircle
                key={placed.instanceId}
                plant={plant}
                placed={placed}
                radius={radius}
                isSelected={isSelected}
                circleOpacity={plantCircleOpacity}
                labelMode={plantLabelMode}
                legendNumber={legendNumbers.get(placed.plantId) || 0}
                placementIndex={Math.max(0, (legendNumbers.get(placed.plantId) || 1) - 1)}
                onMouseDown={(e) => handleMouseDown(e, placed.instanceId)}
                drifted={false}
              />
            );
          })}
          {plantLabelMode === 'callouts' && groupedCallouts.map((callout) => (
            <div key={`callout-${callout.key}`} className="absolute inset-0 pointer-events-none z-30">
              <svg className="absolute inset-0 overflow-visible">
                <line
                  x1={callout.anchorX}
                  y1={callout.anchorY}
                  x2={callout.lineToX}
                  y2={callout.lineToY}
                  stroke="rgba(255,255,255,0.98)"
                  strokeWidth="3.4"
                />
                <line
                  x1={callout.anchorX}
                  y1={callout.anchorY}
                  x2={callout.lineToX}
                  y2={callout.lineToY}
                  stroke="rgba(17,24,39,0.76)"
                  strokeWidth="1.35"
                />
              </svg>
              <div
                className="absolute bg-white border border-gray-500 rounded px-1.5 py-0.5 text-[10px] font-semibold text-gray-950 whitespace-nowrap shadow-md"
                style={{ left: callout.labelX, top: callout.labelY, width: callout.labelWidth }}
              >
                {callout.label}
              </div>
            </div>
          ))}


          {marqueeSelection && (() => {
            const rect = getMarqueeRect(marqueeSelection);
            return (
              <div
                className="absolute border-2 border-blue-500 bg-blue-500/10 z-40 pointer-events-none"
                style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
              />
            );
          })()}

          {placedPlants.length === 0 && zones.length === 0 && !isSettingScale && !isDrawingZone && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="pointer-events-auto flex max-w-lg flex-col items-center rounded-2xl border border-slate-300 bg-white/90 px-7 py-6 text-center shadow-sm backdrop-blur-sm">
                {!backgroundImage && (
                  <img src={`${import.meta.env.BASE_URL}brand/logo-light.svg`} alt="Plant Pending" className="mb-4 h-20 w-auto" />
                )}
                {backgroundImage ? (
                  <p className="text-sm text-slate-600">Select a plant or the Rock Tool from the left panel and click to place it</p>
                ) : (
                  <>
                    <p className="mb-1 text-base font-semibold text-slate-800">
                      <label className="cursor-pointer text-emerald-700 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-800">
                        Upload a top-down image of your yard
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                      </label>
                      <span>, </span>
                      <button type="button" onClick={onLoadExamplePlan} className="text-emerald-700 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-800">
                        load an example plan
                      </button>
                      <span>, or start drawing zones.</span>
                    </p>
                    <p className="text-sm text-slate-600">Plant Pending is standing by with strong opinions and probably a shrub.</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {isSettingScale && !scalePoint1 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-30 pointer-events-none">
            <div className="bg-white px-8 py-6 rounded-lg shadow-lg text-center">
              <p className="text-lg font-medium mb-2">Set Scale</p>
              <p className="text-sm text-gray-600">Click two points on the plan to measure a known distance</p>
            </div>
          </div>
        )}
        {isSettingScale && scalePoint1 && !scalePoint2 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded shadow-lg z-30 pointer-events-none">
            <p className="text-sm">Click the second point</p>
          </div>
        )}
      </div>

      {showScaleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-medium mb-4">Enter Distance</h3>
            <p className="text-sm text-gray-600 mb-4">
              The line you drew is {scaleLinePixels.toFixed(0)} pixels long. How many feet does this represent in real life?
            </p>
            <form onSubmit={handleScaleSubmit}>
              <input type="number" name="feet" min="0.1" step="0.1" placeholder="Distance in feet" className="w-full px-3 py-2 border rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
              <div className="flex gap-2">
                <button type="button" onClick={cancelScaleSetting} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Set Scale</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

