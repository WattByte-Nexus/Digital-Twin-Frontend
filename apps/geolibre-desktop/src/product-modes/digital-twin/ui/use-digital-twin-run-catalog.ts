import { useEffect, useState } from "react";
import { fetchDigitalTwinRunCatalog, isDigitalTwinRunActive, type DigitalTwinRunCatalog } from "../../../lib/digital-twin-runs";

export const ACTIVE_RUN_CATALOG_INTERVAL_MS = 2_000;
export const IDLE_RUN_CATALOG_INTERVAL_MS = 15_000;

export function digitalTwinRunCatalogInterval(catalog: DigitalTwinRunCatalog): number {
  return catalog.runs.some((run) => isDigitalTwinRunActive(run.status)) ? ACTIVE_RUN_CATALOG_INTERVAL_MS : IDLE_RUN_CATALOG_INTERVAL_MS;
}

/** Catalog discovery continues while idle; selected-run SSE serves a different purpose. */
export function useDigitalTwinRunCatalog(apiUrl: string, refreshKey: number = 0, enabled = true) {
  const [catalog, setCatalog] = useState<DigitalTwinRunCatalog>({ regions: [], runs: [] });
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSuccessAt, setLastSuccessAt] = useState<Date | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout>;
    let loading = false;
    let interval = IDLE_RUN_CATALOG_INTERVAL_MS;
    const refresh = async () => {
      clearTimeout(timeout);
      if (loading || document.visibilityState === "hidden" || controller.signal.aborted) return;
      loading = true;
      setIsLoading(true);
      try {
        const next = await fetchDigitalTwinRunCatalog(apiUrl, { signal: controller.signal });
        if (controller.signal.aborted) return;
        interval = digitalTwinRunCatalogInterval(next);
        setCatalog(next);
        setError(null);
        setLastSuccessAt(new Date());
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause : new Error("Runs could not be refreshed."));
      } finally {
        loading = false;
        if (!controller.signal.aborted) {
          setIsLoading(false);
          timeout = setTimeout(() => { void refresh(); }, interval);
        }
      }
    };
    const recovery = () => { void refresh(); };
    document.addEventListener("visibilitychange", recovery);
    window.addEventListener("online", recovery);
    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timeout);
      document.removeEventListener("visibilitychange", recovery);
      window.removeEventListener("online", recovery);
    };
  }, [apiUrl, enabled, refreshKey, revision]);
  return { catalog, error, isLoading, lastSuccessAt, stale: error !== null, refresh: () => setRevision((current) => current + 1) };
}
