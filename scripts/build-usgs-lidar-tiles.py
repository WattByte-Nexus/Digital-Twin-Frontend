#!/usr/bin/env -S uv run --python 3.12
# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = [
#   "ept-python==0.8",
#   "py3dtiles==12.1.1",
# ]
# ///
"""Build a browser-ready 3D Tiles point cloud from a bounded USGS EPT query."""

from __future__ import annotations

import argparse
import json
import math
import struct
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

import ept
import laspy
import numpy as np
from py3dtiles.convert import convert
from pyproj import CRS, Transformer


DEFAULT_EPT_URL = (
    "https://s3-us-west-2.amazonaws.com/usgs-lidar-public/CO_DRCOG_2_2020"
)
DEFAULT_OUTPUT = Path(
    "apps/geolibre-desktop/public/data/usgs-lidar/golden-pilot"
)
NOAA_GEOID_URL = "https://geodesy.noaa.gov/api/geoid/ght"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Stream a bounded USGS EPT point cloud, colorize it, correct its "
            "NAVD88 height, and convert it to self-hostable OGC 3D Tiles."
        )
    )
    parser.add_argument("--center-lon", type=float, default=-105.2211)
    parser.add_argument("--center-lat", type=float, default=39.7555)
    parser.add_argument(
        "--size-m",
        type=float,
        default=200,
        help="Width and height of the square query in meters (default: 200).",
    )
    parser.add_argument("--ept-url", default=DEFAULT_EPT_URL)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--classifications",
        type=int,
        nargs="+",
        help="Optional ASPRS classification values to retain, such as 2 6.",
    )
    parser.add_argument(
        "--max-points",
        type=int,
        default=150_000,
        help="Deterministic display-point cap (default: 150000).",
    )
    parser.add_argument(
        "--geoid-height",
        type=float,
        help=(
            "GEOID18 height in meters. When omitted, query NOAA for the center. "
            "Ellipsoid height is computed as NAVD88 height plus this value."
        ),
    )
    parser.add_argument("--jobs", type=int, default=4)
    return parser.parse_args()


def validate_args(args: argparse.Namespace) -> None:
    if not -180 <= args.center_lon <= 180:
        raise ValueError("--center-lon must be between -180 and 180")
    if not -90 <= args.center_lat <= 90:
        raise ValueError("--center-lat must be between -90 and 90")
    if not math.isfinite(args.size_m) or args.size_m <= 0:
        raise ValueError("--size-m must be greater than zero")
    if args.max_points <= 0:
        raise ValueError("--max-points must be greater than zero")
    if args.jobs <= 0:
        raise ValueError("--jobs must be greater than zero")


def web_mercator_bounds(lon: float, lat: float, size_m: float) -> tuple[float, ...]:
    transformer = Transformer.from_crs(4326, 3857, always_xy=True)
    center_x, center_y = transformer.transform(lon, lat)
    half_size = size_m / 2
    return (
        center_x - half_size,
        center_y - half_size,
        center_x + half_size,
        center_y + half_size,
    )


def fetch_geoid_height(lon: float, lat: float) -> float:
    query = urllib.parse.urlencode({"lat": lat, "lon": lon, "model": 14})
    with urllib.request.urlopen(f"{NOAA_GEOID_URL}?{query}", timeout=30) as response:
        payload = json.load(response)
    if payload.get("geoidModel") != "GEOID18":
        raise RuntimeError(f"NOAA returned an unexpected geoid model: {payload!r}")
    height = float(payload["geoidHeight"])
    if not math.isfinite(height):
        raise RuntimeError(f"NOAA returned an invalid geoid height: {payload!r}")
    return height


def query_lidar(
    ept_url: str,
    bounds: tuple[float, ...],
    classifications: list[int] | None,
    max_points: int,
) -> laspy.LasData:
    min_x, min_y, max_x, max_y = bounds
    query = ept.EPT(
        ept_url.rstrip("/"),
        bounds=ept.Bounds(min_x, min_y, -1_000, max_x, max_y, 10_000),
    )
    lidar = query.as_laspy()
    if len(lidar.points) == 0:
        raise RuntimeError("The USGS EPT query returned no points for the requested area")

    if classifications:
        mask = np.isin(lidar.classification, classifications)
        lidar.points = lidar.points[mask]
        if len(lidar.points) == 0:
            raise RuntimeError(
                "No points matched --classifications "
                + ", ".join(str(value) for value in classifications)
            )

    if len(lidar.points) > max_points:
        indices = np.linspace(0, len(lidar.points) - 1, max_points, dtype=np.int64)
        lidar.points = lidar.points[indices]
    return lidar


def normalized(values: np.ndarray, low: float, high: float) -> np.ndarray:
    lower, upper = np.percentile(values, (low, high))
    if upper <= lower:
        return np.full(values.shape, 0.5, dtype=np.float64)
    return np.clip((values - lower) / (upper - lower), 0, 1)


def colorize_and_correct_height(
    lidar: laspy.LasData, geoid_height: float
) -> laspy.LasData:
    colored = laspy.convert(lidar, point_format_id=7)
    colored.z = np.asarray(colored.z) + geoid_height

    elevation = normalized(np.asarray(colored.z), 1, 99)
    intensity = normalized(np.asarray(colored.intensity, dtype=np.float64), 2, 98)
    shade = 0.55 + 0.45 * intensity

    red = (0.28 + 0.62 * elevation) * shade
    green = (0.52 + 0.36 * elevation) * shade
    blue = (0.68 + 0.28 * elevation) * shade
    ground = np.asarray(colored.classification) == 2
    red[ground] *= 0.72
    green[ground] *= 0.9
    blue[ground] *= 0.72

    colored.red = np.rint(np.clip(red, 0, 1) * 65_535).astype(np.uint16)
    colored.green = np.rint(np.clip(green, 0, 1) * 65_535).astype(np.uint16)
    colored.blue = np.rint(np.clip(blue, 0, 1) * 65_535).astype(np.uint16)
    return colored


def write_source_metadata(
    output: Path,
    args: argparse.Namespace,
    bounds: tuple[float, ...],
    geoid_height: float,
    point_count: int,
) -> None:
    metadata = {
        "title": "Golden USGS 3DEP LiDAR pilot",
        "project": "CO DRCOG 2 2020",
        "source": "U.S. Geological Survey 3D Elevation Program",
        "sourceUrl": args.ept_url,
        "rights": "Public domain; free of charge and without use restrictions",
        "center": [args.center_lon, args.center_lat],
        "querySizeMeters": args.size_m,
        "queryBoundsEpsg3857": list(bounds),
        "geoidModel": "GEOID18",
        "geoidHeightMeters": geoid_height,
        "pointCount": point_count,
        "classifications": args.classifications,
        "mapWorkspacePointCloud": "points.bin",
    }
    (output / "source.json").write_text(json.dumps(metadata, indent=2) + "\n")


def normalize_tileset_metadata(output: Path) -> None:
    tileset_path = output / "tileset.json"
    tileset = json.loads(tileset_path.read_text())
    extras = tileset.setdefault("asset", {}).setdefault("extras", {})
    extras.pop("created_date", None)
    extras.update(
        {
            "source": "U.S. Geological Survey 3D Elevation Program",
            "rights": "Public domain",
        }
    )
    tileset_path.write_text(json.dumps(tileset, separators=(",", ":")) + "\n")


def write_map_workspace_point_cloud(
    output: Path,
    lidar: laspy.LasData,
    center_lon: float,
    center_lat: float,
    bounds: tuple[float, ...],
) -> None:
    center_x = (bounds[0] + bounds[2]) / 2
    center_y = (bounds[1] + bounds[3]) / 2
    mercator_to_ground = math.cos(math.radians(center_lat))
    positions = np.column_stack(
        (
            (np.asarray(lidar.x) - center_x) * mercator_to_ground,
            (np.asarray(lidar.y) - center_y) * mercator_to_ground,
            np.asarray(lidar.z),
        )
    ).astype("<f4")
    colors = np.column_stack(
        (
            np.asarray(lidar.red) >> 8,
            np.asarray(lidar.green) >> 8,
            np.asarray(lidar.blue) >> 8,
        )
    ).astype(np.uint8)

    with (output / "points.bin").open("wb") as destination:
        destination.write(
            struct.pack(
                "<8sI3d",
                b"GLPC0001",
                len(lidar.points),
                center_lon,
                center_lat,
                0.0,
            )
        )
        destination.write(positions.tobytes())
        destination.write(colors.tobytes())


def build(args: argparse.Namespace) -> None:
    validate_args(args)
    bounds = web_mercator_bounds(args.center_lon, args.center_lat, args.size_m)
    geoid_height = (
        args.geoid_height
        if args.geoid_height is not None
        else fetch_geoid_height(args.center_lon, args.center_lat)
    )

    print(f"Streaming USGS LiDAR for EPSG:3857 bounds {bounds}")
    lidar = query_lidar(args.ept_url, bounds, args.classifications, args.max_points)
    colored = colorize_and_correct_height(lidar, geoid_height)
    print(
        f"Converting {len(colored.points):,} points with GEOID18 correction "
        f"{geoid_height:+.3f} m"
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="geolibre-usgs-lidar-") as scratch:
        source_path = Path(scratch) / "source.las"
        colored.write(source_path)
        convert(
            source_path,
            outfolder=args.output,
            overwrite=True,
            jobs=args.jobs,
            crs_out=CRS.from_epsg(4978),
            rgb=True,
            verbose=False,
        )

    normalize_tileset_metadata(args.output)
    write_map_workspace_point_cloud(
        args.output,
        colored,
        args.center_lon,
        args.center_lat,
        bounds,
    )
    write_source_metadata(
        args.output, args, bounds, geoid_height, len(colored.points)
    )
    print(f"Wrote {args.output / 'tileset.json'}")


if __name__ == "__main__":
    build(parse_args())
