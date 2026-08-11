#!/usr/bin/env -S uv run --python 3.12
# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = [
#   "ept-python==0.8",
#   "pillow==12.1.0",
#   "py3dtiles==12.1.1",
# ]
# ///
"""Build a browser-ready 3D Tiles point cloud from a bounded USGS EPT query."""

from __future__ import annotations

import argparse
import io
import json
import math
import shutil
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

import ept
import laspy
import numpy as np
from PIL import Image
from py3dtiles.convert import convert
from pyproj import CRS, Transformer


DEFAULT_EPT_URL = (
    "https://s3-us-west-2.amazonaws.com/usgs-lidar-public/CO_DRCOG_2_2020"
)
DEFAULT_IMAGERY_URL = (
    "https://drcog-data.sanborn.com/arcgis/rest/services/"
    "DRCOG_2022/DRCOG_Mosaics_2022/ImageServer/exportImage"
)
DEFAULT_IMAGERY_SIZE = 4_096
DEFAULT_CLASSIFICATIONS = [1, 3, 4, 5, 6, 14, 15]
DISPLAY_VOXEL_METERS = (4.0, 4.0, 3.0)
VOXEL_CHUNK_POINTS = 1_000_000
UTILITY_CLASSES = (14, 15)
DEFAULT_OUTPUT = Path(
    "apps/geolibre-desktop/public/data/usgs-lidar/golden-city"
)
GOLDEN_BOUNDARY_URL = (
    "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/"
    "Places_CouSub_ConCity_SubMCD/MapServer/4/query?"
    + urllib.parse.urlencode(
        {
            "where": "GEOID='0830835'",
            "outFields": "GEOID,BASENAME,NAME,AREALAND",
            "returnGeometry": "true",
            "outSR": "4326",
            "f": "geojson",
        }
    )
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Stream a bounded USGS EPT point cloud, colorize it, correct its "
            "NAVD88 terrain height, and convert it to self-hostable OGC 3D Tiles."
        )
    )
    parser.add_argument(
        "--query-resolution",
        type=float,
        default=1,
        help="EPT sampling resolution in meters for the city-wide query (default: 1).",
    )
    parser.add_argument("--ept-url", default=DEFAULT_EPT_URL)
    parser.add_argument("--imagery-url", default=DEFAULT_IMAGERY_URL)
    parser.add_argument(
        "--imagery-size",
        type=int,
        default=DEFAULT_IMAGERY_SIZE,
        help=(
            "Maximum width or height of the orthophoto sampled onto the points "
            "(default: 4096)."
        ),
    )
    parser.add_argument("--boundary-url", default=GOLDEN_BOUNDARY_URL)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--classifications",
        type=int,
        nargs="+",
        default=DEFAULT_CLASSIFICATIONS,
        help=(
            "Above-ground ASPRS classifications to retain "
            "(default: 1 3 4 5 6 14 15)."
        ),
    )
    parser.add_argument("--jobs", type=int, default=4)
    return parser.parse_args()


def validate_args(args: argparse.Namespace) -> None:
    if not math.isfinite(args.query_resolution) or args.query_resolution <= 0:
        raise ValueError("--query-resolution must be greater than zero")
    if args.imagery_size <= 0:
        raise ValueError("--imagery-size must be greater than zero")
    if args.jobs <= 0:
        raise ValueError("--jobs must be greater than zero")


def fetch_city_boundary(boundary_url: str):
    with urllib.request.urlopen(boundary_url, timeout=30) as response:
        payload = json.load(response)
    features = payload.get("features", [])
    if len(features) != 1:
        raise RuntimeError(
            f"Expected one Golden municipal boundary, received {len(features)}"
        )
    feature = features[0]
    coordinate_pairs: list[tuple[float, float]] = []

    def collect_coordinates(value) -> None:
        if (
            isinstance(value, list)
            and len(value) >= 2
            and isinstance(value[0], (int, float))
            and isinstance(value[1], (int, float))
        ):
            coordinate_pairs.append((float(value[0]), float(value[1])))
            return
        for child in value:
            collect_coordinates(child)

    collect_coordinates(feature["geometry"]["coordinates"])
    longitudes, latitudes = zip(*coordinate_pairs, strict=True)
    bounds_wgs84 = (
        min(longitudes),
        min(latitudes),
        max(longitudes),
        max(latitudes),
    )
    to_mercator = Transformer.from_crs(4326, 3857, always_xy=True)
    min_x, min_y = to_mercator.transform(bounds_wgs84[0], bounds_wgs84[1])
    max_x, max_y = to_mercator.transform(bounds_wgs84[2], bounds_wgs84[3])
    return feature, bounds_wgs84, (min_x, min_y, max_x, max_y)


def query_lidar(
    ept_url: str,
    bounds: tuple[float, ...],
    query_resolution: float,
    classifications: list[int] | None,
) -> tuple[laspy.LasData, int]:
    min_x, min_y, max_x, max_y = bounds
    query = ept.EPT(
        ept_url.rstrip("/"),
        bounds=ept.Bounds(min_x, min_y, -1_000, max_x, max_y, 10_000),
        queryResolution=query_resolution,
    )
    lidar = query.as_laspy()
    if lidar is None or len(lidar.points) == 0:
        raise RuntimeError(
            "The USGS EPT query returned no points for the requested area"
        )

    if classifications:
        mask = np.isin(lidar.classification, classifications)
        lidar.points = lidar.points[mask]
        if len(lidar.points) == 0:
            raise RuntimeError(
                "No points matched --classifications "
                + ", ".join(str(value) for value in classifications)
            )

    source_point_count = len(lidar.points)
    return spatially_thin_for_display(lidar), source_point_count


def spatially_thin_for_display(lidar: laspy.LasData) -> laspy.LasData:
    """Retain one surface sample per voxel while preserving sparse utilities."""
    voxel_steps = tuple(
        max(1, round(size / scale))
        for size, scale in zip(
            DISPLAY_VOXEL_METERS,
            lidar.header.scales,
            strict=True,
        )
    )
    selected_chunks: list[np.ndarray] = []
    key_type = np.dtype(
        [("x", "<i4"), ("y", "<i4"), ("z", "<i4"), ("classification", "u1")]
    )

    for start in range(0, len(lidar.points), VOXEL_CHUNK_POINTS):
        end = min(start + VOXEL_CHUNK_POINTS, len(lidar.points))
        classifications = np.asarray(lidar.classification[start:end])
        utility_mask = np.isin(classifications, UTILITY_CLASSES)
        surface_indices = np.flatnonzero(~utility_mask)

        keys = np.empty(end - start, dtype=key_type)
        keys["x"] = np.floor_divide(np.asarray(lidar.X[start:end]), voxel_steps[0])
        keys["y"] = np.floor_divide(np.asarray(lidar.Y[start:end]), voxel_steps[1])
        keys["z"] = np.floor_divide(np.asarray(lidar.Z[start:end]), voxel_steps[2])
        keys["classification"] = classifications

        if len(surface_indices) > 0:
            _, first_positions = np.unique(
                keys[surface_indices],
                return_index=True,
            )
            surface_indices = surface_indices[first_positions]

        local_indices = np.sort(
            np.concatenate((surface_indices, np.flatnonzero(utility_mask)))
        )
        selected_chunks.append(local_indices + start)

    lidar.points = lidar.points[np.concatenate(selected_chunks)]
    return lidar


def imagery_dimensions(bounds: tuple[float, ...], maximum_size: int) -> tuple[int, int]:
    width_meters = bounds[2] - bounds[0]
    height_meters = bounds[3] - bounds[1]
    if width_meters >= height_meters:
        return maximum_size, max(1, round(maximum_size * height_meters / width_meters))
    return max(1, round(maximum_size * width_meters / height_meters)), maximum_size


def fetch_imagery(
    imagery_url: str,
    bounds: tuple[float, ...],
    maximum_size: int,
) -> tuple[np.ndarray, str]:
    width, height = imagery_dimensions(bounds, maximum_size)
    query = urllib.parse.urlencode(
        {
            "bbox": ",".join(str(value) for value in bounds),
            "bboxSR": 3857,
            "imageSR": 3857,
            "size": f"{width},{height}",
            "format": "png32",
            "f": "image",
        }
    )
    request_url = f"{imagery_url}{'&' if '?' in imagery_url else '?'}{query}"
    with urllib.request.urlopen(request_url, timeout=120) as response:
        payload = response.read()
    with Image.open(io.BytesIO(payload)) as image:
        pixels = np.asarray(image.convert("RGB"), dtype=np.uint8).copy()
    if pixels.shape != (height, width, 3):
        raise RuntimeError(
            "Imagery service returned unexpected dimensions: "
            f"{pixels.shape!r}, expected {(height, width, 3)!r}"
        )
    return pixels, request_url


def sample_imagery_colors(
    lidar: laspy.LasData,
    imagery: np.ndarray,
    bounds: tuple[float, ...],
) -> np.ndarray:
    height, width, _ = imagery.shape
    x_fraction = (np.asarray(lidar.x) - bounds[0]) / (bounds[2] - bounds[0])
    y_fraction = (bounds[3] - np.asarray(lidar.y)) / (bounds[3] - bounds[1])
    columns = np.clip(np.rint(x_fraction * (width - 1)), 0, width - 1).astype(int)
    rows = np.clip(np.rint(y_fraction * (height - 1)), 0, height - 1).astype(int)
    return imagery[rows, columns]


def colorize_for_satellite_terrain(
    lidar: laspy.LasData,
    imagery: np.ndarray,
    bounds: tuple[float, ...],
) -> laspy.LasData:
    colored = laspy.convert(lidar, point_format_id=7)
    colors = sample_imagery_colors(colored, imagery, bounds).copy()

    # Preserve legibility for sparse utility classes whose footprints are too
    # small to inherit a useful orthophoto color.
    classifications = np.asarray(colored.classification)
    colors[classifications == 14] = (222, 45, 255)
    colors[classifications == 15] = (255, 126, 46)

    colors_16_bit = colors.astype(np.uint16) * 257
    colored.red = colors_16_bit[:, 0]
    colored.green = colors_16_bit[:, 1]
    colored.blue = colors_16_bit[:, 2]
    return colored


def write_source_metadata(
    output: Path,
    args: argparse.Namespace,
    boundary_feature: dict,
    center: tuple[float, float],
    bounds: tuple[float, ...],
    point_count: int,
    source_point_count: int,
    imagery_dimensions: tuple[int, int],
    imagery_request_url: str,
) -> None:
    metadata = {
        "title": "Golden city-wide USGS 3DEP LiDAR",
        "project": "CO DRCOG 2 2020",
        "source": "U.S. Geological Survey 3D Elevation Program",
        "sourceUrl": args.ept_url,
        "rights": "Public domain; free of charge and without use restrictions",
        "municipality": boundary_feature["properties"],
        "boundarySourceUrl": args.boundary_url,
        "coverage": "Continuous bounding envelope of the Golden municipal boundary",
        "center": list(center),
        "queryBoundsEpsg3857": list(bounds),
        "queryResolutionMeters": args.query_resolution,
        "verticalDatum": "NAVD88 source elevations retained for MapLibre raster-dem alignment",
        "pointCount": point_count,
        "sourcePointCount": source_point_count,
        "displayVoxelMeters": list(DISPLAY_VOXEL_METERS),
        "classifications": args.classifications,
        "groundPointsRendered": False,
        "pointColoring": {
            "mode": "imagery-overlay",
            "source": "DRCOG / Sanborn — DRAPP 2022",
            "sourceUrl": args.imagery_url,
            "requestUrl": imagery_request_url,
            "imagerySize": args.imagery_size,
            "dimensions": list(imagery_dimensions),
            "semanticClassOverrides": {
                "14": "wire conductor",
                "15": "transmission tower",
            },
        },
    }
    (output / "source.json").write_text(json.dumps(metadata, indent=2) + "\n")


def normalize_tileset_metadata(output: Path) -> None:
    tileset_path = output / "tileset.json"
    tileset = json.loads(tileset_path.read_text())

    def use_additive_point_refinement(tile: dict) -> None:
        # Point-cloud hierarchy levels are independent density samples. Keeping
        # py3dtiles' REPLACE parents above ADD children deadlocks loaders.gl's
        # traversal: it waits for every child before replacing the parent while
        # non-visible ADD children are deliberately not requested. ADD at every
        # level streams visible detail without dropping the overview coverage.
        tile["refine"] = "ADD"
        for child in tile.get("children", []):
            use_additive_point_refinement(child)

    use_additive_point_refinement(tileset["root"])
    extras = tileset.setdefault("asset", {}).setdefault("extras", {})
    extras.pop("created_date", None)
    extras.update(
        {
            "source": "U.S. Geological Survey 3D Elevation Program",
            "rights": "Public domain",
        }
    )
    tileset_path.write_text(json.dumps(tileset, separators=(",", ":")) + "\n")


def build(args: argparse.Namespace) -> None:
    validate_args(args)
    boundary_feature, bounds_wgs84, bounds = fetch_city_boundary(
        args.boundary_url
    )
    center = (
        (bounds_wgs84[0] + bounds_wgs84[2]) / 2,
        (bounds_wgs84[1] + bounds_wgs84[3]) / 2,
    )
    print(
        "Streaming city-wide USGS LiDAR for Golden boundary "
        f"at {args.query_resolution:g} m EPT resolution"
    )
    lidar, source_point_count = query_lidar(
        args.ept_url,
        bounds,
        args.query_resolution,
        args.classifications,
    )
    print(
        f"Spatial display sampling retained {len(lidar.points):,} of "
        f"{source_point_count:,} classified points"
    )
    print("Fetching DRAPP orthophoto for point colorization")
    imagery, imagery_request_url = fetch_imagery(
        args.imagery_url,
        bounds,
        args.imagery_size,
    )
    colored = colorize_for_satellite_terrain(lidar, imagery, bounds)
    print(f"Converting {len(colored.points):,} map-terrain-aligned points")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(
        prefix=f".{args.output.name}-build-",
        dir=args.output.parent,
    ) as scratch:
        source_path = Path(scratch) / "source.las"
        staged_output = Path(scratch) / "tiles"
        colored.write(source_path)
        convert(
            source_path,
            outfolder=staged_output,
            overwrite=True,
            jobs=args.jobs,
            crs_out=CRS.from_epsg(4978),
            rgb=True,
            verbose=False,
        )
        normalize_tileset_metadata(staged_output)
        (staged_output / "boundary.geojson").write_text(
            json.dumps(
                {"type": "FeatureCollection", "features": [boundary_feature]},
                separators=(",", ":"),
            )
            + "\n"
        )
        write_source_metadata(
            staged_output,
            args,
            boundary_feature,
            center,
            bounds,
            len(colored.points),
            source_point_count,
            (imagery.shape[1], imagery.shape[0]),
            imagery_request_url,
        )

        previous_output = Path(scratch) / "previous"
        if args.output.exists():
            args.output.rename(previous_output)
        try:
            staged_output.rename(args.output)
        except BaseException:
            if previous_output.exists() and not args.output.exists():
                previous_output.rename(args.output)
            raise
        if previous_output.exists():
            shutil.rmtree(previous_output)

    print(f"Wrote {args.output / 'tileset.json'}")


if __name__ == "__main__":
    build(parse_args())
