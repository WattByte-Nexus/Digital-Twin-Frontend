import { Button } from "@geolibre/ui";
import { Activity, Map, Wrench } from "lucide-react";
import type { DigitalTwinAccessContext } from "./access";

interface AdministrationLandingProps {
  access: DigitalTwinAccessContext;
  screen?: "administration" | "diagnostics";
  onOpenAdministration?: () => void;
  onOpenDiagnostics: () => void;
  onOpenExpertWorkspace?: () => void;
}

/** Safe non-operational landing surface for administrators without region scope. */
export function AdministrationLanding({
  access,
  screen = "administration",
  onOpenAdministration,
  onOpenDiagnostics,
  onOpenExpertWorkspace,
}: AdministrationLandingProps) {
  const diagnostics = screen === "diagnostics";
  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <header className="mx-auto flex max-w-5xl items-center gap-3 border-b pb-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Map aria-hidden="true" className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-semibold text-primary">GeoLibre · Digital Twin</p>
          <h1 className="text-xl font-semibold">
            {diagnostics ? "Diagnostics" : "Administration"}
          </h1>
        </div>
        <span className="ms-auto text-sm text-muted-foreground">{access.displayName}</span>
      </header>
      <section className="mx-auto mt-8 max-w-5xl rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium">{access.organization.name}</p>
        <h2 className="mt-1 text-lg font-semibold">
          {diagnostics
            ? "Product readiness and connections"
            : "Deployment and access administration"}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {diagnostics
            ? "Protected operational content remains unloaded while system readiness is inspected."
            : "This account has administrative access without operational region scope. No simulated map, asset, alert, or run data has been loaded."}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {diagnostics ? (
            onOpenAdministration ? (
              <Button onClick={onOpenAdministration} variant="outline">
                Administration
              </Button>
            ) : null
          ) : (
            <Button onClick={onOpenDiagnostics} variant="outline">
              <Activity aria-hidden="true" className="h-4 w-4" />
              Diagnostics
            </Button>
          )}
          {onOpenExpertWorkspace ? (
            <Button onClick={onOpenExpertWorkspace} variant="outline">
              <Wrench aria-hidden="true" className="h-4 w-4" />
              Expert GIS
            </Button>
          ) : null}
        </div>
      </section>
    </main>
  );
}
