import type {
  EventItem,
  RobotSnapshot,
  RoundDetail,
  StatBar,
  StatisticsResponse,
} from "@/lib/types";
import type { SQLInputValue } from "node:sqlite";
import { fetchAll } from "./db";
import { getMatchGroup, getRoundByGameId } from "./matches";
import { col } from "./sqlMap";

const BUILDINGS = new Set(["基地", "前哨站"]);

function matchKeyFromRow(row: {
  region: string;
  match_no: number;
  red_school: string;
  blue_school: string;
}): string {
  return `${row.region}|${row.match_no}|${row.red_school}|${row.blue_school}`;
}

function f(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function distanceForRobot(gameId: string, robotId: string): number {
  const rows = fetchAll<{ x: number; y: number }>(
    `
    SELECT ${col("x")} AS x, ${col("y")} AS y
    FROM timeseries
    WHERE ${col("game_id")} = ? AND ${col("robot_id")} = ?
      AND ${col("x")} IS NOT NULL AND ${col("y")} IS NOT NULL
    ORDER BY ${col("second")}
    `,
    [gameId, robotId]
  );
  let dist = 0;
  let prev: [number, number] | null = null;
  for (const r of rows) {
    const pt: [number, number] = [Number(r.x), Number(r.y)];
    if (prev) dist += Math.hypot(pt[0] - prev[0], pt[1] - prev[1]);
    prev = pt;
  }
  return dist;
}

function damageTakenMap(gameId: string): Record<string, number> {
  const rows = fetchAll<{ rid: string; dmg: number }>(
    `
    SELECT ${col("robot_id")} AS rid, SUM(COALESCE(${col("value")}, 0)) AS dmg
    FROM events
    WHERE ${col("game_id")} = ? AND ${col("event_type")} = ?
    GROUP BY ${col("robot_id")}
    `,
    [gameId, "受击"]
  );
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (r.rid != null) out[String(r.rid)] = Number(r.dmg || 0);
  }
  return out;
}

export function getRoundDetail(
  gameId: string,
  atSecond?: number | null,
  includeDistance?: boolean | null
): RoundDetail | null {
  const row = getRoundByGameId(gameId);
  if (!row) return null;
  const matchKey = matchKeyFromRow(row);
  const group = getMatchGroup(matchKey);
  const duration = Number(row.duration_sec || 0);
  let second = atSecond == null ? duration : Math.max(0, Math.min(atSecond, duration));
  if (includeDistance == null) includeDistance = atSecond == null;

  let robotsRows = fetchAll<Record<string, unknown>>(
    `
    SELECT
      t.${col("robot_id")} AS robot_id,
      t.${col("robot_type")} AS robot_type,
      t.${col("team")} AS team,
      t.${col("school")} AS school,
      t.${col("hp")} AS hp,
      t.${col("hp_max")} AS hp_max,
      t.${col("x")} AS x,
      t.${col("y")} AS y,
      t.${col("z")} AS z,
      t.${col("orientation")} AS orientation,
      t.${col("ammo_17")} AS ammo_17,
      t.${col("ammo_42")} AS ammo_42,
      t.${col("gold_total")} AS gold_total,
      t.${col("gold_remain")} AS gold_remain,
      t.${col("vulnerable")} AS vulnerable
    FROM timeseries t
    INNER JOIN (
      SELECT ${col("robot_id")} AS rid, MAX(${col("second")}) AS mx
      FROM timeseries
      WHERE ${col("game_id")} = ? AND ${col("second")} <= ?
      GROUP BY ${col("robot_id")}
    ) m ON t.${col("robot_id")} = m.rid AND t.${col("second")} = m.mx
    WHERE t.${col("game_id")} = ?
    `,
    [gameId, second, gameId]
  );

  if (!robotsRows.length && second === 0) {
    const first = fetchAll<{ mn: number | null }>(
      `SELECT MIN(${col("second")}) AS mn FROM timeseries WHERE ${col("game_id")} = ?`,
      [gameId]
    );
    const mn = first[0]?.mn;
    if (mn != null && Number(mn) > 0) {
      return getRoundDetail(gameId, Number(mn), includeDistance);
    }
  }

  const dmg = damageTakenMap(gameId);
  const robots: RobotSnapshot[] = [];
  for (const r of robotsRows) {
    const rid = String(r.robot_id);
    const rtype = String(r.robot_type || "");
    const team = String(r.team || "");
    const hp = f(r.hp);
    const hpMax = f(r.hp_max);
    let status: RobotSnapshot["status"] = "active";
    if (BUILDINGS.has(rtype)) status = "building";
    else if (hp != null && hp <= 0) status = "destroyed";
    else if (rtype === "空中" && hp == null) status = "not_deployed";

    robots.push({
      robot_id: rid,
      robot_type: rtype,
      team,
      school: String(r.school || ""),
      hp,
      hp_max: hpMax,
      x: f(r.x),
      y: f(r.y),
      orientation: f(r.orientation),
      ammo_17: f(r.ammo_17),
      ammo_42: f(r.ammo_42),
      gold_remain: f(r.gold_remain),
      vulnerable: Number(r.vulnerable || 0),
      damage_dealt: Math.abs(Number(dmg[rid] || 0)),
      distance: includeDistance ? Math.round(distanceForRobot(gameId, rid) * 100) / 100 : 0,
      status,
    });
  }

  const redHp = robots
    .filter((x) => x.team === "红" && !BUILDINGS.has(x.robot_type))
    .reduce((s, x) => s + (x.hp || 0), 0);
  const blueHp = robots
    .filter((x) => x.team === "蓝" && !BUILDINGS.has(x.robot_type))
    .reduce((s, x) => s + (x.hp || 0), 0);
  const redAlive = robots.filter(
    (x) => x.team === "红" && !BUILDINGS.has(x.robot_type) && (x.hp || 0) > 0
  ).length;
  const blueAlive = robots.filter(
    (x) => x.team === "蓝" && !BUILDINGS.has(x.robot_type) && (x.hp || 0) > 0
  ).length;
  const redGold =
    robots.find((x) => x.team === "红" && x.gold_remain != null)?.gold_remain ?? null;
  const blueGold =
    robots.find((x) => x.team === "蓝" && x.gold_remain != null)?.gold_remain ?? null;

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
    duration_sec: duration,
    match_key: matchKey,
    sibling_rounds: group?.rounds ?? [],
    red_wins: group?.red_wins ?? 0,
    blue_wins: group?.blue_wins ?? 0,
    robots,
    quick_stats: {
      red_hp: redHp,
      blue_hp: blueHp,
      red_alive: redAlive,
      blue_alive: blueAlive,
      red_gold: redGold,
      blue_gold: blueGold,
      at_second: second,
    },
  };
}

export function listEvents(
  gameId: string,
  opts: {
    team?: string | null;
    robot_type?: string | null;
    collapse_shots?: boolean;
    limit?: number;
  } = {}
): { game_id: string; total: number; items: EventItem[] } {
  const { team, robot_type, collapse_shots = true, limit = 500 } = opts;
  const clauses = [`${col("game_id")} = ?`];
  const params: SQLInputValue[] = [gameId];
  if (team) {
    clauses.push(`${col("team")} = ?`);
    params.push(team);
  }
  if (robot_type) {
    clauses.push(`${col("robot_type")} = ?`);
    params.push(robot_type);
  }

  const rows = fetchAll<Record<string, unknown>>(
    `
    SELECT
      ${col("second")} AS second,
      ${col("event_type")} AS event_type,
      ${col("robot_id")} AS robot_id,
      ${col("robot_type")} AS robot_type,
      ${col("team")} AS team,
      ${col("school")} AS school,
      ${col("target_robot_id")} AS target_robot_id,
      ${col("target_type")} AS target_type,
      ${col("category")} AS category,
      ${col("value")} AS value,
      ${col("note")} AS note
    FROM events
    WHERE ${clauses.join(" AND ")}
    ORDER BY ${col("second")}, ${col("event_type")}
    `,
    params
  );

  const major = new Set(["飞镖命中", "能量机关", "装配成功", "雷达反制UAV", "飞镖闸门开", "增益"]);
  const items: EventItem[] = [];
  const shotBucket = new Map<string, number>();

  for (const r of rows) {
    const et = String(r.event_type);
    if (collapse_shots && et === "发弹") {
      const key = `${Number(r.second)}|${String(r.robot_id)}|${String(r.category || "")}`;
      shotBucket.set(key, (shotBucket.get(key) || 0) + 1);
      continue;
    }
    let importance: EventItem["importance"] =
      major.has(et) || (et === "受击" && Number(r.value || 0) >= 50) ? "major" : "minor";
    if (et === "受击" && Number(r.value || 0) >= 100) importance = "major";
    items.push({
      second: Number(r.second),
      event_type: et,
      robot_id: r.robot_id != null ? String(r.robot_id) : null,
      robot_type: r.robot_type != null ? String(r.robot_type) : null,
      team: r.team != null ? String(r.team) : null,
      category: r.category != null ? String(r.category) : null,
      value: f(r.value),
      note: r.note != null ? String(r.note) : null,
      importance,
    });
  }

  for (const [key, count] of [...shotBucket.entries()].sort()) {
    const [sec, rid, cat] = key.split("|");
    items.push({
      second: Number(sec),
      event_type: "发弹",
      robot_id: rid,
      robot_type: null,
      team: null,
      category: cat || null,
      value: count,
      note: `${count} shots collapsed`,
      importance: "minor",
    });
  }
  items.sort((a, b) => a.second - b.second || a.event_type.localeCompare(b.event_type));
  const sliced = items.slice(0, limit);
  return { game_id: gameId, total: sliced.length, items: sliced };
}

export function getStatistics(gameId: string): StatisticsResponse {
  const detail = getRoundDetail(gameId);
  if (!detail) return { game_id: gameId, bars: [] };

  const side = (team: string, pred: (r: RobotSnapshot) => number) =>
    detail.robots.filter((r) => r.team === team).reduce((s, r) => s + pred(r), 0);

  const redDealt = Math.abs(side("蓝", (r) => r.damage_dealt));
  const blueDealt = Math.abs(side("红", (r) => r.damage_dealt));

  const bars: StatBar[] = [
    { metric: "damage_dealt", label: "造成伤害", red: redDealt, blue: blueDealt },
    {
      metric: "ammo_17",
      label: "17mm 发弹",
      red: side("红", (r) => r.ammo_17 || 0),
      blue: side("蓝", (r) => r.ammo_17 || 0),
    },
    {
      metric: "ammo_42",
      label: "42mm 发弹",
      red: side("红", (r) => r.ammo_42 || 0),
      blue: side("蓝", (r) => r.ammo_42 || 0),
    },
    {
      metric: "remaining_hp",
      label: "剩余血量",
      red: side("红", (r) => (!BUILDINGS.has(r.robot_type) ? r.hp || 0 : 0)),
      blue: side("蓝", (r) => (!BUILDINGS.has(r.robot_type) ? r.hp || 0 : 0)),
    },
    {
      metric: "distance",
      label: "移动距离",
      red: side("红", (r) => r.distance),
      blue: side("蓝", (r) => r.distance),
    },
    {
      metric: "gold_remain",
      label: "剩余金币",
      red: Number(detail.quick_stats.red_gold || 0),
      blue: Number(detail.quick_stats.blue_gold || 0),
    },
  ];
  return { game_id: gameId, bars };
}
