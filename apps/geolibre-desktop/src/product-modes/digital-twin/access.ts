export const DIGITAL_TWIN_ROLES = [
  "operator",
  "supervisor",
  "engineer",
  "analyst",
  "administrator",
] as const;

export const DIGITAL_TWIN_CAPABILITIES = [
  "digital-twin",
  "expert-gis",
  "administration",
] as const;

export type DigitalTwinRole = (typeof DIGITAL_TWIN_ROLES)[number];
export type DigitalTwinCapability = (typeof DIGITAL_TWIN_CAPABILITIES)[number];
export type DigitalTwinProductMode = "digital-twin" | "expert-gis" | "administration";
export type DigitalTwinView = "live" | "scenarios" | "runs";

export interface AuthorizedRegion {
  id: string;
  name: string;
}

export interface DigitalTwinAccessContext {
  subjectId: string;
  displayName: string;
  organization: { id: string; name: string };
  roles: DigitalTwinRole[];
  capabilities: DigitalTwinCapability[];
  regions: AuthorizedRegion[];
  mostRecentlyUsedRegionId: string | null;
  savedStartLocation: "digital-twin" | "expert-gis" | null;
}

interface DevelopmentAccessOptions {
  regionId?: string;
  regionName?: string;
}

const DEVELOPMENT_REGIONS: AuthorizedRegion[] = [
  { id: "boulder-co", name: "Boulder" },
  { id: "golden-co", name: "Golden" },
];

export function createDevelopmentAccess(
  options: DevelopmentAccessOptions = {},
): DigitalTwinAccessContext {
  const regionId = options.regionId?.trim();
  const regionName = options.regionName?.trim();
  const regions =
    regionId || regionName
      ? [
          {
            id: regionId || DEVELOPMENT_REGIONS[0].id,
            name: regionName || DEVELOPMENT_REGIONS[0].name,
          },
        ]
      : DEVELOPMENT_REGIONS;

  return {
    subjectId: "local-pilot-developer",
    displayName: "Local pilot developer",
    organization: { id: "local-development", name: "Local development" },
    roles: ["engineer"],
    capabilities: ["digital-twin", "expert-gis", "administration"],
    regions,
    mostRecentlyUsedRegionId: regions[0].id,
    savedStartLocation: "digital-twin",
  };
}

export type AccessFailureKind =
  | "unauthenticated"
  | "unauthorized"
  | "provider-unavailable"
  | "invalid-response";

export class AccessResolutionError extends Error {
  constructor(
    readonly kind: AccessFailureKind,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AccessResolutionError";
  }
}

export type AuthorizedLocationResolution =
  | {
      kind: "allowed";
      location: string;
      mode: DigitalTwinProductMode;
      view: DigitalTwinView;
      regionId: string | null;
    }
  | { kind: "redirect"; location: string }
  | { kind: "denied"; reason: "administration" | "expert-gis" | "region" | "route" };

interface LoadDigitalTwinAccessOptions {
  endpoint: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AccessResolutionError(
      "invalid-response",
      `The access response is missing ${field}.`,
    );
  }
  return value.trim();
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function knownValues<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  const allowedSet = new Set<string>(allowed);
  return [
    ...new Set(
      value.filter((item): item is T => typeof item === "string" && allowedSet.has(item)),
    ),
  ];
}

/** Resolve a deployment endpoint against Vite's application base, not the current SPA route. */
export function resolveApplicationUrl(
  configured: string | null | undefined,
  fallbackPath: string,
  basePath: string,
  documentUrl: string,
): string {
  const applicationBase = new URL(basePath, documentUrl);
  return new URL(configured?.trim() || fallbackPath, applicationBase).href;
}

/**
 * Validate the deliberately small access projection returned by the trusted
 * application backend. Unknown roles and capabilities are ignored so a newer
 * backend cannot accidentally grant an older client access it does not know.
 */
export function parseAccessContext(value: unknown): DigitalTwinAccessContext {
  if (!isRecord(value) || !isRecord(value.organization) || !Array.isArray(value.regions)) {
    throw new AccessResolutionError("invalid-response", "The access response is incomplete.");
  }

  const regions: AuthorizedRegion[] = [];
  const seenRegionIds = new Set<string>();
  for (const candidate of value.regions) {
    if (!isRecord(candidate)) {
      throw new AccessResolutionError("invalid-response", "An authorized region is invalid.");
    }
    const id = requiredString(candidate.id, "region id");
    const name = requiredString(candidate.name, "region name");
    if (seenRegionIds.has(id)) continue;
    seenRegionIds.add(id);
    regions.push({ id, name });
  }

  const savedStart = optionalString(value.saved_start_location);
  return {
    subjectId: requiredString(value.subject_id, "subject id"),
    displayName: requiredString(value.display_name, "display name"),
    organization: {
      id: requiredString(value.organization.id, "organization id"),
      name: requiredString(value.organization.name, "organization name"),
    },
    roles: knownValues(value.roles, DIGITAL_TWIN_ROLES),
    capabilities: knownValues(value.capabilities, DIGITAL_TWIN_CAPABILITIES),
    regions,
    mostRecentlyUsedRegionId: optionalString(value.most_recently_used_region_id),
    savedStartLocation:
      savedStart === "digital-twin" || savedStart === "expert-gis" ? savedStart : null,
  };
}

/** Resolve the authenticated user's safe default route from backend-owned scope. */
export function resolveLandingLocation(access: DigitalTwinAccessContext): string | null {
  const capabilities = new Set(access.capabilities);
  const recentRegion = access.regions.find(
    (region) => region.id === access.mostRecentlyUsedRegionId,
  );
  const region = recentRegion ?? access.regions[0];
  const liveLocation = region ? `/regions/${encodeURIComponent(region.id)}/live` : null;

  if (access.savedStartLocation === "expert-gis" && capabilities.has("expert-gis")) {
    return liveLocation
      ? `/workspace?returnTo=${encodeURIComponent(liveLocation)}`
      : "/workspace";
  }
  if (capabilities.has("digital-twin") && liveLocation) return liveLocation;
  if (capabilities.has("administration")) return "/admin";
  if (capabilities.has("expert-gis")) return "/workspace";
  return null;
}

function parseRegionRoute(
  pathname: string,
): { regionId: string; view: DigitalTwinView } | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0]?.toLowerCase() !== "regions" || parts.length < 3) return null;
  let regionId: string;
  try {
    regionId = decodeURIComponent(parts[1]);
  } catch {
    return null;
  }
  if (!regionId) return null;

  const section = parts[2]?.toLowerCase();
  if (section === "live" && parts.length === 3) return { regionId, view: "live" };
  if (section === "alerts" && parts.length === 4 && parts[3]) {
    return { regionId, view: "live" };
  }
  if (section === "scenarios" && (parts.length === 3 || (parts.length === 4 && parts[3]))) {
    return { regionId, view: "scenarios" };
  }
  if (section === "runs" && (parts.length === 3 || (parts.length === 4 && parts[3]))) {
    return { regionId, view: "runs" };
  }
  return null;
}

/**
 * Authorize a browser location without interpreting or rewriting its deep-link
 * query/hash state. The backend remains responsible for authorizing every data
 * request; this is the route and presentation boundary required by the shell.
 */
export function resolveAuthorizedLocation(
  access: DigitalTwinAccessContext,
  requestedLocation: string,
): AuthorizedLocationResolution {
  const url = new URL(requestedLocation || "/", "https://digital-twin.invalid");
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const location = `${url.pathname}${url.search}${url.hash}`;
  const capabilities = new Set(access.capabilities);

  if (pathname === "/" || pathname.toLowerCase() === "/sign-in") {
    const landing = resolveLandingLocation(access);
    return landing
      ? { kind: "redirect", location: landing }
      : { kind: "denied", reason: "route" };
  }

  if (pathname.toLowerCase() === "/admin") {
    return capabilities.has("administration")
      ? {
          kind: "allowed",
          location,
          mode: "administration",
          view: "live",
          regionId: null,
        }
      : { kind: "denied", reason: "administration" };
  }

  if (pathname.toLowerCase() === "/workspace") {
    return capabilities.has("expert-gis")
      ? {
          kind: "allowed",
          location,
          mode: "expert-gis",
          view: "live",
          regionId: null,
        }
      : { kind: "denied", reason: "expert-gis" };
  }

  if (pathname.toLowerCase() === "/diagnostics") {
    if (capabilities.size === 0) return { kind: "denied", reason: "route" };
    return {
      kind: "allowed",
      location,
      mode: capabilities.has("digital-twin") ? "digital-twin" : "administration",
      view: "live",
      regionId: null,
    };
  }

  const regionRoute = parseRegionRoute(pathname);
  if (regionRoute) {
    if (!capabilities.has("digital-twin")) return { kind: "denied", reason: "region" };
    if (!access.regions.some((region) => region.id === regionRoute.regionId)) {
      return { kind: "denied", reason: "region" };
    }
    return {
      kind: "allowed",
      location,
      mode: "digital-twin",
      view: regionRoute.view,
      regionId: regionRoute.regionId,
    };
  }

  return { kind: "denied", reason: "route" };
}

/** Load the access projection without retaining or exposing private error bodies. */
export async function loadDigitalTwinAccess({
  endpoint,
  fetchImpl = fetch,
  signal,
}: LoadDigitalTwinAccessOptions): Promise<DigitalTwinAccessContext> {
  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new AccessResolutionError(
      "provider-unavailable",
      "The identity provider could not be reached.",
      { cause: error },
    );
  }

  if (response.status === 401) {
    throw new AccessResolutionError("unauthenticated", "Authentication is required.");
  }
  if (response.status === 403) {
    throw new AccessResolutionError("unauthorized", "No product access is assigned.");
  }
  if (!response.ok) {
    throw new AccessResolutionError(
      "provider-unavailable",
      `Access resolution failed with HTTP ${response.status}.`,
    );
  }

  try {
    return parseAccessContext(await response.json());
  } catch (error) {
    if (error instanceof AccessResolutionError) throw error;
    throw new AccessResolutionError("invalid-response", "The access response is invalid.", {
      cause: error,
    });
  }
}
