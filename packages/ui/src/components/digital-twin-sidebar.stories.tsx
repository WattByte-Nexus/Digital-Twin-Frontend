import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { DigitalTwinSidebar } from "./digital-twin-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "./sidebar";

const regions = [
  {
    id: "boulder",
    name: "Boulder County",
    description: "Foothills assets and wildfire exposure",
  },
  {
    id: "sandbox",
    name: "Qualification Sandbox",
    description: "Isolated workspace for model validation",
  },
];

const meta = {
  title: "Digital Twin/Sidebar",
  component: DigitalTwinSidebar,
  args: {
    activeDestination: "live",
    activeRegionId: "boulder",
    appVersion: "v2.2.0",
    onNavigate: fn(),
    onOpenAlerts: fn(),
    onOpenData: fn(),
    onOpenSettings: fn(),
    onSelectRegion: fn(),
    regions,
    themeMode: "light",
  },
  decorators: [
    (Story, context) => (
      <SidebarProvider
        defaultOpen={context.parameters.sidebarDefaultOpen !== false}
        style={{ "--sidebar-width": "12rem" } as CSSProperties}
      >
        <Story />
        <SidebarInset>
          <header className="flex h-16 items-center gap-3 border-b px-4">
            <SidebarTrigger />
            <span className="text-sm font-medium">Map workspace</span>
          </header>
        </SidebarInset>
      </SidebarProvider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof DigitalTwinSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Scenarios/i }));
    await expect(args.onNavigate).toHaveBeenCalledWith("scenarios");
    await userEvent.click(canvas.getByRole("button", { name: "Alerts" }));
    await expect(args.onOpenAlerts).toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Data" }));
    await expect(args.onOpenData).toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Settings" }));
    await expect(args.onOpenSettings).toHaveBeenCalled();
  },
};

export const RunsActive: Story = {
  args: {
    activeDestination: "runs",
  },
};

export const RegionMenuOpen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: /change assigned region/i })
    );
    await expect(
      within(document.body).getByText("Qualification Sandbox")
    ).toBeVisible();
  },
};

export const Dark: Story = {
  args: {
    themeMode: "dark",
  },
};

export const Collapsed: Story = {
  parameters: {
    sidebarDefaultOpen: false,
  },
};
