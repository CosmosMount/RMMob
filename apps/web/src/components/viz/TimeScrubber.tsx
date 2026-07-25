"use client";

import { useRoundTime } from "@/state/roundTime";

export function TimeScrubber() {
  const t = useRoundTime();
  return (
    <section className="panel time-scrubber">
      <div className="ts-top">
        <button type="button" className="text-btn" onClick={() => t.setPlaying(!t.isPlaying)}>
          {t.isPlaying ? "Pause" : "Play"}
        </button>
        <div className="ts-rates">
          {[1, 1.5, 2, 3].map((r) => (
            <button
              key={r}
              type="button"
              className={`text-btn ${t.playbackRate === r ? "active" : ""}`}
              onClick={() => t.setPlaybackRate(r)}
            >
              {r}×
            </button>
          ))}
        </div>
        <span className="muted ts-clock">
          {fmt(t.currentSecond)} / {fmt(t.durationSeconds)}
        </span>
      </div>
      <input
        className="ts-range"
        type="range"
        min={0}
        max={t.durationSeconds}
        value={t.currentSecond}
        onChange={(e) => t.setSecond(Number(e.target.value))}
      />
    </section>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
