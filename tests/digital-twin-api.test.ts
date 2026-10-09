import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultDigitalTwinApiUrl,
  DigitalTwinApiError,
  fetchDigitalTwinPages,
  normalizeDigitalTwinApiUrl,
  requestDigitalTwinJson,
  requestDigitalTwinResponse,
} from "../apps/geolibre-desktop/src/lib/digital-twin-api";

describe("native Engine transport", () => {
  it("uses deployment origin and isolates obsolete demo settings", () => {
    const runtime = {
      location: new URL("https://twin.example.com/regions/boulder/live"),
      localStorage: { getItem: (key: string) => key.includes("demo") ? "http://127.0.0.1:8000" : null },
    } as unknown as NonNullable<Parameters<typeof defaultDigitalTwinApiUrl>[0]>;
    assert.equal(defaultDigitalTwinApiUrl(runtime), "https://twin.example.com");
    assert.equal(defaultDigitalTwinApiUrl({ ...runtime, location: new URL("http://localhost:5173") } as typeof runtime), "http://localhost:5173/__digital_twin_api");
    assert.throws(() => normalizeDigitalTwinApiUrl("https://user:password@example.com"), /credentials/);
  });

  it("preserves request identity and typed server validation errors", async () => {
    const controller = new AbortController();
    const fetchImpl: typeof fetch = async (input, init) => {
      assert.equal(String(input), "https://engine.example.com/proxy/api/v1/scenarios");
      assert.equal(init?.credentials, "same-origin");
      assert.equal(init?.signal, controller.signal);
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("X-Request-ID"), "request-1");
      assert.equal(headers.get("Idempotency-Key"), "scenario-1");
      assert.equal(headers.get("Content-Type"), "application/json");
      assert.deepEqual(JSON.parse(String(init?.body)), { name: "Review" });
      return Response.json({
        detail: "Select a published region.", code: "region_state_conflict", request_id: "request-1", retryable: false,
        field_errors: [{ field: "body.region_id", code: "invalid", message: "Region is a draft." }],
      }, { status: 409 });
    };
    await assert.rejects(
      requestDigitalTwinJson("https://engine.example.com/proxy", "/api/v1/scenarios", {
        method: "POST", json: { name: "Review" }, requestId: "request-1", idempotencyKey: "scenario-1", signal: controller.signal, fetchImpl,
      }),
      (error: unknown) => error instanceof DigitalTwinApiError && error.status === 409 && error.code === "region_state_conflict" && error.requestId === "request-1" && error.fieldErrors[0]?.field === "body.region_id",
    );
  });

  it("does not set JSON content type on multipart or parse empty success bodies", async () => {
    const body = new FormData();
    body.set("file", new Blob(["ply"], { type: "application/octet-stream" }), "survey.ply");
    await requestDigitalTwinResponse("https://engine.example.com", "/api/v1/survey", {
      method: "POST", body,
      fetchImpl: async (_input, init) => {
        assert.equal(init?.body, body);
        assert.equal(new Headers(init?.headers).has("Content-Type"), false);
        return new Response(null, { status: 202 });
      },
    });
    const empty = await requestDigitalTwinJson<void>("https://engine.example.com", "/api/v1/region", {
      method: "DELETE", fetchImpl: async () => new Response(null, { status: 204 }),
    });
    assert.equal(empty, undefined);
  });

  it("follows opaque cursors, preserves filters, and rejects repeated cursors", async () => {
    let count = 0;
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(String(input));
      assert.equal(url.searchParams.get("region_id"), "boulder");
      assert.equal(url.searchParams.get("limit"), "100");
      count++;
      if (count === 1) return Response.json({ items: [1], next_cursor: "opaque/a+b" });
      assert.equal(url.searchParams.get("cursor"), "opaque/a+b");
      return Response.json({ items: [2], next_cursor: null });
    };
    assert.deepEqual(await fetchDigitalTwinPages<number>("https://engine.example.com", "/api/v1/scenarios?region_id=boulder", { fetchImpl }), [1, 2]);
    await assert.rejects(fetchDigitalTwinPages("https://engine.example.com", "/api/v1/scenarios", {
      fetchImpl: async () => Response.json({ items: [], next_cursor: "loop" }),
    }), /repeated/);
  });
});
