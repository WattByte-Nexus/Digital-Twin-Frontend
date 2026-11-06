"""Compare exact outputs and partition timing against the saved pre-fix module.

Run with the recipe-12 Engine src on PYTHONPATH and its installed Python
environment. The sibling before/ tree is measurement evidence, not runtime code.
"""
from pathlib import Path
import hashlib
import importlib.util
import json
import sys
import tempfile
import time

import numpy as np
from pyproj import CRS
from data.ingestion.point_clouds import POINT_DTYPE, PreparedPointSource
from data.normalization.point_clouds import octree as current
from schemas.point_clouds import PointCloudBuildPolicy

root = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("partition_before", root / "before/src/data/normalization/point_clouds/octree.py")
before = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = before
spec.loader.exec_module(before)


def digest_files(paths):
    """Hash relative filenames and bytes to compare all partition outputs."""
    return {str(key): hashlib.sha256(path.read_bytes()).hexdigest() for key, path in paths.items()}


with tempfile.TemporaryDirectory(prefix="point-partition-benchmark-") as tmp:
    folder = Path(tmp)
    rng = np.random.default_rng(42)
    count = 250_000
    indexes = np.arange(count) % (16 * 16 * 56)
    rng.shuffle(indexes)
    cells = np.column_stack((indexes % 16, indexes // 16 % 16, indexes // 256))
    xyz = cells + rng.random((count, 3))
    rows = np.empty(count, dtype=POINT_DTYPE)
    for i, field in enumerate(("x", "y", "z")):
        rows[field] = xyz[:, i]
    for field in ("red", "green", "blue"):
        rows[field] = rng.integers(1, 256, count, dtype=np.uint8)
    source = folder / "source.points"
    rows.tofile(source)
    mapping = {tuple(int(x) for x in cell): (4, tuple(int(x // 4) for x in cell)) for cell in np.unique(cells, axis=0)}
    timings = {}
    hashes = {}
    for name, module in (("before", before), ("after", current)):
        started = time.perf_counter()
        paths = module._partition_leaves(source, max_depth=6, fine_to_leaf=mapping, cube_min=np.zeros(3), cube_side=64, chunk_points=count, scratch=folder / name)
        timings[name] = time.perf_counter() - started
        hashes[name] = digest_files(paths)
        print(name, timings[name], flush=True)
    assert hashes["before"] == hashes["after"]
    full_rows = rows[:5000].copy()
    for field, offset in (("x", 480000), ("y", 4400000), ("z", 1700)):
        full_rows[field] += offset
    source = folder / "full.points"
    full_rows.tofile(source)
    xyz = np.column_stack([full_rows[k] for k in ("x", "y", "z")])
    prepared = PreparedPointSource(path=source, crs=CRS.from_epsg(32613), bounds=tuple(np.r_[xyz.min(0), xyz.max(0)]), source_point_count=len(full_rows), published_point_count=len(full_rows))
    policy = PointCloudBuildPolicy(min_leaf_points=20, max_leaf_points=200, max_preview_points=30, read_chunk_points=127)
    artifacts = {}
    stats = {}
    for name, module in (("before", before), ("after", current)):
        output = folder / (name + "-artifact")
        result = module.NativePointOctreeBuilder().build(source=prepared, policy=policy, output=output, scratch=folder / (name + "-scratch"))
        artifacts[name] = digest_files({p.relative_to(output): p for p in output.rglob("*") if p.is_file()})
        stats[name] = {"depth": result.depth, "tile_count": result.tile_count, "preview_point_count": result.preview_point_count}
    assert artifacts["before"] == artifacts["after"]
    assert stats["before"] == stats["after"]
    report = {"scope": "Single local partition chunk; not a production-job speedup claim", "point_count": count, "fine_cell_count": len(mapping), "adaptive_leaf_count": len(set(mapping.values())), "before_seconds": timings["before"], "after_seconds": timings["after"], "speedup": timings["before"] / timings["after"], "partition_byte_identical": True, "full_hierarchy_byte_identical": True, "full_hierarchy_points": len(full_rows), "full_hierarchy_stats": stats["after"], "full_artifact_files": len(artifacts["after"]), "recipe": "12"}
    (root / "partition-recovery-benchmark-rerun.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
