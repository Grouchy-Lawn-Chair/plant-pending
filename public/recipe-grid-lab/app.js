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

function rotatePoint([x, y], angle) {
  return [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)];
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
    if (!options.allowPatioOverlap && circleIntersectsRect(point.x, point.y, radius + 0.03 * scale, patioRect)) {
      return { ok: false, reason: 'patio-collision', radius };
    }

    for (const existing of plants) {
      const existingRadius = plantById(existing.plantId).radius * existing.scale;
      const combinedRadius = radius + existingRadius;
      let minimumDistance = combinedRadius + (options.clearance ?? 0.02) * scale;
      let reason = 'plant-collision';

      if (plantId === 2 && existing.plantId === 2) {
        minimumDistance = existing.group === group ? combinedRadius * 0.9 : combinedRadius + 0.18 * scale;
        reason = existing.group === group ? 'hydrangea-overlap-too-large' : 'hydrangea-clumps-too-close';
      }
      if (plantId === 1 && existing.plantId === 1) {
        minimumDistance = existing.group === group ? combinedRadius * 0.82 : combinedRadius + 0.16 * scale;
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

  function placePlant(plantId, x, y, group, options = {}) {
    const itemScale = scale * (options.scaleMultiplier ?? 1) * (1 + (rand() - 0.5) * (options.scaleJitter ?? 0.025));
    const base = shapePoint(x, y, size, shape);
    const jitter = (options.jitter ?? 0.03) * scale;
    const candidates = [{ x: base.x, y: base.y }];
    for (let index = 0; index < (options.retries ?? 4); index += 1) {
      const angle = rand() * Math.PI * 2;
      const radius = jitter * (1 + index * 0.8);
      candidates.push({ x: base.x + Math.cos(angle) * radius, y: base.y + Math.sin(angle) * radius });
    }

    for (let attempt = 0; attempt < candidates.length; attempt += 1) {
      const point = candidates[attempt];
      const result = testPlacement(plantId, point, itemScale, group, options);
      attempts.push({
        plantId,
        plantName: plantById(plantId).name,
        group,
        attempt,
        baseX: x,
        baseY: y,
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

  function addModule(type, id, x, y, axis, variant, members) {
    const anchor = { type, id, x, y, axis, variant };
    anchors.push(anchor);
    const before = plants.length;
    for (const member of members) {
      placePlant(member.plantId, x + member.x, y + member.y, id, member.options);
    }
    const placed = plants.length - before;
    modules.push({ id, type, axis, variant, requested: members.length, placed });
    if (placed < Math.min(2, members.length)) anchor.failed = true;
  }

  // Composition-first recipe. Seeds choose between designer-authored variants.
  const compositionVariants = [
    {
      roses: [[3.8, 4.1], [8.9, 5.0], [13.5, 4.0], [15.5, 8.6], [15.6, 17.4]],
      topHydrangeas: [[3.0, 6.7], [6.7, 6.8], [10.4, 6.9]],
      rightHydrangeas: [[14.1, 11.8], [14.0, 15.0], [14.1, 19.0]],
      topThrift: [[2.6, 8.45], [6.0, 8.35], [9.5, 8.45]],
      rightThrift: [[12.55, 11.2], [12.55, 15.1], [12.55, 19.1]],
    },
    {
      roses: [[4.5, 4.7], [9.5, 4.1], [13.3, 5.3], [15.7, 9.6], [15.3, 16.4]],
      topHydrangeas: [[3.1, 6.9], [6.9, 6.5], [10.7, 7.0]],
      rightHydrangeas: [[14.0, 11.5], [14.2, 14.8], [14.0, 18.5]],
      topThrift: [[2.5, 8.45], [5.9, 8.3], [9.4, 8.45]],
      rightThrift: [[12.55, 11.0], [12.55, 14.9], [12.55, 18.8]],
    },
    {
      roses: [[3.6, 5.1], [8.1, 4.0], [12.8, 4.7], [15.8, 7.5], [15.7, 16.0]],
      topHydrangeas: [[2.9, 6.8], [6.5, 6.9], [10.2, 6.7]],
      rightHydrangeas: [[14.1, 11.6], [14.0, 15.2], [14.2, 18.9]],
      topThrift: [[2.4, 8.45], [5.8, 8.35], [9.2, 8.4]],
      rightThrift: [[12.55, 11.2], [12.55, 15.3], [12.55, 19.0]],
    },
    {
      roses: [[4.8, 3.9], [9.6, 5.5], [13.1, 3.7], [15.1, 8.8], [15.4, 17.8]],
      topHydrangeas: [[3.2, 6.8], [6.8, 6.6], [10.5, 6.9]],
      rightHydrangeas: [[14.0, 11.7], [14.2, 15.1], [14.0, 18.8]],
      topThrift: [[2.6, 8.4], [6.1, 8.35], [9.5, 8.4]],
      rightThrift: [[12.55, 11.1], [12.55, 15.0], [12.55, 19.0]],
    },
  ];

  const variantIndex = (seed - 1) % compositionVariants.length;
  const composition = compositionVariants[variantIndex];

  // 1. Hedge module. Structure stays fixed, seed only alters its rhythm slightly.
  const hedgeShift = (rand() - 0.5) * 0.22;
  const hedgeStep = 4.0 + (rand() - 0.5) * 0.12;
  for (let index = 0; index < 5; index += 1) {
    addModule('hedge', `hedge-${index + 1}`, 18.8, 3.0 + hedgeShift + index * hedgeStep, 'right', 'upright-screen', [
      { plantId: 4, x: 0, y: 0, options: { jitter: 0.015, retries: 2, scaleJitter: 0.02, clearance: 0.04 } },
    ]);
  }

  // 2. Rose masses. These are authored composition slots, not random discoveries.
  composition.roses.forEach(([x, y], index) => {
    addModule('rose', `rose-${index + 1}`, x, y, index < 3 ? 'top' : 'right', `rose-slot-${variantIndex + 1}`, [
      { plantId: 3, x: 0, y: 0, options: { jitter: 0.025, retries: 4, scaleJitter: 0.045, clearance: 0.08 } },
    ]);
  });

  const hydrangeaTemplates = [
    [[-0.86, 0.12], [0.86, -0.12]],
    [[-0.92, 0.48], [0.92, 0.44], [0, -0.92]],
    [[-0.9, -0.52], [0.9, -0.48], [-0.9, 0.92], [0.9, 0.88]],
  ];

  function hydrangeaMembers(axis, moduleIndex) {
    const countPattern = [3, 2, 3, 3, 2, 3];
    const count = countPattern[(moduleIndex + variantIndex) % countPattern.length];
    const template = hydrangeaTemplates[count - 2];
    const angle = axis === 'right' ? Math.PI / 2 : 0;
    return template.map(offset => {
      const [x, y] = rotatePoint(offset, angle);
      return { plantId: 2, x, y, options: { jitter: 0.02, retries: 4, scaleJitter: 0.025, clearance: 0.02 } };
    });
  }

  composition.topHydrangeas.forEach(([x, y], index) => {
    addModule('hydrangea', `hydrangea-top-${index + 1}`, x, y, 'top', `hydrangea-${variantIndex + 1}`, hydrangeaMembers('top', index));
  });
  composition.rightHydrangeas.forEach(([x, y], index) => {
    addModule('hydrangea', `hydrangea-right-${index + 1}`, x, y, 'right', `hydrangea-${variantIndex + 1}`, hydrangeaMembers('right', index + 3));
  });

  const thriftTemplates = [
    [[-0.78, 0.05], [0, -0.02], [0.78, 0.04], [-0.38, -0.76], [0.4, -0.72]],
    [[-0.75, 0.06], [0.02, -0.06], [0.77, 0.03], [-0.52, -0.72], [0.28, -0.78], [0.72, -0.7]],
    [[-0.8, 0.03], [-0.02, -0.02], [0.76, 0.05], [-0.56, -0.72], [0.18, -0.78]],
  ];

  function thriftMembers(axis, moduleIndex) {
    const template = thriftTemplates[(variantIndex + moduleIndex) % thriftTemplates.length];
    const countPattern = [5, 6, 5, 5, 6, 5];
    const count = countPattern[(moduleIndex + seed) % countPattern.length];
    const angle = axis === 'right' ? Math.PI / 2 : 0;
    return template.slice(0, count).map(offset => {
      const [x, y] = rotatePoint(offset, angle);
      return { plantId: 1, x, y, options: { jitter: 0.018, retries: 4, scaleJitter: 0.035, clearance: 0 } };
    });
  }

  composition.topThrift.forEach(([x, y], index) => {
    addModule('thrift', `thrift-top-${index + 1}`, x, y, 'top', `thrift-${variantIndex + 1}`, thriftMembers('top', index));
  });
  composition.rightThrift.forEach(([x, y], index) => {
    addModule('thrift', `thrift-right-${index + 1}`, x, y, 'right', `thrift-${variantIndex + 1}`, thriftMembers('right', index + 3));
  });

  const accepted = attempts.filter(attempt => attempt.ok).length;
  const rejected = attempts.length - accepted;
  const failedAnchors = anchors.filter(anchor => anchor.failed).length;
  const successfulHydrangeaModules = modules.filter(module => module.type === 'hydrangea' && module.placed >= 2).length;
  const successfulThriftModules = modules.filter(module => module.type === 'thrift' && module.placed >= 3).length;

  lastRun = {
    recipeId: recipe.id,
    recipeName: recipe.name,
    recipeVersion: 'phase-1-composition-first-v5',
    generatedAt: new Date().toISOString(),
    settings: { size, shape, seed, scale, compositionVariant: variantIndex + 1 },
    rules: {
      generationMode: 'composition-first',
      authoredCompositionVariants: compositionVariants.length,
      seedControls: ['composition-variant', 'bounded-jitter', 'plant-scale', 'clump-member-count'],
      seedDoesNotControl: ['recipe-layer-order', 'module-count', 'module-role', 'edge-assignment'],
      hydrangeaMaxOverlapFraction: 0.1,
      hydrangeaTargetModules: 6,
      thriftTargetModules: 6,
    },
    composition,
    modules,
    anchors,
    attempts,
    plants,
    summary: {
      accepted,
      rejected,
      failedAnchors,
      acceptanceRate: attempts.length ? accepted / attempts.length : 0,
      successfulHydrangeaModules,
      successfulThriftModules,
    },
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
  const hydrangeaModules = modules.filter(module => module.type === 'hydrangea' && module.placed >= 2).length;
  const thriftModules = modules.filter(module => module.type === 'thrift' && module.placed >= 3).length;
  const accepted = attempts.filter(attempt => attempt.ok).length;
  const rejected = attempts.length - accepted;
  const rate = attempts.length ? Math.round((accepted / attempts.length) * 100) : 0;

  els.title.textContent = `${width} × ${height}, ${shape}, seed ${seed}, composition ${compositionVariant}`;
  els.seedValue.textContent = seed;
  els.metrics.innerHTML = counts.map(({ plant, count }) => `<div class="metric"><strong>${count}</strong><span>${plant.role.replaceAll('-', ' ')}</span></div>`).join('');
  els.summary.innerHTML = `<strong>${plants.length} plant centers</strong><br><span class="muted">Composition-first variant ${compositionVariant} · ${hydrangeaModules}/6 hydrangea modules · ${thriftModules}/6 thrift modules</span>`;
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