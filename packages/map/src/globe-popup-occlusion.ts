import type * as maplibregl from "maplibre-gl";

/** JS-observable marker for occluded popups; visual hiding is applied inline. */
export const GLOBE_POPUP_OCCLUDED_CLASS = "geolibre-globe-popup-occluded";

const DEFAULT_OCCLUDED_OPACITY = 0;
const ZERO_OPACITY_STRING = /^[+-]?(?:0+(?:\.0*)?|\.(?:0+))$/;
const patchedPopupPrototypes = new WeakSet<object>();
const configuredPopups = new WeakSet<maplibregl.Popup>();

interface PopupInternals {
  _container?: HTMLElement;
  _updateOpacity?: () => void;
  getLngLat: () => unknown;
  options?: {
    locationOccludedOpacity?: number | string | null;
  };
}

interface InteractiveStyles {
  pointerEvents: string;
  visibility: string;
}

const hiddenPopupStyles = new WeakMap<HTMLElement, InteractiveStyles>();

function shouldSuppressInteraction(popup: PopupInternals): boolean {
  const opacity = popup.options?.locationOccludedOpacity;
  if (typeof opacity === "string") {
    const trimmedOpacity = opacity.trim();
    return ZERO_OPACITY_STRING.test(trimmedOpacity);
  }
  // Else branch is numeric; strict comparison avoids Number(null) === 0.
  return opacity === DEFAULT_OCCLUDED_OPACITY;
}

function restoreInteractiveStyles(container: HTMLElement): void {
  const previous = hiddenPopupStyles.get(container);
  if (!previous) return;
  container.style.pointerEvents = previous.pointerEvents;
  container.style.visibility = previous.visibility;
  hiddenPopupStyles.delete(container);
}

function setPopupOccluded(container: HTMLElement, occluded: boolean): void {
  container.classList.toggle(GLOBE_POPUP_OCCLUDED_CLASS, occluded);

  if (!occluded) {
    restoreInteractiveStyles(container);
    return;
  }

  if (!hiddenPopupStyles.has(container)) {
    hiddenPopupStyles.set(container, {
      pointerEvents: container.style.pointerEvents,
      visibility: container.style.visibility,
    });
  }
  container.style.pointerEvents = "none";
  container.style.visibility = "hidden";
}

export function syncPopupGlobeOcclusion(popup: maplibregl.Popup): boolean {
  const popupInternals = popup as unknown as PopupInternals;
  const container = popupInternals._container;
  if (!container) return false;

  // MapLibre's opacity update owns projection/occlusion detection. Use its
  // result instead of reaching into MapLibre's private camera transform.
  const occluded = Boolean(popupInternals.getLngLat()) && container.style.opacity !== "";
  setPopupOccluded(container, occluded && shouldSuppressInteraction(popupInternals));
  return occluded;
}

export function installGlobePopupOcclusion(maplibre: typeof maplibregl): void {
  const prototype = maplibre.Popup.prototype;
  if (patchedPopupPrototypes.has(prototype)) return;
  const addTo = prototype.addTo;

  // ES module exports are read-only. Configure each popup at its public mount
  // boundary, preserving the shared constructor used by third-party controls.
  prototype.addTo = function (map: maplibregl.Map) {
    if (!configuredPopups.has(this)) {
      const popup = this as unknown as PopupInternals;
      if (popup.options) popup.options.locationOccludedOpacity ??= DEFAULT_OCCLUDED_OPACITY;
      const updateOpacity = popup._updateOpacity;
      popup._updateOpacity = () => {
        if (popup.getLngLat()) updateOpacity?.call(this);
        syncPopupGlobeOcclusion(this);
      };
      configuredPopups.add(this);
    }
    return addTo.call(this, map);
  };
  patchedPopupPrototypes.add(prototype);
}
