import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AccessResolutionError,
  loadDigitalTwinAccess,
  parseAccessContext,
  resolveApplicationUrl,
  resolveAuthorizedLocation,
  resolveLandingLocation,
  type DigitalTwinAccessContext,
} from "../apps/geolibre-desktop/src/product-modes/digital-twin/access";

function access(
  overrides: Partial<DigitalTwinAccessContext> = {},
): DigitalTwinAccessContext {
  return {
    subjectId: "user-1",
    displayName: "Alex Operator",
    organization: { id: "utility-1", name: "Front Range Utility" },
    roles: ["operator"],
    capabilities: ["digital-twin"],
    regions: [
      { id: "north-grid", name: "North Grid" },
      { id: "south/grid", name: "South Grid" },
    ],
    mostRecentlyUsedRegionId: "south/grid",
    savedStartLocation: "digital-twin",
    ...overrides,
  };
}

describe("Digital Twin access resolution", () => {
  it("resolves deployment endpoints from the app base instead of a deep-link route", () => {
    assert.equal(
      resolveApplicationUrl(
        undefined,
        "api/digital-twin/access",
        "/pilot/",
        "https://example.com/pilot/regions/north-grid/live",
      ),
      "https://example.com/pilot/api/digital-twin/access",
    );
    assert.equal(
      resolveApplicationUrl(
        "/session/access",
        "api/digital-twin/access",
        "/pilot/",
        "https://example.com/pilot/regions/north-grid/live",
      ),
      "https://example.com/session/access",
    );
  });

  it("lands an operator in the most recently used authorized region", () => {
    assert.equal(resolveLandingLocation(access()), "/regions/south%2Fgrid/live");
  });

  it("falls back to the first authorized region when the saved region is stale", () => {
    assert.equal(
      resolveLandingLocation(access({ mostRecentlyUsedRegionId: "removed-region" })),
      "/regions/north-grid/live",
    );
  });

  it("honors an authorized engineer's saved Expert GIS start location", () => {
    assert.equal(
      resolveLandingLocation(
        access({
          roles: ["engineer"],
          capabilities: ["digital-twin", "expert-gis"],
          savedStartLocation: "expert-gis",
        }),
      ),
      "/workspace?returnTo=%2Fregions%2Fsouth%252Fgrid%2Flive",
    );
  });

  it("lands an administrator without operational scope in Administration", () => {
    assert.equal(
      resolveLandingLocation(
        access({
          roles: ["administrator"],
          capabilities: ["administration", "expert-gis"],
          regions: [],
          mostRecentlyUsedRegionId: null,
        }),
      ),
      "/admin",
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

  it("allows the Scenarios and Runs destination routes in an authorized region", () => {
    assert.equal(
      resolveAuthorizedLocation(access(), "/regions/north-grid/scenarios").kind,
      "allowed",
    );
    assert.equal(
      resolveAuthorizedLocation(access(), "/regions/north-grid/runs").kind,
      "allowed",
    );
  });

  it("rejects a deep link into a region outside the resolved access scope", () => {
    assert.deepEqual(
      resolveAuthorizedLocation(access(), "/regions/other-grid/runs/run-9?tick=tick-3"),
      { kind: "denied", reason: "region" },
    );
  });

  it("rejects lookalike paths that are not product routes", () => {
    assert.deepEqual(
      resolveAuthorizedLocation(access(), "/regions/north-grid/live/private-data"),
      { kind: "denied", reason: "route" },
    );
    assert.deepEqual(resolveAuthorizedLocation(access(), "/workspace/advanced"), {
      kind: "denied",
      reason: "route",
    });
  });

  it("treats Expert GIS as a capability boundary rather than a hidden control", () => {
    assert.deepEqual(resolveAuthorizedLocation(access(), "/workspace"), {
      kind: "denied",
      reason: "expert-gis",
    });
    assert.deepEqual(
      resolveAuthorizedLocation(
        access({ capabilities: ["digital-twin", "expert-gis"] }),
        "/workspace?returnTo=%2Fregions%2Fnorth-grid%2Flive",
      ),
      {
        kind: "allowed",
        location: "/workspace?returnTo=%2Fregions%2Fnorth-grid%2Flive",
        mode: "expert-gis",
        view: "live",
        regionId: null,
      },
    );
  });

  it("does not let the legacy workspace query flag bypass the route guard", () => {
    assert.deepEqual(resolveAuthorizedLocation(access(), "/?workspace=expert"), {
      kind: "redirect",
      location: "/regions/south%2Fgrid/live",
    });
  });

  it("redirects an authenticated sign-in visit without retaining protected labels", () => {
    assert.deepEqual(resolveAuthorizedLocation(access(), "/sign-in?returnTo=secret-label"), {
      kind: "redirect",
      location: "/regions/south%2Fgrid/live",
    });
  });

  it("fails closed when a nominally authenticated response grants no product capability", () => {
    const noAccess = access({ capabilities: [], regions: [] });
    assert.deepEqual(resolveAuthorizedLocation(noAccess, "/diagnostics"), {
      kind: "denied",
      reason: "route",
    });
    assert.equal(resolveLandingLocation(noAccess), null);
  });

  it("validates the trusted backend access projection before using it", () => {
    assert.deepEqual(
      parseAccessContext({
        subject_id: "user-7",
        display_name: "Morgan Analyst",
        organization: { id: "utility-1", name: "Front Range Utility" },
        roles: ["analyst", "unexpected-role"],
        capabilities: ["digital-twin", "expert-gis", "made-up"],
        regions: [{ id: "north-grid", name: "North Grid" }],
        most_recently_used_region_id: "north-grid",
        saved_start_location: "expert-gis",
      }),
      {
        subjectId: "user-7",
        displayName: "Morgan Analyst",
        organization: { id: "utility-1", name: "Front Range Utility" },
        roles: ["analyst"],
        capabilities: ["digital-twin", "expert-gis"],
        regions: [{ id: "north-grid", name: "North Grid" }],
        mostRecentlyUsedRegionId: "north-grid",
        savedStartLocation: "expert-gis",
      },
    );
    assert.throws(
      () => parseAccessContext({ subject_id: "user-7", regions: [] }),
      AccessResolutionError,
    );
  });

  it("maps session HTTP outcomes without exposing response bodies", async () => {
    const fetchImpl = (async () =>
      new Response("private provider detail", { status: 401 })) as unknown as typeof fetch;
    await assert.rejects(
      () => loadDigitalTwinAccess({ endpoint: "/session", fetchImpl }),
      (error: Error) => {
        assert.ok(error instanceof AccessResolutionError);
        assert.equal(error.kind, "unauthenticated");
        assert.doesNotMatch(error.message, /private provider detail/);
        return true;
      },
    );
  });
});
