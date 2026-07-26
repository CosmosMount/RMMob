import type { MomentumPoint, MomentumResponse } from "@/lib/types";
import { fetchAll } from "./db";
import { col } from "./sqlMap";

const MODEL_VERSION = "momentum-v1.2";
const BUILDINGS = new Set(["基地", "前哨站"]);
/** Field midline (m). */
const FIELD_MID_X = 14;
/** Clip per-robot Δx (m/s) so teleport/dropouts don't dominate. */
const MOVE_DX_CLIP = 2.5;

type TeamScore = {
  hp: number;
  damage: number;
  economy: number;
  position: number;
  movement: number;
  objective: number;
  shooting: number;
};

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

function sumScore(p: TeamScore): number {
  return (
    p.hp + p.damage + p.economy + p.position + p.movement + p.objective + p.shooting
  );
}

/** Midline closeness in [0, ~1.4]: nearer mid → higher. */
function midClose(meanX: number | null): number {
  if (meanX == null || !Number.isFinite(meanX)) return 0;
  return (FIELD_MID_X - Math.abs(meanX - FIELD_MID_X)) / 10;
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

function ema(series: number[], alpha: number): number[] {
  const out = new Array(series.length).fill(0);
  for (let t = 0; t < series.length; t++) {
    out[t] = t === 0 ? series[t]! : alpha * series[t]! + (1 - alpha) * out[t - 1]!;
  }
  return out;
}

function robustBound(series: number[]): number[] {
  const med = median(series);
  const mad = median(series.map((v) => Math.abs(v - med))) + 1e-6;
  return series.map((v) => {
    const z = (v - med) / (1.4826 * mad);
    return Math.max(-3, Math.min(3, z));
  });
}

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
  const redRaw = new Array(duration + 1).fill(0);
  const blueRaw = new Array(duration + 1).fill(0);
  const contribs: Record<string, number>[] = [];
  const prevPos = new Map<string, { x: number; y: number; team: string }>();

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

    const redXs: number[] = [];
    const blueXs: number[] = [];
    let redPush = 0;
    let bluePush = 0;
    let redMoveN = 0;
    let blueMoveN = 0;

    for (const r of rows) {
      const team = String(r.team || "");
      const rtype = String(r.robot_type || "");
      if (BUILDINGS.has(rtype)) continue;
      if (r.x == null) continue;
      const x = Number(r.x);
      const y = r.y == null ? 0 : Number(r.y);
      if (Math.abs(x) < 1e-6 && Math.abs(y) < 1e-6) continue;

      if (team === "红") redXs.push(x);
      else if (team === "蓝") blueXs.push(x);

      const prev = prevPos.get(String(r.robot_id));
      if (prev && prev.team === team) {
        const dx = Math.max(-MOVE_DX_CLIP, Math.min(MOVE_DX_CLIP, x - prev.x));
        if (team === "红") {
          redPush += dx;
          redMoveN += 1;
        } else if (team === "蓝") {
          bluePush += -dx;
          blueMoveN += 1;
        }
      }
      prevPos.set(String(r.robot_id), { x, y, team });
    }

    const redMeanPush = redMoveN ? redPush / redMoveN : 0;
    const blueMeanPush = blueMoveN ? bluePush / blueMoveN : 0;
    const redMeanX = redXs.length ? mean(redXs) : null;
    const blueMeanX = blueXs.length ? mean(blueXs) : null;

    const redScore: TeamScore = {
      hp: 0.3 * redHp,
      damage: 0.22 * (redDmg[t]! / 200),
      economy: 0.08 * (redGold / 500),
      position: 0.18 * midClose(redMeanX),
      movement: 0.12 * (redMeanPush / 1.5),
      objective: 0.08 * redObj,
      shooting: 0.02 * (redAmmo / 200),
    };
    const blueScore: TeamScore = {
      hp: 0.3 * blueHp,
      damage: 0.22 * (blueDmg[t]! / 200),
      economy: 0.08 * (blueGold / 500),
      position: 0.18 * midClose(blueMeanX),
      movement: 0.12 * (blueMeanPush / 1.5),
      objective: 0.08 * blueObj,
      shooting: 0.02 * (blueAmmo / 200),
    };

    redRaw[t] = sumScore(redScore);
    blueRaw[t] = sumScore(blueScore);

    const parts = {
      hp: redScore.hp - blueScore.hp,
      damage: redScore.damage - blueScore.damage,
      economy: redScore.economy - blueScore.economy,
      position: redScore.position - blueScore.position,
      movement: redScore.movement - blueScore.movement,
      resource: 0,
      objective: redScore.objective - blueScore.objective,
      shooting: redScore.shooting - blueScore.shooting,
    };
    raw[t] = redRaw[t]! - blueRaw[t]!;
    contribs.push(parts);
  }

  const alpha = 0.2;
  const bounded = robustBound(raw);
  const smoothed = ema(bounded, alpha);

  // Per-team strength sharing one scale so both sides stay visible
  const teamPool = [...redRaw, ...blueRaw];
  const teamMed = median(teamPool);
  const teamMad = median(teamPool.map((v) => Math.abs(v - teamMed))) + 1e-6;
  const redBound = redRaw.map((v) => {
    const z = (v - teamMed) / (1.4826 * teamMad);
    return Math.max(0, Math.min(3, z + 1.5));
  });
  const blueBound = blueRaw.map((v) => {
    const z = (v - teamMed) / (1.4826 * teamMad);
    return Math.max(0, Math.min(3, z + 1.5));
  });
  const redSmoothed = ema(redBound, alpha);
  const blueSmoothed = ema(blueBound, alpha);

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
      red_smoothed: redSmoothed[t]!,
      blue_smoothed: blueSmoothed[t]!,
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
