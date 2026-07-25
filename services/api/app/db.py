from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Any, Iterator

from app.config import settings

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # pragma: no cover
    psycopg = None  # type: ignore
    dict_row = None  # type: ignore


def using_postgres() -> bool:
    return bool(settings.database_url and settings.database_url.startswith("postgres"))


def _adapt_sql(sql: str) -> str:
    if using_postgres():
        return sql.replace("?", "%s")
    return sql


@contextmanager
def connect() -> Iterator[Any]:
    if using_postgres():
        if psycopg is None:
            raise RuntimeError("psycopg is required for PostgreSQL")
        conn = psycopg.connect(settings.database_url)
        try:
            yield conn
        finally:
            conn.close()
    else:
        if not settings.sqlite_path.exists():
            raise FileNotFoundError(f"SQLite not found: {settings.sqlite_path}")
        conn = sqlite3.connect(str(settings.sqlite_path))
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()


def fetch_all(sql: str, params: tuple | list = ()) -> list[dict[str, Any]]:
    sql = _adapt_sql(sql)
    with connect() as conn:
        if using_postgres():
            with conn.cursor(row_factory=dict_row) as cur:  # type: ignore[misc]
                cur.execute(sql, params)
                return list(cur.fetchall())
        cur = conn.execute(sql, params)
        return [dict(row) for row in cur.fetchall()]


def fetch_one(sql: str, params: tuple | list = ()) -> dict[str, Any] | None:
    rows = fetch_all(sql, params)
    return rows[0] if rows else None
