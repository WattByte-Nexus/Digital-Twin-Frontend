import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createGoldenUsgsLidarLayer,
  DIGITAL_TWIN_LIDAR_OVERLAY_PROPS,
  GAUSSIAN_SURFEL_FRAGMENT_INJECTION,
  GaussianSurfelPointCloudLayer,
  GOLDEN_USGS_LIDAR_TILESET_URL,
} from "../apps/geolibre-desktop/src/product-modes/digital-twin/digital-twin-lidar";

describe("Digital Twin LiDAR fusion layer", () => {
  it("streams the Golden point cloud as 3D Tiles in the interleaved map scene", () => {
    const layer = createGoldenUsgsLidarLayer({
      onError: () => {},
      onReady: () => {},
    });

    assert.equal(DIGITAL_TWIN_LIDAR_OVERLAY_PROPS.interleaved, true);
    assert.equal(layer.props.data, GOLDEN_USGS_LIDAR_TILESET_URL);
    assert.equal(layer.props.pointSize, 4);
    assert.equal(layer.props.pickable, false);
    assert.equal(layer.props.operation, "draw");
    assert.equal(
      layer.props._subLayerProps?.pointcloud?.type,
      GaussianSurfelPointCloudLayer,
    );
    assert.match(GAUSSIAN_SURFEL_FRAGMENT_INJECTION, /exp\(/);
    assert.match(GAUSSIAN_SURFEL_FRAGMENT_INJECTION, /geometry\.uv/);
  });

  it("reports ready after the first spatial tile and reports pre-ready failures", () => {
    let readyCount = 0;
    const errors: Error[] = [];
    const layer = createGoldenUsgsLidarLayer({
      onError: (error) => errors.push(error),
      onReady: () => {
        readyCount += 1;
      },
    });

    layer.props.onTileError({} as never, "request failed", "/points/r0.pnts");
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /request failed/);
    assert.match(errors[0].message, /r0\.pnts/);

    layer.props.onTileLoad({} as never);
    layer.props.onTileLoad({} as never);
    assert.equal(readyCount, 1);
  });
});
