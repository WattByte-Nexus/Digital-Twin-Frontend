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
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  MoreHorizontal,
  Plus,
  Scale,
  Search,
  SlidersHorizontal,
  TrendingUp,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  PANEL_RESIZE_END_EVENT,
  PANEL_RESIZE_START_EVENT,
} from "../../../../lib/panel-resize";
import "./table-views.css";

const TERRAIN_PREVIEW_URL = new URL(
  "../../../../../../../docs/assets/digital-twin-views/live-terrain-clean.png",
  import.meta.url
).href;

const DETAIL_DEFAULT_WIDTH = 452;
const DETAIL_MIN_WIDTH = 352;
const DETAIL_MAX_WIDTH = 640;
const LIST_MIN_WIDTH = 620;

interface ResizableTableViewProps {
  children: ReactNode;
  detail: ReactNode;
  detailLabel: string;
  detailsOpen: boolean;
  viewName: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * The Figma table views share the same split surface. The separator overlays
 * the pane edge, so resizing never introduces a visual gutter or layout jump.
 */
export function ResizableTableView({
  children,
  detail,
  detailLabel,
  detailsOpen,
  viewName,
}: ResizableTableViewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const cleanupDragRef = useRef<(() => void) | null>(null);
  const [detailWidth, setDetailWidth] = useState(DETAIL_DEFAULT_WIDTH);

  const getMaximumWidth = useCallback(() => {
    const containerWidth =
      rootRef.current?.getBoundingClientRect().width ?? window.innerWidth;
    return Math.max(
      DETAIL_MIN_WIDTH,
      Math.min(DETAIL_MAX_WIDTH, containerWidth - LIST_MIN_WIDTH)
    );
  }, []);

  const updateDetailWidth = useCallback(
    (width: number) => {
      setDetailWidth(clamp(width, DETAIL_MIN_WIDTH, getMaximumWidth()));
    },
    [getMaximumWidth]
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const observer = new ResizeObserver(() => {
      setDetailWidth((width) =>
        clamp(width, DETAIL_MIN_WIDTH, getMaximumWidth())
      );
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [getMaximumWidth]);

  useEffect(() => () => cleanupDragRef.current?.(), []);

  const handleResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    cleanupDragRef.current?.();

    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startWidth = detailWidth;
    const direction = getComputedStyle(handle).direction === "rtl" ? -1 : 1;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    let animationFrame = 0;
    let pendingWidth = startWidth;
    let finished = false;

    handle.setPointerCapture(pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.dispatchEvent(new Event(PANEL_RESIZE_START_EVENT));

    const handleMove = (moveEvent: PointerEvent) => {
      pendingWidth = startWidth + direction * (startX - moveEvent.clientX);
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        updateDetailWidth(pendingWidth);
      });
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      if (handle.hasPointerCapture(pointerId))
        handle.releasePointerCapture(pointerId);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      cleanupDragRef.current = null;
      window.dispatchEvent(new Event(PANEL_RESIZE_END_EVENT));
    };

    cleanupDragRef.current = finish;
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  const handleResizeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 32 : 8;
    const isRtl = getComputedStyle(event.currentTarget).direction === "rtl";
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      updateDetailWidth(detailWidth + (isRtl ? -step : step));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      updateDetailWidth(detailWidth + (isRtl ? step : -step));
    } else if (event.key === "Home") {
      event.preventDefault();
      updateDetailWidth(DETAIL_MIN_WIDTH);
    } else if (event.key === "End") {
      event.preventDefault();
      updateDetailWidth(getMaximumWidth());
    }
  };

  return (
    <section
      className="dt-table-view"
      data-detail-open={detailsOpen ? "true" : "false"}
      data-view={viewName}
      ref={rootRef}
      style={{ "--dt-detail-width": `${detailWidth}px` } as CSSProperties}
    >
      <div className="dt-table-view__list">{children}</div>
      {detailsOpen ? (
        <>
          <div
            aria-label={`Resize ${detailLabel}`}
            aria-orientation="vertical"
            aria-valuemax={getMaximumWidth()}
            aria-valuemin={DETAIL_MIN_WIDTH}
            aria-valuenow={detailWidth}
            className="dt-table-view__resize"
            onKeyDown={handleResizeKeyDown}
            onPointerDown={handleResizeStart}
            role="separator"
            tabIndex={0}
          />
          <aside aria-label={detailLabel} className="dt-table-view__detail">
            {detail}
          </aside>
        </>
      ) : null}
    </section>
  );
}

type ScenarioStatus = "Ready" | "Draft" | "Completed" | "Review";
type ScenarioSortKey = "name" | "region" | "updated" | "status";

interface Scenario {
  id: string;
  name: string;
  region: string;
  conditions: string;
  owner: string;
  updated: string;
  updatedOrder: number;
  status: ScenarioStatus;
}

const SCENARIOS: Scenario[] = [
  {
    id: "scenario-1",
    name: "Boulder Foothills — Wind East",
    region: "Boulder Foothills",
    conditions: "15 mph East · 4 h",
    owner: "A. Chen",
    updated: "2 min ago",
    updatedOrder: 0,
    status: "Ready",
  },
  {
    id: "scenario-2",
    name: "North Ridge — Dry Fuels",
    region: "Boulder North",
    conditions: "8 mph NW · 6 h",
    owner: "M. Rivera",
    updated: "18 min ago",
    updatedOrder: 1,
    status: "Draft",
  },
  {
    id: "scenario-3",
    name: "Louisville Interface",
    region: "East County",
    conditions: "22 mph W · 3 h",
    owner: "A. Chen",
    updated: "1 h ago",
    updatedOrder: 2,
    status: "Ready",
  },
  {
    id: "scenario-4",
    name: "Baseline Morning",
    region: "Boulder Foothills",
    conditions: "5 mph E · 8 h",
    owner: "System",
    updated: "Today 8:10 AM",
    updatedOrder: 3,
    status: "Completed",
  },
  {
    id: "scenario-5",
    name: "High Wind Watch",
    region: "Front Range",
    conditions: "35 mph W · 2 h",
    owner: "J. Patel",
    updated: "Yesterday",
    updatedOrder: 4,
    status: "Review",
  },
  {
    id: "scenario-6",
    name: "Superior South",
    region: "South County",
    conditions: "12 mph NE · 4 h",
    owner: "M. Rivera",
    updated: "Yesterday",
    updatedOrder: 5,
    status: "Completed",
  },
];

const SCENARIO_TABS = [
  ["All", 12],
  ["Draft", 4],
  ["Ready", 3],
  ["Completed", 5],
] as const;

function statusTone(status: ScenarioStatus): string {
  return status.toLowerCase();
}

function SortLabel({
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

function StatusPill({ status }: { status: ScenarioStatus }) {
  return (
    <span className="dt-table-view__status" data-tone={statusTone(status)}>
      {status === "Completed" ? <Check aria-hidden="true" /> : null}
      {status}
    </span>
  );
}

interface ScenariosViewProps {
  onNavigateLive: () => void;
  onOpenSimulation: () => void;
}

export function ScenariosView({
  onNavigateLive,
  onOpenSimulation,
}: ScenariosViewProps) {
  const [activeTab, setActiveTab] =
    useState<(typeof SCENARIO_TABS)[number][0]>("All");
  const [activeScenarioId, setActiveScenarioId] = useState(SCENARIOS[0].id);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [owner, setOwner] = useState("All owners");
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("All regions");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set([SCENARIOS[0].id])
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [sortKey, setSortKey] = useState<ScenarioSortKey>("updated");

  const filteredScenarios = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const next = SCENARIOS.filter((scenario) => {
      const matchesTab = activeTab === "All" || scenario.status === activeTab;
      const matchesRegion =
        region === "All regions" || scenario.region === region;
      const matchesOwner = owner === "All owners" || scenario.owner === owner;
      const matchesQuery =
        !normalizedQuery ||
        `${scenario.name} ${scenario.region} ${scenario.conditions} ${scenario.owner}`
          .toLocaleLowerCase()
          .includes(normalizedQuery);
      return matchesTab && matchesRegion && matchesOwner && matchesQuery;
    });

    next.sort((a, b) => {
      const aValue = sortKey === "updated" ? a.updatedOrder : a[sortKey];
      const bValue = sortKey === "updated" ? b.updatedOrder : b[sortKey];
      const comparison =
        typeof aValue === "number"
          ? aValue - Number(bValue)
          : String(aValue).localeCompare(String(bValue));
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return next;
  }, [activeTab, owner, query, region, sortDirection, sortKey]);

  const activeScenario =
    SCENARIOS.find((scenario) => scenario.id === activeScenarioId) ??
    SCENARIOS[0];
  const allVisibleSelected =
    filteredScenarios.length > 0 &&
    filteredScenarios.every(({ id }) => selectedIds.has(id));

  const toggleSort = (key: ScenarioSortKey) => {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const openScenario = (scenarioId: string) => {
    setActiveScenarioId(scenarioId);
    setDetailsOpen(true);
  };

  const toggleScenario = (scenarioId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(scenarioId)) next.delete(scenarioId);
      else next.add(scenarioId);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected)
        filteredScenarios.forEach(({ id }) => next.delete(id));
      else filteredScenarios.forEach(({ id }) => next.add(id));
      return next;
    });
  };

  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    scenarioId: string
  ) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openScenario(scenarioId);
  };

  const detail = (
    <div className="dt-table-view__detail-shell">
      <header className="dt-table-view__detail-header">
        <div className="dt-table-view__detail-header-copy">
          <div className="dt-table-view__detail-heading-line">
            <span className="dt-table-view__detail-kicker">
              Scenario details
            </span>
            <StatusPill status={activeScenario.status} />
          </div>
          <h2>{activeScenario.name}</h2>
          <p>
            Updated {activeScenario.updated} by {activeScenario.owner}
          </p>
        </div>
        <Button
          aria-label="Close scenario details"
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
        <figure className="dt-table-view__terrain">
          <img
            alt="Terrain preview for the selected scenario"
            src={TERRAIN_PREVIEW_URL}
          />
        </figure>

        <section className="dt-table-view__detail-section">
          <div className="dt-table-view__section-heading">
            <h3>Setup</h3>
          </div>
          <dl className="dt-table-view__detail-rows">
            <div>
              <dt>Ignition points</dt>
              <dd>
                1 selected <ChevronRight aria-hidden="true" />
              </dd>
            </div>
            <div>
              <dt>Wind</dt>
              <dd>
                {activeScenario.conditions.split("·")[0]?.trim()}{" "}
                <ChevronRight aria-hidden="true" />
              </dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>
                {activeScenario.conditions.split("·")[1]?.trim() ?? "4 h"}ours{" "}
                <ChevronRight aria-hidden="true" />
              </dd>
            </div>
          </dl>
        </section>

        <section className="dt-table-view__detail-section">
          <div className="dt-table-view__section-heading">
            <h3>Inputs</h3>
          </div>
          <dl className="dt-table-view__detail-rows">
            <div>
              <dt>Weather</dt>
              <dd>
                NWS · Jul 31, 2026 <em>Fresh</em>{" "}
                <ChevronRight aria-hidden="true" />
              </dd>
            </div>
            <div>
              <dt>Engine assets</dt>
              <dd>
                1,284 <ChevronRight aria-hidden="true" />
              </dd>
            </div>
            <div>
              <dt>Simulation area</dt>
              <dd>
                {activeScenario.region} <ChevronRight aria-hidden="true" />
              </dd>
            </div>
          </dl>
        </section>

        <section className="dt-table-view__exposure-card">
          <strong>Estimated exposure</strong>
          <div className="dt-table-view__exposure-value">
            <span>
              <i /> High
            </span>
            <span className="dt-table-view__exposure-scale">
              <i />
            </span>
          </div>
        </section>

        <div className="dt-table-view__detail-actions">
          <Button onClick={onOpenSimulation} type="button" variant="outline">
            <SlidersHorizontal aria-hidden="true" />
            Edit setup
          </Button>
          <Button
            className="dt-table-view__primary-button"
            onClick={onOpenSimulation}
            type="button"
          >
            Run simulation
          </Button>
        </div>
        <Button
          aria-label="Duplicate scenario unavailable in this UI preview"
          className="dt-table-view__duplicate"
          disabled
          title="Duplicate scenario is not available in this UI preview"
          type="button"
          variant="ghost"
        >
          <Copy aria-hidden="true" />
          Duplicate scenario
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
      detailLabel="Scenario details"
      detailsOpen={detailsOpen}
      viewName="scenarios"
    >
      <header className="dt-table-view__page-header">
        <div>
          <h1>Scenarios</h1>
          <p>Model conditions before they reach the grid</p>
        </div>
        <div className="dt-table-view__header-actions">
          <Button
            aria-label="Compare scenarios unavailable in this UI preview"
            disabled
            title="Scenario comparison is not available in this UI preview"
            type="button"
            variant="outline"
          >
            <Scale aria-hidden="true" />
            Compare
          </Button>
          <Button
            className="dt-table-view__primary-button"
            onClick={onOpenSimulation}
            type="button"
          >
            <Plus aria-hidden="true" />
            New scenario
          </Button>
        </div>
      </header>

      <div className="dt-table-view__controls">
        <div className="dt-table-view__filters">
          <label className="dt-table-view__search">
            <Search aria-hidden="true" />
            <span className="sr-only">Search scenarios</span>
            <Input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search scenarios"
              type="search"
              value={query}
            />
          </label>
          <Select
            aria-label="Filter scenarios by region"
            onChange={(event) => setRegion(event.target.value)}
            value={region}
          >
            <option>All regions</option>
            {[
              ...new Set(
                SCENARIOS.map(({ region: scenarioRegion }) => scenarioRegion)
              ),
            ].map((scenarioRegion) => (
              <option key={scenarioRegion}>{scenarioRegion}</option>
            ))}
          </Select>
          <Select
            aria-label="Filter scenarios by owner"
            onChange={(event) => setOwner(event.target.value)}
            value={owner}
          >
            <option>All owners</option>
            {[
              ...new Set(
                SCENARIOS.map(({ owner: scenarioOwner }) => scenarioOwner)
              ),
            ].map((scenarioOwner) => (
              <option key={scenarioOwner}>{scenarioOwner}</option>
            ))}
          </Select>
          <Select
            aria-label="Update-time filter unavailable in this UI preview"
            defaultValue="Updated"
            disabled
            title="Update-time filtering is not available in this UI preview"
          >
            <option>Updated</option>
            <option>Today</option>
            <option>This week</option>
          </Select>
          <Button
            aria-label="More scenario filters unavailable in this UI preview"
            disabled
            size="icon"
            title="Additional filters are not available in this UI preview"
            type="button"
            variant="ghost"
          >
            <SlidersHorizontal aria-hidden="true" />
          </Button>
        </div>
        <nav aria-label="Scenario status" className="dt-table-view__tabs">
          {SCENARIO_TABS.map(([tab, count]) => (
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
          <Table className="dt-table-view__table">
            <TableHeader>
              <TableRow>
                <TableHead className="dt-table-view__select-cell">
                  <input
                    aria-label="Select all visible scenarios"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    type="checkbox"
                  />
                </TableHead>
                <TableHead
                  aria-sort={
                    sortKey === "name" ? `${sortDirection}ending` : "none"
                  }
                >
                  <SortLabel
                    active={sortKey === "name"}
                    direction={sortDirection}
                    label="Scenario"
                    onClick={() => toggleSort("name")}
                  />
                </TableHead>
                <TableHead
                  aria-sort={
                    sortKey === "region" ? `${sortDirection}ending` : "none"
                  }
                >
                  <SortLabel
                    active={sortKey === "region"}
                    direction={sortDirection}
                    label="Region"
                    onClick={() => toggleSort("region")}
                  />
                </TableHead>
                <TableHead>Conditions</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead
                  aria-sort={
                    sortKey === "updated" ? `${sortDirection}ending` : "none"
                  }
                >
                  <SortLabel
                    active={sortKey === "updated"}
                    direction={sortDirection}
                    label="Updated"
                    onClick={() => toggleSort("updated")}
                  />
                </TableHead>
                <TableHead
                  aria-sort={
                    sortKey === "status" ? `${sortDirection}ending` : "none"
                  }
                >
                  <SortLabel
                    active={sortKey === "status"}
                    direction={sortDirection}
                    label="Status"
                    onClick={() => toggleSort("status")}
                  />
                </TableHead>
                <TableHead aria-label="Scenario actions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredScenarios.map((scenario) => (
                <TableRow
                  aria-selected={scenario.id === activeScenarioId}
                  data-active={
                    scenario.id === activeScenarioId ? "true" : "false"
                  }
                  data-state={
                    selectedIds.has(scenario.id) ? "selected" : undefined
                  }
                  key={scenario.id}
                  onClick={() => openScenario(scenario.id)}
                  onKeyDown={(event) => handleRowKeyDown(event, scenario.id)}
                  tabIndex={0}
                >
                  <TableCell className="dt-table-view__select-cell">
                    <input
                      aria-label={`Select ${scenario.name}`}
                      checked={selectedIds.has(scenario.id)}
                      onChange={() => toggleScenario(scenario.id)}
                      onClick={(event) => event.stopPropagation()}
                      type="checkbox"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="dt-table-view__primary-cell">
                      <strong>{scenario.name}</strong>
                    </div>
                  </TableCell>
                  <TableCell>{scenario.region}</TableCell>
                  <TableCell>
                    <div className="dt-table-view__conditions-cell">
                      <TrendingUp aria-hidden="true" />
                      <span>{scenario.conditions}</span>
                    </div>
                  </TableCell>
                  <TableCell>{scenario.owner}</TableCell>
                  <TableCell>{scenario.updated}</TableCell>
                  <TableCell>
                    <StatusPill status={scenario.status} />
                  </TableCell>
                  <TableCell>
                    <Button
                      aria-label={`More actions for ${scenario.name} unavailable in this UI preview`}
                      className="dt-table-view__row-menu"
                      disabled
                      onClick={(event) => event.stopPropagation()}
                      size="icon"
                      title="Scenario actions are not available in this UI preview"
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
          {filteredScenarios.length === 0 ? (
            <div className="dt-table-view__empty">
              <Search aria-hidden="true" />
              <strong>No matching scenarios</strong>
              <span>Adjust the search or filters to see more results.</span>
            </div>
          ) : null}
        </div>
      </div>

      <footer className="dt-table-view__pagination">
        <span>
          Showing <strong>{filteredScenarios.length}</strong> of 12 scenarios
        </span>
        <div>
          <Button
            aria-label="Previous page unavailable in this UI preview"
            disabled
            size="icon"
            title="Additional scenario pages are not available in this UI preview"
            type="button"
            variant="outline"
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          {[1, 2].map((pageNumber) => (
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
                  : "Additional scenario pages are not available in this UI preview"
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
            title="Additional scenario pages are not available in this UI preview"
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
