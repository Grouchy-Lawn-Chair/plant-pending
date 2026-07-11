export interface CalloutSourceItem {
  instanceId: string;
  plantId: number;
  x: number;
  y: number;
  radius: number;
  labelBase: string;
}

export interface GroupedCallout {
  key: string;
  plantId: number;
  label: string;
  count: number;
  anchorX: number;
  anchorY: number;
  labelX: number;
  labelY: number;
  labelWidth: number;
  labelHeight: number;
  lineToX: number;
  lineToY: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  memberIds: string[];
}

type Rect = { x: number; y: number; width: number; height: number };

type Circle = { x: number; y: number; radius: number; instanceId: string; plantId: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function rectsOverlap(a: Rect, b: Rect) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function circleOverlapsRect(circle: Circle, rect: Rect, padding = 0) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.height);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  const radius = circle.radius + padding;
  return dx * dx + dy * dy <= radius * radius;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function nearestPointOnRect(point: { x: number; y: number }, rect: Rect) {
  const closest = {
    x: clamp(point.x, rect.x, rect.x + rect.width),
    y: clamp(point.y, rect.y, rect.y + rect.height),
  };

  // If the anchor is inside the label box, snap to the nearest edge so the
  // leader still connects to the outside of the callout.
  if (point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height) {
    const distances = [
      { x: rect.x, y: point.y, d: Math.abs(point.x - rect.x) },
      { x: rect.x + rect.width, y: point.y, d: Math.abs(rect.x + rect.width - point.x) },
      { x: point.x, y: rect.y, d: Math.abs(point.y - rect.y) },
      { x: point.x, y: rect.y + rect.height, d: Math.abs(rect.y + rect.height - point.y) },
    ];
    distances.sort((a, b) => a.d - b.d);
    return { x: distances[0].x, y: distances[0].y };
  }

  return closest;
}

function estimateLabelWidth(label: string) {
  return Math.max(104, Math.min(250, 22 + label.length * 6.9));
}

function clusterThreshold(current: CalloutSourceItem, other: CalloutSourceItem) {
  const diameterBased = (current.radius + other.radius) * 2.35 + 18;
  const visualDriftMinimum = Math.max(current.radius, other.radius) < 24 ? 86 : 112;
  return Math.max(diameterBased, visualDriftMinimum);
}

function clusterItems(items: CalloutSourceItem[]) {
  const visited = new Set<string>();
  const clusters: CalloutSourceItem[][] = [];

  for (const item of items) {
    if (visited.has(item.instanceId)) continue;
    visited.add(item.instanceId);
    const queue = [item];
    const cluster: CalloutSourceItem[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      cluster.push(current);
      for (const other of items) {
        if (visited.has(other.instanceId)) continue;
        if (distance(current, other) <= clusterThreshold(current, other)) {
          visited.add(other.instanceId);
          queue.push(other);
        }
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

function labelCandidates(
  anchor: { x: number; y: number },
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  labelWidth: number,
  labelHeight: number,
  canvasWidth: number,
  canvasHeight: number,
) {
  const boundWidth = Math.max(1, bounds.maxX - bounds.minX);
  const boundHeight = Math.max(1, bounds.maxY - bounds.minY);
  const groupRadius = Math.sqrt(boundWidth * boundWidth + boundHeight * boundHeight) / 2;
  const labelRadius = Math.sqrt(labelWidth * labelWidth + labelHeight * labelHeight) / 2;
  const baseDistance = groupRadius + labelRadius + 28;
  const angles = [-60, -30, 0, 30, 60, -90, 90, -120, 120, -150, 150, 180, -75, 75, -15, 15, -135, 135].map(deg => (deg * Math.PI) / 180);
  const distances = [baseDistance, baseDistance + 34, baseDistance + 70, baseDistance + 112];
  const margin = 10;
  const candidates: Rect[] = [];

  for (const d of distances) {
    for (const angle of angles) {
      const centerX = anchor.x + Math.cos(angle) * d;
      const centerY = anchor.y + Math.sin(angle) * d;
      candidates.push({
        x: clamp(centerX - labelWidth / 2, margin, Math.max(margin, canvasWidth - labelWidth - margin)),
        y: clamp(centerY - labelHeight / 2, margin, Math.max(margin, canvasHeight - labelHeight - margin)),
        width: labelWidth,
        height: labelHeight,
      });
    }
  }

  // Include some direct edge candidates so labels stay neat when there is easy space.
  const gap = 28;
  candidates.push(
    { x: clamp(bounds.maxX + gap, margin, Math.max(margin, canvasWidth - labelWidth - margin)), y: clamp(anchor.y - labelHeight / 2, margin, Math.max(margin, canvasHeight - labelHeight - margin)), width: labelWidth, height: labelHeight },
    { x: clamp(bounds.minX - labelWidth - gap, margin, Math.max(margin, canvasWidth - labelWidth - margin)), y: clamp(anchor.y - labelHeight / 2, margin, Math.max(margin, canvasHeight - labelHeight - margin)), width: labelWidth, height: labelHeight },
    { x: clamp(anchor.x - labelWidth / 2, margin, Math.max(margin, canvasWidth - labelWidth - margin)), y: clamp(bounds.minY - labelHeight - gap, margin, Math.max(margin, canvasHeight - labelHeight - margin)), width: labelWidth, height: labelHeight },
    { x: clamp(anchor.x - labelWidth / 2, margin, Math.max(margin, canvasWidth - labelWidth - margin)), y: clamp(bounds.maxY + gap, margin, Math.max(margin, canvasHeight - labelHeight - margin)), width: labelWidth, height: labelHeight },
  );

  // De-dupe clamped candidates.
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${Math.round(candidate.x)}-${Math.round(candidate.y)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function boundsOverlapRect(bounds: { minX: number; minY: number; maxX: number; maxY: number }, rect: Rect, padding = 0) {
  return rectsOverlap(
    { x: bounds.minX - padding, y: bounds.minY - padding, width: bounds.maxX - bounds.minX + padding * 2, height: bounds.maxY - bounds.minY + padding * 2 },
    rect,
  );
}

export function buildGroupedCallouts(
  items: CalloutSourceItem[],
  canvasWidth: number,
  canvasHeight: number,
): GroupedCallout[] {
  const plantCircles: Circle[] = items.map(item => ({
    x: item.x,
    y: item.y,
    radius: Math.max(item.radius, 8),
    instanceId: item.instanceId,
    plantId: item.plantId,
  }));

  const byPlant = new Map<number, CalloutSourceItem[]>();
  items.forEach((item) => {
    if (!byPlant.has(item.plantId)) byPlant.set(item.plantId, []);
    byPlant.get(item.plantId)!.push(item);
  });

  const rawGroups: Omit<GroupedCallout, 'labelX' | 'labelY' | 'lineToX' | 'lineToY'>[] = [];

  for (const [plantId, plantItems] of byPlant) {
    const clusters = clusterItems(plantItems);
    clusters.forEach((cluster, idx) => {
      const count = cluster.length;
      const anchorX = cluster.reduce((sum, item) => sum + item.x, 0) / count;
      const anchorY = cluster.reduce((sum, item) => sum + item.y, 0) / count;
      const minX = Math.min(...cluster.map(item => item.x - item.radius));
      const minY = Math.min(...cluster.map(item => item.y - item.radius));
      const maxX = Math.max(...cluster.map(item => item.x + item.radius));
      const maxY = Math.max(...cluster.map(item => item.y + item.radius));
      const labelBase = cluster[0].labelBase;
      const label = count > 1 ? `${labelBase} (${count})` : labelBase;
      rawGroups.push({
        key: `${plantId}-${idx}`,
        plantId,
        label,
        count,
        anchorX,
        anchorY,
        labelWidth: estimateLabelWidth(label),
        labelHeight: 23,
        bounds: { minX, minY, maxX, maxY },
        memberIds: cluster.map(item => item.instanceId),
      });
    });
  }

  rawGroups.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    const aArea = (a.bounds.maxX - a.bounds.minX) * (a.bounds.maxY - a.bounds.minY);
    const bArea = (b.bounds.maxX - b.bounds.minX) * (b.bounds.maxY - b.bounds.minY);
    return bArea - aArea;
  });

  const placedRects: Rect[] = [];
  const groups: GroupedCallout[] = [];

  rawGroups.forEach((group, index) => {
    const { bounds, labelWidth, labelHeight, anchorX, anchorY } = group;
    const candidates = labelCandidates({ x: anchorX, y: anchorY }, bounds, labelWidth, labelHeight, canvasWidth, canvasHeight);

    let best = { rect: candidates[0], score: Number.POSITIVE_INFINITY };

    candidates.forEach((rect, candidateIndex) => {
      let score = 0;
      for (const placedRect of placedRects) {
        if (rectsOverlap(rect, placedRect)) score += 25000;
      }

      for (const circle of plantCircles) {
        if (circleOverlapsRect(circle, rect, 8)) score += 18000;
        else if (circleOverlapsRect(circle, rect, 24)) score += 2500;
      }

      if (boundsOverlapRect(bounds, rect, 10)) score += 26000;
      if (boundsOverlapRect(bounds, rect, 28)) score += 5500;

      const linePoint = nearestPointOnRect({ x: anchorX, y: anchorY }, rect);
      const lineDistance = distance({ x: anchorX, y: anchorY }, linePoint);
      const centerDistance = distance({ x: anchorX, y: anchorY }, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });

      score += lineDistance * 0.8;
      score += centerDistance * 0.12;
      score += candidateIndex * 1.5;
      score += index * 0.5;

      if (score < best.score) best = { rect, score };
    });

    const rect = best.rect;
    placedRects.push(rect);
    const linePoint = nearestPointOnRect({ x: anchorX, y: anchorY }, rect);

    groups.push({
      ...group,
      labelX: rect.x,
      labelY: rect.y,
      lineToX: linePoint.x,
      lineToY: linePoint.y,
    });
  });

  return groups;
}
