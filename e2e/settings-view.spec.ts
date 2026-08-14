import { expect, test } from "@playwright/test";

test.describe("Digital Twin settings", () => {
  test("navigates the initial settings scopes and keeps preview controls interactive", async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));
    await page.route("**/api/digital-twin/access", async (route) => {
      await route.fulfill({
        json: {
          subject_id: "operator-7",
          display_name: "A. Chen",
          organization: { id: "wattbyte", name: "WattByte Nexus" },
          roles: ["operator", "administrator"],
          capabilities: ["digital-twin", "expert-gis", "administration"],
          regions: [{ id: "boulder-co", name: "Boulder Foothills" }],
          most_recently_used_region_id: "boulder-co",
          saved_start_location: "digital-twin",
        },
      });
    });
    await page.route("**/api/v1/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      const json = path.endsWith("/api/v1/health/ready")
        ? { status: "ready" }
        : path.endsWith("/api/v1/regions")
          ? {
              items: [
                {
                  region_id: "boulder-co",
                  name: "Boulder Foothills",
                  status: "published",
                  bounds: { west: -105.35, south: 39.95, east: -105.15, north: 40.1 },
                },
              ],
            }
          : { items: [] };
      await route.fulfill({ json });
    });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.goto("/regions/boulder-co/live");
    await expect.poll(() => pageErrors.map((error) => error.message)).toEqual([]);
    await page.getByRole("button", { name: "Settings", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Alert routing", exact: true })).toBeVisible();
    const productSidebar = page.locator(
      '[data-slot="sidebar-container"][aria-label="Digital Twin navigation"]',
    );
    const productTopbar = page.locator(
      'header[aria-label="Digital Twin application header"]',
    );
    await expect(productSidebar).toHaveCount(0);
    await expect(productTopbar).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Close settings and return to workspace" }),
    ).toBeVisible();
    const settingsSearch = page.getByRole("searchbox", { name: "Search settings" });
    await expect(settingsSearch).toBeVisible();
    await settingsSearch.fill("map");
    await expect(page.getByRole("button", { name: "Map & display" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Preferences" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Map & display" })).toBeVisible();
    await settingsSearch.clear();

    await page.getByRole("button", { name: "Preferences", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Preferences", exact: true })).toBeVisible();
    const reduceMotion = page.getByRole("switch", { name: "Reduce motion" });
    await reduceMotion.click();
    await expect(reduceMotion).toBeChecked();

    await page.getByRole("button", { name: "Simulation presets", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Simulation presets", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Presets are starting values, not hidden engine configuration."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Members & roles", exact: true }).click();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(
      page.getByRole("table").getByText("Grid Operations", { exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Status & health", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Status & health", exact: true })).toBeVisible();
    await expect(page.getByText("Requires restart", { exact: true })).toBeVisible();

    await page
      .getByRole("button", { name: "Close settings and return to workspace" })
      .click();
    await expect(productSidebar).toBeVisible();
    await expect(productTopbar).toBeVisible();
  });
});
