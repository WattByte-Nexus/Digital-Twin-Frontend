import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentProps } from "react";
import { WeatherSettingsFloatingPanel } from "./weather";

function WeatherCanvas({
  dark = false,
  ...props
}: ComponentProps<typeof WeatherSettingsFloatingPanel> & {
  dark?: boolean;
}) {
  return (
    <div className={`${dark ? "dark" : ""} relative min-h-[1120px] font-sans`}>
      <div className="relative min-h-[1120px]">
        <WeatherSettingsFloatingPanel
          {...props}
          defaultOpen
          theme={dark ? "dark" : "light"}
        />
      </div>
    </div>
  );
}

const meta = {
  title: "UI/Weather Settings Panel",
  component: WeatherSettingsFloatingPanel,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof WeatherSettingsFloatingPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {
  render: (args) => <WeatherCanvas {...args} />,
};

export const Dark: Story = {
  render: (args) => <WeatherCanvas {...args} dark />,
};

export const Automatic: Story = {
  render: (args) => <WeatherCanvas {...args} />,
  args: {
    initialValue: {
      mode: "auto",
      temperature: 27,
      hour: 9,
      minute: 30,
      season: "Summer",
    },
  },
};

export const ActiveWeather: Story = {
  render: (args) => <WeatherCanvas {...args} />,
  args: {
    location: "Boulder County, Colorado",
    initialValue: {
      temperature: 18,
      season: "Autumn",
      events: {
        fog: 20,
        rain: 65,
        thunder: 35,
        dust: 0,
        cloudCoverage: 82,
        wind: 34.5,
        windDirection: 225,
        snow: 0,
      },
    },
  },
};
