import { Button } from "@geolibre/ui";
import { PanelRightClose, X } from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  PANEL_RESIZE_END_EVENT,
  PANEL_RESIZE_START_EVENT,
} from "../../../lib/panel-resize";
import type { DigitalTwinView } from "../access";
import { LiveView } from "./LiveView";
import { RunsView } from "./views/RunsView";
import { ScenariosView } from "./views/ScenariosView";
import { SettingsView } from "./views/SettingsView";
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

const SIMULATION_DRAWER_DEFAULT_WIDTH = 420;
const SIMULATION_DRAWER_MIN_WIDTH = 340;
const SIMULATION_DRAWER_MAX_WIDTH = 680;
const DRAWER_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
  const drawerRef = useRef<HTMLElement>(null);
  const simulationOpenerRef = useRef<HTMLElement | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const restoreFocusFrameRef = useRef<number | null>(null);
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [simulationWidth, setSimulationWidth] = useState(
    SIMULATION_DRAWER_DEFAULT_WIDTH
  );

  useEffect(() => {
    window.dispatchEvent(new Event(PANEL_RESIZE_END_EVENT));
  }, [activeView, simulationOpen]);

  useEffect(
    () => () => {
      resizeCleanupRef.current?.();
      if (restoreFocusFrameRef.current !== null) {
        window.cancelAnimationFrame(restoreFocusFrameRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!simulationOpen) return;
    drawerRef.current
      ?.querySelector<HTMLElement>("[data-dt-simulation-close]")
      ?.focus();
  }, [simulationOpen]);

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

  const handleDrawerKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSimulation();
      return;
    }
    if (event.key !== "Tab") return;

    const drawer = drawerRef.current;
    if (!drawer) return;
    const focusableElements = Array.from(
      drawer.querySelectorAll<HTMLElement>(DRAWER_FOCUSABLE_SELECTOR)
    ).filter(
      (element) => !element.closest("[hidden]") && !element.closest("[inert]")
    );
    if (focusableElements.length === 0) {
      event.preventDefault();
      drawer.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  const clampSimulationWidth = (width: number) => {
    const viewportCap = Math.max(
      SIMULATION_DRAWER_MIN_WIDTH,
      Math.min(SIMULATION_DRAWER_MAX_WIDTH, window.innerWidth - 160)
    );
    return clamp(width, SIMULATION_DRAWER_MIN_WIDTH, viewportCap);
  };

  const updateSimulationWidth = (width: number) => {
    const nextWidth = clampSimulationWidth(width);
    drawerRef.current?.style.setProperty(
      "--dt-simulation-drawer-width",
      `${nextWidth}px`
    );
    setSimulationWidth(nextWidth);
  };

  const handleResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    resizeCleanupRef.current?.();

    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startWidth = simulationWidth;
    const direction = getComputedStyle(handle).direction === "rtl" ? -1 : 1;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    let nextWidth = startWidth;
    let finished = false;

    handle.setPointerCapture?.(pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.dispatchEvent(new Event(PANEL_RESIZE_START_EVENT));

    const handleMove = (moveEvent: PointerEvent) => {
      nextWidth = clampSimulationWidth(
        startWidth + direction * (startX - moveEvent.clientX)
      );
      drawerRef.current?.style.setProperty(
        "--dt-simulation-drawer-width",
        `${nextWidth}px`
      );
    };

    const finishResize = (commit: boolean) => {
      if (finished) return;
      finished = true;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleCancel);
      try {
        if (handle.hasPointerCapture?.(pointerId)) {
          handle.releasePointerCapture?.(pointerId);
        }
      } catch {
        // Pointer capture may already be released after an OS-level cancel.
      }
      if (commit) setSimulationWidth(nextWidth);
      else {
        drawerRef.current?.style.setProperty(
          "--dt-simulation-drawer-width",
          `${startWidth}px`
        );
      }
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      resizeCleanupRef.current = null;
      window.dispatchEvent(new Event(PANEL_RESIZE_END_EVENT));
    };

    function handleEnd() {
      finishResize(true);
    }

    function handleCancel() {
      finishResize(false);
    }

    resizeCleanupRef.current = handleCancel;
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd);
    window.addEventListener("pointercancel", handleCancel);
  };

  return (
    <div className="dt-product-workspace" data-digital-twin-workspace="">
      <div
        aria-hidden={activeView !== "live" || simulationOpen}
        className="dt-product-workspace__view"
        data-active={activeView === "live" ? "true" : "false"}
        inert={activeView !== "live" || simulationOpen}
      >
        <LiveView
          mapSlot={mapSlot}
          onMapPresentationChange={onMapPresentationChange}
          onOpenRuns={() => onNavigate("runs")}
          onOpenSimulation={openSimulation}
        />
      </div>
      <div
        aria-hidden={activeView !== "scenarios" || simulationOpen}
        className="dt-product-workspace__view"
        data-active={activeView === "scenarios" ? "true" : "false"}
        inert={activeView !== "scenarios" || simulationOpen}
        role={
          activeView === "scenarios" && !simulationOpen ? "main" : undefined
        }
      >
        <ScenariosView
          onNavigateLive={() => onNavigate("live")}
          onOpenSimulation={openSimulation}
        />
      </div>
      <div
        aria-hidden={activeView !== "runs" || simulationOpen}
        className="dt-product-workspace__view"
        data-active={activeView === "runs" ? "true" : "false"}
        inert={activeView !== "runs" || simulationOpen}
        role={activeView === "runs" && !simulationOpen ? "main" : undefined}
      >
        <RunsView
          onNavigateLive={() => onNavigate("live")}
          onOpenSimulation={openSimulation}
        />
      </div>
      <div
        aria-hidden={activeView !== "settings" || simulationOpen}
        className="dt-product-workspace__view"
        data-active={activeView === "settings" ? "true" : "false"}
        inert={activeView !== "settings" || simulationOpen}
        role={activeView === "settings" && !simulationOpen ? "main" : undefined}
      >
        <SettingsView onOpenRealSettings={onOpenRealSettings} />
      </div>

      <aside
        ref={drawerRef}
        aria-hidden={!simulationOpen}
        aria-label="Simulation workspace"
        aria-modal={simulationOpen || undefined}
        className="dt-simulation-drawer"
        data-open={simulationOpen ? "true" : "false"}
        inert={!simulationOpen}
        onKeyDown={handleDrawerKeyDown}
        role="dialog"
        style={
          {
            "--dt-simulation-drawer-width": `${simulationWidth}px`,
          } as CSSProperties
        }
        tabIndex={-1}
      >
        <div
          aria-label="Resize simulation workspace"
          aria-orientation="vertical"
          aria-valuemax={SIMULATION_DRAWER_MAX_WIDTH}
          aria-valuemin={SIMULATION_DRAWER_MIN_WIDTH}
          aria-valuenow={simulationWidth}
          className="dt-simulation-drawer__resize"
          onKeyDown={(event) => {
            const step = event.shiftKey ? 40 : 10;
            const direction =
              getComputedStyle(event.currentTarget).direction === "rtl"
                ? -1
                : 1;
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              updateSimulationWidth(simulationWidth + direction * step);
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              updateSimulationWidth(simulationWidth - direction * step);
            } else if (event.key === "Home") {
              event.preventDefault();
              updateSimulationWidth(SIMULATION_DRAWER_MIN_WIDTH);
            } else if (event.key === "End") {
              event.preventDefault();
              updateSimulationWidth(SIMULATION_DRAWER_MAX_WIDTH);
            }
          }}
          onPointerDown={handleResizeStart}
          role="separator"
          tabIndex={0}
        />
        <header className="dt-simulation-drawer__header">
          <span className="dt-simulation-drawer__title">
            <PanelRightClose aria-hidden="true" />
            Simulation workspace
          </span>
          <Button
            aria-label="Close simulation workspace"
            data-dt-simulation-close=""
            onClick={closeSimulation}
            size="icon"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </header>
        <PluginContentHost contentEl={pluginContentEl} />
      </aside>
    </div>
  );
}
