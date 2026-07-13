const svgNS = 'http://www.w3.org/2000/svg';
const LAB_VERSION = '11.0.0';
if (!window.Matter) throw new Error('Matter.js did not load. Check the network connection and refresh.');

const { Engine, Composite, Composites, Bodies, Body, Sleeping } = window.Matter;
const CANVAS = { width: 560, height: 472 };
const PATIO = { x: 20, y: 202, width: 270, height: 270 };
const DIVIDER_X = 420;
const STORAGE_KEY = 'plant-pending-recipe-lab-v11';

const DEFAULT_PLANTS = [
  { id: 'bloodstone', name: 'Bloodstone Thrift', diameter: 34, percentage: 50, mode: 'front-fill', color: '#e88bb8' },
  { id: 'hydrangea', name: 'Early Evolution Hydrangea', diameter: 62, percentage: 30, mode: 'scatter', color: '#eadfcd' },
  { id: 'rose', name: 'Eau de Parfum Blush Rose', diameter: 95, percentage: 13, mode: 'stack', color: '#c8d9bf' },
  { id: 'arborvitae', name: 'UpStanding Emerald Arborvitae', diameter: 140, percentage: 7, mode: 'back-attract', color: '#b9d2b4' },
];

const els = {
  svg: document.querySelector('#recipe-canvas'),
  seed: document.querySelector('#seed'),
  seedValue: document.querySelector('#seed-value'),
  totalPlants: document.querySelector('#total-plants'),
  frontDirection: document.querySelector('#front-direction'),
  physicsPercent: document.querySelector('#physics-percent'),
  spacingPad: document.querySelector('#spacing-pad'),
  editor: document.querySelector('#plant-editor'),
  percentageTotal: document.querySelector('#percentage-total'),
  percentageMessage: document.querySelector('#percentage-message'),
  title: document.querySelector('#view-title'),
  metrics: document.querySelector('#metrics'),
  summary: document.querySelector('#test-summary'),
  debugSummary: document.querySelector('#debug-summary'),
  grid: document.querySelector('#show-grid'),
  centers: document.querySelector('#show-centers'),
  debugOverlay: document.querySelector('#show-debug-overlay'),
  version: document.querySelector('#lab-version'),
};

let state = loadState();
let lastRun = null;

if (els.version) els.version.textContent = `Lab version ${LAB_VERSION} · recipe mix builder`;
document.querySelector('#recipe-description').textContent = 'Tune plant sizes, percentages, and placement modes, then export the settled pattern for reuse in a real zone.';

function cloneDefaults() {
  return {
    totalPlants: 60,
    frontDirection: 'bottom',
    physicsPercent: 90,
    spacingPad: 5,
    plants: DEFAULT_PLANTS.map(plant => ({ ...plant })),
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (parsed?.plants?.length) return parsed;
  } catch {}
  return cloneDefaults();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `plant-${Date.now()}`;
}

function rng(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function renderEditor() {
  els.totalPlants.value = state.totalPlants;
  els.frontDirection.value = state.frontDirection;
  els.physicsPercent.value = state.physicsPercent;
  els.spacingPad.value = state.spacingPad;
  els.editor.innerHTML = state.plants.map((plant, index) => `
    <article class="plant-row" data-index="${index}">
      <div class="plant-row-top">
        <input class="plant-name" value="${plant.name.replaceAll('"', '&quot;')}" aria-label="Plant name" />
        <input class="plant-color" type="color" value="${plant.color}" aria-label="Plant color" />
        <button class="remove-plant icon-button" title="Remove plant" ${state.plants.length <= 1 ? 'disabled' : ''}>×</button>
      </div>
      <div class="plant-row-grid">
        <label>Diameter<input class="plant-diameter" type="number" min="8" max="300" value="${plant.diameter}" /><span>px</span></label>
        <label>Mix<input class="plant-percentage" type="number" min="0" max="100" value="${plant.percentage}" /><span>%</span></label>
      </div>
      <label>Placement
        <select class="plant-mode">
          ${['scatter','stack','line','front-fill','back-attract'].map(mode => `<option value="${mode}" ${plant.mode === mode ? 'selected' : ''}>${mode.replace('-', ' ')}</option>`).join('')}
        </select>
      </label>
    </article>
  `).join('');
  updatePercentageDisplay();
}

function readEditor() {
  state.totalPlants = Math.max(1, Number(els.totalPlants.value) || 1);
  state.frontDirection = els.frontDirection.value;
  state.physicsPercent = Math.max(50, Math.min(100, Number(els.physicsPercent.value) || 90));
  state.spacingPad = Math.max(0, Math.min(20, Number(els.spacingPad.value) || 0));
  [...els.editor.querySelectorAll('.plant-row')].forEach((row, index) => {
    const plant = state.plants[index];
    plant.name = row.querySelector('.plant-name').value.trim() || `Plant ${index + 1}`;
    plant.id = slugify(plant.name);
    plant.color = row.querySelector('.plant-color').value;
    plant.diameter = Math.max(8, Number(row.querySelector('.plant-diameter').value) || 8);
    plant.percentage = Math.max(0, Number(row.querySelector('.plant-percentage').value) || 0);
    plant.mode = row.querySelector('.plant-mode').value;
  });
  saveState();
  updatePercentageDisplay();
}

function updatePercentageDisplay() {
  const total = state.plants.reduce((sum, plant) => sum + Number(plant.percentage || 0), 0);
  els.percentageTotal.textContent = `${total}%`;
  els.percentageMessage.textContent = total === 100 ? 'Ready to generate' : 'Percentages are normalized during generation';
  els.percentageTotal.classList.toggle('warning', total !== 100);
}

function allocateCounts(plants, totalPlants) {
  const percentageTotal = plants.reduce((sum, plant) => sum + Math.max(0, Number(plant.percentage || 0)), 0) || 1;
  const raw = plants.map(plant => totalPlants * Math.max(0, plant.percentage) / percentageTotal);
  const counts = raw.map(Math.floor);
  let remaining = totalPlants - counts.reduce((sum, count) => sum + count, 0);
  const order = raw.map((value, index) => ({ index, remainder: value - Math.floor(value) })).sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < remaining; i += 1) counts[order[i % order.length].index] += 1;
  return counts;
}

function gravityVector(direction) {
  return {
    bottom: { x: 0, y: 1 },
    top: { x: 0, y: -1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  }[direction];
}

function isCenterInZone(record) {
  const { x, y } = record;
  const insideCanvas = x >= 0 && x <= CANVAS.width && y >= 0 && y <= CANVAS.height;
  if (!insideCanvas) return false;
  if (record.mode === 'back-attract') return x >= DIVIDER_X && x <= CANVAS.width;
  const inPlantingArea = x <= DIVIDER_X;
  const inPatio = x >= PATIO.x && x <= PATIO.x + PATIO.width && y >= PATIO.y && y <= PATIO.y + PATIO.height;
  return inPlantingArea && !inPatio;
}

function settle(engine, maxSteps = 2600) {
  let quietFrames = 0;
  for (let step = 0; step < maxSteps; step += 1) {
    Engine.update(engine, 1000 / 120);
    const dynamic = Composite.allBodies(engine.world).filter(body => !body.isStatic);
    const quiet = dynamic.every(body => body.speed < 0.05 && body.angularSpeed < 0.05);
    quietFrames = quiet ? quietFrames + 1 : 0;
    if (quietFrames > 100) return step;
  }
  return maxSteps;
}

function generate() {
  readEditor();
  const seed = Number(els.seed.value);
  const rand = rng(seed * 7919 + 17);
  const gravity = gravityVector(state.frontDirection);
  const engine = Engine.create({
    gravity: { ...gravity, scale: 0.0017 },
    positionIterations: 18,
    velocityIterations: 14,
    constraintIterations: 6,
    enableSleeping: true,
  });

  const wallOptions = { isStatic: true, friction: 0.45, restitution: 0, slop: 0.1 };
  Composite.add(engine.world, [
    Bodies.rectangle(5, CANVAS.height / 2, 10, CANVAS.height, wallOptions),
    Bodies.rectangle(CANVAS.width - 5, CANVAS.height / 2, 10, CANVAS.height, wallOptions),
    Bodies.rectangle(CANVAS.width / 2, 5, CANVAS.width, 10, wallOptions),
    Bodies.rectangle(CANVAS.width / 2, CANVAS.height - 5, CANVAS.width, 10, wallOptions),
    Bodies.rectangle(PATIO.x + PATIO.width / 2, PATIO.y + PATIO.height / 2, PATIO.width, PATIO.height, wallOptions),
    Bodies.rectangle(DIVIDER_X, CANVAS.height / 2, 8, CANVAS.height, wallOptions),
  ]);

  const counts = allocateCounts(state.plants, state.totalPlants);
  const records = [];
  const pruned = [];
  const attempts = [];
  const bodyOptions = { restitution: 0.015, friction: 0.3, frictionStatic: 0.55, frictionAir: 0.02, density: 0.0015, sleepThreshold: 45, slop: 0.05 };

  function physicsRadiusFor(plant) {
    return plant.diameter * (state.physicsPercent / 100) / 2 + rand() * state.spacingPad / 2;
  }

  function spawnPoint(plant, index, count, mode) {
    const radius = plant.diameter / 2;
    const fraction = (index + 1) / (count + 1);
    if (mode === 'front-fill') {
      if (state.frontDirection === 'bottom') return { x: 25 + fraction * (DIVIDER_X - 50), y: 18 + radius };
      if (state.frontDirection === 'top') return { x: 25 + fraction * (DIVIDER_X - 50), y: CANVAS.height - 18 - radius };
      if (state.frontDirection === 'left') return { x: CANVAS.width - 18 - radius, y: 25 + fraction * (CANVAS.height - 50) };
      return { x: 18 + radius, y: 25 + fraction * (CANVAS.height - 50) };
    }
    return { x: 25 + rand() * (DIVIDER_X - 50), y: 18 + radius + rand() * 24 };
  }

  function addDynamic(plant, mode, index, count) {
    const visualRadius = plant.diameter / 2;
    const physicsRadius = physicsRadiusFor(plant);
    const spawn = spawnPoint(plant, index, count, mode);
    const body = Bodies.circle(spawn.x, spawn.y, physicsRadius, { ...bodyOptions, label: plant.id });
    Body.setVelocity(body, { x: (rand() - 0.5) * 0.55, y: (rand() - 0.5) * 0.2 });
    Composite.add(engine.world, body);
    settle(engine, 1600);
    records.push({ id: `${plant.id}-${index + 1}`, plantId: plant.id, name: plant.name, color: plant.color, diameter: plant.diameter, visualRadius, physicsRadius, x: body.position.x, y: body.position.y, mode, body, fixed: false });
    attempts.push({ plantId: plant.id, mode, spawn, final: { x: body.position.x, y: body.position.y }, visualDiameter: plant.diameter, physicsDiameter: physicsRadius * 2 });
  }

  state.plants.forEach((plant, plantIndex) => {
    const count = counts[plantIndex];
    if (!count) return;

    if (plant.mode === 'back-attract') {
      for (let i = 0; i < count; i += 1) {
        const y = ((i + 1) / (count + 1)) * CANVAS.height;
        records.push({ id: `${plant.id}-${i + 1}`, plantId: plant.id, name: plant.name, color: plant.color, diameter: plant.diameter, visualRadius: plant.diameter / 2, physicsRadius: plant.diameter * state.physicsPercent / 200, x: DIVIDER_X + (CANVAS.width - DIVIDER_X) / 2, y, mode: plant.mode, fixed: true });
      }
      return;
    }

    if (plant.mode === 'line') {
      const available = DIVIDER_X - 30;
      for (let i = 0; i < count; i += 1) {
        const x = 15 + ((i + 1) / (count + 1)) * available;
        const y = Math.max(plant.diameter / 2 + 8, PATIO.y - plant.diameter / 2 - 4);
        records.push({ id: `${plant.id}-${i + 1}`, plantId: plant.id, name: plant.name, color: plant.color, diameter: plant.diameter, visualRadius: plant.diameter / 2, physicsRadius: plant.diameter * state.physicsPercent / 200, x, y, mode: plant.mode, fixed: true });
      }
      return;
    }

    if (plant.mode === 'stack') {
      const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
      const rows = Math.ceil(count / columns);
      let created = 0;
      const stack = Composites.stack(35, 24, columns, rows, 8, 8, (x, y) => {
        if (created >= count) return null;
        const visualRadius = plant.diameter / 2;
        const physicsRadius = physicsRadiusFor(plant);
        const body = Bodies.circle(x, y, physicsRadius, { ...bodyOptions, label: plant.id });
        records.push({ id: `${plant.id}-${created + 1}`, plantId: plant.id, name: plant.name, color: plant.color, diameter: plant.diameter, visualRadius, physicsRadius, x, y, mode: plant.mode, body, fixed: false });
        created += 1;
        return body;
      });
      Composite.add(engine.world, stack);
      settle(engine, 2200);
      return;
    }

    for (let i = 0; i < count; i += 1) addDynamic(plant, plant.mode, i, count);
  });

  settle(engine, 2600);
  records.filter(record => record.body).forEach(record => {
    record.x = record.body.position.x;
    record.y = record.body.position.y;
    delete record.body;
  });

  const kept = records.filter(record => {
    const keep = isCenterInZone(record);
    if (!keep) pruned.push({ id: record.id, plantId: record.plantId, reason: 'center-outside-zone', center: { x: record.x, y: record.y } });
    return keep;
  });

  const normalizedPlants = kept.map(record => ({ ...record, nx: record.x / CANVAS.width, ny: record.y / CANVAS.height }));
  const countByPlant = Object.fromEntries(state.plants.map(plant => [plant.id, kept.filter(record => record.plantId === plant.id).length]));

  lastRun = {
    recipeVersion: `recipe-mix-builder-v${LAB_VERSION}`,
    generatedAt: new Date().toISOString(),
    settings: { seed, totalPlants: state.totalPlants, frontDirection: state.frontDirection, physicsPercent: state.physicsPercent, spacingPad: state.spacingPad, canvas: CANVAS, patio: PATIO, dividerX: DIVIDER_X },
    plants: state.plants,
    allocatedCounts: Object.fromEntries(state.plants.map((plant, index) => [plant.id, counts[index]])),
    placementModes: Object.fromEntries(state.plants.map(plant => [plant.id, plant.mode])),
    zoneFitRules: { centerMustBeInsideZone: true, centerMustBeOutsideExclusions: true, pruneInvalidPlants: true },
    normalizedPlants,
    pruned,
    attempts,
    summary: { requested: state.totalPlants, kept: kept.length, pruned: pruned.length, countByPlant },
  };

  render(kept, seed, pruned.length, countByPlant);
}

function line(x1, y1, x2, y2, stroke, width, dash = '') {
  const element = document.createElementNS(svgNS, 'line');
  Object.entries({ x1, y1, x2, y2, stroke, 'stroke-width': width }).forEach(([key, value]) => element.setAttribute(key, value));
  if (dash) element.setAttribute('stroke-dasharray', dash);
  els.svg.append(element);
}

function render(records, seed, prunedCount, countByPlant) {
  els.svg.innerHTML = '';
  els.svg.setAttribute('viewBox', `0 0 ${CANVAS.width} ${CANVAS.height}`);
  if (els.grid.checked) {
    for (let x = 0; x <= CANVAS.width; x += 25) line(x, 0, x, CANVAS.height, '#cfd4c7', '1');
    for (let y = 0; y <= CANVAS.height; y += 25) line(0, y, CANVAS.width, y, '#cfd4c7', '1');
  }

  const patio = document.createElementNS(svgNS, 'rect');
  Object.entries({ x: PATIO.x, y: PATIO.y, width: PATIO.width, height: PATIO.height, fill: '#f2eee6', stroke: '#8f8a80', 'stroke-width': '2' }).forEach(([key, value]) => patio.setAttribute(key, value));
  els.svg.append(patio);
  line(DIVIDER_X, 0, DIVIDER_X, CANVAS.height, '#f28c00', '6');
  line(PATIO.x, PATIO.y, PATIO.x + PATIO.width, PATIO.y, '#22d52f', '6');
  line(PATIO.x + PATIO.width, PATIO.y, PATIO.x + PATIO.width, CANVAS.height, '#22d52f', '6');

  records.forEach(item => {
    const circle = document.createElementNS(svgNS, 'circle');
    Object.entries({ cx: item.x, cy: item.y, r: item.visualRadius, fill: item.color, 'fill-opacity': item.mode === 'back-attract' ? '.72' : '.84', stroke: '#fff', 'stroke-opacity': '.78', 'stroke-width': '2' }).forEach(([key, value]) => circle.setAttribute(key, value));
    els.svg.append(circle);
    if (els.centers.checked) {
      const dot = document.createElementNS(svgNS, 'circle');
      Object.entries({ cx: item.x, cy: item.y, r: '3', fill: '#111' }).forEach(([key, value]) => dot.setAttribute(key, value));
      els.svg.append(dot);
    }
    if (els.debugOverlay.checked) {
      const physics = document.createElementNS(svgNS, 'circle');
      Object.entries({ cx: item.x, cy: item.y, r: item.physicsRadius, fill: 'none', stroke: '#222', 'stroke-width': '1', 'stroke-dasharray': '4 3' }).forEach(([key, value]) => physics.setAttribute(key, value));
      els.svg.append(physics);
    }
  });

  els.title.textContent = `560 × 472 reference pixels, seed ${seed}`;
  els.seedValue.textContent = seed;
  els.metrics.innerHTML = state.plants.map(plant => `<div class="metric"><strong>${countByPlant[plant.id] || 0}</strong><span>${plant.name}<br>${plant.percentage}% · ${plant.mode.replace('-', ' ')}</span></div>`).join('');
  els.summary.innerHTML = `<strong>${records.length} plants kept</strong><br><span class="muted">${prunedCount} pruned by center point · ${state.totalPlants} requested</span>`;
  els.debugSummary.innerHTML = `<strong>${state.plants.length} plant types</strong><br><span class="muted">${state.physicsPercent}% collision bodies · 0–${state.spacingPad}px random pad · ${state.frontDirection} front</span>`;
}

function downloadJson(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

els.editor.addEventListener('input', () => { readEditor(); });
els.editor.addEventListener('change', () => { readEditor(); });
els.editor.addEventListener('click', event => {
  const button = event.target.closest('.remove-plant');
  if (!button) return;
  const row = button.closest('.plant-row');
  state.plants.splice(Number(row.dataset.index), 1);
  saveState();
  renderEditor();
  generate();
});

document.querySelector('#add-plant').addEventListener('click', () => {
  const index = state.plants.length + 1;
  state.plants.push({ id: `plant-${index}`, name: `New Plant ${index}`, diameter: 50, percentage: 0, mode: 'scatter', color: '#9fc6a4' });
  saveState();
  renderEditor();
});
document.querySelector('#reset-defaults').addEventListener('click', () => { state = cloneDefaults(); saveState(); renderEditor(); generate(); });
document.querySelector('#regenerate').addEventListener('click', generate);
document.querySelector('#next-seed').addEventListener('click', () => { els.seed.value = (Number(els.seed.value) % 100) + 1; generate(); });
[els.seed, els.grid, els.centers, els.debugOverlay].forEach(element => element.addEventListener('change', generate));
[els.totalPlants, els.frontDirection, els.physicsPercent, els.spacingPad].forEach(element => element.addEventListener('change', generate));
document.querySelector('#download-debug').addEventListener('click', () => lastRun && downloadJson(`plant-pending-recipe-debug-seed-${lastRun.settings.seed}.json`, lastRun));
document.querySelector('#download-recipe').addEventListener('click', () => {
  if (!lastRun) return;
  downloadJson('plant-pending-zone-ready-recipe.json', {
    recipeVersion: lastRun.recipeVersion,
    plants: lastRun.plants,
    settings: lastRun.settings,
    zoneFitRules: lastRun.zoneFitRules,
    normalizedPlants: lastRun.normalizedPlants,
  });
});

renderEditor();
generate();