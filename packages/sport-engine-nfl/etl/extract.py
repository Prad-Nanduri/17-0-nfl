from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd
import pyarrow.parquet as pq
from urllib.request import urlopen

import nfl_data_py as nfl

from common import cache_frame


PBP_COLUMNS = [
    "game_id",
    "play_id",
    "season_type",
    "qtr",
    "game_seconds_remaining",
    "posteam",
    "defteam",
    "punt_attempt",
    "kickoff_attempt",
    "kick_distance",
    "return_yards",
    "touchback",
    "punt_inside_twenty",
    "punter_player_id",
    "kicker_player_id",
    "field_goal_attempt",
    "field_goal_result",
    "penalty",
    "penalty_player_id",
    "penalty_team",
    "penalty_type",
]


def _parquet_loader(url: str) -> Any:
    return lambda: pd.read_parquet(url)


def _load_pbp(season: int, staging: Path, refresh: bool) -> pd.DataFrame:
    raw_path = staging / "pbp_raw.parquet"
    selected_path = staging / "pbp.parquet"
    url = f"https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_{season}.parquet"
    staging.mkdir(parents=True, exist_ok=True)
    if raw_path.exists() and not refresh:
        pass
    else:
        with urlopen(url, timeout=300) as response:
            raw_path.write_bytes(response.read())
    available = set(pq.read_schema(raw_path).names)
    selected = [column for column in PBP_COLUMNS if column in available]
    missing = sorted(set(PBP_COLUMNS) - available)
    if missing:
        print(f"WARNING: PBP asset missing columns {missing}; those fields will be null")
    if not selected:
        raise ValueError("PBP asset contained none of the requested columns")
    if selected_path.exists() and not refresh:
        frame = pd.read_parquet(selected_path)
        if set(selected).issubset(frame.columns) and not frame.empty:
            return frame
        selected_path.unlink()
    frame = pd.read_parquet(raw_path, columns=selected)
    if frame.empty:
        raise ValueError("PBP asset returned an empty DataFrame")
    frame.to_parquet(selected_path, index=False)
    return frame


def extract_season(
    season: int,
    staging: Path,
    refresh: bool = False,
    include_pbp: bool = True,
    legacy_range: tuple[int, int] | None = None,
    franchise_season_range: tuple[int, int] | None = None,
) -> dict[str, pd.DataFrame | None]:
    result: dict[str, pd.DataFrame | None] = {}
    loaders: dict[str, Any] = {
        "seasonal": lambda: nfl.import_seasonal_data([season], s_type="REG"),
        "rosters": lambda: nfl.import_seasonal_rosters([season]),
        "weekly": lambda: nfl.import_weekly_data([season]),
        "schedules": lambda: nfl.import_schedules([season]),
        "snap_counts": lambda: nfl.import_snap_counts([season]),
        "pfr_def": lambda: nfl.import_seasonal_pfr("def", [season]),
        "pfr_pass": lambda: nfl.import_seasonal_pfr("pass", [season]),
        "pfr_rush": lambda: nfl.import_seasonal_pfr("rush", [season]),
        "pfr_rec": lambda: nfl.import_seasonal_pfr("rec", [season]),
        "team_desc": nfl.import_team_desc,
        "players": _parquet_loader(
            "https://github.com/nflverse/nflverse-data/releases/download/players/players.parquet"
        ),
        "defensive": _parquet_loader(
            f"https://github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats_def_{season}.parquet"
        ),
        "kicking": _parquet_loader(
            f"https://github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats_kicking_{season}.parquet"
        ),
    }
    for name, loader in loaders.items():
        try:
            result[name] = cache_frame(name, staging, loader, refresh)
        except Exception as error:
            print(f"WARNING: {name} unavailable for {season} ({error}); treating as empty")
            result[name] = None

    if include_pbp:
        try:
            result["pbp"] = _load_pbp(season, staging, refresh)
        except Exception as error:
            print(f"WARNING: PBP unavailable ({error}); derived PBP fields will be null")
            result["pbp"] = None
    else:
        print("WARNING: PBP skipped; derived PBP fields will be null")
        result["pbp"] = None

    if legacy_range is not None:
        start, end = legacy_range
        result["draft_picks"] = cache_frame(
            f"draft_picks_{start}_{end}",
            staging,
            lambda: nfl.import_draft_picks(range(start, end + 1)),
            refresh,
        )
    if franchise_season_range is not None:
        start, end = franchise_season_range
        result["franchise_schedules"] = cache_frame(
            f"schedules_{start}_{end}",
            staging,
            lambda: nfl.import_schedules(range(start, end + 1)),
            refresh,
        )
    return result
