import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

test("an open tab offers a reload after a deployment without losing its state", async ({
  page,
}) => {
  let revision = 1;
  const dist = resolve(__dirname, "../apps/geolibre-desktop/dist");
  const types: Record<string, string> = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".svg": "image/svg+xml",
  };
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    response.setHeader("Cache-Control", "no-store");
    if (pathname === "/sw.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.end(
        `// release ${revision}\nself.addEventListener('install', () => self.skipWaiting());\nself.addEventListener('activate', event => event.waitUntil(self.clients.claim()));`,
      );
      return;
    }
    if (pathname.startsWith("/api/")) {
      response.writeHead(401, { "Content-Type": "application/json" });
      response.end('{"detail":"Sign in required"}');
      return;
    }
    const file = resolve(dist, pathname === "/" ? "index.html" : `.${pathname}`);
    void readFile(file)
      .then((body) => {
        response.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
        response.end(body);
      })
      .catch(() => {
        response.writeHead(404);
        response.end();
      });
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test server address");
  try {
    await page.goto(`http://127.0.0.1:${address.port}/`);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await expect(page.getByText("Update available", { exact: true })).toHaveCount(0);
    await page.evaluate(() => {
      (window as Window & { unsavedMarker?: string }).unsavedMarker = "map state";
    });
    revision = 2;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByText("Update available", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => (window as Window & { unsavedMarker?: string }).unsavedMarker),
    ).toBe("map state");
    await page.getByRole("button", { name: "Reload", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(() => (window as Window & { unsavedMarker?: string }).unsavedMarker ?? null),
      )
      .toBeNull();
    await expect(page.getByText("Update available", { exact: true })).toHaveCount(0);
  } finally {
    await new Promise<void>((done, reject) =>
      server.close((error) => (error ? reject(error) : done())),
    );
  }
});
