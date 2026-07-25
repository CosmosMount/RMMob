from __future__ import annotations

import math
from typing import Any

from app.db import fetch_all
from app.schemas.models import (
    EventItem,
    EventsResponse,
    RobotSnapshot,
    RoundDetail,
    StatBar,
    StatisticsResponse,
)
from app.services.matches import get_match_group, get_round_by_game_id
from app.sql_map import col

BUILDINGS = {"基地", "前哨站"}


def _match_key_from_row(row: dict[str, Any]) -> str:
    return f"{row['region']}|{row['match_no']}|{row['red_school']}|{row['blue_school']}"


def _f(v: Any) -> float | None:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _g(r: dict[str, Any], *keys: str) -> Any:
    for k in keys:
        if k in r and r[k] is not None:
            return r[k]
    return None


def _distance_for_robot(game_id: str, robot_id: str) -> float:
    rows = fetch_all(
        f"""
        SELECT {col('x')} AS x, {col('y')} AS y
        FROM timeseries
        WHERE {col('game_id')} = ? AND {col('robot_id')} = ?
          AND {col('x')} IS NOT NULL AND {col('y')} IS NOT NULL
        ORDER BY {col('second')}
        """,
        (game_id, robot_id),
    )
    dist = 0.0
    prev = None
    for r in rows:
        pt = (float(r["x"]), float(r["y"]))
        if prev is not None:
            dist += math.hypot(pt[0] - prev[0], pt[1] - prev[1])
        prev = pt
    return dist


def _damage_taken_map(game_id: str) -> dict[str, float]:
    """受击: robot_id is the victim."""
    rows = fetch_all(
        f"""
        SELECT {col('robot_id')} AS rid, SUM(COALESCE({col('value')}, 0)) AS dmg
        FROM events
        WHERE {col('game_id')} = ? AND {col('event_type')} = ?
        GROUP BY {col('robot_id')}
        """,
        (game_id, "受击"),
    )
    return {str(r["rid"]): float(r["dmg"] or 0) for r in rows if r["rid"] is not None}


def get_round_detail(
    game_id: str,
    at_second: int | None = None,
    *,
    include_distance: bool | None = None,
) -> RoundDetail | None:
    row = get_round_by_game_id(game_id)
    if not row:
        return None
    match_key = _match_key_from_row(row)
    group = get_match_group(match_key)
    duration = int(row["duration_sec"] or 0)
    second = duration if at_second is None else max(0, min(at_second, duration))
    # Scrubbing updates skip expensive path distance by default
    if include_distance is None:
        include_distance = at_second is None

    robots_rows = fetch_all(
        f"""
        SELECT
            t.{col('robot_id')} AS robot_id,
            t.{col('robot_type')} AS robot_type,
            t.{col('team')} AS team,
            t.{col('school')} AS school,
            t.{col('hp')} AS hp,
            t.{col('hp_max')} AS hp_max,
            t.{col('x')} AS x,
            t.{col('y')} AS y,
            t.{col('z')} AS z,
            t.{col('orientation')} AS orientation,
            t.{col('ammo_17')} AS ammo_17,
            t.{col('ammo_42')} AS ammo_42,
            t.{col('gold_total')} AS gold_total,
            t.{col('gold_remain')} AS gold_remain,
            t.{col('vulnerable')} AS vulnerable
        FROM timeseries t
        INNER JOIN (
            SELECT {col('robot_id')} AS rid, MAX({col('second')}) AS mx
            FROM timeseries
            WHERE {col('game_id')} = ? AND {col('second')} <= ?
            GROUP BY {col('robot_id')}
        ) m ON t.{col('robot_id')} = m.rid AND t.{col('second')} = m.mx
        WHERE t.{col('game_id')} = ?
        """,
        (game_id, second, game_id),
    )

    # Early scrub (t=0) often has no rows — snap to first available second
    if not robots_rows and second == 0:
        first = fetch_all(
            f"""
            SELECT MIN({col('second')}) AS mn
            FROM timeseries
            WHERE {col('game_id')} = ?
            """,
            (game_id,),
        )
        mn = first[0]["mn"] if first else None
        if mn is not None and int(mn) > 0:
            return get_round_detail(
                game_id,
                int(mn),
                include_distance=include_distance,
            )

    dmg = _damage_taken_map(game_id)
    robots: list[RobotSnapshot] = []
    for r in robots_rows:
        rid = str(r["robot_id"])
        rtype = str(r["robot_type"] or "")
        team = str(r["team"] or "")
        hp = _f(r["hp"])
        hp_max = _f(r["hp_max"])
        status = "active"
        if rtype in BUILDINGS:
            status = "building"
        elif hp is not None and hp <= 0:
            status = "destroyed"
        elif rtype == "空中" and hp is None:
            status = "not_deployed"

        robots.append(
            RobotSnapshot(
                robot_id=rid,
                robot_type=rtype,
                team=team,
                school=str(r["school"] or ""),
                hp=hp,
                hp_max=hp_max,
                x=_f(r["x"]),
                y=_f(r["y"]),
                z=_f(r["z"]),
                orientation=_f(r["orientation"]),
                ammo_17=_f(r["ammo_17"]),
                ammo_42=_f(r["ammo_42"]),
                gold_total=_f(r["gold_total"]),
                gold_remain=_f(r["gold_remain"]),
                vulnerable=int(r["vulnerable"] or 0),
                damage_dealt=abs(float(dmg.get(rid, 0))),
                distance=round(_distance_for_robot(game_id, rid), 2) if include_distance else 0.0,
                status=status,
            )
        )

    red_hp = sum((x.hp or 0) for x in robots if x.team == "红" and x.robot_type not in BUILDINGS)
    blue_hp = sum((x.hp or 0) for x in robots if x.team == "蓝" and x.robot_type not in BUILDINGS)
    red_alive = sum(
        1 for x in robots if x.team == "红" and x.robot_type not in BUILDINGS and (x.hp or 0) > 0
    )
    blue_alive = sum(
        1 for x in robots if x.team == "蓝" and x.robot_type not in BUILDINGS and (x.hp or 0) > 0
    )
    red_gold = next((x.gold_remain for x in robots if x.team == "红" and x.gold_remain is not None), None)
    blue_gold = next((x.gold_remain for x in robots if x.team == "蓝" and x.gold_remain is not None), None)

    return RoundDetail(
        game_id=str(row["game_id"]),
        region=str(row["region"]),
        match_no=int(row["match_no"]),
        schedule=str(row["schedule"]),
        round_no=int(row["round_no"]),
        red_school=str(row["red_school"]),
        blue_school=str(row["blue_school"]),
        winner=str(row["winner"]) if row.get("winner") is not None else None,
        start_time=str(row["start_time"]) if row.get("start_time") is not None else None,
        duration_sec=duration,
        match_key=match_key,
        sibling_rounds=group.rounds if group else [],
        red_wins=group.red_wins if group else 0,
        blue_wins=group.blue_wins if group else 0,
        robots=robots,
        quick_stats={
            "red_hp": red_hp,
            "blue_hp": blue_hp,
            "red_alive": red_alive,
            "blue_alive": blue_alive,
            "red_gold": red_gold,
            "blue_gold": blue_gold,
            "at_second": second,
        },
    )


def list_events(
    game_id: str,
    *,
    team: str | None = None,
    robot_type: str | None = None,
    collapse_shots: bool = True,
    limit: int = 500,
) -> EventsResponse:
    clauses = [f"{col('game_id')} = ?"]
    params: list[Any] = [game_id]
    if team:
        clauses.append(f"{col('team')} = ?")
        params.append(team)
    if robot_type:
        clauses.append(f"{col('robot_type')} = ?")
        params.append(robot_type)

    rows = fetch_all(
        f"""
        SELECT
            {col('second')} AS second,
            {col('event_type')} AS event_type,
            {col('robot_id')} AS robot_id,
            {col('robot_type')} AS robot_type,
            {col('team')} AS team,
            {col('school')} AS school,
            {col('target_robot_id')} AS target_robot_id,
            {col('target_type')} AS target_type,
            {col('category')} AS category,
            {col('value')} AS value,
            {col('note')} AS note
        FROM events
        WHERE {' AND '.join(clauses)}
        ORDER BY {col('second')}, {col('event_type')}
        """,
        params,
    )

    major = {"飞镖命中", "能量机关", "装配成功", "雷达反制UAV", "飞镖闸门开", "增益"}
    items: list[EventItem] = []
    shot_bucket: dict[tuple, int] = {}

    for r in rows:
        et = str(r["event_type"])
        if collapse_shots and et == "发弹":
            key = (int(r["second"]), str(r["robot_id"]), str(r.get("category") or ""))
            shot_bucket[key] = shot_bucket.get(key, 0) + 1
            continue
        importance = "major" if et in major or (et == "受击" and float(r["value"] or 0) >= 50) else "minor"
        if et == "受击" and float(r["value"] or 0) >= 100:
            importance = "major"
        items.append(
            EventItem(
                second=int(r["second"]),
                event_type=et,
                robot_id=str(r["robot_id"]) if r["robot_id"] is not None else None,
                robot_type=str(r["robot_type"]) if r["robot_type"] is not None else None,
                team=str(r["team"]) if r["team"] is not None else None,
                school=str(r["school"]) if r["school"] is not None else None,
                target_robot_id=str(r["target_robot_id"]) if r["target_robot_id"] is not None else None,
                target_type=str(r["target_type"]) if r["target_type"] is not None else None,
                category=str(r["category"]) if r["category"] is not None else None,
                value=_f(r["value"]),
                note=str(r["note"]) if r["note"] is not None else None,
                importance=importance,
            )
        )

    for (sec, rid, cat), count in sorted(shot_bucket.items()):
        items.append(
            EventItem(
                second=sec,
                event_type="发弹",
                robot_id=rid,
                category=cat or None,
                value=float(count),
                note=f"{count} shots collapsed",
                importance="minor",
            )
        )
    items.sort(key=lambda e: (e.second, e.event_type))
    items = items[:limit]
    return EventsResponse(game_id=game_id, total=len(items), items=items)


def get_statistics(game_id: str) -> StatisticsResponse:
    detail = get_round_detail(game_id)
    if not detail:
        return StatisticsResponse(game_id=game_id, bars=[])

    def side(team: str, pred) -> float:
        return float(sum(pred(r) for r in detail.robots if r.team == team))

    # damage_dealt on robots is filled from 受击 (victim; often negative deltas).
    # Team 造成伤害 = |对方承伤|.
    red_dealt = abs(side("蓝", lambda r: r.damage_dealt))
    blue_dealt = abs(side("红", lambda r: r.damage_dealt))

    bars = [
        StatBar(
            metric="damage_dealt",
            label="造成伤害",
            red=red_dealt,
            blue=blue_dealt,
        ),
        StatBar(
            metric="ammo_17",
            label="17mm 发弹",
            red=side("红", lambda r: r.ammo_17 or 0),
            blue=side("蓝", lambda r: r.ammo_17 or 0),
        ),
        StatBar(
            metric="ammo_42",
            label="42mm 发弹",
            red=side("红", lambda r: r.ammo_42 or 0),
            blue=side("蓝", lambda r: r.ammo_42 or 0),
        ),
        StatBar(
            metric="remaining_hp",
            label="剩余血量",
            red=side("红", lambda r: (r.hp or 0) if r.robot_type not in BUILDINGS else 0),
            blue=side("蓝", lambda r: (r.hp or 0) if r.robot_type not in BUILDINGS else 0),
        ),
        StatBar(
            metric="distance",
            label="移动距离",
            red=side("红", lambda r: r.distance),
            blue=side("蓝", lambda r: r.distance),
        ),
        StatBar(
            metric="gold_remain",
            label="剩余金币",
            red=float(detail.quick_stats.get("red_gold") or 0),
            blue=float(detail.quick_stats.get("blue_gold") or 0),
        ),
    ]
    return StatisticsResponse(game_id=game_id, bars=bars)
