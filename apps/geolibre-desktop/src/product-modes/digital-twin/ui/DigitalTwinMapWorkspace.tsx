import type { Layer } from "@deck.gl/core";
import { GeoJsonLayer } from "@deck.gl/layers";
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
  Check,
  CloudSun,
  Compass,
  FlaskConical,
  History,
  Map as MapIcon,
  MapPinned,
  Maximize,
  Moon,
  Mountain,
  Radio,
  Satellite,
  Sun,
  Zap,
} from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { defaultDigitalTwinApiUrl } from "../../../lib/digital-twin-earth-engine";
import {
  checkDigitalTwinEngineHealth,
  fetchDigitalTwinWeatherDatasets,
  type DigitalTwinEngineHealth,
} from "../../../lib/digital-twin-status";
import { fetchDigitalTwinLiveWeather } from "../../../lib/digital-twin-live-weather";
import {
  fetchDigitalTwinRunCatalog,
  submitDigitalTwinScenarioRun,
  type DigitalTwinRunCatalog,
} from "../../../lib/digital-twin-runs";
import { APP_VERSION } from "../../../lib/updates";
import {
  fetchDigitalTwinPowerLines,
  powerLinesFeatureCollection,
  type DigitalTwinPowerLine,
} from "../../../lib/digital-twin-power-lines";
import {
  fetchActiveDigitalTwinPointCloud,
  type DigitalTwinPointCloudResult,
} from "../../../lib/digital-twin-point-cloud";
import { createDigitalTwinPointCloudLayer } from "../digital-twin-lidar";
import {
  DIGITAL_TWIN_REFERENCE_LABEL_ANCHOR_LAYER_ID,
  DIGITAL_TWIN_SATELLITE_TERRAIN_CONFIG,
} from "../satellite-terrain-config";
import {
  createWeatherSunSimulationController,
  type WeatherSunSimulationController,
} from "../weather-sun-simulation";
import {
  timeOfDayLightingOverlay,
  type TimeOfDayLightingOverlay,
} from "../weather-time-of-day-presentation";
import {
  type ScenarioRunRequest,
} from "./simulation-flow";
import { PersistentDigitalTwinMapHost } from "./PersistentDigitalTwinMapHost";
import { AssetsView } from "./assets/AssetsView";
import { SectionErrorBoundary } from "../../../components/common/error-boundaries";
import { RunsView } from "./views/RunsView";
import { ScenariosView } from "./views/ScenariosView";
import type { ScenarioMapController } from "./views/ScenarioBuilder";

export type WorkspaceTheme = "light" | "dark";

type PointCloudLoadState =
  | DigitalTwinPointCloudResult
  | { status: "loading" }
  | { status: "error"; error: Error };

type PowerLineLoadState =
  | { status: "none" }
  | { status: "loading" }
  | { status: "ready"; regionId: string; lines: DigitalTwinPowerLine[] }
  | { status: "error"; error: Error };

type WeatherDataLoadState =
  | { status: "disabled" }
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; error: Error };

type EngineHealthLoadState = "checking" | DigitalTwinEngineHealth;

type LiveWeatherLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      observedAt: string;
      readings: Awaited<ReturnType<typeof fetchDigitalTwinLiveWeather>>["readings"];
      unavailableReadingLabels: string[];
    }
  | { status: "error"; error: Error };

const POWER_LINE_CASING_LAYER_ID =
  "digital-twin-operational-power-lines-casing";
const POWER_LINE_LAYER_ID = "digital-twin-operational-power-lines-line";
const FLOATING_MAP_ACTION_BUTTON_CLASS_NAME =
  "size-10 border border-border bg-background/95 text-foreground shadow-lg backdrop-blur";

function pointCloudDatasetKey(
  dataset: Extract<DigitalTwinPointCloudResult, { status: "ready" }>["dataset"]
): string {
  return `${dataset.regionId}:${dataset.datasetId}:${dataset.version}`;
}

function pointCloudStatusText(
  pointCloud: PointCloudLoadState,
  readyDatasetKey: string | null,
  enabled: boolean
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
      ? `${pointCloud.dataset.name} ready. Source RGB is preserved; missing RGB is shown in cyan.`
      : `${pointCloud.dataset.name} tiles loading.`;
  }
  if (pointCloud.status === "queued") return "Point-cloud build queued.";
  if (pointCloud.status === "building") return "Point-cloud build in progress.";
  return pointCloud.dataset.failureCode
    ? `Point-cloud build failed: ${pointCloud.dataset.failureCode}`
    : "Point-cloud build failed.";
}

function seasonForDate(date: Date): string {
  const month = date.getUTCMonth();
  if (month >= 2 && month <= 4) return "Spring";
  if (month >= 5 && month <= 7) return "Summer";
  if (month >= 8 && month <= 10) return "Autumn";
  return "Winter";
}

function applyLiveWeather(
  current: WeatherSettingsValue,
  weather: Awaited<ReturnType<typeof fetchDigitalTwinLiveWeather>>,
): WeatherSettingsValue {
  const observedAt = new Date(weather.observedAt);
  return {
    ...current,
    date: observedAt.toISOString().slice(0, 10),
    hour: observedAt.getUTCHours(),
    minute: observedAt.getUTCMinutes(),
    timeFormat: "24",
    season: seasonForDate(observedAt),
    temperature: weather.temperatureC ?? current.temperature,
    events: {
      ...current.events,
      wind: weather.windSpeedMph ?? current.events.wind,
      windDirection: weather.windDirectionDegrees ?? current.events.windDirection,
    },
  };
}

function liveWeatherStatusText(state: LiveWeatherLoadState): string | undefined {
  if (state.status === "loading") return "Loading live weather from the Digital Twin Engine…";
  if (state.status === "ready") {
    const unavailable = state.unavailableReadingLabels.length;
    return unavailable > 0
      ? `Live Engine weather · ${state.observedAt} · ${unavailable} ${unavailable === 1 ? "reading" : "readings"} unavailable`
      : `Live Engine weather · ${state.observedAt}`;
  }
  if (state.status === "error") return `Live weather unavailable · ${state.error.message}`;
  return undefined;
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
  onNavigate?: (
    destination: DigitalTwinDestination,
    resourceId?: string
  ) => void;
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
  const mapParkingHostRef = useRef<HTMLDivElement | null>(null);
  const [mapContentEl] = useState(() => {
    const element = document.createElement("div");
    element.className = "contents";
    return element;
  });
  const [mapStarted, setMapStarted] = useState(false);
  const activateMap = useCallback(() => setMapStarted(true), []);
  const setMapParkingHost = useCallback(
    (host: HTMLDivElement | null) => {
      mapParkingHostRef.current = host;
      if (host && !mapContentEl.isConnected) host.replaceChildren(mapContentEl);
    },
    [mapContentEl]
  );
  const interactionMapControllerRef = useRef<ScenarioMapController | null>(
    null
  );
  if (interactionMapControllerRef.current === null) {
    interactionMapControllerRef.current = { getMap: () => mapRef.current };
  }
  const weatherSunRef = useRef<WeatherSunSimulationController | null>(null);
  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null);
  const [pointCloud, setPointCloud] = useState<PointCloudLoadState>({
    status: "none",
  });
  const [powerLines, setPowerLines] = useState<PowerLineLoadState>({
    status: "none",
  });
  const [weatherData, setWeatherData] = useState<WeatherDataLoadState>({
    status: showWeather ? "loading" : "disabled",
  });
  const [engineHealth, setEngineHealth] =
    useState<EngineHealthLoadState>("checking");
  const [readyPointCloudDatasetKey, setReadyPointCloudDatasetKey] = useState<
    string | null
  >(null);
  const [pointCloudCameraTarget, setPointCloudCameraTarget] = useState<{
    datasetKey: string;
    elevationMeters: number;
  } | null>(null);
  const [displaySettings, setDisplaySettings] =
    useState<DigitalTwinMapDisplaySettings>(
      DEFAULT_DIGITAL_TWIN_MAP_DISPLAY_SETTINGS
    );
  const [viewMode, setViewMode] = useState<"3d" | "plan">("3d");
  const [activeThemeMode, setActiveThemeMode] = useState(themeMode);
  const [localRegionId, setLocalRegionId] = useState(
    controlledRegionId ?? regions[0]?.id ?? ""
  );
  const [localDestination, setLocalDestination] =
    useState<DigitalTwinDestination>("live");
  const [scenarioBuilderOpen, setScenarioBuilderOpen] = useState(false);
  const activeRegionId = controlledRegionId ?? localRegionId;
  const activeDestination = controlledDestination ?? localDestination;
  const activeRegion = regions.find((region) => region.id === activeRegionId);
  const showLiveMapChrome =
    activeDestination === "live" ||
    (activeDestination === "scenarios" && scenarioBuilderOpen);
  const [weatherSettings, setWeatherSettings] = useState<WeatherSettingsValue>(
    () => ({
      ...DEFAULT_WEATHER_SETTINGS,
      events: { ...DEFAULT_WEATHER_SETTINGS.events },
    })
  );
  const weatherSettingsRef = useRef(weatherSettings);
  const [liveWeather, setLiveWeather] = useState<LiveWeatherLoadState>({
    status: "idle",
  });
  const [lightingOverlay, setLightingOverlay] =
    useState<TimeOfDayLightingOverlay>(() => timeOfDayLightingOverlay(90));

  const [searchOpen, setSearchOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
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
    void fetchDigitalTwinRunCatalog(digitalTwinApiUrl, {
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
          cause instanceof Error
            ? cause
            : new Error("Digital Twin runs request failed.")
        );
        setRunCatalogLoading(false);
      }
    );
    return () => controller.abort();
  }, [digitalTwinApiUrl, runCatalogRequest]);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const checkHealth = () => {
      void checkDigitalTwinEngineHealth(digitalTwinApiUrl, {
        signal: controller.signal,
      }).then((health) => {
        if (!disposed) setEngineHealth(health);
      }, (cause: unknown) => {
        if (disposed || (cause instanceof Error && cause.name === "AbortError")) return;
        setEngineHealth("offline");
      });
    };
    setEngineHealth("checking");
    checkHealth();
    const interval = window.setInterval(checkHealth, 60_000);
    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [digitalTwinApiUrl]);
  const [mapPanelContainer, setMapPanelContainer] =
    useState<HTMLDivElement | null>(null);
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

  const handleWeatherSettingsChange = useCallback((nextValue: WeatherSettingsValue) => {
    weatherSettingsRef.current = nextValue;
    setWeatherSettings(nextValue);
    weatherSunRef.current?.update(nextValue);
  }, []);

  useEffect(() => {
    if (weatherSettings.mode !== "auto") {
      setLiveWeather({ status: "idle" });
      return;
    }
    if (!mapInstance || !activeRegionId) return;

    const controller = new AbortController();
    let disposed = false;
    const refresh = () => {
      const center = mapInstance.getCenter();
      setLiveWeather((current) =>
        current.status === "ready" ? current : { status: "loading" },
      );
      void fetchDigitalTwinLiveWeather(digitalTwinApiUrl, activeRegionId, {
        longitude: center.lng,
        latitude: center.lat,
      }, { signal: controller.signal }).then(
        (weather) => {
          if (disposed) return;
          const current = weatherSettingsRef.current;
          if (current.mode !== "auto") return;
          handleWeatherSettingsChange(applyLiveWeather(current, weather));
          setLiveWeather({
            status: "ready",
            observedAt: weather.observedAt,
            readings: weather.readings,
            unavailableReadingLabels: weather.unavailableReadingLabels,
          });
        },
        (cause: unknown) => {
          if (disposed || (cause instanceof Error && cause.name === "AbortError")) return;
          setLiveWeather({
            status: "error",
            error: cause instanceof Error ? cause : new Error("Live weather request failed."),
          });
        },
      );
    };

    refresh();
    const interval = window.setInterval(refresh, 60_000);
    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [activeRegionId, digitalTwinApiUrl, handleWeatherSettingsChange, mapInstance, weatherSettings.mode]);

  useEffect(() => {
    if (!showLidar || !activeRegionId) {
      setReadyPointCloudDatasetKey(null);
      setPointCloudCameraTarget(null);
      setPointCloud({ status: "none" });
      return;
    }

    const controller = new AbortController();
    let disposed = false;
    setReadyPointCloudDatasetKey(null);
    setPointCloudCameraTarget(null);
    setPointCloud({ status: "loading" });
    void fetchActiveDigitalTwinPointCloud(digitalTwinApiUrl, activeRegionId, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!disposed) setPointCloud(result);
      })
      .catch((cause: unknown) => {
        if (
          disposed ||
          (cause instanceof Error && cause.name === "AbortError")
        ) {
          return;
        }
        const error =
          cause instanceof Error
            ? cause
            : new Error("Digital Twin point-cloud request failed.");
        console.error(
          "Digital Twin point-cloud catalog could not be loaded",
          error
        );
        setPointCloud({ status: "error", error });
      });

    return () => {
      disposed = true;
      controller.abort();
    };
  }, [activeRegionId, digitalTwinApiUrl, showLidar]);

  useEffect(() => {
    if (!activeRegionId) {
      setPowerLines({ status: "none" });
      return;
    }
    const controller = new AbortController();
    setPowerLines({ status: "loading" });
    void fetchDigitalTwinPowerLines(digitalTwinApiUrl, activeRegionId, {
      signal: controller.signal,
    }).then(
      (lines) => {
        if (!controller.signal.aborted) {
          setPowerLines({ status: "ready", regionId: activeRegionId, lines });
        }
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        const error =
          cause instanceof Error
            ? cause
            : new Error("Power-line inventory request failed.");
        console.error("Digital Twin power lines could not be loaded", error);
        setPowerLines({ status: "error", error });
      }
    );
    return () => controller.abort();
  }, [activeRegionId, digitalTwinApiUrl]);

  useEffect(() => {
    if (!showWeather) {
      setWeatherData({ status: "disabled" });
      return;
    }
    if (!activeRegionId) {
      setWeatherData({ status: "error", error: new Error("No active region selected.") });
      return;
    }
    const controller = new AbortController();
    setWeatherData({ status: "loading" });
    void fetchDigitalTwinWeatherDatasets(digitalTwinApiUrl, activeRegionId, {
      signal: controller.signal,
    }).then(
      () => {
        if (!controller.signal.aborted) {
          setWeatherData({ status: "ready" });
        }
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        setWeatherData({
          status: "error",
          error: cause instanceof Error ? cause : new Error("Weather data request failed."),
        });
      },
    );
    return () => controller.abort();
  }, [activeRegionId, digitalTwinApiUrl, showWeather]);

  const monitoringStatus = useMemo(() => {
    if (engineHealth === "checking") {
      return { label: "Connecting", detail: "Checking Engine", tone: "degraded" as const };
    }
    if (engineHealth === "offline") {
      return { label: "Offline", detail: "Engine health check failed", tone: "offline" as const };
    }
    if (engineHealth === "degraded") {
      return { label: "Degraded", detail: "Engine is not ready", tone: "degraded" as const };
    }
    if (powerLines.status === "loading" || weatherData.status === "loading") {
      return { label: "Loading", detail: "Weather & asset data", tone: "degraded" as const };
    }
    if (powerLines.status === "error") {
      return { label: "Degraded", detail: "Asset data unavailable", tone: "degraded" as const };
    }
    if (weatherData.status === "error") {
      return { label: "Degraded", detail: "Weather data unavailable", tone: "degraded" as const };
    }
    return {
      label: "Current",
      detail: weatherData.status === "ready"
        ? "Weather & asset data loaded"
        : "Asset data loaded · Weather disabled",
      tone: "current" as const,
    };
  }, [engineHealth, powerLines.status, weatherData]);

  useEffect(() => {
    if (
      !showLiveMapChrome ||
      !mapInstance ||
      powerLines.status !== "ready" ||
      powerLines.regionId !== activeRegionId ||
      powerLines.lines.length === 0
    ) {
      return;
    }
    const coordinates = powerLines.lines.flatMap(
      (line) => line.geometry.coordinates
    );
    const longitudes = coordinates.map((position) => position[0]);
    const latitudes = coordinates.map((position) => position[1]);
    mapInstance.fitBounds(
      [
        [Math.min(...longitudes), Math.min(...latitudes)],
        [Math.max(...longitudes), Math.max(...latitudes)],
      ],
      { padding: 96, maxZoom: 16.5, duration: 500 }
    );
  }, [activeRegionId, mapInstance, powerLines, showLiveMapChrome]);

  const deckLayers = useMemo<Layer[]>(() => {
    const layers: Layer[] = [];

    if (
      showLidar &&
      displaySettings.pointClouds &&
      pointCloud.status === "ready" &&
      pointCloud.dataset.regionId === activeRegionId
    ) {
      const datasetKey = pointCloudDatasetKey(pointCloud.dataset);
      layers.push(
        createDigitalTwinPointCloudLayer(pointCloud.dataset, {
          beforeId: DIGITAL_TWIN_REFERENCE_LABEL_ANCHOR_LAYER_ID,
          onError: (error) => {
            console.error(
              `${pointCloud.dataset.name} could not be loaded`,
              error
            );
            setPointCloud((current) =>
              current.status === "ready" &&
              pointCloudDatasetKey(current.dataset) === datasetKey
                ? { status: "error", error }
                : current
            );
          },
          onCameraTargetElevation: (elevationMeters) => {
            setPointCloudCameraTarget({ datasetKey, elevationMeters });
          },
          onReady: () => setReadyPointCloudDatasetKey(datasetKey),
        })
      );
    }

    if (
      powerLines.status === "ready" &&
      powerLines.regionId === activeRegionId
    ) {
      const data = powerLinesFeatureCollection(powerLines.lines);
      layers.push(
        new GeoJsonLayer({
          id: POWER_LINE_CASING_LAYER_ID,
          beforeId: DIGITAL_TWIN_REFERENCE_LABEL_ANCHOR_LAYER_ID,
          data,
          filled: false,
          stroked: true,
          pickable: false,
          lineWidthUnits: "pixels",
          getLineColor: [17, 24, 39, 230],
          getLineWidth: 6,
          parameters: { depthTest: false },
        }),
        new GeoJsonLayer({
          id: POWER_LINE_LAYER_ID,
          beforeId: DIGITAL_TWIN_REFERENCE_LABEL_ANCHOR_LAYER_ID,
          data,
          filled: false,
          stroked: true,
          pickable: true,
          lineWidthUnits: "pixels",
          getLineColor: [251, 191, 36, 255],
          getLineWidth: 3,
          parameters: { depthTest: false },
        })
      );
    }

    return layers;
  }, [
    activeRegionId,
    displaySettings.pointClouds,
    pointCloud,
    powerLines,
    showLidar,
  ]);

  const activePointCloudStatus = pointCloudStatusText(
    pointCloud,
    readyPointCloudDatasetKey,
    showLidar
  );
  const activePointCloudCameraTargetElevation =
    pointCloud.status === "ready" &&
    pointCloudCameraTarget?.datasetKey === pointCloudDatasetKey(pointCloud.dataset)
      ? pointCloudCameraTarget.elevationMeters
      : undefined;
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

  const canZoomToSelectedRegion =
    powerLines.status === "ready" &&
    powerLines.regionId === activeRegionId &&
    powerLines.lines.length > 0;

  const zoomToSelectedRegion = () => {
    if (!canZoomToSelectedRegion) return;
    const coordinates = powerLines.lines.flatMap((line) => line.geometry.coordinates);
    const longitudes = coordinates.map((position) => position[0]);
    const latitudes = coordinates.map((position) => position[1]);
    mapRef.current?.fitBounds(
      [
        [Math.min(...longitudes), Math.min(...latitudes)],
        [Math.max(...longitudes), Math.max(...latitudes)],
      ],
      { padding: 96, maxZoom: 16.5, duration: 500 },
    );
  };

  const openSearchResult = (action: () => void) => {
    action();
    setSearchOpen(false);
  };

  const runCommand = (action: () => void) => {
    action();
    setCommandOpen(false);
  };

  const navigateTo = (
    destination: DigitalTwinDestination,
    resourceId?: string
  ) => {
    setLocalDestination(destination);
    onNavigate?.(destination, resourceId);
  };

  const launchSimulation = async (request: ScenarioRunRequest, idempotencyKey: string) => {
    const submission = await submitDigitalTwinScenarioRun(digitalTwinApiUrl, {
      regionId: request.regionId,
      durationHours: request.durationHours,
      ignitionPoints: request.ignitionPoints,
      windSpeedMph: request.weather.events.wind,
      windDirectionDegrees: request.weather.events.windDirection,
    }, { idempotencyKey });
    setRunCatalogRequest((current) => current + 1);
    navigateTo("runs", submission.runId);
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
        cameraTargetElevation={activePointCloudCameraTargetElevation}
        deckLayers={deckLayers}
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

      {showLiveMapChrome ? (
        <>
          <div className="absolute right-4 top-16 z-10">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className={FLOATING_MAP_ACTION_BUTTON_CLASS_NAME}
              disabled={!canZoomToSelectedRegion}
              aria-label="Zoom to selected region"
              title="Zoom to selected region"
              onClick={zoomToSelectedRegion}
            >
              <Maximize aria-hidden="true" className="size-4" />
            </Button>
          </div>
          <div className="absolute bottom-6 right-4 z-10">
            <DigitalTwinMonitoringStatus
              detail={monitoringStatus.detail}
              label={monitoringStatus.label}
              themeMode={activeThemeMode}
              tone={monitoringStatus.tone}
            />
          </div>

          {showWeather && activeDestination === "live" ? (
            <WeatherSettingsFloatingPanel
              autoWeatherReadings={
                liveWeather.status === "ready"
                  ? liveWeather.readings.map((reading) => ({
                      id: reading.band,
                      label: reading.label,
                      unit: reading.unit,
                      value: reading.value,
                    }))
                  : undefined
              }
              autoWeatherStatus={liveWeatherStatusText(liveWeather)}
              theme={activeThemeMode}
              location="Boulder County, Colorado"
              value={weatherSettings}
              onValueChange={handleWeatherSettingsChange}
              trigger={
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className={FLOATING_MAP_ACTION_BUTTON_CLASS_NAME}
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

      <output aria-live="polite" className="sr-only">
        {powerLines.status === "loading"
          ? "Power lines loading."
          : powerLines.status === "ready"
          ? `${powerLines.lines.length} operational power lines loaded.`
          : powerLines.status === "error"
          ? `Power lines failed to load: ${powerLines.error.message}`
          : "No power lines loaded."}
      </output>
    </div>
  );
  const mapHost = (
    <PersistentDigitalTwinMapHost
      contentEl={mapContentEl}
      mapRef={mapRef}
      onActivate={activateMap}
      parkingHostRef={mapParkingHostRef}
    />
  );

  return (
    <div
      className={`${
        activeThemeMode === "dark" ? "dark" : "theme-light"
      } flex h-full w-full overflow-hidden bg-background`}
    >
      <SidebarProvider
        className="min-h-0"
        style={{ "--sidebar-width": "12rem" } as CSSProperties}
      >
        <DigitalTwinSidebar
          activeDestination={activeDestination}
          activeRegionId={activeRegionId}
          appVersion={`v${APP_VERSION}`}
          regions={regions}
          themeMode={activeThemeMode}
          onNavigate={navigateTo}
          onOpenAlerts={() => navigateTo("live")}
          onOpenData={onOpenExpertWorkspace}
          onOpenSettings={onOpenAdministration}
          onSelectRegion={selectRegion}
        />
        <SidebarInset className="relative min-h-0 min-w-0 overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none invisible absolute bottom-0 end-0 overflow-hidden"
            data-digital-twin-map-parking=""
            ref={setMapParkingHost}
          />
          {mapStarted ? createPortal(mapSurface, mapContentEl) : null}
          <DigitalTwinTopbar
            alerts={WORKSPACE_ALERTS}
            alertsCount={7}
            alertsPanelContainer={mapPanelContainer}
            mapToolbar={
              showLiveMapChrome ? (
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
              ) : undefined
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
                {powerLines.status === "ready" && powerLines.lines.length > 0 ? (
                  powerLines.lines.map((asset) => (
                    <CommandItem
                      className="items-start py-2.5"
                      key={asset.powerLineId}
                      onSelect={() =>
                        openSearchResult(() => {
                          navigateTo("assets", asset.powerLineId);
                        })
                      }
                      value={`asset power line ${asset.powerLineId} ${activeRegion?.name ?? activeRegionId}`}
                    >
                      <Zap aria-hidden="true" className="mt-0.5" />
                      <span className="min-w-0">
                        <span className="block truncate">{asset.powerLineId}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          Overhead power line · {activeRegion?.name ?? activeRegionId}
                        </span>
                      </span>
                    </CommandItem>
                  ))
                ) : (
                  <CommandItem disabled>
                    {powerLines.status === "loading"
                      ? "Loading assets…"
                      : powerLines.status === "error"
                        ? "Assets unavailable"
                        : "No assets published for this region"}
                  </CommandItem>
                )}
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
                    onSelect={() => openSearchResult(() => navigateTo("runs"))}
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
                  onSelect={() => runCommand(() => navigateTo("live"))}
                >
                  <Radio aria-hidden="true" />
                  Open live monitoring
                </CommandItem>
                <CommandItem
                  onSelect={() => runCommand(() => navigateTo("scenarios"))}
                >
                  <FlaskConical aria-hidden="true" />
                  Open scenarios
                </CommandItem>
                <CommandItem
                  onSelect={() => runCommand(() => navigateTo("runs"))}
                >
                  <History aria-hidden="true" />
                  Open runs
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Map view">
                <CommandItem
                  disabled={!canZoomToSelectedRegion}
                  onSelect={() => runCommand(zoomToSelectedRegion)}
                >
                  <Maximize aria-hidden="true" />
                  Zoom to selected region
                </CommandItem>
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
                <CommandItem onSelect={() => runCommand(toggleTheme)}>
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

          {activeDestination === "assets" ? (
            <SectionErrorBoundary
              fallbackClassName="h-full w-full"
              label="Asset catalog"
              resetKeys={[activeRegionId, location]}
            >
            <AssetsView
              apiUrl={digitalTwinApiUrl}
              location={location}
              onOpenAsset={(assetId) => navigateTo("assets", assetId || undefined)}
              regions={regions}
              theme={activeThemeMode}
            />
            </SectionErrorBoundary>
          ) : activeDestination === "scenarios" ? (
            <ScenariosView
              activeRegionId={activeRegionId}
              creationRequest={scenarioCreationRequest}
              mapControllerRef={interactionMapControllerRef}
              mapSlot={mapHost}
              onBuilderOpenChange={setScenarioBuilderOpen}
              onRun={launchSimulation}
              regions={regions}
              theme={activeThemeMode}
            />
          ) : activeDestination === "runs" ? (
            <RunsView
              apiUrl={digitalTwinApiUrl}
              error={runCatalogError}
              isLoading={runCatalogLoading}
              location={location}
              mapControllerRef={interactionMapControllerRef}
              mapSlot={mapHost}
              onCreateScenario={() => {
                setScenarioCreationRequest((request) => request + 1);
                navigateTo("scenarios");
              }}
              onOpenRun={(runId) => navigateTo("runs", runId)}
              onRefresh={() => setRunCatalogRequest((request) => request + 1)}
              onReturnToRuns={() => navigateTo("runs")}
              regions={runCatalog.regions}
              runs={runCatalog.runs}
              theme={activeThemeMode}
            />
          ) : (
            mapHost
          )}
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
