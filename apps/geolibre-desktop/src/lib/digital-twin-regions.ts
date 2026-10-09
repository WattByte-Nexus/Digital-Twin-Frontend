import { fetchDigitalTwinPages, requestDigitalTwinJson, requestDigitalTwinResponse } from "./digital-twin-api";
import type { components } from "./digital-twin-contract.generated";

export type DigitalTwinRegionRecord = components["schemas"]["Region"];
export type DigitalTwinRegionInput = components["schemas"]["RegionCreate"];
export type DigitalTwinRegionReadiness = components["schemas"]["RegionReadiness"];
type Options = { fetchImpl?: typeof fetch; signal?: AbortSignal };
const regionPath = (id: string) => `/api/v1/regions/${encodeURIComponent(id)}`;

export function validateDigitalTwinRegion(input: DigitalTwinRegionInput): DigitalTwinRegionInput {
  const { west, south, east, north } = input.bounds;
  if (!input.name.trim()) throw new Error("Region name is required.");
  if (![west, south, east, north].every(Number.isFinite) || west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) throw new Error("Bounds must form a positive WGS84 rectangle.");
  return { name: input.name.trim(), bounds: input.bounds };
}
export const fetchDigitalTwinRegions = (url: string, options: Options = {}) => fetchDigitalTwinPages<DigitalTwinRegionRecord>(url, "/api/v1/regions?limit=100", options);
export const fetchDigitalTwinRegion = (url: string, id: string, options: Options = {}) => requestDigitalTwinJson<DigitalTwinRegionRecord>(url, regionPath(id), options);
export const fetchDigitalTwinRegionReadiness = (url: string, id: string, options: Options = {}) => requestDigitalTwinJson<DigitalTwinRegionReadiness>(url, `${regionPath(id)}/readiness`, options);
export const createDigitalTwinRegion = (url: string, input: DigitalTwinRegionInput, options: Options = {}) => requestDigitalTwinJson<DigitalTwinRegionRecord>(url, "/api/v1/regions", { ...options, method: "POST", json: validateDigitalTwinRegion(input) });
export const updateDigitalTwinRegion = (url: string, id: string, input: DigitalTwinRegionInput, options: Options = {}) => requestDigitalTwinJson<DigitalTwinRegionRecord>(url, regionPath(id), { ...options, method: "PATCH", json: validateDigitalTwinRegion(input) });
export const publishDigitalTwinRegion = (url: string, id: string, options: Options = {}) => requestDigitalTwinJson<DigitalTwinRegionRecord>(url, `${regionPath(id)}/publish`, { ...options, method: "POST" });
export async function deleteDigitalTwinRegion(url: string, id: string, options: Options = {}): Promise<void> { await requestDigitalTwinResponse(url, regionPath(id), { ...options, method: "DELETE" }); }
