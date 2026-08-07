import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { DigitalTwinMonitoringStatus } from "./digital-twin-monitoring-status";

const meta = {
  title: "Digital Twin/Monitoring Status",
  component: DigitalTwinMonitoringStatus,
  args: {
    detail: "Updated 2 min ago",
    label: "Current",
    onOpenDiagnostics: fn(),
    themeMode: "dark",
    tone: "current",
  },
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof DigitalTwinMonitoringStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Current: Story = {};

export const Degraded: Story = {
  args: {
    detail: "Weather input stale since 10:42 MDT",
    label: "Degraded",
    tone: "degraded",
  },
};

export const Offline: Story = {
  args: {
    detail: "Last contact 18 min ago",
    label: "Offline",
    tone: "offline",
  },
};

export const Light: Story = {
  args: {
    themeMode: "light",
  },
};

export const MenuOpen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", {
        name: /monitoring status: current/i,
      })
    );
    await expect(
      within(document.body).getByText("Decision-support diagnostics")
    ).toBeVisible();
  },
};
