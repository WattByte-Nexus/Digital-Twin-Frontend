import { expect, test, type Page } from "@playwright/test";
import fixtures from "../tests/fixtures/digital-twin-engine.api-fixtures.json";

async function installEngine(page: Page) {
  let health: "ready" | "degraded" | "offline" = "ready";
  await page.route("**/api/digital-twin/access", (route) =>
    route.fulfill({
      json: {
        subject_id: "settings-operator",
        display_name: "Test operator",
        organization: { id: "test", name: "Test operations" },
        roles: ["administrator"],
        capabilities: ["digital-twin", "administration"],
        regions: [{ id: fixtures.region.region_id, name: fixtures.region.name }],
        most_recently_used_region_id: fixtures.region.region_id,
        saved_start_location: "digital-twin",
      },
    }),
  );
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1/, "");
    if (path.startsWith("/health/")) {
      await route.fulfill(
        health === "offline" || (health === "degraded" && path === "/health/ready")
          ? { status: 503, json: { detail: "Unavailable" } }
          : { json: { status: path === "/health/live" ? "live" : "ready" } },
      );
      return;
    }
    const regionPath = `/regions/${fixtures.region.region_id}`;
    const json =
      path === "/regions"
        ? fixtures.region_page
        : path === regionPath
          ? fixtures.region
          : path.endsWith("/readiness")
            ? fixtures.region_readiness
            : path.endsWith("/weather-datasets")
              ? fixtures.weather_page
              : path.endsWith("/assets.geojson")
                ? { type: "FeatureCollection", features: [] }
                : path.endsWith("/assets") || path === "/data-sources"
                  ? []
                  : { items: [], next_cursor: null };
    await route.fulfill({ json });
  });
  return {
    setHealth: (next: typeof health) => {
      health = next;
    },
  };
}

async function openSettings(page: Page) {
  const settingsButton = page.getByRole("button", { name: "Settings", exact: true });
  const openSidebar = page.getByRole("button", { name: "Open sidebar", exact: true });
  await expect
    .poll(async () => (await settingsButton.isVisible()) || (await openSidebar.isVisible()))
    .toBe(true);
  if (!(await settingsButton.isVisible())) {
    await openSidebar.click();
  }
  await settingsButton.click();
  await expect(page.getByRole("heading", { name: "Appearance", exact: true })).toBeVisible();
}

async function chooseSection(page: Page, name: string) {
  const mobileSection = page.getByRole("combobox", { name: "Settings section" });
  const desktopSection = page.getByRole("button", { name, exact: true });
  await expect
    .poll(async () => (await mobileSection.isVisible()) || (await desktopSection.isVisible()))
    .toBe(true);
  if (await mobileSection.isVisible()) {
    await mobileSection.click();
    await page.getByRole("option", { name, exact: true }).click();
  } else {
    await desktopSection.click();
  }
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}

test.describe("Digital Twin settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  });

  test("appearance persists and map controls share the live workspace state", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await installEngine(page);
    await page.goto(`/regions/${fixtures.region.region_id}/live`);
    await openSettings(page);

    await page.getByRole("radio", { name: "Dark", exact: true }).click();
    await expect(page.getByRole("radio", { name: "Dark", exact: true })).toBeChecked();
    await page.getByRole("combobox", { name: "Accent color" }).click();
    await page.getByRole("option", { name: "Violet", exact: true }).click();
    await expect(page.getByRole("combobox", { name: "Accent color" })).toHaveText(/Violet/i);
    await page.reload();
    await openSettings(page);
    await expect(page.getByRole("radio", { name: "Dark", exact: true })).toBeChecked();
    await expect(page.getByRole("combobox", { name: "Accent color" })).toHaveText(/Violet/i);
    // Scoped theme surfaces must keep the chosen accent, not reset to default blue.
    await expect
      .poll(() =>
        page
          .locator(".dt-settings-view")
          .evaluate((element) => getComputedStyle(element).getPropertyValue("--primary").trim()),
      )
      .toBe("263.4 70% 50.4%");

    await chooseSection(page, "Map & display");
    await expect(page.getByRole("switch")).toHaveCount(13);
    await page.getByRole("switch", { name: "Satellite imagery" }).click();
    await expect(page.getByRole("switch", { name: "Satellite imagery" })).not.toBeChecked();
    await page.getByRole("radio", { name: "Plan view" }).click();
    await expect(page.getByRole("radio", { name: "Plan view" })).toBeChecked();
    await page.getByRole("button", { name: "Close settings and return to workspace" }).click();
    await page.getByRole("menuitem", { name: "Surface", exact: true }).click();
    await expect(
      page.getByRole("menuitemcheckbox", { name: "Satellite imagery" }),
    ).not.toBeChecked();
    await page.keyboard.press("Escape");
    await page.getByRole("menuitem", { name: "View", exact: true }).click();
    await expect(page.getByRole("menuitemradio", { name: "Plan view" })).toBeChecked();
    await page.keyboard.press("Escape");

    await openSettings(page);
    await chooseSection(page, "Map & display");
    await page.getByRole("button", { name: "Restore map defaults" }).click();
    await expect(page.getByRole("switch", { name: "Satellite imagery" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "Terrain 3D" })).toBeChecked();
    await chooseSection(page, "Saved scenarios");
    await page.getByRole("button", { name: "Open saved scenarios" }).click();
    await expect(page).toHaveURL(/\/scenarios$/);
    await expect(page.locator(".dt-settings-view")).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test("engine health refreshes from ready through degraded and offline", async ({ page }) => {
    const engine = await installEngine(page);
    await page.goto(`/regions/${fixtures.region.region_id}/live`);
    await openSettings(page);
    await chooseSection(page, "Status & health");
    const status = page
      .getByRole("region", { name: "Status & health settings" })
      .getByRole("status");
    await expect(status).toHaveText("Live and ready");
    await expect(page.locator(".dt-settings-view time")).toHaveAttribute("datetime", /T/);
    engine.setHealth("degraded");
    await page.getByRole("button", { name: "Check now" }).click();
    await expect(status).toHaveText("Startup not ready");
    engine.setHealth("offline");
    await page.getByRole("button", { name: "Check now" }).click();
    await expect(status).toHaveText("Offline");
  });

  test("narrow layouts keep all settings and search reachable without overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installEngine(page);
    await page.goto(`/regions/${fixtures.region.region_id}/live`);
    await openSettings(page);
    await page.getByRole("radio", { name: "Dark", exact: true }).click();
    await page.getByRole("combobox", { name: "Accent color" }).click();
    await expect(page.getByRole("listbox")).toHaveClass(/dark/);
    await page.getByRole("option", { name: "Custom", exact: true }).click();
    await page.getByLabel("Custom accent", { exact: true }).fill("#a855f7");
    await expect(page.getByText("#a855f7", { exact: true })).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator(".dt-settings-view")
          .evaluate((element) => getComputedStyle(element).getPropertyValue("--primary").trim()),
      )
      .toBe("270.7 91% 65.1%");
    await chooseSection(page, "Map & display");
    await page.getByRole("switch", { name: "Elevation", exact: true }).focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("switch", { name: "Elevation", exact: true })).not.toBeChecked();
    const search = page.getByRole("searchbox", { name: "Search settings" });
    await search.fill("accent");
    await expect(page.getByRole("heading", { name: "Appearance", exact: true })).toBeVisible();
    await search.fill("no-such-setting");
    await expect(page.getByRole("heading", { name: "No settings found" })).toBeVisible();
    await page.getByRole("button", { name: "Clear search" }).click();
    await chooseSection(page, "Map & display");
    for (const width of [320, 760, 900]) {
      await page.setViewportSize({ width, height: 844 });
      if (width === 900) {
        await page.getByRole("separator", { name: "Resize settings navigation" }).focus();
        await page.keyboard.press("End");
      }
      await page.getByRole("button", { name: "Restore map defaults" }).scrollIntoViewIfNeeded();
      await expect(page.getByRole("button", { name: "Restore map defaults" })).toBeInViewport();
      expect(
        await page
          .locator(".dt-settings-content [data-radix-scroll-area-viewport]")
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
      ).toBe(true);
    }
  });
});
