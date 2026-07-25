"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { api } from "@/lib/api";
import type {
  EventItem,
  HeatmapResponse,
  MatchGroup,
  MomentumResponse,
  RobotSnapshot,
  RoundDetail,
  StatBar,
} from "@/lib/types";
import { RoundTimeProvider, useRoundTime } from "@/state/roundTime";

const TABS = ["Summary", "Momentum", "Map", "Robots", "Events", "Statistics"] as const;

type Traj = {
  robot_id: string;
  team: string;
  points: Array<{ second: number; x: number | null; y: number | null }>;
};

function positionAt(
  points: Traj["points"],
  second: number
): { x: number | null; y: number | null } | null {
  if (!points.length) return null;
  let best = points[0];
  for (const p of points) {
    if (p.second > second) break;
    best = p;
  }
  // If scrubbing before first sample, use first point
  if (best.second > second && points[0]) best = points[0];
  return { x: best.x, y: best.y };
}

function withTrajPositions(
  robots: RobotSnapshot[],
  traj: Traj[],
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

export default function MatchDetailInner() {
  const params = useParams<{ matchKey: string }>();
  const search = useSearchParams();
  const matchKey = decodeURIComponent(params.matchKey);
  const [group, setGroup] = useState<MatchGroup | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .match(matchKey)
      .then((g) => {
        if ((g as { error?: string }).error) setError("Match not found");
        else setGroup(g);
      })
      .catch((e) => setError(String(e)));
  }, [matchKey]);

  const gameId = useMemo(() => {
    if (!group) return null;
    const q = search.get("round");
    if (q && group.rounds.some((r) => r.game_id === q)) return q;
    return group.rounds[0]?.game_id || null;
  }, [group, search]);

  if (error) return <div className="panel empty">{error}</div>;
  if (!group || !gameId) return <div className="panel skeleton" style={{ height: 200 }} />;

  const roundMeta = group.rounds.find((r) => r.game_id === gameId)!;
  const duration = roundMeta.duration_sec ?? 0;

  return (
    <div className="stack">
      <RoundTimeProvider gameId={gameId} durationSeconds={duration}>
        <MatchRoundView gameId={gameId} matchKey={matchKey} />
      </RoundTimeProvider>
    </div>
  );
}

function MatchRoundView({ gameId, matchKey }: { gameId: string; matchKey: string }) {
  const t = useRoundTime();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Summary");
  const [detail, setDetail] = useState<RoundDetail | null>(null);
  const distanceMap = useRef<Record<string, number>>({});
  const [momentum, setMomentum] = useState<MomentumResponse | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [bars, setBars] = useState<StatBar[]>([]);
  const [heat, setHeat] = useState<HeatmapResponse | null>(null);
  const [traj, setTraj] = useState<Traj[]>([]);
  const [team, setTeam] = useState<string | null>(null);
  const [robotType, setRobotType] = useState<string | null>(null);
  const [selectedRobot, setSelectedRobot] = useState<string | null>(null);
  const [layers, setLayers] = useState({ heat: true, trails: false, robots: true });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = await api.round(gameId);
      if (cancelled) return;
      distanceMap.current = Object.fromEntries(d.robots.map((r) => [r.robot_id, r.distance]));
      setDetail(d);
      const [m, ev, st, robots] = await Promise.all([
        api.momentum(gameId),
        api.events(gameId),
        api.statistics(gameId),
        api.trajectoryRobots(gameId),
      ]);
      if (cancelled) return;
      setMomentum(m);
      setEvents(ev.items);
      setBars(st.bars);

      // Load paths for all mobile robots so Play can drive the map offline
      const mobile = robots.items.filter(
        (r) => r.robot_type !== "基地" && r.robot_type !== "前哨站"
      );
      const trs = await Promise.all(
        mobile.map(async (r) => {
          const tr = await api.trajectory(gameId, r.robot_id);
          return {
            robot_id: r.robot_id,
            team: r.team,
            points: tr.points.map((p) => ({ second: p.second, x: p.x, y: p.y })),
          };
        })
      );
      if (!cancelled) setTraj(trs);
    })().catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  // Soft-refresh HP/stats while scrubbing; map motion comes from trajectories
  useEffect(() => {
    if (!detail) return;
    let cancelled = false;
    const delay = t.isPlaying ? 280 : 80;
    const handle = window.setTimeout(() => {
      api
        .round(gameId, t.currentSecond)
        .then((d) => {
          if (cancelled) return;
          d.robots = d.robots.map((r) => ({
            ...r,
            distance: distanceMap.current[r.robot_id] ?? r.distance,
          }));
          setDetail(d);
        })
        .catch(() => {});
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, t.currentSecond, t.isPlaying]);

  // Full-match heat when paused; cumulative live heat while playing
  const heatBucket = t.isPlaying ? Math.floor(t.currentSecond / 2) * 2 : -1;
  useEffect(() => {
    let cancelled = false;
    const delay = t.isPlaying ? 450 : 0;
    const handle = window.setTimeout(() => {
      api
        .heatmap(gameId, {
          metric: "movement",
          team: team || undefined,
          robot_type: robotType || undefined,
          robot_id: selectedRobot || undefined,
          start: t.selectedTimeRange?.[0],
          end: t.isPlaying
            ? t.currentSecond
            : t.selectedTimeRange?.[1],
        })
        .then((h) => {
          if (!cancelled) setHeat(h);
        })
        .catch(() => {});
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [
    gameId,
    team,
    robotType,
    selectedRobot,
    t.selectedTimeRange,
    t.isPlaying,
    heatBucket,
  ]);

  const filteredEvents = events.filter((e) => {
    if (team && e.team !== team) return false;
    if (robotType && e.robot_type !== robotType) return false;
    return true;
  });

  const filteredTraj = traj.filter((tr) => {
    if (selectedRobot) return tr.robot_id === selectedRobot;
    if (team && tr.team !== team) return false;
    return true;
  });

  const displayRobots = useMemo(
    () => withTrajPositions(detail?.robots || [], traj, t.currentSecond),
    [detail?.robots, traj, t.currentSecond]
  );

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
      </div>
      <TacticalMap
        robots={mapRobots}
        trajectories={filteredTraj}
        heatmapSamples={heat?.samples || []}
        bounds={heat?.coordinate_bounds}
        showHeatmap={layers.heat}
        showTrails={layers.trails}
        showRobots={layers.robots}
      />
    </MatchBattleHud>
  );

  if (!detail) return <div className="panel skeleton" style={{ height: 240 }} />;

  return (
    <div className="stack">
      <MatchHeader detail={detail} matchKey={matchKey} />
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
          <MomentumChart data={momentum} />
          {mapBlock}
          <StatisticComparison bars={bars} />
        </div>
      )}
      {tab === "Momentum" && <MomentumChart data={momentum} />}
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
      {tab === "Statistics" && <StatisticComparison bars={bars} />}
    </div>
  );
}
