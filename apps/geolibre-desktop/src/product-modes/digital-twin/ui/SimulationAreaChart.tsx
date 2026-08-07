import { Card, CardContent, CardHeader, CardTitle, ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@geolibre/ui";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

export interface SimulationAreaSample {
  areaHectares: number;
  tick: number;
}

const chartConfig = {
  areaHectares: {
    label: "Area",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export function SimulationAreaChart({ samples }: { samples: SimulationAreaSample[] }) {
  return (
    <Card className="dt-simulation-area-chart surface-panel-muted gap-0 overflow-hidden rounded-lg py-0 shadow-none">
      <CardHeader className="px-3 py-3">
        <CardTitle className="flex items-center justify-between text-xs">
          <span>Area over time</span>
          <span className="surface-panel-muted-text font-normal">hectares</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-3">
        {samples.length ? (
          <ChartContainer className="h-[180px] w-full" config={chartConfig}>
            <AreaChart data={samples} margin={{ left: -18, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="simulation-area-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-areaHectares)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-areaHectares)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis axisLine={false} dataKey="tick" tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area dataKey="areaHectares" fill="url(#simulation-area-fill)" stroke="var(--color-areaHectares)" strokeWidth={2} type="monotone" />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="surface-panel-divider surface-panel-muted-text grid h-[120px] place-items-center rounded-md border border-dashed text-center text-xs">
            Area growth appears as simulation ticks complete.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
