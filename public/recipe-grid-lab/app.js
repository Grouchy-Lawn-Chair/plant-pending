const svgNS = 'http://www.w3.org/2000/svg';
const LAB_VERSION = '10.0.0';
const recipe = await fetch('./recipe.json').then(response => response.json());

if (!window.Matter) throw new Error('Matter.js did not load. Check the network connection and refresh.');

const { Engine, Composite, Bodies, Body, Sleeping } = window.Matter;
const els = {
  svg: document.querySelector('#recipe-canvas'),
  size: document.querySelector('#grid-size'),
  shape: document.querySelector('#shape'),
  seed: document.querySelector('#seed'),
  seedValue: document.querySelector('#seed-value'),
  title: document.querySelector('#view-title'),
  legend: document.querySelector('#legend'),
  metrics: document.querySelector('#metrics'),
  summary: document.querySelector('#test-summary'),
  debugSummary: document.querySelector('#debug-summary'),
  grid: document.querySelector('#show-grid'),
  centers: document.querySelector('#show-centers'),
  debugOverlay: document.querySelector('#show-debug-overlay'),
  downloadDebug: document.querySelector('#download-debug'),
  version: document.querySelector('#lab-version'),
};

const CANVAS = { width: 560, height: 472 };
const PATIO = { x: 20, y: 202, width: 270, height: 270 };
const DIVIDER_X = 420;
const HEDGE_CENTER_X = 490;
const VISUAL_DIAMETER = { 1: 34, 2: 62, 3: 115, 4: 140 };
const COLORS = Object.fromEntries(recipe.plants.map(plant => [plant.id, plant.color]));

if (els.version) els.version.textContent = `Lab version ${LAB_VERSION} · pixel jar physics`;
document.querySelector('#recipe-name').textContent = recipe.name;
document.querySelector('#recipe-description').textContent = 'Reference-pixel physics test: 560 × 472 area, 270 × 270 patio, one disc dropped at a time.';
els.legend.innerHTML = recipe.plants.map(plant => `
  <div class="legend-item"><span class="swatch" style="background:${plant.color}"></span>
  <div><strong>${plant.name}</strong><span>${plant.role.replaceAll('-', ' ')}</span></div></div>
`).join('');

let lastRun = null;

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function line(x1, y1, x2, y2, stroke, width, dash = '') {
  const element = document.createElementNS(svgNS, 'line');
  Object.entries({ x1, y1, x2, y2, stroke, 'stroke-width': width }).forEach(([key, value]) => element.setAttribute(key, value));
  if (dash) element.setAttribute('stroke-dasharray', dash);
  els.svg.append(element);
}

function circle(item) {
  const element = document.createElementNS(svgNS, 'circle');
  Object.entries({
    cx: item.x,
    cy: item.y,
    r: item.visualRadius,
    fill: COLORS[item.plantId],
    'fill-opacity': item.plantId === 4 ? '.72' : '.84',
    stroke: '#fff',
    'stroke-opacity': '.78',
    'stroke-width': '2',
  }).forEach(([key, value]) => element.setAttribute(key, value));
  els.svg.append(element);
}

function settle(engine, focusBody) {
  Sleeping.set(focusBody, false);
  let quietFrames = 0;
  let steps = 0;
  for (; steps < 3600; steps += 1) {
    Engine.update(engine, 1000 / 120);
    const dynamic = Composite.allBodies(engine.world).filter(body => !body.isStatic);
    const quiet = dynamic.every(body => body.speed < 0.045 && body.angularSpeed < 0.045);
    quietFrames = quiet ? quietFrames + 1 : 0;
    if (quietFrames > 120) break;
  }
  return steps;
}

function generate() {
  const seed = Number(els.seed.value);
  const rand = rng(seed * 7919 + 17);
  const engine = Engine.create({
    gravity: { x: 0, y: 1, scale: 0.0017 },
    positionIterations: 18,
    velocityIterations: 14,
    constraintIterations: 6,
    enableSleeping: true,
  });

  const wall = { isStatic: true, friction: 0.45, restitution: 0, slop: 0.1 };
  const walls = [
    Bodies.rectangle(10, CANVAS.height / 2, 20, CANVAS.height + 120, wall),
    Bodies.rectangle(CANVAS.width - 10, CANVAS.height / 2, 20, CANVAS.height + 120, wall),
    Bodies.rectangle(CANVAS.width / 2, CANVAS.height - 5, CANVAS.width, 10, wall),
    Bodies.rectangle(PATIO.x + PATIO.width / 2, PATIO.y + PATIO.height / 2, PATIO.width, PATIO.height, wall),
    Bodies.rectangle(DIVIDER_X, CANVAS.height / 2, 8, CANVAS.height + 80, wall),
  ];
  Composite.add(engine.world, walls);

  const records = [];
  const attempts = [];
  const modules = [];
  const anchors = [];

  // Arborvitae are the only anchored plants. Four match the source plan.
  const hedgeYs = [70, 183, 296, 409];
  hedgeYs.forEach((y, index) => {
    records.push({
      id: `hedge-${index + 1}`,
      plantId: 4,
      x: HEDGE_CENTER_X,
      y,
      visualRadius: VISUAL_DIAMETER[4] / 2,
      physicsRadius: VISUAL_DIAMETER[4] / 2,
      fixed: true,
      group: 'hedge',
    });
    anchors.push({ id: `hedge-${index + 1}`, type: 'hedge', x: HEDGE_CENTER_X, y, sticky: true });
  });
  modules.push({ id: 'hedge', type: 'hedge', requested: 4, placed: 4 });

  const bodyOptions = {
    restitution: 0.015,
    friction: 0.28,
    frictionStatic: 0.5,
    frictionAir: 0.018,
    density: 0.0015,
    sleepThreshold: 45,
    slop: 0.05,
  };

  function dropPlant(plantId, spawnX, group, order) {
    const visualRadius = VISUAL_DIAMETER[plantId] / 2;
    // 90% physics body allows at most 10% visual overlap. Random 0–5 px padding
    // increases the collision body without changing the rendered plant size.
    const randomPad = rand() * 5;
    const physicsRadius = visualRadius * 0.9 + randomPad / 2;
    const x = Math.max(12 + physicsRadius, Math.min(CANVAS.width - 12 - physicsRadius, spawnX + (rand() - 0.5) * 18));
    const y = -visualRadius - 12 - rand() * 35;
    const body = Bodies.circle(x, y, physicsRadius, { ...bodyOptions, label: `${plantId}:${group}:${order}` });
    Body.setVelocity(body, { x: (rand() - 0.5) * 0.7, y: 0 });
    Composite.add(engine.world, body);
    const steps = settle(engine, body);
    const record = {
      id: `${group}-${order}`,
      plantId,
      x: body.position.x,
      y: body.position.y,
      visualRadius,
      physicsRadius,
      pad: randomPad,
      fixed: false,
      group,
      order,
      body,
    };
    records.push(record);
    attempts.push({
      id: record.id,
      plantId,
      group,
      order,
      spawnX,
      finalX: record.x,
      finalY: record.y,
      visualDiameter: VISUAL_DIAMETER[plantId],
      physicsDiameter: physicsRadius * 2,
      randomPad,
      steps,
      sleeping: body.isSleeping,
      speed: body.speed,
    });
  }

  // Numbered-style sequence. First build the right planting column from the bottom,
  // then fill the top jar. Seed only jitters each release point.
  const rightSequence = [
    [2, 350], [2, 385], [1, 320], [1, 365], [3, 350], [1, 315], [2, 375], [2, 330],
    [1, 390], [1, 345], [1, 305], [2, 365], [1, 330], [1, 395], [2, 315], [1, 350],
    [1, 380], [2, 340], [1, 310], [1, 370], [2, 390], [1, 325], [1, 355],
  ];
  const topSequence = [
    [2, 350], [2, 300], [1, 270], [1, 235], [1, 205], [1, 175], [1, 145], [1, 110],
    [1, 80], [1, 50], [2, 90], [2, 145], [2, 205], [2, 265], [2, 325], [3, 110],
    [2, 170], [3, 235], [2, 300], [3, 345], [1, 65], [1, 125], [1, 185], [1, 245],
  ];

  rightSequence.forEach(([plantId, x], index) => dropPlant(plantId, x, 'right-column', index + 1));
  topSequence.forEach(([plantId, x], index) => dropPlant(plantId, x, 'top-jar', rightSequence.length + index + 1));

  // Let the whole pile relax together after the last drop. No attraction or stickiness.
  settle(engine, records.find(record => record.body)?.body);

  records.filter(record => record.body).forEach(record => {
    record.x = record.body.position.x;
    record.y = record.body.position.y;
    delete record.body;
  });

  const counts = Object.fromEntries([1, 2, 3, 4].map(id => [id, records.filter(record => record.plantId === id).length]));
  modules.push(
    { id: 'bloodstone', type: 'thrift', requested: counts[1], placed: counts[1] },
    { id: 'hydrangea', type: 'hydrangea', requested: counts[2], placed: counts[2] },
    { id: 'rose', type: 'rose', requested: counts[3], placed: counts[3] },
  );

  lastRun = {
    recipeId: recipe.id,
    recipeName: recipe.name,
    recipeVersion: `pixel-jar-physics-v${LAB_VERSION}`,
    generatedAt: new Date().toISOString(),
    settings: { seed, canvas: CANVAS, patio: PATIO, dividerX: DIVIDER_X },
    rules: {
      generationMode: 'matter-js-open-top-jar-one-disc-at-a-time',
      engineVersion: window.Matter.version,
      visualDiameterByPlant: VISUAL_DIAMETER,
      physicsDiameterRule: '90% of visual diameter plus random 0–5 px pair-spacing pad',
      maximumVisualOverlap: '10%',
      patio: 'static solid block; plants may rest on its outer edges',
      divider: 'static orange wall separating planting pile from hedge column',
      stickyObjects: ['hedge'],
      nonStickyObjects: ['rose', 'hydrangea', 'thrift'],
      gravity: { x: 0, y: 1 },
      dropOrder: attempts.map(attempt => attempt.id),
    },
    modules,
    anchors,
    attempts,
    plants: records,
    summary: { totalPlants: records.length, dynamicPlants: records.filter(record => !record.fixed).length, counts },
  };

  render(records, seed);
}

function render(records, seed) {
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
  line(PATIO.x, 0, PATIO.x, PATIO.y, '#22d52f', '6');
  line(PATIO.x + PATIO.width, CANVAS.height - 3, DIVIDER_X, CANVAS.height - 3, '#22d52f', '6');

  records.forEach(item => {
    circle(item);
    if (els.centers.checked) {
      const dot = document.createElementNS(svgNS, 'circle');
      Object.entries({ cx: item.x, cy: item.y, r: '3', fill: '#111' }).forEach(([key, value]) => dot.setAttribute(key, value));
      els.svg.append(dot);
    }
    if (els.debugOverlay.checked && !item.fixed) {
      const physics = document.createElementNS(svgNS, 'circle');
      Object.entries({ cx: item.x, cy: item.y, r: item.physicsRadius, fill: 'none', stroke: '#222', 'stroke-width': '1', 'stroke-dasharray': '4 3' }).forEach(([key, value]) => physics.setAttribute(key, value));
      els.svg.append(physics);
    }
  });

  const counts = [1, 2, 3, 4].map(id => ({ plant: recipe.plants.find(plant => plant.id === id), count: records.filter(record => record.plantId === id).length }));
  els.title.textContent = `560 × 472 reference pixels, seed ${seed}`;
  els.seedValue.textContent = seed;
  els.metrics.innerHTML = counts.map(({ plant, count }) => `<div class="metric"><strong>${count}</strong><span>${plant.role.replaceAll('-', ' ')}</span></div>`).join('');
  els.summary.innerHTML = `<strong>${records.length} plants</strong><br><span class="muted">Patio 270 × 270 px · diameters 34 / 62 / 115 / 140 px</span>`;
  els.debugSummary.innerHTML = `<strong>${records.length - 4} discs dropped one at a time</strong><br><span class="muted">90% collision bodies · random 0–5 px spacing · no sticky plants except hedge</span>`;
}

['change', 'input'].forEach(eventName => {
  [els.seed, els.grid, els.centers, els.debugOverlay].forEach(element => element.addEventListener(eventName, generate));
});
document.querySelector('#regenerate').addEventListener('click', generate);
document.querySelector('#next-seed').addEventListener('click', () => {
  els.seed.value = (Number(els.seed.value) % 100) + 1;
  generate();
});
els.downloadDebug.addEventListener('click', () => {
  if (!lastRun) return;
  const blob = new Blob([JSON.stringify(lastRun, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `plant-pending-recipe-debug-seed-${lastRun.settings.seed}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

generate();