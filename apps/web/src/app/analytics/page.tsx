"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function AnalyticsPage() {
  const [data, setData] = useState<{
    regions: Array<{ region: string; rounds: number }>;
    notes: string[];
  } | null>(null);

  useEffect(() => {
    api.analytics().then(setData).catch(() => {});
  }, []);

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Analytics</h1>
        <p className="page-sub muted">Cross-match overview</p>
      </div>
      <section className="panel">
        <h2 style={{ marginTop: 0, fontSize: 15 }}>Rounds by region</h2>
        {!data && <div className="skeleton" style={{ height: 48 }} />}
        {data?.regions.map((r) => (
          <div
            key={r.region}
            className="row"
            style={{ justifyContent: "space-between", margin: "8px 0" }}
          >
            <span>{r.region}</span>
            <strong>{r.rounds}</strong>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2 style={{ marginTop: 0, fontSize: 15 }}>Notes</h2>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
          {(data?.notes || []).map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
