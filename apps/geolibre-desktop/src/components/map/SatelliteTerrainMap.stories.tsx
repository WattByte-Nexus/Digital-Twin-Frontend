import type { Meta, StoryObj } from "@storybook/react-vite";
import { SatelliteTerrainMap } from "@geolibre/map";
import { DIGITAL_TWIN_SATELLITE_TERRAIN_CONFIG } from "../../product-modes/digital-twin/satellite-terrain-config";

const meta = {
  title: "Digital Twin/Main Map",
  component: SatelliteTerrainMap,
  args: DIGITAL_TWIN_SATELLITE_TERRAIN_CONFIG,
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

/** The reusable map component with no product controls or status chrome. */
export const SatelliteAndTerrain: Story = {};
