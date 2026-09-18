import { Card, CardContent } from "@geolibre/ui";
import type { SurveyNetwork } from "../digital-twin-survey-network";

/** Explain survey coverage and where to inspect connection evidence. */
export function SurveyNetworkLegend({ network, poleCount }: {
  network: SurveyNetwork;
  poleCount: number;
}) {
  const alignedCount = network.connections.filter(connection => connection.evidenceAssetIds.length > 0).length;
  return (
    <Card className="glass-surface pointer-events-auto w-64 gap-0 py-0">
      <CardContent className="space-y-2 p-3 text-xs">
        <p className="font-medium text-foreground">Survey network · needs review</p>
        <p className="tabular-nums text-muted-foreground">
          {poleCount - network.unconnectedPoleIds.length}/{poleCount} poles linked by {network.connections.length} candidates
        </p>
        <p className="text-muted-foreground">Select a pole for connection evidence.</p>
        <p className="text-muted-foreground">
          {alignedCount} wire-aligned · {network.connections.length - alignedCount} proximity only · {network.unconnectedPoleIds.length} isolated poles
        </p>
      </CardContent>
    </Card>
  );
}
