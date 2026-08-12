import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const toasterSource = readFileSync(
  new URL("../packages/ui/src/components/sonner.tsx", import.meta.url),
  "utf8",
);

test("shared Sonner toasts use status colors", () => {
  assert.match(toasterSource, /<Sonner[\s\S]*?richColors/);
});
