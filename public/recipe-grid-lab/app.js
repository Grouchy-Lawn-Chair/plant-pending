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
  debugSummary: document.querySelector('#debug-summary'),
  grid: document.querySelector('#show-grid'),
  centers: document.querySelector('#show-centers'),
  debugOverlay: document.querySelector('#show-debug-overlay'),
  downloadDebug: document.querySelector('#download-debug'),
};

let lastRun = null;

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

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function circleIntersectsRect(x, y, radius, rect) {
  const nearestX = Math.max(rect.x, Math.min(x, rect.x + rect.width));
  const nearestY = Math.max(rect.y, Math.min(y, rect.y + rect.height));
  return Math.hypot(x - nearestX, y - nearestY) < radius;
}

function shuffled(items, rand) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rand() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function generate() {
  const size = Number(els.size.value);
  const shape = els.shape.value;
  const seed = Number(els.seed.value);
  const rand = rng(seed * 7919 + 17);
  const scale = size / recipe.rules.referenceGrid;
  const plants = [];
  const anchors = [];
  const attempts = [];
  const plantById = id => recipe.plants.find(plant => plant.id === id);

  const patioStart = shapePoint(recipe.rules.patio.x, recipe.rules.patio.y, size, shape);
  const patioEnd = shapePoint(recipe.rules.patio.x + recipe.rules.patio.width, recipe.rules.patio.y + recipe.rules.patio.height, size, shape);
  const patioRect = {
    x: Math.min(patioStart.x, patioEnd.x),
    y: Math.min(patioStart.y, patioEnd.y),
    width: Math.abs(patioEnd.x - patioStart.x),
    height: Math.abs(patioEnd.y - patioStart.y),
  };

  function testPlacement(plantId, point, itemScale, group, options = {}) {
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
      const combinedRadius = radius + existingRadius;
      let minimumDistance = combinedRadius + (options.clearance ?? 0.04) * scale;
      let reason = 'plant-collision';

      if (plantId === 2 && existing.plantId === 2) {
        if (existing.group === group) {
          minimumDistance = combinedRadius * 0.9;
          reason = 'hydrangea-overlap-too-large';
        } else {
          minimumDistance = combinedRadius + 0.22 * scale;
          reason = 'hydrangea-clumps-too-close';
        }
      }

      if (plantId === 1 && existing.plantId === 1) {
        minimumDistance = existing.group === group ? combinedRadius * 0.84 : combinedRadius + 0.22 * scale;
        reason = existing.group === group ? 'thrift-overlap-too-large' : 'thrift-clumps-too-close';
      }

      const actualDistance = distance(point, existing);
      if (actualDistance < minimumDistance) {
        return {
          ok: false,
          reason,
          radius,
          conflictWith: existing.id,
          actualDistance,
          minimumDistance,
          overlapFraction: Math.max(0, (combinedRadius - actualDistance) / combinedRadius),
        };
      }
    }
    return { ok: true, radius };
  }

  function addPlant(plantId, baseX, baseY, group, options = {}) {
    const itemScale = scale * (options.scaleMultiplier ?? 1) * (1 + (rand() - 0.5) * (options.scaleJitter ?? 0.04));
    const basePoint = shapePoint(baseX, baseY, size, shape);
    const attemptsAllowed = options.attempts ?? 12;
    const initialJitter = (options.jitter ?? 0.08) * scale;

    for (let attempt = 0; attempt < attemptsAllowed; attempt += 1) {
      const searchRadius = initialJitter + attempt * (options.retryStep ?? 0.05) * scale;
      const angle = rand() * Math.PI * 2;
      const point = attempt === 0 ? basePoint : {
        x: basePoint.x + Math.cos(angle) * searchRadius * (0.45 + rand() * 0.55),
        y: basePoint.y + Math.sin(angle) * searchRadius * (0.45 + rand() * 0.55),
      };
      const result = testPlacement(plantId, point, itemScale, group, options);
      attempts.push({
        plantId,
        plantName: plantById(plantId).name,
        group,
        attempt,
        baseX,
        baseY,
        x: point.x,
        y: point.y,
        scale: itemScale,
        ...result,
      });
      if (result.ok) {
        const item = { id: `${group}-${plants.length + 1}`, plantId, x: point.x, y: point.y, group, scale: itemScale };
        plants.push(item);
        return item;
      }
    }
    return null;
  }

  function findValidAnchor(type, id, preferred, plantId, footprintRadius, options = {}) {
    const candidates = [{ x: preferred.x, y: preferred.y }];
    for (let ring = 1; ring <= 6; ring += 1) {
      const radius = ring * (options.step ?? 0.45);
      for (let slot = 0; slot < 12; slot += 1) {
        const angle = (slot / 12) * Math.PI * 2 + rand() * 0.2;
        candidates.push({ x: preferred.x + Math.cos(angle) * radius, y: preferred.y + Math.sin(angle) * radius });
      }
    }
    for (const candidate of candidates) {
      const point = shapePoint(candidate.x, candidate.y, size, shape);
      const fakeScale = footprintRadius / plantById(plantId).radius;
      const result = testPlacement(plantId, point, fakeScale, id, { clearance: options.clearance ?? 0.08 });
      if (result.ok) {
        const anchor = { type, id, axis: preferred.axis, x: candidate.x, y: candidate.y };
        anchors.push(anchor);
        return anchor;
      }
    }
    anchors.push({ type, id, axis: preferred.axis, x: preferred.x, y: preferred.y, failed: true });
    return null;
  }

  // 1. Hedge
  const hedgeShift = (rand() - 0.5) * 0.45;
  const hedgeStep = 3.95 + rand() * 0.25;
  for (let index = 0; index < 5; index += 1) {
    const anchor = { type: 'hedge', id: `hedge-${index + 1}`, x: 18.8, y: 3.0 + hedgeShift + index * hedgeStep };
    anchors.push(anchor);
    addPlant(4, anchor.x, anchor.y, 'privacy-hedge', { jitter: 0.04, retryStep: 0.08, scaleJitter: 0.03, clearance: 0.06, attempts: 10 });
  }

  // 2. Roses, with structural relocation rather than tiny repeated jitter.
  const roseSlotSets = [
    [[3.7, 4.1], [8.9, 5.0], [13.8, 4.1], [15.6, 8.1], [15.7, 17.1]],
    [[4.7, 4.9], [9.7, 3.9], [13.1, 5.6], [15.9, 10.1], [15.0, 16.2]],
    [[3.4, 5.5], [8.0, 3.8], [12.9, 4.6], [16.0, 7.0], [15.7, 15.8]],
    [[5.0, 3.8], [9.7, 5.7], [13.2, 3.6], [15.0, 8.8], [15.5, 18.0]],
  ];
  const roseSlots = roseSlotSets[(seed - 1) % roseSlotSets.length];
  roseSlots.forEach(([x, y], index) => {
    const anchor = findValidAnchor('rose', `rose-${index + 1}`, { x, y }, 3, 1.58 * scale, { step: 0.5, clearance: 0.12 });
    if (anchor) addPlant(3, anchor.x, anchor.y, 'rose-mass', { jitter: 0.04, retryStep: 0.12, scaleJitter: 0.06, clearance: 0.12, attempts: 12 });
  });

  // 3. Hydrangeas. Validate the entire clump footprint first, then use templates that already obey the 10% overlap rule.
  const hydrangeaPreferred = [
    { x: 3.5, y: 6.5, axis: 'top' },
    { x: 7.0, y: 6.6, axis: 'top' },
    { x: 10.6, y: 7.0, axis: 'top' },
    { x: 14.1, y: 11.7, axis: 'right' },
    { x: 14.2, y: 15.2, axis: 'right' },
    { x: 14.0, y: 19.0, axis: 'right' },
  ];
  const hydrangeaTemplates = {
    2: [[-0.84, 0], [0.84, 0]],
    3: [[-0.86, 0.35], [0.86, 0.35], [0, -0.92]],
    4: [[-0.86, -0.46], [0.86, -0.46], [-0.86, 0.82], [0.86, 0.82]],
  };

  hydrangeaPreferred.forEach((preferred, index) => {
    const count = 2 + Math.floor(rand() * 3);
    const footprint = count === 4 ? 2.15 * scale : 1.85 * scale;
    const anchor = findValidAnchor('hydrangea', `hydrangea-clump-${index + 1}`, preferred, 2, footprint, { step: 0.5, clearance: 0.14 });
    if (!anchor) return;

    const rotation = (preferred.axis === 'right' ? Math.PI / 2 : 0) + (rand() - 0.5) * 0.3;
    const template = hydrangeaTemplates[count];
    for (const [offsetX, offsetY] of template) {
      const rotatedX = offsetX * Math.cos(rotation) - offsetY * Math.sin(rotation);
      const rotatedY = offsetX * Math.sin(rotation) + offsetY * Math.cos(rotation);
      addPlant(2, anchor.x + rotatedX, anchor.y + rotatedY, anchor.id, {
        jitter: 0.03,
        retryStep: 0.07,
        scaleJitter: 0.035,
        clearance: 0.04,
        attempts: 12,
      });
    }
  });

  // 4. Bloodstone thrift. Use only a few real drift anchors, then place 3 to 6 plants inside each drift.
  const thriftPreferred = [
    { x: 2.7, y: 8.35, axis: 'top' },
    { x: 6.0, y: 8.3, axis: 'top' },
    { x: 9.4, y: 8.35, axis: 'top' },
    { x: 12.55, y: 11.3, axis: 'right' },
    { x: 12.55, y: 15.2, axis: 'right' },
    { x: 12.55, y: 19.1, axis: 'right' },
  ];
  const thriftTemplates = [
    [[-0.72, 0], [0, 0.05], [0.72, 0], [-0.36, -0.68], [0.38, -0.64], [0.03, -1.27]],
    [[-0.7, -0.12], [0, 0.08], [0.7, -0.08], [-0.48, -0.72], [0.46, -0.69], [0, -1.3]],
    [[-0.68, 0.02], [0.02, -0.03], [0.7, 0.04], [-0.3, -0.7], [0.42, -0.74], [-0.76, -1.18]],
  ];

  thriftPreferred.forEach((preferred, index) => {
    const count = 3 + Math.floor(rand() * 4);
    const anchor = findValidAnchor('thrift', `thrift-${preferred.axis}-${index + 1}`, preferred, 1, 1.35 * scale, { step: 0.4, clearance: 0.06 });
    if (!anchor) return;
    const template = thriftTemplates[(seed + index) % thriftTemplates.length];
    const rotation = preferred.axis === 'right' ? Math.PI / 2 : 0;
    for (const [offsetX, offsetY] of shuffled(template.slice(0, count), rand)) {
      const rotatedX = offsetX * Math.cos(rotation) - offsetY * Math.sin(rotation);
      const rotatedY = offsetX * Math.sin(rotation) + offsetY * Math.cos(rotation);
      addPlant(1, anchor.x + rotatedX, anchor.y + rotatedY, anchor.id, {
        jitter: 0.025,
        retryStep: 0.06,
        scaleJitter: 0.045,
        clearance: 0.01,
        attempts: 10,
      });
    }
  });

  const accepted = attempts.filter(attempt => attempt.ok).length;
  const rejected = attempts.length - accepted;
  const failedAnchors = anchors.filter(anchor => anchor.failed).length;
  lastRun = {
    recipeId: recipe.id,
    recipeName: recipe.name,
    recipeVersion: 'phase-1-layout-rules-v4',
    generatedAt: new Date().toISOString(),
    settings: { size, shape, seed, scale },
    rules: {
      hydrangeaMaxOverlapFraction: 0.1,
      hydrangeaClumpSize: [2, 4],
      hydrangeaAnchorValidation: true,
      thriftClumpSize: [3, 6],
      thriftAnchorCount: 6,
      progressiveRetrySearch: true,
    },
    anchors,
    attempts,
    plants,
    summary: { accepted, rejected, failedAnchors, acceptanceRate: attempts.length ? accepted / attempts.length : 0 },
  };

  render(plants, size, size, shape, seed, patioRect, anchors, attempts);
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

function render(plants, width, height, shape, seed, patioRect, anchors, attempts) {
  els.svg.innerHTML = '';
  els.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  if (els.grid.checked) {
    for (let x = 0; x <= width; x += 1) line(x, 0, x, height, '#cfd4c7', '.035');
    for (let y = 0; y <= height; y += 1) line(0, y, width, y, '#cfd4c7', '.035');
  }

  const patio = document.createElementNS(svgNS, 'rect');
  patio.setAttribute('x', patioRect.x);
  patio.setAttribute('y', patioRect.y);
  patio.setAttribute('width', patioRect.width);
  patio.setAttribute('height', patioRect.height);
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
    for (const anchor of anchors) {
      const point = shapePoint(anchor.x, anchor.y, width, shape);
      const marker = document.createElementNS(svgNS, 'circle');
      marker.setAttribute('cx', point.x);
      marker.setAttribute('cy', point.y);
      marker.setAttribute('r', '.16');
      marker.setAttribute('fill', anchor.failed ? '#d22' : '#111');
      marker.setAttribute('stroke', '#fff');
      marker.setAttribute('stroke-width', '.05');
      els.svg.append(marker);
    }
    for (const attempt of attempts.filter(value => !value.ok).slice(-220)) {
      line(attempt.x - 0.09, attempt.y - 0.09, attempt.x + 0.09, attempt.y + 0.09, '#d22', '.045');
      line(attempt.x + 0.09, attempt.y - 0.09, attempt.x - 0.09, attempt.y + 0.09, '#d22', '.045');
    }
  }

  const counts = recipe.plants.map(plant => ({ plant, count: plants.filter(item => item.plantId === plant.id).length }));
  const hydrangeaClumps = new Set(plants.filter(item => item.plantId === 2).map(item => item.group)).size;
  const thriftClumps = new Set(plants.filter(item => item.plantId === 1).map(item => item.group)).size;
  const accepted = attempts.filter(attempt => attempt.ok).length;
  const rejected = attempts.length - accepted;
  const rate = attempts.length ? Math.round((accepted / attempts.length) * 100) : 0;

  els.title.textContent = `${width} × ${height}, ${shape}, seed ${seed}`;
  els.seedValue.textContent = seed;
  els.metrics.innerHTML = counts.map(({ plant, count }) => `<div class="metric"><strong>${count}</strong><span>${plant.role.replaceAll('-', ' ')}</span></div>`).join('');
  els.summary.innerHTML = `<strong>${plants.length} plant centers</strong><br><span class="muted">${hydrangeaClumps} hydrangea clumps · ${thriftClumps} thrift clumps · ${counts.map(value => `${value.count} ${value.plant.name}`).join(' · ')}</span>`;
  els.debugSummary.innerHTML = `<strong>${accepted} accepted · ${rejected} rejected</strong><br><span class="muted">${rate}% acceptance rate · ${anchors.filter(anchor => anchor.failed).length} failed anchors</span>`;
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
