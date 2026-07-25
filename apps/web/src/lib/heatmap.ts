import { playableRect, worldToMap, type Bounds, DEFAULT_BOUNDS } from "./coords";

export type HeatSample = { x: number; y: number; weight?: number };

export type HeatmapRenderOptions = {
  bounds?: Bounds;
  /** LADDER grid size (default 60). */
  gridSize?: number;
  /** Blob radius relative to one grid cell — keep modest like FotMob touches. */
  blobCells?: number;
  /** Skip cells below this share of max (keeps map from becoming a solid carpet). */
  floor?: number;
};

/** LADDER export_position_data.coord_to_grid */
export function coordToGrid(
  x: number,
  y: number,
  bounds: Bounds,
  gridSize = 60
): { gx: number; gy: number } {
  const xRange = bounds.xMax - bounds.xMin || 1;
  const yRange = bounds.yMax - bounds.yMin || 1;
  let gx = Math.trunc(((x - bounds.xMin) / xRange) * (gridSize - 1));
  let gy = Math.trunc(((y - bounds.yMin) / yRange) * (gridSize - 1));
  gx = Math.max(0, Math.min(gridSize - 1, gx));
  gy = Math.max(0, Math.min(gridSize - 1, gy));
  return { gx, gy };
}

/**
 * One FotMob-style touch blob: green rim → yellow → orange core.
 * Drawn with source-over (no additive carpet / no post blur colorize).
 */
function fillFotmobBlob(
  ctx: CanvasRenderingContext2D,
  X: number,
  Y: number,
  radius: number,
  intensity: number
): void {
  const t = Math.max(0, Math.min(1, intensity));
  const a = 0.22 + t * 0.55;
  const g = ctx.createRadialGradient(X, Y, 0, X, Y, radius);
  // core orange (hot)
  g.addColorStop(0, `rgba(255, 140, 20, ${a})`);
  // mid yellow
  g.addColorStop(0.35, `rgba(210, 220, 50, ${a * 0.55})`);
  // outer green, fades out
  g.addColorStop(0.72, `rgba(50, 170, 70, ${a * 0.22})`);
  g.addColorStop(1, "rgba(40, 150, 60, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(X, Y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Build: LADDER 60×60 count grid.
 * Form: FotMob discrete soft circles (not a solid wash, not hard squares).
 */
export function renderSoftHeatmap(
  target: HTMLCanvasElement,
  samples: HeatSample[],
  displayWidth: number,
  displayHeight: number,
  options: HeatmapRenderOptions = {}
): void {
  const bounds = options.bounds ?? DEFAULT_BOUNDS;
  const gridSize = options.gridSize ?? 60;
  const blobCells = options.blobCells ?? 1.35;
  const floor = options.floor ?? 0.08;

  const w = Math.max(1, Math.round(displayWidth));
  const h = Math.max(1, Math.round(displayHeight));
  const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
  const rw = Math.round(w * dpr);
  const rh = Math.round(h * dpr);
  target.width = rw;
  target.height = rh;
  target.style.width = `${w}px`;
  target.style.height = `${h}px`;

  const ctx = target.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, rw, rh);
  if (!samples.length) return;

  // ── LADDER accumulate ──
  const grid: number[][] = Array.from({ length: gridSize }, () =>
    Array(gridSize).fill(0)
  );
  for (const s of samples) {
    if (s.x < bounds.xMin || s.x > bounds.xMax || s.y < bounds.yMin || s.y > bounds.yMax) {
      continue;
    }
    const { gx, gy } = coordToGrid(s.x, s.y, bounds, gridSize);
    grid[gy][gx] += s.weight ?? 1;
  }

  // Collect occupied cells
  type Cell = { gx: number; gy: number; count: number };
  const cells: Cell[] = [];
  let maxVal = 0;
  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const c = grid[gy][gx];
      if (c <= 0) continue;
      cells.push({ gx, gy, count: c });
      if (c > maxVal) maxVal = c;
    }
  }
  if (maxVal <= 0 || !cells.length) return;

  // Log scale so a few hot cells don't force everything else invisible,
  // and the field doesn't fill with mid-orange wash.
  const logMax = Math.log1p(maxVal);
  const scored = cells
    .map((c) => ({
      ...c,
      intensity: Math.log1p(c.count) / logMax,
    }))
    .filter((c) => c.intensity >= floor)
    .sort((a, b) => a.intensity - b.intensity); // draw hot on top

  const rect = playableRect(rw, rh);
  const cellPx = Math.max(rect.w, rect.h) / gridSize;
  const xStep = (bounds.xMax - bounds.xMin) / gridSize;
  const yStep = (bounds.yMax - bounds.yMin) / gridSize;
  const radius = cellPx * blobCells;

  ctx.save();
  // Clip to playable area first
  ctx.beginPath();
  ctx.rect(rect.x0, rect.y0, rect.w, rect.h);
  ctx.clip();

  for (const c of scored) {
    const gameX = bounds.xMin + (c.gx + 0.5) * xStep;
    const gameY = bounds.yMin + (c.gy + 0.5) * yStep;
    const { X, Y } = worldToMap(gameX, gameY, rw, rh, bounds);
    // Slightly larger blob for hotter cells (still discrete spots)
    const r = radius * (0.85 + 0.35 * c.intensity);
    fillFotmobBlob(ctx, X, Y, r, c.intensity);
  }

  ctx.restore();
}

export const renderLadderHeatmap = renderSoftHeatmap;
