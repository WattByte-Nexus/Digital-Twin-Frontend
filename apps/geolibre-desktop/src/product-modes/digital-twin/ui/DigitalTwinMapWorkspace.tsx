import { MapboxOverlay } from "@deck.gl/mapbox";
import { SatelliteTerrainMap } from "@geolibre/map";
import {
  Button,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
  DEFAULT_DIGITAL_TWIN_MAP_DISPLAY_SETTINGS,
  DEFAULT_WEATHER_SETTINGS,
  DigitalTwinMapStatus,
  DigitalTwinMapToolbar,
  DigitalTwinMonitoringStatus,
  DigitalTwinSidebar,
  DigitalTwinTopbar,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  WeatherSettingsFloatingPanel,
  type DigitalTwinDestination,
  type DigitalTwinMapDisplaySettings,
  type DigitalTwinOperator,
  type DigitalTwinRegion,
  type WeatherSettingsValue,
} from "@geolibre/ui";
import {
  Bell,
  Building2,
  Check,
  CloudSun,
  Compass,
  FlaskConical,
  History,
  Map as MapIcon,
  MapPinned,
  Moon,
  Mountain,
  Radio,
  Satellite,
  Sun,
} from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { defaultDigitalTwinApiUrl } from "../../../lib/digital-twin-earth-engine";
import {
  fetchActiveDigitalTwinPointCloud,
  type DigitalTwinPointCloudResult,
} from "../../../lib/digital-twin-point-cloud";
import {
  createDigitalTwinPointCloudLayer,
  DIGITAL_TWIN_LIDAR_OVERLAY_PROPS,
} from "../digital-twin-lidar";
import { DIGITAL_TWIN_SATELLITE_TERRAIN_CONFIG } from "../satellite-terrain-config";
import {
  createWeatherSunSimulationController,
  type WeatherSunSimulationController,
} from "../weather-sun-simulation";
import {
  timeOfDayLightingOverlay,
  type TimeOfDayLightingOverlay,
} from "../weather-time-of-day-presentation";
import {
  SIMULATION_RUNS,
  createSimulationRun,
  type ScenarioRunRequest,
  type SimulationRun,
} from "./simulation-flow";
import { RunsView } from "./views/RunsView";
import {
  ScenariosView,
} from "./views/ScenariosView";
import type { ScenarioMapController } from "./views/ScenarioBuilder";

export type WorkspaceTheme = "light" | "dark";

type PointCloudLoadState =
  | DigitalTwinPointCloudResult
  | { status: "loading" }
  | { status: "error"; error: Error };

function pointCloudDatasetKey(
  dataset: Extract<DigitalTwinPointCloudResult, { status: "ready" }>["dataset"],
): string {
  return `${dataset.regionId}:${dataset.datasetId}:${dataset.version}`;
}

function pointCloudStatusText(
  pointCloud: PointCloudLoadState,
  readyDatasetKey: string | null,
  enabled: boolean,
): string {
  if (!enabled) return "Point clouds disabled.";
  if (pointCloud.status === "loading") return "Point-cloud metadata loading.";
  if (pointCloud.status === "none") {
    return "No point-cloud dataset is available for the selected region.";
  }
  if (pointCloud.status === "error") {
    return `Point cloud failed to load: ${pointCloud.error.message}`;
  }
  if (pointCloud.status === "ready") {
    return readyDatasetKey === pointCloudDatasetKey(pointCloud.dataset)
      ? `${pointCloud.dataset.name} ready.`
      : `${pointCloud.dataset.name} tiles loading.`;
  }
  if (pointCloud.status === "queued") return "Point-cloud build queued.";
  if (pointCloud.status === "building") return "Point-cloud build in progress.";
  return pointCloud.dataset.failureCode
    ? `Point-cloud build failed: ${pointCloud.dataset.failureCode}`
    : "Point-cloud build failed.";
}

export interface DigitalTwinMapWorkspaceProps {
  activeDestination?: DigitalTwinDestination;
  activeRegionId?: string;
  digitalTwinApiUrl?: string;
  location?: string;
  operator?: DigitalTwinOperator;
  organizationName?: string;
  regions?: DigitalTwinRegion[];
  showLidar?: boolean;
  showWeather?: boolean;
  themeMode?: WorkspaceTheme;
  onNavigate?: (destination: DigitalTwinDestination, resourceId?: string) => void;
  onOpenAdministration?: () => void;
  onOpenDiagnostics?: () => void;
  onOpenExpertWorkspace?: () => void;
  onSelectRegion?: (regionId: string) => void;
  onToggleTheme?: () => void;
}

const WORKSPACE_REGIONS = [
  {
    id: "front-range",
    name: "Colorado Front Range",
    description: "Regional transmission and distribution overview",
  },
  {
    id: "denver",
    name: "Denver Metro",
    description: "Urban distribution operations and alerts",
  },
  {
    id: "boulder",
    name: "Boulder County",
    description: "Foothills assets and wildfire exposure",
  },
];

const WORKSPACE_ASSETS = [
  {
    id: "boulder-creek-substation",
    name: "Boulder Creek Substation",
    description: "Substation · Boulder County",
    regionId: "boulder",
  },
  {
    id: "denver-feeder-12",
    name: "Denver Feeder 12",
    description: "Distribution feeder · Denver Metro",
    regionId: "denver",
  },
  {
    id: "front-range-corridor-7",
    name: "Front Range Corridor 7",
    description: "Transmission corridor · Colorado Front Range",
    regionId: "front-range",
  },
];

const WORKSPACE_ALERTS = [
  {
    id: "alert-vegetation-clearance",
    name: "Vegetation clearance risk",
    description: "Boulder Creek Substation · 8 min ago",
    regionId: "boulder",
    severity: "high" as const,
  },
  {
    id: "alert-transformer-loading",
    name: "Transformer loading anomaly",
    description: "Denver Feeder 12 · 21 min ago",
    regionId: "denver",
    severity: "medium" as const,
  },
];

const WORKSPACE_RUNS = [
  {
    id: "run-wildfire-exposure",
    name: "Wildfire exposure · Boulder County",
    description: "Completed · 12 min ago · Maya Chen",
  },
  {
    id: "run-peak-load",
    name: "Peak load contingency · Denver Metro",
    description: "Running · 64% · System operator",
  },
];

export function DigitalTwinMapWorkspace({
  activeDestination: controlledDestination,
  activeRegionId: controlledRegionId,
  digitalTwinApiUrl = defaultDigitalTwinApiUrl(),
  location = "",
  operator = {
    name: "Maya Chen",
    role: "Grid operations supervisor",
    initials: "MC",
  },
  organizationName = "WattByte Nexus",
  regions = WORKSPACE_REGIONS,
  showLidar = true,
  showWeather = true,
  themeMode = "light",
  onNavigate,
  onOpenAdministration,
  onOpenDiagnostics,
  onOpenExpertWorkspace,
  onSelectRegion,
  onToggleTheme,
}: DigitalTwinMapWorkspaceProps) {
  const mapRef = useRef<MapLibreMap | null>(null);
  const interactionMapControllerRef = useRef<ScenarioMapController | null>(null);
  if (interactionMapControllerRef.current === null) {
    interactionMapControllerRef.current = { getMap: () => mapRef.current };
  }
  const lidarOverlayRef = useRef<MapboxOverlay | null>(null);
  const lidarLayerRef = useRef<ReturnType<
    typeof createDigitalTwinPointCloudLayer
  > | null>(null);
  const weatherSunRef = useRef<WeatherSunSimulationController | null>(null);
  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null);
  const [pointCloud, setPointCloud] = useState<PointCloudLoadState>({
    status: "none",
  });
  const [pointCloudAttempt, setPointCloudAttempt] = useState(0);
  const [readyPointCloudDatasetKey, setReadyPointCloudDatasetKey] = useState<
    string | null
  >(null);
  const [displaySettings, setDisplaySettings] =
    useState<DigitalTwinMapDisplaySettings>(
      DEFAULT_DIGITAL_TWIN_MAP_DISPLAY_SETTINGS
    );
  const pointCloudsVisibleRef = useRef(displaySettings.pointClouds);
  const [viewMode, setViewMode] = useState<"3d" | "plan">("3d");
  const [activeThemeMode, setActiveThemeMode] = useState(themeMode);
  const [localRegionId, setLocalRegionId] = useState(
    controlledRegionId ?? regions[0]?.id ?? ""
  );
  const [localDestination, setLocalDestination] =
    useState<DigitalTwinDestination>("live");
  const activeRegionId = controlledRegionId ?? localRegionId;
  const activeDestination = controlledDestination ?? localDestination;
  const [weatherSettings, setWeatherSettings] = useState<WeatherSettingsValue>(
    () => ({
      ...DEFAULT_WEATHER_SETTINGS,
      events: { ...DEFAULT_WEATHER_SETTINGS.events },
    })
  );
  const [lightingOverlay, setLightingOverlay] =
    useState<TimeOfDayLightingOverlay>(() => timeOfDayLightingOverlay(90));

  const [searchOpen, setSearchOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [launchedRuns, setLaunchedRuns] = useState<SimulationRun[]>([]);
  const [scenarioCreationRequest, setScenarioCreationRequest] = useState(0);
  const runSequenceRef = useRef(1);
  const [mapPanelContainer, setMapPanelContainer] =
    useState<HTMLDivElement | null>(null);
  const visibleDetailCount = Object.entries(displaySettings).filter(
    ([key, visible]) => key !== "satellite" && key !== "elevation" && visible
  ).length;

  useEffect(() => {
    setActiveThemeMode(themeMode);
  }, [themeMode]);

  useEffect(
    () => () => {
      weatherSunRef.current?.destroy();
      weatherSunRef.current = null;
    },
    []
  );

  const handleMapReady = (map: MapLibreMap | null) => {
    weatherSunRef.current?.destroy();
    weatherSunRef.current = null;
    mapRef.current = map;
    setMapInstance(map);
    if (map) {
      weatherSunRef.current = createWeatherSunSimulationController(
        map,
        weatherSettings,
        setLightingOverlay
      );
    }
  };

  useEffect(() => {
    if (!showLidar || !activeRegionId) {
      setReadyPointCloudDatasetKey(null);
      setPointCloud({ status: "none" });
      return;
    }

    const controller = new AbortController();
    let disposed = false;
    setReadyPointCloudDatasetKey(null);
    setPointCloud({ status: "loading" });
    void fetchActiveDigitalTwinPointCloud(digitalTwinApiUrl, activeRegionId, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!disposed) setPointCloud(result);
      })
      .catch((cause: unknown) => {
        if (disposed || (cause instanceof Error && cause.name === "AbortError")) {
          return;
        }
        const error =
          cause instanceof Error
            ? cause
            : new Error("Digital Twin point-cloud request failed.");
        console.error("Digital Twin point-cloud catalog could not be loaded", error);
        setPointCloud({ status: "error", error });
      });

    return () => {
      disposed = true;
      controller.abort();
    };
  }, [activeRegionId, digitalTwinApiUrl, pointCloudAttempt, showLidar]);

  useLayoutEffect(() => {
    if (
      !mapInstance ||
      !showLidar ||
      pointCloud.status !== "ready" ||
      pointCloud.dataset.regionId !== activeRegionId
    ) {
      return;
    }

    const datasetKey = pointCloudDatasetKey(pointCloud.dataset);
    const lidarLayer = createDigitalTwinPointCloudLayer(pointCloud.dataset, {
      onError: (error) => {
        console.error(`${pointCloud.dataset.name} could not be loaded`, error);
        setPointCloud((current) =>
          current.status === "ready" &&
          pointCloudDatasetKey(current.dataset) === datasetKey
            ? { status: "error", error }
            : current
        );
      },
      onReady: () => setReadyPointCloudDatasetKey(datasetKey),
    });
    const lidarOverlay = new MapboxOverlay({
      ...DIGITAL_TWIN_LIDAR_OVERLAY_PROPS,
      layers: pointCloudsVisibleRef.current ? [lidarLayer] : [],
    });
    mapInstance.addControl(lidarOverlay);
    lidarLayerRef.current = lidarLayer;
    lidarOverlayRef.current = lidarOverlay;

    return () => {
      if (lidarOverlayRef.current === lidarOverlay) {
        mapInstance.removeControl(lidarOverlay);
        lidarOverlayRef.current = null;
        lidarLayerRef.current = null;
      }
    };
  }, [activeRegionId, mapInstance, pointCloud, showLidar]);

  useEffect(() => {
    pointCloudsVisibleRef.current = displaySettings.pointClouds;
    const overlay = lidarOverlayRef.current;
    const layer = lidarLayerRef.current;
    if (!overlay || !layer) return;
    overlay.setProps({ layers: displaySettings.pointClouds ? [layer] : [] });
  }, [displaySettings.pointClouds]);

  const activePointCloudStatus = pointCloudStatusText(
    pointCloud,
    readyPointCloudDatasetKey,
    showLidar,
  );
  const canRetryPointCloud =
    pointCloud.status === "error" || pointCloud.status === "failed";

  const handleWeatherSettingsChange = (nextValue: WeatherSettingsValue) => {
    setWeatherSettings(nextValue);
    weatherSunRef.current?.update(nextValue);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditableTarget =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.matches("input, textarea, select, [role='textbox']"));
      const isCommandShortcut =
        event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
      const isSearchShortcut =
        event.key === "/" &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !isEditableTarget;

      if (isCommandShortcut) {
        event.preventDefault();
        setSearchOpen(false);
        setCommandOpen(true);
      } else if (isSearchShortcut) {
        event.preventDefault();
        setCommandOpen(false);
        setSearchOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const changeViewMode = (mode: "3d" | "plan") => {
    setViewMode(mode);
    mapRef.current?.easeTo({
      pitch:
        mode === "3d"
          ? DIGITAL_TWIN_SATELLITE_TERRAIN_CONFIG.initialView.pitch
          : 0,
      duration: 400,
    });
  };

  const openSearchResult = (action: () => void) => {
    action();
    setSearchOpen(false);
  };

  const runCommand = (action: () => void) => {
    action();
    setCommandOpen(false);
  };

  const navigateTo = (destination: DigitalTwinDestination, resourceId?: string) => {
    setLocalDestination(destination);
    onNavigate?.(destination, resourceId);
  };

  const launchSimulation = (request: ScenarioRunRequest) => {
    const run = createSimulationRun(request, runSequenceRef.current);
    runSequenceRef.current += 1;
    setLaunchedRuns((current) => [run, ...current]);
    navigateTo("runs", run.id);
  };

  const selectRegion = (regionId: string) => {
    if (!regions.some((region) => region.id === regionId)) return;
    setLocalRegionId(regionId);
    onSelectRegion?.(regionId);
  };

  const toggleTheme = () => {
    setActiveThemeMode((current) => (current === "light" ? "dark" : "light"));
    onToggleTheme?.();
  };

  const mapSurface = (
    <div
      className="relative h-full min-h-0 w-full overflow-hidden bg-background"
      ref={setMapPanelContainer}
    >
      <SatelliteTerrainMap
        {...DIGITAL_TWIN_SATELLITE_TERRAIN_CONFIG}
        satelliteVisible={displaySettings.satellite}
        elevationEnabled={displaySettings.elevation}
        themeMode={activeThemeMode}
        referenceOverlayVisibility={displaySettings}
        onMapReady={handleMapReady}
      />

      <div
        aria-hidden="true"
        data-time-of-day-lighting="true"
        className="pointer-events-none absolute inset-0 z-[5] transition-[background-color,opacity] duration-500 motion-reduce:transition-none"
        style={{
          backgroundColor: lightingOverlay.color,
          opacity: lightingOverlay.opacity,
        }}
      />

      {activeDestination === "live" ? (
        <>
          <div className="absolute bottom-4 left-4 z-10">
            <DigitalTwinMapStatus
              viewMode={viewMode}
              visibleDetailCount={visibleDetailCount}
            />
          </div>

          <div className="absolute bottom-6 right-4 z-10">
            <DigitalTwinMonitoringStatus themeMode={activeThemeMode} />
          </div>

          {showWeather ? (
            <WeatherSettingsFloatingPanel
              theme={activeThemeMode}
              location="Boulder County, Colorado"
              value={weatherSettings}
              onValueChange={handleWeatherSettingsChange}
              trigger={
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="border bg-background/95 text-foreground shadow-lg backdrop-blur"
                  aria-label="Open weather settings"
                  title="Weather settings"
                >
                  <CloudSun aria-hidden="true" />
                </Button>
              }
            />
          ) : null}
        </>
      ) : null}

      <output aria-live="polite" className="sr-only">
        {activePointCloudStatus}
      </output>

      {canRetryPointCloud && activeDestination === "live" ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="absolute bottom-16 left-4 z-10 border bg-background/95 shadow-lg backdrop-blur"
          onClick={() => setPointCloudAttempt((attempt) => attempt + 1)}
        >
          Retry point cloud
        </Button>
      ) : null}
    </div>
  );

  return (
    <div
      className={`${
        activeThemeMode === "dark" ? "dark" : "theme-light"
      } flex h-full w-full overflow-hidden bg-background`}
    >
      <SidebarProvider className="min-h-0">
        <DigitalTwinSidebar
          activeDestination={activeDestination}
          activeRegionId={activeRegionId}
          regions={regions}
          themeMode={activeThemeMode}
          onNavigate={navigateTo}
          onSelectRegion={selectRegion}
        />
        <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
          <DigitalTwinTopbar
            alerts={WORKSPACE_ALERTS}
            alertsCount={7}
            alertsPanelContainer={mapPanelContainer}
            mapToolbar={
              <DigitalTwinMapToolbar
                className="h-10 rounded-md border-0 bg-transparent p-0 shadow-none"
                theme={activeThemeMode}
                value={displaySettings}
                viewMode={viewMode}
                onValueChange={setDisplaySettings}
                onViewModeChange={changeViewMode}
                onResetOrientation={() => {
                  mapRef.current?.easeTo({ bearing: 0, duration: 400 });
                }}
              />
            }
            operator={operator}
            organizationName={organizationName}
            sidebarTrigger={<SidebarTrigger />}
            themeMode={activeThemeMode}
            onOpenAdministration={onOpenAdministration}
            onOpenDiagnostics={onOpenDiagnostics}
            onOpenExpertWorkspace={onOpenExpertWorkspace}
            onOpenAlerts={() => navigateTo("live")}
            onOpenSearch={() => setSearchOpen(true)}
            onToggleTheme={toggleTheme}
          />

          <CommandDialog
            description="Look up regions, grid assets, alerts, and simulation runs."
            onOpenChange={setSearchOpen}
            open={searchOpen}
            theme={activeThemeMode}
            title="Search Digital Twin"
          >
            <CommandInput placeholder="Search regions, assets, alerts, and runs..." />
            <CommandList>
              <CommandEmpty>
                No matching regions, assets, alerts, or runs.
              </CommandEmpty>
              <CommandGroup heading="Regions">
                {regions.map((region) => (
                  <CommandItem
                    className="items-start py-2.5"
                    key={region.id}
                    onSelect={() =>
                      openSearchResult(() => {
                        navigateTo("live");
                        selectRegion(region.id);
                      })
                    }
                    value={`region ${region.name} ${region.description}`}
                  >
                    <MapPinned aria-hidden="true" className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block truncate">{region.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {region.description}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Assets">
                {WORKSPACE_ASSETS.map((asset) => (
                  <CommandItem
                    className="items-start py-2.5"
                    key={asset.id}
                    onSelect={() =>
                      openSearchResult(() => {
                        navigateTo("live");
                        selectRegion(asset.regionId);
                      })
                    }
                    value={`asset ${asset.name} ${asset.description}`}
                  >
                    <Building2 aria-hidden="true" className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block truncate">{asset.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {asset.description}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Alerts">
                {WORKSPACE_ALERTS.map((alert) => (
                  <CommandItem
                    className="items-start py-2.5"
                    key={alert.id}
                    onSelect={() =>
                      openSearchResult(() => {
                        navigateTo("live");
                        selectRegion(alert.regionId);
                      })
                    }
                    value={`alert ${alert.name} ${alert.description}`}
                  >
                    <Bell aria-hidden="true" className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block truncate">{alert.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {alert.description}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Runs">
                {WORKSPACE_RUNS.map((run) => (
                  <CommandItem
                    className="items-start py-2.5"
                    key={run.id}
                    onSelect={() =>
                      openSearchResult(() => navigateTo("runs"))
                    }
                    value={`run ${run.name} ${run.description}`}
                  >
                    <History aria-hidden="true" className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block truncate">{run.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {run.description}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </CommandDialog>

          <CommandDialog
            description="Run navigation, map, layer, and workspace commands."
            onOpenChange={setCommandOpen}
            open={commandOpen}
            theme={activeThemeMode}
            title="Workspace command palette"
          >
            <CommandInput placeholder="Search workspace commands..." />
            <CommandList>
              <CommandEmpty>No matching commands.</CommandEmpty>
              <CommandGroup heading="Navigation">
                <CommandItem
                  onSelect={() =>
                    runCommand(() => navigateTo("live"))
                  }
                >
                  <Radio aria-hidden="true" />
                  Open live monitoring
                </CommandItem>
                <CommandItem
                  onSelect={() =>
                    runCommand(() => navigateTo("scenarios"))
                  }
                >
                  <FlaskConical aria-hidden="true" />
                  Open scenarios
                </CommandItem>
                <CommandItem
                  onSelect={() =>
                    runCommand(() => navigateTo("runs"))
                  }
                >
                  <History aria-hidden="true" />
                  Open runs
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Map view">
                <CommandItem
                  onSelect={() => runCommand(() => changeViewMode("3d"))}
                >
                  <Mountain aria-hidden="true" />
                  Switch to 3D view
                  {viewMode === "3d" ? (
                    <Check aria-hidden="true" className="ms-auto" />
                  ) : null}
                </CommandItem>
                <CommandItem
                  onSelect={() => runCommand(() => changeViewMode("plan"))}
                >
                  <MapIcon aria-hidden="true" />
                  Switch to plan view
                  {viewMode === "plan" ? (
                    <Check aria-hidden="true" className="ms-auto" />
                  ) : null}
                </CommandItem>
                <CommandItem
                  onSelect={() =>
                    runCommand(() =>
                      mapRef.current?.easeTo({
                        bearing: 0,
                        pitch: 0,
                        duration: 400,
                      })
                    )
                  }
                >
                  <Compass aria-hidden="true" />
                  Reset map orientation
                  <CommandShortcut>R</CommandShortcut>
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Layers">
                <CommandItem
                  onSelect={() =>
                    runCommand(() =>
                      setDisplaySettings((current) => ({
                        ...current,
                        satellite: !current.satellite,
                      }))
                    )
                  }
                >
                  <Satellite aria-hidden="true" />
                  Toggle satellite imagery
                  {displaySettings.satellite ? (
                    <Check aria-hidden="true" className="ms-auto" />
                  ) : null}
                </CommandItem>
                <CommandItem
                  onSelect={() =>
                    runCommand(() =>
                      setDisplaySettings((current) => ({
                        ...current,
                        elevation: !current.elevation,
                      }))
                    )
                  }
                >
                  <Mountain aria-hidden="true" />
                  Toggle terrain elevation
                  {displaySettings.elevation ? (
                    <Check aria-hidden="true" className="ms-auto" />
                  ) : null}
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Appearance">
                <CommandItem
                  onSelect={() =>
                    runCommand(toggleTheme)
                  }
                >
                  {activeThemeMode === "light" ? (
                    <Moon aria-hidden="true" />
                  ) : (
                    <Sun aria-hidden="true" />
                  )}
                  Switch to {activeThemeMode === "light" ? "dark" : "light"}{" "}
                  theme
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </CommandDialog>

          {activeDestination === "scenarios" ? (
            <ScenariosView
              creationRequest={scenarioCreationRequest}
              mapControllerRef={interactionMapControllerRef}
              mapSlot={mapSurface}
              onRun={launchSimulation}
              theme={activeThemeMode}
            />
          ) : activeDestination === "runs" ? (
            <RunsView
              location={location}
              mapSlot={mapSurface}
              onCreateScenario={() => {
                setScenarioCreationRequest((request) => request + 1);
                navigateTo("scenarios");
              }}
              onOpenRun={(runId) => navigateTo("runs", runId)}
              onReturnToRuns={() => navigateTo("runs")}
              runs={[...launchedRuns, ...SIMULATION_RUNS]}
              theme={activeThemeMode}
            />
          ) : (
            mapSurface
          )}
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
