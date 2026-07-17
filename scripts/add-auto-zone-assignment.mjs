import fs from 'node:fs';

const path = 'src/App.tsx';
let source = fs.readFileSync(path, 'utf8');

if (!source.includes('function getContainingZoneId(')) {
  const anchor = /function polygonArea\(points: Point\[\]\): number \{[\s\S]*?\r?\n\}/;
  const match = source.match(anchor);
  if (!match || match.index === undefined) throw new Error('polygonArea helper not found.');

  const helper = `

function getContainingZoneId(x: number, y: number, zones: GardenZone[]): string {
  const point = { x, y };
  const containingZones = zones
    .filter(zone => zone.zoneType !== 'exclusion' && zone.points.length >= 3 && pointInPolygon(point, zone.points))
    .sort((a, b) => polygonArea(a.points) - polygonArea(b.points));

  return containingZones[0]?.id || '';
}`;

  const end = match.index + match[0].length;
  source = source.slice(0, end) + helper + source.slice(end);
}

source = source.replace(
  /const plantCountBefore = placedPlants\.filter\(item => \(item\.itemType \|\| 'plant'\) === 'plant'\)\.length;\r?\n\s*setPlacedPlants\(prev => \{/,
  match => `${match.replace(/\r?\n\s*setPlacedPlants\(prev => \{$/, '')}\n    const assignedZoneId = getContainingZoneId(x, y, zones);\n    setPlacedPlants(prev => {`,
);

source = source.replace(
  /zone: '',\r?\n\s*notes: '',\r?\n\s*displayMode: plant \? globalDisplayMode : 'color',/,
  `zone: assignedZoneId,\n        notes: '',\n        displayMode: plant ? globalDisplayMode : 'color',`,
);

source = source.replace(
  /\}, \[plants, placedPlants, getPlantPlacementRotation, addTestLog, awardScore\]\);/,
  `}, [plants, placedPlants, zones, getPlantPlacementRotation, addTestLog, awardScore]);`,
);

const oldMove = /const handleMovePlacedPlant = useCallback\(\(instanceId: string, x: number, y: number\) => \{\r?\n\s*const before = placedPlants\.find\(item => item\.instanceId === instanceId\);\r?\n\s*setPlacedPlants\(prev =>\r?\n\s*prev\.map\(p => \(p\.instanceId === instanceId \? \{ \.\.\.p, x, y \} : p\)\)\r?\n\s*\);/;

if (oldMove.test(source)) {
  source = source.replace(
    oldMove,
    `const handleMovePlacedPlant = useCallback((instanceId: string, x: number, y: number) => {
    const before = placedPlants.find(item => item.instanceId === instanceId);
    const assignedZoneId = getContainingZoneId(x, y, zones);
    setPlacedPlants(prev =>
      prev.map(p => (p.instanceId === instanceId ? { ...p, x, y, zone: assignedZoneId } : p))
    );`,
  );
} else if (!source.includes('zone: assignedZoneId } : p')) {
  throw new Error('Placed-plant move handler not found.');
}

source = source.replace(
  /\}, \[placedPlants, addTestLog, awardScore\]\);/,
  `}, [placedPlants, zones, addTestLog, awardScore]);`,
);

fs.writeFileSync(path, source);
console.log('Plants now automatically join the zone containing their center when placed or moved.');
