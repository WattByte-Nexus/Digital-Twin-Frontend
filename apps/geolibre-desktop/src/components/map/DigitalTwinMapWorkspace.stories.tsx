import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { DigitalTwinMapWorkspace } from "../../product-modes/digital-twin/ui/DigitalTwinMapWorkspace";

const meta = {
  title: "Digital Twin/Map Workspace",
  component: DigitalTwinMapWorkspace,
  args: {
    themeMode: "light",
    showLidar: true,
    showWeather: false,
  },
  argTypes: {
    themeMode: {
      control: "inline-radio",
      options: ["light", "dark"],
    },
  },
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <main style={{ height: "100vh", width: "100vw" }}>
        <Story />
      </main>
    ),
  ],
} satisfies Meta<typeof DigitalTwinMapWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};

export const EntitySearchOpen: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", {
        name: "Search regions, assets, alerts, and runs",
      })
    );
    await expect(
      within(document.body).getByRole("dialog", { name: "Search Digital Twin" })
    ).toBeVisible();
    await expect(
      within(document.body).getByPlaceholderText(
        "Search regions, assets, alerts, and runs..."
      )
    ).toHaveFocus();
    await expect(
      within(document.body).getByRole("group", { name: "Assets" })
    ).toBeVisible();
    await expect(
      within(document.body).getByRole("group", { name: "Alerts" })
    ).toBeVisible();
    await expect(
      within(document.body).getByRole("group", { name: "Runs" })
    ).toBeVisible();
  },
};

export const GeneralCommandPaletteOpen: Story = {
  play: async () => {
    await userEvent.keyboard("{Control>}k{/Control}");
    await expect(
      within(document.body).getByRole("dialog", {
        name: "Workspace command palette",
      })
    ).toBeVisible();
    await expect(
      within(document.body).queryByRole("dialog", {
        name: "Search Digital Twin",
      })
    ).not.toBeInTheDocument();
  },
};

export const RegionSelection: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", {
        name: /change assigned region.*colorado front range/i,
      })
    );
    await userEvent.click(
      within(document.body).getByRole("menuitemradio", {
        name: /denver metro/i,
      })
    );
    await expect(
      canvas.getByRole("button", {
        name: /change assigned region.*denver metro/i,
      })
    ).toBeVisible();
  },
};

export const Dark: Story = {
  args: { themeMode: "dark" },
};

export const WithWeather: Story = {
  args: { showWeather: true },
};
