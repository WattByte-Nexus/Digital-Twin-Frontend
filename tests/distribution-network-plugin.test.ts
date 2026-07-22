import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  BUNDLED_POLE_GEOJSON_PATH,
  BUNDLED_POLE_MODEL_PATH,
  BUNDLED_TREE_GEOJSON_PATH,
  BUNDLED_TREE_MODEL_PATH,
  BOULDER_TREE_PAGE_SIZE,
  BOULDER_TREE_SERVICE_URL,
  buildNetwork,
  buildBoulderTreeQueryUrl,
  CONDUCTOR_HIT_WIDTH_PIXELS,
  CONDUCTOR_HIT_TARGET_PARAMETERS,
  fetchBoulderTreeGeoJson,
  PICKING_RADIUS_PIXELS,
  TREE_DEFAULT_SCALE,
  pickedFeatureDetails,
  placementCoordinates,
  replaceImportedTreeDatasets,
  scenegraphSizingProps,
  treePlacements,
} from "../apps/geolibre-desktop/public/plugins/distribution-network/dist/index.js";

const pluginRoot = new URL(
  "../apps/geolibre-desktop/public/plugins/distribution-network/",
  import.meta.url,
);

describe("distribution-network bundled plugin", () => {
  it("ships usable pole and tree defaults for both importers", async () => {
    assert.equal(BUNDLED_POLE_MODEL_PATH, "assets/13.8kv_power_pole.glb");
    assert.equal(BUNDLED_POLE_GEOJSON_PATH, "assets/testpowerlines.geojson");
    assert.equal(
      BUNDLED_TREE_MODEL_PATH,
      "assets/low_poly_forest_tree_assets/tree_07.glb",
    );
    assert.equal(BUNDLED_TREE_GEOJSON_PATH, "assets/testtrees.geojson");

    const [poleModel, treeModel, poleGeojson, treeGeojson] = await Promise.all([
      readFile(new URL(BUNDLED_POLE_MODEL_PATH, pluginRoot)),
      readFile(new URL(BUNDLED_TREE_MODEL_PATH, pluginRoot)),
      readFile(new URL(BUNDLED_POLE_GEOJSON_PATH, pluginRoot), "utf8"),
      readFile(new URL(BUNDLED_TREE_GEOJSON_PATH, pluginRoot), "utf8"),
    ]);
    assert.ok(poleModel.byteLength > 0);
    assert.ok(treeModel.byteLength > 0);
    assert.equal(JSON.parse(poleGeojson).type, "FeatureCollection");
    assert.equal(JSON.parse(treeGeojson).type, "FeatureCollection");
  });

  it("defaults tree imports to a realistic mature roadside-tree scale", () => {
    assert.equal(TREE_DEFAULT_SCALE, 0.5);
  });

  it("keeps scenegraph scale in world units at every zoom level", () => {
    assert.deepEqual(scenegraphSizingProps(TREE_DEFAULT_SCALE), {
      sizeScale: 0.5,
      sizeMinPixels: 0,
      sizeMaxPixels: Number.MAX_SAFE_INTEGER,
    });
  });

  it("provides a forgiving pointer hit area for thin distribution assets", () => {
    assert.ok(PICKING_RADIUS_PIXELS >= 6);
    assert.ok(CONDUCTOR_HIT_WIDTH_PIXELS >= 16);
  });

  it("keeps the invisible conductor hit target out of the depth buffer", () => {
    assert.deepEqual(CONDUCTOR_HIT_TARGET_PARAMETERS, {
      depthWriteEnabled: false,
    });
  });

  it("builds one conductor on each side over two spans and three aligned poles", async () => {
    const geojson = JSON.parse(
      await readFile(new URL("assets/testpowerlines.geojson", pluginRoot), "utf8"),
    );
    const network = buildNetwork(geojson);

    assert.equal(network.conductors.length, 4);
    assert.equal(network.poles.length, 3);
    assert.ok(network.conductors.every((conductor) => conductor.path.length === 2));
    assert.equal(
      new Set(network.conductors.map((conductor) => conductor.path[0].slice(0, 2).join(",")))
        .size,
      4,
    );
    assert.deepEqual(
      network.poles.map((pole) => pole.position.slice(0, 2)),
      [
        [-105.208906, 40.025324],
        [-105.209022, 40.024218],
        [-105.208791, 40.023422],
      ],
    );
    assert.ok(network.poles.every((pole) => Number.isFinite(pole.bearing)));
    assert.ok(network.conductors.every((conductor) => conductor.lengthMeters > 0));
  });

  it("describes clicked poles by ID and clicked lines by length", () => {
    const network = buildNetwork({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: [[0, 0], [0, 0.001]] },
        },
      ],
    });

    assert.deepEqual(pickedFeatureDetails(network.poles[0]), {
      title: "Distribution pole",
      rows: [{ label: "Pole ID", value: "pole-1" }],
    });
    assert.deepEqual(pickedFeatureDetails(network.conductors[0]), {
      title: "Distribution line",
      rows: [
        { label: "Line ID", value: "line-1-left" },
        { label: "Length", value: "111 m" },
      ],
    });
  });

  it("extracts unique model placements from point GeoJSON", () => {
    assert.deepEqual(
      placementCoordinates({
        type: "FeatureCollection",
        features: [
          { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [1, 2] } },
          {
            type: "Feature",
            properties: {},
            geometry: { type: "MultiPoint", coordinates: [[3, 4], [1, 2]] },
          },
        ],
      }),
      [[1, 2], [3, 4]],
    );
  });

  it("builds a paginated Boulder tree query for a WGS84 viewport", () => {
    const url = new URL(buildBoulderTreeQueryUrl([-105.21, 40.01, -105.18, 40.03], 2000));

    assert.equal(`${url.origin}${url.pathname}`, BOULDER_TREE_SERVICE_URL);
    assert.equal(url.searchParams.get("geometry"), "-105.21,40.01,-105.18,40.03");
    assert.equal(url.searchParams.get("geometryType"), "esriGeometryEnvelope");
    assert.equal(url.searchParams.get("inSR"), "4326");
    assert.equal(url.searchParams.get("outSR"), "4326");
    assert.equal(url.searchParams.get("resultOffset"), "2000");
    assert.equal(url.searchParams.get("resultRecordCount"), String(BOULDER_TREE_PAGE_SIZE));
    assert.equal(url.searchParams.get("f"), "geojson");
    assert.match(url.searchParams.get("outFields") ?? "", /FACILITYID/);
  });

  it("paginates and combines Boulder tree GeoJSON results", async () => {
    const pages = [
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [-105.2, 40.02] },
            properties: { OBJECTID: 1, FACILITYID: "TREE1" },
          },
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [-105.19, 40.021] },
            properties: { OBJECTID: 2, FACILITYID: "TREE2" },
          },
        ],
        properties: { exceededTransferLimit: true },
      },
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [-105.18, 40.022] },
            properties: { OBJECTID: 3, FACILITYID: "TREE3" },
          },
        ],
      },
    ];
    const requestedUrls: string[] = [];
    const fetchImpl = async (url: string | URL | Request) => {
      requestedUrls.push(String(url));
      return {
        ok: true,
        json: async () => pages.shift(),
      } as Response;
    };

    const result = await fetchBoulderTreeGeoJson(
      [-105.21, 40.01, -105.17, 40.03],
      fetchImpl,
      { pageSize: 2, maxFeatures: 10 },
    );

    assert.equal(result.features.length, 3);
    assert.equal(result.metadata.source, "City of Boulder public tree inventory");
    assert.equal(result.metadata.truncated, false);
    assert.equal(new URL(requestedUrls[0]).searchParams.get("resultOffset"), "0");
    assert.equal(new URL(requestedUrls[1]).searchParams.get("resultOffset"), "2");
  });

  it("keeps inventory attributes with each tree placement", () => {
    const placements = treePlacements({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          id: 42,
          geometry: { type: "Point", coordinates: [-105.2, 40.02] },
          properties: {
            FACILITYID: "TREE42",
            COMMONNAME: "Oak, Bur",
            LATINNAME: "Quercus macrocarpa",
            DBHINT: 12,
          },
        },
      ],
    });

    assert.deepEqual(placements, [
      {
        featureId: 42,
        position: [-105.2, 40.02],
        properties: {
          FACILITYID: "TREE42",
          COMMONNAME: "Oak, Bur",
          LATINNAME: "Quercus macrocarpa",
          DBHINT: 12,
        },
      },
    ]);
  });

  it("replaces the previous imported tree model instead of stacking models", () => {
    const bundledPoles = { id: "bundled-poles", kind: "poles", bundled: true };
    const oldTrees = { id: "trees-1", kind: "trees", modelUrl: "blob:pine" };
    const replacement = { id: "trees-2", kind: "trees", modelUrl: "blob:oak" };

    assert.deepEqual(
      replaceImportedTreeDatasets([bundledPoles, oldTrees], replacement),
      [bundledPoles, replacement],
    );
  });

  it("shows which model a selected tree is using", () => {
    assert.deepEqual(
      pickedFeatureDetails({ id: "tree-1", kind: "tree", modelName: "tree_07.glb" }),
      {
        title: "Tree",
        rows: [
          { label: "Tree ID", value: "tree-1" },
          { label: "Model", value: "tree_07.glb" },
        ],
      },
    );
  });

  it("shows Boulder inventory details for a selected tree", () => {
    assert.deepEqual(
      pickedFeatureDetails({
        id: "TREE42",
        kind: "tree",
        modelName: "tree_01.glb",
        commonName: "Oak, Bur",
        latinName: "Quercus macrocarpa",
        dbhInches: 12,
        locationType: "Street",
        sourceName: "City of Boulder public tree inventory",
      }),
      {
        title: "Tree",
        rows: [
          { label: "Tree ID", value: "TREE42" },
          { label: "Species", value: "Oak, Bur" },
          { label: "Scientific name", value: "Quercus macrocarpa" },
          { label: "DBH", value: "12 in" },
          { label: "Location", value: "Street" },
          { label: "Source", value: "City of Boulder public tree inventory" },
          { label: "Model", value: "tree_01.glb" },
        ],
      },
    );
  });

  it("connects point-based pole positions when no line geometry is present", () => {
    const network = buildNetwork({
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [-105, 40] } },
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [-105.001, 40.001] },
        },
      ],
    });

    assert.equal(network.poles.length, 2);
    assert.equal(network.conductors.length, 2);
    assert.ok(network.conductors.every((conductor) => conductor.path.length === 2));
  });

  it("aligns each pole with the local line bearing", () => {
    const network = buildNetwork({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [[0, 0], [0, 1], [1, 1]],
          },
        },
      ],
    });

    assert.ok(Math.abs(network.poles[0].bearing - 0) < 0.01);
    assert.ok(Math.abs(network.poles[1].bearing - 45) < 1);
    assert.ok(Math.abs(network.poles[2].bearing - 90) < 0.01);
    assert.ok(Math.abs(network.poles[0].modelYaw - 90) < 0.01);
    assert.ok(Math.abs(network.poles[1].modelYaw - 45) < 1);
    assert.ok(Math.abs(network.poles[2].modelYaw - 0) < 0.01);
  });

  it("declares a matching active-by-default plugin manifest", async () => {
    const manifest = JSON.parse(await readFile(new URL("plugin.json", pluginRoot), "utf8"));
    const { default: plugin } = await import(
      "../apps/geolibre-desktop/public/plugins/distribution-network/dist/index.js"
    );

    assert.equal(manifest.activeByDefault, true);
    assert.equal(manifest.style, "dist/style.css");
    assert.equal(plugin.id, manifest.id);
    assert.equal(plugin.name, manifest.name);
    assert.equal(plugin.version, manifest.version);
  });
});
