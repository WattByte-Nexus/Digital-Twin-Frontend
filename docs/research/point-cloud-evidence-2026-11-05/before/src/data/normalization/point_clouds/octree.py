"""Build a deterministic adaptive spatial octree from a disk point spool.

Leaves contain every selected source point exactly once. Internal content is a
deterministic budgeted sample of its children. Measured nearest-sample error
accumulates toward the root and all nodes use REPLACE refinement.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import json
from pathlib import Path

import numpy as np
import numpy.typing as npt
from pyproj import Transformer
from scipy.spatial import cKDTree

from data.ingestion.point_clouds import POINT_DTYPE, PreparedPointSource
from data.normalization.point_clouds.errors import (
    CorruptPointCloudArtifactError,
    PointCloudDensityError,
)
from data.normalization.point_clouds.pnts import pnts_leaf_point_limit, write_pnts
from schemas.point_clouds import PointCloudBuildPolicy
from schemas.spatial import SceneScale
from services.logging import get_logger


Cell = tuple[int, int, int]
NodeKey = tuple[int, Cell]
logger = get_logger(__name__)


@dataclass
class OctreeNode:
    """Retain scratch and publication metadata for one non-empty octree cell."""

    depth: int
    cell: Cell
    point_path: Path
    point_count: int
    sampling_spacing_m: float
    children: list[OctreeNode] = field(default_factory=list)
    ecef_min: npt.NDArray[np.float64] | None = None
    ecef_max: npt.NDArray[np.float64] | None = None
    position_error_m: float = 0.0

    @property
    def name(self) -> str:
        """Return the stable Morton-style name used for content files."""

        if self.depth == 0:
            return "r"
        digits: list[str] = []
        for shift in range(self.depth - 1, -1, -1):
            octant = (
                ((self.cell[0] >> shift) & 1)
                | (((self.cell[1] >> shift) & 1) << 1)
                | (((self.cell[2] >> shift) & 1) << 2)
            )
            digits.append(str(octant))
        return "r" + "".join(digits)

    @property
    def content_uri(self) -> str:
        """Return the relative PNTS URI declared in ``tileset.json``."""

        return f"tiles/{self.name}.pnts"


@dataclass(frozen=True)
class OctreeBuildResult:
    """Summarize hierarchy output needed for validation and manifest creation."""

    root: OctreeNode
    depth: int
    tile_count: int
    leaf_tile_count: int
    min_leaf_points: int
    max_leaf_points: int
    preview_point_count: int
    max_position_error_m: float


class NativePointOctreeBuilder:
    """Construct the Engine's native leaves and deterministic preview hierarchy."""

    def build(
        self,
        *,
        source: PreparedPointSource,
        policy: PointCloudBuildPolicy,
        output: Path,
        scratch: Path,
    ) -> OctreeBuildResult:
        """Build and serialize one complete point-cloud octree.

        Args:
            source: Bounded normalized native-point spool.
            policy: Active leaf occupancy and source-spacing policy.
            output: Staged artifact directory receiving PNTS and tileset JSON.
            scratch: Build-owned directory for leaf and preview point spools.

        Returns:
            Hierarchy statistics and the root node used by validation.

        Raises:
            PointCloudDensityError: If the maximum octree depth cannot satisfy
                the hard leaf occupancy/payload limits, or the payload budget
                cannot hold one native point.
            CorruptPointCloudArtifactError: If a scratch point spool is malformed.
            OSError: If scratch or output files cannot be written.

        Side Effects:
            Writes bounded raw cell spools, PNTS tiles, and ``tileset.json``.
        """

        output.mkdir(parents=True, exist_ok=True)
        scratch.mkdir(parents=True, exist_ok=True)
        if source.published_point_count == 0:
            return _write_empty_tileset(source, policy, output)
        leaf_point_limit = pnts_leaf_point_limit(
            max_points=policy.max_leaf_points,
            max_payload_bytes=policy.max_leaf_payload_bytes,
        )
        if leaf_point_limit == 0:
            raise PointCloudDensityError("leaf payload budget cannot hold one point")
        transformer = Transformer.from_crs(source.crs, "EPSG:4978", always_xy=True)
        minimum_leaf_depth = 0
        if source.published_point_count <= leaf_point_limit:
            if (
                source.path.stat().st_size
                != source.published_point_count * POINT_DTYPE.itemsize
            ):
                raise CorruptPointCloudArtifactError(
                    "octree source inventory differs from spool"
                )
            _, _, _, root_position_error = _encode_positions(
                _read_points(source.path), transformer
            )
            if root_position_error >= policy.source_spacing_m / 4:
                minimum_leaf_depth = 1
                logger.info(
                    "point_cloud_root_requires_precision_refinement",
                    source_point_count=source.published_point_count,
                    root_position_error_m=root_position_error,
                    maximum_position_error_m=policy.source_spacing_m / 4,
                )
        cube_min, cube_side = _root_cube(source.bounds, policy.source_spacing_m)
        depth, fine_counts = _choose_depth(
            source.path,
            cube_min=cube_min,
            cube_side=cube_side,
            point_count=source.published_point_count,
            max_leaf_points=leaf_point_limit,
            minimum_depth=minimum_leaf_depth,
            policy=policy,
        )
        leaf_counts = _select_adaptive_leaf_counts(
            fine_counts=fine_counts,
            max_depth=depth,
            max_leaf_points=leaf_point_limit,
            minimum_leaf_depth=minimum_leaf_depth,
        )
        fine_to_leaf = _map_fine_cells_to_leaves(
            fine_counts=fine_counts,
            leaf_counts=leaf_counts,
            max_depth=depth,
        )
        leaf_paths = _partition_leaves(
            source.path,
            max_depth=depth,
            fine_to_leaf=fine_to_leaf,
            cube_min=cube_min,
            cube_side=cube_side,
            chunk_points=policy.read_chunk_points,
            scratch=scratch / "leaves",
        )
        leaves = {
            (leaf_depth, cell): OctreeNode(
                depth=leaf_depth,
                cell=cell,
                point_path=path,
                point_count=leaf_counts[(leaf_depth, cell)],
                sampling_spacing_m=0.0,
            )
            for (leaf_depth, cell), path in leaf_paths.items()
        }
        nodes_by_depth: dict[int, dict[Cell, OctreeNode]] = {
            node_depth: {} for node_depth in range(depth + 1)
        }
        for (leaf_depth, cell), node in leaves.items():
            nodes_by_depth[leaf_depth][cell] = node
        logger.info(
            "point_cloud_octree_partition_selected",
            source_point_count=source.published_point_count,
            maximum_depth=depth,
            leaf_point_limit=leaf_point_limit,
            max_leaf_payload_bytes=policy.max_leaf_payload_bytes,
            leaf_tile_count=len(leaves),
            minimum_leaf_points=min(leaf_counts.values()),
            maximum_leaf_points=max(leaf_counts.values()),
        )
        for node_depth in range(depth - 1, -1, -1):
            grouped: dict[Cell, list[OctreeNode]] = {}
            for child in nodes_by_depth[node_depth + 1].values():
                parent_cell = (
                    child.cell[0] // 2,
                    child.cell[1] // 2,
                    child.cell[2] // 2,
                )
                grouped.setdefault(parent_cell, []).append(child)
            parents = nodes_by_depth[node_depth]
            for parent_cell, children in sorted(grouped.items()):
                if parent_cell in parents:
                    raise CorruptPointCloudArtifactError(
                        "adaptive octree leaf overlaps descendant cells"
                    )
                ordered_children = sorted(children, key=lambda child: child.cell)
                preview_path = (
                    scratch
                    / "previews"
                    / f"d{node_depth}-{_cell_name(parent_cell)}.points"
                )
                preview_path.parent.mkdir(parents=True, exist_ok=True)
                preview_count, spacing = _write_preview(
                    ordered_children,
                    destination=preview_path,
                    minimum_error=policy.source_spacing_m,
                    chunk_points=policy.read_chunk_points,
                    max_points=policy.max_preview_points,
                )
                parents[parent_cell] = OctreeNode(
                    depth=node_depth,
                    cell=parent_cell,
                    point_path=preview_path,
                    point_count=preview_count,
                    sampling_spacing_m=spacing,
                    children=ordered_children,
                )
        all_nodes = [
            node
            for node_depth in range(depth, -1, -1)
            for node in nodes_by_depth[node_depth].values()
        ]
        for node in all_nodes:
            _write_node_content(node, transformer=transformer, output=output)
            if node.children:
                child_mins: list[npt.NDArray[np.float64]] = []
                child_maxes: list[npt.NDArray[np.float64]] = []
                for child in node.children:
                    if child.ecef_min is None or child.ecef_max is None:
                        raise CorruptPointCloudArtifactError(
                            "child point tile has no computed ECEF bounds"
                        )
                    child_mins.append(child.ecef_min)
                    child_maxes.append(child.ecef_max)
                node.ecef_min = np.min(np.vstack(child_mins), axis=0)
                node.ecef_max = np.max(np.vstack(child_maxes), axis=0)

        root = nodes_by_depth[0][(0, 0, 0)]
        tileset = {
            "asset": {
                "version": "1.0",
                "extras": {
                    "generator": "digital-twin-engine-native-octree",
                    "generatorVersion": "1",
                    "policy": policy.name,
                    "positionCrs": "EPSG:4978",
                    "sceneScale": {
                        "linearUnit": SceneScale().linear_unit,
                        "metersPerUnit": SceneScale().meters_per_unit,
                    },
                },
            },
            "geometricError": root.sampling_spacing_m,
            "root": _tile_json(root),
        }
        (output / "tileset.json").write_text(
            json.dumps(tileset, sort_keys=True, separators=(",", ":")) + "\n"
        )
        leaf_values = list(leaves.values())
        parent_values = [node for node in all_nodes if node.children]
        return OctreeBuildResult(
            root=root,
            depth=depth,
            tile_count=len(all_nodes),
            leaf_tile_count=len(leaves),
            min_leaf_points=min(node.point_count for node in leaf_values),
            max_leaf_points=max(node.point_count for node in leaf_values),
            preview_point_count=sum(node.point_count for node in parent_values),
            max_position_error_m=max(node.position_error_m for node in all_nodes),
        )


def _write_empty_tileset(
    source: PreparedPointSource, policy: PointCloudBuildPolicy, output: Path
) -> OctreeBuildResult:
    """Publish a valid contentless root for captures without accepted trees.

    Utility-only submissions still publish their measured assets. They never
    receive fabricated points or an invalid zero-point PNTS payload.
    """
    transformer = Transformer.from_crs(source.crs, "EPSG:4978", always_xy=True)
    b = source.bounds
    corners = np.array(
        [
            transformer.transform(x, y, z)
            for x in (b[0], b[3])
            for y in (b[1], b[4])
            for z in (b[2], b[5])
        ]
    )
    low, high = corners.min(axis=0), corners.max(axis=0)
    center, half = (low + high) / 2, (high - low) / 2
    box = [*center, half[0], 0, 0, 0, half[1], 0, 0, 0, half[2]]
    tileset = dict(
        asset=dict(
            version="1.0",
            extras=dict(
                positionCrs="EPSG:4978",
                policy=policy.name,
                sceneScale=dict(linearUnit="meter", metersPerUnit=1),
            ),
        ),
        geometricError=0,
        root=dict(
            boundingVolume=dict(box=box),
            geometricError=0,
            refine="REPLACE",
            extras=dict(pointCount=0),
        ),
    )
    (output / "tileset.json").write_text(json.dumps(tileset, sort_keys=True) + "\n")
    return OctreeBuildResult(
        root=OctreeNode(
            depth=0,
            cell=(0, 0, 0),
            point_path=source.path,
            point_count=0,
            sampling_spacing_m=0,
        ),
        depth=0,
        tile_count=1,
        leaf_tile_count=0,
        min_leaf_points=0,
        max_leaf_points=0,
        preview_point_count=0,
        max_position_error_m=0,
    )


def _root_cube(
    bounds: tuple[float, float, float, float, float, float],
    source_spacing_m: float,
) -> tuple[npt.NDArray[np.float64], float]:
    """Return a stable source-CRS cube enclosing exact selected point bounds."""

    minimum = np.array(bounds[:3], dtype=np.float64)
    maximum = np.array(bounds[3:], dtype=np.float64)
    side = max(float(np.max(maximum - minimum)), source_spacing_m)
    return minimum, side


def _choose_depth(
    path: Path,
    *,
    cube_min: npt.NDArray[np.float64],
    cube_side: float,
    point_count: int,
    max_leaf_points: int,
    minimum_depth: int,
    policy: PointCloudBuildPolicy,
) -> tuple[int, dict[Cell, int]]:
    """Select the shallowest grid satisfying the effective point/payload cap.

    Args:
        path: Native point spool to scan without mutation.
        cube_min: Source-CRS lower corner of the root cube.
        cube_side: Root side length in source-CRS units.
        point_count: Expected number of native records.
        max_leaf_points: Positive occupancy bounded by point and payload limits.
        minimum_depth: Zero for a precision-safe root, one when it must split.
        policy: Chunk size and maximum subdivision depth.

    Returns:
        Fine-grid depth and nonempty cell counts. Depth zero is a root leaf.

    Raises:
        PointCloudDensityError: If subdivision cannot satisfy occupancy.
        CorruptPointCloudArtifactError: If counted records differ from inventory.
    """

    first_possible_depth = minimum_depth
    theoretical_capacity = max_leaf_points * 8**minimum_depth
    while theoretical_capacity < point_count:
        first_possible_depth += 1
        theoretical_capacity *= 8
    for depth in range(first_possible_depth, policy.max_octree_depth + 1):
        counts: dict[Cell, int] = {}
        for records in _iter_points(path, policy.read_chunk_points):
            cells = _cells_for(
                records, depth=depth, cube_min=cube_min, cube_side=cube_side
            )
            unique, local_counts = np.unique(cells, axis=0, return_counts=True)
            for cell_array, count in zip(unique, local_counts, strict=True):
                cell: Cell = (
                    int(cell_array[0]),
                    int(cell_array[1]),
                    int(cell_array[2]),
                )
                counts[cell] = counts.get(cell, 0) + int(count)
        if sum(counts.values()) != point_count:
            raise CorruptPointCloudArtifactError("octree counting lost source points")
        if counts and max(counts.values()) <= max_leaf_points:
            return depth, counts
    raise PointCloudDensityError("maximum octree depth cannot bound leaf occupancy")


def _select_adaptive_leaf_counts(
    *,
    fine_counts: dict[Cell, int],
    max_depth: int,
    max_leaf_points: int,
    minimum_leaf_depth: int = 0,
) -> dict[NodeKey, int]:
    """Collapse fine cells into the coarsest leaves below the occupancy cap.

    Args:
        fine_counts: Exact non-empty cell occupancy at ``max_depth``.
        max_depth: Finest counted octree depth.
        max_leaf_points: Hard leaf occupancy limit.
        minimum_leaf_depth: Zero normally; one when native root encoding
            exceeds the position precision budget.

    Returns:
        Adaptive ``(depth, cell)`` occupancies. A leaf is only kept below the
        target range when merging it with its siblings would exceed the cap
        or the root precision budget.

    Raises:
        CorruptPointCloudArtifactError: If counts are empty, non-positive, or
            cannot be conserved while collapsing the hierarchy.
    """

    if not fine_counts or any(count <= 0 for count in fine_counts.values()):
        raise CorruptPointCloudArtifactError(
            "adaptive octree requires positive fine-cell counts"
        )
    counts_by_depth: dict[int, dict[Cell, int]] = {max_depth: dict(fine_counts)}
    children_by_depth: dict[int, dict[Cell, list[Cell]]] = {}
    for depth in range(max_depth - 1, -1, -1):
        parents: dict[Cell, int] = {}
        children: dict[Cell, list[Cell]] = {}
        for child, count in counts_by_depth[depth + 1].items():
            parent = (child[0] // 2, child[1] // 2, child[2] // 2)
            parents[parent] = parents.get(parent, 0) + count
            children.setdefault(parent, []).append(child)
        counts_by_depth[depth] = parents
        children_by_depth[depth] = children

    selected: dict[NodeKey, int] = {}
    pending: list[NodeKey] = [(0, (0, 0, 0))]
    while pending:
        depth, cell = pending.pop()
        count = counts_by_depth[depth][cell]
        if depth >= minimum_leaf_depth and count <= max_leaf_points:
            selected[(depth, cell)] = count
            continue
        if depth == max_depth:
            raise PointCloudDensityError(
                "fine octree cell still exceeds maximum leaf occupancy"
            )
        pending.extend(
            (depth + 1, child)
            for child in sorted(children_by_depth[depth][cell], reverse=True)
        )

    if sum(selected.values()) != sum(fine_counts.values()):
        raise CorruptPointCloudArtifactError(
            "adaptive octree selection lost source points"
        )
    return selected


def _map_fine_cells_to_leaves(
    *,
    fine_counts: dict[Cell, int],
    leaf_counts: dict[NodeKey, int],
    max_depth: int,
) -> dict[Cell, NodeKey]:
    """Map each occupied fine cell to its selected ancestor, including root.

    Args:
        fine_counts: Occupied cells at ``max_depth`` and their native counts.
        leaf_counts: Selected leaf keys and occupancies, including depth zero.
        max_depth: Fine-grid subdivision depth.

    Returns:
        One leaf owner per fine cell without duplicating native records.

    Raises:
        CorruptPointCloudArtifactError: If a fine cell has no selected owner.
    """

    mapping: dict[Cell, NodeKey] = {}
    for fine_cell in fine_counts:
        for leaf_depth in range(max_depth, -1, -1):
            shift = max_depth - leaf_depth
            leaf_cell = (
                fine_cell[0] >> shift,
                fine_cell[1] >> shift,
                fine_cell[2] >> shift,
            )
            candidate = (leaf_depth, leaf_cell)
            if candidate in leaf_counts:
                mapping[fine_cell] = candidate
                break
        else:
            raise CorruptPointCloudArtifactError(
                "fine octree cell has no adaptive leaf owner"
            )
    return mapping


def _partition_leaves(
    path: Path,
    *,
    max_depth: int,
    fine_to_leaf: dict[Cell, NodeKey],
    cube_min: npt.NDArray[np.float64],
    cube_side: float,
    chunk_points: int,
    scratch: Path,
) -> dict[NodeKey, Path]:
    """Partition the normalized spool once while preserving every point value."""

    scratch.mkdir(parents=True, exist_ok=True)
    paths: dict[NodeKey, Path] = {}
    for records in _iter_points(path, chunk_points):
        cells = _cells_for(
            records,
            depth=max_depth,
            cube_min=cube_min,
            cube_side=cube_side,
        )
        unique = np.unique(cells, axis=0)
        for cell_array in unique:
            mask = np.all(cells == cell_array, axis=1)
            fine_cell: Cell = (
                int(cell_array[0]),
                int(cell_array[1]),
                int(cell_array[2]),
            )
            leaf_depth, leaf_cell = fine_to_leaf[fine_cell]
            destination = paths.setdefault(
                (leaf_depth, leaf_cell),
                scratch / f"d{leaf_depth}-{_cell_name(leaf_cell)}.points",
            )
            with destination.open("ab") as leaf_file:
                records[mask].tofile(leaf_file)
    return paths


def _write_preview(
    children: list[OctreeNode],
    *,
    destination: Path,
    minimum_error: float,
    chunk_points: int,
    max_points: int,
) -> tuple[int, float]:
    """Fill a preview budget and measure its conservative approximation error.

    Args:
        children: Bounded child samples and their accumulated geometric errors.
        destination: Raw spool receiving a deterministic subset of native points.
        minimum_error: Positive error floor maintaining strict LOD ordering.
        chunk_points: Maximum child points read at once.
        max_points: Hard preview occupancy and working-set budget.

    Returns:
        Preview count and maximum child error plus nearest-sample distance.

    Side Effects:
        Reads child spools twice and writes one bounded preview spool.

    Stable coordinate-hash priority fills the budget at any source density and
    is independent of file and chunk order. Measuring the omitted geometry with
    a KD-tree accounts for holes and outliers instead of inferring error from
    the deepest, possibly unrelated branch of the octree.
    """

    selected = np.empty(0, dtype=POINT_DTYPE)
    for child in children:
        for records in _iter_points(child.point_path, chunk_points):
            candidates = np.concatenate((selected, records))
            selected = _sample_preview(candidates, max_points=max_points)
    selected.tofile(destination)
    tree = cKDTree(np.column_stack((selected["x"], selected["y"], selected["z"])))
    error = max(child.sampling_spacing_m for child in children) + minimum_error
    for child in children:
        for records in _iter_points(child.point_path, chunk_points):
            positions = np.column_stack((records["x"], records["y"], records["z"]))
            distances, _ = tree.query(positions, k=1)
            error = max(error, child.sampling_spacing_m + float(np.max(distances)))
    return len(selected), error


def _sample_preview(
    candidates: npt.NDArray[np.void], *, max_points: int
) -> npt.NDArray[np.void]:
    """Keep the lowest stable coordinate hashes with deterministic tie breaking."""

    priority = np.zeros(len(candidates), dtype=np.uint64)
    for axis in ("x", "y", "z"):
        bits = np.ascontiguousarray(candidates[axis]).view(np.uint64)
        bits = (bits ^ (bits >> 30)) * np.uint64(0xBF58476D1CE4E5B9)
        bits = (bits ^ (bits >> 27)) * np.uint64(0x94D049BB133111EB)
        priority = (priority * np.uint64(0x9E3779B185EBCA87)) ^ (bits ^ (bits >> 31))
    order = np.lexsort(
        (
            candidates["blue"],
            candidates["green"],
            candidates["red"],
            candidates["z"],
            candidates["y"],
            candidates["x"],
            priority,
        )
    )
    return candidates[order[:max_points]]


def _write_node_content(
    node: OctreeNode,
    *,
    transformer: Transformer,
    output: Path,
) -> None:
    """Write native or sampled records using the shared ECEF position encoding.

    Args:
        node: Bounded spool and metadata to update with bounds and error.
        transformer: Source-CRS to ECEF coordinate conversion.
        output: Staged artifact directory receiving the node's PNTS file.

    Returns:
        None. Updates ``node`` bounds and precision and writes its content file.

    Raises:
        CorruptPointCloudArtifactError: If the node spool is invalid.
        OSError: If the spool or destination cannot be accessed.
    """

    records = _read_points(node.point_path)
    local32, content_min, content_max, position_error = _encode_positions(
        records, transformer
    )
    node.position_error_m = position_error
    node.ecef_min = content_min
    node.ecef_max = content_max
    center = (content_min + content_max) / 2.0
    colors = np.column_stack(
        (records["red"], records["green"], records["blue"])
    ).astype(np.uint8)
    write_pnts(
        output / node.content_uri,
        local_positions=local32,
        colors=colors,
        rtc_center=(float(center[0]), float(center[1]), float(center[2])),
    )


def _encode_positions(
    records: npt.NDArray[np.void],
    transformer: Transformer,
) -> tuple[
    npt.NDArray[np.float32], npt.NDArray[np.float64], npt.NDArray[np.float64], float
]:
    """Compute exactly the position encoding used for admission and PNTS output.

    Args:
        records: Nonempty native records bounded by a leaf or preview budget.
        transformer: Source-CRS to ECEF coordinate conversion.

    Returns:
        Local float32 ECEF offsets, absolute lower/upper bounds and maximum
        absolute axis quantization error in metres. The RTC center is the
        midpoint of the returned bounds. Input records are not modified.
    """
    ecef = np.column_stack(
        transformer.transform(records["x"], records["y"], records["z"])
    ).astype(np.float64)
    content_min, content_max = ecef.min(axis=0), ecef.max(axis=0)
    local64 = ecef - (content_min + content_max) / 2.0
    local32 = local64.astype(np.float32)
    error = float(np.max(np.abs(local64 - local32.astype(np.float64))))
    return local32, content_min, content_max, error


def _tile_json(node: OctreeNode) -> dict[str, object]:
    """Serialize one node with exact descendant bounds and REPLACE refinement."""

    if node.ecef_min is None or node.ecef_max is None:
        raise CorruptPointCloudArtifactError("octree node lacks ECEF bounds")
    center = (node.ecef_min + node.ecef_max) / 2.0
    half = (node.ecef_max - node.ecef_min) / 2.0
    tile: dict[str, object] = {
        "boundingVolume": {
            "box": [
                float(center[0]),
                float(center[1]),
                float(center[2]),
                float(half[0]),
                0.0,
                0.0,
                0.0,
                float(half[1]),
                0.0,
                0.0,
                0.0,
                float(half[2]),
            ]
        },
        "content": {"uri": node.content_uri},
        "extras": {
            "pointCount": node.point_count,
            "positionErrorMeters": node.position_error_m,
            "samplingSpacingMeters": node.sampling_spacing_m,
        },
        "geometricError": node.sampling_spacing_m,
        "refine": "REPLACE",
    }
    if node.children:
        tile["children"] = [_tile_json(child) for child in node.children]
    return tile


def _cells_for(
    records: npt.NDArray[np.void],
    *,
    depth: int,
    cube_min: npt.NDArray[np.float64],
    cube_side: float,
) -> npt.NDArray[np.int64]:
    """Map source coordinates to clipped fixed-depth octree cell indexes."""

    divisions = 2**depth
    positions = np.column_stack((records["x"], records["y"], records["z"]))
    cells = np.floor((positions - cube_min) / cube_side * divisions).astype(np.int64)
    return np.clip(cells, 0, divisions - 1)


def _iter_points(path: Path, chunk_points: int):
    """Yield bounded raw point chunks while validating record alignment."""

    if path.stat().st_size % POINT_DTYPE.itemsize:
        raise CorruptPointCloudArtifactError("point spool is not record-aligned")
    with path.open("rb") as source:
        while True:
            records = np.fromfile(source, dtype=POINT_DTYPE, count=chunk_points)
            if len(records) == 0:
                break
            yield records


def _read_points(path: Path) -> npt.NDArray[np.void]:
    """Read one bounded leaf or preview spool into memory."""

    records = np.fromfile(path, dtype=POINT_DTYPE)
    if len(records) == 0 or path.stat().st_size % POINT_DTYPE.itemsize:
        raise CorruptPointCloudArtifactError("octree node point spool is invalid")
    return records


def _cell_name(cell: Cell) -> str:
    """Return a stable filesystem-safe fixed-depth cell name."""

    return f"{cell[0]}-{cell[1]}-{cell[2]}"
