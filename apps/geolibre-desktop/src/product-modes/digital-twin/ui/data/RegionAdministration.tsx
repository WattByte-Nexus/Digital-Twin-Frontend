import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@geolibre/ui";
import { useRef, useState } from "react";
import { createDigitalTwinRegion, updateDigitalTwinRegion, deleteDigitalTwinRegion, publishDigitalTwinRegion, type DigitalTwinRegionRecord, type DigitalTwinRegionReadiness } from "../../../../lib/digital-twin-regions";

export function RegionAdministration({ apiUrl, region, readiness, canManage, onBusyChange, onChanged, onError }: { apiUrl: string; region: DigitalTwinRegionRecord | null; readiness: DigitalTwinRegionReadiness | null; canManage: boolean; onBusyChange: (busy: boolean) => void; onChanged: (region?: DigitalTwinRegionRecord) => void; onError: (error: unknown) => void }) {
  const [name, setName] = useState(region?.name ?? "");
  const [bounds, setBounds] = useState(region ? [region.bounds.west, region.bounds.south, region.bounds.east, region.bounds.north].join(", ") : "");
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editable = canManage && (!region || region.status === "draft");
  async function act(action: "save" | "publish" | "delete") {
    if (lock.current || !editable) return;
    lock.current = true; setBusy(true); onBusyChange(true);
    try {
      if (action === "delete" && region) { await deleteDigitalTwinRegion(apiUrl, region.region_id); onChanged(); }
      else if (action === "publish" && region) onChanged(await publishDigitalTwinRegion(apiUrl, region.region_id));
      else {
        const values = bounds.split(",").map((value) => Number(value.trim()));
        if (values.length !== 4 || bounds.split(",").some((value) => !value.trim())) throw new Error("Enter west, south, east, north bounds.");
        const [west, south, east, north] = values;
        const input = { name, bounds: { west, south, east, north } };
        onChanged(await (region ? updateDigitalTwinRegion(apiUrl, region.region_id, input) : createDigitalTwinRegion(apiUrl, input)));
      }
    } catch (error) { onError(error); } finally { lock.current = false; setBusy(false); onBusyChange(false); }
  }
  return <Card><CardHeader><CardTitle>{region ? "Region administration" : "Create region draft"}</CardTitle></CardHeader><CardContent className="space-y-4">
    {region ? <div className="flex flex-wrap gap-2"><Badge variant="outline">{region.status}</Badge><Badge variant="outline">{readiness?.ready_to_simulate ? "Ready to simulate" : "Not ready to simulate"}</Badge></div> : null}
    {region?.published_revision_id ? <p className="break-all text-xs text-muted-foreground">Published revision: {region.published_revision_id}</p> : null}
    {readiness ? <div className="space-y-1 text-sm text-muted-foreground"><p>Grid: {readiness.configured ? "configured" : "unconfigured"}; {readiness.grid_hydrated ? "hydrated" : "not hydrated"}. Runtime: {readiness.runtime_ready ? "ready" : "unavailable"}.</p>{readiness.reason_codes.length ? <p>Blocking reasons: {readiness.reason_codes.join(", ")}</p> : null}<p>Publication does not provision grids or workers.</p></div> : region ? <p className="text-sm text-muted-foreground">Readiness has not been verified.</p> : null}
    <div className="space-y-2"><Label htmlFor="region-name">Name</Label><Input id="region-name" value={name} disabled={!editable || busy} onChange={(event) => setName(event.target.value)} /></div>
    <div className="space-y-2"><Label htmlFor="region-bounds">WGS84 bounds (west, south, east, north)</Label><Input id="region-bounds" value={bounds} disabled={!editable || busy} onChange={(event) => setBounds(event.target.value)} /></div>
    {!editable ? <p className="text-sm text-muted-foreground">{region?.status === "published" ? "Published geometry and assets are read-only." : "Administration permission is required."}</p> : <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void act("save")}>{busy ? "Working…" : region ? "Save draft" : "Create draft"}</Button>{region ? <><Button variant="outline" disabled={busy} onClick={() => void act("publish")}>Publish region</Button><Button variant="destructive" disabled={busy} onClick={() => confirmDelete ? void act("delete") : setConfirmDelete(true)}>{confirmDelete ? "Confirm delete draft" : "Delete draft"}</Button>{confirmDelete ? <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Keep draft</Button> : null}</> : null}</div>}
  </CardContent></Card>;
}
