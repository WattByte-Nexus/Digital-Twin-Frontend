import {
  DEFAULT_LAYER_STYLE,
  useAppStore,
  type GeoLibreLayer,
} from "@geolibre/core";
import { ClipExtension } from "@deck.gl/extensions";
import type { Layer } from "@deck.gl/core";
import type { ImageUnscale, TextureData } from "weatherlayers-gl";
import type { GeoLibreAppAPI, GeoLibrePlugin } from "../types";
import {
  acquireMercatorProjectionLock,
  releaseMercatorProjectionLock,
} from "./map-projection-utils";

export const WIND_PARTICLES_PLUGIN_ID = "weatherlayers-wind-particles";

const WIND_LAYER_FLAG = "windParticleLayer";
const WIND_SOURCE_KIND = "weather-wind";
const WIND_PROJECTION_LOCK = "weather-wind-particles";
const WIND_DATASET = "gfs/wind_10m_above_ground";
const WIND_BOUNDS: [number, number, number, number] = [-180, -90, 180, 90];
const DEFAULT_PARTICLE_COUNT = 5_000;
const DEFAULT_SPEED_FACTOR = 0.55;
const MIN_PARTICLE_COUNT = 1_000;
const MAX_PARTICLE_COUNT = 12_000;
const MIN_SPEED_FACTOR = 0.1;
const MAX_SPEED_FACTOR = 1;
const ILLUSTRATIVE_WIND_RANGE: [number, number] = [-32, 32];

export type WindDataKind = "live" | "illustrative";

export interface WindParticleSettings {
  animate: boolean;
  numParticles: number;
  speedFactor: number;
}

export interface WindParticleState extends WindParticleSettings {
  active: boolean;
  dataKind: WindDataKind;
  dataLabel: string;
}

export interface WindField {
  image: TextureData;
  image2?: TextureData | null;
  imageWeight?: number;
  imageType: "VECTOR";
  imageUnscale: ImageUnscale;
  bounds: [number, number, number, number];
  dataKind: WindDataKind;
  dataLabel: string;
  metadata: Record<string, unknown>;
}

interface WindParticleLayerProps {
  id: string;
  image: TextureData;
  image2: TextureData | null;
  imageWeight: number;
  imageType: "VECTOR";
  imageUnscale: ImageUnscale;
  imageInterpolation: "LINEAR";
  bounds: [number, number, number, number];
  visible: boolean;
  opacity: number;
  animate: boolean;
  numParticles: number;
  maxAge: number;
  speedFactor: number;
  width: number;
  color: [number, number, number, number];
  maxZoom: number;
  extensions: ClipExtension[];
  clipBounds: [number, number, number, number];
  getPolygonOffset: () => [number, number];
}

export interface WindParticleDependencies {
  loadField: () => Promise<WindField>;
  prepareRenderer?: () => Promise<void>;
  mountOverlay: (app: GeoLibreAppAPI) => Promise<WindParticleOverlay | null>;
  createLayer: (props: WindParticleLayerProps) => Layer;
}

export interface WindParticleOverlay {
  setLayers: (layers: Layer[]) => void;
  remove: () => void;
}

export interface WindParticleController {
  activate: (app: GeoLibreAppAPI) => Promise<boolean>;
  deactivate: () => void;
  getState: () => WindParticleState;
  setAnimating: (animate: boolean) => void;
  setParticleCount: (numParticles: number) => void;
  setSpeedFactor: (speedFactor: number) => void;
  subscribe: (listener: () => void) => () => void;
}

const DEFAULT_SETTINGS: WindParticleSettings = {
  animate: true,
  numParticles: DEFAULT_PARTICLE_COUNT,
  speedFactor: DEFAULT_SPEED_FACTOR,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeSettings(value: unknown): WindParticleSettings {
  const candidate =
    value && typeof value === "object"
      ? (value as Partial<WindParticleSettings>)
      : {};
  return {
    animate:
      typeof candidate.animate === "boolean"
        ? candidate.animate
        : DEFAULT_SETTINGS.animate,
    numParticles:
      typeof candidate.numParticles === "number" &&
      Number.isFinite(candidate.numParticles)
        ? Math.round(
            clamp(
              candidate.numParticles,
              MIN_PARTICLE_COUNT,
              MAX_PARTICLE_COUNT
            )
          )
        : DEFAULT_SETTINGS.numParticles,
    speedFactor:
      typeof candidate.speedFactor === "number" &&
      Number.isFinite(candidate.speedFactor)
        ? clamp(candidate.speedFactor, MIN_SPEED_FACTOR, MAX_SPEED_FACTOR)
        : DEFAULT_SETTINGS.speedFactor,
  };
}

function runtimeEnvironment(): Record<string, string | undefined> {
  const buildEnv = (
    import.meta as ImportMeta & {
      env?: Record<string, string | undefined>;
    }
  ).env;
  if (typeof window === "undefined") return buildEnv ?? {};
  return {
    ...(buildEnv ?? {}),
    ...(window.__GEOLIBRE_RUNTIME_ENV__ ?? {}),
  };
}

/**
 * Generates a deterministic, global two-band vector field for installations
 * without WeatherLayers Cloud credentials. It is intentionally labelled as
 * illustrative everywhere it appears; it demonstrates the renderer without
 * presenting synthetic values as observed weather.
 */
export function createIllustrativeWindField(
  width = 360,
  height = 181
): WindField {
  // Use the same RGBA byte texture shape as WeatherLayers Cloud. This avoids
  // requiring float-renderable textures on older/integrated GPUs while keeping
  // the two vector components in R/G and a fully-valid alpha channel.
  const data = new Uint8ClampedArray(width * height * 4);
  const [windMin, windMax] = ILLUSTRATIVE_WIND_RANGE;
  const encode = (value: number): number =>
    Math.round(
      (clamp(value, windMin, windMax) - windMin) * (255 / (windMax - windMin))
    );
  for (let y = 0; y < height; y += 1) {
    const latitude = 90 - (y / Math.max(1, height - 1)) * 180;
    const latRad = (latitude * Math.PI) / 180;
    const jet = 18 * Math.exp(-Math.pow((Math.abs(latitude) - 45) / 13, 2));
    const tropicalEasterly = -7 * Math.exp(-Math.pow(latitude / 20, 2));
    for (let x = 0; x < width; x += 1) {
      const longitude = -180 + (x / Math.max(1, width - 1)) * 360;
      const lonRad = (longitude * Math.PI) / 180;
      const wave = 3.5 * Math.sin(lonRad * 3 + latRad * 1.5);
      const u = jet + tropicalEasterly + wave;
      const v = 4.5 * Math.sin(lonRad * 2 - latRad) * Math.cos(latRad);
      const offset = (y * width + x) * 4;
      data[offset] = encode(u);
      data[offset + 1] = encode(v);
      data[offset + 2] = 0;
      data[offset + 3] = 255;
    }
  }

  return {
    image: { data, width, height },
    image2: null,
    imageWeight: 0,
    imageType: "VECTOR",
    imageUnscale: ILLUSTRATIVE_WIND_RANGE,
    bounds: WIND_BOUNDS,
    dataKind: "illustrative",
    dataLabel: "Illustrative flow",
    metadata: {
      title: "Wind particles",
      description:
        "Animated illustrative wind flow. Configure VITE_WEATHERLAYERS_ACCESS_TOKEN to display current NOAA GFS 10 m wind.",
      provider: "GeoLibre procedural sample",
      product: "Illustrative global vector field",
      coverage: "Global",
      updateFrequency: "Static sample",
      units: "m/s",
      liveData: false,
      documentation:
        "https://docs.weatherlayers.com/weatherlayers-gl/layers/particle-layer",
    },
  };
}

async function loadLiveWindField(accessToken: string): Promise<WindField> {
  const { Client } = await import("weatherlayers-gl/client");
  const client = new Client({
    accessToken,
    dataFormat: "byte.png",
  });
  const signal = AbortSignal.timeout(12_000);
  const [dataset, data] = await Promise.all([
    client.loadDataset(WIND_DATASET),
    client.loadDatasetData(WIND_DATASET, undefined, { signal }),
  ]);
  return {
    image: data.image,
    image2: data.image2,
    imageWeight: data.imageWeight,
    imageType: "VECTOR",
    imageUnscale: data.imageUnscale,
    bounds: data.bounds,
    dataKind: "live",
    dataLabel: "Live GFS · 10 m",
    metadata: {
      title: dataset.title || "Wind particles",
      description: "Animated NOAA GFS wind at 10 m above ground.",
      provider: "WeatherLayers Cloud / NOAA GFS",
      product: WIND_DATASET,
      datetime: data.datetime,
      referenceDatetime: data.referenceDatetime,
      forecastHorizon: data.horizon,
      coverage: "Global",
      units: dataset.unitFormat.unit,
      attribution: dataset.attribution,
      liveData: true,
      documentation:
        "https://docs.weatherlayers.com/weatherlayers-gl/layers/particle-layer",
    },
  };
}

export async function loadWindField(): Promise<WindField> {
  const accessToken =
    runtimeEnvironment().VITE_WEATHERLAYERS_ACCESS_TOKEN?.trim();
  if (!accessToken) return createIllustrativeWindField();
  try {
    return await loadLiveWindField(accessToken);
  } catch (error) {
    console.warn(
      "[GeoLibre] wind particles: live WeatherLayers data failed; using illustrative flow.",
      error
    );
    return createIllustrativeWindField();
  }
}

function createStoreLayer(
  field: WindField,
  settings: WindParticleSettings
): GeoLibreLayer {
  return {
    id: crypto.randomUUID(),
    name: "Wind particles",
    type: "deckgl-viz",
    source: { type: WIND_SOURCE_KIND },
    visible: true,
    opacity: 0.82,
    style: { ...DEFAULT_LAYER_STYLE },
    metadata: {
      ...field.metadata,
      sourceKind: WIND_SOURCE_KIND,
      customLayerType: WIND_SOURCE_KIND,
      externalDeckLayer: true,
      identifiable: false,
      [WIND_LAYER_FLAG]: true,
      bounds: field.bounds,
      windParticleSettings: settings,
      windDataKind: field.dataKind,
    },
  };
}

let ParticleLayerClass: (new (props: WindParticleLayerProps) => Layer) | null =
  null;

/**
 * Mount WeatherLayers on its own overlaid Deck canvas.
 *
 * MapboxOverlay interleaved instances reuse one Deck instance per map. External
 * plugins can legitimately own another interleaved overlay, so a wind overlay
 * joining that shared instance would make the two producers replace each
 * other's complete layer lists. A non-interleaved overlay owns its renderer
 * and can animate independently without clobbering engine/3D layers.
 */
export async function createWindParticleOverlay(
  app: GeoLibreAppAPI
): Promise<WindParticleOverlay | null> {
  if (!app.getDeckGL) return null;
  const deckGL = await app.getDeckGL();
  const overlay = new deckGL.mapbox.MapboxOverlay({
    interleaved: false,
    layers: [],
  });
  if (!app.addMapControl(overlay, "top-left")) return null;
  return {
    setLayers: (layers) => overlay.setProps({ layers }),
    remove: () => app.removeMapControl(overlay),
  };
}

const defaultDependencies: WindParticleDependencies = {
  loadField: loadWindField,
  prepareRenderer: async () => {
    ParticleLayerClass ??= (await import("weatherlayers-gl"))
      .ParticleLayer as unknown as new (props: WindParticleLayerProps) => Layer;
  },
  mountOverlay: createWindParticleOverlay,
  createLayer: (props) => {
    if (!ParticleLayerClass) {
      throw new Error(
        "WeatherLayers ParticleLayer renderer has not been loaded."
      );
    }
    return new ParticleLayerClass(props);
  },
};

export function createWindParticleController(
  dependencies: WindParticleDependencies = defaultDependencies
): WindParticleController {
  let layerId: string | null = null;
  let field: WindField | null = null;
  let settings = { ...DEFAULT_SETTINGS };
  let activationGeneration = 0;
  let unsubscribeStore: (() => void) | null = null;
  let overlay: WindParticleOverlay | null = null;
  let appRef: GeoLibreAppAPI | null = null;
  const listeners = new Set<() => void>();

  const notify = (): void => {
    for (const listener of listeners) listener();
  };

  const ownedLayer = (): GeoLibreLayer | undefined => {
    if (!layerId) return undefined;
    return useAppStore.getState().layers.find((layer) => layer.id === layerId);
  };

  const render = (): void => {
    const layer = ownedLayer();
    if (!field || !layer) {
      overlay?.setLayers([]);
      return;
    }
    overlay?.setLayers([
      dependencies.createLayer({
        id: `weather-wind-particles-${layer.id}`,
        image: field.image,
        image2: field.image2 ?? null,
        imageWeight: field.imageWeight ?? 0,
        imageType: field.imageType,
        imageUnscale: field.imageUnscale,
        imageInterpolation: "LINEAR",
        bounds: field.bounds,
        visible: layer.visible,
        opacity: layer.opacity,
        animate: settings.animate,
        numParticles: settings.numParticles,
        maxAge: 85,
        speedFactor: settings.speedFactor,
        width: 1.8,
        color: [20, 155, 255, 245],
        maxZoom: 15,
        extensions: [new ClipExtension()],
        clipBounds: [-181, -85.051129, 181, 85.051129],
        getPolygonOffset: () => [0, -1000],
      }),
    ]);
  };

  const persistSettings = (): void => {
    const layer = ownedLayer();
    if (!layer) return;
    const saved = normalizeSettings(layer.metadata.windParticleSettings);
    if (
      saved.animate === settings.animate &&
      saved.numParticles === settings.numParticles &&
      saved.speedFactor === settings.speedFactor
    ) {
      return;
    }
    useAppStore.getState().updateLayer(layer.id, {
      metadata: {
        ...layer.metadata,
        windParticleSettings: settings,
      },
    });
  };

  const removeOverlay = (): void => {
    overlay?.setLayers([]);
    overlay?.remove();
    overlay = null;
    if (appRef) {
      releaseMercatorProjectionLock(WIND_PROJECTION_LOCK, appRef);
      appRef = null;
    }
  };

  const resetRuntime = (): void => {
    unsubscribeStore?.();
    unsubscribeStore = null;
    removeOverlay();
    layerId = null;
    field = null;
  };

  return {
    activate: async (app): Promise<boolean> => {
      const generation = (activationGeneration += 1);
      const [loaded] = await Promise.all([
        dependencies.loadField(),
        dependencies.prepareRenderer?.() ?? Promise.resolve(),
      ]);
      if (generation !== activationGeneration) return false;

      appRef = app;
      acquireMercatorProjectionLock(WIND_PROJECTION_LOCK, app);
      let mountedOverlay: WindParticleOverlay | null;
      try {
        mountedOverlay = await dependencies.mountOverlay(app);
      } catch (error) {
        releaseMercatorProjectionLock(WIND_PROJECTION_LOCK, app);
        appRef = null;
        throw error;
      }
      if (generation !== activationGeneration) {
        mountedOverlay?.remove();
        releaseMercatorProjectionLock(WIND_PROJECTION_LOCK, app);
        appRef = null;
        return false;
      }
      if (!mountedOverlay) {
        releaseMercatorProjectionLock(WIND_PROJECTION_LOCK, app);
        appRef = null;
        return false;
      }

      overlay = mountedOverlay;
      field = loaded;
      const store = useAppStore.getState();
      const existing = store.layers.find(
        (layer) => layer.metadata[WIND_LAYER_FLAG] === true
      );
      if (existing) {
        layerId = existing.id;
        settings = normalizeSettings(existing.metadata.windParticleSettings);
        const nextMetadata = {
          ...existing.metadata,
          ...loaded.metadata,
          windDataKind: loaded.dataKind,
          bounds: loaded.bounds,
          windParticleSettings: settings,
        };
        store.updateLayer(existing.id, { metadata: nextMetadata });
      } else {
        settings = { ...DEFAULT_SETTINGS };
        const layer = createStoreLayer(loaded, settings);
        layerId = layer.id;
        store.addLayer(layer);
      }

      unsubscribeStore?.();
      unsubscribeStore = useAppStore.subscribe((state, previous) => {
        const nextLayer = state.layers.find((layer) => layer.id === layerId);
        const previousLayer = previous.layers.find(
          (layer) => layer.id === layerId
        );
        if (!nextLayer) {
          resetRuntime();
          notify();
          return;
        }
        if (
          nextLayer.visible !== previousLayer?.visible ||
          nextLayer.opacity !== previousLayer?.opacity
        ) {
          render();
        }
      });
      render();
      notify();
      return true;
    },

    deactivate: (): void => {
      activationGeneration += 1;
      const id = layerId;
      unsubscribeStore?.();
      unsubscribeStore = null;
      removeOverlay();
      if (
        id &&
        useAppStore.getState().layers.some((layer) => layer.id === id)
      ) {
        useAppStore.getState().removeLayer(id);
      }
      layerId = null;
      field = null;
      notify();
    },

    getState: (): WindParticleState => ({
      active: layerId !== null && ownedLayer() !== undefined,
      animate: settings.animate,
      numParticles: settings.numParticles,
      speedFactor: settings.speedFactor,
      dataKind: field?.dataKind ?? "illustrative",
      dataLabel: field?.dataLabel ?? "Not loaded",
    }),

    setAnimating: (animate): void => {
      settings = { ...settings, animate };
      persistSettings();
      render();
      notify();
    },

    setParticleCount: (numParticles): void => {
      settings = {
        ...settings,
        numParticles: Math.round(
          clamp(numParticles, MIN_PARTICLE_COUNT, MAX_PARTICLE_COUNT)
        ),
      };
      persistSettings();
      render();
      notify();
    },

    setSpeedFactor: (speedFactor): void => {
      settings = {
        ...settings,
        speedFactor: clamp(speedFactor, MIN_SPEED_FACTOR, MAX_SPEED_FACTOR),
      };
      persistSettings();
      render();
      notify();
    },

    subscribe: (listener): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const controller = createWindParticleController();

export function getWindParticleState(): WindParticleState {
  return controller.getState();
}

export function setWindParticlesAnimating(animate: boolean): void {
  controller.setAnimating(animate);
}

export function setWindParticleCount(numParticles: number): void {
  controller.setParticleCount(numParticles);
}

export function setWindParticleSpeed(speedFactor: number): void {
  controller.setSpeedFactor(speedFactor);
}

export function subscribeWindParticles(listener: () => void): () => void {
  return controller.subscribe(listener);
}

export const maplibreWindParticlesPlugin: GeoLibrePlugin = {
  id: WIND_PARTICLES_PLUGIN_ID,
  name: "Wind particles",
  version: "0.1.0",
  activate: (app) => controller.activate(app),
  deactivate: () => controller.deactivate(),
};
