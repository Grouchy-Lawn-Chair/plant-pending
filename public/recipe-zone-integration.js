(() => {
  const CURRENT_PLAN_KEY = 'garden-planner-current';
  const TOAST_KEY = 'plant-pending-recipe-toast';

  const recipe = (id, source, name, plants) => ({ id, source, name, plants });
  const plant = (id, name, weight, layer, widthInches) => ({ id, name, weight, layer, widthInches });

  const recipes = [
    recipe('gardenia-provencal-courtyard', 'Gardenia', 'A Contemporary Provencal Courtyard', [
      plant(811, 'Deer Grass', 55, 'back', 48), plant(860, 'Fruity Germander', 45, 'front', 30),
    ]),
    recipe('gardenia-soft-autumn-colors', 'Gardenia', 'Soft Autumn Colors', [
      plant(506, "Sedum 'Autumn Fire'", 35, 'front', 24), plant(781, "Coast Rosemary 'Blue Gem'", 35, 'back', 48), plant(343, 'Silver Carpet', 30, 'front', 24),
    ]),
    recipe('gardenia-brilliant-summer-border', 'Gardenia', 'Brilliant Summer Border', [
      plant(729, "Bottlebrush 'Little John'", 30, 'back', 36), plant(285, 'Bright Lights Horizon Sunset African Daisy', 45, 'middle', 24), plant(792, "Cordyline 'Electric Pink'", 25, 'accent', 36),
    ]),
    recipe('gardenia-successful-marriage', 'Gardenia', 'A Successful Marriage', [
      plant(399, 'Northern Lights Tufted Hair Grass', 45, 'middle', 24), plant(860, 'Fruity Germander', 30, 'front', 30), plant(277, 'Blue Fescue', 25, 'front', 18),
    ]),
    recipe('gardenia-mediterranean-border', 'Gardenia', 'A Pretty Mediterranean Border Idea', [
      plant(860, 'Fruity Germander', 16, 'front', 30), plant(937, "Lily of the Nile 'Storm Cloud'", 14, 'back', 36), plant(277, 'Blue Fescue', 14, 'front', 18), plant(285, 'Bright Lights Horizon Sunset African Daisy', 14, 'front', 24), plant(729, "Bottlebrush 'Little John'", 14, 'accent', 36), plant(781, "Coast Rosemary 'Blue Gem'", 14, 'back', 48), plant(312, "Coreopsis 'Nana'", 14, 'middle', 24),
    ]),
    recipe('gardenia-backyard-retreat', 'Gardenia', 'Backyard Retreat with Achillea, Festuca and Grasses', [
      plant(574, "Yarrow 'Little Moonshine'", 35, 'middle', 24), plant(277, 'Blue Fescue', 30, 'front', 18), plant(399, 'Northern Lights Tufted Hair Grass', 35, 'back', 24),
    ]),
    recipe('gardenia-desert-pollinator', 'Gardenia', 'Native Desert Pollinator Garden', [
      plant(444, "Lomandra 'Lime Tuff'", 20, 'accent', 36), plant(729, "Bottlebrush 'Little John'", 25, 'back', 36), plant(399, 'Northern Lights Tufted Hair Grass', 30, 'middle', 24), plant(312, "Coreopsis 'Nana'", 25, 'front', 24),
    ]),
    recipe('gardenia-butterfly-friendly', 'Gardenia', 'Butterfly-Friendly Garden Design', [
      plant(312, "Coreopsis 'Nana'", 25, 'front', 24), plant(781, "Coast Rosemary 'Blue Gem'", 20, 'back', 48), plant(370, "Feather Reed Grass 'Karl Foerster'", 15, 'back', 30), plant(506, "Sedum 'Autumn Fire'", 20, 'middle', 24), plant(277, 'Blue Fescue', 20, 'front', 18),
    ]),
    recipe('gardenia-grasses-sage', 'Gardenia', 'A Fabulous Planting Idea with Grasses and Sage', [
      plant(399, 'Northern Lights Tufted Hair Grass', 60, 'middle', 24), plant(781, "Coast Rosemary 'Blue Gem'", 40, 'back', 48),
    ]),
    recipe('gardenia-salvia-caradonna', 'Gardenia', "Salvia 'Caradonna' Plant Profile", [
      plant(781, "Coast Rosemary 'Blue Gem'", 100, 'middle', 48),
    ]),
    recipe('gardenia-summer-fall-border', 'Gardenia', 'Summer-to-Fall Perennial Border', [
      plant(729, "Bottlebrush 'Little John'", 20, 'accent', 36), plant(781, "Coast Rosemary 'Blue Gem'", 20, 'back', 48), plant(285, 'Bright Lights Horizon Sunset African Daisy', 20, 'middle', 24), plant(277, 'Blue Fescue', 20, 'front', 18), plant(374, 'Firehouse Verbena', 20, 'front', 30),
    ]),
    recipe('elegant-privacy-hedge-border', 'Monrovia', 'Elegant Privacy Hedge Border', [
      plant(475, 'Rose Sea Thrift', 30, 'front', 12), plant(683, "Hydrangea 'Little Lime Punch'", 30, 'middle', 48), plant(912, 'Eau de Parfum Blush Rose', 25, 'accent', 48), plant(657, "Emerald Green Arborvitae 'Smaragd'", 15, 'back', 48),
    ]),
    recipe('modern-meadow', 'Monrovia', 'Modern Meadow', [
      plant(399, 'Northern Lights Tufted Hair Grass', 28, 'back', 24), plant(311, 'Butterfly Weed', 22, 'middle', 24), plant(781, "Coast Rosemary 'Blue Gem'", 20, 'middle', 48), plant(312, "Coreopsis 'Nana'", 30, 'front', 24),
    ]),
    recipe('hummingbird-oasis', 'Monrovia', 'Hummingbird Oasis', [
      plant(749, "Rose of Sharon 'Blue Chiffon'", 22, 'back', 48), plant(412, 'Lantana', 17, 'middle', 36), plant(374, 'Firehouse Verbena', 31, 'front', 30), plant(781, "Coast Rosemary 'Blue Gem'", 30, 'middle', 48),
    ]),
    recipe('fire-pit', 'Monrovia', 'Fire Pit', [
      plant(721, 'Dwarf Korean Lilac', 12, 'accent', 48), plant(312, "Coreopsis 'Nana'", 28, 'middle', 24), plant(662, "Dwarf Yaupon Holly 'Schillings'", 14, 'back', 36), plant(506, "Sedum 'Autumn Fire'", 12, 'front', 24), plant(860, 'Fruity Germander', 24, 'middle', 30), plant(277, 'Blue Fescue', 10, 'front', 18),
    ]),
    recipe('fenceline-flow', 'Monrovia', 'Fenceline Flow', [
      plant(525, 'Hosta', 28, 'middle', 36), plant(37, 'Japanese Maple', 20, 'accent', 72), plant(384, 'Japanese Sedge', 27, 'front', 24), plant(371, 'Coral Bells', 25, 'front', 21),
    ]),
    recipe('delightful-drought-tolerant', 'Monrovia', 'Delightful and Drought-Tolerant', [
      plant(94, 'Chaste Tree', 18, 'back', 60), plant(399, 'Northern Lights Tufted Hair Grass', 30, 'middle', 24), plant(312, "Coreopsis 'Nana'", 24, 'middle', 24), plant(860, 'Fruity Germander', 28, 'front', 30),
    ]),
  ];

  const byText = (root, selector, text) => [...root.querySelectorAll(selector)].find(el => el.textContent.trim() === text);
  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

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

  function inside(point, polygon) {
    let hit = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || 1e-9) + a.x) hit = !hit;
    }
    return hit;
  }

  function segmentDistance(point, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const length = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length));
    return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
  }

  function edgeDistance(point, zone, indexes) {
    if (!indexes || !indexes.length) return Infinity;
    return Math.min(...indexes.map(index => segmentDistance(point, zone.points[index], zone.points[(index + 1) % zone.points.length])));
  }

  function polygonEdgeDistance(point, polygon) {
    let distance = Infinity;
    for (let i = 0; i < polygon.length; i++) distance = Math.min(distance, segmentDistance(point, polygon[i], polygon[(i + 1) % polygon.length]));
    return distance;
  }

  function polygonArea(points) {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      area += a.x * b.y - b.x * a.y;
    }
    return Math.abs(area) / 2;
  }

  function layerScore(point, layer, zone, bounds) {
    const front = edgeDistance(point, zone, zone.edgeRoles?.front || []);
    const back = edgeDistance(point, zone, zone.edgeRoles?.back || []);
    const height = Math.max(1, bounds.maxY - bounds.minY);
    if (layer === 'front') return Number.isFinite(front) ? front : bounds.maxY - point.y;
    if (layer === 'back') return Number.isFinite(back) ? back : point.y - bounds.minY;
    if (layer === 'middle') {
      if (Number.isFinite(front) && Number.isFinite(back)) return Math.abs(front - back);
      return Math.abs(point.y - (bounds.minY + height / 2));
    }
    return 0;
  }

  function generateRecipe(plan, zone, selectedRecipe) {
    const pixelsPerFoot = plan.scalePixelsPerFoot || 20;
    const seed = zone.plantingSeed || Math.floor(Math.random() * 99999);
    const random = rng(seed + selectedRecipe.id.length * 97);
    const bounds = {
      minX: Math.min(...zone.points.map(p => p.x)), maxX: Math.max(...zone.points.map(p => p.x)),
      minY: Math.min(...zone.points.map(p => p.y)), maxY: Math.max(...zone.points.map(p => p.y)),
    };
    const weightedAverageWidth = selectedRecipe.plants.reduce((sum, item) => sum + item.widthInches * item.weight, 0) / selectedRecipe.plants.reduce((sum, item) => sum + item.weight, 0);
    const averageDiameter = Math.max(14, (weightedAverageWidth / 12) * pixelsPerFoot);
    const density = Math.max(10, Math.min(100, zone.density || 50)) / 100;
    const target = Math.max(selectedRecipe.plants.length, Math.min(140, Math.round((polygonArea(zone.points) / Math.max(180, averageDiameter * averageDiameter * 0.58)) * (0.45 + density * 1.15))));
    const counts = selectedRecipe.plants.map(item => Math.max(1, Math.round(target * item.weight / 100)));
    let excess = counts.reduce((a, b) => a + b, 0) - target;
    while (excess > 0) {
      const index = counts.findIndex(count => count > 1);
      if (index < 0) break;
      counts[index] -= 1;
      excess -= 1;
    }

    const exclusions = (plan.zones || []).filter(item => item.zoneType === 'exclusion' && item.points?.length >= 3);
    const generated = [];
    const orderedPlants = selectedRecipe.plants.flatMap((item, index) => Array.from({ length: counts[index] }, () => item));
    orderedPlants.sort((a, b) => ({ back: 0, accent: 1, middle: 2, front: 3 }[a.layer] - ({ back: 0, accent: 1, middle: 2, front: 3 }[b.layer])));

    for (const item of orderedPlants) {
      const diameter = Math.max(12, (item.widthInches / 12) * pixelsPerFoot);
      const radius = diameter / 2;
      let best = null;
      for (let attempt = 0; attempt < 500; attempt++) {
        const point = { x: bounds.minX + random() * (bounds.maxX - bounds.minX), y: bounds.minY + random() * (bounds.maxY - bounds.minY) };
        if (!inside(point, zone.points) || polygonEdgeDistance(point, zone.points) < radius * 0.38) continue;
        if (exclusions.some(exclusion => inside(point, exclusion.points))) continue;
        const nearest = generated.reduce((min, placed) => Math.min(min, Math.hypot(point.x - placed.x, point.y - placed.y) - (placed._radius + radius)), Infinity);
        const spacingPenalty = nearest < -Math.min(radius, 16) ? 10000 : nearest < 0 ? Math.abs(nearest) * 8 : 0;
        const score = layerScore(point, item.layer, zone, bounds) + spacingPenalty + random() * 8;
        if (!best || score < best.score) best = { point, score };
        if (score < 8) break;
      }
      if (!best) continue;
      generated.push({
        instanceId: uid(), plantId: item.id, x: best.point.x, y: best.point.y, zone: zone.id,
        notes: `Recipe: ${selectedRecipe.name}`, displayMode: 'symbol', customColor: null, itemType: 'plant',
        rotationDeg: Math.round(random() * 359), _radius: radius,
      });
    }

    return generated.map(({ _radius, ...placed }) => placed);
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;right:24px;bottom:24px;z-index:9999;max-width:420px;padding:14px 16px;border:1px solid #34d399;background:#052e2b;color:#d1fae5;border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.35);font:600 13px/1.4 Inter,Arial,sans-serif';
    toast.textContent = message;
    document.body.append(toast);
    setTimeout(() => toast.remove(), 6500);
  }

  function injectPanel() {
    const modals = [...document.querySelectorAll('div.fixed')];
    const modal = modals.find(element => element.textContent.includes('Zone settings') && element.textContent.includes('Generate planting layout'));
    if (!modal || modal.querySelector('#pp-recipe-zone-panel')) return;
    const generateButton = byText(modal, 'button', 'Generate planting layout');
    if (!generateButton) return;
    const content = generateButton.closest('.space-y-4');
    if (!content) return;
    const zoneName = modal.querySelector('h3')?.textContent.trim();
    if (!zoneName) return;

    const panel = document.createElement('section');
    panel.id = 'pp-recipe-zone-panel';
    panel.style.cssText = 'border:1px solid rgba(167,139,250,.48);background:rgba(76,29,149,.18);border-radius:16px;padding:14px;color:#f8fafc';
    panel.innerHTML = `
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.17em;color:#c4b5fd;font-weight:800">Plant recipe</div>
      <div style="margin-top:4px;font-size:14px;font-weight:800">Generate a reviewed Gardenia or Monrovia layout</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
        <label style="font-size:11px;color:#cbd5e1">Source<select id="pp-recipe-source" style="display:block;width:100%;margin-top:5px;border:1px solid #475569;background:#0f172a;color:white;border-radius:10px;padding:9px"><option value="all">All</option><option value="Gardenia">Gardenia</option><option value="Monrovia">Monrovia</option></select></label>
        <label style="font-size:11px;color:#cbd5e1">Recipe<select id="pp-recipe-select" style="display:block;width:100%;margin-top:5px;border:1px solid #475569;background:#0f172a;color:white;border-radius:10px;padding:9px"></select></label>
      </div>
      <div id="pp-recipe-plants" style="margin-top:10px;font-size:11px;line-height:1.5;color:#cbd5e1"></div>
      <button id="pp-generate-recipe" type="button" style="width:100%;margin-top:12px;border:0;background:#7c3aed;color:white;border-radius:12px;padding:11px;font-weight:800;cursor:pointer">Generate this recipe</button>
      <div style="margin-top:8px;font-size:10px;color:#a5b4fc">Uses the reviewed Green Acres substitutions, recipe percentages, the zone seed, and marked front/back edges. Generated plants remain fully editable.</div>`;
    content.prepend(panel);

    const sourceSelect = panel.querySelector('#pp-recipe-source');
    const recipeSelect = panel.querySelector('#pp-recipe-select');
    const plants = panel.querySelector('#pp-recipe-plants');
    const button = panel.querySelector('#pp-generate-recipe');

    const rebuild = () => {
      const options = sourceSelect.value === 'all' ? recipes : recipes.filter(item => item.source === sourceSelect.value);
      recipeSelect.innerHTML = options.map(item => `<option value="${item.id}">${item.name}</option>`).join('');
      renderPlants();
    };
    const renderPlants = () => {
      const selected = recipes.find(item => item.id === recipeSelect.value);
      if (!selected) return;
      plants.innerHTML = `<strong style="color:white">${selected.source}</strong> · ${selected.plants.map(item => `${item.name} ${item.weight}%`).join(' · ')}`;
    };
    sourceSelect.addEventListener('change', rebuild);
    recipeSelect.addEventListener('change', renderPlants);
    button.addEventListener('click', () => {
      const selected = recipes.find(item => item.id === recipeSelect.value);
      const raw = localStorage.getItem(CURRENT_PLAN_KEY);
      if (!selected || !raw) return showToast('No current plan was found. Make one change to the plan, then try again.');
      let plan;
      try { plan = JSON.parse(raw); } catch { return showToast('The current plan could not be read.'); }
      const zone = (plan.zones || []).find(item => item.name === zoneName);
      if (!zone) return showToast(`Could not find the zone named ${zoneName}.`);
      const uniqueIds = [...new Set(selected.plants.map(item => item.id))];
      const groupId = `recipe-${selected.id}`;
      const group = { id: groupId, name: `Recipe · ${selected.name}`, notes: `${selected.source} reviewed recipe`, plantIds: uniqueIds };
      plan.plantingGroups = [...(plan.plantingGroups || []).filter(item => item.id !== groupId), group];
      zone.plantingGroupId = groupId;
      zone.plantingGroupName = group.name;
      zone.plantingRecipeId = selected.id;
      zone.plantingRecipeName = selected.name;
      zone.plantingRecipeSource = selected.source;
      zone.layoutMode = 'fill';
      zone.plantingType = 'flowerBed';
      zone.plantVariety = 'low';
      zone.plantingSeed = zone.plantingSeed || Math.floor(Math.random() * 99999);
      const generated = generateRecipe(plan, zone, selected);
      plan.placedPlants = [...(plan.placedPlants || []).filter(item => item.zone !== zone.id || item.itemType === 'rock'), ...generated];
      localStorage.setItem(CURRENT_PLAN_KEY, JSON.stringify(plan));
      sessionStorage.setItem(TOAST_KEY, `${selected.name} generated in ${zone.name}: ${generated.length} editable plants.`);
      location.reload();
    });
    rebuild();
  }

  const toast = sessionStorage.getItem(TOAST_KEY);
  if (toast) {
    sessionStorage.removeItem(TOAST_KEY);
    setTimeout(() => showToast(toast), 1000);
  }

  new MutationObserver(injectPanel).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(injectPanel, 700);
})();
