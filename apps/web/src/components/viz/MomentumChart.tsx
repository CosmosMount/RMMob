"use client";

import { useEffect, useMemo, useRef } from "react";
import type { MomentumPoint, MomentumResponse } from "@/lib/types";
import { useRoundTime } from "@/state/roundTime";

const RED = "#e85d5d";
const BLUE = "#5b8def";
const RED_FILL = "rgba(232,93,93,0.45)";
const BLUE_FILL = "rgba(91,141,239,0.45)";

function teamLevels(p: MomentumPoint): { red: number; blue: number } {
  if (p.red_smoothed != null && p.blue_smoothed != null) {
    return { red: Math.max(0, p.red_smoothed), blue: Math.max(0, p.blue_smoothed) };
  }
  // Legacy fixture: only signed net — split into one-sided fills
  return {
    red: Math.max(0, p.smoothed),
    blue: Math.max(0, -p.smoothed),
  };
}

export function MomentumChart({ data }: { data: MomentumResponse | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const t = useRoundTime();
  const points = data?.points || [];

  const tooltip = useMemo(() => {
    if (!points.length) return null;
    return points[Math.min(t.currentSecond, points.length - 1)]!;
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
    const levels = points.map(teamLevels);
    const maxAbs = Math.max(
      1e-6,
      ...levels.map((l) => l.red),
      ...levels.map((l) => l.blue),
      ...points.map((p) => Math.abs(p.smoothed))
    );
    const xAt = (s: number) => pad + (s / Math.max(1, points.length - 1)) * (w - pad * 2);
    const yUp = (v: number) => mid - (v / maxAbs) * (h / 2 - pad);
    const yDown = (v: number) => mid + (v / maxAbs) * (h / 2 - pad);

    // Zero line
    ctx.strokeStyle = "#3a404c";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, mid);
    ctx.lineTo(w - pad, mid);
    ctx.stroke();

    // Red strength (always above zero)
    ctx.beginPath();
    levels.forEach((l, i) => {
      const x = xAt(i);
      const y = yUp(l.red);
      if (i === 0) ctx.moveTo(x, mid);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(xAt(points.length - 1), mid);
    ctx.closePath();
    ctx.fillStyle = RED_FILL;
    ctx.fill();

    // Blue strength (always below zero)
    ctx.beginPath();
    levels.forEach((l, i) => {
      const x = xAt(i);
      const y = yDown(l.blue);
      if (i === 0) ctx.moveTo(x, mid);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(xAt(points.length - 1), mid);
    ctx.closePath();
    ctx.fillStyle = BLUE_FILL;
    ctx.fill();

    // Envelope strokes
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    levels.forEach((l, i) => {
      const x = xAt(i);
      const y = yUp(l.red);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = RED;
    ctx.stroke();

    ctx.beginPath();
    levels.forEach((l, i) => {
      const x = xAt(i);
      const y = yDown(l.blue);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = BLUE;
    ctx.stroke();

    // Thin signed net curve (advantage)
    const ySigned = (v: number) => mid - (v / maxAbs) * (h / 2 - pad);
    ctx.lineWidth = 1.25;
    ctx.globalAlpha = 0.85;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!.smoothed;
      const b = points[i]!.smoothed;
      ctx.strokeStyle = (a + b) / 2 >= 0 ? RED : BLUE;
      ctx.beginPath();
      ctx.moveTo(xAt(i - 1), ySigned(a));
      ctx.lineTo(xAt(i), ySigned(b));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const cx = xAt(t.currentSecond);
    ctx.strokeStyle = "#e8eaed";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, pad);
    ctx.lineTo(cx, h - pad);
    ctx.stroke();
    ctx.setLineDash([]);

    const cur = points[Math.min(t.currentSecond, points.length - 1)]!;
    const curLv = teamLevels(cur);

    // Team tips
    ctx.beginPath();
    ctx.arc(cx, yUp(curLv.red), 3.5, 0, Math.PI * 2);
    ctx.fillStyle = RED;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, yDown(curLv.blue), 3.5, 0, Math.PI * 2);
    ctx.fillStyle = BLUE;
    ctx.fill();

    // Net tip
    ctx.beginPath();
    ctx.arc(cx, ySigned(cur.smoothed), 4, 0, Math.PI * 2);
    ctx.fillStyle = cur.smoothed >= 0 ? RED : BLUE;
    ctx.fill();
    ctx.strokeStyle = "#0b0c0f";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [points, t.currentSecond]);

  const tipLv = tooltip ? teamLevels(tooltip) : null;

  return (
    <section className="panel">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <strong>Momentum</strong>
        <span className="muted" style={{ fontSize: 12 }}>
          {data?.model_version || "—"} ·{" "}
          <span className="team-red">红强度</span> / <span className="team-blue">蓝强度</span>
          {" · "}细线=净优势
        </span>
      </div>
      <canvas ref={canvasRef} style={{ width: "100%", height: 180, display: "block" }} />
      {tooltip && tipLv && (
        <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          t={tooltip.second}s ·{" "}
          <span className="team-red">红 {tipLv.red.toFixed(2)}</span>
          {" · "}
          <span className="team-blue">蓝 {tipLv.blue.toFixed(2)}</span>
          {" · "}净优势 {tooltip.smoothed.toFixed(2)}
          {tooltip.dominant_factor ? ` · ${tooltip.dominant_factor}` : ""}
        </div>
      )}
    </section>
  );
}
