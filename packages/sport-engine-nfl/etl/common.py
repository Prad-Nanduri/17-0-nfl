from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import pandas as pd

HISTORIC_TEAM_KEYS = {
    "GNB": "GB",
    "KAN": "KC",
    "NOR": "NO",
    "NWE": "NE",
    "SFO": "SF",
    "TAM": "TB",
    "SDG": "LAC",
    "RAI": "LV",
    "RAM": "LA",
    "STL": "LA",
    "PHO": "ARI",
    "OAK": "LV",
    "SD": "LAC",
    "HOU": "HOU",
    "BAL": "BAL",
}


def historic_team_key(team: Any, season: int) -> str | None:
    value = str(team).strip().upper()
    if value == "HOU":
        return "TEN" if season <= 1996 else "HOU"
    if value == "BAL":
        return "IND" if season <= 1983 else "BAL"
    return HISTORIC_TEAM_KEYS.get(value, value if value in {
        "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN",
        "DET", "GB", "HOU", "IND", "JAX", "KC", "LA", "LAC", "LV", "MIA",
        "MIN", "NE", "NO", "NYG", "NYJ", "PHI", "PIT", "SEA", "SF", "TB",
        "TEN", "WAS",
    } else None)


def cache_frame(
    name: str,
    staging: Path,
    loader: Any,
    refresh: bool = False,
) -> pd.DataFrame:
    staging.mkdir(parents=True, exist_ok=True)
    path = staging / f"{name}.parquet"
    if path.exists() and not refresh:
        cached = pd.read_parquet(path)
        if not cached.empty:
            return cached
        path.unlink()
    frame = loader()
    if not isinstance(frame, pd.DataFrame):
        raise TypeError(f"{name} loader did not return a DataFrame")
    if frame.empty:
        if path.exists():
            path.unlink()
        raise ValueError(f"{name} loader returned an empty DataFrame")
    frame.to_parquet(path, index=False)
    return frame


def json_value(value: Any) -> Any:
    if value is None:
        return None
    try:
        missing = pd.isna(value)
        if not hasattr(missing, "__len__") and bool(missing):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if isinstance(value, (pd.Timestamp,)):
        return value.date().isoformat()
    if hasattr(value, "item"):
        return json_value(value.item())
    return value


def number(value: Any) -> float | None:
    item = json_value(value)
    if item is None:
        return None
    try:
        result = float(item)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def integer(value: Any) -> int | None:
    result = number(value)
    return None if result is None else int(result)


def stable_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
