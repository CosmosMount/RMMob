from __future__ import annotations

from typing import Any

import numpy as np

from app.db import fetch_all
from app.schemas.models import MomentumPoint, MomentumResponse
from app.sql_map import col

MODEL_VERSION = "momentum-v1.0"
BUILDINGS = {"基地", "前哨站"}


def _series_by_second(game_id: str) -> dict[int, list[dict[str, Any]]]:
    rows = fetch_all(
        f"""
        SELECT
            {col('second')} AS second,
            {col('robot_id')} AS robot_id,
            {col('robot_type')} AS robot_type,
            {col('team')} AS team,
            {col('hp')} AS hp,
            {col('hp_max')} AS hp_max,
            {col('x')} AS x,
            {col('y')} AS y,
            {col('gold_remain')} AS gold_remain,
            {col('ammo_17')} AS ammo_17,
            {col('ammo_42')} AS ammo_42,
            {col('vulnerable')} AS vulnerable
        FROM timeseries
        WHERE {col('game_id')} = ?
        ORDER BY {col('second')}
        """,
        (game_id,),
    )
    by_sec: dict[int, list[dict[str, Any]]] = {}
    for r in rows:
        by_sec.setdefault(int(r["second"]), []).append(r)
    return by_sec


def _events_pressure(game_id: str, duration: int) -> tuple[np.ndarray, np.ndarray]:
    """Decayed damage pressure for red advantage (+) when blue takes damage."""
    rows = fetch_all(
        f"""
        SELECT {col('second')} AS second, {col('team')} AS team, {col('value')} AS value,
               {col('event_type')} AS event_type
        FROM events
        WHERE {col('game_id')} = ? AND {col('event_type')} IN (?, ?)
        """,
        (game_id, "受击", "飞镖命中"),
    )
    red_p = np.zeros(duration + 1)
    blue_p = np.zeros(duration + 1)
    for r in rows:
        sec = int(r["second"])
        if sec < 0 or sec > duration:
            continue
        val = float(r["value"] or 10)
        team = str(r["team"] or "")
        # victim team loses → opposite gets pressure advantage
        if team == "红":
            blue_p[sec] += val
        elif team == "蓝":
            red_p[sec] += val
    # exponential decay accumulation
    decay = 0.92
    red_acc = np.zeros(duration + 1)
    blue_acc = np.zeros(duration + 1)
    for t in range(duration + 1):
        red_acc[t] = (red_acc[t - 1] * decay if t else 0) + red_p[t]
        blue_acc[t] = (blue_acc[t - 1] * decay if t else 0) + blue_p[t]
    return red_acc, blue_acc


def compute_momentum(game_id: str) -> MomentumResponse:
    by_sec = _series_by_second(game_id)
    if not by_sec:
        return MomentumResponse(
            game_id=game_id,
            model_version=MODEL_VERSION,
            smoothing={"method": "ema", "alpha": 0.2},
            points=[],
        )
    duration = max(by_sec.keys())
    red_dmg, blue_dmg = _events_pressure(game_id, duration)

    raw = np.zeros(duration + 1)
    contribs: list[dict[str, float]] = []

    for t in range(duration + 1):
        rows = by_sec.get(t) or by_sec.get(max((s for s in by_sec if s <= t), default=0), [])
        red_hp = 0.0
        blue_hp = 0.0
        red_gold = 0.0
        blue_gold = 0.0
        red_obj = 0.0
        blue_obj = 0.0
        red_ammo = 0.0
        blue_ammo = 0.0
        for r in rows:
            team = str(r["team"] or "")
            rtype = str(r["robot_type"] or "")
            hp = float(r["hp"] or 0)
            hp_max = float(r["hp_max"] or 1) or 1
            ratio = hp / hp_max
            if rtype in BUILDINGS:
                if team == "红":
                    red_obj += ratio
                elif team == "蓝":
                    blue_obj += ratio
                continue
            if team == "红":
                red_hp += ratio
                red_gold = float(r["gold_remain"] or red_gold)
                red_ammo += float(r["ammo_17"] or 0) + float(r["ammo_42"] or 0)
            elif team == "蓝":
                blue_hp += ratio
                blue_gold = float(r["gold_remain"] or blue_gold)
                blue_ammo += float(r["ammo_17"] or 0) + float(r["ammo_42"] or 0)

        h = red_hp - blue_hp
        d = (red_dmg[t] - blue_dmg[t]) / 200.0
        e = (red_gold - blue_gold) / 500.0
        g = red_obj - blue_obj
        s = (red_ammo - blue_ammo) / 200.0
        # positional stub: center control via mean x (field ~28m); red prefers higher x often
        red_xs = [float(r["x"]) for r in rows if r["team"] == "红" and r["x"] is not None and r["robot_type"] not in BUILDINGS]
        blue_xs = [float(r["x"]) for r in rows if r["team"] == "蓝" and r["x"] is not None and r["robot_type"] not in BUILDINGS]
        p = 0.0
        if red_xs and blue_xs:
            # closer to mid (14) is better simplified
            mid = 14.0
            p = -(abs(np.mean(red_xs) - mid) - abs(np.mean(blue_xs) - mid)) / 10.0

        parts = {
            "hp": 0.35 * h,
            "damage": 0.25 * d,
            "economy": 0.1 * e,
            "position": 0.1 * p,
            "resource": 0.05 * 0.0,
            "objective": 0.1 * g,
            "shooting": 0.05 * s,
        }
        m = sum(parts.values())
        raw[t] = m
        contribs.append(parts)

    # robust scale
    med = float(np.median(raw))
    mad = float(np.median(np.abs(raw - med))) + 1e-6
    z = (raw - med) / (1.4826 * mad)
    bounded = np.clip(z, -3, 3)

    alpha = 0.2
    smoothed = np.zeros_like(bounded)
    for t in range(len(bounded)):
        smoothed[t] = bounded[t] if t == 0 else alpha * bounded[t] + (1 - alpha) * smoothed[t - 1]

    points: list[MomentumPoint] = []
    for t in range(len(raw)):
        parts = contribs[t]
        dominant = max(parts, key=lambda k: abs(parts[k])) if parts else None
        if dominant and abs(parts[dominant]) < 1e-6:
            dominant = None
        points.append(
            MomentumPoint(
                second=t,
                raw=float(raw[t]),
                bounded=float(bounded[t]),
                smoothed=float(smoothed[t]),
                dominant_factor=dominant,
                contributions={k: float(v) for k, v in parts.items()},
            )
        )

    return MomentumResponse(
        game_id=game_id,
        model_version=MODEL_VERSION,
        smoothing={"method": "ema", "alpha": alpha},
        points=points,
    )
