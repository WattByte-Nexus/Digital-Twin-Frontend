import {
  Badge, Button, Popover, PopoverContent, PopoverDescription, PopoverHeader,
  PopoverTitle, PopoverTrigger, ScrollArea, Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "@geolibre/ui";
import { Activity } from "lucide-react";
import type { DigitalTwinPowerLineAsset } from "../../../lib/digital-twin-assets";

/** Display completed conductor calculations, their weather time, and detail links. */
export function LivePhysicsPopover({ lines, weatherVersion, theme, onOpenAsset }: {
  lines: readonly DigitalTwinPowerLineAsset[];
  weatherVersion: string | null;
  theme: "light" | "dark";
  onOpenAsset: (assetId: string) => void;
}) {
  const completed = lines.filter(line => line.latestPhysics?.status === "succeeded");
  const pending = lines.filter(line => !line.latestPhysics || (weatherVersion !== null &&
    Date.parse(line.latestPhysics.weatherVersion) < Date.parse(weatherVersion))).length;
  const failed = lines.filter(line => line.latestPhysics?.status === "failed").length;
  const maxDisplacement = Math.max(0, ...completed.map(line =>
    line.latestPhysics?.status === "succeeded" ? Math.abs(line.latestPhysics.maxDisplacementM) : 0));
  const themeClass = theme === "dark" ? "dark" : "theme-light";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" className={`${themeClass} glass-surface min-h-11 gap-2 tabular-nums`} aria-label="Open live physics calculations">
          <Activity aria-hidden="true" className="size-4" />
          Physics
          <span className="text-muted-foreground">{pending ? `${pending} updating` : `${completed.length}/${lines.length} spans`}</span>
          {completed.length > 0 && <Badge variant="outline">{maxDisplacement.toFixed(3)} m max</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className={`${themeClass} surface-glass-overlay w-96 max-w-[calc(100vw-2rem)] min-w-[var(--radix-popover-trigger-width)] p-0`}>
        <PopoverHeader className="space-y-1 p-4">
          <PopoverTitle>Live conductor physics</PopoverTitle>
          <PopoverDescription>Wind-driven displacement · refreshes every 10 seconds</PopoverDescription>
          <p className="text-xs text-muted-foreground">{pending > 0 ? `${pending} spans awaiting current inputs. ` : ""}{failed > 0 ? `${failed} calculations failed. ` : ""}Includes the displayed conductor network.</p>
        </PopoverHeader>
        <ScrollArea className="max-h-80 overflow-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Span / weather time</TableHead><TableHead className="text-right">Wind</TableHead><TableHead className="text-right">Displacement</TableHead></TableRow></TableHeader>
            <TableBody>
              {lines.map((line, index) => {
                const physics = line.latestPhysics;
                return <TableRow key={line.assetId}>
                  <TableCell>
                    <Button variant="link" className="h-auto min-h-11 max-w-40 justify-start whitespace-normal p-0 text-left" onClick={() => onOpenAsset(line.assetId)}>{line.name ?? `Span ${index + 1}`}</Button>
                    <div className="text-xs text-muted-foreground">{physics ? new Date(physics.weatherVersion).toLocaleString() : "Awaiting calculation"}</div>
                    {physics && <div className="text-xs text-muted-foreground">Tick {physics.tick} · {physics.source}</div>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{physics?.status === "succeeded" ? `${physics.windSpeedMps.toFixed(1)} m/s` : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{physics?.status === "succeeded" ? `${Math.abs(physics.maxDisplacementM).toFixed(3)} m` : physics?.status === "failed" ? "Failed" : "Pending"}</TableCell>
                </TableRow>;
              })}
              {lines.length === 0 && <TableRow><TableCell colSpan={3} className="text-muted-foreground">No calculation-ready spans in this region.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
