import {
  Button, Input, Progress, SettingRow, SettingsCard, SelectMenu, SelectMenuContent,
  SelectMenuItem, SelectMenuTrigger, SelectMenuValue, surfaceThemeClassName,
} from "@geolibre/ui";
import { CircleCheck, LoaderCircle, Upload, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { fetchDigitalTwinRegions, type DigitalTwinRegionRecord } from "../../../../lib/digital-twin-regions";
import {
  uploadDigitalTwinPointCloud, validatePointCloudCapture,
  type PointCloudUploadCapture, type PointCloudUploadPhase, type PointCloudUploadResult,
} from "../../../../lib/digital-twin-point-cloud-upload";

const PHASE_LABEL: Record<PointCloudUploadPhase, string> = {
  starting: "Preparing upload…", uploading: "Uploading directly to S3…",
  finishing: "Verifying upload…", cancelling: "Removing unfinished upload…",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const power = Math.min(3, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** power).toFixed(1)} ${["B", "KiB", "MiB", "GiB"][power]}`;
}

/** Settings-owned raw intake; leaving the page cancels unfinished uploads. */
export function PointCloudUploadPage({ apiUrl, theme, canUploadToRegion }: { apiUrl: string; theme: "light" | "dark"; canUploadToRegion: (regionId: string) => boolean }) {
  const id = useId();
  const [regions, setRegions] = useState<DigitalTwinRegionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [regionError, setRegionError] = useState<string | null>(null);
  const [regionId, setRegionId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState<PointCloudUploadCapture["reference"]>("embedded");
  const [epsg, setEpsg] = useState("");
  const [phase, setPhase] = useState<PointCloudUploadPhase | null>(null);
  const [sent, setSent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<PointCloudUploadResult | null>(null);
  const current = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const busy = phase !== null;
  const percent = file ? Math.min(100, Math.floor(sent / file.size * 100)) : 0;
  const overlay = `${surfaceThemeClassName(theme)} surface-glass-overlay min-w-[var(--radix-select-trigger-width)]`;

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    setLoading(true);
    setRegionError(null);
    void fetchDigitalTwinRegions(apiUrl, { signal: controller.signal }).then((items) => {
      if (!controller.signal.aborted) setRegions(items);
    }).catch((cause) => {
      if (!controller.signal.aborted) setRegionError(cause instanceof Error ? cause.message : "Regions could not be loaded.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => {
      mounted.current = false;
      controller.abort();
      current.current?.abort();
    };
  }, [apiUrl]);

  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  function clearFeedback() {
    setError(null); setNotice(null); setResult(null); setSent(0);
  }

  async function upload() {
    if (!file || current.current) return;
    if (!canUploadToRegion(regionId)) { setError("Survey upload permission is required for this region."); return; }
    clearFeedback();
    const capture: PointCloudUploadCapture = {
      filename: file.name, size: file.size, reference,
      ...(reference === "epsg" ? { epsg: epsg.trim().toUpperCase() } : {}),
    };
    try { validatePointCloudCapture(capture); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Check the selected file."); return; }
    const controller = new AbortController();
    current.current = controller;
    try {
      const completed = await uploadDigitalTwinPointCloud(apiUrl, regionId, file, capture, {
        signal: controller.signal,
        onProgress: (bytes) => { if (mounted.current) setSent(bytes); },
        onPhase: (next) => { if (mounted.current) setPhase(next); },
      });
      if (mounted.current) setResult(completed);
    } catch (cause) {
      if (mounted.current) {
        if (cause instanceof Error && cause.name === "AbortError") setNotice("Upload cancelled. Unfinished parts were removed.");
        else setError(cause instanceof Error ? cause.message : "Upload failed.");
      }
    } finally {
      current.current = null;
      if (mounted.current) setPhase(null);
    }
  }

  return (
    <SettingsCard title="Upload point cloud" description="Store a raw capture in the private S3 intake folder for later processing. Uploading does not change the map or start a dataset build.">
      <form onSubmit={(event) => { event.preventDefault(); void upload(); }}>
        <SettingRow htmlFor={`${id}-region`} label="Region" description="Use a region available to your account.">
          <SelectMenu disabled={busy || loading || regions.length === 0} value={regionId} onValueChange={(value) => { setRegionId(value); clearFeedback(); }}>
            <SelectMenuTrigger className="min-h-11 w-full @md/settings-card:w-64" id={`${id}-region`}><SelectMenuValue placeholder={loading ? "Loading regions…" : "Choose a region"} /></SelectMenuTrigger>
            <SelectMenuContent className={overlay} position="popper">
              {regions.map((region) => <SelectMenuItem className="min-h-11" key={region.region_id} value={region.region_id} disabled={!canUploadToRegion(region.region_id)}>{region.name}</SelectMenuItem>)}
            </SelectMenuContent>
          </SelectMenu>
        </SettingRow>
        <SettingRow htmlFor={`${id}-file`} label="Point-cloud file" description="LAS, LAZ or PLY · up to 100 GiB">
          <Input className="min-h-11 w-full min-w-0" id={`${id}-file`} type="file" accept=".las,.laz,.ply" disabled={busy} onChange={(event) => {
            const selected = event.currentTarget.files?.[0] ?? null;
            setFile(selected); clearFeedback();
            setReference(selected && /\.ply$/i.test(selected.name) ? "local" : "embedded");
          }} />
          {file ? <span className="text-xs tabular-nums text-muted-foreground">{formatBytes(file.size)}</span> : null}
        </SettingRow>
        <SettingRow htmlFor={`${id}-reference`} label="Coordinate reference" description="Record how the capture’s coordinates should be interpreted.">
          <SelectMenu disabled={busy} value={reference} onValueChange={(value) => { setReference(value as PointCloudUploadCapture["reference"]); clearFeedback(); }}>
            <SelectMenuTrigger className="min-h-11 w-full @md/settings-card:w-64" id={`${id}-reference`}><SelectMenuValue /></SelectMenuTrigger>
            <SelectMenuContent className={overlay} position="popper">
              <SelectMenuItem className="min-h-11" value="embedded" disabled={Boolean(file && /\.ply$/i.test(file.name))}>Embedded in LAS / LAZ</SelectMenuItem>
              <SelectMenuItem className="min-h-11" value="local">Local coordinates</SelectMenuItem>
              <SelectMenuItem className="min-h-11" value="epsg">EPSG code</SelectMenuItem>
            </SelectMenuContent>
          </SelectMenu>
        </SettingRow>
        {reference === "epsg" ? <SettingRow htmlFor={`${id}-epsg`} label="EPSG code" description="For example, EPSG:26913 for NAD83 / UTM zone 13N.">
          <Input className="min-h-11 w-full @md/settings-card:w-64" id={`${id}-epsg`} placeholder="EPSG:26913" value={epsg} disabled={busy} onChange={(event) => { setEpsg(event.currentTarget.value); clearFeedback(); }} />
        </SettingRow> : null}
        <div className="space-y-4 py-4">
          {regionError ? <p role="alert" className="break-words text-sm text-destructive">{regionError}</p> : null}
          {!loading && !regionError && regions.length === 0 ? <p className="text-sm text-muted-foreground">No regions are available for upload.</p> : null}
          {!loading && regions.length > 0 && !regions.some(region => canUploadToRegion(region.region_id)) ? <p className="text-sm text-muted-foreground">Your current plan does not permit survey uploads in these regions.</p> : null}
          {busy ? <div className="space-y-2">
            <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span role="status">{PHASE_LABEL[phase]}</span><span className="tabular-nums">{formatBytes(sent)} / {formatBytes(file?.size ?? 0)} · {percent}%</span></div>
            <Progress aria-label="Point-cloud upload progress" value={percent} />
          </div> : null}
          {error ? <p role="alert" className="break-words text-sm text-destructive">{error}</p> : null}
          {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}
          {result ? <div role="status" className="space-y-2 text-sm">
            <p className="flex items-center gap-2 font-medium"><CircleCheck aria-hidden="true" className="size-4" />Upload complete</p>
            <code className="block break-all text-xs text-muted-foreground">{result.uri}</code>
            {result.version_id ? <p className="break-all text-xs text-muted-foreground">Version: {result.version_id}</p> : null}
          </div> : null}
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11" type="submit" disabled={busy || !file || !regionId || !canUploadToRegion(regionId) || Boolean(regionError) || loading || Boolean(result)}>
              {busy ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <Upload aria-hidden="true" />}{busy ? "Upload in progress…" : "Upload to S3"}
            </Button>
            {busy ? <Button className="min-h-11" type="button" variant="outline" disabled={phase === "finishing" || phase === "cancelling"} onClick={() => { current.current?.abort(); setPhase("cancelling"); }}><X aria-hidden="true" />Cancel upload</Button> : null}
          </div>
          <p className="max-w-[65ch] text-xs leading-relaxed text-muted-foreground">Keep this page open until the upload completes. Leaving this settings section cancels an unfinished upload.</p>
        </div>
      </form>
    </SettingsCard>
  );
}
