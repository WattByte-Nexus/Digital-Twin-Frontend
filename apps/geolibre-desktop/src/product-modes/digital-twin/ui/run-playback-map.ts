import type { FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

const RESULT_SOURCE_ID = "digital-twin-run-playback-result";
const RESULT_FILL_LAYER_ID = "digital-twin-run-playback-result-fill";
const RESULT_LINE_LAYER_ID = "digital-twin-run-playback-result-line";
const IGNITION_LAYER_ID = "digital-twin-run-ignition-points-circle";

interface RunPlaybackMapColors {
  result: string;
}

export function renderRunPlaybackFrame(
  map: MapLibreMap,
  result: FeatureCollection<Geometry, GeoJsonProperties>,
  colors: RunPlaybackMapColors,
): void {
  const source = map.getSource(RESULT_SOURCE_ID) as GeoJSONSource | undefined;
  if (source) source.setData(result);
  else map.addSource(RESULT_SOURCE_ID, { type: "geojson", data: result });

  const beforeId = map.getLayer(IGNITION_LAYER_ID) ? IGNITION_LAYER_ID : undefined;
  if (!map.getLayer(RESULT_FILL_LAYER_ID)) {
    map.addLayer(
      {
        id: RESULT_FILL_LAYER_ID,
        type: "fill",
        source: RESULT_SOURCE_ID,
        paint: {
          "fill-color": colors.result,
          "fill-opacity": 0.28,
        },
      },
      beforeId,
    );
  }
  if (!map.getLayer(RESULT_LINE_LAYER_ID)) {
    map.addLayer(
      {
        id: RESULT_LINE_LAYER_ID,
        type: "line",
        source: RESULT_SOURCE_ID,
        paint: {
          "line-color": colors.result,
          "line-width": 2.5,
          "line-opacity": 0.9,
          "line-dasharray": [3, 2],
        },
      },
      beforeId,
    );
  }
}

export function removeRunPlaybackFrame(map: MapLibreMap): void {
  if (map.getLayer(RESULT_LINE_LAYER_ID)) map.removeLayer(RESULT_LINE_LAYER_ID);
  if (map.getLayer(RESULT_FILL_LAYER_ID)) map.removeLayer(RESULT_FILL_LAYER_ID);
  if (map.getSource(RESULT_SOURCE_ID)) map.removeSource(RESULT_SOURCE_ID);
}
