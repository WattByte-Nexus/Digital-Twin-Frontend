import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import {
  PolePropertiesPopover,
  type PolePropertiesAsset,
} from "./pole-properties-popover";

const pole: PolePropertiesAsset = {
  assetId: "pole-golden-1847",
  connectedSpans: [
    {
      assetId: "GOLDEN-SPAN-014",
      endpoint: "end",
      horizontalTensionN: 18_420,
      latestPhysics: {
        cachedFromTick: null,
        maxDisplacementM: 1.84,
        modelVersion: "power-line-surrogate-2026.07",
        solverVersion: "fem-2.4.1",
        source: "fem",
        status: "succeeded",
        surrogateConfidence: null,
        tick: 184,
        weatherSourceRef: "NWS-KBDU-2026-07-31T16:15Z",
        weatherVersion: "2026-07-31T16:15:00Z",
        windSpeedMps: 15.2,
      },
      name: "Canyon feeder · span 14",
      spanLengthM: 45.071,
      staticSagM: 2.86,
    },
    {
      assetId: "GOLDEN-SPAN-015",
      endpoint: "start",
      horizontalTensionN: 17_980,
      latestPhysics: {
        cachedFromTick: 182,
        maxDisplacementM: 1.36,
        modelVersion: "power-line-surrogate-2026.07",
        solverVersion: null,
        source: "cached",
        status: "succeeded",
        surrogateConfidence: 0.94,
        tick: 184,
        weatherSourceRef: "NWS-KBDU-2026-07-31T16:15Z",
        weatherVersion: "2026-07-31T16:15:00Z",
        windSpeedMps: 15.2,
      },
      name: "Canyon feeder · span 15",
      spanLengthM: 50.435,
      staticSagM: 3.14,
    },
  ],
  location: {
    elevationM: 1_842.6,
    latitude: 39.754412,
    longitude: -105.227173,
  },
  name: "Pole 1847",
  observation: {
    confidence: 0.98,
    observedAt: "2026-07-28T19:42:00Z",
    source: "Golden lidar · pole classification",
  },
  poleType: "Wood distribution pole",
  regionId: "golden-co",
};

const meta = {
  title: "Digital Twin/Pole Properties Popover",
  component: PolePropertiesPopover,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A Neara-inspired contextual inspector for a selected pole. Current Engine responses identify conductor spans and their support endpoints, so this UI projects connected span details around a pole selection without claiming a writable pole API resource.",
      },
    },
  },
  tags: ["autodocs"],
  args: {
    asset: pole,
    defaultOpen: true,
    onOpenChange: fn(),
    onOpenSpan: fn(),
    screenPosition: { x: 320, y: 240 },
    side: "right",
  },
} satisfies Meta<typeof PolePropertiesPopover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await body.findByRole("tab", { name: "Environment" })
    );
    await expect(body.getByText("Latest Engine result")).toBeVisible();
    await expect(body.getByText("1.84 m")).toBeVisible();
  },
};

export const Dark: Story = {
  args: { theme: "dark" },
  decorators: [
    (Story) => (
      <div className="dark min-h-screen">
        <Story />
      </div>
    ),
  ],
};

export const AwaitingEngineResult: Story = {
  args: {
    asset: {
      ...pole,
      connectedSpans: pole.connectedSpans.map((span) => ({
        ...span,
        latestPhysics: null,
      })),
    },
  },
};

export const FailedEngineResult: Story = {
  args: {
    asset: {
      ...pole,
      connectedSpans: [
        {
          ...pole.connectedSpans[0],
          latestPhysics: {
            failureKind: "non_convergent",
            modelVersion: "power-line-surrogate-2026.07",
            solverVersion: "fem-2.4.1",
            source: "failed",
            status: "failed",
            tick: 185,
            weatherSourceRef: "NWS-KBDU-2026-07-31T16:30Z",
            weatherVersion: "2026-07-31T16:30:00Z",
          },
        },
      ],
    },
  },
};
