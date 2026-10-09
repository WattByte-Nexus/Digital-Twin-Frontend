import { DigitalTwinApiError, requestDigitalTwinJson, requestDigitalTwinResponse } from "./digital-twin-api";
import { fetchDigitalTwinRun, isDigitalTwinRunActive, parseDigitalTwinRun, type DigitalTwinRunRecord, type DigitalTwinRunStatus } from "./digital-twin-runs";

export type DigitalTwinRunConnection = "connecting" | "live" | "disconnected" | "settled";
export interface DigitalTwinRunEvent { event: string; id: string; data: string }
export const DIGITAL_TWIN_RUN_EVENTS = new Set(["run_snapshot", "stream_reset", "run_started", "tick_completed", "cancel_requested", "run_cancelled", "run_completed", "run_failed"]);
const TERMINAL = new Set(["run_cancelled", "run_completed", "run_failed"]);

/** Parse split UTF-8 SSE frames, including comments, multiline data, and CRLF. */
export async function readDigitalTwinRunEvents(response: Response, onEvent: (event: DigitalTwinRunEvent) => boolean | void, signal?: AbortSignal): Promise<void> {
  if (!response.body) throw new Error("The run event stream has no response body.");
  const reader = response.body.getReader();
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener("abort", abort, { once: true });
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "message";
  let id = "";
  let data: string[] = [];
  try {
    while (!signal?.aborted) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        if (!line) {
          if (data.length && onEvent({ event, id, data: data.join("\n") }) === false) return;
          event = "message";
          data = [];
        } else if (!line.startsWith(":")) {
          const separator = line.indexOf(":");
          const field = separator < 0 ? line : line.slice(0, separator);
          const value = separator < 0 ? "" : line.slice(separator + 1).replace(/^ /, "");
          if (field === "event") event = value;
          if (field === "id" && !value.includes("\0")) id = value;
          if (field === "data") data.push(value);
        }
      }
    }
  } finally {
    signal?.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function newerEvent(id: string, previous: string | null): boolean {
  if (!/^\d+-\d+$/.test(id)) throw new Error("Invalid run event replay identity.");
  if (!previous) return true;
  const [a, b] = id.split("-").map(BigInt);
  const [c, d] = previous.split("-").map(BigInt);
  return a > c || a === c && b > d;
}

export function applyDigitalTwinRunProgress(run: DigitalTwinRunRecord, event: DigitalTwinRunEvent): DigitalTwinRunRecord {
  const payload = JSON.parse(event.data) as { schema_version: number; run_id: string; status: DigitalTwinRunStatus; completed_ticks: number; total_ticks: number | null; failure?: { error_type: string; error_message: string } };
  if (payload.schema_version !== 1 || payload.run_id !== run.id || !Number.isInteger(payload.completed_ticks) || payload.completed_ticks < 0 || payload.total_ticks !== null && (!Number.isInteger(payload.total_ticks) || payload.total_ticks <= 0 || payload.completed_ticks > payload.total_ticks)) throw new Error("Invalid run progress payload.");
  if (!["QUEUED", "STARTED", "CANCEL_REQUESTED", "CANCELLED", "COMPLETED", "FAILED"].includes(payload.status)) throw new Error("Invalid run progress status.");
  if (!isDigitalTwinRunActive(run.status)) return run;
  const status = run.status === "CANCEL_REQUESTED" && ["QUEUED", "STARTED"].includes(payload.status)
    || run.status === "STARTED" && payload.status === "QUEUED" ? run.status : payload.status;
  return {
    ...run,
    status,
    completedTicks: event.event === "stream_reset" ? payload.completed_ticks : Math.max(run.completedTicks, payload.completed_ticks),
    expectedTicks: payload.total_ticks ?? run.expectedTicks,
    failureCode: payload.failure?.error_type ?? run.failureCode,
    failureMessage: payload.failure?.error_message ?? run.failureMessage,
  };
}

export async function cancelDigitalTwinRun(apiUrl: string, runId: string, options: { fetchImpl?: typeof fetch; signal?: AbortSignal; regionNames?: ReadonlyMap<string, string> } = {}) {
  try {
    const body = await requestDigitalTwinJson<unknown>(apiUrl, `/api/v1/simulation-runs/${encodeURIComponent(runId)}/cancel`, { ...options, method: "POST" });
    return parseDigitalTwinRun(body, options.regionNames ?? new Map());
  } catch (error) {
    // A terminal transition can win the cancellation race. Its snapshot settles truth.
    if (error instanceof DigitalTwinApiError && error.status === 409) return fetchDigitalTwinRun(apiUrl, runId, options);
    throw error;
  }
}

function reconnectDelay(signal: AbortSignal, delay: number): Promise<void> {
  return new Promise((resolve) => {
    const complete = () => { clearTimeout(timer); signal.removeEventListener("abort", complete); resolve(); };
    const timer = setTimeout(complete, delay);
    signal.addEventListener("abort", complete, { once: true });
    if (signal.aborted) complete();
  });
}

/** One subscription; snapshots recover durable state and event IDs resume replay. */
export async function watchDigitalTwinRun(apiUrl: string, initialRun: DigitalTwinRunRecord, options: {
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
  onRun: (run: DigitalTwinRunRecord) => void;
  onConnection: (state: DigitalTwinRunConnection, error?: Error) => void;
  onSuccess?: (at: Date) => void;
}): Promise<void> {
  let run = initialRun;
  let cursor: string | null = null;
  const regionNames = new Map([[run.regionId, run.regionName]]);
  const snapshot = async () => {
    const latest = await fetchDigitalTwinRun(apiUrl, run.id, { ...options, regionNames });
    run = isDigitalTwinRunActive(latest.status)
      ? { ...latest, completedTicks: Math.max(run.completedTicks, latest.completedTicks), expectedTicks: run.expectedTicks ?? latest.expectedTicks }
      : latest;
    if (options.signal.aborted) return;
    options.onRun(run);
    options.onSuccess?.(new Date());
  };
  while (!options.signal.aborted) {
    options.onConnection("connecting");
    try {
      await snapshot();
      if (!isDigitalTwinRunActive(run.status)) { options.onConnection("settled"); return; }
      const headers = new Headers({ Accept: "text/event-stream" });
      if (cursor) headers.set("Last-Event-ID", cursor);
      const response = await requestDigitalTwinResponse(apiUrl, `/api/v1/simulation-runs/${encodeURIComponent(run.id)}/events`, { fetchImpl: options.fetchImpl, signal: options.signal, headers });
      options.onConnection("live");
      let reset = false;
      let terminal = false;
      await readDigitalTwinRunEvents(response, (event) => {
        if (!DIGITAL_TWIN_RUN_EVENTS.has(event.event)) return;
        if (event.event !== "stream_reset" && !newerEvent(event.id, cursor)) return;
        cursor = event.id;
        run = applyDigitalTwinRunProgress(run, event);
        options.onRun(run);
        options.onSuccess?.(new Date());
        reset = event.event === "stream_reset";
        terminal = TERMINAL.has(event.event) || !isDigitalTwinRunActive(run.status);
        if (reset || terminal) return false;
      }, options.signal);
      if (options.signal.aborted) return;
      await snapshot();
      if (terminal && !isDigitalTwinRunActive(run.status)) { options.onConnection("settled"); return; }
      options.onConnection("disconnected", new Error("Run event stream disconnected; reconnecting from the last durable event."));
    } catch (cause) {
      if (options.signal.aborted) return;
      const error = cause instanceof Error ? cause : new Error("Run updates are unavailable.");
      options.onConnection("disconnected", error);
      if (error instanceof DigitalTwinApiError && [401, 403, 404].includes(error.status)) return;
    }
    await reconnectDelay(options.signal, 3_000);
  }
}
