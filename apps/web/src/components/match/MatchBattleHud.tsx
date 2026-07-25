"use client";

import { robotNumberLabel } from "@/lib/robotLabel";
import type { RobotSnapshot } from "@/lib/types";
import type { ReactNode } from "react";

const BUILDINGS = new Set(["基地", "前哨站"]);

function SoftHpBar({
  ratio,
  tone,
  low,
}: {
  ratio: number;
  tone: "red" | "blue" | "neutral";
  low?: boolean;
}) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div className={`bs-hp-track ${low ? "low" : ""}`}>
      <div
        className={`bs-hp-fill tone-${tone}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function BuildingStrip({ robots, team }: { robots: RobotSnapshot[]; team: "红" | "蓝" }) {
  const tone = team === "红" ? "red" : "blue";
  const base = robots.find((r) => r.team === team && r.robot_type === "基地");
  const outpost = robots.find((r) => r.team === team && r.robot_type === "前哨站");
  const items = [
    { key: "outpost", label: "前哨", r: outpost },
    { key: "base", label: "基地", r: base },
  ];
  return (
    <div className={`bs-building-strip team-${tone}`}>
      {items.map(({ key, label, r }) => {
        const hp = r?.hp ?? 0;
        const max = r?.hp_max || 1;
        const ratio = max > 0 ? hp / max : 0;
        return (
          <div key={key} className="bs-building-item">
            <div className="bs-building-meta">
              <span className="bs-building-label">{label}</span>
              <span className="bs-building-hp num">
                {Math.round(hp)}
                <span className="muted">/{Math.round(max)}</span>
              </span>
            </div>
            <SoftHpBar ratio={ratio} tone={tone} low={ratio > 0 && ratio < 0.2} />
          </div>
        );
      })}
    </div>
  );
}

function SideRobotList({
  robots,
  team,
  selectedId,
  onSelect,
}: {
  robots: RobotSnapshot[];
  team: "红" | "蓝";
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const tone = team === "红" ? "red" : "blue";
  const list = robots
    .filter((r) => r.team === team && !BUILDINGS.has(r.robot_type))
    .slice()
    .sort((a, b) => Number(robotNumberLabel(a.robot_id)) - Number(robotNumberLabel(b.robot_id)));

  return (
    <aside className={`bs-side bs-side-${tone}`}>
      {list.map((r) => {
        const hp = r.hp ?? 0;
        const max = r.hp_max || 1;
        const ratio = max > 0 ? hp / max : 0;
        const num = robotNumberLabel(r.robot_id);
        const selected = selectedId === r.robot_id;
        const dead = hp <= 0;
        const ammo = Math.round((r.ammo_17 || 0) + (r.ammo_42 || 0));
        return (
          <button
            key={r.robot_id}
            type="button"
            className={`bs-robot-card ${selected ? "selected" : ""} ${dead ? "dead" : ""}`}
            onClick={() => onSelect(selected ? null : r.robot_id)}
          >
            <div className="bs-robot-top">
              <span className={`bs-num tone-${tone}`}>{num}</span>
              <span className="bs-robot-type">{r.robot_type}</span>
              <span className="bs-robot-hp num">
                {Math.round(hp)}
                <span className="muted">/{Math.round(max)}</span>
              </span>
            </div>
            <SoftHpBar ratio={ratio} tone={tone} low={!dead && ratio < 0.2} />
            <div className="bs-robot-ammo muted">
              弹 {ammo}
              {r.ammo_17 != null ? ` · 17 ${Math.round(r.ammo_17)}` : ""}
              {r.ammo_42 != null && r.ammo_42 > 0 ? ` · 42 ${Math.round(r.ammo_42)}` : ""}
            </div>
          </button>
        );
      })}
      {!list.length && <div className="muted" style={{ fontSize: 12, padding: 8 }}>无机器人</div>}
    </aside>
  );
}

/** BattleScope-inspired map HUD: building bars on top, robot HP/ammo on sides. */
export function MatchBattleHud({
  robots,
  selectedId,
  onSelect,
  heatMode,
  children,
}: {
  robots: RobotSnapshot[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  heatMode: "live" | "full";
  children: ReactNode;
}) {
  return (
    <div className="battle-hud panel">
      <div className="battle-hud-top">
        <BuildingStrip robots={robots} team="红" />
        <div className="battle-hud-mode muted">
          {heatMode === "live" ? "实时热力" : "全场热力"}
        </div>
        <BuildingStrip robots={robots} team="蓝" />
      </div>
      <div className="battle-hud-body">
        <SideRobotList robots={robots} team="红" selectedId={selectedId} onSelect={onSelect} />
        <div className="battle-hud-map">{children}</div>
        <SideRobotList robots={robots} team="蓝" selectedId={selectedId} onSelect={onSelect} />
      </div>
    </div>
  );
}
