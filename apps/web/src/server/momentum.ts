import type { MomentumPoint, MomentumResponse } from "@/lib/types";
import { fetchAll } from "./db";
import { col } from "./sqlMap";

const MODEL_VERSION = "momentum-v1.0";
const BUILDINGS = new Set(["基地", "前哨站"]);

type TsRow = {
  second: number;
  robot_id: string;
  robot_type: string | null;
  team: string | null;
  hp: number | null;
  hp_max: number | null;
  x: number | null;
  y: number | null;
  gold_remain: number | null;
  ammo_17: number | null;
  ammo_42: number | null;
  vulnerable: number | null;
};

function seriesBySecond(gameId: string): Map<number, TsRow[]> {
  const rows = fetchAll<TsRow>(
    `
    SELECT
      ${col("second")} AS second,
      ${col("robot_id")} AS robot_id,
      ${col("robot_type")} AS robot_type,
      ${col("team")} AS team,
      ${col("hp")} AS hp,
      ${col("hp_max")} AS hp_max,
      ${col("x")} AS x,
      ${col("y")} AS y,
      ${col("gold_remain")} AS gold_remain,
      ${col("ammo_17")} AS ammo_17,
      ${col("ammo_42")} AS ammo_42,
      ${col("vulnerable")} AS vulnerable
    FROM timeseries
    WHERE ${col("game_id")} = ?
    ORDER BY ${col("second")}
    `,
    [gameId]
  );
  const bySec = new Map<number, TsRow[]>();
  for (const r of rows) {
    const s = Number(r.second);
    if (!bySec.has(s)) bySec.set(s, []);
    bySec.get(s)!.push(r);
  }
  return bySec;
}

function eventsPressure(gameId: string, duration: number): { red: number[]; blue: number[] } {
  const rows = fetchAll<{ second: number; team: string | null; value: number | null }>(
    `
    SELECT ${col("second")} AS second, ${col("team")} AS team, ${col("value")} AS value,
           ${col("event_type")} AS event_type
    FROM events
    WHERE ${col("game_id")} = ? AND ${col("event_type")} IN (?, ?)
    `,
    [gameId, "受击", "飞镖命中"]
  );
  const redP = new Array(duration + 1).fill(0);
  const blueP = new Array(duration + 1).fill(0);
  for (const r of rows) {
    const sec = Number(r.second);
    if (sec < 0 || sec > duration) continue;
    const val = Number(r.value ?? 10);
    const team = String(r.team || "");
    if (team === "红") blueP[sec] += val;
    else if (team === "蓝") redP[sec] += val;
  }
  const decay = 0.92;
  const redAcc = new Array(duration + 1).fill(0);
  const blueAcc = new Array(duration + 1).fill(0);
  for (let t = 0; t <= duration; t++) {
    redAcc[t] = (t ? redAcc[t - 1] * decay : 0) + redP[t];
    blueAcc[t] = (t ? blueAcc[t - 1] * decay : 0) + blueP[t];
  }
  return { red: redAcc, blue: blueAcc };
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function computeMomentum(gameId: string): MomentumResponse {
  const bySec = seriesBySecond(gameId);
  if (!bySec.size) {
    return {
      game_id: gameId,
      model_version: MODEL_VERSION,
      points: [],
    };
  }
  const duration = Math.max(...bySec.keys());
  const { red: redDmg, blue: blueDmg } = eventsPressure(gameId, duration);

  const raw = new Array(duration + 1).fill(0);
  const contribs: Record<string, number>[] = [];

  for (let t = 0; t <= duration; t++) {
    let rows = bySec.get(t);
    if (!rows) {
      let best = 0;
      for (const s of bySec.keys()) {
        if (s <= t && s >= best) best = s;
      }
      rows = bySec.get(best) || [];
    }

    let redHp = 0;
    let blueHp = 0;
    let redGold = 0;
    let blueGold = 0;
    let redObj = 0;
    let blueObj = 0;
    let redAmmo = 0;
    let blueAmmo = 0;

    for (const r of rows) {
      const team = String(r.team || "");
      const rtype = String(r.robot_type || "");
      const hp = Number(r.hp || 0);
      const hpMax = Number(r.hp_max || 1) || 1;
      const ratio = hp / hpMax;
      if (BUILDINGS.has(rtype)) {
        if (team === "红") redObj += ratio;
        else if (team === "蓝") blueObj += ratio;
        continue;
      }
      if (team === "红") {
        redHp += ratio;
        redGold = Number(r.gold_remain ?? redGold);
        redAmmo += Number(r.ammo_17 || 0) + Number(r.ammo_42 || 0);
      } else if (team === "蓝") {
        blueHp += ratio;
        blueGold = Number(r.gold_remain ?? blueGold);
        blueAmmo += Number(r.ammo_17 || 0) + Number(r.ammo_42 || 0);
      }
    }

    const h = redHp - blueHp;
    const d = (redDmg[t]! - blueDmg[t]!) / 200;
    const e = (redGold - blueGold) / 500;
    const g = redObj - blueObj;
    const s = (redAmmo - blueAmmo) / 200;
    const redXs = rows
      .filter(
        (r) =>
          r.team === "红" && r.x != null && !BUILDINGS.has(String(r.robot_type || ""))
      )
      .map((r) => Number(r.x));
    const blueXs = rows
      .filter(
        (r) =>
          r.team === "蓝" && r.x != null && !BUILDINGS.has(String(r.robot_type || ""))
      )
      .map((r) => Number(r.x));
    let p = 0;
    if (redXs.length && blueXs.length) {
      const mid = 14;
      p = -(Math.abs(mean(redXs) - mid) - Math.abs(mean(blueXs) - mid)) / 10;
    }

    const parts = {
      hp: 0.35 * h,
      damage: 0.25 * d,
      economy: 0.1 * e,
      position: 0.1 * p,
      resource: 0,
      objective: 0.1 * g,
      shooting: 0.05 * s,
    };
    raw[t] = Object.values(parts).reduce((a, b) => a + b, 0);
    contribs.push(parts);
  }

  const med = median(raw);
  const mad = median(raw.map((v) => Math.abs(v - med))) + 1e-6;
  const bounded = raw.map((v) => {
    const z = (v - med) / (1.4826 * mad);
    return Math.max(-3, Math.min(3, z));
  });

  const alpha = 0.2;
  const smoothed = new Array(bounded.length).fill(0);
  for (let t = 0; t < bounded.length; t++) {
    smoothed[t] = t === 0 ? bounded[t]! : alpha * bounded[t]! + (1 - alpha) * smoothed[t - 1]!;
  }

  const points: MomentumPoint[] = [];
  for (let t = 0; t < raw.length; t++) {
    const parts = contribs[t]!;
    let dominant: string | null = null;
    let bestAbs = -1;
    for (const [k, v] of Object.entries(parts)) {
      const a = Math.abs(v);
      if (a > bestAbs) {
        bestAbs = a;
        dominant = k;
      }
    }
    if (dominant && Math.abs(parts[dominant]!) < 1e-6) dominant = null;
    points.push({
      second: t,
      raw: raw[t]!,
      bounded: bounded[t]!,
      smoothed: smoothed[t]!,
      dominant_factor: dominant,
      contributions: { ...parts },
    });
  }

  return {
    game_id: gameId,
    model_version: MODEL_VERSION,
    points,
  };
}
