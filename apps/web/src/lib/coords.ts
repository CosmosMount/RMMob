export type Bounds = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};

/** Official playable field size (meters). */
export const DEFAULT_BOUNDS: Bounds = {
  xMin: 0,
  xMax: 28,
  yMin: 0,
  yMax: 15,
};

/**
 * Inset of the playable rectangle inside the top-view JPEG.
 * Fractions calibrated to match LADDER analysis.html FIELD_MAP
 * (pixel 80–2110 × 55–1145 on 2190×1202 → same ratios on our asset).
 */
export const FIELD_IMAGE_INSET = {
  left: 80 / 2190,
  right: 80 / 2190,
  top: 55 / 1202,
  bottom: 57 / 1202,
};

/** Native field image aspect (1683 / 938). */
export const FIELD_IMAGE_ASPECT = 1683 / 938;

export function playableRect(width: number, height: number) {
  const { left, right, top, bottom } = FIELD_IMAGE_INSET;
  const x0 = width * left;
  const y0 = height * top;
  const x1 = width * (1 - right);
  const y1 = height * (1 - bottom);
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

export function worldToMap(
  x: number,
  y: number,
  width: number,
  height: number,
  bounds: Bounds = DEFAULT_BOUNDS
) {
  const rect = playableRect(width, height);
  const u = (x - bounds.xMin) / (bounds.xMax - bounds.xMin);
  const v = (y - bounds.yMin) / (bounds.yMax - bounds.yMin);
  return {
    X: rect.x0 + u * rect.w,
    Y: rect.y0 + (1 - v) * rect.h,
  };
}

export function mapToWorld(
  X: number,
  Y: number,
  width: number,
  height: number,
  bounds: Bounds = DEFAULT_BOUNDS
) {
  const rect = playableRect(width, height);
  const u = (X - rect.x0) / rect.w;
  const v = 1 - (Y - rect.y0) / rect.h;
  return {
    x: bounds.xMin + u * (bounds.xMax - bounds.xMin),
    y: bounds.yMin + v * (bounds.yMax - bounds.yMin),
  };
}
