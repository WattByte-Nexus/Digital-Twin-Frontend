import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const topbarSource = readFileSync(
  new URL(
    "../packages/ui/src/components/digital-twin-topbar.tsx",
    import.meta.url,
  ),
  "utf8",
);
const sidebarSource = readFileSync(
  new URL(
    "../packages/ui/src/components/digital-twin-sidebar.tsx",
    import.meta.url,
  ),
  "utf8",
);
const tableSource = readFileSync(
  new URL("../packages/ui/src/components/table.tsx", import.meta.url),
  "utf8",
);
const themeSource = readFileSync(
  new URL("../packages/ui/src/globals.css", import.meta.url),
  "utf8",
);

it("keeps the application header aligned with the sidebar header", () => {
  assert.match(
    topbarSource,
    /<header[\s\S]*?\bh-16\b[^"\n]*\bshrink-0\b[^"\n]*border-b border-separator[^"\n]*bg-card/,
  );
});

it("uses white structural surfaces with deliberate separators", () => {
  assert.match(
    topbarSource,
    /<header[\s\S]*?border-b border-separator[^"\n]*\bshadow-none\b/,
  );
  assert.match(
    topbarSource,
    /<nav[\s\S]*?border-b border-separator[^"\n]*bg-card[^"\n]*\bshadow-none\b/,
  );
  assert.match(
    tableSource,
    /<thead[\s\S]*?\[&_tr\]:border-b[^"\n]*\[&_tr\]:border-separator[^"\n]*\[&_tr\]:bg-card/,
  );
  assert.match(themeSource, /\.theme-light\s*\{[\s\S]*?--background: 0 0% 100%;/);
  assert.match(
    sidebarSource,
    /border-sidebar-border[^"\n]*bg-card[^"\n]*\bshadow-none\b/,
  );
});

it("provides a recoverable collapse control for the map toolbar", () => {
  assert.match(
    topbarSource,
    /const \[isMapToolbarCollapsed, setIsMapToolbarCollapsed\] = useState\(false\)/,
  );
  assert.match(topbarSource, /aria-label="Collapse map controls"/);
  assert.match(topbarSource, /aria-label="Show map controls"/);
});

it("keeps the sidebar header height stable when the sidebar collapses", () => {
  assert.match(
    sidebarSource,
    /<SidebarHeader className="[^"\n]*\bgrid\b[^"\n]*\bh-28\b[^"\n]*\bshrink-0\b[^"\n]*grid-rows-\[minmax\(0,1fr\)_auto\]/,
  );
  assert.doesNotMatch(sidebarSource, /<SidebarHeader className="[^"\n]*border-b/);

  const regionTriggerClassName = sidebarSource.match(
    /aria-label={`Change assigned region[\s\S]*?className="([^"\n]*)"/,
  )?.[1];

  assert.ok(regionTriggerClassName);
  assert.match(regionTriggerClassName, /\bh-11\b/);
  assert.match(
    regionTriggerClassName,
    /group-data-\[collapsible=icon\]:w-8/,
  );
  assert.doesNotMatch(
    regionTriggerClassName,
    /group-data-\[collapsible=icon\]:size-8/,
  );
});
