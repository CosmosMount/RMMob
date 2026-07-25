"use client";

const TEAMS = [
  { id: null, label: "双方" },
  { id: "红", label: "红" },
  { id: "蓝", label: "蓝" },
] as const;

const TYPES = ["英雄", "工程", "步兵3", "步兵4", "空中", "哨兵"] as const;

export function EntityFilter({
  team,
  robotType,
  onTeam,
  onType,
}: {
  team: string | null;
  robotType: string | null;
  onTeam: (t: string | null) => void;
  onType: (t: string | null) => void;
}) {
  return (
    <section className="panel">
      <div className="row" style={{ marginBottom: 8 }}>
        <span className="muted">阵营</span>
        {TEAMS.map((t) => (
          <button
            key={String(t.id)}
            className={`btn ${team === t.id ? "active" : ""}`}
            onClick={() => onTeam(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="row">
        <span className="muted">兵种</span>
        <button
          className={`btn ${robotType == null ? "active" : ""}`}
          onClick={() => onType(null)}
        >
          全部
        </button>
        {TYPES.map((tp) => (
          <button
            key={tp}
            className={`btn ${robotType === tp ? "active" : ""}`}
            onClick={() => onType(tp)}
          >
            {tp}
          </button>
        ))}
      </div>
    </section>
  );
}
