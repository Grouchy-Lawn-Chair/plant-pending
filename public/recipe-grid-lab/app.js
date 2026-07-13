const svgNS = 'http://www.w3.org/2000/svg';
const recipe = await fetch('./recipe.json').then(response => response.json());

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
  grid: document.querySelector('#show-grid'),
  centers: document.querySelector('#show-centers'),
  debugOverlay: document.querySelector('#show-debug-overlay'),
  downloadDebug: document.querySelector('#download-debug'),
  debugSummary: document.querySelector('#debug-summary'),
};

let latestRun = null;

document.querySelector('#recipe-name').textContent = recipe.name;
document.querySelector('#recipe-description').textContent = recipe.description;
els.legend.innerHTML = recipe.plants.map(plant => `
  <div class="legend-item">
    <span class="swatch" style="background:${plant.color}"></span>
    <div><strong>${plant.name}</strong><span>${plant.role.replaceAll('-', ' ')}</span></div>
  </div>
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

function shapePoint(x, y, size, shape) {
  const scale = size / recipe.rules.referenceGrid;
  let transformedX = x * scale;
  let transformedY = y * scale;
  if (shape === 'narrow') transformedX = size * 0.2 + transformedX * 0.6;
  if (shape === 'wide') transformedY *= 0.72;
  if (shape === 'curved') transformedY += Math.sin((transformedX / size) * Math.PI) * 1.2 * scale;
  if (shape === 'irregular') {
    transformedX += Math.sin(y * 0.7) * 0.35 * scale;
    transformedY += Math.cos(x * 0.45) * 0.25 * scale;
  }
  return { x: transformedX, y: transformedY };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function circleIntersectsRect(x, y, radius, rect) {
  const nearestX = Math.max(rect.x, Math.min(x, rect.x + rect.width));
  const nearestY = Math.max(rect.y, Math.min(y, rect.y + rect.height));
  return Math.hypot(x - nearestX, y - nearestY) < radius;
}

function downloadJson(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function generate() {
  const size = Number(els.size.value);
  const shape = els.shape.value;
  const seed = Number(els.seed.value);
  const rand = rng(seed * 7919 + 17);
  const scale = size / recipe.rules.referenceGrid;
  const plants = [];
  const rules = recipe.rules;
  const plantById = id => recipe.plants.find(plant => plant.id === id);

  const debug = {
    recipeId: recipe.id,
    recipeName: recipe.name,
    recipeVersion: 'phase-1-layout-rules-v3',
    generatedAt: new Date().toISOString(),
    settings: { size, shape, seed, scale },
    rules: {
      hydrangeaMaxOverlapFraction: 0.10,
      hydrangeaClumpSize: [2, 4],
      thriftClumpSize: [3, 6],
      thriftRows: [1, 3],
    },
    anchors: [],
    attempts: [],
    accepted: [],
    rejected: [],
    summary: {},
  };

  const patioStart = shapePoint(rules.patio.x, rules.patio.y, size, shape);
  const patioEnd = shapePoint(rules.patio.x + rules.patio.width, rules.patio.y + rules.patio.height, size, shape);
  const patioRect = {
    x: Math.min(patioStart.x, patioEnd.x),
    y: Math.min(patioStart.y, patioEnd.y),
    width: Math.abs(patioEnd.x - patioStart.x),
    height: Math.abs(patioEnd.y - patioStart.y),
  };

  function evaluatePlacement(plantId, point, itemScale, options = {}) {
    const radius = plantById(plantId).radius * itemScale;
    const edgePadding = 0.08 * scale;
    if (point.x - radius < edgePadding || point.x + radius > size - edgePadding || point.y - radius < edgePadding || point.y + radius > size - edgePadding) {
      return { ok: false, reason: 'outside-canvas', radius };
    }
    if (!options.allowPatioOverlap && circleIntersectsRect(point.x, point.y, radius + 0.04 * scale, patioRect)) {
      return { ok: false, reason: 'patio-collision', radius };
    }

    for (const existing of plants) {
      const existingRadius = plantById(existing.plantId).radius * existing.scale;
      const sumRadii = radius + existingRadius;
      const actualDistance = distance(point, existing);
      const sameHydrangeaClump = plantId === 2 && existing.plantId === 2 && existing.group === options.group;
      const sameThriftClump = plantId === 1 && existing.plantId === 1 && existing.group === options.group;

      let minimumDistance = sumRadii + (options.clearance ?? 0.04) * scale;
      if (sameHydrangeaClump) minimumDistance = sumRadii * 0.90;
      if (sameThriftClump) minimumDistance = sumRadii * 0.74;

      if (actualDistance < minimumDistance) {
        return {
          ok: false,
          reason: sameHydrangeaClump ? 'hydrangea-overlap-too-large' : sameThriftClump ? 'thrift-overlap-too-large' : 'plant-collision',
          radius,
          conflictWith: existing.id,
          actualDistance,
          minimumDistance,
          overlapFraction: Math.max(0, (sumRadii - actualDistance) / sumRadii),
        };
      }
    }
    return { ok: true, radius };
  }

  function addPlant(plantId, baseX, baseY, group, options = {}) {
    const itemScale = scale * (options.scaleMultiplier ?? 1) * (1 + (rand() - 0.5) * (options.scaleJitter ?? 0.05));
    const basePoint = shapePoint(baseX, baseY, size, shape);
    const jitter = (options.jitter ?? 0.12) * scale;
    const attempts = options.attempts ?? 12;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const spread = attempt === 0 ? 1 : 1 + attempt * 0.14;
      const point = {
        x: basePoint.x + (rand() - 0.5) * jitter * spread,
        y: basePoint.y + (rand() - 0.5) * jitter * spread,
      };
      const result = evaluatePlacement(plantId, point, itemScale, { ...options, group });
      const record = { plantId, plantName: plantById(plantId).name, group, attempt, baseX, baseY, x: point.x, y: point.y, scale: itemScale, ...result };
      debug.attempts.push(record);
      if (result.ok) {
        const item = { id: `${group}-${plants.length + 1}`, plantId, x: point.x, y: point.y, group, scale: itemScale };
        plants.push(item);
        debug.accepted.push({ ...record, id: item.id });
        return item;
      }
      debug.rejected.push(record);
    }
    return null;
  }

  const hedgeShift = (rand() - 0.5) * 0.55;
  const hedgeStep = 3.85 + rand() * 0.35;
  for (let index = 0; index < 5; index += 1) {
    const anchor = { type: 'hedge', id: `hedge-${index + 1}`, x: 18.8, y: 3.05 + hedgeShift + index * hedgeStep };
    debug.anchors.push(anchor);
    addPlant(4, anchor.x, anchor.y, 'privacy-hedge', { jitter: 0.07, scaleJitter: 0.03, clearance: 0.12 });
  }

  const roseSlotSets = [
    [[3.7, 4.1], [8.9, 5.0], [13.8, 4.1], [15.6, 8.1], [16.0, 17.2]],
    [[4.7, 4.9], [9.7, 3.9], [13.1, 5.6], [15.9, 10.1], [15.1, 16.1]],
    [[3.4, 5.5], [8.0, 3.8], [12.9, 4.6], [16.0, 7.0], [16.3, 15.6]],
    [[5.0, 3.8], [9.7, 5.7], [13.2, 3.6], [15.0, 8.8], [16.2, 18.4]],
  ];
  const roseSlots = roseSlotSets[(seed - 1) % roseSlotSets.length];
  roseSlots.forEach(([x, y], index) => {
    const anchor = { type: 'rose', id: `rose-${index + 1}`, x: x + (rand() - 0.5) * 0.45, y: y + (rand() - 0.5) * 0.45 };
    debug.anchors.push(anchor);
    addPlant(3, anchor.x, anchor.y, 'rose-mass', { jitter: 0.18, scaleJitter: 0.06, clearance: 0.18, attempts: 20 });
  });

  const hydrangeaBands = [
    { axis: 'top', start: 2.5, end: 11.1, fixed: 6.6 },
    { axis: 'right', start: 10.6, end: 20.0, fixed: 14.2 },
  ];
  let hydrangeaClumpIndex = 0;
  for (const band of hydrangeaBands) {
    const clumpCount = 3;
    const span = band.end - band.start;
    for (let index = 0; index < clumpCount; index += 1) {
      hydrangeaClumpIndex += 1;
      const t = (index + 0.5) / clumpCount;
      const group = `hydrangea-clump-${hydrangeaClumpIndex}`;
      const anchor = band.axis === 'top'
        ? { type: 'hydrangea', id: group, axis: band.axis, x: band.start + span * t + (rand() - 0.5) * 0.8, y: band.fixed + (rand() - 0.5) * 0.35 }
        : { type: 'hydrangea', id: group, axis: band.axis, x: band.fixed + (rand() - 0.5) * 0.35, y: band.start + span * t + (rand() - 0.5) * 0.8 };
      debug.anchors.push(anchor);

      const count = 2 + Math.floor(rand() * 3);
      const baseAngle = rand() * Math.PI * 2;
      for (let plantIndex = 0; plantIndex < count; plantIndex += 1) {
        const angle = baseAngle + (plantIndex / count) * Math.PI * 2 + (rand() - 0.5) * 0.32;
        const ring = plantIndex === 0 ? 0 : 1.58 + rand() * 0.24;
        const x = anchor.x + Math.cos(angle) * ring * (band.axis === 'top' ? 1.05 : 0.88);
        const y = anchor.y + Math.sin(angle) * ring * (band.axis === 'right' ? 1.05 : 0.88);
        addPlant(2, x, y, group, { jitter: 0.10, scaleJitter: 0.04, clearance: 0.10, attempts: 22 });
      }
    }
  }

  function createThriftClumps(axis) {
    const isTop = axis === 'top';
    const clumpCount = 7;
    const start = isTop ? 1.8 : 9.9;
    const end = isTop ? 11.0 : 21.0;
    const span = end - start;
    for (let index = 0; index < clumpCount; index += 1) {
      const group = `thrift-${axis}-${index + 1}`;
      const t = (index + 0.5) / clumpCount;
      const anchor = isTop
        ? { type: 'thrift', id: group, axis, x: start + span * t + (rand() - 0.5) * 0.45, y: 8.38 + (rand() - 0.5) * 0.18 }
        : { type: 'thrift', id: group, axis, x: 12.55 + (rand() - 0.5) * 0.18, y: start + span * t + (rand() - 0.5) * 0.45 };
      debug.anchors.push(anchor);

      const count = 3 + Math.floor(rand() * 4);
      const depth = 1 + Math.floor(rand() * 3);
      for (let plantIndex = 0; plantIndex < count; plantIndex += 1) {
        const row = plantIndex % depth;
        const along = (plantIndex - (count - 1) / 2) * 0.72 + (rand() - 0.5) * 0.18;
        const inward = row * 0.68 + (rand() - 0.5) * 0.10;
        const x = isTop ? anchor.x + along : anchor.x + inward;
        const y = isTop ? anchor.y - inward : anchor.y + along;
        addPlant(1, x, y, group, { jitter: 0.08, scaleJitter: 0.05, clearance: 0.02, attempts: 18 });
      }
    }
  }

  createThriftClumps('top');
  createThriftClumps('right');

  const counts = Object.fromEntries(recipe.plants.map(plant => [plant.name, plants.filter(item => item.plantId === plant.id).length]));
  const rejectionCounts = debug.rejected.reduce((acc, item) => {
    acc[item.reason] = (acc[item.reason] || 0) + 1;
    return acc;
  }, {});
  debug.summary = {
    totalPlants: plants.length,
    counts,
    hydrangeaClumps: new Set(plants.filter(item => item.plantId === 2).map(item => item.group)).size,
    thriftClumps: new Set(plants.filter(item => item.plantId === 1).map(item => item.group)).size,
    acceptedPlacements: debug.accepted.length,
    rejectedPlacements: debug.rejected.length,
    rejectionCounts,
  };
  latestRun = debug;
  render(plants, size, size, shape, seed, patioRect, debug);
}

function line(x1, y1, x2, y2, stroke, width, dash = '') {
  const element = document.createElementNS(svgNS, 'line');
  element.setAttribute('x1', x1);
  element.setAttribute('x2', x2);
  element.setAttribute('y1', y1);
  element.setAttribute('y2', y2);
  element.setAttribute('stroke', stroke);
  element.setAttribute('stroke-width', width);
  if (dash) element.setAttribute('stroke-dasharray', dash);
  els.svg.append(element);
}

function render(plants, width, height, shape, seed, patioRect, debug) {
  els.svg.innerHTML = '';
  els.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  if (els.grid.checked) {
    for (let x = 0; x <= width; x += 1) line(x, 0, x, height, '#cfd4c7', '.035');
    for (let y = 0; y <= height; y += 1) line(0, y, width, y, '#cfd4c7', '.035');
  }

  const patio = document.createElementNS(svgNS, 'rect');
  patio.setAttribute('x', patioRect.x);
  patio.setAttribute('y', patioRect.y);
  patio.setAttribute('width', Math.max(0.1, patioRect.width));
  patio.setAttribute('height', Math.max(0.1, patioRect.height));
  patio.setAttribute('fill', '#f2eee6');
  patio.setAttribute('stroke', '#8f8a80');
  patio.setAttribute('stroke-width', '.09');
  els.svg.append(patio);

  const fenceX = recipe.rules.fenceX ?? 21;
  const fenceTop = shapePoint(fenceX, 1.4, width, shape);
  const fenceBottom = shapePoint(fenceX, 22.3, width, shape);
  line(fenceTop.x, fenceTop.y, fenceBottom.x, fenceBottom.y, '#27322a', '.22', '.5 .28');

  for (const item of plants) {
    const plant = recipe.plants.find(value => value.id === item.plantId);
    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', item.x);
    circle.setAttribute('cy', item.y);
    circle.setAttribute('r', plant.radius * item.scale);
    circle.setAttribute('fill', plant.color);
    circle.setAttribute('fill-opacity', item.plantId === 4 ? '.72' : '.84');
    circle.setAttribute('stroke', '#fff');
    circle.setAttribute('stroke-opacity', '.72');
    circle.setAttribute('stroke-width', '.09');
    els.svg.append(circle);

    if (els.centers.checked) {
      const center = document.createElementNS(svgNS, 'circle');
      center.setAttribute('cx', item.x);
      center.setAttribute('cy', item.y);
      center.setAttribute('r', '.08');
      center.setAttribute('fill', '#111');
      els.svg.append(center);
    }
  }

  if (els.debugOverlay.checked) {
    for (const anchor of debug.anchors) {
      const point = shapePoint(anchor.x, anchor.y, width, shape);
      const marker = document.createElementNS(svgNS, 'circle');
      marker.setAttribute('cx', point.x);
      marker.setAttribute('cy', point.y);
      marker.setAttribute('r', anchor.type === 'thrift' ? '.16' : '.22');
      marker.setAttribute('fill', anchor.type === 'hydrangea' ? '#2563eb' : anchor.type === 'thrift' ? '#dc2626' : '#111827');
      marker.setAttribute('stroke', '#fff');
      marker.setAttribute('stroke-width', '.05');
      els.svg.append(marker);
    }
    for (const rejected of debug.rejected.slice(-180)) {
      const marker = document.createElementNS(svgNS, 'path');
      const s = 0.10;
      marker.setAttribute('d', `M ${rejected.x - s} ${rejected.y - s} L ${rejected.x + s} ${rejected.y + s} M ${rejected.x + s} ${rejected.y - s} L ${rejected.x - s} ${rejected.y + s}`);
      marker.setAttribute('stroke', '#b91c1c');
      marker.setAttribute('stroke-width', '.045');
      marker.setAttribute('opacity', '.7');
      els.svg.append(marker);
    }
  }

  const counts = recipe.plants.map(plant => ({ plant, count: plants.filter(item => item.plantId === plant.id).length }));
  els.title.textContent = `${width} × ${height}, ${shape}, seed ${seed}`;
  els.seedValue.textContent = seed;
  els.metrics.innerHTML = counts.map(({ plant, count }) => `<div class="metric"><strong>${count}</strong><span>${plant.role.replaceAll('-', ' ')}</span></div>`).join('');
  els.summary.innerHTML = `<strong>${plants.length} plant centers</strong><br><span class="muted">${debug.summary.hydrangeaClumps} hydrangea clumps · ${debug.summary.thriftClumps} thrift clumps · ${debug.summary.rejectedPlacements} rejected attempts</span>`;
  els.debugSummary.innerHTML = `<strong>${debug.summary.acceptedPlacements} accepted</strong><br><span class="muted">${Object.entries(debug.summary.rejectionCounts).map(([reason, count]) => `${count} ${reason}`).join(' · ') || 'No rejected placements'}</span>`;
}

['change', 'input'].forEach(eventName => {
  els.size.addEventListener(eventName, generate);
  els.shape.addEventListener(eventName, generate);
  els.seed.addEventListener(eventName, generate);
  els.grid.addEventListener(eventName, generate);
  els.centers.addEventListener(eventName, generate);
  els.debugOverlay.addEventListener(eventName, generate);
});

document.querySelector('#regenerate').addEventListener('click', generate);
document.querySelector('#next-seed').addEventListener('click', () => {
  els.seed.value = (Number(els.seed.value) % 100) + 1;
  generate();
});
els.downloadDebug.addEventListener('click', () => {
  if (!latestRun) return;
  downloadJson(`plant-pending-recipe-debug-seed-${latestRun.settings.seed}.json`, latestRun);
});

generate();
