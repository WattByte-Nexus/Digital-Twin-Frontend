import type { Meta, StoryObj } from "@storybook/react-vite";
import { SatelliteTerrainMap } from "@geolibre/map";

const BOULDER_ORTHOPHOTO_TILE_URL =
  "https://maps.bouldercolorado.gov/arcgis/rest/services/raster/AP2020Cached3inWM/MapServer/tile/{z}/{y}/{x}";
const BOULDER_ORTHOPHOTO_ATTRIBUTION =
  '<a href="https://maps.bouldercolorado.gov/arcgis/rest/services/raster/AP2020Cached3inWM/MapServer" target="_blank" rel="noreferrer">2020 Pictometry 3-inch imagery, City of Boulder</a>';
const BOULDER_ORTHOPHOTO_BOUNDS: [number, number, number, number] = [
  -105.539433, 39.913244, -105.044439, 40.262822,
];

const meta = {
  title: "Digital Twin/Main Map",
  component: SatelliteTerrainMap,
  parameters: {
    layout: "fullscreen",
    controls: { disable: true },
  },
  decorators: [
    (Story) => (
      <main style={{ height: "100vh", width: "100vw" }}>
        <Story />
      </main>
    ),
  ],
} satisfies Meta<typeof SatelliteTerrainMap>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SatelliteAndTerrain: Story = {
  args: {
    satelliteSource: {
      tiles: [BOULDER_ORTHOPHOTO_TILE_URL],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 21,
      bounds: BOULDER_ORTHOPHOTO_BOUNDS,
      attribution: BOULDER_ORTHOPHOTO_ATTRIBUTION,
    },
    terrainSource: {
      url: "https://tiles.mapterhorn.com/tilejson.json",
    },
    initialView: {
      center: [-105.2705, 40.015],
      zoom: 15.5,
      pitch: 55,
      bearing: -18,
    },
    terrainExaggeration: 1,
    ariaLabel: "Boulder satellite terrain map",
  },
};
