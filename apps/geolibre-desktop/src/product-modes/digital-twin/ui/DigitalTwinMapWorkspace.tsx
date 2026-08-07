import { MapboxOverlay } from "@deck.gl/mapbox";
import { SatelliteTerrainMap } from "@geolibre/map";
import {
  Badge,
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
  WeatherSettingsPopover,
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
import { useEffect, useRef, useState } from "react";
import {
  createGoldenUsgsLidarLayer,
  DIGITAL_TWIN_LIDAR_OVERLAY_PROPS,
} from "../digital-twin-lidar";
import { DIGITAL_TWIN_SATELLITE_TERRAIN_CONFIG } from "../satellite-terrain-config";
import {
  createWeatherSunSimulationController,
  type WeatherSunSimulationController,
} from "../weather-sun-simulation";

export type WorkspaceTheme = "light" | "dark";
type LidarStatus = "loading" | "ready" | "error";

export interface DigitalTwinMapWorkspaceProps {
  activeDestination?: DigitalTwinDestination;
  activeRegionId?: string;
  operator?: DigitalTwinOperator;
  organizationName?: string;
  regions?: DigitalTwinRegion[];
  showLidar?: boolean;
  showWeather?: boolean;
  themeMode?: WorkspaceTheme;
  onNavigate?: (destination: DigitalTwinDestination) => void;
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
    description: "High · Boulder Creek Substation · 8 min ago",
    regionId: "boulder",
  },
  {
    id: "alert-transformer-loading",
    name: "Transformer loading anomaly",
    description: "Medium · Denver Feeder 12 · 21 min ago",
    regionId: "denver",
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
  const lidarOverlayRef = useRef<MapboxOverlay | null>(null);
  const weatherSunRef = useRef<WeatherSunSimulationController | null>(null);
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
  const activeRegionId = controlledRegionId ?? localRegionId;
  const activeDestination = controlledDestination ?? localDestination;
  const [weatherSettings, setWeatherSettings] = useState<WeatherSettingsValue>(
    () => ({
      ...DEFAULT_WEATHER_SETTINGS,
      events: { ...DEFAULT_WEATHER_SETTINGS.events },
    })
  );
  const [lidarStatus, setLidarStatus] = useState<LidarStatus>("loading");

  const [searchOpen, setSearchOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
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
      const overlay = lidarOverlayRef.current;
      const map = mapRef.current;
      if (overlay && map) map.removeControl(overlay);
      lidarOverlayRef.current = null;
    },
    []
  );

  const handleMapReady = (map: MapLibreMap | null) => {
    const previousOverlay = lidarOverlayRef.current;
    const previousMap = mapRef.current;
    if (previousOverlay && previousMap) previousMap.removeControl(previousOverlay);
    lidarOverlayRef.current = null;
    weatherSunRef.current?.destroy();
    weatherSunRef.current = null;
    mapRef.current = map;
    if (map) {
      if (showLidar) {
        setLidarStatus("loading");
        const lidarLayer = createGoldenUsgsLidarLayer({
          onReady: () => setLidarStatus("ready"),
          onError: (error) => {
            console.error("Golden USGS LiDAR could not be loaded", error);
            setLidarStatus("error");
          },
        });
        const lidarOverlay = new MapboxOverlay({
          ...DIGITAL_TWIN_LIDAR_OVERLAY_PROPS,
          layers: [lidarLayer],
        });
        map.addControl(lidarOverlay);
        lidarOverlayRef.current = lidarOverlay;
      }
      weatherSunRef.current = createWeatherSunSimulationController(
        map,
        weatherSettings
      );
    }
  };

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

  const navigateTo = (destination: DigitalTwinDestination) => {
    setLocalDestination(destination);
    onNavigate?.(destination);
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

          <div className="relative min-h-0 flex-1 overflow-hidden bg-background">
            <SatelliteTerrainMap
              {...DIGITAL_TWIN_SATELLITE_TERRAIN_CONFIG}
              satelliteVisible={displaySettings.satellite}
              elevationEnabled={displaySettings.elevation}
              themeMode={activeThemeMode}
              referenceOverlayVisibility={displaySettings}
              onMapReady={handleMapReady}
            />

            <div className="absolute bottom-4 left-4 z-10">
              <DigitalTwinMapStatus
                viewMode={viewMode}
                visibleDetailCount={visibleDetailCount}
              />
            </div>

            {showLidar ? (
              <div className="absolute left-4 top-4 z-10">
                <Badge variant="secondary" aria-live="polite">
                  USGS 3DEP LiDAR · Golden · {lidarStatus}
                </Badge>
              </div>
            ) : null}

            <div className="absolute bottom-6 right-4 z-10">
              <DigitalTwinMonitoringStatus themeMode={activeThemeMode} />
            </div>

            {showWeather ? (
              <div className="absolute right-4 top-4 z-10">
                <WeatherSettingsPopover
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
              </div>
            ) : null}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
