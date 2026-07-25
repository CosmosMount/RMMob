export type Bounds = {
  xMin: number;
  yMin: number;
  xMax: number;
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
 * Playable rectangle inside the field asset (white apron removed).
 * Tiny inset keeps heat inside the black outer wall ring.
 */
export const FIELD_IMAGE_INSET = {
  left: 0.012,
  right: 0.012,
  top: 0.014,
  bottom: 0.014,
};

/** Cropped field asset aspect (1766 / 947). */
export const FIELD_IMAGE_ASPECT = 1766 / 947;

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
