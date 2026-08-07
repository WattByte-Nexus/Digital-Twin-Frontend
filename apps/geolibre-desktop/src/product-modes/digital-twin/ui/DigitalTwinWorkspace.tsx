import { SimulationPopover } from "@geolibre/ui";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { DigitalTwinView } from "../access";
import { LiveView } from "./LiveView";
import { RunsView } from "./views/RunsView";
import { ScenariosView } from "./views/ScenariosView";
import { SettingsView } from "./views/SettingsView";
import { SimulationAreaChart, type SimulationAreaSample } from "./SimulationAreaChart";
import "./digital-twin-workspace.css";

export type DigitalTwinWorkspaceView = DigitalTwinView | "settings";

interface DigitalTwinWorkspaceProps {
  activeView: DigitalTwinWorkspaceView;
  mapSlot: ReactNode;
  onMapPresentationChange: (mode: "3d" | "plan") => void;
  onNavigate: (view: DigitalTwinView) => void;
  onOpenRealSettings: () => void;
  pluginContentEl: HTMLElement;
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
  activeView,
  mapSlot,
  onMapPresentationChange,
  onNavigate,
  onOpenRealSettings,
  pluginContentEl,
}: DigitalTwinWorkspaceProps) {
  const simulationOpenerRef = useRef<HTMLElement | null>(null);
  const restoreFocusFrameRef = useRef<number | null>(null);
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [areaSamples, setAreaSamples] = useState<SimulationAreaSample[]>([]);

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

  return (
    <div className="dt-product-workspace" data-digital-twin-workspace="">
      <div
        aria-hidden={activeView !== "live"}
        className="dt-product-workspace__view"
        data-active={activeView === "live" ? "true" : "false"}
        inert={activeView !== "live"}
      >
        <LiveView
          mapSlot={mapSlot}
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
          onNavigateLive={() => onNavigate("live")}
          onOpenSimulation={openSimulation}
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
          onNavigateLive={() => onNavigate("live")}
          onOpenSimulation={openSimulation}
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
