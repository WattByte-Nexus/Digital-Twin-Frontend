import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Checkbox, Textarea, SelectMenu, SelectMenuContent, SelectMenuItem, SelectMenuTrigger, SelectMenuValue, surfaceThemeClassName, type SurfaceTheme } from "@geolibre/ui";
import { useEffect, useRef, useState } from "react";
import { fetchDigitalTwinPointCloudDatasets, fetchDigitalTwinPointCloudDataset, submitDigitalTwinSurvey, parseDigitalTwinSurveyMetadata, digitalTwinSurveyBuild, type DigitalTwinPointCloudDataset, type DigitalTwinReadyPointCloudDataset, type DigitalTwinSurveyMetadata, type DigitalTwinSurveySubmission } from "../../../../lib/digital-twin-point-cloud";

export function SurveyAdministration({ apiUrl, regionId, canManage, theme, canPreviewMap, onBusyChange, onPointCloudSelected }: { apiUrl: string; regionId: string; canManage: boolean; theme: SurfaceTheme; canPreviewMap: boolean; onBusyChange: (busy: boolean) => void; onPointCloudSelected: (dataset: DigitalTwinReadyPointCloudDataset) => void }) {
  const [datasets, setDatasets] = useState<DigitalTwinPointCloudDataset[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selected, setSelected] = useState<DigitalTwinPointCloudDataset | null>(null);
  const [requestKey, setRequestKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [metadataText, setMetadataText] = useState("");
  const [metadata, setMetadata] = useState<DigitalTwinSurveyMetadata | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const uploadLock = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [accepted, setAccepted] = useState<DigitalTwinSurveySubmission | null>(null);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(null);
    void fetchDigitalTwinPointCloudDatasets(apiUrl, regionId, { signal: controller.signal }).then((items) => { if (!controller.signal.aborted) { setDatasets(items); setSelectedId((id) => items.some((item) => item.datasetId === id) ? id : items[0]?.datasetId ?? ""); } }, (cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Dataset catalog failed."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [apiUrl, regionId, requestKey]);
  useEffect(() => {
    setSelected(null); setAccepted(null); setReviewed(false); setMetadata(null); setPollError(null); setCheckedAt(null);
    if (!selectedId) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      try { const item = await fetchDigitalTwinPointCloudDataset(apiUrl, regionId, selectedId, { signal: controller.signal }); if (!controller.signal.aborted) { setSelected(item); setPollError(null); setCheckedAt(new Date().toISOString()); } }
      catch (cause) { if (!controller.signal.aborted) setPollError(cause instanceof Error ? `Dataset refresh failed; displayed information may be stale. ${cause.message}` : "Dataset refresh failed; displayed information may be stale."); }
      finally { if (!controller.signal.aborted) timer = setTimeout(refresh, 3000); }
    };
    void refresh(); return () => { controller.abort(); clearTimeout(timer); };
  }, [apiUrl, regionId, selectedId]);
  const build = selected && accepted ? digitalTwinSurveyBuild(selected, accepted.version) : selected?.latestBuild;
  async function submit() {
    if (uploadLock.current || !canManage || !file || !metadata || !reviewed || !selected || selected.status !== "ready" || build?.status === "queued" || build?.status === "building") return;
    uploadLock.current = true; setUploading(true); onBusyChange(true); setError(null);
    try { const submission = await submitDigitalTwinSurvey(apiUrl, regionId, selected.datasetId, file, metadata); setAccepted(submission); setReviewed(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Survey upload failed."); }
    finally { uploadLock.current = false; setUploading(false); onBusyChange(false); }
  }
  return <Card><CardHeader className="flex-row items-center justify-between"><CardTitle>Point-cloud datasets and surveys</CardTitle><Button variant="outline" disabled={loading} onClick={() => setRequestKey((key) => key + 1)}>Refresh</Button></CardHeader><CardContent className="space-y-4">
    {loading ? <p role="status">Loading datasets…</p> : null}{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}{!loading && !datasets.length ? <p className="text-sm text-muted-foreground">No point-cloud datasets exist in this region.</p> : null}
    {datasets.length ? <SelectMenu value={selectedId} onValueChange={setSelectedId} disabled={uploading}><SelectMenuTrigger aria-label="Dataset to inspect"><SelectMenuValue /></SelectMenuTrigger><SelectMenuContent className={`${surfaceThemeClassName(theme)} surface-glass-overlay min-w-[var(--radix-select-trigger-width)]`}>{datasets.map((dataset) => <SelectMenuItem key={dataset.datasetId} value={dataset.datasetId}>{dataset.name}</SelectMenuItem>)}</SelectMenuContent></SelectMenu> : null}
    {pollError ? <p role="alert" className="text-sm text-destructive">{pollError}</p> : null}
    {checkedAt ? <p className="text-xs text-muted-foreground">Dataset checked at {checkedAt}</p> : null}
    {selected ? <><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">Viewable version: {selected.status}</Badge>{build ? <Badge variant="outline">Latest build: {build.status}</Badge> : null}<Button variant="outline" disabled={!canPreviewMap || selected.status !== "ready"} onClick={() => { if (selected.status === "ready") onPointCloudSelected(selected); }}>View selected dataset</Button></div><p className="break-all text-xs text-muted-foreground">Viewable version: {selected.version}</p>{selected.latestBuild ? <p className="break-all text-xs text-muted-foreground">Latest build version: {selected.latestBuild.version} · updated {selected.latestBuild.updated_at}</p> : null}<p className="text-sm text-muted-foreground">{canPreviewMap ? "Selecting a dataset changes this map view. The Engine’s active dataset remains server-owned." : "Open an authorized Digital Twin workspace to preview a dataset on the map."}</p>{selected.status === "ready" ? <p className="text-sm tabular-nums">{selected.pointCount.toLocaleString()} points · {selected.minimumSpacingMeters} m minimum spacing</p> : null}
      {accepted ? <div className="space-y-1" role="status"><p className="break-all text-sm">Accepted patch {accepted.patch_id}: {accepted.version}</p><p className="break-all text-xs text-muted-foreground">Parent: {accepted.parent_version}</p>{!build ? <p className="text-sm">Waiting for accepted-version visibility…</p> : build.status === "failed" ? <p className="text-sm text-destructive">Replacement failed: {build.failure_code}. Previous ready tiles remain available.</p> : build.status === "ready" ? <p className="text-sm">Accepted replacement is ready. View selected dataset to display the new tiles.</p> : <p className="text-sm">Accepted replacement is {build.status}. Previous ready tiles remain available.</p>}</div> : build?.status === "failed" ? <p className="text-sm text-destructive">Latest replacement failed: {build.failure_code}</p> : null}
      <div className="space-y-3 border-t border-border pt-4"><p className="font-medium">Upload a reviewed replacement survey</p><p className="max-w-[65ch] text-sm text-muted-foreground">Supply a PLY and measured georeferencing metadata. The Engine validates placement and version conflicts before accepting a build.</p><Label htmlFor="survey-ply">PLY file, maximum 2 GiB</Label><Input id="survey-ply" type="file" accept=".ply" disabled={!canManage || uploading || selected.status !== "ready"} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><Label htmlFor="survey-metadata-file">Reviewed metadata JSON file</Label><Input id="survey-metadata-file" type="file" accept=".json,application/json" disabled={!canManage || uploading} onChange={(event) => { const metadataFile = event.target.files?.[0]; if (metadataFile) { if (metadataFile.size > 256 * 1024) { setError("Metadata JSON must fit the 256 KiB review limit."); return; } void metadataFile.text().then((text) => { setMetadataText(text); setMetadata(null); setReviewed(false); }).catch((cause) => setError(cause instanceof Error ? cause.message : "Metadata file could not be read.")); } }} /><Label htmlFor="survey-metadata">Placement metadata JSON</Label><Textarea id="survey-metadata" rows={7} value={metadataText} disabled={!canManage || uploading} onChange={(event) => { setMetadataText(event.target.value); setMetadata(null); setReviewed(false); }} /><Button variant="outline" disabled={!canManage || uploading} onClick={() => { try { setMetadata(parseDigitalTwinSurveyMetadata(metadataText)); setReviewed(false); setError(null); } catch (cause) { setMetadata(null); setError(cause instanceof Error ? cause.message : "Invalid metadata."); } }}>Validate placement</Button>
      {metadata ? <div className="space-y-2 text-sm"><p>Patch {metadata.patch_id} · acquired {metadata.acquired_at}</p><p>{metadata.target_crs} · vertical datum {metadata.vertical_datum} · {metadata.meters_per_source_unit} m/source unit</p><p>{metadata.registration_method} · measured RMSE {metadata.registration_rmse_m} m · Z {metadata.replacement_z_range.join(" to ")} m</p><p className="break-all text-muted-foreground">Placement matrix: {metadata.local_to_target_matrix.join(", ")}</p><p className="break-all text-muted-foreground">Footprint: {metadata.replacement_footprint_wkt}</p><Label className="flex min-h-11 items-center gap-2"><Checkbox checked={reviewed} disabled={uploading} onCheckedChange={(value) => setReviewed(value === true)} />I reviewed the placement transform, footprint, units, datum and measured registration.</Label></div> : null}
      <Button disabled={!canManage || !file || !metadata || !reviewed || uploading || selected.status !== "ready" || build?.status === "queued" || build?.status === "building"} onClick={() => void submit()}>{uploading ? "Uploading survey…" : "Submit reviewed survey"}</Button>{!canManage ? <p className="text-sm text-muted-foreground">Survey submission permission is required.</p> : null}</div>
    </> : null}
  </CardContent></Card>;
}
