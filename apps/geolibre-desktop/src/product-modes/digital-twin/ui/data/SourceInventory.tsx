import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@geolibre/ui";
import { useEffect, useRef, useState } from "react";
import { fetchDigitalTwinSources, fetchDigitalTwinEarthEngineMetadata, type DigitalTwinConfiguredSource, type DigitalTwinEarthEngineMetadata } from "../../../../lib/digital-twin-sources";
import { fetchDigitalTwinRegionalEarthEngineLayers, prepareDigitalTwinEarthEngineCog, type DigitalTwinEarthEngineLayer } from "../../../../lib/digital-twin-earth-engine";

export function SourceInventory({ apiUrl, regionId, regionName, activeRasterIds, canPreviewMap, onRasterPrepared, onRasterRemoved }: { apiUrl: string; regionId: string; regionName: string; activeRasterIds: readonly string[]; canPreviewMap: boolean; onRasterPrepared: (layer: DigitalTwinEarthEngineLayer) => void; onRasterRemoved?: (layerId: string) => void }) {
  const [sources, setSources] = useState<DigitalTwinConfiguredSource[]>([]);
  const [metadata, setMetadata] = useState<DigitalTwinEarthEngineMetadata | null>(null);
  const [layers, setLayers] = useState<DigitalTwinEarthEngineLayer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestKey, setRequestKey] = useState(0);
  const [preparing, setPreparing] = useState<string | null>(null);
  const preparation = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(null); setMetadata(null); setLayers([]); setSources([]);
    void (async () => {
      try {
        const inventory = await fetchDigitalTwinSources(apiUrl, { signal: controller.signal });
        if (controller.signal.aborted) return;
        const regional = inventory.filter((source) => source.region_id === regionId); setSources(regional);
        if (regional.some((source) => source.kind === "earth_engine")) {
          const [details, descriptors] = await Promise.all([fetchDigitalTwinEarthEngineMetadata(apiUrl, regionId, { signal: controller.signal }), fetchDigitalTwinRegionalEarthEngineLayers(apiUrl, regionId, regionName, { signal: controller.signal })]);
          if (controller.signal.aborted) return; setMetadata(details); setLayers(descriptors);
        }
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Source inventory failed."); } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => { controller.abort(); preparation.current?.abort(); };
  }, [apiUrl, regionId, regionName, requestKey]);
  async function show(layer: DigitalTwinEarthEngineLayer) {
    const controller = new AbortController(); preparation.current?.abort(); preparation.current = controller; setPreparing(layer.id); setError(null);
    try { await prepareDigitalTwinEarthEngineCog(layer, { signal: controller.signal }); if (controller.signal.aborted) return; onRasterPrepared({ ...layer, artifactReady: true }); }
    catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Layer preparation failed."); }
    finally { if (preparation.current === controller) { preparation.current = null; setPreparing(null); } }
  }
  return <Card><CardHeader className="flex-row items-center justify-between"><CardTitle>Configured sources and raster layers</CardTitle><Button variant="outline" disabled={loading} onClick={() => setRequestKey((key) => key + 1)}>Refresh</Button></CardHeader><CardContent className="space-y-4">
    {loading ? <p role="status">Loading source inventory…</p> : null}{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {!loading && !sources.length && !error ? <p className="text-sm text-muted-foreground">No enabled sources are configured for this region.</p> : null}
    {sources.map((source) => <div className="flex flex-wrap items-center gap-2" key={source.source_id}><span className="text-sm font-medium">{source.kind}</span><span className="text-sm text-muted-foreground">{source.provider}</span><Badge variant="outline">Source {source.ready ? "ready" : "not ready"}</Badge></div>)}
    {metadata ? <p className="text-sm text-muted-foreground">Earth Engine: {metadata.crs}; selected datasets: {metadata.datasets.join(", ") || "none"}.</p> : null}
    {layers.map((layer) => <div key={layer.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"><div><p className="font-medium">{layer.name}</p><p className="text-xs text-muted-foreground">{layer.band} {layer.units} · Source {layer.sourceReady ? "ready" : "not ready"} · COG {layer.artifactReady ? "ready" : "requires preparation"}</p></div>{activeRasterIds.includes(layer.id) && onRasterRemoved ? <Button variant="outline" onClick={() => onRasterRemoved(layer.id)}>Hide layer</Button> : <Button disabled={!canPreviewMap || (!layer.sourceReady && !layer.artifactReady) || preparing !== null} onClick={() => void show(layer)}>{preparing === layer.id ? "Preparing…" : activeRasterIds.includes(layer.id) ? "Show layer again" : "Show on map"}</Button>}</div>)}
    {!canPreviewMap ? <p className="text-sm text-muted-foreground">Open an authorized Digital Twin workspace to preview layers on the map.</p> : null}
    {preparing ? <Button variant="outline" onClick={() => preparation.current?.abort()}>Cancel layer preparation</Button> : null}
  </CardContent></Card>;
}
