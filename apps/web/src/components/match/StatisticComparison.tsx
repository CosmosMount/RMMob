import type { StatBar } from "@/lib/types";

/** FotMob-style dual bars: each side scales against max(red, blue) so both stay visible. */
export function StatisticComparison({ bars }: { bars: StatBar[] }) {
  return (
    <section className="panel">
      {bars.map((b) => {
        const peak = Math.max(b.red, b.blue, 1e-6);
        const redPct = (b.red / peak) * 100;
        const bluePct = (b.blue / peak) * 100;
        return (
          <div key={b.metric} className="stat-row">
            <div className="team-red" style={{ textAlign: "right", fontWeight: 650 }}>
              {formatStat(b.red)}
            </div>
            <div>
              <div className="muted" style={{ textAlign: "center", fontSize: 12, marginBottom: 4 }}>
                {b.label}
              </div>
              <div className="stat-bar-track">
                <div className="stat-bar-half left">
                  <div className="red" style={{ width: `${redPct}%` }} />
                </div>
                <div className="stat-bar-half right">
                  <div className="blue" style={{ width: `${bluePct}%` }} />
                </div>
              </div>
            </div>
            <div className="team-blue" style={{ fontWeight: 650 }}>
              {formatStat(b.blue)}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function formatStat(n: number) {
  if (!Number.isFinite(n)) return "—";
  return Math.abs(n) >= 100 ? String(Math.round(n)) : n.toFixed(n % 1 ? 1 : 0);
}
