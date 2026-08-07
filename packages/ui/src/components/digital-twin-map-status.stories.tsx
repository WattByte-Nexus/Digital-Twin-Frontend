import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useEffect } from "react";
import { DigitalTwinMapStatus } from "./digital-twin-map-status";

function StatusCanvas({
  dark = false,
  ...args
}: ComponentProps<typeof DigitalTwinMapStatus> & { dark?: boolean }) {
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    return () => document.documentElement.classList.remove("dark");
  }, [dark]);

  return (
    <main className={`${dark ? "dark" : ""} min-h-screen bg-background p-8`}>
      <div className="flex justify-center">
        <DigitalTwinMapStatus {...args} />
      </div>
    </main>
  );
}

const meta = {
  title: "Digital Twin/Map Status",
  component: DigitalTwinMapStatus,
  args: {
    viewMode: "3d",
    visibleDetailCount: 5,
  },
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  render: (args) => <StatusCanvas {...args} />,
} satisfies Meta<typeof DigitalTwinMapStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};

export const Dark: Story = {
  render: (args) => <StatusCanvas {...args} dark />,
};

export const PlanView: Story = {
  args: {
    viewMode: "plan",
    visibleDetailCount: 2,
  },
};

export const SingleDetailGroup: Story = {
  args: {
    visibleDetailCount: 1,
  },
};
