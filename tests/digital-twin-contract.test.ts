import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const read = (file: string) => JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8"));
test("every current Engine operation has explicit native ownership or an infrastructure reason", () => {
  const schema = read("./fixtures/digital-twin-engine.openapi.json");
  const coverage = read("./fixtures/digital-twin-endpoint-coverage.json");
  const expected = Object.entries(schema.paths).flatMap(([path, methods]) =>
    Object.keys(methods as object).filter((method) => ["get", "post", "patch", "delete", "put", "head", "options"].includes(method)).map((method) => `${method.toUpperCase()} ${path}`));
  const actual = coverage.operations.map((entry: { method: string; path: string }) => `${entry.method} ${entry.path}`);
  assert.equal(new Set(actual).size, actual.length, "duplicate coverage rows");
  assert.deepEqual(actual.sort(), expected.sort(), "new or removed endpoint requires an explicit coverage decision");
  for (const entry of coverage.operations) {
    if (entry.disposition === "infrastructure") { assert.ok(entry.reason); continue; }
    assert.equal(entry.disposition, "native");
    for (const file of [entry.client, entry.surface, entry.test]) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `missing ownership evidence: ${file}`);
      assert.ok(!file.includes("plugins/digital-twin-demo"));
    }
  }
});
