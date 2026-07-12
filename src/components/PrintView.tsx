// PrintView component - printable plan set for Plant Pending

import { Fragment, useMemo, useRef, useState } from 'react';
import { Plant, PlacedPlant, GardenZone, PlantLabelMode, PlantClumpStrength } from '../types/plant';
import { getPlantImageUrl, getPlantCategoryColor, getPlacedPlantColor, getPlantSymbolColor, hasPlantImage, hasPlantSymbol } from '../utils/imageUtils';
import { TopDownPlantSymbol } from './TopDownPlantSymbol';

interface PrintViewProps {
  plants: Plant[];
  placedPlants: PlacedPlant[];
  zones: GardenZone[];
  planName: string;
  notes: string;
  backgroundImage: string | null;
  backgroundOpacity: number;
  pixelsPerFoot: number | null;
  canvasSize: { width: number; height: number };
  plantCircleOpacity: number;
  plantLabelMode: PlantLabelMode;
  plantClumpingEnabled: boolean;
  plantClumpStrength: PlantClumpStrength;
  onClose: () => void;
}

interface PlantCountGroup {
  plant: Plant;
  count: number;
  instances: PlacedPlant[];
}

interface PriceRange {
  min: number;
  max: number;
  known: number;
}

type Point = { x: number; y: number };

type PrintPaperSize = 'letter' | 'tabloid';

type MapBounds = { minX: number; minY: number; maxX: number; maxY: number };

function getPlantById(plants: Plant[], id: number): Plant | undefined {
  return plants.find(p => p.id === id);
}

function getDisplayMode(placed: PlacedPlant, plant: Plant) {
  return placed.displayMode || (hasPlantSymbol(plant) ? 'symbolLabel' : hasPlantImage(plant) ? 'imageLabel' : 'color');
}

function parsePriceRange(priceText?: string | null): { min: number; max: number } | null {
  if (!priceText) return null;
  const numbers = Array.from(priceText.matchAll(/\$?([0-9]+(?:\.[0-9]{1,2})?)/g))
    .map(match => Number(match[1]))
    .filter(value => Number.isFinite(value));
  if (numbers.length === 0) return null;
  return { min: Math.min(...numbers), max: Math.max(...numbers) };
}

function formatPrice(range: { min: number; max: number } | null | undefined): string {
  if (!range) return '—';
  if (range.min === range.max) return `$${range.min.toFixed(2)}`;
  return `$${range.min.toFixed(2)}–$${range.max.toFixed(2)}`;
}

function formatTotal(range: PriceRange): string {
  if (range.known === 0) return '$0';
  return formatPrice(range);
}

function addPrice(total: PriceRange, price: { min: number; max: number } | null, count = 1): PriceRange {
  if (!price) return total;
  return {
    min: total.min + price.min * count,
    max: total.max + price.max * count,
    known: total.known + count,
  };
}

function getPlantUnitPrice(plant: Plant) {
  return parsePriceRange(plant.greenAcresPriceText);
}

function getPlantSubtotal(plant: Plant, count: number) {
  const price = getPlantUnitPrice(plant);
  if (!price) return null;
  return { min: price.min * count, max: price.max * count };
}

function getWaterText(plant: Plant): string {
  const rating = plant.waterwiseRating;
  if (rating === null || rating === undefined) return 'Unknown';
  if (rating >= 8) return 'Low';
  if (rating >= 5) return 'Medium';
  return 'High';
}

function getSunText(plant: Plant): string {
  const flags = new Set(plant.greenAcresScoreFlags || []);
  if (flags.has('full_sun')) return 'Full sun';
  if (flags.has('shade_tolerant')) return 'Part shade / shade';
  return 'Varies';
}

function getSizeText(plant: Plant): string {
  return `${plant.matureHeightFt || '?'}' × ${plant.matureWidthFt || '?'}'`;
}

function getZoneArea(points: Point[], pixelsPerFoot: number | null): string {
  if (!points || points.length < 3) return '—';
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
  }
  const pxArea = Math.abs(area / 2);
  if (!pixelsPerFoot) return `${Math.round(pxArea).toLocaleString()} px²`;
  return `${Math.round(pxArea / (pixelsPerFoot * pixelsPerFoot)).toLocaleString()} sq ft`;
}

function getBounds(points: Point[]): MapBounds {
  if (!points.length) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return {
    minX: Math.min(...points.map(point => point.x)),
    minY: Math.min(...points.map(point => point.y)),
    maxX: Math.max(...points.map(point => point.x)),
    maxY: Math.max(...points.map(point => point.y)),
  };
}

function inflateBounds(bounds: MapBounds, padding: number, fallbackWidth: number, fallbackHeight: number): MapBounds {
  return {
    minX: Math.max(0, bounds.minX - padding),
    minY: Math.max(0, bounds.minY - padding),
    maxX: Math.min(fallbackWidth, bounds.maxX + padding),
    maxY: Math.min(fallbackHeight, bounds.maxY + padding),
  };
}


const PRINT_FOOTER_MESSAGES = [
  'Probably needs a shrub.',
  'Your plants remain safely theoretical.',
  'The rocks are doing great.',
  'The yard has not gotten any larger.',
  'Future pruning detected, politely ignored.',
  'The nursery has been warned.',
  'Everything is currently where you left it.',
  'Plant Pending: still cheaper than guessing in real life.',
];

function getFooterMessage(pageIndex: number): string {
  return PRINT_FOOTER_MESSAGES[pageIndex % PRINT_FOOTER_MESSAGES.length];
}

function PrintFooter({ pageIndex }: { pageIndex: number }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-2 text-[10px] text-slate-500">
      <div className="flex items-center gap-2 text-slate-700">
        <img src={`${import.meta.env.BASE_URL}brand/logo.svg`} alt="Plant Pending" className="h-5 w-auto" />
      </div>
      <div className="flex-1 text-center italic">{getFooterMessage(pageIndex)}</div>
      <div className="shrink-0">Probably needs a shrub.</div>
    </div>
  );
}

function ZonePhotoGrid({ plantGroups, legendNumbers }: { plantGroups: PlantCountGroup[]; legendNumbers: Map<number, number> }) {
  if (plantGroups.length === 0) return null;
  return (
    <div className="mt-0">
      <h2 className="mb-2 text-base font-bold">Plant images in this zone</h2>
      <div className="grid grid-cols-4 gap-3">
        {plantGroups.slice(0, 12).map(group => {
          const image = getPlantImageUrl(group.plant);
          return (
            <div key={group.plant.id} className="break-inside-avoid overflow-hidden rounded-xl border border-slate-300 bg-slate-50">
              <div className="h-28 bg-slate-200">
                {image ? <img src={image} alt={group.plant.commonName || group.plant.botanicalName} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-slate-500">No image</div>}
              </div>
              <div className="p-2 text-[11px] leading-tight">
                <div className="font-bold">#{legendNumbers.get(group.plant.id)} {group.plant.commonName || group.plant.botanicalName}</div>
                <div className="mt-1 text-slate-500">Qty {group.count} · {getSizeText(group.plant)}</div>
              </div>
            </div>
          );
        })}
      </div>
      {plantGroups.length > 12 && <p className="mt-2 text-xs text-slate-500">Plus {plantGroups.length - 12} more plant types in this zone. The schedule has the full list.</p>}
    </div>
  );
}

function PlantSymbol({ plant, placed, size = 28, legendNumber, placementIndex = 0 }: { plant: Plant; placed?: PlacedPlant; size?: number; legendNumber?: number; placementIndex?: number }) {
  const imageUrl = getPlantImageUrl(plant);
  const displayMode = placed ? getDisplayMode(placed, plant) : (hasPlantSymbol(plant) ? 'symbolLabel' : hasPlantImage(plant) ? 'imageLabel' : 'color');
  const color = placed ? getPlacedPlantColor(plant, placed, placementIndex) : getPlantSymbolColor(plant) || getPlantCategoryColor(plant);
  const showSymbol = displayMode === 'symbol' || displayMode === 'symbolLabel';
  const showImage = !showSymbol && displayMode !== 'color' && !!imageUrl;

  return (
    <div
      className={`relative overflow-visible flex items-center justify-center flex-shrink-0 ${showImage || !showSymbol ? 'rounded-full border border-slate-300' : ''}`}
      style={{ width: size, height: size, backgroundColor: showImage || !showSymbol ? color : 'transparent' }}
      title={plant.commonName || plant.botanicalName}
    >
      {showSymbol && placed && (
        <TopDownPlantSymbol
          plant={plant}
          placed={placed}
          size={size}
          placementIndex={placementIndex}
          circleOpacity={0.58}
          labelMode={legendNumber ? 'numbers' : 'none'}
          legendNumber={legendNumber || 0}
        />
      )}
      {showImage && (
        <img src={imageUrl!} alt={plant.commonName || plant.botanicalName} className="absolute inset-0 w-full h-full object-cover rounded-full" />
      )}
    </div>
  );
}

function PlanMap({
  plants,
  placedPlants,
  zones,
  backgroundImage,
  backgroundOpacity,
  pixelsPerFoot,
  canvasSize,
  plantCircleOpacity,
  legendNumbers,
  cropBounds,
  height = 520,
  showOnlyZoneId,
}: {
  plants: Plant[];
  placedPlants: PlacedPlant[];
  zones: GardenZone[];
  backgroundImage: string | null;
  backgroundOpacity: number;
  pixelsPerFoot: number | null;
  canvasSize: { width: number; height: number };
  plantCircleOpacity: number;
  legendNumbers: Map<number, number>;
  cropBounds?: MapBounds;
  height?: number;
  showOnlyZoneId?: string;
}) {
  const liveWidth = Math.max(canvasSize.width || 900, 300);
  const liveHeight = Math.max(canvasSize.height || 650, 300);
  const bounds = cropBounds || { minX: 0, minY: 0, maxX: liveWidth, maxY: liveHeight };
  const boundsWidth = Math.max(bounds.maxX - bounds.minX, 1);
  const boundsHeight = Math.max(bounds.maxY - bounds.minY, 1);
  const maxMapWidth = showOnlyZoneId ? 560 : 920;
  const minMapWidth = showOnlyZoneId ? 260 : 420;
  const mapWidth = Math.min(maxMapWidth, Math.max(minMapWidth, (boundsWidth / boundsHeight) * height));
  const scale = Math.min(mapWidth / boundsWidth, height / boundsHeight);
  const frameWidth = boundsWidth * scale;
  const frameHeight = boundsHeight * scale;

  const visiblePlants = showOnlyZoneId ? placedPlants.filter(placed => placed.zone === showOnlyZoneId) : placedPlants;
  const visibleZones = showOnlyZoneId ? zones.filter(zone => zone.id === showOnlyZoneId && zone.zoneType !== 'exclusion') : zones.filter(zone => zone.zoneType !== 'exclusion');

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-300 bg-slate-100" style={{ width: frameWidth, height: frameHeight }}>
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: liveWidth,
          height: liveHeight,
          transform: `translate(${-bounds.minX * scale}px, ${-bounds.minY * scale}px) scale(${scale})`,
        }}
      >
        {backgroundImage && (
          <div
            className="absolute inset-0"
            style={{ backgroundImage: `url(${backgroundImage})`, backgroundSize: '100% 100%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
          />
        )}
        {backgroundImage && backgroundOpacity < 1 && (
          <div className="absolute inset-0 bg-slate-100 pointer-events-none" style={{ opacity: 1 - backgroundOpacity }} />
        )}

        <svg className="absolute inset-0 overflow-visible" width={liveWidth} height={liveHeight}>
          {visibleZones.map(zone => (
            <polygon
              key={zone.id}
              points={zone.points.map(point => `${point.x},${point.y}`).join(' ')}
              fill={zone.color || '#22c55e'}
              fillOpacity={Math.max(0.12, Math.min(zone.opacity || 0.28, 0.5))}
              stroke={zone.color || '#22c55e'}
              strokeWidth={showOnlyZoneId ? 3 : 2}
            />
          ))}
        </svg>

        {visiblePlants.map((placed, index) => {
          const plant = getPlantById(plants, placed.plantId);
          if (!plant) return null;
          if ((placed.itemType || 'plant') === 'rock') {
            const rockSize = Math.max((pixelsPerFoot || 20) * (placed.rockSizeFt || 2), 20);
            return (
              <div
                key={placed.instanceId}
                className="absolute flex items-center justify-center rounded-full border border-slate-600 shadow-sm"
                style={{
                  left: placed.x,
                  top: placed.y,
                  width: rockSize,
                  height: rockSize,
                  transform: `translate(-50%, -50%) rotate(${placed.rotationDeg || 0}deg)`,
                  background: placed.rockColor || '#9ca3af',
                }}
              />
            );
          }
          const radius = Math.max(((pixelsPerFoot || 20) * (placed.displayWidthFt || plant.matureWidthFt || 3)) / 2, 7);
          const baseColor = getPlacedPlantColor(plant, placed, index) || getPlantCategoryColor(plant);
          const imageUrl = getPlantImageUrl(plant);
          const displayMode = getDisplayMode(placed, plant);
          const showSymbol = displayMode === 'symbol' || displayMode === 'symbolLabel';
          const showImage = !showSymbol && displayMode !== 'color' && !!imageUrl;
          const legendNumber = legendNumbers.get(plant.id) || 0;
          return (
            <div
              key={placed.instanceId}
              className={`absolute overflow-visible flex items-center justify-center ${showSymbol ? '' : 'rounded-full'}`}
              style={{
                left: placed.x,
                top: placed.y,
                transform: 'translate(-50%, -50%)',
                width: Math.max(radius * 2, 18),
                height: Math.max(radius * 2, 18),
                backgroundColor: showSymbol ? 'transparent' : baseColor,
                opacity: showSymbol ? 1 : plantCircleOpacity,
                border: showSymbol ? '0' : '2px solid white',
                outline: showSymbol ? '0' : '1px solid rgba(0,0,0,0.28)',
              }}
            >
              {showSymbol && (
                <TopDownPlantSymbol
                  plant={plant}
                  placed={placed}
                  size={Math.max(radius * 2, 18)}
                  placementIndex={Math.max(0, (legendNumbers.get(plant.id) || 1) - 1)}
                  circleOpacity={plantCircleOpacity}
                  labelMode="numbers"
                  legendNumber={legendNumber}
                />
              )}
              {showImage && <img src={imageUrl!} alt={plant.commonName || plant.botanicalName} className="absolute inset-0 h-full w-full rounded-full object-cover" />}
              {!showSymbol && legendNumber > 0 && (
                <span className="relative z-10 text-xs font-bold text-slate-950" style={{ textShadow: '0 1px 0 white' }}>{legendNumber}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PrintView({
  plants,
  placedPlants,
  zones,
  planName,
  notes,
  backgroundImage,
  backgroundOpacity,
  pixelsPerFoot,
  canvasSize,
  plantCircleOpacity,
  onClose,
}: PrintViewProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [printPaperSize, setPrintPaperSize] = useState<PrintPaperSize>('letter');

  const paperSettings = printPaperSize === 'tabloid'
    ? {
        label: '11×17 tabloid landscape',
        pageCss: '17in 11in',
        pageWidthIn: 16.4,
        pageHeightIn: 10.4,
        pagePaddingIn: 0.32,
        masterMapHeight: 690,
        zoneMapHeight: 520,
        masterSideWidth: '4.15in',
        zoneSideWidth: '5.35in',
        zonePhotoLimit: 999,
      }
    : {
        label: 'Letter landscape',
        pageCss: 'letter landscape',
        pageWidthIn: 10.5,
        pageHeightIn: 8.0,
        pagePaddingIn: 0.22,
        masterMapHeight: 485,
        zoneMapHeight: 385,
        masterSideWidth: '3.25in',
        zoneSideWidth: '3.75in',
        zonePhotoLimit: 999,
      };

  const pageStyle = {
    width: `${paperSettings.pageWidthIn}in`,
    minHeight: `${paperSettings.pageHeightIn}in`,
    height: `${paperSettings.pageHeightIn}in`,
    maxHeight: `${paperSettings.pageHeightIn}in`,
    padding: `${paperSettings.pagePaddingIn}in`,
    boxSizing: 'border-box' as const,
  };

  const plantCounts = useMemo(() => {
    const groups: PlantCountGroup[] = [];
    for (const placed of placedPlants) {
      if ((placed.itemType || 'plant') === 'rock') continue;
      const plant = getPlantById(plants, placed.plantId);
      if (!plant) continue;
      const existing = groups.find(group => group.plant.id === plant.id);
      if (existing) {
        existing.count += 1;
        existing.instances.push(placed);
      } else {
        groups.push({ plant, count: 1, instances: [placed] });
      }
    }
    return groups.sort((a, b) => (a.plant.commonName || '').localeCompare(b.plant.commonName || ''));
  }, [plants, placedPlants]);

  const legendNumbers = useMemo(() => {
    const map = new Map<number, number>();
    plantCounts.forEach((group, index) => map.set(group.plant.id, index + 1));
    return map;
  }, [plantCounts]);

  const totalCost = useMemo(() => plantCounts.reduce((total, group) => addPrice(total, getPlantUnitPrice(group.plant), group.count), { min: 0, max: 0, known: 0 }), [plantCounts]);

  const zoneSummaries = useMemo(() => zones.filter(zone => zone.zoneType !== 'exclusion').map(zone => {
    const zonePlants = placedPlants.filter(placed => placed.zone === zone.id && (placed.itemType || 'plant') !== 'rock');
    const zoneRocks = placedPlants.filter(placed => placed.zone === zone.id && (placed.itemType || 'plant') === 'rock');
    const plantGroups: PlantCountGroup[] = [];
    for (const placed of zonePlants) {
      const plant = getPlantById(plants, placed.plantId);
      if (!plant) continue;
      const existing = plantGroups.find(group => group.plant.id === plant.id);
      if (existing) {
        existing.count += 1;
        existing.instances.push(placed);
      } else {
        plantGroups.push({ plant, count: 1, instances: [placed] });
      }
    }
    const cost = plantGroups.reduce((total, group) => addPrice(total, getPlantUnitPrice(group.plant), group.count), { min: 0, max: 0, known: 0 });
    return { zone, zonePlants, zoneRocks, plantGroups, cost };
  }), [zones, placedPlants, plants]);

  const unassignedPlants = placedPlants.filter(placed => !placed.zone && (placed.itemType || 'plant') !== 'rock');
  const dated = new Date().toLocaleDateString();

  const handlePrint = () => window.print();

  return (
    <div className="print-shell fixed inset-0 z-[80] flex flex-col bg-black/60">
      <style>{`
        @page { size: ${paperSettings.pageCss}; margin: 0.25in; }

        @media print {
          html, body, #root {
            margin: 0 !important;
            padding: 0 !important;
            width: auto !important;
            min-height: 0 !important;
            height: auto !important;
            overflow: visible !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body * { visibility: hidden; }

          .print-shell,
          .print-shell *,
          #print-content,
          #print-content * {
            visibility: visible !important;
          }

          .print-shell {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            inset: auto !important;
            display: block !important;
            width: auto !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: white !important;
          }

          #print-content {
            position: static !important;
            display: block !important;
            width: auto !important;
            height: auto !important;
            min-height: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            background: white !important;
          }

          #print-content > div {
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .print-page {
            display: block !important;
            width: ${paperSettings.pageWidthIn}in !important;
            height: ${paperSettings.pageHeightIn}in !important;
            min-height: ${paperSettings.pageHeightIn}in !important;
            max-height: ${paperSettings.pageHeightIn}in !important;
            padding: ${paperSettings.pagePaddingIn}in !important;
            box-sizing: border-box !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid-page !important;
            overflow: hidden !important;
          }

          .print-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          .print-hidden { display: none !important; }
        }
      `}</style>

      <div className="print-hidden flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3 text-slate-100">
        <div>
          <h2 className="text-base font-semibold">Print Plan Builder</h2>
          <p className="text-xs text-slate-400">Master plan, zone sheets, plant schedule, costs, and photo sheet.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200">
            <span className="text-xs uppercase tracking-wide text-slate-500">Paper</span>
            <select
              value={printPaperSize}
              onChange={(e) => setPrintPaperSize(e.target.value as PrintPaperSize)}
              className="bg-transparent text-sm font-semibold text-white focus:outline-none"
            >
              <option className="bg-slate-900" value="letter">Letter</option>
              <option className="bg-slate-900" value="tabloid">11×17</option>
            </select>
          </label>
          <button onClick={handlePrint} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Print</button>
          <button onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">Close</button>
        </div>
      </div>

      <div ref={printRef} id="print-content" className="flex-1 overflow-auto bg-slate-200 p-6">
        <div className="mx-auto space-y-6">
          <section className="print-page mx-auto bg-white text-slate-950 shadow-2xl" style={pageStyle}>
            <div className="mb-3 flex items-start justify-between border-b border-slate-300 pb-3">
              <div className="flex items-start gap-4">
                <img src={`${import.meta.env.BASE_URL}brand/logo.svg`} alt="Plant Pending" className="h-16 w-auto" />
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-emerald-700">Plant Pending master plan</div>
                  <h1 className="mt-1 text-xl font-black">{planName || 'Untitled Planting Plan'}</h1>
                  <p className="mt-1 text-sm text-slate-600">Generated {dated} · {placedPlants.length} placed items · {zoneSummaries.length} planting zones</p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-right">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Estimated plant total</div>
                <div className="mt-1 text-xl font-black text-emerald-700">{formatTotal(totalCost)}</div>
                <div className="mt-1 text-xs text-slate-500">Known priced items: {totalCost.known}</div>
              </div>
            </div>

            <div className="grid gap-5" style={{ gridTemplateColumns: `minmax(0,1fr) ${paperSettings.masterSideWidth}` }}>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-lg font-bold">Overall plan</h2>
                  <div className="text-xs text-slate-500">Scale: {pixelsPerFoot ? `${pixelsPerFoot.toFixed(1)} px / ft` : 'not set'}</div>
                </div>
                <PlanMap
                  plants={plants}
                  placedPlants={placedPlants}
                  zones={zones}
                  backgroundImage={backgroundImage}
                  backgroundOpacity={backgroundOpacity}
                  pixelsPerFoot={pixelsPerFoot}
                  canvasSize={canvasSize}
                  plantCircleOpacity={plantCircleOpacity}
                  legendNumbers={legendNumbers}
                  height={paperSettings.masterMapHeight}
                />
              </div>

              <div className="space-y-4">
                <div>
                  <h2 className="mb-2 text-lg font-bold">Zones</h2>
                  <div className="space-y-1.5">
                    {zoneSummaries.length === 0 && <p className="text-sm text-slate-500">No zones drawn yet.</p>}
                    {zoneSummaries.map(({ zone, zonePlants, zoneRocks, cost }) => (
                      <div key={zone.id} className="rounded-xl border border-slate-300 p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 font-bold">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: zone.color }} />
                            {zone.name}
                          </div>
                          <div className="text-xs text-slate-500">{getZoneArea(zone.points, pixelsPerFoot)}</div>
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-600">{zonePlants.length} plants · {zoneRocks.length} rocks · {formatTotal(cost)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="mb-2 text-lg font-bold">Plant legend</h2>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {plantCounts.slice(0, printPaperSize === 'tabloid' ? 24 : 14).map((group) => (
                      <div key={group.plant.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{legendNumbers.get(group.plant.id)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold">{group.plant.commonName || group.plant.botanicalName}</div>
                          <div className="text-slate-500">Qty {group.count}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {plantCounts.length > (printPaperSize === 'tabloid' ? 24 : 14) && <p className="mt-2 text-xs text-slate-500">Full schedule continues on later pages.</p>}
                </div>
              </div>
            </div>
            <PrintFooter pageIndex={0} />
          </section>

          {zoneSummaries.map(({ zone, plantGroups, zonePlants, zoneRocks, cost }, zoneIndex) => {
            const zoneBounds = inflateBounds(getBounds(zone.points), 80, canvasSize.width || 900, canvasSize.height || 650);
            return (
            <Fragment key={zone.id}>
              <section className="print-page mx-auto bg-white text-slate-950 shadow-2xl" style={pageStyle}>
                <div className="mb-3 flex items-start justify-between border-b border-slate-300 pb-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-emerald-700">Zone detail sheet</div>
                    <h1 className="mt-1 text-xl font-black">{zone.name}</h1>
                    <p className="mt-1 text-sm text-slate-600">{zonePlants.length} plants · {zoneRocks.length} rocks · {getZoneArea(zone.points, pixelsPerFoot)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-right">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Zone plant cost</div>
                    <div className="mt-1 text-xl font-black text-emerald-700">{formatTotal(cost)}</div>
                  </div>
                </div>
                <div className="grid gap-5" style={{ gridTemplateColumns: `1fr ${paperSettings.zoneSideWidth}` }}>
                  <div>
                    <h2 className="mb-2 text-lg font-bold">Mini map</h2>
                    <PlanMap
                      plants={plants}
                      placedPlants={placedPlants}
                      zones={zones}
                      backgroundImage={backgroundImage}
                      backgroundOpacity={backgroundOpacity}
                      pixelsPerFoot={pixelsPerFoot}
                      canvasSize={canvasSize}
                      plantCircleOpacity={plantCircleOpacity}
                      legendNumbers={legendNumbers}
                      cropBounds={zoneBounds}
                      showOnlyZoneId={zone.id}
                      height={paperSettings.zoneMapHeight}
                    />
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2"><div className="text-[10px] uppercase text-slate-500">Sun</div><div className="font-bold">{zone.sunExposure || 'Unknown'}</div></div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2"><div className="text-[10px] uppercase text-slate-500">Water</div><div className="font-bold">{zone.waterNeed || 'No preference'}</div></div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2"><div className="text-[10px] uppercase text-slate-500">Fullness</div><div className="font-bold">{zone.density ?? 50}%</div></div>
                    </div>
                    {zone.notes && <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{zone.notes}</p>}
                  </div>
                  <div>
                    <h2 className="mb-2 text-lg font-bold">Zone plant list</h2>
                    {plantGroups.length === 0 ? (
                      <p className="text-sm text-slate-500">No plants in this zone.</p>
                    ) : (
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-left text-[10px] uppercase tracking-wide text-slate-600">
                            <th className="border border-slate-300 p-1.5">No.</th>
                            <th className="border border-slate-300 p-1.5">Plant</th>
                            <th className="border border-slate-300 p-1.5">Qty</th>
                            <th className="border border-slate-300 p-1.5">Size</th>
                            <th className="border border-slate-300 p-1.5">Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {plantGroups.map(group => (
                            <tr key={group.plant.id} className="break-inside-avoid">
                              <td className="border border-slate-300 p-1.5 text-center font-bold">{legendNumbers.get(group.plant.id)}</td>
                              <td className="border border-slate-300 p-1.5"><div className="font-semibold">{group.plant.commonName || group.plant.botanicalName}</div><div className="text-xs italic text-slate-500">{group.plant.botanicalName}</div></td>
                              <td className="border border-slate-300 p-1.5 text-center">{group.count}</td>
                              <td className="border border-slate-300 p-1.5">{getSizeText(group.plant)}</td>
                              <td className="border border-slate-300 p-1.5">{formatPrice(getPlantSubtotal(group.plant, group.count))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
                <PrintFooter pageIndex={zoneIndex * 2 + 1} />
              </section>
              {plantGroups.length > 0 && (
                <section className="print-page mx-auto bg-white text-slate-950 shadow-2xl" style={pageStyle}>
                  <div className="mb-3 flex items-start justify-between border-b border-slate-300 pb-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.22em] text-emerald-700">Zone plant photo sheet</div>
                      <h1 className="mt-1 text-xl font-black">{zone.name}</h1>
                      <p className="mt-1 text-sm text-slate-600">{plantGroups.length} unique plant types · {zonePlants.length} placed plants</p>
                    </div>
                    <img src={`${import.meta.env.BASE_URL}brand/app-icon-mark.svg`} alt="Plant Pending" className="h-10 w-10" />
                  </div>
                  <ZonePhotoGrid plantGroups={plantGroups.slice(0, paperSettings.zonePhotoLimit)} legendNumbers={legendNumbers} />
                  <PrintFooter pageIndex={zoneIndex * 2 + 2} />
                </section>
              )}
            </Fragment>
            );
          })}

          <section className="print-page mx-auto bg-white text-slate-950 shadow-2xl" style={pageStyle}>
            <div className="mb-3 flex items-start justify-between border-b border-slate-300 pb-3">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-emerald-700">Plant Pending plant schedule</div>
                <h1 className="mt-1 text-xl font-black">Shopping list and cost estimate</h1>
              </div>
              <img src={`${import.meta.env.BASE_URL}brand/app-icon-mark.svg`} alt="Plant Pending" className="h-10 w-10" />
            </div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-left text-[10px] uppercase tracking-wide text-slate-600">
                  <th className="border border-slate-300 p-1.5">No.</th>
                  <th className="border border-slate-300 p-1.5">Symbol</th>
                  <th className="border border-slate-300 p-1.5">Qty</th>
                  <th className="border border-slate-300 p-1.5">Plant</th>
                  <th className="border border-slate-300 p-1.5">Size</th>
                  <th className="border border-slate-300 p-1.5">Sun</th>
                  <th className="border border-slate-300 p-1.5">Water</th>
                  <th className="border border-slate-300 p-1.5">Unit price</th>
                  <th className="border border-slate-300 p-1.5">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {plantCounts.map(group => (
                  <tr key={group.plant.id} className="break-inside-avoid">
                    <td className="border border-slate-300 p-1.5 text-center font-bold">{legendNumbers.get(group.plant.id)}</td>
                    <td className="border border-slate-300 p-1.5"><PlantSymbol plant={group.plant} placed={group.instances[0]} legendNumber={legendNumbers.get(group.plant.id)} placementIndex={Math.max(0, (legendNumbers.get(group.plant.id) || 1) - 1)} /></td>
                    <td className="border border-slate-300 p-1.5 text-center font-bold">{group.count}</td>
                    <td className="border border-slate-300 p-1.5"><div className="font-semibold">{group.plant.commonName || group.plant.botanicalName}</div><div className="text-xs italic text-slate-500">{group.plant.botanicalName}</div></td>
                    <td className="border border-slate-300 p-1.5">{getSizeText(group.plant)}</td>
                    <td className="border border-slate-300 p-1.5">{getSunText(group.plant)}</td>
                    <td className="border border-slate-300 p-1.5">{getWaterText(group.plant)}</td>
                    <td className="border border-slate-300 p-1.5">{formatPrice(getPlantUnitPrice(group.plant))}</td>
                    <td className="border border-slate-300 p-1.5 font-semibold">{formatPrice(getPlantSubtotal(group.plant, group.count))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-300 bg-slate-50 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">Total plant estimate</div><div className="mt-1 text-xl font-black text-emerald-700">{formatTotal(totalCost)}</div></div>
              <div className="rounded-xl border border-slate-300 bg-slate-50 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">Unique plants</div><div className="mt-1 text-xl font-black">{plantCounts.length}</div></div>
              <div className="rounded-xl border border-slate-300 bg-slate-50 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">Total plant count</div><div className="mt-1 text-xl font-black">{plantCounts.reduce((sum, group) => sum + group.count, 0)}</div></div>
            </div>
            <p className="mt-4 text-xs text-slate-500">Prices are planning estimates from the catalog where available. Call the nursery to confirm current inventory, price, and container size.</p>
            <PrintFooter pageIndex={zoneSummaries.length * 2 + 1} />
          </section>

          {(notes || unassignedPlants.length > 0) && (
            <section className="print-page mx-auto bg-white text-slate-950 shadow-2xl" style={pageStyle}>
              <div className="mb-3 flex items-start justify-between border-b border-slate-300 pb-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-emerald-700">Plant Pending plan notes</div>
                  <h1 className="mt-1 text-xl font-black">Notes and loose ends</h1>
                </div>
                <img src={`${import.meta.env.BASE_URL}brand/app-icon-mark.svg`} alt="Plant Pending" className="h-10 w-10" />
              </div>
              {unassignedPlants.length > 0 && <div className="mb-5"><h2 className="mb-2 text-lg font-bold">Unassigned plants</h2><p className="text-sm text-slate-600">{unassignedPlants.length} placed plants are not assigned to a zone.</p></div>}
              {notes && <div><h2 className="mb-2 text-lg font-bold">General notes</h2><p className="whitespace-pre-wrap rounded-xl border border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">{notes}</p></div>}
              <PrintFooter pageIndex={zoneSummaries.length * 2 + 2} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
