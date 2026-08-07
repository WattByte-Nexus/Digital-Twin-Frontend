import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";
import { Linter } from "eslint";
import tseslint from "typescript-eslint";
import noRawThemeColors from "../eslint-rules/no-raw-theme-colors.mjs";
import { themeColorLegacyFiles } from "../eslint-rules/theme-color-legacy-files.mjs";

function lint(source: string) {
  const linter = new Linter({ configType: "flat" });

  return linter.verify(
    source,
    {
      files: ["**/*.tsx"],
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
          ecmaVersion: "latest",
          sourceType: "module",
          ecmaFeatures: { jsx: true },
        },
      },
      plugins: {
        theme: {
          rules: { "no-raw-theme-colors": noRawThemeColors },
        },
      },
      rules: {
        "theme/no-raw-theme-colors": "error",
      },
    },
    { filename: "tests/fixtures/NewComponent.tsx" },
  );
}

describe("no-raw-theme-colors", () => {
  it("accepts semantic theme utilities and CSS-variable colors", () => {
    const messages = lint(`
      export function Card() {
        return (
          <section
            className="border-border bg-card text-card-foreground"
            style={{ boxShadow: "0 1px 2px hsl(var(--surface-panel-shadow) / 0.2)" }}
          >
            <span className="text-muted-foreground">Details</span>
          </section>
        );
      }
    `);

    assert.deepEqual(messages, []);
  });

  it("rejects raw Tailwind palette utilities, including variants", () => {
    const messages = lint(`
      export function Notice({ active }: { active: boolean }) {
        return (
          <div className={active ? "bg-white text-gray-700" : "dark:bg-slate-900 border-red-500/40 shadow-[0_1px_2px_#000]"} />
        );
      }
    `);

    assert.equal(messages.length, 2);
    assert.ok(messages.every((message) => message.ruleId === "theme/no-raw-theme-colors"));
    const output = messages.map((message) => message.message).join("\n");
    assert.match(output, /bg-white/);
    assert.match(output, /text-gray-700/);
    assert.match(output, /dark:bg-slate-900/);
    assert.match(output, /border-red-500\/40/);
    assert.match(output, /shadow-\[0_1px_2px_#000\]/);
  });

  it("rejects hard-coded colors in JSX style objects and color attributes", () => {
    const messages = lint(`
      export function Marker() {
        return (
          <svg fill="#fff" style={{ backgroundColor: "rgb(1 2 3 / 50%)", color: "#123456" }} />
        );
      }
    `);

    assert.equal(messages.length, 3);
    assert.ok(messages.every((message) => message.ruleId === "theme/no-raw-theme-colors"));
  });

  it("rejects raw colors even when the same value also uses a semantic token", () => {
    const messages = lint(`
      export function MixedSurface() {
        return <div style={{ background: "linear-gradient(#fff, hsl(var(--background)))" }} />;
      }
    `);

    assert.equal(messages.length, 1);
    assert.equal(messages[0]?.ruleId, "theme/no-raw-theme-colors");
  });

  it("rejects hard-coded colors in conditional presentation values", () => {
    const messages = lint(`
      export function ConditionalMarker({ active }: { active: boolean }) {
        return (
          <svg
            fill={active ? "#fff" : "hsl(var(--foreground))"}
            style={{ color: active ? "rgb(1 2 3)" : "hsl(var(--muted-foreground))" }}
          />
        );
      }
    `);

    assert.equal(messages.length, 2);
    assert.ok(messages.every((message) => message.ruleId === "theme/no-raw-theme-colors"));
  });

  it("does not treat non-presentation domain colors as component styling", () => {
    const messages = lint(`
      const MAP_LAYER_COLOR = "#2563eb";
      export function MapLegend() {
        return <div data-layer-color={MAP_LAYER_COLOR} />;
      }
    `);

    assert.deepEqual(messages, []);
  });
});

describe("theme color legacy list", () => {
  it("contains only unique, sorted paths to existing component source files", () => {
    assert.deepEqual(themeColorLegacyFiles, [...new Set(themeColorLegacyFiles)].sort());

    for (const file of themeColorLegacyFiles) {
      assert.match(file, /^(?:apps|packages)\/.*\/src\/.*\.tsx$/);
      assert.equal(existsSync(file), true, `${file} does not exist`);
    }
  });
});
