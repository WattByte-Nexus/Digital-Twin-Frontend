import { Button, ScrollArea, SelectMenu, SelectMenuContent, SelectMenuItem, SelectMenuTrigger, SelectMenuValue, Tabs, TabsContent, TabsList, TabsTrigger, surfaceThemeClassName, type SurfaceTheme, type DigitalTwinRegion } from "@geolibre/ui";
import { useEffect, useState } from "react";
import { fetchDigitalTwinRegions, fetchDigitalTwinRegion, fetchDigitalTwinRegionReadiness, type DigitalTwinRegionRecord, type DigitalTwinRegionReadiness } from "../../../../lib/digital-twin-regions";
import type { DigitalTwinEarthEngineLayer } from "../../../../lib/digital-twin-earth-engine";
import type { DigitalTwinReadyPointCloudDataset } from "../../../../lib/digital-twin-point-cloud";
import { RegionAdministration } from "./RegionAdministration";
import { SourceInventory } from "./SourceInventory";
import { AssetIntake } from "./AssetIntake";
import { SurveyAdministration } from "./SurveyAdministration";

export interface NativeDataAdministrationProps {
  canPreviewMap?: boolean; apiUrl: string; activeRegionId: string; activeRasterIds: readonly string[]; regions: readonly DigitalTwinRegion[]; canManage: boolean; theme: SurfaceTheme;
  onRegionsChanged: () => void; onAssetsChanged: () => void; onClose: () => void;
  onPointCloudSelected: (dataset: DigitalTwinReadyPointCloudDataset) => void;
  onRasterPrepared: (layer: DigitalTwinEarthEngineLayer) => void;
  onRasterRemoved?: (layerId: string) => void;
}

export function NativeDataAdministration({ canPreviewMap = true, apiUrl, activeRegionId, activeRasterIds, regions, canManage, theme, onRegionsChanged, onAssetsChanged, onClose, onPointCloudSelected, onRasterPrepared, onRasterRemoved }: NativeDataAdministrationProps) {
  const [catalog, setCatalog] = useState<DigitalTwinRegionRecord[]>([]);
  const [selectedId, setSelectedId] = useState(activeRegionId || regions[0]?.id || "");
  const [region, setRegion] = useState<DigitalTwinRegionRecord | null>(null);
  const [readiness, setReadiness] = useState<DigitalTwinRegionReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [mutating, setMutating] = useState(false);
  const [loading, setLoading] = useState(true);
  const fail = (cause: unknown) => setError(cause instanceof Error ? cause.message : "Data operation failed.");
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(null);
    void fetchDigitalTwinRegions(apiUrl, { signal: controller.signal }).then((items) => {
      if (controller.signal.aborted) return;
      setCatalog(items); setSelectedId((id) => id === "new" && canManage ? id : items.some((item) => item.region_id === id) ? id : items[0]?.region_id ?? (canManage ? "new" : ""));
    }, (cause) => { if (!controller.signal.aborted) fail(cause); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [apiUrl, canManage, refreshKey]);
  useEffect(() => {
    const controller = new AbortController(); setRegion(null); setReadiness(null);
    if (!selectedId || selectedId === "new") return () => controller.abort();
    void fetchDigitalTwinRegion(apiUrl, selectedId, { signal: controller.signal }).then((item) => { if (!controller.signal.aborted) setRegion(item); }, (cause) => { if (!controller.signal.aborted) fail(cause); });
    void fetchDigitalTwinRegionReadiness(apiUrl, selectedId, { signal: controller.signal }).then((item) => { if (!controller.signal.aborted) setReadiness(item); }, (cause) => { if (!controller.signal.aborted) fail(cause); });
    return () => controller.abort();
  }, [apiUrl, selectedId, refreshKey]);
  function changed(saved?: DigitalTwinRegionRecord) { setError(null); if (saved) setSelectedId(saved.region_id); else setSelectedId(""); setRefreshKey((key) => key + 1); onRegionsChanged(); onAssetsChanged(); }
  return <div className={`${surfaceThemeClassName(theme)} flex h-full min-h-0 flex-col bg-background text-foreground`}>
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div><h1 className="text-2xl font-semibold">Data administration</h1><p className="mt-1 text-sm text-muted-foreground">Regional sources, draft assets, publication and survey builds.</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading || mutating}>Refresh</Button><Button variant="ghost" disabled={mutating} onClick={onClose}>Back to workspace</Button></div></header>
    <div className="px-5 pt-4"><SelectMenu value={selectedId} onValueChange={setSelectedId} disabled={mutating}><SelectMenuTrigger aria-label="Administration region" className="max-w-lg"><SelectMenuValue placeholder="Select a region" /></SelectMenuTrigger><SelectMenuContent className={`${surfaceThemeClassName(theme)} surface-glass-overlay min-w-[var(--radix-select-trigger-width)]`}>{catalog.map((item) => <SelectMenuItem value={item.region_id} key={item.region_id}>{item.name} · {item.status}</SelectMenuItem>)}{canManage ? <SelectMenuItem value="new">Create region draft</SelectMenuItem> : null}</SelectMenuContent></SelectMenu></div>
    {error ? <p role="alert" className="px-5 pt-3 text-sm text-destructive">{error}</p> : null}
    <ScrollArea className="min-h-0 flex-1"><section aria-label="Selected regional data" className="mx-auto w-full max-w-5xl space-y-5 p-5">
      {loading ? <p role="status">Loading regions…</p> : selectedId === "new" ? <RegionAdministration key="new" apiUrl={apiUrl} region={null} readiness={null} canManage={canManage} onBusyChange={setMutating} onChanged={changed} onError={fail} /> : region ? <Tabs defaultValue="region" className="space-y-4"><TabsList><TabsTrigger disabled={mutating} value="region">Region</TabsTrigger><TabsTrigger disabled={mutating} value="sources">Sources & layers</TabsTrigger><TabsTrigger disabled={mutating} value="assets">Asset intake</TabsTrigger><TabsTrigger disabled={mutating} value="surveys">Datasets & surveys</TabsTrigger></TabsList><TabsContent value="region"><RegionAdministration key={`${region.region_id}:${refreshKey}`} apiUrl={apiUrl} region={region} readiness={readiness} canManage={canManage} onBusyChange={setMutating} onChanged={changed} onError={fail} /></TabsContent><TabsContent value="sources"><SourceInventory key={region.region_id} apiUrl={apiUrl} regionId={region.region_id} regionName={region.name} activeRasterIds={activeRasterIds} canPreviewMap={canPreviewMap} onRasterPrepared={onRasterPrepared} onRasterRemoved={onRasterRemoved} /></TabsContent><TabsContent value="assets"><AssetIntake key={region.region_id} apiUrl={apiUrl} regionId={region.region_id} editable={canManage && region.status === "draft"} theme={theme} onBusyChange={setMutating} onChanged={onAssetsChanged} onError={fail} /></TabsContent><TabsContent value="surveys"><SurveyAdministration key={region.region_id} apiUrl={apiUrl} regionId={region.region_id} canManage={canManage} theme={theme} canPreviewMap={canPreviewMap} onBusyChange={setMutating} onPointCloudSelected={onPointCloudSelected} /></TabsContent></Tabs> : !loading && !error ? <p className="text-sm text-muted-foreground">No accessible regions. {canManage ? "Create a draft to start authoring." : "Region access is required."}</p> : <p role="status">Loading region detail…</p>}
    </section></ScrollArea>
  </div>;
}
