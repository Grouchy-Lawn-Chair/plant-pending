import { pointInPolygon, runRecipePhysics, type PhysicsPoint, type RecipePhysicsPlacement } from './engine/recipePhysicsEngine';

const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
const context = canvas.getContext('2d')!;
const seedInput = document.querySelector<HTMLInputElement>('#seed')!;
const densityInput = document.querySelector<HTMLInputElement>('#density')!;
const densityValue = document.querySelector<HTMLSpanElement>('#density-value')!;
const shapeSelect = document.querySelector<HTMLSelectElement>('#shape')!;
const checks = document.querySelector<HTMLDivElement>('#checks')!;

const shapes: Record<string, PhysicsPoint[]> = {
  wide: [{ x: 70, y: 130 }, { x: 830, y: 130 }, { x: 830, y: 500 }, { x: 70, y: 500 }],
  narrow: [{ x: 260, y: 55 }, { x: 640, y: 55 }, { x: 640, y: 565 }, { x: 260, y: 565 }],
  irregular: [{ x: 90, y: 110 }, { x: 520, y: 70 }, { x: 820, y: 180 }, { x: 740, y: 520 }, { x: 390, y: 560 }, { x: 120, y: 430 }],
  curve: [{ x: 90, y: 250 }, { x: 180, y: 115 }, { x: 430, y: 70 }, { x: 710, y: 130 }, { x: 830, y: 280 }, { x: 720, y: 500 }, { x: 420, y: 555 }, { x: 160, y: 475 }],
};

const plants = [
  { key: 'hedge', plantId: 657, radius: 23, layer: 'back' as const, weight: 18, clump: 1.3 },
  { key: 'shrub', plantId: 683, radius: 20, layer: 'middle' as const, weight: 34, clump: 0.85 },
  { key: 'flower', plantId: 912, radius: 16, layer: 'accent' as const, weight: 18, clump: 1.5 },
  { key: 'edge', plantId: 475, radius: 11, layer: 'front' as const, weight: 30, clump: 0.7 },
];

const colors: Record<string, string> = {
  hedge: '#2f855a',
  shrub: '#60a5fa',
  flower: '#ec4899',
  edge: '#14b8a6',
};

function drawPolygon(polygon: PhysicsPoint[]) {
  context.beginPath();
  polygon.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
  context.closePath();
  context.fillStyle = '#e7eadf';
  context.fill();
  context.strokeStyle = '#334155';
  context.lineWidth = 3;
  context.stroke();
}

function drawPlant(plant: RecipePhysicsPlacement) {
  context.save();
  context.translate(plant.x, plant.y);
  context.rotate((plant.rotationDeg * Math.PI) / 180);
  context.beginPath();
  context.arc(0, 0, plant.radius, 0, Math.PI * 2);
  context.fillStyle = colors[plant.key] || '#94a3b8';
  context.globalAlpha = 0.78;
  context.fill();
  context.globalAlpha = 1;
  context.strokeStyle = '#0f172a';
  context.lineWidth = 1.5;
  context.stroke();
  context.restore();
}

function setStat(id: string, value: number) {
  document.querySelector<HTMLElement>(`#${id}`)!.textContent = String(value);
}

function run() {
  const polygon = shapes[shapeSelect.value];
  const seed = Number(seedInput.value || 1);
  const density = Number(densityInput.value) / 100;
  const result = runRecipePhysics({ polygon, plants, seed, density, iterations: 240, padding: 2 });

  context.clearRect(0, 0, canvas.width, canvas.height);
  drawPolygon(polygon);
  result.placements.forEach(drawPlant);

  setStat('requested', result.diagnostics.requested);
  setStat('placed', result.diagnostics.placed);
  setStat('rejected', result.diagnostics.rejected);
  setStat('overlaps', result.diagnostics.unresolvedOverlaps);

  const allInside = result.placements.every(item => pointInPolygon(item, polygon));
  const hasLayers = new Set(result.placements.map(item => item.layer)).size >= 3;
  const acceptablePlacement = result.diagnostics.placed >= Math.max(4, Math.round(result.diagnostics.requested * 0.72));
  const acceptableOverlap = result.diagnostics.unresolvedOverlaps <= 1;
  const testRows = [
    ['Centers stay inside the zone', allInside],
    ['At least three layers survive', hasLayers],
    ['At least 72% of plants are placed', acceptablePlacement],
    ['No more than one unresolved overlap', acceptableOverlap],
  ];
  checks.innerHTML = testRows.map(([label, passed]) => `<div class="check ${passed ? 'pass' : 'fail'}">${passed ? 'PASS' : 'FAIL'} · ${label}</div>`).join('');
}

densityInput.addEventListener('input', () => {
  densityValue.textContent = `${densityInput.value}%`;
});
densityInput.addEventListener('change', run);
shapeSelect.addEventListener('change', run);
document.querySelector('#run')!.addEventListener('click', run);
document.querySelector('#next')!.addEventListener('click', () => {
  seedInput.value = String(Number(seedInput.value || 1) + 1);
  run();
});
seedInput.addEventListener('change', run);

run();
