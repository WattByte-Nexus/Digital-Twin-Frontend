import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import {
  DEFAULT_DIGITAL_TWIN_MAP_DISPLAY_SETTINGS,
  DigitalTwinMapToolbar,
  type DigitalTwinMapDisplaySettings,
  type DigitalTwinMapToolbarProps,
} from "./digital-twin-map-toolbar";

function MapCanvas({
  theme,
  value: controlledValue,
  viewMode: controlledViewMode,
  onValueChange,
  onViewModeChange,
  onResetOrientation,
  ...props
}: DigitalTwinMapToolbarProps) {
  const [value, setValue] = useState<DigitalTwinMapDisplaySettings>(controlledValue);
  const [viewMode, setViewMode] = useState<"3d" | "plan">(controlledViewMode);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    return () => document.documentElement.classList.remove("dark");
  }, [theme]);

  useEffect(() => setValue(controlledValue), [controlledValue]);
  useEffect(() => setViewMode(controlledViewMode), [controlledViewMode]);

  return (
    <main className={`${theme === "dark" ? "dark" : "theme-light"} min-h-screen bg-background p-8`}>
      <div className="flex justify-center">
        <DigitalTwinMapToolbar
          {...props}
          theme={theme}
          value={value}
          viewMode={viewMode}
          onResetOrientation={() => {
            setViewMode("plan");
            onResetOrientation?.();
          }}
          onValueChange={(next) => {
            setValue(next);
            onValueChange(next);
          }}
          onViewModeChange={(next) => {
            setViewMode(next);
            onViewModeChange(next);
          }}
        />
      </div>
    </main>
  );
}

const meta = {
  title: "Digital Twin/Map Toolbar",
  component: DigitalTwinMapToolbar,
  args: {
    theme: "light",
    value: DEFAULT_DIGITAL_TWIN_MAP_DISPLAY_SETTINGS,
    viewMode: "3d",
    onValueChange: fn(),
    onViewModeChange: fn(),
    onResetOrientation: fn(),
  },
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  render: (args: DigitalTwinMapToolbarProps) => <MapCanvas {...args} />,
} satisfies Meta<typeof DigitalTwinMapToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};

export const Dark: Story = {
  args: { theme: "dark" },
};

export const LabelsMenuOpen: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByText("Labels"));
    await expect(within(document.body).getByText("City & place names")).toBeVisible();
  },
};
