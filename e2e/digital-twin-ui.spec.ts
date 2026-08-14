import { expect, test, type Page, type Route } from "@playwright/test";

const ACCESS_RESPONSE = {
  subject_id: "operator-7",
  display_name: "A. Chen",
  organization: { id: "wattbyte", name: "WattByte Nexus" },
  roles: ["operator", "administrator"],
  capabilities: ["digital-twin", "expert-gis", "administration"],
  regions: [{ id: "boulder-co", name: "Boulder Foothills" }],
  most_recently_used_region_id: "boulder-co",
  saved_start_location: "digital-twin",
};

const REGION = {
  region_id: "boulder-co",
  name: "Boulder Foothills",
  status: "published",
  bounds: { west: -105.35, south: 39.95, east: -105.15, north: 40.1 },
};

const COMPLETED_RUN = {
  simulation_id: "simulation-1",
  run_id: "run-1",
  region_id: "boulder-co",
  status: "COMPLETED",
  trigger: {
    kind: "scenario",
    scenario_id: "scenario-1",
    scenario_name: "Boulder test scenario",
    ignition_points: [{ lat: 40.02, lon: -105.24 }],
    duration_hours: 2,
    delta_t_hours: 1,
  },
  grid_geometry: { resolution_m: 30 },
  tick_refs: [
    { tick: 1, world_state_ref: "state://tick-1" },
    { tick: 2, world_state_ref: "state://tick-2" },
  ],
  final_result_ref: "state://final",
  metrics: {
    final_burning_cells: 24,
    final_burned_cells: 24,
    burned_area_hectares: 2.16,
    peak_spread_rate_hectares_per_hour: 1.08,
  },
  failure: null,
};

const STARTED_RUN = {
  ...COMPLETED_RUN,
  status: "STARTED",
  tick_refs: [{ tick: 1, world_state_ref: "state://tick-1" }],
  final_result_ref: null,
};

const QUEUED_RUN = {
  ...COMPLETED_RUN,
  status: "QUEUED",
  tick_refs: [],
  final_result_ref: null,
};

function resultForTick(tick: number) {
  const radius = tick === 1 ? 0.003 : 0.012;
  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: { tick, active_cell_count: tick * 12 },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-105.24 - radius, 40.02 - radius],
          [-105.24 + radius, 40.02 - radius],
          [-105.24 + radius, 40.02 + radius],
          [-105.24 - radius, 40.02 + radius],
          [-105.24 - radius, 40.02 - radius],
        ]],
      },
    }],
  };
}

const ASSETS = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [-105.285, 40.025],
          [-105.245, 40.015],
          [-105.205, 40.035],
        ],
      },
      properties: { asset_id: "line-1", kind: "power_line" },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-105.238, 40.018] },
      properties: {
        asset_id: "tree-1",
        kind: "tree",
        species: "ponderosa pine",
      },
    },
  ],
};

async function fulfillEngineRoute(route: Route): Promise<void> {
  const path = new URL(route.request().url()).pathname;
  let json: unknown;

  if (path.endsWith("/api/v1/health/ready")) json = { status: "ready" };
  else if (path.endsWith("/api/v1/data-sources")) json = [];
  else if (path.endsWith("/api/v1/regions")) json = { items: [REGION] };
  else if (path.endsWith("/api/v1/regions/boulder-co")) json = REGION;
  else if (path.endsWith("/api/v1/regions/boulder-co/assets.geojson"))
    json = ASSETS;
  else if (path.endsWith("/api/v1/regions/boulder-co/power-lines")) json = [];
  else if (path.endsWith("/api/v1/regions/boulder-co/weather-datasets"))
    json = { items: [] };
  else if (path.endsWith("/api/v1/regions/boulder-co/earth-engine"))
    json = { status: "empty" };
  else if (path.endsWith("/api/v1/regions/boulder-co/earth-engine/map-layers"))
    json = [];
  else if (path.endsWith("/api/v1/simulation-runs/run-1")) json = COMPLETED_RUN;
  else if (path.endsWith("/api/v1/simulation-runs/run-1/ticks/1/result.geojson"))
    json = resultForTick(1);
  else if (path.endsWith("/api/v1/simulation-runs/run-1/ticks/2/result.geojson"))
    json = resultForTick(2);
  else if (path.endsWith("/api/v1/simulation-runs")) json = { items: [COMPLETED_RUN] };
  else json = { items: [] };

  await route.fulfill({
    body: JSON.stringify(json),
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    status: 200,
  });
}

async function installDigitalTwinMocks(page: Page): Promise<void> {
  await page.route("**/api/digital-twin/access", async (route) => {
    await route.fulfill({ json: ACCESS_RESPONSE });
  });
  await page.route("**/api/v1/**", fulfillEngineRoute);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
}

async function openDigitalTwin(page: Page): Promise<void> {
  await installDigitalTwinMocks(page);
  await page.goto(process.env.DIGITAL_TWIN_E2E_URL ?? "/");
  await expect(page).toHaveURL(/\/regions\/boulder-co\/live$/);
  await expect(page.locator("[data-digital-twin-shell]")).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(page.locator(".dt-demo")).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Alert queue" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Alert details" })
  ).toBeVisible();
}

async function rememberMapCanvas(page: Page): Promise<void> {
  await page.locator(".maplibregl-canvas").evaluate((canvas) => {
    const lifecycleWindow = window as Window & {
      digitalTwinMapCanvas?: Element;
      digitalTwinMapContextLosses?: number;
    };
    lifecycleWindow.digitalTwinMapCanvas = canvas;
    lifecycleWindow.digitalTwinMapContextLosses = 0;
    canvas.addEventListener("webglcontextlost", () => {
      lifecycleWindow.digitalTwinMapContextLosses =
        (lifecycleWindow.digitalTwinMapContextLosses ?? 0) + 1;
    });
  });
}

async function expectRememberedMapCanvasConnected(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const lifecycleWindow = window as Window & {
          digitalTwinMapCanvas?: Element;
        };
        return lifecycleWindow.digitalTwinMapCanvas?.isConnected ?? false;
      })
    )
    .toBe(true);
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(1);
}

async function dragSeparator(
  page: Page,
  name: string,
  deltaX: number
): Promise<void> {
  const separator = page.getByRole("separator", { name });
  await expect
    .poll(async () => {
      const candidate = await separator.boundingBox();
      const viewport = page.viewportSize();
      return Boolean(
        candidate &&
          viewport &&
          candidate.x >= 0 &&
          candidate.x + candidate.width <= viewport.width
      );
    })
    .toBe(true);
  const box = await separator.boundingBox();
  if (!box) throw new Error(`Could not measure ${name}`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + deltaX, y, { steps: 6 });
  await page.mouse.up();
}

test.describe("WattByte Nexus Figma workspace", () => {
  test.use({ viewport: { width: 1672, height: 941 } });

  test("navigates from the live map to runs without crashing", async ({ page }) => {
    await installDigitalTwinMocks(page);
    await page.goto(process.env.DIGITAL_TWIN_E2E_URL ?? "/");
    await expect(page).toHaveURL(/\/regions\/boulder-co\/live$/);
    await expect(page.locator(".maplibregl-canvas")).toBeVisible();

    await page.getByRole("button", { name: /Runs:/ }).click();

    await expect(page).toHaveURL(/\/regions\/boulder-co\/runs$/);
    await expect(page.getByRole("heading", { name: "Runs", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Something went wrong" })).toHaveCount(0);
  });

  test("updates an active run to completed without reloading the page", async ({
    page,
  }) => {
    let catalogRequests = 0;
    let engineRunCompleted = false;
    await page.route("**/api/digital-twin/access", async (route) => {
      await route.fulfill({ json: ACCESS_RESPONSE });
    });
    await page.route("**/api/v1/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/api/v1/simulation-runs")) {
        catalogRequests += 1;
        await route.fulfill({
          json: {
            items: [engineRunCompleted ? COMPLETED_RUN : STARTED_RUN],
          },
        });
        return;
      }
      await fulfillEngineRoute(route);
    });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });

    await page.goto(process.env.DIGITAL_TWIN_E2E_URL ?? "/");
    await page.getByRole("button", { name: /Runs:/ }).click();

    await expect(page.getByText("Running", { exact: true })).toBeVisible();
    engineRunCompleted = true;
    await expect(page.getByText("Completed", { exact: true })).toBeVisible();
    expect(catalogRequests).toBeGreaterThanOrEqual(2);
    const terminalRequestCount = catalogRequests;
    await page.waitForTimeout(2_500);
    expect(catalogRequests).toBe(terminalRequestCount);
  });

  test("live-refreshes run details when the Engine publishes progress", async ({
    page,
  }) => {
    let engineRunCompleted = false;
    await page.route("**/api/digital-twin/access", async (route) => {
      await route.fulfill({ json: ACCESS_RESPONSE });
    });
    await page.route("**/api/v1/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/api/v1/simulation-runs")) {
        await route.fulfill({
          json: { items: [engineRunCompleted ? COMPLETED_RUN : QUEUED_RUN] },
        });
        return;
      }
      if (path.endsWith("/api/v1/simulation-runs/run-1")) {
        await route.fulfill({
          json: engineRunCompleted ? COMPLETED_RUN : QUEUED_RUN,
        });
        return;
      }
      await fulfillEngineRoute(route);
    });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });

    await page.goto(process.env.DIGITAL_TWIN_E2E_URL ?? "/");
    await page.getByRole("button", { name: /Runs:/ }).click();
    await page.getByRole("button", { name: "Boulder test scenario" }).click();

    await expect(page.getByText("Queued", { exact: true })).toBeVisible();
    await expect(page.getByText("0 / 2", { exact: true })).toBeVisible();
    await expect(page.getByText("No ticks", { exact: true })).toBeVisible();
    engineRunCompleted = true;
    await expect(page.getByText("Completed", { exact: true })).toBeVisible();
    await expect(page.getByText("2 / 2", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("slider", { name: "Simulation playback tick" })
    ).toBeEnabled();
  });

  test("fits the selected region from both zoom controls without region assets", async ({
    page,
  }) => {
    await openDigitalTwin(page);
    const canvas = page.locator(".maplibregl-canvas");
    const zoomIn = page.getByRole("button", { name: "Zoom in" });

    const expectCameraChange = async (zoomToRegion: () => Promise<void>) => {
      await zoomIn.click();
      await zoomIn.click();
      await page.waitForTimeout(1_000);
      const before = await canvas.screenshot();
      await zoomToRegion();
      await page.waitForTimeout(500);
      const after = await canvas.screenshot();
      expect(Buffer.compare(before, after)).not.toBe(0);
    };

    await expectCameraChange(async () => {
      await page.getByRole("button", { name: "Zoom to selected region" }).click();
    });

    await expectCameraChange(async () => {
      await page.keyboard.press(
        process.platform === "darwin" ? "Meta+KeyK" : "Control+KeyK"
      );
      await page.getByRole("option", { name: "Zoom to selected region" }).click();
    });
  });

  test("run playback changes the map for each durable tick", async ({ page }) => {
    await installDigitalTwinMocks(page);
    await page.goto(process.env.DIGITAL_TWIN_E2E_URL ?? "/");
    await page.getByRole("button", { name: /Runs:/ }).click();
    await page.getByRole("button", { name: "scenario-1" }).click();

    const slider = page.getByRole("slider", { name: "Simulation playback tick" });
    await expect(slider).toBeEnabled();
    await slider.focus();
    await page.keyboard.press("Home");
    await expect(page.getByText("Tick 1", { exact: true })).toBeVisible();
    await page.waitForTimeout(250);
    const firstFrame = await page.locator(".maplibregl-canvas").screenshot();

    await page.getByRole("button", { name: "Play playback" }).click();
    await expect(page.getByText("Tick 2", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Play playback" })).toBeVisible();
    await page.waitForTimeout(250);
    const secondFrame = await page.locator(".maplibregl-canvas").screenshot();

    expect(Buffer.compare(firstFrame, secondFrame)).not.toBe(0);
  });

  test("keeps one connected WebGL map while visiting non-map pages", async ({
    page,
  }) => {
    await installDigitalTwinMocks(page);
    await page.goto(process.env.DIGITAL_TWIN_E2E_URL ?? "/");
    await expect(page).toHaveURL(/\/regions\/boulder-co\/live$/);
    await expect(page.locator(".maplibregl-canvas")).toBeVisible();
    await rememberMapCanvas(page);

    await page.locator('button[aria-label^="Scenarios:"]').click();
    await expect(page).toHaveURL(/\/regions\/boulder-co\/scenarios$/);
    await expectRememberedMapCanvasConnected(page);

    await page.locator('button[aria-label^="Runs:"]').click();
    await expect(page).toHaveURL(/\/regions\/boulder-co\/runs$/);
    await expectRememberedMapCanvasConnected(page);

    await page.locator('button[aria-label^="Live:"]').click();
    await expect(page).toHaveURL(/\/regions\/boulder-co\/live$/);
    await expect(page.locator(".maplibregl-canvas")).toBeVisible();
    expect(
      await page.evaluate(() => {
        const lifecycleWindow = window as Window & {
          digitalTwinMapCanvas?: Element;
          digitalTwinMapContextLosses?: number;
        };
        return {
          contextLosses: lifecycleWindow.digitalTwinMapContextLosses ?? 0,
          sameCanvas:
            lifecycleWindow.digitalTwinMapCanvas ===
            document.querySelector(".maplibregl-canvas"),
        };
      })
    ).toEqual({ contextLosses: 0, sameCanvas: true });
  });

  test("shows the map risk callout only after selecting a supported asset", async ({
    page,
  }) => {
    await openDigitalTwin(page);

    const callout = page.locator(".dt-live-view__risk-callout");
    await expect(callout).toHaveCount(0);

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("geolibre:digital-twin-map-asset-selection", {
          detail: { kind: "tree" },
        })
      );
    });
    await expect(callout).toBeVisible();

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("geolibre:digital-twin-map-asset-selection", {
          detail: { kind: null },
        })
      );
    });
    await expect(callout).toHaveCount(0);

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("geolibre:digital-twin-map-asset-selection", {
          detail: { kind: "power_line" },
        })
      );
    });
    await expect(callout).toBeVisible();
  });

  test("honors the Digital Twin map-only route without product chrome", async ({
    page,
  }) => {
    await installDigitalTwinMocks(page);
    const relativeUrl = "/regions/boulder-co/live?maponly";
    const entryUrl = process.env.DIGITAL_TWIN_E2E_URL;
    await page.goto(
      entryUrl ? new URL(relativeUrl, entryUrl).href : relativeUrl
    );

    await expect(page).toHaveURL(/\/regions\/boulder-co\/live\?maponly$/);
    await expect(page.locator("[data-digital-twin-shell]")).toHaveAttribute(
      "data-map-only",
      ""
    );
    await expect(page.locator("[data-persistent-map-host]")).toBeVisible();
    await expect(page.locator(".maplibregl-canvas")).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: "Digital Twin navigation" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Alert queue" })
    ).toHaveCount(0);
  });

  test("keeps the real map and Engine workflows inside all Figma views", async ({
    page,
  }) => {
    await openDigitalTwin(page);

    const rail = page.getByRole("complementary", {
      name: "Digital Twin navigation",
    });
    await expect(
      rail.getByRole("button", { name: "Live", exact: true })
    ).toHaveAttribute("aria-current", "page");
    await expect(rail).toHaveCSS("backdrop-filter", /blur\(18px\)/);

    await page.getByRole("button", { name: "Plan", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Plan", exact: true })
    ).toHaveAttribute("aria-pressed", "true");

    await page.locator(".dt-demo").evaluate((element) => {
      element.setAttribute("data-session-sentinel", "preserved");
    });
    const startInvestigation = page.getByRole("button", {
      name: "Start investigation",
    });
    await startInvestigation.click();
    const simulationDialog = page.getByRole("dialog", {
      name: "Simulation workspace",
    });
    await expect(simulationDialog).toBeVisible();
    await expect(simulationDialog).not.toHaveAttribute("aria-modal", "true");
    await expect(page.locator(".dt-live-view__map")).toBeVisible();
    await expect(page.locator(".dt-demo")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(startInvestigation).toBeFocused();

    await rail.getByRole("button", { name: "Scenarios", exact: true }).click();
    await expect(page).toHaveURL(/\/regions\/boulder-co\/scenarios$/);
    await expect(
      page.getByRole("heading", { name: "Scenarios", exact: true })
    ).toBeVisible();
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.locator(".maplibregl-canvas")).toHaveCount(1);
    await page
      .getByRole("button", { name: "New scenario", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Simulation Scenario" })
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await rail.getByRole("button", { name: "Runs", exact: true }).click();
    await expect(page).toHaveURL(/\/regions\/boulder-co\/runs$/);
    await expect(
      page.getByRole("heading", { name: "Runs", exact: true })
    ).toBeVisible();
    await expect(page.getByRole("main")).toHaveCount(1);
    await page
      .getByRole("button", { name: "New simulation", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Prior runs" })
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await rail.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Settings", exact: true })
    ).toBeVisible();
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: "Alert routing", exact: true })
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: "Open general workspace settings; alert-routing preview changes will not be saved",
      })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(
      page.locator('.dt-demo[data-session-sentinel="preserved"]')
    ).toHaveCount(1);
  });

  test("resizes Figma panes without remounting the map or Engine plugin", async ({
    page,
  }) => {
    await openDigitalTwin(page);
    await page.locator(".dt-demo").evaluate((element) => {
      element.setAttribute("data-resize-sentinel", "preserved");
    });

    const queue = page.getByRole("complementary", { name: "Alert queue" });
    const queueBefore = (await queue.boundingBox())?.width ?? 0;
    await dragSeparator(page, "Resize alert queue", 64);
    expect((await queue.boundingBox())?.width ?? 0).toBeGreaterThan(
      queueBefore + 45
    );

    const details = page.getByRole("complementary", { name: "Alert details" });
    const detailsBefore = (await details.boundingBox())?.width ?? 0;
    await dragSeparator(page, "Resize alert details", -56);
    expect((await details.boundingBox())?.width ?? 0).toBeGreaterThan(
      detailsBefore + 40
    );

    await page.getByRole("button", { name: "Start investigation" }).click();
    await expect(
      page.getByRole("dialog", { name: "Simulation workspace" })
    ).toBeVisible();
    await page.keyboard.press("Escape");

    const rail = page.getByRole("complementary", {
      name: "Digital Twin navigation",
    });
    await rail.getByRole("button", { name: "Scenarios", exact: true }).click();
    const scenarioDetails = page.getByRole("complementary", {
      name: "Scenario details",
    });
    const scenarioBefore = (await scenarioDetails.boundingBox())?.width ?? 0;
    await dragSeparator(page, "Resize Scenario details", -48);
    expect((await scenarioDetails.boundingBox())?.width ?? 0).toBeGreaterThan(
      scenarioBefore + 35
    );

    await rail.getByRole("button", { name: "Settings", exact: true }).click();
    const settingsSeparator = page.getByRole("separator", {
      name: "Resize settings navigation",
    });
    const settingsBefore = Number(
      await settingsSeparator.getAttribute("aria-valuenow")
    );
    await settingsSeparator.press("ArrowRight");
    expect(
      Number(await settingsSeparator.getAttribute("aria-valuenow"))
    ).toBeGreaterThan(settingsBefore);

    await expect(page.locator(".maplibregl-canvas")).toHaveCount(1);
    await expect(
      page.locator('.dt-demo[data-resize-sentinel="preserved"]')
    ).toHaveCount(1);
  });

  test("opens summary drill-downs and records operator activity", async ({
    page,
  }) => {
    await openDigitalTwin(page);

    const details = page.getByRole("complementary", { name: "Alert details" });
    const summaryTab = details.getByRole("tab", {
      name: "Summary",
      exact: true,
    });
    const evidenceTab = details.getByRole("tab", {
      name: "Evidence",
      exact: true,
    });
    const assetTab = details.getByRole("tab", {
      name: "Asset",
      exact: true,
    });

    await details
      .getByRole("button", {
        name: "Open weather evidence, 15 mph East",
        exact: true,
      })
      .click();
    await expect(evidenceTab).toHaveAttribute("aria-selected", "true");
    await expect(
      details.getByRole("heading", { name: "Weather conditions" })
    ).toBeVisible();

    await summaryTab.click();
    await details
      .getByRole("button", {
        name: "Open model confidence evidence, 92 percent",
        exact: true,
      })
      .click();
    await expect(
      details.getByRole("heading", { name: "Model confidence" })
    ).toBeVisible();

    await summaryTab.click();
    await details
      .getByRole("button", {
        name: "Open primary driver evidence, Vegetation clearance",
        exact: true,
      })
      .click();
    await expect(
      details.getByRole("heading", { name: "Primary driver" })
    ).toBeVisible();

    await summaryTab.click();
    await details
      .getByRole("button", {
        name: "Open affected asset details for Circuit FRN-12 · Segment 14",
        exact: true,
      })
      .click();
    await expect(assetTab).toHaveAttribute("aria-selected", "true");
    await expect(
      details.getByRole("heading", { name: "Circuit FRN-12 · Segment 14" })
    ).toBeVisible();

    await summaryTab.click();
    const acknowledge = page.getByRole("button", {
      name: "Acknowledge",
      exact: true,
    });
    await acknowledge.click();
    await expect(
      page.getByRole("button", { name: "Acknowledged", exact: true })
    ).toBeDisabled();
    await expect(
      details.getByText("Acknowledged by A. Chen", { exact: true })
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Create handoff", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Handoff created", exact: true })
    ).toBeVisible();
    await expect(
      details.getByText("Handoff created", { exact: true })
    ).toBeVisible();
  });
});
