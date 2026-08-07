import { SatelliteTerrainMap } from "@geolibre/map";
import {
  Button,
  DEFAULT_DIGITAL_TWIN_MAP_DISPLAY_SETTINGS,
  DigitalTwinMapStatus,
  DigitalTwinMapToolbar,
  DigitalTwinMonitoringStatus,
  DigitalTwinTopbar,
  WeatherSettingsPopover,
  type DigitalTwinMapDisplaySettings,
} from "@geolibre/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CloudSun } from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { SATELLITE_TERRAIN_STORY_ARGS } from "./satellite-terrain-story-config";

type WorkspaceTheme = "light" | "dark";

interface DigitalTwinMapWorkspaceProps {
  showWeather?: boolean;
  themeMode?: WorkspaceTheme;
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

function DigitalTwinMapWorkspace({
  showWeather = false,
  themeMode = "light",
}: DigitalTwinMapWorkspaceProps) {
  const mapRef = useRef<MapLibreMap | null>(null);
  const [displaySettings, setDisplaySettings] =
    useState<DigitalTwinMapDisplaySettings>(
      DEFAULT_DIGITAL_TWIN_MAP_DISPLAY_SETTINGS
    );
  const [viewMode, setViewMode] = useState<"3d" | "plan">("3d");
  const [activeThemeMode, setActiveThemeMode] = useState(themeMode);
  const visibleDetailCount = Object.entries(displaySettings).filter(
    ([key, visible]) => key !== "satellite" && key !== "elevation" && visible
  ).length;

  useEffect(() => {
    setActiveThemeMode(themeMode);
  }, [themeMode]);

  const changeViewMode = (mode: "3d" | "plan") => {
    setViewMode(mode);
    mapRef.current?.easeTo({
      pitch: mode === "3d" ? SATELLITE_TERRAIN_STORY_ARGS.initialView.pitch : 0,
      duration: 400,
    });
  };

  return (
    <div
      className={`${
        activeThemeMode === "dark" ? "dark" : "theme-light"
      } flex h-full w-full flex-col overflow-hidden bg-background`}
    >
      <DigitalTwinTopbar
        activeDestination="live"
        activeRegionId="front-range"
        alertsCount={7}
        operator={{
          name: "Maya Chen",
          role: "Grid operations supervisor",
          initials: "MC",
        }}
        organizationName="WattByte Nexus"
        regions={WORKSPACE_REGIONS}
        themeMode={activeThemeMode}
        onToggleTheme={() => {
          setActiveThemeMode((current) =>
            current === "light" ? "dark" : "light"
          );
        }}
      />

      <div className="relative min-h-0 flex-1 overflow-hidden bg-background">
        <SatelliteTerrainMap
          {...SATELLITE_TERRAIN_STORY_ARGS}
          satelliteVisible={displaySettings.satellite}
          elevationEnabled={displaySettings.elevation}
          referenceOverlayVisibility={displaySettings}
          onMapReady={(map) => {
            mapRef.current = map;
          }}
        />

        <div className="absolute left-4 top-4 z-10">
          <DigitalTwinMapToolbar
            theme={activeThemeMode}
            value={displaySettings}
            viewMode={viewMode}
            onValueChange={setDisplaySettings}
            onViewModeChange={changeViewMode}
            onResetOrientation={() => {
              mapRef.current?.easeTo({ bearing: 0, duration: 400 });
            }}
          />
        </div>

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
          <div className="absolute right-4 top-4 z-10">
            <WeatherSettingsPopover
              theme={activeThemeMode}
              location="Boulder County, Colorado"
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
    </div>
  );
}

const meta = {
  title: "Digital Twin/Map Workspace",
  component: DigitalTwinMapWorkspace,
  args: {
    themeMode: "light",
    showWeather: false,
  },
  argTypes: {
    themeMode: {
      control: "inline-radio",
      options: ["light", "dark"],
    },
  },
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <main style={{ height: "100vh", width: "100vw" }}>
        <Story />
      </main>
    ),
  ],
} satisfies Meta<typeof DigitalTwinMapWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};

export const Dark: Story = {
  args: { themeMode: "dark" },
};

export const WithWeather: Story = {
  args: { showWeather: true },
};
