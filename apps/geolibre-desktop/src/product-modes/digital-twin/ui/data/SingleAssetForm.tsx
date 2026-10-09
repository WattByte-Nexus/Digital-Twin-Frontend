import { Button, Input, Label, SelectMenu, SelectMenuContent, SelectMenuItem, SelectMenuTrigger, SelectMenuValue, surfaceThemeClassName, type SurfaceTheme } from "@geolibre/ui";
import { useRef, useState, type FormEvent } from "react";
import { createDigitalTwinAsset, type DigitalTwinAssetCreate } from "../../../../lib/digital-twin-assets";

const initialFields = { latitude: "", longitude: "", elevation: "", endLatitude: "", endLongitude: "", endElevation: "", species: "", height: "", canopy: "", source: "", name: "" };
export function SingleAssetForm({ apiUrl, regionId, editable, theme, onBusyChange, onChanged, onError }: { apiUrl: string; regionId: string; editable: boolean; theme: SurfaceTheme; onBusyChange: (busy: boolean) => void; onChanged: () => void; onError: (cause: unknown) => void }) {
  const [kind, setKind] = useState<"tree" | "power_line">("tree");
  const [fields, setFields] = useState(initialFields);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  function input(key: keyof typeof initialFields, label: string, required = false, numeric = false) { return <div className="space-y-2"><Label htmlFor={`asset-single-${key}`}>{label}</Label><Input id={`asset-single-${key}`} type={numeric ? "number" : "text"} step={numeric ? "any" : undefined} required={required} disabled={!editable || busy} value={fields[key]} onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))} /></div>; }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (lock.current || !editable) return;
    lock.current = true; setBusy(true); onBusyChange(true); setMessage(null);
    try {
      const location = { lat: Number(fields.latitude), lon: Number(fields.longitude) };
      const candidate: DigitalTwinAssetCreate = kind === "tree" ? { kind, location, species: fields.species.trim() || null, height_m: fields.height ? Number(fields.height) : null, canopy_radius_m: fields.canopy ? Number(fields.canopy) : null, source_ref: fields.source.trim() || null } : { kind, name: fields.name.trim() || null, coordinates: [{ ...location, elevation_m: Number(fields.elevation) }, { lat: Number(fields.endLatitude), lon: Number(fields.endLongitude), elevation_m: Number(fields.endElevation) }] };
      const asset = await createDigitalTwinAsset(apiUrl, regionId, candidate); setMessage(`Created ${asset.assetId}.`); setFields(initialFields); onChanged();
    } catch (cause) { onError(cause); } finally { lock.current = false; setBusy(false); onBusyChange(false); }
  }
  return <form className="space-y-4" onSubmit={(event) => void submit(event)}><SelectMenu value={kind} onValueChange={(value) => setKind(value as "tree" | "power_line")} disabled={!editable || busy}><SelectMenuTrigger aria-label="Asset type"><SelectMenuValue /></SelectMenuTrigger><SelectMenuContent className={`${surfaceThemeClassName(theme)} surface-glass-overlay min-w-[var(--radix-select-trigger-width)]`}><SelectMenuItem value="tree">Tree</SelectMenuItem><SelectMenuItem value="power_line">Power line</SelectMenuItem></SelectMenuContent></SelectMenu>
    <div className="grid gap-4 sm:grid-cols-2">{input("latitude", kind === "tree" ? "Latitude" : "Start latitude", true, true)}{input("longitude", kind === "tree" ? "Longitude" : "Start longitude", true, true)}{kind === "tree" ? <>{input("species", "Species")}{input("height", "Height (m)", false, true)}{input("canopy", "Canopy radius (m)", false, true)}{input("source", "Source lineage reference (required for publication)")}</> : <>{input("elevation", "Start elevation (m)", true, true)}{input("endLatitude", "End latitude", true, true)}{input("endLongitude", "End longitude", true, true)}{input("endElevation", "End elevation (m)", true, true)}{input("name", "Line name")}</>}</div>
    <Button type="submit" disabled={!editable || busy}>{busy ? "Creating…" : "Create asset"}</Button>{message ? <p role="status" className="text-sm">{message}</p> : null}
  </form>;
}
