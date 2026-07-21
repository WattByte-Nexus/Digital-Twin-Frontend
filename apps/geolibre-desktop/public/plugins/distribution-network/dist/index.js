const PLUGIN_ID = "distribution-network";
const CONDUCTOR_HEIGHT_METERS = 8.2;

let overlay = null;
let previousProjection = null;

function lineCoordinates(geojson) {
  const features = geojson?.type === "FeatureCollection" ? geojson.features : [];
  for (const feature of features) {
    if (feature?.geometry?.type === "LineString") return feature.geometry.coordinates;
    if (feature?.geometry?.type === "MultiLineString") {
      const coordinates = feature.geometry.coordinates.find((line) => line.length >= 3);
      if (coordinates) return coordinates;
    }
  }
  return [];
}

export function buildNetwork(geojson, height = CONDUCTOR_HEIGHT_METERS) {
  const coordinates = lineCoordinates(geojson)
    .slice(0, 3)
    .map((coordinate) => [Number(coordinate[0]), Number(coordinate[1])])
    .filter(([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude));

  if (coordinates.length !== 3) {
    throw new Error("The bundled GeoJSON needs a line with at least three valid coordinates.");
  }

  return {
    poles: coordinates.map(([longitude, latitude], index) => ({
      id: `pole-${index + 1}`,
      position: [longitude, latitude, 0],
    })),
    spans: [
      {
        id: "span-1",
        path: [
          [...coordinates[0], height],
          [...coordinates[1], height],
        ],
      },
      {
        id: "span-2",
        path: [
          [...coordinates[1], height],
          [...coordinates[2], height],
        ],
      },
    ],
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

function assetUrl(app, relativePath) {
  return (
    app.resolvePluginAssetUrl?.(PLUGIN_ID, relativePath) ??
    new URL(`plugins/${PLUGIN_ID}/${relativePath}`, document.baseURI).href
  );
}

const plugin = {
  id: PLUGIN_ID,
  name: "Distribution Network Demo",
  version: "0.1.0",

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
    const deck = await app.getDeckGL();

    const conductorLayer = new deck.layers.PathLayer({
      id: "distribution-network-conductors",
      data: network.spans,
      getPath: (span) => span.path,
      getColor: [255, 174, 0, 255],
      getWidth: 4,
      widthUnits: "pixels",
      widthMinPixels: 2,
      capRounded: true,
      jointRounded: true,
      pickable: true,
    });

    const poleLayer = new deck.meshLayers.ScenegraphLayer({
      id: "distribution-network-poles",
      data: network.poles,
      scenegraph: modelUrl,
      _lighting: "pbr",
      sizeScale: 1,
      sizeMinPixels: 1,
      getPosition: (pole) => pole.position,
      getOrientation: [0, 0, 90],
      pickable: true,
    });

    overlay = new deck.mapbox.MapboxOverlay({
      interleaved: true,
      layers: [conductorLayer, poleLayer],
    });

    previousProjection = app.getMapProjection?.() ?? null;
    app.setMapProjection?.("mercator");
    if (!app.addMapControl(overlay)) {
      overlay = null;
      if (previousProjection) app.setMapProjection?.(previousProjection);
      previousProjection = null;
      return false;
    }

    const map = app.getMap?.();
    map?.fitBounds(
      [
        [network.bounds[0], network.bounds[1]],
        [network.bounds[2], network.bounds[3]],
      ],
      { padding: 100, duration: 0 },
    );
    map?.easeTo({ bearing: -12, pitch: 62, duration: 0 });
    return true;
  },

  deactivate(app) {
    if (overlay) app.removeMapControl(overlay);
    overlay = null;
    if (previousProjection) app.setMapProjection?.(previousProjection);
    previousProjection = null;
  },
};

export { plugin };
export default plugin;
