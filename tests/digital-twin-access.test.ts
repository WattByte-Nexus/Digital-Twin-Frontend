import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AccessResolutionError,
  createDevelopmentAccess,
  loadDigitalTwinAccess,
  hasRegionAction,
  parseAccessContext,
  resolveApplicationUrl,
  resolveAuthorizedLocation,
  resolveLandingLocation,
  type DigitalTwinAccessContext,
} from "../apps/geolibre-desktop/src/product-modes/digital-twin/access";

function access(
  overrides: Partial<DigitalTwinAccessContext> = {}
): DigitalTwinAccessContext {
  return {
    subjectId: "user-1",
    accountId: "account-1",
    accessState: "active",
    permissions: ["region:read"],
    plan: null,
    displayName: "Alex Operator",
    organization: { id: "utility-1", name: "Front Range Utility" },
    roles: ["TENANT_USER"],
    capabilities: ["digital-twin"],
    regions: [
      { id: "north-grid", name: "North Grid", actions: ["region:read"] },
      { id: "south/grid", name: "South Grid", actions: ["region:read"] },
    ],
    mostRecentlyUsedRegionId: "south/grid",
    savedStartLocation: "digital-twin",
    ...overrides,
  };
}

describe("Digital Twin access resolution", () => {
  it("lets an empty local product deployment reach its authorized data-authoring workspace", () => {
    const initial = createDevelopmentAccess([]);
    assert.deepEqual(initial.regions, []);
    assert.equal(resolveLandingLocation(initial), "/data");
  });
  it("grants local development access only to regions supplied by the Engine", () => {
    const developmentAccess = createDevelopmentAccess([
      { id: "north-grid", name: "North Grid", actions: ["region:read"] },
      { id: "south-grid", name: "South Grid" },
    ]);

    assert.deepEqual(
      developmentAccess.regions.map(({ id, name }) => ({ id, name })),
      [
        { id: "north-grid", name: "North Grid" },
        { id: "south-grid", name: "South Grid" },
      ]
    );
    assert.equal(developmentAccess.mostRecentlyUsedRegionId, "north-grid");
  });

  it("fails local development access when the requested region is absent from the Engine", () => {
    assert.throws(
      () =>
        createDevelopmentAccess([{ id: "north-grid", name: "North Grid" }], {
          regionId: "missing-grid",
        }),
      /does not expose region missing-grid/
    );
  });

  it("resolves deployment endpoints from the app base instead of a deep-link route", () => {
    assert.equal(
      resolveApplicationUrl(
        undefined,
        "api/digital-twin/access",
        "/pilot/",
        "https://example.com/pilot/regions/north-grid/live"
      ),
      "https://example.com/pilot/api/digital-twin/access"
    );
    assert.equal(
      resolveApplicationUrl(
        "/session/access",
        "api/digital-twin/access",
        "/pilot/",
        "https://example.com/pilot/regions/north-grid/live"
      ),
      "https://example.com/session/access"
    );
  });

  it("lands an operator in the most recently used authorized region", () => {
    assert.equal(
      resolveLandingLocation(access()),
      "/regions/south%2Fgrid/live"
    );
  });

  it("falls back to the first authorized region when the saved region is stale", () => {
    assert.equal(
      resolveLandingLocation(
        access({ mostRecentlyUsedRegionId: "removed-region" })
      ),
      "/regions/north-grid/live"
    );
  });

  it("honors an authorized engineer's saved Expert GIS start location", () => {
    assert.equal(
      resolveLandingLocation(
        access({
          roles: ["TENANT_USER"],
          capabilities: ["digital-twin", "expert-gis"],
          savedStartLocation: "expert-gis",
        })
      ),
      "/workspace?returnTo=%2Fregions%2Fsouth%252Fgrid%2Flive"
    );
  });

  it("lands an administrator without operational scope in Administration", () => {
    assert.equal(
      resolveLandingLocation(
        access({
          organization: null,
          roles: ["PLATFORM_SUPER_ADMIN"],
          capabilities: ["administration", "expert-gis"],
          regions: [],
          mostRecentlyUsedRegionId: null,
        })
      ),
      "/admin"
    );
  });

  it("preserves an authorized alert deep link and its investigative query state", () => {
    const requested =
      "/regions/north-grid/alerts/alert-42?object=span-7&tick=tick-9&view=3d#evidence";
    assert.deepEqual(resolveAuthorizedLocation(access(), requested), {
      kind: "allowed",
      location: requested,
      mode: "digital-twin",
      view: "live",
      regionId: "north-grid",
    });
  });

  it("preserves an authorized asset catalog deep link", () => {
    const requested = "/regions/north-grid/assets/line-14";
    assert.deepEqual(resolveAuthorizedLocation(access(), requested), {
      kind: "allowed",
      location: requested,
      mode: "digital-twin",
      view: "assets",
      regionId: "north-grid",
    });
  });

  it("allows the Scenarios and Runs destination routes in an authorized region", () => {
    assert.equal(
      resolveAuthorizedLocation(access(), "/regions/north-grid/scenarios").kind,
      "allowed"
    );
    assert.equal(
      resolveAuthorizedLocation(access(), "/regions/north-grid/runs").kind,
      "allowed"
    );
  });

  it("rejects a deep link into a region outside the resolved access scope", () => {
    assert.deepEqual(
      resolveAuthorizedLocation(
        access(),
        "/regions/other-grid/runs/run-9?tick=tick-3"
      ),
      { kind: "denied", reason: "region" }
    );
  });

  it("rejects lookalike paths that are not product routes", () => {
    assert.deepEqual(
      resolveAuthorizedLocation(
        access(),
        "/regions/north-grid/live/private-data"
      ),
      { kind: "denied", reason: "route" }
    );
    assert.deepEqual(
      resolveAuthorizedLocation(access(), "/workspace/advanced"),
      {
        kind: "denied",
        reason: "route",
      }
    );
  });

  it("treats Expert GIS as a capability boundary rather than a hidden control", () => {
    assert.deepEqual(resolveAuthorizedLocation(access(), "/workspace"), {
      kind: "denied",
      reason: "expert-gis",
    });
    assert.deepEqual(
      resolveAuthorizedLocation(
        access({ capabilities: ["digital-twin", "expert-gis"] }),
        "/workspace?returnTo=%2Fregions%2Fnorth-grid%2Flive"
      ),
      {
        kind: "allowed",
        location: "/workspace?returnTo=%2Fregions%2Fnorth-grid%2Flive",
        mode: "expert-gis",
        view: "live",
        regionId: null,
      }
    );
  });

  it("does not let the legacy workspace query flag bypass the route guard", () => {
    assert.deepEqual(
      resolveAuthorizedLocation(access(), "/?workspace=expert"),
      {
        kind: "redirect",
        location: "/regions/south%2Fgrid/live",
      }
    );
  });

  it("redirects an authenticated sign-in visit without retaining protected labels", () => {
    assert.deepEqual(
      resolveAuthorizedLocation(access(), "/sign-in?returnTo=secret-label"),
      {
        kind: "redirect",
        location: "/regions/south%2Fgrid/live",
      }
    );
  });

  it("fails closed when a nominally authenticated response grants no product capability", () => {
    const noAccess = access({ capabilities: [], regions: [] });
    assert.deepEqual(resolveAuthorizedLocation(noAccess, "/diagnostics"), {
      kind: "denied",
      reason: "route",
    });
    assert.equal(resolveLandingLocation(noAccess), "/account");
  });

  it("validates the trusted backend access projection before using it", () => {
    assert.deepEqual(
      parseAccessContext({
        subject_id: "user-7",
        display_name: "Morgan Analyst",
        organization: { id: "utility-1", name: "Front Range Utility" },
        roles: ["TENANT_USER"],
        account_id: "account-7",
        access_state: "active",
        permissions: ["region:read"],
        plan: null,
        capabilities: ["digital-twin", "expert-gis", "made-up"],
        regions: [
          { id: "north-grid", name: "North Grid", actions: ["region:read"] },
        ],
        most_recently_used_region_id: "north-grid",
        saved_start_location: "expert-gis",
      }),
      {
        subjectId: "user-7",
        displayName: "Morgan Analyst",
        organization: { id: "utility-1", name: "Front Range Utility" },
        roles: ["TENANT_USER"],
        accountId: "account-7",
        accessState: "active",
        permissions: ["region:read"],
        plan: null,
        capabilities: ["digital-twin", "expert-gis"],
        regions: [
          { id: "north-grid", name: "North Grid", actions: ["region:read"] },
        ],
        mostRecentlyUsedRegionId: "north-grid",
        savedStartLocation: "expert-gis",
      }
    );
    assert.throws(
      () => parseAccessContext({ subject_id: "user-7", regions: [] }),
      AccessResolutionError
    );
  });

  it("allows an explicitly entitled product account to create its first owned region", () => {
    const creator = access({ regions: [], permissions: ["region:create"] });
    assert.equal(resolveLandingLocation(creator), "/data");
    assert.equal(resolveAuthorizedLocation(creator, "/data").kind, "allowed");
    assert.equal(hasRegionAction(creator, "", "region:create"), true);
    assert.equal(
      resolveAuthorizedLocation(
        { ...creator, roles: ["TENANT_ADMIN"] },
        "/data"
      ).kind,
      "denied"
    );
    assert.equal(
      resolveAuthorizedLocation({ ...creator, permissions: [] }, "/data").kind,
      "denied"
    );
  });
  it("keeps tenant administration separate from product access even with forged capabilities", () => {
    const admin = access({
      roles: ["TENANT_ADMIN"],
      capabilities: ["digital-twin", "expert-gis", "tenant-administration"],
    });
    assert.equal(resolveLandingLocation(admin), "/tenant-admin");
    assert.equal(
      resolveAuthorizedLocation(admin, "/tenant-admin").kind,
      "allowed"
    );
    assert.equal(
      resolveAuthorizedLocation(admin, "/regions/north-grid/live").kind,
      "denied"
    );
    assert.equal(resolveAuthorizedLocation(admin, "/workspace").kind, "denied");
    assert.equal(resolveAuthorizedLocation(admin, "/admin").kind, "denied");
  });
  it("admits tenant-free staff only to administration", () => {
    const staff = parseAccessContext({
      subject_id: "staff",
      account_id: "staff-account",
      display_name: "Platform staff",
      organization: null,
      roles: ["WEB_TRIAL_ADMIN"],
      capabilities: ["administration"],
      regions: [],
      access_state: "active",
      permissions: [],
      plan: null,
    });
    assert.equal(staff.organization, null);
    assert.equal(resolveLandingLocation(staff), "/admin");
    assert.equal(resolveAuthorizedLocation(staff, "/admin").kind, "allowed");
    assert.equal(resolveAuthorizedLocation(staff, "/account").kind, "denied");
    assert.equal(
      resolveAuthorizedLocation(staff, "/regions/north-grid/live").kind,
      "denied"
    );
  });
  it("keeps expired tenant administration restricted to its recovery workspace", () => {
    const expired = access({
      roles: ["TENANT_ADMIN"],
      accessState: "organization-expired",
      capabilities: ["expired-tenant-access"],
    });
    assert.equal(resolveLandingLocation(expired), "/tenant-admin");
    assert.equal(
      resolveAuthorizedLocation(expired, "/tenant-admin").kind,
      "allowed"
    );
    assert.equal(
      resolveAuthorizedLocation(expired, "/regions/north-grid/live").kind,
      "denied"
    );
  });
  it("checks the concrete region action without inheriting account administration", () => {
    const scoped = access({
      permissions: ["runs:cancel"],
      regions: [
        {
          id: "north-grid",
          name: "North",
          actions: ["region:read", "runs:submit"],
        },
      ],
    });
    assert.equal(hasRegionAction(scoped, "north-grid", "runs:submit"), true);
    assert.equal(hasRegionAction(scoped, "north-grid", "runs:cancel"), false);
    assert.equal(hasRegionAction(scoped, "other-grid", "runs:submit"), false);
    assert.equal(
      hasRegionAction(
        { ...scoped, accessState: "organization-expired" },
        "north-grid",
        "runs:submit"
      ),
      false
    );
  });
  it("rejects retired and multiple account-role projections", () => {
    for (const roles of [
      ["administrator"],
      ["TENANT_ADMIN", "TENANT_USER"],
      ["TENANT_USER", "unknown"],
    ])
      assert.throws(
        () =>
          parseAccessContext({
            subject_id: "user",
            account_id: "account",
            display_name: "User",
            organization: { id: "org", name: "Org" },
            roles,
            capabilities: [],
            regions: [],
            access_state: "active",
          }),
        AccessResolutionError
      );
  });
  it("maps session HTTP outcomes without exposing response bodies", async () => {
    const fetchImpl = (async () =>
      new Response("private provider detail", {
        status: 401,
      })) as unknown as typeof fetch;
    await assert.rejects(
      () => loadDigitalTwinAccess({ endpoint: "/session", fetchImpl }),
      (error: Error) => {
        assert.ok(error instanceof AccessResolutionError);
        assert.equal(error.kind, "unauthenticated");
        assert.doesNotMatch(error.message, /private provider detail/);
        return true;
      }
    );
  });
});
