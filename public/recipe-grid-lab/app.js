const svgNS = 'http://www.w3.org/2000/svg';
const LAB_VERSION = '8.0.0';
const recipe = await fetch('./recipe.json').then(r => r.json());

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

if (els.version) els.version.textContent = `Lab version ${LAB_VERSION} · sequential marble packing`;
let lastRun = null;

document.querySelector('#recipe-name').textContent = recipe.name;
document.querySelector('#recipe-description').textContent = recipe.description;
els.legend.innerHTML = recipe.plants.map(plant => `
  <div class="legend-item"><span class="swatch" style="background:${plant.color}"></span>
  <div><strong>${plant.name}</strong><span>${plant.role.replaceAll('-', ' ')}</span></div></div>
`).join('');

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

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

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

function generate() {
  const size = Number(els.size.value);
  const shape = els.shape.value;
  const seed = Number(els.seed.value);
  const rand = rng(seed * 7919 + 17);
  const scale = size / recipe.rules.referenceGrid;
  const plantById = id => recipe.plants.find(p => p.id === id);
  const plants = [];
  const anchors = [];
  const modules = [];
  const attempts = [];

  // Use the recipe's actual mature-size circles. The previous version shrank
  // everything and changed the proportions seen in the source plan.
  const radiusFor = (plantId, itemScale) => plantById(plantId).radius * itemScale;

  const patioA = shapePoint(recipe.rules.patio.x, recipe.rules.patio.y, size, shape);
  const patioB = shapePoint(recipe.rules.patio.x + recipe.rules.patio.width, recipe.rules.patio.y + recipe.rules.patio.height, size, shape);
  const patio = {
    x: Math.min(patioA.x, patioB.x), y: Math.min(patioA.y, patioB.y),
    width: Math.abs(patioB.x - patioA.x), height: Math.abs(patioB.y - patioA.y),
  };

  const variants = [
    { roses:[[3.8,4.1],[8.9,5],[13.5,4],[15.5,8.6],[15.6,17.4]], topH:[[3,6.7],[6.7,6.8],[10.4,6.9]], rightH:[[14.1,11.8],[14,15],[14.1,19]], topT:[[2.6,8.45],[6,8.35],[9.5,8.45]], rightT:[[12.55,11.2],[12.55,15.1],[12.55,19.1]] },
    { roses:[[4.5,4.7],[9.5,4.1],[13.3,5.3],[15.7,9.6],[15.3,16.4]], topH:[[3.1,6.9],[6.9,6.5],[10.7,7]], rightH:[[14,11.5],[14.2,14.8],[14,18.5]], topT:[[2.5,8.45],[5.9,8.3],[9.4,8.45]], rightT:[[12.55,11],[12.55,14.9],[12.55,18.8]] },
    { roses:[[3.6,5.1],[8.1,4],[12.8,4.7],[15.8,7.5],[15.7,16]], topH:[[2.9,6.8],[6.5,6.9],[10.2,6.7]], rightH:[[14.1,11.6],[14,15.2],[14.2,18.9]], topT:[[2.4,8.45],[5.8,8.35],[9.2,8.4]], rightT:[[12.55,11.2],[12.55,15.3],[12.55,19]] },
    { roses:[[4.8,3.9],[9.6,5.5],[13.1,3.7],[15.1,8.8],[15.4,17.8]], topH:[[3.2,6.8],[6.8,6.6],[10.5,6.9]], rightH:[[14,11.7],[14.2,15.1],[14,18.8]], topT:[[2.6,8.4],[6.1,8.35],[9.5,8.4]], rightT:[[12.55,11.1],[12.55,15],[12.55,19]] },
  ];
  const variantIndex = (seed - 1) % variants.length;
  const composition = variants[variantIndex];

  function addHedge(plantId, x, y, id) {
    const p = shapePoint(x, y, size, shape);
    const itemScale = scale * (1 + (rand() - 0.5) * 0.015);
    const r = radiusFor(plantId, itemScale);
    plants.push({ id, plantId, x: p.x, y: p.y, r, scale: itemScale, group: 'hedge', fixed: true });
    anchors.push({ id, type: 'hedge', axis: 'right', x, y, sticky: true });
    modules.push({ id, type: 'hedge', axis: 'right', requested: 1, placed: 1 });
  }

  const topContainer = {
    axis: 'top',
    minX: 0.65 * scale,
    maxX: patio.x + patio.width + 0.65 * scale,
    floor: patio.y,
    spawn: 0.35 * scale,
  };
  const rightContainer = {
    axis: 'right',
    minY: patio.y - 0.25 * scale,
    maxY: Math.min(size - 0.65 * scale, patio.y + patio.height + 0.65 * scale),
    floor: patio.x + patio.width,
    spawn: Math.min(size - 0.35 * scale, (recipe.rules.fenceX ?? 21) * scale - 0.35 * scale),
  };

  function collidersFor(axis) {
    return plants.filter(p => p.fixed || p.axis === axis);
  }

  function resolveCollision(body, other) {
    let dx = body.x - other.x;
    let dy = body.y - other.y;
    let d = Math.hypot(dx, dy);
    const minD = body.r + other.r;
    if (d >= minD) return false;
    if (d < 0.00001) {
      dx = (rand() - 0.5) || 0.001;
      dy = (rand() - 0.5) || 0.001;
      d = Math.hypot(dx, dy);
    }
    const nx = dx / d;
    const ny = dy / d;
    const overlap = minD - d;
    body.x += nx * overlap;
    body.y += ny * overlap;
    const vn = body.vx * nx + body.vy * ny;
    if (vn < 0) {
      body.vx -= vn * nx;
      body.vy -= vn * ny;
    }
    body.vx *= 0.94;
    body.vy *= 0.94;
    return true;
  }

  function supported(body, container, colliders) {
    const epsilon = 0.025 * scale;
    if (container.axis === 'top' && Math.abs(body.y + body.r - container.floor) <= epsilon) return true;
    if (container.axis === 'right' && Math.abs(body.x - body.r - container.floor) <= epsilon) return true;
    for (const other of colliders) {
      const touching = distance(body, other) <= body.r + other.r + epsilon;
      if (!touching) continue;
      if (container.axis === 'top' && other.y > body.y + epsilon) return true;
      if (container.axis === 'right' && other.x < body.x - epsilon) return true;
    }
    return false;
  }

  function settleOne(body, container, colliders) {
    const gravity = 0.010 * scale;
    const damping = 0.992;
    let quietFrames = 0;

    for (let step = 0; step < 2600; step += 1) {
      if (container.axis === 'top') body.vy += gravity;
      else body.vx -= gravity;

      body.vx *= damping;
      body.vy *= damping;
      body.x += body.vx;
      body.y += body.vy;

      if (container.axis === 'top') {
        if (body.x - body.r < container.minX) { body.x = container.minX + body.r; body.vx = Math.abs(body.vx) * 0.25; }
        if (body.x + body.r > container.maxX) { body.x = container.maxX - body.r; body.vx = -Math.abs(body.vx) * 0.25; }
        if (body.y + body.r > container.floor) { body.y = container.floor - body.r; body.vy = 0; }
      } else {
        if (body.y - body.r < container.minY) { body.y = container.minY + body.r; body.vy = Math.abs(body.vy) * 0.25; }
        if (body.y + body.r > container.maxY) { body.y = container.maxY - body.r; body.vy = -Math.abs(body.vy) * 0.25; }
        if (body.x - body.r < container.floor) { body.x = container.floor + body.r; body.vx = 0; }
      }

      let hit = false;
      for (let pass = 0; pass < 4; pass += 1) {
        let passHit = false;
        for (const other of colliders) passHit = resolveCollision(body, other) || passHit;
        hit = hit || passHit;
        if (!passHit) break;
      }

      // Tiny sideways nudge prevents a perfectly centered disc from balancing
      // forever on top of one marble. It is not attraction or stickiness.
      if (hit) {
        if (container.axis === 'top') body.vx += body.bias * 0.0012 * scale;
        else body.vy += body.bias * 0.0012 * scale;
      }

      const speed = Math.hypot(body.vx, body.vy);
      const isSupported = supported(body, container, colliders);
      quietFrames = isSupported && speed < 0.0015 * scale ? quietFrames + 1 : 0;
      if (quietFrames > 55) return { ok: true, steps: step + 1 };
    }
    return { ok: supported(body, container, colliders), steps: 2600 };
  }

  function dropDisc(plantId, axis, target, group, type) {
    const container = axis === 'top' ? topContainer : rightContainer;
    const itemScale = scale * (1 + (rand() - 0.5) * 0.018);
    const r = radiusFor(plantId, itemScale);
    const targetPoint = shapePoint(target[0], target[1], size, shape);
    const maxRetries = 10;

    for (let retry = 0; retry < maxRetries; retry += 1) {
      const spread = (0.35 + retry * 0.12) * scale;
      const body = axis === 'top'
        ? {
            x: clamp(targetPoint.x + (rand() - 0.5) * spread, container.minX + r, container.maxX - r),
            y: container.spawn - r - retry * 0.03 * scale,
            vx: (rand() - 0.5) * 0.018 * scale,
            vy: 0,
          }
        : {
            x: container.spawn + r + retry * 0.03 * scale,
            y: clamp(targetPoint.y + (rand() - 0.5) * spread, container.minY + r, container.maxY - r),
            vx: 0,
            vy: (rand() - 0.5) * 0.018 * scale,
          };
      body.r = r;
      body.bias = rand() < 0.5 ? -1 : 1;

      const colliders = collidersFor(axis);
      const result = settleOne(body, container, colliders);
      const overlap = colliders.some(other => distance(body, other) < body.r + other.r - 0.005 * scale);
      const inBounds = body.x - r >= 0 && body.x + r <= size && body.y - r >= 0 && body.y + r <= size;
      const ok = result.ok && !overlap && inBounds;
      attempts.push({ group, plantId, type, axis, mode: 'sequential-marble-drop', retry, x: body.x, y: body.y, radius: r, steps: result.steps, supported: result.ok, ok, reason: ok ? null : overlap ? 'overlap' : result.ok ? 'boundary' : 'unsupported' });
      if (!ok) continue;

      plants.push({ id: `${group}-${plants.length + 1}`, plantId, x: body.x, y: body.y, r, scale: itemScale, group, axis, fixed: false });
      return true;
    }
    return false;
  }

  function dropSeries(type, plantId, axis, targets, count, groupPrefix) {
    let placed = 0;
    for (let i = 0; i < count; i += 1) {
      const target = targets[i % targets.length];
      if (dropDisc(plantId, axis, target, `${groupPrefix}-${(i % targets.length) + 1}`, type)) placed += 1;
    }
    modules.push({ id: groupPrefix, type, axis, requested: count, placed });
    targets.forEach(([x, y], i) => anchors.push({ id: `${groupPrefix}-${i + 1}`, type, axis, x, y, sticky: false }));
  }

  const hedgeShift = (rand() - 0.5) * 0.16;
  for (let i = 0; i < 5; i += 1) addHedge(4, 18.8, 3.0 + hedgeShift + i * 4.0, `hedge-${i + 1}`);

  // Drop one disc at a time into shared edge containers. Front layer first,
  // then middle layer, then roses. Nothing except the hedge is anchored.
  dropSeries('thrift', 1, 'top', composition.topT, 16, 'thrift-top');
  dropSeries('hydrangea', 2, 'top', composition.topH, 9, 'hydrangea-top');
  dropSeries('rose', 3, 'top', composition.roses.slice(0, 3), 3, 'rose-top');

  dropSeries('thrift', 1, 'right', composition.rightT, 16, 'thrift-right');
  dropSeries('hydrangea', 2, 'right', composition.rightH, 9, 'hydrangea-right');
  dropSeries('rose', 3, 'right', composition.roses.slice(3), 2, 'rose-right');

  const accepted = attempts.filter(a => a.ok).length;
  const rejected = attempts.length - accepted;
  const unsupported = attempts.filter(a => !a.ok && a.reason === 'unsupported').length;
  lastRun = {
    recipeId: recipe.id,
    recipeName: recipe.name,
    recipeVersion: `sequential-marble-packing-v${LAB_VERSION}`,
    generatedAt: new Date().toISOString(),
    settings: { size, shape, seed, scale, compositionVariant: variantIndex + 1 },
    rules: {
      generationMode: 'one-disc-at-a-time-gravity',
      physicalDiscsUseRecipeRadius: true,
      stickyObjects: ['hedge'],
      nonStickyObjects: ['rose', 'hydrangea', 'thrift'],
      topDropOrder: ['thrift', 'hydrangea', 'rose'],
      rightDropOrder: ['thrift', 'hydrangea', 'rose'],
      gravityStepsPerAttempt: 2600,
      supportRequired: true,
    },
    containers: { top: topContainer, right: rightContainer },
    modules, anchors, attempts, plants,
    summary: { accepted, rejected, unsupported, totalPlants: plants.length },
  };

  render(plants, size, shape, seed, patio, anchors, attempts, modules, variantIndex + 1);
}

function line(x1, y1, x2, y2, stroke, width, dash = '') {
  const e = document.createElementNS(svgNS, 'line');
  Object.entries({ x1, x2, y1, y2, stroke, 'stroke-width': width }).forEach(([k, v]) => e.setAttribute(k, v));
  if (dash) e.setAttribute('stroke-dasharray', dash);
  els.svg.append(e);
}

function render(plants, size, shape, seed, patio, anchors, attempts, modules, variant) {
  els.svg.innerHTML = '';
  els.svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  if (els.grid.checked) {
    for (let x = 0; x <= size; x += 1) line(x, 0, x, size, '#cfd4c7', '.035');
    for (let y = 0; y <= size; y += 1) line(0, y, size, y, '#cfd4c7', '.035');
  }

  const rect = document.createElementNS(svgNS, 'rect');
  Object.entries({ x: patio.x, y: patio.y, width: patio.width, height: patio.height, fill: '#f2eee6', stroke: '#8f8a80', 'stroke-width': '.09' }).forEach(([k, v]) => rect.setAttribute(k, v));
  els.svg.append(rect);

  const fenceTop = shapePoint(recipe.rules.fenceX ?? 21, 1.4, size, shape);
  const fenceBottom = shapePoint(recipe.rules.fenceX ?? 21, 22.3, size, shape);
  line(fenceTop.x, fenceTop.y, fenceBottom.x, fenceBottom.y, '#27322a', '.22', '.5 .28');

  for (const item of plants) {
    const plant = recipe.plants.find(p => p.id === item.plantId);
    const c = document.createElementNS(svgNS, 'circle');
    Object.entries({ cx: item.x, cy: item.y, r: item.r, fill: plant.color, 'fill-opacity': item.plantId === 4 ? '.72' : '.84', stroke: '#fff', 'stroke-opacity': '.72', 'stroke-width': '.07' }).forEach(([k, v]) => c.setAttribute(k, v));
    els.svg.append(c);
    if (els.centers.checked) {
      const dot = document.createElementNS(svgNS, 'circle');
      Object.entries({ cx: item.x, cy: item.y, r: '.07', fill: '#111' }).forEach(([k, v]) => dot.setAttribute(k, v));
      els.svg.append(dot);
    }
  }

  if (els.debugOverlay.checked) {
    for (const a of anchors) {
      const p = shapePoint(a.x, a.y, size, shape);
      const dot = document.createElementNS(svgNS, 'circle');
      Object.entries({ cx: p.x, cy: p.y, r: '.12', fill: a.sticky ? '#126e37' : '#111', stroke: '#fff', 'stroke-width': '.04' }).forEach(([k, v]) => dot.setAttribute(k, v));
      els.svg.append(dot);
    }
  }

  const counts = recipe.plants.map(plant => ({ plant, count: plants.filter(p => p.plantId === plant.id).length }));
  const accepted = attempts.filter(a => a.ok).length;
  const rejected = attempts.length - accepted;
  const unsupported = attempts.filter(a => !a.ok && a.reason === 'unsupported').length;
  els.title.textContent = `${size} × ${size}, ${shape}, seed ${seed}, composition ${variant}`;
  els.seedValue.textContent = seed;
  els.metrics.innerHTML = counts.map(({ plant, count }) => `<div class="metric"><strong>${count}</strong><span>${plant.role.replaceAll('-', ' ')}</span></div>`).join('');
  els.summary.innerHTML = `<strong>${plants.length} plant centers</strong><br><span class="muted">Sequential marble packing v${LAB_VERSION} · actual recipe scale · hedge only is sticky</span>`;
  els.debugSummary.innerHTML = `<strong>${accepted} settled · ${rejected} retries rejected</strong><br><span class="muted">${unsupported} unsupported results · every accepted disc has floor or disc support</span>`;
}

['change', 'input'].forEach(eventName => {
  [els.size, els.shape, els.seed, els.grid, els.centers, els.debugOverlay].forEach(el => el.addEventListener(eventName, generate));
});
document.querySelector('#regenerate').addEventListener('click', generate);
document.querySelector('#next-seed').addEventListener('click', () => { els.seed.value = (Number(els.seed.value) % 100) + 1; generate(); });
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