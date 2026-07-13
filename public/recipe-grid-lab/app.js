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
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function circleIntersectsRect(x, y, radius, rect) {
  const nearestX = Math.max(rect.x, Math.min(x, rect.x + rect.width));
  const nearestY = Math.max(rect.y, Math.min(y, rect.y + rect.height));
  return Math.hypot(x - nearestX, y - nearestY) < radius;
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
  const modules = [];
  const plantById = id => recipe.plants.find(plant => plant.id === id);

  const packingMultiplierByPlant = {
    1: 0.80,
    2: 0.84,
    3: 0.94,
    4: 0.98,
  };

  const patioStart = shapePoint(recipe.rules.patio.x, recipe.rules.patio.y, size, shape);
  const patioEnd = shapePoint(recipe.rules.patio.x + recipe.rules.patio.width, recipe.rules.patio.y + recipe.rules.patio.height, size, shape);
  const patioRect = {
    x: Math.min(patioStart.x, patioEnd.x),
    y: Math.min(patioStart.y, patioEnd.y),
    width: Math.abs(patioEnd.x - patioStart.x),
    height: Math.abs(patioEnd.y - patioStart.y),
  };

  const visualRadiusFor = (plantId, itemScale) => plantById(plantId).radius * itemScale;
  const packingRadiusFor = (plantId, itemScale) => visualRadiusFor(plantId, itemScale) * (packingMultiplierByPlant[plantId] ?? 1);

  function pairRule(candidatePlantId, existingPlantId, sameGroup, combinedPackingRadius) {
    const pair = [candidatePlantId, existingPlantId].sort((a, b) => a - b).join('-');
    if (pair === '1-1') return { minimumDistance: combinedPackingRadius * (sameGroup ? 0.78 : 0.90), reason: sameGroup ? 'thrift-overlap-too-large' : 'thrift-clumps-too-close' };
    if (pair === '2-2') return { minimumDistance: combinedPackingRadius * (sameGroup ? 0.90 : 0.98), reason: sameGroup ? 'hydrangea-overlap-too-large' : 'hydrangea-clumps-too-close' };
    if (pair === '1-2') return { minimumDistance: combinedPackingRadius * 0.88, reason: 'thrift-too-close-to-hydrangea' };
    if (pair === '1-3') return { minimumDistance: combinedPackingRadius * 0.94, reason: 'thrift-too-close-to-rose' };
    if (pair === '2-3') return { minimumDistance: combinedPackingRadius * 0.96, reason: 'hydrangea-too-close-to-rose' };
    if (pair === '3-3') return { minimumDistance: combinedPackingRadius * 0.98, reason: 'rose-overlap-too-large' };
    return { minimumDistance: combinedPackingRadius + 0.02 * scale, reason: 'plant-collision' };
  }

  function testPlacement(plantId, point, itemScale, group, options = {}) {
    const visualRadius = visualRadiusFor(plantId, itemScale);
    const packingRadius = packingRadiusFor(plantId, itemScale);
    const edgePadding = 0.08 * scale;

    if (point.x - visualRadius < edgePadding || point.x + visualRadius > size - edgePadding || point.y - visualRadius < edgePadding || point.y + visualRadius > size - edgePadding) {
      return { ok: false, reason: 'outside-canvas', radius: visualRadius, packingRadius };
    }
    if (!options.allowPatioOverlap && circleIntersectsRect(point.x, point.y, visualRadius + 0.02 * scale, patioRect)) {
      return { ok: false, reason: 'patio-collision', radius: visualRadius, packingRadius };
    }

    for (const existing of plants) {
      const existingPackingRadius = packingRadiusFor(existing.plantId, existing.scale);
      const combinedPackingRadius = packingRadius + existingPackingRadius;
      const { minimumDistance, reason } = pairRule(plantId, existing.plantId, existing.group === group, combinedPackingRadius);
      const actualDistance = distance(point, existing);
      if (actualDistance < minimumDistance) {
        return {
          ok: false,
          reason,
          radius: visualRadius,
          packingRadius,
          conflictWith: existing.id,
          actualDistance,
          minimumDistance,
          overlapFraction: Math.max(0, (combinedPackingRadius - actualDistance) / combinedPackingRadius),
        };
      }
    }
    return { ok: true, radius: visualRadius, packingRadius };
  }

  function addFixedPlant(plantId, x, y, group, options = {}) {
    const itemScale = scale * (1 + (rand() - 0.5) * (options.scaleJitter ?? 0.025));
    const base = shapePoint(x, y, size, shape);
    const candidates = [{ x: base.x, y: base.y }];
    for (let index = 0; index < (options.retries ?? 4); index += 1) {
      const angle = rand() * Math.PI * 2;
      const radius = (0.03 + index * 0.035) * scale;
      candidates.push({ x: base.x + Math.cos(angle) * radius, y: base.y + Math.sin(angle) * radius });
    }
    for (let attempt = 0; attempt < candidates.length; attempt += 1) {
      const point = candidates[attempt];
      const result = testPlacement(plantId, point, itemScale, group, options);
      attempts.push({ plantId, plantName: plantById(plantId).name, group, mode: 'fixed-slot', attempt, baseX: x, baseY: y, x: point.x, y: point.y, scale: itemScale, ...result });
      if (result.ok) {
        const item = { id: `${group}-${plants.length + 1}`, plantId, x: point.x, y: point.y, group, scale: itemScale };
        plants.push(item);
        return item;
      }
    }
    return null;
  }

  function buildDriftBox(type, axis, x, y) {
    if (type === 'hydrangea') {
      if (axis === 'top') return { minX: x - 1.65, maxX: x + 1.65, minY: y - 1.05, maxY: y + 1.45 };
      return { minX: x - 1.45, maxX: x + 1.05, minY: y - 1.65, maxY: y + 1.65 };
    }
    if (axis === 'top') return { minX: x - 1.65, maxX: x + 1.65, minY: y - 0.25, maxY: y + 1.75 };
    return { minX: x - 1.75, maxX: x + 0.25, minY: y - 1.65, maxY: y + 1.65 };
  }

  function dropAndSettlePlant(plantId, anchorX, anchorY, axis, group, box, options = {}) {
    const itemScale = scale * (1 + (rand() - 0.5) * (options.scaleJitter ?? 0.025));
    const lateralOffsets = [0, -0.32, 0.32, -0.64, 0.64, -0.96, 0.96, -1.28, 1.28]
      .map(value => value + (rand() - 0.5) * 0.08);
    let best = null;

    for (const lateral of lateralOffsets) {
      const start = axis === 'top'
        ? { x: clamp(anchorX + lateral, box.minX, box.maxX), y: box.minY - 0.75 }
        : { x: box.maxX + 0.75, y: clamp(anchorY + lateral, box.minY, box.maxY) };
      const vector = axis === 'top' ? { x: 0, y: 0.10 } : { x: -0.10, y: 0 };
      let lastValid = null;

      for (let step = 0; step < 54; step += 1) {
        const localPoint = { x: start.x + vector.x * step, y: start.y + vector.y * step };
        if (localPoint.x < box.minX - 0.35 || localPoint.x > box.maxX + 0.35 || localPoint.y < box.minY - 0.35 || localPoint.y > box.maxY + 0.35) continue;
        const point = shapePoint(localPoint.x, localPoint.y, size, shape);
        const result = testPlacement(plantId, point, itemScale, group, options);
        attempts.push({ plantId, plantName: plantById(plantId).name, group, mode: 'drop-settle', laneOffset: lateral, attempt: step, baseX: anchorX, baseY: anchorY, localX: localPoint.x, localY: localPoint.y, x: point.x, y: point.y, scale: itemScale, ...result });
        if (result.ok) lastValid = { point, localPoint, depth: step };
        else if (lastValid) break;
      }
      if (lastValid && (!best || lastValid.depth > best.depth)) best = lastValid;
    }

    if (!best) return null;
    const item = { id: `${group}-${plants.length + 1}`, plantId, x: best.point.x, y: best.point.y, group, scale: itemScale };
    plants.push(item);
    return item;
  }

  function addDroppedModule(type, id, x, y, axis, variant, plantId, requested) {
    const driftBox = buildDriftBox(type, axis, x, y);
    const anchor = { type, id, x, y, axis, variant, driftBox };
    anchors.push(anchor);
    const before = plants.length;
    for (let index = 0; index < requested; index += 1) {
      dropAndSettlePlant(plantId, x, y, axis, id, driftBox, { scaleJitter: plantId === 1 ? 0.04 : 0.025 });
    }
    const placed = plants.length - before;
    modules.push({ id, type, axis, variant, requested, placed });
    const minimum = type === 'hydrangea' ? 2 : 3;
    if (placed < minimum) anchor.failed = true;
  }

  const compositionVariants = [
    { roses: [[3.8, 4.1], [8.9, 5.0], [13.5, 4.0], [15.5, 8.6], [15.6, 17.4]], topHydrangeas: [[3.0, 6.7], [6.7, 6.8], [10.4, 6.9]], rightHydrangeas: [[14.1, 11.8], [14.0, 15.0], [14.1, 19.0]], topThrift: [[2.6, 8.45], [6.0, 8.35], [9.5, 8.45]], rightThrift: [[12.55, 11.2], [12.55, 15.1], [12.55, 19.1]] },
    { roses: [[4.5, 4.7], [9.5, 4.1], [13.3, 5.3], [15.7, 9.6], [15.3, 16.4]], topHydrangeas: [[3.1, 6.9], [6.9, 6.5], [10.7, 7.0]], rightHydrangeas: [[14.0, 11.5], [14.2, 14.8], [14.0, 18.5]], topThrift: [[2.5, 8.45], [5.9, 8.3], [9.4, 8.45]], rightThrift: [[12.55, 11.0], [12.55, 14.9], [12.55, 18.8]] },
    { roses: [[3.6, 5.1], [8.1, 4.0], [12.8, 4.7], [15.8, 7.5], [15.7, 16.0]], topHydrangeas: [[2.9, 6.8], [6.5, 6.9], [10.2, 6.7]], rightHydrangeas: [[14.1, 11.6], [14.0, 15.2], [14.2, 18.9]], topThrift: [[2.4, 8.45], [5.8, 8.35], [9.2, 8.4]], rightThrift: [[12.55, 11.2], [12.55, 15.3], [12.55, 19.0]] },
    { roses: [[4.8, 3.9], [9.6, 5.5], [13.1, 3.7], [15.1, 8.8], [15.4, 17.8]], topHydrangeas: [[3.2, 6.8], [6.8, 6.6], [10.5, 6.9]], rightHydrangeas: [[14.0, 11.7], [14.2, 15.1], [14.0, 18.8]], topThrift: [[2.6, 8.4], [6.1, 8.35], [9.5, 8.4]], rightThrift: [[12.55, 11.1], [12.55, 15.0], [12.55, 19.0]] },
  ];

  const variantIndex = (seed - 1) % compositionVariants.length;
  const composition = compositionVariants[variantIndex];

  const hedgeShift = (rand() - 0.5) * 0.22;
  const hedgeStep = 4.0 + (rand() - 0.5) * 0.12;
  for (let index = 0; index < 5; index += 1) {
    const id = `hedge-${index + 1}`;
    const x = 18.8;
    const y = 3.0 + hedgeShift + index * hedgeStep;
    anchors.push({ type: 'hedge', id, x, y, axis: 'right', variant: 'upright-screen' });
    const placed = addFixedPlant(4, x, y, id, { scaleJitter: 0.02, retries: 2 }) ? 1 : 0;
    modules.push({ id, type: 'hedge', axis: 'right', variant: 'upright-screen', requested: 1, placed });
  }

  composition.roses.forEach(([x, y], index) => {
    const id = `rose-${index + 1}`;
    const axis = index < 3 ? 'top' : 'right';
    anchors.push({ type: 'rose', id, x, y, axis, variant: `rose-slot-${variantIndex + 1}` });
    const placed = addFixedPlant(3, x, y, id, { scaleJitter: 0.045, retries: 5 }) ? 1 : 0;
    modules.push({ id, type: 'rose', axis, variant: `rose-slot-${variantIndex + 1}`, requested: 1, placed });
  });

  const hydrangeaCounts = [3, 2, 3, 3, 2, 3];
  composition.topHydrangeas.forEach(([x, y], index) => addDroppedModule('hydrangea', `hydrangea-top-${index + 1}`, x, y, 'top', `hydrangea-drop-${variantIndex + 1}`, 2, hydrangeaCounts[index]));
  composition.rightHydrangeas.forEach(([x, y], index) => addDroppedModule('hydrangea', `hydrangea-right-${index + 1}`, x, y, 'right', `hydrangea-drop-${variantIndex + 1}`, 2, hydrangeaCounts[index + 3]));

  const thriftCounts = [5, 5, 5, 5, 6, 5];
  composition.topThrift.forEach(([x, y], index) => addDroppedModule('thrift', `thrift-top-${index + 1}`, x, y, 'top', `thrift-drop-${variantIndex + 1}`, 1, thriftCounts[index]));
  composition.rightThrift.forEach(([x, y], index) => addDroppedModule('thrift', `thrift-right-${index + 1}`, x, y, 'right', `thrift-drop-${variantIndex + 1}`, 1, thriftCounts[index + 3]));

  const accepted = attempts.filter(attempt => attempt.ok).length;
  const rejected = attempts.length - accepted;
  const failedAnchors = anchors.filter(anchor => anchor.failed).length;
  const successfulHydrangeaModules = modules.filter(module => module.type === 'hydrangea' && module.placed >= 2).length;
  const successfulThriftModules = modules.filter(module => module.type === 'thrift' && module.placed >= 3).length;

  lastRun = {
    recipeId: recipe.id,
    recipeName: recipe.name,
    recipeVersion: 'phase-1-disc-drop-v6',
    generatedAt: new Date().toISOString(),
    settings: { size, shape, seed, scale, compositionVariant: variantIndex + 1 },
    rules: {
      generationMode: 'composition-first-disc-drop',
      authoredCompositionVariants: compositionVariants.length,
      seedControls: ['composition-variant', 'bounded-jitter', 'plant-scale', 'module-count-variation'],
      seedDoesNotControl: ['recipe-layer-order', 'module-role', 'edge-assignment'],
      packingMultiplierByPlant,
      hydrangeaTargetModules: 6,
      thriftTargetModules: 6,
    },
    composition,
    modules,
    anchors,
    attempts,
    plants,
    summary: { accepted, rejected, failedAnchors, acceptanceRate: attempts.length ? accepted / attempts.length : 0, successfulHydrangeaModules, successfulThriftModules },
  };

  render(plants, size, size, shape, seed, patioRect, anchors, attempts, modules, variantIndex + 1);
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

function render(plants, width, height, shape, seed, patioRect, anchors, attempts, modules, compositionVariant) {
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
      if (anchor.driftBox) {
        const topLeft = shapePoint(anchor.driftBox.minX, anchor.driftBox.minY, width, shape);
        const bottomRight = shapePoint(anchor.driftBox.maxX, anchor.driftBox.maxY, width, shape);
        const rect = document.createElementNS(svgNS, 'rect');
        rect.setAttribute('x', Math.min(topLeft.x, bottomRight.x));
        rect.setAttribute('y', Math.min(topLeft.y, bottomRight.y));
        rect.setAttribute('width', Math.abs(bottomRight.x - topLeft.x));
        rect.setAttribute('height', Math.abs(bottomRight.y - topLeft.y));
        rect.setAttribute('fill', 'none');
        rect.setAttribute('stroke', '#666');
        rect.setAttribute('stroke-width', '.04');
        rect.setAttribute('stroke-dasharray', '.18 .12');
        els.svg.append(rect);
      }
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
    for (const attempt of attempts.filter(value => !value.ok).slice(-260)) {
      line(attempt.x - 0.09, attempt.y - 0.09, attempt.x + 0.09, attempt.y + 0.09, '#d22', '.045');
      line(attempt.x + 0.09, attempt.y - 0.09, attempt.x - 0.09, attempt.y + 0.09, '#d22', '.045');
    }
  }

  const counts = recipe.plants.map(plant => ({ plant, count: plants.filter(item => item.plantId === plant.id).length }));
  const hydrangeaModules = modules.filter(module => module.type === 'hydrangea' && module.placed >= 2).length;
  const thriftModules = modules.filter(module => module.type === 'thrift' && module.placed >= 3).length;
  const accepted = attempts.filter(attempt => attempt.ok).length;
  const rejected = attempts.length - accepted;
  const rate = attempts.length ? Math.round((accepted / attempts.length) * 100) : 0;

  els.title.textContent = `${width} × ${height}, ${shape}, seed ${seed}, composition ${compositionVariant}`;
  els.seedValue.textContent = seed;
  els.metrics.innerHTML = counts.map(({ plant, count }) => `<div class="metric"><strong>${count}</strong><span>${plant.role.replaceAll('-', ' ')}</span></div>`).join('');
  els.summary.innerHTML = `<strong>${plants.length} plant centers</strong><br><span class="muted">Disc-drop composition ${compositionVariant} · ${hydrangeaModules}/6 hydrangea modules · ${thriftModules}/6 thrift modules</span>`;
  els.debugSummary.innerHTML = `<strong>${accepted} accepted · ${rejected} rejected</strong><br><span class="muted">${rate}% acceptance rate · ${anchors.filter(anchor => anchor.failed).length} failed modules</span>`;
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