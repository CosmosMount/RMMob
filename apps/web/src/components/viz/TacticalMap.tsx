"use client";

import { useEffect, useRef } from "react";
import {
  DEFAULT_BOUNDS,
  FIELD_IMAGE_ASPECT,
  worldToMap,
  type Bounds,
} from "@/lib/coords";
import { renderSoftHeatmap } from "@/lib/heatmap";
import { robotNumberLabel } from "@/lib/robotLabel";
import type { HeatmapSample, RobotSnapshot } from "@/lib/types";
import { useRoundTime } from "@/state/roundTime";

const FIELD_SRC = "/field/rmuc_2026_field_top_view.jpeg?v=nobg";

type Traj = {
  robot_id: string;
  team: string;
  points: Array<{ second: number; x: number | null; y: number | null }>;
};

export function TacticalMap({
  robots,
  trajectories,
  heatmapSamples,
  bounds = DEFAULT_BOUNDS,
  showHeatmap,
  showTrails,
  showRobots,
}: {
  robots: RobotSnapshot[];
  trajectories: Traj[];
  heatmapSamples: HeatmapSample[];
  bounds?: Bounds;
  showHeatmap: boolean;
  showTrails: boolean;
  showRobots: boolean;
}) {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const heatRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fieldImg = useRef<HTMLImageElement | null>(null);
  const t = useRoundTime();

  useEffect(() => {
    const img = new Image();
    img.src = FIELD_SRC;
    img.onload = () => {
      fieldImg.current = img;
      // trigger overlay redraw via custom event on wrap
      wrapRef.current?.dispatchEvent(new Event("field-ready"));
    };
  }, []);

  useEffect(() => {
    if (!showHeatmap || !heatRef.current || !wrapRef.current) return;
    const el = wrapRef.current;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w < 8 || h < 8) return;
    renderSoftHeatmap(heatRef.current, heatmapSamples, w, h, {
      bounds,
      gridSize: 60,
      blobCells: 1.4,
      floor: 0.1,
    });
  }, [heatmapSamples, showHeatmap, bounds]);

  useEffect(() => {
    const canvas = overlayRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w < 8 || h < 8) return;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      if (showTrails) {
        for (const tr of trajectories) {
          ctx.beginPath();
          let started = false;
          for (const p of tr.points) {
            if (p.second > t.currentSecond) break;
            if (p.x == null || p.y == null) continue;
            const { X, Y } = worldToMap(p.x, p.y, w, h, bounds);
            if (!started) {
              ctx.moveTo(X, Y);
              started = true;
            } else ctx.lineTo(X, Y);
          }
          ctx.strokeStyle =
            tr.team === "红" ? "rgba(214,69,69,0.28)" : "rgba(59,111,217,0.28)";
          ctx.lineWidth = 1.25;
          ctx.stroke();
        }
      }

      if (showRobots) {
        for (const r of robots) {
          if (r.robot_type === "基地" || r.robot_type === "前哨站") continue;
          if (r.x == null || r.y == null) continue;
          const { X, Y } = worldToMap(r.x, r.y, w, h, bounds);
          const label = robotNumberLabel(r.robot_id);
          if (r.orientation != null) {
            const rad = ((90 - r.orientation) * Math.PI) / 180;
            ctx.beginPath();
            ctx.moveTo(X + Math.cos(rad) * 8, Y - Math.sin(rad) * 8);
            ctx.lineTo(X + Math.cos(rad) * 16, Y - Math.sin(rad) * 16);
            ctx.strokeStyle = r.team === "红" ? "#e85d5d" : "#5b8def";
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.arc(X, Y, 9, 0, Math.PI * 2);
          ctx.fillStyle = r.team === "红" ? "#d64545" : "#3b6fd9";
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = "#fff";
          ctx.font = "bold 10px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, X, Y + 0.5);
        }
      }
    };

    draw();
    wrap.addEventListener("field-ready", draw);
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => {
      wrap.removeEventListener("field-ready", draw);
      ro.disconnect();
    };
  }, [robots, trajectories, t.currentSecond, showTrails, showRobots, bounds]);

  // Re-render heat on resize
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !showHeatmap) return;
    const ro = new ResizeObserver(() => {
      if (!heatRef.current) return;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      renderSoftHeatmap(heatRef.current, heatmapSamples, w, h, {
        bounds,
        gridSize: 60,
        blobCells: 1.4,
        floor: 0.1,
      });
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [heatmapSamples, showHeatmap, bounds]);

  return (
    <section className="panel map-panel">
      <div
        ref={wrapRef}
        className="field-stage"
        style={{ aspectRatio: `${FIELD_IMAGE_ASPECT}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="field-bg" src={FIELD_SRC} alt="RMUC field" draggable={false} />
        {showHeatmap && (
          <canvas ref={heatRef} className="field-layer field-heat" aria-hidden />
        )}
        <canvas ref={overlayRef} className="field-layer field-overlay" aria-hidden />
      </div>
      <div className="map-caption muted">
        LADDER 60×60 · FotMob touch blobs · {bounds.xMax}×{bounds.yMax}m
      </div>
    </section>
  );
}
