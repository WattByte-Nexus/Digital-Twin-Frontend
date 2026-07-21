const PLUGIN_ID = "distribution-network";
const PANEL_ID = "distribution-network-assets";
const MENU_ID = "distribution-network-menu";
const CONDUCTOR_HEIGHT_METERS = 8.2;
const CONDUCTOR_OFFSETS_METERS = [-2, -1, 1, 2];

let overlay = null;
let deck = null;
let currentApp = null;
let previousProjection = null;
let unregisterPanel = null;
let unregisterMenu = null;
let nextDatasetId = 1;
let datasets = [];
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
  const coordinates = [];
  const features = geojson?.type === "FeatureCollection" ? geojson.features : [];
  for (const feature of features) collectGeometryCoordinates(feature?.geometry, coordinates);

  const seen = new Set();
  return coordinates.filter((coordinate) => {
    const key = coordinate.join(",");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
    poles: coordinates.map(([longitude, latitude], index) => ({
      id: `pole-${index + 1}`,
      position: [longitude, latitude, 0],
    })),
    conductors: CONDUCTOR_OFFSETS_METERS.map((offset, index) => ({
      id: `conductor-${index + 1}`,
      path: offsetPath(coordinates, offset, height),
    })),
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

function modelLayer(dataset) {
  return new deck.meshLayers.ScenegraphLayer({
    id: `${PLUGIN_ID}-${dataset.id}-models`,
    data: dataset.points,
    scenegraph: dataset.modelUrl,
    _lighting: "pbr",
    sizeScale: dataset.sizeScale,
    sizeMinPixels: 1,
    getPosition: (point) => point.position,
    getOrientation: [0, 0, 90],
    pickable: true,
  });
}

function renderLayers() {
  if (!overlay || !deck) return;
  const layers = [];
  for (const dataset of datasets) {
    if (dataset.conductors?.length) {
      layers.push(
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
  return `Added ${network.poles.length} poles and four black conductors.`;
}

async function addTreeDataset(modelFile, geojsonFile, sizeScale) {
  const geojson = await readGeoJson(geojsonFile);
  const coordinates = placementCoordinates(geojson);
  if (coordinates.length === 0) throw new Error("The tree GeoJSON has no valid coordinates.");
  const modelUrl = rememberObjectUrl(modelFile);
  datasets.push({
    id: `trees-${nextDatasetId++}`,
    kind: "trees",
    modelUrl,
    points: coordinates.map(([longitude, latitude], index) => ({
      id: `tree-${index + 1}`,
      position: [longitude, latitude, 0],
    })),
    sizeScale,
  });
  renderLayers();
  fitDataset(boundsForCoordinates(coordinates));
  return `Added ${coordinates.length} trees.`;
}

function clearImportedDatasets() {
  const importedUrls = datasets.filter((dataset) => !dataset.bundled).map((dataset) => dataset.modelUrl);
  datasets = datasets.filter((dataset) => dataset.bundled);
  for (const url of importedUrls) {
    if (objectUrls.delete(url)) URL.revokeObjectURL(url);
  }
  renderLayers();
}

function createFileField(labelText, accept) {
  const label = document.createElement("label");
  label.className = "distribution-network-field";
  const text = document.createElement("span");
  text.textContent = labelText;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  label.append(text, input);
  return { label, input };
}

function createScaleField(defaultValue) {
  const label = document.createElement("label");
  label.className = "distribution-network-field distribution-network-scale";
  const text = document.createElement("span");
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
  const heading = document.createElement("h3");
  heading.textContent = options.title;
  const description = document.createElement("p");
  description.textContent = options.description;
  const model = createFileField(`${options.modelLabel} (.glb)`, ".glb,model/gltf-binary");
  const geojson = createFileField(`${options.geojsonLabel} (.geojson)`, ".geojson,.json,application/geo+json,application/json");
  const scale = createScaleField(1);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "distribution-network-primary";
  button.textContent = options.buttonLabel;
  button.addEventListener("click", () => {
    const modelFile = model.input.files?.[0];
    const geojsonFile = geojson.input.files?.[0];
    if (!modelFile || !geojsonFile) {
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
    void options
      .add(modelFile, geojsonFile, sizeScale)
      .then((message) => {
        status.textContent = message;
        status.dataset.state = "success";
      })
      .catch((error) => {
        status.textContent = error instanceof Error ? error.message : "Could not add assets.";
        status.dataset.state = "error";
      })
      .finally(() => {
        button.disabled = false;
      });
  });
  section.append(heading, description, model.label, geojson.label, scale.label, button);
  return section;
}

function renderAssetPanel(container) {
  container.classList.add("distribution-network-panel");
  const intro = document.createElement("p");
  intro.className = "distribution-network-intro";
  intro.textContent = "Choose a model and placement data, then add it to the live map.";
  const status = document.createElement("p");
  status.className = "distribution-network-status";
  status.textContent = "The bundled three-pole demo is loaded.";

  const poles = createImporterSection(
    {
      title: "Distribution poles",
      description: "Line vertices place poles; four parallel conductors follow the line.",
      modelLabel: "Pole model",
      geojsonLabel: "Pole line / positions",
      buttonLabel: "Add poles and lines",
      add: addPoleDataset,
    },
    status,
  );
  const trees = createImporterSection(
    {
      title: "Trees",
      description: "Each unique GeoJSON coordinate receives one tree model.",
      modelLabel: "Tree model",
      geojsonLabel: "Tree locations",
      buttonLabel: "Add trees",
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
    defaultWidth: 340,
    render: renderAssetPanel,
  });
  unregisterMenu = app.registerToolbarMenu?.({
    id: MENU_ID,
    label: "Distribution",
    items: [
      {
        id: "open-assets",
        label: "Open asset loader",
        onSelect: () => app.openRightPanel?.(PANEL_ID),
      },
      {
        id: "clear-assets",
        label: "Clear imported assets",
        onSelect: clearImportedDatasets,
      },
    ],
  });
  app.openRightPanel?.(PANEL_ID);
}

const plugin = {
  id: PLUGIN_ID,
  name: "Distribution Network Demo",
  version: "0.2.0",

  async activate(app) {
    if (!app.getDeckGL) {
      console.error("[Distribution Network] This GeoLibre host does not provide deck.gl.");
      return false;
    }

    const geojsonUrl = assetUrl(app, "assets/testpowerlines.geojson");
    const modelUrl = assetUrl(app, "assets/13.8kv_power_pole.glb");
    const response = await fetch(geojsonUrl);
    if (!response.ok) {
      throw new Error(`Could not load the bundled power-line GeoJSON (HTTP ${response.status}).`);
    }

    const network = buildNetwork(await response.json());
    deck = await app.getDeckGL();
    overlay = new deck.mapbox.MapboxOverlay({ interleaved: true, layers: [] });
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
