import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea, Tabs, TabsList, TabsTrigger, TabsContent, type SurfaceTheme } from "@geolibre/ui";
import { SingleAssetForm } from "./SingleAssetForm";
import { useRef, useState } from "react";
import { createDigitalTwinAsset, importDigitalTwinAssetBatch, importDigitalTwinAssetCsv, previewDigitalTwinAssetBatch, type DigitalTwinAssetCreate } from "../../../../lib/digital-twin-assets";

export function AssetIntake({ apiUrl, regionId, editable, theme, onBusyChange, onChanged, onError }: { apiUrl: string; regionId: string; editable: boolean; theme: SurfaceTheme; onBusyChange: (busy: boolean) => void; onChanged: () => void; onError: (error: unknown) => void }) {
  const [json, setJson] = useState("");
  const [preview, setPreview] = useState<DigitalTwinAssetCreate[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function upload(kind: "single" | "batch" | "csv") {
    if (lock.current || !editable) return;
    lock.current = true; setBusy(true); onBusyChange(true); setMessage(null);
    try {
      if (kind === "csv") { if (!file) throw new Error("Choose a CSV file."); const assets = await importDigitalTwinAssetCsv(apiUrl, regionId, file); setMessage(`${assets.length} assets imported.`); }
      else { if (!preview) throw new Error("Preview and review the asset JSON first."); if (kind === "single" && preview.length !== 1) throw new Error("Single creation requires exactly one asset."); const assets = kind === "single" ? [await createDigitalTwinAsset(apiUrl, regionId, preview[0])] : await importDigitalTwinAssetBatch(apiUrl, regionId, preview); setMessage(`${assets.length} assets created.`); }
      setPreview(null); onChanged();
    } catch (error) { onError(error); } finally { lock.current = false; setBusy(false); onBusyChange(false); }
  }
  return <Card><CardHeader><CardTitle>Add trees and power lines</CardTitle></CardHeader><CardContent className="space-y-4">
    <p className="max-w-[65ch] text-sm text-muted-foreground">Drafts accept individual assets, CSV, or one bounded JSON batch of up to 1,000 assets. Each import is a separate request. Existing asset edits and deletion are available in Assets.</p>
    {!editable ? <p className="text-sm text-muted-foreground">Asset authoring requires an editable draft and administration permission.</p> : null}
    <Tabs defaultValue="single"><TabsList><TabsTrigger disabled={busy} value="single">Single asset</TabsTrigger><TabsTrigger disabled={busy} value="json">Batch JSON</TabsTrigger><TabsTrigger disabled={busy} value="csv">CSV</TabsTrigger></TabsList><TabsContent value="single" className="pt-3"><SingleAssetForm apiUrl={apiUrl} regionId={regionId} editable={editable} theme={theme} onBusyChange={(value) => { setBusy(value); onBusyChange(value); }} onChanged={onChanged} onError={onError} /></TabsContent><TabsContent value="json" className="space-y-3 pt-3">
      <Label htmlFor="asset-json">Asset array</Label><Textarea id="asset-json" rows={8} value={json} disabled={!editable || busy} placeholder={'[{"kind":"tree","location":{"lat":40,"lon":-105},"source_ref":"survey:patch-id"}]'} onChange={(event) => { setJson(event.target.value); setPreview(null); }} />
      <p className="text-xs text-muted-foreground">Trees: kind, location, species, height_m, canopy_radius_m, source_ref. Lines: kind, two coordinates with lat/lon/elevation_m, name. Pole mutation is unsupported.</p>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!editable || busy} onClick={() => { try { setPreview(previewDigitalTwinAssetBatch(json)); } catch (error) { setPreview(null); onError(error); } }}>Validate and preview</Button><Button disabled={!editable || busy || preview?.length !== 1} onClick={() => void upload("single")}>Create single asset</Button><Button disabled={!editable || busy || !preview} onClick={() => void upload("batch")}>Import reviewed batch</Button></div>
      {preview ? <p role="status" className="text-sm">Reviewed intake: {preview.length} assets ({preview.filter((asset) => asset.kind === "tree").length} trees, {preview.filter((asset) => asset.kind === "power_line").length} lines). No server identities will be supplied.</p> : null}
    </TabsContent><TabsContent value="csv" className="space-y-3 pt-3"><Label htmlFor="asset-csv">CSV file, maximum 8 MiB</Label><Input id="asset-csv" type="file" accept=".csv,text/csv" disabled={!editable || busy} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><Button disabled={!editable || busy || !file} onClick={() => void upload("csv")}>Import CSV</Button></TabsContent></Tabs>
    {busy ? <p role="status">Submitting asset intake…</p> : null}{message ? <p role="status">{message}</p> : null}
  </CardContent></Card>;
}
