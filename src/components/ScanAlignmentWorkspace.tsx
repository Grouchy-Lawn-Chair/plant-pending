import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, ThreeEvent } from '@react-three/fiber';
import { Line, OrbitControls, useGLTF } from '@react-three/drei';
import { DoubleSide, Group, Material, Mesh, Object3D } from 'three';
import { GardenZone, LinearSiteFeature, PlacedPlant, ScanAlignment } from '../types/plant';
import { canvasPointToSceneFeet } from '../utils/sceneCoordinates';
import { DEFAULT_SCAN_ALIGNMENT } from '../utils/planSchema';
import { solveTopDownRegistration } from '../utils/scanRegistration';

interface ScanAlignmentWorkspaceProps {
  open: boolean;
  scanUrl: string | null;
  alignment: ScanAlignment;
  zones: GardenZone[];
  siteFeatures: LinearSiteFeature[];
  placedPlants: PlacedPlant[];
  pixelsPerFoot: number | null;
  onClose: () => void;
  onImportScan: (file: File) => void;
  onUpdateAlignment: (alignment: ScanAlignment) => void;
  onRemoveScan: () => void;
}

function cloneMaterial(material: Material | Material[]): Material | Material[] {
  return Array.isArray(material) ? material.map(item => item.clone()) : material.clone();
}

function ScanModel({ url, alignment, selecting, onSelect }: { url: string; alignment: ScanAlignment; selecting: boolean; onSelect: (point: { x: number; y: number; z: number }) => void }) {
  const rootRef = useRef<Group>(null);
  const gltf = useGLTF(url);
  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((object: Object3D) => {
      if (!(object instanceof Mesh)) return;
      object.material = cloneMaterial(object.material);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => {
        material.transparent = true;
        material.opacity = alignment.opacity;
        material.depthWrite = alignment.opacity >= 0.98;
        material.side = DoubleSide;
      });
    });
    return clone;
  }, [alignment.opacity, gltf.scene]);

  const rotation = alignment.transform.rotationDeg;
  const translation = alignment.transform.translationFt;
  const toRadians = Math.PI / 180;
  return (
    <group
      ref={rootRef}
      visible={alignment.visible}
      position={[translation.x, translation.y, translation.z]}
      rotation={[rotation.x * toRadians, rotation.y * toRadians, rotation.z * toRadians]}
      scale={alignment.transform.uniformScale}
      onPointerDown={(event: ThreeEvent<PointerEvent>) => {
        if (!selecting || !rootRef.current) return;
        event.stopPropagation();
        const local = rootRef.current.worldToLocal(event.point.clone());
        onSelect({ x: local.x, y: local.y, z: local.z });
      }}
    >
      <primitive object={scene} />
    </group>
  );
}

function PlanOverlay({ zones, siteFeatures, placedPlants, pixelsPerFoot, opacity, selecting, onSelect }: Omit<ScanAlignmentWorkspaceProps, 'open' | 'scanUrl' | 'alignment' | 'onClose' | 'onImportScan' | 'onUpdateAlignment' | 'onRemoveScan'> & { opacity: number; selecting: boolean; onSelect: (point: { x: number; y: number; z: number }) => void }) {
  if (!pixelsPerFoot) return null;
  const toPoint = (point: { x: number; y: number }, elevation = 0.04): [number, number, number] => {
    const converted = canvasPointToSceneFeet(point, pixelsPerFoot, elevation);
    return converted ? [converted.x, converted.y, converted.z] : [0, elevation, 0];
  };
  return (
    <group>
      {selecting && zones.flatMap(zone => zone.points.map((point, index) => {
        const scenePoint = toPoint(point, 0.25);
        return <mesh key={`zone-point-${zone.id}-${index}`} position={scenePoint} onPointerDown={event => { event.stopPropagation(); onSelect({ x: scenePoint[0], y: 0, z: scenePoint[2] }); }}><sphereGeometry args={[0.22, 12, 12]} /><meshBasicMaterial color="#facc15" /></mesh>;
      }))}
      {selecting && siteFeatures.flatMap(feature => feature.points.map((point, index) => {
        const scenePoint = toPoint(point, 0.28);
        return <mesh key={`feature-point-${feature.id}-${index}`} position={scenePoint} onPointerDown={event => { event.stopPropagation(); onSelect({ x: scenePoint[0], y: 0, z: scenePoint[2] }); }}><sphereGeometry args={[0.22, 12, 12]} /><meshBasicMaterial color="#facc15" /></mesh>;
      }))}
      {zones.filter(zone => zone.visible !== false && zone.points.length >= 2).map(zone => (
        <Line key={zone.id} points={[...zone.points, zone.points[0]].map(point => toPoint(point))} color={zone.surfaceType === 'structure' ? '#334155' : zone.color} opacity={opacity} transparent lineWidth={2} />
      ))}
      {siteFeatures.filter(feature => feature.visible !== false && feature.points.length >= 2).map(feature => (
        <Line key={feature.id} points={feature.points.map(point => toPoint(point, 0.08))} color={feature.kind === 'retainingWall' ? '#7c3aed' : '#92400e'} opacity={opacity} transparent lineWidth={3} />
      ))}
      {placedPlants.map(item => {
        const point = toPoint(item, 0.12);
        const radius = Math.max(0.15, ((item.itemType === 'rock' ? item.rockSizeFt : item.displayWidthFt) || 1) / 2);
        return (
          <mesh key={item.instanceId} position={point} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[radius, 24]} />
            <meshBasicMaterial color={item.itemType === 'rock' ? '#78716c' : '#16a34a'} transparent opacity={opacity * 0.7} side={DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
}

const fieldClass = 'w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white';

export function ScanAlignmentWorkspace(props: ScanAlignmentWorkspaceProps) {
  const { open, scanUrl, alignment, onClose, onImportScan, onUpdateAlignment, onRemoveScan } = props;
  const [selectionStep, setSelectionStep] = useState<'idle' | 'plan' | 'scan'>('idle');
  const [pendingPlanPoint, setPendingPlanPoint] = useState<{ x: number; y: number; z: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, open]);
  if (!open) return null;

  const updateTransform = (group: 'translationFt' | 'rotationDeg', axis: 'x' | 'y' | 'z', value: number) => onUpdateAlignment({
    ...alignment,
    transform: { ...alignment.transform, [group]: { ...alignment.transform[group], [axis]: value } },
  });
  const selectPlanPoint = (point: { x: number; y: number; z: number }) => {
    setPendingPlanPoint(point);
    setSelectionStep('scan');
  };
  const selectScanPoint = (point: { x: number; y: number; z: number }) => {
    if (!pendingPlanPoint) return;
    const nextPair = { id: crypto.randomUUID(), label: `Point ${alignment.controlPoints.length + 1}`, planPointFt: pendingPlanPoint, scanPoint: point };
    onUpdateAlignment({ ...alignment, controlPoints: [...alignment.controlPoints, nextPair], registrationErrorFt: undefined });
    setPendingPlanPoint(null);
    setSelectionStep('plan');
  };
  const applyRegistration = () => {
    const result = solveTopDownRegistration(alignment.controlPoints);
    if (!result) return;
    onUpdateAlignment({ ...alignment, transform: result.transform, controlPoints: result.controlPoints, registrationErrorFt: result.rmsErrorFt });
    setSelectionStep('idle');
    setPendingPlanPoint(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div><h2 className="font-bold">Scan Alignment</h2><p className="text-xs text-slate-400">Top-down GLB true-up · pan and zoom the view, then refine the saved transform</p></div>
        <div className="flex gap-2">
          <label className="cursor-pointer rounded bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500">{alignment.asset ? 'Replace GLB' : 'Import GLB'}<input type="file" accept=".glb,model/gltf-binary" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) onImportScan(file); event.target.value = ''; }} /></label>
          <button type="button" onClick={onClose} className="rounded border border-slate-700 px-3 py-2 text-sm">Close</button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_20rem] max-lg:grid-cols-1 max-lg:grid-rows-[minmax(20rem,1fr)_auto]">
        <div className="relative min-h-0 bg-slate-800">
          {!scanUrl && <div className="absolute inset-0 z-10 flex items-center justify-center p-6 text-center text-slate-300"><div><p className="font-semibold">Import an iPhone GLB scan to begin alignment.</p><p className="mt-2 text-sm text-slate-400">The original file remains unchanged in browser asset storage.</p></div></div>}
          <Canvas orthographic camera={{ position: [0, 100, 0.01], zoom: 18, near: 0.01, far: 10000, up: [0, 0, -1] }}>
            <color attach="background" args={['#1e293b']} />
            <ambientLight intensity={2} />
            <directionalLight position={[10, 20, 10]} intensity={2} />
            <gridHelper args={[200, 200, '#475569', '#334155']} />
            {scanUrl && <ScanModel url={scanUrl} alignment={alignment} selecting={selectionStep === 'scan'} onSelect={selectScanPoint} />}
            <PlanOverlay zones={props.zones} siteFeatures={props.siteFeatures} placedPlants={props.placedPlants} pixelsPerFoot={props.pixelsPerFoot} opacity={alignment.planOpacity} selecting={selectionStep === 'plan'} onSelect={selectPlanPoint} />
            <OrbitControls makeDefault enableRotate={false} screenSpacePanning minZoom={1} maxZoom={250} />
          </Canvas>
          {!props.pixelsPerFoot && <div className="absolute bottom-3 left-3 rounded bg-amber-950/90 px-3 py-2 text-xs text-amber-200">Set the plan scale before true-up; plan geometry cannot be converted to feet yet.</div>}
          {selectionStep !== 'idle' && <div className="absolute left-3 top-3 rounded bg-slate-950/90 px-3 py-2 text-sm text-white">{selectionStep === 'plan' ? 'Select a yellow plan vertex.' : 'Select the matching point on the scan.'}</div>}
        </div>
        <aside className="overflow-y-auto border-l border-slate-800 bg-slate-900 p-4 max-lg:border-l-0 max-lg:border-t">
          <div className="space-y-4">
            <div><div className="text-xs uppercase tracking-wider text-slate-500">Scan asset</div><div className="mt-1 break-all text-sm font-semibold">{alignment.asset?.fileName || 'No scan imported'}</div>{alignment.asset && <div className="text-xs text-slate-500">{(alignment.asset.sizeBytes / 1048576).toFixed(1)} MB</div>}</div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={alignment.visible} onChange={event => onUpdateAlignment({ ...alignment, visible: event.target.checked })} /> Show scan</label>
            <label><span className="text-xs text-slate-400">Scan opacity · {Math.round(alignment.opacity * 100)}%</span><input type="range" min="0" max="1" step="0.05" value={alignment.opacity} onChange={event => onUpdateAlignment({ ...alignment, opacity: Number(event.target.value) })} className="w-full" /></label>
            <label><span className="text-xs text-slate-400">Plan opacity · {Math.round(alignment.planOpacity * 100)}%</span><input type="range" min="0" max="1" step="0.05" value={alignment.planOpacity} onChange={event => onUpdateAlignment({ ...alignment, planOpacity: Number(event.target.value) })} className="w-full" /></label>
            <div><h3 className="mb-2 text-sm font-bold">Translation (feet)</h3><div className="grid grid-cols-3 gap-2">{(['x','y','z'] as const).map(axis => <label key={axis}><span className="text-[10px] uppercase text-slate-500">{axis}</span><input type="number" step="0.1" value={alignment.transform.translationFt[axis]} onChange={event => updateTransform('translationFt', axis, Number(event.target.value) || 0)} className={fieldClass} /></label>)}</div></div>
            <div><h3 className="mb-2 text-sm font-bold">Rotation (degrees)</h3><div className="grid grid-cols-3 gap-2">{(['x','y','z'] as const).map(axis => <label key={axis}><span className="text-[10px] uppercase text-slate-500">{axis}</span><input type="number" step="1" value={alignment.transform.rotationDeg[axis]} onChange={event => updateTransform('rotationDeg', axis, Number(event.target.value) || 0)} className={fieldClass} /></label>)}</div></div>
            <label><span className="text-xs text-slate-400">Uniform scale</span><input type="number" min="0.0001" step="0.01" value={alignment.transform.uniformScale} onChange={event => onUpdateAlignment({ ...alignment, transform: { ...alignment.transform, uniformScale: Math.max(0.0001, Number(event.target.value) || 1) } })} className={fieldClass} /></label>
            <button type="button" onClick={() => onUpdateAlignment({ ...alignment, transform: { ...DEFAULT_SCAN_ALIGNMENT.transform, translationFt: { ...DEFAULT_SCAN_ALIGNMENT.transform.translationFt }, rotationDeg: { ...DEFAULT_SCAN_ALIGNMENT.transform.rotationDeg } } })} className="w-full rounded border border-slate-700 px-3 py-2 text-sm">Reset transform</button>
            <div className="space-y-2 rounded border border-slate-700 bg-slate-950/60 p-3 text-xs text-slate-400">
              <div><strong className="text-slate-200">Registration:</strong> {alignment.controlPoints.length} matched points{alignment.registrationErrorFt !== undefined ? ` · ${alignment.registrationErrorFt.toFixed(2)} ft RMS error` : ''}</div>
              <button type="button" disabled={!scanUrl || !props.pixelsPerFoot} onClick={() => { setPendingPlanPoint(null); setSelectionStep(selectionStep === 'idle' ? 'plan' : 'idle'); }} className="w-full rounded border border-cyan-600 px-2 py-1.5 text-cyan-200 disabled:opacity-40">{selectionStep === 'idle' ? 'Add matched points' : 'Stop selecting'}</button>
              {alignment.controlPoints.map((pair, index) => <div key={pair.id} className="flex items-center justify-between gap-2"><span>{pair.label}{pair.residualFt !== undefined ? ` · ${pair.residualFt.toFixed(2)} ft` : ''}</span><button type="button" aria-label={`Remove ${pair.label}`} onClick={() => onUpdateAlignment({ ...alignment, controlPoints: alignment.controlPoints.filter((_, pairIndex) => pairIndex !== index), registrationErrorFt: undefined })} className="text-red-300">Remove</button></div>)}
              <button type="button" disabled={alignment.controlPoints.length < 2} onClick={applyRegistration} className="w-full rounded bg-cyan-700 px-2 py-1.5 font-semibold text-white disabled:opacity-40">Apply best fit</button>
              {alignment.controlPoints.length > 0 && <button type="button" onClick={() => onUpdateAlignment({ ...alignment, controlPoints: [], registrationErrorFt: undefined })} className="w-full rounded border border-slate-700 px-2 py-1.5">Clear points</button>}
            </div>
            {alignment.asset && <button type="button" onClick={onRemoveScan} className="w-full rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">Remove scan</button>}
          </div>
        </aside>
      </div>
    </div>
  );
}
