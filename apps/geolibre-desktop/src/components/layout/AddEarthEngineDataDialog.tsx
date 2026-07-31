import type { GeoLibreAppAPI } from "@geolibre/plugins";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@geolibre/ui";
import { Database, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  defaultDigitalTwinApiUrl,
  fetchDigitalTwinEarthEngineCatalog,
  rememberDigitalTwinApiUrl,
  type DigitalTwinEarthEngineLayer,
} from "../../lib/digital-twin-earth-engine";

interface AddEarthEngineDataDialogProps {
  open: boolean;
  appApi: GeoLibreAppAPI;
  onOpenChange: (open: boolean) => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Could not load Earth Engine data.";
}

export function AddEarthEngineDataDialog({
  open,
  appApi,
  onOpenChange,
}: AddEarthEngineDataDialogProps) {
  const [apiUrl, setApiUrl] = useState(defaultDigitalTwinApiUrl);
  const [layers, setLayers] = useState<DigitalTwinEarthEngineLayer[]>([]);
  const [unavailableRegions, setUnavailableRegions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const discover = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const catalog = await fetchDigitalTwinEarthEngineCatalog(apiUrl, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setApiUrl(catalog.apiUrl);
      setLayers(catalog.layers);
      setUnavailableRegions(catalog.unavailableRegions);
      rememberDigitalTwinApiUrl(catalog.apiUrl);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setLayers([]);
      setUnavailableRegions([]);
      setError(errorMessage(caught));
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  };

  const addLayer = async (layer: DigitalTwinEarthEngineLayer) => {
    if (!appApi.addCogLayer || addingId) return;
    setAddingId(layer.id);
    setError(null);
    try {
      await appApi.addCogLayer(`${layer.name} · ${layer.regionName}`, layer.url, {
        colormap: layer.style.colormap,
        rescaleMin: layer.style.rescaleMin,
        rescaleMax: layer.style.rescaleMax,
        opacity: layer.style.opacity ?? 0.65,
      });
      setAddedIds((current) => new Set(current).add(layer.id));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setAddingId(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next) {
          abortRef.current?.abort();
          abortRef.current = null;
          setLoading(false);
          setAddingId(null);
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Earth Engine data
          </DialogTitle>
          <DialogDescription>
            Discover Earth Engine rasters already published by the Digital Twin API and add them
            as Cloud-Optimized GeoTIFF overlays.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="digital-twin-api-url">Digital Twin API URL</Label>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input
                id="digital-twin-api-url"
                type="url"
                value={apiUrl}
                onChange={(event) => setApiUrl(event.target.value)}
                placeholder="http://127.0.0.1:8000"
                autoComplete="off"
                spellCheck={false}
              />
              <Button type="button" variant="outline" onClick={discover} disabled={loading}>
                {loading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                {loading ? "Discovering…" : "Discover data"}
              </Button>
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {unavailableRegions.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              No Earth Engine catalog was available for: {unavailableRegions.join(", ")}.
            </p>
          ) : null}

          {!loading && layers.length === 0 && !error ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Connect to the API to discover its downloaded Earth Engine COGs.
            </p>
          ) : null}

          {layers.length > 0 ? (
            <div className="max-h-80 space-y-2 overflow-y-auto pe-1">
              {layers.map((layer) => {
                const added = addedIds.has(layer.id);
                const adding = addingId === layer.id;
                return (
                  <div
                    key={layer.id}
                    className="flex items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{layer.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[layer.regionName, layer.band, layer.units, "COG"]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void addLayer(layer)}
                      disabled={added || addingId !== null || !appApi.addCogLayer}
                    >
                      {adding ? <Loader2 className="me-2 h-3.5 w-3.5 animate-spin" /> : null}
                      {added ? "Added" : adding ? "Adding…" : "Add"}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
