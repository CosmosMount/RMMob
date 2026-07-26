/**
 * Export one match round into public/demo-data for the GitHub Pages demo.
 *
 * Usage:
 *   npx tsx scripts/export-demo.ts
 *   npx tsx scripts/export-demo.ts --game-id=1779323658229
 *   npx tsx scripts/export-demo.ts --snapshot-step=2
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { getStatistics, getRoundDetail, listEvents } from "../src/server/rounds";
import { getMatchGroup, getRoundByGameId, listMatches } from "../src/server/matches";
import { computeMomentum } from "../src/server/momentum";
import { getTrajectory, listRobotIds } from "../src/server/viz";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "..", "public", "demo-data");

function arg(name: string, fallback?: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1]!.startsWith("--")) {
    return process.argv[idx + 1];
  }
  return fallback;
}

function pickGameId(explicit?: string): string {
  if (explicit) return explicit;
  const { items } = listMatches({ limit: 80 });
  let best: { gameId: string; score: number } | null = null;
  for (const g of items) {
    for (const r of g.rounds) {
      const dur = r.duration_sec ?? 0;
      if (dur < 180 || dur > 600) continue;
      // Prefer mid-length games with a winner
      const score = (r.winner ? 100 : 0) + Math.min(dur, 420);
      if (!best || score > best.score) {
        best = { gameId: r.game_id, score };
      }
    }
  }
  if (best) return best.gameId;
  const fallback = items[0]?.rounds[0]?.game_id;
  if (!fallback) throw new Error("No matches found in SQLite");
  return fallback;
}

function writeJson(file: string, data: unknown) {
  fs.writeFileSync(path.join(OUT_DIR, file), JSON.stringify(data), "utf-8");
}

async function main() {
  const gameId = pickGameId(arg("game-id"));
  const step = Math.max(1, Number(arg("snapshot-step", "1")) || 1);

  const row = getRoundByGameId(gameId);
  if (!row) throw new Error(`Round not found: ${gameId}`);
  const matchKey = `${row.region}|${row.match_no}|${row.red_school}|${row.blue_school}`;
  const group = getMatchGroup(matchKey);
  if (!group) throw new Error(`Match group not found: ${matchKey}`);

  const detail0 = getRoundDetail(gameId);
  if (!detail0) throw new Error(`Round detail failed: ${gameId}`);
  const duration = detail0.duration_sec;

  console.log(`Exporting game ${gameId} (${group.red_school} vs ${group.blue_school}, ${duration}s)`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const momentum = computeMomentum(gameId);
  const events = listEvents(gameId, { limit: 2000 });
  const statistics = getStatistics(gameId);

  const robots = listRobotIds(gameId);
  const trajectories = [];
  for (const r of robots) {
    const tr = getTrajectory(gameId, r.robot_id);
    if (!tr) continue;
    trajectories.push({
      robot_id: r.robot_id,
      team: r.team,
      robot_type: r.robot_type,
      points: tr.points.map((p) => ({
        second: p.second,
        x: p.x,
        y: p.y,
        observed: p.observed,
      })),
    });
  }

  const snapshots: Record<string, typeof detail0.robots> = {};
  const endDetail = getRoundDetail(gameId, duration, true);
  const distanceMap = Object.fromEntries(
    (endDetail?.robots || detail0.robots).map((r) => [r.robot_id, r.distance])
  );

  for (let s = 0; s <= duration; s += step) {
    const d = getRoundDetail(gameId, s, false);
    if (!d) continue;
    snapshots[String(s)] = d.robots.map((r) => ({
      ...r,
      distance: distanceMap[r.robot_id] ?? r.distance,
    }));
  }
  // Always include final second
  if (!snapshots[String(duration)]) {
    const d = getRoundDetail(gameId, duration, false);
    if (d) {
      snapshots[String(duration)] = d.robots.map((r) => ({
        ...r,
        distance: distanceMap[r.robot_id] ?? r.distance,
      }));
    }
  }

  const meta = {
    title: "RMMob Match Demo",
    description: `${group.red_school} vs ${group.blue_school} · ${group.region} · 第${group.match_no}场`,
    match_key: matchKey,
    game_id: gameId,
    snapshot_step: step,
    duration_sec: duration,
    red_school: group.red_school,
    blue_school: group.blue_school,
    region: group.region,
    exported_at: new Date().toISOString(),
    note: "Static fixture for GitHub Pages. No live API.",
  };

  writeJson("meta.json", meta);
  writeJson("match.json", group);
  writeJson("momentum.json", momentum);
  writeJson("events.json", { game_id: gameId, items: events.items });
  writeJson("statistics.json", statistics);
  writeJson("trajectories.json", { game_id: gameId, items: trajectories });
  writeJson("snapshots.json", {
    game_id: gameId,
    step,
    duration_sec: duration,
    by_second: snapshots,
  });
  // Initial round detail for header / quick stats shell
  writeJson("round.json", {
    ...detail0,
    robots: snapshots["0"] || snapshots[String(Object.keys(snapshots).map(Number).sort((a, b) => a - b)[0]!)] || detail0.robots,
  });

  const sizes = fs.readdirSync(OUT_DIR).map((f) => {
    const n = fs.statSync(path.join(OUT_DIR, f)).size;
    return `${f}: ${(n / 1024 / 1024).toFixed(2)} MB`;
  });
  console.log("Wrote", OUT_DIR);
  console.log(sizes.join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
