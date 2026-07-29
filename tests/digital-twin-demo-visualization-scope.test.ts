import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  groupVisualizationDescriptors,
  loadPublishedVisualizationCatalogs,
} from "../apps/geolibre-desktop/public/plugins/digital-twin-demo/dist/index.js";

describe("digital twin visualization scope", () => {
  it("loads weather and Earth Engine descriptors for every published coverage", async () => {
    const calls: string[] = [];
    const regions = [
      { region_id: "boulder-co", name: "Boulder" },
      { region_id: "golden-co", name: "Golden" },
    ];
    const client = {
      async getWeatherDatasets(regionId: string) {
        calls.push(`weather:${regionId}`);
        return {
          items: [
            {
              dataset_id: `weather:${regionId}:latest`,
              version: "2026-07-29T18:00:00Z",
              ready: true,
            },
          ],
        };
      },
      async getEarthEngineMetadata(regionId: string) {
        calls.push(`earth-metadata:${regionId}`);
        return { ready: true, datasets: ["evt", "evc"] };
      },
      async getEarthEngineMapLayers(regionId: string) {
        calls.push(`earth-layers:${regionId}`);
        return {
          items: [
            {
              layer_id: `earth-engine-${regionId}-evt`,
              name: "Existing vegetation type",
              category: "earth_engine",
              format: "cog",
              band: "evt",
            },
          ],
        };
      },
      async getWeatherMapLayers(regionId: string, datasetId: string) {
        calls.push(`weather-layers:${regionId}:${datasetId}`);
        return {
          items: [
            {
              layer_id: `weather-${regionId}-wind`,
              name: "Wind speed",
              category: "weather",
              format: "cog",
              band: "wind_velocity",
            },
          ],
        };
      },
    };

    const catalogs = await loadPublishedVisualizationCatalogs(client, regions);

    assert.deepEqual(
      catalogs.map((catalog) => catalog.region.region_id),
      ["boulder-co", "golden-co"],
    );
    assert.deepEqual(
      catalogs.flatMap((catalog) =>
        catalog.earthEngineDescriptors.map((descriptor) => descriptor.coverage_region_id),
      ),
      ["boulder-co", "golden-co"],
    );
    assert.deepEqual(
      catalogs.flatMap((catalog) =>
        catalog.weatherDescriptors.map((descriptor) => descriptor.coverage_region_id),
      ),
      ["boulder-co", "golden-co"],
    );
    assert.deepEqual(
      calls.sort(),
      [
        "earth-layers:boulder-co",
        "earth-layers:golden-co",
        "earth-metadata:boulder-co",
        "earth-metadata:golden-co",
        "weather-layers:boulder-co:weather:boulder-co:latest",
        "weather-layers:golden-co:weather:golden-co:latest",
        "weather:boulder-co",
        "weather:golden-co",
      ],
    );
  });

  it("groups matching regional descriptors into one add-all visualization", () => {
    const groups = groupVisualizationDescriptors([
      {
        layer_id: "earth-engine-boulder-co-evc",
        name: "Existing vegetation cover",
        category: "earth_engine",
        format: "cog",
        band: "evc",
        coverage_region_id: "boulder-co",
      },
      {
        layer_id: "earth-engine-golden-co-evc",
        name: "Existing vegetation cover",
        category: "earth_engine",
        format: "cog",
        band: "evc",
        coverage_region_id: "golden-co",
      },
    ]);

    assert.equal(groups.length, 1);
    assert.equal(groups[0].band, "evc");
    assert.deepEqual(
      groups[0].descriptors.map((descriptor) => descriptor.layer_id),
      ["earth-engine-boulder-co-evc", "earth-engine-golden-co-evc"],
    );
  });

  it("keeps healthy coverage when another regional descriptor endpoint fails", async () => {
    const regions = [
      { region_id: "boulder-co", name: "Boulder" },
      { region_id: "golden-co", name: "Golden" },
    ];
    const client = {
      async getWeatherDatasets() {
        return { items: [] };
      },
      async getEarthEngineMetadata(regionId: string) {
        return { ready: regionId === "boulder-co", datasets: ["evt"] };
      },
      async getEarthEngineMapLayers(regionId: string) {
        if (regionId === "golden-co") throw new Error("Coverage unavailable");
        return {
          items: [
            {
              layer_id: "earth-engine-boulder-co-evt",
              category: "earth_engine",
              format: "cog",
              band: "evt",
            },
          ],
        };
      },
      async getWeatherMapLayers() {
        throw new Error("No weather dataset should be requested");
      },
    };

    const catalogs = await loadPublishedVisualizationCatalogs(client, regions);

    assert.equal(catalogs.length, 2);
    assert.equal(catalogs[0].earthEngineDescriptors.length, 1);
    assert.deepEqual(catalogs[1].earthEngineDescriptors, []);
  });
});
