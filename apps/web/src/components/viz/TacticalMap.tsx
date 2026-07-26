"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  DEFAULT_BOUNDS,
  FIELD_IMAGE_ASPECT,
  worldToMap,
  type Bounds,
} from "@/lib/coords";
import {
  inferAimLinks,
  isBuildingType,
  muzzleTipWorld,
  robotsToMap,
  yawValid,
} from "@/lib/aimTarget";
import { renderSoftHeatmap } from "@/lib/heatmap";
import { publicUrl } from "@/lib/publicUrl";
import { robotNumberLabel } from "@/lib/robotLabel";
import type { HeatmapSample, RobotSnapshot } from "@/lib/types";
import { useRoundTime } from "@/state/roundTime";

const FIELD_SRC = publicUrl("/field/rmuc_2026_field_top_view.jpeg?v=nobg");
/** World-meters length of the short muzzle tick (OfflineRL uses ~1.5 m). */
const MUZZLE_LEN_M = 1.2;

type Traj = {
  robot_id: string;
  team: string;
  points: Array<{ second: number; x: number | null; y: number | null }>;
};

export function TacticalMap({
  robots,
  prevRobots,
  trajectories,
  heatmapSamples,
  bounds = DEFAULT_BOUNDS,
  showHeatmap,
  showTrails,
  showRobots,
  showAim = false,
  focusRobotIds = null,
}: {
  robots: RobotSnapshot[];
  /** Prior-second snapshots for ammo-delta fire gate. */
  prevRobots?: RobotSnapshot[] | null;
  trajectories: Traj[];
  heatmapSamples: HeatmapSample[];
  bounds?: Bounds;
  showHeatmap: boolean;
  showTrails: boolean;
  showRobots: boolean;
  showAim?: boolean;
  /** If set, only draw chassis / aim lines for these ids (candidates still use full `robots`). */
  focusRobotIds?: string[] | null;
}) {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const heatRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fieldImg = useRef<HTMLImageElement | null>(null);
  const t = useRoundTime();

  const focusSet = useMemo(
    () => (focusRobotIds?.length ? new Set(focusRobotIds) : null),
    [focusRobotIds]
  );

  const aimLinks = useMemo(() => {
    if (!showAim) return [];
    const prev = prevRobots?.length ? robotsToMap(prevRobots) : null;
    const links = inferAimLinks(robots, prev);
    if (!focusSet) return links;
    return links.filter((l) => focusSet.has(l.shooterId));
  }, [robots, prevRobots, showAim, focusSet]);

  useEffect(() => {
    const img = new Image();
    img.src = FIELD_SRC;
    img.onload = () => {
      fieldImg.current = img;
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

      // Aim lines (before chassis so dots sit on top)
      if (showAim) {
        for (const link of aimLinks) {
          const a = worldToMap(link.fromX, link.fromY, w, h, bounds);
          const b = worldToMap(link.toX, link.toY, w, h, bounds);
          const col = link.shooterTeam === "红" ? "#e85d5d" : "#5b8def";
          ctx.beginPath();
          ctx.setLineDash(link.firing ? [5, 3] : [4, 5]);
          ctx.moveTo(a.X, a.Y);
          ctx.lineTo(b.X, b.Y);
          ctx.strokeStyle = col;
          ctx.globalAlpha = link.firing ? 0.95 : 0.45 + 0.4 * link.conf;
          ctx.lineWidth = link.firing ? 2.4 : 1.5;
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;

          // Target mark
          ctx.beginPath();
          ctx.arc(b.X, b.Y, isBuildingType(link.targetType) ? 7 : 5, 0, Math.PI * 2);
          ctx.strokeStyle = col;
          ctx.lineWidth = link.firing ? 2 : 1.5;
          ctx.stroke();
          if (isBuildingType(link.targetType)) {
            ctx.beginPath();
            ctx.moveTo(b.X - 5, b.Y);
            ctx.lineTo(b.X + 5, b.Y);
            ctx.moveTo(b.X, b.Y - 5);
            ctx.lineTo(b.X, b.Y + 5);
            ctx.stroke();
          }

          ctx.fillStyle = col;
          ctx.font = "600 10px system-ui, sans-serif";
          ctx.textAlign = "left";
          ctx.textBaseline = "bottom";
          ctx.globalAlpha = 0.9;
          ctx.fillText(link.targetLabel, b.X + 8, b.Y - 4);
          ctx.globalAlpha = 1;
        }
      }

      if (showRobots) {
        for (const r of robots) {
          if (isBuildingType(r.robot_type)) continue;
          if (focusSet && !focusSet.has(r.robot_id)) continue;
          if (r.x == null || r.y == null) continue;
          const { X, Y } = worldToMap(r.x, r.y, w, h, bounds);
          const label = robotNumberLabel(r.robot_id);
          const firing = aimLinks.some(
            (l) => l.shooterId === r.robot_id && l.firing
          );

          if (firing) {
            ctx.beginPath();
            ctx.arc(X, Y, 14, 0, Math.PI * 2);
            ctx.strokeStyle =
              r.team === "红" ? "rgba(232,93,93,0.85)" : "rgba(91,141,239,0.85)";
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          // OfflineRL muzzle: world tip then project
          if (yawValid(r.orientation)) {
            const tip = muzzleTipWorld(r.x, r.y, r.orientation!, MUZZLE_LEN_M);
            const T = worldToMap(tip.x, tip.y, w, h, bounds);
            ctx.beginPath();
            ctx.moveTo(X, Y);
            ctx.lineTo(T.X, T.Y);
            ctx.strokeStyle = r.team === "红" ? "#e85d5d" : "#5b8def";
            ctx.globalAlpha = 0.7;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.globalAlpha = 1;
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
  }, [
    robots,
    trajectories,
    t.currentSecond,
    showTrails,
    showRobots,
    showAim,
    aimLinks,
    bounds,
    focusSet,
  ]);

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
        {showAim
          ? "瞄准由枪口朝向推断（含前哨/基地）· "
          : ""}
        LADDER 60×60 · FotMob touch blobs · {bounds.xMax}×{bounds.yMax}m
      </div>
    </section>
  );
}
