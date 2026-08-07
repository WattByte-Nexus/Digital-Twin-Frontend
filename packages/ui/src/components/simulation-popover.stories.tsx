import type { Meta, StoryObj } from "@storybook/react-vite";
import { Clock3, Map, MapPin, Play, Route } from "lucide-react";
import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import airportBackdrop from "../assets/glass-sidebar-airport.png";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "./chart";
import { SimulationPopover } from "./simulation-popover";

const chartConfig = {
  area: { label: "Area", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const areaOverTime = [
  { area: 0, minute: 0 },
  { area: 12, minute: 15 },
  { area: 24, minute: 30 },
  { area: 41, minute: 45 },
  { area: 68, minute: 60 },
  { area: 96, minute: 75 },
  { area: 134, minute: 90 },
  { area: 181, minute: 105 },
  { area: 238, minute: 120 },
];

function SimulationRunSurface() {
  const [running, setRunning] = React.useState(false);

  return (
    <div className="space-y-3 p-3 text-[hsl(var(--surface-panel-foreground))]">
      <Card className="surface-panel-muted gap-0 overflow-hidden py-0 shadow-none">
        <CardHeader className="surface-panel-divider border-b px-3 py-3">
          <CardTitle className="surface-panel-muted-text flex items-center gap-2 text-xs uppercase tracking-wide">
            <Map aria-hidden="true" className="size-3.5 text-primary" />
            Run details
          </CardTitle>
        </CardHeader>
        <CardContent className="surface-panel-divider grid grid-cols-2 gap-px bg-[hsl(var(--surface-panel-border))] p-0">
          {[
            ["Scenario", "Boulder west slope"],
            ["Duration", "120 min"],
            ["Model", "Wildfire spread v2"],
            ["Resolution", "30 m"],
          ].map(([label, value]) => (
            <div className="bg-[hsl(var(--surface-panel))] p-3" key={label}>
              <span className="surface-panel-muted-text block text-[10px]">{label}</span>
              <strong className="mt-1 block text-xs">{value}</strong>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="surface-panel-muted gap-0 overflow-hidden py-0 shadow-none">
        <CardHeader className="surface-panel-divider border-b px-3 py-3">
          <CardTitle className="surface-panel-muted-text text-xs uppercase tracking-wide">Selected geometry</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-px bg-[hsl(var(--surface-panel-border))] p-0">
          <div className="flex items-center gap-3 bg-[hsl(var(--surface-panel))] p-3">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary"><MapPin aria-hidden="true" className="size-4" /></span>
            <div><strong className="block text-lg leading-none">3</strong><span className="surface-panel-muted-text text-[10px]">Points selected</span></div>
          </div>
          <div className="flex items-center gap-3 bg-[hsl(var(--surface-panel))] p-3">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary"><Route aria-hidden="true" className="size-4" /></span>
            <div><strong className="block text-lg leading-none">2</strong><span className="surface-panel-muted-text text-[10px]">Lines selected</span></div>
          </div>
        </CardContent>
      </Card>

      <Button className="w-full" disabled={running} onClick={() => setRunning(true)}>
        {running ? <Clock3 aria-hidden="true" className="size-4 animate-pulse" /> : <Play aria-hidden="true" className="size-4" />}
        {running ? "Simulation running" : "Run simulation"}
      </Button>

      <Card className="surface-panel-muted gap-0 overflow-hidden py-0 shadow-none">
        <CardHeader className="px-3 py-3">
          <CardTitle className="flex items-center justify-between text-xs">
            <span>Area over time</span>
            <span className="surface-panel-muted-text font-normal">hectares</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-3">
          <ChartContainer className="h-[180px] w-full" config={chartConfig}>
            <AreaChart data={areaOverTime} margin={{ left: -20, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="area-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-area)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-area)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis axisLine={false} dataKey="minute" tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area dataKey="area" fill="url(#area-fill)" stroke="var(--color-area)" strokeWidth={2} type="monotone" />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function StoryCanvas({ children, dark }: { children: React.ReactNode; dark: boolean }) {
  React.useEffect(() => {
    const wasDark = document.documentElement.classList.contains("dark");
    const wasLight = document.documentElement.classList.contains("theme-light");
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.classList.toggle("theme-light", !dark);
    return () => {
      document.documentElement.classList.toggle("dark", wasDark);
      document.documentElement.classList.toggle("theme-light", wasLight);
    };
  }, [dark]);

  return (
    <main className="flex min-h-screen items-start justify-end p-6 font-sans" style={{
      backgroundImage: `${dark ? "linear-gradient(rgb(4 12 12 / 35%), rgb(4 12 12 / 35%))" : "linear-gradient(rgb(255 255 255 / 34%), rgb(255 255 255 / 34%))"}, url(${airportBackdrop})`,
      backgroundPosition: "center",
      backgroundSize: "cover",
    }}>
      {children}
    </main>
  );
}

const meta = {
  title: "UI/Simulation Popover",
  component: SimulationPopover,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta<typeof SimulationPopover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DarkMode: Story = {
  args: {
    children: <SimulationRunSurface />,
    defaultOpen: true,
    trigger: <Button variant="glass">New simulation</Button>,
    theme: "dark",
  },
  render: (args) => <StoryCanvas dark><SimulationPopover {...args} /></StoryCanvas>,
};

export const Light: Story = {
  args: {
    children: <SimulationRunSurface />,
    defaultOpen: true,
    trigger: <Button variant="glass">New simulation</Button>,
    theme: "light",
  },
  render: (args) => <StoryCanvas dark={false}><SimulationPopover {...args} /></StoryCanvas>,
};
