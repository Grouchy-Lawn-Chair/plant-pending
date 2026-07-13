const svgNS = 'http://www.w3.org/2000/svg';
const LAB_VERSION = '9.0.0';
const recipe = await fetch('./recipe.json').then(response => response.json());

if (!window.Matter) {
  throw new Error('Matter.js did not load. Check the network connection and refresh.');
}

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

if (els.version) els.version.textContent = `Lab version ${LAB_VERSION} · Matter.js rigid-body packing`;
document.querySelector('#recipe-name').textContent = recipe.name;
document.querySelector('#recipe-description').textContent = recipe.description;
els.legend.innerHTML = recipe.plants.map(plant => `
  <div class="legend-item">
    <span class="swatch" style="background:${plant.color}"></span>
    <div><strong>${plant.name}</strong><span>${plant.role.replaceAll('-', ' ')}</span></div>
  </div>
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

function shapePoint(x, y, size, shape) {
  const scale = size / recipe.rules.referenceGrid;
  let px = x * scale;
  let py = y * scale;
  if (shape === 'narrow') px = size * 0.2 + px * 0.6;
  if (shape === 'wide') py *= 0.72;
  if (shape === 'curved') py += Math.sin((px / size) * Math.PI) * 1.2 * scale;
  if (shape === 'irregular') {
    px += Math.sin(y * 0.7) * 0.35 * scale;
    py += Math.cos(x * 0.45) * 0.25 * scale;
  }
  return { x: px, y: py };
}

function line(x1, y1, x2, y2, stroke, width, dash = '') {
  const element = document.createElementNS(svgNS, 'line');
  Object.entries({ x1, y1, x2, y2, stroke, 'stroke-width': width }).forEach(([key, value]) => element.setAttribute(key, value));
  if (dash) element.setAttribute('stroke-dasharray', dash);
  els.svg.append(element);
}

function addSvgCircle(item, plant) {
  const circle = document.createElementNS(svgNS, 'circle');
  Object.entries({
    cx: item.x,
    cy: item.y,
    r: item.r,
    fill: plant.color,
    'fill-opacity': item.plantId === 4 ? '.72' : '.84',
    stroke: '#fff',
    'stroke-opacity': '.78',
    'stroke-width': '.07',
  }).forEach(([key, value]) => circle.setAttribute(key, value));
  els.svg.append(circle);
}

function generate() {
  const size = Number(els.size.value);
  const shape = els.shape.value;
  const seed = Number(els.seed.value);
  const rand = rng(seed * 7919 + 17);
  const scale = size / recipe.rules.referenceGrid;
  const plantById = id => recipe.plants.find(plant => plant.id === id);

  // Calibrated against the scale bar and canopy diameters in the source plan.
  const radiusByPlant = {
    1: 0.34 * scale, // Bloodstone thrift, about 0.68 ft diameter
    2: 0.66 * scale, // Hydrangea, about 1.32 ft diameter
    3: 1.15 * scale, // Rose, about 2.30 ft diameter
    4: 1.27 * scale, // Arborvitae, about 2.54 ft diameter
  };

  const patioA = shapePoint(recipe.rules.patio.x, recipe.rules.patio.y, size, shape);
  const patioB = shapePoint(recipe.rules.patio.x + recipe.rules.patio.width, recipe.rules.patio.y + recipe.rules.patio.height, size, shape);
  const patio = {
    x: Math.min(patioA.x, patioB.x),
    y: Math.min(patioA.y, patioB.y),
    width: Math.abs(patioB.x - patioA.x),
    height: Math.abs(patioB.y - patioA.y),
  };

  const variants = [
    { roses:[[3.8,4.1],[8.9,5],[13.5,4],[15.5,8.6],[15.6,17.4]], topH:[[3,6.7],[6.7,6.8],[10.4,6.9]], rightH:[[14.1,11.8],[14,15],[14.1,19]], topT:[[2.6,8.45],[6,8.35],[9.5,8.45]], rightT:[[12.55,11.2],[12.55,15.1],[12.55,19.1]] },
    { roses:[[4.5,4.7],[9.5,4.1],[13.3,5.3],[15.7,9.6],[15.3,16.4]], topH:[[3.1,6.9],[6.9,6.5],[10.7,7]], rightH:[[14,11.5],[14.2,14.8],[14,18.5]], topT:[[2.5,8.45],[5.9,8.3],[9.4,8.45]], rightT:[[12.55,11],[12.55,14.9],[12.55,18.8]] },
    { roses:[[3.6,5.1],[8.1,4],[12.8,4.7],[15.8,7.5],[15.7,16]], topH:[[2.9,6.8],[6.5,6.9],[10.2,6.7]], rightH:[[14.1,11.6],[14,15.2],[14.2,18.9]], topT:[[2.4,8.45],[5.8,8.35],[9.2,8.4]], rightT:[[12.55,11.2],[12.55,15.3],[12.55,19]] },
    { roses:[[4.8,3.9],[9.6,5.5],[13.1,3.7],[15.1,8.8],[15.4,17.8]], topH:[[3.2,6.8],[6.8,6.6],[10.5,6.9]], rightH:[[14,11.7],[14.2,15.1],[14,18.8]], topT:[[2.6,8.4],[6.1,8.35],[9.5,8.4]], rightT:[[12.55,11.1],[12.55,15],[12.55,19]] },
  ];
  const variantIndex = (seed - 1) % variants.length;
  const composition = variants[variantIndex];

  const PHYS = 48;
  const toPhys = value => value * PHYS;
  const fromPhys = value => value / PHYS;

  const makeEngine = (gravityX, gravityY) => {
    const engine = Engine.create({
      gravity: { x: gravityX, y: gravityY, scale: 0.0018 },
      positionIterations: 14,
      velocityIterations: 12,
      constraintIterations: 4,
      enableSleeping: true,
    });
    return engine;
  };

  const topEngine = makeEngine(0, 1.35);
  const rightEngine = makeEngine(-1.35, 0);
  const wallOptions = { isStatic: true, friction: 0.35, restitution: 0, slop: 0.01 * PHYS };

  const topBounds = {
    minX: 0.55 * scale,
    maxX: patio.x + patio.width + 0.9 * scale,
    floor: patio.y,
    ceiling: 0.15 * scale,
  };
  const rightBounds = {
    minY: patio.y - 0.25 * scale,
    maxY: patio.y + patio.height + 0.95 * scale,
    floor: patio.x + patio.width,
    wall: shapePoint(17.15, 0, size, shape).x,
  };

  Composite.add(topEngine.world, [
    Bodies.rectangle(toPhys((topBounds.minX + topBounds.maxX) / 2), toPhys(topBounds.floor + 0.12 * scale), toPhys(topBounds.maxX - topBounds.minX + 0.5 * scale), toPhys(0.24 * scale), wallOptions),
    Bodies.rectangle(toPhys(topBounds.minX - 0.12 * scale), toPhys((topBounds.ceiling + topBounds.floor) / 2), toPhys(0.24 * scale), toPhys(topBounds.floor - topBounds.ceiling + 1.0 * scale), wallOptions),
    Bodies.rectangle(toPhys(topBounds.maxX + 0.12 * scale), toPhys((topBounds.ceiling + topBounds.floor) / 2), toPhys(0.24 * scale), toPhys(topBounds.floor - topBounds.ceiling + 1.0 * scale), wallOptions),
  ]);

  Composite.add(rightEngine.world, [
    Bodies.rectangle(toPhys(rightBounds.floor - 0.12 * scale), toPhys((rightBounds.minY + rightBounds.maxY) / 2), toPhys(0.24 * scale), toPhys(rightBounds.maxY - rightBounds.minY + 0.5 * scale), wallOptions),
    Bodies.rectangle(toPhys(rightBounds.wall + 0.12 * scale), toPhys((rightBounds.minY + rightBounds.maxY) / 2), toPhys(0.24 * scale), toPhys(rightBounds.maxY - rightBounds.minY + 0.5 * scale), wallOptions),
    Bodies.rectangle(toPhys((rightBounds.floor + rightBounds.wall) / 2), toPhys(rightBounds.minY - 0.12 * scale), toPhys(rightBounds.wall - rightBounds.floor + 0.5 * scale), toPhys(0.24 * scale), wallOptions),
    Bodies.rectangle(toPhys((rightBounds.floor + rightBounds.wall) / 2), toPhys(rightBounds.maxY + 0.12 * scale), toPhys(rightBounds.wall - rightBounds.floor + 0.5 * scale), toPhys(0.24 * scale), wallOptions),
  ]);

  const dynamicRecords = [];
  const attempts = [];
  const modules = [];
  const anchors = [];
  const plants = [];

  const bodyOptions = plantId => ({
    restitution: 0.015,
    friction: plantId === 1 ? 0.32 : 0.42,
    frictionStatic: plantId === 1 ? 0.55 : 0.7,
    frictionAir: 0.022,
    slop: 0.01 * PHYS,
    density: 0.0018,
    sleepThreshold: 35,
  });

  function settleEngine(engine, focusBody) {
    Sleeping.set(focusBody, false);
    let quietFrames = 0;
    let steps = 0;
    for (; steps < 1800; steps += 1) {
      Engine.update(engine, 1000 / 120);
      const bodies = Composite.allBodies(engine.world).filter(body => !body.isStatic);
      const quiet = bodies.every(body => body.speed < 0.035 && body.angularSpeed < 0.035);
      quietFrames = quiet ? quietFrames + 1 : 0;
      if (quietFrames > 90) break;
    }
    return steps;
  }

  function dropOne({ engine, axis, plantId, type, group, anchorX, anchorY }) {
    const baseRadius = radiusByPlant[plantId];
    const radius = baseRadius * (0.988 + rand() * 0.024);
    let x;
    let y;
    if (axis === 'top') {
      x = Math.max(topBounds.minX + radius, Math.min(topBounds.maxX - radius, shapePoint(anchorX, anchorY, size, shape).x + (rand() - 0.5) * 1.35 * scale));
      y = topBounds.ceiling - radius - (0.25 + rand() * 0.8) * scale;
    } else {
      x = rightBounds.wall - radius - 0.1 * scale;
      y = Math.max(rightBounds.minY + radius, Math.min(rightBounds.maxY - radius, shapePoint(anchorX, anchorY, size, shape).y + (rand() - 0.5) * 1.35 * scale));
    }

    const body = Bodies.circle(toPhys(x), toPhys(y), toPhys(radius), bodyOptions(plantId));
    Body.setVelocity(body, axis === 'top'
      ? { x: (rand() - 0.5) * 0.35, y: 0 }
      : { x: 0, y: (rand() - 0.5) * 0.35 });
    Composite.add(engine.world, body);
    const steps = settleEngine(engine, body);

    const record = {
      body,
      plantId,
      type,
      group,
      axis,
      r: radius,
      x: fromPhys(body.position.x),
      y: fromPhys(body.position.y),
    };
    dynamicRecords.push(record);
    attempts.push({
      group,
      plantId,
      type,
      axis,
      mode: 'matter-js-rigid-body-drop',
      x: record.x,
      y: record.y,
      radius,
      steps,
      speed: body.speed,
      sleeping: body.isSleeping,
      ok: true,
    });
    return record;
  }

  function dropSequence(axis, type, plantId, anchorsForType, totalCount) {
    const engine = axis === 'top' ? topEngine : rightEngine;
    const before = dynamicRecords.length;
    for (let index = 0; index < totalCount; index += 1) {
      const anchor = anchorsForType[index % anchorsForType.length];
      const group = `${type}-${axis}-${(index % anchorsForType.length) + 1}`;
      dropOne({ engine, axis, plantId, type, group, anchorX: anchor[0], anchorY: anchor[1] });
    }
    modules.push({ id: `${type}-${axis}`, type, axis, requested: totalCount, placed: dynamicRecords.length - before });
    anchorsForType.forEach(([x, y], index) => anchors.push({ id: `${type}-${axis}-${index + 1}`, type, axis, x, y }));
  }

  // Foreground first, then middle layer, then large flowering masses.
  dropSequence('top', 'thrift', 1, composition.topT, 18);
  dropSequence('top', 'hydrangea', 2, composition.topH, 10);
  dropSequence('top', 'rose', 3, composition.roses.slice(0, 3), 3);

  dropSequence('right', 'thrift', 1, composition.rightT, 18);
  dropSequence('right', 'hydrangea', 2, composition.rightH, 10);
  dropSequence('right', 'rose', 3, composition.roses.slice(3), 2);

  // Freeze only after every marble has had a chance to rearrange the pile.
  for (const record of dynamicRecords) {
    Body.setStatic(record.body, true);
    record.x = fromPhys(record.body.position.x);
    record.y = fromPhys(record.body.position.y);
    plants.push({
      id: `${record.group}-${plants.length + 1}`,
      plantId: record.plantId,
      x: record.x,
      y: record.y,
      r: record.r,
      group: record.group,
      axis: record.axis,
      fixed: false,
    });
  }

  const hedgeShift = (rand() - 0.5) * 0.16 * scale;
  for (let index = 0; index < 5; index += 1) {
    const point = shapePoint(18.8, 3.0 + index * 4.0, size, shape);
    const radius = radiusByPlant[4] * (0.992 + rand() * 0.016);
    plants.push({ id: `hedge-${index + 1}`, plantId: 4, x: point.x, y: point.y + hedgeShift, r: radius, group: 'hedge', fixed: true });
    anchors.push({ id: `hedge-${index + 1}`, type: 'hedge', axis: 'right', x: 18.8, y: 3.0 + index * 4.0, sticky: true });
  }
  modules.unshift({ id: 'hedge', type: 'hedge', axis: 'right', requested: 5, placed: 5 });

  lastRun = {
    recipeId: recipe.id,
    recipeName: recipe.name,
    recipeVersion: `matter-js-rigid-body-v${LAB_VERSION}`,
    generatedAt: new Date().toISOString(),
    settings: { size, shape, seed, scale, compositionVariant: variantIndex + 1 },
    rules: {
      generationMode: 'matter-js-rigid-body-one-at-a-time',
      engineVersion: window.Matter.version,
      calibratedRadiusByPlant: radiusByPlant,
      radiusSource: 'source-plan-scale-bar-and-canopy-diameters',
      dropOrder: ['thrift', 'hydrangea', 'rose'],
      stickyObjects: ['hedge'],
      dynamicObjectsRemainLiveUntilAllDropsComplete: true,
      gravity: { top: { x: 0, y: 1.35 }, right: { x: -1.35, y: 0 } },
      restitution: 0.015,
    },
    bounds: { top: topBounds, right: rightBounds },
    modules,
    anchors,
    attempts,
    plants,
    summary: { settled: dynamicRecords.length, totalPlants: plants.length },
  };

  render(plants, size, shape, seed, patio, anchors, modules, variantIndex + 1, radiusByPlant);
}

function render(plants, size, shape, seed, patio, anchors, modules, variant, radiusByPlant) {
  els.svg.innerHTML = '';
  els.svg.setAttribute('viewBox', `0 0 ${size} ${size}`);

  if (els.grid.checked) {
    for (let x = 0; x <= size; x += 1) line(x, 0, x, size, '#cfd4c7', '.035');
    for (let y = 0; y <= size; y += 1) line(0, y, size, y, '#cfd4c7', '.035');
  }

  const patioRect = document.createElementNS(svgNS, 'rect');
  Object.entries({ x: patio.x, y: patio.y, width: patio.width, height: patio.height, fill: '#f2eee6', stroke: '#8f8a80', 'stroke-width': '.09' }).forEach(([key, value]) => patioRect.setAttribute(key, value));
  els.svg.append(patioRect);

  const fenceTop = shapePoint(recipe.rules.fenceX ?? 21, 1.4, size, shape);
  const fenceBottom = shapePoint(recipe.rules.fenceX ?? 21, 22.3, size, shape);
  line(fenceTop.x, fenceTop.y, fenceBottom.x, fenceBottom.y, '#27322a', '.22', '.5 .28');

  for (const item of plants) {
    addSvgCircle(item, recipe.plants.find(plant => plant.id === item.plantId));
    if (els.centers.checked) {
      const dot = document.createElementNS(svgNS, 'circle');
      Object.entries({ cx: item.x, cy: item.y, r: '.07', fill: '#111' }).forEach(([key, value]) => dot.setAttribute(key, value));
      els.svg.append(dot);
    }
  }

  if (els.debugOverlay.checked) {
    for (const anchor of anchors) {
      const point = shapePoint(anchor.x, anchor.y, size, shape);
      const dot = document.createElementNS(svgNS, 'circle');
      Object.entries({ cx: point.x, cy: point.y, r: '.12', fill: anchor.sticky ? '#246' : '#111', stroke: '#fff', 'stroke-width': '.04' }).forEach(([key, value]) => dot.setAttribute(key, value));
      els.svg.append(dot);
    }
  }

  const counts = recipe.plants.map(plant => ({ plant, count: plants.filter(item => item.plantId === plant.id).length }));
  els.title.textContent = `${size} × ${size}, ${shape}, seed ${seed}, composition ${variant}`;
  els.seedValue.textContent = seed;
  els.metrics.innerHTML = counts.map(({ plant, count }) => `<div class="metric"><strong>${count}</strong><span>${plant.role.replaceAll('-', ' ')}</span></div>`).join('');
  els.summary.innerHTML = `<strong>${plants.length} plant centers</strong><br><span class="muted">Matter.js rigid-body packing · calibrated radii ${Object.values(radiusByPlant).map(value => value.toFixed(2)).join(' / ')}</span>`;
  els.debugSummary.innerHTML = `<strong>${plants.length - 5} dynamic discs settled</strong><br><span class="muted">One disc at a time · all earlier discs remain movable until the final drop</span>`;
}

['change', 'input'].forEach(eventName => {
  [els.size, els.shape, els.seed, els.grid, els.centers, els.debugOverlay].forEach(element => element.addEventListener(eventName, generate));
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
