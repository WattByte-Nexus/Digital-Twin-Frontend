import {
  DIGITAL_TWIN_ACCESS_INVALIDATED_EVENT,
} from "../../../lib/digital-twin-api";
import { resolveApplicationUrl, type DigitalTwinRole } from "../access";

/** Account secrets follow trusted deployment configuration, never a saved product API preference. */
export function digitalTwinAccountEndpoint(kind: "management" | "public"): string {
  const accessEndpoint = resolveApplicationUrl(import.meta.env.VITE_DIGITAL_TWIN_ACCESS_URL, "api/digital-twin/access", import.meta.env.BASE_URL, document.baseURI);
  return new URL(kind, accessEndpoint).href;
}

export interface InvitationDelivery {
  state:
    | "pending"
    | "processing"
    | "delivered"
    | "failed"
    | "expired"
    | "setup-in-progress"
    | "not-current";
  attempts: number;
  failure_code: null | "provider_unavailable" | "delivery_failed";
}
export interface Account {
  id: string;
  role: DigitalTwinRole;
  first_name: string;
  last_name: string;
  email: string;
  activation_state: "invited" | "active";
  suspended: boolean;
  organization_id: string | null;
  department_id: string | null;
  version: number;
  invitation_delivery: InvitationDelivery | null;
}
export interface Department {
  id: string;
  name: string;
  version: number;
}
export interface Plan {
  id: string;
  name: string;
  kind: "TRIAL" | "STANDARD" | "CUSTOM";
  features: string[];
  cpu_hours: number;
  storage_bytes: number;
  version: number;
  deletable: boolean;
}
export interface Organization {
  id: string;
  name: string;
  plan_id: string;
  enabled: boolean;
  effective_at: string;
  expires_at: string;
  version: number;
}
export interface Collection<T> {
  items: T[];
  next_cursor: string | null;
}
export class ManagementError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}
export async function managementRequest<T>(
  path: string,
  options: {
    data?: unknown;
    key?: string;
    proof?: string;
    signal?: AbortSignal;
    fetchImpl?: typeof fetch;
    baseUrl?: string;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.data !== undefined) {
    headers["Content-Type"] = "application/json";
    headers["Idempotency-Key"] = options.key ?? crypto.randomUUID();
  }
  if (options.proof) headers["X-Action-Proof"] = options.proof;
  const response = await (options.fetchImpl ?? fetch)(
    `${options.baseUrl === undefined ? digitalTwinAccountEndpoint("management") : `${options.baseUrl}/api/digital-twin/management`}${path}`,
    {
      method: options.data === undefined ? "GET" : "POST",
      credentials: "include",
      cache: "no-store",
      headers,
      body:
        options.data === undefined ? undefined : JSON.stringify(options.data),
      signal: options.signal,
    }
  );
  if (!response.ok) {
    if (
      (response.status === 401 || response.status === 403) &&
      typeof window !== "undefined"
    )
      window.dispatchEvent(new Event(DIGITAL_TWIN_ACCESS_INVALIDATED_EVENT));
    const message =
      response.status === 409
        ? "This record changed or conflicts with another record. Refresh before trying again."
        : response.status === 428
        ? "Verify your email before confirming this action."
        : response.status === 401
        ? "Your session ended. Sign in again."
        : response.status === 403
        ? "Your account cannot perform this action."
        : response.status === 422 || response.status === 400
        ? "Check the form values. The server did not accept this change."
        : "The service is unavailable. Your change has not been confirmed; retry the same action.";
    throw new ManagementError(response.status, message);
  }
  if (options.data !== undefined && typeof window !== "undefined")
    window.dispatchEvent(new Event(DIGITAL_TWIN_ACCESS_INVALIDATED_EVENT));
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}
export function accountStatus(account: Account): string {
  return `${
    account.activation_state === "invited" ? "Invitation pending" : "Activated"
  }${account.suspended ? " · Suspended" : ""}`;
}

const FEATURE_NAMES: Record<string, string> = {
  "region:create": "Create regions",
  "region:read": "View regions",
  "region:write": "Edit region drafts",
  "region:publish": "Publish regions",
  "assets:write": "Edit assets",
  "scenarios:create": "Create scenarios",
  "runs:submit": "Run simulations",
  "runs:cancel": "Cancel simulations",
  "surveys:submit": "Upload surveys",
  "expert-gis": "Expert GIS",
  "data:export": "Export data",
  "ai:use": "AI assistance",
};
export function featureName(feature: string): string {
  return FEATURE_NAMES[feature] ?? feature;
}

export function canResendInvitation(account: Account): boolean {
  return (
    account.activation_state === "invited" &&
    !account.suspended &&
    account.invitation_delivery?.state !== "setup-in-progress" &&
    account.invitation_delivery?.state !== "processing"
  );
}
