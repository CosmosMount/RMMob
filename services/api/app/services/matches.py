from __future__ import annotations

from collections import defaultdict
from typing import Any

from app.db import fetch_all, fetch_one
from app.schemas.models import MatchGroup, MatchRoundSummary
from app.sql_map import col


def _row_to_round(row: dict[str, Any]) -> MatchRoundSummary:
    return MatchRoundSummary(
        game_id=str(row["game_id"]),
        region=str(row["region"]),
        match_no=int(row["match_no"]),
        schedule=str(row["schedule"]),
        round_no=int(row["round_no"]),
        red_school=str(row["red_school"]),
        blue_school=str(row["blue_school"]),
        winner=str(row["winner"]) if row.get("winner") is not None else None,
        start_time=str(row["start_time"]) if row.get("start_time") is not None else None,
        duration_sec=int(row["duration_sec"]) if row.get("duration_sec") is not None else None,
    )


def _select_matches(where: str = "", params: list | tuple = ()) -> list[dict[str, Any]]:
    sql = f"""
        SELECT
            {col('game_id')} AS game_id,
            {col('region')} AS region,
            {col('match_no')} AS match_no,
            {col('schedule')} AS schedule,
            {col('round_no')} AS round_no,
            {col('red_school')} AS red_school,
            {col('blue_school')} AS blue_school,
            {col('winner')} AS winner,
            {col('start_time')} AS start_time,
            {col('duration_sec')} AS duration_sec
        FROM matches
        {where}
        ORDER BY {col('region')}, {col('match_no')}, {col('round_no')}
    """
    return fetch_all(sql, params)


def group_matches(rows: list[dict[str, Any]]) -> list[MatchGroup]:
    buckets: dict[tuple, list[MatchRoundSummary]] = defaultdict(list)
    meta: dict[tuple, dict[str, Any]] = {}
    for row in rows:
        key = (row["region"], int(row["match_no"]), row["red_school"], row["blue_school"])
        buckets[key].append(_row_to_round(row))
        meta[key] = row

    groups: list[MatchGroup] = []
    for key, rounds in buckets.items():
        region, match_no, red, blue = key
        red_wins = sum(1 for r in rounds if r.winner == "红")
        blue_wins = sum(1 for r in rounds if r.winner == "蓝")
        schedule = rounds[0].schedule if rounds else meta[key]["schedule"]
        groups.append(
            MatchGroup(
                match_key=f"{region}|{match_no}|{red}|{blue}",
                region=region,
                match_no=match_no,
                schedule=str(schedule),
                red_school=red,
                blue_school=blue,
                rounds=rounds,
                red_wins=red_wins,
                blue_wins=blue_wins,
            )
        )
    return groups


def list_matches(
    *,
    region: str | None = None,
    school: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[int, list[MatchGroup]]:
    clauses: list[str] = []
    params: list[Any] = []
    if region:
        clauses.append(f"{col('region')} = ?")
        params.append(region)
    if school:
        clauses.append(f"({col('red_school')} LIKE ? OR {col('blue_school')} LIKE ?)")
        like = f"%{school}%"
        params.extend([like, like])
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    rows = _select_matches(where, params)
    groups = group_matches(rows)
    total = len(groups)
    return total, groups[offset : offset + limit]


def get_match_group(match_key: str) -> MatchGroup | None:
    parts = match_key.split("|")
    if len(parts) != 4:
        return None
    region, match_no_s, red, blue = parts
    rows = _select_matches(
        f"WHERE {col('region')} = ? AND {col('match_no')} = ? AND {col('red_school')} = ? AND {col('blue_school')} = ?",
        (region, int(match_no_s), red, blue),
    )
    groups = group_matches(rows)
    return groups[0] if groups else None


def get_round_by_game_id(game_id: str) -> dict[str, Any] | None:
    rows = _select_matches(f"WHERE {col('game_id')} = ?", (game_id,))
    return rows[0] if rows else None


def list_regions() -> list[str]:
    rows = fetch_all(f"SELECT DISTINCT {col('region')} AS region FROM matches ORDER BY region")
    return [str(r["region"]) for r in rows]


def list_schools(q: str | None = None, limit: int = 40) -> list[str]:
    if q:
        like = f"%{q}%"
        rows = fetch_all(
            f"""
            SELECT school FROM (
              SELECT DISTINCT {col('red_school')} AS school FROM matches
              UNION
              SELECT DISTINCT {col('blue_school')} AS school FROM matches
            ) t
            WHERE school LIKE ?
            ORDER BY school
            LIMIT ?
            """,
            (like, limit),
        )
    else:
        rows = fetch_all(
            f"""
            SELECT school FROM (
              SELECT DISTINCT {col('red_school')} AS school FROM matches
              UNION
              SELECT DISTINCT {col('blue_school')} AS school FROM matches
            ) t
            ORDER BY school
            LIMIT ?
            """,
            (limit,),
        )
    return [str(r["school"]) for r in rows]


def school_standings(limit: int = 15) -> list[dict[str, Any]]:
    """Match-series win table (FotMob-style school standings)."""
    rows = _select_matches()
    groups = group_matches(rows)
    stats: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"played": 0, "won": 0, "lost": 0, "drawn": 0, "region": ""}
    )
    for g in groups:
        for school, region in ((g.red_school, g.region), (g.blue_school, g.region)):
            if not stats[school]["region"]:
                stats[school]["region"] = region
        stats[g.red_school]["played"] += 1
        stats[g.blue_school]["played"] += 1
        if g.red_wins > g.blue_wins:
            stats[g.red_school]["won"] += 1
            stats[g.blue_school]["lost"] += 1
        elif g.blue_wins > g.red_wins:
            stats[g.blue_school]["won"] += 1
            stats[g.red_school]["lost"] += 1
        else:
            stats[g.red_school]["drawn"] += 1
            stats[g.blue_school]["drawn"] += 1

    items = [
        {
            "rank": 0,
            "school": school,
            "region": s["region"],
            "played": s["played"],
            "won": s["won"],
            "lost": s["lost"],
            "drawn": s["drawn"],
            "pts": s["won"] * 3 + s["drawn"],
        }
        for school, s in stats.items()
    ]
    items.sort(key=lambda x: (x["pts"], x["won"], x["played"]), reverse=True)
    for i, row in enumerate(items[:limit]):
        row["rank"] = i + 1
    return items[:limit]
