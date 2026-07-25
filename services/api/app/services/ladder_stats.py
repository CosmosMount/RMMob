from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

DATA_PATH = Path(__file__).resolve().parents[2] / "data" / "robot_data_2026.json"

# UI / API Chinese names ↔ LADDER English type keys
TYPE_MAP = {
    "英雄": "Hero",
    "工程": "Sapper",
    "步兵": "Infantry",
    "步兵3": "Infantry",
    "步兵4": "Infantry",
    "空中": "Airplane",
    "哨兵": "Guard",
    "雷达": "Radar",
    "飞镖": "Dart",
    "Hero": "Hero",
    "Sapper": "Sapper",
    "Infantry": "Infantry",
    "Airplane": "Airplane",
    "Guard": "Guard",
    "Radar": "Radar",
    "Dart": "Dart",
}

TYPE_LABELS = {
    "Hero": "英雄",
    "Sapper": "工程",
    "Infantry": "步兵",
    "Airplane": "空中",
    "Guard": "哨兵",
    "Radar": "雷达",
    "Dart": "飞镖",
}

# LADDER TYPE_FIELDS_DEFAULT (+ dart/radar 2026 extras used in UI)
TYPE_FIELDS: dict[str, list[str]] = {
    "Infantry": [
        "eaSmallHitRate",
        "eagHurt",
        "gkDamage",
        "eaKDA",
        "gKillCount",
        "matchLargeEnergyActRoundsAvg",
    ],
    "Hero": ["eaBigHitRate", "eagHurt", "gkDamage", "eaKDA", "eaSnipeCnt", "gKillCount"],
    "Sapper": ["eaExchangeEcon", "avgMineTime", "avgMineDiff", "eaAssembleEcon", "eaAssembleSuccCnt"],
    "Airplane": ["eaSmallHitRate", "eagHurt", "gkDamage", "eaKDA", "avgShootNum", "gKillCount"],
    "Guard": ["eaSmallHitRate", "eagHurt", "gkDamage", "eaKDA", "gKillCount"],
    "Radar": ["eaRadarMarkerTime", "eaRadarDebuffDmg", "eaRadarParseSuccCnt", "eaRadarCounterTime"],
    "Dart": [
        "etDartOutpostCnt",
        "etDartFixedCnt",
        "etDartRDFixCnt",
        "etDartRDMoveCnt",
        "etDartEndMoveCnt",
        "gkDamage",
        "gKillCount",
    ],
}

LADDER_FIELDS: dict[str, dict[str, str]] = {
    "Infantry": {"field": "ladder_score", "label": "K+0.4A"},
    "Hero": {"field": "gkDamage", "label": "关键伤害"},
    "Sapper": {"field": "eaExchangeEcon", "label": "兑换经济"},
    "Airplane": {"field": "eagHurt", "label": "造成伤害"},
    "Guard": {"field": "eagHurt", "label": "造成伤害"},
    "Radar": {"field": "eaRadarMarkerTime", "label": "雷达标记时长"},
    "Dart": {"field": "gkDamage", "label": "关键伤害"},
}

FIELD_LABELS = {
    "eaKDA": "KDA",
    "ladder_score": "K+0.4A",
    "eagHurt": "造成伤害",
    "gkDamage": "关键伤害",
    "gKillCount": "击杀",
    "eaSmallHitRate": "17mm命中率",
    "eaBigHitRate": "42mm命中率",
    "eaSnipeCnt": "吊射次数",
    "avgShootNum": "场均发弹",
    "matchLargeEnergyActRoundsAvg": "大能量局均",
    "eaExchangeEcon": "兑换经济",
    "avgMineTime": "采矿耗时",
    "avgMineDiff": "采矿难度",
    "eaAssembleEcon": "装配经济",
    "eaAssembleSuccCnt": "装配成功",
    "eaRadarMarkerTime": "标记时长",
    "eaRadarDebuffDmg": "易伤伤害",
    "eaRadarParseSuccCnt": "解析成功",
    "eaRadarCounterTime": "反制时长",
    "etDartOutpostCnt": "飞镖前哨",
    "etDartFixedCnt": "飞镖固定",
    "etDartRDFixCnt": "飞镖固定命中",
    "etDartRDMoveCnt": "飞镖移动命中",
    "etDartEndMoveCnt": "飞镖终点移动",
    "kills": "K",
    "deaths": "D",
    "assists": "A",
}

MODEL_VERSION = "ladder-official-2026"


@lru_cache(maxsize=1)
def _load_raw() -> dict[str, Any]:
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Missing {DATA_PATH}")
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


def resolve_type(robot_type: str) -> str:
    key = TYPE_MAP.get(robot_type) or TYPE_MAP.get(robot_type.strip())
    if not key:
        raise ValueError(f"Unknown robot type: {robot_type}")
    return key


def parse_kda(value: Any) -> tuple[float, float, float]:
    parts = str(value or "0/0/0").split("/")
    k = float(parts[0]) if len(parts) > 0 else 0.0
    d = float(parts[1]) if len(parts) > 1 else 0.0
    a = float(parts[2]) if len(parts) > 2 else 0.0
    return k, d, a


def kda_score(value: Any) -> float:
    k, _, a = parse_kda(value)
    return k + a * 0.4


def list_zones() -> list[dict[str, str]]:
    data = _load_raw()
    return [{"zoneId": z["zoneId"], "zoneName": z["zoneName"]} for z in data.get("zones", [])]


def _iter_robots(zone_id: str | None = None, zone_name: str | None = None):
    data = _load_raw()
    for zone in data.get("zones", []):
        if zone_id and str(zone.get("zoneId")) != str(zone_id):
            continue
        if zone_name and zone.get("zoneName") != zone_name:
            continue
        for team in zone.get("teams", []):
            school = team.get("collegeName") or ""
            logo = team.get("collegeLogo")
            team_name = team.get("name") or ""
            for robot in team.get("robots", []):
                yield {
                    "zoneId": str(zone.get("zoneId")),
                    "zoneName": zone.get("zoneName"),
                    "school": school,
                    "team_name": team_name,
                    "logo": logo,
                    "robot": robot,
                }


def get_rankings(
    robot_type: str,
    *,
    region: str | None = None,
    zone_id: str | None = None,
    sort_by: str | None = None,
    limit: int = 80,
) -> dict[str, Any]:
    type_key = resolve_type(robot_type)
    fields = list(TYPE_FIELDS.get(type_key, ["eaKDA"]))
    default_sort = LADDER_FIELDS.get(type_key, {}).get("field", "ladder_score")
    sort_field = sort_by or default_sort

    # region filter: match zoneName containing region keyword (东部/南部/北部)
    zone_name = None
    if region:
        for z in list_zones():
            if region in z["zoneName"] or z["zoneName"] in region:
                zone_name = z["zoneName"]
                break
        if not zone_name:
            zone_name = region

    rows: list[dict[str, Any]] = []
    for item in _iter_robots(zone_id=zone_id, zone_name=zone_name):
        robot = item["robot"]
        if robot.get("type") != type_key:
            continue
        k, d, a = parse_kda(robot.get("eaKDA"))
        score = kda_score(robot.get("eaKDA"))
        metrics = {f: robot.get(f) for f in fields}
        metrics["ladder_score"] = round(score, 3)
        metrics["kills"] = k
        metrics["deaths"] = d
        metrics["assists"] = a
        label = TYPE_LABELS.get(type_key, type_key)
        if type_key == "Infantry" and robot.get("robotNumber") is not None:
            label = f"步兵{robot.get('robotNumber')}"
        rows.append(
            {
                "school": item["school"],
                "team_name": item["team_name"],
                "region": item["zoneName"],
                "zone_id": item["zoneId"],
                "logo": item["logo"],
                "robot_type": label,
                "robot_type_key": type_key,
                "robot_number": robot.get("robotNumber"),
                "kda": f"{k:g}/{d:g}/{a:g}",
                "ladder_score": round(score, 3),
                "eagHurt": robot.get("eagHurt"),
                "gkDamage": robot.get("gkDamage"),
                "gKillCount": robot.get("gKillCount"),
                "metrics": metrics,
            }
        )

    def sort_key(r: dict[str, Any]) -> float:
        if sort_field == "ladder_score" or sort_field == "eagKdaScore":
            return float(r.get("ladder_score") or 0)
        if sort_field == "eaKDA":
            return float(r.get("ladder_score") or 0)
        val = r.get(sort_field)
        if val is None:
            val = r.get("metrics", {}).get(sort_field)
        try:
            return float(val or 0)
        except (TypeError, ValueError):
            return 0.0

    rows.sort(key=sort_key, reverse=True)
    for i, r in enumerate(rows[:limit]):
        r["rank"] = i + 1

    return {
        "robot_type": TYPE_LABELS.get(type_key, type_key),
        "robot_type_key": type_key,
        "region": region,
        "sort_by": sort_field,
        "sort_label": FIELD_LABELS.get(sort_field)
        or LADDER_FIELDS.get(type_key, {}).get("label", sort_field),
        "fields": fields + (["ladder_score"] if "ladder_score" not in fields else []),
        "field_labels": {
            f: FIELD_LABELS.get(f, f)
            for f in fields + ["ladder_score", "kills", "deaths", "assists"]
        },
        "model_version": MODEL_VERSION,
        "source": "LADDER robot_data_2026.json (official season aggregates)",
        "items": rows[:limit],
    }


def get_compare(robot_type: str, schools: list[str]) -> dict[str, Any]:
    type_key = resolve_type(robot_type)
    fields = TYPE_FIELDS.get(type_key, ["eaKDA"])
    schools = [s for s in schools if s][:4]
    if len(schools) < 2:
        raise ValueError("Need 2–4 schools")

    # Pick best robot of that type per school (by ladder default score)
    ranking = get_rankings(robot_type, limit=500)
    by_school = {s: None for s in schools}
    for row in ranking["items"]:
        name = row["school"]
        if name in by_school and by_school[name] is None:
            by_school[name] = row
        else:
            # fuzzy contains
            for s in schools:
                if by_school[s] is None and (s in name or name in s):
                    by_school[s] = row

    teams = []
    for s in schools:
        row = by_school.get(s)
        if not row:
            teams.append({"school": s, "found": False, "metrics": {}})
            continue
        metrics = {}
        for f in fields:
            metrics[f] = row.get("metrics", {}).get(f, row.get(f))
        metrics["ladder_score"] = row.get("ladder_score")
        metrics["kda"] = row.get("kda")
        teams.append(
            {
                "school": row["school"],
                "found": True,
                "region": row.get("region"),
                "logo": row.get("logo"),
                "kda": row.get("kda"),
                "ladder_score": row.get("ladder_score"),
                "metrics": metrics,
            }
        )

    def metric_number(team: dict[str, Any], field: str) -> float:
        if field in ("eaKDA", "ladder_score"):
            if field == "ladder_score" and team.get("ladder_score") is not None:
                try:
                    return float(team["ladder_score"])
                except (TypeError, ValueError):
                    pass
            return kda_score(team.get("kda") or team.get("metrics", {}).get("eaKDA"))
        raw = team.get("metrics", {}).get(field)
        try:
            return float(raw or 0)
        except (TypeError, ValueError):
            return 0.0

    # Build bar series per metric (skip raw eaKDA string — use ladder_score instead)
    series = []
    bar_fields = [f for f in fields if f != "eaKDA"] + ["ladder_score"]
    for f in bar_fields:
        vals = [metric_number(t, f) for t in teams]
        peak = max(vals) if vals else 1.0
        peak = peak or 1.0
        series.append(
            {
                "field": f,
                "label": FIELD_LABELS.get(f, f),
                "values": [
                    {
                        "school": teams[i]["school"],
                        "value": vals[i],
                        "ratio": vals[i] / peak,
                    }
                    for i in range(len(teams))
                ],
            }
        )

    return {
        "robot_type": TYPE_LABELS.get(type_key, type_key),
        "robot_type_key": type_key,
        "fields": fields,
        "field_labels": {f: FIELD_LABELS.get(f, f) for f in fields + ["ladder_score"]},
        "teams": teams,
        "series": series,
        "model_version": MODEL_VERSION,
    }


def list_schools_for_type(robot_type: str, q: str | None = None, limit: int = 40) -> list[str]:
    ranking = get_rankings(robot_type, limit=300)
    names = []
    seen = set()
    for row in ranking["items"]:
        s = row["school"]
        if s in seen:
            continue
        if q and q not in s:
            continue
        seen.add(s)
        names.append(s)
        if len(names) >= limit:
            break
    return names
