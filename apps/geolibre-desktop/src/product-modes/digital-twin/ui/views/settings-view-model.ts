export type SettingsSectionId = "account-preferences" | "workspace-map" | "workspace-simulation" | "engine-status";
export const SETTINGS_PAGE_COPY: Record<SettingsSectionId, { description: string; eyebrow: string; title: string }> = {
  "account-preferences": { eyebrow: "This device", title: "Appearance", description: "Appearance preferences apply to this device and browser." },
  "workspace-map": { eyebrow: "This device", title: "Map & display", description: "Use the existing persisted map settings for this device." },
  "workspace-simulation": { eyebrow: "Engine", title: "Saved scenarios", description: "Reusable simulation conditions are immutable Engine scenarios." },
  "engine-status": { eyebrow: "Engine", title: "Status & health", description: "Live connectivity and readiness from the configured Engine." },
};
