import { expect, test, type Page } from "@playwright/test";
import fixtures from "../tests/fixtures/digital-twin-engine.api-fixtures.json";

/** These response examples are exported from the Engine's current Pydantic models. */
async function installNativeEngine(page: Page, options: { denyAccess?: boolean; failFirstRun?: boolean } = {}) {
  const scenarios: typeof fixtures.scenario[] = [];
  const runRequests: { body: unknown; key: string | undefined }[] = [];
  const cancelledRun = { ...fixtures.run_cancelled, run_id: fixtures.run_started.run_id };
  let cancelled = false;
  let submitted = false;
  await page.route("**/api/digital-twin/access", route => route.fulfill(options.denyAccess ? { status: 403, json: {} } : { json: {
    subject_id: "test-operator", display_name: "Test operator", organization: { id: "test", name: "Test operations" },
    roles: ["administrator"], capabilities: ["digital-twin", "administration"],
    regions: [{ id: fixtures.region.region_id, name: fixtures.region.name }],
    most_recently_used_region_id: fixtures.region.region_id, saved_start_location: "digital-twin",
  } }));
  await page.route("**/api/v1/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^.*\/api\/v1/, "");
    const method = request.method();
    const regionPath = `/regions/${fixtures.region.region_id}`;
    let json: unknown;
    let status = 200;
    if (path === "/health/live") json = { status: "live" };
    else if (path === "/health/ready") json = { status: "ready" };
    else if (path === "/regions") json = fixtures.region_page;
    else if (path === regionPath) json = fixtures.region;
    else if (path === `${regionPath}/readiness`) json = { ...fixtures.region_readiness, region_id: fixtures.region.region_id, ready_to_simulate: true, configured: true, grid_hydrated: true, reason_codes: [] };
    else if (path === `${regionPath}/weather-datasets`) json = fixtures.weather_page;
    else if (path.endsWith("/map-layers") || path.endsWith("/station-observations") || path.endsWith("/point-cloud-datasets")) json = { items: [] };
    else if (path.endsWith("/assets")) json = [];
    else if (path.endsWith("/assets.geojson") || path.endsWith("result.geojson")) json = { type: "FeatureCollection", features: [] };
    else if (path === "/data-sources") json = [];
    else if (path === "/scenarios" && method === "POST") {
      const body = request.postDataJSON();
      const scenario = { ...fixtures.scenario, name: body.name, duration_hours: body.duration_hours, scenario_id: `saved-${scenarios.length + 1}` };
      scenarios.push(scenario); json = scenario; status = 201;
    } else if (path === "/scenarios") json = { items: scenarios, next_cursor: null };
    else if (path.startsWith("/scenarios/")) json = scenarios.find(scenario => path.endsWith(scenario.scenario_id));
    else if (path === "/simulation-runs" && method === "POST") {
      runRequests.push({ body: request.postDataJSON(), key: request.headers()["idempotency-key"] });
      if (options.failFirstRun && runRequests.length === 1) { status = 503; json = { code: "temporarily_unavailable", detail: "Temporary worker outage. Retry the same intent.", retryable: true }; }
      else { submitted = true; status = 202; json = { run_id: fixtures.run_started.run_id, simulation_id: fixtures.run_started.simulation_id, status: "queued", status_url: `/api/v1/simulation-runs/${fixtures.run_started.run_id}`, result_url: `/api/v1/simulation-runs/${fixtures.run_started.run_id}/result.geojson`, scenario_id: scenarios[0]?.scenario_id }; }
    } else if (path.endsWith("/cancel")) { cancelled = true; status = 202; json = cancelledRun; }
    else if (path.endsWith("/events")) { await route.fulfill({ status: 503, json: { detail: "Stream disconnected for recovery test." } }); return; }
    else if (path === "/simulation-runs") json = { items: submitted ? [cancelled ? cancelledRun : fixtures.run_started] : [], next_cursor: null };
    else if (path.startsWith("/simulation-runs/")) json = cancelled ? cancelledRun : fixtures.run_started;
    else { await route.fulfill({ status: 404, json: { detail: `Unmocked native operation: ${method} ${path}` } }); return; }
    await route.fulfill({ status, json });
  });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  return { scenarios, runRequests };
}

async function openScenarios(page: Page) {
  await page.goto(`/regions/${fixtures.region.region_id}/scenarios`);
  await expect(page.getByRole("heading", { name: "Scenarios", exact: true })).toBeVisible();
  await expect(page.locator(".dt-demo")).toHaveCount(0);
}

test("native scenario save, reload and run preserve reviewed intent across retry", async ({ page }) => {
  const state = await installNativeEngine(page, { failFirstRun: true });
  await openScenarios(page);
  await expect(page.getByText("No saved scenarios", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New setup", exact: true }).click();
  await page.getByLabel("Scenario name", { exact: true }).fill("Reviewed native scenario");
  await page.getByRole("tab", { name: /weather/i }).click();
  await page.getByRole("combobox", { name: "Base weather version" }).click();
  await page.getByRole("option", { name: new RegExp(fixtures.weather_dataset.version) }).click();
  await page.getByRole("tab", { name: /review/i }).click();
  await page.getByRole("button", { name: "Save scenario without running" }).click();
  await expect(page.getByText("Saved as saved-1", { exact: true })).toBeVisible();
  expect(state.scenarios).toHaveLength(1);
  expect(state.runRequests).toHaveLength(0);
  await page.getByRole("button", { name: "Close run setup" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Reviewed native scenario", exact: true }).click();
  await page.getByLabel("Ignition latitude").fill("39.75");
  await page.getByLabel("Ignition longitude").fill("-105.25");
  await page.getByRole("button", { name: "Add coordinates" }).click();
  await page.getByRole("tab", { name: /review/i }).click();
  await page.getByRole("button", { name: "Run simulation", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Temporary worker outage" })).toBeVisible();
  await page.getByRole("button", { name: "Run simulation", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/runs/${fixtures.run_started.run_id}$`));
  expect(state.runRequests).toHaveLength(2);
  expect(state.runRequests[0]).toEqual(state.runRequests[1]);
  expect(state.runRequests[0].key).toBeTruthy();
  expect(state.runRequests[0].body).toEqual({ scenario_id: "saved-1", ignition_points: [{ type: "Point", coordinates: [-105.25, 39.75] }] });
  expect(state.scenarios).toHaveLength(1);
  await expect(page.getByRole("button", { name: "Cancel run", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel run", exact: true }).click();
  await expect(page.getByText("Cancelled", { exact: true }).first()).toBeVisible();
});

test("direct run URL recovers its record outside the current catalog", async ({ page }) => {
  await installNativeEngine(page);
  await page.goto(`/regions/${fixtures.region.region_id}/runs/${fixtures.run_started.run_id}`);
  await expect(page.getByRole("button", { name: "Cancel run", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Something went wrong" })).toHaveCount(0);
});

test("denied access never mounts the native workspace or reads Engine resources", async ({ page }) => {
  let reads = 0;
  page.on("request", request => { if (request.url().includes("/api/v1/")) reads++; });
  await installNativeEngine(page, { denyAccess: true });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Access unavailable" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Digital Twin navigation" })).toHaveCount(0);
  expect(reads).toBe(0);
});

test("native navigation asks before discarding unsaved setup", async ({ page }) => {
  await installNativeEngine(page);
  await openScenarios(page);
  await page.getByRole("button", { name: "New setup", exact: true }).click();
  await page.getByLabel("Scenario name", { exact: true }).fill("Unsaved local intent");
  await page.getByRole("button", { name: "Data", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Discard local setup changes?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByLabel("Scenario name", { exact: true })).toHaveValue("Unsaved local intent");
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await dialog.getByRole("button", { name: "Discard and leave" }).click();
  await expect(page.getByRole("heading", { name: "Data administration" })).toBeVisible();
  await expect(page.getByRole("main")).toHaveCount(1);
});
