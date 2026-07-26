"use client";

import Link from "next/link";
import { SchoolCrest } from "@/components/match/SchoolCrest";
import { Pagination } from "@/components/ui/Pagination";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";

const PAGE_SIZE = 20;

export default function TeamsPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [schools, setSchools] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPage(0);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      api
        .schools({ q: q || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
        .then((r) => {
          if (cancelled) return;
          setSchools(r.items);
          setTotal(r.total ?? r.items.length);
        })
        .catch(() => {
          if (!cancelled) {
            setSchools([]);
            setTotal(0);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, page]);

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
      {loading && <div className="panel skeleton" style={{ height: 120 }} />}
      {!loading && (
        <>
          <div className="panel-list">
            {schools.map((s) => (
              <Link key={s} href={`/teams/${encodeURIComponent(s)}`} className="match-row">
                <div className="row" style={{ gap: 12 }}>
                  <SchoolCrest school={s} size={40} />
                  <span className="match-school">{s}</span>
                </div>
              </Link>
            ))}
            {!schools.length && <div className="empty">No teams</div>}
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}
