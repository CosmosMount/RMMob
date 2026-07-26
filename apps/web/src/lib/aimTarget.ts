import type { RobotSnapshot } from "@/lib/types";
import { robotNumberLabel } from "@/lib/robotLabel";

/** OfflineRL: no tracked turret — must not use for aiming. */
export const YAW_SENTINEL = -140;
export const TARGET_CONE_DEG = 15;
/** Soft angular temperature (kept for conf); hard pick is nearest in-cone. */
export const TARGET_TAU_DEG = 8;
/** Default max aim range for ground / sentry shooters. */
export const MAX_AIM_RANGE_M = 7;
/** Aerial (无人机/空中) max aim range. */
export const MAX_AIM_RANGE_AERIAL_M = 12;

export function maxAimRangeM(robotType: string): number {
  return robotType === "空中" ? MAX_AIM_RANGE_AERIAL_M : MAX_AIM_RANGE_M;
}

const SHOOTER_TYPES = new Set([
  "英雄",
  "步兵",
  "步兵3",
  "步兵4",
  "哨兵",
  "空中",
]);

const BUILDING_TYPES = new Set(["基地", "前哨站"]);

/**
 * Dataset records buildings at (0,0). Approximate centers from
 * ezthor/rm-battlescope `OBJECTIVE_POSITIONS` (rule-manual canvas).
 */
export const OBJECTIVE_POSITIONS: Record<string, { x: number; y: number }> = {
  "红|基地": { x: 2.46, y: 7.44 },
  "红|前哨站": { x: 10.87, y: 3.58 },
  "蓝|前哨站": { x: 17.12, y: 11.32 },
  "蓝|基地": { x: 25.73, y: 7.44 },
};

export function wrapDeg(a: number): number {
  return ((((a + 180) % 360) + 360) % 360) - 180;
}

export function yawValid(yaw: number | null | undefined): boolean {
  if (yaw == null || !Number.isFinite(yaw)) return false;
  return Math.abs(yaw - YAW_SENTINEL) > 0.5;
}

export function isShooterType(robotType: string): boolean {
  return SHOOTER_TYPES.has(robotType);
}

export function isBuildingType(robotType: string): boolean {
  return BUILDING_TYPES.has(robotType);
}

/** World-frame muzzle tip (OfflineRL: tip = pos + (cos θ, sin θ)·len). */
export function muzzleTipWorld(
  x: number,
  y: number,
  yawDeg: number,
  lenMeters: number
): { x: number; y: number } {
  const a = (yawDeg * Math.PI) / 180;
  return {
    x: x + Math.cos(a) * lenMeters,
    y: y + Math.sin(a) * lenMeters,
  };
}

export function bearingDeg(fromX: number, fromY: number, toX: number, toY: number): number {
  return (Math.atan2(toY - fromY, toX - fromX) * 180) / Math.PI;
}

export function posKnown(x: number | null | undefined, y: number | null | undefined): boolean {
  if (x == null || y == null) return false;
  return Math.abs(x) > 1e-6 || Math.abs(y) > 1e-6;
}

/** Prefer tracked coords; for buildings fall back to canvas-calibrated centers. */
export function resolveAimPos(
  r: RobotSnapshot
): { x: number; y: number } | null {
  if (posKnown(r.x, r.y)) return { x: r.x!, y: r.y! };
  if (isBuildingType(r.robot_type)) {
    const hit = OBJECTIVE_POSITIONS[`${r.team}|${r.robot_type}`];
    if (hit) return hit;
  }
  return null;
}

export function isAliveTarget(r: RobotSnapshot): boolean {
  if (!resolveAimPos(r)) return false;
  if (r.hp != null && r.hp <= 0) return false;
  if (r.status === "destroyed") return false;
  return true;
}

export type AimLink = {
  shooterId: string;
  shooterTeam: string;
  targetId: string;
  targetType: string;
  targetLabel: string;
  errorDeg: number;
  conf: number;
  firing: boolean;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

function targetLabel(r: RobotSnapshot): string {
  if (r.robot_type === "基地") return "基地";
  if (r.robot_type === "前哨站") return "前哨";
  const n = robotNumberLabel(r.robot_id);
  return `${r.robot_type.replace(/^步兵/, "步")}${n}`;
}

/**
 * Aim target inside muzzle cone: alive only, within per-type max range
 * (空中 12 m / others 7 m), hard pick = nearest Euclidean distance.
 */
export function inferAimTarget(
  shooter: RobotSnapshot,
  candidates: RobotSnapshot[]
): Omit<AimLink, "firing"> | null {
  if (!isShooterType(shooter.robot_type)) return null;
  if (!yawValid(shooter.orientation)) return null;
  const from = resolveAimPos(shooter);
  if (!from) return null;
  if ((shooter.hp ?? 1) <= 0) return null;

  const sx = from.x;
  const sy = from.y;
  const yaw = shooter.orientation!;
  const maxRange = maxAimRangeM(shooter.robot_type);

  type Cand = {
    r: RobotSnapshot;
    err: number;
    dist: number;
    pos: { x: number; y: number };
  };
  const inside: Cand[] = [];
  for (const c of candidates) {
    if (c.robot_id === shooter.robot_id) continue;
    if (c.team === shooter.team) continue;
    // Dead / missing pos → not a candidate (no target if none remain)
    if (!isAliveTarget(c)) continue;
    const pos = resolveAimPos(c);
    if (!pos) continue;
    const dist = Math.hypot(pos.x - sx, pos.y - sy);
    if (dist > maxRange) continue;
    const err = Math.abs(wrapDeg(bearingDeg(sx, sy, pos.x, pos.y) - yaw));
    if (err < TARGET_CONE_DEG) inside.push({ r: c, err, dist, pos });
  }
  if (!inside.length) return null;

  inside.sort((a, b) => a.dist - b.dist || a.err - b.err);
  const pick = inside[0]!;
  // conf: nearer + tighter-aligned → higher (UI opacity)
  const rangeFactor = 1 - pick.dist / maxRange;
  const coneFactor = 1 - pick.err / TARGET_CONE_DEG;
  const conf = Math.max(0.15, Math.min(1, 0.55 * rangeFactor + 0.45 * coneFactor));

  return {
    shooterId: shooter.robot_id,
    shooterTeam: shooter.team,
    targetId: pick.r.robot_id,
    targetType: pick.r.robot_type,
    targetLabel: targetLabel(pick.r),
    errorDeg: pick.err,
    conf,
    fromX: sx,
    fromY: sy,
    toX: pick.pos.x,
    toY: pick.pos.y,
  };
}

export function isFiring(prev: RobotSnapshot | undefined, curr: RobotSnapshot): boolean {
  if (!prev) return false;
  const d17 = (curr.ammo_17 ?? 0) - (prev.ammo_17 ?? 0);
  const d42 = (curr.ammo_42 ?? 0) - (prev.ammo_42 ?? 0);
  return d17 > 0.5 || d42 > 0.5;
}

/** All aim links for the current frame. */
export function inferAimLinks(
  robots: RobotSnapshot[],
  prevById?: Map<string, RobotSnapshot> | Record<string, RobotSnapshot> | null
): AimLink[] {
  const prevMap =
    prevById instanceof Map
      ? prevById
      : prevById
        ? new Map(Object.entries(prevById))
        : null;

  const links: AimLink[] = [];
  for (const s of robots) {
    const base = inferAimTarget(s, robots);
    if (!base) continue;
    const prev = prevMap?.get(s.robot_id);
    links.push({
      ...base,
      firing: isFiring(prev, s),
    });
  }
  return links;
}

export function robotsToMap(robots: RobotSnapshot[]): Map<string, RobotSnapshot> {
  return new Map(robots.map((r) => [r.robot_id, r]));
}
