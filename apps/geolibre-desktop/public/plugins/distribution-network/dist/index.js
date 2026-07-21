const PLUGIN_ID = "distribution-network";
const PANEL_ID = "distribution-network-assets";
const MENU_ID = "distribution-network-menu";
const CONDUCTOR_HEIGHT_METERS = 8.2;
const CONDUCTOR_OFFSETS_METERS = [-1.5, 1.5];
export const PICKING_RADIUS_PIXELS = 8;
export const CONDUCTOR_HIT_WIDTH_PIXELS = 18;
export const TREE_DEFAULT_SCALE = 0.5;
export const BUNDLED_POLE_MODEL_PATH = "assets/13.8kv_power_pole.glb";
export const BUNDLED_POLE_GEOJSON_PATH = "assets/testpowerlines.geojson";
export const BUNDLED_TREE_MODEL_PATH =
  "assets/low_poly_forest_tree_assets/tree_01.glb";
export const BUNDLED_TREE_GEOJSON_PATH = "assets/testtrees.geojson";
export const BOULDER_TREE_SERVICE_URL =
  "https://gis.bouldercolorado.gov/ags_svr2/rest/services/parks/TreesOpenData/MapServer/0/query";
export const BOULDER_TREE_PAGE_SIZE = 2000;
export const BOULDER_TREE_MAX_FEATURES = 10_000;

const BOULDER_TREE_FIELDS = [
  "OBJECTID",
  "FACILITYID",
  "COMMONNAME",
  "LATINNAME",
  "GENUS",
  "LEAFCYCLE",
  "LEAFTYPE",
  "DBHINT",
  "LOCTYPE",
  "OWNEDBY",
  "MAINTBY",
  "CONFIDENCE",
];
const BOULDER_TREE_SOURCE_NAME = "City of Boulder public tree inventory";

let overlay = null;
let deck = null;
let currentApp = null;
let previousProjection = null;
let unregisterPanel = null;
let unregisterMenu = null;
let nextDatasetId = 1;
let datasets = [];
let assetPopup = null;
const objectUrls = new Set();

function validCoordinate(coordinate) {
  const longitude = Number(coordinate?.[0]);
  const latitude = Number(coordinate?.[1]);
  return Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    Math.abs(longitude) <= 180 &&
    Math.abs(latitude) <= 90
    ? [longitude, latitude]
    : null;
}

function lineCoordinates(geojson) {
  const features = geojson?.type === "FeatureCollection" ? geojson.features : [];
  for (const feature of features) {
    if (feature?.geometry?.type === "LineString" && feature.geometry.coordinates.length >= 2) {
      return feature.geometry.coordinates;
    }
    if (feature?.geometry?.type === "MultiLineString") {
      const coordinates = feature.geometry.coordinates.find((line) => line.length >= 2);
      if (coordinates) return coordinates;
    }
  }
  return [];
}

function collectGeometryCoordinates(geometry, coordinates) {
  if (!geometry) return;
  if (geometry.type === "GeometryCollection") {
    for (const child of geometry.geometries ?? []) collectGeometryCoordinates(child, coordinates);
    return;
  }

  const add = (coordinate) => {
    const valid = validCoordinate(coordinate);
    if (valid) coordinates.push(valid);
  };

  if (geometry.type === "Point") add(geometry.coordinates);
  else if (geometry.type === "MultiPoint" || geometry.type === "LineString") {
    geometry.coordinates.forEach(add);
  } else if (geometry.type === "MultiLineString" || geometry.type === "Polygon") {
    geometry.coordinates.forEach((line) => line.forEach(add));
  } else if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach((polygon) => polygon.forEach((ring) => ring.forEach(add)));
  }
}

export function placementCoordinates(geojson) {
  return treePlacements(geojson).map((placement) => placement.position);
}

export function treePlacements(geojson) {
  const placements = [];
  const features = geojson?.type === "FeatureCollection" ? geojson.features : [];
  for (const feature of features) {
    const coordinates = [];
    collectGeometryCoordinates(feature?.geometry, coordinates);
    for (const position of coordinates) {
      placements.push({
        featureId: feature?.id ?? null,
        position,
        properties:
          feature?.properties && typeof feature.properties === "object"
            ? { ...feature.properties }
            : {},
      });
    }
  }

  const seen = new Set();
  return placements.filter((placement) => {
    const key = placement.position.join(",");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizedBounds(bounds) {
  if (!Array.isArray(bounds) || bounds.length !== 4) {
    throw new Error("A west, south, east, north map extent is required.");
  }
  const values = bounds.map(Number);
  const [west, south, east, north] = values;
  if (
    values.some((value) => !Number.isFinite(value)) ||
    west < -180 ||
    east > 180 ||
    south < -90 ||
    north > 90 ||
    west >= east ||
    south >= north
  ) {
    throw new Error("The map extent is not a valid WGS84 bounding box.");
  }
  return values;
}

export function buildBoulderTreeQueryUrl(
  bounds,
  resultOffset = 0,
  resultRecordCount = BOULDER_TREE_PAGE_SIZE,
) {
  const queryBounds = normalizedBounds(bounds);
  const parameters = new URLSearchParams({
    where: "1=1",
    geometry: queryBounds.join(","),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: BOULDER_TREE_FIELDS.join(","),
    returnGeometry: "true",
    outSR: "4326",
    orderByFields: "OBJECTID ASC",
    resultOffset: String(Math.max(0, Math.floor(Number(resultOffset) || 0))),
    resultRecordCount: String(
      Math.max(1, Math.min(BOULDER_TREE_PAGE_SIZE, Math.floor(Number(resultRecordCount) || 1))),
    ),
    f: "geojson",
  });
  return `${BOULDER_TREE_SERVICE_URL}?${parameters}`;
}

export async function fetchBoulderTreeGeoJson(
  bounds,
  fetchImpl = globalThis.fetch,
  options = {},
) {
  if (typeof fetchImpl !== "function") {
    throw new Error("This environment cannot request the Boulder tree inventory.");
  }
  const queryBounds = normalizedBounds(bounds);
  const pageSize = Math.max(
    1,
    Math.min(BOULDER_TREE_PAGE_SIZE, Math.floor(Number(options.pageSize) || BOULDER_TREE_PAGE_SIZE)),
  );
  const maxFeatures = Math.max(
    1,
    Math.floor(Number(options.maxFeatures) || BOULDER_TREE_MAX_FEATURES),
  );
  const features = [];
  let resultOffset = 0;
  let truncated = false;

  while (features.length < maxFeatures) {
    const remaining = maxFeatures - features.length;
    const recordCount = Math.min(pageSize, remaining);
    const response = await fetchImpl(
      buildBoulderTreeQueryUrl(queryBounds, resultOffset, recordCount),
    );
    if (!response?.ok) {
      throw new Error(
        `Could not load the Boulder tree inventory (HTTP ${response?.status ?? "unknown"}).`,
      );
    }
    const page = await response.json();
    if (page?.error) {
      throw new Error(page.error.message || "The Boulder tree service rejected the query.");
    }
    if (page?.type !== "FeatureCollection" || !Array.isArray(page.features)) {
      throw new Error("The Boulder tree service returned an unexpected response.");
    }

    features.push(...page.features.slice(0, remaining));
    const exceededTransferLimit = Boolean(
      page.exceededTransferLimit || page.properties?.exceededTransferLimit,
    );
    if (page.features.length === 0) break;
    resultOffset += page.features.length;
    if (!exceededTransferLimit && page.features.length < recordCount) break;
    if (features.length >= maxFeatures) {
      truncated = exceededTransferLimit || page.features.length >= recordCount;
      break;
    }
  }

  return {
    type: "FeatureCollection",
    features,
    metadata: {
      source: BOULDER_TREE_SOURCE_NAME,
      serviceUrl: BOULDER_TREE_SERVICE_URL,
      license: "CC0 1.0",
      queryBounds,
      truncated,
    },
  };
}

function offsetPath(coordinates, offsetMeters, height) {
  const averageLatitude =
    coordinates.reduce((sum, coordinate) => sum + coordinate[1], 0) / coordinates.length;
  const metersPerLongitude = Math.max(
    Math.abs(111_320 * Math.cos((averageLatitude * Math.PI) / 180)),
    1,
  );
  const metersPerLatitude = 110_540;

  return coordinates.map(([longitude, latitude], index) => {
    const previous = coordinates[Math.max(0, index - 1)];
    const next = coordinates[Math.min(coordinates.length - 1, index + 1)];
    const dx = (next[0] - previous[0]) * metersPerLongitude;
    const dy = (next[1] - previous[1]) * metersPerLatitude;
    const length = Math.hypot(dx, dy) || 1;
    const normalX = -dy / length;
    const normalY = dx / length;
    return [
      longitude + (normalX * offsetMeters) / metersPerLongitude,
      latitude + (normalY * offsetMeters) / metersPerLatitude,
      height,
    ];
  });
}

function lineBearing(coordinates, index) {
  const previous = coordinates[Math.max(0, index - 1)];
  const next = coordinates[Math.min(coordinates.length - 1, index + 1)];
  const averageLatitude = (previous[1] + next[1]) / 2;
  const metersPerLongitude = Math.max(
    Math.abs(111_320 * Math.cos((averageLatitude * Math.PI) / 180)),
    1,
  );
  const dx = (next[0] - previous[0]) * metersPerLongitude;
  const dy = (next[1] - previous[1]) * 110_540;
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

function pathLengthMeters(path) {
  const earthRadiusMeters = 6_371_008.8;
  let length = 0;
  for (let index = 1; index < path.length; index += 1) {
    const [previousLongitude, previousLatitude] = path[index - 1];
    const [longitude, latitude] = path[index];
    const latitudeDelta = ((latitude - previousLatitude) * Math.PI) / 180;
    const longitudeDelta = ((longitude - previousLongitude) * Math.PI) / 180;
    const previousLatitudeRadians = (previousLatitude * Math.PI) / 180;
    const latitudeRadians = (latitude * Math.PI) / 180;
    const haversine =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(previousLatitudeRadians) *
        Math.cos(latitudeRadians) *
        Math.sin(longitudeDelta / 2) ** 2;
    length += 2 * earthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(haversine)));
  }
  return length;
}

function formatLength(lengthMeters) {
  return lengthMeters >= 1000
    ? `${(lengthMeters / 1000).toFixed(2)} km`
    : `${Math.round(lengthMeters)} m`;
}

export function pickedFeatureDetails(object) {
  if (object?.kind === "pole") {
    return {
      title: "Distribution pole",
      rows: [{ label: "Pole ID", value: object.id }],
    };
  }
  if (object?.kind === "conductor") {
    return {
      title: "Distribution line",
      rows: [
        { label: "Line ID", value: object.id },
        { label: "Length", value: formatLength(object.lengthMeters) },
      ],
    };
  }
  if (object?.kind === "tree") {
    return {
      title: "Tree",
      rows: [
        { label: "Tree ID", value: object.id },
        ...(object.commonName ? [{ label: "Species", value: object.commonName }] : []),
        ...(object.latinName
          ? [{ label: "Scientific name", value: object.latinName }]
          : []),
        ...(Number.isFinite(object.dbhInches)
          ? [{ label: "DBH", value: `${object.dbhInches} in` }]
          : []),
        ...(Number.isFinite(object.heightMeters)
          ? [{ label: "Height", value: `${object.heightMeters} m` }]
          : []),
        ...(object.locationType ? [{ label: "Location", value: object.locationType }] : []),
        ...(object.sourceName ? [{ label: "Source", value: object.sourceName }] : []),
        ...(object.modelName ? [{ label: "Model", value: object.modelName }] : []),
      ],
    };
  }
  return null;
}

export function buildNetwork(geojson, height = CONDUCTOR_HEIGHT_METERS, maxCoordinates = 3) {
  const sourceCoordinates = lineCoordinates(geojson);
  const coordinates = (sourceCoordinates.length >= 2 ? sourceCoordinates : placementCoordinates(geojson))
    .slice(0, maxCoordinates)
    .map(validCoordinate)
    .filter(Boolean);

  if (coordinates.length < 2) {
    throw new Error("The pole GeoJSON needs a line with at least two valid coordinates.");
  }

  return {
    poles: coordinates.map(([longitude, latitude], index) => {
      const bearing = lineBearing(coordinates, index);
      return {
        id: `pole-${index + 1}`,
        kind: "pole",
        position: [longitude, latitude, 0],
        bearing,
        // This GLB's crossarm lies on its local Z axis after it is stood upright.
        modelYaw: (90 - bearing + 360) % 360,
      };
    }),
    conductors: CONDUCTOR_OFFSETS_METERS.flatMap((offset, sideIndex) => {
      const side = sideIndex === 0 ? "left" : "right";
      const path = offsetPath(coordinates, offset, height);
      return path.slice(0, -1).map((start, spanIndex) => {
        const spanPath = [start, path[spanIndex + 1]];
        return {
          id: `line-${spanIndex + 1}-${side}`,
          kind: "conductor",
          path: spanPath,
          lengthMeters: pathLengthMeters(spanPath),
        };
      });
    }),
    bounds: coordinates.reduce(
      ([west, south, east, north], [longitude, latitude]) => [
        Math.min(west, longitude),
        Math.min(south, latitude),
        Math.max(east, longitude),
        Math.max(north, latitude),
      ],
      [Infinity, Infinity, -Infinity, -Infinity],
    ),
  };
}

function boundsForCoordinates(coordinates) {
  return coordinates.reduce(
    ([west, south, east, north], [longitude, latitude]) => [
      Math.min(west, longitude),
      Math.min(south, latitude),
      Math.max(east, longitude),
      Math.max(north, latitude),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
}

function assetUrl(app, relativePath) {
  return (
    app.resolvePluginAssetUrl?.(PLUGIN_ID, relativePath) ??
    new URL(`plugins/${PLUGIN_ID}/${relativePath}`, document.baseURI).href
  );
}

function popupCoordinate(object, pickedCoordinate) {
  const coordinate = validCoordinate(object?.position) ?? validCoordinate(pickedCoordinate);
  if (coordinate) return coordinate;
  if (object?.path?.length) {
    return validCoordinate(object.path[Math.floor(object.path.length / 2)]);
  }
  return null;
}

function featureAsGeoJson(object) {
  const geometry = object?.path
    ? { type: "LineString", coordinates: object.path.map((coordinate) => coordinate.slice(0, 2)) }
    : { type: "Point", coordinates: object.position.slice(0, 2) };
  return {
    type: "Feature",
    properties: {
      ...(object.properties ?? {}),
      id: object.id,
      assetType: object.kind,
      ...(object.sourceName ? { source: object.sourceName } : {}),
      ...(Number.isFinite(object.bearing) ? { bearing: object.bearing } : {}),
      ...(Number.isFinite(object.lengthMeters) ? { lengthMeters: object.lengthMeters } : {}),
    },
    geometry,
  };
}

function createPopupAction(iconText, label, onSelect) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "distribution-network-popup-action";
  const icon = document.createElement("span");
  icon.className = "distribution-network-popup-action-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = iconText;
  const text = document.createElement("span");
  text.textContent = label;
  button.append(icon, text);
  button.addEventListener("click", onSelect);
  return button;
}

function showAssetPopup(object, coordinate) {
  const details = pickedFeatureDetails(object);
  const map = currentApp?.getMap?.();
  if (!details || !map || !coordinate) return false;
  assetPopup?.();
  assetPopup = null;

  const element = document.createElement("section");
  element.className = "distribution-network-popup-content";

  const coordinateBar = document.createElement("div");
  coordinateBar.className = "distribution-network-popup-coordinate";
  const pin = document.createElement("span");
  pin.setAttribute("aria-hidden", "true");
  pin.textContent = "⌖";
  const coordinateText = document.createElement("code");
  coordinateText.textContent = `${coordinate[1].toFixed(6)}, ${coordinate[0].toFixed(6)}`;
  coordinateBar.append(pin, coordinateText);

  const info = document.createElement("div");
  info.className = "distribution-network-popup-info";
  const title = document.createElement("h3");
  title.textContent = details.title;
  const rows = document.createElement("dl");
  for (const row of details.rows) {
    const term = document.createElement("dt");
    term.textContent = row.label;
    const value = document.createElement("dd");
    value.textContent = row.value;
    rows.append(term, value);
  }
  info.append(title, rows);

  const quickActions = document.createElement("div");
  quickActions.className = "distribution-network-popup-actions";
  const actionsLabel = document.createElement("p");
  actionsLabel.textContent = "Quick actions";
  quickActions.append(
    actionsLabel,
    createPopupAction("▤", "Open asset loader", () => currentApp?.openRightPanel?.(PANEL_ID)),
    createPopupAction("{}", "Copy as GeoJSON", (event) => {
      const button = event.currentTarget;
      const writeText = navigator.clipboard?.writeText?.bind(navigator.clipboard);
      if (!writeText) {
        button.lastElementChild.textContent = "Clipboard unavailable";
        return;
      }
      void writeText(JSON.stringify(featureAsGeoJson(object), null, 2))
        .then(() => {
          button.lastElementChild.textContent = "Copied GeoJSON";
        })
        .catch(() => {
          button.lastElementChild.textContent = "Could not copy";
        });
    }),
    createPopupAction("◎", "Center map here", () => {
      map.easeTo({ center: coordinate, duration: 350 });
    }),
    createPopupAction("＋", "Zoom to asset", () => {
      map.easeTo({ center: coordinate, zoom: Math.max(map.getZoom(), 18), duration: 450 });
    }),
  );

  element.append(coordinateBar, info, quickActions);
  assetPopup =
    currentApp?.openMapPopup?.({
      coordinates: coordinate,
      content: element,
      className: "distribution-network-asset-popup",
      closeOnClick: false,
      maxWidth: "300px",
    }) ?? null;
  if (!assetPopup) {
    currentApp?.openRightPanel?.(PANEL_ID);
  }
  return true;
}

function selectFeature(object, pickedCoordinate) {
  const details = pickedFeatureDetails(object);
  if (!details) return false;
  return showAssetPopup(object, popupCoordinate(object, pickedCoordinate));
}

function modelLayer(dataset) {
  return new deck.meshLayers.ScenegraphLayer({
    id: `${PLUGIN_ID}-${dataset.id}-models`,
    data: dataset.points,
    scenegraph: dataset.modelUrl,
    _lighting: "pbr",
    sizeScale: dataset.sizeScale,
    sizeMinPixels: 1,
    getPosition: (point) => point.position,
    getOrientation: (point) => [0, point.modelYaw ?? 0, 90],
    pickable: true,
    autoHighlight: true,
    highlightColor: [37, 99, 235, 180],
    onClick: ({ object, coordinate }) => selectFeature(object, coordinate),
  });
}

function renderLayers() {
  if (!overlay || !deck) return;
  const layers = [];
  for (const dataset of datasets) {
    if (dataset.conductors?.length) {
      layers.push(
        new deck.layers.PathLayer({
          id: `${PLUGIN_ID}-${dataset.id}-conductor-hit-targets`,
          data: dataset.conductors,
          getPath: (conductor) => conductor.path,
          getColor: [0, 0, 0, 0],
          getWidth: CONDUCTOR_HIT_WIDTH_PIXELS,
          widthUnits: "pixels",
          pickable: true,
          onClick: ({ object, coordinate }) => selectFeature(object, coordinate),
        }),
        new deck.layers.PathLayer({
          id: `${PLUGIN_ID}-${dataset.id}-conductors`,
          data: dataset.conductors,
          getPath: (conductor) => conductor.path,
          getColor: [15, 15, 15, 255],
          getWidth: 2,
          widthUnits: "pixels",
          widthMinPixels: 1,
          capRounded: true,
          jointRounded: true,
          pickable: true,
          autoHighlight: true,
          highlightColor: [37, 99, 235, 180],
          onClick: ({ object, coordinate }) => selectFeature(object, coordinate),
        }),
      );
    }
    layers.push(modelLayer(dataset));
  }
  overlay.setProps({ layers });
}

function fitDataset(bounds) {
  const map = currentApp?.getMap?.();
  map?.fitBounds(
    [
      [bounds[0], bounds[1]],
      [bounds[2], bounds[3]],
    ],
    { padding: 100, duration: 0 },
  );
  map?.easeTo({ bearing: -12, pitch: 62, duration: 0 });
}

function rememberObjectUrl(file) {
  const url = URL.createObjectURL(file);
  objectUrls.add(url);
  return url;
}

async function readGeoJson(file) {
  const parsed = JSON.parse(await file.text());
  if (parsed?.type !== "FeatureCollection") {
    throw new Error("Choose a GeoJSON FeatureCollection.");
  }
  return parsed;
}

async function bundledAssetFile(relativePath) {
  const response = await fetch(assetUrl(currentApp, relativePath));
  if (!response.ok) {
    throw new Error(`Could not load bundled asset ${relativePath} (HTTP ${response.status}).`);
  }
  const blob = await response.blob();
  const name = decodeURIComponent(relativePath.split("/").pop() ?? "asset");
  return new File([blob], name, { type: blob.type });
}

function currentMapBounds() {
  const bounds = currentApp?.getMap?.()?.getBounds?.();
  if (!bounds) throw new Error("The current map extent is unavailable.");
  return normalizedBounds([
    bounds.getWest(),
    bounds.getSouth(),
    bounds.getEast(),
    bounds.getNorth(),
  ]);
}

function geoJsonFile(data, name) {
  return new File([JSON.stringify(data)], name, { type: "application/geo+json" });
}

async function addPoleDataset(modelFile, geojsonFile, sizeScale) {
  const geojson = await readGeoJson(geojsonFile);
  const network = buildNetwork(geojson, CONDUCTOR_HEIGHT_METERS, Infinity);
  const modelUrl = rememberObjectUrl(modelFile);
  datasets.push({
    id: `poles-${nextDatasetId++}`,
    kind: "poles",
    modelUrl,
    points: network.poles,
    conductors: network.conductors,
    sizeScale,
  });
  renderLayers();
  fitDataset(network.bounds);
  return `Added ${network.poles.length} aligned poles and ${network.conductors.length} selectable line spans.`;
}

async function addTreeDataset(modelFile, geojsonFile, sizeScale) {
  const geojson = await readGeoJson(geojsonFile);
  const placements = treePlacements(geojson);
  if (placements.length === 0) {
    const sourceName = geojson.metadata?.source;
    throw new Error(
      sourceName
        ? `No trees from ${sourceName} were found in the current map view.`
        : "The tree GeoJSON has no valid coordinates.",
    );
  }
  const modelUrl = rememberObjectUrl(modelFile);
  const sourceName = geojson.metadata?.source ?? null;
  const treeDataset = {
    id: `trees-${nextDatasetId++}`,
    kind: "trees",
    modelUrl,
    points: placements.map(({ featureId, position, properties }, index) => {
      const [longitude, latitude] = position;
      const dbhInches = Number(properties.DBHINT ?? properties.dbh_in ?? properties.dbh);
      const heightMeters = Number(properties.height_m ?? properties.height);
      return {
        id:
          properties.FACILITYID ??
          properties.tree_id ??
          properties.id ??
          featureId ??
          `tree-${index + 1}`,
        kind: "tree",
        modelName: modelFile.name,
        sourceName: sourceName ?? properties.source ?? null,
        commonName: properties.COMMONNAME ?? properties.common_name ?? properties.species ?? null,
        latinName: properties.LATINNAME ?? properties.latin_name ?? null,
        dbhInches: Number.isFinite(dbhInches) ? dbhInches : null,
        heightMeters: Number.isFinite(heightMeters) ? heightMeters : null,
        locationType: properties.LOCTYPE ?? properties.location_type ?? null,
        properties,
        position: [longitude, latitude, 0],
      };
    }),
    sizeScale,
  };
  const replacedTreeUrls = datasets
    .filter((dataset) => dataset.kind === "trees" && !dataset.bundled)
    .map((dataset) => dataset.modelUrl);
  datasets = replaceImportedTreeDatasets(datasets, treeDataset);
  for (const url of replacedTreeUrls) {
    if (objectUrls.delete(url)) URL.revokeObjectURL(url);
  }
  renderLayers();
  fitDataset(boundsForCoordinates(placements.map((placement) => placement.position)));
  const truncatedMessage = geojson.metadata?.truncated
    ? ` Showing the first ${placements.length.toLocaleString()} trees for performance.`
    : "";
  return sourceName
    ? `Loaded ${placements.length.toLocaleString()} trees from ${sourceName} using ${modelFile.name}.${truncatedMessage}`
    : `Loaded ${placements.length.toLocaleString()} trees using ${modelFile.name}.`;
}

export function replaceImportedTreeDatasets(currentDatasets, replacement) {
  return [
    ...currentDatasets.filter((dataset) => dataset.kind !== "trees" || dataset.bundled),
    replacement,
  ];
}

function clearImportedDatasets() {
  const importedUrls = datasets.filter((dataset) => !dataset.bundled).map((dataset) => dataset.modelUrl);
  datasets = datasets.filter((dataset) => dataset.bundled);
  for (const url of importedUrls) {
    if (objectUrls.delete(url)) URL.revokeObjectURL(url);
  }
  renderLayers();
}

function createFileField(labelText, accept, fileType, defaultPath) {
  const label = document.createElement("label");
  label.className = "distribution-network-field";
  const text = document.createElement("span");
  text.className = "distribution-network-field-label";
  text.textContent = labelText;

  const picker = document.createElement("span");
  picker.className = "distribution-network-file-picker";
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.setAttribute("aria-label", labelText);

  const icon = document.createElement("span");
  icon.className = "distribution-network-file-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "↑";
  const details = document.createElement("span");
  details.className = "distribution-network-file-details";
  const filename = document.createElement("span");
  filename.className = "distribution-network-file-name";
  const defaultFileName = defaultPath ? defaultPath.split("/").pop() : null;
  filename.textContent = defaultFileName ?? "No file selected";
  const hint = document.createElement("span");
  hint.className = "distribution-network-file-hint";
  hint.textContent = defaultFileName ? `Bundled default · ${fileType}` : fileType;
  details.append(filename, hint);
  const browse = document.createElement("span");
  browse.className = "distribution-network-file-action";
  browse.textContent = "Browse";

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    filename.textContent = file?.name ?? defaultFileName ?? "No file selected";
    picker.dataset.selected = file || defaultFileName ? "true" : "false";
  });

  picker.dataset.selected = defaultFileName ? "true" : "false";

  picker.append(input, icon, details, browse);
  label.append(text, picker);
  return { label, input };
}

function createSelectField(labelText, choices, defaultValue) {
  const label = document.createElement("label");
  label.className = "distribution-network-field";
  const text = document.createElement("span");
  text.className = "distribution-network-field-label";
  text.textContent = labelText;
  const select = document.createElement("select");
  select.className = "distribution-network-select";
  select.setAttribute("aria-label", labelText);
  for (const choice of choices) {
    const option = document.createElement("option");
    option.value = choice.value;
    option.textContent = choice.label;
    select.append(option);
  }
  select.value = defaultValue;
  label.append(text, select);
  return { label, input: select };
}

function createScaleField(defaultValue) {
  const label = document.createElement("label");
  label.className = "distribution-network-field distribution-network-scale";
  const text = document.createElement("span");
  text.className = "distribution-network-field-label";
  text.textContent = "Model scale";
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0.01";
  input.step = "0.1";
  input.value = String(defaultValue);
  label.append(text, input);
  return { label, input };
}

function createImporterSection(options, status) {
  const section = document.createElement("section");
  section.className = "distribution-network-section";
  const headingGroup = document.createElement("div");
  headingGroup.className = "distribution-network-section-heading";
  const kicker = document.createElement("span");
  kicker.className = "distribution-network-kicker";
  kicker.textContent = options.kicker;
  const heading = document.createElement("h3");
  heading.textContent = options.title;
  headingGroup.append(kicker, heading);
  const description = document.createElement("p");
  description.textContent = options.description;
  const model = createFileField(
    options.modelLabel,
    ".glb,model/gltf-binary",
    "GLB model · max size depends on your browser",
    options.defaultModelPath,
  );
  const geojson = createFileField(
    options.geojsonLabel,
    ".geojson,.json,application/geo+json,application/json",
    "GeoJSON or JSON FeatureCollection",
    options.defaultGeojsonPath,
  );
  const locationSource = options.locationSources
    ? createSelectField(
        options.locationSourceLabel ?? "Location source",
        options.locationSources,
        options.defaultLocationSource ?? options.locationSources[0].value,
      )
    : null;
  const scale = createScaleField(options.defaultScale ?? 1);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "distribution-network-primary";
  button.textContent = options.buttonLabel;
  const selectedLocationSource = () => locationSource?.input.value ?? "default";
  const updateLocationSource = () => {
    if (locationSource) {
      geojson.label.hidden = selectedLocationSource() !== "file";
    }
  };
  const updateReadyState = () => {
    const hasModel = Boolean(model.input.files?.[0] || options.defaultModelPath);
    const source = selectedLocationSource();
    const hasGeojson =
      source === "boulder" ||
      (source === "file"
        ? Boolean(geojson.input.files?.[0])
        : Boolean(geojson.input.files?.[0] || options.defaultGeojsonPath));
    button.disabled = !(hasModel && hasGeojson);
  };
  model.input.addEventListener("change", updateReadyState);
  geojson.input.addEventListener("change", () => {
    if (locationSource && geojson.input.files?.[0]) locationSource.input.value = "file";
    updateLocationSource();
    updateReadyState();
  });
  locationSource?.input.addEventListener("change", () => {
    updateLocationSource();
    updateReadyState();
  });
  updateLocationSource();
  updateReadyState();
  button.addEventListener("click", () => {
    const selectedModelFile = model.input.files?.[0];
    const selectedGeojsonFile = geojson.input.files?.[0];
    const source = selectedLocationSource();
    if ((!selectedModelFile && !options.defaultModelPath) ||
        (source === "file" && !selectedGeojsonFile) ||
        (source !== "file" && source !== "boulder" &&
          !selectedGeojsonFile && !options.defaultGeojsonPath)) {
      status.textContent = "Choose both a GLB model and a GeoJSON file first.";
      status.dataset.state = "error";
      return;
    }
    const sizeScale = Number(scale.input.value);
    if (!Number.isFinite(sizeScale) || sizeScale <= 0) {
      status.textContent = "Model scale must be greater than zero.";
      status.dataset.state = "error";
      return;
    }
    button.disabled = true;
    status.textContent = "Loading assets…";
    status.dataset.state = "loading";
    const modelFilePromise = selectedModelFile
      ? Promise.resolve(selectedModelFile)
      : bundledAssetFile(options.defaultModelPath);
    let geojsonFilePromise;
    if (source === "boulder") {
      geojsonFilePromise = fetchBoulderTreeGeoJson(currentMapBounds()).then((geojsonData) =>
        geoJsonFile(geojsonData, "boulder-public-trees.geojson"),
      );
    } else if (source === "file" || selectedGeojsonFile) {
      geojsonFilePromise = Promise.resolve(selectedGeojsonFile);
    } else {
      geojsonFilePromise = bundledAssetFile(options.defaultGeojsonPath);
    }
    void Promise.all([modelFilePromise, geojsonFilePromise])
      .then(([modelFile, geojsonFile]) => options.add(modelFile, geojsonFile, sizeScale))
      .then((message) => {
        status.textContent = message;
        status.dataset.state = "success";
      })
      .catch((error) => {
        status.textContent = error instanceof Error ? error.message : "Could not add assets.";
        status.dataset.state = "error";
      })
      .finally(() => {
        updateReadyState();
      });
  });
  section.append(headingGroup, description);
  if (locationSource) section.append(locationSource.label);
  section.append(model.label, geojson.label, scale.label, button);
  return section;
}

function renderAssetPanel(container) {
  container.classList.add("distribution-network-panel");
  const intro = document.createElement("p");
  intro.className = "distribution-network-intro";
  intro.textContent = "Choose a model and placement data, then add it to the live map.";
  const status = document.createElement("p");
  status.className = "distribution-network-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.dataset.state = "success";
  status.textContent = "The bundled three-pole demo is loaded.";

  const poles = createImporterSection(
    {
      title: "Distribution poles",
      kicker: "Network assets",
      description: "Line vertices place aligned poles; one conductor follows each side.",
      modelLabel: "Pole model (GLB)",
      geojsonLabel: "Pole line or positions (GeoJSON)",
      buttonLabel: "Add poles and lines",
      defaultModelPath: BUNDLED_POLE_MODEL_PATH,
      defaultGeojsonPath: BUNDLED_POLE_GEOJSON_PATH,
      add: addPoleDataset,
    },
    status,
  );
  const trees = createImporterSection(
    {
      title: "Trees",
      kicker: "Vegetation",
      description:
        "Use bundled trees, upload GeoJSON, or query the live City of Boulder inventory in the current map view.",
      locationSourceLabel: "Tree location source",
      locationSources: [
        { value: "bundled", label: "Bundled synthetic trees" },
        { value: "boulder", label: "Boulder public trees · current view" },
        { value: "file", label: "Upload a GeoJSON file" },
      ],
      defaultLocationSource: "bundled",
      modelLabel: "Tree model (GLB)",
      geojsonLabel: "Tree locations (GeoJSON)",
      buttonLabel: "Add trees",
      defaultScale: TREE_DEFAULT_SCALE,
      defaultModelPath: BUNDLED_TREE_MODEL_PATH,
      defaultGeojsonPath: BUNDLED_TREE_GEOJSON_PATH,
      add: addTreeDataset,
    },
    status,
  );
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "distribution-network-secondary";
  clear.textContent = "Clear imported assets";
  clear.addEventListener("click", () => {
    clearImportedDatasets();
    status.textContent = "Imported assets cleared; bundled demo retained.";
    status.dataset.state = "success";
  });

  container.append(intro, poles, trees, clear, status);
  return () => container.replaceChildren();
}

function registerAssetUi(app) {
  unregisterPanel = app.registerRightPanel?.({
    id: PANEL_ID,
    title: "Distribution Assets",
    defaultWidth: 380,
    render: renderAssetPanel,
  });
  unregisterMenu = app.registerToolbarMenu?.({
    id: MENU_ID,
    label: "Distribution",
    items: [
      {
        id: "open-assets",
        label: "Open Distribution Assets…",
        onSelect: () => app.openRightPanel?.(PANEL_ID),
      },
      {
        id: "clear-assets",
        label: "Remove imported assets",
        onSelect: clearImportedDatasets,
      },
    ],
  });
  app.openRightPanel?.(PANEL_ID);
}

const plugin = {
  id: PLUGIN_ID,
  name: "Distribution Network Demo",
  version: "0.6.0",

  async activate(app) {
    if (!app.getDeckGL) {
      console.error("[Distribution Network] This GeoLibre host does not provide deck.gl.");
      return false;
    }

    const geojsonUrl = assetUrl(app, BUNDLED_POLE_GEOJSON_PATH);
    const modelUrl = assetUrl(app, BUNDLED_POLE_MODEL_PATH);
    const response = await fetch(geojsonUrl);
    if (!response.ok) {
      throw new Error(`Could not load the bundled power-line GeoJSON (HTTP ${response.status}).`);
    }

    const network = buildNetwork(await response.json());
    deck = await app.getDeckGL();
    overlay = new deck.mapbox.MapboxOverlay({
      interleaved: true,
      pickingRadius: PICKING_RADIUS_PIXELS,
      layers: [],
    });
    currentApp = app;
    previousProjection = app.getMapProjection?.() ?? null;
    app.setMapProjection?.("mercator");
    if (!app.addMapControl(overlay)) {
      overlay = null;
      deck = null;
      currentApp = null;
      if (previousProjection) app.setMapProjection?.(previousProjection);
      previousProjection = null;
      return false;
    }

    datasets = [
      {
        id: "bundled-poles",
        kind: "poles",
        bundled: true,
        modelUrl,
        points: network.poles,
        conductors: network.conductors,
        sizeScale: 1,
      },
    ];
    renderLayers();
    registerAssetUi(app);
    fitDataset(network.bounds);
    return true;
  },

  deactivate(app) {
    assetPopup?.();
    assetPopup = null;
    app.closeRightPanel?.(PANEL_ID);
    unregisterPanel?.();
    unregisterMenu?.();
    unregisterPanel = null;
    unregisterMenu = null;
    if (overlay) app.removeMapControl(overlay);
    overlay = null;
    deck = null;
    currentApp = null;
    datasets = [];
    for (const url of objectUrls) URL.revokeObjectURL(url);
    objectUrls.clear();
    if (previousProjection) app.setMapProjection?.(previousProjection);
    previousProjection = null;
  },
};

export { plugin };
export default plugin;
