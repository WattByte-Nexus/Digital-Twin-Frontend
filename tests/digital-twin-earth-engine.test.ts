import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fetchDigitalTwinEarthEngineCatalog,
  normalizeDigitalTwinApiUrl,
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
              layer_id: "evt",
              name: "Existing vegetation type",
              format: "cog",
              band: "evt",
              url: "/api/v1/regions/boulder-co/earth-engine/evt.cog.tif",
              default_style: { colormap: "terrain", rescale_min: 1, rescale_max: 10 },
            },
            { layer_id: "legacy", format: "xyz", url: "https://tiles.example.com/{z}" },
          ],
        });
      }
      return json({
        items: [
          {
            layer_id: "evc",
            name: "Existing vegetation cover",
            format: "cog",
            tile_url: "https://cdn.example.com/golden-evc.tif",
          },
        ],
      });
    };

    const catalog = await fetchDigitalTwinEarthEngineCatalog("https://engine.example.com/", {
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.equal(catalog.layers.length, 2);
    assert.deepEqual(
      catalog.layers.map((layer) => [layer.name, layer.regionName, layer.url]),
      [
        ["Existing vegetation cover", "Golden", "https://cdn.example.com/golden-evc.tif"],
        [
          "Existing vegetation type",
          "Boulder",
          "https://engine.example.com/api/v1/regions/boulder-co/earth-engine/evt.cog.tif",
        ],
      ],
    );
    assert.equal(catalog.layers[1]?.style.colormap, "terrain");
    assert.equal(calls.length, 3);
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
