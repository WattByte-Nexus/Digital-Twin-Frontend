#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const [, , sourceDirectory, requestedOutputPath] = process.argv;

if (!sourceDirectory) {
  throw new Error(
    "Usage: node scripts/generate-realistic-power-network.mjs <source-directory> [output.geojson]",
  );
}

const outputPath =
  requestedOutputPath ??
  "apps/geolibre-desktop/public/plugins/distribution-network/assets/boulder_13_8kv_feeder_large.geojson";

const ORIGIN = { longitude: -105.27, latitude: 40.0275 };
const EARTH_RADIUS_M = 6_371_008.8;
const ROAD_OFFSET_M = 6.5;
const NOMINAL_POLE_SPACING_M = 50;
const CORRIDOR_TREE_DISTANCE_M = 24;
const CONDUCTOR = {
  name: "4/0 AWG 6/1 ACSR Penguin",
  massPerMeter: 0.433,
  diameterM: 0.01431,
  cableAreaM2: 0.000125,
  elasticModulusPa: 69_000_000_000,
  horizontalTensionN: 7_500,
  dragCoefficient: 1.0,
};

const WAYPOINTS = [
  [-105.2524, 40.0432],
  [-105.2867, 40.0421],
  [-105.2865, 40.0261],
  [-105.278, 40.0121],
  [-105.2522, 40.0125],
  [-105.2532, 40.0276],
  [-105.2695, 40.0342],
];

function round(value, digits = 6) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function toXy([longitude, latitude]) {
  const originLatitudeRadians = (ORIGIN.latitude * Math.PI) / 180;
  return [
    ((longitude - ORIGIN.longitude) * Math.PI * EARTH_RADIUS_M * Math.cos(originLatitudeRadians)) /
      180,
    ((latitude - ORIGIN.latitude) * Math.PI * EARTH_RADIUS_M) / 180,
  ];
}

function toLongitudeLatitude([x, y]) {
  const originLatitudeRadians = (ORIGIN.latitude * Math.PI) / 180;
  return [
    ORIGIN.longitude +
      (x * 180) / (Math.PI * EARTH_RADIUS_M * Math.cos(originLatitudeRadians)),
    ORIGIN.latitude + (y * 180) / (Math.PI * EARTH_RADIUS_M),
  ];
}

function distance([ax, ay], [bx, by]) {
  return Math.hypot(bx - ax, by - ay);
}

function normalize([x, y]) {
  const magnitude = Math.hypot(x, y);
  return magnitude > 0 ? [x / magnitude, y / magnitude] : [0, 0];
}

function pointToSegmentDistance(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const denominator = dx * dx + dy * dy;
  if (denominator === 0) return distance(point, start);
  const t = clamp(
    ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / denominator,
    0,
    1,
  );
  return Math.hypot(point[0] - (start[0] + t * dx), point[1] - (start[1] + t * dy));
}

function nearestOnPolyline(point, coordinates) {
  let nearestDistance = Number.POSITIVE_INFINITY;
  let segmentIndex = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const candidateDistance = pointToSegmentDistance(
      point,
      coordinates[index - 1],
      coordinates[index],
    );
    if (candidateDistance < nearestDistance) {
      nearestDistance = candidateDistance;
      segmentIndex = index - 1;
    }
  }
  return { distance: nearestDistance, segmentIndex };
}

function polylineLength(coordinates) {
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    total += distance(coordinates[index - 1], coordinates[index]);
  }
  return total;
}

function deduplicateConsecutive(coordinates) {
  return coordinates.filter(
    (coordinate, index) => index === 0 || distance(coordinate, coordinates[index - 1]) > 0.05,
  );
}

function offsetPolyline(coordinates, offsetMeters) {
  return coordinates.map((coordinate, index) => {
    const previous = coordinates[Math.max(0, index - 1)];
    const next = coordinates[Math.min(coordinates.length - 1, index + 1)];
    const incoming = normalize([coordinate[0] - previous[0], coordinate[1] - previous[1]]);
    const outgoing = normalize([next[0] - coordinate[0], next[1] - coordinate[1]]);
    const first = index === 0 ? outgoing : incoming;
    const second = index === coordinates.length - 1 ? incoming : outgoing;
    const firstNormal = [-first[1], first[0]];
    const secondNormal = [-second[1], second[0]];
    const miter = normalize([firstNormal[0] + secondNormal[0], firstNormal[1] + secondNormal[1]]);
    const denominator = miter[0] * secondNormal[0] + miter[1] * secondNormal[1];
    const scale =
      Math.abs(denominator) > 0.25
        ? clamp(offsetMeters / denominator, -Math.abs(offsetMeters) * 2.5, Math.abs(offsetMeters) * 2.5)
        : offsetMeters;
    return [coordinate[0] + miter[0] * scale, coordinate[1] + miter[1] * scale];
  });
}

function resamplePolyline(coordinates, nominalSpacingMeters) {
  const cumulative = [0];
  for (let index = 1; index < coordinates.length; index += 1) {
    cumulative.push(cumulative.at(-1) + distance(coordinates[index - 1], coordinates[index]));
  }
  const totalLength = cumulative.at(-1);
  const breakpoints = [0];
  for (let index = 1; index < coordinates.length - 1; index += 1) {
    const incoming = normalize([
      coordinates[index][0] - coordinates[index - 1][0],
      coordinates[index][1] - coordinates[index - 1][1],
    ]);
    const outgoing = normalize([
      coordinates[index + 1][0] - coordinates[index][0],
      coordinates[index + 1][1] - coordinates[index][1],
    ]);
    const bendDegrees =
      (Math.acos(clamp(incoming[0] * outgoing[0] + incoming[1] * outgoing[1], -1, 1)) *
        180) /
      Math.PI;
    if (
      bendDegrees >= 18 &&
      cumulative[index] - breakpoints.at(-1) >= 24 &&
      totalLength - cumulative[index] >= 24
    ) {
      breakpoints.push(cumulative[index]);
    }
  }
  if (totalLength - breakpoints.at(-1) < 24 && breakpoints.length > 1) breakpoints.pop();
  breakpoints.push(totalLength);

  const targets = [0];
  for (let index = 1; index < breakpoints.length; index += 1) {
    const start = breakpoints[index - 1];
    const sectionLength = breakpoints[index] - start;
    let sectionSpanCount = Math.max(1, Math.round(sectionLength / nominalSpacingMeters));
    while (sectionLength / sectionSpanCount > 58) sectionSpanCount += 1;
    while (sectionSpanCount > 1 && sectionLength / sectionSpanCount < 25) sectionSpanCount -= 1;
    for (let spanIndex = 1; spanIndex <= sectionSpanCount; spanIndex += 1) {
      targets.push(start + (sectionLength * spanIndex) / sectionSpanCount);
    }
  }

  let sourceIndex = 1;
  return targets.map((targetDistance) => {
    while (sourceIndex < cumulative.length - 1 && cumulative[sourceIndex] < targetDistance) {
      sourceIndex += 1;
    }
    const startDistance = cumulative[sourceIndex - 1];
    const endDistance = cumulative[sourceIndex];
    const segmentFraction =
      endDistance === startDistance ? 0 : (targetDistance - startDistance) / (endDistance - startDistance);
    const start = coordinates[sourceIndex - 1];
    const end = coordinates[sourceIndex];
    return [
      start[0] + (end[0] - start[0]) * segmentFraction,
      start[1] + (end[1] - start[1]) * segmentFraction,
    ];
  });
}

function snappedNodeKey(coordinate) {
  return `${Math.round(coordinate[0] / 1.5)}:${Math.round(coordinate[1] / 1.5)}`;
}

function streetName(properties) {
  return [properties.PREDIR, properties.STREETNAME, properties.STREETTYPE, properties.SUFFIX]
    .filter(Boolean)
    .join(" ");
}

function roadCostFactor(properties) {
  switch (properties.STREETCLASS) {
    case "Alley":
      return 0.88;
    case "Residential":
      return 0.94;
    case "Collector":
      return 1;
    case "Minor Arterial":
      return 1.08;
    case "Principal Arterial":
      return 1.16;
    default:
      return 1.04;
  }
}

class MinimumQueue {
  constructor() {
    this.values = [];
  }

  push(value) {
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.values[parent].cost <= value.cost) break;
      this.values[index] = this.values[parent];
      index = parent;
    }
    this.values[index] = value;
  }

  pop() {
    const first = this.values[0];
    const last = this.values.pop();
    if (this.values.length > 0 && last) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= this.values.length) break;
        const child =
          right < this.values.length && this.values[right].cost < this.values[left].cost
            ? right
            : left;
        if (this.values[child].cost >= last.cost) break;
        this.values[index] = this.values[child];
        index = child;
      }
      this.values[index] = last;
    }
    return first;
  }

  get size() {
    return this.values.length;
  }
}

async function loadSources(directory) {
  const fileNames = await readdir(directory);
  const roadFiles = fileNames.filter((name) => /^roads-.*\.geojson$/.test(name)).sort();
  const treeFiles = fileNames.filter((name) => /^trees-.*\.geojson$/.test(name)).sort();
  if (roadFiles.length === 0 || treeFiles.length === 0) {
    throw new Error("The source directory must contain roads-*.geojson and trees-*.geojson files.");
  }

  async function featuresFrom(fileNamesToRead) {
    const collections = await Promise.all(
      fileNamesToRead.map(async (fileName) => {
        const parsed = JSON.parse(await readFile(path.join(directory, fileName), "utf8"));
        if (parsed.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
          throw new Error(`${fileName} is not a GeoJSON FeatureCollection.`);
        }
        return parsed.features;
      }),
    );
    return collections.flat();
  }

  const roads = await featuresFrom(roadFiles);
  const trees = await featuresFrom(treeFiles);
  const uniqueTrees = new Map();
  for (const tree of trees) {
    const key = tree.properties?.OBJECTID ?? JSON.stringify(tree.geometry?.coordinates);
    uniqueTrees.set(key, tree);
  }
  return { roads, trees: [...uniqueTrees.values()] };
}

function buildRoadGraph(roadFeatures) {
  const nodes = new Map();
  const edges = new Map();
  const adjacency = new Map();

  function addAdjacency(nodeKey, edgeId) {
    const edgeIds = adjacency.get(nodeKey) ?? [];
    edgeIds.push(edgeId);
    adjacency.set(nodeKey, edgeIds);
  }

  for (const feature of roadFeatures) {
    if (feature.geometry?.type !== "LineString" || feature.geometry.coordinates.length < 2) continue;
    if (feature.properties?.LIFECYCLE && feature.properties.LIFECYCLE !== "Active") continue;
    const coordinates = deduplicateConsecutive(feature.geometry.coordinates.map(toXy));
    if (coordinates.length < 2) continue;
    const lengthM = polylineLength(coordinates);
    if (lengthM < 2) continue;
    const startKey = snappedNodeKey(coordinates[0]);
    const endKey = snappedNodeKey(coordinates.at(-1));
    if (startKey === endKey) continue;
    const edgeId = `${feature.properties?.STREETCLASS ?? "road"}-${feature.properties?.OBJECTID}`;
    const edge = {
      id: edgeId,
      startKey,
      endKey,
      coordinates,
      lengthM,
      properties: feature.properties ?? {},
    };
    edges.set(edgeId, edge);
    if (!nodes.has(startKey)) nodes.set(startKey, coordinates[0]);
    if (!nodes.has(endKey)) nodes.set(endKey, coordinates.at(-1));
    addAdjacency(startKey, edgeId);
    addAdjacency(endKey, edgeId);
  }

  const unseen = new Set(nodes.keys());
  const components = [];
  while (unseen.size > 0) {
    const first = unseen.values().next().value;
    const queue = [first];
    unseen.delete(first);
    const component = new Set([first]);
    for (let index = 0; index < queue.length; index += 1) {
      const nodeKey = queue[index];
      for (const edgeId of adjacency.get(nodeKey) ?? []) {
        const edge = edges.get(edgeId);
        const next = edge.startKey === nodeKey ? edge.endKey : edge.startKey;
        if (!unseen.has(next)) continue;
        unseen.delete(next);
        component.add(next);
        queue.push(next);
      }
    }
    components.push(component);
  }
  components.sort((left, right) => right.size - left.size);
  return { nodes, edges, adjacency, component: components[0] };
}

function nearestNode(graph, longitudeLatitude) {
  const point = toXy(longitudeLatitude);
  let nearestKey;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const nodeKey of graph.component) {
    const candidateDistance = distance(point, graph.nodes.get(nodeKey));
    if (candidateDistance < nearestDistance) {
      nearestKey = nodeKey;
      nearestDistance = candidateDistance;
    }
  }
  return nearestKey;
}

function shortestPath(graph, startKey, endKey, usedEdgeIds) {
  const queue = new MinimumQueue();
  const costs = new Map([[startKey, 0]]);
  const previous = new Map();
  queue.push({ key: startKey, cost: 0 });

  while (queue.size > 0) {
    const current = queue.pop();
    if (current.cost !== costs.get(current.key)) continue;
    if (current.key === endKey) break;
    for (const edgeId of graph.adjacency.get(current.key) ?? []) {
      const edge = graph.edges.get(edgeId);
      const nextKey = edge.startKey === current.key ? edge.endKey : edge.startKey;
      if (!graph.component.has(nextKey)) continue;
      const reuseFactor = usedEdgeIds.has(edgeId) ? 7 : 1;
      const nextCost =
        current.cost + edge.lengthM * roadCostFactor(edge.properties) * reuseFactor;
      if (nextCost >= (costs.get(nextKey) ?? Number.POSITIVE_INFINITY)) continue;
      costs.set(nextKey, nextCost);
      previous.set(nextKey, { previousKey: current.key, edgeId });
      queue.push({ key: nextKey, cost: nextCost });
    }
  }

  if (!previous.has(endKey)) {
    throw new Error(`No road path connects waypoint nodes ${startKey} and ${endKey}.`);
  }

  const steps = [];
  let nodeKey = endKey;
  while (nodeKey !== startKey) {
    const link = previous.get(nodeKey);
    steps.push({ edgeId: link.edgeId, fromKey: link.previousKey, toKey: nodeKey });
    nodeKey = link.previousKey;
  }
  return steps.reverse();
}

function buildRoadRoute(graph) {
  const waypointNodes = WAYPOINTS.map((waypoint) => nearestNode(graph, waypoint));
  const usedEdgeIds = new Set();
  const routeSteps = [];
  for (let index = 1; index < waypointNodes.length; index += 1) {
    const steps = shortestPath(graph, waypointNodes[index - 1], waypointNodes[index], usedEdgeIds);
    for (const step of steps) {
      routeSteps.push(step);
      usedEdgeIds.add(step.edgeId);
    }
  }

  const coordinates = [];
  for (const step of routeSteps) {
    const edge = graph.edges.get(step.edgeId);
    const oriented =
      edge.startKey === step.fromKey ? edge.coordinates : [...edge.coordinates].reverse();
    if (coordinates.length > 0) oriented[0] = coordinates.at(-1);
    coordinates.push(...(coordinates.length === 0 ? oriented : oriented.slice(1)));
  }
  return {
    steps: routeSteps,
    edges: [...usedEdgeIds].map((edgeId) => graph.edges.get(edgeId)),
    coordinates: deduplicateConsecutive(coordinates),
  };
}

function scoreTreeSide(offsetCoordinates, treePoints) {
  let score = 0;
  for (const tree of treePoints) {
    const nearest = nearestOnPolyline(tree.xy, offsetCoordinates).distance;
    if (nearest < 28) score += 28 - nearest;
  }
  return score;
}

function nearestRoad(point, routeEdges) {
  let best;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const edge of routeEdges) {
    const candidate = nearestOnPolyline(point, edge.coordinates).distance;
    if (candidate < bestDistance) {
      bestDistance = candidate;
      best = edge;
    }
  }
  return best;
}

function turnAngleDegrees(coordinates, index) {
  if (index === 0 || index === coordinates.length - 1) return 0;
  const incoming = normalize([
    coordinates[index][0] - coordinates[index - 1][0],
    coordinates[index][1] - coordinates[index - 1][1],
  ]);
  const outgoing = normalize([
    coordinates[index + 1][0] - coordinates[index][0],
    coordinates[index + 1][1] - coordinates[index][1],
  ]);
  return (Math.acos(clamp(incoming[0] * outgoing[0] + incoming[1] * outgoing[1], -1, 1)) *
    180) /
    Math.PI;
}

function estimatedTreeDimensions(properties) {
  const diameterInches = Number(properties.DBHINT);
  const usableDiameter = Number.isFinite(diameterInches) && diameterInches > 0 ? diameterInches : 12;
  const evergreen = properties.LEAFCYCLE === "Evergreen";
  return {
    heightM: clamp(4.8 + usableDiameter * (evergreen ? 0.42 : 0.36), 5.5, 27),
    crownRadiusM: clamp(1.6 + usableDiameter * (evergreen ? 0.065 : 0.105), 1.8, 7.5),
  };
}

function bboxForFeatures(features) {
  const bounds = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];
  function visit(coordinates) {
    if (typeof coordinates?.[0] === "number") {
      bounds[0] = Math.min(bounds[0], coordinates[0]);
      bounds[1] = Math.min(bounds[1], coordinates[1]);
      bounds[2] = Math.max(bounds[2], coordinates[0]);
      bounds[3] = Math.max(bounds[3], coordinates[1]);
      return;
    }
    for (const child of coordinates ?? []) visit(child);
  }
  for (const feature of features) visit(feature.geometry?.coordinates);
  return bounds.map((value) => round(value, 7));
}

function hashFraction(index) {
  let value = (index + 1) * 2_654_435_761;
  value ^= value >>> 16;
  return (value >>> 0) / 4_294_967_295;
}

const { roads, trees } = await loadSources(sourceDirectory);
const graph = buildRoadGraph(roads);
const roadRoute = buildRoadRoute(graph);
const treePoints = trees
  .filter((feature) => feature.geometry?.type === "Point")
  .map((feature) => ({ feature, xy: toXy(feature.geometry.coordinates) }));

const leftOffset = offsetPolyline(roadRoute.coordinates, ROAD_OFFSET_M);
const rightOffset = offsetPolyline(roadRoute.coordinates, -ROAD_OFFSET_M);
const leftScore = scoreTreeSide(leftOffset, treePoints);
const rightScore = scoreTreeSide(rightOffset, treePoints);
const chosenOffsetSide = leftScore >= rightScore ? "left" : "right";
const offsetRoute = chosenOffsetSide === "left" ? leftOffset : rightOffset;
const polePositionsXy = resamplePolyline(offsetRoute, NOMINAL_POLE_SPACING_M);
const poleCoordinates = polePositionsXy.map((coordinate) =>
  toLongitudeLatitude(coordinate).map((value) => round(value, 7)),
);
const spanCount = poleCoordinates.length - 1;
const routeLengthM = polylineLength(polePositionsXy);

const selectedTrees = [];
const treesBySpan = Array.from({ length: spanCount }, () => []);
for (const tree of treePoints) {
  const nearest = nearestOnPolyline(tree.xy, polePositionsXy);
  if (nearest.distance > CORRIDOR_TREE_DISTANCE_M) continue;
  const dimensions = estimatedTreeDimensions(tree.feature.properties ?? {});
  const crownClearanceM = Math.max(0, nearest.distance - dimensions.crownRadiusM);
  const heightConflict = dimensions.heightM >= 9.5;
  const riskClass =
    heightConflict && crownClearanceM < 1
      ? "critical"
      : heightConflict && crownClearanceM < 4.5
        ? "watch"
        : "corridor";
  const record = {
    feature: tree.feature,
    spanIndex: nearest.segmentIndex,
    trunkDistanceM: nearest.distance,
    crownClearanceM,
    heightM: dimensions.heightM,
    crownRadiusM: dimensions.crownRadiusM,
    riskClass,
  };
  selectedTrees.push(record);
  treesBySpan[nearest.segmentIndex].push(record);
}

const routeFeature = {
  type: "Feature",
  id: "route-nbf-13k8-01",
  properties: {
    asset_type: "power_line_route",
    importer_role: "primary_pole_placement_route",
    name: "North Boulder synthetic 13.8 kV feeder",
    description:
      "Importer-compatible route: each vertex is a pole and each adjacent pair is one span.",
    synthetic: true,
    power: "minor_line",
    operator: "Synthetic Grid Test Utility",
    network: "North Boulder Feeder NBF-01",
    feeder_id: "NBF-13K8-01",
    topology: "radial_with_normally_open_tie",
    status: "in_service",
    voltage_v: 13_800,
    voltage: "13800",
    frequency_hz: 60,
    phases: 3,
    phase_config: "ABC",
    circuits: 1,
    cables: 3,
    neutral_present: true,
    physical_conductor_count: 4,
    conductor: CONDUCTOR.name,
    nominal_pole_spacing_m: NOMINAL_POLE_SPACING_M,
    road_offset_m: ROAD_OFFSET_M,
    road_offset_side: chosenOffsetSide,
    route_length_m: round(routeLengthM, 2),
    pole_count: poleCoordinates.length,
    span_count: spanCount,
    source_context: "City of Boulder street centerlines and public tree inventory",
  },
  geometry: { type: "LineString", coordinates: poleCoordinates },
};

const spanFeatures = [];
for (let index = 0; index < spanCount; index += 1) {
  const startXy = polePositionsXy[index];
  const endXy = polePositionsXy[index + 1];
  const midpoint = [(startXy[0] + endXy[0]) / 2, (startXy[1] + endXy[1]) / 2];
  const spanLengthM = distance(startXy, endXy);
  const road = nearestRoad(midpoint, roadRoute.edges);
  const nearbyTrees = treesBySpan[index];
  const nearestTrunkM =
    nearbyTrees.length > 0
      ? Math.min(...nearbyTrees.map((tree) => tree.trunkDistanceM))
      : null;
  const minimumCrownClearanceM =
    nearbyTrees.length > 0
      ? Math.min(...nearbyTrees.map((tree) => tree.crownClearanceM))
      : null;
  const sagM =
    (CONDUCTOR.massPerMeter * 9.80665 * spanLengthM ** 2) /
    (8 * CONDUCTOR.horizontalTensionN);
  const roadLabel = streetName(road?.properties ?? {}) || null;
  spanFeatures.push({
    type: "Feature",
    id: `span-nbf-${String(index + 1).padStart(4, "0")}`,
    properties: {
      asset_type: "power_line_span",
      power_line_id: `NBF-13K8-SPAN-${String(index + 1).padStart(4, "0")}`,
      feeder_id: "NBF-13K8-01",
      from_pole_id: `NBF-${String(index + 1).padStart(4, "0")}`,
      to_pole_id: `NBF-${String(index + 2).padStart(4, "0")}`,
      sequence: index + 1,
      synthetic: true,
      power: "minor_line",
      operator: "Synthetic Grid Test Utility",
      voltage_v: 13_800,
      voltage: "13800",
      frequency_hz: 60,
      phases: 3,
      phase_config: "ABC",
      circuits: 1,
      cables: 3,
      neutral_present: true,
      physical_conductor_count: 4,
      conductor: CONDUCTOR.name,
      conductor_material: "aluminum_conductor_steel_reinforced",
      conductor_size: "4/0 AWG",
      conductor_stranding: "6/1",
      mass_per_meter: CONDUCTOR.massPerMeter,
      span_length: round(spanLengthM, 3),
      span_length_m: round(spanLengthM, 3),
      span_to_next_node: round(spanLengthM, 3),
      diameter: CONDUCTOR.diameterM,
      conductor_diameter: CONDUCTOR.diameterM,
      conductor_diameter_m: CONDUCTOR.diameterM,
      cable_area: CONDUCTOR.cableAreaM2,
      cable_area_m2: CONDUCTOR.cableAreaM2,
      elastic_modulus: CONDUCTOR.elasticModulusPa,
      elastic_modulus_pa: CONDUCTOR.elasticModulusPa,
      horizontal_tension: CONDUCTOR.horizontalTensionN,
      horizontal_tension_n: CONDUCTOR.horizontalTensionN,
      tension: CONDUCTOR.horizontalTensionN,
      rated_strength_n: 37_143,
      tension_percent_rated_strength: 20.2,
      dc_resistance_ohm_per_km_20c: 0.2608,
      nominal_ampacity_a: 357,
      air_density: 1.225,
      drag_coefficient: CONDUCTOR.dragCoefficient,
      attachment_height_start_m_agl: 9.5,
      attachment_height_end_m_agl: 9.5,
      attachment_height_m: 9.5,
      calculated_still_air_sag_m: round(sagM, 3),
      midspan_sag_m: round(1.45 * (spanLengthM / 99.1) ** 2, 3),
      sag_case: "final_120f_visualization_reference",
      sag_is_engineered: false,
      road_name: roadLabel,
      road_class: road?.properties?.STREETCLASS ?? null,
      road_speed_limit_mph: road?.properties?.SPEEDLIMIT ?? null,
      roadside_offset_m: ROAD_OFFSET_M,
      road_relation: "parallel",
      road_side: chosenOffsetSide,
      placement_reason: spanLengthM < 35 ? "curve" : "tangent",
      corridor_tree_count: nearbyTrees.length,
      nearest_tree_trunk_m: nearestTrunkM === null ? null : round(nearestTrunkM, 2),
      minimum_estimated_crown_clearance_m:
        minimumCrownClearanceM === null ? null : round(minimumCrownClearanceM, 2),
      vegetation_risk:
        nearbyTrees.some((tree) => tree.riskClass === "critical")
          ? "critical"
          : nearbyTrees.some((tree) => tree.riskClass === "watch")
            ? "watch"
            : "normal",
      units: "SI",
    },
    geometry: {
      type: "LineString",
      coordinates: [poleCoordinates[index], poleCoordinates[index + 1]],
    },
  });
}

const specialEquipmentByIndex = new Map([
  [0, "substation_exit_switch"],
  [Math.round(poleCoordinates.length * 0.28), "recloser"],
  [Math.round(poleCoordinates.length * 0.52), "capacitor_bank"],
  [Math.round(poleCoordinates.length * 0.76), "sectionalizer"],
  [poleCoordinates.length - 1, "normally_open_tie"],
]);
const poleFeatures = poleCoordinates.map((coordinate, index) => {
  const angle = turnAngleDegrees(polePositionsXy, index);
  const endpoint = index === 0 || index === poleCoordinates.length - 1;
  const adjacentRoads = [spanFeatures[Math.max(0, index - 1)], spanFeatures[Math.min(index, spanCount - 1)]]
    .map((feature) => feature?.properties?.road_name)
    .filter(Boolean);
  const changesRoad = new Set(adjacentRoads).size > 1;
  const anchor = !endpoint && (angle > 13 || changesRoad);
  const random = hashFraction(index);
  const material = random > 0.965 ? "steel" : random > 0.94 ? "concrete" : "wood";
  const specialEquipment = specialEquipmentByIndex.get(index) ?? null;
  const transformer = !specialEquipment && !endpoint && !anchor && index % 6 === 3;
  const installationYear = 1968 + ((index * 17) % 53);
  return {
    type: "Feature",
    id: `pole-nbf-${String(index + 1).padStart(4, "0")}`,
    properties: {
      asset_type: "power_pole",
      pole_id: `NBF-${String(index + 1).padStart(4, "0")}`,
      ref: `NBF-${String(index + 1).padStart(4, "0")}`,
      feeder_id: "NBF-13K8-01",
      sequence: index + 1,
      synthetic: true,
      power: "pole",
      man_made: "utility_pole",
      utility: "power",
      operator: "Synthetic Grid Test Utility",
      material,
      structure: material === "wood" ? "solid" : "tubular",
      pole_length_ft: material === "steel" ? 45 : 40,
      pole_length_m: material === "steel" ? 13.72 : 12.19,
      embedment_ft: material === "steel" ? 6.5 : 6,
      embedment_m: material === "steel" ? 1.98 : 1.83,
      height_agl_m: material === "steel" ? 11.73 : 10.36,
      height: material === "steel" ? 11.73 : 10.36,
      design: "three-level",
      line_attachment: endpoint || anchor ? "anchor" : "pin",
      line_management: endpoint ? "termination" : "straight",
      guyed: endpoint || anchor,
      turn_angle_deg: round(angle, 1),
      installation_year: installationYear,
      condition:
        installationYear < 1980 ? "inspect" : installationYear < 1995 ? "fair" : "good",
      transformer: transformer ? "distribution" : null,
      transformer_rating_kva: transformer ? 50 : null,
      voltage_primary_v: transformer ? 13_800 : null,
      voltage_secondary_v: transformer ? 240 : null,
      equipment: specialEquipment ?? (transformer ? "distribution_transformer" : null),
      switch_state: specialEquipment === "normally_open_tie" ? "open" : specialEquipment ? "closed" : null,
      normally_open: specialEquipment === "normally_open_tie",
      road_name: adjacentRoads[0] ?? null,
      road_side: chosenOffsetSide,
      road_offset_m: ROAD_OFFSET_M,
      placement_reason: endpoint
        ? "termination"
        : anchor
          ? "angle_or_road_change"
          : transformer
            ? "equipment"
            : specialEquipment
              ? "equipment"
            : "tangent",
    },
    geometry: { type: "Point", coordinates: coordinate },
  };
});

const treeFeatures = selectedTrees.map((record) => {
  const source = record.feature.properties ?? {};
  const sourceId = source.FACILITYID || source.OBJECTID;
  return {
    type: "Feature",
    id: `tree-boulder-${sourceId}`,
    properties: {
      asset_type: "vegetation_hazard",
      tree_id: `BOULDER-${sourceId}`,
      synthetic: false,
      source: "City of Boulder public tree inventory",
      source_object_id: source.OBJECTID ?? null,
      source_facility_id: source.FACILITYID ?? null,
      common_name: source.COMMONNAME ?? null,
      latin_name: source.LATINNAME ?? null,
      genus: source.GENUS ?? null,
      leaf_cycle: source.LEAFCYCLE ?? null,
      leaf_type: source.LEAFTYPE ?? null,
      dbh_in: source.DBHINT ?? null,
      on_street: source.ONSTREET ?? null,
      location_type: source.LOCTYPE ?? null,
      site_type: source.SITETYPE ?? null,
      source_confidence: source.CONFIDENCE ?? null,
      estimated_height_m: round(record.heightM, 2),
      estimated_crown_radius_m: round(record.crownRadiusM, 2),
      trunk_distance_to_line_m: round(record.trunkDistanceM, 2),
      estimated_crown_clearance_m: round(record.crownClearanceM, 2),
      vegetation_risk: record.riskClass,
      nearest_span_id: `NBF-13K8-SPAN-${String(record.spanIndex + 1).padStart(4, "0")}`,
      estimate_notice: "Height and crown dimensions are deterministic synthetic test estimates.",
    },
    geometry: {
      type: "Point",
      coordinates: record.feature.geometry.coordinates.map((value) => round(value, 7)),
    },
  };
});

const features = [routeFeature, ...spanFeatures, ...poleFeatures, ...treeFeatures];
const spanLengths = spanFeatures.map((feature) => feature.properties.span_length_m);
const criticalTreeCount = treeFeatures.filter(
  (feature) => feature.properties.vegetation_risk === "critical",
).length;
const watchTreeCount = treeFeatures.filter(
  (feature) => feature.properties.vegetation_risk === "watch",
).length;
const collection = {
  type: "FeatureCollection",
  name: "North Boulder synthetic 13.8 kV overhead distribution feeder",
  bbox: bboxForFeatures(features),
  properties: {
    fixture_id: "boulder-13k8-feeder-large-v1",
    generated_on: "2026-07-22",
    synthetic_network: true,
    crs: "OGC:CRS84",
    purpose: "Large realistic power-line, pole, and vegetation fixture for engine and UI testing.",
    importer_compatibility:
      "The first feature is a LineString whose vertices are the complete ordered pole route.",
    data_sources: [
      {
        name: "City of Boulder Street Centerlines",
        url: "https://gis.bouldercolorado.gov/ags_svr3/rest/services/trans/StreetCenterline/MapServer",
        role: "Road-following route context",
        license: "CC0-1.0",
      },
      {
        name: "City of Boulder Public Tree Inventory",
        url: "https://gis.bouldercolorado.gov/ags_svr2/rest/services/parks/TreesOpenData/MapServer/0",
        role: "Real roadside vegetation locations and inventory attributes",
        license: "CC0-1.0",
      },
      {
        name: "Southwire ACSR Specification 80100",
        url: "https://cabletechsupport.southwire.com/cablespec/download_spec/?country=US&spec=80100",
        role: "4/0 ACSR Penguin diameter, mass, rated strength, resistance, and ampacity",
      },
      {
        name: "USDA RUS Bulletin 1724E-154",
        url: "https://www.usda.gov/sites/default/files/guidance-documents/RUS%20Bulletin%201724E-154%20Distribution%20Conductor%20Clearances%20and%20Span%20Limitations.pdf",
        role: "Distribution-span and visualization sag reference",
      },
    ],
    statistics: {
      route_length_km: round(routeLengthM / 1000, 3),
      pole_count: poleCoordinates.length,
      span_count: spanCount,
      tree_count: treeFeatures.length,
      critical_tree_count: criticalTreeCount,
      watch_tree_count: watchTreeCount,
      average_span_m: round(spanLengths.reduce((sum, value) => sum + value, 0) / spanCount, 2),
      minimum_span_m: round(Math.min(...spanLengths), 2),
      maximum_span_m: round(Math.max(...spanLengths), 2),
      source_road_feature_count: roadRoute.edges.length,
    },
  },
  features,
};

if (collection.features[0].geometry.type !== "LineString") {
  throw new Error("The importer compatibility route must remain the first feature.");
}
if (spanFeatures.length !== poleFeatures.length - 1) {
  throw new Error("Every pair of adjacent poles must have exactly one span feature.");
}
if (Math.min(...spanLengths) < 20 || Math.max(...spanLengths) > 58) {
  const shortSpanSummary = spanFeatures
    .filter((feature) => feature.properties.span_length_m < 35)
    .slice(0, 8)
    .map((feature) => `${feature.properties.sequence}:${feature.properties.span_length_m}m:${feature.properties.road_name}`)
    .join(", ");
  throw new Error(
    `Generated pole spacing fell outside the 20-58 m fixture envelope (${Math.min(...spanLengths)}-${Math.max(...spanLengths)} m; ${shortSpanSummary}).`,
  );
}
if (treeFeatures.length < 250) {
  throw new Error("The route did not select enough corridor trees for a large vegetation fixture.");
}

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(collection, null, 2)}\n`);
console.log(
  `Wrote ${outputPath}: ${round(routeLengthM / 1000, 2)} km, ${poleFeatures.length} poles, ${spanFeatures.length} spans, ${treeFeatures.length} corridor trees.`,
);
