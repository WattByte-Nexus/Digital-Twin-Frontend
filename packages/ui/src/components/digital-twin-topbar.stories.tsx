import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import {
  DEFAULT_DIGITAL_TWIN_MAP_DISPLAY_SETTINGS,
  DigitalTwinMapToolbar,
} from "./digital-twin-map-toolbar";
import { DigitalTwinTopbar } from "./digital-twin-topbar";

const regions = [
  {
    id: "boulder",
    name: "Boulder County",
    description: "Foothills assets and wildfire exposure",
  },
  {
    id: "foothills",
    name: "North Foothills",
    description: "Mountain corridor operations and monitoring",
  },
  {
    id: "sandbox",
    name: "Qualification Sandbox",
    description: "Isolated workspace for model validation",
  },
];

const defaultArgs = {
  activeRegionId: "boulder",
  alertsCount: 7,
  operator: {
    name: "Maya Chen",
    role: "Grid operations supervisor",
    initials: "MC",
  },
  organizationName: "Front Range Electric",
  regions,
  themeMode: "dark" as const,
  onOpenAdministration: fn(),
  onOpenAlerts: fn(),
  onOpenDiagnostics: fn(),
  onOpenExpertWorkspace: fn(),
  onOpenHelp: fn(),
  onOpenSearch: fn(),
  onSelectRegion: fn(),
  onSignOut: fn(),
  onToggleTheme: fn(),
};

const meta = {
  title: "Digital Twin/Topbar",
  component: DigitalTwinTopbar,
  args: defaultArgs,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof DigitalTwinTopbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OperationsDesktop: Story = {};

export const RegionMenuOpen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", {
        name: /change assigned region/i,
      })
    );
    await expect(
      within(document.body).getByText("Qualification Sandbox")
    ).toBeVisible();
  },
};

export const OperatorMenuOpen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: /operator and system menu/i })
    );
    await expect(
      within(document.body).getByText("Open Expert GIS workspace")
    ).toBeVisible();
  },
};

export const CompactWorkstation: Story = {
  decorators: [
    (Story) => (
      <div className="w-[920px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

export const WithMapToolbar: Story = {
  args: {
    mapToolbar: (
      <DigitalTwinMapToolbar
        className="h-10 rounded-md border-0 bg-transparent p-0 shadow-none"
        onResetOrientation={fn()}
        onValueChange={fn()}
        onViewModeChange={fn()}
        theme="dark"
        value={DEFAULT_DIGITAL_TWIN_MAP_DISPLAY_SETTINGS}
        viewMode="3d"
      />
    ),
  },
};

export const ThemeToggle: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: /switch to light mode/i })
    );
    await expect(args.onToggleTheme).toHaveBeenCalledOnce();
  },
};

export const Light: Story = {
  args: {
    themeMode: "light",
  },
};
