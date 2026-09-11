from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

import nfl_data_py as nfl

from common import cache_frame


PBP_COLUMNS = [
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


def extract_season(
    season: int,
    staging: Path,
    refresh: bool = False,
    include_pbp: bool = True,
    legacy_range: tuple[int, int] | None = None,
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
        result[name] = cache_frame(name, staging, loader, refresh)

    if include_pbp:
        try:
            pbp = cache_frame(
                "pbp",
                staging,
                lambda: nfl.import_pbp_data([season], columns=PBP_COLUMNS),
                refresh,
            )
            missing = sorted(set(PBP_COLUMNS) - set(pbp.columns))
            if missing:
                print(f"WARNING: PBP missing columns {missing}; derived PBP fields will be null")
                result["pbp"] = None
            else:
                result["pbp"] = pbp
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
    return result
