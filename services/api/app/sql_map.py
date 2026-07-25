from __future__ import annotations

"""Shared SQL dialect helpers for SQLite (source) vs PostgreSQL (ingested)."""

from app.db import using_postgres


def matches_table() -> str:
    return "matches" if using_postgres() else "matches"


# Column names differ: SQLite keeps Chinese headers; PG uses English.
COLS = {
    "region": "region" if using_postgres() else "赛区",
    "match_no": "match_no" if using_postgres() else "场次号",
    "schedule": "schedule" if using_postgres() else "赛程",
    "round_no": "round_no" if using_postgres() else "局号",
    "game_id": "game_id",
    "web_game_id": "web_game_id",
    "red_school": "red_school" if using_postgres() else "红方学校",
    "blue_school": "blue_school" if using_postgres() else "蓝方学校",
    "winner": "winner" if using_postgres() else "胜方",
    "start_time": "start_time" if using_postgres() else "开始时间",
    "duration_sec": "duration_sec" if using_postgres() else "时长秒",
    "second": "second" if using_postgres() else "时刻秒",
    "robot_id": "robot_id",
    "robot_type": "robot_type" if using_postgres() else "机器人类型",
    "team": "team" if using_postgres() else "阵营",
    "school": "school" if using_postgres() else "学校名",
    "opponent_school": "opponent_school" if using_postgres() else "对手学校",
    "hp": "hp" if using_postgres() else "当前血量",
    "hp_max": "hp_max" if using_postgres() else "最大血量",
    "x": "x",
    "y": "y",
    "z": "z",
    "orientation": "orientation" if using_postgres() else "枪口朝向",
    "chassis_power": "chassis_power" if using_postgres() else "底盘功率",
    "heat_17": "heat_17" if using_postgres() else "小热量",
    "heat_17_max": "heat_17_max" if using_postgres() else "小热量上限",
    "heat_42": "heat_42" if using_postgres() else "大热量",
    "heat_42_max": "heat_42_max" if using_postgres() else "大热量上限",
    "ammo_17": "ammo_17" if using_postgres() else "累计17mm发弹",
    "ammo_42": "ammo_42" if using_postgres() else "累计42mm发弹",
    "gold_total": "gold_total" if using_postgres() else "队伍总金币",
    "gold_remain": "gold_remain" if using_postgres() else "队伍剩余金币",
    "vulnerable": "vulnerable" if using_postgres() else "是否易伤",
    "event_type": "event_type" if using_postgres() else "事件类型",
    "target_robot_id": "target_robot_id" if using_postgres() else "目标robot_id",
    "target_type": "target_type" if using_postgres() else "目标类型",
    "category": "category" if using_postgres() else "类别",
    "value": "value" if using_postgres() else "数值",
    "note": "note" if using_postgres() else "备注",
}


def c(key: str) -> str:
    return COLS[key]


def qident(name: str) -> str:
    """Quote identifier for SQLite Chinese columns."""
    if using_postgres():
        return name
    return f'"{name}"'


def col(key: str) -> str:
    return qident(c(key))
