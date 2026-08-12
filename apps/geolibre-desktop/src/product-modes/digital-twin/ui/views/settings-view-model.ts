export type SettingsSectionId =
  | "account-preferences"
  | "workspace-map"
  | "workspace-simulation"
  | "operations-alert-routing"
  | "organization-members"
  | "engine-status";

export type Channel = "inApp" | "email" | "sms";
export type Severity = "high" | "medium" | "low";

export interface SeverityRoute {
  assignment: string;
  channels: Record<Channel, boolean>;
  escalateAfter: string;
}

export interface AlertRoutingSettings {
  defaultAssignee: string;
  enabled: boolean;
  escalateUnacknowledged: boolean;
  groupRelatedAlerts: boolean;
  playArrivalSound: boolean;
  queueOrder: "severity" | "newest";
  routing: Record<Severity, SeverityRoute>;
  showModelConfidence: boolean;
}

export const INITIAL_ALERT_ROUTING: AlertRoutingSettings = {
  defaultAssignee: "on-duty",
  enabled: true,
  escalateUnacknowledged: true,
  groupRelatedAlerts: false,
  playArrivalSound: true,
  queueOrder: "severity",
  routing: {
    high: {
      assignment: "grid-operations",
      channels: { inApp: true, email: true, sms: true },
      escalateAfter: "5-min",
    },
    medium: {
      assignment: "on-duty",
      channels: { inApp: true, email: true, sms: false },
      escalateAfter: "15-min",
    },
    low: {
      assignment: "unassigned",
      channels: { inApp: true, email: false, sms: false },
      escalateAfter: "off",
    },
  },
  showModelConfidence: true,
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const SETTINGS_PAGE_COPY: Record<
  SettingsSectionId,
  { description: string; eyebrow: string; title: string }
> = {
  "account-preferences": {
    eyebrow: "Account",
    title: "Preferences",
    description: "Personalize how the digital twin looks and behaves for you.",
  },
  "workspace-map": {
    eyebrow: "Workspace",
    title: "Map & display",
    description: "Choose the shared defaults for map navigation and geographic data.",
  },
  "workspace-simulation": {
    eyebrow: "Workspace",
    title: "Simulation presets",
    description: "Define reusable starting values without hiding run-specific inputs.",
  },
  "operations-alert-routing": {
    eyebrow: "Operations",
    title: "Alert routing",
    description: "Control how operational alerts enter the queue and reach your team.",
  },
  "organization-members": {
    eyebrow: "Organization",
    title: "Members & roles",
    description: "Manage who can access the workspace and what they can change.",
  },
  "engine-status": {
    eyebrow: "Engine",
    title: "Status & health",
    description: "Inspect connectivity, runtime configuration, storage, and queues.",
  },
};
