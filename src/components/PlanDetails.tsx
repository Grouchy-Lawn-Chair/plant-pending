// PlanDetails component - right sidebar for plan management and plant details

import { useEffect, useState, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { Plant, PlacedPlant, Warning, GardenPlan, GardenZone, ZoneSunExposure, ZoneWaterNeed, ZoneAfternoonSun, ZoneType, PlantingGroup, ZoneLayoutMode, ZonePlantingType, ZonePlantVariety, TestLogEntry, TestSnapshot, DisplayMode, PlantLabelMode, PlantClumpStrength } from '../types/plant';
import { importPlanFromJSON } from '../utils/storage';
import { hasPlantImage, getPlantImageUrl, getPlantCategoryColor, getPlantSymbolColor } from '../utils/imageUtils';
import { PlanIconSvg } from './PlanIconSvg';

const publicAssetUrl = (path: string) => {
  if (!path) return import.meta.env.BASE_URL;
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  const base = import.meta.env.BASE_URL;
  const baseNoSlash = base.replace(/\/$/, '');
  let cleanPath = path.trim();

  if (cleanPath.startsWith(base)) {
    cleanPath = cleanPath.slice(base.length);
  } else if (baseNoSlash && cleanPath.startsWith(`${baseNoSlash}/`)) {
    cleanPath = cleanPath.slice(baseNoSlash.length + 1);
  }

  return `${base}${cleanPath.replace(/^\/+/, '')}`;
};

type InspectorSection = 'item' | 'canvas' | 'zones' | 'groups' | 'legend' | 'debug' | null;

const ZONE_LAYOUT_OPTIONS: { value: ZoneLayoutMode; label: string; helper: string }[] = [
  { value: 'fill', label: 'Fill zone', helper: 'Scatter plants throughout the zone' },
  { value: 'edge', label: 'Edge planting', helper: 'Keep plants near zone edges' },
  { value: 'cornerAnchors', label: 'Corner anchors', helper: 'Start with plants near corners, then fill' },
  { value: 'groundcoverFill', label: 'Groundcover fill', helper: 'Favor the smallest plant in the group for coverage' },
];

const ZONE_PLANTING_TYPE_OPTIONS: { value: ZonePlantingType; label: string; helper: string }[] = [
  { value: 'mixedBorder', label: 'Mixed border', helper: 'General mixed planting, balanced layers' },
  { value: 'flowerBed', label: 'Flower bed', helper: 'Layered decorative bed, low front and taller back when marked' },
  { value: 'hedgeRow', label: 'Hedge row', helper: 'Repeated shrubs, simple screen or border' },
  { value: 'grassDrift', label: 'Grass drift', helper: 'Repeated grasses or strappy plants in loose groups' },
  { value: 'slopePlanting', label: 'Slope planting', helper: 'Groundcovers, drifts, and erosion-friendly anchors' },
  { value: 'poolPlanter', label: 'Pool planter', helper: 'Cleaner, lower-mess, evergreen or architectural planting' },
  { value: 'rockGarden', label: 'Rock garden', helper: 'Sparse low plants, succulents, and architectural accents' },
];


const ZONE_PLANT_VARIETY_OPTIONS: { value: ZonePlantVariety; label: string; helper: string }[] = [
  { value: 'low', label: 'Low variety', helper: 'Smaller plant list, more repeating drifts, slightly fewer plants.' },
  { value: 'medium', label: 'Medium variety', helper: 'Balanced palette and plant count.' },
  { value: 'high', label: 'High variety', helper: 'Larger plant list and a little more plant count.' },
];

function getEdgeRole(zone: GardenZone, edgeIndex: number): 'front' | 'back' | '' {
  if (zone.edgeRoles?.front?.includes(edgeIndex)) return 'front';
  if (zone.edgeRoles?.back?.includes(edgeIndex)) return 'back';
  return '';
}

function updateEdgeRole(zone: GardenZone, edgeIndex: number, role: 'front' | 'back' | ''): Partial<GardenZone> {
  const currentFront = zone.edgeRoles?.front || [];
  const currentBack = zone.edgeRoles?.back || [];
  return {
    edgeRoles: {
      front: role === 'front' ? Array.from(new Set([...currentFront, edgeIndex])).sort((a, b) => a - b) : currentFront.filter(index => index !== edgeIndex),
      back: role === 'back' ? Array.from(new Set([...currentBack, edgeIndex])).sort((a, b) => a - b) : currentBack.filter(index => index !== edgeIndex),
    },
  };
}

function formatPlantingTypeLabel(value?: ZonePlantingType): string {
  return ZONE_PLANTING_TYPE_OPTIONS.find(option => option.value === (value || 'mixedBorder'))?.label || 'Mixed border';
}


function formatSunAmount(value?: ZoneSunExposure): string {
  switch (value) {
    case 'fullSun':
      return 'Full sun, 6+ hours';
    case 'partSun':
      return 'Part sun, 4-6 hours';
    case 'partialSun':
      return 'Part sun/shade, 3-6 hours';
    case 'partShade':
      return 'Part shade, 2-4 hours';
    case 'fullShade':
      return 'Full shade, under 2 hours';
    default:
      return 'Sun unknown';
  }
}

interface PlanDetailsProps {
  plants: Plant[];
  placedPlants: PlacedPlant[];
  zones: GardenZone[];
  plantingGroups: PlantingGroup[];
  selectedZoneId: string | null;
  zoneShapesVisible: boolean;
  selectedInstanceId: string | null;
  selectedInstanceIds: string[];
  warnings: Warning[];
  savedPlans: GardenPlan[];
  currentPlanName: string;
  notes: string;
  canvasWorldSize: { width: number; height: number };
  zoom: number;
  plantCircleOpacity: number;
  plantLabelMode: PlantLabelMode;
  globalDisplayMode: DisplayMode;
  plantClumpingEnabled: boolean;
  plantClumpStrength: PlantClumpStrength;
  inspectorSection: InspectorSection;
  onInspectorSectionChange: (section: InspectorSection) => void;
  testLog: TestLogEntry[];
  debugSnapshots: TestSnapshot[];
  onClearTestLog: () => void;
  onSelectPlacedPlant: (instanceId: string | null) => void;
  onUpdatePlacedPlant: (instanceId: string, updates: Partial<PlacedPlant>) => void;
  onDeletePlacedPlant: (instanceId: string) => void;
  onClearPlacedPlants: () => void;
  onDuplicatePlacedPlant: (instanceId: string) => void;
  onSelectZone: (zoneId: string | null) => void;
  onUpdateZone: (zoneId: string, updates: Partial<GardenZone>) => void;
  onDeleteZone: (zoneId: string) => void;
  onDuplicateZone: (zoneId: string) => void;
  onZoneShapesVisibleChange: (visible: boolean) => void;
  onCreatePlantingGroup: (name: string) => void;
  onUpdatePlantingGroup: (groupId: string, updates: Partial<PlantingGroup>) => void;
  onDeletePlantingGroup: (groupId: string) => void;
  onAddPlantToGroup: (groupId: string, plantId: number) => void;
  onRemovePlantFromGroup: (groupId: string, plantId: number) => void;
  onGenerateZoneLayout: (zoneId: string) => void;
  onSavePlan: (name: string) => void;
  onLoadPlan: (plan: GardenPlan) => void;
  onDeleteSavedPlan: (planId: string) => void;
  onNewPlan: () => void;
  onExportPlan: () => void;
  onImportPlan: (plan: GardenPlan) => void;
  onPrint: () => void;
  onNotesChange: (notes: string) => void;
  onZoomChange: (zoom: number) => void;
  onPlantCircleOpacityChange: (opacity: number) => void;
  onPlantLabelModeChange: (mode: PlantLabelMode) => void;
  onGlobalDisplayModeChange: (mode: DisplayMode) => void;
  onPlantClumpingEnabledChange: (enabled: boolean) => void;
  onPlantClumpStrengthChange: (strength: PlantClumpStrength) => void;
}

export function PlanDetails({
  plants,
  placedPlants,
  zones,
  plantingGroups,
  selectedZoneId,
  zoneShapesVisible,
  selectedInstanceId,
  selectedInstanceIds,
  warnings,
  savedPlans,
  currentPlanName,
  notes,
  canvasWorldSize,
  zoom,
  plantCircleOpacity,
  plantLabelMode,
  globalDisplayMode,
  plantClumpingEnabled,
  plantClumpStrength,
  inspectorSection,
  onInspectorSectionChange,
  testLog,
  debugSnapshots,
  onClearTestLog,
  onSelectPlacedPlant,
  onUpdatePlacedPlant,
  onDeletePlacedPlant,
  onClearPlacedPlants,
  onDuplicatePlacedPlant,
  onSelectZone,
  onUpdateZone,
  onDeleteZone,
  onDuplicateZone,
  onZoneShapesVisibleChange,
  onCreatePlantingGroup,
  onUpdatePlantingGroup,
  onDeletePlantingGroup,
  onAddPlantToGroup,
  onRemovePlantFromGroup,
  onGenerateZoneLayout,
  onSavePlan,
  onLoadPlan,
  onDeleteSavedPlan,
  onNewPlan,
  onExportPlan,
  onImportPlan,
  onPrint,
  onNotesChange,
  onZoomChange,
  onPlantCircleOpacityChange,
  onPlantLabelModeChange,
  onGlobalDisplayModeChange,
  onPlantClumpingEnabledChange,
  onPlantClumpStrengthChange,
}: PlanDetailsProps) {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [saveName, setSaveName] = useState(currentPlanName);
  const [fullSizeImage, setFullSizeImage] = useState<{ url: string; title: string; subtitle?: string } | null>(null);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [zoneSettingsTab, setZoneSettingsTab] = useState<'site' | 'generate' | 'style'>('site');
  const [zoneModalPosition, setZoneModalPosition] = useState({ x: 360, y: 90 });
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedPlantingGroupId, setSelectedPlantingGroupId] = useState<string | null>(null);
  const [groupPlantSearch, setGroupPlantSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zoneModalRef = useRef<HTMLDivElement>(null);

  // Get the selected placed plant instance
  const selectedPlaced = placedPlants.find(p => p.instanceId === selectedInstanceId);
  const selectedItems = placedPlants.filter(p => selectedInstanceIds.includes(p.instanceId));
  const selectedPlantCount = selectedItems.filter(p => (p.itemType || 'plant') === 'plant').length;
  const editingZone = zones.find(zone => zone.id === editingZoneId) || null;
  const selectedPlantingGroup = plantingGroups.find(group => group.id === selectedPlantingGroupId) || plantingGroups[0] || null;

  useEffect(() => {
    if (!selectedZoneId) return;
    onInspectorSectionChange('zones');
    setEditingZoneId(selectedZoneId);
    setZoneSettingsTab('site');
  }, [selectedZoneId, onInspectorSectionChange]);

  useEffect(() => {
    if (!selectedInstanceId) return;
    onInspectorSectionChange('item');
  }, [selectedInstanceId]);

  // Group placed plants by plant ID for count list
  const plantCounts: { plant: Plant; count: number; instances: PlacedPlant[] }[] = [];
  for (const placed of placedPlants) {
    if (placed.itemType === 'rock') continue;
    const plant = plants.find(p => p.id === placed.plantId);
    if (!plant) continue;

    const existing = plantCounts.find(pc => pc.plant.id === plant.id);
    if (existing) {
      existing.count++;
      existing.instances.push(placed);
    } else {
      plantCounts.push({ plant, count: 1, instances: [placed] });
    }
  }

  const groupSearchText = groupPlantSearch.trim().toLowerCase();
  const candidatePlantsForGroup = plants
    .filter(plant => {
      if (!selectedPlantingGroup) return false;
      if (selectedPlantingGroup.plantIds.includes(plant.id)) return false;
      if (!groupSearchText) return false;
      const haystack = `${plant.commonName} ${plant.botanicalName} ${plant.category}`.toLowerCase();
      return haystack.includes(groupSearchText);
    })
    .slice(0, 8);

  const getPlantName = (plantId: number): string => {
    const plant = plants.find(item => item.id === plantId);
    return plant?.commonName || plant?.botanicalName || `Plant ${plantId}`;
  };

  const copyTestLog = async () => {
    const payload = JSON.stringify(testLog, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      alert('Test log copied to clipboard.');
    } catch {
      alert('Clipboard copy failed. Use Download log instead.');
    }
  };

  const downloadTestLog = () => {
    const blob = new Blob([JSON.stringify(testLog, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `garden-planner-test-log-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const downloadDebugPackage = () => {
    const packageData = {
      createdAt: new Date().toISOString(),
      app: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      },
      planSummary: {
        name: currentPlanName,
        placedPlants: placedPlants.length,
        zones: zones.length,
        plantingGroups: plantingGroups.length,
        warnings: warnings.length,
        notesLength: notes.length,
        selectedZoneId,
        selectedInstanceId,
        zoneShapesVisible,
        debugSnapshots: debugSnapshots.length,
      },
      zones,
      plantingGroups,
      placedPlants: placedPlants.map(item => ({
        ...item,
        plantName: plants.find(plant => plant.id === item.plantId)?.commonName || plants.find(plant => plant.id === item.plantId)?.botanicalName || null,
      })),
      warnings,
      testLog,
      debugSnapshots,
    };

    const blob = new Blob([JSON.stringify(packageData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `garden-planner-debug-package-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  // Handle file import
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const plan = await importPlanFromJSON(file);
      onImportPlan(plan);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to import plan');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startZoneModalDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const modal = zoneModalRef.current;
    if (!modal) return;
    const rect = modal.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    const onMove = (moveEvent: PointerEvent) => {
      setZoneModalPosition({
        x: Math.max(12, Math.min(window.innerWidth - rect.width - 12, moveEvent.clientX - offsetX)),
        y: Math.max(12, Math.min(window.innerHeight - 80, moveEvent.clientY - offsetY)),
      });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div className="inspector-dark relative h-full flex flex-col bg-slate-950 text-slate-100 pr-12">
      <div className={`${inspectorSection ? '' : 'hidden'} border-b border-slate-800 bg-slate-900 px-3 py-2`}>
        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Current plan</div>
        <p className="mt-1 truncate text-sm font-medium text-slate-100">{currentPlanName || 'Untitled Plan'}</p>
      </div>

      <div className="absolute inset-y-0 right-0 z-20 flex w-12 flex-col items-center gap-2 border-l border-slate-800 bg-slate-950 px-1.5 py-3">
        {[
          { id: 'item' as const, label: selectedPlaced ? 'Selection' : 'Selection (nothing selected)', icon: '◆' },
          { id: 'canvas' as const, label: 'Canvas', iconSrc: `${import.meta.env.BASE_URL}ui-icons/noun-canvas-8382519.svg` },
          { id: 'zones' as const, label: 'Zones', iconSrc: `${import.meta.env.BASE_URL}ui-icons/noun-screenshot-4899159.svg` },
          { id: 'groups' as const, label: 'Groups', icon: '☷' },
          { id: 'legend' as const, label: 'Legend', icon: '#' },
          { id: 'debug' as const, label: 'Debug', icon: '⌁' },
        ].map(section => (
          <button
            key={section.id}
            type="button"
            title={section.label}
            onClick={() => onInspectorSectionChange(inspectorSection === section.id ? null : section.id)}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-bold ${inspectorSection === section.id ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200' : 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
          >
            {'iconSrc' in section ? (
              <img
                src={section.iconSrc}
                alt=""
                aria-hidden="true"
                className={`h-5 w-5 ${inspectorSection === section.id ? 'invert brightness-0 sepia saturate-[8] hue-rotate-[105deg]' : 'invert opacity-80'}`}
              />
            ) : (
              section.icon
            )}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div className={`${inspectorSection ? '' : 'hidden'} flex-1 overflow-y-auto`}>
        {/* Multi-select details */}
        {selectedInstanceIds.length > 1 && (
          <div className="p-3 border-b border-slate-800 bg-slate-900">
            <h3 className="text-sm font-medium text-slate-100 mb-1">Selected Group</h3>
            <p className="text-xs text-sky-300 mb-3">
              {selectedInstanceIds.length} items selected{selectedPlantCount !== selectedInstanceIds.length ? `, ${selectedPlantCount} plants` : ''}. Drag any selected item to move the group, or press Delete to remove it.
            </p>
            <div className="mb-3 rounded-xl border border-slate-700 bg-slate-950 p-2">
              <label className="text-xs text-slate-400 block mb-1">Assign selected to zone</label>
              <select
                value=""
                onChange={(e) => {
                  const nextZoneId = e.target.value;
                  selectedInstanceIds.forEach(id => onUpdatePlacedPlant(id, { zone: nextZoneId }));
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
              >
                <option value="">No zone assigned</option>
                {zones.filter(zone => zone.zoneType !== 'exclusion').map(zone => (
                  <option key={zone.id} value={zone.id}>{zone.name}</option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">Applies to all selected plants/rocks. Exclusion zones are intentionally not listed.</p>
            </div>

            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete ${selectedInstanceIds.length} selected items?`)) {
                  selectedInstanceIds.forEach(id => onDeletePlacedPlant(id));
                }
              }}
              className="w-full px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
            >
              Delete selected items
            </button>
          </div>
        )}

        {/* Selected plant details */}
        {inspectorSection === 'item' && selectedPlaced && (
          <div className="p-3 border-b border-slate-800 bg-slate-950 text-slate-100">
            <h3 className="text-sm font-medium text-slate-100 mb-2">Selection</h3>
            {(() => {
              if (selectedPlaced.itemType === 'rock') {
                return (
                  <div className="text-sm space-y-3">
                    <div className="flex gap-3 items-center">
                      <div
                        className="w-24 h-24 rounded-lg border bg-stone-50 flex items-center justify-center"
                        style={{ color: selectedPlaced.rockColor || '#8f8f8f' }}
                      >
                        <PlanIconSvg
                          src={publicAssetUrl(selectedPlaced.rockSvg || 'rocks-icons/rock1.svg')}
                          color={selectedPlaced.rockColor || '#8f8f8f'}
                          opacity={0.9}
                          className="rock-plan-icon w-20 h-20"
                          title="Rock"
                        />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-medium text-slate-100">Rock</h4>
                        <p className="text-xs text-slate-400">{selectedPlaced.rockSvg || '/rocks-icons/rock1.svg'}</p>
                        <p className="text-xs text-slate-400 mt-1">Color: {selectedPlaced.rockColor || 'gray'}</p>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Rock size</label>
                      <select
                        value={selectedPlaced.rockSizeFt || 2}
                        onChange={(e) => onUpdatePlacedPlant(selectedPlaced.instanceId, { rockSizeFt: parseInt(e.target.value, 10) })}
                        className="w-full px-2 py-1 text-sm border border-slate-700 bg-slate-950 text-slate-100 rounded"
                      >
                        <option value={1}>1 ft</option>
                        <option value={2}>2 ft</option>
                        <option value={3}>3 ft</option>
                        <option value={4}>4 ft</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Rock shade</label>
                      <input
                        type="color"
                        value={selectedPlaced.rockColor && selectedPlaced.rockColor.startsWith('#') ? selectedPlaced.rockColor : '#8f8f8f'}
                        onChange={(e) => onUpdatePlacedPlant(selectedPlaced.instanceId, { rockColor: e.target.value })}
                        className="w-full h-9 border rounded cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Blob rotation</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max="360"
                          value={selectedPlaced.rotationDeg || 0}
                          onChange={(e) => onUpdatePlacedPlant(selectedPlaced.instanceId, { rotationDeg: parseInt(e.target.value, 10) })}
                          className="flex-1"
                        />
                        <span className="text-xs text-slate-400 w-10 text-right">{selectedPlaced.rotationDeg || 0}°</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Zone</label>
                      <select
                        value={selectedPlaced.zone || ''}
                        onChange={(e) => onUpdatePlacedPlant(selectedPlaced.instanceId, { zone: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-slate-700 bg-slate-950 text-slate-100 rounded"
                      >
                        <option value="">No zone assigned</option>
                        {zones.map(zone => (
                          <option key={zone.id} value={zone.id}>{zone.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Notes</label>
                      <input
                        type="text"
                        value={selectedPlaced.notes || ''}
                        onChange={(e) => onUpdatePlacedPlant(selectedPlaced.instanceId, { notes: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-slate-700 bg-slate-950 text-slate-100 rounded"
                        placeholder="Add notes..."
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => onDuplicatePlacedPlant(selectedPlaced.instanceId)}
                        className="flex-1 px-2 py-1 text-xs rounded border border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={() => onDeletePlacedPlant(selectedPlaced.instanceId)}
                        className="flex-1 px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              }

              const plant = plants.find(p => p.id === selectedPlaced.plantId);
              if (!plant) return <p className="text-sm text-slate-400">Unknown plant</p>;

              const plantHasImage = hasPlantImage(plant);
              const imageUrl = getPlantImageUrl(plant);
              const categoryColor = getPlantCategoryColor(plant);
              const symbolColor = getPlantSymbolColor(plant);
              const currentColor = selectedPlaced.customColor || symbolColor || categoryColor;
              return (
                <div className="text-sm space-y-3">
                  {/* Plant image */}
                  <div className="flex gap-3">
                    {plantHasImage ? (
                      <button
                        type="button"
                        onClick={() => setFullSizeImage({
                          url: imageUrl!,
                          title: plant.commonName || plant.botanicalName,
                          subtitle: plant.botanicalName,
                        })}
                        className="group relative w-32 h-32 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200 text-left shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        title="Open full-size plant image"
                      >
                        <img
                          src={imageUrl!}
                          alt={plant.commonName || plant.botanicalName}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <span className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-white/90 border border-slate-300 shadow flex items-center justify-center text-lg leading-none font-semibold text-slate-800 group-hover:bg-white">
                          +
                        </span>
                      </button>
                    ) : (
                      <div
                        className="w-32 h-32 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0 text-2xl"
                        style={{ backgroundColor: categoryColor }}
                      >
                        {plant.abbreviation}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{plant.commonName || plant.botanicalName}</p>
                      <p className="text-xs text-slate-400 italic truncate">{plant.botanicalName}</p>
                      <p className="text-xs text-slate-500 mt-1">{plant.category}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400">Height: </span>
                      <span>{plant.matureHeightFt || '?'} ft</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Width: </span>
                      <span>{plant.matureWidthFt || '?'} ft</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Waterwise: </span>
                      <span>{plant.waterwiseRating || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Maintenance: </span>
                      <span>{plant.maintenanceEaseRating || '-'}</span>
                    </div>
                  </div>

                  <div className="text-xs rounded-xl border border-slate-700 bg-slate-900 p-3 text-slate-200">
                    <div className="space-y-1">
                      {plant.greenAcresProductName && <div className="font-medium">{plant.greenAcresProductName}</div>}
                      {plant.greenAcresPriceText && <div>Price: {plant.greenAcresPriceText}</div>}
                      {plant.greenAcresUrl && (
                        <a href={plant.greenAcresUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                          View Green Acres page
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Color picker */}
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Symbol color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={currentColor}
                        onChange={(e) => onUpdatePlacedPlant(selectedPlaced.instanceId, { customColor: e.target.value })}
                        className="w-10 h-8 border rounded cursor-pointer"
                      />
                      <div
                        className="w-8 h-8 rounded-full border-2 border-slate-300"
                        style={{ backgroundColor: categoryColor }}
                        title="Category default"
                      />
                      <span className="text-xs text-slate-500">Default</span>
                      {selectedPlaced.customColor && (
                        <button
                          onClick={() => onUpdatePlacedPlant(selectedPlaced.instanceId, { customColor: null })}
                          className="text-xs text-blue-500 hover:underline"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Rotation control */}
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Blob rotation</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="359"
                        value={selectedPlaced.rotationDeg || 0}
                        onChange={(e) => onUpdatePlacedPlant(selectedPlaced.instanceId, { rotationDeg: parseInt(e.target.value) })}
                        className="flex-1"
                      />
                      <span className="text-xs text-slate-400 w-10 text-right">{selectedPlaced.rotationDeg || 0}°</span>
                    </div>
                  </div>

                  {/* Zone selector */}
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Zone</label>
                    <select
                      value={selectedPlaced.zone || ''}
                      onChange={(e) => onUpdatePlacedPlant(selectedPlaced.instanceId, { zone: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-slate-700 bg-slate-950 text-slate-100 rounded"
                    >
                      <option value="">No zone assigned</option>
                      {zones.map(zone => (
                        <option key={zone.id} value={zone.id}>{zone.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => onDuplicatePlacedPlant(selectedPlaced.instanceId)}
                      className="flex-1 px-2 py-1 text-xs rounded border border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() => onDeletePlacedPlant(selectedPlaced.instanceId)}
                      className="flex-1 px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded"
                    >
                      Delete
                    </button>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Notes</label>
                    <input
                      type="text"
                      value={selectedPlaced.notes || ''}
                      onChange={(e) => onUpdatePlacedPlant(selectedPlaced.instanceId, { notes: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-slate-700 bg-slate-950 text-slate-100 rounded"
                      placeholder="Add notes..."
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        )}


        <div className="hidden">
          {[
            { id: 'zones' as const, label: 'Zones' },
            { id: 'groups' as const, label: 'Groups' },
            { id: 'debug' as const, label: 'Debug' },
          ].map(section => (
            <button
              key={section.id}
              type="button"
              onClick={() => onInspectorSectionChange(section.id)}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold ${inspectorSection === section.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
            >
              {section.label}
            </button>
          ))}
        </div>

        {/* Canvas controls */}
        <div hidden={inspectorSection !== 'canvas'} className="p-3 border-b border-slate-800 bg-slate-950 text-slate-100 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-slate-100">Canvas</h3>
            <p className="text-xs text-slate-400">Plan display and drafting controls.</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-400">
              Display
              <select
                value={globalDisplayMode}
                onChange={(e) => onGlobalDisplayModeChange(e.target.value as DisplayMode)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
              >
                <option value="symbol">Icon</option>
                <option value="image">Image</option>
                <option value="color">Color circle</option>
              </select>
            </label>
            <label className="text-xs text-slate-400">
              Labels
              <select
                value={plantLabelMode}
                onChange={(e) => onPlantLabelModeChange(e.target.value as PlantLabelMode)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
              >
                <option value="numbers">Numbers</option>
                <option value="none">Off</option>
                <option value="callouts">Callouts</option>
              </select>
            </label>
          </div>

          <label className="block text-xs text-slate-400">
            Icon opacity <span className="float-right text-slate-300">{Math.round(plantCircleOpacity * 100)}%</span>
            <input
              type="range"
              min="20"
              max="85"
              value={plantCircleOpacity * 100}
              onChange={(e) => onPlantCircleOpacityChange(parseInt(e.target.value) / 100)}
              className="mt-2 w-full"
            />
          </label>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-2">
            <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
              <span>Merge matching plants</span>
              <input type="checkbox" checked={plantClumpingEnabled} onChange={(e) => onPlantClumpingEnabledChange(e.target.checked)} />
            </label>
            <select
              value={plantClumpStrength}
              onChange={(e) => onPlantClumpStrengthChange(e.target.value as PlantClumpStrength)}
              disabled={!plantClumpingEnabled}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100 disabled:opacity-45"
            >
              <option value="tight">Tight</option>
              <option value="normal">Normal</option>
              <option value="loose">Loose</option>
            </select>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-100">Zoom</span>
              <span className="text-xs text-slate-400">{Math.round(zoom * 100)}%</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => onZoomChange(Math.max(0.25, Number((zoom - 0.1).toFixed(2))))} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm hover:bg-slate-800">−</button>
              <button onClick={() => onZoomChange(1)} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm hover:bg-slate-800">100%</button>
              <button onClick={() => onZoomChange(Math.min(2.5, Number((zoom + 0.1).toFixed(2))))} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm hover:bg-slate-800">+</button>
            </div>
            <p className="text-[11px] text-slate-500">Shortcuts: Ctrl/Cmd + plus, Ctrl/Cmd + minus, Ctrl/Cmd + 0.</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs text-slate-400">
            Canvas size: {canvasWorldSize.width} × {canvasWorldSize.height}px
          </div>
        </div>

        {/* Zone list */}
        <div hidden={inspectorSection !== 'zones'} className="p-3 border-b border-slate-800 bg-slate-950 text-slate-100">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div>
              <h3 className="text-sm font-medium text-slate-100">Zones</h3>
              <p className="text-xs text-slate-400">Draw zones from the canvas toolbar, then manage them here.</p>
            </div>
            <button
              type="button"
              onClick={() => onZoneShapesVisibleChange(!zoneShapesVisible)}
              className={`px-2 py-1 text-xs rounded border ${zoneShapesVisible ? 'bg-green-500/15 text-green-200 border-green-500/30' : 'bg-slate-900 text-slate-400 border-slate-700'}`}
              title="Toggle all zone shapes on the plan"
            >
              {zoneShapesVisible ? 'Shown' : 'Hidden'}
            </button>
          </div>
          {zones.length === 0 ? (
            <p className="text-sm text-slate-400">No zones yet. Use Draw zone on the canvas.</p>
          ) : (
            <div className="space-y-2">
              {zones.map(zone => (
                <div
                  key={zone.id}
                  className={`flex items-center gap-2 p-2 rounded border text-sm ${selectedZoneId === zone.id ? 'border-blue-500 bg-blue-500/15' : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900'}`}
                >
                  <button
                    type="button"
                    onClick={() => onUpdateZone(zone.id, { visible: zone.visible === false })}
                    className="w-5 h-5 rounded border flex-shrink-0"
                    style={{ backgroundColor: zone.visible === false ? '#f3f4f6' : zone.color }}
                    title={zone.visible === false ? 'Show this zone' : 'Hide this zone'}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onSelectPlacedPlant(null);
                      onSelectZone(zone.id);
                    }}
                    className="flex-1 min-w-0 text-left"
                    title="Select zone"
                  >
                    <div className="font-medium truncate text-slate-100">{zone.name}</div>
                    <div className="text-[11px] text-slate-400">{zone.zoneType === 'exclusion' ? 'Plant exclusion' : 'Planting zone'}, {zone.points.length} points, {Math.round((zone.opacity ?? 0.28) * 100)}% fill</div>
                    <div className="text-[11px] text-slate-400 truncate">{zone.zoneType === 'exclusion' ? 'Excluded from future auto-planting' : `${formatSunAmount(zone.sunExposure)} • ${formatPlantingTypeLabel(zone.plantingType)}`}</div>
                    {zone.zoneType !== 'exclusion' && (zone.plantingGroupId || zone.plantingGroupName) && (
                      <div className="text-[11px] text-slate-400 truncate">
                        Group: {plantingGroups.find(group => group.id === zone.plantingGroupId)?.name || zone.plantingGroupName}
                      </div>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDuplicateZone(zone.id)}
                    className="px-2 py-1 text-xs rounded border border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"
                    title="Duplicate zone"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectZone(zone.id);
                      setEditingZoneId(zone.id);
                    }}
                    className="px-2 py-1 text-xs rounded border border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"
                    title="Zone settings"
                  >
                    Settings
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Planting groups */}
        <div hidden={inspectorSection !== 'groups'} className="p-3 border-b border-slate-800 bg-slate-950 text-slate-100">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div>
              <h3 className="text-sm font-medium text-slate-100">Planting Groups</h3>
              <p className="text-xs text-slate-400">Reusable plant lists for zones and future auto-planting.</p>
            </div>
          </div>

          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="flex-1 px-2 py-1 text-sm border border-slate-700 bg-slate-950 text-slate-100 rounded"
              placeholder="New group name"
            />
            <button
              type="button"
              onClick={() => {
                const name = newGroupName.trim();
                if (!name) return;
                onCreatePlantingGroup(name);
                setNewGroupName('');
              }}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Add
            </button>
          </div>

          {plantingGroups.length === 0 ? (
            <p className="text-sm text-slate-400">No groups yet. Create one like Pool Area or Hill/Slope.</p>
          ) : (
            <div className="space-y-2">
              <select
                value={selectedPlantingGroup?.id || ''}
                onChange={(e) => setSelectedPlantingGroupId(e.target.value || null)}
                className="w-full px-2 py-1 text-sm border border-slate-700 bg-slate-950 text-slate-100 rounded"
              >
                {plantingGroups.map(group => (
                  <option key={group.id} value={group.id}>{group.name} ({group.plantIds.length})</option>
                ))}
              </select>

              {selectedPlantingGroup && (
                <div className="border border-slate-800 rounded p-2 bg-slate-900 space-y-2">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Group name</label>
                    <input
                      type="text"
                      value={selectedPlantingGroup.name}
                      onChange={(e) => onUpdatePlantingGroup(selectedPlantingGroup.id, { name: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-slate-700 bg-slate-950 text-slate-100 rounded"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Notes</label>
                    <textarea
                      value={selectedPlantingGroup.notes}
                      onChange={(e) => onUpdatePlantingGroup(selectedPlantingGroup.id, { notes: e.target.value })}
                      rows={2}
                      className="w-full px-2 py-1 text-sm border rounded resize-none"
                      placeholder="Example: low maintenance pool-safe plants"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Add plant to group</label>
                    <input
                      type="text"
                      value={groupPlantSearch}
                      onChange={(e) => setGroupPlantSearch(e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-slate-700 bg-slate-950 text-slate-100 rounded"
                      placeholder="Search plant name..."
                    />
                    {candidatePlantsForGroup.length > 0 && (
                      <div className="mt-1 border border-slate-700 rounded bg-slate-950 max-h-36 overflow-y-auto">
                        {candidatePlantsForGroup.map(plant => (
                          <button
                            type="button"
                            key={plant.id}
                            onClick={() => {
                              onAddPlantToGroup(selectedPlantingGroup.id, plant.id);
                              setGroupPlantSearch('');
                            }}
                            className="w-full text-left px-2 py-1 text-xs hover:bg-blue-50 border-b last:border-b-0"
                          >
                            <span className="font-medium">{plant.commonName || plant.botanicalName}</span>
                            <span className="block text-slate-400 italic">{plant.botanicalName}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs text-slate-400 mb-1">Plants in group</div>
                    {selectedPlantingGroup.plantIds.length === 0 ? (
                      <p className="text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded p-2">No plants added yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {selectedPlantingGroup.plantIds.map(plantId => (
                          <div key={plantId} className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs">
                            <span className="flex-1 truncate">{getPlantName(plantId)}</span>
                            <button
                              type="button"
                              onClick={() => onRemovePlantFromGroup(selectedPlantingGroup.id, plantId)}
                              className="text-red-600 hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete planting group "${selectedPlantingGroup.name}"?`)) {
                        onDeletePlantingGroup(selectedPlantingGroup.id);
                        setSelectedPlantingGroupId(null);
                      }
                    }}
                    className="w-full px-2 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-700 rounded border border-red-100"
                  >
                    Delete group
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Plant legend summary */}
        <div hidden={inspectorSection !== 'legend'} className="p-3 border-b border-slate-800 bg-slate-950 text-slate-100">
          <h3 className="text-sm font-medium text-slate-100 mb-1">
            Plant Legend
          </h3>
          <p className="text-xs text-slate-400 mb-2">Numbers match the symbols on the plan. {placedPlants.length} total plants placed.</p>
          {plantCounts.length === 0 ? (
            <p className="text-sm text-slate-400">No plants placed yet</p>
          ) : (
            <div className="space-y-1">
              {plantCounts.map(({ plant, count, instances }, index) => (
                <div
                  key={plant.id}
                  onClick={() => onSelectPlacedPlant(instances[0].instanceId)}
                  className="flex items-center gap-2 p-2 rounded cursor-pointer text-sm border border-slate-700 bg-slate-900/60 hover:bg-slate-800 focus:bg-slate-800"
                >
                  <span className="w-7 h-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0" title="Legend number">
                    #{index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium text-slate-100">{plant.commonName || plant.botanicalName}</div>
                    {plant.commonName && <div className="truncate text-xs text-slate-400 italic">{plant.botanicalName}</div>}
                  </div>
                  <span className="px-2 py-1 rounded-lg bg-emerald-700 text-white text-xs font-bold flex-shrink-0 shadow-sm" title="Quantity">
                    Qty {count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Test log */}
        <div hidden={inspectorSection !== 'debug'} className="p-3 border-b border-slate-800 bg-slate-950 text-slate-100">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div>
              <h3 className="text-sm font-medium text-slate-100">Test Log</h3>
              <p className="text-xs text-slate-400">Runs from app load. Generator captures fast debug map snapshots.</p>
            </div>
            <span className="text-xs text-slate-400">{testLog.length} entries, {debugSnapshots.length} snaps</span>
          </div>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={copyTestLog}
              disabled={testLog.length === 0}
              className="flex-1 px-2 py-1 text-xs bg-slate-100 hover:bg-gray-200 rounded disabled:opacity-40"
            >
              Copy log
            </button>
            <button
              type="button"
              onClick={downloadTestLog}
              disabled={testLog.length === 0}
              className="flex-1 px-2 py-1 text-xs bg-slate-100 hover:bg-gray-200 rounded disabled:opacity-40"
            >
              Download log
            </button>
            <button
              type="button"
              onClick={downloadDebugPackage}
              className="flex-1 px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 text-sky-300 rounded"
            >
              Debug pkg
            </button>
            <button
              type="button"
              onClick={onClearTestLog}
              disabled={testLog.length === 0}
              className="px-2 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-700 rounded disabled:opacity-40"
            >
              Clear
            </button>
          </div>
          {debugSnapshots.length > 0 && (
            <div className="text-[11px] text-sky-300 bg-blue-50 border border-blue-100 rounded px-2 py-1 mb-2">
              {debugSnapshots.length} fast debug snapshot{debugSnapshots.length === 1 ? '' : 's'} saved in Debug pkg.
            </div>
          )}
          {testLog.length > 0 && (
            <div className="rounded border bg-slate-50 p-2 text-[11px] text-slate-800 font-mono">
              {testLog.slice(-5).reverse().map(entry => (
                <div key={entry.id} className="border-b border-slate-200 last:border-b-0 py-1">
                  <span className="font-semibold">{entry.action}</span>
                  <span className="text-slate-400"> {new Date(entry.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Warnings */}
        <div hidden={inspectorSection !== 'debug'} className="p-3 border-b border-slate-800 bg-slate-950 text-slate-100">
          <h3 className="text-sm font-medium text-slate-100 mb-2">Warnings</h3>
          {warnings.length === 0 ? (
            <p className="text-sm text-slate-400">No warnings</p>
          ) : (
            <div className="space-y-2">
              {warnings.map(warning => (
                <div
                  key={warning.id}
                  className={`p-2 text-xs rounded ${
                    warning.severity === 'error'
                      ? 'bg-red-50 text-red-700'
                      : warning.severity === 'warning'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-blue-50 text-sky-300'
                  }`}
                >
                  {warning.message}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Plan notes */}
        <div hidden={inspectorSection !== 'debug'} className="p-3 border-b border-slate-800 bg-slate-950 text-slate-100">
          <h3 className="text-sm font-medium text-slate-100 mb-2">Plan Notes</h3>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            className="w-full px-2 py-1 text-sm border rounded resize-none"
            rows={3}
            placeholder="General notes about the plan..."
          />
        </div>
      </div>

      {/* Bottom action buttons */}
      <div className="hidden">
        <button
          type="button"
          onClick={() => {
            const plantCount = placedPlants.filter(item => (item.itemType || 'plant') === 'plant').length;
            if (plantCount > 0 && confirm(`Clear ${plantCount} plants from the plan? Rocks and zones will stay.`)) {
              onClearPlacedPlants();
            }
          }}
          disabled={placedPlants.filter(item => (item.itemType || 'plant') === 'plant').length === 0}
          className="w-full px-3 py-2 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100 disabled:opacity-50 border border-red-100"
        >
          Clear plants from plan
        </button>

        {/* Save/Load row */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setSaveName(currentPlanName);
              setShowSaveModal(true);
            }}
            className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save
          </button>
          <button
            onClick={() => setShowLoadModal(true)}
            className="flex-1 px-3 py-2 text-sm bg-slate-100 text-slate-800 rounded hover:bg-gray-200"
          >
            Load
          </button>
        </div>

        {/* Import/Export row */}
        <div className="flex gap-2">
          <button
            onClick={onExportPlan}
            disabled={placedPlants.length === 0}
            className="flex-1 px-3 py-2 text-sm bg-slate-100 text-slate-800 rounded hover:bg-gray-200 disabled:opacity-50"
          >
            Export JSON
          </button>
          <label className="flex-1">
            <span className="block px-3 py-2 text-sm bg-slate-100 text-slate-800 rounded hover:bg-gray-200 text-center cursor-pointer">
              Import JSON
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />
          </label>
        </div>

        {/* New plan / Print row */}
        <div className="flex gap-2">
          <button
            onClick={onNewPlan}
            className="flex-1 px-3 py-2 text-sm bg-slate-100 text-slate-800 rounded hover:bg-gray-200"
          >
            New Plan
          </button>
          <button
            onClick={onPrint}
            disabled={placedPlants.length === 0}
            className="flex-1 px-3 py-2 text-sm bg-slate-100 text-slate-800 rounded hover:bg-gray-200 disabled:opacity-50"
          >
            Print
          </button>
        </div>
      </div>


      {/* Zone Settings Modal */}
      {editingZone && (
        <div
          className="fixed inset-0 bg-black/45 z-50"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setEditingZoneId(null);
          }}
        >
          <div
            ref={zoneModalRef}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            className="fixed max-h-[82vh] w-[520px] max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 text-slate-100 shadow-2xl"
            style={{ left: zoneModalPosition.x, top: zoneModalPosition.y }}
          >
            <div className="flex cursor-move select-none items-start justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-3" onPointerDown={startZoneModalDrag}>
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Zone settings</div>
                <h3 className="mt-1 text-base font-semibold text-white">{editingZone.name}</h3>
                <p className="text-xs text-slate-400">Generation first, site conditions second, appearance last.</p>
              </div>
              <button type="button" onClick={() => setEditingZoneId(null)} className="rounded-lg px-2 py-1 text-xl leading-none text-slate-400 hover:bg-slate-800 hover:text-white">×</button>
            </div>

            <div className="grid grid-cols-3 gap-2 border-b border-slate-800 bg-slate-950 px-4 py-3">
              {[
                { id: 'site' as const, label: 'Site info' },
                { id: 'generate' as const, label: 'Generate' },
                { id: 'style' as const, label: 'Style & zone' },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setZoneSettingsTab(tab.id)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold ${zoneSettingsTab === tab.id ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200' : 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="max-h-[calc(82vh-132px)] overflow-y-auto p-4">
              {zoneSettingsTab === 'generate' && editingZone.zoneType !== 'exclusion' && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-900/70 bg-emerald-950/40 p-3">
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">Planting type</label>
                    <select
                      value={editingZone.plantingType || 'mixedBorder'}
                      onChange={(e) => onUpdateZone(editingZone.id, { plantingType: e.target.value as ZonePlantingType })}
                      className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    >
                      {ZONE_PLANTING_TYPE_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-emerald-100/80">
                      {ZONE_PLANTING_TYPE_OPTIONS.find(option => option.value === (editingZone.plantingType || 'mixedBorder'))?.helper}
                    </p>
                  </div>

                  <div>
                    <label title="Optional saved plant list. Leave blank to let the generator choose from the full catalog." className="text-xs text-slate-400 block mb-1">Assigned planting group</label>
                    <select
                      value={editingZone.plantingGroupId || ''}
                      onChange={(e) => {
                        const group = plantingGroups.find(item => item.id === e.target.value);
                        onUpdateZone(editingZone.id, {
                          plantingGroupId: group?.id || '',
                          plantingGroupName: group?.name || '',
                        });
                      }}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    >
                      <option value="">Auto-pick from catalog</option>
                      {plantingGroups.map(group => (
                        <option key={group.id} value={group.id}>{group.name} ({group.plantIds.length} plants)</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label title="Controls where plants are placed inside the zone." className="text-xs text-slate-400 block mb-1">Layout mode</label>
                      <select
                        value={editingZone.layoutMode || 'fill'}
                        onChange={(e) => onUpdateZone(editingZone.id, { layoutMode: e.target.value as ZoneLayoutMode })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                      >
                        {ZONE_LAYOUT_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Planting seed</label>
                      <input
                        type="number"
                        value={editingZone.plantingSeed ?? 12345}
                        onChange={(e) => onUpdateZone(editingZone.id, { plantingSeed: parseInt(e.target.value || '0', 10) })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                      />
                    </div>
                  </div>

                  <label className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={editingZone.plantingType === 'rockGarden' || editingZone.includeRocks === true}
                      disabled={editingZone.plantingType === 'rockGarden'}
                      onChange={(e) => onUpdateZone(editingZone.id, { includeRocks: e.target.checked })}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-medium text-white">Include rocks in generated mix</span>
                      <span className="block text-xs text-slate-400">Adds a few tasteful boulders before plants. Rock gardens always include rocks.</span>
                    </span>
                  </label>

                  <div className="rounded-2xl border border-sky-900/70 bg-sky-950/30 p-3 space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold text-sky-100">
                        <span title="Less plants to more plants. This controls how full the zone appears.">Fullness</span>
                        <span>{editingZone.density ?? 50}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={editingZone.density ?? 50}
                        onChange={(e) => onUpdateZone(editingZone.id, { density: parseInt(e.target.value, 10) })}
                        className="mt-2 w-full"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-sky-100 font-medium block mb-1">Plant variety</label>
                      <select
                        value={editingZone.plantVariety || 'medium'}
                        onChange={(e) => onUpdateZone(editingZone.id, { plantVariety: e.target.value as ZonePlantVariety })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                      >
                        {ZONE_PLANT_VARIETY_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-sky-100/75">
                        {ZONE_PLANT_VARIETY_OPTIONS.find(option => option.value === (editingZone.plantVariety || 'medium'))?.helper}
                      </p>
                    </div>
                  </div>


                  <button
                    type="button"
                    onClick={() => onGenerateZoneLayout(editingZone.id)}
                    className="w-full rounded-2xl bg-blue-600 px-3 py-3 text-sm font-semibold text-white hover:bg-blue-500"
                  >
                    Generate planting layout
                  </button>
                  {!editingZone.plantingGroupId && (
                    <div className="text-xs text-blue-300">No group assigned, generator will auto-pick from the catalog using the zone settings.</div>
                  )}

<div>
                    <div title="Optional edge guidance. Front edges get lower plants; back edges get taller structure." className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Front / back edges</div>
                    <div className="space-y-1.5">
                      {editingZone.points.map((point, edgeIndex) => {
                        const nextPoint = editingZone.points[(edgeIndex + 1) % editingZone.points.length];
                        const role = getEdgeRole(editingZone, edgeIndex);
                        return (
                          <div key={edgeIndex} className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 px-2 py-2 text-xs">
                            <span className="truncate text-slate-400">Edge {edgeIndex + 1}: ({Math.round(point.x)}, {Math.round(point.y)}) → ({Math.round(nextPoint.x)}, {Math.round(nextPoint.y)})</span>
                            <select
                              value={role}
                              onChange={(e) => onUpdateZone(editingZone.id, updateEdgeRole(editingZone, edgeIndex, e.target.value as 'front' | 'back' | ''))}
                              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-white"
                            >
                              <option value="">Unmarked</option>
                              <option value="front">Front</option>
                              <option value="back">Back</option>
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              )}

              {zoneSettingsTab === 'generate' && editingZone.zoneType === 'exclusion' && (
                <div className="rounded-2xl border border-red-900/70 bg-red-950/30 p-4 text-sm text-red-100">
                  This is an exclusion zone, so generation controls are hidden. Switch the zone type in Site info to generate plants here.
                </div>
              )}

              {zoneSettingsTab === 'site' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Zone type</label>
                    <select
                      value={editingZone.zoneType || 'planting'}
                      onChange={(e) => onUpdateZone(editingZone.id, { zoneType: e.target.value as ZoneType })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    >
                      <option value="planting">Planting zone</option>
                      <option value="exclusion">Plant exclusion zone</option>
                    </select>
                    <p className="mt-1 text-xs text-slate-400">Use exclusion zones for chairs, paths, equipment, and no-plant pockets.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Sun amount</label>
                      <select
                        value={editingZone.sunExposure || 'unknown'}
                        onChange={(e) => onUpdateZone(editingZone.id, { sunExposure: e.target.value as ZoneSunExposure })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                      >
                        <option value="unknown">Unknown</option>
                        <option value="fullSun">Full sun, 6+ hours</option>
                        <option value="partSun">Part sun, 4-6 hours</option>
                        <option value="partShade">Part shade, 2-4 hours</option>
                        <option value="fullShade">Full shade, under 2 hours</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Afternoon sun</label>
                      <select
                        value={editingZone.afternoonSun || 'unknown'}
                        onChange={(e) => onUpdateZone(editingZone.id, { afternoonSun: e.target.value as ZoneAfternoonSun })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                      >
                        <option value="unknown">Unknown</option>
                        <option value="yes">Yes, gets afternoon sun</option>
                        <option value="no">No, shade later</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-slate-400 block mb-1">Waterwise priority</label>
                      <select
                        value={editingZone.waterNeed || 'unknown'}
                        onChange={(e) => onUpdateZone(editingZone.id, { waterNeed: e.target.value as ZoneWaterNeed })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                      >
                        <option value="noPreference">No preference</option>
                        <option value="high">High, waterwise plants only</option>
                        <option value="medium">Medium, mostly waterwise</option>
                        <option value="low">Low, okay with thirstier plants</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Sun notes</label>
                    <input
                      type="text"
                      value={editingZone.sunNotes || ''}
                      onChange={(e) => onUpdateZone(editingZone.id, { sunNotes: e.target.value })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                      placeholder="Example: fence shade after 2 pm, neighbor tree in winter"
                    />
                  </div>
                </div>
              )}

              {zoneSettingsTab === 'style' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Zone name</label>
                    <input
                      type="text"
                      value={editingZone.name}
                      onChange={(e) => onUpdateZone(editingZone.id, { name: e.target.value })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Zone color</label>
                      <input
                        type="color"
                        value={editingZone.color}
                        onChange={(e) => onUpdateZone(editingZone.id, { color: e.target.value })}
                        className="h-10 w-full cursor-pointer rounded-xl border border-slate-700 bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Visible on plan</label>
                      <button
                        type="button"
                        onClick={() => onUpdateZone(editingZone.id, { visible: editingZone.visible === false })}
                        className={`h-10 w-full rounded-xl border text-sm ${editingZone.visible === false ? 'border-slate-700 bg-slate-900 text-slate-300' : 'border-emerald-500/50 bg-emerald-500/15 text-emerald-100'}`}
                      >
                        {editingZone.visible === false ? 'Hidden' : 'Shown'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <label>Zone transparency</label>
                      <span>{Math.round((editingZone.opacity ?? 0.28) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="80"
                      value={(editingZone.opacity ?? 0.28) * 100}
                      onChange={(e) => onUpdateZone(editingZone.id, { opacity: parseInt(e.target.value, 10) / 100 })}
                      className="mt-2 w-full"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Notes</label>
                    <textarea
                      value={editingZone.notes || ''}
                      onChange={(e) => onUpdateZone(editingZone.id, { notes: e.target.value })}
                      rows={3}
                      className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                      placeholder="Example: tall hedge along back edge, rocks in corners, avoid bees near seating..."
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete ${editingZone.name}?`)) {
                          onDeleteZone(editingZone.id);
                          setEditingZoneId(null);
                        }
                      }}
                      className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-2 text-sm text-red-200 hover:bg-red-900/50"
                    >
                      Delete zone
                    </button>
                    <button type="button" onClick={() => setEditingZoneId(null)} className="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full-size plant image modal */}
      {fullSizeImage && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setFullSizeImage(null)}
        >
          <div
            className="relative bg-white text-slate-100 border border-slate-200 rounded-2xl shadow-2xl max-w-5xl max-h-[92vh] w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b">
              <div className="min-w-0">
                <h3 className="font-medium text-slate-100 truncate">{fullSizeImage.title}</h3>
                {fullSizeImage.subtitle && (
                  <p className="text-xs text-slate-400 italic truncate">{fullSizeImage.subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setFullSizeImage(null)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-gray-200 text-slate-800 text-xl leading-none flex items-center justify-center"
                aria-label="Close full-size image"
              >
                ×
              </button>
            </div>
            <div className="bg-slate-100 flex items-center justify-center max-h-[78vh] overflow-auto">
              <img
                src={fullSizeImage.url}
                alt={fullSizeImage.title}
                className="max-w-full max-h-[78vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white text-slate-100 border border-slate-200 rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-medium mb-4">Save Plan</h3>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Plan name"
              className="w-full px-3 py-2 border rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 px-4 py-2 bg-slate-100 text-slate-800 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onSavePlan(saveName || 'Untitled Plan');
                  setShowSaveModal(false);
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white text-slate-100 border border-slate-200 rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium mb-4">Load Plan</h3>
            {savedPlans.length === 0 ? (
              <p className="text-sm text-slate-400 mb-4">No saved plans found.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                {savedPlans.map(plan => (
                  <div
                    key={plan.id}
                    className="flex items-center justify-between p-2 bg-slate-50 rounded hover:bg-slate-100"
                  >
                    <div
                      onClick={() => {
                        onLoadPlan(plan);
                        setShowLoadModal(false);
                      }}
                      className="flex-1 cursor-pointer"
                    >
                      <p className="text-sm font-medium">{plan.name}</p>
                      <p className="text-xs text-slate-400">
                        {plan.placedPlants.length} plants
                      </p>
                    </div>
                    <button
                      onClick={() => onDeleteSavedPlan(plan.id)}
                      className="p-1 text-red-500 hover:text-red-700"
                      title="Delete plan"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={() => setShowLoadModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-800 rounded hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}