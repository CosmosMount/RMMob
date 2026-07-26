import type { HeatmapResponse, HeatmapSample, TrajectoryResponse } from "@/lib/types";
import type { SQLInputValue } from "node:sqlite";
import { fetchAll } from "./db";
import { col } from "./sqlMap";

const BOUNDS = { xMin: 0, xMax: 28, yMin: 0, yMax: 15 };
const HEATMAP_MODEL = "ladder-grid-fotmob-blob-v1";
const BUILDINGS = new Set(["基地", "前哨站"]);

export function getTrajectory(
  gameId: string,
  robotId: string,
  opts: { start?: number | null; end?: number | null } = {}
): TrajectoryResponse | null {
  const { start, end } = opts;
  const clauses = [`${col("game_id")} = ?`, `${col("robot_id")} = ?`];
  const params: SQLInputValue[] = [gameId, robotId];
  if (start != null) {
    clauses.push(`${col("second")} >= ?`);
    params.push(start);
  }
  if (end != null) {
    clauses.push(`${col("second")} <= ?`);
    params.push(end);
  }

  const rows = fetchAll<Record<string, unknown>>(
    `
    SELECT
      ${col("second")} AS second,
      ${col("x")} AS x,
      ${col("y")} AS y,
      ${col("z")} AS z,
      ${col("hp")} AS hp,
      ${col("orientation")} AS orientation,
      ${col("team")} AS team,
      ${col("robot_type")} AS robot_type
    FROM timeseries
    WHERE ${clauses.join(" AND ")}
    ORDER BY ${col("second")}
    `,
    params
  );
  if (!rows.length) return null;

  const points: TrajectoryResponse["points"] = [];
  let dist = 0;
  let prev: [number, number] | null = null;
  for (const r of rows) {
    const x = r.x != null ? Number(r.x) : null;
    const y = r.y != null ? Number(r.y) : null;
    const observed = x != null && y != null;
    if (observed && prev) dist += Math.hypot(x! - prev[0], y! - prev[1]);
    if (observed) prev = [x!, y!];
    else prev = null;
    points.push({
      second: Number(r.second),
      x,
      y,
      observed,
    });
  }

  return {
    game_id: gameId,
    robot_id: robotId,
    team: String(rows[0]!.team || ""),
    robot_type: String(rows[0]!.robot_type || ""),
    points,
    estimated_distance_2d: Math.round(dist * 1000) / 1000,
  };
}

export function listRobotIds(
  gameId: string,
  opts: { team?: string | null; robot_type?: string | null } = {}
): Array<{ robot_id: string; team: string; robot_type: string }> {
  const { team, robot_type } = opts;
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
  const rows = fetchAll<{ robot_id: string; team: string | null; robot_type: string | null }>(
    `
    SELECT DISTINCT
      ${col("robot_id")} AS robot_id,
      ${col("team")} AS team,
      ${col("robot_type")} AS robot_type
    FROM timeseries
    WHERE ${clauses.join(" AND ")}
    `,
    params
  );
  return rows
    .filter((r) => !BUILDINGS.has(String(r.robot_type || "")))
    .map((r) => ({
      robot_id: String(r.robot_id),
      team: String(r.team || ""),
      robot_type: String(r.robot_type || ""),
    }));
}

export function getHeatmap(
  gameId: string,
  opts: {
    metric?: string;
    team?: string | null;
    robot_type?: string | null;
    robot_id?: string | null;
    start?: number | null;
    end?: number | null;
  } = {}
): HeatmapResponse {
  const {
    metric = "movement",
    team,
    robot_type,
    robot_id,
    start,
    end,
  } = opts;

  const clauses = [
    `${col("game_id")} = ?`,
    `${col("x")} IS NOT NULL`,
    `${col("y")} IS NOT NULL`,
    `${col("robot_type")} NOT IN ('基地', '前哨站')`,
  ];
  const params: SQLInputValue[] = [gameId];
  if (team) {
    clauses.push(`${col("team")} = ?`);
    params.push(team);
  }
  if (robot_type) {
    clauses.push(`${col("robot_type")} = ?`);
    params.push(robot_type);
  }
  if (robot_id) {
    clauses.push(`${col("robot_id")} = ?`);
    params.push(robot_id);
  }
  if (start != null) {
    clauses.push(`${col("second")} >= ?`);
    params.push(start);
  }
  if (end != null) {
    clauses.push(`${col("second")} <= ?`);
    params.push(end);
  }
  if (metric === "vulnerability") {
    clauses.push(`${col("vulnerable")} = 1`);
  }

  const rows = fetchAll<{ x: number; y: number; second: number; robot_id: string }>(
    `
    SELECT ${col("x")} AS x, ${col("y")} AS y, ${col("second")} AS second,
           ${col("robot_id")} AS robot_id
    FROM timeseries
    WHERE ${clauses.join(" AND ")}
    ORDER BY ${col("second")}
    `,
    params
  );

  const samples: HeatmapSample[] = [];
  if (metric === "shooting") {
    const ev = fetchAll<{ second: number; robot_id: string }>(
      `
      SELECT e.${col("second")} AS second, e.${col("robot_id")} AS robot_id
      FROM events e
      WHERE e.${col("game_id")} = ? AND e.${col("event_type")} = ?
      `,
      [gameId, "发弹"]
    );
    const pos = new Map<string, [number, number]>();
    for (const r of rows) pos.set(`${r.robot_id}|${Number(r.second)}`, [Number(r.x), Number(r.y)]);
    for (const e of ev) {
      const key = `${e.robot_id}|${Number(e.second)}`;
      const xy = pos.get(key);
      if (!xy) continue;
      const [x, y] = xy;
      if (x >= BOUNDS.xMin && x <= BOUNDS.xMax && y >= BOUNDS.yMin && y <= BOUNDS.yMax) {
        samples.push({ x, y, weight: 1 });
      }
    }
  } else if (metric === "damage") {
    const ev = fetchAll<{ second: number; robot_id: string; value: number }>(
      `
      SELECT ${col("second")} AS second, ${col("robot_id")} AS robot_id,
             COALESCE(${col("value")}, 1) AS value
      FROM events
      WHERE ${col("game_id")} = ? AND ${col("event_type")} = ?
      `,
      [gameId, "受击"]
    );
    const pos = new Map<string, [number, number]>();
    for (const r of rows) pos.set(`${r.robot_id}|${Number(r.second)}`, [Number(r.x), Number(r.y)]);
    for (const e of ev) {
      const key = `${e.robot_id}|${Number(e.second)}`;
      const xy = pos.get(key);
      if (!xy) continue;
      const [x, y] = xy;
      if (x >= BOUNDS.xMin && x <= BOUNDS.xMax && y >= BOUNDS.yMin && y <= BOUNDS.yMax) {
        samples.push({ x, y, weight: Math.abs(Number(e.value || 1)) });
      }
    }
  } else {
    for (const r of rows) {
      const x = Number(r.x);
      const y = Number(r.y);
      if (x >= BOUNDS.xMin && x <= BOUNDS.xMax && y >= BOUNDS.yMin && y <= BOUNDS.yMax) {
        samples.push({ x, y, weight: 1 });
      }
    }
  }

  const short = Math.min(BOUNDS.xMax - BOUNDS.xMin, BOUNDS.yMax - BOUNDS.yMin);
  const bandwidth = short / 60;
  const t0 =
    start != null ? start : rows.length ? Math.min(...rows.map((r) => Number(r.second))) : 0;
  const t1 =
    end != null ? end : rows.length ? Math.max(...rows.map((r) => Number(r.second))) : 0;

  return {
    game_id: gameId,
    metric,
    time_range: [t0, t1],
    coordinate_bounds: BOUNDS,
    bandwidth,
    samples: samples.slice(0, 80000),
    model_version: HEATMAP_MODEL,
  };
}
