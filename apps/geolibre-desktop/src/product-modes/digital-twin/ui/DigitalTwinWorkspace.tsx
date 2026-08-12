import type { MapController } from "@geolibre/map";
import { SimulationPopover, type DigitalTwinRegion, type SurfaceTheme } from "@geolibre/ui";
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { DigitalTwinView } from "../access";
import { defaultDigitalTwinApiUrl } from "../../../lib/digital-twin-earth-engine";
import {
  fetchDigitalTwinRunCatalog,
  submitDigitalTwinScenarioRun,
  type DigitalTwinRunCatalog,
} from "../../../lib/digital-twin-runs";
import { LiveView } from "./LiveView";
import { RunsView } from "./views/RunsView";
import { ScenariosView } from "./views/ScenariosView";
import { SettingsView } from "./views/SettingsView";
import { SimulationAreaChart, type SimulationAreaSample } from "./SimulationAreaChart";
import {
  type ScenarioRunRequest,
} from "./simulation-flow";
import "./digital-twin-workspace.css";

export type DigitalTwinWorkspaceView = DigitalTwinView | "settings";

interface DigitalTwinWorkspaceProps {
  activeRegionId: string;
  activeView: DigitalTwinWorkspaceView;
  location: string;
  mapControllerRef: RefObject<MapController | null>;
  mapSlot: ReactNode;
  onMapPresentationChange: (mode: "3d" | "plan") => void;
  onNavigate: (view: DigitalTwinView, resourceId?: string) => void;
  onOpenRealSettings: () => void;
  pluginContentEl: HTMLElement;
  regions: readonly DigitalTwinRegion[];
  theme: SurfaceTheme;
}

function PluginContentHost({ contentEl }: { contentEl: HTMLElement }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    hostRef.current?.replaceChildren(contentEl);
  }, [contentEl]);

  return <div ref={hostRef} className="dt-workspace-plugin-host" />;
}

/**
 * Figma-faithful Digital Twin product workspace around the existing map and
 * Engine plugin DOM. All route surfaces stay mounted so changing views never
 * resets MapLibre, a running simulation, replay state, or plugin form state.
 */
export function DigitalTwinWorkspace({
  activeRegionId,
  activeView,
  location,
  mapControllerRef,
  mapSlot,
  onMapPresentationChange,
  onNavigate,
  onOpenRealSettings,
  pluginContentEl,
  regions,
  theme,
}: DigitalTwinWorkspaceProps) {
  const simulationOpenerRef = useRef<HTMLElement | null>(null);
  const restoreFocusFrameRef = useRef<number | null>(null);
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [areaSamples, setAreaSamples] = useState<SimulationAreaSample[]>([]);
  const [scenarioCreationRequest, setScenarioCreationRequest] = useState(0);
  const [runCatalog, setRunCatalog] = useState<DigitalTwinRunCatalog>({
    regions: [],
    runs: [],
  });
  const [runCatalogError, setRunCatalogError] = useState<Error | null>(null);
  const [runCatalogLoading, setRunCatalogLoading] = useState(true);
  const [runCatalogRequest, setRunCatalogRequest] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setRunCatalogLoading(true);
    setRunCatalogError(null);
    void fetchDigitalTwinRunCatalog(defaultDigitalTwinApiUrl(), {
      signal: controller.signal,
    }).then(
      (catalog) => {
        if (controller.signal.aborted) return;
        setRunCatalog(catalog);
        setRunCatalogLoading(false);
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        setRunCatalogError(
          cause instanceof Error ? cause : new Error("Digital Twin runs request failed."),
        );
        setRunCatalogLoading(false);
      },
    );
    return () => controller.abort();
  }, [runCatalogRequest]);

  useEffect(() => {
    const handleAreaSeries = (event: Event) => {
      const detail = (event as CustomEvent<{ samples?: SimulationAreaSample[] }>).detail;
      setAreaSamples(Array.isArray(detail?.samples) ? detail.samples : []);
    };
    window.addEventListener("geolibre:digital-twin-area-series", handleAreaSeries);
    return () => window.removeEventListener("geolibre:digital-twin-area-series", handleAreaSeries);
  }, []);

  useEffect(
    () => () => {
      if (restoreFocusFrameRef.current !== null) {
        window.cancelAnimationFrame(restoreFocusFrameRef.current);
      }
    },
    []
  );

  const openSimulation = useCallback(() => {
    const activeElement = document.activeElement;
    simulationOpenerRef.current =
      activeElement instanceof HTMLElement && activeElement !== document.body
        ? activeElement
        : null;
    setSimulationOpen(true);
  }, []);

  const closeSimulation = useCallback(() => {
    setSimulationOpen(false);
    if (restoreFocusFrameRef.current !== null) {
      window.cancelAnimationFrame(restoreFocusFrameRef.current);
    }
    restoreFocusFrameRef.current = window.requestAnimationFrame(() => {
      const opener = simulationOpenerRef.current;
      if (opener?.isConnected) opener.focus();
      simulationOpenerRef.current = null;
      restoreFocusFrameRef.current = null;
    });
  }, []);

  const launchSimulation = useCallback(
    async (request: ScenarioRunRequest, idempotencyKey: string) => {
      const submission = await submitDigitalTwinScenarioRun(defaultDigitalTwinApiUrl(), {
        regionId: request.regionId,
        durationHours: request.durationHours,
        ignitionPoints: request.ignitionPoints,
        windSpeedMph: request.weather.events.wind,
        windDirectionDegrees: request.weather.events.windDirection,
      }, { idempotencyKey });
      setRunCatalogRequest((current) => current + 1);
      onNavigate("runs", submission.runId);
    },
    [onNavigate],
  );

  return (
    <div className="dt-product-workspace" data-digital-twin-workspace="">
      <div
        aria-hidden={activeView !== "live"}
        className="dt-product-workspace__view"
        data-active={activeView === "live" ? "true" : "false"}
        inert={activeView !== "live"}
      >
        <LiveView
          mapSlot={activeView === "live" ? mapSlot : null}
          onMapPresentationChange={onMapPresentationChange}
          onOpenRuns={() => onNavigate("runs")}
          onOpenSimulation={openSimulation}
        />
      </div>
      <div
        aria-hidden={activeView !== "scenarios"}
        className="dt-product-workspace__view"
        data-active={activeView === "scenarios" ? "true" : "false"}
        inert={activeView !== "scenarios"}
        role={activeView === "scenarios" ? "main" : undefined}
      >
        <ScenariosView
          activeRegionId={activeRegionId}
          creationRequest={scenarioCreationRequest}
          mapControllerRef={mapControllerRef}
          mapSlot={activeView === "scenarios" ? mapSlot : null}
          onBuilderOpenChange={() => undefined}
          onRun={launchSimulation}
          regions={regions}
          theme={theme}
        />
      </div>
      <div
        aria-hidden={activeView !== "runs"}
        className="dt-product-workspace__view"
        data-active={activeView === "runs" ? "true" : "false"}
        inert={activeView !== "runs"}
        role={activeView === "runs" ? "main" : undefined}
      >
        <RunsView
          apiUrl={defaultDigitalTwinApiUrl()}
          error={runCatalogError}
          isLoading={runCatalogLoading}
          location={location}
          mapControllerRef={mapControllerRef}
          mapSlot={activeView === "runs" ? mapSlot : null}
          onCreateScenario={() => {
            setScenarioCreationRequest((request) => request + 1);
            onNavigate("scenarios");
          }}
          onOpenRun={(runId) => onNavigate("runs", runId)}
          onRefresh={() => setRunCatalogRequest((request) => request + 1)}
          onReturnToRuns={() => onNavigate("runs")}
          regions={runCatalog.regions}
          runs={runCatalog.runs}
          theme={theme}
        />
      </div>
      <div
        aria-hidden={activeView !== "settings"}
        className="dt-product-workspace__view"
        data-active={activeView === "settings" ? "true" : "false"}
        inert={activeView !== "settings"}
        role={activeView === "settings" ? "main" : undefined}
      >
        <SettingsView onOpenRealSettings={onOpenRealSettings} />
      </div>

      <SimulationPopover
        anchor={<span aria-hidden="true" className="dt-simulation-popover-anchor" />}
        bodyClassName="h-full"
        contentClassName="dt-simulation-popover"
        onOpenChange={(open) => {
          if (open) setSimulationOpen(true);
          else closeSimulation();
        }}
        open={simulationOpen}
        side="bottom"
        sideOffset={8}
      >
        <div className="dt-simulation-content">
          <PluginContentHost contentEl={pluginContentEl} />
          <SimulationAreaChart samples={areaSamples} />
        </div>
      </SimulationPopover>
    </div>
  );
}
