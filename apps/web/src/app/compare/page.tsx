"use client";

import { SchoolCrest } from "@/components/match/SchoolCrest";
import { api } from "@/lib/api";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

const TYPES = ["英雄", "工程", "步兵", "空中", "哨兵", "雷达", "飞镖"];
const SLOT_COLORS = ["#6fcf97", "#5b8def", "#e85d5d", "#f2c94c"];

function CompareInner() {
  const search = useSearchParams();
  const initialType = search.get("type") || "英雄";
  const [robotType, setRobotType] = useState(initialType);
  const [slots, setSlots] = useState<string[]>(["", ""]);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.compare>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      api.rankingSchools(robotType, query || undefined).then((r) => setSuggestions(r.items)).catch(() => {});
    }, 150);
    return () => clearTimeout(t);
  }, [robotType, query]);

  const selected = useMemo(() => slots.filter(Boolean), [slots]);

  useEffect(() => {
    if (selected.length < 2) {
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .compare(robotType, selected)
      .then(setResult)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [robotType, selected.join("|")]);

  function setSlot(i: number, school: string) {
    setSlots((prev) => {
      const next = [...prev];
      next[i] = school;
      return next;
    });
  }

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Compare</h1>
        <p className="page-sub muted">Pick a robot type and 2–4 schools · official season metrics</p>
      </div>

      <div className="panel row">
        {TYPES.map((t) => (
          <button
            key={t}
            className={`btn ${robotType === t ? "active" : ""}`}
            onClick={() => setRobotType(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="panel stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <strong>Schools</strong>
          <div className="row">
            {slots.length < 4 && (
              <button className="btn" onClick={() => setSlots((s) => [...s, ""])}>
                + Slot
              </button>
            )}
            {slots.length > 2 && (
              <button className="btn" onClick={() => setSlots((s) => s.slice(0, -1))}>
                − Slot
              </button>
            )}
          </div>
        </div>
        <input
          className="input"
          placeholder="Search schools to fill slots"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="row">
          {suggestions.slice(0, 12).map((s) => (
            <button
              key={s}
              className="btn"
              onClick={() => {
                const empty = slots.findIndex((x) => !x);
                if (empty >= 0) setSlot(empty, s);
                else if (slots.length < 4) setSlots([...slots, s]);
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="row">
          {slots.map((s, i) => (
            <div key={i} className="row" style={{ gap: 8 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 99,
                  background: SLOT_COLORS[i % SLOT_COLORS.length],
                }}
              />
              {s ? (
                <>
                  <SchoolCrest school={s} size={28} />
                  <span>{s}</span>
                  <button className="text-btn" onClick={() => setSlot(i, "")}>
                    clear
                  </button>
                </>
              ) : (
                <span className="muted">Slot {i + 1} empty</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {error && <div className="panel empty">{error}</div>}
      {loading && <div className="panel skeleton" style={{ height: 120 }} />}

      {result && (
        <>
          <section className="panel">
            <h2 style={{ margin: "0 0 12px", fontSize: 15 }}>Metric bars</h2>
            <div className="compare-bars">
              {result.series.map((ser) => (
                <div key={ser.field} className="compare-metric">
                  <div className="compare-metric-label">{ser.label}</div>
                  {ser.values.map((v, i) => (
                    <div key={v.school} className="compare-bar-row">
                      <span className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                        {v.school}
                      </span>
                      <div className="compare-bar-track">
                        <div
                          className="compare-bar-fill"
                          style={{
                            width: `${Math.max(2, v.ratio * 100)}%`,
                            background: SLOT_COLORS[i % SLOT_COLORS.length],
                          }}
                        />
                      </div>
                      <span className="num" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 650 }}>
                        {Number.isFinite(v.value) ? Number(v.value.toFixed(2)) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section className="panel" style={{ padding: 0, overflowX: "auto" }}>
            <table className="rank-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  {result.teams.map((t) => (
                    <th key={t.school}>{t.school}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(["kda", "ladder_score", ...result.fields] as string[]).map((f) => (
                  <tr key={f}>
                    <td className="muted">{f === "kda" ? "KDA" : result.field_labels[f] || f}</td>
                    {result.teams.map((t) => {
                      const raw =
                        f === "kda"
                          ? t.kda
                          : f === "ladder_score"
                            ? t.ladder_score
                            : t.metrics?.[f];
                      const val =
                        typeof raw === "number" ? Number(raw.toFixed(2)) : raw != null ? String(raw) : "—";
                      return (
                        <td key={t.school} className="num">
                          {t.found ? val : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="panel skeleton" style={{ height: 160 }} />}>
      <CompareInner />
    </Suspense>
  );
}
