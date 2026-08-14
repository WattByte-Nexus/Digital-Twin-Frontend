import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runsViewSource = readFileSync(
  new URL(
    "../apps/geolibre-desktop/src/product-modes/digital-twin/ui/views/RunsView.tsx",
    import.meta.url,
  ),
  "utf8",
);
const runDetailSource = readFileSync(
  new URL(
    "../apps/geolibre-desktop/src/product-modes/digital-twin/ui/views/RunDetailView.tsx",
    import.meta.url,
  ),
  "utf8",
);
const runTabsSource = readFileSync(
  new URL(
    "../apps/geolibre-desktop/src/product-modes/digital-twin/ui/views/RunDetailTabs.tsx",
    import.meta.url,
  ),
  "utf8",
);
const playbackWorkspaceSource = readFileSync(
  new URL(
    "../apps/geolibre-desktop/src/product-modes/digital-twin/ui/views/RunPlaybackWorkspace.tsx",
    import.meta.url,
  ),
  "utf8",
);
test("simulation history opens a run from its scenario cell", () => {
  assert.match(
    runsViewSource,
    /<TableCell>\s*<Button[\s\S]*?onClick=\{\(\) => onOpenRun\(run\.id\)\}[\s\S]*?\{run\.scenarioName \?\? "—"\}[\s\S]*?<\/Button>\s*<\/TableCell>/,
  );
  assert.match(
    runsViewSource,
    /<TableCell className="font-mono text-xs">\{run\.id\}<\/TableCell>/,
  );
});

test("run detail positions graphs beside or below the expandable map and provides playback", () => {
  assert.match(playbackWorkspaceSource, /aria-label=\{mapExpanded \? "Restore map size" : "Expand map"\}/);
  assert.match(playbackWorkspaceSource, /setMapExpanded\(\(expanded\) => !expanded\)/);
  assert.match(playbackWorkspaceSource, /pendingMapBoundsRef\.current = mapCardRef\.current\?\.getBoundingClientRect\(\) \?\? null/);
  assert.match(playbackWorkspaceSource, /mapCard\.animate\(/);
  assert.match(playbackWorkspaceSource, /prefers-reduced-motion/);
  assert.match(playbackWorkspaceSource, /mapExpanded \? "lg:grid-cols-1" : "lg:grid-cols-\[minmax\(0,1\.35fr\)_minmax\(360px,0\.8fr\)\]"/);
  assert.match(playbackWorkspaceSource, /mapExpanded \? "lg:grid-cols-2" : "grid-cols-1"/);
  assert.match(playbackWorkspaceSource, /Affected area over time/);
  assert.match(playbackWorkspaceSource, /Active fire cells/);
  assert.match(playbackWorkspaceSource, /aria-label=\{playing \? "Pause playback" : "Play playback"\}/);
  assert.match(playbackWorkspaceSource, /const RUN_PLAYBACK_INTERVAL_MS = 250;/);
  assert.match(playbackWorkspaceSource, /aria-label="Simulation playback tick"/);
  assert.match(playbackWorkspaceSource, /<\/Card>\s*<Card\s+aria-label="Simulation timeline"/);
  assert.doesNotMatch(playbackWorkspaceSource, /absolute bottom-3 left-3 right-3/);
  assert.doesNotMatch(runDetailSource, /Run timeline/);
  assert.match(runTabsSource, /<TabsTrigger value="overview">Overview<\/TabsTrigger>/);
  assert.match(runTabsSource, /fill-primary text-primary-foreground/);
  assert.match(runTabsSource, /text-sm font-medium text-foreground">Tick \{tick\} completed/);
  assert.match(runTabsSource, /<ScrollArea className="h-\[min\(32rem,50vh\)\][^"]*scroll-area-viewport[^\"]*overscroll-contain/);
  assert.match(runTabsSource, /fill-\[hsl\(var\(--dt-status-ok-text\)\)\]/);
  assert.match(runTabsSource, /fill-destructive text-destructive-foreground/);
  assert.match(runDetailSource, /label="Area consumed"/);
  assert.match(runTabsSource, /run\.metrics\.burned_area_hectares/);
  assert.match(runTabsSource, /Affected land cover/);
  assert.match(runTabsSource, /entry\.area_hectares/);
  assert.match(runTabsSource, /entry\.percentage/);
});
