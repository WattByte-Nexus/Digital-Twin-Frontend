import {
  Activity,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Filter,
  Leaf,
  MapPin,
  Play,
  ShieldCheck,
  UserPlus,
  Wind,
  Zap,
} from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  PANEL_RESIZE_END_EVENT,
  PANEL_RESIZE_START_EVENT,
} from "../../../lib/panel-resize";
import "./live-view.css";
import {
  DIGITAL_TWIN_MAP_ASSET_SELECTION_EVENT,
  type DigitalTwinMapAssetKind,
  isDigitalTwinMapAssetKind,
} from "./map-asset-selection";

type PaneSide = "left" | "right";
type AlertStatus = "New" | "Acknowledged" | "Investigating";
type AlertSeverity = "High" | "Medium" | "Low";
type AlertFilter = "all" | AlertStatus;
type SeverityFilter = "all" | AlertSeverity;
type DetailTab = "summary" | "evidence" | "asset";
type EvidenceFocus = "overview" | "weather" | "confidence" | "driver";

interface AlertActivityItem {
  id: string;
  time: string;
  label: string;
}

interface AlertItem {
  id: string;
  kind: string;
  title: string;
  asset: string;
  severity: AlertSeverity;
  status: AlertStatus;
  time: string;
  risk: number;
  clearance: string;
  structures: number;
  weather: string;
  weatherAge: string;
  confidence: number;
  driver: string;
}

export interface LiveViewProps {
  /** The real map surface. It remains in one stable slot while the surrounding panes resize. */
  mapSlot: ReactNode;
  /** Opens the shell-owned, persistent simulation drawer. */
  onOpenSimulation: () => void;
  /** Opens the real runs surface when a replay has not been chosen yet. */
  onOpenRuns: () => void;
  /** Applies the visual 3D/Plan choice to the persistent MapLibre instance. */
  onMapPresentationChange?: (mode: "3d" | "plan") => void;
}

const LEFT_PANE_DEFAULT_WIDTH = 378;
const RIGHT_PANE_DEFAULT_WIDTH = 380;
const LEFT_PANE_MIN_WIDTH = 280;
const RIGHT_PANE_MIN_WIDTH = 300;
const PANE_MAX_WIDTH = 640;
const COLLAPSED_PANE_WIDTH = 48;
const MIN_MAP_WIDTH = 360;
const REFERENCE_CONTENT_WIDTH = 1578;
const RESIZE_STEP = 8;

const INITIAL_ALERTS: AlertItem[] = [
  {
    id: "vegetation-clearance",
    kind: "Engine alert",
    title: "Vegetation clearance risk",
    asset: "Circuit FRN-12  ·  Segment 14",
    severity: "High",
    status: "New",
    time: "10:12 AM",
    risk: 82,
    clearance: "6.2 ft",
    structures: 6,
    weather: "15 mph East",
    weatherAge: "6 min",
    confidence: 92,
    driver: "Vegetation clearance",
  },
  {
    id: "wind-risk",
    kind: "Engine alert",
    title: "Wind-driven risk increase",
    asset: "Circuit FRN-07  ·  Segment 8",
    severity: "Medium",
    status: "New",
    time: "10:08 AM",
    risk: 67,
    clearance: "8.1 ft",
    structures: 4,
    weather: "22 mph East",
    weatherAge: "6 min",
    confidence: 88,
    driver: "Wind exposure",
  },
  {
    id: "dry-fuel",
    kind: "Engine alert",
    title: "Dry fuel moisture low",
    asset: "Circuit FRN-03  ·  Segment 27",
    severity: "Medium",
    status: "Acknowledged",
    time: "9:56 AM",
    risk: 61,
    clearance: "9.4 ft",
    structures: 3,
    weather: "11 mph East",
    weatherAge: "8 min",
    confidence: 89,
    driver: "Dry fuel moisture",
  },
  {
    id: "conductor-temperature",
    kind: "Engine alert",
    title: "Conductor temperature high",
    asset: "Circuit FRN-11  ·  Segment 5",
    severity: "Low",
    status: "Investigating",
    time: "9:42 AM",
    risk: 38,
    clearance: "12.8 ft",
    structures: 2,
    weather: "9 mph East",
    weatherAge: "10 min",
    confidence: 94,
    driver: "Conductor loading",
  },
  {
    id: "weather-delay",
    kind: "Engine alert",
    title: "Weather feed delayed",
    asset: "Boulder Foothills",
    severity: "Medium",
    status: "New",
    time: "9:35 AM",
    risk: 54,
    clearance: "—",
    structures: 0,
    weather: "Data delayed",
    weatherAge: "18 min",
    confidence: 73,
    driver: "Weather freshness",
  },
  {
    id: "pole-loading",
    kind: "Engine alert",
    title: "Pole loading threshold",
    asset: "Circuit FRN-09  ·  Structure 42",
    severity: "High",
    status: "Acknowledged",
    time: "9:21 AM",
    risk: 78,
    clearance: "7.3 ft",
    structures: 1,
    weather: "17 mph East",
    weatherAge: "6 min",
    confidence: 91,
    driver: "Structural loading",
  },
  {
    id: "sensor-drift",
    kind: "Engine alert",
    title: "Sensor confidence drift",
    asset: "Circuit FRN-04  ·  Segment 3",
    severity: "Low",
    status: "Investigating",
    time: "9:04 AM",
    risk: 31,
    clearance: "11.6 ft",
    structures: 2,
    weather: "12 mph East",
    weatherAge: "7 min",
    confidence: 76,
    driver: "Sensor confidence",
  },
];

const ALERT_FILTERS: ReadonlyArray<{ id: AlertFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "New", label: "New" },
  { id: "Acknowledged", label: "Acknowledged" },
  { id: "Investigating", label: "Investigating" },
];

const DETAIL_TABS: ReadonlyArray<{ id: DetailTab; label: string }> = [
  { id: "summary", label: "Summary" },
  { id: "evidence", label: "Evidence" },
  { id: "asset", label: "Asset" },
];

const INITIAL_ACTIVITY: ReadonlyArray<AlertActivityItem> = [
  { id: "created", time: "10:12", label: "Alert created" },
  { id: "assigned", time: "10:13", label: "Assigned to A. Chen" },
];

function initialActivityForAlert(alert: AlertItem): AlertActivityItem[] {
  if (alert.id === INITIAL_ALERTS[0].id) return [...INITIAL_ACTIVITY];
  return [
    {
      id: `${alert.id}-created`,
      time: alert.time.replace(/\s(?:AM|PM)$/, ""),
      label: "Alert created",
    },
  ];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function severityCount(alerts: AlertItem[], filter: AlertFilter): number {
  return filter === "all"
    ? alerts.length
    : alerts.filter((alert) => alert.status === filter).length;
}

function currentActivityTime(): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
  }).format(new Date());
}

export function LiveView({
  mapSlot,
  onOpenRuns,
  onOpenSimulation,
  onMapPresentationChange,
}: LiveViewProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const activeResizeCleanupRef = useRef<(() => void) | null>(null);
  const queuePaneId = useId();
  const detailsPaneId = useId();
  const detailsTabPanelId = useId();

  const [alerts, setAlerts] = useState<AlertItem[]>(() =>
    INITIAL_ALERTS.map((alert) => ({ ...alert }))
  );
  const [selectedAlertId, setSelectedAlertId] = useState(INITIAL_ALERTS[0].id);
  const [alertFilter, setAlertFilter] = useState<AlertFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("summary");
  const [evidenceFocus, setEvidenceFocus] = useState<EvidenceFocus>("overview");
  const [leftWidth, setLeftWidth] = useState(LEFT_PANE_DEFAULT_WIDTH);
  const [rightWidth, setRightWidth] = useState(RIGHT_PANE_DEFAULT_WIDTH);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [mapMode, setMapMode] = useState<"3d" | "plan">("3d");
  const [selectedMapAssetKind, setSelectedMapAssetKind] =
    useState<DigitalTwinMapAssetKind | null>(null);
  const [activityByAlert, setActivityByAlert] = useState<
    Record<string, AlertActivityItem[]>
  >(() => ({ [INITIAL_ALERTS[0].id]: [...INITIAL_ACTIVITY] }));

  const selectedAlert =
    alerts.find((alert) => alert.id === selectedAlertId) ??
    alerts[0] ??
    INITIAL_ALERTS[0];

  const visibleAlerts = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          (alertFilter === "all" || alert.status === alertFilter) &&
          (severityFilter === "all" || alert.severity === severityFilter)
      ),
    [alertFilter, alerts, severityFilter]
  );

  const getPaneBounds = useCallback(
    (pane: PaneSide) => {
      const rootWidth = rootRef.current?.clientWidth ?? REFERENCE_CONTENT_WIDTH;
      const oppositeWidth =
        pane === "left"
          ? rightCollapsed
            ? COLLAPSED_PANE_WIDTH
            : rightWidth
          : leftCollapsed
          ? COLLAPSED_PANE_WIDTH
          : leftWidth;
      const min = pane === "left" ? LEFT_PANE_MIN_WIDTH : RIGHT_PANE_MIN_WIDTH;
      const max = Math.max(
        min,
        Math.min(PANE_MAX_WIDTH, rootWidth - oppositeWidth - MIN_MAP_WIDTH)
      );
      return { min, max };
    },
    [leftCollapsed, leftWidth, rightCollapsed, rightWidth]
  );

  const applyPaneWidth = useCallback(
    (pane: PaneSide, width: number) => {
      const bounds = getPaneBounds(pane);
      const nextWidth = clamp(width, bounds.min, bounds.max);
      const property =
        pane === "left" ? "--dt-live-left-width" : "--dt-live-right-width";
      rootRef.current?.style.setProperty(property, `${nextWidth}px`);
      if (pane === "left") setLeftWidth(nextWidth);
      else setRightWidth(nextWidth);
      return nextWidth;
    },
    [getPaneBounds]
  );

  const startPaneResize = useCallback(
    (pane: PaneSide, event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      activeResizeCleanupRef.current?.();

      const handle = event.currentTarget;
      const pointerId = event.pointerId;
      handle.setPointerCapture?.(pointerId);
      const startX = event.clientX;
      const startWidth = pane === "left" ? leftWidth : rightWidth;
      const directionSign =
        getComputedStyle(handle).direction === "rtl" ? -1 : 1;
      const { min, max } = getPaneBounds(pane);
      const property =
        pane === "left" ? "--dt-live-left-width" : "--dt-live-right-width";
      let nextWidth = startWidth;
      let resizeFrame: number | null = null;
      let finished = false;
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.dispatchEvent(new Event(PANEL_RESIZE_START_EVENT));

      const applyPendingWidth = () => {
        resizeFrame = null;
        rootRef.current?.style.setProperty(property, `${nextWidth}px`);
      };

      const handleMove = (moveEvent: PointerEvent) => {
        const physicalDelta = moveEvent.clientX - startX;
        const paneDelta =
          pane === "left"
            ? directionSign * physicalDelta
            : -directionSign * physicalDelta;
        nextWidth = clamp(startWidth + paneDelta, min, max);
        if (resizeFrame === null) {
          resizeFrame = window.requestAnimationFrame(applyPendingWidth);
        }
      };

      const finishResize = (commit: boolean) => {
        if (finished) return;
        finished = true;
        handle.removeEventListener("pointermove", handleMove);
        handle.removeEventListener("pointerup", handleEnd);
        handle.removeEventListener("pointercancel", handleEnd);
        if (resizeFrame !== null) {
          window.cancelAnimationFrame(resizeFrame);
          resizeFrame = null;
        }
        rootRef.current?.style.setProperty(property, `${nextWidth}px`);
        if (commit) {
          if (pane === "left") setLeftWidth(nextWidth);
          else setRightWidth(nextWidth);
        }
        try {
          if (handle.hasPointerCapture?.(pointerId))
            handle.releasePointerCapture?.(pointerId);
        } catch {
          // Pointer capture can already be gone after an OS-level cancellation.
        }
        activeResizeCleanupRef.current = null;
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        window.dispatchEvent(new Event(PANEL_RESIZE_END_EVENT));
      };

      function handleEnd() {
        finishResize(true);
      }

      activeResizeCleanupRef.current = () => finishResize(false);
      handle.addEventListener("pointermove", handleMove);
      handle.addEventListener("pointerup", handleEnd);
      handle.addEventListener("pointercancel", handleEnd);
    },
    [getPaneBounds, leftWidth, rightWidth]
  );

  const handleSeparatorKeyDown = useCallback(
    (pane: PaneSide, event: ReactKeyboardEvent<HTMLDivElement>) => {
      const currentWidth = pane === "left" ? leftWidth : rightWidth;
      const { min, max } = getPaneBounds(pane);
      let nextWidth: number | null = null;

      if (event.key === "Home") nextWidth = min;
      else if (event.key === "End") nextWidth = max;
      else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const physicalDirection = event.key === "ArrowRight" ? 1 : -1;
        const directionSign =
          getComputedStyle(event.currentTarget).direction === "rtl" ? -1 : 1;
        const step = event.shiftKey ? RESIZE_STEP * 4 : RESIZE_STEP;
        const paneDirection = pane === "left" ? directionSign : -directionSign;
        nextWidth = currentWidth + physicalDirection * paneDirection * step;
      }

      if (nextWidth === null) return;
      event.preventDefault();
      window.dispatchEvent(new Event(PANEL_RESIZE_START_EVENT));
      applyPaneWidth(pane, nextWidth);
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new Event(PANEL_RESIZE_END_EVENT));
      });
    },
    [applyPaneWidth, getPaneBounds, leftWidth, rightWidth]
  );

  const setPaneCollapsed = useCallback((pane: PaneSide, collapsed: boolean) => {
    window.dispatchEvent(new Event(PANEL_RESIZE_START_EVENT));
    if (pane === "left") setLeftCollapsed(collapsed);
    else setRightCollapsed(collapsed);
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event(PANEL_RESIZE_END_EVENT));
    });
  }, []);

  useEffect(
    () => () => {
      activeResizeCleanupRef.current?.();
    },
    []
  );

  useEffect(() => {
    setEvidenceFocus("overview");
  }, [selectedAlertId]);

  useEffect(() => {
    const handleMapAssetSelection = (event: Event) => {
      const kind = (event as CustomEvent<{ kind?: unknown }>).detail?.kind;
      setSelectedMapAssetKind(isDigitalTwinMapAssetKind(kind) ? kind : null);
    };

    window.addEventListener(
      DIGITAL_TWIN_MAP_ASSET_SELECTION_EVENT,
      handleMapAssetSelection
    );
    return () => {
      window.removeEventListener(
        DIGITAL_TWIN_MAP_ASSET_SELECTION_EVENT,
        handleMapAssetSelection
      );
    };
  }, []);

  useEffect(() => {
    onMapPresentationChange?.(mapMode);
  }, [mapMode, onMapPresentationChange]);

  const recordActivity = (id: string, label: string) => {
    setActivityByAlert((current) => {
      const alert = alerts.find((item) => item.id === id) ?? INITIAL_ALERTS[0];
      const activity = current[id] ?? initialActivityForAlert(alert);
      if (activity.some((item) => item.label === label)) return current;
      return {
        ...current,
        [id]: [
          ...activity,
          { id: `${id}-${label}`, time: currentActivityTime(), label },
        ],
      };
    });
  };

  const updateSelectedStatus = (
    status: AlertStatus,
    activityLabel?: string
  ) => {
    setAlerts((currentAlerts) =>
      currentAlerts.map((alert) =>
        alert.id === selectedAlert.id ? { ...alert, status } : alert
      )
    );
    if (activityLabel) recordActivity(selectedAlert.id, activityLabel);
  };

  const startInvestigation = () => {
    updateSelectedStatus("Investigating", "Investigation started");
    onOpenSimulation();
  };

  const openEvidence = (focus: EvidenceFocus = "overview") => {
    setEvidenceFocus(focus);
    setDetailTab("evidence");
  };

  const selectedActivity =
    activityByAlert[selectedAlert.id] ?? initialActivityForAlert(selectedAlert);
  const handoffCreated = selectedActivity.some(
    (item) => item.label === "Handoff created"
  );

  const layoutStyle = {
    "--dt-live-left-width": `${
      leftCollapsed ? COLLAPSED_PANE_WIDTH : leftWidth
    }px`,
    "--dt-live-right-width": `${
      rightCollapsed ? COLLAPSED_PANE_WIDTH : rightWidth
    }px`,
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      className="dt-live-view"
      style={layoutStyle}
      data-testid="digital-twin-live-view"
    >
      <aside
        id={queuePaneId}
        className="dt-live-view__queue dt-live-view__glass"
        data-collapsed={leftCollapsed}
        aria-label="Alert queue"
      >
        <div
          className="dt-live-view__collapsed-pane"
          aria-hidden={!leftCollapsed}
        >
          <button
            type="button"
            className="dt-live-view__icon-button"
            aria-label="Expand alert queue"
            onClick={() => setPaneCollapsed("left", false)}
          >
            <ChevronsRight aria-hidden="true" />
          </button>
          <span>Alerts</span>
          <strong>{alerts.length}</strong>
        </div>

        <div className="dt-live-view__pane-content" aria-hidden={leftCollapsed}>
          <header className="dt-live-view__pane-header">
            <h2>Alert queue</h2>
            <div className="dt-live-view__pane-header-actions">
              <button
                type="button"
                className="dt-live-view__icon-button"
                aria-label="Filter alerts"
                aria-expanded={filterOpen}
                onClick={() => setFilterOpen((open) => !open)}
              >
                <Filter aria-hidden="true" />
              </button>
              <button
                type="button"
                className="dt-live-view__icon-button"
                aria-label="Collapse alert queue"
                onClick={() => setPaneCollapsed("left", true)}
              >
                <ChevronsLeft aria-hidden="true" />
              </button>
            </div>
            <div className="dt-live-view__filter-menu" data-open={filterOpen}>
              <span>Severity</span>
              {(["all", "High", "Medium", "Low"] as const).map((severity) => (
                <button
                  key={severity}
                  type="button"
                  data-active={severityFilter === severity}
                  onClick={() => {
                    setSeverityFilter(severity);
                    setFilterOpen(false);
                  }}
                >
                  {severity === "all" ? "All severities" : severity}
                </button>
              ))}
            </div>
          </header>

          <div
            className="dt-live-view__queue-tabs"
            role="tablist"
            aria-label="Alert status"
          >
            {ALERT_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={alertFilter === filter.id}
                data-active={alertFilter === filter.id}
                onClick={() => setAlertFilter(filter.id)}
              >
                {filter.label} <span>{severityCount(alerts, filter.id)}</span>
              </button>
            ))}
          </div>

          <div className="dt-live-view__alert-list" role="list">
            {visibleAlerts.map((alert) => (
              <button
                key={alert.id}
                type="button"
                role="listitem"
                className="dt-live-view__alert-card"
                data-severity={alert.severity.toLowerCase()}
                data-selected={alert.id === selectedAlert.id}
                aria-pressed={alert.id === selectedAlert.id}
                onClick={() => {
                  setSelectedAlertId(alert.id);
                  setDetailTab("summary");
                }}
              >
                <span
                  className="dt-live-view__severity-rail"
                  aria-hidden="true"
                />
                <span className="dt-live-view__alert-kind">{alert.kind}</span>
                <strong>{alert.title}</strong>
                <span className="dt-live-view__alert-asset">{alert.asset}</span>
                <span className="dt-live-view__alert-severity">
                  {alert.severity} <i aria-hidden="true" />
                </span>
                <span className="dt-live-view__alert-time">{alert.time}</span>
                <span className="dt-live-view__status-chip">
                  {alert.status}
                </span>
              </button>
            ))}
            {visibleAlerts.length === 0 ? (
              <p className="dt-live-view__empty-state">
                No alerts match these filters.
              </p>
            ) : null}
          </div>

          <footer className="dt-live-view__queue-actions">
            <span>Selected alert</span>
            <button
              type="button"
              className="dt-live-view__primary-button"
              disabled={selectedAlert.status === "Acknowledged"}
              onClick={() =>
                updateSelectedStatus("Acknowledged", "Acknowledged by A. Chen")
              }
            >
              {selectedAlert.status === "Acknowledged"
                ? "Acknowledged"
                : "Acknowledge"}
            </button>
            <button
              type="button"
              className="dt-live-view__secondary-button"
              onClick={startInvestigation}
            >
              Start investigation
            </button>
            <button
              type="button"
              className="dt-live-view__handoff-button"
              onClick={() =>
                recordActivity(selectedAlert.id, "Handoff created")
              }
            >
              <UserPlus aria-hidden="true" />
              {handoffCreated ? "Handoff created" : "Create handoff"}
            </button>
          </footer>
        </div>

        {!leftCollapsed ? (
          <div
            role="separator"
            tabIndex={0}
            aria-label="Resize alert queue"
            aria-orientation="vertical"
            aria-controls={queuePaneId}
            aria-valuemin={getPaneBounds("left").min}
            aria-valuemax={getPaneBounds("left").max}
            aria-valuenow={leftWidth}
            aria-valuetext={`${leftWidth} pixels`}
            className="dt-live-view__resize-handle dt-live-view__resize-handle--left"
            onPointerDown={(event) => startPaneResize("left", event)}
            onKeyDown={(event) => handleSeparatorKeyDown("left", event)}
          />
        ) : null}
      </aside>

      <section className="dt-live-view__map" aria-label="Digital twin live map">
        <div className="dt-live-view__map-slot">{mapSlot}</div>

        <div
          className="dt-live-view__map-overlay"
          aria-label="Map context controls"
        >
          <div className="dt-live-view__circuit-context">
            <Zap aria-hidden="true" />
            <span>{selectedAlert.asset}</span>
          </div>

          <div
            className="dt-live-view__map-mode"
            role="group"
            aria-label="Map mode"
          >
            <button
              type="button"
              data-active={mapMode === "3d"}
              aria-pressed={mapMode === "3d"}
              onClick={() => setMapMode("3d")}
            >
              3D
            </button>
            <button
              type="button"
              data-active={mapMode === "plan"}
              aria-pressed={mapMode === "plan"}
              onClick={() => setMapMode("plan")}
            >
              Plan
            </button>
          </div>

          {selectedMapAssetKind ? (
            <div className="dt-live-view__risk-callout">
              <MapPin aria-hidden="true" />
              <div>
                <strong>{selectedAlert.title}</strong>
                <span>
                  {selectedAlert.severity} · {selectedAlert.risk}
                </span>
                <small>Clearance {selectedAlert.clearance}</small>
              </div>
            </div>
          ) : null}

          <div className="dt-live-view__exposure-legend">
            <span>Exposure</span>
            <div aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <small>
              <span>Low</span>
              <span>High</span>
            </small>
          </div>
        </div>
      </section>

      <section
        aria-label="Simulation replay"
        className="dt-live-view__replay-empty dt-live-view__glass"
      >
        <div className="dt-live-view__replay-empty-heading">
          <strong>Replay</strong>
          <span>No completed run selected</span>
          <button type="button" onClick={onOpenRuns}>
            Choose run
          </button>
        </div>
        <div className="dt-live-view__replay-empty-body">
          <button aria-label="Replay unavailable" disabled type="button">
            <Play aria-hidden="true" />
          </button>
          <div aria-hidden="true">
            <i />
          </div>
          <span>
            <i aria-hidden="true" /> Live data
          </span>
        </div>
      </section>

      <aside
        id={detailsPaneId}
        className="dt-live-view__details dt-live-view__glass"
        data-collapsed={rightCollapsed}
        aria-label="Alert details"
      >
        <div
          className="dt-live-view__collapsed-pane"
          aria-hidden={!rightCollapsed}
        >
          <button
            type="button"
            className="dt-live-view__icon-button"
            aria-label="Expand alert details"
            onClick={() => setPaneCollapsed("right", false)}
          >
            <ChevronsLeft aria-hidden="true" />
          </button>
          <span>Details</span>
        </div>

        <div
          className="dt-live-view__pane-content"
          aria-hidden={rightCollapsed}
        >
          <header className="dt-live-view__pane-header dt-live-view__details-header">
            <h2>Alert details</h2>
            <span className="dt-live-view__evidence-chip">Evidence ready</span>
            <button
              type="button"
              className="dt-live-view__icon-button"
              aria-label="Collapse alert details"
              onClick={() => setPaneCollapsed("right", true)}
            >
              <ChevronsRight aria-hidden="true" />
            </button>
          </header>

          <div
            className="dt-live-view__detail-tabs"
            role="tablist"
            aria-label="Alert details"
          >
            {DETAIL_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={detailTab === tab.id}
                aria-controls={detailsTabPanelId}
                data-active={detailTab === tab.id}
                onClick={() => {
                  if (tab.id === "evidence") setEvidenceFocus("overview");
                  setDetailTab(tab.id);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div
            id={detailsTabPanelId}
            className="dt-live-view__detail-scroll"
            role="tabpanel"
          >
            {detailTab === "summary" ? (
              <div className="dt-live-view__summary-panel">
                <section className="dt-live-view__risk-summary">
                  <div>
                    <strong>{selectedAlert.risk}</strong>
                    <span>/ 100</span>
                  </div>
                  <p>{selectedAlert.severity} exposure</p>
                  <div
                    className="dt-live-view__exposure-scale"
                    role="meter"
                    aria-label="Exposure score"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={selectedAlert.risk}
                    aria-valuetext={`${
                      selectedAlert.risk
                    } out of 100, ${selectedAlert.severity.toLowerCase()} exposure`}
                  >
                    <i />
                    <i />
                    <i />
                    <b
                      style={{
                        insetInlineStart: `calc(${selectedAlert.risk}% - 11px)`,
                      }}
                    />
                  </div>
                </section>

                <div className="dt-live-view__detail-facts">
                  <button
                    type="button"
                    aria-label={`Open affected asset details for ${selectedAlert.asset}`}
                    onClick={() => setDetailTab("asset")}
                  >
                    <Zap aria-hidden="true" />
                    <div>
                      <strong>Affected asset</strong>
                      <span>{selectedAlert.asset}</span>
                      <span>
                        {selectedAlert.structures} structures · Clearance{" "}
                        {selectedAlert.clearance}
                      </span>
                    </div>
                    <ChevronRight aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Open weather evidence, ${selectedAlert.weather}`}
                    onClick={() => openEvidence("weather")}
                  >
                    <Wind aria-hidden="true" />
                    <div>
                      <strong>Weather</strong>
                      <span>{selectedAlert.weather}</span>
                      <span>Data fresh · {selectedAlert.weatherAge}</span>
                    </div>
                    <ChevronRight aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Open model confidence evidence, ${selectedAlert.confidence} percent`}
                    onClick={() => openEvidence("confidence")}
                  >
                    <ShieldCheck aria-hidden="true" />
                    <div>
                      <strong>Model confidence</strong>
                      <span>{selectedAlert.confidence}%</span>
                    </div>
                    <ChevronRight aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Open primary driver evidence, ${selectedAlert.driver}`}
                    onClick={() => openEvidence("driver")}
                  >
                    <Leaf aria-hidden="true" />
                    <div>
                      <strong>Primary driver</strong>
                      <span>{selectedAlert.driver}</span>
                    </div>
                    <ChevronRight aria-hidden="true" />
                  </button>
                </div>

                <section className="dt-live-view__activity">
                  <h3>
                    <Activity aria-hidden="true" /> Activity
                  </h3>
                  {selectedActivity.map((item) => (
                    <p key={item.id}>
                      <time>{item.time}</time>
                      <span>{item.label}</span>
                    </p>
                  ))}
                </section>
              </div>
            ) : detailTab === "evidence" ? (
              <div className="dt-live-view__secondary-tab-panel">
                {evidenceFocus === "weather" ? (
                  <>
                    <Wind aria-hidden="true" />
                    <h3>Weather conditions</h3>
                    <p>
                      Current observations used to assess exposure for this
                      alert.
                    </p>
                    <dl>
                      <div>
                        <dt>Wind</dt>
                        <dd>{selectedAlert.weather}</dd>
                      </div>
                      <div>
                        <dt>Freshness</dt>
                        <dd>{selectedAlert.weatherAge}</dd>
                      </div>
                      <div>
                        <dt>Region</dt>
                        <dd>Boulder Foothills</dd>
                      </div>
                    </dl>
                  </>
                ) : evidenceFocus === "confidence" ? (
                  <>
                    <ShieldCheck aria-hidden="true" />
                    <h3>Model confidence</h3>
                    <p>
                      The current assessment is supported by recent inputs and
                      corridor evidence.
                    </p>
                    <dl>
                      <div>
                        <dt>Confidence</dt>
                        <dd>{selectedAlert.confidence}%</dd>
                      </div>
                      <div>
                        <dt>Exposure score</dt>
                        <dd>{selectedAlert.risk} / 100</dd>
                      </div>
                      <div>
                        <dt>Evidence status</dt>
                        <dd>Ready</dd>
                      </div>
                    </dl>
                  </>
                ) : evidenceFocus === "driver" ? (
                  <>
                    <Leaf aria-hidden="true" />
                    <h3>Primary driver</h3>
                    <p>
                      The strongest contributing signal behind this exposure
                      score.
                    </p>
                    <dl>
                      <div>
                        <dt>Driver</dt>
                        <dd>{selectedAlert.driver}</dd>
                      </div>
                      <div>
                        <dt>Clearance</dt>
                        <dd>{selectedAlert.clearance}</dd>
                      </div>
                      <div>
                        <dt>Affected structures</dt>
                        <dd>{selectedAlert.structures}</dd>
                      </div>
                    </dl>
                  </>
                ) : (
                  <>
                    <Eye aria-hidden="true" />
                    <h3>Evidence package ready</h3>
                    <p>
                      Model output, weather inputs, and the affected corridor
                      are available for review.
                    </p>
                    <dl>
                      <div>
                        <dt>Captured</dt>
                        <dd>10:12 AM MDT</dd>
                      </div>
                      <div>
                        <dt>Confidence</dt>
                        <dd>{selectedAlert.confidence}%</dd>
                      </div>
                      <div>
                        <dt>Region</dt>
                        <dd>Boulder Foothills</dd>
                      </div>
                    </dl>
                  </>
                )}
              </div>
            ) : (
              <div className="dt-live-view__secondary-tab-panel">
                <Zap aria-hidden="true" />
                <h3>{selectedAlert.asset}</h3>
                <p>
                  The selected alert is linked to the active network asset shown
                  on the live map.
                </p>
                <dl>
                  <div>
                    <dt>Clearance</dt>
                    <dd>{selectedAlert.clearance}</dd>
                  </div>
                  <div>
                    <dt>Structures</dt>
                    <dd>{selectedAlert.structures}</dd>
                  </div>
                  <div>
                    <dt>Primary driver</dt>
                    <dd>{selectedAlert.driver}</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>

          <footer className="dt-live-view__detail-actions">
            <button
              type="button"
              className="dt-live-view__secondary-button"
              onClick={() => openEvidence()}
            >
              View evidence
            </button>
            <button
              type="button"
              className="dt-live-view__primary-button"
              onClick={startInvestigation}
            >
              Investigate
            </button>
          </footer>
        </div>

        {!rightCollapsed ? (
          <div
            role="separator"
            tabIndex={0}
            aria-label="Resize alert details"
            aria-orientation="vertical"
            aria-controls={detailsPaneId}
            aria-valuemin={getPaneBounds("right").min}
            aria-valuemax={getPaneBounds("right").max}
            aria-valuenow={rightWidth}
            aria-valuetext={`${rightWidth} pixels`}
            className="dt-live-view__resize-handle dt-live-view__resize-handle--right"
            onPointerDown={(event) => startPaneResize("right", event)}
            onKeyDown={(event) => handleSeparatorKeyDown("right", event)}
          />
        ) : null}
      </aside>
    </div>
  );
}
