"use client";

import Link from "next/link";
import { SchoolCrest } from "@/components/match/SchoolCrest";
import { api } from "@/lib/api";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

const TYPES = ["英雄", "工程", "步兵", "空中", "哨兵", "雷达", "飞镖"];

type RankItem = {
  rank: number;
  school: string;
  region: string | null;
  robot_type: string;
  kda: string;
  ladder_score: number;
  eagHurt: number | null;
  gkDamage: number | null;
  gKillCount: number | null;
  metrics: Record<string, number | string | null>;
};

function RankingsInner() {
  const search = useSearchParams();
  const initialType = search.get("type") || "英雄";
  const [robotType, setRobotType] = useState(
    TYPES.includes(initialType) ? initialType : "英雄"
  );
  const [region, setRegion] = useState("");
  const [zones, setZones] = useState<Array<{ zoneId: string; zoneName: string }>>([]);
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [data, setData] = useState<{
    sort_by: string;
    sort_label: string;
    fields: string[];
    field_labels: Record<string, string>;
    model_version: string;
    source: string;
    items: RankItem[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.rankingZones().then((r) => setZones(r.items)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .rankings(robotType, region || undefined, sortBy)
      .then((raw) => {
        // Tolerate stale API payloads missing ladder field metadata
        setData({
          sort_by: raw.sort_by ?? "ladder_score",
          sort_label: raw.sort_label ?? "",
          fields: raw.fields ?? [],
          field_labels: raw.field_labels ?? {},
          model_version: raw.model_version ?? "—",
          source: raw.source ?? "",
          items: raw.items ?? [],
        });
      })
      .finally(() => setLoading(false));
  }, [robotType, region, sortBy]);

  const columns = useMemo(() => {
    if (!data) return [] as string[];
    const fields = data.fields ?? [];
    if (!fields.length) return [];
    const sort = data.sort_by;
    const ordered: string[] = [];
    if (sort && fields.includes(sort)) ordered.push(sort);
    for (const f of fields) {
      if (f === sort) continue;
      if (f === "ladder_score") {
        ordered.push("ladder_score", "eaKDA");
        continue;
      }
      ordered.push(f);
    }
    return Array.from(new Set(ordered)).slice(0, 6);
  }, [data]);

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Rankings</h1>
        <p className="page-sub muted">
          Official season stats (LADDER) · {data?.model_version || "…"}
          {data?.sort_label ? ` · sort ${data.sort_label}` : ""}
        </p>
      </div>
      <div className="panel row">
        {TYPES.map((t) => (
          <button
            key={t}
            className={`btn ${robotType === t ? "active" : ""}`}
            onClick={() => {
              setRobotType(t);
              setSortBy(undefined);
            }}
          >
            {t}
          </button>
        ))}
        <select className="input" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">All zones</option>
          {zones.map((z) => (
            <option key={z.zoneId} value={z.zoneName}>
              {z.zoneName}
            </option>
          ))}
        </select>
        <Link className="btn" href={`/compare?type=${encodeURIComponent(robotType)}`}>
          Compare
        </Link>
      </div>
      {loading && <div className="panel skeleton" style={{ height: 120 }} />}
      {!loading && data && (
        <div className="panel" style={{ padding: 0, overflowX: "auto" }}>
          <table className="rank-table">
            <thead>
              <tr>
                <th>#</th>
                <th>School</th>
                {columns.map((c) => (
                  <th
                    key={c}
                    className={data.sort_by === c || (c === "eaKDA" && data.sort_by === "ladder_score") ? "active" : ""}
                    onClick={() => setSortBy(c === "eaKDA" ? "ladder_score" : c)}
                  >
                    {c === "eaKDA" ? "KDA" : data.field_labels?.[c] || c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items?.map((it) => (
                <tr key={`${it.school}-${it.rank}-${it.robot_type}`}>
                  <td className="num">{it.rank}</td>
                  <td>
                    <Link href={`/teams/${encodeURIComponent(it.school)}`} className="rank-school-cell">
                      <SchoolCrest school={it.school} size={32} />
                      <span>
                        <div className="match-school">{it.school}</div>
                        <div className="muted" style={{ fontSize: 11 }}>
                          {it.region} · {it.robot_type}
                        </div>
                      </span>
                    </Link>
                  </td>
                  {columns.map((c) => {
                    let val: string | number = "—";
                    if (c === "eaKDA") val = it.kda;
                    else if (c === "ladder_score") val = it.ladder_score?.toFixed(2);
                    else {
                      const raw = it.metrics?.[c] ?? (it as Record<string, unknown>)[c];
                      val = typeof raw === "number" ? Number(raw.toFixed(2)) : raw != null ? String(raw) : "—";
                    }
                    return (
                      <td key={c} className="num">
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ fontSize: 11, padding: "10px 12px" }}>
            {data.source}
          </p>
        </div>
      )}
    </div>
  );
}

export default function RankingsPage() {
  return (
    <Suspense fallback={<div className="panel skeleton" style={{ height: 160 }} />}>
      <RankingsInner />
    </Suspense>
  );
}
