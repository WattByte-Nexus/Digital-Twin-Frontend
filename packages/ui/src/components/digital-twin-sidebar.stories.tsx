import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { DigitalTwinSidebar } from "./digital-twin-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "./sidebar";

const meta = {
  title: "Digital Twin/Sidebar",
  component: DigitalTwinSidebar,
  args: {
    activeDestination: "live",
    onNavigate: fn(),
    themeMode: "light",
  },
  decorators: [
    (Story, context) => (
      <SidebarProvider defaultOpen={context.parameters.sidebarDefaultOpen !== false}>
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
  },
};

export const RunsActive: Story = {
  args: {
    activeDestination: "runs",
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
