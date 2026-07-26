import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import fs from "fs";
import path from "path";

function resolveSqlitePath(): string {
  if (process.env.SQLITE_PATH) return process.env.SQLITE_PATH;
  // apps/web → repo root
  return path.resolve(
    process.cwd(),
    "..",
    "..",
    "rmuc_2026_region_dataset",
    "rmuc_2026_region_dataset.sqlite"
  );
}

let cached: DatabaseSync | null = null;
let cachedPath: string | null = null;

export function sqlitePath(): string {
  return resolveSqlitePath();
}

export function sqliteExists(): boolean {
  return fs.existsSync(resolveSqlitePath());
}

export function getDb(): DatabaseSync {
  const p = resolveSqlitePath();
  if (cached && cachedPath === p) return cached;
  if (!fs.existsSync(p)) {
    throw new Error(`SQLite not found: ${p}`);
  }
  cached = new DatabaseSync(p, { readOnly: true });
  cachedPath = p;
  return cached;
}

export function fetchAll<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params: readonly SQLInputValue[] = []
): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}

export function fetchOne<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params: readonly SQLInputValue[] = []
): T | null {
  const row = getDb().prepare(sql).get(...params) as T | undefined;
  return row ?? null;
}
