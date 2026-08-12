import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type ChartConfig,
} from "@geolibre/ui";
import { AlertCircle, CheckCircle2, CircleDot, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  loadRunTab,
  type DigitalTwinRunRecord,
  type RunDetailTab,
  type RunTabData,
} from "../digital-twin-run-api";

interface RunDetailTabsProps {
  apiUrl: string;
  runId: string;
}

type TabLoadState =
  | { status: "loading" }
  | { status: "ready"; data: RunTabData }
  | { status: "error"; message: string };

const BEHAVIOR_CONFIG = {
  activeCellCount: { label: "Active fire cells", color: "hsl(var(--destructive))" },
} satisfies ChartConfig;

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return JSON.stringify(value);
}

function titleCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toLocaleUpperCase());
}

function RunMetadataTable({ run }: { run: DigitalTwinRunRecord }) {
  return (
    <Table>
      <TableBody>
        <TableRow>
          <TableCell className="text-muted-foreground">Simulation</TableCell>
          <TableCell className="text-right font-mono text-xs">{run.simulation_id}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="text-muted-foreground">Region</TableCell>
          <TableCell className="text-right">{run.region_id}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="text-muted-foreground">Status</TableCell>
          <TableCell className="text-right"><Badge variant="outline">{titleCase(run.status)}</Badge></TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="text-muted-foreground">Completed ticks</TableCell>
          <TableCell className="text-right tabular-nums">{run.tick_refs.filter(({ tick }) => tick > 0).length}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="text-muted-foreground">Final result</TableCell>
          <TableCell className="text-right">{run.final_result_ref ? "Available" : "Not available"}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function OverviewPanel({ data }: { data: Extract<RunTabData, { kind: "overview" }> }) {
  const { run } = data;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="gap-4 py-5">
        <CardHeader className="px-5">
          <CardTitle className="text-base">Authoritative run</CardTitle>
          <CardDescription>Current metadata returned by the simulation API</CardDescription>
        </CardHeader>
        <CardContent className="px-5"><RunMetadataTable run={run} /></CardContent>
      </Card>
      <Card className="gap-4 py-5">
        <CardHeader className="px-5">
          <CardTitle className="text-base">Execution lineage</CardTitle>
          <CardDescription>Identifiers that connect this run to its source request</CardDescription>
        </CardHeader>
        <CardContent className="px-5">
          <Table>
            <TableBody>
              <TableRow><TableCell className="text-muted-foreground">Trigger</TableCell><TableCell className="text-right">{titleCase(data.run.trigger.kind ?? "automatic")}</TableCell></TableRow>
              <TableRow><TableCell className="text-muted-foreground">Scenario</TableCell><TableCell className="text-right">{displayValue(data.run.trigger.scenario_id)}</TableCell></TableRow>
              <TableRow><TableCell className="text-muted-foreground">Request</TableCell><TableCell className="text-right font-mono text-xs">{displayValue(data.run.trigger.correlation_id)}</TableCell></TableRow>
              <TableRow><TableCell className="text-muted-foreground">Failure</TableCell><TableCell className="text-right">{data.run.failure ? displayValue(data.run.failure.message ?? data.run.failure.detail ?? data.run.failure.error_type) : "None"}</TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function BehaviorPanel({ data }: { data: Extract<RunTabData, { kind: "behavior" }> }) {
  if (data.samples.length === 0) {
    return <Card className="px-5 py-8 text-center text-sm text-muted-foreground">No durable fire-behavior ticks are available yet.</Card>;
  }
  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-base">Fire behavior by tick</CardTitle>
        <CardDescription>Active fire cells read from each immutable tick artifact</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 px-5">
        <ChartContainer className="h-[260px] w-full" config={BEHAVIOR_CONFIG}>
          <LineChart data={data.samples} margin={{ left: 8, right: 16, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="tick" tickLine={false} />
            <YAxis axisLine={false} tickLine={false} width={54} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey="activeCellCount" dot stroke="var(--color-activeCellCount)" strokeWidth={2} type="monotone" />
          </LineChart>
        </ChartContainer>
        <Table>
          <TableHeader><TableRow><TableHead>Tick</TableHead><TableHead>Active cells</TableHead><TableHead>Weather version</TableHead></TableRow></TableHeader>
          <TableBody>{data.samples.map((sample) => <TableRow key={sample.tick}><TableCell>{sample.tick}</TableCell><TableCell>{sample.activeCellCount.toLocaleString()}</TableCell><TableCell className="font-mono text-xs">{sample.weatherVersion ?? "Not reported"}</TableCell></TableRow>)}</TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ExposurePanel({ data }: { data: Extract<RunTabData, { kind: "exposure" }> }) {
  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const asset of data.exposedAssets) {
      const properties = asset.properties ?? {};
      const type = String(properties.asset_type ?? properties.type ?? "Unclassified");
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [data.exposedAssets]);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
      <Card className="gap-3 px-5 py-5">
        <span className="text-sm text-muted-foreground">Assets intersecting the burned footprint</span>
        <strong className="text-4xl font-semibold tracking-tight">{data.exposedAssets.length.toLocaleString()}</strong>
        <span className="text-xs text-muted-foreground">Calculated from the run result and region asset APIs</span>
      </Card>
      <Card className="gap-4 py-5">
        <CardHeader className="px-5"><CardTitle className="text-base">Exposure by asset type</CardTitle><CardDescription>Authoritative region assets spatially intersected with the result geometry</CardDescription></CardHeader>
        <CardContent className="px-5">
          {groups.length ? <Table><TableHeader><TableRow><TableHead>Asset type</TableHead><TableHead className="text-right">Exposed</TableHead></TableRow></TableHeader><TableBody>{groups.map(([type, count]) => <TableRow key={type}><TableCell>{titleCase(type)}</TableCell><TableCell className="text-right tabular-nums">{count}</TableCell></TableRow>)}</TableBody></Table> : <p className="py-6 text-center text-sm text-muted-foreground">No region assets intersect the current burned footprint.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function InputsPanel({ data }: { data: Extract<RunTabData, { kind: "inputs" }> }) {
  const entries = Object.entries(data.run.trigger).filter(([, value]) => value !== undefined);
  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5"><CardTitle className="text-base">Run inputs</CardTitle><CardDescription>Immutable trigger and model inputs returned by the run API</CardDescription></CardHeader>
      <CardContent className="px-5"><Table><TableBody>{entries.map(([key, value]) => <TableRow key={key}><TableCell className="text-muted-foreground">{titleCase(key)}</TableCell><TableCell className="max-w-xl text-right font-mono text-xs break-words">{displayValue(value)}</TableCell></TableRow>)}</TableBody></Table></CardContent>
    </Card>
  );
}

function ActivityPanel({ data }: { data: Extract<RunTabData, { kind: "activity" }> }) {
  const ticks = data.run.tick_refs.filter(({ tick }) => tick > 0);
  const hasFailed = data.run.status === "FAILED" || Boolean(data.run.failure);
  const hasCompleted = data.run.status === "COMPLETED" && !hasFailed;
  const StatusIcon = hasFailed ? AlertCircle : hasCompleted ? CheckCircle2 : CircleDot;
  const statusColor = hasFailed
    ? "text-[hsl(var(--dt-status-failed-text))]"
    : hasCompleted
      ? "text-[hsl(var(--dt-status-ok-text))]"
      : "text-muted-foreground";
  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5"><CardTitle className="text-base">Activity and logs</CardTitle><CardDescription>Durable lifecycle and tick lineage from the run API</CardDescription></CardHeader>
      <CardContent className="px-5">
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg bg-surface-subtle p-3"><CircleDot aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" /><div><p className="text-sm font-medium">Run accepted</p><p className="font-mono text-xs text-muted-foreground">{displayValue(data.run.trigger.correlation_id)}</p></div></div>
          {ticks.map(({ tick, world_state_ref: reference }) => <div className="flex items-start gap-3 rounded-lg bg-surface-subtle p-3" key={tick}><CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 text-primary" /><div><p className="text-sm font-medium text-primary">Tick {tick} completed</p><p className="font-mono text-xs text-muted-foreground break-all">{reference}</p></div></div>)}
          <div className="flex items-start gap-3 rounded-lg bg-surface-subtle p-3"><StatusIcon aria-hidden="true" className={`mt-0.5 size-4 ${statusColor}`} /><div><p className={`text-sm font-medium ${statusColor}`}>Current status: {titleCase(data.run.status)}</p>{data.run.failure ? <p className="mt-1 text-xs text-destructive">{displayValue(data.run.failure.message ?? data.run.failure.detail ?? data.run.failure.error_type)}</p> : null}</div></div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingPanel() {
  return <Card className="space-y-4 px-5 py-5" aria-busy="true" aria-label="Loading run tab"><Skeleton className="h-5 w-44" /><Skeleton className="h-28 w-full" /><Skeleton className="h-10 w-full" /></Card>;
}

function TabPanel({ state, onRetry }: { state: TabLoadState | undefined; onRetry: () => void }) {
  if (!state || state.status === "loading") return <LoadingPanel />;
  if (state.status === "error") return <Card className="items-center gap-3 px-5 py-8 text-center"><AlertCircle aria-hidden="true" className="size-6 text-destructive" /><p className="font-medium">This run data could not be loaded.</p><p className="text-sm text-muted-foreground">{state.message}</p><Button onClick={onRetry} variant="outline"><RefreshCw aria-hidden="true" /> Retry</Button></Card>;
  if (state.data.kind === "overview") return <OverviewPanel data={state.data} />;
  if (state.data.kind === "behavior") return <BehaviorPanel data={state.data} />;
  if (state.data.kind === "exposure") return <ExposurePanel data={state.data} />;
  if (state.data.kind === "inputs") return <InputsPanel data={state.data} />;
  return <ActivityPanel data={state.data} />;
}

export function RunDetailTabs({ apiUrl, runId }: RunDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<RunDetailTab>("overview");
  const [states, setStates] = useState<Partial<Record<RunDetailTab, TabLoadState>>>({});
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStates((current) => ({ ...current, [activeTab]: { status: "loading" } }));
    void loadRunTab(apiUrl, runId, activeTab, { signal: controller.signal }).then(
      (data) => setStates((current) => ({ ...current, [activeTab]: { status: "ready", data } })),
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        const message = cause instanceof Error ? cause.message : "Unexpected Digital Twin API error.";
        setStates((current) => ({ ...current, [activeTab]: { status: "error", message } }));
      },
    );
    return () => controller.abort();
  }, [activeTab, apiUrl, reloadToken, runId]);

  return (
    <Tabs onValueChange={(value) => setActiveTab(value as RunDetailTab)} value={activeTab}>
      <TabsList variant="line">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="behavior">Fire behavior</TabsTrigger>
        <TabsTrigger value="exposure">Exposure</TabsTrigger>
        <TabsTrigger value="inputs">Inputs</TabsTrigger>
        <TabsTrigger value="activity">Activity and logs</TabsTrigger>
      </TabsList>
      {(["overview", "behavior", "exposure", "inputs", "activity"] as const).map((tab) => (
        <TabsContent key={tab} value={tab}>
          <TabPanel
            onRetry={() => setReloadToken((token) => token + 1)}
            state={states[tab]}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
