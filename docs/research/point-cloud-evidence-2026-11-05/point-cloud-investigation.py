import sys
from pathlib import Path
engine = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[3].parent / 'Digital_Twin_Engine'
sys.path.insert(0, str(engine / 'src'))
import json
import tempfile
import time
from pathlib import Path
import numpy as np
from pyproj import CRS
from data.ingestion.point_clouds import POINT_DTYPE, PreparedPointSource
from data.normalization.point_clouds.octree import NativePointOctreeBuilder
from schemas.point_clouds import PointCloudBuildPolicy

policy = PointCloudBuildPolicy(min_leaf_points=100000, max_leaf_points=100000, max_preview_points=50000)
results = []
for count in (1000, 10000, 50000, 100000, 250000, 1000000):
    with tempfile.TemporaryDirectory(prefix='point-cloud-audit-') as folder:
        root = Path(folder)
        rng = np.random.default_rng(42)
        xyz = rng.random((count, 3)) * [20, 20, 20] + [480000, 4400000, 1700]
        rows = np.empty(count, dtype=POINT_DTYPE)
        for i, field in enumerate(('x', 'y', 'z')):
            rows[field] = xyz[:, i]
        for field in ('red', 'green', 'blue'):
            rows[field] = rng.integers(1, 256, count, dtype=np.uint8)
        source_path = root / 'source.points'
        rows.tofile(source_path)
        source = PreparedPointSource(path=source_path, crs=CRS.from_epsg(32613), bounds=tuple(np.r_[xyz.min(axis=0), xyz.max(axis=0)]), source_point_count=count, published_point_count=count)
        started = time.perf_counter()
        result = NativePointOctreeBuilder().build(source=source, policy=policy, output=root/'output', scratch=root/'scratch')
        elapsed = time.perf_counter() - started
        tiles = list((root/'output').rglob('*.pnts'))
        results.append(dict(points=count, build_seconds=round(elapsed, 4), tile_count=result.tile_count, leaf_tiles=result.leaf_tile_count, preview_points=result.preview_point_count, encoded_points=count+result.preview_point_count, bytes=sum(p.stat().st_size for p in tiles), min_leaf_points=result.min_leaf_points, max_leaf_points=result.max_leaf_points, root_error=result.root.sampling_spacing_m, depth=result.depth))
print(json.dumps({'scope':'Synthetic uniform 20 m cube; actual Engine octree, current production caps; excludes input parsing, semantics, validation, network and rendering', 'results':results}, indent=2))
