"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MatchRow } from "@/components/match/MatchRow";
import { SchoolCrest } from "@/components/match/SchoolCrest";
import { api } from "@/lib/api";
import type { MatchGroup } from "@/lib/types";

export default function TeamDetailPage() {
  const params = useParams<{ school: string }>();
  const school = decodeURIComponent(params.school);
  const [data, setData] = useState<{
    school: string;
    matches_played: number;
    rounds_played: number;
    rounds_won: number;
    win_rate: number;
    region_counts: Record<string, number>;
    recent_matches: MatchGroup[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .team(school)
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [school]);

  if (error) return <div className="panel empty">{error}</div>;
  if (!data) return <div className="panel skeleton" style={{ height: 160 }} />;

  return (
    <div className="stack">
      <section className="panel">
        <div className="row" style={{ gap: 14, alignItems: "center" }}>
          <SchoolCrest school={data.school} size={56} />
          <div>
            <h1 className="page-title" style={{ fontSize: 22 }}>
              {data.school}
            </h1>
            <div className="row muted" style={{ marginTop: 4, fontSize: 13 }}>
              <span>Matches {data.matches_played}</span>
              <span>
                Rounds {data.rounds_won}/{data.rounds_played}
              </span>
              <span>Win {(data.win_rate * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          {Object.entries(data.region_counts).map(([r, n]) => (
            <span key={r} className="btn">
              {r} · {n}
            </span>
          ))}
        </div>
      </section>
      <h2 className="page-title" style={{ fontSize: 16 }}>
        Recent matches
      </h2>
      <div className="panel-list">
        {data.recent_matches.map((m) => (
          <MatchRow key={m.match_key} match={m} />
        ))}
      </div>
    </div>
  );
}
