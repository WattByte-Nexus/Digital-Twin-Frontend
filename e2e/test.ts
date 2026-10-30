import { expect, test as base } from "@playwright/test";

/** Give GIS smoke tests an authenticated expert workspace; native tests override this route. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route("**/api/digital-twin/access", (route) => route.fulfill({ json: {
      subject_id: "e2e-expert",
      display_name: "Test engineer",
      organization: { id: "test", name: "Test operations" },
      roles: ["engineer"],
      capabilities: ["expert-gis"],
      regions: [],
      most_recently_used_region_id: null,
      saved_start_location: "expert-gis",
    } }));
    await use(page);
  },
});

export { expect };
export type { Download, Page, TestInfo } from "@playwright/test";
