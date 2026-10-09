import { Badge, Button } from "@geolibre/ui";
import { useEffect, useState } from "react";
import { checkDigitalTwinEngineHealth, type DigitalTwinEngineHealth } from "../../../../lib/digital-twin-status";
import { normalizeDigitalTwinApiUrl } from "../../../../lib/digital-twin-api";
import { SettingRow, SettingsCard } from "./settings-view-components";

export function AccountPreferencesPage({ theme, onToggleTheme }: { theme: "light" | "dark"; onToggleTheme?: () => void }) {
  return <div className="mx-auto max-w-5xl space-y-5 p-5 sm:p-8"><SettingsCard title="Device appearance" description="These preferences are local to this device and browser."><SettingRow label="Application theme"><span className="text-sm capitalize">{theme}</span>{onToggleTheme ? <Button variant="outline" onClick={onToggleTheme}>Switch to {theme === "light" ? "dark" : "light"}</Button> : null}</SettingRow></SettingsCard></div>;
}
export function WorkspaceMapPage({ onOpenRealSettings }: { onOpenRealSettings?: () => void }) {
  return <div className="mx-auto max-w-5xl space-y-5 p-5 sm:p-8"><SettingsCard title="Map & display" description="Map navigation, basemap, projection and display preferences use the existing device-local persistence."><div className="space-y-3 py-4"><p className="text-sm text-muted-foreground">Change map preferences in the workspace settings. Changes apply to the live map on this device.</p>{onOpenRealSettings ? <Button variant="outline" onClick={onOpenRealSettings}>Open map & display settings</Button> : <p className="text-sm text-muted-foreground">Use Surface, Labels, Detail and View on the workspace map to change its display.</p>}</div></SettingsCard></div>;
}
export function SavedScenariosPage({ onOpenScenarios }: { onOpenScenarios: () => void }) {
  return <div className="mx-auto max-w-5xl space-y-5 p-5 sm:p-8"><SettingsCard title="Saved Engine scenarios" description="Save supported environmental conditions in the scenario library."><div className="space-y-3 py-4"><p className="max-w-[65ch] text-sm text-muted-foreground">Each saved scenario retains its reviewed region, weather version, bounds and synthetic wind. Choose ignition and run inputs when submitting a run.</p><Button onClick={onOpenScenarios}>Open saved scenarios</Button></div></SettingsCard></div>;
}
export function EngineStatusPage({ apiUrl }: { apiUrl: string }) {
  const [health, setHealth] = useState<DigitalTwinEngineHealth | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController(); setChecking(true); setHealth(null); setCheckedAt(null); setError(null);
    void checkDigitalTwinEngineHealth(apiUrl, { signal: controller.signal }).then((status) => { if (!controller.signal.aborted) { setHealth(status); setCheckedAt(new Date().toISOString()); } }, (cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Health check failed."); }).finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, [apiUrl, refresh]);
  let endpoint = apiUrl;
  try { endpoint = normalizeDigitalTwinApiUrl(apiUrl); } catch { /* The health error reports invalid configuration. */ }
  return <div className="mx-auto max-w-5xl space-y-5 p-5 sm:p-8"><SettingsCard title="Engine connectivity" description="Readiness reports the running service's startup state. Region readiness is shown in Data administration." action={<Button variant="outline" disabled={checking} onClick={() => setRefresh((key) => key + 1)}>{checking ? "Checking…" : "Check now"}</Button>}><SettingRow label="Configured API endpoint"><span className="max-w-[65ch] break-all text-sm">{endpoint}</span></SettingRow><SettingRow label="Live / ready probes"><Badge variant="outline">{checking ? "Checking" : health === "ready" ? "Live and ready" : health === "degraded" ? "Live; startup not ready" : health === "offline" ? "Offline" : "Not checked"}</Badge></SettingRow><SettingRow label="Actual check timestamp"><span className="text-sm">{checkedAt ?? "Not checked"}</span></SettingRow>{error ? <p role="alert" className="py-3 text-sm text-destructive">{error}</p> : null}</SettingsCard></div>;
}
