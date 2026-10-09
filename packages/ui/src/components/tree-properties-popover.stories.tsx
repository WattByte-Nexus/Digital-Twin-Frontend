import type { Meta, StoryObj } from "@storybook/react-vite";
import { TreePropertiesPopover } from "./tree-properties-popover";

const meta = {
  title: "Digital Twin/Tree Properties Popover",
  component: TreePropertiesPopover,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  args: {
    asset: {
      assetId: "GOLDEN-TREE-001",
      regionId: "golden-co",
      species: "Ponderosa pine",
      heightM: 10,
      canopyRadiusM: 3,
      location: { lat: 39.7557, lon: -105.2208 },
      sourceRef: "wildfire-rec:single-lane:tree-0",
    },
    defaultOpen: true,
    dock: "right",
    align: "start",
    side: "left",
    screenPosition: { x: 800, y: 12 },
  },
} satisfies Meta<typeof TreePropertiesPopover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { args: { theme: "dark" } };
export const MissingMeasurements: Story = {
  args: {
    asset: {
      ...meta.args.asset,
      species: null,
      heightM: null,
      canopyRadiusM: null,
      sourceRef: null,
    },
  },
};
