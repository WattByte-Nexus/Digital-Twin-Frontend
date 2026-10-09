import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import openapiTS, { astToString } from "openapi-typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = resolve(root, "tests/fixtures/digital-twin-engine.openapi.json");
const metadataPath = resolve(root, "tests/fixtures/digital-twin-engine.contract.json");
const outputPath = resolve(root, "apps/geolibre-desktop/src/lib/digital-twin-contract.generated.ts");
const args = process.argv.slice(2);
const argument = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};

function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordered(item)]));
  return value;
}

const inputPath = argument("--schema");
const check = args.includes("--check");
if (inputPath && check) throw new Error("Use --schema to update or --check to verify, not both.");
const schema = JSON.parse(await readFile(inputPath ? resolve(inputPath) : schemaPath, "utf8"));
const serialized = `${JSON.stringify(ordered(schema), null, 2)}\n`;
const sha256 = createHash("sha256").update(serialized).digest("hex");
if (inputPath) {
  const revision = argument("--engine-revision");
  if (!revision || !/^[a-f0-9]{40}$/.test(revision)) throw new Error("Schema updates require --engine-revision with the full Engine commit SHA.");
  await writeFile(schemaPath, serialized);
  await writeFile(metadataPath, `${JSON.stringify({ engineRevision: revision, schemaSha256: sha256, note: "Schema hash identifies the exact exported contract, including any working-tree changes." }, null, 2)}\n`);
}
const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
if (metadata.schemaSha256 !== sha256) throw new Error("Pinned Engine schema does not match its recorded fingerprint.");
const candidatePath = argument("--engine-schema");
if (candidatePath) {
  const candidate = JSON.parse(await readFile(resolve(candidatePath), "utf8"));
  const pinnedContract = { ...schema };
  delete candidate["x-engine-contract"];
  delete pinnedContract["x-engine-contract"];
  if (JSON.stringify(ordered(candidate)) !== JSON.stringify(ordered(pinnedContract))) {
    throw new Error("Engine contract differs from the frontend pin. Refresh the schema/types and verify the native workflows together.");
  }
}
const generated = `// Generated from the pinned Digital Twin Engine OpenAPI. Do not edit.\n// Engine revision: ${metadata.engineRevision}; schema SHA-256: ${sha256}\n\n${astToString(await openapiTS(schema, { alphabetize: true }))}`;
if (check) {
  if (await readFile(outputPath, "utf8") !== generated) throw new Error("Generated Engine types are stale. Run npm run sync:digital-twin-contract.");
  console.log(`Engine contract and generated types match (${sha256.slice(0, 12)}).`);
} else {
  await writeFile(outputPath, generated);
  console.log(`Generated native Engine types (${sha256.slice(0, 12)}).`);
}
