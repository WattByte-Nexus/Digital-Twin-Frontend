import {
  Button,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@geolibre/ui";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Download,
  ExternalLink,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  Square,
  X,
  Zap,
} from "lucide-react";
import { type KeyboardEvent, useMemo, useState } from "react";
import { ResizableTableView } from "./ScenariosView";
import "./table-views.css";

const TERRAIN_PREVIEW_URL = new URL(
  "../../../../../../../docs/assets/digital-twin-views/live-terrain-clean.png",
  import.meta.url
).href;

type RunStatus = "Running" | "Completed" | "Queued" | "Failed";
type RunSortKey = "id" | "scenario" | "started" | "duration" | "status";

interface SimulationRun {
  id: string;
  scenario: string;
  region: string;
  started: string;
  startedOrder: number;
  duration: string;
  durationSeconds: number;
  progress: number;
  status: RunStatus;
  owner: string;
}

const RUNS: SimulationRun[] = [
  {
    id: "RUN-2026-07-31-1013",
    scenario: "Boulder Foothills — Wind East",
    region: "Boulder Foothills",
    started: "10:13 AM",
    startedOrder: 0,
    duration: "1m 42s",
    durationSeconds: 102,
    progress: 68,
    status: "Running",
    owner: "A. Chen",
  },
  {
    id: "RUN-2026-07-31-0958",
    scenario: "Louisville Interface",
    region: "East County",
    started: "9:58 AM",
    startedOrder: 1,
    duration: "2m 08s",
    durationSeconds: 128,
    progress: 100,
    status: "Completed",
    owner: "A. Chen",
  },
  {
    id: "RUN-2026-07-31-0915",
    scenario: "North Ridge — Dry Fuels",
    region: "Boulder North",
    started: "9:15 AM",
    startedOrder: 2,
    duration: "—",
    durationSeconds: 0,
    progress: 0,
    status: "Queued",
    owner: "M. Rivera",
  },
  {
    id: "RUN-2026-07-31-0840",
    scenario: "Baseline Morning",
    region: "Boulder Foothills",
    started: "8:40 AM",
    startedOrder: 3,
    duration: "1m 51s",
    durationSeconds: 111,
    progress: 100,
    status: "Completed",
    owner: "System",
  },
  {
    id: "RUN-2026-07-30-1642",
    scenario: "High Wind Watch",
    region: "Front Range",
    started: "Yesterday",
    startedOrder: 4,
    duration: "0m 46s",
    durationSeconds: 46,
    progress: 34,
    status: "Failed",
    owner: "J. Patel",
  },
  {
    id: "RUN-2026-07-30-1510",
    scenario: "Superior South",
    region: "South County",
    started: "Yesterday",
    startedOrder: 5,
    duration: "2m 14s",
    durationSeconds: 134,
    progress: 100,
    status: "Completed",
    owner: "M. Rivera",
  },
];

const RUN_TABS = [
  ["All", 24],
  ["Running", 3],
  ["Completed", 18],
  ["Failed", 2],
  ["Queued", 1],
] as const;

function runTone(status: RunStatus): string {
  return status.toLowerCase();
}

function RunStatusPill({ status }: { status: RunStatus }) {
  return (
    <span className="dt-table-view__status" data-tone={runTone(status)}>
      {status === "Completed" ? <Check aria-hidden="true" /> : null}
      {status === "Failed" ? <AlertTriangle aria-hidden="true" /> : null}
      {status === "Running" ? <span className="dt-table-view__pulse" /> : null}
      {status}
    </span>
  );
}

function RunSortLabel({
  active,
  direction,
  label,
  onClick,
}: {
  active: boolean;
  direction: "asc" | "desc";
  label: string;
  onClick: () => void;
}) {
  const Icon = direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      aria-label={`Sort by ${label}`}
      className="dt-table-view__sort"
      onClick={onClick}
      type="button"
    >
      {label}
      {active ? <Icon aria-hidden="true" /> : null}
    </button>
  );
}

interface RunsViewProps {
  onNavigateLive: () => void;
  onOpenSimulation: () => void;
}

export function RunsView({ onNavigateLive, onOpenSimulation }: RunsViewProps) {
  const [activeRunId, setActiveRunId] = useState(RUNS[0].id);
  const [activeTab, setActiveTab] =
    useState<(typeof RUN_TABS)[number][0]>("All");
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("All regions");
  const [scenario, setScenario] = useState("All scenarios");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set([RUNS[0].id])
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [sortKey, setSortKey] = useState<RunSortKey>("started");

  const filteredRuns = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const next = RUNS.filter((run) => {
      const matchesTab = activeTab === "All" || run.status === activeTab;
      const matchesRegion = region === "All regions" || run.region === region;
      const matchesScenario =
        scenario === "All scenarios" || run.scenario === scenario;
      const matchesQuery =
        !normalizedQuery ||
        `${run.id} ${run.scenario} ${run.region} ${run.owner}`
          .toLocaleLowerCase()
          .includes(normalizedQuery);
      return matchesTab && matchesRegion && matchesScenario && matchesQuery;
    });

    next.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;
      if (sortKey === "started") {
        aValue = a.startedOrder;
        bValue = b.startedOrder;
      } else if (sortKey === "duration") {
        aValue = a.durationSeconds;
        bValue = b.durationSeconds;
      } else {
        aValue = a[sortKey];
        bValue = b[sortKey];
      }
      const comparison =
        typeof aValue === "number"
          ? aValue - Number(bValue)
          : String(aValue).localeCompare(String(bValue));
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return next;
  }, [activeTab, query, region, scenario, sortDirection, sortKey]);

  const activeRun = RUNS.find((run) => run.id === activeRunId) ?? RUNS[0];
  const allVisibleSelected =
    filteredRuns.length > 0 &&
    filteredRuns.every(({ id }) => selectedIds.has(id));

  const openRun = (runId: string) => {
    setActiveRunId(runId);
    setDetailsOpen(true);
  };

  const toggleSort = (key: RunSortKey) => {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const toggleRun = (runId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) filteredRuns.forEach(({ id }) => next.delete(id));
      else filteredRuns.forEach(({ id }) => next.add(id));
      return next;
    });
  };

  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    runId: string
  ) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openRun(runId);
  };

  const detail = (
    <div className="dt-table-view__detail-shell">
      <header className="dt-table-view__detail-header">
        <div className="dt-table-view__detail-header-copy">
          <div className="dt-table-view__detail-heading-line">
            <span className="dt-table-view__detail-kicker">Run details</span>
            <RunStatusPill status={activeRun.status} />
          </div>
          <h2>{activeRun.id}</h2>
          <p>{activeRun.scenario}</p>
        </div>
        <Button
          aria-label="Close run details"
          className="dt-table-view__icon-button"
          onClick={() => setDetailsOpen(false)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <X aria-hidden="true" />
        </Button>
      </header>

      <div className="dt-table-view__detail-scroll">
        <section className="dt-table-view__run-progress-card">
          <div className="dt-table-view__run-progress-heading">
            <strong>{activeRun.progress}%</strong>
            <div>
              <span>Simulating fire spread</span>
              <small>~48 sec</small>
            </div>
          </div>
          <div
            aria-label={`${activeRun.progress}% complete`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={activeRun.progress}
            className="dt-table-view__progress dt-table-view__progress--large"
            role="progressbar"
          >
            <span style={{ width: `${activeRun.progress}%` }} />
          </div>
        </section>

        <section className="dt-table-view__detail-section">
          <div className="dt-table-view__section-heading">
            <h3>Pipeline</h3>
            <span>3 of 4 stages</span>
          </div>
          <ol className="dt-table-view__pipeline">
            <li data-state="complete">
              <span>
                <Check aria-hidden="true" />
              </span>
              <div>
                <strong>Queued</strong>
              </div>
            </li>
            <li data-state="complete">
              <span>
                <Check aria-hidden="true" />
              </span>
              <div>
                <strong>
                  Preparing
                  <br />
                  inputs
                </strong>
              </div>
            </li>
            <li data-state="active">
              <span>
                <Zap aria-hidden="true" />
              </span>
              <div>
                <strong>
                  Running
                  <br />
                  model
                </strong>
              </div>
            </li>
            <li data-state="pending">
              <span>
                <Circle aria-hidden="true" />
              </span>
              <div>
                <strong>
                  Publishing
                  <br />
                  results
                </strong>
              </div>
            </li>
          </ol>
        </section>

        <section className="dt-table-view__detail-section">
          <div className="dt-table-view__section-heading">
            <h3>Inputs</h3>
          </div>
          <dl className="dt-table-view__detail-rows">
            <div>
              <dt>Ignition points</dt>
              <dd>1</dd>
            </div>
            <div>
              <dt>Wind</dt>
              <dd>15 mph East</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>4 hours</dd>
            </div>
            <div>
              <dt>Weather</dt>
              <dd>
                NWS · <em>Fresh</em>
              </dd>
            </div>
          </dl>
        </section>

        <section className="dt-table-view__detail-section">
          <div className="dt-table-view__section-heading">
            <h3>Live output</h3>
          </div>
          <figure className="dt-table-view__terrain dt-table-view__terrain--run">
            <img
              alt="Latest terrain output for the selected run"
              src={TERRAIN_PREVIEW_URL}
            />
          </figure>
          <div className="dt-table-view__output-metrics">
            <div>
              <span>Exposed assets</span>
              <strong>18</strong>
            </div>
            <div>
              <span>Peak intensity</span>
              <strong>High</strong>
            </div>
          </div>
        </section>

        <section className="dt-table-view__detail-section">
          <div className="dt-table-view__section-heading">
            <h3>Activity</h3>
          </div>
          <ol className="dt-table-view__activity-list">
            <li>
              <time>10:13</time>
              <span>Run queued</span>
            </li>
            <li>
              <time>10:13</time>
              <span>Inputs validated</span>
            </li>
            <li>
              <time>10:14</time>
              <span>Model started</span>
            </li>
          </ol>
        </section>

        <div className="dt-table-view__detail-actions">
          <Button
            aria-label="Cancel run unavailable in this UI preview"
            disabled
            title="Run cancellation is not available in this UI preview"
            type="button"
            variant="outline"
          >
            <Square aria-hidden="true" />
            Cancel run
          </Button>
          <Button
            className="dt-table-view__primary-button"
            onClick={onNavigateLive}
            type="button"
          >
            <ExternalLink aria-hidden="true" />
            Open live view
          </Button>
        </div>
        <Button
          aria-label="Copy run ID unavailable in this UI preview"
          className="dt-table-view__duplicate"
          disabled
          title="Copying run IDs is not available in this UI preview"
          type="button"
          variant="ghost"
        >
          Copy run ID
        </Button>
      </div>

      <footer className="dt-table-view__detail-alert">
        <span>
          <i /> 1 new high-severity alert
        </span>
        <button onClick={onNavigateLive} type="button">
          Open Live <ChevronRight aria-hidden="true" />
        </button>
      </footer>
    </div>
  );

  return (
    <ResizableTableView
      detail={detail}
      detailLabel="Run details"
      detailsOpen={detailsOpen}
      viewName="runs"
    >
      <header className="dt-table-view__page-header">
        <div>
          <h1>Runs</h1>
          <p>Monitor simulations, results, and replay</p>
        </div>
        <div className="dt-table-view__header-actions">
          <Button
            aria-label="Export runs unavailable in this UI preview"
            disabled
            title="Run export is not available in this UI preview"
            type="button"
            variant="outline"
          >
            <Download aria-hidden="true" />
            Export
          </Button>
          <Button
            className="dt-table-view__primary-button"
            onClick={onOpenSimulation}
            type="button"
          >
            <Plus aria-hidden="true" />
            New simulation
          </Button>
        </div>
      </header>

      <div className="dt-table-view__controls">
        <div className="dt-table-view__filters">
          <label className="dt-table-view__search">
            <Search aria-hidden="true" />
            <span className="sr-only">Search runs</span>
            <Input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search runs"
              type="search"
              value={query}
            />
          </label>
          <Select
            aria-label="Filter runs by region"
            onChange={(event) => setRegion(event.target.value)}
            value={region}
          >
            <option>All regions</option>
            {[...new Set(RUNS.map(({ region: runRegion }) => runRegion))].map(
              (runRegion) => (
                <option key={runRegion}>{runRegion}</option>
              )
            )}
          </Select>
          <Select
            aria-label="Filter runs by scenario"
            onChange={(event) => setScenario(event.target.value)}
            value={scenario}
          >
            <option>All scenarios</option>
            {RUNS.map(({ id, scenario: runScenario }) => (
              <option key={id}>{runScenario}</option>
            ))}
          </Select>
          <Select
            aria-label="Time-range filter unavailable in this UI preview"
            defaultValue="Time range"
            disabled
            title="Time-range filtering is not available in this UI preview"
          >
            <option>Time range</option>
            <option>Today</option>
            <option>Last 30 days</option>
          </Select>
          <Button
            aria-label="More run filters unavailable in this UI preview"
            disabled
            size="icon"
            title="Additional filters are not available in this UI preview"
            type="button"
            variant="ghost"
          >
            <SlidersHorizontal aria-hidden="true" />
          </Button>
        </div>
        <nav aria-label="Run status" className="dt-table-view__tabs">
          {RUN_TABS.map(([tab, count]) => (
            <button
              aria-current={activeTab === tab ? "page" : undefined}
              data-active={activeTab === tab ? "true" : "false"}
              key={tab}
              onClick={() => {
                setActiveTab(tab);
              }}
              type="button"
            >
              {tab}
              <span>{count}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="dt-table-view__table-region">
        <div className="dt-table-view__table-frame">
          <Table className="dt-table-view__table dt-table-view__table--runs">
            <TableHeader>
              <TableRow>
                <TableHead className="dt-table-view__select-cell">
                  <input
                    aria-label="Select all visible runs"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    type="checkbox"
                  />
                </TableHead>
                <TableHead
                  aria-sort={
                    sortKey === "id" ? `${sortDirection}ending` : "none"
                  }
                >
                  <RunSortLabel
                    active={sortKey === "id"}
                    direction={sortDirection}
                    label="Run ID"
                    onClick={() => toggleSort("id")}
                  />
                </TableHead>
                <TableHead
                  aria-sort={
                    sortKey === "scenario" ? `${sortDirection}ending` : "none"
                  }
                >
                  <RunSortLabel
                    active={sortKey === "scenario"}
                    direction={sortDirection}
                    label="Scenario"
                    onClick={() => toggleSort("scenario")}
                  />
                </TableHead>
                <TableHead
                  aria-sort={
                    sortKey === "started" ? `${sortDirection}ending` : "none"
                  }
                >
                  <RunSortLabel
                    active={sortKey === "started"}
                    direction={sortDirection}
                    label="Started"
                    onClick={() => toggleSort("started")}
                  />
                </TableHead>
                <TableHead
                  aria-sort={
                    sortKey === "duration" ? `${sortDirection}ending` : "none"
                  }
                >
                  <RunSortLabel
                    active={sortKey === "duration"}
                    direction={sortDirection}
                    label="Duration"
                    onClick={() => toggleSort("duration")}
                  />
                </TableHead>
                <TableHead>Progress</TableHead>
                <TableHead
                  aria-sort={
                    sortKey === "status" ? `${sortDirection}ending` : "none"
                  }
                >
                  <RunSortLabel
                    active={sortKey === "status"}
                    direction={sortDirection}
                    label="Status"
                    onClick={() => toggleSort("status")}
                  />
                </TableHead>
                <TableHead>Owner</TableHead>
                <TableHead aria-label="Run actions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRuns.map((run) => (
                <TableRow
                  aria-selected={run.id === activeRunId}
                  data-active={run.id === activeRunId ? "true" : "false"}
                  data-state={selectedIds.has(run.id) ? "selected" : undefined}
                  key={run.id}
                  onClick={() => openRun(run.id)}
                  onKeyDown={(event) => handleRowKeyDown(event, run.id)}
                  tabIndex={0}
                >
                  <TableCell className="dt-table-view__select-cell">
                    <input
                      aria-label={`Select ${run.id}`}
                      checked={selectedIds.has(run.id)}
                      onChange={() => toggleRun(run.id)}
                      onClick={(event) => event.stopPropagation()}
                      type="checkbox"
                    />
                  </TableCell>
                  <TableCell>
                    <strong className="dt-table-view__run-id">{run.id}</strong>
                  </TableCell>
                  <TableCell>
                    <div className="dt-table-view__scenario-cell">
                      <span>
                        <strong>{run.scenario}</strong>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{run.started}</TableCell>
                  <TableCell>{run.duration}</TableCell>
                  <TableCell>
                    <div className="dt-table-view__table-progress">
                      <div
                        aria-label={`${run.progress}% complete`}
                        aria-valuemax={100}
                        aria-valuemin={0}
                        aria-valuenow={run.progress}
                        className="dt-table-view__progress"
                        role="progressbar"
                      >
                        <span style={{ width: `${run.progress}%` }} />
                      </div>
                      <span>{run.progress}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <RunStatusPill status={run.status} />
                  </TableCell>
                  <TableCell>{run.owner}</TableCell>
                  <TableCell>
                    <Button
                      aria-label={`More actions for ${run.id} unavailable in this UI preview`}
                      className="dt-table-view__row-menu"
                      disabled
                      onClick={(event) => event.stopPropagation()}
                      size="icon"
                      title="Run actions are not available in this UI preview"
                      type="button"
                      variant="ghost"
                    >
                      <MoreHorizontal aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredRuns.length === 0 ? (
            <div className="dt-table-view__empty">
              <Search aria-hidden="true" />
              <strong>No matching runs</strong>
              <span>Adjust the search or filters to see more results.</span>
            </div>
          ) : null}
        </div>
      </div>

      <footer className="dt-table-view__pagination">
        <span>
          Showing <strong>{filteredRuns.length}</strong> of 24 runs
        </span>
        <div>
          <Button
            aria-label="Previous page unavailable in this UI preview"
            disabled
            size="icon"
            title="Additional run pages are not available in this UI preview"
            type="button"
            variant="outline"
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          {[1, 2, 3, 4].map((pageNumber) => (
            <Button
              aria-current={pageNumber === 1 ? "page" : undefined}
              aria-label={
                pageNumber === 1
                  ? "Current page, page 1"
                  : `Page ${pageNumber} unavailable in this UI preview`
              }
              className="dt-table-view__page-number"
              data-active={pageNumber === 1 ? "true" : "false"}
              disabled
              key={pageNumber}
              size="icon"
              title={
                pageNumber === 1
                  ? "Current page"
                  : "Additional run pages are not available in this UI preview"
              }
              type="button"
              variant="ghost"
            >
              {pageNumber}
            </Button>
          ))}
          <Button
            aria-label="Next page unavailable in this UI preview"
            disabled
            size="icon"
            title="Additional run pages are not available in this UI preview"
            type="button"
            variant="outline"
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </footer>
    </ResizableTableView>
  );
}
