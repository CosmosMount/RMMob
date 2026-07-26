"use client";

import Link from "next/link";
import { SchoolCrest } from "@/components/match/SchoolCrest";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";

const TYPES = ["英雄", "工程", "步兵", "空中", "哨兵", "雷达", "飞镖"];

type RankItem = {
  rank: number;
  school: string;
  kda: string;
  ladder_score: number;
  gkDamage: number | null;
  eagHurt: number | null;
  robot_type: string;
  metrics?: Record<string, number | string | null>;
};

export function HomeTypeRankPanel() {
  const [robotType, setRobotType] = useState("英雄");
  const [loading, setLoading] = useState(true);
  const [sortLabel, setSortLabel] = useState("");
  const [items, setItems] = useState<RankItem[]>([]);

  useEffect(() => {
    setLoading(true);
    api
      .rankings(robotType)
      .then((r) => {
        setSortLabel(r.sort_label || "");
        setItems((r.items || []).slice(0, 10) as RankItem[]);
      })
      .catch(() => {
        setItems([]);
        setSortLabel("");
      })
      .finally(() => setLoading(false));
  }, [robotType]);

  function metricLine(it: RankItem) {
    if (robotType === "英雄" && it.gkDamage != null) {
      return `${it.kda || "—"} · 伤害 ${Math.round(it.gkDamage)}`;
    }
    if ((robotType === "空中" || robotType === "哨兵") && it.eagHurt != null) {
      return `伤害 ${Math.round(it.eagHurt)}`;
    }
    if (robotType === "工程") {
      const lvl = it.metrics?.avgAssembleDiff;
      const econ = it.metrics?.eaAssembleEcon;
      if (typeof lvl === "number") {
        return `兑矿 ${lvl.toFixed(1)}${typeof econ === "number" ? ` · 经济 ${Math.round(econ)}` : ""}`;
      }
    }
    if (it.kda && it.kda !== "0/0/0" && !it.kda.startsWith("0.0/")) return it.kda;
    if (it.ladder_score != null && robotType !== "工程") return `分 ${it.ladder_score}`;
    return it.robot_type || "—";
  }

  return (
    <section className="panel home-side-panel">
      <div className="home-side-head">
        <h2>兵种榜</h2>
        <Link href="/rankings" className="muted">
          全部
        </Link>
      </div>
      <select
        className="input home-type-select"
        value={robotType}
        onChange={(e) => setRobotType(e.target.value)}
        aria-label="选择兵种"
      >
        {TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      {loading && <div className="skeleton" style={{ height: 120, marginTop: 8 }} />}
      {!loading && (
        <>
          {sortLabel && (
            <p className="muted" style={{ fontSize: 11, margin: "8px 0", padding: "0 4px" }}>
              排序 · {sortLabel}
            </p>
          )}
          {!items.length && <div className="empty" style={{ padding: 16 }}>暂无数据</div>}
          <ol className="home-rank-list">
            {items.map((it) => (
              <li key={`${robotType}-${it.rank}-${it.school}-${it.robot_type}`}>
                <Link href={`/teams/${encodeURIComponent(it.school)}`} className="home-rank-row">
                  <span className="num muted" style={{ width: 20 }}>
                    {it.rank}
                  </span>
                  <SchoolCrest school={it.school} size={26} />
                  <span className="home-rank-meta">
                    <span className="home-school-name">{it.school}</span>
                    <span className="muted" style={{ fontSize: 11 }}>
                      {metricLine(it)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
