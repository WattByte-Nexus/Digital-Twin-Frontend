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

it("keeps the application header aligned with the sidebar header", () => {
  assert.match(
    topbarSource,
    /<header[\s\S]*?surface-glass-subtle[^"\n]*\bh-16\b[^"\n]*\bshrink-0\b[^"\n]*border-b border-sidebar-border/,
  );
});
