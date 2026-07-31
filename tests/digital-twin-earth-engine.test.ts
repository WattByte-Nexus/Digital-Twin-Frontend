import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fetchDigitalTwinEarthEngineCatalog,
  groupDigitalTwinEarthEngineLayers,
  normalizeDigitalTwinApiUrl,
  prepareDigitalTwinEarthEngineCog,
} from "../apps/geolibre-desktop/src/lib/digital-twin-earth-engine";

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status });
}

describe("Digital Twin Earth Engine catalog", () => {
  it("normalizes absolute HTTP API URLs", () => {
    assert.equal(normalizeDigitalTwinApiUrl("https://engine.example.com/api/?debug=1#x"), "https://engine.example.com/api");
    assert.throws(() => normalizeDigitalTwinApiUrl("file:///tmp/engine"), /HTTP or HTTPS/);
  });

  it("discovers COG descriptors across published regions", async () => {
    const calls: string[] = [];
    const fetchImpl = async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/api/v1/regions?limit=100")) {
        return json({
          items: [
            { region_id: "boulder-co", name: "Boulder" },
            { region_id: "golden-co", name: "Golden" },
          ],
        });
      }
      if (url.includes("boulder-co")) {
        return json({
          items: [
            {
              layer_id: "earth-engine-boulder-co-evt",
              name: "Existing vegetation type",
              format: "cog",
              band: "evt",
              url: "/api/v1/regions/boulder-co/earth-engine/evt.cog.tif",
              default_style: { colormap: "terrain", rescale_min: 1, rescale_max: 10 },
            },
            {
              layer_id: "earth-engine-boulder-co-evc",
              name: "Existing vegetation cover",
              format: "cog",
              band: "evc",
              url: "/api/v1/regions/boulder-co/earth-engine/evc.cog.tif",
            },
            { layer_id: "legacy", format: "xyz", url: "https://tiles.example.com/{z}" },
          ],
        });
      }
      return json({
        items: [
          {
            layer_id: "earth-engine-golden-co-evc",
            name: "Existing vegetation cover",
            format: "cog",
            band: "evc",
            tile_url: "https://cdn.example.com/golden-evc.tif",
          },
          {
            layer_id: "earth-engine-golden-co-evt",
            name: "Existing vegetation type",
            format: "cog",
            band: "evt",
            tile_url: "https://cdn.example.com/golden-evt.tif",
            artifact_ready: true,
          },
        ],
      });
    };

    const catalog = await fetchDigitalTwinEarthEngineCatalog("https://engine.example.com/", {
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.equal(catalog.layers.length, 4);
    assert.deepEqual(
      catalog.layers.map((layer) => [layer.name, layer.regionName, layer.url]),
      [
        [
          "Existing vegetation cover",
          "Boulder",
          "https://engine.example.com/api/v1/regions/boulder-co/earth-engine/evc.cog.tif",
        ],
        ["Existing vegetation cover", "Golden", "https://cdn.example.com/golden-evc.tif"],
        [
          "Existing vegetation type",
          "Boulder",
          "https://engine.example.com/api/v1/regions/boulder-co/earth-engine/evt.cog.tif",
        ],
        ["Existing vegetation type", "Golden", "https://cdn.example.com/golden-evt.tif"],
      ],
    );
    assert.equal(catalog.layers[2]?.style.colormap, "terrain");
    assert.equal(calls.length, 3);

    const datasets = groupDigitalTwinEarthEngineLayers(catalog.layers);
    assert.equal(datasets.length, 2);
    assert.deepEqual(
      datasets.map((dataset) => [
        dataset.id,
        dataset.name,
        dataset.layers.map((layer) => layer.regionName),
      ]),
      [
        ["evc", "Existing vegetation cover", ["Boulder", "Golden"]],
        ["evt", "Existing vegetation type", ["Boulder", "Golden"]],
      ],
    );
    assert.equal(datasets[1]?.primaryLayer.regionName, "Golden");
  });

  it("prepares an unready COG with a bounded HEAD request", async () => {
    const requests: Array<{ url: string; method?: string }> = [];
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(input), method: init?.method });
      return new Response(null, {
        status: 200,
        headers: { "accept-ranges": "bytes", "content-type": "image/tiff" },
      });
    };

    await prepareDigitalTwinEarthEngineCog(
      {
        id: "boulder:evt",
        layerId: "earth-engine-boulder-co-evt",
        name: "Existing vegetation type",
        band: "evt",
        url: "https://engine.example.com/api/v1/map-layers/evt/data.tif",
        regionId: "boulder-co",
        regionName: "Boulder",
        artifactReady: false,
        sourceReady: true,
        style: {},
      },
      { fetchImpl: fetchImpl as typeof fetch, timeoutMs: 50 },
    );

    assert.deepEqual(requests, [
      {
        url: "https://engine.example.com/api/v1/map-layers/evt/data.tif",
        method: "HEAD",
      },
    ]);
  });

  it("fails preparation instead of leaving an unready COG loading forever", async () => {
    const fetchImpl = (_input: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      });

    await assert.rejects(
      prepareDigitalTwinEarthEngineCog(
        {
          id: "boulder:evt",
          layerId: "earth-engine-boulder-co-evt",
          name: "Existing vegetation type",
          band: "evt",
          url: "https://engine.example.com/api/v1/map-layers/evt/data.tif",
          regionId: "boulder-co",
          regionName: "Boulder",
          artifactReady: false,
          sourceReady: true,
          style: {},
        },
        { fetchImpl: fetchImpl as typeof fetch, timeoutMs: 5 },
      ),
      /did not prepare this COG within 5 ms/,
    );
  });

  it("keeps healthy region catalogs when one region endpoint is unavailable", async () => {
    const fetchImpl = async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/api/v1/regions?limit=100")) {
        return json({
          items: [
            { region_id: "healthy", name: "Healthy" },
            { region_id: "missing", name: "Missing" },
          ],
        });
      }
      if (url.includes("/missing/")) return json({ detail: "Not downloaded" }, 404);
      return json({
        items: [
          { layer_id: "dem", name: "Elevation", format: "cog", url: "/cogs/dem.tif" },
        ],
      });
    };

    const catalog = await fetchDigitalTwinEarthEngineCatalog("http://localhost:8000", {
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.equal(catalog.layers.length, 1);
    assert.deepEqual(catalog.unavailableRegions, ["Missing"]);
  });
});
