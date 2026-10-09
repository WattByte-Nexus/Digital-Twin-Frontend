import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { tsImport } from "tsx/esm/api";
import { fahrenheitToCelsius } from "../packages/ui/src/components/weather/types";

const panelModule = tsImport("../packages/ui/src/components/weather/weather-settings-panel.tsx", {
  parentURL: import.meta.url,
  tsconfig: "tsconfig.base.json",
});

test("live Celsius readings appear as Fahrenheit in the summary and controls", async () => {
  const { WeatherSettingsPanel } = await panelModule;
  const html = renderToStaticMarkup(createElement(WeatherSettingsPanel, {
    initialValue: { mode: "auto", temperature: 20 },
    autoWeatherReadings: [
      { id: "temperature_c", label: "Air temperature", unit: "°C", value: 20 },
      { id: "dew_point_c", label: "Dew point", unit: "°C", value: 8.5 },
    ],
  }));
  assert.match(html, /68°F/);
  assert.match(html, /Temperature in Fahrenheit/);
  assert.match(html, /value="68"/);
  assert.match(html, /value="47.3"/);
  assert.doesNotMatch(html, /°C|Temperature in Celsius/);
});

test("manual Fahrenheit values preserve Celsius weather state", async () => {
  const { WeatherSettingsPanel } = await panelModule;
  const html = renderToStaticMarkup(createElement(WeatherSettingsPanel, {
    initialValue: {
      temperature: fahrenheitToCelsius(32),
      events: { dewPoint: fahrenheitToCelsius(-4) },
    },
  }));
  assert.match(html, /32°F/);
  assert.match(html, /value="32"/);
  assert.match(html, /value="-4"/);
});

test("missing live temperature remains unavailable", async () => {
  const { WeatherSettingsPanel } = await panelModule;
  const html = renderToStaticMarkup(createElement(WeatherSettingsPanel, {
    initialValue: { mode: "auto" },
    autoWeatherReadings: [],
  }));
  assert.match(html, /Unavailable/);
  assert.doesNotMatch(html, /Temperature in Fahrenheit|106°F/);
});
