"use client";

import { MatchRow } from "@/components/match/MatchRow";
import { SchoolCombobox } from "@/components/ui/SchoolCombobox";
import { api } from "@/lib/api";
import type { MatchGroup } from "@/lib/types";
import { useEffect, useState } from "react";

export default function MatchesPage() {
  const [region, setRegion] = useState("");
  const [school, setSchool] = useState("");
  const [regions, setRegions] = useState<string[]>([]);
  const [items, setItems] = useState<MatchGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.regions().then((r) => setRegions(r.items)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const t = setTimeout(() => {
      api
        .matches({
          region: region || undefined,
          school: school || undefined,
          limit: 60,
        })
        .then((r) => setItems(r.items))
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    }, school ? 220 : 0);
    return () => clearTimeout(t);
  }, [region, school]);

  return (
    <div className="stack">
      <h1 className="page-title">Matches</h1>
      <div className="panel row">
        <select className="input" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">All regions</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <SchoolCombobox
          value={school}
          onChange={setSchool}
          placeholder="Select or search school…"
        />
      </div>
      {loading && <div className="panel skeleton" style={{ height: 80 }} />}
      {error && <div className="panel empty">{error}</div>}
      {!loading && !error && (
        <div className="panel-list">
          {items.map((m) => (
            <MatchRow key={m.match_key} match={m} />
          ))}
          {!items.length && <div className="empty">No matches</div>}
        </div>
      )}
    </div>
  );
}
