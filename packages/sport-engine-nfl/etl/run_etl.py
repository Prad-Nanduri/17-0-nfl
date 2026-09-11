from __future__ import annotations

import argparse
import importlib.metadata
import time
from pathlib import Path

from common import stable_json
from extract import extract_season
from transform import transform


def parse_range(value: str) -> tuple[int, int]:
    start, end = value.split("-", maxsplit=1)
    return int(start), int(end)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--season", type=int, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--staging", type=Path, default=Path("etl/.staging"))
    parser.add_argument("--skip-pbp", action="store_true")
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--legacy-drafts", type=parse_range)
    args = parser.parse_args()
    started = time.perf_counter()
    frames = extract_season(args.season, args.staging, args.refresh, not args.skip_pbp, args.legacy_drafts)
    counts = transform(frames, args.season, args.out)
    manifest = {
        "season": args.season,
        "generatedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "nflDataPyVersion": importlib.metadata.version("nfl-data-py"),
        "sources": [
            "nfl_data_py.import_seasonal_data",
            "nfl_data_py.import_seasonal_rosters",
            "nfl_data_py.import_weekly_data",
            "nfl_data_py.import_schedules",
            "nfl_data_py.import_snap_counts",
            "nfl_data_py.import_seasonal_pfr",
            "nfl_data_py.import_team_desc",
            "nflverse player_stats parquet assets",
            "nfl_data_py.import_pbp_data",
        ],
        "pbpIncluded": frames["pbp"] is not None,
        "rowCounts": counts,
    }
    stable_json(args.out / "manifest.json", manifest)
    print(f"ETL completed in {time.perf_counter() - started:.1f}s")


if __name__ == "__main__":
    main()
