import type { MatchGroup } from "@/lib/types";
import { fetchAll } from "./db";
import { listMatches } from "./matches";
import { col } from "./sqlMap";

let robotIndexCache: { limit: number; items: Array<Record<string, unknown>> } | null = null;

export function getTeam(school: string) {
  const { items: groups } = listMatches({ school, limit: 200, offset: 0 });
  if (!groups.length) return null;
  const exact = groups.filter((g) => g.red_school === school || g.blue_school === school);
  const use = exact.length ? exact : groups;
  if (!use.length) return null;

  const regionCounts: Record<string, number> = {};
  let roundsPlayed = 0;
  let roundsWon = 0;
  for (const g of use) {
    regionCounts[g.region] = (regionCounts[g.region] || 0) + 1;
    for (const r of g.rounds) {
      roundsPlayed += 1;
      if (
        (r.winner === "红" && g.red_school === school) ||
        (r.winner === "蓝" && g.blue_school === school)
      ) {
        roundsWon += 1;
      }
    }
  }

  return {
    school,
    region_counts: regionCounts,
    matches_played: use.length,
    rounds_played: roundsPlayed,
    rounds_won: roundsWon,
    win_rate: roundsPlayed ? roundsWon / roundsPlayed : 0,
    recent_matches: use.slice(0, 12) as MatchGroup[],
  };
}

export function listRobotIndex(limit = 100) {
  if (robotIndexCache && robotIndexCache.limit === limit) {
    return robotIndexCache.items;
  }
  const rows = fetchAll<{
    school: string;
    robot_type: string;
    region: string;
    rounds: number;
  }>(
    `
    SELECT
      ${col("school")} AS school,
      ${col("robot_type")} AS robot_type,
      ${col("region")} AS region,
      COUNT(DISTINCT ${col("game_id")}) AS rounds
    FROM timeseries
    WHERE ${col("game_id")} IN (
      SELECT ${col("game_id")} FROM matches LIMIT 200
    )
      AND ${col("robot_type")} NOT IN ('基地', '前哨站')
    GROUP BY ${col("school")}, ${col("robot_type")}, ${col("region")}
    ORDER BY rounds DESC
    LIMIT ?
    `,
    [limit]
  );
  const items = rows.map((r) => ({
    school: String(r.school),
    robot_type: String(r.robot_type),
    region: String(r.region),
    rounds: Number(r.rounds),
    key: `${r.school}|${r.robot_type}|${r.region}`,
  }));
  robotIndexCache = { limit, items };
  return items;
}

export function analyticsOverview() {
  const regions = fetchAll<{ region: string; rounds: number }>(
    `SELECT ${col("region")} AS region, COUNT(*) AS rounds FROM matches GROUP BY ${col("region")}`
  );
  const winners = fetchAll<{ winner: string; n: number }>(
    `SELECT ${col("winner")} AS winner, COUNT(*) AS n FROM matches GROUP BY ${col("winner")}`
  );
  return {
    regions: regions.map((r) => ({ region: r.region, rounds: r.rounds })),
    winners: winners.map((r) => ({ winner: r.winner, count: r.n })),
    notes: [
      "Opening strategy and route density charts arrive after map aggregation jobs.",
      "Momentum distribution uses momentum-v1.0 per round when requested.",
    ],
  };
}
