import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FilterSearch,
  Input,
  Label,
  ScrollArea,
  SelectMenu,
  SelectMenuContent,
  SelectMenuItem,
  SelectMenuTrigger,
  SelectMenuValue,
  Separator,
  Skeleton,
  SortableTableHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TooltipProvider,
  surfaceThemeClassName,
  type DigitalTwinRegion,
  type SurfaceTheme,
} from "@geolibre/ui";
import {
  Activity,
  Cable,
  ChevronRight,
  CircleAlert,
  CloudSun,
  Database,
  FileText,
  MapPin,
  Plus,
  RefreshCw,
  SearchX,
  TreePine,
  TriangleAlert,
  Trash2,
  Upload,
  Wind,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  deleteDigitalTwinAsset,
  fetchDigitalTwinAsset,
  fetchDigitalTwinAssets,
  importDigitalTwinAssetCsv,
  updateDigitalTwinAsset,
  type DigitalTwinAsset,
  type DigitalTwinAssetPatch,
} from "../../../../lib/digital-twin-assets";

type AssetKind = DigitalTwinAsset["kind"];
type SortKey = "name" | "region" | "type";
type SortDirection = "asc" | "desc";
type PanelMode = "view" | "add" | "edit" | null;

interface CatalogAsset {
  asset: DigitalTwinAsset;
  regionName: string;
}

interface AssetsViewProps {
  apiUrl: string;
  location: string;
  onOpenAsset: (assetId: string) => void;
  regions: readonly DigitalTwinRegion[];
  theme: SurfaceTheme;
}

interface EditorDraft {
  kind: AssetKind;
  regionId: string;
  name: string;
  latitude: string;
  longitude: string;
  endLatitude: string;
  endLongitude: string;
  elevationM: string;
  endElevationM: string;
  heightM: string;
  canopyRadiusM: string;
  sourceRef: string;
}

function assetIdFromLocation(location: string): string | null {
  const parts = new URL(
    location || "/",
    "https://digital-twin.invalid"
  ).pathname
    .split("/")
    .filter(Boolean);
  if (parts[2]?.toLowerCase() !== "assets" || !parts[3]) return null;
  try {
    return decodeURIComponent(parts[3]);
  } catch {
    return null;
  }
}

function assetName(asset: DigitalTwinAsset): string {
  if (asset.kind === "power_line")
    return asset.name ?? `Power line ${asset.assetId}`;
  return asset.species
    ? asset.species.replaceAll("_", " ")
    : `Tree ${asset.assetId}`;
}

function kindLabel(kind: AssetKind): string {
  return kind === "power_line" ? "Power line" : "Tree";
}

function editorDraft(
  asset: DigitalTwinAsset | null,
  regionId: string
): EditorDraft {
  if (asset?.kind === "power_line") {
    const first = asset.coordinates[0];
    const last = asset.coordinates.at(-1);
    return {
      kind: "power_line",
      regionId: asset.regionId,
      name: asset.name ?? "",
      latitude: String(first?.lat ?? ""),
      longitude: String(first?.lon ?? ""),
      endLatitude: String(last?.lat ?? ""),
      endLongitude: String(last?.lon ?? ""),
      elevationM: String(first?.elevationM ?? ""),
      endElevationM: String(last?.elevationM ?? ""),
      heightM: "",
      canopyRadiusM: "",
      sourceRef: "",
    };
  }
  if (asset?.kind === "tree") {
    return {
      kind: "tree",
      regionId: asset.regionId,
      name: asset.species ?? "",
      latitude: String(asset.location.lat),
      longitude: String(asset.location.lon),
      endLatitude: "",
      endLongitude: "",
      elevationM: "",
      endElevationM: "",
      heightM: asset.heightM === null ? "" : String(asset.heightM),
      canopyRadiusM:
        asset.canopyRadiusM === null ? "" : String(asset.canopyRadiusM),
      sourceRef: asset.sourceRef ?? "",
    };
  }
  return {
    kind: "power_line",
    regionId,
    name: "",
    latitude: "",
    longitude: "",
    endLatitude: "",
    endLongitude: "",
    elevationM: "",
    endElevationM: "",
    heightM: "",
    canopyRadiusM: "",
    sourceRef: "",
  };
}

function coordinate(latitude: string, longitude: string, label: string) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (
    !Number.isFinite(lat) ||
    Math.abs(lat) > 90 ||
    !Number.isFinite(lon) ||
    Math.abs(lon) > 180
  ) {
    throw new Error(`${label} must be valid WGS84 latitude and longitude.`);
  }
  return { lat, lon };
}

function positiveOptional(value: string, label: string): number | undefined {
  if (!value.trim()) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0)
    throw new Error(`${label} must be greater than zero.`);
  return number;
}

function finiteNumber(value: string, label: string): number {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be a number.`);
  return number;
}

function updatePayload(draft: EditorDraft): DigitalTwinAssetPatch {
  if (draft.kind === "power_line") {
    return {
      name: draft.name.trim() || null,
      coordinates: [
        {
          ...coordinate(draft.latitude, draft.longitude, "Start coordinate"),
          elevation_m: finiteNumber(draft.elevationM, "Start elevation"),
        },
        {
          ...coordinate(
            draft.endLatitude,
            draft.endLongitude,
            "End coordinate"
          ),
          elevation_m: finiteNumber(draft.endElevationM, "End elevation"),
        },
      ],
    };
  }
  return {
    location: coordinate(draft.latitude, draft.longitude, "Tree location"),
    species: draft.name.trim() || null,
    height_m: positiveOptional(draft.heightM, "Tree height") ?? null,
    canopy_radius_m:
      positiveOptional(draft.canopyRadiusM, "Canopy radius") ?? null,
  };
}

function PropertyRows({
  rows,
}: {
  rows: Array<{ label: string; value: ReactNode; mono?: boolean }>;
}) {
  return (
    <dl className="divide-y divide-separator">
      {rows.map((row) => (
        <div className="grid grid-cols-[1fr_1.3fr] gap-4 py-3" key={row.label}>
          <dt className="text-xs text-muted-foreground">{row.label}</dt>
          <dd
            className={`select-text text-right text-xs font-medium ${
              row.mono ? "break-all font-mono" : ""
            }`}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function AssetSectionHeading({
  children,
  icon,
}: {
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {icon}
      {children}
    </h3>
  );
}

function AssetMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

function AssetEditor({
  apiUrl,
  asset,
  mode,
  onCancel,
  onSaved,
  regions,
  theme,
}: {
  apiUrl: string;
  asset: DigitalTwinAsset | null;
  mode: "add" | "edit";
  onCancel: () => void;
  onSaved: (assets: DigitalTwinAsset[]) => void;
  regions: readonly DigitalTwinRegion[];
  theme: SurfaceTheme;
}) {
  const [draft, setDraft] = useState(() =>
    editorDraft(asset, regions[0]?.id ?? "")
  );
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = (key: keyof EditorDraft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (mode === "add" && !file) {
      setError("Choose a CSV file to import.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved =
        mode === "add"
          ? await importDigitalTwinAssetCsv(
              apiUrl,
              draft.regionId,
              file as File
            )
          : [
              await updateDigitalTwinAsset(
                apiUrl,
                asset?.regionId ?? "",
                asset?.assetId ?? "",
                updatePayload(draft)
              ),
            ];
      onSaved(saved);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Asset could not be saved."
      );
    } finally {
      setSaving(false);
    }
  };
  const overlay = `${surfaceThemeClassName(theme)} surface-glass-overlay`;
  return (
    <aside
      aria-label={mode === "add" ? "Add assets" : "Edit asset"}
      className="flex min-h-0 w-[420px] shrink-0 flex-col border-l border-separator bg-card"
    >
      <header className="flex items-start justify-between gap-3 border-b border-separator p-5">
        <div>
          <h2 className="text-lg font-semibold">
            {mode === "add" ? "Add assets" : "Edit asset"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "add"
              ? "Import a validated asset batch into a draft region."
              : "Changes are saved directly to the Digital Twin API."}
          </p>
        </div>
        <Button
          aria-label="Close editor"
          onClick={onCancel}
          size="icon"
          variant="ghost"
        >
          <X />
        </Button>
      </header>
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-5 p-5">
            <div className="space-y-2">
              <Label>Region</Label>
              <SelectMenu
                disabled={mode === "edit"}
                onValueChange={(value) => update("regionId", value)}
                value={draft.regionId}
              >
                <SelectMenuTrigger>
                  <MapPin />
                  <SelectMenuValue />
                </SelectMenuTrigger>
                <SelectMenuContent className={overlay} position="popper">
                  {regions.map((region) => (
                    <SelectMenuItem key={region.id} value={region.id}>
                      {region.name}
                    </SelectMenuItem>
                  ))}
                </SelectMenuContent>
              </SelectMenu>
            </div>
            {mode === "add" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="asset-csv">Asset CSV</Label>
                  <Input
                    accept=".csv,text/csv"
                    className="sr-only"
                    id="asset-csv"
                    onChange={(event) => {
                      setFile(event.target.files?.[0] ?? null);
                      setError(null);
                    }}
                    required
                    type="file"
                  />
                  <Label
                    className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 p-5 text-center transition-colors hover:bg-muted/70 focus-within:ring-2 focus-within:ring-ring"
                    htmlFor="asset-csv"
                  >
                    {file ? (
                      <>
                        <FileText
                          aria-hidden="true"
                          className="size-8 text-primary"
                        />
                        <span className="mt-3 max-w-full truncate text-sm font-medium">
                          {file.name}
                        </span>
                        <span className="mt-1 text-xs font-normal text-muted-foreground">
                          {(file.size / 1024).toLocaleString(undefined, {
                            maximumFractionDigits: 1,
                          })}{" "}
                          KiB · click to replace
                        </span>
                      </>
                    ) : (
                      <>
                        <Upload
                          aria-hidden="true"
                          className="size-8 text-muted-foreground"
                        />
                        <span className="mt-3 text-sm font-medium">
                          Choose a CSV file
                        </span>
                        <span className="mt-1 text-xs font-normal text-muted-foreground">
                          Up to 1,000 assets and 8 MiB
                        </span>
                      </>
                    )}
                  </Label>
                </div>
                <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-xs font-medium">Required columns</p>
                  <code className="block text-xs text-muted-foreground">
                    type,properties,coords
                  </code>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Types are <code>tree</code> or <code>power_line</code>.
                    Properties and coordinates must be JSON; coordinates use
                    GeoJSON longitude, latitude order.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Asset type</Label>
                  <SelectMenu
                    disabled={mode === "edit"}
                    onValueChange={(value) => update("kind", value)}
                    value={draft.kind}
                  >
                    <SelectMenuTrigger>
                      <SelectMenuValue />
                    </SelectMenuTrigger>
                    <SelectMenuContent className={overlay} position="popper">
                      <SelectMenuItem value="power_line">
                        Power line
                      </SelectMenuItem>
                      <SelectMenuItem value="tree">Tree</SelectMenuItem>
                    </SelectMenuContent>
                  </SelectMenu>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asset-name">
                    {draft.kind === "tree" ? "Species" : "Name"}
                  </Label>
                  <Input
                    id="asset-name"
                    onChange={(event) => update("name", event.target.value)}
                    placeholder={
                      draft.kind === "tree"
                        ? "ponderosa_pine"
                        : "North feeder span"
                    }
                    value={draft.name}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="asset-lat">
                      {draft.kind === "tree" ? "Latitude" : "Start latitude"}
                    </Label>
                    <Input
                      id="asset-lat"
                      inputMode="decimal"
                      onChange={(event) =>
                        update("latitude", event.target.value)
                      }
                      required
                      value={draft.latitude}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="asset-lon">
                      {draft.kind === "tree" ? "Longitude" : "Start longitude"}
                    </Label>
                    <Input
                      id="asset-lon"
                      inputMode="decimal"
                      onChange={(event) =>
                        update("longitude", event.target.value)
                      }
                      required
                      value={draft.longitude}
                    />
                  </div>
                </div>
                {draft.kind === "power_line" ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="asset-start-elevation">
                          Start elevation (m)
                        </Label>
                        <Input
                          id="asset-start-elevation"
                          inputMode="decimal"
                          onChange={(event) =>
                            update("elevationM", event.target.value)
                          }
                          required
                          value={draft.elevationM}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="asset-end-elevation">
                          End elevation (m)
                        </Label>
                        <Input
                          id="asset-end-elevation"
                          inputMode="decimal"
                          onChange={(event) =>
                            update("endElevationM", event.target.value)
                          }
                          required
                          value={draft.endElevationM}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="asset-end-lat">End latitude</Label>
                        <Input
                          id="asset-end-lat"
                          inputMode="decimal"
                          onChange={(event) =>
                            update("endLatitude", event.target.value)
                          }
                          required
                          value={draft.endLatitude}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="asset-end-lon">End longitude</Label>
                        <Input
                          id="asset-end-lon"
                          inputMode="decimal"
                          onChange={(event) =>
                            update("endLongitude", event.target.value)
                          }
                          required
                          value={draft.endLongitude}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="asset-height">Height (m)</Label>
                        <Input
                          id="asset-height"
                          inputMode="decimal"
                          onChange={(event) =>
                            update("heightM", event.target.value)
                          }
                          value={draft.heightM}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="asset-canopy">Canopy radius (m)</Label>
                        <Input
                          id="asset-canopy"
                          inputMode="decimal"
                          onChange={(event) =>
                            update("canopyRadiusM", event.target.value)
                          }
                          value={draft.canopyRadiusM}
                        />
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
            {error ? (
              <p
                className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            ) : null}
          </div>
        </ScrollArea>
        <footer className="flex justify-end gap-2 border-t border-separator p-4">
          <Button
            disabled={saving}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={saving || (mode === "add" && !file)} type="submit">
            {saving
              ? "Saving…"
              : mode === "add"
              ? "Import CSV"
              : "Save changes"}
          </Button>
        </footer>
      </form>
    </aside>
  );
}

function AssetProperties({
  apiUrl,
  asset,
  onClose,
  onDeleted,
  onEdit,
  regionName,
}: {
  apiUrl: string;
  asset: DigitalTwinAsset;
  onClose: () => void;
  onDeleted: () => void;
  onEdit: () => void;
  regionName: string;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteDigitalTwinAsset(apiUrl, asset.regionId, asset.assetId);
      onDeleted();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Asset could not be deleted."
      );
      setDeleting(false);
    }
  };
  const Icon = asset.kind === "power_line" ? Cable : TreePine;
  const physics = asset.kind === "power_line" ? asset.latestPhysics : null;
  return (
    <aside
      aria-label={`Properties for ${assetName(asset)}`}
      className="flex min-h-0 w-[420px] shrink-0 flex-col border-l border-separator bg-card"
    >
      <header className="p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-semibold">
                {assetName(asset)}
              </h2>
              <Badge variant="outline">{kindLabel(asset.kind)}</Badge>
            </div>
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
              {asset.assetId} · {regionName}
            </p>
          </div>
          <Button
            aria-label="Close properties"
            className="-mr-2 -mt-2 size-11 shrink-0"
            onClick={onClose}
            size="icon"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <Button className="mt-4 min-h-11 w-full" onClick={onEdit}>
          Edit properties
        </Button>
      </header>
      <Separator />
      <Tabs className="min-h-0 flex-1 gap-0" defaultValue="properties">
        <div className="border-b px-4 py-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="properties">Properties</TabsTrigger>
            <TabsTrigger value="environment">Environment</TabsTrigger>
            <TabsTrigger value="lineage">Lineage</TabsTrigger>
          </TabsList>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <TabsContent className="space-y-5 p-4" value="properties">
            <section>
              <AssetSectionHeading>Identity</AssetSectionHeading>
              <PropertyRows
                rows={[
                  { label: "Asset ID", value: asset.assetId, mono: true },
                  { label: "Region", value: regionName },
                  { label: "Asset type", value: kindLabel(asset.kind) },
                ]}
              />
            </section>

            {asset.kind === "power_line" ? (
              <>
                <section>
                  <AssetSectionHeading
                    icon={<MapPin aria-hidden="true" className="size-3.5" />}
                  >
                    Support positions
                  </AssetSectionHeading>
                  <PropertyRows
                    rows={[
                      {
                        label: "Start",
                        value: `${asset.coordinates[0].lat.toFixed(
                          6
                        )}°, ${asset.coordinates[0].lon.toFixed(6)}°`,
                      },
                      {
                        label: "Start elevation",
                        value: `${asset.coordinates[0].elevationM.toLocaleString()} m`,
                      },
                      {
                        label: "End",
                        value: `${asset.coordinates[1].lat.toFixed(
                          6
                        )}°, ${asset.coordinates[1].lon.toFixed(6)}°`,
                      },
                      {
                        label: "End elevation",
                        value: `${asset.coordinates[1].elevationM.toLocaleString()} m`,
                      },
                    ]}
                  />
                </section>
                <section>
                  <AssetSectionHeading
                    icon={<Cable aria-hidden="true" className="size-3.5" />}
                  >
                    Conductor
                  </AssetSectionHeading>
                  {asset.conductor ? (
                    <PropertyRows
                      rows={[
                        {
                          label: "Span length",
                          value: `${asset.conductor.spanLengthM.toLocaleString()} m`,
                        },
                        {
                          label: "Diameter",
                          value: `${(
                            asset.conductor.conductorDiameterM * 1_000
                          ).toLocaleString()} mm`,
                        },
                        {
                          label: "Mass",
                          value: `${asset.conductor.massPerMeterKgM.toLocaleString()} kg/m`,
                        },
                        {
                          label: "Horizontal tension",
                          value: `${asset.conductor.horizontalTensionN.toLocaleString()} N`,
                        },
                        {
                          label: "Static sag",
                          value:
                            asset.conductor.staticSagM === null
                              ? "Not available"
                              : `${asset.conductor.staticSagM.toLocaleString()} m`,
                        },
                      ]}
                    />
                  ) : (
                    <p className="mt-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                      Operational conductor properties are not available yet.
                    </p>
                  )}
                </section>
              </>
            ) : (
              <>
                <section>
                  <AssetSectionHeading
                    icon={<MapPin aria-hidden="true" className="size-3.5" />}
                  >
                    Position
                  </AssetSectionHeading>
                  <PropertyRows
                    rows={[
                      {
                        label: "Latitude",
                        value: `${asset.location.lat.toFixed(6)}°`,
                      },
                      {
                        label: "Longitude",
                        value: `${asset.location.lon.toFixed(6)}°`,
                      },
                    ]}
                  />
                </section>
                <section>
                  <AssetSectionHeading>Vegetation</AssetSectionHeading>
                  <PropertyRows
                    rows={[
                      {
                        label: "Species",
                        value: asset.species?.replaceAll("_", " ") ?? "Not supplied",
                      },
                      {
                        label: "Height",
                        value:
                          asset.heightM === null
                            ? "Not supplied"
                            : `${asset.heightM} m`,
                      },
                      {
                        label: "Canopy radius",
                        value:
                          asset.canopyRadiusM === null
                            ? "Not supplied"
                            : `${asset.canopyRadiusM} m`,
                      },
                    ]}
                  />
                </section>
              </>
            )}
          </TabsContent>

          <TabsContent className="space-y-5 p-4" value="environment">
            {physics ? (
              <>
                <section>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <AssetSectionHeading>
                        Latest Engine result
                      </AssetSectionHeading>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {assetName(asset)}
                      </p>
                    </div>
                    <Badge
                      className="uppercase tracking-[0.06em]"
                      variant={
                        physics.status === "succeeded"
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {physics.status === "succeeded" ? (
                        <Activity aria-hidden="true" />
                      ) : (
                        <CircleAlert aria-hidden="true" />
                      )}
                      {physics.source}
                    </Badge>
                  </div>
                  {physics.status === "succeeded" ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <AssetMetric
                        icon={<Wind aria-hidden="true" className="size-3.5" />}
                        label="Wind speed"
                        value={`${physics.windSpeedMps.toFixed(1)} m/s`}
                      />
                      <AssetMetric
                        icon={
                          <Activity aria-hidden="true" className="size-3.5" />
                        }
                        label="Max movement"
                        value={`${physics.maxDisplacementM.toFixed(2)} m`}
                      />
                    </div>
                  ) : (
                    <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                      The latest solver result failed: {physics.failureKind.replaceAll(
                        "_",
                        " "
                      )}.
                    </p>
                  )}
                </section>
                <section>
                  <AssetSectionHeading>Result details</AssetSectionHeading>
                  <PropertyRows
                    rows={[
                      { label: "Completed tick", value: physics.tick },
                      ...(physics.status === "succeeded"
                        ? [
                            {
                              label: "Midspan movement",
                              value: `${physics.midspanDisplacementM.toFixed(
                                2
                              )} m`,
                            },
                            {
                              label: "Max position",
                              value: `${physics.maxDisplacementPositionM.toFixed(
                                2
                              )} m`,
                            },
                          ]
                        : []),
                    ]}
                  />
                </section>
              </>
            ) : (
              <div className="rounded-lg border border-dashed p-5 text-center">
                <CloudSun
                  aria-hidden="true"
                  className="mx-auto size-5 text-muted-foreground"
                />
                <p className="mt-2 text-sm font-medium text-foreground">
                  No completed environment result
                </p>
                <p className="mx-auto mt-1 max-w-[32ch] text-xs leading-relaxed text-muted-foreground">
                  {asset.kind === "power_line"
                    ? "Run a scenario to calculate wind response for this conductor span."
                    : "Environmental calculations are not available for this tree asset."}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent className="space-y-5 p-4" value="lineage">
            <section>
              <AssetSectionHeading
                icon={<Database aria-hidden="true" className="size-3.5" />}
              >
                Digital Twin Engine
              </AssetSectionHeading>
              <PropertyRows
                rows={[
                  {
                    label: "Resource",
                    value: `/api/v1/regions/${asset.regionId}/assets/${asset.assetId}`,
                    mono: true,
                  },
                  {
                    label: "Geometry model",
                    value:
                      asset.kind === "power_line"
                        ? "Conductor span endpoints"
                        : "Point asset",
                  },
                  {
                    label: "Source of truth",
                    value: "Versioned Engine state",
                  },
                ]}
              />
            </section>
            {physics ? (
              <section>
                <AssetSectionHeading>
                  Calculation lineage
                </AssetSectionHeading>
                <PropertyRows
                  rows={[
                    { label: "Weather version", value: physics.weatherVersion },
                    { label: "Weather source", value: physics.weatherSourceRef },
                    { label: "Model", value: physics.modelVersion },
                    {
                      label: "Solver",
                      value: physics.solverVersion ?? physics.source.toUpperCase(),
                    },
                    {
                      label: "Line snapshot",
                      value: physics.lineSnapshot,
                    },
                    ...(physics.surrogateConfidence === null
                      ? []
                      : [
                          {
                            label: "Model confidence",
                            value: `${Math.round(
                              physics.surrogateConfidence * 100
                            )}%`,
                          },
                        ]),
                  ]}
                />
              </section>
            ) : null}
            {asset.kind === "tree" ? (
              <section>
                <AssetSectionHeading>Source record</AssetSectionHeading>
                <PropertyRows
                  rows={[
                    {
                      label: "Source reference",
                      value: asset.sourceRef ?? "Not supplied",
                    },
                  ]}
                />
              </section>
            ) : null}
          </TabsContent>
        </ScrollArea>
      </Tabs>
      <Separator />
      <footer className="p-3">
        {error ? (
          <p className="mb-2 px-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          className="min-h-11 w-full text-destructive hover:text-destructive"
          disabled={deleting}
          onClick={() => void remove()}
          variant="ghost"
        >
          <Trash2 />
          {deleting ? "Deleting…" : "Delete asset"}
        </Button>
      </footer>
    </aside>
  );
}

export function AssetsView({
  apiUrl,
  location,
  onOpenAsset,
  regions,
  theme,
}: AssetsViewProps) {
  const [assets, setAssets] = useState<CatalogAsset[]>([]);
  const [requestKey, setRequestKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [query, setQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<AssetKind | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const selectedId = assetIdFromLocation(location);
  const selected =
    assets.find((item) => item.asset.assetId === selectedId) ?? null;
  const selectedRegionId = selected?.asset.regionId ?? null;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void Promise.allSettled(
      regions.map(async (region) => ({
        region,
        assets: await fetchDigitalTwinAssets(apiUrl, region.id, {
          signal: controller.signal,
        }),
      }))
    ).then((results) => {
      if (controller.signal.aborted) return;
      const loaded = results.flatMap((result) =>
        result.status === "fulfilled"
          ? result.value.assets.map((asset) => ({
              asset,
              regionName: result.value.region.name,
            }))
          : []
      );
      const failures = results.filter((result) => result.status === "rejected");
      setAssets(loaded);
      setError(
        failures.length
          ? new Error(
              `${failures.length} of ${regions.length} region catalogs could not be loaded.`
            )
          : null
      );
      setLoading(false);
    });
    return () => controller.abort();
  }, [apiUrl, regions, requestKey]);

  useEffect(() => {
    if (!selectedId || !selectedRegionId) return;
    const controller = new AbortController();
    void fetchDigitalTwinAsset(apiUrl, selectedRegionId, selectedId, {
      signal: controller.signal,
    }).then(
      (asset) => {
        if (controller.signal.aborted) return;
        setAssets((current) => {
          const existing = current.some(
            (item) => item.asset.assetId === asset.assetId
          );
          if (existing) {
            return current.map((item) =>
              item.asset.assetId === asset.assetId ? { ...item, asset } : item
            );
          }
          return [
            {
              asset,
              regionName:
                regions.find((region) => region.id === asset.regionId)?.name ??
                asset.regionId,
            },
            ...current,
          ];
        });
        setPanelMode("view");
      },
      (cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause
              : new Error("Asset details could not be loaded.")
          );
      }
    );
    return () => controller.abort();
  }, [apiUrl, regions, selectedId, selectedRegionId]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = assets.filter(
      ({ asset, regionName }) =>
        (regionFilter === "all" || asset.regionId === regionFilter) &&
        (typeFilter === "all" || asset.kind === typeFilter) &&
        (!normalized ||
          [
            assetName(asset),
            asset.assetId,
            regionName,
            kindLabel(asset.kind),
          ].some((value) => value.toLowerCase().includes(normalized)))
    );
    return [...filtered].sort((left, right) => {
      const a =
        sortKey === "name"
          ? assetName(left.asset)
          : sortKey === "region"
          ? left.regionName
          : kindLabel(left.asset.kind);
      const b =
        sortKey === "name"
          ? assetName(right.asset)
          : sortKey === "region"
          ? right.regionName
          : kindLabel(right.asset.kind);
      return (
        a.localeCompare(b, undefined, { numeric: true }) *
        (sortDirection === "asc" ? 1 : -1)
      );
    });
  }, [assets, query, regionFilter, sortDirection, sortKey, typeFilter]);
  const sort = (key: SortKey) => {
    if (sortKey === key)
      setSortDirection((value) => (value === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };
  const overlay = `${surfaceThemeClassName(theme)} surface-glass-overlay`;
  const save = (savedAssets: DigitalTwinAsset[]) => {
    const savedIds = new Set(savedAssets.map((asset) => asset.assetId));
    const catalogItems = savedAssets.map((asset) => ({
      asset,
      regionName:
        regions.find((region) => region.id === asset.regionId)?.name ??
        asset.regionId,
    }));
    setAssets((current) => [
      ...catalogItems,
      ...current.filter((item) => !savedIds.has(item.asset.assetId)),
    ]);
    if (panelMode === "edit" && savedAssets[0]) {
      onOpenAsset(savedAssets[0].assetId);
      setPanelMode("view");
    } else {
      onOpenAsset("");
      setPanelMode(null);
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full min-h-0 bg-background">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-4 px-5 pb-2 pt-5 lg:px-7">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Assets</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage the canonical network catalog through the Digital Twin
                API.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                disabled={loading}
                onClick={() => setRequestKey((value) => value + 1)}
                variant="outline"
              >
                <RefreshCw className={loading ? "animate-spin" : undefined} />
                Refresh
              </Button>
              <Button
                onClick={() => {
                  onOpenAsset("");
                  setPanelMode("add");
                }}
              >
                <Plus />
                Add assets
              </Button>
            </div>
          </header>
          <div className="flex flex-wrap gap-2 px-5 pb-5 pt-2 lg:px-7">
            <FilterSearch
              className="min-w-64 flex-1"
              onValueChange={setQuery}
              placeholder="Search assets…"
              value={query}
            />
            <SelectMenu onValueChange={setRegionFilter} value={regionFilter}>
              <SelectMenuTrigger className="w-44">
                <MapPin />
                <SelectMenuValue />
              </SelectMenuTrigger>
              <SelectMenuContent className={overlay} position="popper">
                <SelectMenuItem value="all">All regions</SelectMenuItem>
                {regions.map((region) => (
                  <SelectMenuItem key={region.id} value={region.id}>
                    {region.name}
                  </SelectMenuItem>
                ))}
              </SelectMenuContent>
            </SelectMenu>
            <SelectMenu
              onValueChange={(value) =>
                setTypeFilter(value as AssetKind | "all")
              }
              value={typeFilter}
            >
              <SelectMenuTrigger className="w-40">
                <SelectMenuValue />
              </SelectMenuTrigger>
              <SelectMenuContent className={overlay} position="popper">
                <SelectMenuItem value="all">All types</SelectMenuItem>
                <SelectMenuItem value="power_line">Power lines</SelectMenuItem>
                <SelectMenuItem value="tree">Trees</SelectMenuItem>
              </SelectMenuContent>
            </SelectMenu>
          </div>
          {error ? (
            <Card className="mx-5 mb-4 bg-destructive/5 lg:mx-7">
              <CardContent className="flex flex-wrap items-center gap-3 px-5">
                <TriangleAlert aria-hidden="true" className="size-5 text-destructive" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">Assets could not be loaded</p>
                  <p className="text-sm text-muted-foreground">{error.message}</p>
                </div>
                <Button onClick={() => setRequestKey((value) => value + 1)} variant="outline">
                  Try again
                </Button>
              </CardContent>
            </Card>
          ) : null}
          <ScrollArea className="min-h-0 flex-1">
            <div className="px-5 pb-5 lg:px-7 lg:pb-7">
              <Card className="gap-0 overflow-hidden py-0">
                <CardHeader className="px-5 py-4">
                  <CardTitle className="text-base">Asset catalog</CardTitle>
                  <CardDescription>
                    {visible.length} of {assets.length} assets
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">
                        <SortableTableHeader
                          active={sortKey === "name"}
                          direction={sortDirection}
                          onClick={() => sort("name")}
                        >
                          Asset
                        </SortableTableHeader>
                      </TableHead>
                      <TableHead>
                        <SortableTableHeader
                          active={sortKey === "region"}
                          direction={sortDirection}
                          onClick={() => sort("region")}
                        >
                          Region
                        </SortableTableHeader>
                      </TableHead>
                      <TableHead>
                        <SortableTableHeader
                          active={sortKey === "type"}
                          direction={sortDirection}
                          onClick={() => sort("type")}
                        >
                          Type
                        </SortableTableHeader>
                      </TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && !assets.length
                      ? Array.from({ length: 6 }, (_, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Skeleton className="h-9 w-48" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-5 w-24" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-5 w-20" />
                            </TableCell>
                            <TableCell />
                          </TableRow>
                        ))
                      : visible.map(({ asset, regionName }) => {
                          const Icon =
                            asset.kind === "power_line" ? Cable : TreePine;
                          return (
                            <TableRow
                              className="cursor-pointer"
                              key={asset.assetId}
                              onClick={() => {
                                setPanelMode("view");
                                onOpenAsset(asset.assetId);
                              }}
                            >
                              <TableCell className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <span className="grid size-9 place-items-center rounded-md bg-secondary">
                                    <Icon className="size-4" />
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-medium">
                                      {assetName(asset)}
                                    </span>
                                    <span className="block truncate font-mono text-[11px] text-muted-foreground">
                                      {asset.assetId}
                                    </span>
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {regionName}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {kindLabel(asset.kind)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <ChevronRight className="size-4 text-muted-foreground" />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                  </TableBody>
                </Table>
                {!loading && !visible.length ? (
                  <div className="grid min-h-64 place-items-center p-6 text-center">
                    <div>
                      <SearchX className="mx-auto size-7 text-muted-foreground" />
                      <p className="mt-3 font-medium text-foreground">
                        No matching assets
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Adjust the filters or refresh the Digital Twin API.
                      </p>
                    </div>
                  </div>
                ) : null}
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </main>
        {panelMode === "view" && selected ? (
          <AssetProperties
            apiUrl={apiUrl}
            asset={selected.asset}
            onClose={() => {
              setPanelMode(null);
              onOpenAsset("");
            }}
            onDeleted={() => {
              setAssets((current) =>
                current.filter(
                  (item) => item.asset.assetId !== selected.asset.assetId
                )
              );
              setPanelMode(null);
              onOpenAsset("");
            }}
            onEdit={() => setPanelMode("edit")}
            regionName={selected.regionName}
          />
        ) : null}
        {panelMode === "add" || (panelMode === "edit" && selected) ? (
          <AssetEditor
            apiUrl={apiUrl}
            asset={panelMode === "edit" ? selected?.asset ?? null : null}
            key={panelMode === "edit" ? selected?.asset.assetId : "new"}
            mode={panelMode}
            onCancel={() => setPanelMode(panelMode === "edit" ? "view" : null)}
            onSaved={save}
            regions={regions}
            theme={theme}
          />
        ) : null}
      </div>
    </TooltipProvider>
  );
}
