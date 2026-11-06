import { expect, test, type Page } from "@playwright/test";
const account = {
  id: "staff-1",
  role: "PLATFORM_SUPER_ADMIN",
  first_name: "Alex",
  last_name: "Admin",
  email: "alex@example.test",
  activation_state: "active",
  suspended: false,
  organization_id: null,
  department_id: null,
  version: 1,
};
const standard = {
  id: "standard",
  name: "Standard",
  kind: "STANDARD",
  features: ["region:read", "runs:submit"],
  cpu_hours: 20,
  storage_bytes: 500000000,
  version: 1,
  deletable: false,
};
async function session(
  page: Page,
  role = "PLATFORM_SUPER_ADMIN",
  expired = false
) {
  await page.route("**/api/digital-twin/access", (route) =>
    route.fulfill({
      json: {
        subject_id: "subject",
        account_id: account.id,
        display_name: "Alex Admin",
        roles: [role],
        organization: role.startsWith("TENANT_")
          ? { id: "org-1", name: "Utility One" }
          : null,
        capabilities:
          role === "TENANT_ADMIN"
            ? [expired ? "expired-tenant-access" : "tenant-administration"]
            : role === "TENANT_USER"
            ? ["digital-twin"]
            : ["administration"],
        regions: [],
        permissions: [],
        plan: null,
        access_state: expired ? "organization-expired" : "active",
      },
    })
  );
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
}
test("staff invitations retain their intent through explicit email verification", async ({
  page,
}) => {
  await session(page);
  const people = [account];
  const writes: {
    key: string | undefined;
    body: unknown;
    proof: string | undefined;
  }[] = [];
  await page.route("**/api/digital-twin/management/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.split("/management")[1];
    if (path === "/staff" && request.method() === "GET")
      return route.fulfill({ json: { items: people, next_cursor: null } });
    if (path === "/verification/start") {
      expect(request.postDataJSON().action).toBe(
        "POST:/api/digital-twin/management/staff"
      );
      return route.fulfill({
        json: { challenge_id: "challenge", expires_at: "2026-11-06T12:00:00Z" },
      });
    }
    if (path === "/verification/verify") {
      expect(request.postDataJSON().code).toBe("123456");
      return route.fulfill({ json: { action_proof: "fresh-proof" } });
    }
    if (path === "/staff" && request.method() === "POST") {
      writes.push({
        key: request.headers()["idempotency-key"],
        body: request.postDataJSON(),
        proof: request.headers()["x-action-proof"],
      });
      if (!writes.at(-1)?.proof)
        return route.fulfill({ status: 428, json: {} });
      people.push({
        ...account,
        ...request.postDataJSON(),
        id: "invited-2",
        activation_state: "invited",
      });
      return route.fulfill({ status: 201, json: people.at(-1) });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Administration", exact: true })
  ).toBeVisible();
  await page.getByLabel("First name", { exact: true }).fill("Jamie");
  await page.getByLabel("Last name", { exact: true }).fill("Reviewer");
  await page.getByLabel("Email", { exact: true }).fill("jamie@example.test");
  await page
    .getByRole("button", { name: "Send invitation", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Verify your email");
  await page
    .getByRole("button", { name: "Send email verification code" })
    .click();
  await page.getByLabel("Email verification code").fill("123456");
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  expect(writes).toHaveLength(1);
  await page.getByRole("button", { name: "Confirm verified action" }).click();
  await expect(
    page.getByText("jamie@example.test", { exact: true })
  ).toBeVisible();
  expect(writes).toHaveLength(2);
  expect(writes[0].key).toBeTruthy();
  expect(writes[1].key).toBe(writes[0].key);
  expect(writes[1].body).toEqual(writes[0].body);
  expect(writes[1].proof).toBe("fresh-proof");
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(0);
  await page.locator("main").evaluate((element) => element.scrollTo(0, 0));
  await page.screenshot({
    path: "/tmp/digital-twin-admin-light.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await expect(page.locator("tbody td").first()).toHaveCSS(
    "color",
    "rgb(248, 250, 252)"
  );
  await page.screenshot({
    path: "/tmp/digital-twin-admin-dark.png",
    fullPage: true,
    animations: "disabled",
  });
});
test("system plans expose limits and preserve their protected features", async ({
  page,
}) => {
  await session(page);
  let saved: unknown;
  await page.route("**/api/digital-twin/management/**", (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.split("/management")[1];
    if (path === "/staff")
      return route.fulfill({ json: { items: [account], next_cursor: null } });
    if (path === "/features")
      return route.fulfill({
        json: {
          items: standard.features.map((id) => ({
            id,
            enabled: true,
            is_ai: false,
            version: 1,
          })),
          next_cursor: null,
        },
      });
    if (path === "/plans")
      return route.fulfill({ json: { items: [standard], next_cursor: null } });
    if (path === "/plans/standard") {
      saved = request.postDataJSON();
      return route.fulfill({ json: { ...standard, version: 2 } });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto("/admin");
  await page.getByRole("tab", { name: "Plans", exact: true }).click();
  await expect(
    page.getByText("Standard is a protected system plan.", { exact: false })
  ).toBeVisible();
  const system = page.locator("form").filter({
    has: page.getByRole("button", { name: "Save plan", exact: true }),
  });
  await expect(system.getByLabel("Plan name", { exact: true })).toHaveCount(0);
  await expect(system.getByRole("checkbox")).toHaveCount(0);
  await system.getByLabel("Cumulative compute hours per user").fill("25");
  await system.getByRole("button", { name: "Save plan", exact: true }).click();
  await expect
    .poll(() => saved)
    .toEqual({
      name: "Standard",
      features: standard.features,
      cpu_hours: 25,
      storage_bytes: 500000000,
      version: 1,
    });
});
test("expired tenant administrators load only extension recovery and cannot mount product", async ({
  page,
}) => {
  await session(page, "TENANT_ADMIN", true);
  const reads: string[] = [];
  await page.route("**/api/digital-twin/management/**", (route) => {
    reads.push(route.request().url());
    return route.fulfill({ json: { items: [], next_cursor: null } });
  });
  await page.goto("/");
  await expect(page).toHaveURL(/tenant-admin$/);
  await expect(
    page.getByText("Organization access has expired", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Users and departments" })
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Request extension", exact: true })
  ).toBeVisible();
  expect(reads.every((url) => url.endsWith("/organization-extensions"))).toBe(
    true
  );
  await page.goto("/regions/private/live");
  await expect(
    page.getByText("This location is not available", { exact: true })
  ).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(0);
});
test("tenant user invitations have no role, email-edit, password or feature override controls", async ({
  page,
}) => {
  await session(page, "TENANT_ADMIN");
  let invite: unknown;
  await page.route("**/api/digital-twin/management/**", (route) => {
    const request = route.request();
    if (request.url().endsWith("/tenant-users")) {
      invite = request.postDataJSON();
      return route.fulfill({ status: 201, json: {} });
    }
    return route.fulfill({
      json: {
        organization: {},
        plan: standard,
        users: [],
        departments: [{ id: "dept", name: "Operations", version: 1 }],
      },
    });
  });
  await page.goto("/tenant-admin");
  await page.getByLabel("First name", { exact: true }).fill("Pat");
  await page.getByLabel("Last name", { exact: true }).fill("User");
  await page.getByLabel("Email", { exact: true }).fill("pat@example.test");
  await page.getByLabel("Department", { exact: true }).selectOption("dept");
  await page
    .getByRole("button", { name: "Send invitation", exact: true })
    .click();
  await expect
    .poll(() => invite)
    .toEqual({
      first_name: "Pat",
      last_name: "User",
      email: "pat@example.test",
      department_id: "dept",
    });
  await expect(page.getByLabel("Staff role")).toHaveCount(0);
  await expect(page.getByLabel(/password/i)).toHaveCount(0);
});
test("public applications submit without mounting protected workspaces", async ({
  page,
}) => {
  let payload: unknown;
  let protectedCalls = 0;
  await page.route("**/api/digital-twin/access", (route) => {
    protectedCalls++;
    return route.fulfill({ status: 401, json: {} });
  });
  await page.route("**/api/digital-twin/public/trial-applications", (route) => {
    payload = route.request().postDataJSON();
    return route.fulfill({ status: 202, json: { accepted: true } });
  });
  await page.goto("/request-trial");
  await page.getByLabel("First name", { exact: true }).fill("Rae");
  await page.getByLabel("Last name", { exact: true }).fill("Trial");
  await page.getByLabel("Email", { exact: true }).fill("rae@example.test");
  await page.getByLabel("Organization", { exact: true }).fill("Grid Co");
  await page
    .getByLabel("What would you like to evaluate?")
    .fill("Wildfire scenarios");
  await page.getByRole("button", { name: "Submit trial request" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Your request was received"
  );
  expect(protectedCalls).toBe(0);
  expect(payload).toEqual({
    first_name: "Rae",
    last_name: "Trial",
    email: "rae@example.test",
    organization_name: "Grid Co",
    reason: "Wildfire scenarios",
    website: "",
  });
});
test("activation removes invitation secrets from the address bar and submits them only to activation", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("geolibre.digital-twin.api-url", "https://untrusted-engine.example"));
  let payload: unknown;
  await page.route("**/api/digital-twin/public/activate", (route) => {
    expect(new URL(route.request().url()).origin).toBe("http://localhost:4173");
    payload = route.request().postDataJSON();
    return route.fulfill({ json: { activated: true } });
  });
  await page.goto("/activate#token=invitation-secret");
  await expect(page).toHaveURL(/activate$/);
  await page
    .getByLabel("New password", { exact: true })
    .fill("UniquePassword!234");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("UniquePassword!234");
  await page
    .getByRole("button", { name: "Activate account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Account activation confirmed"
  );
  expect(payload).toEqual({
    token: "invitation-secret",
    password: "UniquePassword!234",
  });
});

test("web trial review requires an owned decision and a separate provisioning confirmation", async ({
  page,
}) => {
  await session(page, "WEB_TRIAL_ADMIN");
  let application = {
    id: "application-1",
    email: "rae@example.test",
    first_name: "Rae",
    last_name: "Trial",
    organization_name: "Grid Co",
    reason: "Evaluate wildfire simulation",
    status: "PENDING",
    owner_id: null as string | null,
    version: 1,
    created_at: "2026-11-05T12:00:00Z",
    decision_message: "",
    provisioned_account_id: null as string | null,
  };
  const mutations: { path: string; body: unknown }[] = [];
  await page.route("**/api/digital-twin/management/**", (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.split("/management")[1];
    if (path === "/trial-plan")
      return route.fulfill({
        json: { ...standard, id: "trial", name: "Trial", kind: "TRIAL" },
      });
    if (path === "/applications")
      return route.fulfill({
        json: { items: [application], next_cursor: null },
      });
    const body = request.postDataJSON();
    mutations.push({ path, body });
    if (path.endsWith("/claim"))
      application = {
        ...application,
        owner_id: account.id,
        status: "UNDER_EVALUATION",
        version: 2,
      };
    else if (path.endsWith("/decision"))
      application = {
        ...application,
        status: "APPROVED",
        version: 3,
        decision_message: body.message,
      };
    else if (path.endsWith("/provision"))
      application = {
        ...application,
        provisioned_account_id: "trial-user",
        version: 4,
      };
    else return route.fulfill({ status: 404, json: {} });
    return route.fulfill({ json: application });
  });
  await page.goto("/admin");
  await expect(
    page.getByRole("button", { name: "Approve application", exact: true })
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Claim application", exact: true })
    .click();
  await page
    .getByLabel("Decision message", { exact: true })
    .fill("Approved for evaluation");
  await page
    .getByRole("button", { name: "Approve application", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Confirm provisioning and send invitation",
    })
  ).toBeVisible();
  expect(
    mutations.some((mutation) => mutation.path.endsWith("/provision"))
  ).toBe(false);
  await page.getByLabel("Trial duration in days").fill("21");
  await page
    .getByRole("checkbox", {
      name: "I reviewed the recipient, Trial plan, and duration.",
    })
    .check();
  await page
    .getByRole("button", { name: "Confirm provisioning and send invitation" })
    .click();
  await expect(
    page.getByText("Account provisioned.", { exact: false })
  ).toBeVisible();
  expect(mutations).toEqual([
    { path: "/applications/application-1/claim", body: { version: 1 } },
    {
      path: "/applications/application-1/decision",
      body: { version: 2, approved: true, message: "Approved for evaluation" },
    },
    {
      path: "/applications/application-1/provision",
      body: { version: 3, duration_days: 21, confirmed: true },
    },
  ]);
});
test("trial extension decisions bind approval to the currently reviewed expiry", async ({
  page,
}) => {
  await session(page, "WEB_TRIAL_ADMIN");
  let decision: unknown;
  await page.route("**/api/digital-twin/management/**", (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.split("/management")[1];
    if (path === "/trial-plan")
      return route.fulfill({
        json: { ...standard, id: "trial", name: "Trial", kind: "TRIAL" },
      });
    if (path === "/applications")
      return route.fulfill({ json: { items: [], next_cursor: null } });
    if (path === "/trial-extensions")
      return route.fulfill({
        json: {
          items: [
            {
              id: "extension-1",
              account_id: "trial-user",
              organization_id: "trial-org",
              status: "PENDING",
              version: 4,
              current_expires_at: "2026-12-01T12:00:00Z",
              requested_expires_at: "2027-01-01T12:00:00Z",
              reason: "Continue the evaluation",
              created_at: "2026-11-05T12:00:00Z",
            },
          ],
          next_cursor: null,
        },
      });
    if (path.endsWith("/decision")) {
      decision = request.postDataJSON();
      return route.fulfill({ json: {} });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto("/admin");
  await page.getByRole("tab", { name: "Extensions", exact: true }).click();
  await page
    .getByLabel("Decision message", { exact: true })
    .fill("Extended evaluation");
  await page
    .getByRole("button", { name: "Approve extension", exact: true })
    .click();
  await expect
    .poll(() => decision)
    .toEqual({
      version: 4,
      approved: true,
      message: "Extended evaluation",
      expires_at: "2027-01-01T12:00:00Z",
      expected_expires_at: "2026-12-01T12:00:00Z",
    });
});
test("stale management edits show a conflict and leave the current record intact", async ({
  page,
}) => {
  await session(page);
  await page.route("**/api/digital-twin/management/staff", (route) =>
    route.fulfill({ json: { items: [account], next_cursor: null } })
  );
  await page.route(
    "**/api/digital-twin/management/staff/staff-1/state",
    (route) =>
      route.fulfill({
        status: 409,
        json: { detail: "private database conflict" },
      })
  );
  await page.goto("/admin");
  await page.getByRole("button", { name: "Suspend", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "This record changed or conflicts"
  );
  await expect(page.getByRole("alert")).not.toContainText(
    "private database conflict"
  );
  await expect(page.getByText("Activated", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true })
  ).toBeEnabled();
});

test("product account displays elapsed compute separately from configured storage allowance", async ({
  page,
}) => {
  await session(page, "TENANT_USER");
  await page.route("**/api/digital-twin/management/**", (route) => {
    if (route.request().url().endsWith("/me"))
      return route.fulfill({
        json: {
          account: {
            ...account,
            role: "TENANT_USER",
            organization_id: "org-1",
          },
          organization: {
            id: "org-1",
            name: "Utility One",
            expires_at: "2027-01-01T12:00:00Z",
            is_trial: false,
          },
          plan: standard,
          features: standard.features,
          access_state: "active",
          usage: {
            enforced: true,
            cpu_used_seconds: 5400,
            cpu_hours: 20,
            storage_bytes: 500000000,
            storage_used_bytes: null,
            storage_enforced: false,
            active_runs: 1,
          },
        },
      });
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto("/");
  await expect(page).toHaveURL(/account$/);
  await expect(
    page.getByText("Compute used: 1.50 elapsed hours", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("Storage used: Not measured", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText(
      "Storage allowance is configured; upload admission is not enforced.",
      { exact: true }
    )
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Staff", exact: true })
  ).toHaveCount(0);
});

test("invitation delivery failures stay distinct from account activation and allow a safe resend", async ({
  page,
}) => {
  await session(page);
  let resend: unknown;
  const invited = {
    ...account,
    id: "invited",
    activation_state: "invited",
    invitation_delivery: {
      state: "failed",
      attempts: 2,
      failure_code: "provider_unavailable",
    },
  };
  await page.route("**/api/digital-twin/management/**", (route) => {
    const request = route.request();
    if (request.url().endsWith("/resend-invitation")) {
      resend = request.postDataJSON();
      return route.fulfill({
        json: {
          ...invited,
          invitation_delivery: {
            ...invited.invitation_delivery,
            state: "pending",
          },
        },
      });
    }
    return route.fulfill({ json: { items: [invited], next_cursor: null } });
  });
  await page.goto("/admin");
  await expect(
    page.getByText("Invitation pending", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("Invitation delivery failed", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("Delivery attempts: 2", { exact: true })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Resend invitation", exact: true })
    .click();
  await expect.poll(() => resend).toEqual({ version: 1 });
});
test("administration remains scrollable on mobile with keyboard-visible focus and full-size targets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await session(page);
  await page.route("**/api/digital-twin/management/staff", (route) =>
    route.fulfill({ json: { items: [account], next_cursor: null } })
  );
  await page.goto("/admin");
  await expect(
    page.getByRole("cell", { name: "Platform administrator", exact: true })
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Dark mode", exact: true })
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Dark mode", exact: true })
  ).not.toHaveCSS("box-shadow", "none");
  expect(
    await page
      .getByRole("button", { name: "Dark mode", exact: true })
      .evaluate((element) => element.matches(":focus-visible"))
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/digital-twin-admin-mobile-overview.png",
    fullPage: true,
    animations: "disabled",
  });
  const send = page.getByRole("button", {
    name: "Send invitation",
    exact: true,
  });
  await send.scrollIntoViewIfNeeded();
  await expect(send).toBeVisible();
  expect(
    await send.evaluate((element) => element.getBoundingClientRect().height)
  ).toBeGreaterThanOrEqual(44);
  expect(
    await page
      .locator("main")
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1)
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/digital-twin-admin-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});
test("a product account with create authority can author its first owned region without account administration", async ({
  page,
}) => {
  await session(page, "TENANT_USER");
  await page.route("**/api/digital-twin/access", (route) =>
    route.fulfill({
      json: {
        subject_id: "subject",
        account_id: "product",
        display_name: "Product user",
        roles: ["TENANT_USER"],
        organization: { id: "org-1", name: "Utility One" },
        capabilities: ["digital-twin"],
        regions: [],
        permissions: ["region:create"],
        plan: standard,
        access_state: "active",
      },
    })
  );
  const regions: {
    region_id: string;
    name: string;
    status: string;
    bounds: unknown;
    published_revision_id: null;
  }[] = [];
  await page.route("**/api/v1/**", (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.split("/api/v1")[1];
    if (path === "/regions" && request.method() === "POST") {
      const region = {
        ...request.postDataJSON(),
        region_id: "first-region",
        status: "draft",
        published_revision_id: null,
      };
      regions.push(region);
      return route.fulfill({ status: 201, json: region });
    }
    if (path === "/regions")
      return route.fulfill({ json: { items: regions, next_cursor: null } });
    if (path.endsWith("/readiness"))
      return route.fulfill({
        json: {
          region_id: "first-region",
          publication_status: "draft",
          configured: false,
          grid_hydrated: false,
          runtime_ready: true,
          ready_to_simulate: false,
          sources: [],
          reason_codes: [],
        },
      });
    if (path === "/regions/first-region")
      return route.fulfill({ json: regions[0] });
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto("/");
  await expect(page).toHaveURL(/data$/);
  await expect(
    page.getByRole("heading", { name: "Data administration", exact: true })
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("First owned region");
  await page.getByLabel("WGS84 bounds").fill("-105.3, 40, -105.2, 40.1");
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await expect.poll(() => regions.length).toBe(1);
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(0);
  await expect(
    page.getByRole("tab", { name: "Staff", exact: true })
  ).toHaveCount(0);
});
