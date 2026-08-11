interface IgnitionCoordinate {
  latitude: number;
  longitude: number;
}

interface IgnitionFocusMap {
  fitBounds: (
    bounds: [[number, number], [number, number]],
    options: { duration: number; maxZoom: number; padding: number },
  ) => unknown;
  jumpTo: (options: { center: [number, number]; zoom: number }) => unknown;
}

function ignitionBounds(
  points: readonly IgnitionCoordinate[],
): [[number, number], [number, number]] | null {
  const first = points[0];
  if (!first) return null;
  return points.reduce<[[number, number], [number, number]]>(
    (bounds, point) => [
      [Math.min(bounds[0][0], point.longitude), Math.min(bounds[0][1], point.latitude)],
      [Math.max(bounds[1][0], point.longitude), Math.max(bounds[1][1], point.latitude)],
    ],
    [
      [first.longitude, first.latitude],
      [first.longitude, first.latitude],
    ],
  );
}

export function focusMapOnIgnitions(
  map: IgnitionFocusMap,
  points: readonly IgnitionCoordinate[],
): boolean {
  const bounds = ignitionBounds(points);
  if (!bounds) return false;

  const [[west, south], [east, north]] = bounds;
  if (west === east && south === north) {
    map.jumpTo({ center: [west, south], zoom: 14 });
  } else {
    map.fitBounds(bounds, { duration: 0, maxZoom: 14, padding: 96 });
  }
  return true;
}
