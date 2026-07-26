import type { MatchGroup, MatchRoundSummary } from "@/lib/types";
import type { SQLInputValue } from "node:sqlite";
import { fetchAll } from "./db";
import { col } from "./sqlMap";

type MatchRow = {
  game_id: string | number;
  region: string;
  match_no: number;
  schedule: string;
  round_no: number;
  red_school: string;
  blue_school: string;
  winner: string | null;
  start_time: string | null;
  duration_sec: number | null;
};

function rowToRound(row: MatchRow): MatchRoundSummary {
  return {
    game_id: String(row.game_id),
    region: String(row.region),
    match_no: Number(row.match_no),
    schedule: String(row.schedule),
    round_no: Number(row.round_no),
    red_school: String(row.red_school),
    blue_school: String(row.blue_school),
    winner: row.winner != null ? String(row.winner) : null,
    start_time: row.start_time != null ? String(row.start_time) : null,
    duration_sec: row.duration_sec != null ? Number(row.duration_sec) : null,
  };
}

function selectMatches(where = "", params: SQLInputValue[] = []): MatchRow[] {
  const sql = `
    SELECT
      ${col("game_id")} AS game_id,
      ${col("region")} AS region,
      ${col("match_no")} AS match_no,
      ${col("schedule")} AS schedule,
      ${col("round_no")} AS round_no,
      ${col("red_school")} AS red_school,
      ${col("blue_school")} AS blue_school,
      ${col("winner")} AS winner,
      ${col("start_time")} AS start_time,
      ${col("duration_sec")} AS duration_sec
    FROM matches
    ${where}
    ORDER BY ${col("region")}, ${col("match_no")}, ${col("round_no")}
  `;
  return fetchAll<MatchRow>(sql, params);
}

export function groupMatches(rows: MatchRow[]): MatchGroup[] {
  const buckets = new Map<string, MatchRoundSummary[]>();
  const meta = new Map<string, MatchRow>();

  for (const row of rows) {
    const key = `${row.region}|${Number(row.match_no)}|${row.red_school}|${row.blue_school}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(rowToRound(row));
    meta.set(key, row);
  }

  const groups: MatchGroup[] = [];
  for (const [key, rounds] of buckets) {
    const [region, matchNoS, red, blue] = key.split("|");
    const redWins = rounds.filter((r) => r.winner === "红").length;
    const blueWins = rounds.filter((r) => r.winner === "蓝").length;
    const schedule = rounds[0]?.schedule ?? String(meta.get(key)?.schedule ?? "");
    groups.push({
      match_key: key,
      region,
      match_no: Number(matchNoS),
      schedule,
      red_school: red,
      blue_school: blue,
      rounds,
      red_wins: redWins,
      blue_wins: blueWins,
    });
  }
  return groups;
}

export function listMatches(opts: {
  region?: string | null;
  school?: string | null;
  limit?: number;
  offset?: number;
} = {}): { total: number; items: MatchGroup[] } {
  const { region, school, limit = 50, offset = 0 } = opts;
  const clauses: string[] = [];
  const params: SQLInputValue[] = [];
  if (region) {
    clauses.push(`${col("region")} = ?`);
    params.push(region);
  }
  if (school) {
    clauses.push(`(${col("red_school")} LIKE ? OR ${col("blue_school")} LIKE ?)`);
    const like = `%${school}%`;
    params.push(like, like);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const groups = groupMatches(selectMatches(where, params));
  return { total: groups.length, items: groups.slice(offset, offset + limit) };
}

export function getMatchGroup(matchKey: string): MatchGroup | null {
  const parts = matchKey.split("|");
  if (parts.length !== 4) return null;
  const [region, matchNoS, red, blue] = parts;
  const rows = selectMatches(
    `WHERE ${col("region")} = ? AND ${col("match_no")} = ? AND ${col("red_school")} = ? AND ${col("blue_school")} = ?`,
    [region, Number(matchNoS), red, blue]
  );
  const groups = groupMatches(rows);
  return groups[0] ?? null;
}

export function getRoundByGameId(gameId: string): MatchRow | null {
  const rows = selectMatches(`WHERE ${col("game_id")} = ?`, [gameId]);
  return rows[0] ?? null;
}

export function listRegions(): string[] {
  const rows = fetchAll<{ region: string }>(
    `SELECT DISTINCT ${col("region")} AS region FROM matches ORDER BY region`
  );
  return rows.map((r) => String(r.region));
}

export function listSchools(
  q?: string | null,
  limit = 40,
  offset = 0
): { items: string[]; total: number } {
  const like = q ? `%${q}%` : null;
  const baseFrom = `
    SELECT school FROM (
      SELECT DISTINCT ${col("red_school")} AS school FROM matches
      UNION
      SELECT DISTINCT ${col("blue_school")} AS school FROM matches
    ) t
  `;
  const where = like ? "WHERE school LIKE ?" : "";
  const countRow = fetchAll<{ n: number }>(
    `SELECT COUNT(*) AS n FROM (${baseFrom} ${where}) c`,
    like ? [like] : []
  );
  const total = Number(countRow[0]?.n ?? 0);
  const rows = fetchAll<{ school: string }>(
    `
    ${baseFrom}
    ${where}
    ORDER BY school
    LIMIT ? OFFSET ?
    `,
    like ? [like, limit, offset] : [limit, offset]
  );
  return {
    total,
    items: rows.map((r) => String(r.school)),
  };
}

export function schoolStandings(limit = 15) {
  const groups = groupMatches(selectMatches());
  const stats = new Map<
    string,
    { played: number; won: number; lost: number; drawn: number; region: string }
  >();

  const ensure = (school: string, region: string) => {
    if (!stats.has(school)) {
      stats.set(school, { played: 0, won: 0, lost: 0, drawn: 0, region });
    } else if (!stats.get(school)!.region) {
      stats.get(school)!.region = region;
    }
  };

  for (const g of groups) {
    ensure(g.red_school, g.region);
    ensure(g.blue_school, g.region);
    stats.get(g.red_school)!.played += 1;
    stats.get(g.blue_school)!.played += 1;
    if (g.red_wins > g.blue_wins) {
      stats.get(g.red_school)!.won += 1;
      stats.get(g.blue_school)!.lost += 1;
    } else if (g.blue_wins > g.red_wins) {
      stats.get(g.blue_school)!.won += 1;
      stats.get(g.red_school)!.lost += 1;
    } else {
      stats.get(g.red_school)!.drawn += 1;
      stats.get(g.blue_school)!.drawn += 1;
    }
  }

  const items = [...stats.entries()].map(([school, s]) => ({
    rank: 0,
    school,
    region: s.region,
    played: s.played,
    won: s.won,
    lost: s.lost,
    drawn: s.drawn,
    pts: s.won * 3 + s.drawn,
  }));
  items.sort((a, b) => b.pts - a.pts || b.won - a.won || b.played - a.played);
  const top = items.slice(0, limit);
  top.forEach((row, i) => {
    row.rank = i + 1;
  });
  return top;
}
