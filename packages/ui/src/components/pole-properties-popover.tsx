import {
  Activity,
  Cable,
  Check,
  ChevronRight,
  CircleAlert,
  CloudSun,
  Database,
  MapPin,
  UtilityPole,
  Wind,
} from "lucide-react";
import * as React from "react";

import { Badge } from "./badge";
import {
  AssetPropertiesPopover,
  type AssetPropertiesPopoverPositionProps,
  PropertyRow,
  SectionHeading,
} from "./asset-properties-popover";
import { ScrollArea } from "./scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

export interface PolePropertiesLocation {
  elevationM: number;
  latitude: number;
  longitude: number;
}

export interface PolePropertiesObservation {
  confidence: number;
  observedAt?: string;
  source: string;
}

export interface PolePropertiesPhysics {
  cachedFromTick?: number | null;
  failureKind?: "non_convergent" | "solver_error";
  maxDisplacementM?: number;
  modelVersion: string;
  solverVersion?: string | null;
  source: "surrogate" | "cached" | "fem" | "failed";
  status: "succeeded" | "failed";
  surrogateConfidence?: number | null;
  tick: number;
  weatherSourceRef: string;
  weatherVersion: string;
  windSpeedMps?: number;
}

export interface PolePropertiesConnectedSpan {
  assetId: string;
  endpoint: "start" | "end";
  horizontalTensionN?: number | null;
  latestPhysics?: PolePropertiesPhysics | null;
  name?: string | null;
  spanLengthM?: number | null;
  staticSagM?: number | null;
  reviewStatus?: string;
  evidenceCount?: number;
}

export interface PolePropertiesAsset {
  assetId: string;
  connectedSpans: readonly PolePropertiesConnectedSpan[];
  location: PolePropertiesLocation;
  name: string;
  observation?: PolePropertiesObservation | null;
  poleType?: string | null;
  regionId: string;
  networkReview?: string;
}

export interface PolePropertiesPopoverProps extends AssetPropertiesPopoverPositionProps {
  asset: PolePropertiesAsset;
  onOpenSpan?: (assetId: string) => void;
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        <Icon aria-hidden="true" className="size-3.5" />
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

function formatCoordinate(value: number) {
  return value.toFixed(6);
}

function formatMeters(value?: number | null) {
  return value == null ? "Not available" : `${value.toFixed(2)} m`;
}

function formatNewtons(value?: number | null) {
  return value == null
    ? "Not available"
    : `${Math.round(value).toLocaleString()} N`;
}

function latestSpanPhysics(spans: readonly PolePropertiesConnectedSpan[]) {
  return spans
    .map((span) => span.latestPhysics)
    .filter((physics): physics is PolePropertiesPhysics => physics != null)
    .sort((left, right) => right.tick - left.tick)[0];
}

function OverviewTab({
  asset,
  onOpenSpan,
}: {
  asset: PolePropertiesAsset;
  onOpenSpan?: (assetId: string) => void;
}) {
  return (
    <TabsContent className="space-y-5 px-4 py-4" value="properties">
      {asset.observation ? (
        <section aria-labelledby="pole-observation-heading">
          <SectionHeading>Observed asset</SectionHeading>
          <div className="mt-2 flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Check aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h4
                className="text-sm font-medium text-foreground"
                id="pole-observation-heading"
              >
                Pole classification
              </h4>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {asset.observation.source}
              </p>
            </div>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {Math.round(asset.observation.confidence * 100)}%
            </span>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="pole-identity-heading">
        <SectionHeading id="pole-identity-heading">Identity</SectionHeading>
        <dl className="mt-1 divide-y">
          <PropertyRow label="Asset ID" value={asset.assetId} />
          <PropertyRow label="Region" value={asset.regionId} />
          <PropertyRow
            label="Structure type"
            value={asset.poleType ?? "Pole"}
          />
        </dl>
      </section>

      <section aria-labelledby="pole-position-heading">
        <div className="flex items-center gap-2">
          <MapPin aria-hidden="true" className="size-3.5 text-muted-foreground" />
          <SectionHeading id="pole-position-heading">Position</SectionHeading>
        </div>
        <dl className="mt-1 divide-y">
          <PropertyRow
            label="Latitude"
            value={
              <span className="tabular-nums">
                {formatCoordinate(asset.location.latitude)}°
              </span>
            }
          />
          <PropertyRow
            label="Longitude"
            value={
              <span className="tabular-nums">
                {formatCoordinate(asset.location.longitude)}°
              </span>
            }
          />
          <PropertyRow
            label="Support elevation"
            value={
              <span className="tabular-nums">
                {asset.location.elevationM.toFixed(1)} m
              </span>
            }
          />
        </dl>
      </section>

      <section aria-labelledby="pole-network-heading">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Cable aria-hidden="true" className="size-3.5 text-muted-foreground" />
            <SectionHeading id="pole-network-heading">{asset.networkReview ? "Candidate connections" : "Connected spans"}</SectionHeading>
          </div>
          <Badge variant="secondary">{asset.connectedSpans.length}</Badge>
        </div>
        {asset.networkReview ? (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{asset.networkReview}</p>
        ) : null}
        <div className="mt-2 space-y-2">
          {asset.connectedSpans.map((span) => (
            <button
              className="flex min-h-11 w-full items-center gap-3 rounded-lg border bg-background px-3 py-2 text-left transition-[background-color,transform] duration-150 ease-out hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]"
              key={span.assetId}
              onClick={() => onOpenSpan?.(span.assetId)}
              disabled={!onOpenSpan || Boolean(span.reviewStatus)}
              type="button"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                <Cable aria-hidden="true" className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-foreground">
                  {span.name ?? span.assetId}
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {span.endpoint} support · {formatMeters(span.spanLengthM)}
                </span>
                {span.reviewStatus ? (
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {span.reviewStatus}{span.evidenceCount ? ` · ${span.evidenceCount} ${span.evidenceCount === 1 ? "fragment" : "fragments"}` : ""}
                  </span>
                ) : null}
              </span>
              <ChevronRight
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
              />
            </button>
          ))}
        </div>
      </section>
    </TabsContent>
  );
}

function EnvironmentTab({ asset }: { asset: PolePropertiesAsset }) {
  const physics = latestSpanPhysics(asset.connectedSpans);
  const selectedSpan = asset.connectedSpans.find(
    (span) => span.latestPhysics?.tick === physics?.tick
  );

  if (!physics) {
    return (
      <TabsContent className="px-4 py-4" value="environment">
        <div className="rounded-lg border border-dashed p-5 text-center">
          <CloudSun
            aria-hidden="true"
            className="mx-auto size-5 text-muted-foreground"
          />
          <p className="mt-2 text-sm font-medium text-foreground">
            No completed environment result
          </p>
          <p className="mx-auto mt-1 max-w-[32ch] text-xs leading-relaxed text-muted-foreground">
            {asset.networkReview ? "Reconstructed candidates require verification before they can be used in a simulation." : "Run a scenario to calculate wind response for spans connected to this pole."}
          </p>
        </div>
      </TabsContent>
    );
  }

  return (
    <TabsContent className="space-y-5 px-4 py-4" value="environment">
      <section aria-labelledby="pole-environment-status">
        <div className="flex items-start justify-between gap-3">
          <div>
            <SectionHeading>Latest Engine result</SectionHeading>
            <h3
              className="mt-1 text-sm font-medium text-foreground"
              id="pole-environment-status"
            >
              {selectedSpan?.name ?? selectedSpan?.assetId ?? "Connected span"}
            </h3>
          </div>
          <Badge
            className="uppercase tracking-[0.06em]"
            variant={physics.status === "succeeded" ? "secondary" : "destructive"}
          >
            {physics.status === "succeeded" ? (
              <Activity aria-hidden="true" />
            ) : (
              <CircleAlert aria-hidden="true" />
            )}
            {physics.source}
          </Badge>
        </div>

        {physics.status === "succeeded" ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Metric
              icon={Wind}
              label="Wind speed"
              value={`${physics.windSpeedMps?.toFixed(1) ?? "—"} m/s`}
            />
            <Metric
              icon={Activity}
              label="Max movement"
              value={`${physics.maxDisplacementM?.toFixed(2) ?? "—"} m`}
            />
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            The latest solver result failed: {physics.failureKind?.replace("_", " ") ?? "unknown failure"}.
          </div>
        )}
      </section>

      <section aria-labelledby="pole-span-properties-heading">
        <SectionHeading id="pole-span-properties-heading">
          Span properties
        </SectionHeading>
        <dl className="mt-1 divide-y">
          <PropertyRow
            label="Span length"
            value={formatMeters(selectedSpan?.spanLengthM)}
          />
          <PropertyRow
            label="Static sag"
            value={formatMeters(selectedSpan?.staticSagM)}
          />
          <PropertyRow
            label="Horizontal tension"
            value={formatNewtons(selectedSpan?.horizontalTensionN)}
          />
          <PropertyRow label="Completed tick" value={physics.tick} />
        </dl>
      </section>

      <p className="rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
        These values reflect the latest completed Engine physics tick. Run a
        scenario to calculate an updated response.
      </p>
    </TabsContent>
  );
}

function LineageTab({ asset }: { asset: PolePropertiesAsset }) {
  const physics = latestSpanPhysics(asset.connectedSpans);

  return (
    <TabsContent className="space-y-5 px-4 py-4" value="lineage">
      <section aria-labelledby="pole-api-source-heading">
        <div className="flex items-center gap-2">
          <Database aria-hidden="true" className="size-3.5 text-muted-foreground" />
            <SectionHeading id="pole-api-source-heading">
              Digital Twin Engine
            </SectionHeading>
        </div>
        <dl className="mt-1 divide-y">
          <PropertyRow
            label="Resource"
            value={
              <span className="font-mono text-[11px]">
                /api/v1/regions/{asset.regionId}/assets
              </span>
            }
          />
          <PropertyRow
            label="Support model"
            value={asset.networkReview ? "Measured survey support" : "Connected span endpoints"}
          />
          <PropertyRow
            label="Source of truth"
            value={asset.networkReview ? "Engine measurements; candidate topology derived for display" : "Versioned Engine state"}
          />
        </dl>
      </section>

      {physics ? (
        <section aria-labelledby="pole-calculation-lineage-heading">
          <SectionHeading id="pole-calculation-lineage-heading">
            Calculation lineage
          </SectionHeading>
          <dl className="mt-1 divide-y">
            <PropertyRow label="Weather version" value={physics.weatherVersion} />
            <PropertyRow label="Weather source" value={physics.weatherSourceRef} />
            <PropertyRow label="Model" value={physics.modelVersion} />
            <PropertyRow
              label="Solver"
              value={physics.solverVersion ?? physics.source.toUpperCase()}
            />
            {physics.surrogateConfidence != null ? (
              <PropertyRow
                label="Model confidence"
                value={`${Math.round(physics.surrogateConfidence * 100)}%`}
              />
            ) : null}
          </dl>
        </section>
      ) : null}

      <div className="flex gap-3 rounded-lg border bg-muted/30 p-3">
        <CircleAlert
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          {asset.networkReview ?? "This view groups shared span endpoints into one pole selection. Pole positions are read-only."}
        </p>
      </div>
    </TabsContent>
  );
}

export function PolePropertiesPopover({
  asset,
  onOpenSpan,
  ...props
}: PolePropertiesPopoverProps) {
  return (
    <AssetPropertiesPopover
      {...props}
      assetName={asset.name}
      assetKind="Pole"
      icon={UtilityPole}
      description={`${asset.assetId} · ${asset.connectedSpans.length} ${asset.networkReview ? `candidate connection${asset.connectedSpans.length === 1 ? "" : "s"}` : `connected span${asset.connectedSpans.length === 1 ? "" : "s"}`}`}
    >
      <Tabs className="min-h-0 gap-0" defaultValue="properties">
        <div className="border-b px-4 py-2">
          <TabsList className="grid w-full grid-cols-3" variant="default">
            <TabsTrigger value="properties">Properties</TabsTrigger>
            <TabsTrigger value="environment">Environment</TabsTrigger>
            <TabsTrigger value="lineage">Lineage</TabsTrigger>
          </TabsList>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <OverviewTab asset={asset} onOpenSpan={onOpenSpan} />
          <EnvironmentTab asset={asset} />
          <LineageTab asset={asset} />
        </ScrollArea>
      </Tabs>
    </AssetPropertiesPopover>
  );
}
