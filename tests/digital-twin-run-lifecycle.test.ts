import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { applyDigitalTwinRunProgress, cancelDigitalTwinRun, readDigitalTwinRunEvents, watchDigitalTwinRun, type DigitalTwinRunEvent } from "../apps/geolibre-desktop/src/lib/digital-twin-run-lifecycle";
import { boundedDurationHours, digitalTwinTickCount, parseDigitalTwinRun, type DigitalTwinRunRecord } from "../apps/geolibre-desktop/src/lib/digital-twin-runs";
import { loadRunTab } from "../apps/geolibre-desktop/src/product-modes/digital-twin/ui/digital-twin-run-api";
import { digitalTwinRunCatalogInterval } from "../apps/geolibre-desktop/src/product-modes/digital-twin/ui/use-digital-twin-run-catalog";

const fixtures = JSON.parse(readFileSync(new URL("./fixtures/digital-twin-engine.api-fixtures.json", import.meta.url), "utf8"));
const names = new Map([["golden-co", "Contract region"]]);
const active = () => parseDigitalTwinRun(fixtures.run_started, names);
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
const event = (kind: string, id: string, count: number, status = "STARTED", runId = active().id): DigitalTwinRunEvent => ({ event: kind, id, data: JSON.stringify({ schema_version: 1, run_id: runId, status, completed_ticks: count, total_ticks: 2 }) });
const stream = (events: DigitalTwinRunEvent[]) => new Response(events.map((item) => `id: ${item.id}\nevent: ${item.event}\ndata: ${item.data}\n\n`).join(""), { headers: { "content-type": "text/event-stream" } });

test("current Engine fixtures parse failures and initialization separately from positive compute ticks", () => {
  const completed = parseDigitalTwinRun(fixtures.run_completed, names);
  assert.equal(completed.completedTicks, 2);
  assert.equal(completed.expectedTicks, 2);
  const failed = parseDigitalTwinRun(fixtures.run_failed, names);
  assert.equal(failed.failureCode, "simulation_failed");
  assert.equal(failed.failureMessage, "Simulation execution failed.");
  const cancelled = parseDigitalTwinRun(fixtures.scenario_cancelled, names);
  assert.equal(cancelled.completedTicks, 2); assert.equal(cancelled.resultAvailable, false);
});

test("bounded duration and whole-tick tolerance match Engine arithmetic", () => {
  assert.equal(boundedDurationHours("2026-10-09T06:00:00-06:00", "2026-10-09T14:00:00Z"), 2);
  assert.equal(boundedDurationHours("invalid", "2026-10-09T14:00:00Z"), null);
  assert.equal(digitalTwinTickCount(1.2, 1), 2);
  assert.equal(digitalTwinTickCount(0.3, 0.1), 3);
  assert.equal(digitalTwinTickCount(3.0000000000001, 1), 3);
  const bounded = { ...fixtures.run_started, trigger: { ...fixtures.run_started.trigger, time: { mode: "bounded", start_at: "2026-10-09T12:00:00Z", end_at: "2026-10-09T14:00:00Z" } } };
  assert.equal(parseDigitalTwinRun(bounded, names).durationHours, 2);
  assert.equal(parseDigitalTwinRun(bounded, names).expectedTicks, 2);
});

test("split SSE frames preserve named events, durable IDs, multiline data and cleanup", async () => {
  const encoded = new TextEncoder().encode(": heartbeat\r\nid: 10-1\r\nevent: tick_completed\r\ndata: {\r\ndata: \"tick\":1}\r\n\r\n");
  let closed = false;
  const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(encoded.slice(0, 18)); controller.enqueue(encoded.slice(18)); }, cancel() { closed = true; } }));
  const events: DigitalTwinRunEvent[] = [];
  await readDigitalTwinRunEvents(response, (item) => { events.push(item); return false; });
  assert.deepEqual(events, [{ id: "10-1", event: "tick_completed", data: "{\n\"tick\":1}" }]);
  assert.equal(closed, true);
});

test("progress replay cannot lower tick count or undo cancellation; reset is authoritative", () => {
  const run = applyDigitalTwinRunProgress(active(), event("tick_completed", "10-1", 2));
  assert.equal(applyDigitalTwinRunProgress(run, event("tick_completed", "9-1", 1)).completedTicks, 2);
  const cancelling = applyDigitalTwinRunProgress(run, event("cancel_requested", "10-2", 2, "CANCEL_REQUESTED"));
  assert.equal(applyDigitalTwinRunProgress(cancelling, event("run_started", "10-3", 2)).status, "CANCEL_REQUESTED");
  assert.equal(applyDigitalTwinRunProgress(run, event("stream_reset", "1-0", 1)).completedTicks, 1);
  assert.throws(() => applyDigitalTwinRunProgress(run, event("tick_completed", "10-4", 3)), /Invalid run progress/);
});

test("watch recovers snapshots, resumes Last-Event-ID, deduplicates replay and closes at terminal", async () => {
  const initial = active(); const snapshots: DigitalTwinRunRecord[] = []; const headers: Headers[] = [];
  let subscriptions = 0; let terminal = false;
  const fetchImpl: typeof fetch = async (input, init) => {
    if (!String(input).endsWith("/events")) return json(terminal ? { ...fixtures.run_cancelled, run_id: initial.id } : fixtures.run_started);
    headers.push(new Headers(init?.headers)); subscriptions++;
    if (subscriptions === 1) return stream([event("tick_completed", "10-1", 1)]);
    terminal = true;
    return stream([event("tick_completed", "10-1", 2), event("tick_completed", "10-2", 2), event("run_cancelled", "10-3", 2, "CANCELLED")]);
  };
  const connection: string[] = [];
  await watchDigitalTwinRun("https://engine.test", initial, { signal: new AbortController().signal, fetchImpl, onRun: (run) => snapshots.push(run), onConnection: (state) => connection.push(state) });
  assert.equal(subscriptions, 2); assert.equal(headers[1].get("Last-Event-ID"), "10-1");
  assert.equal(snapshots.at(-1)?.status, "CANCELLED");
  assert.equal(snapshots.at(-1)?.completedTicks, 2);
  assert.ok(snapshots.every((run, index) => index === 0 || run.completedTicks >= snapshots[index - 1].completedTicks));
  assert.ok(connection.includes("disconnected")); assert.equal(connection.at(-1), "settled");
});

test("stream reset reloads snapshot and resumes at reset identity without erasing active progress", async () => {
  const initial = active(); let subscription = 0; let complete = false; const headers: Headers[] = [];
  const snapshots: DigitalTwinRunRecord[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    if (!String(input).endsWith("/events")) return json(complete ? { ...fixtures.run_completed, run_id: initial.id } : fixtures.run_started);
    headers.push(new Headers(init?.headers)); subscription++;
    if (subscription === 1) return stream([event("stream_reset", "20-1", 1)]);
    complete = true;
    return stream([event("run_completed", "20-2", 2, "COMPLETED")]);
  };
  await watchDigitalTwinRun("https://engine.test", initial, { signal: new AbortController().signal, fetchImpl, onRun: (run) => snapshots.push(run), onConnection: () => {} });
  assert.equal(headers[1].get("Last-Event-ID"), "20-1");
  assert.equal(snapshots.at(-1)?.resultAvailable, true);
  assert.equal(snapshots[2].completedTicks, 1);
});

test("abort cancels a blocked stream reader without reconnecting", async () => {
  const controller = new AbortController(); let closed = false;
  const response = new Response(new ReadableStream({ cancel() { closed = true; } }));
  const pending = readDigitalTwinRunEvents(response, () => {}, controller.signal);
  controller.abort(); await pending; assert.equal(closed, true);
});

test("completion winning a cancellation conflict settles from the authoritative snapshot", async () => {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => { calls.push(String(input)); return String(input).endsWith("/cancel") ? json({ detail: "Run completed" }, 409) : json(fixtures.run_completed); };
  const run = await cancelDigitalTwinRun("https://engine.test", "run/1", { fetchImpl, regionNames: names });
  assert.equal(run.status, "COMPLETED"); assert.equal(run.resultAvailable, true); assert.equal(calls.length, 2);
});

test("denied run streams report disconnected once instead of retrying protected IDs", async () => {
  let calls = 0; let error: Error | undefined;
  await watchDigitalTwinRun("https://engine.test", active(), { signal: new AbortController().signal, fetchImpl: async () => { calls++; return json({ detail: "Access denied" }, 403); }, onRun: () => {}, onConnection: (_state, value) => { error = value; } });
  assert.equal(calls, 1); assert.match(error?.message ?? "", /Access denied/);
});

test("active SSE ticks load real artifacts even when REST run snapshots omit active tick refs", async () => {
  const calls: string[] = [];
  const data = await loadRunTab("https://engine.test", active().id, "behavior", { completedTicks: 2, fetchImpl: async (input) => {
    const url = String(input); calls.push(url);
    return json(url.includes("/ticks/") ? { type: "FeatureCollection", features: [{ type: "Feature", geometry: null, properties: { tick: Number(url.match(/ticks\/(\d+)/)?.[1]), active_cell_count: 1 } }] } : fixtures.run_started);
  } });
  assert.equal(data.kind, "behavior");
  if (data.kind === "behavior") assert.deepEqual(data.samples.map((sample) => sample.tick), [1, 2]);
  assert.equal(calls.length, 3);
});

test("catalog discovery schedules both idle and active refresh", () => {
  assert.equal(digitalTwinRunCatalogInterval({ regions: [], runs: [] }), 15_000);
  assert.equal(digitalTwinRunCatalogInterval({ regions: [], runs: [active()] }), 2_000);
});
