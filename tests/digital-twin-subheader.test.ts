import assert from "node:assert/strict";
import test from "node:test";
import {
  DIGITAL_TWIN_FOOTER_ACTIONS,
  DIGITAL_TWIN_SUBHEADER_OPTIONS,
  getDefaultDigitalTwinSubheaderOption,
  getDigitalTwinSubheaderSelectionKey,
} from "../apps/geolibre-desktop/src/components/layout/digital-twin-subheader";

test("Digital Twin destinations expose distinct contextual subheader options", () => {
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(DIGITAL_TWIN_SUBHEADER_OPTIONS).map(([view, options]) => [
        view,
        options.map((option) => option.id),
      ])
    ),
    {
      live: ["overview", "assets"],
      scenarios: ["library", "drafts", "templates"],
      runs: ["active", "history", "replay"],
    }
  );
});

test("Alerts is a persistent footer action instead of a header subview", () => {
  assert.deepEqual(
    DIGITAL_TWIN_FOOTER_ACTIONS.map((action) => action.id),
    ["alerts"]
  );
});

test("each Digital Twin destination defaults to its first contextual option", () => {
  assert.equal(
    getDefaultDigitalTwinSubheaderOption("live"),
    "overview.operations"
  );
  assert.equal(
    getDefaultDigitalTwinSubheaderOption("scenarios"),
    "library.all"
  );
  assert.equal(getDefaultDigitalTwinSubheaderOption("runs"), "active.all");
});

test("every contextual subheader option is a populated dropdown", () => {
  for (const options of Object.values(DIGITAL_TWIN_SUBHEADER_OPTIONS)) {
    for (const option of options) {
      assert.ok(
        option.items.length > 0,
        `${option.id} should have dropdown items`
      );
      assert.equal(
        new Set(option.items.map((item) => item.id)).size,
        option.items.length,
        `${option.id} should not repeat dropdown item ids`
      );
    }
  }
  assert.equal(
    getDigitalTwinSubheaderSelectionKey("assets", "lines"),
    "assets.lines"
  );
});
