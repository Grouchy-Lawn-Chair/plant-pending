const svgNS = 'http://www.w3.org/2000/svg';
const LAB_VERSION = '7.0.0';
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

if (els.version) els.version.textContent = `Lab version ${LAB_VERSION} · gravity packing`;
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
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

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

  const displayMultiplierByPlant = { 1: 0.86, 2: 0.78, 3: 0.82, 4: 0.84 };
  const radiusFor = (plantId, itemScale) => plantById(plantId).radius * itemScale * displayMultiplierByPlant[plantId];

  const patioA = shapePoint(recipe.rules.patio.x, recipe.rules.patio.y, size, shape);
  const patioB = shapePoint(recipe.rules.patio.x + recipe.rules.patio.width, recipe.rules.patio.y + recipe.rules.patio.height, size, shape);
  const patio = {
    x: Math.min(patioA.x, patioB.x), y: Math.min(patioA.y, patioB.y),
    width: Math.abs(patioB.x - patioA.x), height: Math.abs(patioB.y - patioA.y),
  };

  function overlapsAny(body, ignore = []) {
    for (const other of [...plants, ...ignore]) {
      const r2 = other.r ?? radiusFor(other.plantId, other.scale);
      if (dist(body, other) < body.r + r2 - 0.002 * scale) return other;
    }
    return null;
  }

  function addFixed(plantId, x, y, group, type, axis) {
    const p = shapePoint(x, y, size, shape);
    const itemScale = scale * (1 + (rand() - 0.5) * 0.018);
    const r = radiusFor(plantId, itemScale);
    const item = { id: `${group}-${plants.length + 1}`, plantId, x: p.x, y: p.y, r, scale: itemScale, group };
    plants.push(item);
    anchors.push({ id: group, type, axis, x, y });
    modules.push({ id: group, type, axis, requested: 1, placed: 1 });
  }

  function makeContainer(type, axis, x, y) {
    const c = shapePoint(x, y, size, shape);
    if (axis === 'top') {
      const half = (type === 'hydrangea' ? 1.65 : 1.55) * scale;
      return { axis, minX: c.x - half, maxX: c.x + half, spawnMin: Math.max(0.3 * scale, c.y - 4.0 * scale), floor: patio.y };
    }
    const half = (type === 'hydrangea' ? 1.65 : 1.55) * scale;
    return { axis, minY: c.y - half, maxY: c.y + half, spawnMax: Math.min(size - 0.3 * scale, c.x + 4.0 * scale), floor: patio.x + patio.width };
  }

  function settleBodies(bodies, container) {
    const gravity = 0.0035 * scale;
    const damping = 0.985;
    for (let step = 0; step < 1600; step += 1) {
      let movement = 0;
      for (const b of bodies) {
        if (container.axis === 'top') b.vy += gravity;
        else b.vx -= gravity;
        b.vx *= damping;
        b.vy *= damping;
        b.x += b.vx;
        b.y += b.vy;

        if (container.axis === 'top') {
          if (b.x - b.r < container.minX) { b.x = container.minX + b.r; b.vx *= -0.18; }
          if (b.x + b.r > container.maxX) { b.x = container.maxX - b.r; b.vx *= -0.18; }
          if (b.y + b.r > container.floor) { b.y = container.floor - b.r; b.vy = 0; }
        } else {
          if (b.y - b.r < container.minY) { b.y = container.minY + b.r; b.vy *= -0.18; }
          if (b.y + b.r > container.maxY) { b.y = container.maxY - b.r; b.vy *= -0.18; }
          if (b.x - b.r < container.floor) { b.x = container.floor + b.r; b.vx = 0; }
        }
      }

      const all = [...plants, ...bodies];
      for (let i = 0; i < bodies.length; i += 1) {
        const a = bodies[i];
        for (const b of all) {
          if (a === b) continue;
          const br = b.r ?? radiusFor(b.plantId, b.scale);
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let d = Math.hypot(dx, dy);
          const minD = a.r + br;
          if (d < minD) {
            if (d < 0.0001) { dx = (rand() - 0.5) * 0.01; dy = (rand() - 0.5) * 0.01; d = Math.hypot(dx, dy); }
            const overlap = minD - d;
            const nx = dx / d;
            const ny = dy / d;
            const movableOther = bodies.includes(b);
            const share = movableOther ? 0.5 : 1;
            a.x += nx * overlap * share;
            a.y += ny * overlap * share;
            if (movableOther) { b.x -= nx * overlap * 0.5; b.y -= ny * overlap * 0.5; }
            a.vx *= 0.45; a.vy *= 0.45;
            movement += overlap;
          }
        }
      }
      if (step > 250 && movement < 0.00005 * scale && bodies.every(b => Math.hypot(b.vx, b.vy) < 0.00005 * scale)) break;
    }
  }

  function addGravityModule(type, id, x, y, axis, plantId, count) {
    const container = makeContainer(type, axis, x, y);
    const bodies = [];
    for (let i = 0; i < count; i += 1) {
      const itemScale = scale * (1 + (rand() - 0.5) * (plantId === 1 ? 0.025 : 0.018));
      const r = radiusFor(plantId, itemScale);
      let body;
      if (axis === 'top') {
        body = { x: clamp(shapePoint(x, y, size, shape).x + (rand() - 0.5) * 2.4 * scale, container.minX + r, container.maxX - r), y: container.spawnMin - i * (2 * r + 0.12 * scale), vx: (rand() - 0.5) * 0.018 * scale, vy: 0, r, itemScale };
      } else {
        body = { x: container.spawnMax + i * (2 * r + 0.12 * scale), y: clamp(shapePoint(x, y, size, shape).y + (rand() - 0.5) * 2.4 * scale, container.minY + r, container.maxY - r), vx: 0, vy: (rand() - 0.5) * 0.018 * scale, r, itemScale };
      }
      bodies.push(body);
    }

    settleBodies(bodies, container);
    let placed = 0;
    for (const b of bodies) {
      const conflict = overlapsAny(b, bodies.filter(x => x !== b));
      const inBounds = b.x - b.r >= 0 && b.x + b.r <= size && b.y - b.r >= 0 && b.y + b.r <= size;
      const patioClear = axis === 'top' ? b.y + b.r <= patio.y + 0.002 : b.x - b.r >= patio.x + patio.width - 0.002;
      const ok = !conflict && inBounds && patioClear;
      attempts.push({ group: id, plantId, mode: 'gravity-physics', x: b.x, y: b.y, radius: b.r, ok, reason: ok ? null : conflict ? 'unresolved-overlap' : 'boundary' });
      if (!ok) continue;
      plants.push({ id: `${id}-${plants.length + 1}`, plantId, x: b.x, y: b.y, r: b.r, scale: b.itemScale, group: id });
      placed += 1;
    }
    anchors.push({ id, type, axis, x, y, container, failed: placed < (type === 'hydrangea' ? 2 : 3) });
    modules.push({ id, type, axis, requested: count, placed });
  }

  const variants = [
    { roses:[[3.8,4.1],[8.9,5],[13.5,4],[15.5,8.6],[15.6,17.4]], topH:[[3,6.7],[6.7,6.8],[10.4,6.9]], rightH:[[14.1,11.8],[14,15],[14.1,19]], topT:[[2.6,8.45],[6,8.35],[9.5,8.45]], rightT:[[12.55,11.2],[12.55,15.1],[12.55,19.1]] },
    { roses:[[4.5,4.7],[9.5,4.1],[13.3,5.3],[15.7,9.6],[15.3,16.4]], topH:[[3.1,6.9],[6.9,6.5],[10.7,7]], rightH:[[14,11.5],[14.2,14.8],[14,18.5]], topT:[[2.5,8.45],[5.9,8.3],[9.4,8.45]], rightT:[[12.55,11],[12.55,14.9],[12.55,18.8]] },
    { roses:[[3.6,5.1],[8.1,4],[12.8,4.7],[15.8,7.5],[15.7,16]], topH:[[2.9,6.8],[6.5,6.9],[10.2,6.7]], rightH:[[14.1,11.6],[14,15.2],[14.2,18.9]], topT:[[2.4,8.45],[5.8,8.35],[9.2,8.4]], rightT:[[12.55,11.2],[12.55,15.3],[12.55,19]] },
    { roses:[[4.8,3.9],[9.6,5.5],[13.1,3.7],[15.1,8.8],[15.4,17.8]], topH:[[3.2,6.8],[6.8,6.6],[10.5,6.9]], rightH:[[14,11.7],[14.2,15.1],[14,18.8]], topT:[[2.6,8.4],[6.1,8.35],[9.5,8.4]], rightT:[[12.55,11.1],[12.55,15],[12.55,19]] },
  ];
  const variantIndex = (seed - 1) % variants.length;
  const c = variants[variantIndex];

  const hedgeShift = (rand() - 0.5) * 0.18;
  for (let i = 0; i < 5; i += 1) addFixed(4, 18.8, 3.0 + hedgeShift + i * 4.0, `hedge-${i + 1}`, 'hedge', 'right');
  c.roses.forEach(([x,y], i) => addFixed(3, x, y, `rose-${i + 1}`, 'rose', i < 3 ? 'top' : 'right'));

  const hCounts = [3,3,3,3,3,3];
  c.topH.forEach(([x,y], i) => addGravityModule('hydrangea', `hydrangea-top-${i + 1}`, x, y, 'top', 2, hCounts[i]));
  c.rightH.forEach(([x,y], i) => addGravityModule('hydrangea', `hydrangea-right-${i + 1}`, x, y, 'right', 2, hCounts[i + 3]));

  const tCounts = [7,7,7,7,8,7];
  c.topT.forEach(([x,y], i) => addGravityModule('thrift', `thrift-top-${i + 1}`, x, y, 'top', 1, tCounts[i]));
  c.rightT.forEach(([x,y], i) => addGravityModule('thrift', `thrift-right-${i + 1}`, x, y, 'right', 1, tCounts[i + 3]));

  const accepted = attempts.filter(a => a.ok).length;
  const rejected = attempts.length - accepted;
  const failedAnchors = anchors.filter(a => a.failed).length;
  lastRun = {
    recipeId: recipe.id, recipeName: recipe.name, recipeVersion: `gravity-packing-v${LAB_VERSION}`,
    generatedAt: new Date().toISOString(), settings: { size, shape, seed, scale, compositionVariant: variantIndex + 1 },
    rules: { generationMode: 'deterministic-2d-gravity-physics', displayMultiplierByPlant, physicalDiscsUseDisplayedRadius: true, gravitySteps: 1600 },
    modules, anchors, attempts, plants,
    summary: { accepted, rejected, failedAnchors, totalPlants: plants.length },
  };
  render(plants, size, shape, seed, patio, anchors, attempts, modules, variantIndex + 1);
}

function line(x1,y1,x2,y2,stroke,width,dash='') {
  const e = document.createElementNS(svgNS,'line');
  Object.entries({x1,x2,y1,y2,stroke,'stroke-width':width}).forEach(([k,v])=>e.setAttribute(k,v));
  if (dash) e.setAttribute('stroke-dasharray',dash);
  els.svg.append(e);
}

function render(plants, size, shape, seed, patio, anchors, attempts, modules, variant) {
  els.svg.innerHTML = '';
  els.svg.setAttribute('viewBox',`0 0 ${size} ${size}`);
  if (els.grid.checked) {
    for (let x=0;x<=size;x+=1) line(x,0,x,size,'#cfd4c7','.035');
    for (let y=0;y<=size;y+=1) line(0,y,size,y,'#cfd4c7','.035');
  }
  const rect = document.createElementNS(svgNS,'rect');
  Object.entries({x:patio.x,y:patio.y,width:patio.width,height:patio.height,fill:'#f2eee6',stroke:'#8f8a80','stroke-width':'.09'}).forEach(([k,v])=>rect.setAttribute(k,v));
  els.svg.append(rect);
  const fenceTop = shapePoint(recipe.rules.fenceX ?? 21,1.4,size,shape);
  const fenceBottom = shapePoint(recipe.rules.fenceX ?? 21,22.3,size,shape);
  line(fenceTop.x,fenceTop.y,fenceBottom.x,fenceBottom.y,'#27322a','.22','.5 .28');

  for (const item of plants) {
    const plant = recipe.plants.find(p=>p.id===item.plantId);
    const c = document.createElementNS(svgNS,'circle');
    Object.entries({cx:item.x,cy:item.y,r:item.r,fill:plant.color,'fill-opacity':item.plantId===4?'.72':'.84',stroke:'#fff','stroke-opacity':'.72','stroke-width':'.07'}).forEach(([k,v])=>c.setAttribute(k,v));
    els.svg.append(c);
    if (els.centers.checked) {
      const dot = document.createElementNS(svgNS,'circle');
      Object.entries({cx:item.x,cy:item.y,r:'.07',fill:'#111'}).forEach(([k,v])=>dot.setAttribute(k,v));
      els.svg.append(dot);
    }
  }

  if (els.debugOverlay.checked) {
    for (const a of anchors) {
      const p = shapePoint(a.x,a.y,size,shape);
      const dot = document.createElementNS(svgNS,'circle');
      Object.entries({cx:p.x,cy:p.y,r:'.14',fill:a.failed?'#d22':'#111',stroke:'#fff','stroke-width':'.04'}).forEach(([k,v])=>dot.setAttribute(k,v));
      els.svg.append(dot);
    }
  }

  const counts = recipe.plants.map(plant=>({plant,count:plants.filter(p=>p.plantId===plant.id).length}));
  const h = modules.filter(m=>m.type==='hydrangea'&&m.placed>=2).length;
  const t = modules.filter(m=>m.type==='thrift'&&m.placed>=3).length;
  const accepted = attempts.filter(a=>a.ok).length;
  const rejected = attempts.length-accepted;
  els.title.textContent = `${size} × ${size}, ${shape}, seed ${seed}, composition ${variant}`;
  els.seedValue.textContent = seed;
  els.metrics.innerHTML = counts.map(({plant,count})=>`<div class="metric"><strong>${count}</strong><span>${plant.role.replaceAll('-',' ')}</span></div>`).join('');
  els.summary.innerHTML = `<strong>${plants.length} plant centers</strong><br><span class="muted">Gravity-packed v${LAB_VERSION} · ${h}/6 hydrangea modules · ${t}/6 thrift modules</span>`;
  els.debugSummary.innerHTML = `<strong>${accepted} settled · ${rejected} unresolved</strong><br><span class="muted">Physical discs use the same radius as the visible circles · ${anchors.filter(a=>a.failed).length} failed modules</span>`;
}

['change','input'].forEach(eventName=>{
  [els.size,els.shape,els.seed,els.grid,els.centers,els.debugOverlay].forEach(el=>el.addEventListener(eventName,generate));
});
document.querySelector('#regenerate').addEventListener('click',generate);
document.querySelector('#next-seed').addEventListener('click',()=>{els.seed.value=(Number(els.seed.value)%100)+1;generate();});
els.downloadDebug.addEventListener('click',()=>{
  if (!lastRun) return;
  const blob = new Blob([JSON.stringify(lastRun,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href=url; link.download=`plant-pending-recipe-debug-seed-${lastRun.settings.seed}.json`; link.click();
  URL.revokeObjectURL(url);
});
generate();
