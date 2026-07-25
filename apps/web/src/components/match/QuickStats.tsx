export function QuickStats({ stats }: { stats: Record<string, number | null | undefined> }) {
  const items = [
    { label: "Red HP", value: stats.red_hp, tone: "team-red" },
    { label: "Blue HP", value: stats.blue_hp, tone: "team-blue" },
    { label: "Red alive", value: stats.red_alive, tone: "team-red" },
    { label: "Blue alive", value: stats.blue_alive, tone: "team-blue" },
    { label: "Red gold", value: stats.red_gold, tone: "team-red" },
    { label: "Blue gold", value: stats.blue_gold, tone: "team-blue" },
  ];
  return (
    <section className="panel quick-stats">
      {items.map((it) => (
        <div key={it.label} className="qs-item">
          <div className="qs-label muted">{it.label}</div>
          <div className={`qs-value ${it.tone}`}>
            {it.value == null ? "—" : Math.round(Number(it.value))}
          </div>
        </div>
      ))}
    </section>
  );
}
