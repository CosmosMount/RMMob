"use client";

import { useState } from "react";
import { robotNumberLabel } from "@/lib/robotLabel";
import type { RobotSnapshot } from "@/lib/types";

export function RobotCards({
  robots,
  teamFilter,
  typeFilter,
  selectedId,
  onSelect,
}: {
  robots: RobotSnapshot[];
  teamFilter: string | null;
  typeFilter: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const filtered = robots.filter((r) => {
    if (r.robot_type === "基地" || r.robot_type === "前哨站") return false;
    if (teamFilter && r.team !== teamFilter) return false;
    if (typeFilter && r.robot_type !== typeFilter) return false;
    return true;
  });

  return (
    <section className="stack">
      {filtered.map((r) => {
        const ratio = r.hp_max ? Math.max(0, Math.min(1, (r.hp || 0) / r.hp_max)) : 0;
        const open = expanded === r.robot_id;
        const selected = selectedId === r.robot_id;
        const num = robotNumberLabel(r.robot_id);
        return (
          <article
            key={r.robot_id}
            className="panel"
            style={{
              borderColor: selected ? (r.team === "红" ? "var(--red)" : "var(--blue)") : undefined,
              cursor: "pointer",
            }}
            onClick={() => {
              onSelect(selected ? null : r.robot_id);
              setExpanded(open ? null : r.robot_id);
            }}
          >
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="row" style={{ gap: 8 }}>
                <span
                  className="robot-num-badge"
                  style={{
                    background: r.team === "红" ? "var(--red)" : "var(--blue)",
                  }}
                >
                  {num}
                </span>
                <div>
                  <strong className={r.team === "红" ? "team-red" : "team-blue"}>
                    {r.robot_type}
                  </strong>
                  <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                    #{r.robot_id}
                  </span>
                </div>
              </div>
              <span className="muted">{r.status}</span>
            </div>
            <div className="hp-bar" style={{ marginTop: 8 }}>
              <span
                style={{
                  width: `${ratio * 100}%`,
                  background: r.team === "红" ? "var(--red)" : "var(--blue)",
                }}
              />
            </div>
            <div className="row muted" style={{ marginTop: 8, fontSize: 13 }}>
              <span>
                HP {Math.round(r.hp || 0)}/{Math.round(r.hp_max || 0)}
              </span>
              <span>承伤 {Math.round(r.damage_dealt)}</span>
              <span>17mm {Math.round(r.ammo_17 || 0)}</span>
              <span>距离 {r.distance}m</span>
            </div>
            {open && (
              <div className="muted" style={{ marginTop: 12, fontSize: 13 }}>
                <div>学校 {r.school}</div>
                <div>序号 {num}</div>
                <div>42mm {Math.round(r.ammo_42 || 0)}</div>
                <div>易伤 {r.vulnerable ? "是" : "否"}</div>
                <div>
                  位置{" "}
                  {r.x != null && r.y != null
                    ? `(${r.x.toFixed(2)}, ${r.y.toFixed(2)})`
                    : "无数据"}
                </div>
              </div>
            )}
          </article>
        );
      })}
      {!filtered.length && <div className="empty">No robots for current filters</div>}
    </section>
  );
}
