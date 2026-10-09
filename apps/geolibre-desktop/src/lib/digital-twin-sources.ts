import { requestDigitalTwinJson } from "./digital-twin-api";
import type { components } from "./digital-twin-contract.generated";
export type DigitalTwinConfiguredSource = components["schemas"]["ConfiguredDataSource"];
export type DigitalTwinEarthEngineMetadata = components["schemas"]["EarthEngineMetadata"];
type Options = { fetchImpl?: typeof fetch; signal?: AbortSignal };
export const fetchDigitalTwinSources = (url: string, options: Options = {}) => requestDigitalTwinJson<DigitalTwinConfiguredSource[]>(url, "/api/v1/data-sources", options);
export const fetchDigitalTwinEarthEngineMetadata = (url: string, regionId: string, options: Options = {}) => requestDigitalTwinJson<DigitalTwinEarthEngineMetadata>(url, `/api/v1/regions/${encodeURIComponent(regionId)}/earth-engine`, options);
