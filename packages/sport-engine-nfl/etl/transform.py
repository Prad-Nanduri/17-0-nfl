from __future__ import annotations

from collections import defaultdict
from pathlib import Path
from typing import Any

import pandas as pd

from common import integer, json_value, number, stable_json


POSITION_GROUPS = {
    "QB": "QB",
    "RB": "RB",
    "FB": "RB",
    "HB": "RB",
    "WR": "WR",
    "TE": "TE",
    "T": "OL",
    "OT": "OL",
    "G": "OL",
    "OG": "OL",
    "C": "OL",
    "OL": "OL",
    "DE": "DL",
    "DT": "DL",
    "NT": "DL",
    "DL": "DL",
    "EDGE": "DL",
    "LB": "LB",
    "OLB": "LB",
    "ILB": "LB",
    "MLB": "LB",
    "CB": "CB",
    "DB": "CB",
    "S": "S",
    "FS": "S",
    "SS": "S",
    "SAF": "S",
    "K": "K",
    "P": "P",
}


def position_group(position: Any) -> str | None:
    if position is None:
        return None
    return POSITION_GROUPS.get(str(position).strip().upper())


def _field(row: Any, name: str) -> Any:
    return row[name] if name in row.index else None


def _sum(frame: pd.DataFrame, name: str) -> float | None:
    if name not in frame.columns or frame.empty:
        return None
    values = pd.to_numeric(frame[name], errors="coerce").dropna()
    return number(values.sum()) if not values.empty else None


def _ratio(numerator: float | None, denominator: float | None) -> float | None:
    return None if numerator is None or denominator is None or denominator == 0 else numerator / denominator


def _team_results(schedules: pd.DataFrame, season: int) -> list[dict[str, Any]]:
    rows: dict[str, dict[str, Any]] = {}
    regular = schedules[schedules["game_type"].eq("REG")] if "game_type" in schedules else schedules
    for _, game in regular.iterrows():
        away = str(game["away_team"])
        home = str(game["home_team"])
        away_score = number(game["away_score"])
        home_score = number(game["home_score"])
        if away_score is None or home_score is None:
            continue
        for team in (away, home):
            rows.setdefault(team, {"franchiseKey": team, "season": season, "wins": 0, "losses": 0, "ties": 0, "eraTier": "full_feature" if season >= 1999 else "legacy"})
        if away_score > home_score:
            rows[away]["wins"] += 1
            rows[home]["losses"] += 1
        elif home_score > away_score:
            rows[home]["wins"] += 1
            rows[away]["losses"] += 1
        else:
            rows[away]["ties"] += 1
            rows[home]["ties"] += 1
    return [rows[key] for key in sorted(rows)]


def _franchises(team_desc: pd.DataFrame, rosters: pd.DataFrame, schedules: pd.DataFrame) -> list[dict[str, Any]]:
    roster_teams = set(rosters["team"].dropna().astype(str)) if "team" in rosters else set()
    if "game_type" in schedules:
        regular = schedules[schedules["game_type"].eq("REG")]
    else:
        regular = schedules
    scheduled_teams = set(regular["away_team"].dropna().astype(str)) | set(regular["home_team"].dropna().astype(str))
    teams = roster_teams & scheduled_teams
    rows = []
    for _, row in team_desc.iterrows():
        team = str(_field(row, "team_abbr"))
        if team not in teams:
            continue
        rows.append({
            "franchiseKey": team,
            "name": json_value(_field(row, "team_name")),
            "currentName": json_value(_field(row, "team_name")),
            "abbreviation": team,
            "nflverseTeamId": integer(_field(row, "team_id")) or 0,
            "logoUrl": json_value(_field(row, "team_logo_espn")),
        })
    return sorted(rows, key=lambda row: row["franchiseKey"])


def _players(
    rosters: pd.DataFrame,
    unknown: dict[str, int],
    player_asset: pd.DataFrame | None,
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    by_id: dict[str, Any] = {}
    for _, row in rosters.iterrows():
        player_id = json_value(_field(row, "player_id"))
        if not player_id:
            continue
        by_id[str(player_id)] = row
    players = []
    metadata: dict[str, dict[str, Any]] = {}
    asset_by_id = (
        {str(row["gsis_id"]): row for _, row in player_asset.iterrows()}
        if player_asset is not None and "gsis_id" in player_asset
        else {}
    )
    for player_id in sorted(by_id):
        row = by_id[player_id]
        asset = asset_by_id.get(player_id)
        position = str(_field(row, "position") or "").strip().upper()
        ngs_position = str(_field(row, "ngs_position") or "").strip().upper()
        depth_chart_position = str(_field(row, "depth_chart_position") or "").strip().upper()
        group = position_group(position)
        if ngs_position == "EDGE" or (
            position == "LB" and not ngs_position and depth_chart_position == "OLB"
        ):
            group = "DL"
        if group is None:
            unknown[str(json_value(_field(row, "position")))] += 1
            continue
        player = {
            "gsisId": player_id,
            "pfrId": json_value(_field(row, "pfr_id")) or (json_value(_field(asset, "pfr_id")) if asset is not None else None),
            "espnId": json_value(_field(row, "espn_id")) or (json_value(_field(asset, "espn_id")) if asset is not None else None),
            "fullName": json_value(_field(row, "player_name")) or "",
            "primaryPosition": json_value(_field(row, "position")) or "",
            "positionGroup": group,
            "ngsPosition": json_value(_field(row, "ngs_position")),
            "depthChartPosition": json_value(_field(row, "depth_chart_position")),
            "birthDate": json_value(_field(row, "birth_date")),
            "college": json_value(_field(row, "college")) or (json_value(_field(asset, "college_name")) if asset is not None else None),
            "draftYear": integer(_field(row, "entry_year")) or (integer(_field(asset, "draft_year")) if asset is not None else None),
            "draftRound": integer(_field(asset, "draft_round")) if asset is not None else None,
            "draftNumber": integer(_field(row, "draft_number")) or (integer(_field(asset, "draft_pick")) if asset is not None else None),
            "rookieYear": integer(_field(row, "rookie_year")) or (integer(_field(asset, "rookie_season")) if asset is not None else None),
            "headshotUrl": json_value(_field(row, "headshot_url")) or (json_value(_field(asset, "headshot")) if asset is not None else None),
        }
        players.append(player)
        metadata[player_id] = {"team": json_value(_field(row, "team")), **player}
    return players, metadata


def _weekly_groups(weekly: pd.DataFrame) -> dict[tuple[str, str], pd.DataFrame]:
    regular = weekly[weekly["season_type"].eq("REG")] if "season_type" in weekly else weekly
    groups: dict[tuple[str, str], pd.DataFrame] = {}
    for key, frame in regular.groupby(["player_id", "recent_team"], dropna=True):
        groups[(str(key[0]), str(key[1]))] = frame
    return groups


def _snap_groups(snaps: pd.DataFrame) -> dict[tuple[str, str], pd.DataFrame]:
    regular = snaps[snaps["game_type"].eq("REG")] if "game_type" in snaps else snaps
    return {(str(key[0]), str(key[1])): frame for key, frame in regular.groupby(["pfr_player_id", "team"], dropna=True)}


def _pfr_map(frame: pd.DataFrame, key: str = "pfr_id") -> dict[str, pd.Series]:
    return {str(_field(row, key)): row for _, row in frame.iterrows() if json_value(_field(row, key))}


def _team_frame(frame: pd.DataFrame, team: str) -> pd.DataFrame:
    column = "team" if "team" in frame.columns else "tm" if "tm" in frame.columns else None
    return frame[frame[column].eq(team)] if column is not None else frame.iloc[0:0]


def _weeks(frame: pd.DataFrame | None) -> set[int]:
    if frame is None or frame.empty or "week" not in frame.columns:
        return set()
    return {
        int(value)
        for value in pd.to_numeric(frame["week"], errors="coerce").dropna().unique()
    }


def _filter_player_team(
    frame: pd.DataFrame,
    player_id: str,
    team: str,
    id_column: str = "player_id",
) -> pd.DataFrame:
    if id_column not in frame.columns or "team" not in frame.columns:
        return frame.iloc[0:0]
    filtered = frame[frame[id_column].eq(player_id) & frame["team"].eq(team)]
    return filtered[filtered["season_type"].eq("REG")] if "season_type" in filtered else filtered


def _relevant_stats(group: str) -> set[str]:
    return {
        "QB": {
            "passAttempts", "completions", "passingYards", "passingTds",
            "interceptions", "sacks", "sackYards", "rushingEpa", "rushingYards",
            "anyPerAttempt", "tdRate", "intRate", "completionPct",
        },
        "RB": {
            "carries", "rushingYards", "rushingTds", "receivingYards",
            "receptions", "targets", "yardsPerCarry", "rushYardsShare",
            "brokenTackleRate",
        },
        "WR": {
            "targets", "receptions", "receivingYards", "receivingTds",
            "targetShare", "yardsPerRouteProxy",
        },
        "TE": {
            "targets", "receptions", "receivingYards", "receivingTds",
            "targetShare", "yardsPerRouteProxy",
        },
        "OL": {
            "teamPressureRateAllowed", "teamYardsBeforeContactPerAtt", "penalties",
        },
        "DL": {
            "sacks", "qbHits", "tacklesForLoss", "tacklesSolo", "tackles",
            "pfrPressures", "pressureRate", "runStopProxy",
        },
        "LB": {
            "tackles", "tacklesForLoss", "tacklesSolo", "interceptions",
            "passDefended", "pfrTargets", "completionsAllowed", "yardsAllowed",
            "passerRatingAllowed", "runStopProxy", "coverageProxy",
        },
        "CB": {
            "tackles", "tacklesForLoss", "tacklesSolo", "interceptions",
            "passDefended", "pfrTargets", "completionsAllowed", "yardsAllowed",
            "passerRatingAllowed", "runStopProxy", "coverageProxy",
        },
        "S": {
            "tackles", "tacklesForLoss", "tacklesSolo", "interceptions",
            "passDefended", "pfrTargets", "completionsAllowed", "yardsAllowed",
            "passerRatingAllowed", "runStopProxy", "coverageProxy",
        },
        "K": {
            "fgAtt", "fgMade", "fgPct", "fgMade_0_19", "fgAtt_0_19",
            "fgMade_20_29", "fgAtt_20_29", "fgMade_30_39", "fgAtt_30_39",
            "fgMade_40_49", "fgAtt_40_49", "fgMade_50_plus", "fgAtt_50_plus",
            "patAtt", "patMade", "accuracyByDistance", "kickoffTouchbackRate",
            "clutchFgPct",
        },
        "P": {"punts", "grossAvg", "netAvg", "inside20Rate", "clutchNetAvg"},
    }[group]


def _stats_row(
    player: dict[str, Any],
    team: str,
    weekly: pd.DataFrame,
    snap: pd.DataFrame | None,
    pfr_def_map: dict[str, pd.Series],
    pfr_rush_map: dict[str, pd.Series],
    pfr_pass: pd.DataFrame,
    pfr_rush_frame: pd.DataFrame,
    defensive: pd.DataFrame,
    kicking: pd.DataFrame,
    pbp: pd.DataFrame | None,
    event_weeks: set[int],
    all_weekly: pd.DataFrame,
) -> dict[str, Any]:
    group = player["positionGroup"]
    pfr_id = player["pfrId"]
    player_id = player["gsisId"]
    stats: dict[str, Any] = {
        "offenseSnaps": _sum(snap, "offense_snaps") if snap is not None else None,
        "defenseSnaps": _sum(snap, "defense_snaps") if snap is not None else None,
        "stSnaps": _sum(snap, "st_snaps") if snap is not None else None,
        "games": len(event_weeks),
    }
    sums = {key: _sum(weekly, key) for key in ["attempts", "completions", "passing_yards", "passing_tds", "interceptions", "sacks", "sack_yards", "rushing_epa", "rushing_yards", "carries", "rushing_tds", "receiving_yards", "receptions", "targets", "receiving_tds"]}
    defense = _filter_player_team(defensive, player_id, team)
    kick = _filter_player_team(kicking, player_id, team)
    for key, source in [("passAttempts", sums["attempts"]), ("completions", sums["completions"]), ("passingYards", sums["passing_yards"]), ("passingTds", sums["passing_tds"]), ("interceptions", sums["interceptions"]), ("sacks", sums["sacks"]), ("sackYards", sums["sack_yards"]), ("rushingEpa", sums["rushing_epa"]), ("rushingYards", sums["rushing_yards"]), ("carries", sums["carries"]), ("rushingTds", sums["rushing_tds"]), ("receivingYards", sums["receiving_yards"]), ("receptions", sums["receptions"]), ("targets", sums["targets"]), ("receivingTds", sums["receiving_tds"])]:
        stats[key] = source
    stats["tackles"] = _sum(defense, "def_tackles")
    stats["tacklesSolo"] = _sum(defense, "def_tackles_solo")
    stats["tacklesForLoss"] = _sum(defense, "def_tackles_for_loss")
    stats["qbHits"] = _sum(defense, "def_qb_hits")
    stats["defSacks"] = _sum(defense, "def_sacks")
    defensive_interceptions = _sum(defense, "def_interceptions")
    stats["passDefended"] = _sum(defense, "def_pass_defended")
    stats["fgAtt"] = _sum(kick, "fg_att")
    stats["fgMade"] = _sum(kick, "fg_made")
    stats["fgPct"] = _ratio(stats["fgMade"], stats["fgAtt"])
    stats["patAtt"] = _sum(kick, "pat_att")
    stats["patMade"] = _sum(kick, "pat_made")
    for bucket in ["0_19", "20_29", "30_39", "40_49"]:
        stats[f"fgMade_{bucket}"] = _sum(kick, f"fg_made_{bucket}")
        made = _sum(kick, f"fg_made_{bucket}")
        missed = _sum(kick, f"fg_missed_{bucket}")
        stats[f"fgAtt_{bucket}"] = (made or 0) + (missed or 0) if not kick.empty else None
    stats["fgMade_50_plus"] = (_sum(kick, "fg_made_50_59") or 0) + (_sum(kick, "fg_made_60_") or 0) if not kick.empty else None
    stats["fgAtt_50_plus"] = sum((_sum(kick, f"fg_made_{suffix}") or 0) + (_sum(kick, f"fg_missed_{suffix}") or 0) for suffix in ["50_59", "60_"]) if not kick.empty else None
    pfr_row = pfr_def_map.get(str(pfr_id)) if pfr_id else None
    stats["pfrTargets"] = number(_field(pfr_row, "tgt")) if pfr_row is not None else None
    stats["completionsAllowed"] = number(_field(pfr_row, "cmp")) if pfr_row is not None else None
    stats["yardsAllowed"] = number(_field(pfr_row, "yds")) if pfr_row is not None else None
    stats["passerRatingAllowed"] = number(_field(pfr_row, "rat")) if pfr_row is not None else None
    stats["pfrPressures"] = number(_field(pfr_row, "prss")) if pfr_row is not None else None
    pass_team = _team_frame(pfr_pass, team)
    rush_team = _team_frame(pfr_rush_frame, team)
    stats["teamPressureRateAllowed"] = _ratio(_sum(pass_team, "times_pressured"), _sum(pass_team, "pass_attempts"))
    stats["teamYardsBeforeContactPerAtt"] = _ratio(_sum(rush_team, "ybc"), _sum(rush_team, "att"))
    stats["penalties"] = (
        int((pbp["penalty_player_id"].eq(player_id) & pbp["season_type"].eq("REG")).sum())
        if pbp is not None and {"penalty_player_id", "season_type"}.issubset(pbp.columns)
        else None
    )
    stats.update({"punts": None, "grossAvg": None, "netAvg": None, "inside20Rate": None, "clutchNetAvg": None})
    if pbp is not None:
        required = {"punter_player_id", "season_type", "punt_attempt"}
        punts = pbp[pbp["punter_player_id"].eq(player_id) & pbp["season_type"].eq("REG") & pbp["punt_attempt"].eq(1)] if required.issubset(pbp.columns) else pbp.iloc[0:0]
        stats["punts"] = int(len(punts))
        stats["grossAvg"] = number(pd.to_numeric(punts["kick_distance"], errors="coerce").mean()) if not punts.empty and "kick_distance" in punts else None
        net = pd.to_numeric(punts["kick_distance"], errors="coerce") - pd.to_numeric(punts["return_yards"], errors="coerce").fillna(0) - 20 * pd.to_numeric(punts["touchback"], errors="coerce").fillna(0) if {"kick_distance", "return_yards", "touchback"}.issubset(punts.columns) else pd.Series(dtype=float)
        stats["netAvg"] = number(net.mean()) if not punts.empty else None
        stats["inside20Rate"] = number(pd.to_numeric(punts["punt_inside_twenty"], errors="coerce").mean()) if not punts.empty and "punt_inside_twenty" in punts else None
        clutch = punts[pd.to_numeric(punts["qtr"], errors="coerce") >= 4] if "qtr" in punts else punts.iloc[0:0]
        clutch_net = pd.to_numeric(clutch["kick_distance"], errors="coerce") - pd.to_numeric(clutch["return_yards"], errors="coerce").fillna(0) - 20 * pd.to_numeric(clutch["touchback"], errors="coerce").fillna(0) if {"kick_distance", "return_yards", "touchback"}.issubset(clutch.columns) else pd.Series(dtype=float)
        stats["clutchNetAvg"] = number(clutch_net.mean()) if len(clutch) >= 3 else None
        kickoffs = pbp[pbp["kicker_player_id"].eq(player_id) & pbp["season_type"].eq("REG") & pbp["kickoff_attempt"].eq(1)] if {"kicker_player_id", "season_type", "kickoff_attempt"}.issubset(pbp.columns) else pbp.iloc[0:0]
        stats["kickoffTouchbackRate"] = number(pd.to_numeric(kickoffs["touchback"], errors="coerce").mean()) if not kickoffs.empty and "touchback" in kickoffs else None
        fgs = pbp[pbp["kicker_player_id"].eq(player_id) & pbp["season_type"].eq("REG") & pbp["field_goal_attempt"].eq(1)] if {"kicker_player_id", "season_type", "field_goal_attempt"}.issubset(pbp.columns) else pbp.iloc[0:0]
        clutch_fgs = fgs[pd.to_numeric(fgs["qtr"], errors="coerce") >= 4] if "qtr" in fgs else fgs.iloc[0:0]
        made = clutch_fgs["field_goal_result"].eq("made").sum() if "field_goal_result" in clutch_fgs else 0
        stats["clutchFgPct"] = number(made / len(clutch_fgs)) if len(clutch_fgs) >= 3 else None
    else:
        stats["kickoffTouchbackRate"] = None
        stats["clutchFgPct"] = None
    stats["anyPerAttempt"] = _ratio((stats["passingYards"] or 0) + 20 * (stats["passingTds"] or 0) - 45 * (stats["interceptions"] or 0) - (stats["sackYards"] or 0), (stats["passAttempts"] or 0) + (stats["sacks"] or 0))
    stats["tdRate"] = _ratio(stats["passingTds"], stats["passAttempts"])
    stats["intRate"] = _ratio(stats["interceptions"], stats["passAttempts"])
    stats["completionPct"] = _ratio(stats["completions"], stats["passAttempts"])
    stats["yardsPerCarry"] = _ratio(stats["rushingYards"], stats["carries"])
    team_rushing = _sum(all_weekly[all_weekly["recent_team"].eq(team)], "rushing_yards") if "recent_team" in all_weekly else None
    stats["rushYardsShare"] = _ratio(stats["rushingYards"], team_rushing)
    rush_row = pfr_rush_map.get(str(pfr_id)) if pfr_id else None
    stats["brokenTackleRate"] = _ratio(number(_field(rush_row, "brk_tkl")) if rush_row is not None else None, stats["carries"])
    stats["targetShare"] = _ratio(stats["targets"], _sum(all_weekly[all_weekly["recent_team"].eq(team)], "attempts")) if group in {"WR", "TE"} else None
    stats["yardsPerRouteProxy"] = _ratio(stats["receivingYards"], stats["offenseSnaps"])
    if group in {"DL", "LB", "CB", "S"}:
        stats["interceptions"] = defensive_interceptions
        stats["sacks"] = stats["defSacks"]
    stats["pressureRate"] = _ratio(stats["pfrPressures"] if stats["pfrPressures"] is not None else (stats["qbHits"] or 0) + (stats["defSacks"] or 0), stats["defenseSnaps"])
    stats["runStopProxy"] = _ratio(stats["tacklesSolo"], stats["defenseSnaps"])
    stats["coverageProxy"] = (158.3 - stats["passerRatingAllowed"]) / 158.3 if stats["pfrTargets"] is not None and stats["pfrTargets"] >= 15 and stats["passerRatingAllowed"] is not None else None
    bucket_values = [(stats["fgMade_0_19"], stats["fgAtt_0_19"], 0.3), (stats["fgMade_20_29"], stats["fgAtt_20_29"], 0.3), (stats["fgMade_30_39"], stats["fgAtt_30_39"], 0.3), (stats["fgMade_40_49"], stats["fgAtt_40_49"], 0.35), (stats["fgMade_50_plus"], stats["fgAtt_50_plus"], 0.35)]
    usable = [(made / attempts, weight) for made, attempts, weight in bucket_values if made is not None and attempts is not None and attempts >= 1]
    weight_total = sum(weight for _, weight in usable)
    stats["accuracyByDistance"] = sum(rate * weight for rate, weight in usable) / weight_total if weight_total else None
    common = {"offenseSnaps", "defenseSnaps", "stSnaps", "games"}
    stats = {key: json_value(value) for key, value in stats.items() if key in common or key in _relevant_stats(group)}
    return {"gsisId": player_id, "franchiseKey": team, "season": int(player.get("season", 2023)), "position": player["primaryPosition"], "positionGroup": group, "eraTier": "full_feature", "games": len(event_weeks), "stats": stats, "isTeamLevelProxy": group == "OL"}


def transform(data: dict[str, pd.DataFrame | None], season: int, out: Path) -> dict[str, int]:
    unknown: dict[str, int] = defaultdict(int)
    rosters = data["rosters"]
    assert rosters is not None
    players_asset = data["players"]
    players, metadata = _players(rosters, unknown, players_asset)
    schedules = data["schedules"]
    team_desc = data["team_desc"]
    assert schedules is not None and team_desc is not None
    franchises = _franchises(team_desc, rosters, schedules)
    franchise_seasons = _team_results(schedules, season)
    weekly = data["weekly"]
    snaps = data["snap_counts"]
    assert weekly is not None and snaps is not None
    seasonal = data["seasonal"]
    if seasonal is not None:
        regular_weekly = weekly[weekly["season_type"].eq("REG")] if "season_type" in weekly else weekly
        cross_check_diffs = 0
        cross_check_values = 0
        for _, seasonal_row in seasonal.head(5).iterrows():
            player_id = json_value(_field(seasonal_row, "player_id"))
            weekly_player = regular_weekly[regular_weekly["player_id"].eq(player_id)]
            for weekly_key, seasonal_key in [
                ("attempts", "attempts"),
                ("rushing_yards", "rushing_yards"),
                ("receiving_yards", "receiving_yards"),
            ]:
                weekly_total = _sum(weekly_player, weekly_key)
                seasonal_total = number(_field(seasonal_row, seasonal_key))
                if weekly_total is not None and seasonal_total is not None:
                    cross_check_values += 1
                    if abs(weekly_total - seasonal_total) > 0.01:
                        cross_check_diffs += 1
        print(f"weekly-vs-seasonal cross-check: values={cross_check_values} differences={cross_check_diffs}")
    weekly_groups = _weekly_groups(weekly)
    snap_groups = _snap_groups(snaps)
    pfr_def = data["pfr_def"] if data["pfr_def"] is not None else pd.DataFrame()
    pfr_pass = data["pfr_pass"] if data["pfr_pass"] is not None else pd.DataFrame()
    pfr_rush = data["pfr_rush"] if data["pfr_rush"] is not None else pd.DataFrame()
    pfr_rec = data["pfr_rec"] if data["pfr_rec"] is not None else pd.DataFrame()
    pfr_def_map = _pfr_map(pfr_def)
    pfr_rush_map = _pfr_map(pfr_rush)
    defensive = data["defensive"] if data["defensive"] is not None else pd.DataFrame()
    kicking = data["kicking"] if data["kicking"] is not None else pd.DataFrame()
    pbp = data["pbp"]
    stats_rows = []
    for player in players:
        player_teams = {
            team for (player_id, team) in weekly_groups if player_id == player["gsisId"]
        }
        if "player_id" in defensive and "team" in defensive:
            player_teams.update(
                str(team)
                for team in defensive.loc[
                    defensive["player_id"].eq(player["gsisId"]), "team"
                ].dropna().unique()
            )
        if "player_id" in kicking and "team" in kicking:
            player_teams.update(
                str(team)
                for team in kicking.loc[
                    kicking["player_id"].eq(player["gsisId"]), "team"
                ].dropna().unique()
            )
        if player["pfrId"]:
            player_teams.update(
                team for (pfr_id, team) in snap_groups if pfr_id == str(player["pfrId"])
            )
        if not player_teams:
            player_teams = {str(metadata[player["gsisId"]]["team"])}
        for team in sorted(player_teams):
            weekly_frame = weekly_groups.get((player["gsisId"], team), weekly.iloc[0:0])
            snap_frame = None
            if player["pfrId"]:
                snap_frame = snap_groups.get((str(player["pfrId"]), team))
            defense_frame = _filter_player_team(defensive, player["gsisId"], team)
            kicking_frame = _filter_player_team(kicking, player["gsisId"], team)
            event_weeks = _weeks(weekly_frame) | _weeks(defense_frame) | _weeks(kicking_frame) | _weeks(snap_frame)
            stats_rows.append(
                _stats_row(
                    player,
                    team,
                    weekly_frame,
                    snap_frame,
                    pfr_def_map,
                    pfr_rush_map,
                    pfr_pass,
                    pfr_rush,
                    defensive,
                    kicking,
                    pbp,
                    event_weeks,
                    weekly,
                )
            )
    legacy_rows = []
    draft_picks = data.get("draft_picks")
    if draft_picks is not None:
        for _, row in draft_picks.iterrows():
            pfr_id = json_value(_field(row, "pfr_player_id"))
            group = position_group(_field(row, "position"))
            if not pfr_id or group is None:
                continue
            legacy_stats = {
                "carAv": json_value(_field(row, "car_av")),
                "weightedAv": json_value(_field(row, "w_av")),
                "draftTeamAv": json_value(_field(row, "dr_av")),
                "proBowls": json_value(_field(row, "probowls")),
                "allPro": json_value(_field(row, "allpro")),
                "seasonsStarted": json_value(_field(row, "seasons_started")),
                "games": json_value(_field(row, "games")),
            }
            position_stats = {
                "QB": {
                    "passCompletions": "pass_completions", "passAttempts": "pass_attempts",
                    "passYards": "pass_yards", "passTds": "pass_tds", "passInts": "pass_ints",
                },
                "RB": {
                    "rushAttempts": "rush_atts", "rushYards": "rush_yards", "rushTds": "rush_tds",
                    "receptions": "receptions", "recYards": "rec_yards", "recTds": "rec_tds",
                },
                "WR": {"receptions": "receptions", "recYards": "rec_yards", "recTds": "rec_tds"},
                "TE": {"receptions": "receptions", "recYards": "rec_yards", "recTds": "rec_tds"},
                "DL": {
                    "defSoloTackles": "def_solo_tackles", "defInts": "def_ints", "defSacks": "def_sacks",
                },
                "LB": {
                    "defSoloTackles": "def_solo_tackles", "defInts": "def_ints", "defSacks": "def_sacks",
                },
                "CB": {
                    "defSoloTackles": "def_solo_tackles", "defInts": "def_ints", "defSacks": "def_sacks",
                },
                "S": {
                    "defSoloTackles": "def_solo_tackles", "defInts": "def_ints", "defSacks": "def_sacks",
                },
                "OL": {}, "K": {}, "P": {},
            }[group]
            legacy_stats.update(
                {
                    key: json_value(_field(row, source))
                    for key, source in position_stats.items()
                    if json_value(_field(row, source)) is not None
                }
            )
            legacy_row = {
                "pfrId": pfr_id,
                "fullName": json_value(_field(row, "pfr_player_name")) or "",
                "positionGroup": group,
                "draftYear": integer(_field(row, "season")),
                "draftRound": integer(_field(row, "round")),
                "draftPick": integer(_field(row, "pick")),
                "franchiseKey": json_value(_field(row, "team")) or "",
                "hof": bool(_field(row, "hof")) if json_value(_field(row, "hof")) is not None else False,
                "careerFromSeason": integer(_field(row, "season")),
                "careerThroughSeason": integer(_field(row, "to")),
                "eraTier": "legacy",
                "stats": legacy_stats,
            }
            gsis_id = json_value(_field(row, "gsis_id"))
            if gsis_id is not None:
                legacy_row["gsisId"] = gsis_id
            legacy_rows.append(legacy_row)
    stable_json(out / "franchises.json", franchises)
    stable_json(out / "franchise_seasons.json", franchise_seasons)
    stable_json(out / "players.json", sorted(players, key=lambda row: row["gsisId"]))
    stable_json(out / "player_season_stats.json", sorted(stats_rows, key=lambda row: (row["franchiseKey"], row["gsisId"])))
    if legacy_rows:
        stable_json(out.parent / "legacy" / "legacy_player_careers.json", sorted(legacy_rows, key=lambda row: row["pfrId"]))
    row_counts = {
        "franchises": len(franchises),
        "franchiseSeasons": len(franchise_seasons),
        "players": len(players),
        "playerSeasonStats": len(stats_rows),
        "legacyPlayerCareers": len(legacy_rows),
        "unknownPositions": sum(unknown.values()),
    }
    return row_counts
