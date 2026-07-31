import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  new URL(
    "../apps/geolibre-desktop/src/components/layout/toolbar/AddDataMenu.tsx",
    import.meta.url,
  ),
  "utf8",
);

describe("Add Data menu", () => {
  it("exposes only the Earth Engine workflow", () => {
    const items = source.match(/<DropdownMenuItem\b/g) ?? [];

    assert.equal(items.length, 1);
    assert.match(source, /onSelect=\{onOpenEarthEngine\}/);
    assert.match(source, /toolbar\.command\.earthEngine/);
    assert.doesNotMatch(source, /DATA_SOURCE_CATALOG|addLayer\.|onSetAddDataKind/);
  });
});
