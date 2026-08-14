import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  getMapboxGlyphsUrl,
  getMapboxSatelliteTileUrlTemplate,
  getMapboxStreetsTileJsonUrl,
} from "@geolibre/core";
import { SatelliteTerrainMap } from "@geolibre/map";
import { createDigitalTwinSatelliteTerrainConfig } from "../../product-modes/digital-twin/satellite-terrain-config";
import { DigitalTwinMapCredentialsNotice } from "../../product-modes/digital-twin/ui/DigitalTwinMapCredentialsNotice";

function DigitalTwinSatelliteTerrainStory() {
  const glyphsUrl = getMapboxGlyphsUrl();
  const satelliteTileUrlTemplate = getMapboxSatelliteTileUrlTemplate();
  const streetsTileJsonUrl = getMapboxStreetsTileJsonUrl();
  return glyphsUrl && satelliteTileUrlTemplate && streetsTileJsonUrl ? (
    <SatelliteTerrainMap
      {...createDigitalTwinSatelliteTerrainConfig(
        satelliteTileUrlTemplate,
        streetsTileJsonUrl,
        glyphsUrl,
      )}
    />
  ) : (
    <DigitalTwinMapCredentialsNotice />
  );
}

const meta = {
  title: "Digital Twin/Main Map",
  component: DigitalTwinSatelliteTerrainStory,
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
} satisfies Meta<typeof DigitalTwinSatelliteTerrainStory>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The reusable map component with no product controls or status chrome. */
export const SatelliteAndTerrain: Story = {};
