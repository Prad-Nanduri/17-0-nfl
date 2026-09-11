from __future__ import annotations

import argparse
import datetime
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
    parser.add_argument("--franchise-seasons", type=parse_range)
    args = parser.parse_args()
    started = time.perf_counter()
    frames = extract_season(
        args.season,
        args.staging,
        args.refresh,
        not args.skip_pbp,
        args.legacy_drafts,
        args.franchise_seasons,
    )
    counts = transform(frames, args.season, args.out)
    manifest = {
        "season": args.season,
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
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
            "nflverse play_by_play parquet asset",
        ],
        "pbpIncluded": frames["pbp"] is not None,
        "rowCounts": counts,
    }
    stable_json(args.out / "manifest.json", manifest)
    if args.franchise_seasons is not None:
        from transform import build_franchise_season_pool

        pool_manifest = build_franchise_season_pool(
            frames["franchise_schedules"],
            frames.get("draft_picks"),
            frames["team_desc"],
            frames["rosters"],
            args.franchise_seasons,
            args.legacy_drafts,
            args.out.parent,
        )
        print(
            "Franchise-season pool: "
            f"{pool_manifest['rowCounts']['fullFeature']} full-feature, "
            f"{pool_manifest['rowCounts']['legacy']} legacy, "
            f"{pool_manifest['rowCounts']['total']} total"
        )
    print(f"ETL completed in {time.perf_counter() - started:.1f}s")


if __name__ == "__main__":
    main()
