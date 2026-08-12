import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deleteDigitalTwinAsset,
  fetchDigitalTwinAsset,
  fetchDigitalTwinAssets,
  importDigitalTwinAssetCsv,
  updateDigitalTwinAsset,
} from "../apps/geolibre-desktop/src/lib/digital-twin-assets";

const tree = {
  kind: "tree",
  asset_id: "asset-tree-1",
  region_id: "region/1",
  location: { lat: 40.01, lon: -105.27 },
  species: "ponderosa_pine",
  height_m: 12,
  canopy_radius_m: 3.5,
  source_ref: "city-tree:1",
};

describe("Digital Twin asset API", () => {
  it("loads and validates region assets and asset details", async () => {
    const urls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      urls.push(String(input));
      return Response.json(urls.length === 1 ? [tree] : tree);
    };
    const listed = await fetchDigitalTwinAssets(
      "http://engine.test/",
      "region/1",
      { fetchImpl }
    );
    const detail = await fetchDigitalTwinAsset(
      "http://engine.test/",
      "asset-tree-1",
      { fetchImpl }
    );
    assert.equal(listed[0]?.kind, "tree");
    assert.deepEqual(detail, listed[0]);
    assert.deepEqual(urls, [
      "http://engine.test/api/v1/regions/region%2F1/assets",
      "http://engine.test/api/v1/assets/asset-tree-1",
    ]);
  });

  it("uses the canonical CSV import, patch, and delete contracts", async () => {
    const requests: Array<{
      method: string;
      url: string;
      body: BodyInit | null | undefined;
    }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({
        method: init?.method ?? "GET",
        url: String(input),
        body: init?.body,
      });
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      return Response.json(init?.method === "POST" ? [tree] : tree, {
        status: init?.method === "POST" ? 201 : 200,
      });
    };
    const csv = new File(
      [
        'type,properties,coords\ntree,"{""species"":""ponderosa_pine""}","[-105.27,40.01]"',
      ],
      "assets.csv",
      { type: "text/csv" }
    );
    await importDigitalTwinAssetCsv("http://engine.test", "region/1", csv, {
      fetchImpl,
    });
    await updateDigitalTwinAsset(
      "http://engine.test",
      "asset-tree-1",
      { height_m: 14 },
      { fetchImpl }
    );
    await deleteDigitalTwinAsset("http://engine.test", "asset-tree-1", {
      fetchImpl,
    });
    assert.deepEqual(
      requests.map(({ method, url }) => [method, url]),
      [
        ["POST", "http://engine.test/api/v1/regions/region%2F1/assets:csv"],
        ["PATCH", "http://engine.test/api/v1/assets/asset-tree-1"],
        ["DELETE", "http://engine.test/api/v1/assets/asset-tree-1"],
      ]
    );
    assert.ok(requests[0]?.body instanceof FormData);
    const uploaded = requests[0].body.get("file");
    assert.ok(uploaded instanceof File);
    assert.equal(uploaded.name, "assets.csv");
    assert.equal(uploaded.type, "text/csv");
  });

  it("rejects a non-CSV file before sending it", async () => {
    await assert.rejects(
      () =>
        importDigitalTwinAssetCsv(
          "http://engine.test",
          "region-1",
          new File(["assets"], "assets.txt", { type: "text/plain" })
        ),
      /must be a CSV file/
    );
  });

  it("surfaces the Engine's safe error detail", async () => {
    const fetchImpl: typeof fetch = async () =>
      Response.json(
        { detail: "Published assets cannot be deleted." },
        { status: 409 }
      );
    await assert.rejects(
      () =>
        deleteDigitalTwinAsset("http://engine.test", "asset-tree-1", {
          fetchImpl,
        }),
      /Published assets cannot be deleted/
    );
  });
});
