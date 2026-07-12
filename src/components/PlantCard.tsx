import type { ReactNode } from 'react';
import { Plant } from '../types/plant';
import { getPlantImageUrl, getPlantCategoryColor, hasPlantImage } from '../utils/imageUtils';

interface PlantCardProps {
  plant: Plant;
  isSelected: boolean;
  onClick: () => void;
}

function getSunText(plant: Plant): string {
  const flags = new Set(plant.greenAcresScoreFlags || []);
  if (flags.has('full_sun')) return 'FULL SUN';
  if (flags.has('shade_tolerant')) return 'SHADE';
  return 'MIXED';
}

function getWaterText(plant: Plant): string {
  if (plant.waterwiseRating === null || plant.waterwiseRating === undefined) return '—';
  if (plant.waterwiseRating >= 8) return 'LOW';
  if (plant.waterwiseRating >= 5) return 'MED';
  return 'HIGH';
}

function getSizeText(plant: Plant): string {
  const height = plant.matureHeightFt ? `${plant.matureHeightFt}'` : '?';
  const width = plant.matureWidthFt ? `${plant.matureWidthFt}'` : '?';
  return `${height} × ${width}`;
}

function getPollinatorText(plant: Plant): string {
  return plant.pollinatorValue || '—';
}

function getPriceText(plant: Plant): string {
  return plant.greenAcresPriceText || '—';
}


function getSunIconType(plant: Plant): 'full' | 'partial' | 'shade' | 'mixed' {
  const flags = new Set(plant.greenAcresScoreFlags || []);
  if (flags.has('full_sun')) return 'full';
  if (flags.has('shade_tolerant')) return 'shade';
  return 'partial';
}

function getWaterIconType(plant: Plant): 'low' | 'medium' | 'high' | 'unknown' {
  if (plant.waterwiseRating === null || plant.waterwiseRating === undefined) return 'unknown';
  if (plant.waterwiseRating >= 8) return 'low';
  if (plant.waterwiseRating >= 5) return 'medium';
  return 'high';
}

function getWaterwiseText(plant: Plant): string {
  if (plant.waterwiseRating === null || plant.waterwiseRating === undefined) return 'Unknown';
  return plant.waterwiseRating >= 7 ? 'Waterwise' : 'Not waterwise';
}

function getMaintenanceText(plant: Plant): string {
  if (plant.maintenanceEaseRating === null || plant.maintenanceEaseRating === undefined) return 'Unknown';
  if (plant.maintenanceEaseRating >= 7) return 'Easy';
  if (plant.maintenanceEaseRating >= 4) return 'Med';
  return 'Hard';
}

function LineIcon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function MetricTile({
  value,
  icon,
  accent = 'text-slate-950',
  title,
}: {
  value: string;
  icon?: ReactNode;
  accent?: string;
  title?: string;
}) {
  return (
    <div title={title || value} className="flex h-[54px] flex-col items-center justify-center rounded-xl border border-slate-300 bg-white px-2 py-1 text-center shadow-sm">
      {icon && <div className={`${value ? 'mb-0.5' : ''} flex h-8 justify-center text-slate-800`}>{icon}</div>}
      {value && <div className={`w-full truncate text-base font-extrabold leading-tight ${accent}`}>{value}</div>}
    </div>
  );
}

function ImagePanel({ plant, isSelected }: { plant: Plant; isSelected: boolean }) {
  const imageUrl = getPlantImageUrl(plant);
  const categoryColor = getPlantCategoryColor(plant);
  const hasImage = hasPlantImage(plant);
  const imageHeight = isSelected ? 'h-44' : 'h-36';
  const commonName = plant.commonName || plant.botanicalName || 'Plant';
  const botanicalName = (plant.botanicalName || '').trim();
  const showBotanical = botanicalName && botanicalName !== commonName && isSelected;

  const titleOverlay = (
    <div className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] rounded-xl bg-black/38 px-2.5 py-1.5 text-white shadow-sm backdrop-blur-[1px]">
      <div className="truncate text-left text-sm font-extrabold leading-tight drop-shadow" title={commonName}>
        {commonName}
      </div>
      {showBotanical && (
        <div className="mt-0.5 truncate text-left text-[10px] italic leading-tight text-white/80" title={botanicalName}>
          {botanicalName}
        </div>
      )}
    </div>
  );

  if (!imageUrl || !hasImage) {
    return (
      <div
        className={`relative ${imageHeight} overflow-hidden rounded-2xl`}
        style={{ background: `linear-gradient(135deg, ${categoryColor}, #d9f99d)` }}
      >
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white">
          {plant.category || 'Plant'}
        </div>
        <div className="absolute inset-0 flex items-center justify-center pb-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/70 bg-white/20 text-xl font-semibold text-white shadow-lg">
            {plant.abbreviation}
          </div>
        </div>
        {titleOverlay}
      </div>
    );
  }

  return (
    <div className={`relative ${imageHeight} overflow-hidden rounded-2xl bg-slate-200`}>
      <img
        src={imageUrl}
        alt={plant.commonName || plant.botanicalName}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/45 to-transparent" />
      <div className="absolute bottom-0 left-0 h-20 w-3/4 bg-gradient-to-tr from-black/35 via-black/10 to-transparent" />
      <div className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white shadow-sm">
        {plant.category || 'Plant'}
      </div>
      {titleOverlay}
    </div>
  );
}

function DropIcon({ filled }: { filled: boolean }) {
  return (
    <path
      d="M12 3.8s3.4 3.9 3.4 6.6a3.4 3.4 0 0 1-6.8 0C8.6 7.7 12 3.8 12 3.8Z"
      fill={filled ? 'currentColor' : 'none'}
      opacity={filled ? 0.95 : 0.35}
    />
  );
}

function waterIconFor(level: 'low' | 'medium' | 'high' | 'unknown') {
  const filledCount = level === 'high' ? 3 : level === 'medium' ? 2 : level === 'low' ? 1 : 0;
  return (
    <svg viewBox="0 0 42 24" className="h-10 w-14 text-sky-700" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g transform="translate(-2 0) scale(.82)"><DropIcon filled={filledCount >= 1} /></g>
      <g transform="translate(9 0) scale(.82)"><DropIcon filled={filledCount >= 2} /></g>
      <g transform="translate(20 0) scale(.82)"><DropIcon filled={filledCount >= 3} /></g>
    </svg>
  );
}


function sunIconFor(level: 'full' | 'partial' | 'shade' | 'mixed') {
  if (level === 'shade') {
    return (
      <LineIcon>
        <path d="M5 17c2.5-3.7 5.5-5.7 9-6" />
        <path d="M11 18c1.7-3.1 3.8-5 6.5-5.7" />
        <path d="M7 10c2.5-.4 5.1.1 7.8 1.4" />
        <path d="M4 19h16" />
      </LineIcon>
    );
  }
  if (level === 'partial') {
    return (
      <LineIcon>
        <path d="M12 3v2" />
        <path d="M4 12h2" />
        <path d="m6.2 6.2 1.4 1.4" />
        <path d="M12 7a5 5 0 0 0-5 5" />
        <path d="M10 17h7a4 4 0 0 0 0-8 5.8 5.8 0 0 0-10.8 2" />
      </LineIcon>
    );
  }
  return (
    <LineIcon>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <path d="M2 12h3" />
      <path d="M19 12h3" />
      <path d="m4.9 4.9 2.1 2.1" />
      <path d="m17 17 2.1 2.1" />
      <path d="m17 7 2.1-2.1" />
      <path d="m4.9 19.1 2.1-2.1" />
    </LineIcon>
  );
}




export function PlantCard({ plant, isSelected, onClick }: PlantCardProps) {
  const sunText = getSunText(plant);
  const waterText = getWaterText(plant);
  const sizeText = getSizeText(plant);
  const pollinatorText = getPollinatorText(plant);
  const priceText = getPriceText(plant);
  const waterwiseText = getWaterwiseText(plant);
  const sunIconType = getSunIconType(plant);
  const waterIconType = getWaterIconType(plant);
  const maintenanceText = getMaintenanceText(plant);

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer overflow-hidden rounded-3xl border transition-all duration-150 ${
        isSelected
          ? 'border-emerald-500 bg-white shadow-xl shadow-emerald-950/15 ring-2 ring-emerald-400/25'
          : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-white hover:shadow-lg'
      }`}
      style={{ contentVisibility: 'auto', containIntrinsicSize: isSelected ? '440px' : '300px' }}
    >
      <div className="p-3">
        <ImagePanel plant={plant} isSelected={isSelected} />

        <div className="mt-2.5 grid grid-cols-3 gap-2.5">
          <MetricTile value={sizeText} title={`Mature size: ${sizeText}`} />
          <MetricTile value="" accent="text-sky-700" icon={waterIconFor(waterIconType)} title={`Water need: ${waterText}`} />
          <MetricTile value="" accent="text-orange-700" icon={sunIconFor(sunIconType)} title={`Sun requirement: ${sunText}`} />
        </div>

        {isSelected && (
          <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs text-slate-700">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div title={`Waterwise score: ${plant.waterwiseRating ?? 'unknown'}`}>
                <dt className="inline text-slate-500">Waterwise: </dt>
                <dd className="inline font-semibold text-slate-950">{waterwiseText}</dd>
              </div>
              <div title={`Maintenance score: ${plant.maintenanceEaseRating ?? 'unknown'}`}>
                <dt className="inline text-slate-500">Maintenance: </dt>
                <dd className="inline font-semibold text-slate-950">{maintenanceText}</dd>
              </div>
              {pollinatorText !== '—' && (
                <div title={`Pollinator value: ${pollinatorText}`}>
                  <dt className="inline text-slate-500">Pollinator: </dt>
                  <dd className="inline font-semibold text-slate-950">{pollinatorText}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        <div className="mt-2 grid grid-cols-2 overflow-hidden rounded-xl bg-slate-100 text-center text-xs font-medium text-slate-700">
          <div className="px-3 py-2">More details</div>
          <div className="border-l border-slate-200 px-3 py-2 font-semibold text-slate-950 truncate" title={priceText}>{priceText}</div>
        </div>
      </div>
    </div>
  );
}
