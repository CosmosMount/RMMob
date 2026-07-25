from __future__ import annotations

import math
from typing import Any

from app.db import fetch_all
from app.schemas.models import (
    HeatmapResponse,
    HeatmapSample,
    TrajectoryPoint,
    TrajectoryResponse,
)
from app.sql_map import col

# Official field approx 28m x 15m (BattleScope / RMUC)
BOUNDS = {"xMin": 0.0, "xMax": 28.0, "yMin": 0.0, "yMax": 15.0}
HEATMAP_MODEL = "ladder-grid-fotmob-blob-v1"
BUILDINGS = {"基地", "前哨站"}


def get_trajectory(
    game_id: str,
    robot_id: str,
    *,
    start: int | None = None,
    end: int | None = None,
) -> TrajectoryResponse | None:
    clauses = [f"{col('game_id')} = ?", f"{col('robot_id')} = ?"]
    params: list[Any] = [game_id, robot_id]
    if start is not None:
        clauses.append(f"{col('second')} >= ?")
        params.append(start)
    if end is not None:
        clauses.append(f"{col('second')} <= ?")
        params.append(end)

    rows = fetch_all(
        f"""
        SELECT
            {col('second')} AS second,
            {col('x')} AS x,
            {col('y')} AS y,
            {col('z')} AS z,
            {col('hp')} AS hp,
            {col('orientation')} AS orientation,
            {col('team')} AS team,
            {col('robot_type')} AS robot_type
        FROM timeseries
        WHERE {' AND '.join(clauses)}
        ORDER BY {col('second')}
        """,
        params,
    )
    if not rows:
        return None

    points: list[TrajectoryPoint] = []
    dist = 0.0
    prev = None
    segments: list[dict] = []
    seg_start = 0
    for i, r in enumerate(rows):
        x = float(r["x"]) if r["x"] is not None else None
        y = float(r["y"]) if r["y"] is not None else None
        observed = x is not None and y is not None
        if observed and prev is not None:
            dist += math.hypot(x - prev[0], y - prev[1])  # type: ignore[arg-type]
        if observed:
            prev = (x, y)
        else:
            if prev is not None:
                segments.append(
                    {
                        "startIndex": seg_start,
                        "endIndex": i - 1,
                        "reason": "continuous",
                    }
                )
                seg_start = i + 1
            prev = None
        points.append(
            TrajectoryPoint(
                second=int(r["second"]),
                x=x,
                y=y,
                z=float(r["z"]) if r["z"] is not None else None,
                hp=float(r["hp"]) if r["hp"] is not None else None,
                orientation=float(r["orientation"]) if r["orientation"] is not None else None,
                observed=observed,
            )
        )
    if points:
        segments.append({"startIndex": seg_start, "endIndex": len(points) - 1, "reason": "continuous"})

    return TrajectoryResponse(
        game_id=game_id,
        robot_id=robot_id,
        team=str(rows[0]["team"] or ""),
        robot_type=str(rows[0]["robot_type"] or ""),
        points=points,
        estimated_distance_2d=round(dist, 3),
        segments=segments,
    )


def list_robot_ids(
    game_id: str,
    *,
    team: str | None = None,
    robot_type: str | None = None,
) -> list[dict[str, str]]:
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
        SELECT DISTINCT
            {col('robot_id')} AS robot_id,
            {col('team')} AS team,
            {col('robot_type')} AS robot_type
        FROM timeseries
        WHERE {' AND '.join(clauses)}
        """,
        params,
    )
    return [
        {
            "robot_id": str(r["robot_id"]),
            "team": str(r["team"] or ""),
            "robot_type": str(r["robot_type"] or ""),
        }
        for r in rows
        if str(r["robot_type"] or "") not in BUILDINGS
    ]


def get_heatmap(
    game_id: str,
    *,
    metric: str = "movement",
    team: str | None = None,
    robot_type: str | None = None,
    robot_id: str | None = None,
    start: int | None = None,
    end: int | None = None,
) -> HeatmapResponse:
    clauses = [
        f"{col('game_id')} = ?",
        f"{col('x')} IS NOT NULL",
        f"{col('y')} IS NOT NULL",
        f"{col('robot_type')} NOT IN ('基地', '前哨站')",
    ]
    params: list[Any] = [game_id]
    if team:
        clauses.append(f"{col('team')} = ?")
        params.append(team)
    if robot_type:
        clauses.append(f"{col('robot_type')} = ?")
        params.append(robot_type)
    if robot_id:
        clauses.append(f"{col('robot_id')} = ?")
        params.append(robot_id)
    if start is not None:
        clauses.append(f"{col('second')} >= ?")
        params.append(start)
    if end is not None:
        clauses.append(f"{col('second')} <= ?")
        params.append(end)

    if metric == "vulnerability":
        clauses.append(f"{col('vulnerable')} = 1")

    rows = fetch_all(
        f"""
        SELECT {col('x')} AS x, {col('y')} AS y, {col('second')} AS second,
               {col('robot_id')} AS robot_id
        FROM timeseries
        WHERE {' AND '.join(clauses)}
        ORDER BY {col('second')}
        """,
        params,
    )

    samples: list[HeatmapSample] = []
    if metric == "shooting":
        # LADDER: events JOIN timeseries on (game_id, robot_id, second)
        ev = fetch_all(
            f"""
            SELECT e.{col('second')} AS second, e.{col('robot_id')} AS robot_id
            FROM events e
            WHERE e.{col('game_id')} = ? AND e.{col('event_type')} = ?
            """,
            (game_id, "发弹"),
        )
        pos = {(str(r["robot_id"]), int(r["second"])): (float(r["x"]), float(r["y"])) for r in rows}
        for e in ev:
            key = (str(e["robot_id"]), int(e["second"]))
            if key in pos:
                x, y = pos[key]
                if BOUNDS["xMin"] <= x <= BOUNDS["xMax"] and BOUNDS["yMin"] <= y <= BOUNDS["yMax"]:
                    samples.append(HeatmapSample(x=x, y=y, weight=1.0))
    elif metric == "damage":
        ev = fetch_all(
            f"""
            SELECT {col('second')} AS second, {col('robot_id')} AS robot_id,
                   COALESCE({col('value')}, 1) AS value
            FROM events
            WHERE {col('game_id')} = ? AND {col('event_type')} = ?
            """,
            (game_id, "受击"),
        )
        pos = {(str(r["robot_id"]), int(r["second"])): (float(r["x"]), float(r["y"])) for r in rows}
        for e in ev:
            key = (str(e["robot_id"]), int(e["second"]))
            if key in pos:
                x, y = pos[key]
                if BOUNDS["xMin"] <= x <= BOUNDS["xMax"] and BOUNDS["yMin"] <= y <= BOUNDS["yMax"]:
                    samples.append(
                        HeatmapSample(x=x, y=y, weight=abs(float(e["value"] or 1)))
                    )
    else:
        # LADDER position heat: every in-bounds timeseries sample (count += 1)
        for r in rows:
            x, y = float(r["x"]), float(r["y"])
            if BOUNDS["xMin"] <= x <= BOUNDS["xMax"] and BOUNDS["yMin"] <= y <= BOUNDS["yMax"]:
                samples.append(HeatmapSample(x=x, y=y, weight=1.0))

    short = min(BOUNDS["xMax"] - BOUNDS["xMin"], BOUNDS["yMax"] - BOUNDS["yMin"])
    bandwidth = short / 60.0  # LADDER cell size on short axis
    entity_scope = "robot" if robot_id else ("team" if team or robot_type else "all")
    t0 = start if start is not None else (min((int(r["second"]) for r in rows), default=0))
    t1 = end if end is not None else (max((int(r["second"]) for r in rows), default=0))

    return HeatmapResponse(
        game_id=game_id,
        entity_scope=entity_scope,
        entity_id=robot_id,
        metric=metric,
        time_range=[t0, t1],
        coordinate_bounds=BOUNDS,
        bandwidth=bandwidth,
        normalization={
            "method": "max",
            "lowPercentile": 0,
            "highPercentile": 100,
            "gamma": 1.0,
            "threshold": 0.01,
            "gridSize": 60,
            "style": "fotmob-blob",
        },
        samples=samples[:80000],
        model_version=HEATMAP_MODEL,
    )
