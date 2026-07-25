"use client";

import Link from "next/link";
import { SchoolCrest } from "@/components/match/SchoolCrest";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";

export default function RobotsPage() {
  const [items, setItems] = useState<
    Array<{ school: string; robot_type: string; region: string; rounds: number; key: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .robots()
      .then((r) => setItems(r.items || []))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Robots</h1>
        <p className="page-sub muted">School × robot-type index</p>
      </div>
      {loading && <div className="panel skeleton" style={{ height: 120 }} />}
      {error && <div className="panel empty">{error}</div>}
      {!loading && !error && (
        <div className="panel-list">
          {items.map((it) => (
            <Link
              key={it.key}
              href={`/teams/${encodeURIComponent(it.school)}`}
              className="match-row"
            >
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="row" style={{ gap: 12 }}>
                  <SchoolCrest school={it.school} size={36} />
                  <div>
                    <strong>{it.robot_type}</strong>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {it.school}
                    </div>
                  </div>
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {it.region} · {it.rounds} rounds
                </div>
              </div>
            </Link>
          ))}
          {!items.length && <div className="empty">No robots indexed</div>}
        </div>
      )}
    </div>
  );
}
