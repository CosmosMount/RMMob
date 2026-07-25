"use client";

import { useEffect, useMemo, useRef } from "react";
import type { MomentumResponse } from "@/lib/types";
import { useRoundTime } from "@/state/roundTime";

const RED = "#e85d5d";
const BLUE = "#5b8def";
const RED_FILL = "rgba(232,93,93,0.55)";
const BLUE_FILL = "rgba(91,141,239,0.55)";

export function MomentumChart({ data }: { data: MomentumResponse | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const t = useRoundTime();
  const points = data?.points || [];

  const tooltip = useMemo(() => {
    if (!points.length) return null;
    const p = points[Math.min(t.currentSecond, points.length - 1)];
    return p;
  }, [points, t.currentSecond]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !points.length) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const pad = 16;
    const mid = h / 2;
    const maxAbs = Math.max(1e-6, ...points.map((p) => Math.abs(p.smoothed)));
    const xAt = (s: number) => pad + (s / Math.max(1, points.length - 1)) * (w - pad * 2);
    const yAt = (v: number) => mid - (v / maxAbs) * (h / 2 - pad);

    // Zero line
    ctx.strokeStyle = "#3a404c";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, mid);
    ctx.lineTo(w - pad, mid);
    ctx.stroke();

    // Positive (red) fill — clipped above zero independently
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad, pad, w - pad * 2, mid - pad);
    ctx.clip();
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = xAt(i);
      const y = yAt(Math.max(0, p.smoothed));
      if (i === 0) ctx.moveTo(x, mid);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(xAt(points.length - 1), mid);
    ctx.closePath();
    ctx.fillStyle = RED_FILL;
    ctx.fill();
    ctx.restore();

    // Negative (blue) fill — clipped below zero independently
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad, mid, w - pad * 2, h - mid - pad);
    ctx.clip();
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = xAt(i);
      const y = yAt(Math.min(0, p.smoothed));
      if (i === 0) ctx.moveTo(x, mid);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(xAt(points.length - 1), mid);
    ctx.closePath();
    ctx.fillStyle = BLUE_FILL;
    ctx.fill();
    ctx.restore();

    // Dual-tone stroke along the curve
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1].smoothed;
      const b = points[i].smoothed;
      const x0 = xAt(i - 1);
      const y0 = yAt(a);
      const x1 = xAt(i);
      const y1 = yAt(b);
      // Segment color by average sign (stronger team cue)
      const avg = (a + b) / 2;
      ctx.strokeStyle = avg >= 0 ? RED : BLUE;
      ctx.lineWidth = 2.25;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    const cx = xAt(t.currentSecond);
    ctx.strokeStyle = "#e8eaed";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, pad);
    ctx.lineTo(cx, h - pad);
    ctx.stroke();
    ctx.setLineDash([]);

    // Cursor tip colored by current momentum
    const cur = points[Math.min(t.currentSecond, points.length - 1)]?.smoothed ?? 0;
    ctx.beginPath();
    ctx.arc(cx, yAt(cur), 4, 0, Math.PI * 2);
    ctx.fillStyle = cur >= 0 ? RED : BLUE;
    ctx.fill();
    ctx.strokeStyle = "#0b0c0f";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [points, t.currentSecond]);

  return (
    <section className="panel">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <strong>Momentum</strong>
        <span className="muted" style={{ fontSize: 12 }}>
          {data?.model_version || "—"} ·{" "}
          <span className="team-red">红 +</span> / <span className="team-blue">蓝 −</span>
        </span>
      </div>
      <canvas ref={canvasRef} style={{ width: "100%", height: 180, display: "block" }} />
      {tooltip && (
        <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          t={tooltip.second}s · smoothed {tooltip.smoothed.toFixed(2)} · raw{" "}
          {tooltip.raw.toFixed(2)}
          {tooltip.dominant_factor ? ` · ${tooltip.dominant_factor}` : ""}
        </div>
      )}
    </section>
  );
}
