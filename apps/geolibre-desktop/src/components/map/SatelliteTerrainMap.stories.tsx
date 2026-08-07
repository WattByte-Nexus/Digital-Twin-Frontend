import type { Meta, StoryObj } from "@storybook/react-vite";
import { SatelliteTerrainMap } from "@geolibre/map";
import { SATELLITE_TERRAIN_STORY_ARGS } from "./satellite-terrain-story-config";

const meta = {
  title: "Digital Twin/Main Map",
  component: SatelliteTerrainMap,
  args: SATELLITE_TERRAIN_STORY_ARGS,
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
