"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SchoolCrest } from "@/components/match/SchoolCrest";
import { api } from "@/lib/api";

type RobotDetail = Awaited<ReturnType<typeof api.teamRobot>>;

export default function TeamRobotDetailInner() {
  const params = useParams<{ school: string; robotType: string }>();
  const school = decodeURIComponent(params.school);
  const robotType = decodeURIComponent(params.robotType);
  const [data, setData] = useState<RobotDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setData(null);
    api
      .teamRobot(school, robotType)
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [school, robotType]);

  if (error) {
    return (
      <div className="stack">
        <Link href={`/teams/${encodeURIComponent(school)}`} className="text-btn">
          ← {school}
        </Link>
        <div className="panel empty">{error}</div>
      </div>
    );
  }
  if (!data) return <div className="panel skeleton" style={{ height: 180 }} />;

  const metricKeys = [
    "ladder_score",
    "eaKDA",
    ...data.fields.filter((f) => f !== "ladder_score" && f !== "eaKDA"),
  ];
  const seen = new Set<string>();
  const cols = metricKeys.filter((k) => {
    if (seen.has(k)) return false;
    seen.add(k);
    return data.metrics[k] != null || k === "ladder_score" || k === "eaKDA";
  });

  return (
    <div className="stack">
      <Link href={`/teams/${encodeURIComponent(school)}`} className="text-btn">
        ← {school}
      </Link>

      <section className="panel">
        <div className="row" style={{ gap: 14, alignItems: "center" }}>
          <SchoolCrest school={data.school} size={56} />
          <div>
            <h1 className="page-title" style={{ fontSize: 22 }}>
              {data.robot_type}
            </h1>
            <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
              {data.school}
              {data.region ? ` · ${data.region}` : ""}
              {data.rank != null ? ` · Rank #${data.rank}` : ""}
            </div>
            <div className="row" style={{ marginTop: 10, gap: 8 }}>
              <span className="btn active">KDA {data.kda}</span>
              <span className="btn">K+0.4A {data.ladder_score}</span>
            </div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 14, gap: 8 }}>
          <Link
            className="btn"
            href={`/rankings?type=${encodeURIComponent(
              data.robot_type_key === "Infantry" ? "步兵" : data.robot_type
            )}`}
          >
            Type rankings
          </Link>
          <Link
            className="btn"
            href={`/compare?type=${encodeURIComponent(
              data.robot_type_key === "Infantry" ? "步兵" : data.robot_type
            )}`}
          >
            Compare
          </Link>
        </div>
      </section>

      <section className="panel" style={{ padding: 0, overflowX: "auto" }}>
        <table className="rank-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {cols.map((f) => {
              const raw =
                f === "eaKDA"
                  ? data.kda
                  : f === "ladder_score"
                    ? data.ladder_score
                    : data.metrics[f];
              const val =
                typeof raw === "number"
                  ? Number(raw.toFixed(3))
                  : raw != null
                    ? String(raw)
                    : "—";
              return (
                <tr key={f}>
                  <td className="muted">{data.field_labels[f] || f}</td>
                  <td className="num">{val}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <p className="muted" style={{ fontSize: 12 }}>
        {data.model_version} · {data.source}
      </p>
    </div>
  );
}
