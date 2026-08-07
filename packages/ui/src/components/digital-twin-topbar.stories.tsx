import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
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
  activeDestination: "live" as const,
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
  onNavigate: fn(),
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

export const ScenariosActive: Story = {
  args: {
    activeDestination: "scenarios",
    alertsCount: 2,
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

export const CompactNavigationOpen: Story = {
  decorators: [
    (Story) => (
      <div className="w-[920px] max-w-full">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", {
        name: /change digital twin section.*current section: live/i,
      })
    );
    const scenariosItem = await within(document.body).findByRole("menuitem", {
      name: /Scenarios Bounded what-if studies/i,
    });
    await expect(scenariosItem).toBeVisible();
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
