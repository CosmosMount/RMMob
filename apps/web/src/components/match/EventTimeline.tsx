import type { EventItem } from "@/lib/types";

export function EventTimeline({
  events,
  currentSecond,
  onSeek,
}: {
  events: EventItem[];
  currentSecond: number;
  onSeek: (s: number) => void;
}) {
  return (
    <section className="panel stack" style={{ gap: 8 }}>
      {events.map((e, i) => (
        <button
          key={`${e.second}-${e.event_type}-${i}`}
          className="btn"
          style={{
            justifyContent: "flex-start",
            textAlign: "left",
            opacity: Math.abs(e.second - currentSecond) <= 2 ? 1 : 0.75,
            borderColor: e.importance === "major" ? "var(--text)" : undefined,
            display: "block",
            width: "100%",
            borderRadius: 10,
          }}
          onClick={() => onSeek(e.second)}
        >
          <span className="muted">{fmt(e.second)}</span>{" "}
          <span className={e.team === "红" ? "team-red" : e.team === "蓝" ? "team-blue" : ""}>
            {e.team || ""}
          </span>{" "}
          <strong>{e.event_type}</strong>{" "}
          <span className="muted">
            {e.robot_type || ""} {e.category || ""}{" "}
            {e.value != null ? e.value : ""} {e.note || ""}
          </span>
        </button>
      ))}
      {!events.length && <div className="empty">No events</div>}
    </section>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
