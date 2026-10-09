/** Shared HTTP boundary for the native Digital Twin product. */
const API_STORAGE_KEY = "geolibre.digital-twin.api-url";
const DEFAULT_API_URL = "http://127.0.0.1:8000";
const DEV_API_PROXY_PATH = "/__digital_twin_api";

interface DigitalTwinRuntimeWindow extends Window {
  __DIGITAL_TWIN_API_URL__?: string;
}

export interface DigitalTwinRequestOptions extends RequestInit {
  fetchImpl?: typeof fetch;
  requestId?: string;
  idempotencyKey?: string;
}

export interface DigitalTwinJsonOptions extends DigitalTwinRequestOptions {
  json?: unknown;
}

export interface DigitalTwinFieldError {
  field: string;
  code: string;
  message: string;
}

/** Preserve public error metadata so views can distinguish conflicts and denied access. */
export class DigitalTwinApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
    readonly requestId: string | null,
    readonly retryable: boolean,
    readonly fieldErrors: DigitalTwinFieldError[],
  ) {
    super(message);
    this.name = "DigitalTwinApiError";
  }
}

export function normalizeDigitalTwinApiUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("API URL must be an absolute HTTP URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("API URL must use HTTP or HTTPS.");
  }
  if (parsed.username || parsed.password) throw new Error("API URL must not contain credentials.");
  parsed.hash = "";
  parsed.search = "";
  return parsed.href.replace(/\/+$/, "");
}

export function defaultDigitalTwinApiUrl(
  runtimeWindow: DigitalTwinRuntimeWindow | undefined =
    typeof window === "undefined" ? undefined : window as DigitalTwinRuntimeWindow,
): string {
  const configured = runtimeWindow?.__DIGITAL_TWIN_API_URL__;
  if (configured) return normalizeDigitalTwinApiUrl(configured);
  let stored: string | null = null;
  try {
    stored = runtimeWindow?.localStorage?.getItem(API_STORAGE_KEY) ?? null;
  } catch {
    // Browser storage restrictions do not prevent use of the deployment endpoint.
  }
  if (stored) return normalizeDigitalTwinApiUrl(stored);
  const location = runtimeWindow?.location;
  if (location) {
    if (location.port === "5173" && ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) {
      return new URL(DEV_API_PROXY_PATH, location.origin).href;
    }
    if (["http:", "https:"].includes(location.protocol)) return location.origin;
  }
  return DEFAULT_API_URL;
}

export function rememberDigitalTwinApiUrl(value: string): void {
  const normalized = normalizeDigitalTwinApiUrl(value);
  if (typeof window !== "undefined") window.localStorage.setItem(API_STORAGE_KEY, normalized);
}

/** Revoke the HttpOnly hosting session with a browser POST, then follow Cognito logout. */
export function signOutDigitalTwin(): void {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/digital-twin/sign-out";
  document.body.append(form);
  form.submit();
}

export function resolveDigitalTwinApiUrl(apiUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path.replace(/^\/+/, ""), `${normalizeDigitalTwinApiUrl(apiUrl)}/`).href;
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

async function failure(response: Response): Promise<DigitalTwinApiError> {
  let body: unknown;
  try { body = await response.json(); } catch { body = null; }
  const problem = record(body) ? body : {};
  const fieldErrors = Array.isArray(problem.field_errors)
    ? problem.field_errors.filter((entry): entry is DigitalTwinFieldError =>
      record(entry) && typeof entry.field === "string" && typeof entry.code === "string" && typeof entry.message === "string")
    : [];
  return new DigitalTwinApiError(
    text(problem.detail) ?? text(problem.title) ?? `Digital Twin API request failed (${response.status}).`,
    response.status,
    text(problem.code),
    text(problem.request_id) ?? response.headers.get("X-Request-ID"),
    problem.retryable === true,
    fieldErrors,
  );
}

/** Send JSON, multipart, or binary requests without altering the caller's body. */
export async function requestDigitalTwinResponse(
  apiUrl: string,
  path: string,
  options: DigitalTwinRequestOptions = {},
): Promise<Response> {
  const { fetchImpl = fetch, requestId, idempotencyKey, ...init } = options;
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (requestId) headers.set("X-Request-ID", requestId);
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
  const response = await fetchImpl(resolveDigitalTwinApiUrl(apiUrl, path), {
    credentials: "same-origin",
    ...init,
    headers,
  });
  if (!response.ok) throw await failure(response);
  return response;
}

export async function requestDigitalTwinJson<T>(
  apiUrl: string,
  path: string,
  options: DigitalTwinJsonOptions = {},
): Promise<T> {
  const { json, ...init } = options;
  const headers = new Headers(init.headers);
  if (json !== undefined) {
    if (init.body !== undefined && init.body !== null) throw new Error("Provide either json or body, not both.");
    headers.set("Content-Type", "application/json");
    init.body = JSON.stringify(json);
  }
  const response = await requestDigitalTwinResponse(apiUrl, path, { ...init, headers });
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

/** Read every cursor page and reject broken loops instead of hanging the interface. */
export async function fetchDigitalTwinPages<T>(
  apiUrl: string,
  path: string,
  options: Pick<DigitalTwinRequestOptions, "fetchImpl" | "signal"> = {},
): Promise<T[]> {
  const url = new URL(resolveDigitalTwinApiUrl(apiUrl, path));
  url.searchParams.set("limit", "100");
  const items: T[] = [];
  const cursors = new Set<string>();
  while (true) {
    const page = await requestDigitalTwinJson<unknown>(apiUrl, url.href, options);
    if (!record(page) || !Array.isArray(page.items)) throw new Error("Invalid Digital Twin collection response.");
    items.push(...page.items as T[]);
    if (page.next_cursor === null) return items;
    if (typeof page.next_cursor !== "string" || !page.next_cursor || cursors.has(page.next_cursor)) {
      throw new Error("Invalid or repeated Digital Twin page cursor.");
    }
    cursors.add(page.next_cursor);
    url.searchParams.set("cursor", page.next_cursor);
  }
}
