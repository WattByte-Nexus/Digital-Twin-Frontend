import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentProps } from "react";
import { WeatherSettingsPopover } from "./weather";

function WeatherCanvas({
  dark = false,
  ...props
}: ComponentProps<typeof WeatherSettingsPopover> & {
  dark?: boolean;
}) {
  return (
    <div
      className={`${dark ? "dark bg-zinc-950" : "bg-white"} min-h-screen p-7 font-sans`}
    >
      <div className="flex min-h-[1120px] items-start justify-center pt-3">
        <WeatherSettingsPopover
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
  component: WeatherSettingsPopover,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof WeatherSettingsPopover>;

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
