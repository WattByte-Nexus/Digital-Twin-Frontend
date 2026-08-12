import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@geolibre/ui";
import { KeyRound } from "lucide-react";

export function DigitalTwinMapCredentialsNotice() {
  return (
    <div
      className="flex h-full min-h-0 w-full items-center justify-center p-6"
      data-testid="digital-twin-map-credentials-notice"
      role="status"
    >
      <Card className="glass-surface w-full max-w-md">
        <CardHeader>
          <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
            <KeyRound aria-hidden="true" className="size-5" />
          </div>
          <CardTitle>Mapbox access token required</CardTitle>
          <CardDescription>
            The Digital Twin map uses one Mapbox Satellite resolution pyramid
            for consistent imagery at every zoom level.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Add <code className="font-mono text-foreground">VITE_MAPBOX_ACCESS_TOKEN</code>{" "}
          in Environment Variables. The map loads automatically after the
          token is saved.
        </CardContent>
      </Card>
    </div>
  );
}
