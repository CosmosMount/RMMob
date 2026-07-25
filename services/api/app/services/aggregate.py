from __future__ import annotations

from functools import lru_cache
from typing import Any

from app.db import fetch_all
from app.schemas.models import RankingRow, RankingsResponse, TeamSummary
from app.services.matches import list_matches
from app.sql_map import col

RANK_MODEL = "rankings-v1.0"


def get_team(school: str) -> TeamSummary | None:
    _, groups = list_matches(school=school, limit=200, offset=0)
    if not groups:
        return None
    exact = [g for g in groups if g.red_school == school or g.blue_school == school]
    use = exact or groups
    if not use:
        return None

    from collections import defaultdict

    region_counts: dict[str, int] = defaultdict(int)
    rounds_played = 0
    rounds_won = 0
    resolved = school
    for g in use:
        region_counts[g.region] += 1
        if g.red_school == school or g.blue_school == school:
            resolved = school
        for r in g.rounds:
            rounds_played += 1
            if (r.winner == "红" and g.red_school == school) or (
                r.winner == "蓝" and g.blue_school == school
            ):
                rounds_won += 1

    return TeamSummary(
        school=resolved,
        region_counts=dict(region_counts),
        matches_played=len(use),
        rounds_played=rounds_played,
        rounds_won=rounds_won,
        win_rate=(rounds_won / rounds_played) if rounds_played else 0.0,
        recent_matches=use[:12],
    )


def get_rankings(robot_type: str, region: str | None = None, limit: int = 40) -> RankingsResponse:
    region_clause = f"AND {col('region')} = ?" if region else ""
    params: list[Any] = [robot_type]
    if region:
        params.append(region)

    ammo_rows = fetch_all(
        f"""
        SELECT school, region, SUM(a17) AS ammo_17, SUM(a42) AS ammo_42, COUNT(*) AS rounds
        FROM (
            SELECT
                {col('school')} AS school,
                {col('region')} AS region,
                {col('game_id')} AS game_id,
                {col('robot_id')} AS robot_id,
                MAX(COALESCE({col('ammo_17')}, 0)) AS a17,
                MAX(COALESCE({col('ammo_42')}, 0)) AS a42
            FROM timeseries
            WHERE {col('robot_type')} = ?
            {region_clause}
            GROUP BY {col('school')}, {col('region')}, {col('game_id')}, {col('robot_id')}
        ) x
        GROUP BY school, region
        """,
        params,
    )

    dmg_params: list[Any] = ["受击", robot_type]
    dmg_region = ""
    if region:
        dmg_region = f"AND {col('region')} = ?"
        dmg_params.append(region)
    dmg_rows = fetch_all(
        f"""
        SELECT {col('school')} AS school, SUM(COALESCE({col('value')}, 0)) AS dmg
        FROM events
        WHERE {col('event_type')} = ? AND {col('robot_type')} = ?
        {dmg_region}
        GROUP BY {col('school')}
        """,
        dmg_params,
    )
    dmg_map = {str(r["school"]): float(r["dmg"] or 0) for r in dmg_rows}

    items_data = []
    for r in ammo_rows:
        school = str(r["school"])
        items_data.append(
            {
                "school": school,
                "region": str(r["region"]) if r["region"] is not None else None,
                "rounds": int(r["rounds"] or 0),
                "ammo_17": float(r["ammo_17"] or 0),
                "ammo_42": float(r["ammo_42"] or 0),
                "damage": dmg_map.get(school, 0.0),
                "distance": 0.0,
                "avg_hp_ratio": 0.0,
            }
        )

    items_data.sort(key=lambda x: (x["damage"], x["ammo_17"] + x["ammo_42"]), reverse=True)
    items = [
        RankingRow(
            rank=i + 1,
            school=d["school"],
            region=d["region"],
            robot_type=robot_type,
            rounds=d["rounds"],
            damage=round(d["damage"], 1),
            ammo_17=round(d["ammo_17"], 1),
            ammo_42=round(d["ammo_42"], 1),
            distance=d["distance"],
            avg_hp_ratio=round(d["avg_hp_ratio"], 3),
        )
        for i, d in enumerate(items_data[:limit])
    ]
    return RankingsResponse(
        robot_type=robot_type,
        region=region,
        model_version=RANK_MODEL,
        items=items,
    )


def list_robot_index(limit: int = 100) -> list[dict[str, Any]]:
    """School × type index.

    Full GROUP BY on 4M timeseries rows is too slow for interactive UI.
    Sample recent/limited matches then cache — accurate enough for browsing.
    """
    return _list_robot_index_cached(limit)


@lru_cache(maxsize=8)
def _list_robot_index_cached(limit: int) -> list[dict[str, Any]]:
    rows = fetch_all(
        f"""
        SELECT
            {col('school')} AS school,
            {col('robot_type')} AS robot_type,
            {col('region')} AS region,
            COUNT(DISTINCT {col('game_id')}) AS rounds
        FROM timeseries
        WHERE {col('game_id')} IN (
            SELECT {col('game_id')} FROM matches LIMIT 200
        )
          AND {col('robot_type')} NOT IN ('基地', '前哨站')
        GROUP BY {col('school')}, {col('robot_type')}, {col('region')}
        ORDER BY rounds DESC
        LIMIT ?
        """,
        (limit,),
    )
    return [
        {
            "school": str(r["school"]),
            "robot_type": str(r["robot_type"]),
            "region": str(r["region"]),
            "rounds": int(r["rounds"]),
            "key": f"{r['school']}|{r['robot_type']}|{r['region']}",
        }
        for r in rows
    ]


def analytics_overview() -> dict[str, Any]:
    regions = fetch_all(
        f"SELECT {col('region')} AS region, COUNT(*) AS rounds FROM matches GROUP BY {col('region')}"
    )
    winners = fetch_all(
        f"SELECT {col('winner')} AS winner, COUNT(*) AS n FROM matches GROUP BY {col('winner')}"
    )
    return {
        "regions": [{"region": r["region"], "rounds": r["rounds"]} for r in regions],
        "winners": [{"winner": r["winner"], "count": r["n"]} for r in winners],
        "notes": [
            "Opening strategy and route density charts arrive after map aggregation jobs.",
            "Momentum distribution uses momentum-v1.0 per round when requested.",
        ],
    }
