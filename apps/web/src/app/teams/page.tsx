"use client";

import Link from "next/link";
import { SchoolCrest } from "@/components/match/SchoolCrest";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";

export default function TeamsPage() {
  const [q, setQ] = useState("");
  const [schools, setSchools] = useState<string[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      api.schools(q || undefined).then((r) => setSchools(r.items)).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="stack">
      <h1 className="page-title">Teams</h1>
      <input
        className="input"
        placeholder="Search school"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ maxWidth: 360 }}
      />
      <div className="panel-list">
        {schools.map((s) => (
          <Link key={s} href={`/teams/${encodeURIComponent(s)}`} className="match-row">
            <div className="row" style={{ gap: 12 }}>
              <SchoolCrest school={s} size={40} />
              <span className="match-school">{s}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
