import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDigitalTwinRegion, updateDigitalTwinRegion, publishDigitalTwinRegion, deleteDigitalTwinRegion, fetchDigitalTwinRegionReadiness, fetchDigitalTwinRegions } from "../apps/geolibre-desktop/src/lib/digital-twin-regions";
import { previewDigitalTwinAssetBatch, createDigitalTwinAsset, importDigitalTwinAssetBatch } from "../apps/geolibre-desktop/src/lib/digital-twin-assets";
import { fetchDigitalTwinPointCloudDataset, submitDigitalTwinSurvey, parseDigitalTwinSurveyMetadata, digitalTwinSurveyBuild } from "../apps/geolibre-desktop/src/lib/digital-twin-point-cloud";
import { DigitalTwinApiError } from "../apps/geolibre-desktop/src/lib/digital-twin-api";
import { fetchDigitalTwinSources, fetchDigitalTwinEarthEngineMetadata } from "../apps/geolibre-desktop/src/lib/digital-twin-sources";

const api = "https://engine.example";
const input = { name: "Survey region", bounds: { west: -105.2, south: 40, east: -105, north: 40.2 } };
const metadata = { patch_id: "field-survey", acquired_at: "2026-10-09T12:00:00Z", target_crs: "EPSG:26913", vertical_datum: "NAVD88", meters_per_source_unit: 1, local_to_target_matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], replacement_footprint_wkt: "POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))", replacement_z_range: [0, 50], registration_method: "ground_control_points", registration_rmse_m: 0.03 };
const descriptor = { dataset_id: "survey", region_id: "draft", name: "Survey", status: "ready", format: "3d-tiles-point-cloud", position_crs: "EPSG:4978", scene_scale: { meters_per_unit: 1 }, tileset_url: "/point-clouds/draft/survey/old/tileset.json", bounds: [-105.2, 40, -105, 40.2], bounds_crs: "EPSG:4326", point_count: 20, source_point_count: 30, minimum_spacing_m: 0.5, attributes: ["position"], version: "a".repeat(64), attribution: "Measured survey", updated_at: "2026-10-09T12:00:00Z", failure_code: null };

describe("Native data administration contracts", () => {
  it("creates, patches, publishes and deletes drafts with the current public region contract", async () => {
    const requests: { url: string; method: string; body: unknown; credentials: string | undefined }[] = [];
    const options = { fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), method: init?.method ?? "GET", body: typeof init?.body === "string" ? JSON.parse(init.body) : null, credentials: init?.credentials });
      return init?.method === "DELETE" ? new Response(null, { status: 204 }) : Response.json({ ...input, region_id: "draft", status: String(url).endsWith("/publish") ? "published" : "draft", published_revision_id: String(url).endsWith("/publish") ? "revision" : null });
    }) as typeof fetch };
    assert.equal((await createDigitalTwinRegion(api, input, options)).status, "draft");
    await updateDigitalTwinRegion(api, "draft", { ...input, name: "Reviewed" }, options);
    assert.equal((await publishDigitalTwinRegion(api, "draft", options)).published_revision_id, "revision");
    await deleteDigitalTwinRegion(api, "unused draft", options);
    assert.deepEqual(requests.map((request) => request.method), ["POST", "PATCH", "POST", "DELETE"]);
    assert.equal(requests[3].url, `${api}/api/v1/regions/unused%20draft`);
    assert.ok(requests.every((request) => request.credentials === "same-origin"));
    assert.deepEqual(requests[0].body, input);
    assert.throws(() => createDigitalTwinRegion(api, { ...input, bounds: { ...input.bounds, west: -104 } }, options), /positive WGS84/);
    assert.equal(requests.length, 4);
  });
  it("paginates regions and keeps publication separate from model readiness", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string | URL | Request) => { calls.push(String(url)); if (String(url).includes("readiness")) return Response.json({ region_id: "draft", publication_status: "published", configured: false, grid_hydrated: false, runtime_ready: true, ready_to_simulate: false, sources: [], reason_codes: ["region_not_configured", "grid_not_hydrated"] }); return Response.json({ items: [{ ...input, region_id: calls.length === 1 ? "first" : "second", status: "draft", published_revision_id: null }], next_cursor: calls.length === 1 ? "page 2" : null }); }) as typeof fetch;
    const regions = await fetchDigitalTwinRegions(api, { fetchImpl }); assert.equal(regions.length, 2); assert.match(calls[1], /cursor=page\+2/);
    const readiness = await fetchDigitalTwinRegionReadiness(api, "draft", { fetchImpl }); assert.equal(readiness.publication_status, "published"); assert.equal(readiness.ready_to_simulate, false);
  });
  it("validates bounded batch intake and submits single and batch public creation fields", async () => {
    const tree = { kind: "tree", location: { lat: 40.1, lon: -105.1 }, source_ref: "survey:field-survey", height_m: 5 };
    const candidates = previewDigitalTwinAssetBatch(JSON.stringify([tree])); assert.equal(candidates.length, 1);
    for (const value of [[], Array.from({ length: 1001 }, () => tree), [{ ...tree, asset_id: "client-id" }], [{ kind: "power_pole" }], [{ ...tree, height_m: -1 }]]) assert.throws(() => previewDigitalTwinAssetBatch(JSON.stringify(value)));
    const requests: { url: string; json: unknown }[] = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => { requests.push({ url: String(url), json: JSON.parse(String(init?.body)) }); const asset = { ...tree, species: null, canopy_radius_m: null, asset_id: "asset-id", region_id: "draft", scene_scale: { meters_per_unit: 1 } }; return Response.json(String(url).endsWith(":batch") ? [asset] : asset); }) as typeof fetch;
    await createDigitalTwinAsset(api, "draft", candidates[0], { fetchImpl }); await importDigitalTwinAssetBatch(api, "draft", candidates, { fetchImpl });
    assert.deepEqual(requests.map((request) => request.url), [`${api}/api/v1/regions/draft/assets`, `${api}/api/v1/regions/draft/assets:batch`]); assert.deepEqual(requests[0].json, tree);
  });
  it("shows configured sources and Earth Engine metadata without invented readiness", async () => {
    const fetchImpl = (async (url: string | URL | Request) => String(url).endsWith("/data-sources") ? Response.json([{ source_id: "static", region_id: "draft", provider: "google_earth_engine", kind: "earth_engine", ready: false }]) : Response.json({ source_id: "static", region_id: "draft", provider: "google_earth_engine", ready: false, crs: "EPSG:4326", datasets: ["vegetation"] })) as typeof fetch;
    assert.equal((await fetchDigitalTwinSources(api, { fetchImpl }))[0].ready, false); assert.deepEqual((await fetchDigitalTwinEarthEngineMetadata(api, "draft", { fetchImpl })).datasets, ["vegetation"]);
  });
  it("tracks accepted builds while preserving the previous ready tiles through queued and failed replacements", async () => {
    const acceptedVersion = "b".repeat(64);
    for (const state of ["queued", "building", "failed", "ready"] as const) {
      const value = { ...descriptor, ...(state === "ready" ? { version: acceptedVersion, tileset_url: "/point-clouds/draft/survey/new/tileset.json" } : {}), latest_build: { version: acceptedVersion, status: state, updated_at: "2026-10-09T13:00:00Z", failure_code: state === "failed" ? "invalid_geometry" : null } };
      const dataset = await fetchDigitalTwinPointCloudDataset(api, "draft", "survey", { fetchImpl: (async () => Response.json(value)) as typeof fetch });
      assert.equal(dataset.status, "ready"); assert.equal(dataset.version, state === "ready" ? acceptedVersion : descriptor.version); assert.equal(digitalTwinSurveyBuild(dataset, acceptedVersion)?.status, state); assert.equal(digitalTwinSurveyBuild(dataset, "unrelated-version"), null);
    }
  });
  it("sends reviewed PLY multipart with credentials and retains exact acceptance identities", async () => {
    const parsed = parseDigitalTwinSurveyMetadata(JSON.stringify(metadata));
    const accepted = { region_id: "draft", dataset_id: "survey", patch_id: parsed.patch_id, status: "queued", version: "b".repeat(64), parent_version: "a".repeat(64) };
    let called = false;
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => { called = true; assert.equal(init?.credentials, "same-origin"); assert.ok(init?.body instanceof FormData); assert.deepEqual(JSON.parse(String(init.body.get("metadata"))), metadata); assert.equal((init.body.get("file") as File).name, "survey.ply"); assert.equal(new Headers(init.headers).get("Content-Type"), null); return Response.json(accepted, { status: 202 }); }) as typeof fetch;
    assert.deepEqual(await submitDigitalTwinSurvey(api, "draft", "survey", new File(["ply\n"], "survey.ply"), parsed, { fetchImpl }), accepted); assert.equal(called, true);
    called = false; await assert.rejects(submitDigitalTwinSurvey(api, "draft", "survey", new File(["x"], "survey.xyz"), parsed, { fetchImpl }), /\.ply/); assert.equal(called, false);
    for (const bad of [{ ...metadata, acquired_at: "2026-10-09T12:00:00" }, { ...metadata, local_to_target_matrix: [1] }, { ...metadata, registration_rmse_m: -1 }, { ...metadata, replacement_z_range: [10, 0] }, { ...metadata, meters_per_source_unit: 2 }]) assert.throws(() => parseDigitalTwinSurveyMetadata(JSON.stringify(bad)));
  });
  it("preserves safe upload conflict and permission error identity", async () => {
    for (const status of [401, 403, 409, 413, 415, 422]) await assert.rejects(fetchDigitalTwinPointCloudDataset(api, "draft", "survey", { fetchImpl: (async () => Response.json({ detail: "Reviewed survey was rejected.", code: "survey_rejected", request_id: "trace-1" }, { status })) as typeof fetch }), (error: unknown) => error instanceof DigitalTwinApiError && error.status === status && error.code === "survey_rejected" && error.requestId === "trace-1");
  });
});
