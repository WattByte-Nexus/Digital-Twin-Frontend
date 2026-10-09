import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const bounds = { west: -105.35, south: 39.95, east: -105.15, north: 40.1 };
const oldVersion = "a".repeat(64);
const acceptedVersion = "b".repeat(64);
const metadata = { patch_id: "field-survey", acquired_at: "2026-10-09T12:00:00Z", target_crs: "EPSG:26913", vertical_datum: "NAVD88", meters_per_source_unit: 1, local_to_target_matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], replacement_footprint_wkt: "POLYGON ((500000 4427000, 500010 4427000, 500010 4427010, 500000 4427010, 500000 4427000))", replacement_z_range: [1500, 1550], registration_method: "ground_control_points", registration_rmse_m: 0.03 };

async function installDataMocks(page: Page, admin = true, adminOnly = false) {
  const state = {
    regions: [{ region_id: "boulder-co", name: "Boulder Foothills", status: "draft", bounds, published_revision_id: null as string | null }, { region_id: "unused-draft", name: "Unused draft", status: "draft", bounds, published_revision_id: null as string | null }],
    assets: [] as unknown[],
    requests: [] as string[],
    healthOnline: true,
    headRequests: 0,
    surveyUploads: 0,
    latestStatus: "ready" as "queued" | "building" | "ready" | "failed",
    latestVersion: oldVersion,
    selectedVersion: oldVersion,
  };
  if (adminOnly) state.regions = [];
  const sourceRegionId = adminOnly ? "created-draft" : "boulder-co";
  const dataset = () => ({ dataset_id: "survey", region_id: "boulder-co", name: "Measured survey", status: "ready", format: "3d-tiles-point-cloud", position_crs: "EPSG:4978", scene_scale: { linear_unit: "meter", meters_per_unit: 1 }, tileset_url: `/api/v1/point-clouds/boulder-co/survey/${state.selectedVersion}/tileset.json`, bounds: [-105.35, 39.95, -105.15, 40.1], bounds_crs: "EPSG:4326", point_count: 20, source_point_count: 30, minimum_spacing_m: 0.5, attributes: ["position"], version: state.selectedVersion, attribution: "Measured survey", updated_at: "2026-10-09T12:00:00Z", failure_code: null, latest_build: { version: state.latestVersion, status: state.latestStatus, updated_at: "2026-10-09T13:00:00Z", failure_code: state.latestStatus === "failed" ? "invalid_geometry" : null } });
  await page.route("**/api/digital-twin/access", (route) => route.fulfill({ json: { subject_id: "operator", display_name: "Survey operator", organization: { id: "test", name: "Test operations" }, roles: admin ? ["operator", "administrator"] : ["operator"], capabilities: adminOnly ? ["administration"] : admin ? ["digital-twin", "administration"] : ["digital-twin"], regions: state.regions.map((region) => ({ id: region.region_id, name: region.name })), most_recently_used_region_id: adminOnly ? null : "boulder-co", saved_start_location: adminOnly ? "administration" : "digital-twin" } }));
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request(); const path = new URL(request.url()).pathname; const method = request.method(); state.requests.push(`${method} ${path}`); let json: unknown;
    if (path.includes("/health/") && !state.healthOnline) { await route.fulfill({ status: 503, json: { detail: "Offline test Engine" } }); return; }
    if (path.endsWith("/health/live")) json = { status: "live" };
    else if (path.endsWith("/health/ready")) json = { status: "ready" };
    else if (path.endsWith("/regions") && method === "POST") { const input = request.postDataJSON(); const region = { ...input, region_id: "created-draft", status: "draft", published_revision_id: null }; state.regions.push(region); json = region; }
    else if (path.endsWith("/regions")) json = { items: state.regions, next_cursor: null };
    else if (/\/regions\/[^/]+\/readiness$/.test(path)) { const region = state.regions.find((item) => path.includes(`/${item.region_id}/`)); json = { region_id: region?.region_id, publication_status: region?.status, configured: false, grid_hydrated: false, runtime_ready: true, ready_to_simulate: false, sources: [], reason_codes: ["region_not_configured", "grid_not_hydrated"] }; }
    else if (/\/regions\/[^/]+\/publish$/.test(path)) { const region = state.regions.find((item) => path.includes(`/${item.region_id}/`)); if (region) { region.status = "published"; region.published_revision_id = "published-revision"; } json = region; }
    else if (/\/regions\/[^/]+$/.test(path)) { const id = decodeURIComponent(path.split("/").at(-1) ?? ""); const region = state.regions.find((item) => item.region_id === id); if (method === "DELETE") { state.regions = state.regions.filter((item) => item.region_id !== id); await route.fulfill({ status: 204 }); return; } if (method === "PATCH" && region) Object.assign(region, request.postDataJSON()); json = region; }
    else if (path.endsWith("/assets") && method === "POST") { const asset = { ...request.postDataJSON(), asset_id: `asset-${state.assets.length + 1}`, region_id: "boulder-co", species: null, height_m: null, canopy_radius_m: null, scene_scale: { linear_unit: "meter", meters_per_unit: 1 } }; state.assets.push(asset); json = asset; }
    else if (path.endsWith("/assets")) json = path.includes("/boulder-co/") ? state.assets : [];
    else if (path.endsWith("/assets.geojson")) json = { type: "FeatureCollection", features: [] };
    else if (path.endsWith("/data-sources")) json = [{ source_id: "vegetation", kind: "earth_engine", region_id: sourceRegionId, provider: "google_earth_engine", ready: true }];
    else if (path.endsWith("/earth-engine")) json = { source_id: "vegetation", region_id: sourceRegionId, provider: "google_earth_engine", datasets: ["vegetation"], crs: "EPSG:4326", ready: true };
    else if (path.endsWith("/earth-engine/map-layers")) json = { items: [{ layer_id: "vegetation", name: "Vegetation cover", category: "earth_engine", format: "cog", url: "/api/v1/map-layers/vegetation/data.tif", bounds: [-105.35, 39.95, -105.15, 40.1], bounds_crs: "EPSG:4326", crs: "EPSG:4326", band: "cover", units: "percent", attribution: "Test measured vegetation", default_style: { colormap: "viridis", rescale_min: 0, rescale_max: 100, opacity: 0.8 }, version: null, source_ready: true, artifact_ready: false }] };
    else if (path.endsWith("/data.tif")) {
      const bytes = readFileSync(`${process.cwd()}/tests/fixtures/striped.tif`);
      if (method === "HEAD") state.headRequests++;
      const range = request.headers().range?.match(/bytes=(\d+)-(\d*)/); const start = range ? Number(range[1]) : 0; const end = range?.[2] ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1;
      await route.fulfill({ status: range ? 206 : 200, body: method === "HEAD" ? undefined : bytes.subarray(start, end + 1), contentType: "image/tiff", headers: { "accept-ranges": "bytes", "content-length": String(method === "HEAD" ? bytes.length : end - start + 1), ...(range ? { "content-range": `bytes ${start}-${end}/${bytes.length}` } : {}) } }); return;
    }
    else if (path.endsWith("/surveys")) { state.surveyUploads++; state.latestVersion = acceptedVersion; state.latestStatus = "queued"; json = { region_id: "boulder-co", dataset_id: "survey", patch_id: metadata.patch_id, status: "queued", version: acceptedVersion, parent_version: oldVersion }; }
    else if (path.endsWith("/point-cloud-datasets/survey")) json = dataset();
    else if (path.endsWith("/point-cloud-datasets")) json = path.includes("/boulder-co/") ? { region_id: "boulder-co", active_dataset_id: "survey", items: [dataset()] } : { region_id: "unused-draft", active_dataset_id: null, items: [] };
    else if (path.includes("/point-clouds/")) json = { asset: { version: "1.1" }, geometricError: 0, root: { boundingVolume: { sphere: [-1276000, -4728000, 4078000, 100] }, geometricError: 0, refine: "ADD", children: [] } };
    else json = { items: [], next_cursor: null };
    await route.fulfill({ json, status: path.endsWith("/surveys") ? 202 : 200 });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(adminOnly ? "/admin" : process.env.DIGITAL_TWIN_E2E_URL ?? "/");
  await expect(page.getByRole("button", { name: adminOnly ? "Manage regional data" : "Data", exact: true })).toBeVisible();
  return state;
}

async function openData(page: Page) {
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Data administration", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Name", exact: true })).toBeVisible();
}

test.describe("Native data administration", () => {
  test.use({ viewport: { width: 1500, height: 1000 } });
  test("authors a draft, ingests a measured tree and publishes with explicit unconfigured readiness", async ({ page }) => {
    const state = await installDataMocks(page); await openData(page);
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("Reviewed foothills"); await page.getByRole("button", { name: "Save draft", exact: true }).click(); await expect.poll(() => state.regions[0].name).toBe("Reviewed foothills");
    await page.getByRole("tab", { name: "Asset intake" }).click(); await page.getByLabel("Latitude", { exact: true }).fill("40.01"); await page.getByLabel("Longitude", { exact: true }).fill("-105.25"); await page.getByLabel("Source lineage reference").fill("survey:field-survey"); await page.getByRole("button", { name: "Create asset", exact: true }).click(); await expect.poll(() => state.assets.length).toBe(1);
    await page.getByRole("tab", { name: "Region", exact: true }).click(); await page.getByRole("button", { name: "Publish region", exact: true }).click(); await expect(page.getByText("Published geometry and assets are read-only.", { exact: true })).toBeVisible(); await expect(page.getByText("Not ready to simulate", { exact: true })).toBeVisible(); await expect(page.getByRole("textbox", { name: "Name", exact: true })).toBeDisabled();
    await page.getByRole("tab", { name: "Asset intake" }).click(); await expect(page.getByRole("button", { name: "Create asset", exact: true })).toBeDisabled();
  });
  test("creates a region draft and deletes a separate draft through native controls", async ({ page }) => {
    const state = await installDataMocks(page); await openData(page); await page.getByRole("combobox", { name: "Administration region" }).click(); await page.getByRole("option", { name: "Create region draft" }).click(); await page.getByRole("textbox", { name: "Name", exact: true }).fill("New survey area"); await page.getByLabel("WGS84 bounds").fill("-105.3, 40, -105.2, 40.1"); await page.getByRole("button", { name: "Create draft", exact: true }).click(); await expect.poll(() => state.regions.length).toBe(3);
    await page.getByRole("combobox", { name: "Administration region" }).click(); await page.getByRole("option", { name: "Unused draft · draft", exact: true }).click(); await page.getByRole("button", { name: "Delete draft", exact: true }).click(); await page.getByRole("button", { name: "Confirm delete draft", exact: true }).click(); await expect.poll(() => state.regions.some((region) => region.region_id === "unused-draft")).toBe(false);
  });
  test("keeps draft authoring disabled without administration permission", async ({ page }) => {
    const state = await installDataMocks(page, false); await openData(page); await expect(page.getByRole("textbox", { name: "Name", exact: true })).toBeDisabled(); await page.getByRole("tab", { name: "Asset intake" }).click(); await expect(page.getByRole("button", { name: "Create asset", exact: true })).toBeDisabled(); expect(state.assets).toHaveLength(0);
  });
  test("prepares native COG layers and hides controlled map visibility after returning to Data", async ({ page }) => {
    const state = await installDataMocks(page); await openData(page); await page.getByRole("tab", { name: "Sources & layers" }).click(); await expect(page.getByText("Vegetation cover", { exact: true })).toBeVisible(); await page.getByRole("button", { name: "Show on map", exact: true }).click(); await expect.poll(() => state.headRequests).toBe(1); await expect(page.getByRole("heading", { name: "Data administration", exact: true })).not.toBeVisible();
    await openData(page); await page.getByRole("tab", { name: "Sources & layers" }).click(); await page.getByRole("button", { name: "Hide layer", exact: true }).click(); await expect(page.getByRole("button", { name: "Show on map", exact: true })).toBeVisible();
  });
  test("tracks accepted survey failure without confusing old ready tiles for success", async ({ page }) => {
    const state = await installDataMocks(page); await openData(page); await page.getByRole("tab", { name: "Datasets & surveys" }).click(); await expect(page.getByText(`Viewable version: ${oldVersion}`, { exact: true })).toBeVisible(); await page.getByLabel("PLY file, maximum 2 GiB").setInputFiles({ name: "survey.ply", mimeType: "application/octet-stream", buffer: Buffer.from("ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\nend_header\n0 0 0\n") }); await page.getByRole("textbox", { name: "Placement metadata JSON", exact: true }).fill(JSON.stringify(metadata)); await page.getByRole("button", { name: "Validate placement", exact: true }).click(); await page.getByRole("checkbox").check(); await page.getByRole("button", { name: "Submit reviewed survey", exact: true }).click(); await expect.poll(() => state.surveyUploads).toBe(1); await expect(page.getByText(/Accepted patch field-survey:/)).toBeVisible(); await expect(page.getByText("Accepted replacement is queued. Previous ready tiles remain available.", { exact: true })).toBeVisible();
    state.latestStatus = "building"; await expect(page.getByText("Accepted replacement is building. Previous ready tiles remain available.", { exact: true })).toBeVisible(); state.latestStatus = "failed"; await expect(page.getByText("Replacement failed: invalid_geometry. Previous ready tiles remain available.", { exact: true })).toBeVisible(); await expect(page.getByText(`Viewable version: ${oldVersion}`, { exact: true })).toBeVisible(); await expect(page.getByRole("button", { name: "View selected dataset", exact: true })).toBeEnabled();
    state.latestStatus = "ready"; state.selectedVersion = acceptedVersion; await expect(page.getByText("Accepted replacement is ready. View selected dataset to display the new tiles.", { exact: true })).toBeVisible(); await expect(page.getByText(`Viewable version: ${acceptedVersion}`, { exact: true })).toBeVisible();
  });
  test("settings use actual health, local appearance and the saved scenario library", async ({ page }) => {
    const state = await installDataMocks(page); await page.getByRole("button", { name: "Settings", exact: true }).click(); await expect(page.getByRole("heading", { name: "Status & health", exact: true })).toBeVisible(); await expect(page.getByText("Live and ready", { exact: true })).toBeVisible();
    state.healthOnline = false; await page.getByRole("button", { name: "Check now", exact: true }).click(); await expect(page.getByText("Offline", { exact: true })).toBeVisible(); await expect(page.getByText(/Redis|Queue depth|Last checked just now/)).toHaveCount(0);
    await page.getByRole("searchbox", { name: "Search settings", exact: true }).fill("Appearance"); await page.getByRole("button", { name: "Appearance", exact: true }).click(); const toggle = page.getByRole("button", { name: /^Switch to (?:dark|light)$/ }); const before = await toggle.innerText(); await toggle.click(); await expect(toggle).toHaveText(before === "Switch to dark" ? "Switch to light" : "Switch to dark");
    await page.reload(); await page.getByRole("button", { name: "Settings", exact: true }).click(); await page.getByRole("button", { name: "Appearance", exact: true }).click(); await expect(page.getByRole("button", { name: /^Switch to (?:dark|light)$/ })).toHaveText(before === "Switch to dark" ? "Switch to light" : "Switch to dark");
    await page.getByRole("button", { name: "Saved scenarios", exact: true }).click(); await page.getByRole("button", { name: "Open saved scenarios", exact: true }).click(); await expect(page.getByRole("heading", { name: "Scenarios", exact: true })).toBeVisible();
  });

  test("administrators without operational scope can create the first draft without loading map resources", async ({ page }) => {
    const state = await installDataMocks(page, true, true); await page.getByRole("button", { name: "Manage regional data", exact: true }).click(); await expect(page.getByRole("button", { name: "Create draft", exact: true })).toBeVisible(); await page.getByRole("textbox", { name: "Name", exact: true }).fill("First deployment region"); await page.getByLabel("WGS84 bounds").fill("-105.3, 40, -105.2, 40.1"); await page.getByRole("button", { name: "Create draft", exact: true }).click(); await expect.poll(() => state.regions.length).toBe(1); await expect(page.getByRole("button", { name: "Save draft", exact: true })).toBeVisible();
    expect(state.requests.some((request) => /simulation-runs|assets|weather-datasets|point-cloud/.test(request))).toBe(false); await expect(page.locator(".maplibregl-canvas")).toHaveCount(0);
    await page.getByRole("tab", { name: "Sources & layers" }).click(); await expect(page.getByRole("button", { name: "Show on map", exact: true })).toBeDisabled(); await expect(page.getByText("Open an authorized Digital Twin workspace to preview layers on the map.", { exact: true })).toBeVisible();
  });

});
