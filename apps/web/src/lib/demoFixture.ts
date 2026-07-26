import type {
  EventItem,
  HeatmapSample,
  MatchGroup,
  MomentumResponse,
  RobotSnapshot,
  RoundDetail,
  StatBar,
} from "@/lib/types";

export type DemoMeta = {
  title: string;
  description: string;
  match_key: string;
  game_id: string;
  snapshot_step: number;
  duration_sec: number;
  red_school: string;
  blue_school: string;
  region: string;
  note?: string;
};

export type DemoTrajectory = {
  robot_id: string;
  team: string;
  robot_type?: string;
  points: Array<{
    second: number;
    x: number | null;
    y: number | null;
    observed?: boolean;
  }>;
};

export type DemoFixture = {
  meta: DemoMeta;
  match: MatchGroup;
  round: RoundDetail;
  momentum: MomentumResponse;
  events: EventItem[];
  bars: StatBar[];
  trajectories: DemoTrajectory[];
  snapshots: Record<string, RobotSnapshot[]>;
  snapshotStep: number;
};

function basePrefix(): string {
  // next.js injects basePath into asset requests; for fetch use env or empty
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_BASE_PATH) {
    return process.env.NEXT_PUBLIC_BASE_PATH.replace(/\/$/, "");
  }
  return "";
}

async function getJson<T>(file: string): Promise<T> {
  const res = await fetch(`${basePrefix()}/demo-data/${file}`, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Failed to load demo-data/${file}: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function loadDemoFixture(): Promise<DemoFixture> {
  const [meta, match, round, momentum, eventsWrap, stats, trajWrap, snapWrap] =
    await Promise.all([
      getJson<DemoMeta>("meta.json"),
      getJson<MatchGroup>("match.json"),
      getJson<RoundDetail>("round.json"),
      getJson<MomentumResponse>("momentum.json"),
      getJson<{ items: EventItem[] }>("events.json"),
      getJson<{ bars: StatBar[] }>("statistics.json"),
      getJson<{ items: DemoTrajectory[] }>("trajectories.json"),
      getJson<{
        step: number;
        by_second: Record<string, RobotSnapshot[]>;
      }>("snapshots.json"),
    ]);

  return {
    meta,
    match,
    round,
    momentum,
    events: eventsWrap.items,
    bars: stats.bars,
    trajectories: trajWrap.items,
    snapshots: snapWrap.by_second,
    snapshotStep: snapWrap.step || meta.snapshot_step || 1,
  };
}

/** Nearest baked snapshot at or before `second`. */
export function robotsAtSecond(
  snapshots: Record<string, RobotSnapshot[]>,
  second: number,
  step: number
): RobotSnapshot[] | null {
  const aligned = Math.floor(second / step) * step;
  if (snapshots[String(aligned)]) return snapshots[String(aligned)]!;
  // fallback: search downward
  for (let s = aligned; s >= 0; s -= step) {
    const hit = snapshots[String(s)];
    if (hit) return hit;
  }
  const keys = Object.keys(snapshots)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (!keys.length) return null;
  return snapshots[String(keys[0]!)] ?? null;
}

export function heatSamplesFromTrajectories(
  trajectories: DemoTrajectory[],
  opts: {
    endSecond: number;
    team?: string | null;
    robotId?: string | null;
  }
): HeatmapSample[] {
  const { endSecond, team, robotId } = opts;
  const samples: HeatmapSample[] = [];
  for (const tr of trajectories) {
    if (robotId && tr.robot_id !== robotId) continue;
    if (team && tr.team !== team) continue;
    for (const p of tr.points) {
      if (p.second > endSecond) break;
      if (p.x == null || p.y == null) continue;
      samples.push({ x: p.x, y: p.y, weight: 1 });
    }
  }
  // Cap for canvas performance on Pages
  if (samples.length > 40000) {
    const stride = Math.ceil(samples.length / 40000);
    return samples.filter((_, i) => i % stride === 0);
  }
  return samples;
}
