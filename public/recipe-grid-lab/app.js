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
};

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

function generate() {
  const size = Number(els.size.value);
  const shape = els.shape.value;
  const seed = Number(els.seed.value);
  const rand = rng(seed * 7919 + 17);
  const scale = size / recipe.rules.referenceGrid;
  const plants = [];
  const rules = recipe.rules;

  const patioStart = shapePoint(rules.patio.x, rules.patio.y, size, shape);
  const patioEnd = shapePoint(rules.patio.x + rules.patio.width, rules.patio.y + rules.patio.height, size, shape);
  const patioRect = {
    x: Math.min(patioStart.x, patioEnd.x),
    y: Math.min(patioStart.y, patioEnd.y),
    width: Math.abs(patioEnd.x - patioStart.x),
    height: Math.abs(patioEnd.y - patioStart.y),
  };

  const plantById = id => recipe.plants.find(plant => plant.id === id);

  function canPlace(plantId, point, itemScale, options = {}) {
    const radius = plantById(plantId).radius * itemScale;
    const edgePadding = 0.08 * scale;
    if (point.x - radius < edgePadding || point.x + radius > size - edgePadding) return false;
    if (point.y - radius < edgePadding || point.y + radius > size - edgePadding) return false;
    if (!options.allowPatioOverlap && circleIntersectsRect(point.x, point.y, radius + 0.04 * scale, patioRect)) return false;

    const clearance = options.clearance ?? 0.04;
    for (const existing of plants) {
      if (options.ignorePlantIds?.includes(existing.plantId)) continue;
      const existingRadius = plantById(existing.plantId).radius * existing.scale;
      const minimumDistance = radius + existingRadius + clearance * scale;
      if (distance(point, existing) < minimumDistance) return false;
    }
    return true;
  }

  function addPlant(plantId, baseX, baseY, group, options = {}) {
    const itemScale = scale * (options.scaleMultiplier ?? 1) * (1 + (rand() - 0.5) * (options.scaleJitter ?? 0.05));
    const basePoint = shapePoint(baseX, baseY, size, shape);
    const jitter = (options.jitter ?? 0.12) * scale;
    const attempts = options.attempts ?? 10;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const spread = attempt === 0 ? 1 : 1 + attempt * 0.18;
      const point = {
        x: basePoint.x + (rand() - 0.5) * jitter * spread,
        y: basePoint.y + (rand() - 0.5) * jitter * spread,
      };
      if (canPlace(plantId, point, itemScale, options)) {
        plants.push({ plantId, x: point.x, y: point.y, group, scale: itemScale });
        return true;
      }
    }
    return false;
  }

  // Hedge stays a readable screen, but seed changes its rhythm and spacing slightly.
  const hedgeShift = (rand() - 0.5) * 0.65;
  const hedgeStep = 3.75 + rand() * 0.65;
  for (let index = 0; index < 5; index += 1) {
    addPlant(4, 18.8 + (rand() - 0.5) * 0.18, 3.05 + hedgeShift + index * hedgeStep, 'privacy-hedge', {
      jitter: 0.08,
      scaleJitter: 0.04,
      clearance: 0.14,
    });
  }

  // Roses use alternate seed-driven anchor slots so each seed creates a visibly different composition.
  const roseSlotSets = [
    [[3.7, 4.1], [8.9, 5.0], [13.8, 4.1], [15.6, 8.1], [16.0, 17.2]],
    [[4.7, 4.9], [9.7, 3.9], [13.1, 5.6], [15.9, 10.1], [15.1, 16.1]],
    [[3.4, 5.5], [8.0, 3.8], [12.9, 4.6], [16.0, 7.0], [16.3, 15.6]],
    [[5.0, 3.8], [9.7, 5.7], [13.2, 3.6], [15.0, 8.8], [16.2, 18.4]],
  ];
  const roseSlots = roseSlotSets[(seed - 1) % roseSlotSets.length];
  for (const [x, y] of roseSlots) {
    addPlant(3, x + (rand() - 0.5) * 0.75, y + (rand() - 0.5) * 0.75, 'rose-mass', {
      jitter: 0.3,
      scaleJitter: 0.08,
      clearance: 0.22,
      attempts: 18,
    });
  }

  // Hydrangeas are generated as tight, irregular clumps rather than isolated circles.
  const hydrangeaAnchors = [
    { x: 3.7, y: 6.4, axis: 'top' },
    { x: 7.6, y: 6.5, axis: 'top' },
    { x: 11.1, y: 7.2, axis: 'top' },
    { x: 13.9, y: 11.1, axis: 'right' },
    { x: 14.7, y: 14.8, axis: 'right' },
    { x: 14.8, y: 19.0, axis: 'right' },
  ];
  const clumpTemplates = [
    [[0, 0], [-0.82, 0.32], [0.78, 0.28], [-0.3, -0.72], [0.48, -0.62]],
    [[0, 0], [-0.75, -0.25], [0.72, -0.35], [-0.35, 0.68], [0.52, 0.58]],
    [[0, 0], [-0.68, 0.48], [0.72, 0.44], [0.02, -0.72]],
  ];

  hydrangeaAnchors.forEach((anchor, anchorIndex) => {
    const template = clumpTemplates[(seed + anchorIndex) % clumpTemplates.length];
    const count = 3 + Math.floor(rand() * 3);
    const rotation = (rand() - 0.5) * 0.9 + (anchor.axis === 'right' ? Math.PI / 2 : 0);
    const stretchX = anchor.axis === 'top' ? 1.05 + rand() * 0.2 : 0.82 + rand() * 0.18;
    const stretchY = anchor.axis === 'right' ? 1.08 + rand() * 0.2 : 0.82 + rand() * 0.18;
    const anchorX = anchor.x + (rand() - 0.5) * 0.9;
    const anchorY = anchor.y + (rand() - 0.5) * 0.7;

    for (let index = 0; index < count; index += 1) {
      const [offsetX, offsetY] = template[index % template.length];
      const rotatedX = offsetX * Math.cos(rotation) - offsetY * Math.sin(rotation);
      const rotatedY = offsetX * Math.sin(rotation) + offsetY * Math.cos(rotation);
      addPlant(2, anchorX + rotatedX * stretchX, anchorY + rotatedY * stretchY, `hydrangea-clump-${anchorIndex + 1}`, {
        jitter: 0.18,
        scaleJitter: 0.06,
        clearance: -0.28,
        ignorePlantIds: [2],
        attempts: 18,
      });
    }
  });

  // Bloodstone thrift forms broken two and three deep drifts. Candidates that cross the patio,
  // canvas edge, or a larger plant circle are rejected instead of being drawn on top.
  const thriftCandidates = [];
  const topPhase = rand() * 0.75;
  for (let row = 0; row < 3; row += 1) {
    const y = 8.72 - row * 0.88 + (rand() - 0.5) * 0.16;
    const startX = 1.65 + topPhase + row * 0.42;
    for (let x = startX; x <= 11.2; x += 1.02 + rand() * 0.16) {
      const clumpWave = Math.sin(x * 1.15 + seed * 0.73 + row) * 0.5 + 0.5;
      if (clumpWave > 0.22 || rand() > 0.35) thriftCandidates.push({ x, y, group: 'foreground-top' });
    }
  }

  const rightPhase = rand() * 0.75;
  for (let column = 0; column < 3; column += 1) {
    const x = 12.2 + column * 0.92 + (rand() - 0.5) * 0.16;
    const startY = 9.85 + rightPhase + column * 0.45;
    for (let y = startY; y <= 21.25; y += 1.02 + rand() * 0.16) {
      const clumpWave = Math.sin(y * 1.08 + seed * 0.61 + column) * 0.5 + 0.5;
      if (clumpWave > 0.2 || rand() > 0.34) thriftCandidates.push({ x, y, group: 'foreground-right' });
    }
  }

  // Seed controls candidate order, which changes gaps, drift depth, and the final outline.
  thriftCandidates.sort(() => rand() - 0.5);
  for (const candidate of thriftCandidates) {
    addPlant(1, candidate.x, candidate.y, candidate.group, {
      jitter: 0.24,
      scaleJitter: 0.09,
      clearance: 0.06,
      attempts: 6,
    });
  }

  render(plants, size, size, shape, seed, patioRect);
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

function render(plants, width, height, shape, seed, patioRect) {
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
    circle.dataset.role = plant.role;
    circle.dataset.group = item.group;
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

  const counts = recipe.plants.map(plant => ({
    plant,
    count: plants.filter(item => item.plantId === plant.id).length,
  }));
  const hydrangeaClumps = new Set(plants.filter(item => item.plantId === 2).map(item => item.group)).size;

  els.title.textContent = `${width} × ${height}, ${shape}, seed ${seed}`;
  els.seedValue.textContent = seed;
  els.metrics.innerHTML = counts.map(({ plant, count }) => `
    <div class="metric"><strong>${count}</strong><span>${plant.role.replaceAll('-', ' ')}</span></div>
  `).join('');
  els.summary.innerHTML = `
    <strong>${plants.length} plant centers</strong><br>
    <span class="muted">${hydrangeaClumps} hydrangea clumps · boundary-safe circles · ${counts.map(value => `${value.count} ${value.plant.name}`).join(' · ')}</span>
  `;
}

['change', 'input'].forEach(eventName => {
  els.size.addEventListener(eventName, generate);
  els.shape.addEventListener(eventName, generate);
  els.seed.addEventListener(eventName, generate);
  els.grid.addEventListener(eventName, generate);
  els.centers.addEventListener(eventName, generate);
});

document.querySelector('#regenerate').addEventListener('click', generate);
document.querySelector('#next-seed').addEventListener('click', () => {
  els.seed.value = (Number(els.seed.value) % 100) + 1;
  generate();
});

generate();
