"use client";

import { useEffect, useMemo, useState } from "react";
import { EventTimeline } from "@/components/match/EventTimeline";
import { MatchBattleHud } from "@/components/match/MatchBattleHud";
import { MatchHeader } from "@/components/match/MatchHeader";
import { QuickStats } from "@/components/match/QuickStats";
import { RobotCards } from "@/components/match/RobotCards";
import { StatisticComparison } from "@/components/match/StatisticComparison";
import { EntityFilter } from "@/components/viz/EntityFilter";
import { MomentumChart } from "@/components/viz/MomentumChart";
import { TacticalMap } from "@/components/viz/TacticalMap";
import { TimeScrubber } from "@/components/viz/TimeScrubber";
import {
  heatSamplesFromTrajectories,
  loadDemoFixture,
  robotsAtSecond,
  type DemoFixture,
  type DemoTrajectory,
} from "@/lib/demoFixture";
import type { RobotSnapshot, RoundDetail } from "@/lib/types";
import { RoundTimeProvider, useRoundTime } from "@/state/roundTime";
import { DEFAULT_BOUNDS } from "@/lib/coords";

const TABS = ["Summary", "Momentum", "Map", "Robots", "Events", "Statistics"] as const;

function positionAt(
  points: DemoTrajectory["points"],
  second: number
): { x: number | null; y: number | null } | null {
  if (!points.length) return null;
  let best = points[0]!;
  for (const p of points) {
    if (p.second > second) break;
    best = p;
  }
  if (best.second > second && points[0]) best = points[0];
  return { x: best.x, y: best.y };
}

function withTrajPositions(
  robots: RobotSnapshot[],
  traj: DemoTrajectory[],
  second: number
): RobotSnapshot[] {
  if (!traj.length) return robots;
  const byId = new Map(traj.map((t) => [t.robot_id, t]));
  return robots.map((r) => {
    const tr = byId.get(r.robot_id);
    if (!tr) return r;
    const pos = positionAt(tr.points, second);
    if (!pos || (pos.x == null && pos.y == null)) return r;
    return { ...r, x: pos.x, y: pos.y };
  });
}

export default function DemoMatchPage() {
  const [fixture, setFixture] = useState<DemoFixture | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDemoFixture()
      .then(setFixture)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div className="panel empty">
        Demo 数据加载失败：{error}
        <div className="muted" style={{ marginTop: 8 }}>
          请先运行 <code>npm run export:demo</code>
        </div>
      </div>
    );
  }
  if (!fixture) return <div className="panel skeleton" style={{ height: 240 }} />;

  return (
    <div className="stack">
      <section className="panel" style={{ padding: "12px 16px" }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
          GitHub Pages Demo · 静态数据 · 无后端
        </div>
        <h1 className="page-title" style={{ fontSize: 18, margin: 0 }}>
          {fixture.meta.description}
        </h1>
      </section>
      <RoundTimeProvider gameId={fixture.meta.game_id} durationSeconds={fixture.meta.duration_sec}>
        <DemoRoundView fixture={fixture} />
      </RoundTimeProvider>
    </div>
  );
}

function DemoRoundView({ fixture }: { fixture: DemoFixture }) {
  const t = useRoundTime();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Summary");
  const [team, setTeam] = useState<string | null>(null);
  const [robotType, setRobotType] = useState<string | null>(null);
  const [selectedRobot, setSelectedRobot] = useState<string | null>(null);
  const [layers, setLayers] = useState({
    heat: true,
    trails: false,
    robots: true,
    aim: true,
  });

  const snapRobots =
    robotsAtSecond(fixture.snapshots, t.currentSecond, fixture.snapshotStep) ||
    fixture.round.robots;

  const prevSnapRobots =
    t.currentSecond > 0
      ? robotsAtSecond(
          fixture.snapshots,
          Math.max(0, t.currentSecond - fixture.snapshotStep),
          fixture.snapshotStep
        )
      : null;

  const detail: RoundDetail = useMemo(() => {
    const robots = snapRobots;
    const BUILDINGS = new Set(["基地", "前哨站"]);
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
      ...fixture.round,
      robots,
      quick_stats: {
        red_hp: redHp,
        blue_hp: blueHp,
        red_alive: redAlive,
        blue_alive: blueAlive,
        red_gold: redGold,
        blue_gold: blueGold,
        at_second: t.currentSecond,
      },
    };
  }, [fixture.round, snapRobots, t.currentSecond]);

  const displayRobots = useMemo(
    () => withTrajPositions(detail.robots, fixture.trajectories, t.currentSecond),
    [detail.robots, fixture.trajectories, t.currentSecond]
  );

  const heatEnd = t.isPlaying
    ? t.currentSecond
    : t.selectedTimeRange?.[1] ?? fixture.meta.duration_sec;

  const heatSamples = useMemo(
    () =>
      heatSamplesFromTrajectories(fixture.trajectories, {
        endSecond: heatEnd,
        team,
        robotId: selectedRobot,
      }),
    [fixture.trajectories, heatEnd, team, selectedRobot]
  );

  const filteredEvents = fixture.events.filter((e) => {
    if (team && e.team !== team) return false;
    if (robotType && e.robot_type !== robotType) return false;
    return true;
  });

  const filteredTraj = fixture.trajectories.filter((tr) => {
    if (selectedRobot) return tr.robot_id === selectedRobot;
    if (team && tr.team !== team) return false;
    return true;
  });

  const mapRobots = displayRobots.filter((r) => {
    if (team && r.team !== team) return false;
    if (robotType && r.robot_type !== robotType) return false;
    if (selectedRobot && r.robot_id !== selectedRobot) return false;
    return true;
  });

  const heatMode = t.isPlaying ? "live" : "full";

  const mapBlock = (
    <MatchBattleHud
      robots={displayRobots}
      selectedId={selectedRobot}
      onSelect={setSelectedRobot}
      heatMode={heatMode}
    >
      <div className="row" style={{ marginBottom: 8 }}>
        <button
          className={`btn ${layers.heat ? "active" : ""}`}
          onClick={() =>
            setLayers((l) => {
              const heat = !l.heat;
              return { ...l, heat, trails: heat ? false : l.trails };
            })
          }
        >
          Heatmap
        </button>
        <button
          className={`btn ${layers.trails ? "active" : ""}`}
          onClick={() => setLayers((l) => ({ ...l, trails: !l.trails }))}
        >
          Trails
        </button>
        <button
          className={`btn ${layers.robots ? "active" : ""}`}
          onClick={() => setLayers((l) => ({ ...l, robots: !l.robots }))}
        >
          Robots
        </button>
        <button
          className={`btn ${layers.aim ? "active" : ""}`}
          onClick={() => setLayers((l) => ({ ...l, aim: !l.aim }))}
        >
          Aim
        </button>
      </div>
      <TacticalMap
        robots={displayRobots}
        prevRobots={prevSnapRobots}
        focusRobotIds={mapRobots.map((r) => r.robot_id)}
        trajectories={filteredTraj}
        heatmapSamples={heatSamples}
        bounds={DEFAULT_BOUNDS}
        showHeatmap={layers.heat}
        showTrails={layers.trails}
        showRobots={layers.robots}
        showAim={layers.aim}
      />
    </MatchBattleHud>
  );

  return (
    <div className="stack">
      <MatchHeader detail={detail} />
      <TimeScrubber />
      <EntityFilter team={team} robotType={robotType} onTeam={setTeam} onType={setRobotType} />
      <QuickStats stats={detail.quick_stats} />

      <div className="tabs">
        {TABS.map((name) => (
          <button
            key={name}
            className={tab === name ? "active" : ""}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {tab === "Summary" && (
        <div className="stack">
          <MomentumChart data={fixture.momentum} />
          {mapBlock}
          <StatisticComparison bars={fixture.bars} />
        </div>
      )}
      {tab === "Momentum" && <MomentumChart data={fixture.momentum} />}
      {tab === "Map" && mapBlock}
      {tab === "Robots" && (
        <RobotCards
          robots={displayRobots}
          teamFilter={team}
          typeFilter={robotType}
          selectedId={selectedRobot}
          onSelect={setSelectedRobot}
        />
      )}
      {tab === "Events" && (
        <EventTimeline
          events={filteredEvents}
          currentSecond={t.currentSecond}
          onSeek={t.setSecond}
        />
      )}
      {tab === "Statistics" && <StatisticComparison bars={fixture.bars} />}
    </div>
  );
}
