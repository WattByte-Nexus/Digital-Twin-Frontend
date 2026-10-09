export type SettingsSectionId =
  | "account-preferences"
  | "workspace-map"
  | "workspace-simulation"
  | "engine-status";
export const SETTINGS_PAGE_COPY: Record<
  SettingsSectionId,
  { description: string; eyebrow: string; keywords: string; title: string }
> = {
  "account-preferences": {
    eyebrow: "This device",
    title: "Appearance",
    description: "Make the application comfortable to use with your preferred theme and accent.",
    keywords: "theme light dark accent color custom",
  },
  "workspace-map": {
    eyebrow: "Workspace",
    title: "Map & display",
    description:
      "Choose your map perspective, surface, labels and geographic detail. Changes apply to this workspace.",
    keywords:
      "view terrain 3d plan satellite imagery elevation point clouds city place roads routes points interest water names buildings trees parks boundaries defaults",
  },
  "workspace-simulation": {
    eyebrow: "Workspace",
    title: "Saved scenarios",
    description: "Manage reusable environmental conditions for your simulations.",
    keywords: "library weather wind ignition",
  },
  "engine-status": {
    eyebrow: "Engine",
    title: "Status & health",
    description: "Check connectivity and startup readiness for the configured Engine service.",
    keywords: "api endpoint live ready probes connection last checked",
  },
};
