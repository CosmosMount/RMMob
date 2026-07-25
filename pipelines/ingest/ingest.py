#!/usr/bin/env python3
"""SQLite → PostgreSQL ingest for RMMob."""

from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path

try:
    import psycopg
    from psycopg import sql
except ImportError:
    print("Install psycopg: pip install 'psycopg[binary]'", file=sys.stderr)
    raise

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = Path(__file__).with_name("schema.sql")

MATCH_MAP = [
    ("赛区", "region"),
    ("场次号", "match_no"),
    ("赛程", "schedule"),
    ("局号", "round_no"),
    ("game_id", "game_id"),
    ("web_game_id", "web_game_id"),
    ("红方学校", "red_school"),
    ("蓝方学校", "blue_school"),
    ("胜方", "winner"),
    ("开始时间", "start_time"),
    ("时长秒", "duration_sec"),
]

TS_MAP = [
    ("赛区", "region"),
    ("场次号", "match_no"),
    ("赛程", "schedule"),
    ("局号", "round_no"),
    ("game_id", "game_id"),
    ("时刻秒", "second"),
    ("robot_id", "robot_id"),
    ("机器人类型", "robot_type"),
    ("阵营", "team"),
    ("学校名", "school"),
    ("对手学校", "opponent_school"),
    ("当前血量", "hp"),
    ("最大血量", "hp_max"),
    ("x", "x"),
    ("y", "y"),
    ("z", "z"),
    ("枪口朝向", "orientation"),
    ("底盘功率", "chassis_power"),
    ("小热量", "heat_17"),
    ("小热量上限", "heat_17_max"),
    ("大热量", "heat_42"),
    ("大热量上限", "heat_42_max"),
    ("累计17mm发弹", "ammo_17"),
    ("累计42mm发弹", "ammo_42"),
    ("队伍总金币", "gold_total"),
    ("队伍剩余金币", "gold_remain"),
    ("是否易伤", "vulnerable"),
]

EV_MAP = [
    ("赛区", "region"),
    ("场次号", "match_no"),
    ("赛程", "schedule"),
    ("局号", "round_no"),
    ("game_id", "game_id"),
    ("时刻秒", "second"),
    ("robot_id", "robot_id"),
    ("机器人类型", "robot_type"),
    ("阵营", "team"),
    ("学校名", "school"),
    ("事件类型", "event_type"),
    ("目标robot_id", "target_robot_id"),
    ("目标类型", "target_type"),
    ("类别", "category"),
    ("数值", "value"),
    ("备注", "note"),
]


def copy_table(sqlite_conn: sqlite3.Connection, pg: psycopg.Connection, table: str, mapping: list[tuple[str, str]], batch: int = 2000) -> int:
    src_cols = [s for s, _ in mapping]
    dst_cols = [d for _, d in mapping]
    q_src = ", ".join(f'"{c}"' for c in src_cols)
    cur = sqlite_conn.execute(f"SELECT {q_src} FROM {table}")
    insert = sql.SQL("INSERT INTO {} ({}) VALUES ({}) ON CONFLICT DO NOTHING").format(
        sql.Identifier(table) if table != "events" else sql.Identifier("events"),
        sql.SQL(", ").join(map(sql.Identifier, dst_cols)),
        sql.SQL(", ").join(sql.Placeholder() * len(dst_cols)),
    )
    # events has no natural PK conflict — plain insert
    if table == "events":
        insert = sql.SQL("INSERT INTO events ({}) VALUES ({})").format(
            sql.SQL(", ").join(map(sql.Identifier, dst_cols)),
            sql.SQL(", ").join(sql.Placeholder() * len(dst_cols)),
        )
    elif table == "matches":
        insert = sql.SQL("INSERT INTO matches ({}) VALUES ({}) ON CONFLICT (game_id) DO NOTHING").format(
            sql.SQL(", ").join(map(sql.Identifier, dst_cols)),
            sql.SQL(", ").join(sql.Placeholder() * len(dst_cols)),
        )
    else:
        insert = sql.SQL("INSERT INTO timeseries ({}) VALUES ({})").format(
            sql.SQL(", ").join(map(sql.Identifier, dst_cols)),
            sql.SQL(", ").join(sql.Placeholder() * len(dst_cols)),
        )

    total = 0
    while True:
        rows = cur.fetchmany(batch)
        if not rows:
            break
        with pg.cursor() as pcur:
            pcur.executemany(insert, rows)
        pg.commit()
        total += len(rows)
        print(f"  {table}: {total}", flush=True)
    return total


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest RMUC SQLite into PostgreSQL")
    parser.add_argument(
        "--sqlite",
        type=Path,
        default=ROOT / "rmuc_2026_region_dataset" / "rmuc_2026_region_dataset.sqlite",
    )
    parser.add_argument(
        "--database-url",
        default="postgresql://rmmob:rmmob@localhost:5432/rmmob",
    )
    args = parser.parse_args()
    if not args.sqlite.exists():
        raise SystemExit(f"SQLite missing: {args.sqlite}")

    schema_sql = SCHEMA.read_text(encoding="utf-8")
    sqlite_conn = sqlite3.connect(str(args.sqlite))
    with psycopg.connect(args.database_url) as pg:
        with pg.cursor() as cur:
            cur.execute(schema_sql)
        pg.commit()
        print("Schema applied")
        print("Copying matches...")
        copy_table(sqlite_conn, pg, "matches", MATCH_MAP)
        print("Copying timeseries (large)...")
        copy_table(sqlite_conn, pg, "timeseries", TS_MAP, batch=5000)
        print("Copying events...")
        copy_table(sqlite_conn, pg, "events", EV_MAP, batch=5000)
    sqlite_conn.close()
    print("Done. Set DATABASE_URL for the API.")


if __name__ == "__main__":
    main()
