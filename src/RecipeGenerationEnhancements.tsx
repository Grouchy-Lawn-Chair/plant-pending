import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GardenPlan, GardenZone, PlacedPlant } from './types/plant';

const CURRENT_PLAN_KEY = 'garden-planner-current';
type Point = { x: number; y: number };
type PlantCardInfo = { name: string; widthInches: number; enabled: boolean; placement: string; checkbox: HTMLInputElement; widthInput: HTMLInputElement };
type PendingRun = { button: HTMLButtonElement; zone: GardenZone; plan: GardenPlan; issues: Array<{ plant: PlantCardInfo; availableInches: number }>; hedgePlants: PlantCardInfo[] };

type HookNode = { memoizedState?: unknown; queue?: { dispatch?: (value: unknown) => void } | null; next?: HookNode | null };
type FiberNode = { child?: FiberNode | null; sibling?: FiberNode | null; return?: FiberNode | null; memoizedProps?: Record<string, unknown> | null; pendingProps?: Record<string, unknown> | null; memoizedState?: HookNode | null };

const messages = [
  'Measuring the dirt. It remains dirt.',
  'Dropping tiny botanical marbles into the garden jar…',
  'Politely asking the shrubs to stop sitting on each other…',
  'Applying a suspicious but legal amount of gravity…',
  'Checking the weird corners where plants go to hide…',
  'Rocks remain extremely committed to their locations.',
  'Evicting plants from the forbidden polygon…',
  'Final shrub inspection. Clipboards have appeared.',
];

function readPlan(): GardenPlan | null { try { const raw = localStorage.getItem(CURRENT_PLAN_KEY); return raw ? JSON.parse(raw) as GardenPlan : null; } catch { return null; } }
function findFiber(element: Element | null): FiberNode | null { let current = element; while (current) { const key = Object.keys(current).find(name => name.startsWith('__reactFiber$')); if (key) return (current as unknown as Record<string, FiberNode>)[key] || null; current = current.parentElement; } return null; }
function rootOf(start: FiberNode | null) { let root = start; if (!root) return null; while (root.return) root = root.return; return root; }
function findCallback(start: FiberNode | null, name: string): ((plan: GardenPlan) => void) | null { const root = rootOf(start); if (!root) return null; const stack = [root], seen = new Set<FiberNode>(); while (stack.length) { const fiber = stack.pop()!; if (seen.has(fiber)) continue; seen.add(fiber); const callback = fiber.memoizedProps?.[name] ?? fiber.pendingProps?.[name]; if (typeof callback === 'function') return callback as (plan: GardenPlan) => void; if (fiber.sibling) stack.push(fiber.sibling); if (fiber.child) stack.push(fiber.child); } return null; }
function applyPlan(plan: GardenPlan) { const host = document.querySelector<HTMLElement>('[data-recipe-react-host]') || document.getElementById('root'); const callback = findCallback(findFiber(host), 'onImportPlan') || findCallback(findFiber(host), 'onLoadPlan'); if (!callback) return false; callback(plan); return true; }
function pointInPolygon(point: Point, polygon: Point[]) { let inside = false; for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) { const a = polygon[i], b = polygon[j]; if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || 1e-9) + a.x) inside = !inside; } return inside; }
function bounds(points: Point[]) { return { minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)), minY: Math.min(...points.map(p => p.y)), maxY: Math.max(...points.map(p => p.y)) }; }
function distanceToSegment(point: Point, a: Point, b: Point) { const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / l2)); return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy)); }
function edgeDistance(point: Point, polygon: Point[]) { return Math.min(...polygon.map((a, i) => distanceToSegment(point, a, polygon[(i + 1) % polygon.length]))); }
function radius(plant: PlacedPlant, ppf: number) { return Math.max(5, ((plant.displayWidthFt || 2) * ppf) / 2); }
function isMergeable(plant: PlacedPlant) { return plant.notes?.includes('[mergeable]') ?? false; }
function driftId(plant: PlacedPlant) { return plant.notes?.match(/\[drift:([^\]]+)\]/)?.[1] || null; }
function sameMergeDrift(a: PlacedPlant, b: PlacedPlant) { return a.plantId === b.plantId && isMergeable(a) && isMergeable(b) && driftId(a) && driftId(a) === driftId(b); }
function relevantExclusions(plan: GardenPlan, zone: GardenZone) { const z = bounds(zone.points); return (plan.zones || []).filter(candidate => { if (candidate.zoneType !== 'exclusion' || candidate.points.length < 3) return false; const b = bounds(candidate.points); return b.maxX >= z.minX && b.minX <= z.maxX && b.maxY >= z.minY && b.minY <= z.maxY; }); }
function rockRadius(rock: PlacedPlant, ppf: number) { return Math.max(6, ((rock.rockSizeFt || 2) * ppf) / 2); }
function validCenter(point: Point, r: number, zone: GardenZone, exclusions: GardenZone[], rocks: PlacedPlant[], ppf: number) { if (!pointInPolygon(point, zone.points) || edgeDistance(point, zone.points) < r) return false; for (const exclusion of exclusions) if (pointInPolygon(point, exclusion.points) || edgeDistance(point, exclusion.points) < r) return false; return rocks.every(rock => Math.hypot(point.x - rock.x, point.y - rock.y) >= r + rockRadius(rock, ppf)); }
function collectPlantCards(host: HTMLElement): PlantCardInfo[] { return [...host.querySelectorAll<HTMLElement>('div.rounded-xl')].flatMap(card => { const checkbox = card.querySelector<HTMLInputElement>('input[type="checkbox"]'); const widthLabel = [...card.querySelectorAll('label')].find(label => label.textContent?.includes('Width in')); const widthInput = widthLabel?.querySelector<HTMLInputElement>('input[type="number"]'); const placementLabel = [...card.querySelectorAll('label')].find(label => label.textContent?.includes('Placement')); const placement = placementLabel?.querySelector<HTMLSelectElement>('select')?.value || ''; const name = card.querySelector<HTMLElement>('.font-bold')?.textContent?.trim() || ''; return checkbox && widthInput && name ? [{ name, widthInches: Number(widthInput.value) || 0, enabled: checkbox.checked, placement, checkbox, widthInput }] : []; }); }
function maximumClearDiameter(zone: GardenZone, exclusions: GardenZone[], rocks: PlacedPlant[], ppf: number) { const box = bounds(zone.points); let best = 0; for (let yi = 0; yi <= 36; yi++) for (let xi = 0; xi <= 36; xi++) { const q = { x: box.minX + xi / 36 * (box.maxX - box.minX), y: box.minY + yi / 36 * (box.maxY - box.minY) }; if (!pointInPolygon(q, zone.points)) continue; let r = edgeDistance(q, zone.points); for (const exclusion of exclusions) r = pointInPolygon(q, exclusion.points) ? 0 : Math.min(r, edgeDistance(q, exclusion.points)); for (const rock of rocks) r = Math.min(r, Math.max(0, Math.hypot(q.x - rock.x, q.y - rock.y) - rockRadius(rock, ppf))); best = Math.max(best, r); } return best * 2 / ppf * 12; }
function setInputValue(input: HTMLInputElement, value: string) { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set; setter?.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); }

async function cleanGeneratedZone(plan: GardenPlan, zone: GardenZone, progress: (value: number) => void) {
  const ppf = plan.scalePixelsPerFoot || 20;
  const all = plan.placedPlants || [];
  const plants = all.filter(item => item.zone === zone.id && item.itemType !== 'rock').map(item => ({ ...item }));
  const rocks = all.filter(item => item.itemType === 'rock' && (pointInPolygon(item, zone.points) || item.zone === zone.id));
  const exclusions = relevantExclusions(plan, zone);
  const rejected = new Set<string>();

  // Preserve the recipe arrangement. Only repair invalid obstacle/boundary placements.
  for (let index = 0; index < plants.length; index++) {
    const plant = plants[index], r = radius(plant, ppf);
    if (validCenter(plant, r, zone, exclusions, rocks, ppf)) continue;
    const box = bounds(zone.points); let best: Point | null = null, score = Infinity;
    for (let yi = 0; yi <= 42; yi++) for (let xi = 0; xi <= 42; xi++) {
      const q = { x: box.minX + xi / 42 * (box.maxX - box.minX), y: box.minY + yi / 42 * (box.maxY - box.minY) };
      if (!validCenter(q, r, zone, exclusions, rocks, ppf)) continue;
      const d = Math.hypot(q.x - plant.x, q.y - plant.y);
      if (d < score) { score = d; best = q; }
    }
    if (best) Object.assign(plant, best); else rejected.add(plant.instanceId);
    if (index % 8 === 0) { progress(72 + Math.round(index / Math.max(1, plants.length) * 18)); await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); }
  }

  // Separate unrelated plants only. Same-species members of a mergeable drift may overlap and smoosh.
  for (let pass = 0; pass < 24; pass++) {
    for (let i = 0; i < plants.length; i++) for (let j = i + 1; j < plants.length; j++) {
      const a = plants[i], b = plants[j]; if (rejected.has(a.instanceId) || rejected.has(b.instanceId) || sameMergeDrift(a, b)) continue;
      const ra = radius(a, ppf), rb = radius(b, ppf), dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || .001, preferred = (ra + rb) * .9;
      if (d >= preferred) continue; const push = (preferred - d) * .35, ux = dx / d, uy = dy / d;
      const qa = { x: a.x - ux * push, y: a.y - uy * push }, qb = { x: b.x + ux * push, y: b.y + uy * push };
      if (validCenter(qa, ra, zone, exclusions, rocks, ppf)) Object.assign(a, qa);
      if (validCenter(qb, rb, zone, exclusions, rocks, ppf)) Object.assign(b, qb);
    }
    if (pass % 6 === 0) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  }
  const replacements = new Map(plants.map(item => [item.instanceId, item]));
  return { ...plan, placedPlants: all.flatMap(item => rejected.has(item.instanceId) ? [] : [replacements.get(item.instanceId) || item]), updatedAt: new Date().toISOString() };
}

export default function RecipeGenerationEnhancements() {
  const [visible, setVisible] = useState(false);
  const [stage, setStage] = useState(0);
  const [pending, setPending] = useState<PendingRun | null>(null);
  const [trimWidths, setTrimWidths] = useState<Record<string, number>>({});
  const rotatingMessage = useMemo(() => messages[stage % messages.length], [stage]);

  useEffect(() => { if (!visible) return; const timer = window.setInterval(() => setStage(value => value + 1), 1150); return () => window.clearInterval(timer); }, [visible]);
  useEffect(() => {
    let running = false, bypass = false;
    const run = (button: HTMLButtonElement, zone: GardenZone, beforePlan: GardenPlan) => {
      running = true; setStage(0); setVisible(true); const stamp = beforePlan.updatedAt || '';
      window.setTimeout(() => { bypass = true; button.click(); bypass = false; let attempts = 0; const poll = window.setInterval(async () => { attempts++; const next = readPlan(); if (!next || next.updatedAt === stamp) { if (attempts > 180) { window.clearInterval(poll); setStage(7); window.setTimeout(() => setVisible(false), 1400); running = false; } return; } window.clearInterval(poll); setStage(5); const freshZone = next.zones.find(item => item.id === zone.id) || zone; const improved = await cleanGeneratedZone(next, freshZone, () => setStage(value => Math.max(value, 6))); applyPlan(improved); localStorage.setItem(CURRENT_PLAN_KEY, JSON.stringify(improved)); setStage(7); window.setTimeout(() => setVisible(false), 900); running = false; }, 120); }, 120);
    };
    const onClick = (event: MouseEvent) => { const button = (event.target as Element | null)?.closest<HTMLButtonElement>('button'); const host = button?.closest<HTMLElement>('[data-recipe-react-host]'); if (!button || !host || bypass || running) return; const text = button.textContent?.trim().toLowerCase() || ''; if (text !== 'generate' && text !== 'new seed + generate') return; event.preventDefault(); event.stopImmediatePropagation(); const modal = host.closest('div.fixed') || host.parentElement, zoneName = modal?.querySelector('h3')?.textContent?.trim() || '', plan = readPlan(), zone = plan?.zones.find(item => item.name === zoneName); if (!plan || !zone) return; const cards = collectPlantCards(host).filter(item => item.enabled), exclusions = relevantExclusions(plan, zone), ppf = plan.scalePixelsPerFoot || 20, rocks = plan.placedPlants.filter(item => item.itemType === 'rock' && (pointInPolygon(item, zone.points) || item.zone === zone.id)), available = maximumClearDiameter(zone, exclusions, rocks, ppf), issues = cards.filter(item => item.widthInches > available * 1.02).map(plant => ({ plant, availableInches: available })), hedgePlants = cards.filter(item => item.placement === 'back-attract'); if (issues.length || hedgePlants.length) { setTrimWidths(Object.fromEntries(hedgePlants.map(item => [item.name, item.widthInches]))); setPending({ button, zone, plan, issues, hedgePlants }); return; } run(button, zone, plan); };
    const proceed = (event: Event) => { const detail = (event as CustomEvent<{ button: HTMLButtonElement; zone: GardenZone; plan: GardenPlan }>).detail; run(detail.button, detail.zone, detail.plan); };
    document.addEventListener('recipe-preflight-proceed', proceed); document.addEventListener('click', onClick, true); return () => { document.removeEventListener('recipe-preflight-proceed', proceed); document.removeEventListener('click', onClick, true); };
  }, []);

  const proceed = (mode: 'adjust' | 'exclude' | 'trim' | 'anyway') => { if (!pending) return; if (mode === 'adjust') { setPending(null); return; } if (mode === 'exclude') pending.issues.forEach(issue => issue.plant.checkbox.click()); if (mode === 'trim') pending.hedgePlants.forEach(item => setInputValue(item.widthInput, String(trimWidths[item.name] ?? item.widthInches))); const detail = { button: pending.button, zone: pending.zone, plan: pending.plan }; setPending(null); window.setTimeout(() => document.dispatchEvent(new CustomEvent('recipe-preflight-proceed', { detail })), 100); };

  return <>
    {pending && createPortal(<div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"><div className="max-h-[calc(100vh-32px)] w-[min(620px,100%)] overflow-auto rounded-3xl border border-amber-300/35 bg-slate-950 p-6 text-white shadow-2xl"><div className="text-[11px] font-black uppercase tracking-[.2em] text-amber-300">Pre-shrub flight check</div><h2 className="mt-2 text-xl font-black">Before we launch several plants into a polygon…</h2>{pending.issues.length > 0 && <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-950/25 p-4"><div className="font-bold text-amber-200">Too large at the current width</div>{pending.issues.map(issue => <div key={issue.plant.name} className="mt-1 text-sm">• {issue.plant.name}: {Math.round(issue.plant.widthInches)} in; about {Math.round(issue.availableInches)} in fits.</div>)}</div>}{pending.hedgePlants.length > 0 && <div className="mt-4 rounded-2xl border border-violet-400/30 bg-violet-950/25 p-4"><div className="font-bold text-violet-200">Hedge detected. It would like a haircut plan.</div><div className="mt-2 space-y-3">{pending.hedgePlants.map(item => <label key={item.name} className="block text-sm"><span className="font-bold">{item.name}</span><span className="ml-2 text-slate-400">mature: {item.widthInches} in</span><input type="number" min="6" max="240" value={trimWidths[item.name] ?? item.widthInches} onChange={event => setTrimWidths(value => ({ ...value, [item.name]: Number(event.target.value) || 6 }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2" /></label>)}</div><button type="button" onClick={() => proceed('trim')} className="mt-3 w-full rounded-xl bg-violet-600 px-3 py-2.5 font-bold">Use these maintained widths and generate</button></div>}<div className="mt-4 grid gap-2 sm:grid-cols-2">{pending.issues.length > 0 && <button onClick={() => proceed('exclude')} className="rounded-xl bg-amber-600 px-3 py-2.5 font-bold">Exclude plants that cannot fit</button>}<button onClick={() => proceed('adjust')} className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 font-bold">Go back and adjust widths</button><button onClick={() => proceed('anyway')} className="rounded-xl border border-rose-500/50 bg-rose-950/40 px-3 py-2.5 font-bold">Generate anyway, tempt fate</button></div></div></div>, document.body)}
    {visible && createPortal(<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/55 backdrop-blur-sm"><style>{`@keyframes shrub-slide{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}`}</style><div className="w-[min(560px,calc(100vw-32px))] rounded-3xl border border-violet-300/30 bg-slate-950 p-6 shadow-2xl"><div className="text-[11px] font-black uppercase tracking-[.2em] text-violet-300">Botanical machinery in progress</div><div className="mt-2 text-xl font-black text-white">Please remain calm. The plants are being negotiated with.</div><div className="mt-4 min-h-14 rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-200">{rotatingMessage}</div><div className="relative mt-5 h-4 overflow-hidden rounded-full border border-slate-700 bg-slate-900"><div className="absolute inset-y-0 w-1/3 rounded-full bg-violet-400" style={{ animation: 'shrub-slide 1.4s linear infinite' }} /></div><div className="mt-2 flex justify-between text-xs text-slate-400"><span>Still shrubbin’…</span><span>Probably needs a shrub.</span></div></div></div>, document.body)}
  </>;
}
